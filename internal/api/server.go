// Package api is the HTTP surface: a JSON API for actions, one server-sent
// event stream for everything that changes, and the embedded console.
package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/asitha-w/beacon/internal/agent"
	"github.com/asitha-w/beacon/internal/domain"
	"github.com/asitha-w/beacon/internal/scenario"
	"github.com/asitha-w/beacon/internal/store"
	"github.com/asitha-w/beacon/internal/world"
)

// Server holds the handlers' dependencies.
type Server struct {
	st    *store.Store
	w     *world.World
	orch  *agent.Orchestrator
	log   *slog.Logger
	web   fs.FS
	reset func()
}

// New builds the server. reset rebuilds the tenant from scratch.
func New(st *store.Store, w *world.World, orch *agent.Orchestrator, web fs.FS, reset func(), log *slog.Logger) *Server {
	return &Server{st: st, w: w, orch: orch, log: log, web: web, reset: reset}
}

// Handler returns the routed handler.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/state", s.state)
	mux.HandleFunc("GET /api/events", s.events)
	mux.HandleFunc("POST /api/login", s.login)
	mux.HandleFunc("POST /api/logout", s.logout)
	mux.HandleFunc("POST /api/tenant", s.tenant)
	mux.HandleFunc("POST /api/connections", s.createConnection)
	mux.HandleFunc("DELETE /api/connections/{id}", s.deleteConnection)
	mux.HandleFunc("POST /api/connections/{id}/onboard", s.onboard)
	mux.HandleFunc("DELETE /api/cells/{id}", s.detachCell)
	mux.HandleFunc("POST /api/cells/{id}/telemetry", s.setTelemetry)
	mux.HandleFunc("POST /api/cells/{id}/labels", s.setLabels)
	mux.HandleFunc("POST /api/runbooks", s.saveRunbook)
	mux.HandleFunc("DELETE /api/runbooks/{id}", s.deleteRunbook)
	mux.HandleFunc("POST /api/probe/install", s.installProbe)
	mux.HandleFunc("POST /api/approvals/{id}", s.decide)
	mux.HandleFunc("POST /api/chat", s.chat)
	mux.HandleFunc("POST /api/runs/{id}/ask", s.ask)
	mux.HandleFunc("POST /api/responders/{id}", s.responder)
	mux.HandleFunc("POST /api/agents/{id}", s.agentUpdate)
	mux.HandleFunc("POST /api/scenarios/{id}/start", s.startScenario)
	mux.HandleFunc("POST /api/reset", s.doReset)
	mux.Handle("/", http.FileServerFS(s.web))
	return logRequests(mux, s.log)
}

func logRequests(h http.Handler, log *slog.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") && r.URL.Path != "/api/events" {
			log.Info("api", "method", r.Method, "path", r.URL.Path)
		} else {
			// the console is small and changes often; make the browser revalidate
			w.Header().Set("Cache-Control", "no-cache")
		}
		h.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, err error) {
	writeJSON(w, code, map[string]string{"error": err.Error()})
}

func readJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<16))
	if err := dec.Decode(v); err != nil && !errors.Is(err, errEOF) {
		return err
	}
	return nil
}

var errEOF = errors.New("EOF")

func (s *Server) state(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(s.st.Snapshot())
}

