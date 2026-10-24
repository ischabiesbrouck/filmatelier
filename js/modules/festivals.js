import { h, bind, field, section, btn, pageHead, tabs, uid, money, todayISO, fmtDate, confirmDlg } from '../util.js';
import { gridEditor } from '../grid.js';

const SUGGEST = ['Nederlands Film Festival (Utrecht)', 'International Film Festival Rotterdam (IFFR)', 'Berlinale', 'Festival de Cannes', 'Mostra di Venezia', 'Toronto International Film Festival', 'Sundance Film Festival', 'Locarno Film Festival', 'San Sebastián', 'Karlovy Vary', 'Film Fest Gent', 'Cinekid (jeugd)', 'IDFA (documentaire)', 'Tribeca Festival', 'SXSW', 'Busan International Film Festival'];
const STATUS = ['Overwegen', 'Klaar om in te dienen', 'Ingediend', 'Geselecteerd', 'Afgewezen', 'Vertoond', 'Prijs gewonnen'];
let tab = 'list';

export default {
  id: 'festivals', title: 'Festivals & distributie', icon: 'trophy', group: 'Post & distributie',
  render(root, ctx) {
    const p = ctx.project;
    p.distribution ??= { salesAgent: '', distributor: '', strategy: '', press: {} };
    const D = p.distribution;
    const today = todayISO();
    const upcoming = p.festivals.filter((f) => f.deadline && f.deadline >= today && ['Overwegen', 'Klaar om in te dienen'].includes(f.status)).sort((a, b) => a.deadline.localeCompare(b.deadline));
    const fees = p.festivals.filter((f) => f.status !== 'Overwegen').reduce((a, f) => a + (Number(f.fee) || 0), 0);
    root.append(pageHead('Festivals & distributie', 'Festivalstrategie, deadlines, inzendingen en je perskit.',
      btn('AI: festivalstrategie', () => ctx.openAI('Stel een festivalstrategie op voor mijn film: welke festivals passen (genre, premièrestatus), in welke volgorde, en wat is realistisch?'), { icon: 'sparkles', class: 'ghost' })),
    tabs([['list', `Festivals (${p.festivals.length})`], ['dist', 'Distributie & perskit']], tab, (t) => { tab = t; ctx.rerender(); }));

    if (tab === 'list') {
      root.append(h('div', { class: 'grid g3', style: { marginBottom: '14px' } },
        h('div', { class: 'stat' }, h('div', { class: 'v' }, p.festivals.filter((f) => f.status === 'Ingediend').length), h('div', { class: 'l' }, 'Ingediend')),
        h('div', { class: 'stat' }, h('div', { class: 'v' }, p.festivals.filter((f) => ['Geselecteerd', 'Vertoond', 'Prijs gewonnen'].includes(f.status)).length), h('div', { class: 'l' }, 'Selecties')),
        h('div', { class: 'stat' }, h('div', { class: 'v' }, money(fees, p.budget.currency)), h('div', { class: 'l' }, 'Inschrijfkosten'))),
      upcoming.length ? section('Eerstvolgende deadlines', h('div', { class: 'chips' }, upcoming.slice(0, 6).map((f) => {
        const days = Math.round((new Date(f.deadline) - new Date(today)) / 864e5);
        return h('span', { class: 'chip' + (days < 14 ? ' on' : '') }, `${f.name} — ${fmtDate(f.deadline, { day: 'numeric', month: 'short' })} (${days} d)`);
      }))) : null,
      h('div', { style: { height: '12px' } }),
      gridEditor(ctx, p.festivals, [
        { key: 'name', label: 'Festival', width: '200px', list: 'fest-sug' },
        { key: 'section', label: 'Sectie / categorie', width: '140px' },
        { key: 'premiere', label: 'Premièrevereiste', type: 'select', options: ['—', 'Wereld', 'Internationaal', 'Europees', 'Nationaal', 'Geen'], width: '130px' },
        { key: 'deadline', label: 'Deadline', type: 'date', width: '140px' },
        { key: 'fee', label: 'Fee', type: 'number', width: '80px' },
        { key: 'status', label: 'Status', type: 'select', options: STATUS, width: '150px' },
        { key: 'notify', label: 'Uitslag op', type: 'date', width: '140px' },
        { key: 'url', label: 'Link', type: 'url', width: '140px' },
        { key: 'notes', label: 'Notities', type: 'textarea' },
      ], () => ({ name: '', section: '', premiere: '—', deadline: '', fee: '', status: 'Overwegen', notify: '', url: '', notes: '' }), {
        addLabel: 'Festival toevoegen', emptyText: 'Nog geen festivals. Voeg ze toe of laad een lijst met bekende festivals (deadlines vul je zelf in; die wisselen per jaar).',
        rowStyle: (f) => ({ opacity: f.status === 'Afgewezen' ? 0.5 : 1 }),
      }),
      h('datalist', { id: 'fest-sug' }, SUGGEST.map((s) => h('option', { value: s }))),
      !p.festivals.length ? h('div', { style: { marginTop: '10px' } }, btn('Bekende festivals laden', async () => {
        if (!(await confirmDlg(`${SUGGEST.length} bekende festivals toevoegen? Controleer zelf deadlines en voorwaarden op hun websites.`, 'Toevoegen'))) return;
        SUGGEST.forEach((name) => p.festivals.push({ id: uid(), name, section: '', premiere: '—', deadline: '', fee: '', status: 'Overwegen', notify: '', url: '', notes: '' }));
        ctx.save(); ctx.rerender();
      }, { class: 'ghost', icon: 'list' })) : null);
    } else {
      const KIT = ['Logline & synopsis (kort/lang)', 'Regievisie', 'Biografieën & filmografieën', 'Cast & crew-lijst', 'Persfoto’s (stills)', 'Poster / key art', 'Trailer', 'Teaser / clips', 'Screener-link (beveiligd)', 'Technische gegevens', 'Ondertitels EN', 'Website / social media', 'EPK (making-of, interviews)', 'Persbericht'];
      D.press ??= {};
      root.append(h('div', { class: 'grid g2', style: { alignItems: 'start' } },
        section('Partners', h('div', { class: 'stack' },
          field('Sales agent', bind(D, 'salesAgent', ctx, { placeholder: 'Naam, contact, territoria' })),
          field('Distributeur(s)', bind(D, 'distributor', ctx, { type: 'textarea', rows: 2, placeholder: 'Bioscoop NL/BE, streaming, tv' })),
          field('Releasestrategie', bind(D, 'strategy', ctx, { type: 'textarea', rows: 6, placeholder: 'Festivalronde → bioscooprelease → VOD/streaming → tv. Vensters en data.' })))),
        section('Perskit', h('div', { class: 'stack tight' }, KIT.map((k) => h('label', { class: 'check', style: { color: 'var(--text)' } }, bind(D.press, k, ctx, { type: 'checkbox' }), k))))));
    }
  },
};
