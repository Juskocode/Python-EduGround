export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function sendJson(response, status, payload, method = "GET") {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(method === "HEAD" ? undefined : body);
}

export async function readJson(request, maximumBytes = 512 * 1024) {
  const contentType = String(request.headers["content-type"] || "").toLowerCase();
  if (!/^application\/(?:json|[a-z0-9!#$&^_.+-]+\+json)(?:\s*;|$)/u.test(contentType)) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  }

  const declaredLength = Number(request.headers["content-length"] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", `Request body must be at most ${maximumBytes} bytes.`);
  }

  const chunks = [];
  let byteLength = 0;
  for await (const chunk of request) {
    byteLength += chunk.length;
    if (byteLength > maximumBytes) {
      throw new HttpError(413, "PAYLOAD_TOO_LARGE", `Request body must be at most ${maximumBytes} bytes.`);
    }
    chunks.push(chunk);
  }

  if (byteLength === 0) {
    throw new HttpError(400, "INVALID_JSON", "A JSON request body is required.");
  }

  try {
    const value = JSON.parse(Buffer.concat(chunks, byteLength).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("JSON body is not an object");
    }
    return value;
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must contain a valid JSON object.");
  }
}

export function requireMethod(request, allowedMethods) {
  if (allowedMethods.includes(request.method)) return;
  throw new HttpError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
}
