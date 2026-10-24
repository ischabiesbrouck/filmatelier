import { h, bind, field, btn, iconBtn, pageHead, empty, tabs, uid, money, esc, printDoc, download, slug, confirmDlg, toast } from '../util.js';
import { BUDGET_TEMPLATE } from '../store.js';

export const BCATS = ['Boven de lijn', 'Productie', 'Postproductie', 'Overig'];
const UNITS = ['forfait', 'dag', 'week', 'maand', 'uur', 'stuk', 'km'];
let view = 'detail';

const lineTotal = (it) => (Number(it.qty) || 0) * (Number(it.rate) || 0);

export function budgetTotals(p) {
  const B = p.budget;
  const byCat = Object.fromEntries(BCATS.map((c) => [c, 0]));
  let actual = 0;
  B.items.forEach((it) => { byCat[it.cat] = (byCat[it.cat] || 0) + lineTotal(it); actual += Number(it.actual) || 0; });
  const sub = Object.values(byCat).reduce((a, b) => a + b, 0);
  const overhead = sub * (Number(B.overhead) || 0) / 100;
  const insurance = sub * (Number(B.insurance) || 0) / 100;
  const contingency = (sub + overhead + insurance) * (Number(B.contingency) || 0) / 100;
  return { byCat, sub, overhead, insurance, contingency, grand: sub + overhead + insurance + contingency, actual };
}

