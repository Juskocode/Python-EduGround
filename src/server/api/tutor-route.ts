import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import { readJson, requireMethod, sendJson } from "../http/responses.js";
import { ChapterTutorService } from "../rag/tutor-service.js";
import { TutorError } from "../rag/types.js";
import {
  RequestPolicyError,
  assertSameOrigin,
  readSessionCookie,
  requestClientIp,
} from "../security/runtime-policy.js";

export interface TutorRouteOptions {
  readonly service: ChapterTutorService;
  readonly environment?: NodeJS.ProcessEnv;
  readonly now?: () => number;
}

interface RateLimitEntry {
  count: number;
  readonly resetAt: number;
}

const RATE_LIMIT_MAXIMUM_KEYS = 10_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const ALLOWED_CHAT_FIELDS = new Set(["chapterId", "message", "conversationId"]);
const TUTOR_CLIENT_HEADER = "x-eduground-tutor-client";
const TUTOR_CLIENT_PATTERN = /^[A-Za-z0-9_-]{32,128}$/u;

function boundedRequestsPerMinute(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  maximum: number
): number {
  const raw = environment[name] || String(fallback);
  if (!/^\d+$/u.test(raw)) {
    throw new Error(`${name} must be a whole number from 1 to ${maximum}.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be a whole number from 1 to ${maximum}.`);
  }
  return value;
}

function hashActor(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function requestActorKey(request: IncomingMessage, clientIp: string): string {
  const sessionToken = readSessionCookie(request);
  if (sessionToken) return `session:${hashActor(sessionToken)}`;
  const tutorClient = String(request.headers[TUTOR_CLIENT_HEADER] || "");
  if (TUTOR_CLIENT_PATTERN.test(tutorClient)) {
    return `client:${hashActor(tutorClient)}`;
  }
  return `ip:${clientIp}`;
}

export function createTutorRouteHandler({
  service,
  environment = process.env,
  now = Date.now,
}: TutorRouteOptions) {
  const maximumRequestsPerMinute = boundedRequestsPerMinute(
    environment,
    "RAG_REQUESTS_PER_MINUTE",
    4,
    120
  );
  const maximumIpRequestsPerMinute = boundedRequestsPerMinute(
    environment,
    "RAG_IP_REQUESTS_PER_MINUTE",
    Math.max(80, maximumRequestsPerMinute * 20),
    2_400
  );
  const actorRateLimits = new Map<string, RateLimitEntry>();
  const ipRateLimits = new Map<string, RateLimitEntry>();
  const activeActors = new Set<string>();

  function enforceRateLimit(
    rateLimits: Map<string, RateLimitEntry>,
    key: string,
    maximum: number,
    message: string
  ): void {
    const currentTime = now();
    const existing = rateLimits.get(key);
    if (!existing || existing.resetAt <= currentTime) {
      if (!existing && rateLimits.size >= RATE_LIMIT_MAXIMUM_KEYS) {
        const oldestKey = rateLimits.keys().next().value;
        if (oldestKey !== undefined) rateLimits.delete(oldestKey);
      }
      rateLimits.set(key, {
        count: 1,
        resetAt: currentTime + RATE_LIMIT_WINDOW_MS,
      });
      return;
    }
    existing.count += 1;
    if (existing.count > maximum) {
      throw new TutorError(
        429,
        "TUTOR_RATE_LIMITED",
        message,
        {
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((existing.resetAt - currentTime) / 1_000)
          ),
        }
      );
    }
  }

  return async function handleTutorRoute(
    request: IncomingMessage,
    response: ServerResponse,
    requestUrl: URL
  ): Promise<boolean> {
    if (requestUrl.pathname === "/api/tutor/status") {
      try {
        requireMethod(request, ["GET", "HEAD"]);
        const status = service.status();
        sendJson(
          response,
          200,
          {
            status: status.enabled ? "configured" : "disabled",
            enabled: status.enabled,
            model: status.model,
          },
          request.method
        );
      } catch (error) {
        if (!(error instanceof TutorError)) throw error;
        sendJson(
          response,
          error.status,
          { error: { code: error.code, message: error.message } },
          request.method
        );
      }
      return true;
    }
    if (requestUrl.pathname !== "/api/tutor/chat") return false;

    let actorKey = "";
    let abortController: AbortController | null = null;
    let abortRequest: (() => void) | null = null;
    try {
      requireMethod(request, ["POST"]);
      assertSameOrigin(request, environment, { required: true });
      const clientIp = requestClientIp(request, environment);
      actorKey = requestActorKey(request, clientIp);
      enforceRateLimit(
        actorRateLimits,
        actorKey,
        maximumRequestsPerMinute,
        "Too many tutor questions. Try again shortly."
      );
      enforceRateLimit(
        ipRateLimits,
        clientIp,
        maximumIpRequestsPerMinute,
        "This network has sent too many tutor questions. Try again shortly."
      );
      if (activeActors.has(actorKey)) {
        throw new TutorError(
          429,
          "TUTOR_RATE_LIMITED",
          "Wait for the current tutor answer before asking another question.",
          { retryAfterSeconds: 2 }
        );
      }
      activeActors.add(actorKey);
      abortController = new AbortController();
      abortRequest = () => abortController?.abort();
      request.once("aborted", abortRequest);
      response.once("close", abortRequest);
      const body = await readJson(request, 8 * 1024);
      const unexpectedFields = Object.keys(body).filter(
        (field) => !ALLOWED_CHAT_FIELDS.has(field)
      );
      if (unexpectedFields.length > 0) {
        throw new TutorError(
          400,
          "INVALID_INPUT",
          `Unexpected request field: ${unexpectedFields[0]}`
        );
      }
      const result = await service.ask(
        {
          chapterId: typeof body.chapterId === "string" ? body.chapterId : "",
          message: typeof body.message === "string" ? body.message : "",
          ...(body.conversationId === undefined
            ? {}
            : {
                conversationId:
                  typeof body.conversationId === "string" ? body.conversationId : "",
              }),
        },
        { signal: abortController.signal }
      );
      if (abortController.signal.aborted || response.destroyed) return true;
      sendJson(response, 200, result, request.method);
    } catch (error) {
      if (!(error instanceof TutorError) && !(error instanceof RequestPolicyError)) {
        throw error;
      }
      if (response.destroyed || response.writableEnded) return true;
      const retryAfterSeconds =
        error instanceof TutorError ? error.retryAfterSeconds : undefined;
      if (retryAfterSeconds !== undefined) {
        response.setHeader("Retry-After", String(retryAfterSeconds));
      }
      sendJson(
        response,
        error.status,
        {
          error: {
            code: error.code,
            message: error.message,
            ...(retryAfterSeconds === undefined
              ? {}
              : { retryAfterSeconds }),
          },
        },
        request.method
      );
    } finally {
      if (abortRequest) {
        request.removeListener("aborted", abortRequest);
        response.removeListener("close", abortRequest);
      }
      if (actorKey) activeActors.delete(actorKey);
    }
    return true;
  };
}
