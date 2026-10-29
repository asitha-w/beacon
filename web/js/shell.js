// The app frame: rail, top bar, activity panel, toasts and the demo bar.
import { el, Button } from './ds.js';
import { store, sel } from './store.js';
import { route, go } from './router.js';
import { api } from './api.js';

export const NAV = [['findings', 'Findings'], ['investigations', 'Investigations'], ['approvals', 'Approvals'], ['chat', 'Ask Beacon'], ['agents', 'Agents'], ['services', 'Services'], ['connections', 'Connections'], ['responders', 'Responders'], ['consumption', 'Consumption']];

export function shell(contentNode, opts = {}) {
  const s = store.state; const r = route().split('/')[0];
  const pending = sel.pendingApprovals().length;
  const rail = el('nav', { class: 'rail', 'aria-label': 'Beacon' }, [
    el('div', { class: 'brand' }, [el('i'), 'Beacon']),
    el('div', { class: 'tenant' }, [el('span', { text: s.tenant ? s.tenant.name : 'No tenant' }), el('span', { class: 'label', text: s.tenant ? s.tenant.env : '' })]),
    el('div', { class: 'nav' }, NAV.map((n) => el('a', { href: '#' + n[0], class: r === n[0] || (n[0] === 'investigations' && r === 'inv') ? 'active' : '' }, [n[1], n[0] === 'approvals' && pending ? el('span', { class: 'count', text: String(pending) }) : null]))),
    el('div', { class: 'me' }, [el('div', { text: s.user ? s.user.name : '' }), el('div', { class: 'sm', text: s.user ? s.user.role : '' }), el('a', { href: '#', class: 'sm', text: 'Sign out', onClick: (e) => { e.preventDefault(); api.logout(); } })]),
  ]);
  const top = el('div', { class: 'topbar' }, [el('span', { class: 'crumb', text: opts.crumb || '' }), el('span', { class: 'spacer' }), el('span', { class: 'sm muted', text: probeSummary() }), el('span', { class: 'badge', text: s.reasoner === 'claude' ? s.model : 'scripted mode' })]);
  const body = el('div', { class: 'body' + (opts.aside ? '' : ' noaside') }, [el('div', { class: 'content' }, [contentNode]), opts.aside ? el('aside', { class: 'aside', 'aria-label': 'Activity' }, [activityPanel()]) : null]);
  return el('div', { class: 'app' }, [rail, el('div', { class: 'main' }, [top, body])]);
}
export function setupShell(contentNode) {
  const s = store.state;
  return el('div', { class: 'app', style: 'grid-template-columns:1fr' }, [el('div', { class: 'main' }, [el('div', { class: 'topbar' }, [el('div', { class: 'brand', style: 'padding:0' }, [el('i'), 'Beacon']), el('span', { class: 'spacer' }), el('span', { class: 'sm muted', text: s.user ? s.user.email : '' })]), el('div', { class: 'body noaside' }, [el('div', { class: 'content' }, [contentNode])])])]);
}
function probeSummary() {
  const s = store.state; const on = s.probe.hosts.length;
  const conns = Object.values(s.connections).filter((c) => c.status === 'connected').length;
  return on ? `${on} probes online · ${conns} connections` : (conns ? `${conns} connections · no probes yet` : 'Not connected');
}
export function activityPanel() {
  const s = store.state;
  const items = s.activity.length ? s.activity.map((a) => {
    const n = el('div', { class: 'act' + (a.task ? ' task' : '') }, [el('span', { class: 't', text: fmtTime(a.at) + ' · ' + a.kind }), el('span', { text: a.text })]);
    if (a.runId) n.appendChild(el('div', { class: 'bc-row', style: 'margin-top:6px' }, [Button({ variant: a.task ? 'primary' : 'quiet', label: a.task ? 'Open approval' : 'Open run', onClick: () => go('inv/' + a.runId) })]));
    return n;
  }) : [el('div', { class: 'empty sm', text: 'Quiet. Signals, runs, approvals and notifications appear here as they happen.' })];
  return el('div', { class: 'activity' }, [el('div', { class: 'label', text: 'Activity' })].concat(items));
}
export function fmtTime(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
export function ago(iso) {
  const ms = Date.now() - new Date(iso).getTime(); if (isNaN(ms)) return '';
  const s = Math.max(0, Math.round(ms / 1000)); if (s < 60) return s + 's'; const m = Math.round(s / 60); if (m < 60) return m + 'm'; const h = Math.round(m / 60); if (h < 48) return h + 'h'; return Math.round(h / 24) + 'd';
}
export function duration(r) {
  const end = r.endedAt ? new Date(r.endedAt) : new Date(); const s = Math.max(0, Math.round((end - new Date(r.startedAt)) / 1000));
  return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's';
}
export function money(v) { return '$' + (v || 0).toFixed(2); }
export function tokens(n) { return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n || 0); }
export function toast(text) {
  const box = document.getElementById('toasts'); const t = el('div', { class: 'toast', text }); box.appendChild(t); setTimeout(() => t.remove(), 4200);
}
export function demobar() {
  const s = store.state; const bar = document.getElementById('demobar'); bar.innerHTML = '';
  const ready = s.user && s.tenant && s.probe.status === 'online';
  bar.appendChild(el('span', { class: 'label', text: 'Demo controls' }));
  bar.appendChild(el('span', { text: ready ? 'Inject a fault into the simulated estate:' : 'Finish sign-in, tenant and connections to enable scenarios.' }));
  bar.appendChild(el('span', { class: 'scen' }, s.scenarios.map((sc) => Button({ variant: sc.status === 'idle' ? 'primary' : 'quiet', label: sc.status === 'running' ? sc.name + ' (running)' : sc.status === 'done' ? sc.name + ' (done)' : sc.name, title: sc.description, disabled: !ready || sc.status !== 'idle', onClick: () => api.startScenario(sc.id).then(() => go('findings')).catch((e) => toast(e.message)) }))));
  bar.appendChild(Button({ label: 'Reset tenant', onClick: () => api.reset().then(() => { location.hash = '#login'; }) }));
}