export default {
  id: 'budget', title: 'Budget', icon: 'euro', group: 'Pre-productie',
  render(root, ctx) {
    const p = ctx.project, B = p.budget;
    const cur = B.currency || 'EUR';
    const t = budgetTotals(p);
    root.append(pageHead('Budget', 'Begroting met topsheet, onvoorzien en een kolom voor werkelijke kosten.',
      btn('Topsheet afdrukken', () => printBudget(p), { icon: 'print' }),
      btn('CSV', () => download(`${slug(p.meta.title)}-budget.csv`, toCSV(p), 'text/csv;charset=utf-8'), { icon: 'download', class: 'ghost' }),
      btn('AI-check', () => ctx.openAI('Controleer mijn budget: welke posten ontbreken voor een speelfilm van deze omvang, en welke bedragen lijken onrealistisch? Houd rekening met aantal draaidagen, cast en locaties.'), { icon: 'sparkles', class: 'ghost' })),
    tabs([['detail', 'Begroting'], ['top', 'Topsheet']], view, (v) => { view = v; ctx.rerender(); }));

    const summary = h('div', { class: 'grid g4', style: { marginBottom: '16px' } },
      h('div', { class: 'stat' }, h('div', { class: 'v' }, money(t.grand, cur)), h('div', { class: 'l' }, 'Totaal incl. opslagen')),
      h('div', { class: 'stat' }, h('div', { class: 'v' }, money(t.sub, cur)), h('div', { class: 'l' }, 'Directe kosten')),
      h('div', { class: 'stat' }, h('div', { class: 'v' }, money(t.actual, cur)), h('div', { class: 'l' }, 'Werkelijk besteed'), h('div', { class: 's' }, t.grand ? `${Math.round((t.actual / t.grand) * 100)}% van begroting` : '')),
      h('div', { class: 'stat' }, h('div', { class: 'v' }, p.schedule.days.length ? money(t.grand / p.schedule.days.length, cur) : '—'), h('div', { class: 'l' }, 'Per draaidag')));

    if (view === 'top') { root.append(summary, topSheet(p, t, cur)); return; }

    root.append(summary,
      h('div', { class: 'card row wrap', style: { marginBottom: '14px', alignItems: 'end' } },
        field('Valuta', bind(B, 'currency', ctx, { type: 'select', options: ['EUR', 'USD', 'GBP', 'CHF', 'DKK', 'SEK', 'NOK'], onchange: () => ctx.rerender() })),
        field('Productiekosten / overhead %', bind(B, 'overhead', ctx, { type: 'number', min: 0, step: 0.5, onchange: () => ctx.rerender() })),
        field('Verzekering %', bind(B, 'insurance', ctx, { type: 'number', min: 0, step: 0.5, onchange: () => ctx.rerender() })),
        field('Onvoorzien %', bind(B, 'contingency', ctx, { type: 'number', min: 0, step: 0.5, onchange: () => ctx.rerender() })),
        h('div', { class: 'spacer' }),
        btn('Aantallen uit draaischema', () => {
          const d = p.schedule.days.length;
          if (!d) { toast('Maak eerst een draaischema'); return; }
          let n = 0;
          B.items.forEach((it) => { if (it.cat === 'Productie' && it.unit === 'dag') { it.qty = d; n++; } if (it.cat === 'Productie' && it.unit === 'week') { it.qty = Math.ceil(d / 5); n++; } });
          ctx.save(); ctx.rerender(); toast(`${n} posten bijgewerkt (${d} draaidagen)`);
        }, { icon: 'strip', class: 'sm' }),
        !B.items.length ? btn('Standaardposten laden', () => { B.items = BUDGET_TEMPLATE.map(([cat, acct, desc, qty, unit, rate]) => ({ id: uid(), cat, acct, desc, qty, unit, rate, actual: 0 })); ctx.save(); ctx.rerender(); }, { class: 'sm primary' }) : null));

    if (!B.items.length) { root.append(empty('Nog geen begrotingsposten.')); return; }
    BCATS.forEach((cat) => {
      const items = B.items.filter((it) => it.cat === cat);
      const subTotals = items.map(lineTotal);
      const totCell = [];
      root.append(h('div', { class: 'card table-wrap', style: { marginBottom: '14px' } },
        h('h3', { class: 'card-title' }, cat, h('div', { class: 'spacer' }), h('span', { 'data-cat-total': cat, style: { color: 'var(--text)', fontSize: '.95rem', textTransform: 'none', letterSpacing: 0 } }, money(t.byCat[cat], cur))),
        h('table', { class: 'tbl' },
          h('thead', {}, h('tr', {}, ['Code', 'Omschrijving', 'Aantal', 'Eenheid', 'Tarief', 'Totaal', 'Werkelijk', ''].map((x, i) => h('th', { class: i >= 4 && i <= 6 ? 'num' : '' }, x)))),
          h('tbody', {}, items.map((it, i) => {
            const tot = h('td', { class: 'num nowrap' }, money(subTotals[i], cur));
            totCell.push(tot);
            const recalc = () => { tot.textContent = money(lineTotal(it), cur); };
            return h('tr', {},
              h('td', { style: { width: '70px' } }, bind(it, 'acct', ctx)),
              h('td', { style: { minWidth: '240px' } }, bind(it, 'desc', ctx)),
              h('td', { style: { width: '80px' } }, bind(it, 'qty', ctx, { type: 'number', min: 0, step: 'any', onchange: recalc })),
              h('td', { style: { width: '100px' } }, bind(it, 'unit', ctx, { type: 'select', options: UNITS })),
              h('td', { style: { width: '110px' } }, bind(it, 'rate', ctx, { type: 'number', min: 0, step: 'any', onchange: recalc, class: 'num' })),
              tot,
              h('td', { style: { width: '110px' } }, bind(it, 'actual', ctx, { type: 'number', min: 0, step: 'any', class: 'num' })),
              h('td', {}, iconBtn('trash', 'Verwijderen', async () => { if (!lineTotal(it) || await confirmDlg(`Post “${it.desc}” verwijderen?`, 'Verwijderen', true)) { B.items.splice(B.items.indexOf(it), 1); ctx.save(); ctx.rerender(); } }, 'danger')));
          }))),
        h('div', { style: { marginTop: '8px' } }, btn('Post toevoegen', () => { B.items.push({ id: uid(), cat, acct: '', desc: '', qty: 1, unit: 'forfait', rate: 0, actual: 0 }); ctx.save(); ctx.rerender(); }, { icon: 'plus', class: 'sm ghost' }))));
    });
    // Totalen live bijwerken zonder te herrenderen (zodat de focus in het veld blijft)
    const live = () => {
      const n = budgetTotals(p);
      const vs = summary.querySelectorAll('.v');
      vs[0].textContent = money(n.grand, cur); vs[1].textContent = money(n.sub, cur); vs[2].textContent = money(n.actual, cur);
      vs[3].textContent = p.schedule.days.length ? money(n.grand / p.schedule.days.length, cur) : '—';
      summary.querySelectorAll('.s')[0].textContent = n.grand ? `${Math.round((n.actual / n.grand) * 100)}% van begroting` : '';
      root.querySelectorAll('[data-cat-total]').forEach((el) => { el.textContent = money(n.byCat[el.dataset.catTotal], cur); });
    };
    root.querySelectorAll('.tbl input[type=number]').forEach((i) => i.addEventListener('input', live));
  },
};

