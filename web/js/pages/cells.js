import { el, Button } from '../ds.js';
import { store, sel } from '../store.js';
import { api } from '../api.js';
import { toast, ago } from '../shell.js';
import { accessChip, tierChip, channelChip } from '../connections.js';

function parseSelector(text) { const out = {}; text.split(',').map((p) => p.trim()).filter(Boolean).forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }); return out; }
function selectorText(s) { return Object.keys(s || {}).map((k) => k + '=' + s[k]).join(', '); }
export function labelChips(labels) { return el('div', { class: 'policy', style: 'flex-wrap:wrap' }, Object.keys(labels || {}).map((k) => el('span', { text: k + '=' + labels[k] }))); }

// channels draws the runtime and one isolated channel per cell.
function channels() {
  const s = store.state;
  const rows = s.cells.map((c) => {
    const conn = sel.conn(c.connectionId); const shared = sel.sharedWith(c);
    return el('div', { class: 'chan ' + (c.channel === 'online' || c.channel === 'connected' ? 'on' : '') }, [
      el('span', { class: 'line' }), el('span', { class: 'mono', text: c.id }), tierChip(c), el('span', { class: 'sm muted', text: conn ? 'via ' + conn.name + (shared ? ` · identity shared with ${shared} other cell${shared === 1 ? '' : 's'}` : ' · dedicated identity') : 'no connection' }),
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
  const s = store.state; const app = sel.appOf(c); const conn = sel.conn(c.connectionId);
  const access = conn ? ((conn.catalogue || []).find((k) => k.id === c.id) || {}).access : '';
  const input = el('input', { id: 'labels-' + c.id, value: selectorText(c.labels), style: 'width:100%' });
  const editor = el('div', { class: 'bc-row hidden', style: 'margin-top:6px' }, [input, Button({ variant: 'primary', label: 'Save', onClick: () => api.setLabels(c.id, parseSelector(input.value)).catch((e) => toast(e.message)) })]);
  const chips = labelChips(c.labels); chips.style.cursor = 'pointer'; chips.title = 'Edit labels'; chips.addEventListener('click', () => editor.classList.toggle('hidden'));
  return el('tr', null, [
    el('td', null, [el('div', { class: 'mono', text: c.id }), el('div', { class: 'sm muted', text: c.kind })]),
    el('td', null, [channelChip(c)]),
    el('td', null, [tierChip(c), c.agentCapable && c.tier !== 'agent' ? el('div', { class: 'sm muted', text: c.channel === 'waiting' ? 'waiting for the agent' : 'agent not installed' }) : null]),
    el('td', null, [el('div', { class: 'sm', text: conn ? conn.name : '' }), accessChip(access)]),
    el('td', null, [chips, editor]),
    el('td', { text: app ? app.name : 'Unassigned', class: app ? '' : 'muted' }),
    el('td', null, [Button({ label: 'Detach', onClick: () => api.detachCell(c.id).catch((e) => toast(e.message)) })]),
  ]);
}

export function pageCells() {
  const s = store.state;
  const pending = s.cells.filter((c) => c.agentCapable && c.tier !== 'agent');
  return el('div', { class: 'page' }, [
    el('div', null, [el('h1', { class: 'display', text: 'Cells' }), el('p', { class: 'muted', text: 'A cell is one managed thing: a VM, a cluster, a server. Each has its own isolated channel in the runtime. Basic tier reads provider metrics and runs provider actions; the agent tier adds in-guest metrics, logs, files and commands.' })]),
    channels(),
    pending.length && s.probe.status !== 'waiting' ? el('div', { class: 'card', style: 'border-color:var(--warning)' }, [el('div', { class: 'bc-row', style: 'justify-content:space-between' }, [el('div', null, [el('div', { class: 'heading', text: `${pending.length} cell${pending.length === 1 ? '' : 's'} can take the agent` }), el('div', { class: 'sm muted', text: 'Install the agent to raise them to the agent tier: ' + pending.map((c) => c.id).join(', ') })]), Button({ variant: 'primary', label: 'Install the agent', onClick: () => api.installProbe().catch((e) => toast(e.message)) })])]) : null,
    s.cells.length ? el('div', { class: 'tablewrap' }, [el('table', { class: 'table' }, [el('thead', null, [el('tr', null, [el('th', { text: 'Cell' }), el('th', { text: 'Channel' }), el('th', { text: 'Tier' }), el('th', { text: 'Connection' }), el('th', { text: 'Labels' }), el('th', { text: 'App' }), el('th')])]), el('tbody', null, s.cells.map(cellRow))])]) : el('div', { class: 'empty', text: 'No cells yet. Open a connection and onboard what it discovered.' }),
  ]);
}
