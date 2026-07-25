import assert from "node:assert/strict";
import test from "node:test";

import {
  OllamaClientError,
  createOllamaClient,
  readOllamaConfiguration,
} from "../../../dist/server/rag/ollama-client.js";

test("Ollama configuration is explicit, bounded, and host allowlisted", () => {
  const configuration = readOllamaConfiguration({
    OLLAMA_BASE_URL: "http://ollama:11434",
    OLLAMA_ALLOWED_HOSTS: "ollama",
    OLLAMA_MODEL: "llama3.1:8b",
    OLLAMA_REQUEST_TIMEOUT_MS: "45000",
  });
  assert.equal(configuration.baseUrl.href, "http://ollama:11434/");
  assert.equal(configuration.model, "llama3.1:8b");
  assert.equal(configuration.requestTimeoutMs, 45_000);

  assert.throws(
    () =>
      readOllamaConfiguration({
        OLLAMA_BASE_URL: "https://models.example.test",
      }),
    /not allowlisted/u
  );
  assert.throws(
    () =>
      readOllamaConfiguration({
        OLLAMA_BASE_URL: "http://user:secret@127.0.0.1:11434",
      }),
    /cannot contain credentials/u
  );
  assert.throws(
    () =>
      readOllamaConfiguration({
        OLLAMA_BASE_URL: "file:///tmp/model",
      }),
    /must use http or https/u
  );
});

test("the Ollama adapter sends a non-streaming, resource-bounded chat request", async () => {
  let capturedUrl;
  let capturedRequest;
  const client = createOllamaClient({
    environment: {
      OLLAMA_BASE_URL: "http://ollama:11434",
      OLLAMA_ALLOWED_HOSTS: "ollama",
      OLLAMA_MODEL: "llama3.1:8b",
      RAG_MAX_ANSWER_TOKENS: "300",
      RAG_MODEL_CONTEXT_TOKENS: "4096",
    },
    fetchImplementation: async (url, request) => {
      capturedUrl = String(url);
      capturedRequest = request;
      return new Response(
        JSON.stringify({
          model: "llama3.1:8b",
          message: { role: "assistant", content: "input() returns text [1]." },
          prompt_eval_count: 100,
          eval_count: 12,
          total_duration: 2_500_000,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    },
  });

  const result = await client.chat([
    { role: "system", content: "Coach safely." },
    { role: "user", content: "What is input?" },
  ]);
  const body = JSON.parse(capturedRequest.body);

  assert.equal(capturedUrl, "http://ollama:11434/api/chat");
  assert.equal(body.stream, false);
  assert.equal(body.options.num_ctx, 4_096);
  assert.equal(body.options.num_predict, 300);
  assert.equal(body.options.temperature, 0.2);
  assert.equal(result.answer, "input() returns text [1].");
  assert.deepEqual(result.usage, {
    promptTokens: 100,
    completionTokens: 12,
    totalDurationMs: 3,
  });
});

test("oversized and malformed model responses fail closed", async () => {
  const oversized = createOllamaClient({
    environment: {},
    fetchImplementation: async () =>
      new Response("{}", {
        status: 200,
        headers: { "content-length": String(300 * 1024) },
      }),
  });
  await assert.rejects(
    oversized.chat([{ role: "user", content: "hello" }]),
    (error) =>
      error instanceof OllamaClientError &&
      error.code === "OLLAMA_BAD_RESPONSE" &&
      /oversized/u.test(error.message)
  );

  const oversizedStream = createOllamaClient({
    environment: {},
    fetchImplementation: async () =>
      new Response(
        JSON.stringify({
          message: { content: "x".repeat(257 * 1024) },
        }),
        { status: 200 }
      ),
  });
  await assert.rejects(
    oversizedStream.chat([{ role: "user", content: "hello" }]),
    (error) =>
      error instanceof OllamaClientError &&
      error.code === "OLLAMA_BAD_RESPONSE" &&
      /oversized/u.test(error.message)
  );

  const malformed = createOllamaClient({
    environment: {},
    fetchImplementation: async () => new Response("{", { status: 200 }),
  });
  await assert.rejects(
    malformed.chat([{ role: "user", content: "hello" }]),
    (error) =>
      error instanceof OllamaClientError && error.code === "OLLAMA_BAD_RESPONSE"
  );
});
