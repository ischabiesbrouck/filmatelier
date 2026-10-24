import { h, bind, field, section, icon, money, words, num, todayISO, fmtDate } from '../util.js';
import { budgetTotals } from './budget.js';

const PHASES = ['Ontwikkeling', 'Pre-productie', 'Productie', 'Postproductie', 'Distributie'];
const GENRES = ['', 'Drama', 'Komedie', 'Tragikomedie', 'Thriller', 'Misdaad', 'Horror', 'Sciencefiction', 'Fantasy', 'Avontuur', 'Actie', 'Romantiek', 'Familie', 'Animatie', 'Documentaire', 'Musical', 'Western', 'Oorlog', 'Historisch', 'Coming-of-age'];
const FLOW = [['ideeen', 'Idee'], ['structuur', 'Structuur'], ['personages', 'Personages'], ['treatment', 'Treatment'], ['scenario', 'Scenario'],
  ['breakdown', 'Breakdown'], ['stripboard', 'Draaischema'], ['budget', 'Budget'], ['callsheet', 'Callsheets'], ['post', 'Post'], ['festivals', 'Festivals']];
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

let calMonth = null; // { y, m }

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const goBtn = (route, label, cls = '') => h('a', { class: 'go ' + cls, href: '#/' + route, title: label, 'aria-label': label }, icon('arrowUpRight', 17));

/** Halve-cirkelmeter (zoals een snelheidsmeter) voor de totale voortgang. */
function gauge(pct, done, total) {
  const L = Math.PI * 50;
  const th = Math.PI - (pct / 100) * Math.PI;
  const el = h('div', { class: 'gauge' });
  el.innerHTML = `<svg viewBox="0 0 120 70" aria-hidden="true">
    <path class="g-track" d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke-width="9" stroke-linecap="round"/>
    <path class="g-val" d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke-width="9" stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - pct / 100)}"/>
    <line class="g-needle" x1="60" y1="62" x2="${60 + 34 * Math.cos(th)}" y2="${62 - 34 * Math.sin(th)}"/>
    <circle cx="60" cy="62" r="4" fill="currentColor"/></svg>`;
  el.append(h('div', { class: 'meta' }, h('div', { class: 'v' }, `${pct}%`), h('div', { class: 'l' }, 'Project gereed'),
    h('small', {}, `gemiddelde van taken (${done}/${total}), scenario en planning`)));
  return el;
}

function calendar(ctx, p) {
  const now = new Date();
  calMonth ??= (() => { const first = p.schedule.days.map((d) => d.date).filter((d) => d && d >= todayISO()).sort()[0]; const b = first ? new Date(first + 'T12:00') : now; return { y: b.getFullYear(), m: b.getMonth() }; })();
  const shoot = {};
  p.schedule.days.forEach((d, i) => { if (d.date) shoot[d.date] = { id: d.id, n: i + 1 }; });
  const due = new Set(p.tasks.filter((t) => t.due && t.status !== 'klaar').map((t) => t.due));
  const wrap = h('div', { class: 'cal' });
  const draw = () => {
    const { y, m } = calMonth;
    const first = new Date(y, m, 1);
    const start = new Date(y, m, 1 - ((first.getDay() + 6) % 7)); // week begint op maandag
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      if (i >= 35 && d.getMonth() !== m) break;
      const k = iso(d), s = shoot[k];
      cells.push(h('button', {
        type: 'button', class: 'd' + (d.getMonth() !== m ? ' out' : '') + (k === iso(now) ? ' today' : '') + (s ? ' shoot' : ''),
        title: s ? `Draaidag ${s.n} — callsheet openen` : (due.has(k) ? 'Taak met deadline' : null),
        tabindex: s ? '0' : '-1',
        onclick: s ? () => { sessionStorage.setItem('fa.callday', s.id); ctx.go('callsheet'); } : null,
      }, String(d.getDate()), (s || due.has(k)) ? h('span', { class: 'dots' }, s ? h('i', { class: 'shoot' }) : null, due.has(k) ? h('i', { class: 'task' }) : null) : null));
    }
    wrap.replaceChildren(
      h('div', { class: 'cal-head' },
        h('button', { type: 'button', 'aria-label': 'Vorige maand', onclick: () => { calMonth = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }; draw(); } }, icon('left', 16)),
        h('b', {}, `${MONTHS[m][0].toUpperCase() + MONTHS[m].slice(1)} ${y}`),
        h('button', { type: 'button', 'aria-label': 'Volgende maand', onclick: () => { calMonth = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }; draw(); } }, icon('right', 16))),
      h('div', { class: 'cal-grid' }, ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].map((x) => h('div', { class: 'wd' }, x)), cells),
      h('div', { class: 'cal-legend' }, h('span', {}, h('i', { style: { background: 'var(--accent)' } }), 'Draaidag'), h('span', {}, h('i', { style: { background: 'var(--ink-muted)' } }), 'Deadline')));
  };
  draw();
  return wrap;
}

