// Herbruikbare bewerkbare tabel voor eenvoudige lijsten (VFX, muziek, festivals…).
import { h, bind, btn, iconBtn, uid, empty } from './util.js';

/**
 * @param ctx      app-context
 * @param rows     array met rij-objecten (wordt gemuteerd)
 * @param cols     [{ key, label, type?, options?, width?, placeholder?, render?(row) }]
 * @param make     () => nieuw rij-object
 */
export function gridEditor(ctx, rows, cols, make, { addLabel = 'Rij toevoegen', emptyText = 'Nog leeg.', rowStyle } = {}) {
  const addBtn = btn(addLabel, () => { rows.push({ id: uid(), ...make() }); ctx.save(); ctx.rerender(); }, { icon: 'plus', class: 'sm' });
  if (!rows.length) return h('div', { class: 'stack' }, empty(emptyText), h('div', {}, addBtn));
  return h('div', { class: 'card table-wrap' },
    h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, cols.map((c) => h('th', { class: c.type === 'number' ? 'num' : '' }, c.label)), h('th', {}))),
      h('tbody', {}, rows.map((r) => h('tr', { style: rowStyle?.(r) },
        cols.map((c) => h('td', { style: { minWidth: c.width || (c.type === 'textarea' ? '220px' : '90px') } },
          c.render ? c.render(r) : bind(r, c.key, ctx, { type: c.type === 'textarea' ? 'text' : c.type, options: c.options, placeholder: c.placeholder, list: c.list, onchange: c.onchange ? (v) => c.onchange(v, r) : undefined }))),
        h('td', {}, iconBtn('trash', 'Verwijderen', () => { rows.splice(rows.indexOf(r), 1); ctx.save(); ctx.rerender(); }, 'danger')))))),
    h('div', { style: { marginTop: '10px' } }, addBtn));
}
