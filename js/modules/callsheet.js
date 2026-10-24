import { h, bind, field, section, btn, pageHead, empty, esc, printDoc, fmtDate, eighths } from '../util.js';
import { dayStats } from './stripboard.js';
import { sceneCast } from './breakdown.js';
import { scenesForLocation } from './locations.js';
import { sunTimes, hhmm } from '../sun.js';

let dayId = null;

export default {
  id: 'callsheet', title: 'Callsheets', icon: 'megaphone', group: 'Productie',
  render(root, ctx) {
    const p = ctx.project;
    const days = p.schedule.days;
    root.append(pageHead('Callsheets', 'Dagelijks oproepblad: tijden, locaties, scènes, cast en crew. Gegenereerd uit je draaischema, locaties en cast & crew.'));
    if (!days.length) { root.append(empty('Maak eerst een draaischema met draaidagen.', btn('Naar draaischema', () => ctx.go('stripboard'), { icon: 'strip' }))); return; }
    const pre = sessionStorage.getItem('fa.callday');
    if (pre) { dayId = pre; sessionStorage.removeItem('fa.callday'); }
    if (!days.find((d) => d.id === dayId)) dayId = (days.find((d) => d.date >= new Date().toISOString().slice(0, 10)) || days[0]).id;
    const di = days.findIndex((d) => d.id === dayId);
    const day = days[di];
    const C = p.callsheets[day.id] ??= { general: '07:00', crewCall: '07:00', breakfast: '06:30', lunch: '13:00', wrap: '19:00', weather: '', hospital: '', notes: '', safety: '', castCalls: {}, crewCalls: {} };
    C.castCalls ??= {}; C.crewCalls ??= {};

    const sel = h('select', { style: { width: 'auto' } }, days.map((d, i) => h('option', { value: d.id }, `Dag ${i + 1} van ${days.length}${d.date ? ' — ' + fmtDate(d.date) : ''}`)));
    sel.value = day.id; sel.onchange = () => { dayId = sel.value; ctx.rerender(); };

    const data = build(p, ctx, day, di);
    const preview = h('div', { class: 'cs-preview', html: callsheetHTML(p, data, C) });
    const refresh = () => { preview.innerHTML = callsheetHTML(p, build(p, ctx, day, di), C); };
    const b = (k, label, type = 'time') => field(label, bind(C, k, ctx, { type, onchange: refresh }));

    root.append(h('div', { class: 'row wrap', style: { marginBottom: '14px' } }, sel, h('div', { class: 'spacer' }),
      btn('Afdrukken / PDF', () => printDoc(`Callsheet dag ${di + 1} — ${p.meta.title}`, callsheetHTML(p, build(p, ctx, day, di), C), 'body{font-size:9.5pt}h2{font-size:11pt;margin:8pt 0 3pt}table{margin:3pt 0 6pt}'), { icon: 'print', class: 'primary' })),
    h('div', { class: 'grid g2', style: { alignItems: 'start' } },
      h('div', { class: 'stack' },
        section('Tijden', h('div', { class: 'grid g3' }, b('general', 'Algemene call'), b('crewCall', 'Crew call'), b('breakfast', 'Ontbijt'), b('lunch', 'Lunch'), b('wrap', 'Verwachte wrap'))),
        section('Cast-tijden',
          data.cast.length ? h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['#', 'Rol', 'Ophalen', 'Grime', 'Op set'].map((x) => h('th', {}, x)))),
            h('tbody', {}, data.cast.map((c) => { const cc = C.castCalls[c.role] ??= { pickup: '', makeup: '', set: '' }; return h('tr', {}, h('td', { class: 'mono' }, c.num || ''), h('td', {}, c.role, h('div', { class: 'muted small' }, c.actor)),
              ...['pickup', 'makeup', 'set'].map((k) => h('td', {}, bind(cc, k, ctx, { type: 'time', onchange: refresh })))); })))
            : h('p', { class: 'muted' }, 'Geen cast in de scènes van deze dag.')),
        section('Crew-afwijkingen',
          p.people.filter((x) => x.type === 'crew').length ? h('table', { class: 'tbl' }, h('tbody', {}, p.people.filter((x) => x.type === 'crew').map((x) =>
            h('tr', {}, h('td', {}, x.role, h('div', { class: 'muted small' }, x.name)), h('td', { style: { width: '130px' } }, bind(C.crewCalls, x.id, ctx, { type: 'time', onchange: refresh, title: 'Leeg = crew call' }))))))
            : h('p', { class: 'muted' }, 'Voeg crew toe bij Cast & crew.')),
        section('Overig',
          h('div', { class: 'stack' },
            field('Weer', bind(C, 'weather', ctx, { placeholder: 'bijv. 14°C, bewolkt, 20% regen', onchange: refresh })),
            field('Dichtstbijzijnde ziekenhuis (SEH)', bind(C, 'hospital', ctx, { placeholder: data.hospital || 'Naam + adres', onchange: refresh })),
            field('Veiligheid', bind(C, 'safety', ctx, { type: 'textarea', rows: 2, placeholder: 'Stunts, water, hoogte, rook, wapens…', onchange: refresh })),
            field('Notities / afdelingen', bind(C, 'notes', ctx, { type: 'textarea', rows: 4, onchange: refresh }))))),
      h('div', { style: { position: 'sticky', top: '70px' } }, preview)));
  },
};