function topSheet(p, t, cur) {
  const pct = (v) => (t.grand ? ((v / t.grand) * 100).toFixed(1) + '%' : '');
  return h('div', { class: 'card' }, h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Categorie'), h('th', { class: 'num' }, 'Begroot'), h('th', { class: 'num' }, '%'), h('th', { class: 'num' }, 'Werkelijk'))),
    h('tbody', {},
      BCATS.map((c) => h('tr', {}, h('td', {}, c), h('td', { class: 'num' }, money(t.byCat[c], cur)), h('td', { class: 'num muted' }, pct(t.byCat[c])),
        h('td', { class: 'num' }, money(p.budget.items.filter((i) => i.cat === c).reduce((a, i) => a + (Number(i.actual) || 0), 0), cur)))),
      h('tr', {}, h('td', {}, h('b', {}, 'Subtotaal directe kosten')), h('td', { class: 'num' }, h('b', {}, money(t.sub, cur))), h('td', {}), h('td', {})),
      h('tr', {}, h('td', {}, `Productiekosten / overhead (${p.budget.overhead || 0}%)`), h('td', { class: 'num' }, money(t.overhead, cur)), h('td', { class: 'num muted' }, pct(t.overhead)), h('td', {})),
      h('tr', {}, h('td', {}, `Verzekering (${p.budget.insurance || 0}%)`), h('td', { class: 'num' }, money(t.insurance, cur)), h('td', { class: 'num muted' }, pct(t.insurance)), h('td', {})),
      h('tr', {}, h('td', {}, `Onvoorzien (${p.budget.contingency || 0}%)`), h('td', { class: 'num' }, money(t.contingency, cur)), h('td', { class: 'num muted' }, pct(t.contingency)), h('td', {}))),
    h('tfoot', {}, h('tr', {}, h('td', {}, 'TOTAAL'), h('td', { class: 'num' }, money(t.grand, cur)), h('td', { class: 'num' }, '100%'), h('td', { class: 'num' }, money(t.actual, cur))))));
}

function toCSV(p) {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  return '﻿' + [['Categorie', 'Code', 'Omschrijving', 'Aantal', 'Eenheid', 'Tarief', 'Totaal', 'Werkelijk'].join(';'),
    ...p.budget.items.map((i) => [i.cat, i.acct, i.desc, i.qty, i.unit, i.rate, lineTotal(i), i.actual].map(q).join(';'))].join('\r\n');
}

function printBudget(p) {
  const t = budgetTotals(p), cur = p.budget.currency;
  const rows = BCATS.map((c) => {
    const items = p.budget.items.filter((i) => i.cat === c);
    return `<h2>${c} — ${money(t.byCat[c], cur)}</h2><table><tr><th>Code</th><th>Omschrijving</th><th class="right">Aantal</th><th>Eenheid</th><th class="right">Tarief</th><th class="right">Totaal</th></tr>${items.map((i) => `<tr><td>${esc(i.acct)}</td><td>${esc(i.desc)}</td><td class="right">${esc(String(i.qty))}</td><td>${esc(i.unit)}</td><td class="right">${money(i.rate, cur)}</td><td class="right">${money(lineTotal(i), cur)}</td></tr>`).join('')}</table>`;
  }).join('');
  printDoc(`${p.meta.title} — budget`, `<h1>${esc(p.meta.title)} — Begroting</h1>
    <table><tr><th>Categorie</th><th class="right">Bedrag</th></tr>${BCATS.map((c) => `<tr><td>${c}</td><td class="right">${money(t.byCat[c], cur)}</td></tr>`).join('')}
    <tr><td>Overhead (${p.budget.overhead}%)</td><td class="right">${money(t.overhead, cur)}</td></tr><tr><td>Verzekering (${p.budget.insurance}%)</td><td class="right">${money(t.insurance, cur)}</td></tr>
    <tr><td>Onvoorzien (${p.budget.contingency}%)</td><td class="right">${money(t.contingency, cur)}</td></tr><tr><th>TOTAAL</th><th class="right">${money(t.grand, cur)}</th></tr></table>
    <div class="pb"></div>${rows}`);
}
