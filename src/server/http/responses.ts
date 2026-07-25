import type { IncomingMessage, ServerResponse } from "node:http";

export type JsonObject = Record<string, unknown>;

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function sendJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
  method = "GET"
): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(method === "HEAD" ? undefined : body);
}

export async function readJson(
  request: IncomingMessage,
  maximumBytes = 512 * 1024
): Promise<JsonObject> {
  const contentType = String(request.headers["content-type"] || "").toLowerCase();
  if (!/^application\/(?:json|[a-z0-9!#$&^_.+-]+\+json)(?:\s*;|$)/u.test(contentType)) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  }

  const declaredLength = Number(request.headers["content-length"] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", `Request body must be at most ${maximumBytes} bytes.`);
  }

  const chunks: Buffer[] = [];
  let byteLength = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteLength += buffer.length;
    if (byteLength > maximumBytes) {
      throw new HttpError(413, "PAYLOAD_TOO_LARGE", `Request body must be at most ${maximumBytes} bytes.`);
    }
    chunks.push(buffer);
  }

  if (byteLength === 0) {
    throw new HttpError(400, "INVALID_JSON", "A JSON request body is required.");
  }

  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks, byteLength).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("JSON body is not an object");
    }
    return value as JsonObject;
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must contain a valid JSON object.");
  }
}

export function requireMethod(
  request: IncomingMessage,
  allowedMethods: readonly string[]
): void {
  if (request.method && allowedMethods.includes(request.method)) return;
  throw new HttpError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
}
