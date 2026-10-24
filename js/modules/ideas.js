import { h, bind, field, section, btn, iconBtn, icon, pageHead, tabs, empty, uid, pick, toast, confirmDlg } from '../util.js';

const COLORS = { amber: 'var(--accent)', blue: 'var(--blue)', green: 'var(--green)', rose: 'var(--rose)', violet: 'var(--violet)', teal: 'var(--teal)', red: 'var(--red)' };

const G = {
  hero: ['een gepensioneerde brandweervrouw', 'een stotterende radiopresentator', 'een tienjarige schaakkampioen', 'een uitgebluste wedding planner', 'een Syrische kok in een Fries dorp', 'een dove drummer', 'een corrupte wethouder met een geweten', 'een verlegen lijkschouwer', 'een vrachtwagenchauffeur op zijn laatste rit', 'een influencer die haar volgers kwijtraakt', 'twee vervreemde tweelingzussen', 'een bejaarde ex-bankrover', 'een nachtverpleegkundige', 'een mislukte magiër', 'een boer die zijn land moet verkopen', 'een AI-onderzoeker die niet meer slaapt', 'een politieagent die net is geschorst', 'een eenzame vuurtorenwachter', 'een vluchteling die tolk wordt', 'een tiener die podcasts over moord maakt'],
  incident: ['een onbekende erfenis ontvangt', 'per ongeluk getuige wordt van een ontvoering', 'ontdekt dat haar vader nog leeft', 'een brief vindt die dertig jaar te laat is bezorgd', 'de loterij wint maar het niemand mag vertellen', 'wakker wordt in het verkeerde jaar', 'een verlaten baby vindt in de veerpont', 'gevraagd wordt een moord te bekennen die hij niet pleegde', 'het laatste exemplaar van een vergeten liedje vindt', 'door een storm vast komt te zitten op een eiland', 'zijn geheugen verliest na een ongeluk', 'een fout maakt live op televisie', 'een anonieme dreigbrief krijgt', 'erachter komt dat haar huis gesloopt wordt', 'een oude vriend tegenkomt die dood zou zijn'],
  goal: ['de familie weer bij elkaar te krijgen', 'de waarheid te bewijzen', 'het dorp te redden', 'een wedstrijd te winnen', 'op tijd thuis te zijn voor kerst', 'een geheim te bewaren', 'de dader te vinden', 'een tweede kans te krijgen', 'een belofte na te komen', 'eindelijk afscheid te nemen'],
  obstacle: ['een machtige vastgoedontwikkelaar', 'haar eigen angst', 'een vijandige gemeenschap', 'een klok die genadeloos doortikt', 'een rivaal met betere papieren', 'zijn eigen leugens', 'de wet', 'een naderende storm', 'een familielid met een verborgen agenda', 'een journalist die alles wil weten'],
  stakes: ['alles wat hij liefheeft verloren gaat', 'het dorp voorgoed verdwijnt', 'een onschuldige de gevangenis in gaat', 'haar kind wordt weggehaald', 'de laatste kans op verzoening verkeken is', 'de waarheid voorgoed begraven wordt', 'zij zichzelf kwijtraakt'],
  setting: ['een vervallen badplaats buiten het seizoen', 'een Limburgse mijnstreek', 'een ijsbaan om vier uur ’s nachts', 'een veerpont op de Waal', 'een asielzoekerscentrum in een oud klooster', 'een tv-studio tijdens een live uitzending', 'een stille Waddeneiland-winter', 'de haven van Rotterdam', 'een volkstuincomplex dat moet wijken', 'een nachttrein naar Wenen', 'een bloemenveiling', 'een kraakpand in de jaren tachtig'],
  twist: ['De mentor blijkt de veroorzaker van het probleem.', 'De verteller heeft al die tijd gelogen.', 'Het slachtoffer leeft nog — en wil niet gevonden worden.', 'De antagonist heeft gelijk.', 'Het doel blijkt waardeloos; het échte doel was iets anders.', 'Twee verhaallijnen blijken dezelfde dag vanuit verschillende kanten.', 'De hoofdpersoon is zelf de dader die ze zoekt.', 'Het is allemaal al eens gebeurd, dertig jaar eerder.', 'De bondgenoot verraadt — om de held te beschermen.', 'Wat een droom leek, is echt gebeurd.'],
  whatif: ['Wat als je je eigen begrafenis kon bijwonen?', 'Wat als een dorp besloot niet meer te liegen, één week lang?', 'Wat als je herinneringen kon verkopen?', 'Wat als de laatste mens met een vaste telefoon gebeld wordt door de toekomst?', 'Wat als een rouwende moeder de stem van haar zoon in een AI terugvindt?', 'Wat als een rechter moet oordelen over zijn eigen kind?', 'Wat als een stad elke nacht een uur verliest?', 'Wat als je beste vriend een spion bleek, en je dat altijd al wist?', 'Wat als je één dag de verkeerde taal sprak, en niemand je verstond?', 'Wat als het weer weigerde te veranderen?'],
  first: ['Anna', 'Bram', 'Cor', 'Daan', 'Elif', 'Fenna', 'Gijs', 'Hanna', 'Ilse', 'Joost', 'Karim', 'Lotte', 'Mees', 'Noor', 'Otto', 'Pien', 'Rutger', 'Saar', 'Teun', 'Vera', 'Wout', 'Yara', 'Zeynep', 'Henk', 'Truus', 'Marja', 'Sem', 'Jasmijn', 'Ruben', 'Mila', 'Kees', 'Annelies', 'Youssef', 'Femke', 'Dirk', 'Ingrid', 'Thijs', 'Lieke', 'Mohammed', 'Sophie', 'Willem', 'Esther', 'Koen', 'Nadia', 'Floor', 'Gerrit', 'Roos', 'Jelle', 'Amira', 'Stijn'],
  last: ['de Vries', 'Jansen', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Boer', 'Mulder', 'de Groot', 'Bos', 'Vos', 'Peters', 'Hendriks', 'van Dijk', 'Dekker', 'Brouwer', 'de Wit', 'Dijkstra', 'Kok', 'van der Meer', 'Postma', 'Hoekstra', 'Yilmaz', 'El Amrani', 'Kramer', 'van Leeuwen', 'Verbeek', 'Schouten', 'Willems', 'Huisman', 'Koster', 'Prins', 'Biesheuvel', 'Zwart', 'Wolters', 'Kuipers', 'Veenstra', 'Timmermans', 'Groen', 'Sanders'],
  trait: ['verzamelt kapotte klokken', 'praat tegen planten', 'kan niet tegen stilte', 'liegt alleen over kleine dingen', 'heeft altijd een appel bij zich', 'onthoudt elk kenteken', 'zingt als ze nerveus is', 'draagt altijd de jas van haar vader', 'telt traptreden', 'heeft een hekel aan water', 'schrijft brieven die hij nooit verstuurt', 'is bang in het donker maar werkt ’s nachts'],
};

const GENS = [
  ['premise', 'Premisse', () => `${cap(pick(G.hero))} die ${pick(G.incident)}, moet ${pick(G.goal)} — tegen ${pick(G.obstacle)} in, voordat ${pick(G.stakes)}.`],
  ['whatif', '“Wat als…”', () => pick(G.whatif)],
  ['setting', 'Setting', () => `Speelt zich af in ${pick(G.setting)}.`],
  ['twist', 'Plotwending', () => pick(G.twist)],
  ['char', 'Personage', () => `${pick(G.first)} ${pick(G.last)} — ${pick(G.hero).replace(/^een |^twee /, '')}, ${pick(G.trait)}.`],
  ['names', 'Namen (8)', () => Array.from({ length: 8 }, () => `${pick(G.first)} ${pick(G.last)}`).join(' · ')],
  ['mashup', 'Genremix', () => `${pick(['Een western', 'Een heistfilm', 'Een romcom', 'Een rechtbankdrama', 'Een horrorfilm', 'Een roadmovie', 'Een sportfilm', 'Een musical'])} als ${pick(['familiedrama', 'coming-of-age', 'satire', 'documentaire', 'kerstfilm', 'thriller', 'sprookje', 'kamerspel'])}, in ${pick(G.setting)}.`],
];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

let tab = 'bord';
let filter = '';
let lastGen = { kind: 'premise', text: '' };

export default {
  id: 'ideeen', title: 'Ideeënlab', icon: 'bulb', group: 'Ontwikkeling',
  badge: (ctx) => ctx.project.ideas.length || null,
  render(root, ctx) {
    const p = ctx.project;
    root.append(pageHead('Ideeënlab', 'Verzamel invallen, laat de generatoren je prikkelen en smeed je premisse tot een logline.',
      btn('AI-brainstorm', () => ctx.openAI('Brainstorm met me: geef 10 verrassende ideeën (beelden, scènes, wendingen) die passen bij mijn film.'), { icon: 'sparkles' })),
    tabs([['bord', 'Ideeënbord'], ['gen', 'Generatoren'], ['premisse', 'Premisse & thema'], ['logline', 'Loglinebouwer']], tab, (t) => { tab = t; ctx.rerender(); }));

    if (tab === 'bord') board(root, ctx, p);
    else if (tab === 'gen') generators(root, ctx, p);
    else if (tab === 'premisse') premise(root, ctx, p);
    else loglineBuilder(root, ctx, p);
  },
};

function board(root, ctx, p) {
  const tags = [...new Set(p.ideas.map((i) => i.tag).filter(Boolean))];
  const quick = h('input', { placeholder: 'Nieuw idee… (Enter)' });
  quick.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && quick.value.trim()) {
      p.ideas.unshift({ id: uid(), text: quick.value.trim(), tag: filter || '', color: 'amber' });
      ctx.save(); ctx.rerender();
      setTimeout(() => document.querySelector('.mod-ideeen input')?.focus(), 0);
    }
  });
  root.append(h('div', { class: 'row wrap', style: { marginBottom: '14px' } },
    h('div', { style: { flex: '1 1 300px' } }, quick),
    h('div', { class: 'chips' },
      h('button', { class: 'chip' + (!filter ? ' on' : ''), type: 'button', onclick: () => { filter = ''; ctx.rerender(); } }, 'Alles'),
      tags.map((t) => h('button', { class: 'chip' + (filter === t ? ' on' : ''), type: 'button', onclick: () => { filter = t; ctx.rerender(); } }, t)))));

  const list = p.ideas.filter((i) => !filter || i.tag === filter).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  if (!list.length) { root.append(empty('Nog geen ideeën. Typ hierboven, of gebruik de generatoren.')); return; }
  root.append(h('div', { class: 'idea-grid' }, list.map((it) => {
    const card = h('div', { class: 'idea', style: { '--c': COLORS[it.color] || 'var(--line2)' } });
    card.style.setProperty('--c', COLORS[it.color] || 'var(--line2)');
    const ta = bind(it, 'text', ctx, { type: 'textarea', rows: 4 });
    ta.style.height = Math.min(400, 40 + (it.text.length / 28) * 22) + 'px';
    card.append(ta,
      h('div', { class: 'row' },
        bind(it, 'tag', ctx, { placeholder: 'label', style: 'width:110px;padding:3px 6px;font-size:.8rem', list: 'idea-tags' }),
        h('div', { class: 'color-dots' }, Object.entries(COLORS).map(([k, c]) => h('button', {
          class: 'color-dot' + (it.color === k ? ' on' : ''), type: 'button', title: k, style: { background: c },
          onclick: () => { it.color = k; ctx.save(); card.style.setProperty('--c', c); card.querySelectorAll('.color-dot').forEach((d) => d.classList.toggle('on', d.title === k)); },
        })))),
      h('div', { class: 'row' },
        iconBtn('pin', it.pinned ? 'Losmaken' : 'Vastpinnen', () => { it.pinned = !it.pinned; ctx.save(); ctx.rerender(); }, it.pinned ? 'on' : ''),
        iconBtn('sparkles', 'Uitwerken met AI', () => ctx.openAI(`Werk dit idee uit tot iets bruikbaars voor mijn film, met 3 concrete varianten:\n\n${it.text}`)),
        h('div', { class: 'spacer' }),
        iconBtn('trash', 'Verwijderen', async () => { if (it.text.trim().length < 20 || await confirmDlg('Dit idee verwijderen?', 'Verwijderen', true)) { p.ideas.splice(p.ideas.indexOf(it), 1); ctx.save(); ctx.rerender(); } }, 'danger')));
    if (it.pinned) card.querySelector('.icon-btn').style.color = 'var(--accent)';
    return card;
  })), h('datalist', { id: 'idea-tags' }, tags.map((t) => h('option', { value: t }))));
}

