// Package domain holds the Beacon domain model: the entities the console shows
// and the agents act on. It has no dependencies on the simulator or the API so
// the same types can back the real product later.
package domain

import (
	"sort"
	"time"
)

// User is the signed-in operator.
type User struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

// Tenant is a collection of cells served by one runtime: isolated workers,
// own credentials, one static egress address.
type Tenant struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Env       string    `json:"env"`
	Region    string    `json:"region"`
	Runtime   string    `json:"runtime"`
	EgressIP  string    `json:"egressIp"`
	CreatedAt time.Time `json:"createdAt"`
}

// Capability is one thing a connection lets Beacon see or do.
type Capability struct {
	Name   string `json:"name"`
	Detail string `json:"detail,omitempty"`
	State  string `json:"state"` // available, missing, none
}

// Connection statuses.
const (
	ConnNone       = "none"
	ConnValidating = "validating"
	ConnConnected  = "connected"
)

// Scope levels for Azure role assignments, from broad to narrow.
const (
	ScopeManagementGroup = "management-group"
	ScopeSubscription    = "subscription"
	ScopeResourceGroup   = "resource-group"
	ScopeResource        = "resource"
	ScopeNone            = "none"
)

// Scope is where an identity's roles are assigned.
type Scope struct {
	Level  string `json:"level"`
	Target string `json:"target"` // subscription id, resource group name, or resource id
}

// Covers reports whether the scope includes the resource.
func (sc Scope) Covers(r *Cell) bool {
	switch sc.Level {
	case ScopeManagementGroup, ScopeSubscription:
		return true
	case ScopeResourceGroup:
		return r.ResourceGroup != "" && r.ResourceGroup == sc.Target
	case ScopeResource:
		return r.ID == sc.Target
	}
	return false
}

// RoleAssignment is one role an identity holds at a scope, as validated.
type RoleAssignment struct {
	Identity string `json:"identity"` // read, write
	Role     string `json:"role"`
	Scope    Scope  `json:"scope"`
}

// Connection is an identity, a credential, a scope and a network path into one
// provider. A tenant may hold several per provider with different scopes.
type Connection struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Provider string `json:"provider"`
	Status   string `json:"status"`
	// Azure
	Directory      string `json:"directory,omitempty"`      // Entra tenant id
	AuthMode       string `json:"authMode,omitempty"`       // consent, byo
	ClientID       string `json:"clientId,omitempty"`       // byo only
	CredentialKind string `json:"credentialKind,omitempty"` // federated, certificate
	ReadScope      Scope  `json:"readScope"`
	WriteScope     Scope  `json:"writeScope"`
	// UpCloud
	SubAccount string   `json:"subAccount,omitempty"`
	Grants     []string `json:"grants,omitempty"`
	// Validation result
	Catalogue    []Candidate      `json:"catalogue"`
	Identity     string           `json:"identity,omitempty"`
	Roles        []RoleAssignment `json:"roles,omitempty"`
	ValidatedAt  *time.Time       `json:"validatedAt,omitempty"`
	Capabilities []Capability     `json:"capabilities,omitempty"`
	Error        string           `json:"error,omitempty"`
}

// AccessTo returns what the connection can do on a cell: "", "read" or "write".
func (c *Connection) AccessTo(r *Cell) string {
	if c.Provider != r.Provider {
		return ""
	}
	if c.CanWrite(r) {
		return "write"
	}
	if c.Provider == "upcloud" {
		for _, g := range c.Grants {
			if g == "server.read" || g == "database.read" {
				return "read"
			}
		}
		return ""
	}
	if c.ReadScope.Covers(r) {
		return "read"
	}
	return ""
}

// Candidate returns the catalogue entry with the id, or nil.
func (c *Connection) Candidate(id string) *Candidate {
	for i := range c.Catalogue {
		if c.Catalogue[i].ID == id {
			return &c.Catalogue[i]
		}
	}
	return nil
}

