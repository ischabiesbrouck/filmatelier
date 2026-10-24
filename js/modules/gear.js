import { h, bind, btn, iconBtn, pageHead, empty, uid, money, esc, printDoc, confirmDlg, toast, modal } from '../util.js';

export const GEAR_CATS = ['Camera', 'Lenzen & filters', 'Monitoring & video', 'Grip', 'Licht', 'Stroom', 'Geluid', 'Data & DIT', 'Productie & veiligheid'];
const STATUS = [['nodig', 'Nodig'], ['geregeld', 'Geregeld'], ['ingepakt', 'Ingepakt ✓'], ['retour', 'Retour ✓✓']];
const SOURCE = [['huur', 'Huur'], ['eigen', 'Eigen'], ['leen', 'Geleend']];

// Standaardpakketten: [categorie, naam, aantal]. Prijzen vul je zelf in (verschillen sterk per verhuurder).
const PACKS = {
  basis: ['Basispakket (low budget, kleine crew)', [
    ['Camera', 'Cinemacamera-body (bijv. compacte full-frame cinemacamera)', 1], ['Camera', 'Mediakaarten + kaartlezer', 4], ['Camera', 'Accu’s + lader', 6], ['Camera', 'Cage / rig met handgrepen', 1], ['Camera', 'Statief + vloeistofkop', 1],
    ['Lenzen & filters', 'Set cine primes (bijv. 24 / 35 / 50 / 85 mm)', 1], ['Lenzen & filters', 'ND-filters (0.3 – 1.2) of variabele ND', 1], ['Lenzen & filters', 'Lensdoekjes, blaasbalg, lenspen', 1],
    ['Monitoring & video', 'Regiemonitor 7"', 1],
    ['Grip', 'C-stands', 4], ['Grip', 'Zandzakken', 8], ['Grip', 'Apple boxes (set)', 1], ['Grip', 'Gimbal', 1], ['Grip', 'Klemmen, gaffertape, kabelbinders', 1],
    ['Licht', 'LED COB 300W + softbox/lantaarn', 1], ['Licht', 'Bi-color LED-panelen', 2], ['Licht', 'Reflectiescherm 5-in-1', 1], ['Licht', 'Gels (CTO / CTB / ND)', 1],
    ['Stroom', 'Verlengkabels / haspels', 4],
    ['Geluid', 'Audiorecorder (32-bit float)', 1], ['Geluid', 'Hengel + richtmicrofoon', 1], ['Geluid', 'Zendsets met dasspeldmicrofoon', 2], ['Geluid', 'Windkap (dead cat)', 1], ['Geluid', 'Gesloten koptelefoons', 2], ['Geluid', 'Klapbord (slate)', 1],
    ['Data & DIT', 'Laptop met back-upsoftware (checksum)', 1], ['Data & DIT', 'Externe SSD’s (zie Gereedschap → Opslag)', 3],
    ['Productie & veiligheid', 'Portofoons + oortjes', 4], ['Productie & veiligheid', 'EHBO-koffer', 1], ['Productie & veiligheid', 'Regenbescherming camera', 1],
  ]],
  speelfilm: ['Speelfilmpakket (middelgroot)', [
    ['Camera', 'Cinemacamera-body A-camera', 1], ['Camera', 'Cinemacamera-body B-camera', 1], ['Camera', 'Mediakaarten + kaartlezers', 8], ['Camera', 'V-mount accu’s + laders', 12], ['Camera', 'Matte box + draadloze follow focus', 2], ['Camera', 'Statieven: hoog, laag, hi-hat', 1], ['Camera', 'Vloeistofkop zwaar', 2],
    ['Lenzen & filters', 'Set cine primes (18 / 25 / 32 / 50 / 75 / 100 mm)', 1], ['Lenzen & filters', 'Cine zoom (bijv. 24–290 of 18–80)', 1], ['Lenzen & filters', 'ND-set 4×5.6 (0.3 – 2.1) + IRND', 1], ['Lenzen & filters', 'Polarisatiefilter 4×5.6', 1], ['Lenzen & filters', 'Diffusiefilters (1/8, 1/4, 1/2)', 1],
    ['Monitoring & video', 'Draadloze videozender + ontvangers', 2], ['Monitoring & video', 'Regiemonitor 17"/21" (video village)', 1], ['Monitoring & video', 'Focusmonitor 7"', 2], ['Monitoring & video', 'SDI-kabels (diverse lengtes)', 10],
    ['Grip', 'Dolly + rails (rechte en bochten)', 1], ['Grip', 'Slider', 1], ['Grip', 'Steadicam of zware gimbal + operator', 1], ['Grip', 'Autohouder / zuignappen', 1], ['Grip', 'C-stands', 12], ['Grip', 'Combo-/rolstatieven', 6], ['Grip', 'Zandzakken', 30], ['Grip', 'Frames 6×6 en 12×12 + doeken (diffusie, bounce, zwart)', 1], ['Grip', 'Flags & floppies (set)', 1], ['Grip', 'Apple boxes (2 sets)', 2],
    ['Licht', 'HMI 1.8 kW of LED 1200W', 2], ['Licht', 'LED COB 600W + lantaarn/softbox', 3], ['Licht', 'LED-panelen bi-color', 4], ['Licht', 'RGB-tubes', 6], ['Licht', 'Kleine accentlampen', 4], ['Licht', 'DMX-bediening / dimmers', 1], ['Licht', 'Gels-boek + diffusie', 1], ['Licht', 'Rookmachine (hazer)', 1],
    ['Stroom', 'Stille aggregaat (≥ 20 kVA)', 1], ['Stroom', 'Stroomverdeelkast (CEE)', 2], ['Stroom', 'Kabels 16A/32A', 10], ['Stroom', 'Kabelmatten', 6],
    ['Geluid', 'Audiorecorder/mixer 8-kanaals', 1], ['Geluid', 'Richtmicrofoons (buiten + binnen)', 2], ['Geluid', 'Hengels', 2], ['Geluid', 'Zendsets', 6], ['Geluid', 'Timecodegeneratoren', 4], ['Geluid', 'Smart slate (timecode)', 1], ['Geluid', 'Geluidsdekens', 10], ['Geluid', 'Comtek/monitoring voor regie', 3],
    ['Data & DIT', 'DIT-werkstation + gekalibreerde monitor', 1], ['Data & DIT', 'RAID-opslag + back-upschijven (3-2-1)', 3], ['Data & DIT', 'Kaartlezers', 3], ['Data & DIT', 'LUT-box / kleurbeheer', 1],
    ['Productie & veiligheid', 'Portofoons + oortjes', 15], ['Productie & veiligheid', 'EHBO-koffer + brandblussers', 2], ['Productie & veiligheid', 'Afzetlint, pionnen, verkeershesjes', 1], ['Productie & veiligheid', 'Partytent, klaptafels en stoelen', 1], ['Productie & veiligheid', 'Regenkleding & paraplu’s', 1],
  ]],
};

