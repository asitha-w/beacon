// Connection forms and cards shared by setup and the Connections page. A
// connection is an identity at a scope; its catalogue is what it could manage.
import { el, Button, StatusChip, CapabilityList } from './ds.js';
import { store, sel } from './store.js';
import { api } from './api.js';
import { toast } from './shell.js';

export function connChip(s) { return s === 'connected' ? StatusChip({ status: 'verified', label: 'Connected' }) : s === 'validating' ? StatusChip({ status: 'investigating', label: 'Validating' }) : StatusChip({ status: 'unverified', label: 'Not connected' }); }
export function accessChip(a) { return a === 'write' ? el('span', { class: 'bc-pill bc-pill-missing', text: 'read + write' }) : a === 'read' ? el('span', { class: 'bc-pill bc-pill-available', text: 'read only' }) : el('span', { class: 'bc-pill bc-pill-none', text: 'no access' }); }
export function tierChip(c) { return c.tier === 'probe' ? el('span', { class: 'bc-pill bc-pill-available', text: 'probe' }) : el('span', { class: 'bc-pill bc-pill-none', text: 'basic' }); }
export function channelChip(c) { const m = { online: ['verified', 'Online'], connected: ['verified', 'Connected'], waiting: ['investigating', 'Waiting for probe'], offline: ['unverified', 'Offline'] }[c.channel] || ['unverified', c.channel]; return StatusChip({ status: m[0], label: m[1] }); }

function field(id, label, input, hint) { return el('div', { class: 'field' }, [el('label', { for: id, text: label }), input, hint ? el('span', { class: 'sm muted', text: hint }) : null]); }
function select(id, options, value, onChange) { return el('select', { id, onChange }, options.map((o) => el('option', { value: o[0], text: o[1], selected: o[0] === value }))); }

