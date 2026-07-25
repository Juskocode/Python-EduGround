import type {
  TutorModelClient,
  TutorModelMessage,
  TutorModelResult,
} from "./types.js";

const DEFAULT_ALLOWED_HOSTS = ["localhost", "127.0.0.1", "::1", "ollama"];
const DEFAULT_MODEL = "llama3.1:8b";
const MAX_RESPONSE_BYTES = 256 * 1024;

function integerSetting(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const raw = environment[name];
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/u.test(raw)) {
    throw new Error(`${name} must be a whole number from ${minimum} to ${maximum}.`);
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be a whole number from ${minimum} to ${maximum}.`);
  }
  return parsed;
}

function normalizeHost(hostname: string): string {
  return hostname.replace(/^\[|\]$/gu, "").toLowerCase();
}

function allowedHosts(environment: NodeJS.ProcessEnv): ReadonlySet<string> {
  const raw = environment.OLLAMA_ALLOWED_HOSTS;
  const values = raw
    ? raw.split(",").map((value) => normalizeHost(value.trim())).filter(Boolean)
    : DEFAULT_ALLOWED_HOSTS;
  if (values.length === 0) throw new Error("OLLAMA_ALLOWED_HOSTS cannot be empty.");
  return new Set(values);
}

export interface OllamaConfiguration {
  readonly baseUrl: URL;
  readonly model: string;
  readonly requestTimeoutMs: number;
  readonly maximumAnswerTokens: number;
  readonly contextWindowTokens: number;
  readonly keepAlive: string;
}

export function readOllamaConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): OllamaConfiguration {
  const baseUrl = new URL(environment.OLLAMA_BASE_URL || "http://127.0.0.1:11434");
  if (!["http:", "https:"].includes(baseUrl.protocol)) {
    throw new Error("OLLAMA_BASE_URL must use http or https.");
  }
  if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error("OLLAMA_BASE_URL cannot contain credentials, a query, or a fragment.");
  }
  if (baseUrl.pathname !== "/" && baseUrl.pathname !== "") {
    throw new Error("OLLAMA_BASE_URL must not contain a path.");
  }
  if (!allowedHosts(environment).has(normalizeHost(baseUrl.hostname))) {
    throw new Error(
      `OLLAMA_BASE_URL host is not allowlisted by OLLAMA_ALLOWED_HOSTS: ${baseUrl.hostname}`
    );
  }

  const model = (environment.OLLAMA_MODEL || DEFAULT_MODEL).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u.test(model)) {
    throw new Error("OLLAMA_MODEL contains unsupported characters.");
  }
  const keepAlive = (environment.OLLAMA_KEEP_ALIVE || "10m").trim();
  if (!/^(?:0|-1|\d+[smh])$/u.test(keepAlive)) {
    throw new Error("OLLAMA_KEEP_ALIVE must be 0, -1, or a duration such as 10m.");
  }

  return Object.freeze({
    baseUrl,
    model,
    requestTimeoutMs: integerSetting(
      environment,
      "OLLAMA_REQUEST_TIMEOUT_MS",
      60_000,
      5_000,
      180_000
    ),
    maximumAnswerTokens: integerSetting(
      environment,
      "RAG_MAX_ANSWER_TOKENS",
      420,
      64,
      1_024
    ),
    contextWindowTokens: integerSetting(
      environment,
      "RAG_MODEL_CONTEXT_TOKENS",
      4_096,
      2_048,
      16_384
    ),
    keepAlive,
  });
}

export class OllamaClientError extends Error {
  readonly code:
    | "OLLAMA_TIMEOUT"
    | "OLLAMA_UNAVAILABLE"
    | "OLLAMA_BAD_RESPONSE"
    | "OLLAMA_CANCELLED";

  constructor(
    code:
      | "OLLAMA_TIMEOUT"
      | "OLLAMA_UNAVAILABLE"
      | "OLLAMA_BAD_RESPONSE"
      | "OLLAMA_CANCELLED",
    message: string,
    cause?: unknown
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "OllamaClientError";
    this.code = code;
  }
}

interface OllamaClientOptions {
  readonly configuration?: OllamaConfiguration;
  readonly environment?: NodeJS.ProcessEnv;
  readonly fetchImplementation?: typeof fetch;
}

async function readBoundedResponse(
  response: Response,
  maximumBytes: number
): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new OllamaClientError(
      "OLLAMA_BAD_RESPONSE",
      "The classroom tutor returned an oversized response."
    );
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        throw new OllamaClientError(
          "OLLAMA_BAD_RESPONSE",
          "The classroom tutor returned an oversized response."
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)),
    totalBytes
  ).toString("utf8");
}

function usageFromPayload(payload: Record<string, unknown>): TutorModelResult["usage"] {
  const promptTokens =
    typeof payload.prompt_eval_count === "number" ? payload.prompt_eval_count : undefined;
  const completionTokens =
    typeof payload.eval_count === "number" ? payload.eval_count : undefined;
  const totalDurationMs =
    typeof payload.total_duration === "number"
      ? Math.round(payload.total_duration / 1_000_000)
      : undefined;
  if (
    promptTokens === undefined &&
    completionTokens === undefined &&
    totalDurationMs === undefined
  ) {
    return undefined;
  }
  return {
    ...(promptTokens === undefined ? {} : { promptTokens }),
    ...(completionTokens === undefined ? {} : { completionTokens }),
    ...(totalDurationMs === undefined ? {} : { totalDurationMs }),
  };
}

export function createOllamaClient(options: OllamaClientOptions = {}): TutorModelClient {
  const configuration =
    options.configuration || readOllamaConfiguration(options.environment);
  const fetchImplementation = options.fetchImplementation || globalThis.fetch;
  if (typeof fetchImplementation !== "function") {
    throw new Error("A Fetch-compatible implementation is required for Ollama.");
  }
  const endpoint = new URL("/api/chat", configuration.baseUrl);

  return Object.freeze({
    model: configuration.model,
    async chat(
      messages: readonly TutorModelMessage[],
      chatOptions: { readonly signal?: AbortSignal } = {}
    ): Promise<TutorModelResult> {
      const timeoutSignal = AbortSignal.timeout(configuration.requestTimeoutMs);
      const signal = chatOptions.signal
        ? AbortSignal.any([chatOptions.signal, timeoutSignal])
        : timeoutSignal;

      let response: Response;
      try {
        response = await fetchImplementation(endpoint, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: configuration.model,
            stream: false,
            keep_alive: configuration.keepAlive,
            messages,
            options: {
              num_ctx: configuration.contextWindowTokens,
              num_predict: configuration.maximumAnswerTokens,
              repeat_penalty: 1.1,
              temperature: 0.2,
              top_p: 0.9,
            },
          }),
          redirect: "error",
          signal,
        });
      } catch (error) {
        if (chatOptions.signal?.aborted) {
          throw new OllamaClientError(
            "OLLAMA_CANCELLED",
            "The learner cancelled the tutor request.",
            error
          );
        }
        if (timeoutSignal.aborted || error instanceof DOMException && error.name === "TimeoutError") {
          throw new OllamaClientError(
            "OLLAMA_TIMEOUT",
            "The classroom tutor took too long to respond.",
            error
          );
        }
        throw new OllamaClientError(
          "OLLAMA_UNAVAILABLE",
          "The classroom tutor model is unavailable.",
          error
        );
      }

      let responseText: string;
      try {
        responseText = await readBoundedResponse(response, MAX_RESPONSE_BYTES);
      } catch (error) {
        if (error instanceof OllamaClientError) throw error;
        if (chatOptions.signal?.aborted) {
          throw new OllamaClientError(
            "OLLAMA_CANCELLED",
            "The learner cancelled the tutor request.",
            error
          );
        }
        if (timeoutSignal.aborted) {
          throw new OllamaClientError(
            "OLLAMA_TIMEOUT",
            "The classroom tutor took too long to respond.",
            error
          );
        }
        throw new OllamaClientError(
          "OLLAMA_BAD_RESPONSE",
          "The classroom tutor response could not be read.",
          error
        );
      }
      if (!response.ok) {
        throw new OllamaClientError(
          "OLLAMA_UNAVAILABLE",
          `The classroom tutor model returned HTTP ${response.status}.`
        );
      }

      let payload: unknown;
      try {
        payload = JSON.parse(responseText);
      } catch (error) {
        throw new OllamaClientError(
          "OLLAMA_BAD_RESPONSE",
          "The classroom tutor returned invalid JSON.",
          error
        );
      }
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new OllamaClientError(
          "OLLAMA_BAD_RESPONSE",
          "The classroom tutor returned an invalid response."
        );
      }
      const record = payload as Record<string, unknown>;
      const message = record.message;
      const answer =
        message && typeof message === "object" && !Array.isArray(message)
          ? (message as Record<string, unknown>).content
          : undefined;
      if (typeof answer !== "string" || !answer.trim()) {
        throw new OllamaClientError(
          "OLLAMA_BAD_RESPONSE",
          "The classroom tutor returned an empty answer."
        );
      }

      const usage = usageFromPayload(record);
      return {
        answer: answer.trim().slice(0, 12_000),
        model:
          typeof record.model === "string" && record.model.trim()
            ? record.model
            : configuration.model,
        ...(usage === undefined ? {} : { usage }),
      };
    },
  });
}
