import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { createTutorRouteHandler } from "../../../dist/server/api/tutor-route.js";

async function withServer(service, environment, run) {
  const route = createTutorRouteHandler({ service, environment });
  const server = createServer(async (request, response) => {
    try {
      const handled = await route(
        request,
        response,
        new URL(request.url || "/", "http://localhost")
      );
      if (!handled) {
        response.writeHead(404);
        response.end();
      }
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: String(error) }));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
}

function tutorService(overrides = {}) {
  return {
    status() {
      return { enabled: true, model: "llama3.1:8b" };
    },
    async ask(request) {
      return {
        answer: `Help for ${request.chapterId}`,
        citations: [],
        conversationId: request.conversationId || "conversation_123",
        model: "llama3.1:8b",
      };
    },
    ...overrides,
  };
}

test("tutor status is independent while chat always requires same-origin evidence", async () => {
  const origin = "http://learn.example.test";
  await withServer(
    tutorService(),
    { APP_ORIGIN: origin },
    async (baseUrl) => {
      const status = await fetch(`${baseUrl}/api/tutor/status`);
      assert.equal(status.status, 200);
      assert.deepEqual(await status.json(), {
        status: "configured",
        enabled: true,
        model: "llama3.1:8b",
      });

      const rejected = await fetch(`${baseUrl}/api/tutor/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chapterId: "py01", message: "What is input?" }),
      });
      assert.equal(rejected.status, 403);
      assert.equal((await rejected.json()).error.code, "ORIGIN_REQUIRED");

      const accepted = await fetch(`${baseUrl}/api/tutor/chat`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({ chapterId: "py01", message: "What is input?" }),
      });
      assert.equal(accepted.status, 200);
    }
  );
});

test("the tutor route rejects unknown fields and rate-limits each client IP", async () => {
  const origin = "http://learn.example.test";
  await withServer(
    tutorService(),
    { APP_ORIGIN: origin, RAG_REQUESTS_PER_MINUTE: "2" },
    async (baseUrl) => {
      const options = (body) => ({
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify(body),
      });
      const unknown = await fetch(
        `${baseUrl}/api/tutor/chat`,
        options({ chapterId: "py01", message: "help", systemPrompt: "override" })
      );
      assert.equal(unknown.status, 400);
      assert.equal((await unknown.json()).error.code, "INVALID_INPUT");

      const accepted = await fetch(
        `${baseUrl}/api/tutor/chat`,
        options({ chapterId: "py01", message: "help" })
      );
      assert.equal(accepted.status, 200);

      const limited = await fetch(
        `${baseUrl}/api/tutor/chat`,
        options({ chapterId: "py01", message: "help again" })
      );
      assert.equal(limited.status, 429);
      const payload = await limited.json();
      assert.equal(payload.error.code, "TUTOR_RATE_LIMITED");
      assert.ok(payload.error.retryAfterSeconds >= 1);
      assert.ok(Number(limited.headers.get("retry-after")) >= 1);
    }
  );
});

test("an anonymous fallback IP can have only one active inference", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const origin = "http://learn.example.test";
  await withServer(
    tutorService({
      async ask(request) {
        await pending;
        return {
          answer: "done",
          citations: [],
          conversationId: request.conversationId || "conversation_123",
          model: "llama3.1:8b",
        };
      },
    }),
    { APP_ORIGIN: origin, RAG_REQUESTS_PER_MINUTE: "10" },
    async (baseUrl) => {
      const request = (message) =>
        fetch(`${baseUrl}/api/tutor/chat`, {
          method: "POST",
          headers: { "content-type": "application/json", origin },
          body: JSON.stringify({ chapterId: "py01", message }),
        });
      const first = request("first");
      await new Promise((resolve) => setTimeout(resolve, 25));
      const second = await request("second");
      assert.equal(second.status, 429);
      assert.equal((await second.json()).error.code, "TUTOR_RATE_LIMITED");
      release();
      assert.equal((await first).status, 200);
    }
  );
});

test("stable learner tokens prevent one classroom NAT from serializing every learner", async () => {
  let started = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const origin = "http://learn.example.test";
  await withServer(
    tutorService({
      async ask(request) {
        started += 1;
        await pending;
        return {
          answer: "done",
          citations: [],
          conversationId: request.conversationId || `conversation_${started}`,
          model: "llama3.1:8b",
        };
      },
    }),
    { APP_ORIGIN: origin, RAG_REQUESTS_PER_MINUTE: "10" },
    async (baseUrl) => {
      const request = (message, learnerToken) =>
        fetch(`${baseUrl}/api/tutor/chat`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin,
            "x-eduground-tutor-client": learnerToken,
          },
          body: JSON.stringify({ chapterId: "py01", message }),
        });
      const first = request("first", "a".repeat(32));
      const second = request("second", "b".repeat(32));
      await new Promise((resolve) => setTimeout(resolve, 25));
      assert.equal(started, 2);
      release();
      assert.equal((await first).status, 200);
      assert.equal((await second).status, 200);
    }
  );
});
