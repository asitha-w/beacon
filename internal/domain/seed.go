package domain

import "time"

// Seed data for a fresh tenant. In the real product these come from discovery
// and the tenant's own configuration; here they describe the simulated estate.

// SeedResources is the discovered estate. Labels mirror the provider tags.
func SeedResources() []Resource {
	return []Resource{
		{ID: "web-01", Kind: "Azure VM", Detail: "Standard_B2s · westeurope", Provider: "azure", ResourceGroup: "rg-shop-prod", Probe: true,
			Labels: map[string]string{"app": "shop", "tier": "web", "env": "production", "os": "linux"}},
		{ID: "aks-shop", Kind: "AKS cluster", Detail: "3 nodes · 1.31", Provider: "azure", ResourceGroup: "rg-shop-prod", Probe: true,
			Labels: map[string]string{"app": "shop", "tier": "api", "env": "production", "platform": "kubernetes"}},
		{ID: "la-shop", Kind: "Log Analytics", Detail: "workspace", Provider: "azure", ResourceGroup: "rg-shop-prod",
			Labels: map[string]string{"app": "shop", "tier": "observability", "env": "production"}},
		{ID: "db-01", Kind: "UpCloud managed PostgreSQL", Detail: "2 vCPU · fi-hel2", Provider: "upcloud",
			Labels: map[string]string{"app": "shop", "tier": "data", "env": "production"}},
		{ID: "edge-01", Kind: "UpCloud server", Detail: "1 vCPU 1 GB · de-fra1", Provider: "upcloud", Probe: true,
			Labels: map[string]string{"app": "edge", "tier": "proxy", "env": "production", "os": "linux"}},
	}
}

// SeedApps groups the estate by label selector.
func SeedApps() []*App {
	return []*App{
		{ID: "shop-web", Name: "Shop web", Selector: map[string]string{"app": "shop", "tier": "web"}, Criticality: "Critical", Owner: "platform@shop.example", SLO: "99.9% availability, 30d"},
		{ID: "shop-api", Name: "Shop API", Selector: map[string]string{"app": "shop", "tier": "api"}, Criticality: "Critical", Owner: "platform@shop.example", SLO: "99.9% availability, 30d"},
		{ID: "shop-data", Name: "Shop data", Selector: map[string]string{"app": "shop", "tier": "data"}, Criticality: "Critical", Owner: "data@shop.example", SLO: "none yet"},
		{ID: "edge", Name: "Edge", Selector: map[string]string{"app": "edge"}, Criticality: "Standard", Owner: "ops@shop.example", SLO: "none yet"},
	}
}

// SeedResponders is the routing table from signal to agent and policy.
func SeedResponders() []*Responder {
	return []*Responder{
		{ID: "disk-pressure-linux", Signal: "disk_used_percent > 90 for 5m", Scope: "VMs with a probe", Mode: "Review", Level: "L3", Agent: "investigator",
			Tools: []ToolPolicy{{Tool: "read_metrics", Policy: PolicyAllow}, {Tool: "tail_logs", Policy: PolicyAllow}, {Tool: "run_command", Policy: PolicyAsk}, {Tool: "restart_service", Policy: PolicyDeny}}},
		{ID: "release-regression", Signal: "error_rate > 5% for 5m after a rollout", Scope: "Kubernetes services", Mode: "Review", Level: "L3", Agent: "investigator",
			Tools: []ToolPolicy{{Tool: "read_metrics", Policy: PolicyAllow}, {Tool: "tail_logs", Policy: PolicyAllow}, {Tool: "rollout_undo", Policy: PolicyAsk}, {Tool: "delete_pod", Policy: PolicyDeny}}},
		{ID: "service-down", Signal: "http_up == 0 for 3m on a running host", Scope: "Hosts with a probe", Mode: "Review", Level: "L3", Agent: "investigator",
			Tools: []ToolPolicy{{Tool: "read_metrics", Policy: PolicyAllow}, {Tool: "tail_logs", Policy: PolicyAllow}, {Tool: "restart_service", Policy: PolicyAsk}, {Tool: "run_command", Policy: PolicyDeny}}},
		{ID: "server-stopped", Signal: "state != started, no operator event", Scope: "UpCloud servers", Mode: "Autonomous", Level: "L4", Agent: "investigator",
			Tools: []ToolPolicy{{Tool: "get_resource_state", Policy: PolicyAllow}, {Tool: "start_server", Policy: PolicyAllow}, {Tool: "stop_server", Policy: PolicyDeny}}},
		{ID: "slo-burn-rate", Signal: "burn rate > 2x over 1h", Scope: "Services with an SLO", Mode: "Review", Level: "L2", Agent: "investigator",
			Tools: []ToolPolicy{{Tool: "read_metrics", Policy: PolicyAllow}, {Tool: "notify", Policy: PolicyAllow}}},
		{ID: "cert-expiry", Signal: "cert expires in < 14d", Scope: "Ingress, load balancers", Mode: "Review", Level: "L2", Agent: "investigator",
			Tools: []ToolPolicy{{Tool: "get_resource_state", Policy: PolicyAllow}, {Tool: "notify", Policy: PolicyAllow}}},
	}
}

