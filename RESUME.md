# Resume notes

Working folder for the Beacon product shaping work. Started 2026-10-29.

- `beacon-initial-prd.md` is the PRD v0.1 the work began from.
- `ARTIFACTS.md` lists every published artifact with its URL, local source and how to republish.
- `design-system/project/` is the Beacon design system exactly as published.
- `prototype/beacon-console.html` is the clickable console prototype exactly as published.
- `traffic-map/beacon-traffic-map.html` is the connections diagram exactly as published.
- `docs/` is for the design notes still to be written into the PRD: traffic and connection model, three-loop collector, technology section, competitor section.

Decisions made so far: dark-first console; product name Beacon on screens; polls are truth and webhooks are hints; no Beacon-written agent, the probe is an unmodified OpenTelemetry Collector managed over OpAMP; per-tenant cell with static egress; Postgres for the system of record, ClickHouse for parked telemetry, Temporal for durable runs, OPA for policy, NATS JetStream for events, Go throughout; PoC runs in docker compose, UpCloud Starter 4 vCPU 16 GB host plus a 1 GB UpCloud server as the first monitored asset.

Next: journey simulations. More scripted scenarios in the prototype, for example an UpCloud server stopping and being started autonomously, and a Kubernetes crash loop with rollout undo.
