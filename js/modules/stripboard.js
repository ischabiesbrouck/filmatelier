import { h, bind, btn, iconBtn, pageHead, empty, tabs, uid, eighths, esc, printDoc, fmtDate, confirmDlg, toast, field } from '../util.js';
import { sceneCast } from './breakdown.js';

let view = 'board';
let sortBy = 'script';

const stripClass = (s) => (s.ie === 'EXT' ? 'E' : 'I') + (s.dn === 'N' ? 'N' : 'D');

export function dayStats(day, byKey, breakdown) {
  const scenes = day.scenes.map((k) => byKey[k]).filter(Boolean);
  const e8 = scenes.reduce((a, s) => a + s.eighths, 0);
  const hours = scenes.reduce((a, s) => a + (Number(breakdown[s.key]?.hours) || (s.eighths / 8) * 4.5), 0);
  const cast = [...new Set(scenes.flatMap((s) => sceneCast({ breakdown }, s)))];
  const locs = [...new Set(scenes.map((s) => s.location))];
  return { scenes, e8, hours, cast, locs };
}

export default {
  id: 'stripboard', title: 'Draaischema', icon: 'strip', group: 'Pre-productie',
  badge: (ctx) => ctx.project.schedule.days.length || null,
  render(root, ctx) {
    const p = ctx.project, SC = p.schedule;
    SC.maxEighths ??= 40; SC.skipWeekends ??= true;
    const parsed = ctx.parsed();
    const byKey = Object.fromEntries(parsed.scenes.map((s) => [s.key, s]));
    const cn = ctx.castNumbers();
    SC.days.forEach((d) => { d.scenes = d.scenes.filter((k) => byKey[k]); });
    const scheduled = new Set(SC.days.flatMap((d) => d.scenes));
    let unsched = parsed.scenes.filter((s) => !scheduled.has(s.key));
    if (sortBy === 'loc') unsched = [...unsched].sort((a, b) => a.location.localeCompare(b.location) || a.ie.localeCompare(b.ie) || a.dn.localeCompare(b.dn));
    if (sortBy === 'dn') unsched = [...unsched].sort((a, b) => a.dn.localeCompare(b.dn) || a.location.localeCompare(b.location));

    root.append(pageHead('Draaischema (stripboard)', 'Sleep scènestroken naar draaidagen. Kleuren volgen de industrienorm: wit INT/dag, geel EXT/dag, blauw INT/nacht, groen EXT/nacht.',
      btn('Draaidag', () => { SC.days.push({ id: uid(), date: '', notes: '', scenes: [] }); recalcDates(SC); ctx.save(); ctx.rerender(); }, { icon: 'plus', class: 'primary' }),
      btn('Automatisch plannen', () => autoPlan(ctx, p, unsched), { icon: 'wand' }),
      btn('Afdrukken', () => printSchedule(p, parsed, byKey, cn), { icon: 'print', class: 'ghost' })),
    tabs([['board', 'Stripboard'], ['dood', 'Dag-uit-dagen (cast)'], ['settings', 'Instellingen']], view, (v) => { view = v; ctx.rerender(); }));

    if (!parsed.scenes.length) { root.append(empty('Nog geen scènes in het scenario.')); return; }
    if (view === 'dood') return dood(root, p, parsed, byKey, cn);
    if (view === 'settings') {
      root.append(h('div', { class: 'card grid g3' },
        field('Eerste draaidag', bind(SC, 'startDate', ctx, { type: 'date', onchange: () => { recalcDates(SC); ctx.save(); } })),
        field('Max. pagina’s per dag (automatisch plannen)', bind(SC, 'maxEighths', ctx, { type: 'number', min: 8, step: 1 }), `${eighths(SC.maxEighths || 40)} pagina’s (in achtsten: 40 = 5 pagina’s)`),
        field('Weekenden overslaan', bind(SC, 'skipWeekends', ctx, { type: 'checkbox', onchange: () => { recalcDates(SC); ctx.save(); } })),
        h('div', { class: 'span-all row' }, btn('Datums opnieuw berekenen', () => { recalcDates(SC, true); ctx.save(); toast('Datums bijgewerkt'); }), btn('Schema leegmaken', async () => { if (await confirmDlg('Alle draaidagen verwijderen? Scènes komen terug in “niet ingepland”.', 'Leegmaken', true)) { SC.days = []; ctx.save(); ctx.rerender(); } }, { class: 'danger' }))));
      return;
    }

    const dayOpts = [['', 'Niet ingepland'], ...SC.days.map((d, i) => [d.id, `Dag ${i + 1}`])];
    const strip = (s, dayId) => {
      const castIds = sceneCast(p, s).map((c) => cn[c] || c).sort((a, b) => a - b);
      const move = h('select', { title: 'Verplaats naar dag', onchange: (e) => { moveTo(s.key, e.target.value, -1); } }, dayOpts.map(([v, l]) => h('option', { value: v, selected: v === (dayId || '') }, l)));
      return h('div', { class: 'strip ' + stripClass(s), draggable: 'true', 'data-key': s.key },
        h('span', { class: 'n' }, s.num),
        h('span', { class: 'ie' }, `${s.ie === 'INT/EXT' ? 'I/E' : s.ie}\n${s.dn === 'N' ? 'NACHT' : 'DAG'}`),
        h('div', { style: { minWidth: 0 } }, h('div', { class: 'loc' }, s.location || s.heading), h('div', { class: 'sub' }, [p.breakdown[s.key]?.storyDay, s.synopsis[0], castIds.length ? `cast ${castIds.join(', ')}` : ''].filter(Boolean).join(' · '))),
        h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'pg' }, eighths(s.eighths)), move));
    };

    function moveTo(key, dayId, index) {
      SC.days.forEach((d) => { d.scenes = d.scenes.filter((k) => k !== key); });
      if (dayId) { const d = SC.days.find((x) => x.id === dayId); if (index < 0 || index > d.scenes.length) d.scenes.push(key); else d.scenes.splice(index, 0, key); }
      ctx.save(); ctx.rerender();
    }

    const dropList = (el, dayId) => {
      el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over'); });
      el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('over'); });
      el.addEventListener('drop', (e) => {
        e.preventDefault(); el.classList.remove('over');
        const key = e.dataTransfer.getData('text/x-scene'); if (!key) return;
        const items = [...el.querySelectorAll('.strip')].filter((x) => x.dataset.key !== key);
        let idx = items.findIndex((x) => { const r = x.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
        moveTo(key, dayId, idx);
      });
      return el;
    };

    const unList = dropList(h('div', { class: 'strip-list' }, unsched.map((s) => strip(s, ''))), '');
    const sortSel = h('select', { style: { width: 'auto', padding: '3px 6px', fontSize: '.8rem' } }, [['script', 'Scriptvolgorde'], ['loc', 'Per locatie'], ['dn', 'Dag/nacht']].map(([v, l]) => h('option', { value: v, selected: v === sortBy }, l)));
    sortSel.onchange = () => { sortBy = sortSel.value; ctx.rerender(); };

    const daysEl = h('div', {}, SC.days.length ? SC.days.map((d, i) => {
      const st = dayStats(d, byKey, p.breakdown);
      const over = st.e8 > (SC.maxEighths || 40);
      return h('div', { class: 'day' },
        h('div', { class: 'day-head' },
          h('b', {}, `Dag ${i + 1}`),
          bind(d, 'date', ctx, { type: 'date' }),
          h('span', { class: 'small' }, d.date ? fmtDate(d.date, { weekday: 'long' }) : ''),
          h('div', { class: 'spacer' }),
          h('span', { class: 'small', style: { color: over ? '#ff8a7a' : '#ccc' } }, `${eighths(st.e8)} p · ±${st.hours.toFixed(1)} u · ${st.cast.length} cast · ${st.locs.length} loc.`),
          iconBtn('megaphone', 'Callsheet', () => { sessionStorage.setItem('fa.callday', d.id); ctx.go('callsheet'); }),
          iconBtn('up', 'Omhoog', () => { if (i > 0) { [SC.days[i - 1], SC.days[i]] = [SC.days[i], SC.days[i - 1]]; recalcDates(SC); ctx.save(); ctx.rerender(); } }),
          iconBtn('trash', 'Dag verwijderen', () => { SC.days.splice(i, 1); recalcDates(SC); ctx.save(); ctx.rerender(); })),
        dropList(h('div', { class: 'strip-list', style: { minHeight: '46px' } }, d.scenes.length ? d.scenes.map((k) => strip(byKey[k], d.id)) : h('p', { class: 'muted small', style: { margin: '8px' } }, 'Sleep scènes hierheen')), d.id),
        h('div', { style: { padding: '0 10px 8px' } }, bind(d, 'notes', ctx, { placeholder: 'Notities voor deze dag (bijv. vroege call, sneeuwmachine, locatiewissel)', style: 'font-size:.85rem;padding:4px 8px' })));
    }) : empty('Nog geen draaidagen. Voeg een dag toe of laat het schema automatisch plannen.'));

    const totalE8 = parsed.scenes.reduce((a, s) => a + s.eighths, 0);
    root.append(h('div', { class: 'legend', style: { marginBottom: '12px' } },
      [['ID', 'INT · dag'], ['ED', 'EXT · dag'], ['IN', 'INT · nacht'], ['EN', 'EXT · nacht']].map(([c, l]) => h('span', {}, h('i', { style: { background: `var(--strip-${c.toLowerCase()})` } }), l)),
      h('span', { class: 'muted' }, `· ${SC.days.length} draaidagen · ${eighths(totalE8)} pagina’s totaal · gem. ${SC.days.length ? eighths(Math.round(totalE8 / SC.days.length)) : 0} p/dag`)),
    h('div', {
      class: 'strip-cols',
      ondragstart: (e) => { const s = e.target.closest?.('.strip'); if (s) { e.dataTransfer.setData('text/x-scene', s.dataset.key); e.dataTransfer.effectAllowed = 'move'; s.classList.add('dragging'); } },
      ondragend: (e) => e.target.closest?.('.strip')?.classList.remove('dragging'),
    },
      h('div', { class: 'card', style: { position: 'sticky', top: '70px', maxHeight: 'calc(100vh - 90px)', overflow: 'auto', padding: '10px' } },
        h('div', { class: 'row', style: { marginBottom: '6px' } }, h('h3', { class: 'card-title', style: { margin: 0 } }, `Niet ingepland (${unsched.length})`), h('div', { class: 'spacer' }), sortSel), unList),
      daysEl));
  },
};

