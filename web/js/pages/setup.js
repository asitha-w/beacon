import { el, Button } from '../ds.js';
import { icon } from '../icons.js';
import { store, sel } from '../store.js';
import { azureForm, upcloudForm, connectionCard, connChip } from '../connections.js';
import { api } from '../api.js';
import { go } from '../router.js';
import { toast } from '../shell.js';

export function pageLogin() {
  const email = el('input', { id: 'login-email', type: 'email', placeholder: 'you@company.example', autocomplete: 'username' });
  const pw = el('input', { id: 'login-pw', type: 'password', placeholder: 'Password', autocomplete: 'current-password' });
  const signIn = (name) => api.login(email.value || 'asitha@company.example', name).catch((e) => toast(e.message));
  const form = el('form', { class: 'form', onSubmit: (e) => { e.preventDefault(); signIn(); } }, [
    el('div', { class: 'field' }, [el('label', { for: 'login-email', text: 'Work email' }), email]),
    el('div', { class: 'field' }, [el('label', { for: 'login-pw', text: 'Password' }), pw]),
    Button({ variant: 'primary', label: 'Sign in', type: 'submit' }),
  ]);
  return el('div', { class: 'center' }, [el('div', { class: 'login' }, [
    el('div', { class: 'brand' }, [el('i', null, [icon('beacon')]), 'Beacon']),
    el('p', { class: 'muted', text: 'Reliability operations for teams without a full-time SRE. Sign in to your workspace.' }),
    form, el('div', { class: 'hr' }),
    Button({ label: 'Continue with Microsoft Entra', onClick: () => signIn('asitha') }),
    el('p', { class: 'sm muted', text: 'Prototype. Any email and password sign you in. Nothing leaves this server.' }),
  ])]);
}

// docLinks points at the documentation from the setup pages: the model, then the exact steps per provider.
export function docLinks() {
  return el('p', { class: 'sm muted doclinks' }, ['Before you connect: ', el('a', { href: '#docs/model', text: 'how levels and cells work' }), ' · ', el('a', { href: '#docs/azure', text: 'Azure, step by step' }), ' · ', el('a', { href: '#docs/upcloud', text: 'UpCloud, step by step' }), ' · ', el('a', { href: '#docs/howto', text: 'all how-tos' })]);
}

function stepsBar(n) {
  const names = ['Sign in', 'Create tenant', 'Connect clouds', 'Onboard cells', 'Install probes'];
  return el('div', { class: 'steps' }, names.map((s, i) => el('span', { class: i < n ? 'done' : (i === n ? '' : 'muted') }, [i < n ? '✓ ' : (i + 1) + '. ', i === n ? el('b', { text: s }) : s])));
}

export function pageSetupTenant() {
  const name = el('input', { id: 'tenant-name', placeholder: 'Shop AS', value: 'Shop AS' });
  const env = el('select', { id: 'tenant-env' }, [el('option', { text: 'production' }), el('option', { text: 'staging' })]);
  const region = el('select', { id: 'tenant-region' }, [el('option', { text: 'EU, Finland (UpCloud fi-hel2)' }), el('option', { text: 'EU, Netherlands (Azure westeurope)' })]);
  const form = el('form', { class: 'form', onSubmit: (e) => { e.preventDefault(); api.createTenant({ name: name.value, env: env.value, region: region.value }).then(() => go('findings')).catch((x) => toast(x.message)); } }, [
    el('div', { class: 'field' }, [el('label', { for: 'tenant-name', text: 'Tenant name' }), name]),
    el('div', { class: 'field' }, [el('label', { for: 'tenant-env', text: 'First environment' }), env]),
    el('div', { class: 'field' }, [el('label', { for: 'tenant-region', text: 'Where the Beacon cell runs' }), region]),
    el('p', { class: 'sm muted', text: 'The tenant gets its own runtime: isolated workers, its own credentials, one static egress address you can allowlist.' }),
    el('p', { class: 'sm muted' }, ['New to Beacon? Read ', el('a', { href: '#docs/model', text: 'how Beacon reaches your infrastructure' }), ' first.']),
    Button({ variant: 'primary', label: 'Create tenant', type: 'submit' }),
  ]);
  return el('div', { class: 'page' }, [stepsBar(1), el('h1', { class: 'display', text: 'Create your tenant' }), el('div', { class: 'card lg' }, [form])]);
}

