import { h, bind, field, section, btn, iconBtn, pageHead, empty, uid, confirmDlg, pickFile, compressImage, num, tabs } from '../util.js';

let selId = null;
let view = 'bible';

/** Raster personage × personage: elke cel is hoe de rij-persoon tegenover de kolom-persoon staat. */
function relationMatrix(root, ctx, p) {
  const cs = p.characters;
  if (cs.length < 2) { root.append(empty('Maak minstens twee personages aan om relaties in kaart te brengen.')); return; }
  cs.forEach((c) => { c.relations ??= []; });
  const cell = (a, b) => {
    const ta = h('textarea', { rows: 2, placeholder: '…', style: { minWidth: '150px', fontSize: '.82rem', padding: '4px 6px' } });
    ta.value = a.relations.find((r) => r.with === b.id)?.text || '';
    ta.addEventListener('input', () => {
      let r = a.relations.find((x) => x.with === b.id);
      if (!r) { r = { with: b.id, text: '' }; a.relations.push(r); }
      r.text = ta.value;
      if (!ta.value.trim()) a.relations.splice(a.relations.indexOf(r), 1);
      ctx.save();
    });
    return ta;
  };
  root.append(h('p', { class: 'muted' }, 'Lees per rij: hoe staat het rij-personage tegenover het kolom-personage? (bijv. “beschermt hem, maar verzwijgt de schuld”). Zo zie je ook ongelijke relaties: A houdt van B, B vertrouwt A niet.'),
    h('div', { class: 'card table-wrap' }, h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, h('th', {}, 'tegenover →'), cs.map((c) => h('th', {}, c.name)))),
      h('tbody', {}, cs.map((a) => h('tr', {}, h('th', { style: { whiteSpace: 'nowrap' } }, a.name),
        cs.map((b) => (a === b ? h('td', { style: { background: 'var(--panel3)' } }) : h('td', {}, cell(a, b))))))))));
}

const ROLES = ['Protagonist', 'Co-protagonist', 'Antagonist', 'Mentor', 'Liefde / B-verhaal', 'Bondgenoot', 'Tegenspeler', 'Comic relief', 'Bijrol', 'Figurant'];

const QUESTIONS = ['Wat is het eerste wat ze ’s ochtends denkt?', 'Waar schaamt hij zich voor?', 'Wat zou ze nooit doen — en wanneer doet ze het toch?', 'Wie heeft hem het meest gekwetst?', 'Wat ligt er in haar nachtkastje?', 'Hoe praat hij tegen iemand die hij niet mag?', 'Wat wil ze dat niemand weet?', 'Wat is zijn grootste overwinning, waar niemand van weet?'];

