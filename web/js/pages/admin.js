import { el, Button, SeverityChip, StatusChip, CapabilityList } from '../ds.js';
import { store, sel } from '../store.js';
import { api } from '../api.js';
import { go } from '../router.js';
import { ago, money, tokens, duration, toast } from '../shell.js';
import { azureForm, upcloudForm, connectionCard } from '../connections.js';
import { labelChips } from './cells.js';

export function pageApprovals() {
  const rows = sel.pendingApprovals().map((a) => el('tr', { class: 'row', onClick: () => go('inv/' + a.runId) }, [el('td', { class: 'mono', text: a.id }), el('td', { text: a.task }), el('td', null, [StatusChip({ status: 'awaiting-approval' })]), el('td', { class: 'mono', text: a.level }), el('td', { class: 'mono muted', text: ago(a.requestedAt) })]));
  const past = store.state.approvals.filter((a) => a.status !== 'pending').map((a) => el('tr', { class: 'row', onClick: () => go('inv/' + a.runId) }, [el('td', { class: 'mono', text: a.id }), el('td', { text: a.task }), el('td', null, [StatusChip({ status: a.status })]), el('td', { class: 'mono', text: a.decidedBy || '' }), el('td', { class: 'mono muted', text: ago(a.decidedAt) })]));
  return el('div', { class: 'page' }, [el('h1', { class: 'display', text: 'Approvals' }), el('p', { class: 'muted', text: 'Every action waiting for a human. Only administrators can approve. Each row opens the investigation it came from.' }),
    rows.length ? el('div', { class: 'tablewrap' }, [el('table', { class: 'table' }, [el('thead', null, [el('tr', null, [el('th', { text: 'Id' }), el('th', { text: 'Task' }), el('th', { text: 'Status' }), el('th', { text: 'Level' }), el('th', { text: 'Since' })])]), el('tbody', null, rows)])]) : el('div', { class: 'empty', text: 'Nothing waiting. Beacon has not proposed any action that needs you.' }),
    past.length ? el('div', null, [el('h2', { class: 'title', text: 'Decided' }), el('div', { style: 'height:8px' }), el('div', { class: 'tablewrap' }, [el('table', { class: 'table' }, [el('thead', null, [el('tr', null, [el('th', { text: 'Id' }), el('th', { text: 'Task' }), el('th', { text: 'Decision' }), el('th', { text: 'By' }), el('th', { text: 'When' })])]), el('tbody', null, past)])])]) : null]);
}

function parseSelector(text) {
  const out = {};
  text.split(',').map((p) => p.trim()).filter(Boolean).forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  return out;
}
function selectorText(sel) { return Object.keys(sel || {}).map((k) => k + '=' + sel[k]).join(', '); }

// appCard shows an app, its selector, matched cells, and an inline editor.
function appCard(a) {
  const matched = sel.cellsOf(a);
  const sv = el('input', { id: 'app-sel-' + a.id, value: selectorText(a.selector) });
  const editor = el('div', { class: 'form hidden', style: 'margin-top:8px' }, [
    el('div', { class: 'field' }, [el('label', { text: 'Selector (key=value, comma separated)' }), sv]),
    el('div', { class: 'bc-row' }, [Button({ variant: 'primary', label: 'Save', onClick: () => api.saveApp(Object.assign({}, a, { selector: parseSelector(sv.value) })).catch((e) => toast(e.message)) }), Button({ variant: 'danger', label: 'Delete app', onClick: () => api.deleteApp(a.id).catch((e) => toast(e.message)) })]),
  ]);
  return el('div', { class: 'card' }, [
    el('div', { class: 'bc-row', style: 'justify-content:space-between' }, [el('span', { class: 'card-title', text: a.name }), SeverityChip({ severity: a.criticality === 'Critical' ? 'critical' : 'info', label: a.criticality })]),
    el('div', { style: 'margin-top:6px' }, [labelChips(a.selector)]),
    el('dl', { class: 'kv', style: 'margin-top:10px' }, [el('dt', { text: 'Cells' }), el('dd', { class: matched.length ? 'mono' : 'muted', text: matched.length ? matched.map((r) => r.id).join(', ') : 'none match yet' }), el('dt', { text: 'Owner' }), el('dd', { class: 'mono', text: a.owner }), el('dt', { text: 'SLO' }), el('dd', { text: a.slo || 'none yet' })]),
    el('div', { class: 'bc-row', style: 'margin-top:10px' }, [Button({ label: 'Edit selector', onClick: () => editor.classList.toggle('hidden') })]),
    editor,
  ]);
}