function generators(root, ctx, p) {
  const out = h('div', { class: 'generator-out' }, lastGen.text || 'Kies een generator hieronder.');
  const run = (kind) => {
    const g = GENS.find((x) => x[0] === kind);
    lastGen = { kind, text: g[2]() };
    out.textContent = lastGen.text;
  };
  root.append(h('div', { class: 'stack' },
    section('Willekeurige vonk',
      h('div', { class: 'chips', style: { marginBottom: '12px' } }, GENS.map(([k, l]) => h('button', { class: 'chip' + (lastGen.kind === k ? ' on' : ''), type: 'button', onclick: (e) => { e.currentTarget.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.remove('on')); e.currentTarget.classList.add('on'); run(k); } }, icon('dice', 14), l))),
      out,
      h('div', { class: 'row wrap', style: { marginTop: '12px' } },
        btn('Opnieuw', () => run(lastGen.kind), { icon: 'dice', class: 'primary' }),
        btn('Bewaar als idee', () => { if (!lastGen.text) return; p.ideas.unshift({ id: uid(), text: lastGen.text, tag: GENS.find((x) => x[0] === lastGen.kind)[1], color: 'blue' }); ctx.save(); toast('Bewaard in het ideeënbord'); }, { icon: 'bulb' }),
        btn('Gebruik als logline', () => { if (!lastGen.text) return; p.meta.logline = lastGen.text; ctx.save(); toast('Logline bijgewerkt'); }, { class: 'ghost' }),
        btn('Uitwerken met AI', () => lastGen.text && ctx.openAI(`Neem deze vonk en maak er drie sterke, verschillende filmpremissen van (met hoofdpersoon, conflict en einde):\n\n${lastGen.text}`), { icon: 'sparkles', class: 'ghost' }))),
    section('Vragen om je idee te testen',
      h('ul', { class: 'muted', style: { margin: 0, paddingLeft: '18px', lineHeight: 1.8 } },
        ['Waarom moet dit verhaal nú verteld worden — en waarom door jou?', 'Wat is het meest filmische beeld van je film (de poster)?', 'Wat wil je hoofdpersoon, en wat heeft ze eigenlijk nodig?', 'Wat is het ergste dat je hoofdpersoon kan overkomen? Laat het gebeuren.', 'Hoe is je hoofdpersoon aan het eind veranderd?', 'Welke vraag stelt het publiek zich de hele film?', 'Wat is het thema in één woord? Waar is je antagonist het tegendeel van?', 'Kan je het verhaal vertellen in drie zinnen: begin, midden, eind?'].map((q) => h('li', {}, q))))));
  if (!lastGen.text) run(lastGen.kind);
}

