import { h, bind, field, section, btn, pageHead } from '../util.js';

export const TEMPLATES = {
  savethecat: {
    name: 'Save the Cat (15 beats)', acts: [[0, 'Akte 1'], [20, 'Akte 2A'], [50, 'Akte 2B'], [77, 'Akte 3']],
    beats: [
      ['opening', 'Openingsbeeld', 0, 'Een momentopname van de wereld en de hoofdpersoon vóór de verandering.'],
      ['theme', 'Thema benoemd', 5, 'Iemand (meestal niet de held) zegt waar de film over gaat.'],
      ['setup', 'Opzet', 1, 'De wereld, wat er ontbreekt in het leven van de held, de bijpersonages.'],
      ['catalyst', 'Katalysator', 10, 'Het moment dat alles verandert: telefoontje, ontslag, ontmoeting.'],
      ['debate', 'Twijfel', 15, 'De held aarzelt. Moet ik dit doen? Wat staat er op het spel?'],
      ['break2', 'Naar akte 2', 20, 'De held kiest bewust en stapt de nieuwe wereld in.'],
      ['bstory', 'B-verhaal', 22, 'Een (liefdes)relatie die het thema draagt en de held helpt veranderen.'],
      ['fun', 'Fun & games', 30, 'De belofte van de premisse: de scènes uit de trailer.'],
      ['midpoint', 'Midpunt', 50, 'Valse overwinning of valse nederlaag; de inzet wordt hoger.'],
      ['badguys', 'De vijand sluit in', 55, 'Druk van buiten en van binnen neemt toe; het team valt uiteen.'],
      ['alllost', 'Alles verloren', 68, 'Het dieptepunt; vaak een (symbolische) dood.'],
      ['darknight', 'Donkere nacht van de ziel', 70, 'De held rouwt en ziet eindelijk de waarheid.'],
      ['break3', 'Naar akte 3', 77, 'De oplossing: A- en B-verhaal komen samen.'],
      ['finale', 'Finale', 80, 'De held past de les toe, verslaat de tegenkracht, de wereld verandert.'],
      ['final', 'Slotbeeld', 100, 'Het tegenbeeld van het openingsbeeld: bewijs van verandering.'],
    ],
  },
  threeact: {
    name: 'Klassieke drie-akten', acts: [[0, 'Akte 1 — opzet'], [25, 'Akte 2 — confrontatie'], [75, 'Akte 3 — ontknoping']],
    beats: [
      ['hook', 'Haak / opening', 0, 'Grijp het publiek; zet toon en genre neer.'],
      ['inciting', 'Aanleiding (inciting incident)', 10, 'De gebeurtenis die het verhaal in beweging zet.'],
      ['pp1', 'Plotpunt 1', 25, 'De held committeert zich; er is geen weg terug.'],
      ['pinch1', 'Eerste pinch', 37, 'We voelen de kracht van de tegenstander.'],
      ['mid', 'Midpunt', 50, 'Omslag: van reageren naar handelen. Nieuwe informatie.'],
      ['pinch2', 'Tweede pinch', 62, 'De tegenstander slaat harder terug.'],
      ['pp2', 'Plotpunt 2', 75, 'Crisis/dieptepunt, gevolgd door het laatste stukje van de puzzel.'],
      ['climax', 'Climax', 88, 'De beslissende confrontatie.'],
      ['resolution', 'Resolutie', 97, 'De nieuwe normaal.'],
    ],
  },
  hero: {
    name: 'Heldenreis (Vogler, 12 stadia)', acts: [[0, 'Vertrek'], [25, 'Inwijding'], [75, 'Terugkeer']],
    beats: [
      ['ordinary', 'Gewone wereld', 0, 'De held in zijn vertrouwde omgeving, met een gemis.'],
      ['call', 'Roep tot avontuur', 8, 'Een uitdaging of probleem dient zich aan.'],
      ['refusal', 'Weigering', 12, 'Angst of twijfel houdt de held tegen.'],
      ['mentor', 'Ontmoeting met de mentor', 17, 'Advies, training of een magisch hulpmiddel.'],
      ['threshold', 'Over de drempel', 25, 'De held betreedt de bijzondere wereld.'],
      ['tests', 'Beproevingen, bondgenoten, vijanden', 30, 'Leren van de regels van de nieuwe wereld.'],
      ['approach', 'Nadering van de grot', 45, 'Voorbereiding op de grootste uitdaging.'],
      ['ordeal', 'De beproeving', 55, 'Confrontatie met de grootste angst; symbolische dood.'],
      ['reward', 'Beloning', 65, 'De held grijpt het zwaard / de schat / het inzicht.'],
      ['road', 'De weg terug', 75, 'De gevolgen; achtervolging.'],
      ['resurrection', 'Wederopstanding', 88, 'Laatste, hoogste test; de held is getransformeerd.'],
      ['elixir', 'Terugkeer met het elixer', 97, 'De held brengt iets mee dat de gewone wereld verandert.'],
    ],
  },
  circle: {
    name: 'Story Circle (Dan Harmon)', acts: [[0, 'Orde'], [50, 'Chaos'], [75, 'Terug']],
    beats: [
      ['you', '1. Jij', 0, 'Een personage in zijn comfortzone.'],
      ['need', '2. Behoefte', 12, 'Maar hij wil iets.'],
      ['go', '3. Gaan', 25, 'Hij betreedt een onbekende situatie.'],
      ['search', '4. Zoeken', 37, 'Hij past zich aan.'],
      ['find', '5. Vinden', 50, 'Hij krijgt wat hij wilde.'],
      ['take', '6. Prijs', 62, 'Hij betaalt er een zware prijs voor.'],
      ['return', '7. Terugkeer', 75, 'Hij keert terug naar het vertrouwde.'],
      ['change', '8. Verandering', 90, 'Hij is veranderd.'],
    ],
  },
  sequence: {
    name: 'Sequentiemethode (8 sequenties)', acts: [[0, 'Akte 1'], [25, 'Akte 2'], [75, 'Akte 3']],
    beats: [
      ['s1', 'Seq. A — Status quo & aanleiding', 0, 'Introductie, eindigt met de aanleiding.'],
      ['s2', 'Seq. B — Predicament', 12.5, 'De held probeert het probleem te ontwijken; eindigt met de knoop.'],
      ['s3', 'Seq. C — Eerste poging', 25, 'De eerste, makkelijkste oplossing.'],
      ['s4', 'Seq. D — Escalatie naar midpunt', 37.5, 'Eerste poging faalt; eindigt met midpunt.'],
      ['s5', 'Seq. E — Nieuwe aanpak', 50, 'Nieuwe kennis, nieuwe tactiek; subplots.'],
      ['s6', 'Seq. F — Hoogste punt / dieptepunt', 62.5, 'Eindigt met het einde van akte 2.'],
      ['s7', 'Seq. G — Laatste poging', 75, 'Alles op alles; climax.'],
      ['s8', 'Seq. H — Afronding', 87.5, 'Resolutie, epiloog.'],
    ],
  },
  sevenpoint: {
    name: '7-puntsstructuur (Dan Wells)', acts: [[0, 'Opzet'], [50, 'Omslag'], [75, 'Ontknoping']],
    beats: [
      ['hook', 'Haak', 0, 'Begin bij het tegendeel van het einde: waar staat de held nu?'],
      ['turn1', 'Plotwending 1', 15, 'Iets nieuws (persoon, idee, conflict) zet het verhaal in beweging.'],
      ['pinch1', 'Knelpunt 1', 35, 'Druk van de tegenkracht dwingt de held tot actie.'],
      ['midpoint', 'Midpunt', 50, 'De held stopt met reageren en gaat zelf handelen.'],
      ['pinch2', 'Knelpunt 2', 65, 'Het plan faalt; de held staat er (bijna) alleen voor.'],
      ['turn2', 'Plotwending 2', 80, 'De held krijgt het laatste stuk dat nodig is om te winnen.'],
      ['resolution', 'Resolutie', 95, 'De held handelt naar wat hij heeft geleerd; het tegendeel van de haak.'],
    ],
  },
  freytag: {
    name: 'Piramide van Freytag (5 akten)', acts: [[0, 'Expositie'], [20, 'Opbouw'], [45, 'Climax'], [60, 'Afbouw'], [85, 'Ontknoping']],
    beats: [
      ['expo', 'Expositie', 0, 'Wereld, personages en uitgangssituatie.'],
      ['incite', 'Opwindend moment', 12, 'De gebeurtenis die het conflict ontketent.'],
      ['rising', 'Stijgende handeling', 25, 'Complicaties stapelen zich op; de spanning loopt op.'],
      ['climax', 'Climax / keerpunt', 50, 'Het hoogtepunt: het lot van de held keert.'],
      ['falling', 'Dalende handeling', 65, 'De gevolgen van de keer werken door; laatste spanning.'],
      ['denouement', 'Ontknoping', 90, 'Het conflict wordt opgelost; een nieuwe orde.'],
    ],
  },
  kishotenketsu: {
    name: 'Kishōtenketsu (4 delen, zonder conflict)', acts: [[0, 'Ki'], [25, 'Shō'], [50, 'Ten'], [75, 'Ketsu']],
    beats: [
      ['ki', 'Ki — introductie', 0, 'Personages en wereld.'],
      ['sho', 'Shō — ontwikkeling', 25, 'Verdieping, zonder grote wending.'],
      ['ten', 'Ten — wending', 50, 'Een onverwacht, ogenschijnlijk los element.'],
      ['ketsu', 'Ketsu — verzoening', 75, 'De delen vallen samen tot een nieuw geheel.'],
    ],
  },
};

