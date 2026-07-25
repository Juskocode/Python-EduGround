# Chapter tutor: secure classroom operations

This runbook deploys the optional chapter-scoped tutor for a class of roughly
10–20 learners. It uses the reviewed `llama3.1:8b-instruct-q4_K_M` model through
Ollama and deliberately favors predictable memory use over maximum concurrency.
The normal application remains usable without the tutor.

The model tag is an 8.03-billion-parameter Q4 model whose artifact is about
4.9 GB. That is not its complete runtime footprint: weights, context, the Ollama
runtime, the app, PostgreSQL, and the operating system all need memory. The
Compose profile therefore reserves 8 GB for Ollama, and a dedicated host should
normally have 12–16 GB of RAM. A machine with only 7 GB total RAM is not a safe
classroom host.

Primary references:

- [Ollama Llama 3.1 model card](https://ollama.com/library/llama3.1)
- [Ollama concurrency and queue controls](https://docs.ollama.com/faq)
- [Ollama local API](https://docs.ollama.com/api/introduction)
- [Ollama model-list API](https://docs.ollama.com/api/tags)
- [Official Ollama Docker instructions](https://docs.ollama.com/docker)

## Security and network model

```text
first model seed only
    internet <- model-download network <- ollama-model-bootstrap
                                             |
                                             v
                                     ollama_models volume
                                             |
browser -> reverse proxy -> app -> internal ai network -> ollama
                           |
                           +-> internal database network -> PostgreSQL
```

`docker-compose.ai.yml` is an explicit overlay. It provides these boundaries:

| Control | Effect |
| --- | --- |
| No `ports` on Ollama | The unauthenticated local Ollama API is never published on the host |
| Internal `ai` network | The long-running inference server has no internet route |
| One-shot download network | Only the short-lived model bootstrap process has outbound access |
| Pinned Ollama image | The reviewed Ollama version is fixed by tag and multi-platform manifest digest |
| Read-only filesystems | Only the model volume and bounded temporary filesystems are writable |
| Dropped capabilities | Both AI containers run with every Linux capability removed and privilege escalation disabled |
| Bounded resources | Memory, CPU, process count, logs, context, loaded models, active generations, and queue size have explicit limits |
| Server-side adapter | Browsers call the EduGround API; they never receive the Ollama address |
| Explicit outbound allowlist | The app accepts `ollama` as the only Compose inference host |

The bootstrap starts a temporary loopback-only Ollama server, validates the model
identifier, and checks the named model volume. If the model is already present, it
exits without network access. Otherwise it downloads the approved model and
verifies it can be opened. The long-running Ollama service starts only after that
one-shot process succeeds.

An instructional system prompt is not a security sandbox. Retrieved classroom
text and model output remain untrusted data. The server must continue to validate
chapter identifiers, use only the selected chapter corpus, cap request and
response sizes, avoid logging prompt bodies, and render tutor output as text rather
than executable HTML. The tutor should explain concepts and ask guiding questions;
it must not be treated as an authoritative source or a way to execute learner code.

## Start the local AI stack

Create local settings and database secrets once:

```bash
cp .env.example .env
npm run secrets:init
```

Review the limits in `.env`, then validate and start the base stack with the AI
overlay:

```bash
npm run validate:ai-infra
docker compose \
  --file docker-compose.yml \
  --file docker-compose.ai.yml \
  config --quiet

docker compose \
  --file docker-compose.yml \
  --file docker-compose.ai.yml \
  up --detach --build --wait
```

The first run downloads about 4.9 GB and can take several minutes. Later starts
reuse the named `ollama_models` volume, including when the source repository is
updated. Do not use `docker compose down --volumes` unless deleting the downloaded
model and all local PostgreSQL progress is intentional.

Inspect the bounded service state:

```bash
docker compose \
  --file docker-compose.yml \
  --file docker-compose.ai.yml \
  ps --all

docker compose \
  --file docker-compose.yml \
  --file docker-compose.ai.yml \
  logs --no-color --tail 100 ollama-model-bootstrap ollama app
```

Confirm there is no Ollama host binding:

```bash
ollama_id="$(
  docker compose \
    --file docker-compose.yml \
    --file docker-compose.ai.yml \
    ps --quiet ollama
)"
docker inspect --format '{{json .HostConfig.PortBindings}}' "$ollama_id"
```

The result must be `{}`. `http://127.0.0.1:11434` should not answer on the host.
Test tutor behavior through the application API and UI, never by publishing that
port.

## Local development without Compose

Plain `npm run serve` keeps `RAG_ENABLED=false`. This prevents an ordinary
development session or CI job from unexpectedly loading a multi-gigabyte model.
To opt in with a separately installed loopback-only Ollama:

```bash
ollama pull llama3.1:8b-instruct-q4_K_M
export RAG_ENABLED=true
export OLLAMA_BASE_URL=http://127.0.0.1:11434
export OLLAMA_ALLOWED_HOSTS=127.0.0.1,localhost,::1
npm run serve
```

Do not configure local Ollama to listen on a LAN address. Ollama's local API has no
authentication by default; the EduGround server is the policy and admission layer.

## Reviewed classroom budget

The defaults are designed for one shared, memory-constrained inference worker:

| Setting | Default | Reason |
| --- | ---: | --- |
| Ollama memory | 8 GB | Holds the 4.9 GB quantized artifact plus runtime and context overhead |
| Ollama CPU | 4 cores | Prevents inference from starving PostgreSQL and the app |
| Loaded models | 1 | Prevents another model from displacing or duplicating the approved tutor |
| Parallel generations | 1 | Avoids multiplying context memory on an 8 GB budget |
| Context | 4,096 tokens | The model supports more, but a chapter tutor does not need a 128K context |
| Learner question | 1,200 characters | Keeps accidental pastes and prompt abuse out of the inference queue |
| Retrieved chapter context | 4 chunks / 8,000 characters | Keeps retrieval chapter-scoped and gives prompt size a deterministic ceiling |
| Generated answer | 420 tokens | Favors short teaching guidance instead of long solution dumps |
| Ollama queue | 20 | One bounded classroom-sized backstop |
| App concurrent requests | 1 | Keeps admission aligned with the single inference slot |
| App queue depth | 20 | Bounds retained prompts and rejects overload instead of consuming the host |
| Requests per learner identity | 4/minute | Discourages button-spam while allowing normal tutoring |
| Requests per classroom IP | 80/minute | Adds an abuse ceiling without making 20 learners behind one NAT share a four-request quota |
| Request timeout | 90 seconds | Allows CPU inference to finish without an unbounded socket |
| Model keep-alive | 10 minutes | Avoids repeated cold loads during a lesson, then releases idle memory |

Ollama documents that parallel processing multiplies context memory. Do not increase
`OLLAMA_NUM_PARALLEL` or `RAG_MAX_CONCURRENT_REQUESTS` just to hide a slow queue.
Load-test the exact host first and change both limits together.

Admission uses a hashed authenticated session when available, then a hashed stable
per-tab tutor token, and finally the trusted client IP. Each primary identity may
have only one request in flight. The separate IP ceiling is intentionally high
enough for a 20-person room behind one school NAT while still limiting anonymous
flooding. Rate exhaustion, duplicate in-flight work, queue timeout, and queue
saturation return HTTP `429` with `Retry-After`; an unavailable model returns `503`
and an inference timeout returns `504`.

## Capacity plan for 10–20 learners

The important number is simultaneous tutor generations, not signed-in learners.
Most classroom use is bursty: learners read, edit code, and occasionally ask a
question.

| Stage | Suggested capacity | Operating mode |
| --- | --- | --- |
| Pilot, 1–5 learners | 4 CPU cores, 12 GB host RAM | One Ollama worker, one active generation |
| Normal class, 10–20 learners with staggered questions | 8 CPU cores and 16 GB host RAM, or a supported GPU with enough VRAM | One worker, one active generation, queue up to 20 |
| Sustained queue or timeouts | Dedicated GPU inference host, or two isolated Ollama workers behind a server-side dispatcher | One loaded model per worker; retain per-learner rate limits |
| More than one classroom | Separate inference pool and queue per classroom/tenant | Prevent one room from consuming another room's latency budget |

Before a lesson, replay a representative chapter prompt mix with synthetic users.
Ramp 1, 5, 10, then 20 clients; do not begin at maximum load. Measure:

- queue depth, admission rejections, and HTTP `429`/`503` responses;
- time to first token and total response latency at p50 and p95;
- input/output token counts and tokens per second;
- Ollama resident memory, CPU/GPU utilization, and out-of-memory restarts;
- app event-loop delay, PostgreSQL pool wait, and overall `/readyz` status.

Select an SLO for the actual hardware before opening the room. A practical starting
gate is no OOM restart, less than 1% overload rejection in the representative run,
and a p95 response time the instructor considers usable. If the queue stays above
half full for five minutes, p95 repeatedly exceeds the lesson SLO, or memory
exceeds 85%, add inference capacity rather than increasing queue length.

One local smoke measurement provides scale, not a capacity promise: on an Apple
arm64 host with 18 GB RAM, Ollama 0.24.0, the same Llama 3.1 8B Q4_K_M model,
`num_ctx=2048`, and an eight-token response, a cold request took 10.59 seconds
(7.69 seconds loading and 2.74 seconds prompt evaluation). The model runner used
about 4.24 GB RSS and Ollama reported about 4.8 GB for the model. The Compose
profile uses a larger 4,096-token context and a newer pinned Ollama release, so
measure it independently on the intended CPU or GPU.

On that host, a real chapter-scoped tutor smoke with 1,173 prompt tokens and 186
completion tokens took about 55 seconds and returned a chapter-only answer with
three citations. At that speed a single CPU worker provides only about one full
answer per minute. The 15-second queue timeout intentionally rejects a burst
quickly instead of making a whole class wait many minutes. A room expecting
several simultaneous answers therefore needs faster GPU inference, multiple
isolated workers, or instructor-paced/staggered tutor use.

For horizontal scaling, each Ollama worker needs its own complete model residency;
two workers roughly double inference memory. Put a bounded server-side dispatcher
in front of them, use least-active-request routing, keep each worker at one active
generation initially, and preserve the same per-learner rate limit. Do not expose
workers directly to browsers or place the unauthenticated API behind a public load
balancer.

## Operations and failure handling

### Tutor unavailable

If Ollama fails after startup, the core course should remain available while tutor
requests return a bounded service-unavailable response. Check:

```bash
docker compose \
  --file docker-compose.yml \
  --file docker-compose.ai.yml \
  ps ollama
docker compose \
  --file docker-compose.yml \
  --file docker-compose.ai.yml \
  logs --no-color --tail 200 ollama app
```

Restart only the inference service:

```bash
docker compose \
  --file docker-compose.yml \
  --file docker-compose.ai.yml \
  restart ollama
```

To disable the tutor during an incident, recreate the app from the base Compose
file without the AI overlay. Keep the model volume for later recovery:

```bash
docker compose --file docker-compose.yml up --detach --force-recreate app
```

### Change the model

Treat a model change like an application release. Use a specific reviewed tag,
rerun content-safety and chapter-isolation tests, measure memory and latency, and
perform a small classroom canary. Set a new `OLLAMA_MODEL` value and recreate the
AI overlay. The bootstrap downloads a model only when that exact tag is absent.
Never switch to `latest` for a classroom deployment.

### Data and retention

The model volume is a reproducible cache, not learner progress. PostgreSQL and
`submissions_data` remain the authoritative learner stores and follow the backup
procedure in [DEPLOYMENT.md](DEPLOYMENT.md). Avoid persisting raw tutor prompts or
responses. If operational sampling is necessary, redact code, names, emails,
session identifiers, and secrets; set a short retention period and restrict access.

## Release checklist

- `npm run validate` and `npm run validate:ai-infra` pass.
- The merged Compose configuration parses successfully.
- Ollama has no host port and is attached only to the internal `ai` network.
- The bootstrap downloader has exited successfully.
- The approved model is present and no second model is loaded.
- Chapter-isolation, prompt-injection, timeout, queue-full, and model-down tests pass.
- A 1/5/10/20-client capacity run meets the classroom SLO.
- Instructor-facing fallback copy explains that the tutor is temporarily unavailable.
- PostgreSQL and submission backups are verified independently of the model cache.