// events streams the snapshot and then every change as server-sent events.
func (s *Server) events(w http.ResponseWriter, r *http.Request) {
	fl, ok := w.(http.Flusher)
	if !ok {
		writeErr(w, http.StatusInternalServerError, errors.New("streaming unsupported"))
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	ch, cancel := s.st.Subscribe()
	defer cancel()
	snap, _ := json.Marshal(store.Event{Type: "snapshot", Data: json.RawMessage(s.st.Snapshot())})
	fmt.Fprintf(w, "data: %s\n\n", snap)
	fl.Flush()
	ping := time.NewTicker(20 * time.Second)
	defer ping.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-ping.C:
			fmt.Fprint(w, ": ping\n\n")
			fl.Flush()
		case b := <-ch:
			fmt.Fprintf(w, "data: %s\n\n", b)
			fl.Flush()
		}
	}
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var in struct{ Email, Name string }
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, err)
		return
	}
	if in.Email == "" {
		in.Email = "asitha@company.example"
	}
	if in.Name == "" {
		in.Name = strings.SplitN(in.Email, "@", 2)[0]
	}
	s.st.Update(func(st *domain.State) []store.Event {
		st.User = &domain.User{Name: in.Name, Email: in.Email, Role: "Administrator"}
		return []store.Event{{Type: "user", Data: st.User}}
	})
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) logout(w http.ResponseWriter, _ *http.Request) {
	s.st.Update(func(st *domain.State) []store.Event {
		st.User = nil
		return []store.Event{{Type: "user", Data: nil}}
	})
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) tenant(w http.ResponseWriter, r *http.Request) {
	var in struct{ Name, Env, Region string }
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, err)
		return
	}
	if in.Name == "" {
		in.Name = "Shop AS"
	}
	s.st.Update(func(st *domain.State) []store.Event {
		t := &domain.Tenant{ID: fmt.Sprintf("t-%04x", rand.Intn(0xffff)), Name: in.Name, Env: in.Env, Region: in.Region, Runtime: fmt.Sprintf("rt-%04x", rand.Intn(0xffff)), EgressIP: fmt.Sprintf("94.237.%d.%d", 20+rand.Intn(200), 10+rand.Intn(200)), CreatedAt: time.Now()}
		st.Tenant = t
		return []store.Event{{Type: "tenant", Data: t}, store.Activity(st, "run", fmt.Sprintf("Tenant %s created. Runtime %s provisioned with static egress %s.", t.Name, t.Runtime, t.EgressIP), "", false)}
	})
	writeJSON(w, 200, map[string]any{"ok": true})
}

// createConnection records a connection and validates it in the background.
func (s *Server) createConnection(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Provider, Name, Directory, AuthMode, ClientID, CredentialKind string
		ReadScope, WriteScope                                         domain.Scope
		SubAccount, Token                                             string
		Grants                                                        []string
	}
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, err)
		return
	}
	if in.Provider != "azure" && in.Provider != "upcloud" {
		writeErr(w, 400, errors.New("provider must be azure or upcloud"))
		return
	}
	if in.Provider == "azure" && in.Directory == "" {
		writeErr(w, 400, errors.New("the Entra directory (tenant id) is required"))
		return
	}
	if in.Provider == "azure" && in.ReadScope.Target == "" {
		writeErr(w, 400, errors.New("a read scope is required"))
		return
	}
	var c *domain.Connection
	s.st.Update(func(st *domain.State) []store.Event {
		c = &domain.Connection{ID: s.st.NextID("conn", 0), Provider: in.Provider, Name: in.Name, Status: domain.ConnValidating,
			Directory: in.Directory, AuthMode: in.AuthMode, ClientID: in.ClientID, CredentialKind: in.CredentialKind, ReadScope: in.ReadScope, WriteScope: in.WriteScope,
			SubAccount: in.SubAccount, Grants: in.Grants}
		if c.Name == "" {
			if in.Provider == "azure" {
				c.Name = "Azure · " + c.ReadScope.Level + " " + c.ReadScope.Target
			} else {
				c.Name = "UpCloud · " + c.SubAccount
			}
		}
		if c.AuthMode == "" {
			c.AuthMode = "consent"
		}
		if c.CredentialKind == "" {
			c.CredentialKind = "federated"
		}
		if c.WriteScope.Level == "" {
			c.WriteScope.Level = domain.ScopeNone
		}
		st.Connections = append(st.Connections, c)
		return []store.Event{{Type: "connection", Data: c}}
	})
	id := c.ID
	go func() {
		time.Sleep(1800 * time.Millisecond)
		s.st.Update(func(st *domain.State) []store.Event {
			c := st.Connection(id)
			if c == nil {
				return nil
			}
			now := time.Now()
			c.Status = domain.ConnConnected
			c.ValidatedAt = &now
			var text string
			n := 0
			if c.Provider == "azure" {
				domain.ValidateAzure(c)
			} else {
				domain.ValidateUpCloud(c)
			}
			domain.Discover(c)
			for _, cand := range c.Catalogue {
				if cand.Supported {
					n++
				}
			}
			text = fmt.Sprintf("%s connected. Discovery found %d things in scope, %d of them manageable.", c.Name, len(c.Catalogue), n)
			return []store.Event{{Type: "connection", Data: c}, store.Activity(st, "run", text, "", false)}
		})
	}()
	writeJSON(w, 202, map[string]any{"ok": true, "id": id})
}

