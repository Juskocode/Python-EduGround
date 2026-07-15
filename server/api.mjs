import { DatabaseUnavailableError } from "./database.mjs";
import { HttpError, readJson, requireMethod, sendJson } from "./http.mjs";
import {
  createSessionToken,
  createUserId,
  hashPassword,
  hashSessionToken,
  isValidEmail,
  normalizeEmail,
  verifyPassword,
} from "./security.mjs";

const AUTH_WINDOW_MS = 15 * 60 * 1_000;
const REGISTER_LIMIT = 8;
const LOGIN_LIMIT = 20;
const STATE_MAX_BYTES = 384 * 1024;
const FILE_MAX_BYTES = 256 * 1024;
const RESULTS_MAX_BYTES = 256 * 1024;
const MAX_TEST_RESULTS = 250;
const EXERCISE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/u;
const RUN_SCOPE_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/u;
const DUMMY_PASSWORD_RECORD = [
  "scrypt",
  "16384",
  "8",
  "1",
  Buffer.alloc(16).toString("base64url"),
  Buffer.alloc(64).toString("base64url"),
].join("$");

function asIsoString(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: asIsoString(row.created_at),
  };
}

function publicFile(row) {
  return {
    exerciseId: row.exercise_id,
    filename: row.filename,
    content: row.content,
    updatedAt: asIsoString(row.updated_at),
  };
}

function requireString(value, fieldName, { minimum = 1, maximum }) {
  if (typeof value !== "string") {
    throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be a string.`);
  }
  if (value.length < minimum || value.length > maximum) {
    throw new HttpError(
      400,
      "INVALID_INPUT",
      `${fieldName} must contain between ${minimum} and ${maximum} characters.`
    );
  }
  return value;
}

function requireInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new HttpError(400, "INVALID_INPUT", `${fieldName} must be a whole number from 0 to 10000.`);
  }
  return value;
}

function validateExerciseId(value) {
  if (typeof value !== "string" || !EXERCISE_ID_PATTERN.test(value)) {
    throw new HttpError(400, "INVALID_EXERCISE_ID", "Exercise id is invalid.");
  }
  return value;
}

function requestIp(request, trustProxy) {
  if (trustProxy) {
    const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (forwarded) return forwarded;
  }
  return request.socket?.remoteAddress || "unknown";
}

function createRateLimiter() {
  const attempts = new Map();
  let operations = 0;

  return function check(key, limit, now = Date.now()) {
    operations += 1;
    if (operations % 100 === 0) {
      for (const [storedKey, entry] of attempts) {
        if (entry.resetAt <= now) attempts.delete(storedKey);
      }
    }

    const existing = attempts.get(key);
    if (!existing || existing.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS });
      return;
    }

    existing.count += 1;
    if (existing.count > limit) {
      const error = new HttpError(429, "RATE_LIMITED", "Too many attempts. Try again later.");
      error.retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1_000));
      throw error;
    }
  };
}

function configuredOrigins(environment) {
  return new Set(
    String(environment.APP_ORIGIN || "")
      .split(",")
      .map((value) => value.trim().replace(/\/$/u, ""))
      .filter(Boolean)
  );
}

function assertSameOrigin(request, environment) {
  const origin = request.headers.origin;
  if (!origin) return;

  const allowed = configuredOrigins(environment);
  const trustProxy = environment.TRUST_PROXY === "true" || environment.TRUST_PROXY === "1";
  const forwardedProtocol = trustProxy
    ? String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim()
    : "";
  if (allowed.size === 0) {
    const protocol = forwardedProtocol || (request.socket?.encrypted ? "https" : "http");
    const host = request.headers.host;
    if (host) allowed.add(`${protocol}://${host}`);
  }

  if (origin === "null" || !allowed.has(String(origin).replace(/\/$/u, ""))) {
    throw new HttpError(403, "ORIGIN_NOT_ALLOWED", "Request origin is not allowed.");
  }
}

