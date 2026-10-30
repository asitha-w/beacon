# Beacon

Agentic reliability operations for teams on Azure and UpCloud without a full-time SRE. This repository holds the product shaping work (PRD, design system, static prototype) and the first runnable version of the console: a Go service with a simulated tenant, a real agent loop, and the console UI.

## What is here

| Path | What |
|---|---|
| `cmd/beacon` | The binary: API, event stream, embedded console, signal loop, orchestrator. |
| `internal/domain` | Entities the console shows and the agents act on. No dependencies. |
| `internal/store` | In-memory system of record for one tenant plus the event bus. |
| `internal/world` | Simulated estate: hosts, metric streams, services with versions, logs, files, activity. |
| `internal/scenario` | The faults the demo injects and the scripted playbook for each. |
| `internal/signal` | Deterministic signal loop: ticks the world, evaluates responder rules, verifies fixes. |
| `internal/agent` | Orchestrator, investigator reasoners (Claude and scripted), toolbox with the policy gate, remediator, usage accounting. |
| `internal/api` | HTTP handlers and the server-sent event stream. |
| `web/` | The console: vanilla ES modules on the Beacon design system, embedded into the binary. |
| `prototype/`, `design-system/`, `traffic-map/` | The published artifacts the app grew from. See `ARTIFACTS.md`. |
| `beacon-initial-prd.md` | PRD v0.1. |

## Run it

```sh
make run                      # scripted mode: no API key needed, playbooks drive the agents
ANTHROPIC_API_KEY=... make run  # live mode: the investigator and orchestrator call Claude
```

Open http://localhost:8080, sign in with anything, create a tenant, validate both clouds, wait for the probes, then inject a fault from the demo bar at the bottom.

Settings are environment variables; see `.env.example`. `BEACON_MODEL` defaults to `claude-opus-5-5`.

`make build` produces a single static binary in `bin/`. `docker compose up --build` runs it in a container.

## How a run works

1. The **signal loop** ticks the world once a second and evaluates the responder rules. No model is involved.
2. When a rule holds for its window, the **orchestrator** applies the responder table: it opens a finding and a run and starts the responder's agent, the **investigator**, with a tool budget.
3. The investigator reads metrics, logs, activity and files through the **toolbox**, records evidence with source pointers and hypotheses with verdicts, and proposes exactly one action.
4. The **policy gate** decides: `allow` runs it now, `ask` opens an approval and pauses the run until a human decides, `deny` refuses it. A responder in Autonomous mode turns `ask` into `allow`.
5. The **remediator** executes the approved action against the world and records the provider response. It has no model.
6. The **verifier** marks the cause Verified only when every claim has a pointer, and the signal loop re-reads the triggering signal before the finding is resolved.

**Connections** are one identity at one scope. An Azure connection needs the Entra directory, an identity (consent to the Beacon app, or bring your own app registration with a federated credential or certificate), a read scope for discovery and an optional, narrower write scope for fixes. Validation lists the role assignments and derives the capability list from them. The remediator refuses an approved action when no connection's write scope covers the resource. An UpCloud connection is a sub-account token whose grants are the frame.

**Labels and apps.** Resources carry labels imported from provider tags and editable in Beacon. An app is a label selector; resources join by matching and findings are attributed to the most specific app. Runbooks will attach to the same labels.

The operator talks to the orchestrator on the Ask Beacon page. It can list findings, describe resources, and start an investigation on request. Every model call is accounted per agent and per run on the Agents and Consumption pages.

## Scripted mode and live mode

Without `ANTHROPIC_API_KEY` the reasoners replay scenario playbooks through the same toolbox, so policy, approvals, evidence and verification behave exactly as with the model. Token usage is simulated at typical sizes and labelled as such in the console. With a key, the investigator and the orchestrator run a streaming tool loop on the model named in `BEACON_MODEL`; the Agents page lets you change effort per agent.

## Development

```sh
make test   # go vet and the unit tests
make fmt
```

The console has no build step. The design system components in `web/js/ds.js` mirror `design-system/project/components/bundle.js`; change the design system first, then copy.
