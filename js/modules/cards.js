import { h, btn, iconBtn, pageHead, empty, sortable, eighths, toast, modal, field } from '../util.js';
import { parse } from '../fountain.js';
import { migrateKeys, remapAfterInsert } from '../scenes.js';
import { sceneCast, sceneData } from './breakdown.js';

const TODS = ['DAG', 'NACHT', 'OCHTEND', 'AVOND', 'DAGERAAD', 'SCHEMERING', 'LATER', 'CONTINU'];

/** Dialoog om een scène vooraf als kaart aan te maken; schrijft kop + synopsis in het scenario. */
function newScene(ctx, p, parsed, after = null) {
  const ie = h('select', {}, ['INT.', 'EXT.', 'INT./EXT.'].map((x) => h('option', { value: x }, x)));
  const loc = h('input', { list: 'ns-locs', placeholder: 'bijv. KEUKEN' });
  const tod = h('select', {}, TODS.map((x) => h('option', { value: x }, x)));
  const syn = h('textarea', { rows: 3, placeholder: 'Wat gebeurt er in deze scène?' });
  const pos = h('select', {}, h('option', { value: 'end' }, 'Aan het eind'), parsed.scenes.map((s) => h('option', { value: String(s.index), selected: after === s.index }, `Na ${s.num}. ${s.heading}`)));
  const names = [...new Set([...Object.keys(parsed.characters), ...p.characters.map((c) => c.name.toUpperCase())])].sort();
  const checks = names.map((n) => { const cb = h('input', { type: 'checkbox', value: n }); return [cb, h('label', { class: 'check', style: { color: 'var(--text)' } }, cb, n)]; });
  modal({
    title: 'Nieuwe scène',
    body: h('div', { class: 'stack' },
      h('div', { class: 'grid g3' }, field('Binnen/buiten', ie), field('Locatie', loc), field('Tijd', tod)),
      h('datalist', { id: 'ns-locs' }, [...new Set(parsed.scenes.map((s) => s.location))].map((l) => h('option', { value: l }))),
      field('Synopsis', syn),
      names.length ? field('Personages in deze scène', h('div', { class: 'row wrap', style: { gap: '4px 14px' } }, checks.map((c) => c[1]))) : null,
      field('Plaats in het verhaal', pos)),
    actions: [{ label: 'Annuleren' }, { label: 'Scène aanmaken', primary: true, onClick: () => {
      if (!loc.value.trim()) { loc.focus(); return false; }
      const heading = `${ie.value} ${loc.value.trim().toUpperCase()} - ${tod.value}`;
      const lines = p.script.text.replace(/\r\n?/g, '\n').split('\n');
      const idx = pos.value === 'end' ? parsed.scenes.length : Number(pos.value) + 1;
      const at = pos.value === 'end' ? lines.length : parsed.scenes[Number(pos.value)].endLine + 1;
      const block = [heading, '', ...(syn.value.trim() ? syn.value.trim().split('\n').map((l) => '= ' + l.trim()) : [])];
      if (at > 0 && lines[at - 1]?.trim()) block.unshift('');
      if (at < lines.length && lines[at]?.trim()) block.push('');
      if (at >= lines.length) block.push('');
      lines.splice(at, 0, ...block);
      p.script.text = lines.join('\n');
      const np = remapAfterInsert(p, parsed, idx);
      const created = np.scenes[idx];
      const chosen = checks.filter(([cb]) => cb.checked).map(([cb]) => cb.value);
      if (created && chosen.length) {
        const d = sceneData(p, created.key);
        d.items.cast = [...new Set([...(d.items.cast || []), ...chosen.filter((n) => !created.cast.includes(n))])];
      }
      ctx.save(); ctx.rerender(); toast('Scène toegevoegd aan het scenario');
    } }],
  });
}

