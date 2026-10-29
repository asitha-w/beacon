/* @ds-bundle: {"format":4,"namespace":"Beacon","components":[{"name":"Button"},{"name":"SeverityChip"},{"name":"StatusChip"},{"name":"StatRow"},{"name":"EvidenceTable"},{"name":"CausalChain"},{"name":"ApprovalCard"},{"name":"CapabilityList"}]} */
(function () {
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (attrs[k] === true) n.setAttribute(k, '');
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c == null) return; n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function Button(p) {
    p = p || {};
    return el('button', { class: 'bc-btn bc-btn-' + (p.variant || 'quiet'), type: 'button', disabled: !!p.disabled, onClick: p.onClick }, [p.label || '']);
  }
  var sevWords = { critical: 'Critical', warning: 'Warning', info: 'Info', ok: 'Healthy' };
  function SeverityChip(p) {
    p = p || {}; var s = p.severity || 'info';
    return el('span', { class: 'bc-chip bc-chip-' + s, text: p.label || sevWords[s] || s });
  }
  var statusTone = { open: 'critical', investigating: 'info', 'awaiting-approval': 'approve', resolved: 'ok', verified: 'ok', escalated: 'warning', unverified: 'neutral' };
  var statusWords = { open: 'Open', investigating: 'Investigating', 'awaiting-approval': 'Awaiting approval', resolved: 'Resolved', verified: 'Verified', escalated: 'Escalated', unverified: 'Unverified' };
  function StatusChip(p) {
    p = p || {}; var s = p.status || 'open';
    return el('span', { class: 'bc-chip bc-chip-' + (statusTone[s] || 'neutral'), text: p.label || statusWords[s] || s });
  }
  function StatRow(p) {
    p = p || {};
    return el('div', { class: 'bc-stat' }, (p.items || []).map(function (it) {
      if (typeof it === 'string') return el('span', { text: it });
      return el('span', null, [el('b', { text: it.value }), ' ' + (it.label || '')]);
    }));
  }
  function EvidenceTable(p) {
    p = p || {};
    var head = el('thead', null, [el('tr', null, [el('th', { text: 'Source' }), el('th', { text: 'Observed' }), el('th', { text: 'Pointer' })])]);
    var body = el('tbody', null, (p.rows || []).map(function (r) {
      var ptr = r.href ? el('a', { href: r.href, text: r.pointer }) : document.createTextNode(r.pointer || '');
      return el('tr', null, [el('td', { class: 'bc-kind', text: r.kind || '' }), el('td', { text: r.claim || '' }), el('td', { class: 'bc-ptr' }, [ptr])]);
    }));
    return el('table', { class: 'bc-evidence' }, [head, body]);
  }
  function arrow() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('class', 'bc-chain-arrow'); svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M2 8h10M8 4l4 4-4 4'); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.5');
    svg.appendChild(path); return svg;
  }
  function CausalChain(p) {
    p = p || {}; var steps = p.steps || []; var out = [];
    steps.forEach(function (s, i) {
      if (i > 0) out.push(arrow());
      out.push(el('div', { class: 'bc-chain-step' + (s.severity ? ' bc-sev-' + s.severity : '') }, [el('time', { text: s.time || '' }), s.text || '']));
    });
    return el('div', { class: 'bc-chain', role: 'list' }, out);
  }
  function ApprovalCard(p) {
    p = p || {};
    return el('div', { class: 'bc-approval', role: 'group', 'aria-label': 'Approval request' }, [
      el('h3', { text: p.finding || '' }),
      el('span', { class: 'bc-eyebrow', text: 'Proposed action' }),
      el('div', { class: 'bc-action', text: p.action || '' }),
      el('span', { class: 'bc-eyebrow', text: 'Blast radius' }),
      el('p', { class: 'bc-blast', text: p.blastRadius || '' }),
      el('div', { class: 'bc-buttons' }, [
        Button({ variant: 'primary', label: p.approveLabel || 'Approve', disabled: !p.canApprove, onClick: p.onApprove }),
        Button({ variant: 'quiet', label: 'Deny', disabled: !p.canApprove, onClick: p.onDeny }),
        el('span', { class: 'bc-who', text: p.canApprove ? 'You can approve this.' : 'Administrators approve this.' })
      ])
    ]);
  }
  var pillWords = { available: 'Available', missing: 'Missing permission', none: 'Not offered' };
  function CapabilityList(p) {
    p = p || {};
    return el('ul', { class: 'bc-caps' }, (p.items || []).map(function (it) {
      var st = it.state || 'none';
      return el('li', null, [
        el('span', { class: 'bc-cap-name', text: it.name || '' }),
        it.detail ? el('span', { class: 'bc-cap-detail', text: it.detail }) : null,
        el('span', { class: 'bc-pill bc-pill-' + st, text: pillWords[st] || st })
      ]);
    }));
  }
  var w = window; w.Beacon = w.Beacon || {};
  Object.assign(w.Beacon, { Button: Button, SeverityChip: SeverityChip, StatusChip: StatusChip, StatRow: StatRow, EvidenceTable: EvidenceTable, CausalChain: CausalChain, ApprovalCard: ApprovalCard, CapabilityList: CapabilityList, el: el });
})();
