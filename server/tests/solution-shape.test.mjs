import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const [engineSource, earlyTestData, recursionTestData] = await Promise.all([
  readFile(resolve(REPOSITORY_ROOT, "solution-shape.js"), "utf8"),
  readFile(resolve(REPOSITORY_ROOT, "test-data/tests-py01-03.js"), "utf8"),
  readFile(resolve(REPOSITORY_ROOT, "test-data/tests-py08-11.js"), "utf8"),
]);

const context = vm.createContext({ window: {} });
vm.runInContext(engineSource, context, { filename: "solution-shape.js" });
vm.runInContext(earlyTestData, context, { filename: "tests-py01-03.js" });
vm.runInContext(recursionTestData, context, { filename: "tests-py08-11.js" });

const engine = context.SOLUTION_SHAPE;
const specs = context.window.EXERCISE_TESTS;

test("the browser API is small, immutable, and returns structured coaching", () => {
  assert.equal(typeof engine.evaluate, "function");
  assert.equal(typeof engine.maskPythonNonCode, "function");
  assert.equal(typeof engine.validateRule, "function");
  assert.equal(typeof engine.validateRules, "function");
  assert.equal(Object.isFrozen(engine), true);

  const report = engine.evaluate(
    "first = input()\nsecond = input()\njoined = first + second\nprint(joined)",
    specs["py01-fixme"].sourceRules
  );
  assert.equal(report.passed, true);
  assert.equal(report.total, 2);
  assert.equal(report.passedCount, 2);
  assert.equal(report.failedCount, 0);
  assert.equal(report.invalidCount, 0);
  assert.equal(report.results.every((result) => typeof result.feedback === "string"), true);
  assert.equal(report.results.some((result) => Object.hasOwn(result, "pattern")), false);
});

test("comments and single, double, and triple-quoted strings cannot satisfy code rules", () => {
  const source = [
    'message = "while left + right # still a string"',
    "other = 'sum_digits_rec(value)'",
    '"""while fake:',
    "left + right",
    '"""',
    "# while pretend:",
    "while ready:",
    "    total = left + right",
  ].join("\n");
  const masked = engine.maskPythonNonCode(source);

  assert.equal(masked.length, source.length);
  assert.equal(masked.split("\n").length, source.split("\n").length);
  assert.equal((masked.match(/\bwhile\b/gu) || []).length, 1);
  assert.equal((masked.match(/\+/gu) || []).length, 1);
  assert.equal(masked.includes("sum_digits_rec"), false);
  assert.equal(masked.includes("still a string"), false);
});

test("FIXME intention checks require real assignments and real concatenation", () => {
  const rules = specs["py01-fixme"].sourceRules;
  const disguised = [
    'note = "second = value and left + right"',
    "# another = assignment",
    "# combined = left + right",
  ].join("\n");
  const failed = engine.evaluate(disguised, rules);

  assert.equal(failed.passed, false);
  assert.equal(failed.results[0].observedMatches, 1);
  assert.equal(failed.results[1].observedMatches, 0);
  assert.match(failed.results[0].feedback, /two named variables/iu);
  assert.match(failed.results[1].feedback, /same variable/iu);

  const hardcodedOutput = [
    "left = 1",
    "right = 2",
    "total = left + right",
    'print("Hello world!")',
  ].join("\n");
  const intended = [
    'first = "Hello"',
    'ending = " world!"',
    "greeting = first + ending",
    "print(greeting)",
  ].join("\n");

  assert.equal(engine.evaluate(hardcodedOutput, rules).passed, false);
  assert.equal(engine.evaluate(hardcodedOutput, rules).results[0].passed, true);
  assert.equal(engine.evaluate(hardcodedOutput, rules).results[1].passed, false);
  assert.equal(engine.evaluate(intended, rules).passed, true);
});

test("the no-addition rule ignores prose but detects binary plus in code and f-strings", () => {
  const rules = specs["py01-avoid-sums"].sourceRules;
  const intended = [
    'note = "left + right is not executable"',
    "# left + right",
    "left = int(input())",
    "right = int(input())",
    "result = left - -right",
  ].join("\n");
  const binaryAddition = intended.replace("left - -right", "left + -right");

  assert.equal(engine.evaluate(intended, rules).passed, true);
  assert.equal(engine.evaluate(binaryAddition, rules).passed, false);
  assert.equal(engine.evaluate('print(f"{left + right}")', rules).passed, false);
  assert.equal(engine.evaluate('print(rf"{left + right}")', rules).passed, false);
  assert.equal(engine.evaluate('print(f"{{left + right}}")', rules).passed, true);
  assert.equal(engine.evaluate('print(f"{\'left + right\'}")', rules).passed, true);
});

test("loop and recursion checks reject keyword-shaped prose and accept executable structure", () => {
  const loopRules = specs["py03-who-needs-for"].sourceRules;
  const recursionRules = specs["py08-sum-digits"].sourceRules;

  assert.equal(engine.evaluate('message = "while ready:"\n# while ready:', loopRules).passed, false);
  assert.equal(engine.evaluate("position = 0\nwhile position < limit:\n    position += 1", loopRules).passed, true);

  const definitionOnly = "def sum_digits_rec(value):\n    return value";
  const selfCall = "def sum_digits_rec(value):\n    return sum_digits_rec(value // 10)";
  assert.equal(engine.evaluate(definitionOnly, recursionRules).passed, false);
  assert.equal(engine.evaluate(`${definitionOnly}\n# sum_digits_rec(value)`, recursionRules).passed, false);
  assert.equal(engine.evaluate(selfCall, recursionRules).passed, true);
});

test("the shared schema validator rejects malformed and duplicate source rules", () => {
  const malformed = {
    id: "Bad ID",
    label: "x",
    target: "tokens",
    pattern: "(",
    flags: "gg",
    minMatches: 2,
    maxMatches: 1,
    passFeedback: "short",
    failFeedback: "```answer```",
    unexpected: true,
  };
  const validation = engine.validateRule(malformed);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.length >= 8);

  const validRule = specs["py03-who-needs-for"].sourceRules[0];
  const duplicateValidation = engine.validateRules([validRule, validRule]);
  assert.equal(duplicateValidation.valid, false);
  assert.equal(duplicateValidation.errors.some((error) => error.includes("duplicate id")), true);
  assert.equal(engine.validateRules({}).valid, false);
});
