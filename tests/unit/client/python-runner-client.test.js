import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const source = await readFile(
  resolve(REPOSITORY_ROOT, "public/workers/python-runner-client.js"),
  "utf8",
);

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createHarness(protocol = "http:") {
  const timers = new Map();
  const workers = [];
  let timerId = 0;

  class FakeWorker {
    constructor(url, options) {
      this.url = url;
      this.options = options;
      this.listeners = new Map();
      this.messages = [];
      this.terminated = false;
      workers.push(this);
    }

    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) || [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    postMessage(message) {
      this.messages.push(message);
    }

    terminate() {
      this.terminated = true;
    }

    emit(type, payload) {
      for (const listener of this.listeners.get(type) || []) {
        listener(type === "message" ? { data: payload } : payload);
      }
    }
  }

  const window = {
    Worker: FakeWorker,
    clearTimeout(id) {
      timers.delete(id);
    },
    location: { protocol },
    setTimeout(callback, delay) {
      timerId += 1;
      timers.set(timerId, { callback, delay });
      return timerId;
    },
  };
  const context = vm.createContext({ window });
  vm.runInContext(source, context, { filename: "python-runner-client.js" });

  return {
    api: window.PYTHON_RUNNER_CLIENT,
    fireDelay(delay) {
      const matches = Array.from(timers.entries())
        .filter(([, timer]) => timer.delay === delay);
      for (const [id, timer] of matches) {
        timers.delete(id);
        timer.callback();
      }
    },
    timers,
    workers,
  };
}

test("runner client publishes a frozen factory and module-worker contract", async () => {
  const harness = createHarness();
  const runner = harness.api.create();

  assert.equal(Object.isFrozen(harness.api), true);
  assert.equal(Object.isFrozen(runner), true);

  const first = runner.prepare();
  const second = runner.prepare();
  assert.equal(first, second, "concurrent prepare calls must share one startup");
  assert.equal(harness.workers.length, 1);
  assert.equal(harness.workers[0].url, "/workers/python-runner-worker.js");
  assert.deepEqual(plain(harness.workers[0].options), { type: "module" });

  harness.workers[0].emit("message", { type: "ready" });
  await first;
  assert.equal(harness.timers.size, 0, "ready clears the startup deadline");
});

test("run forwards one bounded request and resolves worker results", async () => {
  const harness = createHarness();
  const runner = harness.api.create();
  const ready = runner.prepare();
  const worker = harness.workers[0];
  worker.emit("message", { type: "ready" });
  await ready;

  const pending = runner.run(
    "print('hello')",
    "all",
    [{ id: "visible-1" }],
  );
  await Promise.resolve();
  assert.deepEqual(plain(worker.messages), [{
    id: "run-1",
    code: "print('hello')",
    mode: "all",
    tests: [{ id: "visible-1" }],
  }]);

  const results = [{ id: "visible-1", passed: true }];
  worker.emit("message", {
    id: "run-1",
    type: "result",
    results,
  });
  assert.deepEqual(await pending, results);
  assert.equal(harness.timers.size, 0, "a result clears its run deadline");
});

test("run timeout terminates the worker and permits a clean restart", async () => {
  const harness = createHarness();
  const runner = harness.api.create({ runTimeoutMs: 12000 });
  const ready = runner.prepare();
  const firstWorker = harness.workers[0];
  firstWorker.emit("message", { type: "ready" });
  await ready;

  const pending = runner.run("while True: pass", "visible", []);
  await Promise.resolve();
  harness.fireDelay(12000);
  await assert.rejects(
    pending,
    /exceeded 12 seconds/u,
  );
  assert.equal(firstWorker.terminated, true);

  const restarted = runner.prepare();
  assert.equal(harness.workers.length, 2);
  harness.workers[1].emit("message", { type: "ready" });
  await restarted;
});

test("startup errors reject preparation and reset the worker lifecycle", async () => {
  const harness = createHarness();
  const runner = harness.api.create();
  const preparing = runner.prepare();
  const worker = harness.workers[0];

  worker.emit("message", {
    type: "startup-error",
    error: "runtime unavailable",
  });
  await assert.rejects(
    preparing,
    /Python could not load: runtime unavailable/u,
  );
  assert.equal(worker.terminated, true);

  const retry = runner.prepare();
  assert.equal(harness.workers.length, 2);
  harness.workers[1].emit("message", { type: "ready" });
  await retry;
});

test("file protocol refuses execution before constructing a worker", async () => {
  const harness = createHarness("file:");
  const runner = harness.api.create();

  await assert.rejects(
    runner.prepare(),
    /needs the local web server/u,
  );
  assert.equal(harness.workers.length, 0);
});
