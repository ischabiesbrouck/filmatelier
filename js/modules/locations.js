import { h, bind, field, section, btn, iconBtn, pageHead, empty, uid, confirmDlg, pickFile, compressImage, toast, eighths, money, modal } from '../util.js';

const PERMIT = ['Te zoeken', 'Gescout', 'Optie', 'Vergunning aangevraagd', 'Akkoord', 'Afgewezen'];
const BADGE = { 'Akkoord': 'green', 'Afgewezen': 'red', 'Vergunning aangevraagd': 'amber', 'Optie': 'blue' };
let selId = null;

export const scenesForLocation = (loc, parsed) => {
  const m = (loc.match || loc.name || '').toUpperCase().trim();
  return m ? parsed.scenes.filter((s) => s.location === m || s.location.startsWith(m + ' ') || s.location.startsWith(m + ' -') || s.location.startsWith(m + '/')) : [];
};

export default {
  id: 'locaties', title: 'Locaties', icon: 'pin', group: 'Pre-productie',
  badge: (ctx) => ctx.project.locations.length || null,
  render(root, ctx) {
    const p = ctx.project;
    const parsed = ctx.parsed();
    const scriptLocs = [...new Set(parsed.scenes.map((s) => s.location).filter(Boolean))];
    const covered = new Set(p.locations.flatMap((l) => scenesForLocation(l, parsed).map((s) => s.location)));
    const missing = scriptLocs.filter((l) => !covered.has(l));
    const want = sessionStorage.getItem('fa.selloc');
    if (want) { sessionStorage.removeItem('fa.selloc'); selId = want; }
    if (!p.locations.find((l) => l.id === selId)) selId = p.locations[0]?.id;
    const add = (name = 'Nieuwe locatie', match = '') => {
      const l = { id: uid(), name, match, address: '', lat: '', lon: '', contact: '', phone: '', permit: 'Te zoeken', cost: '', parking: '', power: '', hospital: '', notes: '', photos: [] };
      p.locations.push(l); selId = l.id; ctx.save(); ctx.rerender();
    };
    root.append(pageHead('Locaties', 'Scouting, vergunningen en praktische info per draailocatie, gekoppeld aan de scènes die er spelen.',
      btn('Nieuwe locatie', () => add(), { icon: 'plus', class: 'primary' })));

    const list = h('div', { class: 'card stack tight' },
      p.locations.map((l) => h('div', { class: 'list-item' + (l.id === selId ? ' active' : ''), onclick: () => { selId = l.id; ctx.rerender(); } },
        l.photos?.[0] ? h('img', { src: l.photos[0], alt: '', class: 'avatar', style: { objectFit: 'cover', borderRadius: '6px' } }) : h('div', { class: 'avatar', style: { borderRadius: '6px' } }, '📍'),
        h('div', { style: { minWidth: 0, flex: 1 } }, h('div', { style: { fontWeight: 600 } }, l.name), h('small', { class: 'muted' }, `${scenesForLocation(l, parsed).length} scènes`)),
        h('span', { class: 'badge ' + (BADGE[l.permit] || '') }, l.permit))),
      !p.locations.length ? h('p', { class: 'muted small' }, 'Nog geen locaties.') : null,
      missing.length ? h('div', { style: { marginTop: '10px' } }, h('div', { class: 'card-title' }, 'In scenario, nog geen locatie'),
        h('div', { class: 'chips' }, missing.map((m) => h('button', { class: 'chip', type: 'button', onclick: () => add(m.charAt(0) + m.slice(1).toLowerCase(), m) }, '+ ' + m)))) : null);

    const l = p.locations.find((x) => x.id === selId);
    let detail;
    if (!l) detail = empty('Voeg een locatie toe, of maak er een aan vanuit het scenario.');
    else {
      l.photos ??= [];
      const sc = scenesForLocation(l, parsed);
      const mapUrl = l.lat && l.lon ? `https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lon}#map=16/${l.lat}/${l.lon}` : l.address ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(l.address)}` : null;
      detail = h('div', { class: 'stack' },
        section('Gegevens',
          h('div', { class: 'grid g3' },
            field('Naam', bind(l, 'name', ctx)),
            field('Koppelen aan scènekop', bind(l, 'match', ctx, { list: 'script-locs', placeholder: 'bijv. CAFÉ DE OVERKANT', onchange: () => ctx.rerender() }), 'Scènes met deze locatie in de kop worden gekoppeld'),
            field('Status', bind(l, 'permit', ctx, { type: 'select', options: PERMIT, onchange: () => ctx.rerender() })),
            field('Adres', bind(l, 'address', ctx), null, 'span2'),
            field('Kosten per draaidag (€)', bind(l, 'cost', ctx, { type: 'number', min: 0 })),
            field('Breedtegraad', bind(l, 'lat', ctx, { type: 'number', step: 'any' })),
            field('Lengtegraad', bind(l, 'lon', ctx, { type: 'number', step: 'any' })),
            h('div', { class: 'row', style: { alignSelf: 'end' } },
              btn('Huidige positie', () => {
                if (!navigator.geolocation) return toast('Locatiebepaling niet beschikbaar');
                navigator.geolocation.getCurrentPosition((pos) => { l.lat = +pos.coords.latitude.toFixed(5); l.lon = +pos.coords.longitude.toFixed(5); ctx.save(); ctx.rerender(); toast('Positie ingevuld'); }, () => toast('Kon positie niet bepalen'), { enableHighAccuracy: true, timeout: 10000 });
              }, { icon: 'pin', class: 'sm' }),
              mapUrl ? h('a', { class: 'btn sm ghost', href: mapUrl, target: '_blank', rel: 'noopener' }, 'Kaart ↗') : null)),
          h('datalist', { id: 'script-locs' }, scriptLocs.map((x) => h('option', { value: x })))),
        h('div', { class: 'grid g2' },
          section('Praktisch',
            h('div', { class: 'stack' },
              field('Contactpersoon', bind(l, 'contact', ctx)),
              field('Telefoon', bind(l, 'phone', ctx, { type: 'tel' })),
              field('Parkeren (crew & trucks)', bind(l, 'parking', ctx)),
              field('Stroom', bind(l, 'power', ctx, { placeholder: 'Krachtstroom / aggregaat nodig?' })),
              field('Dichtstbijzijnde ziekenhuis (SEH)', bind(l, 'hospital', ctx)),
              field('Notities (geluid, licht, buren, toiletten, uitwijk bij regen)', bind(l, 'notes', ctx, { type: 'textarea', rows: 4 })))),
          section('Scènes op deze locatie',
            sc.length ? h('table', { class: 'tbl' }, h('tbody', {}, sc.map((s) => h('tr', {}, h('td', { class: 'mono' }, s.num), h('td', {}, s.heading), h('td', { class: 'num' }, eighths(s.eighths))))),
              h('tfoot', {}, h('tr', {}, h('td', {}), h('td', {}, `${sc.length} scènes${l.cost ? ` · ${money(l.cost)}/dag` : ''}`), h('td', { class: 'num' }, eighths(sc.reduce((a, s) => a + s.eighths, 0))))))
              : h('p', { class: 'muted' }, 'Geen scènes gekoppeld. Vul bij “Koppelen aan scènekop” de locatienaam uit het scenario in.'),
            h('h4', { style: { margin: '14px 0 6px' } }, 'Zon op deze locatie'),
            h('p', { class: 'muted small' }, 'Bekijk zonsopkomst, gouden uur en ondergang via ', h('a', { href: '#/gereedschap', onclick: () => sessionStorage.setItem('fa.sunloc', JSON.stringify({ lat: l.lat, lon: l.lon })) }, 'Gereedschap → Zon & licht'), '.'))),
        section('Scoutingfoto’s',
          h('div', { class: 'board-grid' }, l.photos.map((src, i) => h('div', { class: 'frame' },
            h('div', { class: 'img', style: { '--ar': '4/3' } }, h('img', { src, alt: `${l.name} foto ${i + 1}`, onclick: () => modal({ title: l.name, wide: true, body: h('img', { src, alt: '', style: { width: '100%', borderRadius: '6px' } }) }) })),
            h('div', { class: 'cap row' }, h('span', { class: 'muted small' }, `Foto ${i + 1}`), h('div', { class: 'spacer' }), iconBtn('trash', 'Verwijderen', () => { l.photos.splice(i, 1); ctx.save(); ctx.rerender(); }, 'danger'))))),
          h('div', { style: { marginTop: '10px' } }, btn('Foto’s toevoegen', async () => {
            const files = await pickFile('image/*', true);
            for (const f of files) l.photos.push(await compressImage(f, 1400));
            ctx.save(); ctx.rerender();
          }, { icon: 'image' }))),
        h('div', { class: 'row' }, h('div', { class: 'spacer' }), btn('Locatie verwijderen', async () => { if (await confirmDlg(`“${l.name}” verwijderen?`, 'Verwijderen', true)) { p.locations.splice(p.locations.indexOf(l), 1); ctx.save(); ctx.rerender(); } }, { class: 'danger sm', icon: 'trash' })));
    }
    root.append(h('div', { class: 'master' }, list, detail));
  },
};
