# Resume notes

Working folder and git repo for Beacon. Started 2026-10-29; the Go app landed 2026-10-30 on branch `app/v1`.

- `README.md` explains the app, how to run it and how a run flows. Start there.
- `beacon-initial-prd.md` is the PRD v0.1 the work began from.
- `ARTIFACTS.md` lists every published artifact with its URL, local source and how to republish.
- `design-system/project/` is the Beacon design system exactly as published. `web/js/ds.js` and `web/css/beacon.css` mirror it.
- `prototype/beacon-console.html` is the frozen static prototype that matches the published artifact. The live app in `cmd/`, `internal/`, `web/` supersedes it.
- `traffic-map/beacon-traffic-map.html` is the connections diagram exactly as published.

Decisions so far: dark-first console; product name Beacon on screens; polls are truth and webhooks are hints; no Beacon-written agent, the probe is an unmodified OpenTelemetry Collector managed over OpAMP; per-tenant cell with static egress; Postgres for the system of record, ClickHouse for parked telemetry, Temporal for durable runs, OPA for policy, NATS JetStream for events, Go throughout; PoC runs in docker compose, UpCloud Starter 4 vCPU 16 GB host plus a 1 GB UpCloud server as the first monitored asset.

Cell model (2026-10-30, later in the day): tenant = cells + one runtime; connection = identity at scope that discovers a catalogue; cell = one managed VM, cluster or server with its own channel, basic or agent tier; apps and runbooks select cells by label; one agent team per tenant. `./start.sh` runs everything; `./start.sh --dev` serves the console from disk.

Agent model (2026-10-30): one orchestrator per tenant that the human talks to; it applies the responder table to signals and starts specialists (investigator). Deterministic workers (remediator, verifier) have no model. Usage is tracked per agent and per run. Scripted mode replays playbooks through the same toolbox when no API key is set.

Next: tenant-specific runbooks the agents follow (attach to responder or service, inject into the investigator prompt); live-mode test with an API key; push to GitHub when happy.