// CanWrite reports whether the connection's write identity covers the resource.
func (c *Connection) CanWrite(r *Cell) bool {
	if c.Status != ConnConnected || c.Provider != r.Provider {
		return false
	}
	if c.Provider == "upcloud" {
		for _, g := range c.Grants {
			if g == "server.power" {
				return true
			}
		}
		return false
	}
	return c.WriteScope.Level != ScopeNone && c.WriteScope.Level != "" && c.WriteScope.Covers(r)
}

// Probe statuses.
const (
	ProbeNone    = "none"
	ProbeWaiting = "waiting"
	ProbeOnline  = "online"
)

// Probe tracks the OpenTelemetry Collectors dialling into the cell.
type Probe struct {
	Status   string   `json:"status"`
	Hosts    []string `json:"hosts"`
	Expected []string `json:"expected"`
}

// Cell tiers and channel states.
const (
	TierBasic = "basic" // provider metrics and provider actions through the API
	TierAgent = "agent" // the probe is installed: in-guest metrics, logs, files, commands

	ChannelConnected = "connected"
	ChannelWaiting   = "waiting"
	ChannelOnline    = "online"
	ChannelOffline   = "offline"
)

// Cell is the most specific thing Beacon manages: one VM, one cluster, one
// server. It has its own isolated channel in the tenant runtime, came through
// one connection, and carries the labels that apps and runbooks select on.
type Cell struct {
	ID            string            `json:"id"`
	Kind          string            `json:"kind"`
	Detail        string            `json:"detail"`
	Provider      string            `json:"provider"`
	ResourceGroup string            `json:"resourceGroup,omitempty"`
	ConnectionID  string            `json:"connectionId,omitempty"`
	Tier          string            `json:"tier"`
	Channel       string            `json:"channel"`
	AgentCapable  bool              `json:"agentCapable"`
	Labels        map[string]string `json:"labels"`
	OnboardedAt   time.Time         `json:"onboardedAt"`
}

// Candidate is one thing discovered through a connection that could become a cell.
type Candidate struct {
	ID            string            `json:"id"`
	Kind          string            `json:"kind"`
	Detail        string            `json:"detail"`
	ResourceGroup string            `json:"resourceGroup,omitempty"`
	Supported     bool              `json:"supported"`
	AgentCapable  bool              `json:"agentCapable"`
	Access        string            `json:"access"` // read, write
	Labels        map[string]string `json:"labels"`
}

// App groups cells by a label selector and decides who is paged. It can be a
// real application, a gateway, or one machine that stands alone.
type App struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Selector    map[string]string `json:"selector"`
	Criticality string            `json:"criticality"`
	Owner       string            `json:"owner"`
	SLO         string            `json:"slo"`
}

// Matches reports whether every selector pair is present on the resource.
func (a *App) Matches(r *Cell) bool { return selectorMatches(a.Selector, r) }

func selectorMatches(sel map[string]string, r *Cell) bool {
	if len(sel) == 0 {
		return false
	}
	for k, v := range sel {
		if r.Labels[k] != v {
			return false
		}
	}
	return true
}

// Runbook is tenant-written guidance attached to a label selector. Agents
// read the runbooks that match the resource they work on and cite them. A
// runbook guides; the responder policy still decides what may run.
type Runbook struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Selector  map[string]string `json:"selector"`
	Body      string            `json:"body"`
	UpdatedAt time.Time         `json:"updatedAt"`
	UpdatedBy string            `json:"updatedBy,omitempty"`
}

// Matches reports whether the runbook applies to the resource.
func (rb *Runbook) Matches(r *Cell) bool { return selectorMatches(rb.Selector, r) }

// Tool policies.
const (
	PolicyAllow = "allow"
	PolicyAsk   = "ask"
	PolicyDeny  = "deny"
)

// ToolPolicy is the policy for one action inside a responder.
type ToolPolicy struct {
	Tool   string `json:"tool"`
	Policy string `json:"policy"`
}

// Responder binds a signal to the agent that handles it and the policy on each action.
type Responder struct {
	ID     string       `json:"id"`
	Signal string       `json:"signal"`
	Scope  string       `json:"scope"`
	Mode   string       `json:"mode"` // Review, Autonomous
	Level  string       `json:"level"`
	Agent  string       `json:"agent"`
	Tools  []ToolPolicy `json:"tools"`
}