func (s *Server) deleteConnection(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var found bool
	s.st.Update(func(st *domain.State) []store.Event {
		for i, c := range st.Connections {
			if c.ID == id {
				found = true
				st.Connections = append(st.Connections[:i], st.Connections[i+1:]...)
				kept := st.Cells[:0]
				for _, cell := range st.Cells {
					if cell.ConnectionID != id {
						kept = append(kept, cell)
					}
				}
				st.Cells = kept
				syncProbe(st)
				return []store.Event{{Type: "connections", Data: st.Connections}, {Type: "cells", Data: st.Cells}, {Type: "probe", Data: st.Probe}, store.Activity(st, "run", "Connection "+c.Name+" removed with its cells.", "", false)}
			}
		}
		return nil
	})
	if !found {
		writeErr(w, 404, errors.New("no such connection"))
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

// syncProbe recomputes which cells the agent is expected on.
func syncProbe(st *domain.State) {
	st.Probe.Expected = st.Probe.Expected[:0]
	for _, c := range st.Cells {
		if c.ProbeCapable {
			st.Probe.Expected = append(st.Probe.Expected, c.ID)
		}
	}
	if len(st.Probe.Expected) == 0 {
		st.Probe.Status = domain.ProbeNone
		st.Probe.Hosts = st.Probe.Hosts[:0]
	}
}

// onboard turns catalogue entries of a connection into cells.
func (s *Server) onboard(w http.ResponseWriter, r *http.Request) {
	var in struct{ IDs []string }
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, err)
		return
	}
	by := s.userName()
	var errOut error
	var added []string
	s.st.Update(func(st *domain.State) []store.Event {
		c := st.Connection(r.PathValue("id"))
		if c == nil || c.Status != domain.ConnConnected {
			errOut = errors.New("connection not found or not validated")
			return nil
		}
		for _, id := range in.IDs {
			cand := c.Candidate(id)
			if cand == nil || !cand.Supported || st.Cell(id) != nil {
				continue
			}
			st.Cells = append(st.Cells, domain.NewCell(c, cand))
			added = append(added, id)
		}
		if len(added) == 0 {
			errOut = errors.New("nothing to onboard: pick supported entries that are not cells yet")
			return nil
		}
		syncProbe(st)
		return []store.Event{{Type: "cells", Data: st.Cells}, {Type: "probe", Data: st.Probe}, store.Activity(st, "run", fmt.Sprintf("%s onboarded %s as cells through %s. Basic tier: provider metrics and actions.", by, strings.Join(added, ", "), c.Name), "", false), store.Toast(fmt.Sprintf("%d cell(s) onboarded", len(added)))}
	})
	if errOut != nil {
		writeErr(w, 409, errOut)
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "cells": added})
}

// detachCell removes a cell from management. Its findings and runs stay as history.
func (s *Server) detachCell(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	by := s.userName()
	var found bool
	s.st.Update(func(st *domain.State) []store.Event {
		for i, c := range st.Cells {
			if c.ID == id {
				found = true
				st.Cells = append(st.Cells[:i], st.Cells[i+1:]...)
				break
			}
		}
		if !found {
			return nil
		}
		kept := st.Probe.Hosts[:0]
		for _, h := range st.Probe.Hosts {
			if h != id {
				kept = append(kept, h)
			}
		}
		st.Probe.Hosts = kept
		syncProbe(st)
		if st.Probe.Status != domain.ProbeNone && len(st.Probe.Hosts) < len(st.Probe.Expected) {
			st.Probe.Status = domain.ProbeWaiting
		}
		return []store.Event{{Type: "cells", Data: st.Cells}, {Type: "probe", Data: st.Probe}, store.Activity(st, "run", fmt.Sprintf("%s detached cell %s.", by, id), "", false)}
	})
	if !found {
		writeErr(w, 404, errors.New("no such cell"))
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

// setTelemetry replaces the probe configuration of a cell.
func (s *Server) setTelemetry(w http.ResponseWriter, r *http.Request) {
	var in domain.Telemetry
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, err)
		return
	}
	by := s.userName()
	var found bool
	s.st.Update(func(st *domain.State) []store.Event {
		c := st.Cell(r.PathValue("id"))
		if c == nil {
			return nil
		}
		found = true
		c.Telemetry = in
		return []store.Event{{Type: "cells", Data: st.Cells}, store.Activity(st, "run", fmt.Sprintf("%s changed the probe telemetry on %s. Config pushed over OpAMP.", by, c.ID), "", false)}
	})
	if !found {
		writeErr(w, 404, errors.New("no such cell"))
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

// saveRunbook creates or updates a runbook by id.
func (s *Server) saveRunbook(w http.ResponseWriter, r *http.Request) {
	var in domain.Runbook
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, err)
		return
	}
	if strings.TrimSpace(in.Name) == "" || len(in.Selector) == 0 || strings.TrimSpace(in.Body) == "" {
		writeErr(w, 400, errors.New("name, a selector and a body are required"))
		return
	}
	by := s.userName()
	s.st.Update(func(st *domain.State) []store.Event {
		if in.ID == "" {
			in.ID = strings.ToLower(strings.ReplaceAll(strings.TrimSpace(in.Name), " ", "-"))
		}
		in.UpdatedAt = time.Now()
		in.UpdatedBy = by
		if rb := st.Runbook(in.ID); rb != nil {
			*rb = in
		} else {
			cp := in
			st.Runbooks = append(st.Runbooks, &cp)
		}
		return []store.Event{{Type: "runbooks", Data: st.Runbooks}, store.Activity(st, "run", fmt.Sprintf("%s saved runbook %s.", by, in.Name), "", false)}
	})
	writeJSON(w, 200, map[string]any{"ok": true, "id": in.ID})
}