function build(p, ctx, day, di) {
  const parsed = ctx.parsed();
  const byKey = Object.fromEntries(parsed.scenes.map((s) => [s.key, s]));
  const st = dayStats(day, byKey, p.breakdown);
  const cn = ctx.castNumbers();
  const locs = p.locations.filter((l) => scenesForLocation(l, parsed).some((s) => day.scenes.includes(s.key)));
  const loc = locs.find((l) => l.lat && l.lon);
  const sun = loc && day.date ? sunTimes(new Date(day.date + 'T12:00:00'), Number(loc.lat), Number(loc.lon)) : null;
  const cast = st.cast.map((role) => ({ role, num: cn[role], actor: p.people.find((x) => x.type === 'cast' && x.role === role)?.name || '', phone: p.people.find((x) => x.type === 'cast' && x.role === role)?.phone || '' }))
    .sort((a, b) => (a.num || 999) - (b.num || 999));
  const next = p.schedule.days[di + 1];
  const nextScenes = next ? next.scenes.map((k) => byKey[k]).filter(Boolean) : [];
  const items = (k) => [...new Set(st.scenes.flatMap((s) => p.breakdown[s.key]?.items?.[k] || []))];
  return { day, di, total: p.schedule.days.length, st, cast, locs, sun, next, nextScenes, hospital: locs.map((l) => l.hospital).filter(Boolean).join('; '), items, extras: st.scenes.reduce((a, s) => a + (Number(p.breakdown[s.key]?.extrasCount) || 0), 0) };
}

