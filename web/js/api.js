// Thin client for the Beacon API. Every call returns the parsed JSON body or throws.
async function send(method, path, body) {
  const res = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
export const api = {
  state: () => send('GET', '/api/state'),
  login: (email, name) => send('POST', '/api/login', { email, name }),
  logout: () => send('POST', '/api/logout'),
  createTenant: (t) => send('POST', '/api/tenant', t),
  createConnection: (body) => send('POST', '/api/connections', body),
  deleteConnection: (id) => send('DELETE', `/api/connections/${id}`),
  saveApp: (app) => send('POST', '/api/apps', app),
  deleteApp: (id) => send('DELETE', `/api/apps/${id}`),
  saveRunbook: (rb) => send('POST', '/api/runbooks', rb),
  deleteRunbook: (id) => send('DELETE', `/api/runbooks/${id}`),
  setLabels: (id, labels) => send('POST', `/api/resources/${id}/labels`, { labels }),
  installProbe: () => send('POST', '/api/probe/install'),
  decide: (id, decision) => send('POST', `/api/approvals/${id}`, { decision }),
  chat: (question) => send('POST', '/api/chat', { question }),
  ask: (runId, question) => send('POST', `/api/runs/${runId}/ask`, { question }),
  responderMode: (id, mode) => send('POST', `/api/responders/${id}`, { mode }),
  agent: (id, patch) => send('POST', `/api/agents/${id}`, patch),
  startScenario: (id) => send('POST', `/api/scenarios/${id}/start`),
  reset: () => send('POST', '/api/reset'),
};
// Opens the event stream. onEvent gets every decoded event; reconnects on drop.
export function connect(onEvent, onStatus) {
  let es;
  function open() {
    es = new EventSource('/api/events');
    es.onopen = () => onStatus && onStatus('open');
    es.onmessage = (m) => { try { onEvent(JSON.parse(m.data)); } catch (e) { console.error('bad event', e); } };
    es.onerror = () => { onStatus && onStatus('reconnecting'); };
  }
  open();
  return () => es && es.close();
}
