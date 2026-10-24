import { h, bind, field, section, btn, iconBtn, icon, pageHead, empty, tabs, modal, esc, eighths, printDoc, toast } from '../util.js';
import { orphanKeys, keyLabel, migrateKeys } from '../scenes.js';

export const CATS = [
  ['cast', 'Cast', '#e05a4f'], ['extras', 'Figuratie', '#4caf6e'], ['stunts', 'Stunts', '#ee8a2a'], ['props', 'Rekwisieten', '#9a74d8'],
  ['wardrobe', 'Kostuum', '#3a9fd0'], ['makeup', 'Grime & haar', '#e277a8'], ['setdressing', 'Decor & aankleding', '#b08a5a'], ['vehicles', 'Voertuigen', '#d65fa0'],
  ['animals', 'Dieren', '#8fb33a'], ['sfx', 'Special effects', '#2f7fd8'], ['vfx', 'VFX', '#25b5b0'], ['sound', 'Geluid & muziek', '#c9a227'],
  ['equipment', 'Speciale apparatuur', '#7a8597'], ['security', 'Beveiliging / verkeer', '#a0522d'],
];

let sel = null;
let view = 'scene';

/** Definitieve cast van een scène: automatisch uit het scenario, min uitgesloten, plus handmatig toegevoegd. */
export function sceneCast(p, s) {
  const d = p.breakdown[s.key];
  const ex = new Set(d?.castExclude || []);
  return [...new Set([...s.cast.filter((c) => !ex.has(c)), ...(d?.items?.cast || [])])];
}

export function sceneData(p, key) {
  const d = p.breakdown[key] ??= { items: {}, notes: '', extrasCount: '', hours: '' };
  d.items ??= {};
  return d;
}

