#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { REPOSITORY_ROOT } from "../lib/paths.js";

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function read(relativePath) {
  return readFile(resolve(REPOSITORY_ROOT, relativePath), "utf8");
}

function serviceBlock(source, serviceName) {
  const expression = new RegExp(
    `^  ${serviceName}:\\n(?<block>[\\s\\S]*?)(?=^  [a-zA-Z0-9_-]+:\\n|^(?:volumes|networks):\\n|(?![\\s\\S]))`,
    "mu"
  );
  return expression.exec(source)?.groups?.block || "";
}

const [compose, environmentExample, ciWorkflow] = await Promise.all([
  read("docker-compose.ai.yml"),
  read(".env.example"),
  read(".github/workflows/ci.yml"),
]);

const bootstrap = serviceBlock(compose, "ollama-model-bootstrap");
const ollama = serviceBlock(compose, "ollama");
const app = serviceBlock(compose, "app");

check(
  !/^\s+ports:/mu.test(compose),
  "The AI overlay must not publish a host port for either Ollama process."
);
check(bootstrap.length > 0, "AI Compose must define a one-shot model bootstrap service.");
check(ollama.length > 0, "AI Compose must define the long-running Ollama service.");
check(app.length > 0, "AI Compose must configure the application RAG adapter.");

const ollamaImageLines = compose.match(/image:\s+ollama\/ollama:[^\s]+/gu) || [];
check(
  ollamaImageLines.length === 1 &&
    /ollama\/ollama:0\.32\.3@sha256:[0-9a-f]{64}$/u.test(ollamaImageLines[0]),
  "The shared Ollama image must use a reviewed version and immutable manifest digest."
);
check(
  !/ollama\/ollama:(?:latest|main)(?:@|\s|$)/u.test(compose),
  "Mutable Ollama image tags are forbidden."
);

check(
  /networks:\n      - model-download/u.test(bootstrap) &&
    !/networks:\n      - ai/u.test(bootstrap),
  "Only the short-lived bootstrap service may use the model-download network."
);
check(
  /if ollama show "\$\$model"[\s\S]*skipping download[\s\S]*ollama pull "\$\$model"/u.test(
    bootstrap
  ),
  "Model bootstrap must reuse a present model before attempting an outbound download."
);
check(
  /case "\$\$model" in[\s\S]*unsupported characters/u.test(bootstrap),
  "Model bootstrap must reject unsafe model identifiers before invoking the CLI."
);
check(
  /restart: "no"/u.test(bootstrap),
  "The model downloader must be one-shot and must not restart indefinitely."
);

check(!/^\s+ports:/mu.test(ollama), "Ollama must never publish a host port.");
check(
  /expose:\n      - "11434"/u.test(ollama),
  "Ollama may expose port 11434 only to its Compose network."
);
check(
  /networks:\n      - ai/u.test(ollama) && !/model-download/u.test(ollama),
  "The long-running Ollama server must live only on the internal AI network."
);
check(
  /  ai:\n    internal: true/u.test(compose),
  "The AI inference network must be marked internal."
);
check(
  /  model-download:\s*$/mu.test(compose) &&
    !/  model-download:\n\s+internal: true/u.test(compose),
  "The isolated one-shot model-download network must retain outbound access."
);

for (const [blockName, block] of [
  ["bootstrap", bootstrap],
  ["Ollama", ollama],
]) {
  check(/read_only: true/u.test(block), `${blockName} filesystem must be read-only.`);
  check(
    /cap_drop:\n      - ALL/u.test(block),
    `${blockName} service must drop every Linux capability.`
  );
  check(
    /no-new-privileges:true/u.test(block),
    `${blockName} service must prevent privilege escalation.`
  );
  check(/pids_limit: [1-9][0-9]*/u.test(block), `${blockName} service must bound processes.`);
  check(/mem_limit:/u.test(block), `${blockName} service must have a memory limit.`);
  check(/cpus:/u.test(block), `${blockName} service must have a CPU limit.`);
  check(/logging: \*ai-logging/u.test(block), `${blockName} logs must be rotated.`);
}

