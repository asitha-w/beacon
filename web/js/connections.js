// Connection forms and cards shared by setup and the Connections page. A
// connection is an identity, a credential, a scope and the roles found there.
import { el, Button, StatusChip, CapabilityList } from './ds.js';
import { store, sel } from './store.js';
import { api } from './api.js';
import { toast } from './shell.js';

export function connChip(s) { return s === 'connected' ? StatusChip({ status: 'verified', label: 'Connected' }) : s === 'validating' ? StatusChip({ status: 'investigating', label: 'Validating' }) : StatusChip({ status: 'unverified', label: 'Not connected' }); }
export function probeChip(s) { return s === 'online' ? StatusChip({ status: 'verified', label: 'Online' }) : s === 'waiting' ? StatusChip({ status: 'investigating', label: 'Waiting' }) : StatusChip({ status: 'unverified', label: 'Not installed' }); }

function field(id, label, input, hint) { return el('div', { class: 'field' }, [el('label', { for: id, text: label }), input, hint ? el('span', { class: 'sm muted', text: hint }) : null]); }
function select(id, options, value, onChange) { return el('select', { id, onChange }, options.map((o) => el('option', { value: o[0], text: o[1], selected: o[0] === value }))); }

// azureForm collects what a real Azure connection needs: directory, identity,
// credential, read scope and an optional, narrower write scope.
export function azureForm(opts = {}) {
  const dir = el('input', { id: 'az-dir', value: '2c1a7b90-3f4e-4d2a-9b1c-7e5f6a8d9c01', placeholder: 'Entra tenant id' });
  const clientId = el('input', { id: 'az-client', placeholder: 'Application (client) id' });
  const cred = select('az-cred', [['federated', 'Federated credential (no secret)'], ['certificate', 'Certificate']], 'federated');
  const byoBox = el('div', { class: 'form hidden', style: 'max-width:none' }, [field('az-client', 'Application (client) id', clientId), field('az-cred', 'Credential', cred, 'Beacon trusts your app through a federated credential or a certificate you upload to the app. Client secrets are not accepted.')]);
  const auth = select('az-auth', [['consent', 'Consent to the Beacon app (recommended)'], ['byo', 'Bring your own app registration']], 'consent', (e) => byoBox.classList.toggle('hidden', e.target.value !== 'byo'));
  const readLevel = select('az-rl', [['subscription', 'Subscription'], ['resource-group', 'Resource group'], ['management-group', 'Management group']], 'subscription');
  const readTarget = el('input', { id: 'az-rt', value: '7f3c21e0-5d2a-4b7e-9a11-0c3f1e2d8b44', placeholder: 'subscription id or resource group' });
  const writeLevel = select('az-wl', [['resource-group', 'Resource group'], ['resource', 'Single resource'], ['subscription', 'Subscription (not recommended)'], ['none', 'None, read only']], 'resource-group');
  const writeTarget = el('input', { id: 'az-wt', value: 'rg-shop-prod', placeholder: 'resource group or resource id' });
  const name = el('input', { id: 'az-name', placeholder: 'Shop production (optional)' });
  const submit = () => api.createConnection({ provider: 'azure', name: name.value, directory: dir.value.trim(), authMode: auth.value, clientId: clientId.value.trim(), credentialKind: cred.value,
    readScope: { level: readLevel.value, target: readTarget.value.trim() }, writeScope: { level: writeLevel.value, target: writeLevel.value === 'none' ? '' : writeTarget.value.trim() } })
    .then(() => opts.onSubmit && opts.onSubmit()).catch((e) => toast(e.message));
  return el('div', { class: 'form', style: 'max-width:none' }, [
    field('az-dir', 'Directory (Entra tenant id)', dir, 'The directory the identity lives in. Beacon validates against this directory only.'),
    field('az-auth', 'Identity', auth, 'Consent creates a service principal for Beacon in your directory. No secret changes hands.'),
    byoBox,
    el('div', { class: 'split' }, [
      el('div', { class: 'form' }, [el('span', { class: 'label', text: 'Read scope' }), field('az-rl', 'Level', readLevel), field('az-rt', 'Target', readTarget, 'Reader, Monitoring Reader and AKS RBAC Reader are assigned here. Broad read keeps discovery useful.')]),
      el('div', { class: 'form' }, [el('span', { class: 'label', text: 'Write scope' }), field('az-wl', 'Level', writeLevel), field('az-wt', 'Target', writeTarget, 'Virtual Machine Contributor and AKS RBAC Writer are assigned here. This is the blast radius for fixes; keep it narrow.')]),
    ]),
    field('az-name', 'Connection name', name),
    el('div', { class: 'bc-row' }, [Button({ variant: 'primary', label: 'Consent and validate', onClick: submit }), opts.onCancel ? Button({ label: 'Cancel', onClick: opts.onCancel }) : null]),
  ]);
}

