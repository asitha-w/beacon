# Resume notes

Working folder and git repo for Beacon. Private GitHub repo: https://github.com/asitha-w/beacon (default branch `main`, work on `app/v1`). Started 2026-10-29; the Go app landed 2026-10-30 and was reshaped around cells the same day.

## Where to start

- `./start.sh` runs everything on http://localhost:8080; `./start.sh --dev` serves the console from `web/` so edits show on refresh. `README.md` explains the model and the run flow.
- `docs/architecture/beacon-architecture.png` is the one-page picture for the team. `docs/recordings/2026-10-30-beacon-walkthrough.mp4` is the 5-minute video; `tools/record/record.py` regenerates it.
- `docs/planning/` holds the product planning notes: the technical gap list and one file per settled topic. Read `technical-gaps.md` there before picking the next design question.
- `ARTIFACTS.md` lists the published claude.ai artifacts from day one. The design system there still shows the old IBM Plex look; `web/css/beacon.css` is now the source of truth.

## The model, as agreed on 2026-10-30

- Tenant = a collection of cells served by one runtime (isolated workers, own credentials, static egress).
- Connection = an identity at a scope. Azure: directory, consent or own app registration, read scope, narrower write scope; validation lists roles and fills a catalogue. UpCloud: sub-account token, its grants are the frame. Connections manage nothing by themselves.
- Cell = one managed VM, cluster or server, onboarded from a catalogue, with its own isolated channel, labels, and a tier: basic (provider sensors and actions) or probe (the OpenTelemetry Collector installed; telemetry settings render into its config over OpAMP). The investigator can only read what the telemetry enables.
- Isolation is real at Beacon's layer (channel, policy, budget per cell) and at the provider's layer only as far as the identity's scope; the Cells page shows dedicated versus shared identity.
- Labels are the only glue: runbooks select cells by label, owner and criticality are labels, `app=` is just a label. There is no app object.
- One agent team per tenant: orchestrator (talks to the operator, routes by the responder table), investigator (model), remediator and verifier (no model). "Agent" means these; the thing on a cell is the "probe".
- Runbooks guide, the responder policy decides (allow, ask, deny).

## Earlier decisions still standing

Dark-first console in the shadcn look; polls are truth and webhooks are hints; probe is an unmodified OpenTelemetry Collector over OpAMP; Postgres, ClickHouse, Temporal, OPA, NATS JetStream, Go; PoC on an UpCloud host in docker compose.

## Settled on 2026-10-31 (design only, no code)

- Levels of reach per cell: VM Level 0 connected, Level 1 granted; Kubernetes Level 0 connected, Level 1 API access, Level 2 probe. `docs/planning/cell-access-model.md` is the reviewed reference of what must exist at each level on Azure and UpCloud.
- VM hands: SSH direct from the tenant's static egress, reverse tunnel fallback, never a jump box; Ansible on top; per-tenant SSH CA with short-lived certificates; the "Beacon grant" is one line the operator runs. `docs/planning/hands-ssh.md`.
- Twenty comparable products studied from their own docs: `docs/planning/competitor-access-models.md`.
- Still to test on real infrastructure: listed at the end of `cell-access-model.md`.

## Open items, in the order we discussed

1. Live-mode run with an API key: the investigator and orchestrator prompts have never been exercised against the model.
2. Cell page follow-ups: receivers per kind, a "test this log source" action, telemetry presets.
3. Responders and runbooks per cell page (which responders are in scope for this cell).
4. Consumption: budgets per tenant, maybe per cell.
5. Re-publish the design system artifact from the current stylesheet when the screens settle.
6. Decide whether `main` tracks `app/v1` continuously or only at milestones.
