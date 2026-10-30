# Recordings

Stepped GIF captures of the console in scripted mode, recorded 2026-10-30. One frame per action, with click markers.

| File | What it shows |
|---|---|
| `2026-10-30-01-onboarding.gif` | Sign in, create the tenant, validate the Azure connection (directory, consent identity, read and write scopes, role assignments) and the UpCloud sub-account, wait for the probes, then the Agents page and enabling the Cost advisor. |
| `2026-10-30-02-runbooks.gif` | The Runbooks page, a new runbook for the managed database written in the editor against the `app=shop, tier=data` selector, and its card after saving. |
| `2026-10-30-03-incident.gif` | A bad shop-api release: the signal loop opens the finding, the investigator follows the Shop API runbook, proposes the rollback, a human approves, the remediator rolls back, the verifier resolves the finding. |
| `2026-10-30-04-agent-interaction.gif` | nginx crashes on edge-01. The operator asks the orchestrator what is open and why edge-01 is failing, opens the pending approval, asks the agent whether the restart is safe, approves it, and watches verification. |
