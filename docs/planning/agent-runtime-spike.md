# Agent runtime and durable runs: one spike, two arms

Drafted 2026-11-09, revised the same day to the operator shape. Settles technical gap 5 (durable runs),
decides where Beacon's agents live, and pulls in the Kubernetes half of gap 1 (tenant runtime).

## Why one investigation, not two

The agent runtime and the workflow engine are the same question asked twice. What makes a runtime
"real" for Beacon is mostly durability: a run that survives a restart, waits hours for an approval,
never repeats a remediation and never pays for the same model turn twice. Whoever owns the agent loop
owns that durability.

Today the loop lives in `internal/agent/claude.go` (`Claude.loop`) and the approval wait is a Go
channel inside a tool call (`toolbox.go`, `t.gate.wait(ap.ID)`): the run's goroutine blocks until a
human decides, and a restart loses the run, the approval and the thread.

- **Go-native arm.** The loop becomes a DBOS workflow inside the tenant runtime. Each model turn and
  each tool call is a checkpointed step; the approval wait is a durable receive. DBOS *is* the agent
  runtime's durability layer.
- **kagent arm.** The loop runs in a kagent agent pod. DBOS can only wrap the call to it as one
  coarse step, so durability inside the investigation depends on kagent. A restart mid-run either
  resumes in kagent or re-runs the whole investigation.

Both arms are measured against one contract, on one test harness, and end in one decision.

## The shape: one namespace per tenant

```
namespace tenant-a
  CRDs:       Cell, Responder, Runbook, Policy   declared intent, reviewed in git
              Agent, ModelConfig                 kagent, only if that arm wins
              Run                                thin handle: phase, cell, finding, link
  Deployment  beacon-runtime                     controller + DBOS, watches this namespace only
  Secrets     cloud identities, model key        this tenant only
  Egress      one static IP                      e.g. a Cilium egress gateway policy
Postgres      database tenant_a, own role        DBOS steps, threads, evidence
```

**What goes in a CRD and what does not.** Declared intent changes rarely and belongs in Kubernetes:
cells, responders, runbooks, policy, agents. Execution does not: a run's thread and evidence grow past
etcd's object limit (about 1.5 MB) and runs churn many times a day, which is why Argo and Tekton need
archiving bolted on. So a `Run` resource is a thin handle with a phase and a link, and DBOS holds the
steps in the tenant's Postgres database.

**Reconcile meets durable execution.** The controller starts a DBOS workflow with the `Run`'s UID as
the workflow id, so a level-triggered reconcile that fires twice cannot start two runs. The workflow
writes its phase back to the `Run` status. Deleting a `Run` (finalizer) cancels the workflow. An
approval decision reaches the waiting workflow as a durable message.

**The controller is a library, not a deployed operator.** DBOS workflows are Go functions compiled
into the binary that runs them, so a generic operator cannot run Beacon's investigation code. The
reusable part is the glue: the `Run`-to-workflow reconciler, status sync, cancel by finalizer,
signals, per-namespace DBOS setup. That glue is built as a separate Go module with no Beacon imports
(working name `dbos-operator`, see the last section); Beacon's runtime binary imports it and
registers its own workflows and CRDs.

## The contract an agent runtime must meet

| # | Requirement | Today |
|---|---|---|
| C1 | A run survives a process or pod restart at any point and resumes where it stopped. | Lost |
| C2 | No side effect repeats after a restart: no second remediation, no second paid model turn. | n/a |
| C3 | An approval can wait hours or days without holding a worker; a timeout escalates. | Goroutine blocks |
| C4 | The policy gate sits in the only tool path; an action runs only through the remediator. | Yes, in process |
| C5 | A run can only touch the cell it was started for. | Yes |
| C6 | The orchestrator delegates to specialists as child runs; cancelling a parent cancels children. | Partial |
| C7 | Tokens are accounted per agent, per run and per tenant, and a budget is checked before a model call. | Accounted, no budget |
| C8 | Streamed text reaches the console over the existing event stream; a replay does not stream twice. | Yes |
| C9 | Claude with per-agent effort and prompt caching. | Yes |
| C10 | Tenant isolation: one namespace, one runtime and one Postgres database and role per tenant. | n/a |
| C11 | A small team can operate it: footprint, moving parts, upgrade risk. | n/a |
| C12 | Declared intent (cells, responders, runbooks, policy) is applied with `kubectl` or GitOps and picked up without a restart. | In memory |

## Phase 0: fact check (half a day)

DBOS Go, from its docs and code, with links:

- Can the system database be a given database and schema per tenant (C10)?
- Durable send/receive with a timeout, durable sleep, child workflows, cancellation (C3, C6).
- Queues with a concurrency limit, for one queue per cell.
- Step retries and how a step's recorded output is replayed.
- Release maturity (it was `v0.x` beta in 2026) and how often the API has broken.
- Workflow versioning: what happens to in-flight runs when the workflow code changes.
- Several DBOS executors on one database (two runtime replicas): who recovers which workflow.

kagent, from its docs and code: where sessions are stored, whether a session survives an agent pod
restart, how `requireApproval` pauses and resumes, and the state of the Go ADK runtime.