export default {
  id: 'structuur', title: 'Structuur', icon: 'structure', group: 'Ontwikkeling',
  render(root, ctx) {
    const p = ctx.project, S = p.structure;
    S.links ??= {};
    const T = TEMPLATES[S.template] || TEMPLATES.savethecat;
    const rt = Number(p.meta.runtime) || 100;
    const parsed = ctx.parsed();
    const sceneOpts = [['', '— koppel aan scène —'], ...parsed.scenes.map((s) => [s.key, `${s.num}. ${s.heading.slice(0, 40)} (p. ${s.page})`])];
    const filled = T.beats.filter(([id]) => S.beats[id]?.trim()).length;

    root.append(pageHead('Structuur', `Beat sheet op basis van je doelduur (${rt} min ≈ ${rt} pagina’s). Koppel beats aan scènes om te zien of je op schema zit.`,
      btn('AI-analyse', () => ctx.openAI('Analyseer mijn structuur: welke beats zijn zwak of ontbreken, en waar zakt de spanning in? Geef concrete verbetervoorstellen.'), { icon: 'sparkles' })));

    const sel = h('select', { style: { maxWidth: '340px' } }, Object.entries(TEMPLATES).map(([k, t]) => h('option', { value: k }, t.name)));
    sel.value = S.template;
    sel.addEventListener('change', () => { S.template = sel.value; ctx.save(); ctx.rerender(); });

    const tl = h('div', { class: 'timeline' },
      T.acts.map(([pct, label], i) => h('div', { class: 'act', style: { left: pct + '%', width: ((T.acts[i + 1]?.[0] ?? 100) - pct) + '%' } }, label)),
      T.beats.map(([id, name, pct]) => h('div', { class: 'tick' + (S.beats[id]?.trim() ? ' done' : ''), style: { left: `max(6px, min(calc(100% - 6px), ${pct}%))` }, 'data-label': `${name} · p. ${Math.round((pct / 100) * rt)}` })));

    root.append(section(null,
      h('div', { class: 'row wrap' }, field('Model', sel), h('div', { class: 'spacer' }), h('span', { class: 'badge amber' }, `${filled}/${T.beats.length} beats ingevuld`)),
      tl,
      T.beats.map(([id, name, pct, desc]) => {
        const target = Math.max(1, Math.round((pct / 100) * rt));
        const linked = S.links[id] ? parsed.scenes.find((s) => s.key === S.links[id]) : null;
        const diff = linked ? linked.page - target : 0;
        const link = bind(S.links, id, ctx, { type: 'select', options: sceneOpts, onchange: () => ctx.rerender() });
        link.style.cssText = 'font-size:.8rem;padding:3px 6px';
        return h('div', { class: 'beat' },
          h('div', {}, h('h4', {}, name), h('div', { class: 'pg' }, `doel: p. ${target}`), h('small', { class: 'muted' }, desc)),
          h('div', { class: 'stack tight' },
            bind(S.beats, id, ctx, { type: 'textarea', rows: 2, placeholder: 'Wat gebeurt er hier in jouw film?', onchange: () => {
              tl.querySelectorAll('.tick')[T.beats.findIndex((b) => b[0] === id)]?.classList.toggle('done', !!S.beats[id]?.trim());
            } }),
            h('div', { class: 'row wrap' }, link,
              linked ? h('span', { class: 'badge ' + (Math.abs(diff) <= Math.max(3, rt * 0.04) ? 'green' : 'red') }, `staat op p. ${linked.page} (${diff > 0 ? '+' : ''}${diff})`) : null)));
      })),
    section('Vrije structuurnotities', bind(S, 'notes', ctx, { type: 'textarea', rows: 6, placeholder: 'Subplots, motieven, opzet & pay-off, wat het publiek weet versus wat de held weet…' })));
    root.lastChild.style.marginTop = '16px';
  },
};
