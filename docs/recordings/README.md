# Recordings

| File | What it shows |
|---|---|
| `2026-10-30-beacon-walkthrough.mp4` | One continuous video, 5 min 10 s, 1600×900, four parts with title cards. **Onboarding:** sign in, tenant, Azure and UpCloud connections, discovery, onboarding cells, installing the probe, a cell's provider sensors and probe telemetry, the agent roster. **Runbooks:** writing one for the managed database against a label selector. **Incident:** a bad shop-api release from signal to rollback to verification. **Working with the agents:** the operator asks the orchestrator about a crashed edge proxy, questions the proposed fix, approves it, and watches verification. |

Recorded with `tools/record/record.py` against a fresh scripted-mode server; re-run it after UI changes to regenerate. It needs the Python environment described in `tools/record/README.md`.