export default {
  id: 'overzicht', title: 'Overzicht', icon: 'home', group: 'Start',
  render(root, ctx) {
    const p = ctx.project, m = p.meta;
    const parsed = ctx.parsed();
    const bt = budgetTotals(p);
    const open = p.tasks.filter((t) => t.status !== 'klaar');
    const doneTasks = p.tasks.length - open.length;
    const scheduled = new Set(p.schedule.days.flatMap((d) => d.scenes));
    const nSched = parsed.scenes.filter((s) => scheduled.has(s.key)).length;
    const rt = Number(m.runtime) || 100;
    const overall = Math.round((((p.tasks.length ? doneTasks / p.tasks.length : 0) + Math.min(1, parsed.pages / rt) + (parsed.scenes.length ? nSched / parsed.scenes.length : 0)) / 3) * 100);
    const phaseIdx = Math.max(0, PHASES.indexOf(m.status));
    const hr = new Date().getHours();
    const today = todayISO();
    const nextDay = p.schedule.days.map((d, i) => ({ ...d, n: i + 1 })).filter((d) => d.date && d.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];

    // --- film-kaart (zwart) ---
    const hint = h('div', { class: 'film-hint' });
    const updHint = () => { const w = words(m.logline); hint.textContent = `${w} woorden${w > 45 ? ' · vrij lang, mik op 25–40' : w ? '' : ' · wie wil wat, wat staat er in de weg, wat staat er op het spel?'}`; };
    updHint();
    const pills = h('div', { class: 'pills' });
    const updPills = () => pills.replaceChildren(...[m.format, m.genre, m.runtime ? `${m.runtime} min` : '', m.status].filter(Boolean).map((x) => h('span', { class: 'pill' }, x)));
    updPills();
    const title = bind(m, 'title', ctx, { class: 'film-title', placeholder: 'Titel van je film', onchange: () => ctx.refreshNav() });
    title.setAttribute('aria-label', 'Titel');
    const tag = bind(m, 'tagline', ctx, { class: 'film-tag', placeholder: 'Tagline — één zin voor op de poster' });
    tag.setAttribute('aria-label', 'Tagline');
    const log = bind(m, 'logline', ctx, { type: 'textarea', rows: 3, class: 'film-log', placeholder: 'Logline: Wanneer … moet … voordat …', onchange: updHint });
    log.setAttribute('aria-label', 'Logline');

    const tile = (route, v, l, s) => h('a', { class: 'tile', href: '#/' + route }, h('span', { class: 'go' }, icon('arrowUpRight', 15)), h('div', { class: 'v' }, v), h('div', { class: 'l' }, l), s ? h('div', { class: 's' }, s) : null);

    const left = h('div', { class: 'dash-col' },
      h('div', { class: 'greet' },
        h('div', { class: 'hello' }, hr < 6 ? 'Goedenacht.' : hr < 12 ? 'Goedemorgen.' : hr < 18 ? 'Goedemiddag.' : 'Goedenavond.'),
        h('div', { class: 'sub' }, `Nog ${open.length} open ${open.length === 1 ? 'taak' : 'taken'}, ${parsed.pages} van ${rt} pagina’s geschreven.`),
        h('div', { class: 'sub2' }, nextDay ? `Volgende draaidag: ${fmtDate(nextDay.date, { weekday: 'long', day: 'numeric', month: 'long' })}` : 'Tijd om verder te schrijven', icon('list', 18))),
      h('section', { class: 'film-card' },
        pills, title, tag, log, hint,
        h('div', { class: 'film-foot' },
          h('span', { class: 'tag' }, `${parsed.pages} p`), h('span', { class: 'tag' }, `${parsed.scenes.length} scènes`), h('span', { class: 'tag' }, `${Object.keys(parsed.characters).length} rollen`),
          h('div', { class: 'spacer' }),
          h('button', { class: 'btn sm', type: 'button', style: { background: 'transparent', color: 'var(--ink-text)', borderColor: 'var(--ink-faint)' }, onclick: () => ctx.openAI('Wat is de volgende logische stap voor mijn film? Kijk naar wat al is ingevuld en wat ontbreekt.') }, icon('sparkles', 15), 'Wat nu?'),
          goBtn('scenario', 'Naar scenario', 'light'))),
      h('nav', { class: 'phases', 'aria-label': 'Productiefase' }, PHASES.map((ph, i) => h('button', {
        type: 'button', class: 'ph' + (i < phaseIdx ? ' done' : i === phaseIdx ? ' cur' : ''), 'aria-current': i === phaseIdx ? 'step' : null, title: `Fase instellen op ${ph}`,
        onclick: () => { m.status = ph; ctx.save(); ctx.refreshNav(); ctx.rerender(); },
      }, h('span', { class: 'n' }, String(i + 1).padStart(2, '0')), h('b', {}, ph),
      h('small', {}, `${p.tasks.filter((t) => t.phase === ph && t.status === 'klaar').length}/${p.tasks.filter((t) => t.phase === ph).length} taken`)))),
      h('div', { class: 'tiles' },
        tile('scenario', num(parsed.pages), 'Pagina’s', `${parsed.pages - rt >= 0 ? '+' : ''}${parsed.pages - rt} t.o.v. doelduur`),
        tile('kaarten', parsed.scenes.length, 'Scènes', `${num(parsed.dialogueWords + parsed.actionWords)} woorden`),
        tile('stripboard', p.schedule.days.length, 'Draaidagen', `${nSched}/${parsed.scenes.length} scènes ingepland`),
        tile('budget', money(bt.grand, p.budget.currency).replace(/\s/g, ' '), 'Budget', `besteed ${money(bt.actual, p.budget.currency)}`),
        tile('personages', p.characters.length, 'Personages', `${Object.keys(parsed.characters).length} sprekend`),
        tile('mensen', p.people.length, 'Cast & crew', `${p.people.filter((x) => x.type === 'cast').length} cast`),
        tile('shots', Object.values(p.shots).reduce((a, l) => a + l.length, 0), 'Shots', 'shotlist & storyboard'),
        tile('ideeen', p.ideas.length, 'Ideeën', 'in het Ideeënlab')),
      h('div', { class: 'grid g2', style: { alignItems: 'start' } },
        section('Projectgegevens',
          h('div', { class: 'grid g2' },
            field('Genre', bind(m, 'genre', ctx, { type: 'select', options: GENRES.includes(m.genre) ? GENRES : [...GENRES, m.genre], onchange: updPills })),
            field('Doelduur (min)', bind(m, 'runtime', ctx, { type: 'number', min: 1, onchange: updPills })),
            field('Format', bind(m, 'format', ctx, { type: 'select', options: ['Speelfilm', 'Korte film', 'Televisiefilm', 'Pilot (serie)', 'Documentaire'], onchange: updPills })),
            field('Thema', bind(m, 'theme', ctx, { placeholder: 'Waar gaat het écht over?' })),
            field('Vergelijkbare titels', bind(m, 'comps', ctx, { placeholder: 'Film A × Film B' }), null, 'span2'))),
        section('Werkstroom',
          h('div', { class: 'pipeline' }, FLOW.map(([route, label]) => h('a', { href: '#/' + route }, label, icon('arrowUpRight', 13)))))));

    const d = new Date();
    const right = h('div', { class: 'dash-col' },
      h('section', { class: 'datecard' },
        h('div', { class: 'top' }, h('span', { class: 'eyebrow', style: { marginBottom: 0 } }, 'Vandaag'), h('span', { class: 'faint small' }, d.getFullYear())),
        h('div', { class: 'big' }, String(d.getDate()).padStart(2, '0'), h('span', { class: 'dot' }, '.'), String(d.getMonth() + 1).padStart(2, '0')),
        h('div', { class: 'wd' }, d.toLocaleDateString('nl-NL', { weekday: 'long' })),
        h('div', { class: 'next' },
          h('div', { style: { flex: 1 } }, h('div', { class: 'lbl' }, 'Volgende draaidag'),
            h('div', { class: 'val' }, nextDay ? `Dag ${nextDay.n} · ${fmtDate(nextDay.date, { weekday: 'short', day: 'numeric', month: 'short' })}` : 'Nog niet gepland')),
          goBtn(nextDay ? 'callsheet' : 'stripboard', nextDay ? 'Callsheet' : 'Draaischema'))),
      gauge(overall, doneTasks, p.tasks.length),
      calendar(ctx, p),
      h('section', { class: 'tl' },
        h('div', { class: 'card-title', style: { marginBottom: '14px' } }, 'Volgende taken', h('div', { class: 'spacer' }), h('a', { class: 'chip', href: '#/taken' }, 'Alles')),
        open.length ? h('div', { class: 'tl-list' }, open.sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 5).map((t) => h('div', { class: 'tl-item' },
          h('button', { class: 'tl-node', type: 'button', title: 'Afvinken', 'aria-label': `“${t.title}” afvinken`, onclick: () => { t.status = 'klaar'; ctx.save(); ctx.rerender(); } }),
          h('div', { class: 'tl-body' }, h('b', {}, t.title), h('small', {}, [t.phase, t.due ? fmtDate(t.due, { day: 'numeric', month: 'short' }) : null, t.who].filter(Boolean).join(' · '))))))
          : h('p', { class: 'muted' }, 'Geen open taken.')));
    root.append(h('div', { class: 'title-row' }, h('h1', {}, 'Studio'), h('span', { class: 'light' }, 'overzicht van je film')),
      h('div', { class: 'dash' }, left, right));
  },
};
