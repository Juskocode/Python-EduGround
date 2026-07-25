import type { IncomingMessage, ServerResponse } from "node:http";

import { requireMethod, sendJson } from "../../http/responses.js";

export interface DatabaseHealthStatus {
  configured: boolean;
  available: boolean;
  schemaReady: boolean;
  message: string;
}

export interface HealthDatabase {
  health(): Promise<DatabaseHealthStatus>;
}

export interface HealthRouteOptions {
  database: HealthDatabase;
}

export type HealthRouteHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  requestUrl: URL
) => Promise<boolean>;

export function createHealthRouteHandler({
  database,
}: HealthRouteOptions): HealthRouteHandler {
  return async function handleHealthRoute(request, response, requestUrl) {
    const pathname = requestUrl.pathname;

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

    return false;
  };
}