// SeedAgents is the agent roster the orchestrator manages.
func SeedAgents(model string) []*AgentDef {
	return []*AgentDef{
		{ID: "orchestrator", Name: "Orchestrator", Kind: AgentOrchestrator, Role: "Routes signals and requests to the right agent",
			Description: "The agent you talk to. It watches the signal loop, applies the responder table, starts specialists, and answers questions about the tenant. It never changes infrastructure itself.",
			Model:       model, Effort: "medium", Tools: []string{"list_findings", "get_resource_state", "start_investigation", "list_runs"}, Enabled: true, MaxToolCalls: 8},
		{ID: "investigator", Name: "Investigator", Kind: AgentSpecialist, Role: "Collects evidence, forms hypotheses, proposes one action",
			Description: "Started by the orchestrator when a responder matches. Reads metrics, logs, activity and files, records evidence with pointers, and proposes a single remediation under the responder's policy.",
			Model:       model, Effort: "medium", Tools: []string{"read_metrics", "tail_logs", "get_activity", "get_resource_state", "read_file", "record_evidence", "record_hypothesis", "propose_action", "conclude"}, Enabled: true, MaxToolCalls: 25},
		{ID: "remediator", Name: "Remediator", Kind: AgentDeterministic, Role: "Executes approved actions with the write identity",
			Description: "No model. Runs exactly the action that was approved, with the preconditions re-checked, and records the provider's response.",
			Tools:       []string{"run_command", "restart_service", "rollout_undo", "start_server"}, Enabled: true},
		{ID: "verifier", Name: "Verifier", Kind: AgentDeterministic, Role: "Checks claims have pointers and re-reads the signal after a fix",
			Description: "No model. Marks a cause Verified only when every material claim has an evidence row, and resolves a finding only when the triggering signal has cleared on an independent read.",
			Tools:       []string{"read_metrics", "get_resource_state"}, Enabled: true},
		{ID: "cost-advisor", Name: "Cost advisor", Kind: AgentSpecialist, Role: "Finds idle and oversized resources",
			Description: "Weekly review of utilisation against size. Disabled until the tenant opts in; shown here so the roster is complete.",
			Model:       model, Effort: "low", Tools: []string{"read_metrics", "get_resource_state", "notify"}, Enabled: false, MaxToolCalls: 15},
	}
}

