import assert from "node:assert/strict";
import test from "node:test";

import {
  ChapterTutorService,
  readTutorServiceConfiguration,
} from "../../../dist/server/rag/tutor-service.js";
import { OllamaClientError } from "../../../dist/server/rag/ollama-client.js";
import { TutorError } from "../../../dist/server/rag/types.js";

const CHUNK = Object.freeze({
  id: "py01:learning-content:tutorial:1",
  chapterId: "py01",
  title: "First Programs",
  section: "Learning guide / Tutorial",
  source: "learning-content",
  text: "input reads a line of text. int converts suitable text to a whole number.",
});

function configuration(overrides = {}) {
  return {
    enabled: true,
    maximumMessageCharacters: 2_000,
    maximumContextChunks: 4,
    maximumContextCharacters: 8_000,
    maximumConcurrentRequests: 1,
    maximumQueueDepth: 2,
    queueTimeoutMs: 1_000,
    responseCacheTtlMs: 300_000,
    maximumCachedResponses: 10,
    ...overrides,
  };
}

test("tutor service validates chapter scope and returns bounded citations", async () => {
  let capturedMessages;
  const service = new ChapterTutorService({
    repository: {
      async getChapterChunks(chapterId) {
        assert.equal(chapterId, "py01");
        return [
          CHUNK,
          {
            ...CHUNK,
            id: "py01:learning-content:tutorial:2",
            text: "Use int after input when a whole number must participate in arithmetic.",
          },
        ];
      },
    },
    modelClient: {
      model: "llama3.1:8b",
      async chat(messages) {
        capturedMessages = messages;
        return {
          answer: "input() returns text; use int() when a whole-number calculation is needed [1].",
          model: "llama3.1:8b",
          usage: { promptTokens: 80, completionTokens: 20 },
        };
      },
    },
    configuration: configuration(),
    createConversationId: () => "conversation_123",
  });

  const response = await service.ask({
    chapterId: "py01",
    message: "When should I use int with input?",
  });
  assert.equal(response.conversationId, "conversation_123");
  assert.equal(response.model, "llama3.1:8b");
  assert.deepEqual(response.citations, [
    { title: "First Programs", section: "Learning guide / Tutorial" },
  ]);
  assert.equal(response.usage.cached, false);
  assert.match(capturedMessages[0].content, /Never reveal/u);
  assert.match(capturedMessages[1].content, /When should I use int/u);
  assert.match(capturedMessages[1].content, /<source id="2"/u);

  await assert.rejects(
    service.ask({ chapterId: "py99", message: "Help me" }),
    (error) =>
      error instanceof TutorError &&
      error.status === 404 &&
      error.code === "CHAPTER_NOT_FOUND"
  );
});

test("identical chapter questions use an ephemeral bounded response cache", async () => {
  let calls = 0;
  const service = new ChapterTutorService({
    repository: { async getChapterChunks() { return [CHUNK]; } },
    modelClient: {
      model: "llama3.1:8b",
      async chat() {
        calls += 1;
        return { answer: "A cached coaching answer.", model: "llama3.1:8b" };
      },
    },
    configuration: configuration(),
    createConversationId: () => `conversation_${calls + 100}`,
  });

  const first = await service.ask({ chapterId: "py01", message: "Explain input" });
  const second = await service.ask({
    chapterId: "py01",
    message: "  EXPLAIN   INPUT  ",
    conversationId: "existing_123",
  });
  assert.equal(calls, 1);
  assert.equal(first.usage.cached, false);
  assert.equal(second.usage.cached, true);
  assert.equal(second.conversationId, "existing_123");
});

test("global inference and queue capacity reject excess work before model overuse", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const service = new ChapterTutorService({
    repository: { async getChapterChunks() { return [CHUNK]; } },
    modelClient: {
      model: "llama3.1:8b",
      async chat() {
        await pending;
        return { answer: "done", model: "llama3.1:8b" };
      },
    },
    configuration: configuration({ maximumQueueDepth: 0 }),
  });

  const first = service.ask({ chapterId: "py01", message: "first question" });
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(
    service.ask({ chapterId: "py01", message: "second question" }),
    (error) =>
      error instanceof TutorError &&
      error.status === 429 &&
      error.code === "TUTOR_RATE_LIMITED"
  );
  release();
  await first;
});

test("RAG is opt-in and all resource settings are bounded", () => {
  assert.equal(readTutorServiceConfiguration({}).enabled, false);
  assert.equal(
    readTutorServiceConfiguration({
      RAG_ENABLED: "true",
      RAG_MAX_CONCURRENT_REQUESTS: "1",
      RAG_MAX_QUEUE_DEPTH: "10",
    }).enabled,
    true
  );
  assert.throws(
    () => readTutorServiceConfiguration({ RAG_MAX_CONCURRENT_REQUESTS: "100" }),
    /whole number/u
  );
});

test("learner cancellation propagates through the service to model inference", async () => {
  let modelSignal;
  const service = new ChapterTutorService({
    repository: { async getChapterChunks() { return [CHUNK]; } },
    modelClient: {
      model: "llama3.1:8b",
      async chat(_messages, options) {
        modelSignal = options.signal;
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener(
            "abort",
            () =>
              reject(
                new OllamaClientError(
                  "OLLAMA_CANCELLED",
                  "The learner cancelled the tutor request."
                )
              ),
            { once: true }
          );
        });
      },
    },
    configuration: configuration(),
  });
  const controller = new AbortController();
  const response = service.ask(
    { chapterId: "py01", message: "Explain input" },
    { signal: controller.signal }
  );
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();

  await assert.rejects(
    response,
    (error) =>
      error instanceof TutorError &&
      error.status === 499 &&
      error.code === "TUTOR_CANCELLED"
  );
  assert.equal(modelSignal.aborted, true);
});
