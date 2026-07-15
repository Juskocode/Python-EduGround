import assert from "node:assert/strict";
import test from "node:test";
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  isValidEmail,
  normalizeEmail,
  verifyPassword,
} from "../security.mjs";

test("password records use scrypt and reject the wrong password", async () => {
  const record = await hashPassword("correct horse battery staple");
  assert.match(record, /^scrypt\$16384\$8\$1\$/u);
  assert.equal(await verifyPassword("correct horse battery staple", record), true);
  assert.equal(await verifyPassword("wrong password", record), false);
  assert.equal(await verifyPassword("correct horse battery staple", "broken"), false);
});

test("emails are normalized and validated", () => {
  assert.equal(normalizeEmail("  Learner@Example.COM "), "learner@example.com");
  assert.equal(isValidEmail("learner@example.com"), true);
  assert.equal(isValidEmail("not-an-email"), false);
});

test("session tokens are opaque and only their digest is stored", () => {
  const first = createSessionToken();
  const second = createSessionToken();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/u);
  assert.notEqual(first, second);
  assert.match(hashSessionToken(first), /^[a-f0-9]{64}$/u);
  assert.notEqual(hashSessionToken(first), first);
});
