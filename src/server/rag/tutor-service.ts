import { createHash, randomUUID } from "node:crypto";

import { OllamaClientError } from "./ollama-client.js";
import { buildTutorMessages } from "./prompt-guard.js";
import { PublicClassroomRepository } from "./public-classroom-content.js";
import { retrieveChapterKnowledge } from "./retrieval.js";
import {
  isChapterId,
  TutorError,
  type TutorChatRequest,
  type TutorChatResponse,
  type TutorModelClient,
} from "./types.js";

const CONVERSATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/u;

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
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be a whole number from ${minimum} to ${maximum}.`);
  }
  return value;
}

function booleanSetting(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: boolean
): boolean {
  const raw = environment[name];
  if (raw === undefined || raw === "") return fallback;
  if (["1", "true", "yes", "on"].includes(raw.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(raw.toLowerCase())) return false;
  throw new Error(`${name} must be true or false.`);
}

export interface TutorServiceConfiguration {
  readonly enabled: boolean;
  readonly maximumMessageCharacters: number;
  readonly maximumContextChunks: number;
  readonly maximumContextCharacters: number;
  readonly maximumConcurrentRequests: number;
  readonly maximumQueueDepth: number;
  readonly queueTimeoutMs: number;
  readonly responseCacheTtlMs: number;
  readonly maximumCachedResponses: number;
}

export function readTutorServiceConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): TutorServiceConfiguration {
  return Object.freeze({
    enabled: booleanSetting(environment, "RAG_ENABLED", false),
    maximumMessageCharacters: integerSetting(
      environment,
      "RAG_MAX_MESSAGE_CHARACTERS",
      1_200,
      200,
      8_000
    ),
    maximumContextChunks: integerSetting(
      environment,
      "RAG_MAX_CONTEXT_CHUNKS",
      4,
      1,
      8
    ),
    maximumContextCharacters: integerSetting(
      environment,
      "RAG_MAX_CONTEXT_CHARACTERS",
      8_000,
      1_000,
      20_000
    ),
    maximumConcurrentRequests: integerSetting(
      environment,
      "RAG_MAX_CONCURRENT_REQUESTS",
      1,
      1,
      8
    ),
    maximumQueueDepth: integerSetting(
      environment,
      "RAG_MAX_QUEUE_DEPTH",
      20,
      0,
      100
    ),
    queueTimeoutMs: integerSetting(
      environment,
      "RAG_QUEUE_TIMEOUT_MS",
      15_000,
      1_000,
      60_000
    ),
    responseCacheTtlMs: integerSetting(
      environment,
      "RAG_RESPONSE_CACHE_TTL_MS",
      5 * 60_000,
      0,
      60 * 60_000
    ),
    maximumCachedResponses: integerSetting(
      environment,
      "RAG_MAX_CACHED_RESPONSES",
      100,
      0,
      1_000
    ),
  });
}

interface CapacityWaiter {
  readonly resolve: () => void;
  readonly reject: (error: TutorError) => void;
  readonly timer: NodeJS.Timeout;
  readonly signal: AbortSignal | undefined;
  readonly abortListener: (() => void) | undefined;
}

class CapacityGate {
  readonly #maximumConcurrent: number;
  readonly #maximumQueueDepth: number;
  readonly #queueTimeoutMs: number;
  #active = 0;
  readonly #waiters: CapacityWaiter[] = [];

  constructor(maximumConcurrent: number, maximumQueueDepth: number, queueTimeoutMs: number) {
    this.#maximumConcurrent = maximumConcurrent;
    this.#maximumQueueDepth = maximumQueueDepth;
    this.#queueTimeoutMs = queueTimeoutMs;
  }

  async run<T>(
    operation: () => Promise<T>,
    signal: AbortSignal | undefined
  ): Promise<T> {
    await this.#acquire(signal);
    try {
      return await operation();
    } finally {
      this.#release();
    }
  }

  async #acquire(signal: AbortSignal | undefined): Promise<void> {
    if (signal?.aborted) {
      throw new TutorError(499, "TUTOR_CANCELLED", "The tutor request was cancelled.");
    }
    if (this.#active < this.#maximumConcurrent) {
      this.#active += 1;
      return;
    }
    if (this.#waiters.length >= this.#maximumQueueDepth) {
      throw new TutorError(
        429,
        "TUTOR_RATE_LIMITED",
        "The classroom tutor is busy. Try again shortly.",
        { retryAfterSeconds: Math.max(1, Math.ceil(this.#queueTimeoutMs / 1_000)) }
      );
    }
    await new Promise<void>((resolve, reject) => {
      const abortListener = signal
        ? () => {
            const index = this.#waiters.indexOf(waiter);
            if (index >= 0) this.#waiters.splice(index, 1);
            clearTimeout(waiter.timer);
            reject(new TutorError(499, "TUTOR_CANCELLED", "The tutor request was cancelled."));
          }
        : undefined;
      const waiter: CapacityWaiter = {
        resolve: () => {
          if (signal && abortListener) signal.removeEventListener("abort", abortListener);
          resolve();
        },
        reject,
        timer: setTimeout(() => {
          const index = this.#waiters.indexOf(waiter);
          if (index >= 0) this.#waiters.splice(index, 1);
          if (signal && abortListener) signal.removeEventListener("abort", abortListener);
          reject(
            new TutorError(
              429,
              "TUTOR_RATE_LIMITED",
              "The classroom tutor queue is full. Try again shortly.",
              { retryAfterSeconds: 5 }
            )
          );
        }, this.#queueTimeoutMs),
        signal,
        abortListener,
      };
      waiter.timer.unref();
      this.#waiters.push(waiter);
      if (signal && abortListener) signal.addEventListener("abort", abortListener, { once: true });
    });
  }

  #release(): void {
    const waiter = this.#waiters.shift();
    if (waiter) {
      clearTimeout(waiter.timer);
      if (waiter.signal && waiter.abortListener) {
        waiter.signal.removeEventListener("abort", waiter.abortListener);
      }
      waiter.resolve();
      return;
    }
    this.#active -= 1;
  }
}

interface CacheEntry {
  readonly expiresAt: number;
  readonly response: Omit<TutorChatResponse, "conversationId" | "usage"> & {
    readonly usage?: Omit<NonNullable<TutorChatResponse["usage"]>, "cached">;
  };
}

export interface ChapterTutorServiceOptions {
  readonly repository?: PublicClassroomRepository;
  readonly modelClient: TutorModelClient;
  readonly configuration?: TutorServiceConfiguration;
  readonly environment?: NodeJS.ProcessEnv;
  readonly now?: () => number;
  readonly createConversationId?: () => string;
}

export interface TutorAskOptions {
  readonly signal?: AbortSignal;
}

export class ChapterTutorService {
  readonly #repository: PublicClassroomRepository;
  readonly #modelClient: TutorModelClient;
  readonly #configuration: TutorServiceConfiguration;
  readonly #capacity: CapacityGate;
  readonly #cache = new Map<string, CacheEntry>();
  readonly #now: () => number;
  readonly #createConversationId: () => string;

  constructor(options: ChapterTutorServiceOptions) {
    this.#repository = options.repository || new PublicClassroomRepository();
    this.#modelClient = options.modelClient;
    this.#configuration =
      options.configuration || readTutorServiceConfiguration(options.environment);
    this.#capacity = new CapacityGate(
      this.#configuration.maximumConcurrentRequests,
      this.#configuration.maximumQueueDepth,
      this.#configuration.queueTimeoutMs
    );
    this.#now = options.now || Date.now;
    this.#createConversationId = options.createConversationId || randomUUID;
  }

  async ask(
    request: TutorChatRequest,
    options: TutorAskOptions = {}
  ): Promise<TutorChatResponse> {
    if (!this.#configuration.enabled) {
      throw new TutorError(
        503,
        "TUTOR_DISABLED",
        "The classroom tutor is not enabled for this deployment."
      );
    }
    if (!isChapterId(request.chapterId)) {
      throw new TutorError(404, "CHAPTER_NOT_FOUND", "The requested chapter does not exist.");
    }
    if (typeof request.message !== "string") {
      throw new TutorError(400, "INVALID_INPUT", "message must be a string.");
    }
    const message = request.message.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "").trim();
    if (!message || message.length > this.#configuration.maximumMessageCharacters) {
      throw new TutorError(
        400,
        "INVALID_INPUT",
        `message must contain between 1 and ${this.#configuration.maximumMessageCharacters} characters.`
      );
    }
    if (
      request.conversationId !== undefined &&
      (typeof request.conversationId !== "string" ||
        !CONVERSATION_ID_PATTERN.test(request.conversationId))
    ) {
      throw new TutorError(400, "INVALID_INPUT", "conversationId is invalid.");
    }
    const conversationId = request.conversationId || this.#createConversationId();
    const cacheKey = createHash("sha256")
      .update(request.chapterId)
      .update("\0")
      .update(message.toLowerCase().replace(/\s+/gu, " "))
      .digest("base64url");
    const cached = this.#readCache(cacheKey);
    if (cached) {
      return {
        ...cached,
        conversationId,
        usage: { ...cached.usage, cached: true },
      };
    }

    const chunks = await this.#repository.getChapterChunks(request.chapterId);
    if (chunks.length === 0) {
      throw new TutorError(
        404,
        "CHAPTER_NOT_FOUND",
        "No solution-free classroom material exists for this chapter."
      );
    }
    const retrieved = retrieveChapterKnowledge(chunks, message, {
      maximumChunks: this.#configuration.maximumContextChunks,
      maximumContextCharacters: this.#configuration.maximumContextCharacters,
    });
    const modelMessages = buildTutorMessages(request.chapterId, message, retrieved);

    let result;
    try {
      result = await this.#capacity.run(
        () =>
          this.#modelClient.chat(
            modelMessages,
            options.signal === undefined ? {} : { signal: options.signal }
          ),
        options.signal
      );
    } catch (error) {
      if (error instanceof TutorError) throw error;
      if (error instanceof OllamaClientError && error.code === "OLLAMA_CANCELLED") {
        throw new TutorError(499, "TUTOR_CANCELLED", error.message, { cause: error });
      }
      if (error instanceof OllamaClientError && error.code === "OLLAMA_TIMEOUT") {
        throw new TutorError(504, "TUTOR_TIMEOUT", error.message, { cause: error });
      }
      if (error instanceof OllamaClientError) {
        throw new TutorError(503, "TUTOR_UNAVAILABLE", error.message, { cause: error });
      }
      throw new TutorError(
        503,
        "TUTOR_UNAVAILABLE",
        "The classroom tutor is temporarily unavailable.",
        { cause: error }
      );
    }

    const citationKeys = new Set<string>();
    const citations = retrieved.flatMap(({ chunk }) => {
      const key = `${chunk.title}\0${chunk.section}`;
      if (citationKeys.has(key)) return [];
      citationKeys.add(key);
      return [{ title: chunk.title, section: chunk.section }];
    });
    const responseWithoutConversation: CacheEntry["response"] = {
      answer: result.answer,
      citations,
      model: result.model,
      ...(result.usage === undefined ? {} : { usage: result.usage }),
    };
    this.#writeCache(cacheKey, responseWithoutConversation);
    return {
      ...responseWithoutConversation,
      conversationId,
      usage: { ...result.usage, cached: false },
    };
  }

  status(): { readonly enabled: boolean; readonly model: string } {
    return {
      enabled: this.#configuration.enabled,
      model: this.#modelClient.model,
    };
  }

  #readCache(cacheKey: string): CacheEntry["response"] | null {
    const cached = this.#cache.get(cacheKey);
    if (!cached) return null;
    if (cached.expiresAt <= this.#now()) {
      this.#cache.delete(cacheKey);
      return null;
    }
    this.#cache.delete(cacheKey);
    this.#cache.set(cacheKey, cached);
    return cached.response;
  }

  #writeCache(cacheKey: string, response: CacheEntry["response"]): void {
    if (
      this.#configuration.responseCacheTtlMs === 0 ||
      this.#configuration.maximumCachedResponses === 0
    ) {
      return;
    }
    this.#cache.set(cacheKey, {
      expiresAt: this.#now() + this.#configuration.responseCacheTtlMs,
      response,
    });
    while (this.#cache.size > this.#configuration.maximumCachedResponses) {
      const oldestKey = this.#cache.keys().next().value;
      if (oldestKey === undefined) break;
      this.#cache.delete(oldestKey);
    }
  }
}
