import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const source = await readFile(
  resolve(REPOSITORY_ROOT, "public/app/feedback/audio-feedback.js"),
  "utf8",
);

function createAudioParam(label, trace) {
  return {
    value: 0,
    events: [],
    setValueAtTime(value, time) {
      this.value = value;
      this.events.push({ method: "set", value, time });
      trace.parameterEvents.push({ label, method: "set", value, time });
    },
    exponentialRampToValueAtTime(value, time) {
      this.value = value;
      this.events.push({ method: "exponentialRamp", value, time });
      trace.parameterEvents.push({ label, method: "exponentialRamp", value, time });
    },
    linearRampToValueAtTime(value, time) {
      this.value = value;
      this.events.push({ method: "linearRamp", value, time });
      trace.parameterEvents.push({ label, method: "linearRamp", value, time });
    },
    cancelScheduledValues(time) {
      this.events.push({ method: "cancel", time });
      trace.parameterEvents.push({ label, method: "cancel", time });
    },
  };
}

function createConnectable(kind, trace) {
  return {
    kind,
    connections: [],
    connect(target) {
      this.connections.push(target);
      trace.connections.push({ from: kind, to: target && target.kind });
      return target;
    },
  };
}

function createHarness({ enabled = true, hidden = false, reducedMotion = false } = {}) {
  const listeners = new Map();
  const storage = new Map([
    ["fp-playground.audio.enabled.v1", String(enabled)],
  ]);
  const trace = {
    contexts: [],
    oscillators: [],
    gains: [],
    parameterEvents: [],
    connections: [],
  };
  let now = 1_000;

  class FakeAudioContext {
    constructor() {
      this.currentTime = 4;
      this.sampleRate = 48_000;
      this.state = "running";
      this.destination = { kind: "destination" };
      trace.contexts.push(this);
    }

    createGain() {
      const node = createConnectable("gain", trace);
      node.gain = createAudioParam("gain", trace);
      trace.gains.push(node);
      return node;
    }

    createDynamicsCompressor() {
      const node = createConnectable("compressor", trace);
      node.threshold = createAudioParam("compressor.threshold", trace);
      node.knee = createAudioParam("compressor.knee", trace);
      node.ratio = createAudioParam("compressor.ratio", trace);
      node.attack = createAudioParam("compressor.attack", trace);
      node.release = createAudioParam("compressor.release", trace);
      return node;
    }

    createOscillator() {
      const node = createConnectable("oscillator", trace);
      node.type = "sine";
      node.frequency = createAudioParam("oscillator.frequency", trace);
      node.detune = createAudioParam("oscillator.detune", trace);
      node.start = (time) => {
        node.startedAt = time;
      };
      node.stop = (time) => {
        node.stoppedAt = time;
      };
      trace.oscillators.push(node);
      return node;
    }

    createBuffer(_channels, length) {
      const samples = new Float32Array(length);
      return {
        getChannelData() {
          return samples;
        },
      };
    }

    createBufferSource() {
      const node = createConnectable("buffer-source", trace);
      node.start = (time) => {
        node.startedAt = time;
      };
      node.stop = (time) => {
        node.stoppedAt = time;
      };
      return node;
    }

    createBiquadFilter() {
      const node = createConnectable("filter", trace);
      node.frequency = createAudioParam("filter.frequency", trace);
      node.Q = createAudioParam("filter.Q", trace);
      return node;
    }

    resume() {
      this.state = "running";
      return Promise.resolve();
    }
  }

  const document = {
    hidden,
    addEventListener(type, listener) {
      const handlers = listeners.get(type) || [];
      handlers.push(listener);
      listeners.set(type, handlers);
    },
  };
  const mediaQuery = {
    matches: reducedMotion,
    addEventListener() {},
    addListener() {},
  };
  const window = {
    AudioContext: FakeAudioContext,
    document,
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
    },
    matchMedia() {
      return mediaQuery;
    },
    navigator: {
      userActivation: {
        isActive: false,
        hasBeenActive: false,
      },
    },
    performance: {
      now() {
        return now;
      },
    },
  };

  const context = vm.createContext({ window });
  vm.runInContext(source, context, { filename: "audio-feedback.js" });

  return {
    api: window.APP_AUDIO,
    document,
    trace,
    activate() {
      for (const listener of listeners.get("pointerdown") || []) {
        listener({ isTrusted: true });
      }
      window.navigator.userActivation.isActive = true;
      window.navigator.userActivation.hasBeenActive = true;
    },
    advance(milliseconds) {
      now += milliseconds;
    },
  };
}