function newAppForm() {
  const name = el('input', { id: 'new-app-name', placeholder: 'Checkout' });
  const selInput = el('input', { id: 'new-app-sel', placeholder: 'app=shop, tier=api' });
  const crit = el('select', { id: 'new-app-crit' }, [el('option', { text: 'Standard' }), el('option', { text: 'Critical' })]);
  const owner = el('input', { id: 'new-app-owner', placeholder: 'team@shop.example' });
  const box = el('div', { class: 'card hidden' }, [el('div', { class: 'card-title', text: 'New app' }), el('div', { class: 'form', style: 'margin-top:8px' }, [
    el('div', { class: 'field' }, [el('label', { for: 'new-app-name', text: 'Name' }), name]),
    el('div', { class: 'field' }, [el('label', { for: 'new-app-sel', text: 'Selector (key=value, comma separated)' }), selInput, el('span', { class: 'sm muted', text: 'Cells whose labels match every pair belong to this app. New cells join automatically.' })]),
    el('div', { class: 'field' }, [el('label', { for: 'new-app-crit', text: 'Criticality' }), crit]),
    el('div', { class: 'field' }, [el('label', { for: 'new-app-owner', text: 'Owner' }), owner]),
    el('div', { class: 'bc-row' }, [Button({ variant: 'primary', label: 'Create app', onClick: () => api.saveApp({ name: name.value, selector: parseSelector(selInput.value), criticality: crit.value, owner: owner.value, slo: 'none yet' }).then(() => box.classList.add('hidden')).catch((e) => toast(e.message)) }), Button({ label: 'Cancel', onClick: () => box.classList.add('hidden') })]),
  ])]);
  return { box, toggle: () => box.classList.toggle('hidden') };
}

export function pageServices() {
  const s = store.state; const form = newAppForm();
  return el('div', { class: 'page' }, [el('div', { class: 'bc-row', style: 'justify-content:space-between' }, [el('div', null, [el('h1', { class: 'display', text: 'Apps' }), el('p', { class: 'muted', text: 'An app is a named label group: a real application, a gateway, or one machine on its own. Cells join by label; runbooks attach to the same labels.' })]), Button({ variant: 'primary', label: 'New app', onClick: form.toggle })]),
    form.box,
    el('div', { class: 'split' }, s.apps.map(appCard))]);
}

export function pageConnections() {
  const s = store.state;
  const azBox = el('div', { class: 'card conn hidden' }, [el('div', { class: 'card-title', text: 'New Azure connection' }), azureForm({ onSubmit: () => azBox.classList.add('hidden'), onCancel: () => azBox.classList.add('hidden') })]);
  const ucBox = el('div', { class: 'card conn hidden' }, [el('div', { class: 'card-title', text: 'New UpCloud connection' }), upcloudForm({ onSubmit: () => ucBox.classList.add('hidden'), onCancel: () => ucBox.classList.add('hidden') })]);
  return el('div', { class: 'page' }, [el('div', { class: 'bc-row', style: 'justify-content:space-between' }, [el('div', null, [el('h1', { class: 'display', text: 'Connections' }), el('p', { class: 'muted', text: 'One identity at one scope. Broad read for discovery, narrow write for fixes. Each connection lists what it discovered; onboard from there.' })]), el('div', { class: 'bc-row' }, [Button({ variant: 'primary', label: 'Add Azure', onClick: () => { azBox.classList.toggle('hidden'); ucBox.classList.add('hidden'); } }), Button({ variant: 'primary', label: 'Add UpCloud', onClick: () => { ucBox.classList.toggle('hidden'); azBox.classList.add('hidden'); } })])]),
    azBox, ucBox,
    s.connections.length ? el('div', { class: 'grid2' }, s.connections.map((c) => connectionCard(c, { removable: true }))) : el('div', { class: 'empty', text: 'No connections yet.' })]);
}