// SeedRunbooks is the tenant's starting guidance, one per app tier.
func SeedRunbooks() []*Runbook {
	t := time.Date(2026, 10, 28, 9, 0, 0, 0, time.UTC)
	return []*Runbook{
		{ID: "shop-web-vms", Name: "Shop web on VMs", Selector: map[string]string{"app": "shop", "tier": "web"}, UpdatedAt: t, UpdatedBy: "platform@shop.example", Body: `# Shop web on VMs

nginx in front of the shop-web process on Ubuntu 22.04. Deploys come from ci-deploy through Run Command.

## Health signals
- disk_used_percent on / above 85% is the early warning; 90% is the signal.
- requests_per_second around 300 is normal at this hour; a spike is above 600.

## Known fixes, in order
1. Disk pressure: force a logrotate run first. If NGINX_DEBUG=1 is set in /etc/nginx/env, turn it off and reload nginx. Debug logging is never meant to stay on in production.
2. High memory: restart shop-web, not nginx.

## Never
- Never delete files under /var/log. Rotate and compress only.
- Never reboot during the 08:00 to 10:00 CET order window.

## Escalation
platform@shop.example, #ops on Slack. Page only for Critical findings.
`},
		{ID: "shop-api-aks", Name: "Shop API on AKS", Selector: map[string]string{"app": "shop", "tier": "api"}, UpdatedAt: t, UpdatedBy: "platform@shop.example", Body: `# Shop API on AKS

Deployment shop-api, three replicas, rolled out by ci-deploy. Checkout depends on it.

## Known fixes, in order
1. Error rate rises right after a rollout: roll back to the previous revision. Do not wait for a hotfix.
2. Pod restarts without a rollout: check node memory before touching the deployment.

## Never
- Never delete pods by hand; let the deployment replace them.
- Never scale below three replicas.

## Escalation
platform@shop.example. Attach the pod log excerpt and the rollout revision.
`},
		{ID: "edge-proxy", Name: "Edge proxy servers", Selector: map[string]string{"app": "edge"}, UpdatedAt: t, UpdatedBy: "ops@shop.example", Body: `# Edge proxy servers

Small UpCloud servers running nginx as a caching proxy. 1 GB of memory; the cache zone is sized at 400 MB.

## Known fixes, in order
1. nginx down, host up: restart nginx. Safe at any hour.
2. Server stopped with no operator event: start it. This is allowlisted (L4).
3. Repeated OOM kills: lower edge_cache in /etc/nginx/conf.d/cache.conf and tell ops.

## Escalation
ops@shop.example. Edge is Standard criticality; no paging.
`},
	}
}

// SeedScenarios lists the faults the demo can inject.
func SeedScenarios() []*Scenario {
	return []*Scenario{
		{ID: "disk-fill", Name: "Fill the disk on web-01", Description: "A deploy turns nginx debug logging on and logrotate has stalled. Expect disk-pressure-linux, a Run Command fix after approval.", Resource: "web-01", Status: "idle"},
		{ID: "bad-release", Name: "Ship a bad version of shop-api", Description: "Rollout v2.4.1 on aks-shop raises the error rate to 18%. Expect release-regression and a rollout undo after approval.", Resource: "aks-shop", Status: "idle"},
		{ID: "service-crash", Name: "Crash nginx on edge-01", Description: "The kernel OOM-kills nginx. Expect service-down and a service restart after approval.", Resource: "edge-01", Status: "idle"},
		{ID: "server-stopped", Name: "Stop the UpCloud server edge-01", Description: "The server stops with no operator event. Expect server-stopped to start it autonomously (L4).", Resource: "edge-01", Status: "idle"},
	}
}