check(
  /OLLAMA_MAX_LOADED_MODELS: "1"/u.test(ollama) &&
    /OLLAMA_NUM_PARALLEL: "1"/u.test(ollama),
  "The 8 GB classroom profile must keep one loaded model and one active generation."
);
check(
  /OLLAMA_MAX_QUEUE: "\$\{OLLAMA_MAX_QUEUE:-20\}"/u.test(ollama) &&
    /OLLAMA_CONTEXT_LENGTH: "\$\{OLLAMA_CONTEXT_LENGTH:-4096\}"/u.test(ollama),
  "Ollama must use bounded classroom queue and context defaults."
);
check(
  /healthcheck:[\s\S]*?- ollama\n        - list/u.test(ollama),
  "Ollama must have a bounded API health check."
);

check(
  /RAG_ENABLED: "true"/u.test(app) &&
    /OLLAMA_BASE_URL: http:\/\/ollama:11434/u.test(app) &&
    /OLLAMA_ALLOWED_HOSTS: ollama/u.test(app),
  "The app must explicitly enable RAG and allow only its internal Ollama host."
);
check(
  /RAG_MAX_CONCURRENT_REQUESTS: "\$\{RAG_MAX_CONCURRENT_REQUESTS:-1\}"/u.test(app) &&
    /RAG_MAX_QUEUE_DEPTH: "\$\{RAG_MAX_QUEUE_DEPTH:-20\}"/u.test(app) &&
    /RAG_QUEUE_TIMEOUT_MS: "\$\{RAG_QUEUE_TIMEOUT_MS:-15000\}"/u.test(app) &&
    /RAG_REQUESTS_PER_MINUTE: "\$\{RAG_REQUESTS_PER_MINUTE:-4\}"/u.test(app) &&
    /RAG_IP_REQUESTS_PER_MINUTE: "\$\{RAG_IP_REQUESTS_PER_MINUTE:-80\}"/u.test(app),
  "The app must bound tutor concurrency, queue depth, learner rate, and classroom-IP rate."
);
check(
  /RAG_MAX_ANSWER_TOKENS: "\$\{RAG_MAX_ANSWER_TOKENS:-420\}"/u.test(app) &&
    /RAG_MODEL_CONTEXT_TOKENS: "\$\{RAG_MODEL_CONTEXT_TOKENS:-4096\}"/u.test(app) &&
    /RAG_MAX_MESSAGE_CHARACTERS: "\$\{RAG_MAX_MESSAGE_CHARACTERS:-1200\}"/u.test(
      app
    ) &&
    /RAG_MAX_CONTEXT_CHUNKS: "\$\{RAG_MAX_CONTEXT_CHUNKS:-4\}"/u.test(app) &&
    /RAG_MAX_CONTEXT_CHARACTERS: "\$\{RAG_MAX_CONTEXT_CHARACTERS:-8000\}"/u.test(
      app
    ),
  "The app must cap learner messages, retrieved context, model context, and answer tokens."
);
check(
  /RAG_RESPONSE_CACHE_TTL_MS: "\$\{RAG_RESPONSE_CACHE_TTL_MS:-300000\}"/u.test(
    app
  ) &&
    /RAG_MAX_CACHED_RESPONSES: "\$\{RAG_MAX_CACHED_RESPONSES:-100\}"/u.test(app),
  "The app must bound tutor response-cache lifetime and entry count."
);
check(
  /networks:\n      - edge\n      - database\n      - ai/u.test(app),
  "The application must join the internal AI network without removing its existing networks."
);

check(
  /^RAG_ENABLED=false$/mu.test(environmentExample),
  "Plain local development must keep RAG disabled unless the operator opts in."
);
check(
  /^OLLAMA_BASE_URL=http:\/\/127\.0\.0\.1:11434$/mu.test(environmentExample),
  "Plain local Ollama must default to a loopback URL."
);
check(
  /^OLLAMA_MODEL=llama3\.1:8b-instruct-q4_K_M$/mu.test(environmentExample),
  "The environment example must select the reviewed Llama 3.1 8B quantization."
);
check(
  /^OLLAMA_MEMORY_LIMIT=8g$/mu.test(environmentExample) &&
    /^OLLAMA_CONTEXT_LENGTH=4096$/mu.test(environmentExample),
  "The environment example must declare the reviewed memory and context budget."
);
check(
  /Validate the isolated AI Compose overlay[\s\S]*?docker compose[\s\S]*?--file docker-compose\.yml[\s\S]*?--file docker-compose\.ai\.yml[\s\S]*?config --quiet/u.test(
    ciWorkflow
  ),
  "CI must parse the merged base and AI Compose files without downloading the model."
);

if (failures.length > 0) {
  console.error("AI infrastructure validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("AI infrastructure is local-only, bounded, and network-isolated.");
