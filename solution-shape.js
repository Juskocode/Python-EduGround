(() => {
  "use strict";

  const RULE_FIELDS = new Set([
    "id",
    "label",
    "target",
    "pattern",
    "flags",
    "minMatches",
    "maxMatches",
    "passFeedback",
    "failFeedback",
  ]);
  const TARGETS = new Set(["code", "source"]);
  const FLAG_PATTERN = /^(?!.*(.).*\1)[imsu]*$/u;
  const RULE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/u;
  const MAX_PATTERN_LENGTH = 240;
  const MAX_FEEDBACK_LENGTH = 320;

  function maskCharacter(character) {
    return character === "\n" || character === "\r" ? character : " ";
  }

  function maskPythonNonCode(sourceValue) {
    const source = String(sourceValue ?? "");
    let result = "";
    let index = 0;
    let state = "code";
    let quote = "";
    let tripleQuoted = false;

    while (index < source.length) {
      const character = source[index];

      if (state === "comment") {
        result += maskCharacter(character);
        index += 1;
        if (character === "\n" || character === "\r") {
          state = "code";
        }
        continue;
      }

      if (state === "string") {
        if (character === "\\") {
          result += " ";
          index += 1;
          if (index < source.length) {
            result += maskCharacter(source[index]);
            index += 1;
          }
          continue;
        }

        if (tripleQuoted && source.slice(index, index + 3) === quote.repeat(3)) {
          result += "   ";
          index += 3;
          state = "code";
          quote = "";
          tripleQuoted = false;
          continue;
        }

        if (!tripleQuoted && character === quote) {
          result += " ";
          index += 1;
          state = "code";
          quote = "";
          continue;
        }

        result += maskCharacter(character);
        index += 1;
        continue;
      }

      if (character === "#") {
        result += " ";
        index += 1;
        state = "comment";
        continue;
      }

      if (character === "'" || character === '"') {
        quote = character;
        tripleQuoted = source.slice(index, index + 3) === character.repeat(3);
        const quoteLength = tripleQuoted ? 3 : 1;
        result += " ".repeat(quoteLength);
        index += quoteLength;
        state = "string";
        continue;
      }

      result += character;
      index += 1;
    }

    return result;
  }

  function validateRule(rule) {
    const errors = [];

    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      return { valid: false, errors: ["rule must be an object"] };
    }

    for (const field of Object.keys(rule)) {
      if (!RULE_FIELDS.has(field)) {
        errors.push(`unsupported field "${field}"`);
      }
    }

    if (typeof rule.id !== "string" || !RULE_ID_PATTERN.test(rule.id)) {
      errors.push("id must use lowercase letters, numbers, and hyphens");
    }
    if (typeof rule.label !== "string" || rule.label.trim().length < 3) {
      errors.push("label must be a short learner-facing description");
    }
    if (!TARGETS.has(rule.target)) {
      errors.push('target must be either "code" or "source"');
    }
    if (
      typeof rule.pattern !== "string" ||
      rule.pattern.length === 0 ||
      rule.pattern.length > MAX_PATTERN_LENGTH
    ) {
      errors.push(`pattern must contain 1-${MAX_PATTERN_LENGTH} characters`);
    }

    const flags = rule.flags ?? "";
    if (typeof flags !== "string" || !FLAG_PATTERN.test(flags)) {
      errors.push("flags may contain each of i, m, s, and u at most once");
    }

    const hasMinimum = rule.minMatches !== undefined;
    const hasMaximum = rule.maxMatches !== undefined;
    if (!hasMinimum && !hasMaximum) {
      errors.push("minMatches or maxMatches is required");
    }
    if (hasMinimum && (!Number.isSafeInteger(rule.minMatches) || rule.minMatches < 0)) {
      errors.push("minMatches must be a non-negative safe integer");
    }
    if (hasMaximum && (!Number.isSafeInteger(rule.maxMatches) || rule.maxMatches < 0)) {
      errors.push("maxMatches must be a non-negative safe integer");
    }
    if (
      hasMinimum &&
      hasMaximum &&
      Number.isSafeInteger(rule.minMatches) &&
      Number.isSafeInteger(rule.maxMatches) &&
      rule.minMatches > rule.maxMatches
    ) {
      errors.push("minMatches cannot be greater than maxMatches");
    }

    for (const field of ["passFeedback", "failFeedback"]) {
      const value = rule[field];
      if (
        typeof value !== "string" ||
        value.trim().length < 8 ||
        value.length > MAX_FEEDBACK_LENGTH ||
        value.includes("```")
      ) {
        errors.push(`${field} must be solution-free prose between 8 and ${MAX_FEEDBACK_LENGTH} characters`);
      }
    }

    if (typeof rule.pattern === "string" && rule.pattern.length <= MAX_PATTERN_LENGTH) {
      try {
        new RegExp(rule.pattern, `${typeof flags === "string" ? flags : ""}g`);
      } catch {
        errors.push("pattern and flags must form a valid JavaScript regular expression");
      }
    }

    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors),
    });
  }

  function validateRules(rules) {
    if (!Array.isArray(rules)) {
      return Object.freeze({
        valid: false,
        errors: Object.freeze(["sourceRules must be an array"]),
      });
    }

    const errors = [];
    const ids = new Set();
    rules.forEach((rule, index) => {
      const validation = validateRule(rule);
      validation.errors.forEach((error) => errors.push(`rule ${index + 1}: ${error}`));
      if (rule && typeof rule.id === "string") {
        if (ids.has(rule.id)) {
          errors.push(`rule ${index + 1}: duplicate id "${rule.id}"`);
        }
        ids.add(rule.id);
      }
    });

    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors),
    });
  }

  function countMatches(value, pattern, flags) {
    const expression = new RegExp(pattern, `${flags || ""}g`);
    let count = 0;
    let match;

    while ((match = expression.exec(value)) !== null) {
      count += 1;
      if (match[0] === "") {
        expression.lastIndex += 1;
      }
    }

    return count;
  }

  function expectationFor(rule) {
    if (rule.minMatches !== undefined && rule.maxMatches !== undefined) {
      return Object.freeze({ minMatches: rule.minMatches, maxMatches: rule.maxMatches });
    }
    if (rule.minMatches !== undefined) {
      return Object.freeze({ minMatches: rule.minMatches });
    }
    return Object.freeze({ maxMatches: rule.maxMatches });
  }

  function evaluateRule(source, maskedCode, rule) {
    const validation = validateRule(rule);
    if (!validation.valid) {
      return Object.freeze({
        id: typeof rule?.id === "string" ? rule.id : "invalid-rule",
        label: typeof rule?.label === "string" ? rule.label : "Exercise intention",
        passed: false,
        invalid: true,
        observedMatches: 0,
        expectation: Object.freeze({}),
        feedback: "This learning check is unavailable. Your output tests can still be reviewed.",
      });
    }

    const target = rule.target === "source" ? source : maskedCode;
    const observedMatches = countMatches(target, rule.pattern, rule.flags);
    const meetsMinimum = rule.minMatches === undefined || observedMatches >= rule.minMatches;
    const meetsMaximum = rule.maxMatches === undefined || observedMatches <= rule.maxMatches;
    const passed = meetsMinimum && meetsMaximum;

    return Object.freeze({
      id: rule.id,
      label: rule.label,
      passed,
      invalid: false,
      observedMatches,
      expectation: expectationFor(rule),
      feedback: passed ? rule.passFeedback : rule.failFeedback,
    });
  }

  function evaluate(sourceValue, rulesValue) {
    const source = String(sourceValue ?? "");
    const rules = Array.isArray(rulesValue) ? rulesValue : [];
    const maskedCode = maskPythonNonCode(source);
    const results = rules.map((rule) => evaluateRule(source, maskedCode, rule));
    const passedCount = results.filter((result) => result.passed).length;
    const invalidCount = results.filter((result) => result.invalid).length;

    return Object.freeze({
      passed: passedCount === results.length && invalidCount === 0,
      total: results.length,
      passedCount,
      failedCount: results.length - passedCount,
      invalidCount,
      results: Object.freeze(results),
    });
  }

  globalThis.SOLUTION_SHAPE = Object.freeze({
    evaluate,
    maskPythonNonCode,
    validateRule,
    validateRules,
  });
})();