func (s *Server) deleteRunbook(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	s.st.Update(func(st *domain.State) []store.Event {
		for i, rb := range st.Runbooks {
			if rb.ID == id {
				st.Runbooks = append(st.Runbooks[:i], st.Runbooks[i+1:]...)
				break
			}
		}
		return []store.Event{{Type: "runbooks", Data: st.Runbooks}}
	})
	writeJSON(w, 200, map[string]any{"ok": true})
}

// setLabels replaces the labels on a cell.
func (s *Server) setLabels(w http.ResponseWriter, r *http.Request) {
	var in struct{ Labels map[string]string }
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, err)
		return
	}
	var found bool
	by := s.userName()
	s.st.Update(func(st *domain.State) []store.Event {
		res := st.Cell(r.PathValue("id"))
		if res == nil {
			return nil
		}
		found = true
		res.Labels = in.Labels
		if res.Labels == nil {
			res.Labels = map[string]string{}
		}
		for _, f := range st.Findings {
			f.Service = st.GroupName(f.Resource)
		}
		return []store.Event{{Type: "cells", Data: st.Cells}, store.Activity(st, "run", fmt.Sprintf("%s relabelled %s.", by, res.ID), "", false)}
	})
	if !found {
		writeErr(w, 404, errors.New("no such cell"))
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) installProbe(w http.ResponseWriter, _ *http.Request) {
	var ready bool
	s.st.Update(func(st *domain.State) []store.Event {
		syncProbe(st)
		if len(st.Probe.Expected) == 0 {
			return nil
		}
		ready = true
		st.Probe.Status = domain.ProbeWaiting
		for _, c := range st.Cells {
			if c.ProbeCapable && c.Tier != domain.TierProbe {
				c.Channel = domain.ChannelWaiting
			}
		}
		return []store.Event{{Type: "probe", Data: st.Probe}, {Type: "cells", Data: st.Cells}}
	})
	if !ready {
		writeErr(w, 409, errors.New("onboard at least one probe-capable cell first"))
		return
	}
	go func() {
		var hosts []string
		s.st.View(func(st *domain.State) {
			for _, h := range st.Probe.Expected {
				found := false
				for _, on := range st.Probe.Hosts {
					if on == h {
						found = true
					}
				}
				if !found {
					hosts = append(hosts, h)
				}
			}
		})
		for i, h := range hosts {
			time.Sleep(time.Duration(1500+i*400) * time.Millisecond)
			s.st.Update(func(st *domain.State) []store.Event {
				if st.Probe.Status == domain.ProbeNone {
					return nil
				}
				st.Probe.Hosts = append(st.Probe.Hosts, h)
				if len(st.Probe.Hosts) == len(st.Probe.Expected) {
					st.Probe.Status = domain.ProbeOnline
				}
				if c := st.Cell(h); c != nil {
					c.Tier = domain.TierProbe
					c.Channel = domain.ChannelOnline
				}
				return []store.Event{{Type: "probe", Data: st.Probe}, {Type: "cells", Data: st.Cells}, store.Activity(st, "signal", "Probe on "+h+" dialled in over OpAMP. Cell raised to the probe tier.", "", false), store.Toast("Probe online: " + h)}
			})
		}
	}()
	writeJSON(w, 202, map[string]any{"ok": true})
}