function premise(root, ctx, p) {
  const m = p.meta;
  const T = m.themeParts ??= { value: '', outcome: '', counter: '' };
  const stmt = h('div', { class: 'generator-out' });
  const upd = () => {
    stmt.textContent = T.value && T.outcome ? `${cap(T.value)} leidt tot ${T.outcome}${T.counter ? `; zonder ${T.value.toLowerCase()} volgt ${T.counter}` : ''}.` : 'Vul de waarde en de uitkomst in…';
  };
  const f = (obj, k, label, ph, rows = 2, onchange) => field(label, bind(obj, k, ctx, { type: rows > 1 ? 'textarea' : 'text', rows, placeholder: ph, onchange }));
  root.append(h('div', { class: 'grid g2', style: { alignItems: 'start' } },
    section('Premisse',
      h('div', { class: 'stack' },
        f(p.treatment, 'premise', 'Premisse in een paar zinnen', 'Wie, in welke situatie, wil wat — en waarom is dat nu moeilijk?', 4),
        f(m, 'conflict', 'Kernconflict', 'De botsing die de film draagt: persoon tegen persoon, maatschappij, natuur of zichzelf.', 3),
        f(m, 'stakes', 'Wat staat er op het spel?', 'Wat verliest de hoofdpersoon als het mislukt — uiterlijk én innerlijk?'),
        f(m, 'whyNow', 'Waarom dit verhaal, nu, door jou?', 'Persoonlijke band, actualiteit, wat de film toevoegt.'))),
    h('div', { class: 'stack' },
      section('Thema',
        h('div', { class: 'stack' },
          f(m, 'theme', 'Thema in een paar woorden', 'bijv. vooruitgang versus verbondenheid', 1),
          f(m, 'themeQuestion', 'Thematische vraag (die de film stelt)', 'bijv. Wat zijn we bereid op te geven voor vooruitgang?', 1),
          h('div', { class: 'grid g3' },
            field('Waarde', bind(T, 'value', ctx, { placeholder: 'verbondenheid', onchange: upd })),
            field('… leidt tot', bind(T, 'outcome', ctx, { placeholder: 'een zinvol leven', onchange: upd })),
            field('zonder volgt (optioneel)', bind(T, 'counter', ctx, { placeholder: 'eenzaamheid', onchange: upd }))),
          stmt,
          h('div', { class: 'row wrap' },
            btn('Gebruik als thematische stelling', () => { m.themeStatement = stmt.textContent; ctx.save(); ctx.rerender(); }, { class: 'sm' })),
          f(m, 'themeStatement', 'Thematische stelling (wat de film beweert)', 'De film beantwoordt de thematische vraag; de antagonist belichaamt vaak het tegendeel.'))),
      section('Publiek & toon',
        h('div', { class: 'stack' },
          f(m, 'audience', 'Doelgroep', 'Leeftijd, smaak, waar ze kijken (festival, bioscoop, streaming)', 1),
          f(m, 'tone', 'Toon', 'bijv. warm-melancholiek met droge humor', 1),
          f(m, 'comps', 'Vergelijkbare titels', 'Film A × Film B', 1),
          btn('AI: test mijn premisse', () => ctx.openAI('Beoordeel mijn premisse, kernconflict en thematische stelling kritisch: is het conflict sterk genoeg voor een speelfilm, spiegelt de antagonist het thema, en wat ontbreekt er? Geef concrete verbeteringen.'), { icon: 'sparkles', class: 'ghost' }))))));
  upd();
}

