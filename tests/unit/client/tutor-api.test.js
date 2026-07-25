import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const apiSource = await readFile(
  resolve(REPOSITORY_ROOT, "public/features/classroom/tutor-api.js"),
  "utf8",
);
const controllerSource = await readFile(
  resolve(REPOSITORY_ROOT, "public/features/classroom/chapter-tutor.js"),
  "utf8",
);

function loadApi() {
  const window = {
    clearTimeout,
    setTimeout,
  };
  const context = vm.createContext({
    AbortController,
    Error,
    JSON,
    Math,
    Number,
    Object,
    Promise,
    RegExp,
    String,
    TypeError,
    window,
  });
  vm.runInContext(apiSource, context, { filename: "tutor-api.js" });
  return context.window.CHAPTER_TUTOR_API;
}

test("the tutor client sends a bounded chapter request and normalizes cited output", async () => {
  const api = loadApi();
  let request = null;
  const stored = new Map();
  const client = api.createClient({
    sessionStorage: {
      getItem: (key) => stored.get(key) || null,
      setItem: (key, value) => stored.set(key, value),
    },
    crypto: {
      randomUUID: () => "123e4567-e89b-12d3-a456-426614174000",
    },
    fetch: async (path, options) => {
      request = { path, options };
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          answer: "  input() always returns text until you convert it.  ",
          citations: [
            { title: "Reading keyboard input", section: "The input() return value" },
            null,
          ],
          conversationId: "room-42",
          model: "llama3.1:8b",
          usage: { promptTokens: 120 },
        }),
      };
    },
  });

  const result = await client.ask({
    chapterId: "PY01",
    message: "  What type does input() return?  ",
  });

  assert.equal(request.path, "/api/tutor/chat");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.credentials, "same-origin");
  assert.equal(
    request.options.headers["X-EduGround-Tutor-Client"],
    "123e4567-e89b-12d3-a456-426614174000",
  );
  assert.equal(
    stored.get(api.CLIENT_STORAGE_KEY),
    "123e4567-e89b-12d3-a456-426614174000",
  );
  assert.deepEqual(JSON.parse(request.options.body), {
    chapterId: "py01",
    message: "What type does input() return?",
  });
  assert.equal(result.answer, "input() always returns text until you convert it.");
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0].title, "Reading keyboard input");
  assert.equal(result.conversationId, "room-42");
  assert.equal(result.model, "llama3.1:8b");
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.citations), true);
});

test("the rate-limit client identifier is stable per browser tab and safely optional", () => {
  const api = loadApi();
  const stored = new Map();
  const storage = {
    getItem: (key) => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, value),
  };
  const first = api.getTutorClientId(storage, {
    randomUUID: () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  });
  const second = api.getTutorClientId(storage, {
    randomUUID: () => "ffffffff-1111-4222-8333-444444444444",
  });

  assert.equal(first, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  assert.equal(second, first);
  assert.equal(
    api.getTutorClientId({
      getItem() {
        throw new Error("storage disabled");
      },
    }, null),
    "",
  );
});

test("invalid chapters and oversized questions are rejected before fetch", async () => {
  const api = loadApi();
  let calls = 0;
  const client = api.createClient({
    fetch: async () => {
      calls += 1;
      throw new Error("fetch should not run");
    },
  });

  await assert.rejects(
    client.ask({ chapterId: "py99", message: "Explain loops" }),
    (error) => error.code === "INVALID_INPUT",
  );
  await assert.rejects(
    client.ask({ chapterId: "py01", message: "x".repeat(api.MAX_MESSAGE_LENGTH + 1) }),
    (error) => error.code === "INVALID_INPUT",
  );
  assert.equal(calls, 0);
});

test("rate-limit metadata is preserved for an actionable classroom message", async () => {
  const api = loadApi();
  const client = api.createClient({
    fetch: async () => ({
      ok: false,
      status: 429,
      headers: { get: (name) => name === "Retry-After" ? "15" : null },
      json: async () => ({
        error: {
          code: "TUTOR_RATE_LIMITED",
          message: "Classroom quota reached.",
          retryAfterSeconds: 12,
        },
      }),
    }),
  });

  await assert.rejects(
    client.ask({ chapterId: "py02", message: "Explain integer division" }),
    (error) => {
      assert.equal(error.code, "TUTOR_RATE_LIMITED");
      assert.equal(error.status, 429);
      assert.equal(error.retryAfterSeconds, 12);
      return true;
    },
  );
});

test("controller errors become learner-friendly without exposing server internals", () => {
  const context = vm.createContext({
    Array,
    Math,
    Number,
    Object,
    String,
    TypeError,
    document: {
      addEventListener() {},
    },
    window: {},
  });
  vm.runInContext(controllerSource, context, { filename: "chapter-tutor.js" });
  const tutor = context.window.CHAPTER_TUTOR;

  assert.equal(
    tutor.getErrorMessage({ code: "TUTOR_DISABLED" }),
    "The chapter tutor is not enabled in this environment.",
  );
  assert.equal(
    tutor.getErrorMessage({
      code: "TUTOR_RATE_LIMITED",
      retryAfterSeconds: 12,
      message: "database details that should stay hidden",
    }),
    "The classroom request limit is active. Try again in about 12 seconds.",
  );
  assert.equal(
    tutor.getErrorMessage({ code: "SOME_INTERNAL_FAILURE", message: "secret stack" }),
    "The chapter tutor is temporarily unavailable. Keep learning from the class notes and try again shortly.",
  );
});