let cat = '';

export function gearCost(it, days) {
  if (it.source !== 'huur') return 0;
  return (Number(it.qty) || 0) * (Number(it.rate) || 0) * (it.days === '' || it.days == null ? days : Number(it.days) || 0);
}

export default {
  id: 'apparatuur', title: 'Apparatuur', icon: 'package', group: 'Pre-productie',
  badge: (ctx) => { const g = ctx.project.gear?.items || []; const n = g.filter((i) => i.status === 'nodig').length; return n || null; },
  render(root, ctx) {
    const p = ctx.project;
    const G = p.gear ??= { items: [] };
    const days = p.schedule.days.length || 1;
    const cur = p.budget.currency;
    const list = G.items.filter((i) => !cat || i.cat === cat);
    const total = G.items.reduce((a, i) => a + gearCost(i, days), 0);
    const count = (st) => G.items.filter((i) => i.status === st).length;
    const add = (c = cat || GEAR_CATS[0]) => { G.items.push({ id: uid(), cat: c, name: '', qty: 1, source: 'huur', vendor: '', rate: '', days: '', status: 'nodig', notes: '' }); ctx.save(); ctx.rerender(); };

    root.append(pageHead('Apparatuur & gear', `Paklijst voor camera, licht, geluid en grip. Huurdagen staan standaard op het aantal draaidagen (${p.schedule.days.length || 'nog geen'}).`,
      btn('Standaardpakket laden', () => loadPack(ctx, G), { icon: 'package', class: 'primary' }),
      btn('Naar budget', () => toBudget(ctx, p, days), { icon: 'euro' }),
      btn('Paklijst afdrukken', () => printList(p, days), { icon: 'print', class: 'ghost' })),
    h('div', { class: 'grid g4', style: { marginBottom: '14px' } },
      h('div', { class: 'stat' }, h('div', { class: 'v' }, G.items.length), h('div', { class: 'l' }, 'Items'), h('div', { class: 's' }, `${count('nodig')} nog te regelen`)),
      h('div', { class: 'stat' }, h('div', { class: 'v' }, count('ingepakt')), h('div', { class: 'l' }, 'Ingepakt')),
      h('div', { class: 'stat' }, h('div', { class: 'v' }, count('retour')), h('div', { class: 'l' }, 'Retour')),
      h('div', { class: 'stat' }, h('div', { class: 'v' }, money(total, cur)), h('div', { class: 'l' }, 'Huurkosten'), h('div', { class: 's' }, 'aantal × dagprijs × dagen'))),
    h('div', { class: 'chips', style: { marginBottom: '14px' } }, ['', ...GEAR_CATS].map((c) => h('button', { class: 'chip' + (cat === c ? ' on' : ''), type: 'button', onclick: () => { cat = c; ctx.rerender(); } },
      `${c || 'Alles'} (${c ? G.items.filter((i) => i.cat === c).length : G.items.length})`))));

    if (!G.items.length) { root.append(empty('Nog geen apparatuur. Laad een standaardpakket en pas het aan, of voeg zelf items toe.', btn('Item toevoegen', () => add(), { icon: 'plus' }))); return; }
    const vendors = [...new Set(G.items.map((i) => i.vendor).filter(Boolean))];
    const cats = cat ? [cat] : GEAR_CATS.filter((c) => list.some((i) => i.cat === c));
    root.append(h('datalist', { id: 'gear-vendors' }, vendors.map((v) => h('option', { value: v }))));
    cats.forEach((c) => {
      const items = list.filter((i) => i.cat === c);
      const sub = items.reduce((a, i) => a + gearCost(i, days), 0);
      root.append(h('div', { class: 'card table-wrap', style: { marginBottom: '14px' } },
        h('h3', { class: 'card-title' }, c, h('span', { class: 'badge' }, `${items.filter((i) => ['ingepakt', 'retour'].includes(i.status)).length}/${items.length} ingepakt`), h('div', { class: 'spacer' }),
          h('span', { style: { color: 'var(--text)', textTransform: 'none', letterSpacing: 0 } }, money(sub, cur))),
        h('table', { class: 'tbl' },
          h('thead', {}, h('tr', {}, ['Status', 'Item', 'Aantal', 'Bron', 'Verhuurder / eigenaar', 'Dagprijs', 'Dagen', 'Notities', ''].map((x) => h('th', {}, x)))),
          h('tbody', {}, items.map((it) => h('tr', { style: { opacity: it.status === 'retour' ? 0.55 : 1 } },
            h('td', { style: { width: '120px' } }, bind(it, 'status', ctx, { type: 'select', options: STATUS, onchange: () => ctx.rerender() })),
            h('td', { style: { minWidth: '240px' } }, bind(it, 'name', ctx, { placeholder: 'Omschrijving' })),
            h('td', { style: { width: '70px' } }, bind(it, 'qty', ctx, { type: 'number', min: 0 })),
            h('td', { style: { width: '100px' } }, bind(it, 'source', ctx, { type: 'select', options: SOURCE })),
            h('td', { style: { minWidth: '140px' } }, bind(it, 'vendor', ctx, { list: 'gear-vendors' })),
            h('td', { style: { width: '100px' } }, bind(it, 'rate', ctx, { type: 'number', min: 0, step: 'any', placeholder: '€' })),
            h('td', { style: { width: '80px' } }, bind(it, 'days', ctx, { type: 'number', min: 0, placeholder: String(days) })),
            h('td', { style: { minWidth: '160px' } }, bind(it, 'notes', ctx)),
            h('td', {}, iconBtn('trash', 'Verwijderen', () => { G.items.splice(G.items.indexOf(it), 1); ctx.save(); ctx.rerender(); }, 'danger')))))),
        h('div', { style: { marginTop: '8px' } }, btn('Item toevoegen', () => add(c), { icon: 'plus', class: 'sm ghost' }))));
    });
  },
};

