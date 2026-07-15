(function () {
  "use strict";

  // Persist progress as { version, blocks: { [blockId]: { theory, practical } } }.
  // Each mode owns one resumable `active` attempt and up to ten compact terminal
  // summaries in `history`. All timestamps are absolute Unix milliseconds so a
  // serialized attempt resumes against the same deadline after a page reload.

  var MODES = ["theory", "practical"];
  var ATTEMPT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  var HISTORY_LIMIT = 10;
  var DEFAULT_PASS_PERCENT = 60;
  var DEFAULT_PRACTICAL_POINTS = 20;
  var MAX_SAFE_DEPTH = 10;
  var BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

  function asArray(value) {
    if (value === undefined || value === null) {
      return [];
    }
    if (Array.isArray(value)) {
      return value;
    }
    if (value instanceof Set) {
      return Array.from(value);
    }
    return [value];
  }

  function normalizedChoice(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return "number:" + String(value);
    }
    if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
      return "number:" + String(Number(value));
    }
    if (typeof value === "string") {
      return "string:" + value;
    }
    if (typeof value === "boolean") {
      return "boolean:" + String(value);
    }
    return "other:" + String(value);
  }

  function normalizedAnswerSet(value) {
    return new Set(asArray(value).map(normalizedChoice));
  }

  function sameAnswerSet(actual, expected) {
    var selected = normalizedAnswerSet(actual);
    var answer = normalizedAnswerSet(expected);
    if (selected.size !== answer.size) {
      return false;
    }
    return Array.from(answer).every(function (choice) {
      return selected.has(choice);
    });
  }

  function finiteNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizedPassPercent(value) {
    return Math.min(100, Math.max(0, finiteNumber(value, DEFAULT_PASS_PERCENT)));
  }

  function roundedPercent(numerator, denominator) {
    if (!denominator) {
      return 0;
    }
    return Math.round((numerator / denominator) * 10000) / 100;
  }

  function passes(score, passPercent) {
    return finiteNumber(score, 0) >= normalizedPassPercent(passPercent);
  }

  function valueByQuestion(container, questionId, index) {
    if (container instanceof Map) {
      return container.get(questionId);
    }
    if (Array.isArray(container)) {
      var named = container.find(function (entry) {
        return entry && typeof entry === "object" &&
          String(entry.questionId || entry.id || "") === questionId;
      });
      if (named) {
        if (Object.prototype.hasOwnProperty.call(named, "answer")) {
          return named.answer;
        }
        if (Object.prototype.hasOwnProperty.call(named, "selected")) {
          return named.selected;
        }
        return named;
      }
      return container[index];
    }
    if (container && typeof container === "object") {
      return container[questionId];
    }
    return undefined;
  }

  function expectedTheoryAnswer(question) {
    if (Array.isArray(question && question.correct)) {
      return question.correct;
    }
    if (Array.isArray(question && question.answerIndexes)) {
      return question.answerIndexes;
    }
    if (Array.isArray(question && question.correctAnswerIndexes)) {
      return question.correctAnswerIndexes;
    }
    if (Array.isArray(question && question.correctAnswers)) {
      return question.correctAnswers;
    }
    return [];
  }

  function scoreTheory(questions, answers, options) {
    var definitions = Array.isArray(questions) ? questions : [];
    var config = options || {};
    var threshold = normalizedPassPercent(config.passPercent);
    var items = definitions.map(function (question, index) {
      var questionId = String(question && question.id ? question.id : "question-" + (index + 1));
      var selected = valueByQuestion(answers, questionId, index);
      var expected = expectedTheoryAnswer(question);
      return {
        id: questionId,
        correct: sameAnswerSet(selected, expected)
      };
    });
    var correctCount = items.filter(function (item) { return item.correct; }).length;
    var score = roundedPercent(correctCount, definitions.length);
    return {
      mode: "theory",
      correctCount: correctCount,
      totalCount: definitions.length,
      score: score,
      passPercent: threshold,
      passed: passes(score, threshold),
      items: items
    };
  }

  function practicalResultTests(result) {
    if (Array.isArray(result)) {
      return result;
    }
    if (result && Array.isArray(result.results)) {
      return result.results;
    }
    if (result && Array.isArray(result.tests)) {
      return result.tests;
    }
    return [];
  }

  function practicalDefinitionTests(question) {
    if (question && Array.isArray(question.tests)) {
      return question.tests;
    }
    if (question && question.testSpec && Array.isArray(question.testSpec.tests)) {
      return question.testSpec.tests;
    }
    return [];
  }

  function practicalQuestionPassed(question, result) {
    var actualTests = practicalResultTests(result);
    if (!actualTests.length) {
      return false;
    }

    var expectedTests = practicalDefinitionTests(question);
    if (!expectedTests.length) {
      return actualTests.every(function (testResult) {
        return Boolean(testResult && testResult.passed);
      });
    }

    var actualById = new Map();
    actualTests.forEach(function (testResult) {
      if (testResult && testResult.id !== undefined) {
        actualById.set(String(testResult.id), testResult);
      }
    });
    return expectedTests.every(function (testDefinition, index) {
      var hasExpectedId = testDefinition && testDefinition.id !== undefined;
      var testId = hasExpectedId ? String(testDefinition.id) : "test-" + (index + 1);
      var matching = hasExpectedId && actualById.size ? actualById.get(testId) : null;
      if (!matching && !actualById.size && actualTests.length === expectedTests.length) {
        matching = actualTests[index];
      }
      return Boolean(matching && matching.passed);
    });
  }

  function scorePractical(questions, results, options) {
    var definitions = Array.isArray(questions) ? questions : [];
    var config = options || {};
    var threshold = normalizedPassPercent(config.passPercent);
    var pointsPerQuestion = Math.max(0, finiteNumber(config.pointsPerQuestion, DEFAULT_PRACTICAL_POINTS));
    var items = definitions.map(function (question, index) {
      var questionId = String(question && question.id ? question.id : "question-" + (index + 1));
      var result = valueByQuestion(results, questionId, index);
      var passed = practicalQuestionPassed(question, result);
      return {
        id: questionId,
        passed: passed,
        points: passed ? pointsPerQuestion : 0
      };
    });
    var passedCount = items.filter(function (item) { return item.passed; }).length;
    var earnedPoints = items.reduce(function (total, item) { return total + item.points; }, 0);
    var maxPoints = definitions.length * pointsPerQuestion;
    var score = roundedPercent(earnedPoints, maxPoints);
    return {
      mode: "practical",
      passedCount: passedCount,
      totalCount: definitions.length,
      earnedPoints: earnedPoints,
      maxPoints: maxPoints,
      score: score,
      passPercent: threshold,
      passed: passes(score, threshold),
      items: items
    };
  }

  function timestamp(value) {
    if (value instanceof Date) {
      return Number.isFinite(value.getTime()) ? value.getTime() : null;
    }
    if (typeof value === "string" && value.trim() !== "") {
      var parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    var number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function deadlineFrom(startedAt, durationSeconds) {
    var start = timestamp(startedAt);
    var duration = finiteNumber(durationSeconds, -1);
    if (start === null || duration < 0) {
      return null;
    }
    return start + Math.floor(duration * 1000);
  }

  function remainingSeconds(deadlineAt, now) {
    var deadline = timestamp(deadlineAt);
    var current = timestamp(now === undefined ? Date.now() : now);
    if (deadline === null || current === null) {
      return 0;
    }
    return Math.max(0, Math.ceil((deadline - current) / 1000));
  }

  function blockDefinitions(config) {
    if (Array.isArray(config)) {
      return config;
    }
    return config && Array.isArray(config.blocks) ? config.blocks : [];
  }

  function blockMap(config) {
    var result = new Map();
    blockDefinitions(config).forEach(function (block) {
      if (block && typeof block.id === "string" && block.id.trim()) {
        result.set(block.id.trim(), block);
      }
    });
    return result;
  }

  function emptyModeProgress() {
    return { active: null, history: [] };
  }

  function createProgress(config) {
    var progress = {
      version: Math.max(1, Math.floor(finiteNumber(config && config.version, 1))),
      blocks: {}
    };
    blockMap(config).forEach(function (_block, blockId) {
      progress.blocks[blockId] = {
        theory: emptyModeProgress(),
        practical: emptyModeProgress()
      };
    });
    return progress;
  }

  function safeClone(value, depth) {
    var level = depth || 0;
    if (level > MAX_SAFE_DEPTH || value === undefined || typeof value === "function" || typeof value === "symbol") {
      return undefined;
    }
    if (value === null || typeof value === "string" || typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      return value.map(function (item) { return safeClone(item, level + 1); }).filter(function (item) {
        return item !== undefined;
      });
    }
    if (typeof value === "object") {
      var clone = {};
      Object.keys(value).forEach(function (key) {
        if (BLOCKED_KEYS.has(key)) {
          return;
        }
        var cloned = safeClone(value[key], level + 1);
        if (cloned !== undefined) {
          clone[key] = cloned;
        }
      });
      return clone;
    }
    return undefined;
  }

  function generatedAttemptId() {
    var cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : null;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
      return cryptoApi.randomUUID();
    }
    if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
      var bytes = new Uint8Array(16);
      cryptoApi.getRandomValues(bytes);
      return Array.from(bytes).map(function (value) {
        return value.toString(16).padStart(2, "0");
      }).join("");
    }
    return "attempt-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 14);
  }

  function validAttemptId(value) {
    return typeof value === "string" && ATTEMPT_ID_PATTERN.test(value);
  }

  function withImmutableId(attempt, id) {
    Object.defineProperty(attempt, "id", {
      value: id,
      enumerable: true,
      configurable: false,
      writable: false
    });
    return attempt;
  }

  function modeDuration(block, mode) {
    var definition = block && block[mode];
    return Math.max(0, finiteNumber(definition && definition.durationSeconds, 0));
  }

  function createAttempt(config, details) {
    var input = details && typeof details === "object" ? details : {};
    var blocks = blockMap(config);
    var blockId = String(input.blockId || "");
    var mode = MODES.indexOf(input.mode) >= 0 ? input.mode : "";
    var block = blocks.get(blockId);
    if (!block) {
      throw new Error("Assessment block is not present in the supplied configuration.");
    }
    if (!mode) {
      throw new Error("Assessment mode must be theory or practical.");
    }

    var id = validAttemptId(input.id) ? input.id : generatedAttemptId();
    var startedAt = timestamp(input.startedAt === undefined ? Date.now() : input.startedAt);
    if (startedAt === null) {
      throw new Error("Assessment start time is invalid.");
    }
    var durationSeconds = input.durationSeconds === undefined
      ? modeDuration(block, mode)
      : Math.max(0, finiteNumber(input.durationSeconds, 0));
    var attempt = safeClone(input) || {};
    delete attempt.id;
    attempt.blockId = blockId;
    attempt.mode = mode;
    attempt.status = "active";
    attempt.startedAt = startedAt;
    attempt.deadlineAt = deadlineFrom(startedAt, durationSeconds);
    attempt.updatedAt = timestamp(input.updatedAt) || startedAt;
    return withImmutableId(attempt, id);
  }

  function sanitizeAttempt(raw, blockId, mode, status) {
    if (!raw || typeof raw !== "object" || !validAttemptId(raw.id)) {
      return null;
    }
    var attempt = safeClone(raw) || {};
    var id = raw.id;
    delete attempt.id;
    attempt.blockId = blockId;
    attempt.mode = mode;
    attempt.status = status;

    ["startedAt", "deadlineAt", "updatedAt", "submittedAt"].forEach(function (field) {
      if (attempt[field] !== undefined) {
        var normalized = timestamp(attempt[field]);
        if (normalized === null) {
          delete attempt[field];
        } else {
          attempt[field] = normalized;
        }
      }
    });
    if (attempt.score !== undefined) {
      attempt.score = Math.min(100, Math.max(0, finiteNumber(attempt.score, 0)));
    }
    if (attempt.passed !== undefined) {
      attempt.passed = Boolean(attempt.passed);
    }
    return withImmutableId(attempt, id);
  }

  function compactHistoryAttempt(attempt, blockId, mode) {
    var status = attempt && attempt.status === "expired" ? "expired" : "submitted";
    var sanitized = sanitizeAttempt(attempt, blockId, mode, status);
    if (!sanitized) {
      return null;
    }
    var compact = {
      blockId: blockId,
      mode: mode,
      status: status
    };
    [
      "revision", "startedAt", "deadlineAt", "updatedAt", "submittedAt", "score", "passed",
      "correctCount", "passedCount", "totalCount", "earnedPoints", "maxPoints", "reason"
    ].forEach(function (field) {
      if (sanitized[field] !== undefined) {
        compact[field] = safeClone(sanitized[field]);
      }
    });
    var results = compactAttemptResults(sanitized.results, mode);
    if (results.length) {
      compact.results = results;
    }
    return withImmutableId(compact, sanitized.id);
  }

  function compactAttemptResults(value, mode) {
    if (!Array.isArray(value)) {
      return [];
    }
    var limit = mode === "theory" ? 20 : 10;
    return value.slice(0, limit).map(function (entry) {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      var questionId = String(entry.questionId || entry.id || "").slice(0, 160);
      if (!questionId) {
        return null;
      }
      if (mode === "theory") {
        return {
          questionId: questionId,
          correct: Boolean(entry.correct),
          selected: asArray(entry.selected).slice(0, 10).map(function (choice) {
            return Math.max(0, Math.floor(finiteNumber(choice, 0)));
          })
        };
      }
      var result = {
        questionId: questionId,
        passed: Boolean(entry.passed),
        passedCount: Math.max(0, Math.floor(finiteNumber(entry.passedCount, 0))),
        totalCount: Math.max(0, Math.floor(finiteNumber(entry.totalCount, 0)))
      };
      if (entry.runnerError) {
        result.runnerError = String(entry.runnerError).slice(0, 2000);
      }
      return result;
    }).filter(Boolean);
  }

  function attemptTime(attempt) {
    return timestamp(attempt && (
      attempt.submittedAt !== undefined ? attempt.submittedAt :
        attempt.updatedAt !== undefined ? attempt.updatedAt :
          attempt.deadlineAt !== undefined ? attempt.deadlineAt : attempt.startedAt
    )) || 0;
  }

  function sortedHistory(history, shouldLimit) {
    var sorted = history.slice().sort(function (left, right) {
      var timeDifference = attemptTime(right) - attemptTime(left);
      return timeDifference || String(right.id).localeCompare(String(left.id));
    });
    return shouldLimit === false ? sorted : sorted.slice(0, HISTORY_LIMIT);
  }

  function modeBestScore(modeProgress, history) {
    var configuredBest = modeProgress && modeProgress.bestScore !== undefined
      ? Math.min(100, Math.max(0, finiteNumber(modeProgress.bestScore, 0)))
      : 0;
    return (Array.isArray(history) ? history : []).reduce(function (best, attempt) {
      return Math.max(best, Math.min(100, Math.max(0, finiteNumber(attempt && attempt.score, 0))));
    }, configuredBest);
  }

  function modeCompleted(modeProgress, history) {
    return Boolean(
      modeProgress && modeProgress.completed ||
      (Array.isArray(history) ? history : []).some(function (attempt) {
        return Boolean(attempt && attempt.passed);
      })
    );
  }

  function sanitizeModeProgress(rawMode, blockId, mode, shouldLimitHistory) {
    var source = rawMode && typeof rawMode === "object" ? rawMode : {};
    var active = sanitizeAttempt(source.active, blockId, mode, "active");
    var historyById = new Map();
    (Array.isArray(source.history) ? source.history : []).forEach(function (entry) {
      var compact = compactHistoryAttempt(entry, blockId, mode);
      if (compact) {
        var existing = historyById.get(compact.id);
        if (!existing || attemptTime(compact) >= attemptTime(existing)) {
          historyById.set(compact.id, compact);
        }
      }
    });
    if (active && historyById.has(active.id)) {
      active = null;
    }
    var completeHistory = Array.from(historyById.values());
    var cleanMode = safeClone(source) || {};
    cleanMode.active = active;
    cleanMode.history = sortedHistory(completeHistory, shouldLimitHistory);
    // Keep achievement facts outside the bounded review history. Otherwise a
    // pass could disappear after ten later retakes roll the original attempt
    // out of the recent-history window.
    cleanMode.bestScore = modeBestScore(source, completeHistory);
    cleanMode.completed = modeCompleted(source, completeHistory);
    return cleanMode;
  }

  function sanitizeProgressInternal(raw, config, shouldLimitHistory) {
    var source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    var sourceBlocks = source.blocks && typeof source.blocks === "object" && !Array.isArray(source.blocks)
      ? source.blocks
      : {};
    var configured = createProgress(config);
    var clean = safeClone(source) || {};
    clean.version = Math.max(
      configured.version,
      Math.max(1, Math.floor(finiteNumber(source.version, configured.version)))
    );
    clean.blocks = safeClone(sourceBlocks) || {};
    Object.keys(configured.blocks).forEach(function (blockId) {
      var sourceBlock = sourceBlocks[blockId] && typeof sourceBlocks[blockId] === "object"
        ? sourceBlocks[blockId]
        : {};
      var cleanBlock = safeClone(sourceBlock) || {};
      MODES.forEach(function (mode) {
        cleanBlock[mode] = sanitizeModeProgress(
          sourceBlock[mode],
          blockId,
          mode,
          shouldLimitHistory
        );
      });
      clean.blocks[blockId] = cleanBlock;
    });
    return clean;
  }

  function sanitizeProgress(raw, config) {
    return sanitizeProgressInternal(raw, config, true);
  }

  function deepMerge(left, right) {
    if (!left || typeof left !== "object" || Array.isArray(left)) {
      return safeClone(right);
    }
    if (!right || typeof right !== "object" || Array.isArray(right)) {
      return safeClone(right === undefined ? left : right);
    }
    var merged = safeClone(left) || {};
    Object.keys(right).forEach(function (key) {
      if (BLOCKED_KEYS.has(key) || key === "id") {
        return;
      }
      if (
        merged[key] && typeof merged[key] === "object" && !Array.isArray(merged[key]) &&
        right[key] && typeof right[key] === "object" && !Array.isArray(right[key])
      ) {
        merged[key] = deepMerge(merged[key], right[key]);
      } else {
        merged[key] = safeClone(right[key]);
      }
    });
    return merged;
  }

  function mergeSameActive(localAttempt, remoteAttempt, blockId, mode) {
    var localIsNewer = attemptTime(localAttempt) >= attemptTime(remoteAttempt);
    var older = localIsNewer ? remoteAttempt : localAttempt;
    var newer = localIsNewer ? localAttempt : remoteAttempt;
    var merged = deepMerge(older, newer) || {};
    delete merged.id;
    merged.blockId = blockId;
    merged.mode = mode;
    merged.status = "active";
    return withImmutableId(merged, localAttempt.id);
  }

  function mergeHistoryRecord(existing, candidate, blockId, mode) {
    if (!existing) {
      return compactHistoryAttempt(candidate, blockId, mode);
    }
    var newer = attemptTime(candidate) >= attemptTime(existing) ? candidate : existing;
    var older = newer === candidate ? existing : candidate;
    var merged = deepMerge(older, newer) || {};
    merged.status = existing.status === "submitted" || candidate.status === "submitted"
      ? "submitted"
      : "expired";
    if (existing.score !== undefined || candidate.score !== undefined) {
      merged.score = Math.max(finiteNumber(existing.score, 0), finiteNumber(candidate.score, 0));
    }
    if (existing.passed !== undefined || candidate.passed !== undefined) {
      merged.passed = Boolean(existing.passed || candidate.passed);
    }
    return compactHistoryAttempt(Object.assign(merged, { id: existing.id }), blockId, mode);
  }

  function supersededHistoryAttempt(attempt, blockId, mode) {
    var summary = safeClone(attempt) || {};
    summary.status = "expired";
    summary.updatedAt = attemptTime(attempt);
    summary.reason = "superseded";
    return compactHistoryAttempt(Object.assign(summary, { id: attempt.id }), blockId, mode);
  }

  function mergeModeProgress(localMode, remoteMode, blockId, mode) {
    var historyById = new Map();
    localMode.history.concat(remoteMode.history).forEach(function (entry) {
      historyById.set(
        entry.id,
        mergeHistoryRecord(historyById.get(entry.id), entry, blockId, mode)
      );
    });

    var localActive = localMode.active;
    var remoteActive = remoteMode.active;
    var active = null;
    if (localActive && remoteActive && localActive.id === remoteActive.id) {
      active = mergeSameActive(localActive, remoteActive, blockId, mode);
    } else if (localActive && remoteActive) {
      var localIsNewer = attemptTime(localActive) >= attemptTime(remoteActive);
      active = localIsNewer ? localActive : remoteActive;
      var superseded = supersededHistoryAttempt(localIsNewer ? remoteActive : localActive, blockId, mode);
      historyById.set(
        superseded.id,
        mergeHistoryRecord(historyById.get(superseded.id), superseded, blockId, mode)
      );
    } else {
      active = localActive || remoteActive || null;
    }

    if (active && historyById.has(active.id)) {
      active = null;
    }
    var mergedMode = safeClone(localMode) || {};
    Object.keys(remoteMode || {}).forEach(function (key) {
      if (key !== "active" && key !== "history" && !BLOCKED_KEYS.has(key)) {
        mergedMode[key] = safeClone(remoteMode[key]);
      }
    });
    var completeHistory = Array.from(historyById.values());
    mergedMode.active = active;
    mergedMode.history = sortedHistory(completeHistory, true);
    mergedMode.bestScore = Math.max(
      modeBestScore(localMode, localMode.history),
      modeBestScore(remoteMode, remoteMode.history),
      modeBestScore({}, completeHistory)
    );
    mergedMode.completed = Boolean(
      modeCompleted(localMode, localMode.history) ||
      modeCompleted(remoteMode, remoteMode.history) ||
      modeCompleted({}, completeHistory)
    );
    return mergedMode;
  }

  function mergeProgress(localProgress, remoteProgress, config) {
    var local = sanitizeProgressInternal(localProgress, config, false);
    var remote = sanitizeProgressInternal(remoteProgress, config, false);
    var configured = createProgress(config);
    var merged = safeClone(local) || configured;
    Object.keys(remote).forEach(function (key) {
      if (key !== "blocks" && key !== "version" && !BLOCKED_KEYS.has(key)) {
        merged[key] = safeClone(remote[key]);
      }
    });
    merged.version = Math.max(configured.version, finiteNumber(local.version, 1), finiteNumber(remote.version, 1));
    merged.blocks = merged.blocks && typeof merged.blocks === "object" && !Array.isArray(merged.blocks)
      ? merged.blocks
      : {};
    Object.keys(remote.blocks || {}).forEach(function (blockId) {
      if (!Object.prototype.hasOwnProperty.call(configured.blocks, blockId)) {
        merged.blocks[blockId] = safeClone(remote.blocks[blockId]);
        return;
      }
      var localBlock = merged.blocks[blockId] && typeof merged.blocks[blockId] === "object"
        ? merged.blocks[blockId]
        : {};
      var remoteBlock = remote.blocks[blockId] && typeof remote.blocks[blockId] === "object"
        ? remote.blocks[blockId]
        : {};
      Object.keys(remoteBlock).forEach(function (key) {
        if (MODES.indexOf(key) < 0 && !BLOCKED_KEYS.has(key)) {
          localBlock[key] = safeClone(remoteBlock[key]);
        }
      });
      merged.blocks[blockId] = localBlock;
    });
    Object.keys(configured.blocks).forEach(function (blockId) {
      merged.blocks[blockId] = merged.blocks[blockId] && typeof merged.blocks[blockId] === "object"
        ? merged.blocks[blockId]
        : {};
      MODES.forEach(function (mode) {
        merged.blocks[blockId][mode] = mergeModeProgress(
          local.blocks[blockId][mode],
          remote.blocks[blockId][mode],
          blockId,
          mode
        );
      });
    });
    return merged;
  }

  window.ASSESSMENT_ENGINE = Object.freeze({
    HISTORY_LIMIT: HISTORY_LIMIT,
    createAttempt: createAttempt,
    createProgress: createProgress,
    deadlineFrom: deadlineFrom,
    mergeProgress: mergeProgress,
    passes: passes,
    practicalQuestionPassed: practicalQuestionPassed,
    remainingSeconds: remainingSeconds,
    sameAnswerSet: sameAnswerSet,
    sanitizeProgress: sanitizeProgress,
    scorePractical: scorePractical,
    scoreTheory: scoreTheory
  });
})();
