import { h, bind, btn, iconBtn, pageHead, empty, tabs, uid, esc, printDoc, download, slug } from '../util.js';

export const DEPTS = ['Productie', 'Regie', 'Camera', 'Licht & grip', 'Geluid', 'Art department', 'Kostuum', 'Grime & haar', 'Continuïteit', 'Locaties', 'Vervoer', 'Catering', 'Stunts', 'VFX', 'Montage', 'Post', 'Muziek', 'Publiciteit', 'Overig'];
const CREW_ROLES = ['Producent', 'Uitvoerend producent', 'Productieleider', 'Opnameleider', '1e regieassistent', '2e regieassistent', 'Regisseur', 'Director of Photography', 'Camera-assistent (focus puller)', 'DIT', 'Gaffer', 'Key grip', 'Geluidsman', 'Boom operator', 'Production designer', 'Art director', 'Props master', 'Kostuumontwerper', 'Grimeur', 'Script supervisor', 'Locatiemanager', 'Runner', 'Editor', 'Componist', 'Stunt coördinator', 'Setfotograaf', 'Making-of'];
let tab = 'cast';

export default {
  id: 'mensen', title: 'Cast & crew', icon: 'id', group: 'Pre-productie',
  render(root, ctx) {
    const p = ctx.project;
    const parsed = ctx.parsed();
    const cn = ctx.castNumbers();
    const roles = [...new Set([...Object.keys(parsed.characters), ...p.characters.map((c) => c.name.toUpperCase())])];
    const list = p.people.filter((x) => x.type === tab).sort((a, b) => tab === 'cast' ? (cn[a.role] || 999) - (cn[b.role] || 999) : DEPTS.indexOf(a.dept) - DEPTS.indexOf(b.dept));
    const add = () => { p.people.push({ id: uid(), name: '', type: tab, role: '', dept: tab === 'cast' ? 'Cast' : 'Productie', phone: '', email: '', rate: '', availability: '', notes: '' }); ctx.save(); ctx.rerender(); };
    const uncast = roles.filter((r) => !p.people.some((x) => x.type === 'cast' && x.role === r));

    root.append(pageHead('Cast & crew', 'Contactlijst voor de hele productie. Castleden koppel je aan een rol; die verschijnen automatisch op callsheets.',
      btn(tab === 'cast' ? 'Castlid toevoegen' : 'Crewlid toevoegen', add, { icon: 'plus', class: 'primary' }),
      btn('Contactlijst afdrukken', () => printContacts(p, cn), { icon: 'print' }),
      btn('CSV', () => download(`${slug(p.meta.title)}-contacten.csv`, toCSV(p.people), 'text/csv;charset=utf-8'), { icon: 'download', class: 'ghost' })),
    tabs([['cast', `Cast (${p.people.filter((x) => x.type === 'cast').length})`], ['crew', `Crew (${p.people.filter((x) => x.type === 'crew').length})`]], tab, (t) => { tab = t; ctx.rerender(); }));

    if (tab === 'cast' && uncast.length) {
      root.append(h('div', { class: 'row wrap', style: { marginBottom: '12px' } }, h('span', { class: 'muted small' }, 'Nog niet gecast:'),
        h('div', { class: 'chips' }, uncast.map((r) => h('button', { class: 'chip', type: 'button', onclick: () => { p.people.push({ id: uid(), name: '', type: 'cast', role: r, dept: 'Cast', phone: '', email: '', rate: '', availability: '', notes: '' }); ctx.save(); ctx.rerender(); } }, `+ ${cn[r] ? cn[r] + '. ' : ''}${r}`)))));
    }
    if (!list.length) { root.append(empty(tab === 'cast' ? 'Nog geen castleden.' : 'Nog geen crew.', btn('Toevoegen', add, { icon: 'plus' }))); return; }

    root.append(h('datalist', { id: 'roles-cast' }, roles.map((r) => h('option', { value: r }))), h('datalist', { id: 'roles-crew' }, CREW_ROLES.map((r) => h('option', { value: r }))),
      h('div', { class: 'card table-wrap' }, h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, (tab === 'cast' ? ['#', 'Rol', 'Acteur / actrice', 'Telefoon', 'E-mail', 'Gage', 'Beschikbaarheid', 'Notities', ''] : ['Afdeling', 'Functie', 'Naam', 'Telefoon', 'E-mail', 'Tarief', 'Beschikbaarheid', 'Notities', '']).map((x) => h('th', {}, x)))),
        h('tbody', {}, list.map((x) => h('tr', {},
          tab === 'cast' ? h('td', { class: 'mono' }, cn[x.role] || '–') : h('td', { style: { minWidth: '130px' } }, bind(x, 'dept', ctx, { type: 'select', options: DEPTS })),
          h('td', { style: { minWidth: '150px' } }, bind(x, 'role', ctx, { list: tab === 'cast' ? 'roles-cast' : 'roles-crew', placeholder: tab === 'cast' ? 'ROL' : 'Functie' })),
          h('td', { style: { minWidth: '150px' } }, bind(x, 'name', ctx, { placeholder: 'Naam' })),
          h('td', { style: { minWidth: '120px' } }, bind(x, 'phone', ctx, { type: 'tel', placeholder: '06…' })),
          h('td', { style: { minWidth: '170px' } }, bind(x, 'email', ctx, { type: 'email', placeholder: '@' })),
          h('td', { style: { width: '100px' } }, bind(x, 'rate', ctx, { placeholder: '€ / dag' })),
          h('td', { style: { minWidth: '130px' } }, bind(x, 'availability', ctx, { placeholder: 'bijv. niet 3–7 mei' })),
          h('td', { style: { minWidth: '160px' } }, bind(x, 'notes', ctx)),
          h('td', { class: 'nowrap' },
            x.phone ? h('a', { class: 'icon-btn', href: 'tel:' + x.phone.replace(/\s/g, ''), title: 'Bellen' }, '☎') : null,
            x.email ? h('a', { class: 'icon-btn', href: 'mailto:' + x.email, title: 'E-mailen' }, '✉') : null,
            iconBtn('trash', 'Verwijderen', () => { p.people.splice(p.people.indexOf(x), 1); ctx.save(); ctx.rerender(); }, 'danger'))))))));
  },
};