// upcloudForm collects the sub-account and token; the grants come from validation.
export function upcloudForm(opts = {}) {
  const sub = el('input', { id: 'uc-sub', value: 'beacon-ro', placeholder: 'sub-account username' });
  const tok = el('input', { id: 'uc-token', type: 'password', value: 'ucat_01J9…redacted', autocomplete: 'off' });
  const power = el('input', { type: 'checkbox', id: 'uc-power', checked: true });
  const submit = () => api.createConnection({ provider: 'upcloud', subAccount: sub.value.trim(), token: tok.value, grants: ['server.read', 'database.read'].concat(power.checked ? ['server.power'] : []) })
    .then(() => opts.onSubmit && opts.onSubmit()).catch((e) => toast(e.message));
  return el('div', { class: 'form', style: 'max-width:none' }, [
    field('uc-sub', 'Sub-account', sub, 'Create a sub-account in the UpCloud hub and restrict it to the servers and databases Beacon should see.'),
    field('uc-token', 'API token', tok, "Stored in the cell's secret store only. Its grants are the frame; Beacon cannot exceed them."),
    el('label', { class: 'switch' }, [power, 'Sub-account may start and stop servers (needed for L4 autonomous start)']),
    el('div', { class: 'bc-row' }, [Button({ variant: 'primary', label: 'Validate token', onClick: submit }), opts.onCancel ? Button({ label: 'Cancel', onClick: opts.onCancel }) : null]),
  ]);
}

function scopeText(sc) { if (!sc || !sc.level || sc.level === 'none') return 'none, read only'; return sc.level.replace('-', ' ') + ' ' + sc.target; }

// connectionCard shows one validated connection: identity, scopes, roles, capabilities.
export function connectionCard(c, opts = {}) {
  const s = store.state;
  const head = el('div', { class: 'conn-head' }, [el('span', { class: 'name', text: c.name }), connChip(c.status), el('span', { class: 'spacer', style: 'flex:1' }), opts.removable ? Button({ label: 'Remove', onClick: () => api.deleteConnection(c.id).catch((e) => toast(e.message)) }) : null]);
  if (c.status === 'validating') return el('div', { class: 'card conn' }, [head, el('p', { class: 'muted', text: c.provider === 'azure' ? 'Validating identity in the directory, listing role assignments at each scope, mapping roles to capabilities…' : 'Validating token, reading sub-account grants, listing servers and managed databases…' })]);
  const kv = c.provider === 'azure' ? [['Directory', c.directory], ['Identity', c.identity], ['Read scope', scopeText(c.readScope)], ['Write scope', scopeText(c.writeScope)]] : [['Identity', c.identity], ['Grants', (c.grants || []).join(', ')]];
  if (c.validatedAt) kv.push(['Last validated', new Date(c.validatedAt).toLocaleTimeString()]);
  if (s.tenant) kv.push(['Egress', s.tenant.egressIp + ' (static)']);
  const inScope = s.resources.filter((r) => r.connectionId === c.id).map((r) => r.id);
  kv.push(['Resources in scope', inScope.length ? inScope.join(', ') : 'none']);
  const roles = c.roles && c.roles.length ? el('div', { class: 'tablewrap' }, [el('table', { class: 'table' }, [el('thead', null, [el('tr', null, [el('th', { text: 'Identity' }), el('th', { text: 'Role' }), el('th', { text: 'Scope' })])]), el('tbody', null, c.roles.map((r) => el('tr', null, [el('td', null, [el('span', { class: 'bc-pill ' + (r.identity === 'write' ? 'bc-pill-missing' : 'bc-pill-available'), text: r.identity })]), el('td', { class: 'sm', text: r.role }), el('td', { class: 'mono sm', text: scopeText(r.scope) })])))])]) : null;
  return el('div', { class: 'card conn' }, [head, el('dl', { class: 'kv' }, kv.flatMap((p) => [el('dt', { text: p[0] }), el('dd', { class: p[0] === 'Directory' || p[0] === 'Egress' ? 'mono' : '', text: p[1] || '' })])), roles, CapabilityList({ items: c.capabilities || [] })]);
}