// Agent kinds.
const (
	AgentOrchestrator  = "orchestrator"
	AgentSpecialist    = "specialist"
	AgentDeterministic = "deterministic"
)

// AgentDef is a managed agent in the tenant: the orchestrator the human talks
// to, the specialists it starts, and the deterministic workers that need no model.
type AgentDef struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Kind         string   `json:"kind"`
	Role         string   `json:"role"`
	Description  string   `json:"description"`
	Model        string   `json:"model,omitempty"`
	Effort       string   `json:"effort,omitempty"`
	Tools        []string `json:"tools"`
	Enabled      bool     `json:"enabled"`
	MaxToolCalls int      `json:"maxToolCalls,omitempty"`
}

// Usage is model consumption for one run or one agent.
type Usage struct {
	Calls        int     `json:"calls"`
	InputTokens  int     `json:"inputTokens"`
	OutputTokens int     `json:"outputTokens"`
	CostUSD      float64 `json:"costUsd"`
	Runs         int     `json:"runs"`
}

// Add folds another usage into this one.
func (u *Usage) Add(o Usage) {
	u.Calls += o.Calls
	u.InputTokens += o.InputTokens
	u.OutputTokens += o.OutputTokens
	u.CostUSD += o.CostUSD
	u.Runs += o.Runs
}

// Finding statuses.
const (
	FindingOpen             = "open"
	FindingInvestigating    = "investigating"
	FindingAwaitingApproval = "awaiting-approval"
	FindingExecuting        = "executing"
	FindingVerifying        = "verifying"
	FindingResolved         = "resolved"
	FindingEscalated        = "escalated"
)