/** Nummert de datums van alle draaidagen door vanaf de eerste draaidag (optioneel zonder weekenden). */
export function recalcDates(SC) {
  if (!SC.startDate) return;
  const d = new Date(SC.startDate + 'T12:00:00');
  SC.days.forEach((day, i) => {
    if (i > 0) d.setDate(d.getDate() + 1);
    while (SC.skipWeekends && (d.getDay() === 0 || d.getDay() === 6)) d.setDate(d.getDate() + 1);
    day.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
}

async function autoPlan(ctx, p, unsched) {
  if (!unsched.length) { toast('Alle scènes zijn al ingepland'); return; }
  const SC = p.schedule;
  const max = Number(SC.maxEighths) || 40;
  // Groepeer per locatie, dan EXT dag eerst (daglicht), nacht later; vul dagen tot het maximum.
  const groups = {};
  unsched.forEach((s) => { (groups[s.location || s.heading] ??= []).push(s); });
  const ordered = Object.values(groups).sort((a, b) => b.reduce((x, s) => x + s.eighths, 0) - a.reduce((x, s) => x + s.eighths, 0))
    .flatMap((g) => g.sort((a, b) => (a.dn + a.ie).localeCompare(b.dn + b.ie)));
  if (!(await confirmDlg(`${unsched.length} scènes inplannen, gegroepeerd per locatie, max. ${eighths(max)} pagina’s per dag? Je kunt daarna alles nog verslepen.`, 'Inplannen'))) return;
  let day = null, used = 0, dn = null;
  for (const s of ordered) {
    if (!day || used + s.eighths > max || (dn && dn !== s.dn && used >= max / 2)) {
      day = { id: uid(), date: '', notes: '', scenes: [] }; SC.days.push(day); used = 0; dn = s.dn;
    }
    day.scenes.push(s.key); used += s.eighths;
  }
  if (!SC.startDate) SC.startDate = new Date().toISOString().slice(0, 10);
  recalcDates(SC);
  ctx.save(); ctx.rerender();
  toast(`${SC.days.length} draaidag${SC.days.length === 1 ? '' : 'en'} gepland`);
}

function dood(root, p, parsed, byKey, cn) {
  const days = p.schedule.days;
  if (!days.length) { root.append(empty('Maak eerst een draaischema.')); return; }
  const cast = Object.keys(cn).sort((a, b) => cn[a] - cn[b]);
  const extraCast = [...new Set(Object.values(p.breakdown).flatMap((b) => b.items?.cast || []))].filter((c) => !cn[c]);
  const all = [...cast, ...extraCast];
  const work = all.map((c) => days.map((d) => d.scenes.some((k) => byKey[k] && sceneCast(p, byKey[k]).includes(c))));
  const code = (row, j) => {
    const first = row.indexOf(true), last = row.lastIndexOf(true);
    if (!row[j]) return j > first && j < last && first >= 0 ? 'H' : '';
    if (first === last) return 'SWF';
    return j === first ? 'SW' : j === last ? 'WF' : 'W';
  };
  root.append(h('p', { class: 'muted' }, 'SW = start werk · W = werkdag · WF = laatste dag · SWF = één dag · H = hold (tussen draaidagen in, wel betalen/beschikbaar houden).'),
    h('div', { class: 'card table-wrap' }, h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Rol'), days.map((d, i) => h('th', { class: 'center', title: d.date }, `D${i + 1}`)), h('th', { class: 'num' }, 'Werk'), h('th', { class: 'num' }, 'Hold'))),
      h('tbody', {}, all.map((c, r) => h('tr', {}, h('td', { class: 'mono' }, cn[c] || '–'), h('td', {}, c),
        days.map((_, j) => { const v = code(work[r], j); return h('td', { class: 'center mono', style: { background: v.includes('W') ? 'var(--accent-soft)' : v === 'H' ? 'var(--panel3)' : '', fontWeight: 700, fontSize: '.75rem' } }, v); }),
        h('td', { class: 'num' }, work[r].filter(Boolean).length),
        h('td', { class: 'num' }, days.filter((_, j) => code(work[r], j) === 'H').length)))))));
}

function printSchedule(p, parsed, byKey, cn) {
  const html = p.schedule.days.map((d, i) => {
    const st = dayStats(d, byKey, p.breakdown);
    return `<h2>Dag ${i + 1}${d.date ? ' — ' + fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}</h2>
      ${d.notes ? `<p><i>${esc(d.notes)}</i></p>` : ''}
      <table><tr><th>Sc.</th><th>I/E</th><th>D/N</th><th>Locatie / omschrijving</th><th>Cast</th><th>Pag.</th></tr>
      ${st.scenes.map((s) => `<tr style="background:${{ ID: '#fff', ED: '#fbf0a8', IN: '#cfe0f7', EN: '#cdebd5' }[stripClass(s)]}"><td><b>${esc(s.num)}</b></td><td>${s.ie}</td><td>${s.dn === 'N' ? 'Nacht' : 'Dag'}</td><td><b>${esc(s.location)}</b><br>${esc(s.synopsis.join(' '))}</td><td>${sceneCast(p, s).map((c) => cn[c] || c).join(', ')}</td><td>${eighths(s.eighths)}</td></tr>`).join('')}
      <tr><td colspan="5" class="right"><b>Totaal</b></td><td><b>${eighths(st.e8)}</b></td></tr></table>`;
  }).join('') || '<p>Geen draaidagen.</p>';
  const legend = Object.entries(cn).map(([n, i]) => `${i}. ${esc(n)}`).join(' · ');
  printDoc(`${p.meta.title} — draaischema`, `<h1>${esc(p.meta.title)} — Draaischema</h1><p class="muted">Cast: ${legend}</p>${html}`);
}