export default {
  id: 'breakdown', title: 'Breakdown', icon: 'tag', group: 'Pre-productie',
  render(root, ctx) {
    const p = ctx.project;
    const parsed = ctx.parsed();
    const orphans = orphanKeys(p, parsed);
    root.append(pageHead('Scène-breakdown', 'Markeer per scène alles wat nodig is: cast, rekwisieten, kostuum, voertuigen, effecten… De basis voor draaischema, budget en callsheets.',
      btn('Breakdown-sheets afdrukken', () => printSheets(p, parsed, ctx), { icon: 'print' }),
      btn('AI-voorstel', () => ctx.openAI('Maak een breakdown-voorstel per scène: cast, figuratie, rekwisieten, kostuum, grime, voertuigen, effecten en bijzonderheden. Gebruik een overzichtelijke lijst per scène.'), { icon: 'sparkles', class: 'ghost' })),
    tabs([['scene', 'Per scène'], ['report', 'Overzicht per element'], ...(orphans.length ? [['orphans', `Losgeraakt (${orphans.length})`]] : [])], view, (v) => { view = v; ctx.rerender(); }));
    if (!parsed.scenes.length) { root.append(empty('Nog geen scènes in het scenario.', btn('Naar scenario', () => ctx.go('scenario'), { icon: 'pen' }))); return; }
    if (view === 'report') return report(root, ctx, p, parsed);
    if (view === 'orphans' && orphans.length) return orphanView(root, ctx, p, parsed, orphans);

    if (!parsed.scenes.find((s) => s.key === sel)) sel = parsed.scenes[0].key;
    const list = h('div', { class: 'card stack tight' }, parsed.scenes.map((s) => {
      const d = p.breakdown[s.key];
      const n = d ? Object.values(d.items).reduce((a, l) => a + l.length, 0) : 0;
      return h('div', { class: 'list-item' + (s.key === sel ? ' active' : ''), onclick: () => { sel = s.key; ctx.rerender(); } },
        h('span', { class: 'mono', style: { minWidth: '26px', color: 'var(--accent)' } }, s.num),
        h('div', { style: { minWidth: 0, flex: 1 } }, h('div', { style: { fontSize: '.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, s.location || s.heading),
          h('small', { class: 'muted' }, `${s.ie} · ${s.dn === 'N' ? 'nacht' : 'dag'} · ${eighths(s.eighths)} p`)),
        n ? h('span', { class: 'badge green' }, n) : h('span', { class: 'badge' }, '–'));
    }));
    const s = parsed.scenes.find((x) => x.key === sel);
    root.append(h('div', { class: 'master' }, list, sceneDetail(ctx, p, parsed, s)));
  },
};

function sceneDetail(ctx, p, parsed, s) {
  const d = sceneData(p, s.key);
  const lines = p.script.text.replace(/\r\n?/g, '\n').split('\n').slice(s.line, s.endLine + 1).join('\n').trim();
  const allTagged = new Set(Object.values(d.items).flat().map((x) => x.toUpperCase()));
  const charNames = new Set(Object.keys(parsed.characters));
  // Woorden in HOOFDLETTERS in de actie zijn vaak rekwisieten/elementen: klikbaar maken.
  const html = esc(lines).replace(/(?<![\p{L}\p{N}])(\p{Lu}[\p{Lu}\p{N}'’-]+(?:[ ]\p{Lu}[\p{Lu}\p{N}'’-]+)*)(?![\p{L}\p{N}])/gu, (m) => {
    if (/^(INT|EXT|DAG|NACHT|AVOND|OCHTEND|DAGERAAD|CONT'D|V\.O|O\.S)$/.test(m) || m.length < 3) return m;
    if (charNames.has(m)) return `<mark data-w="${m}" data-c="cast" style="background:transparent;color:inherit">${m}</mark>`;
    return `<mark data-w="${m}" title="Klik om toe te voegen aan de breakdown"${allTagged.has(m) ? ' style="opacity:.55"' : ''}>${m}</mark>`;
  });
  const text = h('div', { class: 'scene-text', html });
  text.addEventListener('click', (e) => {
    const mk = e.target.closest('mark');
    if (!mk || mk.dataset.c === 'cast') return;
    const word = mk.dataset.w.toLowerCase().replace(/^./, (c) => c.toUpperCase());
    modal({
      title: `“${word}” toevoegen als…`,
      body: (close) => h('div', { class: 'chips' }, CATS.filter(([k]) => k !== 'cast').map(([k, l, c]) => h('button', { class: 'chip', type: 'button', style: { borderColor: c }, onclick: () => {
        (d.items[k] ??= []).includes(word) || d.items[k].push(word); ctx.save(); close(); ctx.rerender();
      } }, l))),
    });
  });

  const cast = s.cast;
  const allItems = (k) => [...new Set(Object.values(p.breakdown).flatMap((b) => b.items?.[k] || []))];
  return h('div', { class: 'stack' },
    h('div', { class: 'card' },
      h('div', { class: 'row wrap' }, h('h2', {}, `${s.num}. ${s.heading}`), h('div', { class: 'spacer' }),
        h('span', { class: 'badge' }, s.ie || '?'), h('span', { class: 'badge ' + (s.dn === 'N' ? 'blue' : 'amber') }, s.dn === 'N' ? 'Nacht' : 'Dag'), h('span', { class: 'badge' }, `${eighths(s.eighths)} pag.`), h('span', { class: 'badge' }, `p. ${s.page}`)),
      s.synopsis.length ? h('p', { class: 'muted', style: { marginTop: '8px' } }, s.synopsis.join(' ')) : null,
      h('details', { style: { marginTop: '8px' } }, h('summary', { class: 'muted small', style: { cursor: 'pointer' } }, 'Scènetekst (klik op woorden in HOOFDLETTERS om ze toe te voegen)'), text)),
    h('div', { class: 'grid g3' },
      CATS.map(([k, label, color]) => {
        const items = d.items[k] ??= [];
        const inp = h('input', { placeholder: '+ toevoegen', list: 'bd-' + k });
        const add = () => { const v = inp.value.trim(); if (v && !items.includes(v)) { items.push(v); ctx.save(); ctx.rerender(); } };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
        d.castExclude ??= [];
        const auto = k === 'cast' ? cast.filter((c) => !items.includes(c)) : [];
        return h('div', { class: 'card bd-cat', style: { '--c': color, padding: '10px 12px' } },
          h('h4', {}, label),
          h('div', { class: 'chips' },
            auto.map((c) => {
              const off = d.castExclude.includes(c);
              return h('span', { class: 'chip', style: off ? { opacity: 0.45, textDecoration: 'line-through' } : null, title: off ? 'Uitgesloten — klik om weer mee te nemen' : 'Automatisch uit het scenario (spreekt of komt voor in de actie)' }, c,
                h('span', { class: 'x', title: off ? 'Weer meenemen' : 'Niet nodig in deze scène', onclick: () => {
                  if (off) d.castExclude.splice(d.castExclude.indexOf(c), 1); else d.castExclude.push(c);
                  ctx.save(); ctx.rerender();
                } }, icon(off ? 'plus' : 'x', 12)));
            }),
            items.map((it) => h('span', { class: 'chip' }, it, h('span', { class: 'x', title: 'Verwijderen', onclick: () => { items.splice(items.indexOf(it), 1); ctx.save(); ctx.rerender(); } }, icon('x', 12))))),
          h('div', { class: 'bd-add' }, inp, h('datalist', { id: 'bd-' + k }, allItems(k).map((x) => h('option', { value: x })))));
      })),
    section('Overig',
      h('div', { class: 'grid g4' },
        field('Verhaaldag', bind(d, 'storyDay', ctx, { placeholder: 'bijv. D1, N1, D2', list: 'story-days' }), 'Voor continuïteit van kostuum, grime en rekwisieten'),
        h('datalist', { id: 'story-days' }, [...new Set(Object.values(p.breakdown).map((b) => b.storyDay).filter(Boolean))].sort().map((x) => h('option', { value: x }))),
        field('Aantal figuranten', bind(d, 'extrasCount', ctx, { type: 'number', min: 0 })),
        field('Geschatte draaitijd (uur)', bind(d, 'hours', ctx, { type: 'number', min: 0, step: 0.25 }), 'Vuistregel: ±4–5 uur per pagina bij een speelfilm'),
        field('Notities voor afdelingen', bind(d, 'notes', ctx, { type: 'textarea', rows: 2 }), null))));
}

function report(root, ctx, p, parsed) {
  const keyToScene = Object.fromEntries(parsed.scenes.map((s) => [s.key, s]));
  root.append(h('div', { class: 'grid g2' }, CATS.map(([k, label, color]) => {
    const map = {};
    if (k === 'cast') parsed.scenes.forEach((s) => sceneCast(p, s).forEach((c) => (map[c] ??= new Set()).add(s.key)));
    Object.entries(p.breakdown).forEach(([key, d]) => (d.items?.[k] || []).forEach((it) => (map[it] ??= new Set()).add(key)));
    const rows = Object.entries(map).sort((a, b) => b[1].size - a[1].size);
    if (!rows.length) return null;
    return h('div', { class: 'card bd-cat', style: { '--c': color } }, h('h4', {}, `${label} (${rows.length})`),
      h('table', { class: 'tbl' }, h('tbody', {}, rows.map(([it, keys]) => h('tr', {}, h('td', {}, it),
        h('td', { class: 'muted small' }, [...keys].map((kk) => keyToScene[kk]?.num ?? '?').join(', ')), h('td', { class: 'num' }, keys.size))))));
  })));
}

function orphanView(root, ctx, p, parsed, orphans) {
  root.append(section('Gegevens zonder scène',
    h('p', { class: 'muted' }, 'Deze breakdown-, shot- of planningsgegevens horen bij een scène die niet meer in het scenario staat (kop gewijzigd of scène verwijderd). Koppel ze aan de juiste scène of verwijder ze.'),
    h('table', { class: 'tbl' }, h('tbody', {}, orphans.map((k) => {
      const sel = h('select', {}, h('option', { value: '' }, '— kies scène —'), parsed.scenes.map((s) => h('option', { value: s.key }, `${s.num}. ${s.heading}`)));
      return h('tr', {}, h('td', {}, keyLabel(k)),
        h('td', { class: 'muted small' }, [p.breakdown[k] ? 'breakdown' : '', p.shots[k]?.length ? `${p.shots[k].length} shots` : '', p.schedule.days.some((d) => d.scenes.includes(k)) ? 'draaischema' : ''].filter(Boolean).join(', ')),
        h('td', {}, sel),
        h('td', { class: 'right nowrap' },
          btn('Koppelen', () => {
            if (!sel.value) return;
            if (p.breakdown[sel.value] && p.breakdown[k]) {
              const tgt = p.breakdown[sel.value], src = p.breakdown[k];
              Object.entries(src.items || {}).forEach(([c, l]) => { tgt.items[c] = [...new Set([...(tgt.items[c] || []), ...l])]; });
              tgt.notes = [tgt.notes, src.notes].filter(Boolean).join('\n');
              delete p.breakdown[k];
            }
            if (p.shots[sel.value]?.length && p.shots[k]) { p.shots[sel.value].push(...p.shots[k]); delete p.shots[k]; }
            p.schedule.days.forEach((d) => { if (d.scenes.includes(k) && d.scenes.includes(sel.value)) d.scenes = d.scenes.filter((x) => x !== k); });
            migrateKeys(p, { [k]: sel.value }); ctx.save(); ctx.rerender(); toast('Gekoppeld');
          }, { class: 'sm primary' }),
          iconBtn('trash', 'Verwijderen', () => { delete p.breakdown[k]; delete p.shots[k]; p.schedule.days.forEach((d) => { d.scenes = d.scenes.filter((x) => x !== k); }); ctx.save(); ctx.rerender(); }, 'danger')));
    })))));
}

function printSheets(p, parsed, ctx) {
  const cn = ctx.castNumbers();
  const html = parsed.scenes.map((s) => {
    const d = p.breakdown[s.key] || { items: {} };
    const cast = sceneCast(p, s);
    const cells = CATS.filter(([k]) => k !== 'cast').map(([k, l, c]) => `<div class="box" style="border-left:5px solid ${c}"><b>${l}</b><br>${(d.items?.[k] || []).map(esc).join('<br>') || '<span class="muted">—</span>'}</div>`).join('');
    return `<div class="pb"><table><tr><th>Productie</th><td>${esc(p.meta.title)}</td><th>Scène</th><td><b>${esc(s.num)}</b></td><th>Pagina’s</th><td>${eighths(s.eighths)}</td></tr>
      <tr><th>Kop</th><td colspan="3"><b>${esc(s.heading)}</b></td><th>INT/EXT · D/N</th><td>${s.ie} · ${s.dn === 'N' ? 'Nacht' : 'Dag'}</td></tr>
      <tr><th>Synopsis</th><td colspan="5">${esc(s.synopsis.join(' '))}</td></tr></table>
      <div class="grid2"><div class="box" style="border-left:5px solid #e05a4f"><b>Cast</b><br>${cast.map((c) => `${cn[c] ? cn[c] + '. ' : ''}${esc(c)}`).join('<br>') || '—'}</div>
      <div class="box"><b>Figuratie</b>: ${esc(String(d.extrasCount || '—'))}<br><b>Geschatte draaitijd</b>: ${esc(String(d.hours || '—'))} uur<br><b>Notities</b>: ${esc(d.notes || '')}</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8pt;margin-top:8pt">${cells}</div></div>`;
  }).join('');
  printDoc(`${p.meta.title} — breakdown`, html, '.box{font-size:9.5pt;min-height:40pt}');
}