// Finding is something Beacon believes is wrong and can point at.
type Finding struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Service     string    `json:"service"`
	Resource    string    `json:"resource"`
	Severity    string    `json:"severity"` // critical, warning, info, ok
	Status      string    `json:"status"`
	RunID       string    `json:"runId"`
	ResponderID string    `json:"responderId,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}

// Message roles inside a run thread.
const (
	RoleSignal       = "signal"
	RoleOrchestrator = "orchestrator"
	RoleAgent        = "agent"
	RoleTool         = "tool"
	RoleEvidence     = "evidence"
	RoleHypotheses   = "hypotheses"
	RoleVerifier     = "verifier"
	RolePolicy       = "policy"
	RoleUser         = "user"
	RoleExecutor     = "executor"
	RoleVerification = "verification"
	RoleError        = "error"
)

// ToolCall is one tool invocation shown inline in a thread.
type ToolCall struct {
	Name   string         `json:"name"`
	Input  map[string]any `json:"input"`
	Output string         `json:"output,omitempty"`
	Status string         `json:"status"` // running, done, denied, error
}

// Message is one entry in a run thread.
type Message struct {
	ID    string    `json:"id"`
	Role  string    `json:"role"`
	Agent string    `json:"agent,omitempty"`
	Title string    `json:"title,omitempty"`
	Text  string    `json:"text,omitempty"`
	Tool  *ToolCall `json:"tool,omitempty"`
	At    time.Time `json:"at"`
}

// Evidence is a claim with a source pointer.
type Evidence struct {
	Kind    string `json:"kind"`
	Claim   string `json:"claim"`
	Pointer string `json:"pointer"`
}

// Hypothesis is a candidate cause and its verdict.
type Hypothesis struct {
	Title   string `json:"title"`
	Detail  string `json:"detail"`
	Verdict string `json:"verdict"` // supported, rejected
}

// ChainStep is one link in the causal chain.
type ChainStep struct {
	Time     string `json:"time"`
	Text     string `json:"text"`
	Severity string `json:"severity,omitempty"`
}

// QA is a question asked about a run and its answer.
type QA struct {
	Question string    `json:"question"`
	Answer   string    `json:"answer"`
	At       time.Time `json:"at"`
}

// Run statuses.
const (
	RunRunning   = "running"
	RunWaiting   = "waiting"
	RunExecuting = "executing"
	RunVerifying = "verifying"
	RunDone      = "done"
	RunFailed    = "failed"
)

// Run is one agent working one task, usually an investigation of a finding.
type Run struct {
	ID            string       `json:"id"`
	Agent         string       `json:"agent"`
	Trigger       string       `json:"trigger"` // signal, user
	Task          string       `json:"task"`
	FindingID     string       `json:"findingId,omitempty"`
	ResponderID   string       `json:"responderId,omitempty"`
	Status        string       `json:"status"`
	Outcome       string       `json:"outcome"`
	StartedAt     time.Time    `json:"startedAt"`
	EndedAt       *time.Time   `json:"endedAt,omitempty"`
	Usage         Usage        `json:"usage"`
	Messages      []*Message   `json:"messages"`
	Evidence      []Evidence   `json:"evidence"`
	Hypotheses    []Hypothesis `json:"hypotheses"`
	Chain         []ChainStep  `json:"chain"`
	ApprovalID    string       `json:"approvalId,omitempty"`
	Runbooks      []string     `json:"runbooks"`
	Questions     []QA         `json:"questions"`
	Summary       string       `json:"summary,omitempty"`
	CauseVerified bool         `json:"causeVerified"`
}

// Approval statuses.
const (
	ApprovalPending  = "pending"
	ApprovalApproved = "approved"
	ApprovalDenied   = "denied"
)

// Approval is a proposed action waiting for a human.
type Approval struct {
	ID          string         `json:"id"`
	RunID       string         `json:"runId"`
	FindingID   string         `json:"findingId"`
	Task        string         `json:"task"`
	Level       string         `json:"level"`
	Action      string         `json:"action"`
	Args        map[string]any `json:"args"`
	Command     string         `json:"command"`
	BlastRadius string         `json:"blastRadius"`
	Status      string         `json:"status"`
	RequestedAt time.Time      `json:"requestedAt"`
	DecidedAt   *time.Time     `json:"decidedAt,omitempty"`
	DecidedBy   string         `json:"decidedBy,omitempty"`
}

// Activity is one line in the activity panel.
type Activity struct {
	Kind  string    `json:"kind"`
	Text  string    `json:"text"`
	RunID string    `json:"runId,omitempty"`
	Task  bool      `json:"task"`
	At    time.Time `json:"at"`
}

// ChatMessage is one turn in the tenant conversation with the orchestrator.
type ChatMessage struct {
	ID   string    `json:"id"`
	Role string    `json:"role"` // user, orchestrator, tool
	Text string    `json:"text,omitempty"`
	Tool *ToolCall `json:"tool,omitempty"`
	At   time.Time `json:"at"`
}

// Scenario is a fault the demo can inject into the simulated world.
type Scenario struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Resource    string `json:"resource"`
	Status      string `json:"status"` // idle, running, done
}

// State is everything the console shows for one tenant.
type State struct {
	User        *User             `json:"user"`
	Tenant      *Tenant           `json:"tenant"`
	Connections []*Connection     `json:"connections"`
	Probe       Probe             `json:"probe"`
	Cells       []*Cell           `json:"cells"`
	Apps        []*App            `json:"apps"`
	Runbooks    []*Runbook        `json:"runbooks"`
	Responders  []*Responder      `json:"responders"`
	Agents      []*AgentDef       `json:"agents"`
	Findings    []*Finding        `json:"findings"`
	Runs        []*Run            `json:"runs"`
	Approvals   []*Approval       `json:"approvals"`
	Activity    []Activity        `json:"activity"`
	Chat        []*ChatMessage    `json:"chat"`
	Scenarios   []*Scenario       `json:"scenarios"`
	Usage       map[string]*Usage `json:"usage"`    // by agent id
	Reasoner    string            `json:"reasoner"` // claude or scripted
	Model       string            `json:"model"`
}

// Run returns the run with the id, or nil.
func (s *State) Run(id string) *Run {
	for _, r := range s.Runs {
		if r.ID == id {
			return r
		}
	}
	return nil
}

// Finding returns the finding with the id, or nil.
func (s *State) Finding(id string) *Finding {
	for _, f := range s.Findings {
		if f.ID == id {
			return f
		}
	}
	return nil
}

// Approval returns the approval with the id, or nil.
func (s *State) Approval(id string) *Approval {
	for _, a := range s.Approvals {
		if a.ID == id {
			return a
		}
	}
	return nil
}

// Responder returns the responder with the id, or nil.
func (s *State) Responder(id string) *Responder {
	for _, r := range s.Responders {
		if r.ID == id {
			return r
		}
	}
	return nil
}

// Agent returns the agent definition with the id, or nil.
func (s *State) Agent(id string) *AgentDef {
	for _, a := range s.Agents {
		if a.ID == id {
			return a
		}
	}
	return nil
}

// Scenario returns the scenario with the id, or nil.
func (s *State) Scenario(id string) *Scenario {
	for _, sc := range s.Scenarios {
		if sc.ID == id {
			return sc
		}
	}
	return nil
}

// OpenFinding returns an unresolved finding for a responder on a resource, or nil.
func (s *State) OpenFinding(responderID, resource string) *Finding {
	for _, f := range s.Findings {
		if f.ResponderID == responderID && f.Resource == resource && f.Status != FindingResolved && f.Status != FindingEscalated {
			return f
		}
	}
	return nil
}

// Cell returns the cell with the id, or nil.
func (s *State) Cell(id string) *Cell {
	for _, c := range s.Cells {
		if c.ID == id {
			return c
		}
	}
	return nil
}

// AppOf returns the most specific app whose selector matches the cell, or nil.
func (s *State) AppOf(r *Cell) *App {
	var best *App
	for _, a := range s.Apps {
		if a.Matches(r) && (best == nil || len(a.Selector) > len(best.Selector)) {
			best = a
		}
	}
	return best
}

// AppName returns the app name for a cell id, or "Unassigned".
func (s *State) AppName(cellID string) string {
	if r := s.Cell(cellID); r != nil {
		if a := s.AppOf(r); a != nil {
			return a.Name
		}
	}
	return "Unassigned"
}

// App returns the app with the id, or nil.
func (s *State) App(id string) *App {
	for _, a := range s.Apps {
		if a.ID == id {
			return a
		}
	}
	return nil
}

// Connection returns the connection with the id, or nil.
func (s *State) Connection(id string) *Connection {
	for _, c := range s.Connections {
		if c.ID == id {
			return c
		}
	}
	return nil
}

// ConnectedProviders counts providers with at least one connected connection.
func (s *State) ConnectedProviders() map[string]bool {
	out := map[string]bool{}
	for _, c := range s.Connections {
		if c.Status == ConnConnected {
			out[c.Provider] = true
		}
	}
	return out
}

// WriteConnection returns a connection whose write identity covers the cell, or nil.
func (s *State) WriteConnection(r *Cell) *Connection {
	for _, c := range s.Connections {
		if c.CanWrite(r) {
			return c
		}
	}
	return nil
}

// RunbooksFor returns the runbooks matching a cell, most specific first.
func (s *State) RunbooksFor(cellID string) []*Runbook {
	r := s.Cell(cellID)
	if r == nil {
		return nil
	}
	var out []*Runbook
	for _, rb := range s.Runbooks {
		if rb.Matches(r) {
			out = append(out, rb)
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return len(out[i].Selector) > len(out[j].Selector) })
	return out
}

// Runbook returns the runbook with the id, or nil.
func (s *State) Runbook(id string) *Runbook {
	for _, rb := range s.Runbooks {
		if rb.ID == id {
			return rb
		}
	}
	return nil
}

// SharedIdentity counts other cells that reach the provider through the same connection.
func (s *State) SharedIdentity(cell *Cell) int {
	n := 0
	for _, c := range s.Cells {
		if c.ID != cell.ID && c.ConnectionID == cell.ConnectionID {
			n++
		}
	}
	return n
}