const CARD_COLORS = { '': '#c9c2b0', rood: '#e05a4f', oranje: '#ee9a3a', geel: '#e8c53a', groen: '#5cb176', blauw: '#4f8fd8', paars: '#9a74d8', roze: '#e277a8' };
let filterChar = '';
let filterLoc = '';

/** Verplaatst scène `from` naar positie `to` in de scripttekst en neemt gekoppelde gegevens mee. */
export function moveScene(p, from, to) {
  const before = parse(p.script.text);
  const lines = p.script.text.replace(/\r\n?/g, '\n').split('\n');
  const sc = before.scenes;
  const pre = lines.slice(0, sc[0].line);
  const blocks = sc.map((s) => {
    const b = lines.slice(s.line, s.endLine + 1);
    while (b.length && !b[b.length - 1].trim()) b.pop();
    return { key: s.key, lines: b };
  });
  // Tekst na de laatste scène die geen deel is van een scène (bijv. FADE OUT.) blijft bij de laatste scène horen.
  const [m] = blocks.splice(from, 1);
  blocks.splice(to, 0, m);
  p.script.text = [...pre, ...blocks.flatMap((b) => [...b.lines, ''])].join('\n');
  const after = parse(p.script.text);
  const map = {};
  blocks.forEach((b, i) => { if (after.scenes[i] && after.scenes[i].key !== b.key) map[b.key] = after.scenes[i].key; });
  // Twee-fase hernoemen om botsingen te vermijden
  const tmp = {}, fin = {};
  Object.entries(map).forEach(([a, b], i) => { tmp[a] = `tmp:${i}`; fin[`tmp:${i}`] = b; });
  migrateKeys(p, tmp); migrateKeys(p, fin);
}

function setSynopsis(p, scene, text) {
  const lines = p.script.text.replace(/\r\n?/g, '\n').split('\n');
  const body = lines.slice(scene.line + 1, scene.endLine + 1).filter((l) => !l.trim().startsWith('=') || /^={3,}$/.test(l.trim()));
  const syn = text.trim() ? text.trim().split('\n').map((l) => '= ' + l.trim()) : [];
  while (body.length && !body[0].trim()) body.shift();
  const block = [lines[scene.line], '', ...(syn.length ? [...syn, ''] : []), ...body];
  lines.splice(scene.line, scene.endLine - scene.line + 1, ...block);
  p.script.text = lines.join('\n');
}

