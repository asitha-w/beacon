import { el, Button, StatusChip, CapabilityList } from '../ds.js';
import { store } from '../store.js';
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
    el('div', { class: 'brand' }, [el('i'), 'Beacon']),
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

export function connChip(s) { return s === 'connected' ? StatusChip({ status: 'verified', label: 'Connected' }) : s === 'validating' ? StatusChip({ status: 'investigating', label: 'Validating' }) : StatusChip({ status: 'unverified', label: 'Not connected' }); }
export function probeChip(s) { return s === 'online' ? StatusChip({ status: 'verified', label: 'Online' }) : s === 'waiting' ? StatusChip({ status: 'investigating', label: 'Waiting' }) : StatusChip({ status: 'unverified', label: 'Not installed' }); }

export function pageSetupConnect() {
  const s = store.state; const az = s.connections.azure, uc = s.connections.upcloud, pr = s.probe;
  const sub = el('input', { id: 'az-sub', value: '7f3c21e0-5d2a-4b7e-9a11-0c3f1e2d8b44' });
  const tok = el('input', { id: 'uc-token', type: 'password', value: 'ucat_01J9…redacted' });
  const azCard = el('div', { class: 'card conn' }, [
    el('div', { class: 'conn-head' }, [el('span', { class: 'name', text: 'Microsoft Azure' }), connChip(az.status)]),
    az.status === 'none' ? el('div', { class: 'form' }, [
      el('div', { class: 'field' }, [el('label', { for: 'az-sub', text: 'Subscription id' }), sub]),
      el('p', { class: 'sm muted', text: 'You consent to the Beacon app in your Entra tenant and assign Reader on this subscription. No client secret is created.' }),
      Button({ variant: 'primary', label: 'Consent and validate', onClick: () => api.validate('azure', { subscription: sub.value }).catch((e) => toast(e.message)) }),
    ]) : az.status === 'validating' ? el('p', { class: 'muted', text: 'Validating identity, checking role assignment, listing capabilities…' }) : el('div', { class: 'conn' }, [
      el('dl', { class: 'kv' }, [el('dt', { text: 'Scope' }), el('dd', { text: az.scope }), el('dt', { text: 'Identity' }), el('dd', { text: az.identity })]),
      CapabilityList({ items: az.capabilities }),
    ]),
  ]);
  const ucCard = el('div', { class: 'card conn' }, [
    el('div', { class: 'conn-head' }, [el('span', { class: 'name', text: 'UpCloud' }), connChip(uc.status)]),
    uc.status === 'none' ? el('div', { class: 'form' }, [
      el('div', { class: 'field' }, [el('label', { for: 'uc-token', text: 'API token for a read-only sub-account' }), tok]),
      el('p', { class: 'sm muted', text: "Create a sub-account with read permissions and paste its token. Beacon stores it in the cell's secret store only." }),
      Button({ variant: 'primary', label: 'Validate token', onClick: () => api.validate('upcloud', { token: tok.value }).catch((e) => toast(e.message)) }),
    ]) : uc.status === 'validating' ? el('p', { class: 'muted', text: 'Validating token, listing servers and managed databases…' }) : el('div', { class: 'conn' }, [
      el('dl', { class: 'kv' }, [el('dt', { text: 'Scope' }), el('dd', { text: uc.scope }), el('dt', { text: 'Identity' }), el('dd', { text: uc.identity })]),
      CapabilityList({ items: uc.capabilities }),
    ]),
  ]);
  const cell = s.tenant ? s.tenant.cell : 'cell';
  const cmd = `curl -fsSL https://probe.beacon.example/install.sh | sh -s -- \\\n  --tenant ${cell} --gateway probe-${cell}.beacon.example:4317 \\\n  --enroll-token bpt_6f2a…`;
  const prCard = el('div', { class: 'card conn' }, [
    el('div', { class: 'conn-head' }, [el('span', { class: 'name', text: 'Beacon probe' }), probeChip(pr.status)]),
    el('p', { class: 'sm muted', text: 'An unmodified OpenTelemetry Collector with a Beacon config. It dials out to your cell over mTLS; nothing listens on the host. Needed for memory, disk and logs on VMs, and for everything inside UpCloud servers.' }),
    el('div', { class: 'code', text: cmd }),
    el('div', { class: 'code', text: `helm install beacon-probe oci://probe.beacon.example/charts/probe --set tenant=${cell}` }),
    pr.status === 'none' ? Button({ variant: 'primary', label: 'I ran it, wait for probes', disabled: az.status !== 'connected' || uc.status !== 'connected', onClick: () => api.installProbe().catch((e) => toast(e.message)) })
      : pr.status === 'waiting' ? el('p', { class: 'muted', text: `Waiting for probes to dial in… ${pr.hosts.length} of ${pr.expected.length} online.` })
        : el('div', { class: 'bc-row' }, pr.hosts.map((h) => el('span', { class: 'bc-pill bc-pill-available', text: h + ' online' }))),
  ]);
  const done = pr.status === 'online';
  return el('div', { class: 'page' }, [stepsBar(done ? 4 : (az.status === 'connected' && uc.status === 'connected' ? 3 : 2)), el('h1', { class: 'display', text: 'Connect your clouds' }),
    el('p', { class: 'muted', text: 'Each connection is an identity, a scope and a network path. Beacon shows exactly what it can see before it watches anything.' }),
    el('div', { class: 'split' }, [azCard, ucCard]), prCard,
    done ? el('div', { class: 'bc-row' }, [Button({ variant: 'primary', label: 'Go to findings', onClick: () => go('findings') })]) : null]);
}