func (s *Server) decide(w http.ResponseWriter, r *http.Request) {
	var in struct{ Decision string }
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, err)
		return
	}
	by := s.userName()
	if err := s.orch.Decide(r.PathValue("id"), in.Decision == "approve", by); err != nil {
		writeErr(w, 409, err)
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) userName() string {
	by := "operator"
	s.st.View(func(st *domain.State) {
		if st.User != nil {
			by = st.User.Name
		}
	})
	return by
}

func (s *Server) chat(w http.ResponseWriter, r *http.Request) {
	var in struct{ Question string }
	if err := readJSON(r, &in); err != nil || strings.TrimSpace(in.Question) == "" {
		writeErr(w, 400, errors.New("question required"))
		return
	}
	by := s.userName()
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
		defer cancel()
		if err := s.orch.Chat(ctx, in.Question, by); err != nil {
			s.log.Warn("chat", "err", err)
		}
	}()
	writeJSON(w, 202, map[string]any{"ok": true})
}

func (s *Server) ask(w http.ResponseWriter, r *http.Request) {
	var in struct{ Question string }
	if err := readJSON(r, &in); err != nil || strings.TrimSpace(in.Question) == "" {
		writeErr(w, 400, errors.New("question required"))
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Minute)
	defer cancel()
	answer, err := s.orch.Ask(ctx, r.PathValue("id"), in.Question)
	if err != nil {
		writeErr(w, 500, err)
		return
	}
	writeJSON(w, 200, map[string]any{"answer": answer})
}

func (s *Server) responder(w http.ResponseWriter, r *http.Request) {
	var in struct{ Mode string }
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, err)
		return
	}
	if in.Mode != "Review" && in.Mode != "Autonomous" {
		writeErr(w, 400, errors.New("mode must be Review or Autonomous"))
		return
	}
	var found bool
	by := s.userName()
	s.st.Update(func(st *domain.State) []store.Event {
		rp := st.Responder(r.PathValue("id"))
		if rp == nil {
			return nil
		}
		found = true
		rp.Mode = in.Mode
		return []store.Event{{Type: "responder", Data: rp}, store.Activity(st, "policy", fmt.Sprintf("%s set %s to %s.", by, rp.ID, in.Mode), "", false)}
	})
	if !found {
		writeErr(w, 404, errors.New("no such responder"))
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) agentUpdate(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Enabled *bool
		Effort  *string
	}
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, err)
		return
	}
	var found bool
	by := s.userName()
	s.st.Update(func(st *domain.State) []store.Event {
		a := st.Agent(r.PathValue("id"))
		if a == nil {
			return nil
		}
		found = true
		if in.Enabled != nil && a.Kind != domain.AgentOrchestrator {
			a.Enabled = *in.Enabled
		}
		if in.Effort != nil && a.Model != "" {
			switch *in.Effort {
			case "low", "medium", "high", "xhigh", "max":
				a.Effort = *in.Effort
			}
		}
		return []store.Event{{Type: "agent", Data: a}, store.Activity(st, "policy", fmt.Sprintf("%s updated agent %s: enabled=%v effort=%s.", by, a.ID, a.Enabled, a.Effort), "", false)}
	})
	if !found {
		writeErr(w, 404, errors.New("no such agent"))
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) startScenario(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	def, ok := scenario.Catalog()[id]
	if !ok {
		writeErr(w, 404, errors.New("no such scenario"))
		return
	}
	var errOut error
	s.st.Update(func(st *domain.State) []store.Event {
		sc := st.Scenario(id)
		cell := st.Cell(sc.Resource)
		if cell == nil {
			errOut = fmt.Errorf("onboard %s as a cell first", sc.Resource)
			return nil
		}
		if cell.ProbeCapable && cell.Tier != domain.TierProbe {
			errOut = fmt.Errorf("install the probe on %s first; this scenario needs in-guest signals", sc.Resource)
			return nil
		}
		for _, o := range st.Scenarios {
			if o.Status == "running" && o.Resource == sc.Resource {
				errOut = fmt.Errorf("scenario %s is already running on %s", o.ID, o.Resource)
				return nil
			}
		}
		sc.Status = "running"
		return []store.Event{store.ScenarioEvent(sc), store.Activity(st, "demo", "Fault injected: "+sc.Name+".", "", false)}
	})
	if errOut != nil {
		writeErr(w, 409, errOut)
		return
	}
	s.w.Inject(def.NewFault())
	writeJSON(w, 202, map[string]any{"ok": true})
}

func (s *Server) doReset(w http.ResponseWriter, _ *http.Request) {
	s.reset()
	writeJSON(w, 200, map[string]any{"ok": true})
}
