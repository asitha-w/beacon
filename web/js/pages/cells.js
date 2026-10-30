import { el, Button, SeverityChip, StatusChip, CapabilityList } from '../ds.js';
import { store, sel } from '../store.js';
import { api } from '../api.js';
import { toast, ago, duration, money } from '../shell.js';
import { go } from '../router.js';
import { accessChip, tierChip, channelChip } from '../connections.js';
import { markdown } from '../markdown.js';

function parseSelector(text) { const out = {}; text.split(',').map((p) => p.trim()).filter(Boolean).forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }); return out; }
function selectorText(s) { return Object.keys(s || {}).map((k) => k + '=' + s[k]).join(', '); }
export function labelChips(labels) { return el('div', { class: 'policy', style: 'flex-wrap:wrap' }, Object.keys(labels || {}).map((k) => el('span', { text: k + '=' + labels[k] }))); }
function accessOf(c) { const conn = sel.conn(c.connectionId); return conn ? ((conn.catalogue || []).find((k) => k.id === c.id) || {}).access : ''; }

// channels draws the runtime and one isolated channel per cell.
function channels() {
  const s = store.state;
  const rows = s.cells.map((c) => {
    const conn = sel.conn(c.connectionId); const shared = sel.sharedWith(c);
    return el('div', { class: 'chan ' + (c.channel === 'online' || c.channel === 'connected' ? 'on' : '') }, [
      el('span', { class: 'line' }), el('a', { class: 'mono', href: '#cell/' + c.id, text: c.id }), tierChip(c), el('span', { class: 'sm muted', text: conn ? 'via ' + conn.name + (shared ? ` · identity shared with ${shared} other cell${shared === 1 ? '' : 's'}` : ' · dedicated identity') : 'no connection' }),
    ]);
  });
  return el('div', { class: 'card' }, [
    el('div', { class: 'bc-row', style: 'gap:24px;align-items:flex-start' }, [
      el('div', { class: 'runtime' }, [el('span', { class: 'label', text: 'Tenant runtime' }), el('b', { text: s.tenant ? s.tenant.runtime : '' }), el('span', { class: 'mono sm muted', text: s.tenant ? s.tenant.egressIp : '' }), el('span', { class: 'sm muted', text: 'one isolated channel per cell' })]),
      el('div', { class: 'chans' }, rows.length ? rows : [el('span', { class: 'sm muted', text: 'No cells yet. Onboard them from a connection.' })]),
    ]),
  ]);
}

function cellRow(c) {
  const conn = sel.conn(c.connectionId);
  return el('tr', { class: 'row', onClick: () => go('cell/' + c.id) }, [
    el('td', null, [el('div', { class: 'mono', text: c.id }), el('div', { class: 'sm muted', text: c.kind })]),
    el('td', null, [channelChip(c)]),
    el('td', null, [tierChip(c)]),
    el('td', null, [el('div', { class: 'sm', text: conn ? conn.name : '' }), accessChip(accessOf(c))]),
    el('td', null, [labelChips(c.labels)]),
  ]);
}

export function pageCells() {
  const s = store.state;
  const pending = s.cells.filter((c) => c.probeCapable && c.tier !== 'probe');
  return el('div', { class: 'page' }, [
    el('div', null, [el('h1', { class: 'display', text: 'Cells' }), el('p', { class: 'muted', text: 'A cell is one managed thing: a VM, a cluster, a server. Each has its own isolated channel in the runtime. Basic tier reads provider sensors and runs provider actions; the probe tier adds in-guest metrics, logs, files and commands.' })]),
    channels(),
    pending.length && s.probe.status !== 'waiting' ? el('div', { class: 'card', style: 'border-color:var(--warning)' }, [el('div', { class: 'bc-row', style: 'justify-content:space-between' }, [el('div', null, [el('div', { class: 'heading', text: `${pending.length} cell${pending.length === 1 ? '' : 's'} can take the probe` }), el('div', { class: 'sm muted', text: 'Install it to raise them to the probe tier: ' + pending.map((c) => c.id).join(', ') })]), Button({ variant: 'primary', label: 'Install the probe', onClick: () => api.installProbe().catch((e) => toast(e.message)) })])]) : null,
    s.cells.length ? el('div', { class: 'tablewrap' }, [el('table', { class: 'table' }, [el('thead', null, [el('tr', null, [el('th', { text: 'Cell' }), el('th', { text: 'Channel' }), el('th', { text: 'Tier' }), el('th', { text: 'Connection' }), el('th', { text: 'Labels' })])]), el('tbody', null, s.cells.map(cellRow))])]) : el('div', { class: 'empty', text: 'No cells yet. Open a connection and onboard what it discovered.' }),
  ]);
}

