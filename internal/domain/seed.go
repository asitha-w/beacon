package domain

// Seed data for a fresh tenant. In the real product these come from discovery
// and the tenant's own configuration; here they describe the simulated estate.

// SeedResources is the discovered estate.
func SeedResources() []Resource {
	return []Resource{
		{ID: "web-01", Kind: "Azure VM", Detail: "Standard_B2s · westeurope", Service: "Shop web", Provider: "azure", Probe: true},
		{ID: "aks-shop", Kind: "AKS cluster", Detail: "3 nodes · 1.31", Service: "Shop web", Provider: "azure", Probe: true},
		{ID: "la-shop", Kind: "Log Analytics", Detail: "workspace", Service: "Shop web", Provider: "azure"},
		{ID: "db-01", Kind: "UpCloud managed PostgreSQL", Detail: "2 vCPU · fi-hel2", Service: "Shop data", Provider: "upcloud"},
		{ID: "edge-01", Kind: "UpCloud server", Detail: "1 vCPU 1 GB · de-fra1", Service: "Edge", Provider: "upcloud", Probe: true},
	}
}

// SeedServices groups the estate.
func SeedServices() []Service {
	return []Service{
		{Name: "Shop web", Criticality: "Critical", Owner: "platform@shop.example", SLO: "99.9% availability, 30d"},
		{Name: "Shop data", Criticality: "Critical", Owner: "data@shop.example", SLO: "none yet"},
		{Name: "Edge", Criticality: "Standard", Owner: "ops@shop.example", SLO: "none yet"},
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

// SeedScenarios lists the faults the demo can inject.
func SeedScenarios() []*Scenario {
	return []*Scenario{
		{ID: "disk-fill", Name: "Fill the disk on web-01", Description: "A deploy turns nginx debug logging on and logrotate has stalled. Expect disk-pressure-linux, a Run Command fix after approval.", Resource: "web-01", Status: "idle"},
		{ID: "bad-release", Name: "Ship a bad version of shop-api", Description: "Rollout v2.4.1 on aks-shop raises the error rate to 18%. Expect release-regression and a rollout undo after approval.", Resource: "aks-shop", Status: "idle"},
		{ID: "service-crash", Name: "Crash nginx on edge-01", Description: "The kernel OOM-kills nginx. Expect service-down and a service restart after approval.", Resource: "edge-01", Status: "idle"},
		{ID: "server-stopped", Name: "Stop the UpCloud server edge-01", Description: "The server stops with no operator event. Expect server-stopped to start it autonomously (L4).", Resource: "edge-01", Status: "idle"},
	}
}

// AzureCapabilities is what the Azure connection offers once validated.
func AzureCapabilities() []Capability {
	return []Capability{
		{Name: "Resource discovery", Detail: "Resource Graph · Reader", State: "available"},
		{Name: "Platform metrics", Detail: "Azure Monitor metrics", State: "available"},
		{Name: "Resource health verdict", Detail: "Resource Health API", State: "available"},
		{Name: "Activity log, who changed what", Detail: "Activity Log · Reader", State: "available"},
		{Name: "Log Analytics queries", Detail: "Log Analytics Reader", State: "missing"},
		{Name: "Kubernetes API, aks-shop", Detail: "Entra RBAC · view ClusterRole", State: "available"},
		{Name: "In-guest fixes", Detail: "Run Command · write identity", State: "available"},
		{Name: "Memory, disk, processes", Detail: "Beacon probe on web-01", State: "available"},
	}
}

// UpCloudCapabilities is what the UpCloud connection offers once validated.
func UpCloudCapabilities() []Capability {
	return []Capability{
		{Name: "Server inventory and state", Detail: "GET /1.3/server", State: "available"},
		{Name: "Managed database metrics", Detail: "GET /1.3/database/{id}/metrics", State: "available"},
		{Name: "Power operations", Detail: "POST /1.3/server/{id}/start", State: "available"},
		{Name: "Host CPU, memory, disk", Detail: "Beacon probe on edge-01", State: "available"},
		{Name: "Activity log", State: "none"},
		{Name: "Resource health verdict", State: "none"},
	}
}

// NewState returns an empty tenant state with seed data.
func NewState(model, reasoner string) *State {
	s := &State{
		Connections: map[string]*Connection{
			"azure":   {Provider: "azure", Status: ConnNone},
			"upcloud": {Provider: "upcloud", Status: ConnNone},
		},
		Probe:      Probe{Status: ProbeNone, Hosts: []string{}, Expected: []string{"edge-01", "web-01", "aks-shop"}},
		Resources:  SeedResources(),
		Services:   SeedServices(),
		Responders: SeedResponders(),
		Agents:     SeedAgents(model),
		Findings:   []*Finding{},
		Runs:       []*Run{},
		Approvals:  []*Approval{},
		Activity:   []Activity{},
		Chat:       []*ChatMessage{},
		Scenarios:  SeedScenarios(),
		Usage:      map[string]*Usage{},
		Reasoner:   reasoner,
		Model:      model,
	}
	for _, a := range s.Agents {
		s.Usage[a.ID] = &Usage{}
	}
	return s
}
