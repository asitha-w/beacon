import { el, Button } from '../ds.js';
import { icon } from '../icons.js';
import { store, sel } from '../store.js';
import { azureForm, upcloudForm, connectionCard, connChip, probeChip } from '../connections.js';
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

function stepsBar(n) {
  const names = ['Sign in', 'Create tenant', 'Connect clouds', 'Install probe'];
  return el('div', { class: 'steps' }, names.map((s, i) => el('span', { class: i < n ? 'done' : (i === n ? '' : 'muted') }, [i < n ? '✓ ' : (i + 1) + '. ', i === n ? el('b', { text: s }) : s])));
}

export function pageSetupTenant() {
  const name = el('input', { id: 'tenant-name', placeholder: 'Shop AS', value: 'Shop AS' });
  const env = el('select', { id: 'tenant-env' }, [el('option', { text: 'production' }), el('option', { text: 'staging' })]);
  const region = el('select', { id: 'tenant-region' }, [el('option', { text: 'EU, Finland (UpCloud fi-hel2)' }), el('option', { text: 'EU, Netherlands (Azure westeurope)' })]);
  const form = el('form', { class: 'form', onSubmit: (e) => { e.preventDefault(); api.createTenant({ name: name.value, env: env.value, region: region.value }).then(() => go('setup-connect')).catch((x) => toast(x.message)); } }, [
    el('div', { class: 'field' }, [el('label', { for: 'tenant-name', text: 'Tenant name' }), name]),
    el('div', { class: 'field' }, [el('label', { for: 'tenant-env', text: 'First environment' }), env]),
    el('div', { class: 'field' }, [el('label', { for: 'tenant-region', text: 'Where the Beacon cell runs' }), region]),
    el('p', { class: 'sm muted', text: 'A cell is your own isolated worker set: its own network, its own credentials, one static egress address you can allowlist.' }),
    Button({ variant: 'primary', label: 'Create tenant', type: 'submit' }),
  ]);
  return el('div', { class: 'page' }, [stepsBar(1), el('h1', { class: 'display', text: 'Create your tenant' }), el('div', { class: 'card lg' }, [form])]);
}

export { connChip, probeChip } from '../connections.js';

export function pageSetupConnect() {
  const s = store.state; const pr = s.probe;
  const azConns = sel.conns('azure'), ucConns = sel.conns('upcloud');
  const azCard = azConns.length ? el('div', { class: 'conn' }, azConns.map((c) => connectionCard(c))) : el('div', { class: 'card conn' }, [el('div', { class: 'conn-head' }, [el('span', { class: 'name', text: 'Microsoft Azure' }), connChip('none')]), azureForm()]);
  const ucCard = ucConns.length ? el('div', { class: 'conn' }, ucConns.map((c) => connectionCard(c))) : el('div', { class: 'card conn' }, [el('div', { class: 'conn-head' }, [el('span', { class: 'name', text: 'UpCloud' }), connChip('none')]), upcloudForm()]);
  const both = sel.connected('azure') && sel.connected('upcloud');
  const cell = s.tenant ? s.tenant.cell : 'cell';
  const cmd = `curl -fsSL https://probe.beacon.example/install.sh | sh -s -- \\\n  --tenant ${cell} --gateway probe-${cell}.beacon.example:4317 \\\n  --enroll-token bpt_6f2a…`;
  const prCard = el('div', { class: 'card conn' }, [
    el('div', { class: 'conn-head' }, [el('span', { class: 'name', text: 'Beacon probe' }), probeChip(pr.status)]),
    el('p', { class: 'sm muted', text: 'An unmodified OpenTelemetry Collector with a Beacon config. It dials out to your cell over mTLS; nothing listens on the host. Needed for memory, disk and logs on VMs, and for everything inside UpCloud servers.' }),
    el('div', { class: 'code', text: cmd }),
    el('div', { class: 'code', text: `helm install beacon-probe oci://probe.beacon.example/charts/probe --set tenant=${cell}` }),
    pr.status === 'none' ? Button({ variant: 'primary', label: 'I ran it, wait for probes', disabled: !both, onClick: () => api.installProbe().catch((e) => toast(e.message)) })
      : pr.status === 'waiting' ? el('p', { class: 'muted', text: `Waiting for probes to dial in… ${pr.hosts.length} of ${pr.expected.length} online.` })
        : el('div', { class: 'bc-row' }, pr.hosts.map((h) => el('span', { class: 'bc-pill bc-pill-available', text: h + ' online' }))),
  ]);
  const done = pr.status === 'online';
  return el('div', { class: 'page' }, [stepsBar(done ? 4 : (both ? 3 : 2)), el('h1', { class: 'display', text: 'Connect your clouds' }),
    el('p', { class: 'muted', text: 'Each connection is an identity, a credential, a scope and a network path. Beacon lists the roles it actually holds and shows exactly what it can see and do before it watches anything.' }),
    el('div', { class: 'split' }, [azCard, ucCard]), prCard,
    done ? el('div', { class: 'bc-row' }, [Button({ variant: 'primary', label: 'Go to findings', onClick: () => go('findings') })]) : null]);
}