function loglineBuilder(root, ctx, p) {
  const L = p.meta.loglineParts ??= { when: '', who: '', goal: '', against: '', stakes: '' };
  const preview = h('div', { class: 'generator-out' });
  const upd = () => {
    const s = `${L.when ? `Wanneer ${L.when}, ` : ''}${L.who ? `moet ${L.who} ` : ''}${L.goal ? L.goal : ''}${L.against ? ` — ondanks ${L.against}` : ''}${L.stakes ? ` — voordat ${L.stakes}` : ''}.`;
    preview.textContent = s.length > 2 ? s.replace(/\s+/g, ' ') : 'Vul de velden in…';
    return s;
  };
  const f = (k, label, ph) => field(label, bind(L, k, ctx, { placeholder: ph, onchange: upd }));
  root.append(h('div', { class: 'grid g2' },
    section('Bouwstenen',
      h('div', { class: 'stack' },
        f('when', 'Aanleiding (wanneer…)', 'de veerdienst van het dorp wordt opgeheven'),
        f('who', 'Hoofdpersoon (met eigenschap)', 'een koppige oude schipper'),
        f('goal', 'Doel (wat moet hij/zij doen?)', 'de laatste vaarweek vastleggen met zijn kleindochter'),
        f('against', 'Tegenkracht', 'een ambitieuze wethouder en zijn eigen trots'),
        f('stakes', 'Inzet (voordat…)', 'het verhaal van het dorp voorgoed verdwijnt'))),
    section('Resultaat',
      preview,
      h('div', { class: 'row wrap', style: { marginTop: '12px' } },
        btn('Gebruik als logline', () => { p.meta.logline = upd().replace(/\s+/g, ' '); ctx.save(); toast('Logline opgeslagen in Overzicht'); }, { class: 'primary' }),
        btn('Laat AI varianten maken', () => ctx.openAI(`Maak 5 sterkere varianten van deze logline. Houd ze onder 40 woorden en benoem per variant wat er beter is:\n\n${upd()}`), { icon: 'sparkles', class: 'ghost' })),
      h('h4', { style: { margin: '18px 0 6px' } }, 'Huidige logline'),
      h('p', { class: 'muted' }, p.meta.logline || '—'),
      h('h4', { style: { margin: '14px 0 6px' } }, 'Checklist'),
      h('ul', { class: 'muted', style: { margin: 0, paddingLeft: '18px', lineHeight: 1.8 } },
        h('li', {}, 'Is de hoofdpersoon specifiek (niet “een man”, maar “een koppige oude schipper”)?'),
        h('li', {}, 'Is er een duidelijke aanleiding die de wereld op z’n kop zet?'),
        h('li', {}, 'Is het doel concreet en zichtbaar te maken op film?'),
        h('li', {}, 'Is er een tegenkracht die echt pijn doet?'),
        h('li', {}, 'Is duidelijk wat er verloren gaat als het mislukt?'),
        h('li', {}, 'Verraadt de logline het genre en de toon?')))));
  upd();
}