function callsheetHTML(p, d, C) {
  const crew = p.people.filter((x) => x.type === 'crew');
  const it = (k, l) => { const v = d.items(k); return v.length ? `<tr><th>${l}</th><td>${v.map(esc).join(', ')}</td></tr>` : ''; };
  return `
  <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
    <div><div style="font-size:18pt;font-weight:800">${esc(p.meta.title)}</div><div>CALLSHEET · Draaidag ${d.di + 1} van ${d.total}</div>
    <div><b>${d.day.date ? fmtDate(d.day.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Datum nog niet gepland'}</b></div></div>
    <div style="text-align:center;border:2px solid #111;padding:6px 14px;border-radius:6px"><div style="font-size:9pt">ALGEMENE CALL</div><div style="font-size:22pt;font-weight:800">${esc(C.general || '—')}</div></div>
    <div style="font-size:9pt;line-height:1.5">Crew call: <b>${esc(C.crewCall || '')}</b><br>Ontbijt: ${esc(C.breakfast || '')}<br>Lunch: ${esc(C.lunch || '')}<br>Wrap: ${esc(C.wrap || '')}</div>
  </div>
  <table><tr><th>Zon op</th><td>${d.sun ? hhmm(d.sun.sunrise) : '—'}</td><th>Gouden uur</th><td>${d.sun ? `${hhmm(d.sun.goldenStart)}–${hhmm(d.sun.sunset)}` : '—'}</td><th>Zon onder</th><td>${d.sun ? hhmm(d.sun.sunset) : '—'}</td><th>Weer</th><td>${esc(C.weather || '')}</td></tr></table>
  <h2>Locatie${d.locs.length > 1 ? 's' : ''}</h2>
  <table><tr><th>Locatie</th><th>Adres</th><th>Parkeren</th><th>Contact</th></tr>
  ${d.locs.map((l) => `<tr><td><b>${esc(l.name)}</b></td><td>${esc(l.address)}</td><td>${esc(l.parking)}</td><td>${esc(l.contact)} ${esc(l.phone)}</td></tr>`).join('') || `<tr><td colspan="4">${[...new Set(d.st.scenes.map((s) => esc(s.location)))].join(', ')}</td></tr>`}</table>
  <p><b>Ziekenhuis (SEH):</b> ${esc(C.hospital || d.hospital || '—')} &nbsp; <b>Noodnummer:</b> 112</p>
  <h2>Scènes</h2>
  <table><tr><th>Sc.</th><th>Kop / omschrijving</th><th>D/N</th><th>Cast</th><th>Pag.</th></tr>
  ${d.st.scenes.map((s) => `<tr><td><b>${esc(s.num)}</b></td><td><b>${esc(s.heading)}</b>${p.breakdown[s.key]?.storyDay ? ` <span style="font-size:.8em;border:1px solid #999;border-radius:99px;padding:0 6px">${esc(p.breakdown[s.key].storyDay)}</span>` : ''}<br>${esc(s.synopsis.join(' '))}</td><td>${s.dn === 'N' ? 'N' : 'D'}</td><td>${sceneCast(p, s).map((c) => d.cast.find((x) => x.role === c)?.num || c).join(', ')}</td><td>${eighths(s.eighths)}</td></tr>`).join('')}
  <tr><td colspan="4" style="text-align:right"><b>Totaal</b></td><td><b>${eighths(d.st.e8)}</b></td></tr></table>
  <h2>Cast</h2>
  <table><tr><th>#</th><th>Rol</th><th>Acteur</th><th>Ophalen</th><th>Grime</th><th>Op set</th></tr>
  ${d.cast.map((c) => { const cc = C.castCalls[c.role] || {}; return `<tr><td>${c.num || ''}</td><td>${esc(c.role)}</td><td>${esc(c.actor)}</td><td>${esc(cc.pickup || '')}</td><td>${esc(cc.makeup || '')}</td><td><b>${esc(cc.set || '')}</b></td></tr>`; }).join('') || '<tr><td colspan="6">—</td></tr>'}</table>
  ${d.extras ? `<p><b>Figuratie:</b> ${d.extras} personen</p>` : ''}
  <h2>Afdelingen</h2><table>${it('props', 'Rekwisieten')}${it('wardrobe', 'Kostuum')}${it('makeup', 'Grime & haar')}${it('vehicles', 'Voertuigen')}${it('sfx', 'Special effects')}${it('stunts', 'Stunts')}${it('animals', 'Dieren')}${it('equipment', 'Apparatuur')}${it('security', 'Beveiliging')}</table>
  ${C.safety ? `<h2>Veiligheid</h2><p>${esc(C.safety).replace(/\n/g, '<br>')}</p>` : ''}
  ${C.notes || d.day.notes ? `<h2>Notities</h2><p>${esc([d.day.notes, C.notes].filter(Boolean).join('\n')).replace(/\n/g, '<br>')}</p>` : ''}
  ${crew.length ? `<h2>Crew</h2><table><tr><th>Functie</th><th>Naam</th><th>Telefoon</th><th>Call</th></tr>${crew.map((x) => `<tr><td>${esc(x.role)}</td><td>${esc(x.name)}</td><td>${esc(x.phone)}</td><td>${esc(C.crewCalls[x.id] || C.crewCall || '')}</td></tr>`).join('')}</table>` : ''}
  <h2>Vooruitblik: ${d.next ? `dag ${d.di + 2}${d.next.date ? ' — ' + fmtDate(d.next.date) : ''}` : 'laatste draaidag'}</h2>
  ${d.nextScenes.length ? `<table>${d.nextScenes.map((s) => `<tr><td><b>${esc(s.num)}</b></td><td>${esc(s.heading)}</td><td>${eighths(s.eighths)}</td></tr>`).join('')}</table>` : '<p>—</p>'}`;
}