// --- cell page ---

const SENSOR = /metrics|health|Activity|inventory|Kubernetes API/i;
const ACTION = /fixes|Rollouts|Power/i;
const K8S = /Kubernetes|AKS|Rollouts/i;
const GUEST = /In-guest/i;

function sensorsCard(c, conn) {
  const k8s = c.kind === 'AKS cluster';
  const caps = ((conn && conn.capabilities) || []).filter((k) => !/Beacon probe/.test(k.detail || '')).filter((k) => k8s ? !GUEST.test(k.name) : !K8S.test(k.name));
  const sensors = caps.filter((k) => SENSOR.test(k.name)).map((k) => ({ name: k.name, detail: k.detail, state: k.state }));
  const actions = caps.filter((k) => ACTION.test(k.name)).map((k) => ({ name: k.name, detail: k.detail, state: k.state }));
  return el('div', { class: 'card conn' }, [
    el('div', null, [el('div', { class: 'card-title', text: 'Provider sensors' }), el('div', { class: 'sm muted', text: 'What the connection gives for free, no software on the cell. Read through ' + (conn ? conn.name : 'no connection') + '.' })]),
    CapabilityList({ items: sensors }),
    el('div', { class: 'label', text: 'Provider actions' }), CapabilityList({ items: actions }),
  ]);
}

function configText(c) {
  const t = c.telemetry; const lines = ['receivers:'];
  if (t.hostMetrics) lines.push('  hostmetrics: { scrapers: [cpu, memory, disk, filesystem, network' + (t.processes ? ', process' : '') + '] }');
  t.receivers.filter((r) => r.enabled).forEach((r) => lines.push(`  ${r.name}: {}`));
  const logs = t.logs.filter((l) => l.enabled).map((l) => l.name);
  if (logs.length) lines.push(c.kind === 'AKS cluster' ? `  k8s_logs: { workloads: [${logs.join(', ')}] }` : `  filelog: { include: [${logs.join(', ')}] }`);
  if (t.otlp) lines.push('  otlp: { protocols: { grpc: { endpoint: 127.0.0.1:4317 } } }');
  lines.push('exporters:', `  otlp/beacon: { endpoint: ${store.state.tenant ? store.state.tenant.runtime : 'runtime'}.beacon.example:4317, tls: { mtls: true } }`);
  lines.push('extensions:', '  opamp: { server: { ws: { endpoint: wss://' + (store.state.tenant ? store.state.tenant.runtime : 'runtime') + '.beacon.example/opamp } } }');
  return lines.join('\n');
}

function telemetryCard(c) {
  const t = JSON.parse(JSON.stringify(c.telemetry));
  const sw = (label, get, set, detail) => el('label', { class: 'switch tel' }, [el('input', { type: 'checkbox', checked: get(), onChange: (e) => { set(e.target.checked); preview.textContent = configText({ ...c, telemetry: t }); } }), el('span', null, [el('span', { text: label }), detail ? el('span', { class: 'sm muted', text: ' · ' + detail }) : null])]);
  const preview = el('div', { class: 'code', text: configText(c) });
  const installed = c.tier === 'probe';
  const body = el('div', { class: 'split' }, [
    el('div', { class: 'conn' }, [
      el('div', { class: 'label', text: 'Metrics' }),
      sw('Host metrics', () => t.hostMetrics, (v) => { t.hostMetrics = v; }, 'cpu, memory, disk, filesystem, network'),
      sw('Processes', () => t.processes, (v) => { t.processes = v; }, 'per-process cpu and memory'),
      ...t.receivers.map((r) => sw(r.name, () => r.enabled, (v) => { r.enabled = v; }, r.detail)),
      el('div', { class: 'label', style: 'margin-top:8px', text: 'Application telemetry' }),
      sw('Accept OTLP from the app', () => t.otlp, (v) => { t.otlp = v; }, 'traces and metrics pushed to the probe on the cell'),
    ]),
    el('div', { class: 'conn' }, [
      el('div', { class: 'label', text: c.kind === 'AKS cluster' ? 'Logs · workloads' : 'Logs · files' }),
      ...t.logs.map((l) => sw(l.name, () => l.enabled, (v) => { l.enabled = v; })),
      el('div', { class: 'bc-row', style: 'margin-top:4px' }, [el('input', { id: 'new-log', placeholder: c.kind === 'AKS cluster' ? 'workload name' : '/var/log/app.log', style: 'flex:1' }), Button({ label: 'Add', onClick: () => { const v = document.getElementById('new-log').value.trim(); if (!v) return; t.logs.push({ name: v, enabled: true }); api.setTelemetry(c.id, t).catch((e) => toast(e.message)); } })]),
    ]),
  ]);
  return el('div', { class: 'card conn' }, [
    el('div', { class: 'bc-row', style: 'justify-content:space-between' }, [el('div', null, [el('div', { class: 'card-title', text: 'Probe telemetry' }), el('div', { class: 'sm muted', text: installed ? 'What the probe on this cell collects. Saving pushes a new collector config over OpAMP. The investigator can only read what is enabled here.' : 'The probe is not installed yet. This is the configuration it will get; install it to raise the cell to the probe tier.' })]), installed ? Button({ variant: 'primary', label: 'Save and push', onClick: () => api.setTelemetry(c.id, t).then(() => toast('Config pushed to ' + c.id)).catch((e) => toast(e.message)) }) : (c.probeCapable ? Button({ variant: 'primary', label: 'Install the probe', onClick: () => api.installProbe().catch((e) => toast(e.message)) }) : null)]),
    body,
    el('details', { class: 'details' }, [el('summary', { text: 'Collector config the probe receives' }), preview]),
  ]);
}