export function initials(name) { return (name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(); }

export default {
  id: 'personages', title: 'Personages', icon: 'users', group: 'Ontwikkeling',
  badge: (ctx) => ctx.project.characters.length || null,
  render(root, ctx) {
    const p = ctx.project;
    const parsed = ctx.parsed();
    const known = new Set(p.characters.map((c) => c.name.toUpperCase()));
    const missing = Object.values(parsed.characters).filter((c) => !known.has(c.name)).sort((a, b) => b.lines - a.lines);
    const want = sessionStorage.getItem('fa.selchar');
    if (want) { sessionStorage.removeItem('fa.selchar'); selId = want; view = 'bible'; }
    if (!p.characters.find((c) => c.id === selId)) selId = p.characters[0]?.id;
    const add = (name = 'NIEUW PERSONAGE') => {
      const c = { id: uid(), name, role: '', age: '', description: '', want: '', need: '', wound: '', flaw: '', arc: '', voice: '', backstory: '', notes: '', relations: [], photo: '' };
      p.characters.push(c); selId = c.id; ctx.save(); ctx.rerender();
    };

    root.append(pageHead('Personages', 'Je personagebijbel: extern en intern doel, wond, profiel en ontwikkeling — gekoppeld aan wat ze in het scenario doen.',
      btn('Nieuw personage', () => add(), { icon: 'plus', class: 'primary' })),
    tabs([['bible', 'Personagebijbel'], ['matrix', 'Relatiematrix']], view, (v) => { view = v; ctx.rerender(); }));
    if (view === 'matrix') return relationMatrix(root, ctx, p);

    const list = h('div', { class: 'card stack tight' },
      p.characters.map((c) => {
        const st = parsed.characters[c.name.toUpperCase()];
        return h('div', { class: 'list-item' + (c.id === selId ? ' active' : ''), onclick: () => { selId = c.id; ctx.rerender(); } },
          c.photo ? h('img', { src: c.photo, class: 'avatar', style: { objectFit: 'cover' }, alt: '' }) : h('div', { class: 'avatar' }, initials(c.name)),
          h('div', { style: { minWidth: 0 } }, h('div', { style: { fontWeight: 600 } }, c.name), h('small', { class: 'muted' }, [c.role, st ? `${st.scenes.size} sc.` : null].filter(Boolean).join(' · ') || '—')));
      }),
      !p.characters.length ? h('p', { class: 'muted small' }, 'Nog geen personages.') : null,
      missing.length ? h('div', { style: { marginTop: '10px' } },
        h('div', { class: 'card-title' }, 'In scenario, nog niet uitgewerkt'),
        h('div', { class: 'chips' }, missing.slice(0, 30).map((c) => h('button', { class: 'chip', type: 'button', title: 'Toevoegen', onclick: () => add(c.name) }, '+ ' + c.name)))) : null);

    const c = p.characters.find((x) => x.id === selId);
    let detail;
    if (!c) detail = empty('Maak een personage aan, of voeg er een toe vanuit het scenario.');
    else {
      c.relations ??= [];
      const st = parsed.characters[c.name.toUpperCase()];
      const photo = h('div', { class: 'avatar', style: { width: '84px', height: '84px', fontSize: '1.6rem', cursor: 'pointer', overflow: 'hidden' }, title: 'Referentiefoto kiezen',
        onclick: async () => { const [f] = await pickFile('image/*'); if (!f) return; c.photo = await compressImage(f, 400); ctx.save(); ctx.rerender(); } },
      c.photo ? h('img', { src: c.photo, alt: '', style: { width: '100%', height: '100%', objectFit: 'cover' } }) : initials(c.name));
      detail = h('div', { class: 'stack' },
        h('div', { class: 'card' },
          h('div', { class: 'row top', style: { gap: '16px' } }, photo,
            h('div', { class: 'grid g3', style: { flex: 1 } },
              field('Naam (zoals in scenario)', bind(c, 'name', ctx, { onchange: () => ctx.refreshNav() })),
              field('Functie in verhaal', bind(c, 'role', ctx, { list: 'roles-dl', placeholder: 'Protagonist…' })),
              field('Leeftijd', bind(c, 'age', ctx)),
              field('Uiterlijk & eerste indruk', bind(c, 'description', ctx, { type: 'textarea', rows: 2 }), null, 'span-all'))),
          h('datalist', { id: 'roles-dl' }, ROLES.map((r) => h('option', { value: r })))),
        h('div', { class: 'grid g2' },
          section('Binnenwereld',
            h('div', { class: 'stack' },
              field('Extern doel (want) — wat ze najaagt', bind(c, 'want', ctx, { type: 'textarea', rows: 2 })),
              field('Intern doel (need) — wat ze echt nodig heeft', bind(c, 'need', ctx, { type: 'textarea', rows: 2 })),
              field('Psychologisch profiel', bind(c, 'psych', ctx, { type: 'textarea', rows: 3, placeholder: 'Temperament, angsten, waarden, overtuigingen, hoe ze reageert onder druk, verdedigingsmechanismen…' })),
              field('Wond / geest uit het verleden', bind(c, 'wound', ctx, { type: 'textarea', rows: 2 })),
              field('Fout / leugen die ze gelooft', bind(c, 'flaw', ctx, { type: 'textarea', rows: 2 })),
              field('Ontwikkeling (arc)', bind(c, 'arc', ctx, { type: 'textarea', rows: 2 })))),
          h('div', { class: 'stack' },
            section('In het scenario',
              st ? h('div', { class: 'stack tight' },
                h('div', { class: 'grid g3' },
                  h('div', {}, h('b', {}, st.scenes.size), h('div', { class: 'muted small' }, 'scènes')),
                  h('div', {}, h('b', {}, st.lines), h('div', { class: 'muted small' }, 'dialoogblokken')),
                  h('div', {}, h('b', {}, num(st.words)), h('div', { class: 'muted small' }, 'woorden dialoog'))),
                h('div', { class: 'chips', style: { marginTop: '6px' } }, [...st.scenes].map((i) => h('a', { class: 'chip', href: '#/scenario', onclick: () => { sessionStorage.setItem('fa.jump', String(parsed.scenes[i].line)); } }, parsed.scenes[i].num + '. ' + parsed.scenes[i].location.slice(0, 18)))))
                : h('p', { class: 'muted' }, `“${c.name}” spreekt nog niet in het scenario.`)),
            section('Stem & achtergrond',
              h('div', { class: 'stack' },
                field('Manier van praten', bind(c, 'voice', ctx, { type: 'textarea', rows: 2, placeholder: 'Woordkeus, ritme, stopwoorden, wat ze níet zegt…' })),
                field('Achtergrond', bind(c, 'backstory', ctx, { type: 'textarea', rows: 4 })))))),
        section('Relaties',
          h('div', { class: 'stack tight' },
            c.relations.map((r) => h('div', { class: 'row' },
              bind(r, 'with', ctx, { type: 'select', options: [['', '— personage —'], ...p.characters.filter((x) => x.id !== c.id).map((x) => [x.id, x.name])], style: 'max-width:200px' }),
              bind(r, 'text', ctx, { placeholder: 'Hoe verhouden ze zich? Wat staat er tussen hen?' }),
              iconBtn('trash', 'Verwijderen', () => { c.relations.splice(c.relations.indexOf(r), 1); ctx.save(); ctx.rerender(); }, 'danger'))),
            h('div', {}, btn('Relatie toevoegen', () => { c.relations.push({ with: '', text: '' }); ctx.save(); ctx.rerender(); }, { icon: 'plus', class: 'sm' })))),
        section('Personage-interview',
          h('p', { class: 'muted small' }, 'Beantwoord in de stem van het personage. Klik een vraag om hem aan je notities toe te voegen.'),
          h('div', { class: 'chips', style: { marginBottom: '10px' } }, QUESTIONS.map((q) => h('button', { class: 'chip', type: 'button', onclick: () => { c.notes = (c.notes ? c.notes + '\n\n' : '') + q + '\n— '; ctx.save(); ctx.rerender(); } }, q))),
          bind(c, 'notes', ctx, { type: 'textarea', rows: 8, placeholder: 'Notities, interview, beelden…' })),
        h('div', { class: 'row' },
          btn('Verdiep met AI', () => ctx.openAI(`Verdiep het personage ${c.name}: geef tegenstrijdigheden, een geheim, een sterkere wond en drie scènes die de arc zichtbaar maken.`), { icon: 'sparkles', class: 'ghost' }),
          h('div', { class: 'spacer' }),
          btn('Verwijder personage', async () => { if (await confirmDlg(`${c.name} verwijderen uit de personagebijbel? (Het scenario verandert niet.)`, 'Verwijderen', true)) { p.characters.splice(p.characters.indexOf(c), 1); ctx.save(); ctx.rerender(); } }, { class: 'danger sm', icon: 'trash' })));
    }
    root.append(h('div', { class: 'master' }, list, detail));
  },
};
