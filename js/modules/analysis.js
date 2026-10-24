import { h, section, btn, pageHead, empty, eighths, num, esc } from '../util.js';
import { wrap } from '../fountain.js';
import { sceneCast } from './breakdown.js';
import { TEMPLATES } from './structure.js';

// Veelvoorkomende woorden die niets zeggen over je verhaal (NL + EN).
const STOP = new Set(('de het een en van in op te dat die is zijn was niet met voor aan er maar om als ook bij nog naar uit tot dan of wat ze hij zij je jij ik we wij jullie hem haar hun ons mijn jouw heeft hebben had heb wordt worden werd kan kunnen zal zou moet moeten doen doet deed gaat gaan ging komt komen kwam geen al wel nu hier daar dit deze zo meer door over onder tegen na zonder want dus toen omdat welke wie waar hoe waarom alleen iets niets alles me mij u zich nee ja oké oke o.k. dan dat\'s \'t m\'n z\'n d\'r even weer heen af mee toe uw elkaar ze\'n wordt '
  + 'the a an of to and in on is it you i he she we they his her this that with for at be are was not but').split(/\s+/));
// Woorden die tekst vaak slapper maken; niet fout, wel het controleren waard.
const FILLER = ['eigenlijk', 'gewoon', 'even', 'echt', 'heel', 'best', 'nou', 'toch', 'misschien', 'beetje', 'zomaar', 'ineens', 'opeens', 'plotseling', 'langzaam', 'zeer', 'erg', 'vrij', 'bijna', 'begint', 'probeert', 'lijkt', 'kijkt', 'zucht', 'knikt', 'glimlacht'];

let tab = 'overzicht';

