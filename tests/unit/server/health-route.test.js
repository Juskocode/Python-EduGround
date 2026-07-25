import assert from "node:assert/strict";
import test from "node:test";

import { createHealthRouteHandler } from "../../../dist/server/api/routes/health-route.js";

function createResponse() {
  return {
    body: undefined,
    headers: undefined,
    status: undefined,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    },
  };
}

function jsonBody(response) {
  return JSON.parse(String(response.body));
}

test("health route keeps liveness independent from database readiness", async () => {
  let healthChecks = 0;
  const handler = createHealthRouteHandler({
    database: {
      async health() {
        healthChecks += 1;
        return {
          configured: false,
          available: false,
          schemaReady: false,
          message: "PostgreSQL is not configured.",
        };
      },
    },
  });
  const response = createResponse();

  assert.equal(
    await handler({ method: "GET" }, response, new URL("http://localhost/healthz")),
    true
  );
  assert.equal(response.status, 200);
  assert.deepEqual(jsonBody(response), { status: "ok" });
  assert.equal(healthChecks, 0);
});

test("health route preserves ready and degraded readiness contracts", async () => {
  const statuses = [
    {
      configured: true,
      available: true,
      schemaReady: true,
      message: "PostgreSQL and the required schema are ready.",
    },
    {
      configured: false,
      available: false,
      schemaReady: false,
      message: "PostgreSQL is not configured.",
    },
  ];
  const handler = createHealthRouteHandler({
    database: {
      async health() {
        return statuses.shift();
      },
    },
  });

  const readyResponse = createResponse();
  assert.equal(
    await handler({ method: "GET" }, readyResponse, new URL("http://localhost/readyz")),
    true
  );
  assert.equal(readyResponse.status, 200);
  assert.deepEqual(jsonBody(readyResponse), {
    status: "ok",
    database: {
      configured: true,
      available: true,
      schemaReady: true,
      message: "PostgreSQL and the required schema are ready.",
    },
  });

  const degradedResponse = createResponse();
  assert.equal(
    await handler(
      { method: "GET" },
      degradedResponse,
      new URL("http://localhost/api/health")
    ),
    true
  );
  assert.equal(degradedResponse.status, 503);
  assert.equal(jsonBody(degradedResponse).status, "degraded");
});

test("health route ignores unrelated paths and enforces GET or HEAD", async () => {
  const handler = createHealthRouteHandler({
    database: {
      async health() {
        throw new Error("unrelated routes must not query health");
      },
    },
  });

  assert.equal(
    await handler(
      { method: "GET" },
      createResponse(),
      new URL("http://localhost/api/state")
    ),
    false
  );

  await assert.rejects(
    handler(
      { method: "POST" },
      createResponse(),
      new URL("http://localhost/healthz")
    ),
    (error) => error?.status === 405 && error?.code === "METHOD_NOT_ALLOWED"
  );

  const headResponse = createResponse();
  assert.equal(
    await handler({ method: "HEAD" }, headResponse, new URL("http://localhost/healthz")),
    true
  );
  assert.equal(headResponse.status, 200);
  assert.equal(headResponse.body, undefined);
});
