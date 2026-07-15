#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "..");
const REAL_REPOSITORY_ROOT = await realpath(REPOSITORY_ROOT);

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".py", "text/x-python; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".webp", "image/webp"],
]);

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

  if (!value || value.startsWith("-")) {
    throw new Error(`${optionName} requires a value.`);
  }

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

  if (!/^\d+$/.test(portValue)) {
    throw new Error(`Port must be a whole number from 0 to 65535; received "${portValue}".`);
  }

  const port = Number(portValue);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`Port must be a whole number from 0 to 65535; received "${portValue}".`);
  }

  if (!host.trim()) {
    throw new Error("Host cannot be empty.");
  }

  return { host: host.trim(), port };
}

function isInsideRepository(candidatePath) {
  const pathFromRoot = relative(REAL_REPOSITORY_ROOT, candidatePath);
  return pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== "..");
}

function hasHiddenSegment(pathname) {
  return pathname
    .split("/")
    .filter(Boolean)
    .some((segment) => segment.startsWith("."));
}

function setDevelopmentHeaders(response) {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.setHeader("Expires", "0");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

function sendText(response, statusCode, message, method = "GET") {
  const body = `${message}\n`;
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(method === "HEAD" ? undefined : body);
}

async function resolveRequestedFile(requestUrl) {
  let pathname;

  try {
    pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  } catch {
    return { error: 400, message: "Bad request: the URL is malformed." };
  }

  if (pathname.includes("\0") || hasHiddenSegment(pathname)) {
    return { error: 403, message: "Forbidden." };
  }

  const candidatePath = resolve(REPOSITORY_ROOT, `.${pathname}`);
  if (candidatePath !== REPOSITORY_ROOT && !candidatePath.startsWith(`${REPOSITORY_ROOT}${sep}`)) {
    return { error: 403, message: "Forbidden." };
  }

  try {
    const candidateStats = await stat(candidatePath);
    const filePath = candidateStats.isDirectory() ? join(candidatePath, "index.html") : candidatePath;
    const fileStats = candidateStats.isDirectory() ? await stat(filePath) : candidateStats;

    if (!fileStats.isFile()) {
      return { error: 404, message: "Not found." };
    }

    const realFilePath = await realpath(filePath);
    if (!isInsideRepository(realFilePath)) {
      return { error: 403, message: "Forbidden." };
    }

    return { filePath: realFilePath, fileStats };
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      return { error: 404, message: "Not found." };
    }

    throw error;
  }
}

let configuration;

try {
  configuration = parseArguments(process.argv.slice(2));
} catch (error) {
  console.error(`Error: ${error.message}\n`);
  console.error(usage());
  process.exit(1);
}

const server = createServer(async (request, response) => {
  setDevelopmentHeaders(response);

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    sendText(response, 405, "Method not allowed.", request.method);
    return;
  }

  try {
    const result = await resolveRequestedFile(request.url || "/");

    if (result.error) {
      sendText(response, result.error, result.message, request.method);
      return;
    }

    const contentType = MIME_TYPES.get(extname(result.filePath).toLowerCase()) || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": result.fileStats.size,
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    const fileStream = createReadStream(result.filePath);
    fileStream.on("error", (error) => {
      console.error(`Could not read ${result.filePath}:`, error);
      if (!response.headersSent) {
        sendText(response, 500, "Internal server error.");
      } else {
        response.destroy(error);
      }
    });
    fileStream.pipe(response);
  } catch (error) {
    console.error("Request failed:", error);
    if (!response.headersSent) {
      sendText(response, 500, "Internal server error.", request.method);
    } else {
      response.destroy(error);
    }
  }
});

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

  console.log("Programming Foundations Playground");
  console.log(`Local server: ${url}`);
  console.log(`Serving: ${REPOSITORY_ROOT}`);
  console.log("Press Ctrl+C to stop.");
});

let shuttingDown = false;

function shutDown(signal) {
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

  server.close((error) => {
    clearTimeout(forceShutdownTimer);
    if (error) {
      console.error("Could not stop the server cleanly:", error);
      process.exit(1);
    }

    console.log("Server stopped.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutDown("Ctrl+C"));
process.on("SIGTERM", () => shutDown("SIGTERM"));