Stop and rethink if the per-tenant database or the durable receive with timeout is missing in DBOS.

## Phase 1: Go-native arm, the operator shape (3 to 4 days)

Branch `spike/runtime` off `app/v1`. Cluster: OrbStack's built-in Kubernetes on the Mac.

1. **Postgres.** One instance in the cluster (or compose beside it), databases `tenant_a` and
   `tenant_b`, each with its own role.
2. **The `dbos-operator` module** (separate repo or a `go.work` sibling, no Beacon imports):
   a `controller-runtime` manager scoped to one namespace, DBOS launched against that tenant's
   database, a generic reconciler that maps a run-like resource to a registered workflow by name,
   writes status back, cancels on delete and delivers signals.
3. **Beacon's CRDs**, minimal: `Cell`, `Responder`, `Run`. Generated with kubebuilder markers.
   The signal loop creates a `Run`; the console's approve button delivers the decision as a signal.
4. **The investigation workflow** in Beacon, registered with the module:
   - step: load the run and its cell, responder, runbooks.
   - loop: step `ModelTurn` (one Claude call; records the assistant message and usage) →
     for each tool use, step `ToolCall` through the existing `Toolbox` and policy gate.
   - `propose_action` with policy `ask`: step writes the approval, then a durable receive on
     `approval:<id>` with a timeout from the responder (default 24h); timeout escalates.
   - step `Remediate` with the approval id as idempotency key; step `Verify`.
   - The scripted reasoner goes through the same workflow, so the demo still runs without a key.
5. **Domain state across restarts.** The store is in memory. For the spike only, persist
   `Store.Snapshot()` as one `jsonb` row on each update and restore it on boot. Throwaway; the real
   schema is technical gap 7.
6. **Delegation.** The orchestrator starts a specialist as a child `Run` and child workflow; delete
   the parent and check the child stops (C6).
7. **Budget check.** A step before each `ModelTurn` refuses when the tenant budget is spent (C7).

### Kill tests

Kill at each point (`kill -9` in the container and `kubectl delete pod`), let it come back, and check
the console, the `Run` status and the database:

| Kill during | Expected |
|---|---|
| a model turn | that turn re-runs once; earlier turns are not re-billed |
| after a tool call, before the next turn | the tool call is not repeated |
| waiting on an approval | the approval is still pending; deciding after restart continues the run |
| remediation | the provider action runs exactly once |
| a child specialist run | parent and child both resume |
| a reconcile (controller restart with a `Run` just created) | exactly one workflow starts |

Also: two tenant namespaces, `tenant-a` and `tenant-b`, each runtime denied the other's database and
the other's Secrets (C10); edit a `Responder` with `kubectl apply` and see it take effect (C12).
Record image size, memory per tenant runtime, step latency and the DBOS tables created (C11).

## Phase 2: kagent arm (2 days, same contract)

Only if Phase 1 passes, so there is a baseline to beat.

1. Install kagent from its Helm chart on the same cluster.
2. **Beacon's toolbox as an MCP server** (Go, same `Toolbox` and gate). Worth having either way:
   it is the clean boundary around the policy gate whichever runtime calls it.
3. The investigator as a kagent `Agent` in `tenant-a`, Go ADK runtime if it is ready, an Anthropic
   `ModelConfig`, and the Beacon MCP server as its tool server.
4. A DBOS step calls the agent (A2A) and records its result.
5. Same kill tests, killing the agent pod as well, and check C2, C3, C7, C8:
   - does kagent resume an investigation mid-way, or start again?
   - can Beacon's policy gate own approvals, with kagent's `requireApproval` unused, or do they fight?
   - can usage be attributed per run and per tenant from what kagent reports?
6. Record the moving parts it adds (controller, agent pods, UI, its own storage).

## Decision

Score both arms on C1 to C12 in a table at the end of this file, then write the outcome into
`technical-gaps.md` (gaps 1 and 5) and `RESUME.md`. Expected outcome, to be proved or disproved: the
Go-native arm meets the contract with fewer moving parts; kagent is worth adding if its Agent CRDs,
identity and gateway pieces carry weight in the tenant namespace without taking the run loop away
from DBOS.

Out of scope here: static egress in practice (gap 1, network half), the real Postgres schema (gap 7),
the OPA policy document (gap 6).

## The `dbos-operator` module as its own project

Proposed 2026-11-09: the Kubernetes-to-DBOS glue is useful beyond Beacon, so it lives in its own repo
and Beacon is its first user.

- **Scope:** a Go library, not a deployed operator. A generic run resource (or any CRD the user
  registers) mapped to a DBOS workflow by name; workflow id = resource UID; status written back;
  cancel by finalizer; signals delivered as durable messages; one manager per namespace with that
  namespace's database.
- **Not in scope:** Beacon's CRDs, agents, policy, anything about models.
- **How it grows:** developed beside Beacon in one `go.work` workspace during the spike, with the
  boundary enforced by having no Beacon imports. It gets its own release once the spike passes and
  the API has held for one more consumer or a second Beacon workflow.