export function analyse(parsed) {
  const sc = parsed.scenes;
  const perScene = sc.map((s) => ({ s, dlgW: 0, actW: 0, blocks: [], actBlocks: [] }));
  let cur = null, who = null;
  for (const t of parsed.tokens) {
    if (t.type === 'scene_heading') { cur = perScene[t.scene]; continue; }
    if (!cur) continue;
    const w = (t.text?.match(/\S+/g) || []).length;
    if (t.type === 'character') who = t.name;
    else if (t.type === 'dialogue') { cur.dlgW += w; cur.blocks.push({ who, lines: wrap(t.text, 35).length, text: t.text }); }
    else if (t.type === 'action') { cur.actW += w; cur.actBlocks.push({ lines: wrap(t.text, 60).length, text: t.text }); }
  }
  // Woordfrequenties
  const freq = {};
  const fill = {};
  for (const t of parsed.tokens) {
    if (!['action', 'dialogue'].includes(t.type)) continue;
    for (const raw of t.text.toLowerCase().match(/[\p{L}'’-]+/gu) || []) {
      const wd = raw.replace(/^['’-]+|['’-]+$/g, '');
      if (FILLER.includes(wd)) fill[wd] = (fill[wd] || 0) + 1;
      if (wd.length < 3 || STOP.has(wd)) continue;
      freq[wd] = (freq[wd] || 0) + 1;
    }
  }
  const chars = Object.values(parsed.characters).sort((a, b) => b.words - a.words);
  const totalDlg = chars.reduce((a, c) => a + c.words, 0) || 1;
  return { perScene, freq, fill, chars, totalDlg };
}

export default {
  id: 'analyse', title: 'Scenario-analyse', icon: 'chart', group: 'Schrijven',
  render(root, ctx) {
    const p = ctx.project;
    const parsed = ctx.parsed();
    root.append(pageHead('Scenario-analyse', 'Inzicht in ritme, structuur, personages en woordgebruik — rechtstreeks uit je scenario.',
      btn('AI: script coverage', () => ctx.openAI('Geef professionele script coverage: logline, samenvatting in 5 zinnen, sterke punten, zwakke punten (structuur, personages, dialoog, toon), en een eindoordeel (pass/consider/recommend) met motivatie.'), { icon: 'sparkles', class: 'ghost' })));
    if (!parsed.scenes.length) { root.append(empty('Nog geen scènes om te analyseren.', btn('Naar scenario', () => ctx.go('scenario'), { icon: 'pen' }))); return; }
    const A = analyse(parsed);
    const sc = parsed.scenes;
    const total8 = sc.reduce((a, s) => a + s.eighths, 0) || 1;
    const longest = sc.reduce((a, s) => (s.eighths > a.eighths ? s : a), sc[0]);
    const ext = sc.filter((s) => s.ie === 'EXT').length, night = sc.filter((s) => s.dn === 'N').length;
    const dlgPct = Math.round((parsed.dialogueWords / ((parsed.dialogueWords + parsed.actionWords) || 1)) * 100);
    const jump = (s) => { sessionStorage.setItem('fa.jump', String(s.line)); ctx.go('scenario'); };
    const stat = (v, l, s) => h('div', { class: 'stat' }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l), s ? h('div', { class: 's' }, s) : null);

    root.append(h('div', { class: 'grid g4', style: { marginBottom: '18px' } },
      stat(parsed.pages, 'Pagina’s', `≈ ${parsed.pages} min · doel ${p.meta.runtime || '?'} min`),
      stat(sc.length, 'Scènes', `gemiddeld ${eighths(Math.round(total8 / sc.length))} pagina`),
      stat(`${dlgPct}%`, 'Dialoog', `${100 - dlgPct}% actie (in woorden)`),
      stat(Object.keys(parsed.characters).length, 'Sprekende rollen', `${A.chars[0]?.name || '—'} spreekt het meest`),
      stat(`${Math.round((ext / sc.length) * 100)}%`, 'Buiten (EXT)', `${sc.length - ext} binnen · ${ext} buiten`),
      stat(`${Math.round((night / sc.length) * 100)}%`, 'Nacht', `${night} nacht · ${sc.length - night} dag`),
      stat(eighths(longest.eighths), 'Langste scène', `${longest.num}. ${longest.location}`),
      stat(Object.keys(A.fill).reduce((a, k) => a + A.fill[k], 0), 'Vulwoorden', 'zie Woordgebruik')),
    tabsBar());

    function tabsBar() {
      return h('div', { class: 'tabs' }, [['overzicht', 'Ritme & structuur'], ['personages', 'Personages'], ['woorden', 'Woordgebruik'], ['signalen', `Signaleringen (${signals().length})`]].map(([k, l]) =>
        h('button', { class: 'tab' + (tab === k ? ' active' : ''), type: 'button', onclick: () => { tab = k; ctx.rerender(); } }, l)));
    }

    function signals() {
      const out = [];
      sc.forEach((s, i) => {
        const ps = A.perScene[i];
        if (s.eighths > 24) out.push(['Lange scène', `${eighths(s.eighths)} pagina’s — kan hij korter, of in tweeën?`, s]);
        if (!s.tod) out.push(['Geen tijdsaanduiding', 'Scènekop zonder DAG/NACHT; nodig voor planning en licht.', s]);
        ps.blocks.filter((b) => b.lines > 6).forEach((b) => out.push(['Lange dialoog', `${b.who}: ${b.lines} regels achter elkaar — monoloog bedoeld?`, s]));
        ps.actBlocks.filter((b) => b.lines > 5).forEach((b) => out.push(['Dik actieblok', `${b.lines} regels — breek op in kortere alinea’s (één beeld per alinea).`, s]));
      });
      Object.values(parsed.characters).filter((c) => c.scenes.size === 1 && c.lines <= 1).forEach((c) => out.push(['Eenmalige spreekrol', `${c.name} zegt één keer iets — samenvoegen met een andere rol scheelt casting.`, sc[[...c.scenes][0]]]));
      const rt = Number(p.meta.runtime) || 0;
      if (rt && Math.abs(parsed.pages - rt) / rt > 0.15 && parsed.pages > rt * 0.5) out.push(['Lengte', `${parsed.pages} pagina’s tegenover een doelduur van ${rt} minuten.`, null]);
      return out;
    }

    if (tab === 'overzicht') {
      const T = TEMPLATES[p.structure.template] || TEMPLATES.savethecat;
      const max = Math.max(...sc.map((s) => s.eighths));
      let acc = 0;
      root.append(
        section('Tijdlijn van het scenario',
          h('p', { class: 'muted small' }, `Elke strook is een scène, breedte = lengte. Kleur volgt het stripboard (INT/EXT × dag/nacht). De streepjes zijn de beats van “${T.name}” op hun doelpositie.`),
          h('div', { class: 'an-timeline' },
            sc.map((s) => h('button', { type: 'button', class: `an-seg ${(s.ie === 'EXT' ? 'E' : 'I') + (s.dn === 'N' ? 'N' : 'D')}`, style: { width: (s.eighths / total8) * 100 + '%' }, title: `${s.num}. ${s.heading} · ${eighths(s.eighths)} p`, onclick: () => jump(s) })),
            T.beats.map(([, name, pct], n) => h('span', { class: 'an-beat', style: { left: pct + '%' }, title: `${n + 1}. ${name}` }, h('i', {}, n + 1)))),
          h('div', { class: 'an-axis' }, (parsed.pages >= 8 ? [0, 25, 50, 75, 100] : [0, 100]).map((x) => h('span', { style: { left: x + '%' } }, `p. ${Math.round((x / 100) * parsed.pages)}`))),
          h('div', { class: 'an-legend' }, T.beats.map(([, name, pct], n) => h('span', {}, h('b', {}, n + 1), `${name} · p. ${Math.round((pct / 100) * parsed.pages)}`)))),
        h('div', { style: { height: '16px' } }),
        section('Scènelengte (ritme)',
          h('p', { class: 'muted small' }, 'Wissel van lange en korte scènes geeft ritme. Een reeks lange scènes achter elkaar voelt vaak traag.'),
          h('div', { class: 'an-bars' }, sc.map((s, i) => {
            const ps = A.perScene[i];
            const d = Math.round((ps.dlgW / ((ps.dlgW + ps.actW) || 1)) * 100);
            return h('button', { type: 'button', class: 'an-bar' + (s === longest ? ' max' : ''), style: { height: Math.max(6, (s.eighths / max) * 100) + '%' }, title: `${s.num}. ${s.heading}\n${eighths(s.eighths)} p · ${d}% dialoog`, onclick: () => jump(s) },
              h('i', { style: { height: d + '%' } }));
          })),
          h('div', { class: 'row muted small', style: { marginTop: '8px', gap: '14px' } }, h('span', {}, h('span', { class: 'an-key' }), ' lengte'), h('span', {}, h('span', { class: 'an-key dlg' }), ' aandeel dialoog'))));
    } else if (tab === 'personages') {
      const top = Object.values(parsed.characters).sort((a, b) => b.scenes.size - a.scenes.size).slice(0, 14);
      root.append(
        section('Wie is waar?',
          h('p', { class: 'muted small' }, 'Zwart = spreekt, grijs = aanwezig (genoemd in de actie of toegevoegd in de breakdown). Klik op een kolom om naar de scène te gaan.'),
          h('div', { class: 'table-wrap' }, h('div', { class: 'an-heat', style: { gridTemplateColumns: `140px repeat(${sc.length}, minmax(10px, 1fr))` } },
            h('div', {}), sc.map((s) => h('button', { type: 'button', class: 'an-col', title: s.heading, onclick: () => jump(s) }, s.num)),
            top.flatMap((c) => [h('div', { class: 'an-name' }, c.name),
              ...sc.map((s) => h('div', { class: 'an-cell' + (s.chars.includes(c.name) ? ' speak' : sceneCast(p, s).includes(c.name) ? ' here' : ''), title: `${c.name} · ${s.num}` }))])))),
        h('div', { style: { height: '16px' } }),
        section('Dialoogverdeling',
          h('div', { class: 'stack tight' }, A.chars.slice(0, 14).map((c) => h('div', { class: 'an-share' },
            h('b', {}, c.name), h('div', { class: 'progress' }, h('i', { style: { width: (c.words / A.chars[0].words) * 100 + '%' } })),
            h('span', { class: 'faint small nowrap' }, `${Math.round((c.words / A.totalDlg) * 100)}% · ${c.lines} blokken · ${c.scenes.size} sc.`))))));
    } else if (tab === 'woorden') {
      const top = Object.entries(A.freq).sort((a, b) => b[1] - a[1]).slice(0, 40);
      const fills = Object.entries(A.fill).sort((a, b) => b[1] - a[1]);
      root.append(h('div', { class: 'grid g2', style: { alignItems: 'start' } },
        section('Meest gebruikte woorden',
          h('p', { class: 'muted small' }, 'Zonder lidwoorden en voegwoorden. Herhaalde beelden of motieven zijn goed; onbedoelde herhaling niet.'),
          h('div', { class: 'chips' }, top.map(([w, n]) => h('span', { class: 'chip', style: { fontSize: `${Math.min(1.15, 0.78 + n / (top[0][1] * 2.2))}rem` } }, w, h('span', { class: 'faint' }, n))))),
        section('Vulwoorden & zwakke werkwoorden',
          h('p', { class: 'muted small' }, 'Woorden als “eigenlijk”, “begint te” of “kijkt” zijn niet fout, maar maken actie en dialoog vaak slapper. Zoek ze op met Zoeken & vervangen in het scenario.'),
          fills.length ? h('table', { class: 'tbl' }, h('tbody', {}, fills.map(([w, n]) => h('tr', {}, h('td', {}, h('b', {}, w)), h('td', { class: 'num' }, n)))))
            : h('p', { class: 'muted' }, 'Geen vulwoorden gevonden. Netjes.'))));
    } else {
      const list = signals();
      root.append(section('Signaleringen',
        list.length ? h('div', { class: 'stack tight' }, list.map(([kind, text, s]) => h('div', { class: 'an-sig' },
          h('span', { class: 'badge amber' }, kind), h('span', { style: { flex: 1 } }, text),
          s ? btn(`Sc. ${s.num}`, () => jump(s), { class: 'sm', icon: 'arrowUpRight' }) : null)))
          : h('p', { class: 'muted' }, 'Geen signaleringen. Je scenario oogt technisch gezond.')));
    }
  },
};