function bearerToken(request) {
  const authorization = String(request.headers.authorization || "");
  const match = /^Bearer ([A-Za-z0-9_-]{32,256})$/u.exec(authorization);
  if (!match) {
    throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
  }
  return match[1];
}

async function authenticate(request, database) {
  const tokenHash = hashSessionToken(bearerToken(request));
  const result = await database.query(
    `SELECT users.id, users.email, users.display_name, users.created_at
       FROM sessions
       JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = $1
        AND sessions.expires_at > NOW()`,
    [tokenHash]
  );
  if (result.rowCount !== 1) {
    throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
  }
  return publicUser(result.rows[0]);
}

async function createSession(client, userId, sessionTtlSeconds) {
  const token = createSessionToken();
  await client.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, NOW() + $3::interval)`,
    [hashSessionToken(token), userId, `${sessionTtlSeconds} seconds`]
  );
  return token;
}

function errorResponse(error, logger, request) {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      headers: error.retryAfter ? { "Retry-After": String(error.retryAfter) } : null,
      payload: { error: { code: error.code, message: error.message } },
    };
  }
  if (error instanceof DatabaseUnavailableError) {
    return {
      status: 503,
      payload: {
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Cloud saving is temporarily unavailable. Your local workspace can still be used.",
        },
      },
    };
  }

  logger.error("API request failed", {
    method: request.method,
    path: String(request.url || "").split("?", 1)[0],
    error: error?.code || error?.name || "Error",
  });
  return {
    status: 500,
    payload: { error: { code: "INTERNAL_ERROR", message: "The request could not be completed." } },
  };
}

function sendApiError(response, result, method) {
  if (result.headers) {
    for (const [name, value] of Object.entries(result.headers)) response.setHeader(name, value);
  }
  sendJson(response, result.status, result.payload, method);
}

export function createApiHandler({ database, environment = process.env, logger = console }) {
  const rateLimit = createRateLimiter();
  const trustProxy = environment.TRUST_PROXY === "true" || environment.TRUST_PROXY === "1";
  const configuredTtl = Number(environment.SESSION_TTL_SECONDS || 30 * 24 * 60 * 60);
  const sessionTtlSeconds = Number.isSafeInteger(configuredTtl)
    ? Math.min(Math.max(configuredTtl, 3_600), 180 * 24 * 60 * 60)
    : 30 * 24 * 60 * 60;

  return async function handleApi(request, response, requestUrl) {
    const pathname = requestUrl.pathname;
    const isApiPath = pathname === "/api" || pathname.startsWith("/api/");
    if (!isApiPath && pathname !== "/healthz" && pathname !== "/readyz") return false;

    try {
      if (pathname === "/healthz") {
        requireMethod(request, ["GET", "HEAD"]);
        sendJson(response, 200, { status: "ok" }, request.method);
        return true;
      }

      if (pathname === "/api/health" || pathname === "/readyz") {
        requireMethod(request, ["GET", "HEAD"]);
        const storage = await database.health();
        sendJson(
          response,
          storage.available ? 200 : 503,
          { status: storage.available ? "ok" : "degraded", database: storage },
          request.method
        );
        return true;
      }

      if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH" || request.method === "DELETE") {
        assertSameOrigin(request, environment);
      }

      if (pathname === "/api/auth/register") {
        requireMethod(request, ["POST"]);
        rateLimit(`register:${requestIp(request, trustProxy)}`, REGISTER_LIMIT);
        const body = await readJson(request, 32 * 1024);
        const email = normalizeEmail(body.email);
        if (!isValidEmail(email)) {
          throw new HttpError(400, "INVALID_INPUT", "Enter a valid email address.");
        }
        const displayName = requireString(body.displayName?.trim(), "displayName", {
          minimum: 2,
          maximum: 80,
        });
        const password = requireString(body.password, "password", { minimum: 10, maximum: 256 });
        const passwordRecord = await hashPassword(password);
        const userId = createUserId();

        let created;
        try {
          created = await database.transaction(async (client) => {
            const userResult = await client.query(
              `INSERT INTO users (id, email, display_name, password_hash)
               VALUES ($1, $2, $3, $4)
               RETURNING id, email, display_name, created_at`,
              [userId, email, displayName, passwordRecord]
            );
            const token = await createSession(client, userId, sessionTtlSeconds);
            return { token, user: publicUser(userResult.rows[0]) };
          });
        } catch (error) {
          if (error?.code === "23505") {
            throw new HttpError(409, "EMAIL_IN_USE", "An account already exists for that email address.");
          }
          throw error;
        }

        sendJson(response, 201, created, request.method);
        return true;
      }

      if (pathname === "/api/auth/login") {
        requireMethod(request, ["POST"]);
        rateLimit(`login:${requestIp(request, trustProxy)}`, LOGIN_LIMIT);
        const body = await readJson(request, 32 * 1024);
        const email = normalizeEmail(body.email);
        const password = typeof body.password === "string" ? body.password : "";
        const lookup = isValidEmail(email)
          ? await database.query(
              `SELECT id, email, display_name, password_hash, created_at
                 FROM users
                WHERE email = $1`,
              [email]
            )
          : { rowCount: 0, rows: [] };
        const row = lookup.rows[0];
        const valid = await verifyPassword(password, row?.password_hash || DUMMY_PASSWORD_RECORD);
        if (!row || !valid) {
          throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
        }

        const token = await database.transaction(async (client) => {
          await client.query("DELETE FROM sessions WHERE expires_at <= NOW()");
          return createSession(client, row.id, sessionTtlSeconds);
        });
        sendJson(response, 200, { token, user: publicUser(row) }, request.method);
        return true;
      }

      if (pathname === "/api/auth/logout") {
        requireMethod(request, ["POST"]);
        const tokenHash = hashSessionToken(bearerToken(request));
        const result = await database.query(
          "DELETE FROM sessions WHERE token_hash = $1 AND expires_at > NOW() RETURNING user_id",
          [tokenHash]
        );
        if (result.rowCount !== 1) {
          throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
        }
        response.writeHead(204, {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        });
        response.end();
        return true;
      }

      if (pathname === "/api/me") {
        requireMethod(request, ["GET"]);
        const user = await authenticate(request, database);
        sendJson(response, 200, { user }, request.method);
        return true;
      }

      if (pathname === "/api/state") {
        requireMethod(request, ["GET", "PUT"]);
        const user = await authenticate(request, database);
        if (request.method === "GET") {
          const result = await database.query(
            "SELECT state, updated_at FROM user_state WHERE user_id = $1",
            [user.id]
          );
          const row = result.rows[0];
          sendJson(
            response,
            200,
            { state: row?.state || {}, updatedAt: asIsoString(row?.updated_at) },
            request.method
          );
          return true;
        }

        const body = await readJson(request);
        if (!body.state || typeof body.state !== "object" || Array.isArray(body.state)) {
          throw new HttpError(400, "INVALID_INPUT", "state must be a JSON object.");
        }
        const serialized = JSON.stringify(body.state);
        if (Buffer.byteLength(serialized) > STATE_MAX_BYTES) {
          throw new HttpError(413, "STATE_TOO_LARGE", "Saved progress is too large.");
        }
        const result = await database.query(
          `INSERT INTO user_state (user_id, state, updated_at)
           VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (user_id) DO UPDATE
             SET state = EXCLUDED.state, updated_at = NOW()
           RETURNING state, updated_at`,
          [user.id, serialized]
        );
        sendJson(
          response,
          200,
          { state: result.rows[0].state, updatedAt: asIsoString(result.rows[0].updated_at) },
          request.method
        );
        return true;
      }

      const fileMatch = /^\/api\/files\/([^/]+)$/u.exec(pathname);
      if (fileMatch) {
        requireMethod(request, ["GET", "PUT"]);
        let exerciseId;
        try {
          exerciseId = validateExerciseId(decodeURIComponent(fileMatch[1]));
        } catch (error) {
          if (error instanceof URIError) {
            throw new HttpError(400, "INVALID_EXERCISE_ID", "Exercise id is invalid.");
          }
          throw error;
        }
        const user = await authenticate(request, database);

        if (request.method === "GET") {
          const result = await database.query(
            `SELECT exercise_id, filename, content, updated_at
               FROM user_files
              WHERE user_id = $1 AND exercise_id = $2`,
            [user.id, exerciseId]
          );
          if (result.rowCount === 0) {
            throw new HttpError(404, "FILE_NOT_FOUND", "No saved file exists for this exercise.");
          }
          sendJson(response, 200, { file: publicFile(result.rows[0]) }, request.method);
          return true;
        }

        const body = await readJson(request);
        const filename = requireString(body.filename?.trim(), "filename", { minimum: 1, maximum: 120 });
        if (/[/\\\0\r\n]/u.test(filename) || filename === "." || filename === "..") {
          throw new HttpError(400, "INVALID_INPUT", "filename must be a plain file name without a path.");
        }
        const content = requireString(body.content, "content", { minimum: 0, maximum: FILE_MAX_BYTES });
        if (Buffer.byteLength(content) > FILE_MAX_BYTES) {
          throw new HttpError(413, "FILE_TOO_LARGE", "Saved code must be at most 256 KiB.");
        }
        const result = await database.query(
          `INSERT INTO user_files (user_id, exercise_id, filename, content, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (user_id, exercise_id) DO UPDATE
             SET filename = EXCLUDED.filename, content = EXCLUDED.content, updated_at = NOW()
           RETURNING exercise_id, filename, content, updated_at`,
          [user.id, exerciseId, filename, content]
        );
        sendJson(response, 200, { file: publicFile(result.rows[0]) }, request.method);
        return true;
      }

      if (pathname === "/api/runs") {
        requireMethod(request, ["POST"]);
        const user = await authenticate(request, database);
        const body = await readJson(request);
        const exerciseId = validateExerciseId(body.exerciseId);
        const scope = requireString(body.scope, "scope", { minimum: 1, maximum: 32 });
        if (!RUN_SCOPE_PATTERN.test(scope)) {
          throw new HttpError(400, "INVALID_INPUT", "scope is invalid.");
        }
        const passedCount = requireInteger(body.passedCount, "passedCount");
        const totalCount = requireInteger(body.totalCount, "totalCount");
        if (passedCount > totalCount) {
          throw new HttpError(400, "INVALID_INPUT", "passedCount cannot exceed totalCount.");
        }
        if (typeof body.allPassed !== "boolean") {
          throw new HttpError(400, "INVALID_INPUT", "allPassed must be true or false.");
        }
        if (body.allPassed !== (totalCount > 0 && passedCount === totalCount)) {
          throw new HttpError(400, "INVALID_INPUT", "allPassed does not match the supplied counts.");
        }
        if (!Array.isArray(body.results) || body.results.length > MAX_TEST_RESULTS) {
          throw new HttpError(400, "INVALID_INPUT", `results must be an array of at most ${MAX_TEST_RESULTS} items.`);
        }
        const serializedResults = JSON.stringify(body.results);
        if (Buffer.byteLength(serializedResults) > RESULTS_MAX_BYTES) {
          throw new HttpError(413, "RESULTS_TOO_LARGE", "Test results are too large to save.");
        }

        const result = await database.query(
          `INSERT INTO test_runs
             (user_id, exercise_id, scope, passed_count, total_count, all_passed, results)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
           RETURNING id, created_at`,
          [user.id, exerciseId, scope, passedCount, totalCount, body.allPassed, serializedResults]
        );
        sendJson(
          response,
          201,
          {
            run: {
              id: String(result.rows[0].id),
              exerciseId,
              scope,
              passedCount,
              totalCount,
              allPassed: body.allPassed,
              createdAt: asIsoString(result.rows[0].created_at),
            },
          },
          request.method
        );
        return true;
      }

      throw new HttpError(404, "API_NOT_FOUND", "API endpoint not found.");
    } catch (error) {
      sendApiError(response, errorResponse(error, logger, request), request.method);
      return true;
    }
  };
}
