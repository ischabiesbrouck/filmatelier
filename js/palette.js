// Zoek- en opdrachtpalet (Ctrl+K): spring naar onderdelen, scènes, personages, locaties, ideeën, taken en voer acties uit.

import { h, icon } from './util.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function collect(ctx, modules, actions) {
  const p = ctx.project;
  const parsed = ctx.parsed();
  const items = [];
  const add = (type, ico, label, sub, run) => items.push({ type, ico, label, sub, run, key: norm(label + ' ' + (sub || '')) });
  actions.forEach(([label, ico, run]) => add('Actie', ico, label, '', run));
  modules.forEach((m) => add('Onderdeel', m.icon, m.title, m.group, () => ctx.go(m.id)));
  parsed.scenes.forEach((s) => add('Scène', 'pen', `${s.num}. ${s.heading}`, s.synopsis.join(' '), () => { sessionStorage.setItem('fa.jump', String(s.line)); ctx.go('scenario'); if (ctx.route === 'scenario') ctx.rerender(); }));
  p.characters.forEach((c) => add('Personage', 'users', c.name, [c.role, c.want].filter(Boolean).join(' · '), () => { sessionStorage.setItem('fa.selchar', c.id); ctx.go('personages'); if (ctx.route === 'personages') ctx.rerender(); }));
  p.locations.forEach((l) => add('Locatie', 'pin', l.name, l.address, () => { sessionStorage.setItem('fa.selloc', l.id); ctx.go('locaties'); if (ctx.route === 'locaties') ctx.rerender(); }));
  p.people.forEach((x) => (x.name || x.role) && add('Cast & crew', 'id', x.name || x.role, [x.role, x.phone].filter(Boolean).join(' · '), () => ctx.go('mensen')));
  p.ideas.forEach((i) => add('Idee', 'bulb', i.text.split('\n')[0].slice(0, 90), i.tag, () => ctx.go('ideeen')));
  p.tasks.forEach((t) => add('Taak', 'check', t.title, `${t.phase}${t.status === 'klaar' ? ' · klaar' : ''}`, () => ctx.go('taken')));
  (p.writer?.docs || []).forEach((d) => add('Document', 'type', d.title || 'Naamloos document', d.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140), () => { sessionStorage.setItem('fa.seldoc', d.id); ctx.go('tekst'); if (ctx.route === 'tekst') ctx.rerender(); }));
  p.world.forEach((w) => add('Research', 'globe', w.title || '(zonder titel)', w.category, () => ctx.go('wereld')));
  return items;
}

export function openPalette({ ctx, modules, actions }) {
  if (document.querySelector('.palette')) return;
  const all = collect(ctx, modules, actions);
  const input = h('input', { type: 'search', placeholder: 'Zoek scènes, personages, locaties, taken… of typ een opdracht', 'aria-label': 'Zoeken', autocomplete: 'off', spellcheck: 'false' });
  const list = h('div', { class: 'pal-list', role: 'listbox' });
  let results = [], sel = 0;
  const prev = document.activeElement;
  const close = () => { ov.remove(); prev?.focus?.(); };
  const run = (it) => { close(); it?.run(); };

  const render = () => {
    const q = norm(input.value.trim());
    if (!q) results = all.filter((i) => i.type === 'Actie' || i.type === 'Onderdeel');
    else {
      const words = q.split(/\s+/);
      results = all.filter((i) => words.every((w) => i.key.includes(w)))
        .map((i) => ({ i, s: (norm(i.label).startsWith(words[0]) ? 0 : 1) + (i.type === 'Onderdeel' ? -0.5 : 0) }))
        .sort((a, b) => a.s - b.s).map((x) => x.i).slice(0, 40);
    }
    sel = Math.min(sel, Math.max(0, results.length - 1));
    let lastType = null;
    list.replaceChildren(...(results.length ? results.flatMap((it, n) => {
      const out = [];
      if (it.type !== lastType) { out.push(h('div', { class: 'pal-group' }, it.type)); lastType = it.type; }
      out.push(h('button', { type: 'button', role: 'option', 'aria-selected': String(n === sel), class: 'pal-item' + (n === sel ? ' sel' : ''), onmousemove: () => { if (sel !== n) { sel = n; render(); } }, onclick: () => run(it) },
        h('span', { class: 'pal-ico' }, icon(it.ico, 16)), h('span', { class: 'pal-text' }, h('b', {}, it.label), it.sub ? h('small', {}, it.sub.slice(0, 110)) : null),
        n === sel ? h('span', { class: 'kbd' }, '↵') : null));
      return out;
    }) : [h('div', { class: 'pal-empty' }, 'Niets gevonden.')]));
    list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
  };

  input.addEventListener('input', () => { sel = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  const ov = h('div', { class: 'modal-ov palette-ov', onmousedown: (e) => { if (e.target === ov) close(); } },
    h('div', { class: 'palette', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Zoeken en opdrachten' },
      h('div', { class: 'pal-search' }, icon('search', 18), input, h('span', { class: 'kbd' }, 'Esc')),
      list,
      h('div', { class: 'pal-foot' }, h('span', {}, h('span', { class: 'kbd' }, '↑↓'), ' kiezen'), h('span', {}, h('span', { class: 'kbd' }, '↵'), ' openen'), h('span', {}, `${all.length} items doorzoekbaar`))));
  document.body.append(ov);
  render();
  setTimeout(() => input.focus(), 20);
}
