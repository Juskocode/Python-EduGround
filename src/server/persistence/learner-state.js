const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const ASSESSMENT_HISTORY_LIMIT = 10;

function safeObjectKeys(value) {
  return Object.keys(value).filter((key) => !BLOCKED_KEYS.has(key)).sort();
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneJson(value) {
  if (Array.isArray(value)) return value.map(cloneJson);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    safeObjectKeys(value)
      .map((key) => [key, cloneJson(value[key])])
  );
}

function canonicalJson(value) {
  return JSON.stringify(cloneJson(value));
}

function compareCanonical(left, right) {
  return canonicalJson(left).localeCompare(canonicalJson(right), "en");
}

function unionJsonArrays(currentValue, incomingValue) {
  const current = Array.isArray(currentValue) ? currentValue : [];
  const incoming = Array.isArray(incomingValue) ? incomingValue : [];
  const unique = new Map();
  for (const item of [...current, ...incoming]) {
    const cloned = cloneJson(item);
    unique.set(canonicalJson(cloned), cloned);
  }
  return [...unique.values()].sort(compareCanonical);
}

function mergeSetArray(currentValue, incomingValue) {
  if (Array.isArray(currentValue) || Array.isArray(incomingValue)) {
    return unionJsonArrays(currentValue, incomingValue);
  }
  return cloneJson(incomingValue === undefined ? currentValue : incomingValue);
}

function mergeLearningProgress(currentValue, incomingValue) {
  if (!isRecord(currentValue) && !isRecord(incomingValue)) {
    return cloneJson(incomingValue === undefined ? currentValue : incomingValue);
  }

  const current = isRecord(currentValue) ? currentValue : {};
  const incoming = isRecord(incomingValue) ? incomingValue : {};
  const merged = {};
  for (const chapterId of [...new Set([...safeObjectKeys(current), ...safeObjectKeys(incoming)])].sort()) {
    const currentItems = current[chapterId];
    const incomingItems = incoming[chapterId];
    if (Array.isArray(currentItems) || Array.isArray(incomingItems)) {
      merged[chapterId] = unionJsonArrays(currentItems, incomingItems);
    } else if (hasOwn(incoming, chapterId)) {
      merged[chapterId] = cloneJson(incomingItems);
    } else {
      merged[chapterId] = cloneJson(currentItems);
    }
  }
  return merged;
}

const ATTEMPT_ID_KEYS = ["id", "attemptId", "attempt_id"];
const FINAL_ATTEMPT_STATUSES = new Set(["completed", "expired", "submitted", "timed-out", "timed_out"]);

function attemptIdentity(value) {
  if (isRecord(value)) {
    for (const key of ATTEMPT_ID_KEYS) {
      if (typeof value[key] === "string" || typeof value[key] === "number") {
        return `${key}:${String(value[key])}`;
      }
    }
  }
  return `value:${canonicalJson(value)}`;
}

function isAttemptRecord(value) {
  return isRecord(value) && ATTEMPT_ID_KEYS.some((key) => hasOwn(value, key));
}

function itemIdentity(value) {
  if (isRecord(value)) {
    for (const key of ["id", "questionId", "testId", "exerciseId", "assessmentId"]) {
      if (typeof value[key] === "string" || typeof value[key] === "number") {
        return `${key}:${String(value[key])}`;
      }
    }
  }
  return `value:${canonicalJson(value)}`;
}