// azureForm collects what a real Azure connection needs: directory, identity,
// credential, read scope and an optional, narrower write scope.
export function azureForm(opts = {}) {
  const dir = el('input', { id: 'az-dir', value: '2c1a7b90-3f4e-4d2a-9b1c-7e5f6a8d9c01', placeholder: 'Entra tenant id' });
  const clientId = el('input', { id: 'az-client', placeholder: 'Application (client) id' });
  const cred = select('az-cred', [['federated', 'Federated credential (no secret)'], ['certificate', 'Certificate']], 'federated');
  const byoBox = el('div', { class: 'form hidden', style: 'max-width:none' }, [field('az-client', 'Application (client) id', clientId), field('az-cred', 'Credential', cred, 'Beacon trusts your app through a federated credential or a certificate. Client secrets are not accepted.')]);
  const auth = select('az-auth', [['consent', 'Consent to the Beacon app (recommended)'], ['byo', 'Bring your own app registration']], 'consent', (e) => byoBox.classList.toggle('hidden', e.target.value !== 'byo'));
  const readLevel = select('az-rl', [['subscription', 'Subscription'], ['resource-group', 'Resource group'], ['management-group', 'Management group']], 'resource-group');
  const readTarget = el('input', { id: 'az-rt', value: 'rg-shop-prod', placeholder: 'subscription id or resource group' });
  const writeLevel = select('az-wl', [['resource-group', 'Resource group'], ['resource', 'Single resource'], ['subscription', 'Subscription (not recommended)'], ['none', 'None, read only']], 'resource-group');
  const writeTarget = el('input', { id: 'az-wt', value: 'rg-shop-prod', placeholder: 'resource group or resource id' });
  const name = el('input', { id: 'az-name', placeholder: 'Shop production (optional)' });
  const submit = () => api.createConnection({ provider: 'azure', name: name.value, directory: dir.value.trim(), authMode: auth.value, clientId: clientId.value.trim(), credentialKind: cred.value,
    readScope: { level: readLevel.value, target: readTarget.value.trim() }, writeScope: { level: writeLevel.value, target: writeLevel.value === 'none' ? '' : writeTarget.value.trim() } })
    .then(() => opts.onSubmit && opts.onSubmit()).catch((e) => toast(e.message));
  return el('div', { class: 'form', style: 'max-width:none' }, [
    field('az-dir', 'Directory (Entra tenant id)', dir),
    field('az-auth', 'Identity', auth, 'Consent creates a service principal for Beacon in your directory. No secret changes hands.'),
    byoBox,
    el('div', { class: 'split' }, [
      el('div', { class: 'form' }, [el('span', { class: 'label', text: 'Read scope' }), field('az-rl', 'Level', readLevel), field('az-rt', 'Target', readTarget, 'Reader roles are assigned here. What Beacon can see.')]),
      el('div', { class: 'form' }, [el('span', { class: 'label', text: 'Write scope' }), field('az-wl', 'Level', writeLevel), field('az-wt', 'Target', writeTarget, 'Contributor roles are assigned here. What Beacon can change; keep it narrow.')]),
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
    field('uc-sub', 'Sub-account', sub, 'Restrict the sub-account to the servers Beacon should see.'),
    field('uc-token', 'API token', tok, "Stored in the runtime's secret store. Its grants are the frame; Beacon cannot exceed them."),
    el('label', { class: 'switch' }, [power, 'Sub-account may start and stop servers (needed for autonomous start)']),
    el('div', { class: 'bc-row' }, [Button({ variant: 'primary', label: 'Validate token', onClick: submit }), opts.onCancel ? Button({ label: 'Cancel', onClick: opts.onCancel }) : null]),
  ]);
}

function scopeText(sc) { if (!sc || !sc.level || sc.level === 'none') return 'none, read only'; return sc.level.replace('-', ' ') + ' ' + sc.target; }

// catalogue is the discovery grid: what the connection can manage, with a
// checkbox per supported entry and one button to onboard the selection.
export function catalogue(c) {
  const cat = c.catalogue || [];
  if (!cat.length) return el('p', { class: 'sm muted', text: 'Nothing discovered in scope.' });
  const boxes = {};
  const rows = cat.map((k) => {
    const cell = sel.cell(k.id); const can = k.supported && !cell;
    const box = el('input', { type: 'checkbox', checked: can, disabled: !can });
    if (can) boxes[k.id] = box;
    return el('tr', null, [el('td', null, [box]), el('td', { class: 'mono', text: k.id }), el('td', null, [el('div', { text: k.kind }), el('div', { class: 'sm muted', text: k.detail + (k.resourceGroup ? ' · ' + k.resourceGroup : '') })]), el('td', null, [accessChip(k.access)]), el('td', null, [cell ? el('span', { class: 'bc-pill bc-pill-available', text: 'cell · ' + cell.tier }) : k.supported ? el('span', { class: 'bc-pill bc-pill-none', text: 'manageable' }) : el('span', { class: 'bc-pill bc-pill-none', text: 'not supported yet' })])]);
  });
  const onboard = () => { const ids = Object.keys(boxes).filter((id) => boxes[id].checked); if (!ids.length) return toast('Select something to onboard'); api.onboard(c.id, ids).catch((e) => toast(e.message)); };
  const n = Object.keys(boxes).length;
  return el('div', { class: 'conn' }, [
    el('div', { class: 'bc-row', style: 'justify-content:space-between' }, [el('span', { class: 'heading', text: 'Discovered in scope' }), n ? Button({ variant: 'primary', label: 'Onboard selected as cells', onClick: onboard }) : el('span', { class: 'sm muted', text: 'Everything manageable is onboarded' })]),
    el('div', { class: 'tablewrap' }, [el('table', { class: 'table compact' }, [el('thead', null, [el('tr', null, [el('th'), el('th', { text: 'Id' }), el('th', { text: 'Kind' }), el('th', { text: 'Access' }), el('th', { text: 'State' })])]), el('tbody', null, rows)])]),
  ]);
}

// connectionCard shows one validated connection: identity, scopes, roles, capabilities, catalogue.
export function connectionCard(c, opts = {}) {
  const s = store.state;
  const head = el('div', { class: 'conn-head' }, [el('span', { class: 'name', text: c.name }), connChip(c.status), el('span', { class: 'spacer', style: 'flex:1' }), opts.removable ? Button({ label: 'Remove', onClick: () => api.deleteConnection(c.id).catch((e) => toast(e.message)) }) : null]);
  if (c.status === 'validating') return el('div', { class: 'card conn' }, [head, el('p', { class: 'muted', text: c.provider === 'azure' ? 'Validating identity in the directory, listing role assignments at each scope, discovering what is in scope…' : 'Validating token, reading sub-account grants, listing servers and managed databases…' })]);
  const kv = c.provider === 'azure' ? [['Directory', c.directory], ['Identity', c.identity], ['Read scope', scopeText(c.readScope)], ['Write scope', scopeText(c.writeScope)]] : [['Identity', c.identity], ['Grants', (c.grants || []).join(', ')]];
  if (s.tenant) kv.push(['Egress', s.tenant.egressIp + ' (static)']);
  const details = el('details', { class: 'details' }, [el('summary', { text: 'Roles and capabilities' }),
    c.roles && c.roles.length ? el('div', { class: 'tablewrap', style: 'margin:8px 0' }, [el('table', { class: 'table compact' }, [el('thead', null, [el('tr', null, [el('th', { text: 'Identity' }), el('th', { text: 'Role' }), el('th', { text: 'Scope' })])]), el('tbody', null, c.roles.map((r) => el('tr', null, [el('td', null, [el('span', { class: 'bc-pill ' + (r.identity === 'write' ? 'bc-pill-missing' : 'bc-pill-available'), text: r.identity })]), el('td', { class: 'sm', text: r.role }), el('td', { class: 'mono sm', text: scopeText(r.scope) })])))])]) : null,
    CapabilityList({ items: c.capabilities || [] })]);
  return el('div', { class: 'card conn' }, [head, el('dl', { class: 'kv' }, kv.flatMap((p) => [el('dt', { text: p[0] }), el('dd', { class: p[0] === 'Directory' || p[0] === 'Egress' ? 'mono' : '', text: p[1] || '' })])), opts.catalogue === false ? null : catalogue(c), details]);
}
