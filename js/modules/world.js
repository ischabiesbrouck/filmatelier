import { h, bind, field, btn, iconBtn, pageHead, empty, uid, confirmDlg } from '../util.js';

const CATS = ['Wereld & setting', 'Research', 'Regels van de wereld', 'Geschiedenis / tijdlijn', 'Bronnen & interviews', 'Thema & motieven', 'Toon & stijl', 'Overig'];
let filter = '';
let q = '';

export default {
  id: 'wereld', title: 'Wereld & research', icon: 'globe', group: 'Ontwikkeling',
  render(root, ctx) {
    const p = ctx.project;
    const add = () => { p.world.unshift({ id: uid(), title: '', category: filter || CATS[0], text: '', link: '' }); ctx.save(); ctx.rerender(); setTimeout(() => root.querySelector('.world-item input')?.focus(), 0); };
    const search = h('input', { type: 'search', placeholder: 'Zoeken…', value: q, style: { maxWidth: '260px' } });
    search.addEventListener('input', () => { q = search.value; renderList(); });
    root.append(pageHead('Wereld & research', 'Alles wat je film geloofwaardig maakt: setting, regels, geschiedenis, bronnen en motieven.',
      btn('Nieuw item', add, { icon: 'plus', class: 'primary' }),
      btn('Researchvragen (AI)', () => ctx.openAI('Welke research moet ik doen om de wereld van mijn film geloofwaardig te maken? Geef concrete vragen, bronnen en mensen om te interviewen.'), { icon: 'sparkles', class: 'ghost' })),
    h('div', { class: 'row wrap', style: { marginBottom: '14px' } }, search,
      h('div', { class: 'chips' }, ['', ...CATS].map((c) => h('button', { class: 'chip' + (filter === c ? ' on' : ''), type: 'button', onclick: () => { filter = c; ctx.rerender(); } }, c || 'Alles')))));
    const wrap = h('div', { class: 'grid auto' });
    root.append(wrap);
    function renderList() {
      wrap.replaceChildren();
      const items = p.world.filter((w) => (!filter || w.category === filter) && (!q || (w.title + ' ' + w.text).toLowerCase().includes(q.toLowerCase())));
      if (!items.length) { wrap.append(empty(p.world.length ? 'Niets gevonden.' : 'Nog leeg. Begin met de setting: waar en wanneer speelt je film?', btn('Nieuw item', add, { icon: 'plus' }))); wrap.firstChild.classList.add('span-all'); return; }
      items.forEach((w) => wrap.append(h('div', { class: 'card stack tight world-item' },
        h('div', { class: 'row' }, bind(w, 'title', ctx, { placeholder: 'Titel', style: 'font-weight:600' }),
          iconBtn('trash', 'Verwijderen', async () => { if (!w.text || await confirmDlg('Dit item verwijderen?', 'Verwijderen', true)) { p.world.splice(p.world.indexOf(w), 1); ctx.save(); renderList(); } }, 'danger')),
        bind(w, 'category', ctx, { type: 'select', options: CATS }),
        bind(w, 'text', ctx, { type: 'textarea', rows: 6, placeholder: 'Aantekeningen…' }),
        h('div', { class: 'row' }, bind(w, 'link', ctx, { type: 'url', placeholder: 'https://bron…' }),
          w.link ? h('a', { href: w.link, target: '_blank', rel: 'noopener', class: 'icon-btn', title: 'Open bron' }, '↗') : null))));
    }
    renderList();
  },
};