// ValidateAzure simulates validation: it derives the role assignments the
// identity would hold from the requested scopes, then the capabilities from
// the roles. Log Analytics Reader is never granted by consent alone, so that
// capability shows as missing until the customer assigns it.
func ValidateAzure(c *Connection) {
	c.Identity = "Service principal Beacon (" + c.AuthMode + ", " + c.CredentialKind + ")"
	if c.AuthMode == "byo" && c.ClientID != "" {
		c.Identity = "App registration " + short(c.ClientID) + " (" + c.CredentialKind + ")"
	}
	c.Roles = []RoleAssignment{
		{Identity: "read", Role: "Reader", Scope: c.ReadScope},
		{Identity: "read", Role: "Monitoring Reader", Scope: c.ReadScope},
		{Identity: "read", Role: "Azure Kubernetes Service RBAC Reader", Scope: c.ReadScope},
	}
	hasWrite := c.WriteScope.Level != ScopeNone && c.WriteScope.Level != ""
	if hasWrite {
		c.Roles = append(c.Roles,
			RoleAssignment{Identity: "write", Role: "Virtual Machine Contributor", Scope: c.WriteScope},
			RoleAssignment{Identity: "write", Role: "Azure Kubernetes Service RBAC Writer", Scope: c.WriteScope})
	}
	writeState := "missing"
	writeDetail := "no write identity on this connection"
	if hasWrite {
		writeState = "available"
		writeDetail = "Run Command · write identity at " + c.WriteScope.Level + " " + c.WriteScope.Target
	}
	c.Capabilities = []Capability{
		{Name: "Resource discovery", Detail: "Resource Graph · Reader", State: "available"},
		{Name: "Platform metrics", Detail: "Azure Monitor · Monitoring Reader", State: "available"},
		{Name: "Resource health verdict", Detail: "Resource Health API · Reader", State: "available"},
		{Name: "Activity log, who changed what", Detail: "Activity Log · Reader", State: "available"},
		{Name: "Log Analytics queries", Detail: "needs Log Analytics Reader on the workspace", State: "missing"},
		{Name: "Kubernetes API", Detail: "Entra RBAC · AKS RBAC Reader", State: "available"},
		{Name: "In-guest fixes", Detail: writeDetail, State: writeState},
		{Name: "Rollouts on AKS", Detail: map[bool]string{true: "AKS RBAC Writer · write identity", false: "no write identity on this connection"}[hasWrite], State: writeState},
	}
}

// ValidateUpCloud simulates validation of a sub-account token.
func ValidateUpCloud(c *Connection) {
	if c.SubAccount == "" {
		c.SubAccount = "beacon-ro"
	}
	c.Identity = "API token for sub-account " + c.SubAccount
	if len(c.Grants) == 0 {
		c.Grants = []string{"server.read", "server.power", "database.read"}
	}
	has := func(g string) bool {
		for _, x := range c.Grants {
			if x == g {
				return true
			}
		}
		return false
	}
	state := func(ok bool) string {
		if ok {
			return "available"
		}
		return "missing"
	}
	c.Capabilities = []Capability{
		{Name: "Server inventory and state", Detail: "GET /1.3/server · server.read", State: state(has("server.read"))},
		{Name: "Managed database metrics", Detail: "GET /1.3/database/{id}/metrics · database.read", State: state(has("database.read"))},
		{Name: "Power operations", Detail: "POST /1.3/server/{id}/start · server.power", State: state(has("server.power"))},
		{Name: "Host CPU, memory, disk", Detail: "Beacon probe on servers", State: "available"},
		{Name: "Activity log", State: "none"},
		{Name: "Resource health verdict", State: "none"},
	}
}

func short(s string) string {
	if len(s) > 8 {
		return s[:8] + "…"
	}
	return s
}

// NewState returns an empty tenant state with seed data.
func NewState(model, reasoner string) *State {
	s := &State{
		Connections: []*Connection{},
		Probe:       Probe{Status: ProbeNone, Hosts: []string{}, Expected: []string{"edge-01", "web-01", "aks-shop"}},
		Resources:   SeedResources(),
		Apps:        SeedApps(),
		Runbooks:    SeedRunbooks(),
		Responders:  SeedResponders(),
		Agents:      SeedAgents(model),
		Findings:    []*Finding{},
		Runs:        []*Run{},
		Approvals:   []*Approval{},
		Activity:    []Activity{},
		Chat:        []*ChatMessage{},
		Scenarios:   SeedScenarios(),
		Usage:       map[string]*Usage{},
		Reasoner:    reasoner,
		Model:       model,
	}
	for _, a := range s.Agents {
		s.Usage[a.ID] = &Usage{}
	}
	return s
}