export { connChip } from '../connections.js';

export function pageSetupConnect() {
  const s = store.state; const pr = s.probe;
  const azConns = sel.conns('azure'), ucConns = sel.conns('upcloud');
  const azCard = azConns.length ? el('div', { class: 'conn' }, azConns.map((c) => connectionCard(c))) : el('div', { class: 'card conn' }, [el('div', { class: 'conn-head' }, [el('span', { class: 'name', text: 'Microsoft Azure' }), connChip('none')]), azureForm()]);
  const ucCard = ucConns.length ? el('div', { class: 'conn' }, ucConns.map((c) => connectionCard(c))) : el('div', { class: 'card conn' }, [el('div', { class: 'conn-head' }, [el('span', { class: 'name', text: 'UpCloud' }), connChip('none')]), upcloudForm()]);
  const cells = s.cells; const pending = cells.filter((c) => c.probeCapable && c.tier !== 'probe');
  const rt = s.tenant ? s.tenant.runtime : 'runtime';
  const cmd = `curl -fsSL https://probe.beacon.example/install.sh | sh -s -- \\\n  --runtime ${rt} --gateway ${rt}.beacon.example:4317 --enroll-token bpt_6f2a…`;
  const step = !cells.length ? (sel.connected('azure') || sel.connected('upcloud') ? 3 : 2) : (pr.status === 'online' || !pending.length ? 5 : 4);
  const agentCard = cells.length ? el('div', { class: 'card conn' }, [
    el('div', { class: 'conn-head' }, [el('span', { class: 'name', text: 'Install the probe on your cells' }), el('span', { class: 'sm muted', text: `${cells.length} cell${cells.length === 1 ? '' : 's'} onboarded · ${s.probe.hosts.length} probe${s.probe.hosts.length === 1 ? '' : 's'} online` })]),
    el('p', { class: 'sm muted', text: 'Every cell starts at the basic tier: provider sensors and provider actions. The probe is an unmodified OpenTelemetry Collector that dials out to the runtime over mTLS; it raises a cell to the probe tier with in-guest metrics, logs, files and commands.' }),
    el('div', { class: 'code', text: cmd }),
    pending.length && pr.status !== 'waiting' ? el('div', { class: 'bc-row' }, [Button({ variant: 'primary', label: `I ran it on ${pending.map((c) => c.id).join(', ')}`, onClick: () => api.installProbe().catch((e) => toast(e.message)) })])
      : pr.status === 'waiting' ? el('p', { class: 'muted', text: `Waiting for probes to dial in… ${pr.hosts.length} of ${pr.expected.length} online.` })
        : el('div', { class: 'bc-row' }, cells.map((c) => el('span', { class: 'bc-pill ' + (c.tier === 'probe' ? 'bc-pill-available' : 'bc-pill-none'), text: c.id + ' · ' + c.tier }))),
  ]) : null;
  const done = cells.length > 0 && !pending.length;
  return el('div', { class: 'page' }, [stepsBar(step), el('h1', { class: 'display', text: 'Connect your clouds' }),
    el('p', { class: 'muted', text: 'A connection is an identity at a scope. It discovers what Beacon could manage; you choose what becomes a cell.' }),
    docLinks(),
    el('div', { class: 'split' }, [azCard, ucCard]), agentCard,
    done ? el('div', { class: 'bc-row' }, [Button({ variant: 'primary', label: 'Go to findings', onClick: () => go('findings') })]) : null]);
}