export default {
  id: 'kaarten', title: 'Scènekaarten', icon: 'cards', group: 'Schrijven',
  render(root, ctx) {
    const p = ctx.project;
    p.script.sceneColors ??= {};
    const parsed = ctx.parsed();
    const chars = Object.keys(parsed.characters).sort();
    const locs = [...new Set(parsed.scenes.map((s) => s.location))].sort();
    root.append(pageHead('Scènekaarten', 'Je scènes als kaartjes op een prikbord. Maak vooraf kaarten aan om te outlinen, sleep om de volgorde in het scenario te veranderen; de synopsis (=-regel) schrijf je direct op de kaart.',
      btn('Nieuwe scène', () => newScene(ctx, p, parsed), { icon: 'plus', class: 'primary' }),
      btn('AI: volgorde-advies', () => ctx.openAI('Bekijk mijn scènelijst. Stel een sterkere volgorde voor en geef aan welke scènes geschrapt, samengevoegd of toegevoegd kunnen worden.'), { icon: 'sparkles', class: 'ghost' })));

    if (!parsed.scenes.length) { root.append(empty('Nog geen scènes. Maak een eerste scènekaart aan, of schrijf scènekoppen (bijv. “INT. KEUKEN - NACHT”) in het scenario.', h('div', { class: 'row', style: { justifyContent: 'center' } }, btn('Nieuwe scène', () => newScene(ctx, p, parsed), { icon: 'plus', class: 'primary' }), btn('Naar scenario', () => ctx.go('scenario'), { icon: 'pen' })))); return; }
    const allNames = [...new Set([...Object.keys(parsed.characters), ...p.characters.map((c) => c.name.toUpperCase())])].sort();

    const selC = h('select', { style: { width: 'auto' } }, h('option', { value: '' }, 'Alle personages'), chars.map((c) => h('option', { value: c }, c)));
    selC.value = filterChar; selC.onchange = () => { filterChar = selC.value; ctx.rerender(); };
    const selL = h('select', { style: { width: 'auto' } }, h('option', { value: '' }, 'Alle locaties'), locs.map((c) => h('option', { value: c }, c)));
    selL.value = filterLoc; selL.onchange = () => { filterLoc = selL.value; ctx.rerender(); };
    const filtering = filterChar || filterLoc;
    root.append(h('div', { class: 'row wrap', style: { marginBottom: '14px' } }, selC, selL,
      h('span', { class: 'muted small' }, filtering ? 'Slepen is uitgeschakeld tijdens filteren.' : `${parsed.scenes.length} scènes · ${parsed.pages} pagina’s`)));

    const board = h('div', { class: 'card-board' });
    parsed.scenes.forEach((s) => {
      const cast = sceneCast(p, s);
      if (filterChar && !cast.includes(filterChar)) return;
      if (filterLoc && s.location !== filterLoc) return;
      const col = p.script.sceneColors[s.key] || '';
      const syn = h('textarea', { rows: 3, placeholder: 'Wat gebeurt er? (synopsis)' });
      syn.value = s.synopsis.join('\n');
      syn.addEventListener('change', () => { setSynopsis(p, ctx.parsed().scenes[s.index], syn.value); ctx.save(); });
      const card = h('div', { class: 'icard', 'data-index': s.index, style: { '--c': CARD_COLORS[col] } },
        h('span', { class: 'no' }, s.num),
        h('div', { class: 'hd', draggable: filtering ? null : 'true', title: filtering ? null : 'Sleep aan de kop om te verplaatsen' }, s.heading),
        syn,
        cast.length ? h('div', { class: 'meta', style: { fontWeight: 600, color: '#444' } }, cast.join(' · ')) : null,
        h('div', { class: 'meta' },
          h('span', { title: cast.join(', ') }, `${s.ie} · ${s.dn === 'N' ? 'nacht' : 'dag'} · ${eighths(s.eighths)} p`),
          h('span', { class: 'row', style: { gap: 0 } },
            h('select', { class: 'card-ctl', title: 'Personage toewijzen', 'aria-label': 'Personage toewijzen', onchange: (e) => {
              const n = e.target.value; if (!n) return;
              const d = sceneData(p, s.key); d.items.cast = [...new Set([...(d.items.cast || []), n])];
              if (d.castExclude?.includes(n)) d.castExclude.splice(d.castExclude.indexOf(n), 1);
              ctx.save(); ctx.rerender();
            } }, h('option', { value: '' }, '+ rol'), allNames.filter((n) => !cast.includes(n)).map((n) => h('option', { value: n }, n))),
            iconBtn('plus', 'Nieuwe scène hierna', () => newScene(ctx, p, parsed, s.index)),
            h('select', { class: 'card-color', title: 'Kleurlabel', 'aria-label': 'Kleurlabel', style: { '--c': CARD_COLORS[col] }, onchange: (e) => { p.script.sceneColors[s.key] = e.target.value; ctx.save(); ctx.rerender(); } },
              Object.keys(CARD_COLORS).map((k) => h('option', { value: k, selected: k === col }, k || 'geen kleur'))),
            iconBtn('pen', 'Openen in scenario', () => { sessionStorage.setItem('fa.jump', String(s.line)); ctx.go('scenario'); }))));
      board.append(card);
    });
    if (!filtering) sortable(board, '.icard', (from, to) => { moveScene(p, from, to); ctx.save(); ctx.rerender(); toast('Scène verplaatst'); });
    root.append(board);
  },
};