function loadPack(ctx, G) {
  modal({
    title: 'Standaardpakket laden',
    body: (close) => h('div', { class: 'stack' },
      h('p', { class: 'muted' }, 'Items die al op de lijst staan (zelfde naam) worden overgeslagen. Prijzen vul je zelf in; die verschillen sterk per verhuurder.'),
      Object.entries(PACKS).map(([k, [label, items]]) => btn(`${label} — ${items.length} items`, () => {
        const have = new Set(G.items.map((i) => i.name));
        const add = items.filter(([, n]) => !have.has(n));
        add.forEach(([c, name, qty]) => G.items.push({ id: uid(), cat: c, name, qty, source: 'huur', vendor: '', rate: '', days: '', status: 'nodig', notes: '' }));
        ctx.save(); close(); ctx.rerender(); toast(`${add.length} items toegevoegd`);
      }, { icon: 'package' }))),
  });
}

async function toBudget(ctx, p, days) {
  const totals = {};
  p.gear.items.forEach((i) => { totals[i.cat] = (totals[i.cat] || 0) + gearCost(i, days); });
  const cats = Object.entries(totals).filter(([, v]) => v > 0);
  if (!cats.length) { toast('Nog geen huurkosten: vul dagprijzen in bij gehuurde items'); return; }
  if (!(await confirmDlg(`${cats.length} budgetposten “Apparatuurhuur — …” aanmaken of bijwerken in de categorie Productie?`, 'Bijwerken'))) return;
  cats.forEach(([c, v]) => {
    const desc = `Apparatuurhuur — ${c}`;
    let line = p.budget.items.find((i) => i.desc === desc);
    if (!line) { line = { id: uid(), cat: 'Productie', acct: '2250', desc, qty: 1, unit: 'forfait', rate: 0, actual: 0 }; p.budget.items.push(line); }
    line.qty = 1; line.unit = 'forfait'; line.rate = Math.round(v);
  });
  ctx.save(); toast('Budget bijgewerkt');
}

function printList(p, days) {
  const html = GEAR_CATS.map((c) => {
    const items = p.gear.items.filter((i) => i.cat === c);
    if (!items.length) return '';
    return `<h2>${esc(c)}</h2><table><tr><th style="width:18pt">☐</th><th>Item</th><th>Aantal</th><th>Bron</th><th>Verhuurder</th><th>Notities</th></tr>
      ${items.map((i) => `<tr><td>${['ingepakt', 'retour'].includes(i.status) ? '☑' : '☐'}</td><td>${esc(i.name)}</td><td>${esc(String(i.qty))}</td><td>${esc((SOURCE.find((s) => s[0] === i.source) || ['', ''])[1])}</td><td>${esc(i.vendor)}</td><td>${esc(i.notes)}</td></tr>`).join('')}</table>`;
  }).join('');
  printDoc(`${p.meta.title} — paklijst`, `<h1>${esc(p.meta.title)} — Paklijst apparatuur</h1><p class="muted">${p.gear.items.length} items · ${days} draaidag(en)</p>${html}`);
}