export function pageResponders() {
  const s = store.state;
  const rows = s.responders.map((r) => el('tr', null, [el('td', { class: 'mono', text: r.id }), el('td', { class: 'sm', text: r.signal }), el('td', { class: 'sm muted', text: r.scope }), el('td', { class: 'sm', text: (sel.agent(r.agent) || {}).name || r.agent }), el('td', null, [el('div', { class: 'segs' }, [el('button', { class: r.mode === 'Review' ? 'on' : '', text: 'Review', onClick: () => api.responderMode(r.id, 'Review') }), el('button', { class: r.mode === 'Autonomous' ? 'on' : '', text: 'Autonomous', onClick: () => api.responderMode(r.id, 'Autonomous').then(() => toast(r.id + ' set to autonomous. Beacon will act and report.')) })])]), el('td', { class: 'mono', text: r.level }), el('td', null, [el('div', { class: 'policy' }, r.tools.map((t) => el('span', { class: t.policy, text: t.tool + ' · ' + t.policy })))])]));
  return el('div', { class: 'page' }, [el('h1', { class: 'display', text: 'Responders' }), el('p', { class: 'muted', text: 'A responder binds a signal to the agent that handles it, the actions it may take, the policy on each action, and the run mode. Start every responder in review. Promote the ones you always approve.' }),
    el('div', { class: 'tablewrap' }, [el('table', { class: 'table' }, [el('thead', null, [el('tr', null, [el('th', { text: 'Responder' }), el('th', { text: 'Signal' }), el('th', { text: 'Scope' }), el('th', { text: 'Agent' }), el('th', { text: 'Run mode' }), el('th', { text: 'Level' }), el('th', { text: 'Action policy' })])]), el('tbody', null, rows)])]),
    el('div', { class: 'card' }, [el('div', { class: 'heading', text: 'Autonomy levels' }), el('p', { class: 'sm muted', text: 'L0 observe · L1 investigate · L2 recommend · L3 execute after a human approves the specific action · L4 execute allowlisted low-risk actions automatically when preconditions pass, then verify and report.' })])]);
}

export function pageConsumption() {
  const s = store.state; const cap = 60;
  const byAgent = s.agents.map((a) => [a.name, (s.usage[a.id] || {}).costUsd || 0]);
  const spent = byAgent.reduce((x, b) => x + b[1], 0);
  const rows = s.runs.map((r) => el('tr', { class: 'row', onClick: () => go('inv/' + r.id) }, [el('td', { class: 'mono', text: r.id }), el('td', { text: (sel.finding(r.findingId) || {}).title || r.task }), el('td', { text: (sel.agent(r.agent) || {}).name || r.agent }), el('td', { class: 'mono', text: tokens(r.usage.inputTokens) + ' in · ' + tokens(r.usage.outputTokens) + ' out' }), el('td', { class: 'mono', text: duration(r) }), el('td', { class: 'mono', text: money(r.usage.costUsd) }), el('td', { text: r.outcome })]));
  return el('div', { class: 'page' }, [el('h1', { class: 'display', text: 'Consumption' }), el('p', { class: 'muted', text: 'What Beacon spent on your behalf this month, by agent and by run. The cap stops investigations, never the collector and signal loops.' }),
    el('div', { class: 'split' }, [
      el('div', { class: 'card' }, [el('span', { class: 'label', text: 'Monthly cap' }), el('div', { class: 'val', style: 'margin:4px 0 8px' }, [el('span', { class: 'numeral', text: money(spent) }), el('span', { class: 'muted', text: ' of $' + cap })]), el('div', { class: 'bar' }, [el('i', { style: 'width:' + Math.min(100, spent / cap * 100).toFixed(1) + '%' })]), el('p', { class: 'sm muted', style: 'margin-top:8px', text: `Collector and signal loops: no model cost. ${s.runs.length} runs this month.` })]),
      el('div', { class: 'card' }, [el('span', { class: 'label', text: 'By agent' })].concat(byAgent.map((b) => el('div', { style: 'margin-top:8px' }, [el('div', { class: 'bc-row', style: 'justify-content:space-between' }, [el('span', { class: 'sm', text: b[0] }), el('span', { class: 'mono', text: money(b[1]) })]), el('div', { class: 'bar' }, [el('i', { style: 'width:' + (spent ? b[1] / spent * 100 : 0).toFixed(1) + '%' })])])))),
      el('div', { class: 'card' }, [el('span', { class: 'label', text: 'Per run' }), el('div', { class: 'val', style: 'margin-top:4px' }, [el('span', { class: 'numeral', text: money(s.runs.length ? spent / s.runs.length : 0) })]), el('p', { class: 'sm muted', text: `average, ${s.model}, adaptive thinking${s.reasoner === 'claude' ? '' : ' (simulated in scripted mode)'}` })]),
    ]),
    el('div', { class: 'tablewrap' }, [el('table', { class: 'table' }, [el('thead', null, [el('tr', null, [el('th', { text: 'Run' }), el('th', { text: 'Task' }), el('th', { text: 'Agent' }), el('th', { text: 'Tokens' }), el('th', { text: 'Duration' }), el('th', { text: 'Cost' }), el('th', { text: 'Outcome' })])]), el('tbody', null, rows.length ? rows : [el('tr', null, [el('td', { colspan: '7', class: 'muted', text: 'No runs yet.' })])])])])]);
}
