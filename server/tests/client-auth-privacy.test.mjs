import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = await readFile(resolve(REPOSITORY_ROOT, "course-app.js"), "utf8");

function between(start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `missing start marker: ${start}`);
  assert.ok(endIndex > startIndex, `missing end marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("account storage remains anonymous until the cookie session is validated", () => {
  const startup = between("var deliberateLocalSignOut", "var pythonRunner");
  const restore = between("async function restoreAuthenticatedSession", "async function manualSync");

  assert.match(startup, /var workspaceScope = "";/u);
  assert.doesNotMatch(startup, /workspaceScope = authUserId/u);
  assert.match(restore, /switchWorkspace\(String\(restoredUser\.id\), false, false\)/u);
  assert.match(
    restore,
    /catch \(error\)[\s\S]*expireAuthenticatedSession\([\s\S]*Account work remains hidden/u,
    "expired or offline restore failures must return to anonymous storage"
  );
});

test("a deliberate local sign-out prevents cookie restoration after reload", () => {
  const startup = between("var deliberateLocalSignOut", "var pythonRunner");
  const boot = between("syncThemeButton();", "function renderRoute");
  const authenticate = between("async function authenticate", "async function restoreAuthenticatedSession");

  assert.match(startup, /safeRead\(STORAGE_KEYS\.authSignedOut\) === "1"/u);
  assert.match(startup, /safeSessionRemove\(STORAGE_KEYS\.authClientCapability\)/u);
  assert.match(
    boot,
    /if \(!deliberateLocalSignOut && clientCapability\) \{\s*restoreAuthenticatedSession\(\);\s*\}/u
  );
  assert.match(authenticate, /safeRemove\(STORAGE_KEYS\.authSignedOut\)/u);
});

test("the page-only capability gates every authenticated API request", () => {
  const startup = between("var deliberateLocalSignOut", "var pythonRunner");
  const authenticate = between("async function authenticate", "async function restoreAuthenticatedSession");
  const apiRequest = between("async function apiRequest", "function setSyncStatus");

  assert.match(startup, /safeSessionRead\(STORAGE_KEYS\.authClientCapability\)/u);
  assert.doesNotMatch(source, /safeWrite\(STORAGE_KEYS\.authClientCapability/u);
  assert.match(authenticate, /response\.clientCapability/u);
  assert.match(authenticate, /safeSessionWrite\(STORAGE_KEYS\.authClientCapability, clientCapability\)/u);
  assert.match(apiRequest, /headers\["X-EduGround-Client-Capability"\] = requestClientCapability/u);
  assert.match(apiRequest, /config\.authenticated !== false && requestClientCapability/u);
});

test("offline sign-out hides the account immediately and reports revocation failure", () => {
  const signOut = between("async function signOut", "function expireAuthenticatedSession");
  const tombstoneIndex = signOut.indexOf('safeWrite(STORAGE_KEYS.authSignedOut, "1")');
  const anonymousIndex = signOut.indexOf('switchWorkspace("", false, false)');
  const capabilityClearIndex = signOut.indexOf("safeSessionRemove(STORAGE_KEYS.authClientCapability)");
  const serverRequestIndex = signOut.indexOf('await apiRequest("/api/auth/logout"');

  assert.ok(tombstoneIndex >= 0 && tombstoneIndex < serverRequestIndex);
  assert.ok(anonymousIndex >= 0 && anonymousIndex < serverRequestIndex);
  assert.ok(capabilityClearIndex >= 0 && capabilityClearIndex < serverRequestIndex);
  assert.match(signOut, /clientCapability: revocationCapability/u);
  assert.match(signOut, /server session could not be revoked/u);
  assert.match(signOut, /server session was revoked/u);
  assert.doesNotMatch(signOut, /Local sign-out must still succeed/u);
});

test("expired sessions clear both the account scope and page capability", () => {
  const expire = between("function expireAuthenticatedSession", "async function syncFromServerAndPush");

  assert.match(expire, /switchWorkspace\("", false, false\)/u);
  assert.match(expire, /clientCapability = ""/u);
  assert.match(expire, /safeSessionRemove\(STORAGE_KEYS\.authClientCapability\)/u);
  assert.match(expire, /safeRemove\(STORAGE_KEYS\.authUser\)/u);
});
