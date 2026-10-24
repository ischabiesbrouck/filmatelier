import { h, bind, btn, iconBtn, pageHead, uid, todayISO, fmtDate, confirmDlg, toast } from '../util.js';
import { TASK_TEMPLATE } from '../store.js';

const PHASES = ['Ontwikkeling', 'Pre-productie', 'Productie', 'Postproductie', 'Distributie'];
const COLS = [['todo', 'Te doen'], ['bezig', 'Bezig'], ['klaar', 'Klaar']];
let phase = '';
let editing = null;

export default {
  id: 'taken', title: 'Planning & taken', icon: 'check', group: 'Pre-productie',
  badge: (ctx) => ctx.project.tasks.filter((t) => t.status !== 'klaar').length || null,
  render(root, ctx) {
    const p = ctx.project;
    const today = todayISO();
    const quick = h('input', { placeholder: 'Nieuwe taak… (Enter)' });
    quick.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && quick.value.trim()) {
        p.tasks.push({ id: uid(), title: quick.value.trim(), phase: phase || p.meta.status || 'Ontwikkeling', status: 'todo', due: '', who: '' });
        ctx.save(); ctx.rerender(); setTimeout(() => root.querySelector('input')?.focus(), 0);
      }
    });
    root.append(pageHead('Planning & taken', 'Takenbord per fase. Sleep kaarten tussen kolommen; klik een kaart om te bewerken.',
      btn('Standaard productie-checklist', async () => {
        const have = new Set(p.tasks.map((t) => t.title));
        const add = TASK_TEMPLATE.filter(([, t]) => !have.has(t));
        if (!add.length) { toast('Alle standaardtaken staan er al in'); return; }
        if (!(await confirmDlg(`${add.length} standaardtaken toevoegen (van ontwikkeling tot distributie)?`, 'Toevoegen'))) return;
        add.forEach(([ph, title]) => p.tasks.push({ id: uid(), title, phase: ph, status: 'todo', due: '', who: '' }));
        ctx.save(); ctx.rerender();
      }, { icon: 'list' })),
    h('div', { class: 'row wrap', style: { marginBottom: '14px' } }, h('div', { style: { flex: '1 1 280px' } }, quick),
      h('div', { class: 'chips' }, ['', ...PHASES].map((ph) => h('button', { class: 'chip' + (phase === ph ? ' on' : ''), type: 'button', onclick: () => { phase = ph; ctx.rerender(); } }, ph || 'Alle fasen')))));

    const kb = h('div', { class: 'kanban' });
    COLS.forEach(([st, label]) => {
      const tasks = p.tasks.filter((t) => t.status === st && (!phase || t.phase === phase)).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
      const list = h('div', { class: 'klist', 'data-status': st });
      list.addEventListener('dragover', (e) => { e.preventDefault(); list.classList.add('over'); });
      list.addEventListener('dragleave', (e) => { if (!list.contains(e.relatedTarget)) list.classList.remove('over'); });
      list.addEventListener('drop', (e) => {
        e.preventDefault(); list.classList.remove('over');
        const t = p.tasks.find((x) => x.id === e.dataTransfer.getData('text/x-task'));
        if (t) { t.status = st; ctx.save(); ctx.rerender(); }
      });
      tasks.forEach((t) => {
        const late = t.due && t.due < today && st !== 'klaar';
        if (editing === t.id) {
          list.append(h('div', { class: 'ktask stack tight' },
            bind(t, 'title', ctx),
            h('div', { class: 'row' }, bind(t, 'phase', ctx, { type: 'select', options: PHASES }), bind(t, 'due', ctx, { type: 'date' })),
            bind(t, 'who', ctx, { placeholder: 'Wie?' }),
            bind(t, 'notes', ctx, { type: 'textarea', rows: 2, placeholder: 'Notities' }),
            h('div', { class: 'row' }, btn('Klaar', () => { editing = null; ctx.rerender(); }, { class: 'sm primary' }), h('div', { class: 'spacer' }),
              iconBtn('trash', 'Verwijderen', () => { p.tasks.splice(p.tasks.indexOf(t), 1); editing = null; ctx.save(); ctx.rerender(); }, 'danger'))));
          return;
        }
        list.append(h('div', { class: 'ktask' + (late ? ' late' : ''), draggable: 'true', ondragstart: (e) => e.dataTransfer.setData('text/x-task', t.id), onclick: (e) => { if (e.target.type !== 'checkbox') { editing = t.id; ctx.rerender(); } } },
          h('div', { class: 'row top' },
            h('input', { type: 'checkbox', checked: st === 'klaar', title: 'Afvinken', onchange: (e) => { t.status = e.target.checked ? 'klaar' : 'todo'; ctx.save(); ctx.rerender(); } }),
            h('span', { class: 't', style: { textDecoration: st === 'klaar' ? 'line-through' : '' } }, t.title)),
          h('div', { class: 'm' }, h('span', { class: 'badge' }, t.phase), t.due ? h('span', { class: 'due' }, fmtDate(t.due, { day: 'numeric', month: 'short' })) : null, t.who ? h('span', {}, '· ' + t.who) : null)));
      });
      kb.append(h('div', { class: 'kcol' }, h('h3', {}, label, h('span', {}, tasks.length)), list));
    });
    root.append(kb);
  },
};
