(function (global) {
  "use strict";

  if (!global) {
    return;
  }

  var STORAGE_KEY = "fp-playground.audio.enabled.v1";
  var AudioContextClass = global.AudioContext || global.webkitAudioContext || null;
  var context = null;
  var masterGain = null;
  var compressor = null;
  var hasInteracted = false;
  var isEnabled = readEnabledPreference();
  var reducedIntensity = readReducedIntensity();
  var lastPlayedAt = Object.create(null);
  var lastNonClickAt = 0;
  var lastSuccessAt = 0;

  watchForUserInteraction();
  watchReducedMotionPreference();

  function readEnabledPreference() {
    try {
      var stored = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      if (stored === "false") {
        return false;
      }
      if (stored === "true") {
        return true;
      }
    } catch (_error) {
      // Storage can be unavailable in private or locked-down browser contexts.
    }
    return true;
  }

  function persistEnabledPreference() {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, String(isEnabled));
      }
    } catch (_error) {
      // Audio still works when storage is unavailable; the choice just is not persistent.
    }
  }

  function readReducedIntensity() {
    try {
      return Boolean(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (_error) {
      return false;
    }
  }

  function watchReducedMotionPreference() {
    if (!global.matchMedia) {
      return;
    }

    try {
      var query = global.matchMedia("(prefers-reduced-motion: reduce)");
      var update = function (event) {
        reducedIntensity = Boolean(event.matches);
      };

      if (typeof query.addEventListener === "function") {
        query.addEventListener("change", update);
      } else if (typeof query.addListener === "function") {
        query.addListener(update);
      }
    } catch (_error) {
      // A missing media-query implementation should never affect the application.
    }
  }

  function watchForUserInteraction() {
    if (!global.document || typeof global.document.addEventListener !== "function") {
      return;
    }

    var markInteraction = function (event) {
      if (!event || event.isTrusted !== false) {
        hasInteracted = true;
      }
    };

    global.document.addEventListener("pointerdown", markInteraction, { capture: true, passive: true });
    global.document.addEventListener("touchstart", markInteraction, { capture: true, passive: true });
    global.document.addEventListener("keydown", markInteraction, { capture: true });
    global.document.addEventListener("click", markInteraction, { capture: true });
  }

  function userHasInteracted() {
    if (hasInteracted) {
      return true;
    }

    try {
      var activation = global.navigator && global.navigator.userActivation;
      if (activation && (activation.isActive || activation.hasBeenActive)) {
        hasInteracted = true;
        return true;
      }
    } catch (_error) {
      // Fall through to the interaction flag in browsers without User Activation support.
    }

    return false;
  }

  function ensureContext() {
    if (!AudioContextClass || !userHasInteracted()) {
      return null;
    }
    if (context) {
      return context;
    }

    try {
      context = new AudioContextClass();
      masterGain = context.createGain();
      masterGain.gain.setValueAtTime(isEnabled ? 0.72 : 0, context.currentTime);

      if (typeof context.createDynamicsCompressor === "function") {
        compressor = context.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-20, context.currentTime);
        compressor.knee.setValueAtTime(18, context.currentTime);
        compressor.ratio.setValueAtTime(5, context.currentTime);
        compressor.attack.setValueAtTime(0.004, context.currentTime);
        compressor.release.setValueAtTime(0.14, context.currentTime);
        masterGain.connect(compressor);
        compressor.connect(context.destination);
      } else {
        masterGain.connect(context.destination);
      }
    } catch (_error) {
      context = null;
      masterGain = null;
      compressor = null;
    }

    return context;
  }

  function unlock() {
    if (!userHasInteracted()) {
      return Promise.resolve(false);
    }

    var audioContext = ensureContext();
    if (!audioContext) {
      return Promise.resolve(false);
    }
    if (audioContext.state === "running") {
      return Promise.resolve(true);
    }
    if (typeof audioContext.resume !== "function") {
      return Promise.resolve(true);
    }

    try {
      return audioContext.resume().then(function () {
        return audioContext.state === "running";
      }).catch(function () {
        return false;
      });
    } catch (_error) {
      return Promise.resolve(false);
    }
  }

  function enabled() {
    return isEnabled;
  }

  function setEnabled(nextEnabled) {
    isEnabled = Boolean(nextEnabled);
    persistEnabledPreference();

    if (context && masterGain) {
      var now = context.currentTime;
      try {
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(masterGain.gain.value, now);
        masterGain.gain.linearRampToValueAtTime(isEnabled ? 0.72 : 0, now + 0.025);
      } catch (_error) {
        masterGain.gain.value = isEnabled ? 0.72 : 0;
      }
    }

    if (isEnabled && userHasInteracted()) {
      unlock();
    }
    return isEnabled;
  }

  function toggle() {
    return setEnabled(!isEnabled);
  }

  function monotonicNow() {
    if (global.performance && typeof global.performance.now === "function") {
      return global.performance.now();
    }
    return Date.now();
  }

  function canPlay(name, cooldownMs) {
    if (!isEnabled || !userHasInteracted()) {
      return false;
    }

    var now = monotonicNow();
    if (now - (lastPlayedAt[name] || 0) < cooldownMs) {
      return false;
    }
    if (name === "click" && now - lastNonClickAt < 90) {
      return false;
    }

    lastPlayedAt[name] = now;
    if (name !== "click") {
      lastNonClickAt = now;
    }
    return true;
  }

  function intensity() {
    return reducedIntensity ? 0.55 : 1;
  }

  function playCue(name, cooldownMs, buildCue) {
    if (!canPlay(name, cooldownMs)) {
      return false;
    }

    var audioContext = ensureContext();
    if (!audioContext || !masterGain) {
      return false;
    }

    var schedule = function () {
      if (!isEnabled || !context || !masterGain) {
        return;
      }
      try {
        buildCue(context, context.currentTime + 0.008, intensity());
      } catch (_error) {
        // A sound effect must never interfere with exercise controls or test results.
      }
    };

    if (audioContext.state === "suspended" && typeof audioContext.resume === "function") {
      try {
        audioContext.resume().then(schedule).catch(function () {});
      } catch (_error) {
        return false;
      }
    } else {
      schedule();
    }
    return true;
  }

  function addTone(audioContext, startAt, frequency, duration, volume, options) {
    var settings = options || {};
    var oscillator = audioContext.createOscillator();
    var gain = audioContext.createGain();
    var attack = Math.max(0.003, settings.attack || 0.008);
    var releaseAt = startAt + Math.max(attack + 0.006, duration);
    var peak = Math.max(0.0001, volume);

    oscillator.type = settings.type || "sine";
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), startAt);
    if (settings.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, settings.endFrequency), releaseAt);
    }
    if (settings.detune) {
      oscillator.detune.setValueAtTime(settings.detune, startAt);
    }

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(peak, startAt + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, releaseAt);

    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(startAt);
    oscillator.stop(releaseAt + 0.025);
  }

  function addGlassNoise(audioContext, startAt, duration, volume) {
    if (typeof audioContext.createBuffer !== "function" || typeof audioContext.createBufferSource !== "function") {
      return;
    }

    var sampleCount = Math.max(1, Math.floor(audioContext.sampleRate * duration));
    var buffer = audioContext.createBuffer(1, sampleCount, audioContext.sampleRate);
    var samples = buffer.getChannelData(0);
    var previous = 0;

    for (var index = 0; index < sampleCount; index += 1) {
      var envelope = Math.pow(1 - index / sampleCount, 2.4);
      var white = Math.random() * 2 - 1;
      previous = previous * 0.22 + white * 0.78;
      samples[index] = previous * envelope;
    }

    var source = audioContext.createBufferSource();
    var filter = audioContext.createBiquadFilter();
    var gain = audioContext.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2350, startAt);
    filter.Q.setValueAtTime(1.2, startAt);
    gain.gain.setValueAtTime(Math.max(0.0001, volume), startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start(startAt);
    source.stop(startAt + duration + 0.015);
  }

  function playClick() {
    return playCue("click", 70, function (audioContext, startAt, scale) {
      addTone(audioContext, startAt, 610, 0.045, 0.025 * scale, {
        type: "triangle",
        attack: 0.004,
        endFrequency: 455
      });
    });
  }

  function playSubmit() {
    return playCue("submit", 180, function (audioContext, startAt, scale) {
      addTone(audioContext, startAt, 350, 0.11, 0.032 * scale, {
        type: "sine",
        attack: 0.008,
        endFrequency: 515
      });
      addTone(audioContext, startAt + 0.065, 555, 0.12, 0.025 * scale, {
        type: "triangle",
        attack: 0.007,
        endFrequency: 680
      });
    });
  }

  function playFailure() {
    return playCue("failure", 420, function (audioContext, startAt, scale) {
      addGlassNoise(audioContext, startAt, reducedIntensity ? 0.09 : 0.14, 0.018 * scale);
      [1240, 1780, 2380].forEach(function (frequency, index) {
        addTone(audioContext, startAt + index * 0.012, frequency, 0.16 + index * 0.025, 0.014 * scale, {
          type: "sine",
          attack: 0.003,
          endFrequency: frequency * 0.72,
          detune: index % 2 === 0 ? -4 : 5
        });
      });
      addTone(audioContext, startAt + 0.035, 196, 0.19, 0.018 * scale, {
        type: "triangle",
        attack: 0.006,
        endFrequency: 148
      });
    });
  }

  function playSuccess() {
    var played = playCue("success", 520, function (audioContext, startAt, scale) {
      [523.25, 659.25, 783.99, 1046.5].forEach(function (frequency, index) {
        addTone(audioContext, startAt + index * 0.026, frequency, 0.27 - index * 0.018, 0.025 * scale, {
          type: index < 3 ? "triangle" : "sine",
          attack: 0.012
        });
      });
    });
    if (played) {
      lastSuccessAt = monotonicNow();
    }
    return played;
  }

  function playAchievement() {
    return playCue("achievement", 900, function (audioContext, startAt, scale) {
      var followsSuccess = monotonicNow() - lastSuccessAt < 850;
      var offset = followsSuccess ? 0.31 : 0;
      var frequencies = reducedIntensity
        ? [659.25, 783.99, 1046.5]
        : [523.25, 659.25, 783.99, 987.77, 1318.51];

      frequencies.forEach(function (frequency, index) {
        addTone(audioContext, startAt + offset + index * 0.066, frequency, 0.21, 0.024 * scale, {
          type: index % 2 === 0 ? "triangle" : "sine",
          attack: 0.009
        });
      });

      if (!reducedIntensity) {
        addTone(audioContext, startAt + offset + 0.285, 659.25, 0.28, 0.014 * scale, {
          type: "sine",
          attack: 0.02
        });
      }
    });
  }

  global.APP_AUDIO = Object.freeze({
    enabled: enabled,
    setEnabled: setEnabled,
    toggle: toggle,
    unlock: unlock,
    playClick: playClick,
    playSubmit: playSubmit,
    playFailure: playFailure,
    playSuccess: playSuccess,
    playAchievement: playAchievement
  });
})(typeof window !== "undefined" ? window : null);