function toCSV(people) {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  return '﻿' + [['Type', 'Afdeling', 'Rol/functie', 'Naam', 'Telefoon', 'E-mail', 'Tarief', 'Beschikbaarheid', 'Notities'].join(';'),
    ...people.map((x) => [x.type, x.dept, x.role, x.name, x.phone, x.email, x.rate, x.availability, x.notes].map(q).join(';'))].join('\r\n');
}

function printContacts(p, cn) {
  const row = (x) => `<tr><td>${x.type === 'cast' ? (cn[x.role] || '') : esc(x.dept)}</td><td>${esc(x.role)}</td><td><b>${esc(x.name)}</b></td><td>${esc(x.phone)}</td><td>${esc(x.email)}</td></tr>`;
  const cast = p.people.filter((x) => x.type === 'cast').sort((a, b) => (cn[a.role] || 999) - (cn[b.role] || 999));
  const crew = p.people.filter((x) => x.type === 'crew').sort((a, b) => DEPTS.indexOf(a.dept) - DEPTS.indexOf(b.dept));
  printDoc(`${p.meta.title} — contactlijst`, `<h1>${esc(p.meta.title)} — Contactlijst</h1>
    <h2>Cast</h2><table><tr><th>#</th><th>Rol</th><th>Naam</th><th>Telefoon</th><th>E-mail</th></tr>${cast.map(row).join('')}</table>
    <h2>Crew</h2><table><tr><th>Afdeling</th><th>Functie</th><th>Naam</th><th>Telefoon</th><th>E-mail</th></tr>${crew.map(row).join('')}</table>
    <p class="muted">Vertrouwelijk — alleen voor gebruik binnen de productie.</p>`);
}
