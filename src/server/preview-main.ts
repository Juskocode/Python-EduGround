#!/usr/bin/env node

import { writeFile, unlink } from "node:fs/promises";
import { isIP } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createSecurePreviewGateway } from "./security/secure-preview-gateway.js";

function readWholeNumber(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const raw = String(process.env[name] || fallback);
  if (!/^\d+$/u.test(raw)) {
    throw new Error(`${name} must be a whole number from ${minimum} to ${maximum}.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be a whole number from ${minimum} to ${maximum}.`);
  }
  return value;
}

function loopbackAddress(value: string): boolean {
  const address = value.trim().replace(/^\[|\]$/gu, "");
  return (
    (isIP(address) === 4 && address.startsWith("127.")) ||
    address === "::1"
  );
}

const host = String(process.env.PREVIEW_GATEWAY_HOST || "127.0.0.1").trim();
if (!loopbackAddress(host)) {
  throw new Error("PREVIEW_GATEWAY_HOST must be a numeric loopback address.");
}

const port = readWholeNumber("PREVIEW_GATEWAY_PORT", 8002, 1, 65_535);
const previewLifetimeSeconds = readWholeNumber(
  "PREVIEW_LIFETIME_SECONDS",
  4 * 60 * 60,
  15 * 60,
  12 * 60 * 60
);
const upstream = String(
  process.env.PREVIEW_UPSTREAM || "http://127.0.0.1:8001"
);
const tokenFile = join(
  tmpdir(),
  `python-eduground-preview-${process.pid}.token`
);
const gateway = createSecurePreviewGateway({
  upstream,
  previewLifetimeSeconds,
  sessionLifetimeSeconds: previewLifetimeSeconds,
});

let tokenFilePresent = false;
let cleanupStarted = false;

async function removeTokenFile(): Promise<void> {
  if (!tokenFilePresent) return;
  tokenFilePresent = false;
  await unlink(tokenFile).catch(() => undefined);
}

async function shutdown(): Promise<void> {
  if (cleanupStarted) return;
  cleanupStarted = true;
  await gateway.close().catch(() => undefined);
  await removeTokenFile();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
gateway.server.once("close", () => {
  void removeTokenFile();
});
gateway.server.once("error", (error) => {
  console.error(`Secure preview gateway failed: ${error.message}`);
  void shutdown();
});

await writeFile(tokenFile, `${gateway.accessToken}\n`, {
  encoding: "utf8",
  flag: "wx",
  mode: 0o600,
});
tokenFilePresent = true;

gateway.server.listen(port, host, () => {
  console.log(`Secure preview gateway: http://${host}:${port}`);
  console.log(`Access token file (mode 0600): ${tokenFile}`);
  console.log(`Preview expires: ${new Date(gateway.expiresAt).toISOString()}`);
});
