// A small Markdown renderer for runbooks: headings, lists, paragraphs, inline code. Builds DOM, never HTML strings.
import { el } from './ds.js';
function inline(text) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((p) => p.startsWith('`') && p.endsWith('`') ? el('code', { text: p.slice(1, -1) }) : document.createTextNode(p));
}
export function markdown(src) {
  const root = el('div', { class: 'md' });
  let list = null; let para = [];
  const flushPara = () => { if (para.length) { root.appendChild(el('p', null, inline(para.join(' ')))); para = []; } };
  const flushList = () => { list = null; };
  (src || '').split('\n').forEach((raw) => {
    const line = raw.trimEnd();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (!line) { flushPara(); flushList(); return; }
    if (h) { flushPara(); flushList(); root.appendChild(el(h[1].length === 1 ? 'h3' : 'h4', null, inline(h[2]))); return; }
    if (ul || ol) { flushPara(); const tag = ul ? 'ul' : 'ol'; if (!list || list.tagName.toLowerCase() !== tag) { list = el(tag); root.appendChild(list); } list.appendChild(el('li', null, inline((ul || ol)[1]))); return; }
    flushList(); para.push(line);
  });
  flushPara();
  return root;
}