function attemptTimestamp(value) {
  if (!isRecord(value)) return 0;
  for (const key of ["submittedAt", "updatedAt", "deadlineAt", "startedAt", "createdAt"]) {
    const candidate = value[key];
    if (Number.isFinite(candidate)) return Number(candidate);
    if (typeof candidate === "string") {
      const parsed = Date.parse(candidate);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function unionResultArrays(currentValue, incomingValue) {
  const merged = new Map();
  for (const item of Array.isArray(currentValue) ? currentValue : []) {
    merged.set(itemIdentity(item), cloneJson(item));
  }
  for (const item of Array.isArray(incomingValue) ? incomingValue : []) {
    const key = itemIdentity(item);
    const existing = merged.get(key);
    merged.set(
      key,
      isRecord(existing) && isRecord(item)
        ? mergeAttemptRecord(existing, item)
        : cloneJson(item)
    );
  }
  return [...merged.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([, value]) => value);
}

function mergeAttemptRecord(currentValue, incomingValue) {
  if (!isRecord(currentValue) || !isRecord(incomingValue)) return cloneJson(incomingValue);

  const incomingIsNewer = attemptTimestamp(incomingValue) >= attemptTimestamp(currentValue);
  const earlier = incomingIsNewer ? currentValue : incomingValue;
  const later = incomingIsNewer ? incomingValue : currentValue;
  const merged = cloneJson(earlier);
  for (const key of safeObjectKeys(later)) {
    const current = earlier[key];
    const incoming = later[key];
    const lowerKey = key.toLowerCase();

    if (lowerKey === "results" && (Array.isArray(current) || Array.isArray(incoming))) {
      merged[key] = unionResultArrays(current, incoming);
    } else if ((lowerKey === "passed" || lowerKey === "completed") && typeof current === "boolean" && typeof incoming === "boolean") {
      merged[key] = current || incoming;
    } else if ((lowerKey === "score" || lowerKey === "bestscore") && Number.isFinite(current) && Number.isFinite(incoming)) {
      merged[key] = Math.max(current, incoming);
    } else if (lowerKey === "status" && FINAL_ATTEMPT_STATUSES.has(String(current)) && !FINAL_ATTEMPT_STATUSES.has(String(incoming))) {
      merged[key] = current;
    } else if (isRecord(current) && isRecord(incoming)) {
      merged[key] = mergeAttemptRecord(current, incoming);
    } else if (incoming === null && current !== undefined && ["submittedat", "score", "passed", "results"].includes(lowerKey)) {
      merged[key] = cloneJson(current);
    } else {
      merged[key] = cloneJson(incoming);
    }
  }
  return merged;
}

function historySortKey(value) {
  return attemptIdentity(value);
}

function mergedAttemptHistories(currentValue, incomingValue) {
  const merged = new Map();
  for (const attempt of Array.isArray(currentValue) ? currentValue : []) {
    merged.set(attemptIdentity(attempt), cloneJson(attempt));
  }
  for (const attempt of Array.isArray(incomingValue) ? incomingValue : []) {
    const key = attemptIdentity(attempt);
    const existing = merged.get(key);
    merged.set(
      key,
      isRecord(existing) && isRecord(attempt)
        ? mergeAttemptRecord(existing, attempt)
        : cloneJson(attempt)
    );
  }
  return [...merged.values()].sort((left, right) => {
    const timeDifference = attemptTimestamp(right) - attemptTimestamp(left);
    return timeDifference || historySortKey(left).localeCompare(historySortKey(right), "en");
  });
}

function unionAttemptHistories(currentValue, incomingValue) {
  return mergedAttemptHistories(currentValue, incomingValue)
    .slice(0, ASSESSMENT_HISTORY_LIMIT);
}

function assessmentModeBestScore(modeValue, history) {
  const configured = isRecord(modeValue) && Number.isFinite(modeValue.bestScore)
    ? Math.min(100, Math.max(0, modeValue.bestScore))
    : 0;
  return (Array.isArray(history) ? history : []).reduce((best, attempt) => (
    Number.isFinite(attempt?.score)
      ? Math.max(best, Math.min(100, Math.max(0, attempt.score)))
      : best
  ), configured);
}

function assessmentModeCompleted(modeValue, history) {
  return Boolean(
    isRecord(modeValue) && modeValue.completed ||
    (Array.isArray(history) ? history : []).some((attempt) => Boolean(attempt?.passed))
  );
}

function isHistoryKey(key) {
  const lowerKey = String(key).toLowerCase();
  return lowerKey === "history" || lowerKey.includes("attempts") || lowerKey.includes("attempthistory");
}

function isCompletionKey(key) {
  const lowerKey = String(key).toLowerCase();
  return lowerKey.includes("completion") || lowerKey.includes("completed") || lowerKey.includes("passed");
}

function mergeAssessmentValue(currentValue, incomingValue, key = "", mode = "assessment") {
  const nextMode = isHistoryKey(key)
    ? "history"
    : isCompletionKey(key)
      ? "completion"
      : mode;

  if (String(key).toLowerCase() === "active") {
    return cloneJson(incomingValue === undefined ? currentValue : incomingValue);
  }

  if (incomingValue === undefined) {
    return nextMode === "history" && Array.isArray(currentValue)
      ? unionAttemptHistories(currentValue, [])
      : cloneJson(currentValue);
  }
  if (currentValue === undefined) {
    if (nextMode === "history" && Array.isArray(incomingValue)) {
      return unionAttemptHistories([], incomingValue);
    }
    if (nextMode === "completion" && Array.isArray(incomingValue)) {
      return unionJsonArrays([], incomingValue);
    }
    if (isRecord(incomingValue)) {
      return mergeAssessmentValue({}, incomingValue, key, mode);
    }
    return cloneJson(incomingValue);
  }

  if (
    incomingValue === null &&
    (nextMode === "history" || nextMode === "completion" || isAssessmentStateKey(key))
  ) {
    return cloneJson(currentValue);
  }

  if (nextMode === "history" && (Array.isArray(currentValue) || Array.isArray(incomingValue))) {
    return unionAttemptHistories(currentValue, incomingValue);
  }
  if (nextMode === "completion" && (Array.isArray(currentValue) || Array.isArray(incomingValue))) {
    return unionJsonArrays(currentValue, incomingValue);
  }
  if (nextMode === "completion" && typeof currentValue === "boolean" && typeof incomingValue === "boolean") {
    return currentValue || incomingValue;
  }

  if (nextMode === "history" && isAttemptRecord(currentValue) && isAttemptRecord(incomingValue)) {
    return mergeAttemptRecord(currentValue, incomingValue);
  }

  if (isRecord(currentValue) && isRecord(incomingValue)) {
    const merged = {};
    const keys = [...new Set([...safeObjectKeys(currentValue), ...safeObjectKeys(incomingValue)])].sort();
    for (const childKey of keys) {
      const childMode = nextMode === "completion"
        ? "completion"
        : nextMode === "history"
          ? "history"
          : "assessment";
      merged[childKey] = mergeAssessmentValue(
        currentValue[childKey],
        incomingValue[childKey],
        childKey,
        childMode
      );
    }
    if (Array.isArray(currentValue.history) || Array.isArray(incomingValue.history)) {
      const completeHistory = mergedAttemptHistories(currentValue.history, incomingValue.history);
      merged.bestScore = Math.max(
        assessmentModeBestScore(currentValue, currentValue.history || []),
        assessmentModeBestScore(incomingValue, incomingValue.history || []),
        assessmentModeBestScore({}, completeHistory)
      );
      merged.completed = Boolean(
        assessmentModeCompleted(currentValue, currentValue.history || []) ||
        assessmentModeCompleted(incomingValue, incomingValue.history || []) ||
        assessmentModeCompleted({}, completeHistory)
      );
    }
    return merged;
  }

  const lowerKey = String(key).toLowerCase();
  if ((lowerKey === "version" || lowerKey === "bestscore") && Number.isFinite(currentValue) && Number.isFinite(incomingValue)) {
    return Math.max(currentValue, incomingValue);
  }
  if (nextMode === "completion" && Number.isFinite(currentValue) && Number.isFinite(incomingValue)) {
    return Math.max(currentValue, incomingValue);
  }
  if (nextMode === "completion" && incomingValue === null) return cloneJson(currentValue);
  return cloneJson(incomingValue);
}

function isAssessmentStateKey(key) {
  const lowerKey = String(key).toLowerCase();
  return lowerKey.includes("assessment") || lowerKey.includes("exam") || lowerKey.includes("quiz");
}

/**
 * Merge a client learner-state snapshot into the current authoritative document.
 *
 * Unknown top-level fields are retained unless the incoming client explicitly
 * supplies that same field. Completion-like values are monotonic, while drafts,
 * active assessment attempts, and editor preferences remain last-writer-wins.
 */
export function mergeLearnerState(currentState, incomingState) {
  const current = isRecord(currentState) ? currentState : {};
  const incoming = isRecord(incomingState) ? incomingState : {};
  const merged = cloneJson(current);

  for (const key of safeObjectKeys(incoming)) {
    merged[key] = cloneJson(incoming[key]);
  }

  if (hasOwn(current, "passedIds") || hasOwn(incoming, "passedIds")) {
    merged.passedIds = mergeSetArray(current.passedIds, incoming.passedIds);
  }
  if (hasOwn(current, "learningProgress") || hasOwn(incoming, "learningProgress")) {
    merged.learningProgress = mergeLearningProgress(
      current.learningProgress,
      incoming.learningProgress
    );
  }

  if (hasOwn(current, "schemaVersion") || hasOwn(incoming, "schemaVersion")) {
    const currentVersion = Number.isFinite(current.schemaVersion) ? current.schemaVersion : 0;
    const incomingVersion = Number.isFinite(incoming.schemaVersion) ? incoming.schemaVersion : 0;
    merged.schemaVersion = Math.max(currentVersion, incomingVersion);
  }

  for (const key of [...new Set([...safeObjectKeys(current), ...safeObjectKeys(incoming)])].sort()) {
    if (!isAssessmentStateKey(key)) continue;
    merged[key] = mergeAssessmentValue(current[key], incoming[key], key);
  }

  return cloneJson(merged);
}
