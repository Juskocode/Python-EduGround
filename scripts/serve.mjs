#!/usr/bin/env node

import { realpath } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApiHandler } from "../server/api.mjs";
import { createDatabase } from "../server/database.mjs";
import { listExerciseFiles } from "../server/exercise-manifest.mjs";
import {
  configureHttpServer,
  securityHeaders,
  validateRuntimeEnvironment,
} from "../server/runtime-security.mjs";
import { resolveRequestedFile, streamStaticFile } from "../server/static.mjs";
import {
  createSubmissionFileStore,
  resolveSubmissionsDirectory,
} from "../server/submission-files.mjs";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "..");
const REAL_REPOSITORY_ROOT = await realpath(REPOSITORY_ROOT);

function usage() {
  return `Usage: node scripts/serve.mjs [options]

Options:
  -p, --port <number>  Listening port (default: PORT or 8000)
      --host <address> Listening address (default: HOST or 127.0.0.1)
  -h, --help           Show this help

Examples:
  node scripts/serve.mjs
  node scripts/serve.mjs --port 4173
  PORT=4173 node scripts/serve.mjs`;
}

function readOptionValue(argumentsList, index, optionName) {
  const value = argumentsList[index + 1];
  if (!value || value.startsWith("-")) throw new Error(`${optionName} requires a value.`);
  return value;
}

function parseArguments(argumentsList) {
  let host = process.env.HOST || "127.0.0.1";
  let portValue = process.env.PORT || "8000";

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "-h" || argument === "--help") {
      console.log(usage());
      process.exit(0);
    }
    if (argument === "-p" || argument === "--port") {
      portValue = readOptionValue(argumentsList, index, argument);
      index += 1;
      continue;
    }
    if (argument.startsWith("--port=")) {
      portValue = argument.slice("--port=".length);
      continue;
    }
    if (argument === "--host") {
      host = readOptionValue(argumentsList, index, argument);
      index += 1;
      continue;
    }
    if (argument.startsWith("--host=")) {
      host = argument.slice("--host=".length);
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }

  if (!/^\d+$/u.test(portValue)) {
    throw new Error(`Port must be a whole number from 0 to 65535; received "${portValue}".`);
  }
  const port = Number(portValue);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`Port must be a whole number from 0 to 65535; received "${portValue}".`);
  }
  if (!host.trim()) throw new Error("Host cannot be empty.");
  return { host: host.trim(), port };
}

function setResponseHeaders(request, response) {
  for (const [name, value] of Object.entries(securityHeaders(request, process.env))) {
    response.setHeader(name, value);
  }
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.setHeader("Expires", "0");
  response.setHeader("Pragma", "no-cache");
}

function sendText(response, statusCode, message, method = "GET") {
  const body = `${message}\n`;
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(method === "HEAD" ? undefined : body);
}

let configuration;
try {
  configuration = parseArguments(process.argv.slice(2));
  validateRuntimeEnvironment(process.env);
} catch (error) {
  console.error(`Error: ${error.message}\n`);
  console.error(usage());
  process.exit(1);
}

let database;
let submissionFiles;
let handleApi;
try {
  database = createDatabase(process.env, console);
  const submissionsDirectory = resolveSubmissionsDirectory(
    process.env,
    resolve(REPOSITORY_ROOT, "submissions")
  );
  const solutionDirectories = [
    ...new Set(listExerciseFiles().map((exercise) => exercise.chapterDirectory)),
  ].map((directory) => resolve(REPOSITORY_ROOT, directory));
  const publicAssetDirectories = ["assets", "test-data", "docs/screenshots"].map((directory) =>
    resolve(REPOSITORY_ROOT, directory)
  );
  submissionFiles = createSubmissionFileStore({
    rootDirectory: submissionsDirectory,
    forbiddenDirectories: [...solutionDirectories, ...publicAssetDirectories],
    logger: console,
  });
  handleApi = createApiHandler({
    database,
    submissionFiles,
    environment: process.env,
    logger: console,
  });
} catch (error) {
  console.error(`Configuration error: ${error?.message || error}`);
  process.exit(1);
}
const server = createServer(async (request, response) => {
  setResponseHeaders(request, response);

  try {
    let requestUrl;
    try {
      requestUrl = new URL(request.url || "/", "http://localhost");
    } catch {
      sendText(response, 400, "Bad request: the URL is malformed.", request.method);
      return;
    }

    if (await handleApi(request, response, requestUrl)) return;

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.setHeader("Allow", "GET, HEAD");
      sendText(response, 405, "Method not allowed.", request.method);
      return;
    }

    const result = await resolveRequestedFile(
      REPOSITORY_ROOT,
      REAL_REPOSITORY_ROOT,
      request.url || "/"
    );
    if (result.error) {
      sendText(response, result.error, result.message, request.method);
      return;
    }
    streamStaticFile(request, response, result, sendText);
  } catch (error) {
    console.error("Request failed:", error?.message || error);
    if (!response.headersSent) sendText(response, 500, "Internal server error.", request.method);
    else response.destroy(error);
  }
});
try {
  configureHttpServer(server, process.env);
} catch (error) {
  console.error(`Configuration error: ${error?.message || error}`);
  process.exit(1);
}

server.on("clientError", (_error, socket) => {
  socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Cannot start the server: ${configuration.host}:${configuration.port} is already in use.`);
  } else if (error.code === "EACCES") {
    console.error(`Cannot start the server: permission denied for ${configuration.host}:${configuration.port}.`);
  } else {
    console.error("Server error:", error);
  }
  process.exitCode = 1;
});

server.listen(configuration.port, configuration.host, () => {
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : configuration.port;
  const displayHost = configuration.host.includes(":") ? `[${configuration.host}]` : configuration.host;
  const url = `http://${displayHost}:${port}`;
  console.log("Python EduGround");
  console.log(`Local server: ${url}`);
  console.log(`Serving: ${REPOSITORY_ROOT}`);
  console.log(
    database.configured
      ? "Cloud save: PostgreSQL configured"
      : "Cloud save: unavailable (set DATABASE_URL to enable)"
  );
  console.log(
    submissionFiles.configured
      ? "Submission files: per-user chapter mirror configured"
      : "Submission files: disabled (PostgreSQL remains authoritative)"
  );
  console.log("Press Ctrl+C to stop.");
});

let shuttingDown = false;
async function shutDown(signal) {
  if (shuttingDown) {
    console.error("\nForced shutdown.");
    process.exit(1);
  }
  shuttingDown = true;
  console.log(`\n${signal} received. Stopping the server...`);
  const forceShutdownTimer = setTimeout(() => {
    console.error("Shutdown timed out; closing remaining connections.");
    server.closeAllConnections?.();
    process.exit(1);
  }, 5_000);
  forceShutdownTimer.unref();

  server.close(async (error) => {
    clearTimeout(forceShutdownTimer);
    if (error) {
      console.error("Could not stop the server cleanly:", error);
      process.exit(1);
    }
    try {
      await database.close();
    } catch (databaseError) {
      console.error("Could not close the database pool cleanly:", databaseError?.message || databaseError);
    }
    console.log("Server stopped.");
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutDown("Ctrl+C"));
process.on("SIGTERM", () => void shutDown("SIGTERM"));
