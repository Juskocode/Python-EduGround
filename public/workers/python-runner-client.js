(function (global) {
  "use strict";

  if (!global) {
    return;
  }

  var DEFAULT_STARTUP_TIMEOUT_MS = 90000;
  var DEFAULT_RUN_TIMEOUT_MS = 12000;
  var DEFAULT_WORKER_URL = "/workers/python-runner-worker.js";

  function positiveTimeout(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0
      ? Math.floor(number)
      : fallback;
  }

  function create(options) {
    var settings = options && typeof options === "object" ? options : {};
    var runtime = settings.runtime || global;
    var WorkerClass = settings.Worker || runtime.Worker;
    var location = settings.location || runtime.location || { protocol: "" };
    var setTimer = settings.setTimeout || runtime.setTimeout.bind(runtime);
    var clearTimer = settings.clearTimeout || runtime.clearTimeout.bind(runtime);
    var workerUrl = settings.workerUrl || DEFAULT_WORKER_URL;
    var startupTimeoutMs = positiveTimeout(
      settings.startupTimeoutMs,
      DEFAULT_STARTUP_TIMEOUT_MS
    );
    var runTimeoutMs = positiveTimeout(
      settings.runTimeoutMs,
      DEFAULT_RUN_TIMEOUT_MS
    );
    var worker = null;
    var readyPromise = null;
    var readyResolve = null;
    var readyReject = null;
    var startupTimer = null;
    var requestCounter = 0;
    var pending = new Map();

    function ensureReady() {
      if (location.protocol === "file:") {
        return Promise.reject(new Error(
          "Python execution needs the local web server; module workers cannot start from a file:// page."
        ));
      }
      if (readyPromise) {
        return readyPromise;
      }

      readyPromise = new Promise(function (resolve, reject) {
        readyResolve = resolve;
        readyReject = reject;
      });

      try {
        if (typeof WorkerClass !== "function") {
          throw new Error("This browser cannot start the Python worker.");
        }
        worker = new WorkerClass(workerUrl, { type: "module" });
      } catch (error) {
        var failedReadyPromise = readyPromise;
        readyReject(error);
        resetWorker();
        return failedReadyPromise;
      }

      startupTimer = setTimer(function () {
        var error = new Error(
          "Python took too long to load. Check the network connection and try again."
        );
        if (readyReject) {
          readyReject(error);
        }
        resetWorker(error);
      }, startupTimeoutMs);
      worker.addEventListener("message", handleWorkerMessage);
      worker.addEventListener("error", function (event) {
        var error = new Error(
          event && event.message
            ? event.message
            : "The Python worker could not start."
        );
        if (readyReject) {
          readyReject(error);
        }
        resetWorker(error);
      });
      return readyPromise;
    }

    function handleWorkerMessage(event) {
      var message = event && event.data ? event.data : {};
      if (message.type === "ready") {
        clearTimer(startupTimer);
        startupTimer = null;
        if (readyResolve) {
          readyResolve();
        }
        readyResolve = null;
        readyReject = null;
        return;
      }
      if (message.type === "startup-error") {
        var startupError = new Error("Python could not load: " + message.error);
        if (readyReject) {
          readyReject(startupError);
        }
        resetWorker(startupError);
        return;
      }

      var request = pending.get(message.id);
      if (!request) {
        return;
      }
      clearTimer(request.timer);
      pending.delete(message.id);
      if (message.type === "result") {
        request.resolve(message.results || []);
      } else {
        request.reject(new Error(
          "Python runner error: " + (message.error || "Unknown error")
        ));
      }
    }

    function resetWorker(error) {
      clearTimer(startupTimer);
      startupTimer = null;
      if (worker) {
        worker.terminate();
      }
      worker = null;
      pending.forEach(function (request) {
        clearTimer(request.timer);
        request.reject(error || new Error("The Python runner was restarted."));
      });
      pending.clear();
      readyPromise = null;
      readyResolve = null;
      readyReject = null;
    }

    async function run(code, mode, tests) {
      await ensureReady();
      requestCounter += 1;
      var requestId = "run-" + requestCounter;
      return new Promise(function (resolve, reject) {
        var timer = setTimer(function () {
          pending.delete(requestId);
          var timeoutError = new Error(
            "The test run exceeded 12 seconds. The runner restarted to stop a possible infinite loop."
          );
          reject(timeoutError);
          resetWorker(timeoutError);
        }, runTimeoutMs);
        pending.set(requestId, {
          resolve: resolve,
          reject: reject,
          timer: timer
        });
        worker.postMessage({
          id: requestId,
          code: code,
          mode: mode,
          tests: tests
        });
      });
    }

    return Object.freeze({
      prepare: ensureReady,
      run: run
    });
  }

  global.PYTHON_RUNNER_CLIENT = Object.freeze({
    create: create
  });
})(typeof window !== "undefined" ? window : null);