function initialFrequencies(oscillators) {
  return oscillators.map((oscillator) => {
    const event = oscillator.frequency.events.find((item) => item.method === "set");
    return event && event.value;
  });
}

function cueResult(name, options) {
  const harness = createHarness(options);
  harness.activate();
  const played = harness.api[name]();
  const peak = harness.trace.gains
    .flatMap((gain) => gain.gain.events)
    .filter((event) => event.method === "exponentialRamp" && event.value > 0.001)
    .reduce((maximum, event) => Math.max(maximum, event.value), 0);
  return {
    frequencies: initialFrequencies(harness.trace.oscillators),
    peak,
    played,
  };
}

test("audio feedback exposes a frozen semantic cue API", () => {
  const harness = createHarness();
  const expectedMethods = [
    "enabled",
    "setEnabled",
    "toggle",
    "unlock",
    "playClick",
    "playFailure",
    "playAchievement",
    "playRun",
    "playRunAll",
    "playCheck",
    "playRunComplete",
    "playTestComplete",
    "playTaskComplete",
  ];

  assert.equal(Object.isFrozen(harness.api), true);
  for (const method of expectedMethods) {
    assert.equal(typeof harness.api[method], "function", `${method} should remain callable`);
  }
});

test("semantic run, test, check, and completion cues schedule distinct signatures", () => {
  const names = [
    "playRun",
    "playRunAll",
    "playCheck",
    "playRunComplete",
    "playTestComplete",
    "playTaskComplete",
  ];
  const results = names.map((name) => cueResult(name));

  assert.deepEqual(
    results.map((result) => result.frequencies.length),
    [2, 4, 2, 2, 6, 5],
    "larger completion cues should remain richer than repeatable run cues",
  );
  assert.equal(
    new Set(results.map((result) => result.frequencies.join(","))).size,
    names.length,
    "every learner action should have a recognizably different pitch signature",
  );
  assert.equal(results.every((result) => result.played), true);
  assert.deepEqual(results[0].frequencies, [420, 1050]);
  assert.deepEqual(results[1].frequencies, [330, 495, 740, 1320]);
  assert.deepEqual(results[2].frequencies, [440, 659.25]);
});

test("audio never schedules before activation, while muted, or in a hidden page", () => {
  const inactive = createHarness();
  assert.equal(inactive.api.playRun(), false);
  assert.equal(inactive.trace.contexts.length, 0);
  assert.equal(inactive.trace.oscillators.length, 0);

  const muted = createHarness({ enabled: false });
  muted.activate();
  assert.equal(muted.api.playRunAll(), false);
  assert.equal(muted.trace.contexts.length, 0);
  assert.equal(muted.trace.oscillators.length, 0);

  const hidden = createHarness({ hidden: true });
  hidden.activate();
  assert.equal(hidden.api.playTaskComplete(), false);
  assert.equal(hidden.trace.contexts.length, 0);
  assert.equal(hidden.trace.oscillators.length, 0);
});

test("reduced-motion preference lowers reward intensity and removes flourish notes", () => {
  const standardTests = cueResult("playTestComplete");
  const reducedTests = cueResult("playTestComplete", { reducedMotion: true });
  const standardTask = cueResult("playTaskComplete");
  const reducedTask = cueResult("playTaskComplete", { reducedMotion: true });

  assert.equal(standardTests.frequencies.length, 6);
  assert.equal(reducedTests.frequencies.length, 4);
  assert.equal(standardTask.frequencies.length, 5);
  assert.equal(reducedTask.frequencies.length, 3);
  assert.ok(reducedTests.peak < standardTests.peak);
  assert.ok(reducedTask.peak < standardTask.peak);
  assert.ok(Math.abs(reducedTests.peak / standardTests.peak - 0.55) < 0.001);
  assert.ok(Math.abs(reducedTask.peak / standardTask.peak - 0.55) < 0.001);
});