export function pageCell(id) {
  const s = store.state; const c = sel.cell(id);
  if (!c) return el('div', { class: 'page' }, [el('h1', { class: 'display', text: id }), el('div', { class: 'empty', text: 'Not a cell in this tenant. Onboard it from its connection.' })]);
  const conn = sel.conn(c.connectionId); const shared = sel.sharedWith(c);
  const input = el('input', { id: 'labels-' + c.id, value: selectorText(c.labels), style: 'width:100%' });
  const editor = el('div', { class: 'bc-row hidden', style: 'margin-top:6px' }, [input, Button({ variant: 'primary', label: 'Save labels', onClick: () => api.setLabels(c.id, parseSelector(input.value)).then(() => editor.classList.add('hidden')).catch((e) => toast(e.message)) })]);
  const chips = labelChips(c.labels); chips.style.cursor = 'pointer'; chips.title = 'Edit labels'; chips.addEventListener('click', () => editor.classList.toggle('hidden'));
  const head = el('div', null, [
    el('div', { class: 'bc-row', style: 'margin-bottom:8px' }, [channelChip(c), tierChip(c), accessChip(accessOf(c)), el('span', { class: 'badge', text: c.kind })]),
    el('h1', { class: 'display', text: c.id }),
    el('div', { class: 'sm muted', style: 'margin-top:4px', text: c.detail + ' · via ' + (conn ? conn.name : 'no connection') + (shared ? ` · identity shared with ${shared} other cell${shared === 1 ? '' : 's'}` : ' · dedicated identity') + ' · onboarded ' + ago(c.onboardedAt) + ' ago' }),
    el('div', { style: 'margin-top:10px' }, [chips, editor]),
  ]);
  const rbs = sel.cellsMatching ? s.runbooks.filter((rb) => sel.cellsMatching(rb.selector).some((x) => x.id === c.id)) : [];
  const findings = s.findings.filter((f) => f.resource === c.id);
  const rows = findings.map((f) => el('tr', { class: 'row', onClick: () => go('inv/' + f.runId) }, [el('td', null, [SeverityChip({ severity: f.severity })]), el('td', { text: f.title }), el('td', null, [StatusChip({ status: f.status })]), el('td', { class: 'mono muted', text: ago(f.createdAt) })]));
  return el('div', { class: 'page' }, [
    head,
    el('div', { class: 'grid2' }, [sensorsCard(c, conn), telemetryCard(c)]),
    el('div', { class: 'grid2' }, [
      el('div', { class: 'card conn' }, [el('div', { class: 'card-title', text: 'Runbooks that apply' }), rbs.length ? el('div', { class: 'conn' }, rbs.map((rb) => el('details', { class: 'details' }, [el('summary', { text: rb.name + ' · ' + selectorText(rb.selector) }), markdown(rb.body)]))) : el('p', { class: 'sm muted', text: 'No runbook matches these labels yet.' }), el('div', null, [Button({ label: 'Runbooks', onClick: () => go('runbooks') })])]),
      el('div', { class: 'card conn' }, [el('div', { class: 'card-title', text: 'Findings on this cell' }), rows.length ? el('div', { class: 'tablewrap' }, [el('table', { class: 'table compact' }, [el('tbody', null, rows)])]) : el('p', { class: 'sm muted', text: 'Nothing yet.' }), el('div', { class: 'bc-row' }, [Button({ variant: 'danger', label: 'Detach cell', onClick: () => api.detachCell(c.id).then(() => go('cells')).catch((e) => toast(e.message)) })])]),
    ]),
  ]);
}
