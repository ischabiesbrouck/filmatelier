import { h, bind, field, section, btn, pageHead, tabs, esc, printDoc, fmtDate, todayISO } from '../util.js';

let tab = 'fasen';
let q = '';
let doc = 'location';

/* ---------- Handleiding per fase ---------- */
const PHASES = [
  ['Ontwikkeling', 'Van idee tot schietklaar scenario', [
    'Formuleer premisse, logline en thema; test of het conflict een speelfilm kan dragen.',
    'Werk personages uit: extern en intern doel, wond, ontwikkeling.',
    'Bouw de structuur (beat sheet) en een scènelijst op kaarten vóór je gaat schrijven.',
    'Schrijf synopsis en treatment; laat ze lezen voordat je het scenario schrijft.',
    'Schrijf de eerste versie zonder te schaven; herschrijf daarna in rondes (structuur → scènes → dialoog).',
    'Organiseer een leesrepetitie en verzamel feedback; bewaar elke versie.',
    'Regel rechten (optie op boek of levensverhaal, afspraken met co-schrijvers) en de chain of title.',
    'Stel een financieringsplan op en vraag ontwikkel- of productiesteun aan.',
  ], 'Een gelockt scenario, financieringsplan, globale begroting en planning.'],
  ['Pre-productie', 'Alles klaarzetten voor de draaiperiode', [
    'Zet scènenummers vast (locked script) en maak de breakdown per scène.',
    'Maak het draaischema: groepeer per locatie, dag/nacht en beschikbaarheid van cast.',
    'Stel de definitieve begroting op en vergelijk die met het draaischema.',
    'Casting, crew en contracten (deal memo’s), verzekeringen.',
    'Locaties scouten, technische scout met camera/licht/geluid, vergunningen aanvragen.',
    'Shotlist en storyboard per scène; camera- en lichttests; kostuum- en grimepassen.',
    'Leesrepetitie met de cast; repetities van lastige scènes en stunts.',
    'Productieboek: contactlijst, draaischema, dag-uit-dagen, veiligheidsplan.',
  ], 'Iedereen weet wat, waar en wanneer — callsheet van dag 1 is klaar.'],
  ['Productie', 'De draaiperiode', [
    'Verstuur de callsheet de avond van tevoren; houd een dagrapport bij.',
    'Script supervisor registreert takes, continuïteit en afwijkingen van het script.',
    'Data: back-up volgens 3-2-1 (drie kopieën, twee media, één op een andere plek) vóór kaarten worden gewist.',
    'Bekijk dailies; draai ontbrekende shots (pick-ups) bij zolang de set er nog staat.',
    'Neem geluid van elke ruimte op (room tone) en wild lines waar nodig.',
    'Houd het tempo bij in het draaischema; schuif scènes tijdig door.',
  ], 'Al het materiaal veilig, gelogd en klaar voor de montage.'],
  ['Postproductie', 'Van ruw materiaal tot master', [
    'Assembly → rough cut → fine cut → picture lock. Laat na elke versie kijken en noteer feedback.',
    'Na picture lock: geluidsmontage, ADR, foley, muziek, mix (stereo en 5.1) en een M&E-versie.',
    'Kleurcorrectie, VFX en titels; controleer rechten van alle muziek en beelden.',
    'Maak deliverables: DCP, ProRes-master, ondertitels, trailer, stills en de cuesheet.',
  ], 'Een master plus alle deliverables die distributeur en festivals vragen.'],
  ['Distributie', 'De film naar zijn publiek', [
    'Festivalstrategie: welke première (wereld, internationaal, nationaal) waar?',
    'Perskit: synopsis, regievisie, stills, poster, trailer, credits, biografieën.',
    'Sales agent en/of distributeur; afspraken over territoria, vensters en minimumgarantie.',
    'Release: bioscoop, VOD/streaming, tv; publiciteit en vertoningen met Q&A.',
  ], 'De film is gezien — en je weet wat je volgende project wordt.'],
];

/* ---------- Opmaakregels ---------- */
const FORMAT = [
  ['Basis', ['Courier 12 pt; één pagina ≈ één minuut film.', 'Marges ongeveer 3,8 cm links, 2,5 cm rechts, boven en onder.', 'Tegenwoordige tijd; schrijf alleen wat je ziet en hoort.', 'Een speelfilm is meestal 85–120 pagina’s.']],
  ['Scènekop', ['INT. of EXT. + locatie + tijd: INT. KEUKEN - NACHT.', 'Elke nieuwe plek of tijd = nieuwe scène.', 'Gebruik vaste namen per locatie, dan kloppen breakdown en draaischema.', 'Vervolgscène op hetzelfde moment: “- CONTINU” of “- LATER”.']],
  ['Actie', ['Korte alinea’s van 1–4 regels; één beeld per alinea.', 'Introduceer een personage de eerste keer in HOOFDLETTERS met leeftijd: SANNE (24).', 'Geluiden en belangrijke rekwisieten mogen in hoofdletters.', 'Vermijd camera-aanwijzingen; suggereer het beeld met je zinnen.']],
  ['Dialoog', ['Naam in hoofdletters, dialoog eronder.', 'Parentheticals “(zacht)” spaarzaam: alleen als de betekenis anders onduidelijk is.', '(V.O.) = voice-over, (O.S.) = buiten beeld maar in de ruimte, (CONT’D) = gaat door na actie.', 'Subtekst: personages zeggen zelden precies wat ze bedoelen.']],
  ['Bijzondere vormen', ['Overgangen (KNIPPEN NAAR:) alleen als ze iets betekenen.', 'Montage: “MONTAGE - SANNE FILMT HET DORP” met korte regels eronder.', 'Intercut: “INTERCUT - TELEFOONGESPREK” na beide locaties eenmaal te tonen.', 'Tekst in beeld: TITEL: “Drie jaar later”.']],
  ['In Fountain', ['Gebruik = voor een synopsisregel per scène: die verschijnt op de kaarten.', 'Gebruik # voor akten of sequenties: handig in navigatie.', '[[notities]] worden niet afgedrukt.', 'Na “Scènenummers vastzetten” krijgen nieuwe scènes een eigen nummer (bijv. 12A).']],
];

/* ---------- Woordenlijst ---------- */
const GLOSSARY = [
  ['180°-regel', 'De camera blijft aan één kant van de denkbeeldige lijn tussen twee personages, zodat blikrichtingen kloppen.'],
  ['A-camera / B-camera', 'Hoofdcamera en tweede camera die tegelijk draaien.'],
  ['ADR', 'Automated Dialogue Replacement: dialoog die achteraf in de studio opnieuw wordt ingesproken.'],
  ['Akte', 'Grote structurele eenheid van een verhaal (meestal drie).'],
  ['Assembly', 'Eerste montage waarin alle scènes in scriptvolgorde staan.'],
  ['Beat', 'Kleinste eenheid van verandering in een scène of in de structuur.'],
  ['Blocking', 'Het vastleggen van posities en bewegingen van acteurs en camera.'],
  ['Boom', 'Hengel met microfoon boven het beeld.'],
  ['Breakdown', 'Uitsplitsing per scène van alles wat nodig is: cast, rekwisieten, kostuum, voertuigen, effecten.'],
  ['Callsheet', 'Oproepblad met tijden, locaties, scènes en cast voor één draaidag.'],
  ['Chain of title', 'Sluitende keten van documenten die aantoont dat de productie alle rechten op het verhaal bezit.'],
  ['Continuïteit', 'Consistentie van details (kleding, rekwisieten, posities) tussen shots en takes.'],
  ['Coverage (dekking)', 'Alle shots die een scène vanuit verschillende hoeken vastleggen; ook: een leesrapport over een scenario.'],
  ['Cutaway / insert', 'Kort shot van een detail om naar toe te snijden.'],
  ['Dagrapport', 'Verslag van een draaidag: gedraaide scènes, takes, tijden, bijzonderheden.'],
  ['Dailies / rushes', 'Het ongemonteerde materiaal van een draaidag.'],
  ['Dag-uit-dagen', 'Overzicht per acteur van de dagen waarop hij of zij werkt (W), begint (S), eindigt (F) of beschikbaar moet blijven (H).'],
  ['DCP', 'Digital Cinema Package: het bestandsformaat voor vertoning in bioscopen.'],
  ['Deal memo', 'Korte overeenkomst met de kernafspraken voor een crewlid of acteur.'],
  ['DIT', 'Digital Imaging Technician: verantwoordelijk voor data, back-ups en beeldbeheer op de set.'],
  ['Draaischema / stripboard', 'Planning van scènes over draaidagen, traditioneel met gekleurde stroken.'],
  ['E&O-verzekering', 'Errors & Omissions: dekt claims over rechten, smaad en privacy; vaak geëist door distributeurs.'],
  ['Establishing shot', 'Wijd shot dat laat zien waar een scène zich afspeelt.'],
  ['Figurant', 'Niet-sprekende persoon op de achtergrond.'],
  ['Final cut', 'Het recht om de definitieve montage te bepalen.'],
  ['Foley', 'Geluidseffecten (voetstappen, kleding) die in de studio worden nagemaakt.'],
  ['Gaffer', 'Hoofd van de lichtafdeling.'],
  ['Gouden uur', 'Periode rond zonsopkomst en -ondergang met warm, zacht licht.'],
  ['Grip', 'Afdeling voor camerabewegingen en statieven (dolly, kraan) en het vormen van licht met frames en vlaggen.'],
  ['Inciting incident', 'De gebeurtenis die het verhaal in gang zet.'],
  ['Intercut', 'Afwisselend tonen van twee locaties, bijvoorbeeld bij een telefoongesprek.'],
  ['Logline', 'Het verhaal in één zin: hoofdpersoon, doel, tegenkracht, inzet.'],
  ['M&E', 'Music & Effects: geluidsband zonder dialoog, nodig voor nasynchronisatie in andere talen.'],
  ['Master shot', 'Shot dat een hele scène in één keer vastlegt.'],
  ['Martini shot', 'Het laatste shot van de draaidag.'],
  ['MOS', 'Opname zonder geluid.'],
  ['Opnameverhouding', 'Verhouding tussen gedraaid materiaal en de lengte van de film (bijv. 15:1).'],
  ['Parenthetical', 'Korte aanwijzing tussen haakjes onder een personagenaam.'],
  ['Picture lock', 'Het moment waarop de beeldmontage definitief vastligt.'],
  ['Pick-ups', 'Extra shots die later worden bijgedraaid.'],
  ['Plotpunt', 'Wending die het verhaal een nieuwe richting geeft, vaak aan het eind van een akte.'],
  ['POV', 'Point of view: shot vanuit de ogen van een personage.'],
  ['Room tone', 'Opname van de stilte in een ruimte, nodig voor de geluidsmontage.'],
  ['Sales agent', 'Partij die de film aan distributeurs in verschillende landen verkoopt.'],
  ['Scènekop (slugline)', 'Regel die een scène opent: INT./EXT., locatie en tijd.'],
  ['Script supervisor', 'Bewaakt continuïteit en noteert wat er per take gedraaid is.'],
  ['Shotlist', 'Lijst van alle geplande shots per scène.'],
  ['Sides', 'Uittreksels van het script met alleen de scènes van een draaidag of auditie.'],
  ['Subtekst', 'Wat personages bedoelen maar niet zeggen.'],
  ['Synopsis', 'Samenvatting van het hele verhaal, inclusief het einde.'],
  ['Table read / leesrepetitie', 'Het hardop lezen van het scenario met cast of stemmen.'],
  ['Tegenshot', 'Shot vanuit de tegenovergestelde richting, bijvoorbeeld bij een gesprek.'],
  ['Treatment', 'Uitgebreide prozaversie van het verhaal, scène voor scène.'],
  ['Turnaround', 'Rusttijd tussen twee draaidagen; ook: het terugvallen van rechten na een optie.'],
  ['V.O. / O.S.', 'Voice-over (vertelstem) / off screen (wel aanwezig, niet in beeld).'],
  ['Video village', 'Plek op de set waar regie en klant meekijken op monitoren.'],
  ['Wild track', 'Losse geluidsopname zonder beeld (bijv. een extra dialoogregel of sfeer).'],
  ['Wrap', 'Einde van een draaidag of van de hele productie.'],
];

/* ---------- Financiering & regels ---------- */
const MONEY = [
  ['Nederland', ['Nederlands Filmfonds: steun voor scenario-ontwikkeling, productie en distributie, plus de Filmproductie-incentive (een cash rebate op in Nederland bestede kosten).', 'CoBO-fonds: steun voor coproducties met de publieke omroep.', 'Regionale fondsen en filmcommissies van provincies en grote steden.', 'Omroepen en streamingdiensten als coproducent of afnemer.']],
  ['België', ['Vlaams Audiovisueel Fonds (VAF) voor Vlaamse producties; Screen Flanders als economisch fonds.', 'Tax shelter: federale fiscale regeling voor investeringen in audiovisuele producties.', 'Franstalig: Centre du Cinéma et de l’Audiovisuel en Wallimage.']],
  ['Europa', ['Creative Europe MEDIA: ontwikkeling, distributie en festivals.', 'Eurimages (Raad van Europa): internationale coproducties.', 'Coproductieverdragen maken bijdragen van meerdere landen mogelijk.']],
  ['Overige bronnen', ['Private investeerders, sponsoring en productplaatsing (houd het geloofwaardig).', 'Crowdfunding: werkt het best met een bestaand publiek en een concrete tegenprestatie.', 'In-kind: apparatuur, locaties of diensten in ruil voor credits of een aandeel.', 'Voorverkoop via sales agent of distributeur (minimumgarantie).']],
];
const RULES = [
  ['Rechten', ['Optie of rechten op bronmateriaal schriftelijk vastleggen (chain of title).', 'Muziek: synchronisatie- én masterrechten nodig; auteursrechtorganisaties: Buma/Stemra (NL), Sabam (BE).', 'Herkenbare personen, merken en kunstwerken in beeld: toestemming vragen of vermijden.', 'Toestemmingsverklaringen van cast en figuranten (zie Sjablonen).']],
  ['Vergunningen', ['Draaien op openbare grond: vergunning van de gemeente; vraag ruim op tijd aan.', 'Verkeersregelaars of politie bij afzettingen.', 'Drones: Europese droneregels (registratie, categorie, bewijs van vakbekwaamheid); controleer de actuele eisen.', 'Wapens, vuur en pyrotechniek alleen met gespecialiseerde, bevoegde partijen.']],
  ['Werk & veiligheid', ['Arbeidstijden en rusttijden respecteren; plan geen extreem lange dagen achter elkaar.', 'Kinderen op de set: in Nederland is een ontheffing van de Arbeidsinspectie nodig; in België gelden eigen regels.', 'Veiligheidsplan per draaidag: EHBO, dichtstbijzijnde SEH, nooduitgangen, weer.', 'Aansprakelijkheids- en productieverzekering, ook voor gehuurde apparatuur.']],
];

/* ---------- Sjablonen ---------- */
const COMMON = [['company', 'Productie (bedrijf of naam)'], ['rep', 'Vertegenwoordigd door'], ['place', 'Plaats van ondertekening']];
const DOCS = {
  location: {
    title: 'Locatieovereenkomst',
    fields: [['owner', 'Eigenaar / beheerder'], ['address', 'Adres van de locatie'], ['dates', 'Draaidata'], ['times', 'Tijden (incl. op- en afbouw)'], ['fee', 'Vergoeding (€, excl. btw)'], ['extra', 'Bijzondere afspraken', 'textarea']],
    body: (v, p) => `
      <p><b>Partijen:</b> ${v.company || '[productie]'}, vertegenwoordigd door ${v.rep || '[naam]'} (hierna: de Productie), en ${v.owner || '[eigenaar]'} (hierna: de Eigenaar).</p>
      <p><b>1. Locatie en periode.</b> De Eigenaar geeft de Productie toegang tot ${v.address || '[adres]'} op ${v.dates || '[data]'}, ${v.times || '[tijden]'}, voor opnamen van de film “${esc(p.meta.title)}”.</p>
      <p><b>2. Vergoeding.</b> De Productie betaalt een vergoeding van € ${v.fee || '[bedrag]'} (excl. btw), binnen 30 dagen na de laatste draaidag.</p>
      <p><b>3. Gebruik van beelden.</b> De Eigenaar staat toe dat de locatie herkenbaar of onherkenbaar in beeld komt en dat de opnamen zonder beperking in tijd en gebied in alle media worden gebruikt, inclusief promotie. De naam van de locatie wordt alleen genoemd na overleg.</p>
      <p><b>4. Zorg en schade.</b> De Productie behandelt de locatie zorgvuldig, is verzekerd voor aansprakelijkheid en laat de locatie achter in de staat waarin zij die aantrof. Schade wordt binnen 24 uur gemeld en hersteld of vergoed.</p>
      <p><b>5. Bijzondere afspraken.</b> ${(v.extra || 'Geen.')}</p>`,
  },
  release: {
    title: 'Toestemmingsverklaring beeld en geluid',
    fields: [['name', 'Naam'], ['role', 'Rol / functie (bijv. figurant)'], ['date', 'Datum opname', 'date'], ['fee', 'Vergoeding (of “geen”)'], ['guardian', 'Wettelijk vertegenwoordiger (bij minderjarigen)']],
    body: (v, p) => `
      <p>Ondergetekende, <b>${(v.name || '[naam]')}</b>, verleent ${(v.company || '[productie]')} toestemming om beeld- en geluidsopnamen die op ${v.date ? fmtDate(v.date, { day: 'numeric', month: 'long', year: 'numeric' }) : '[datum]'} van hem/haar zijn gemaakt als ${(v.role || '[rol]')} voor de film “${esc(p.meta.title)}” te gebruiken, te bewerken en openbaar te maken.</p>
      <p>Deze toestemming geldt voor alle media en vormen van exploitatie, waaronder bioscoop, televisie, internet, festivals en promotie, zonder beperking in tijd of gebied.</p>
      <p>Vergoeding: ${(v.fee || 'geen')}. Ondergetekende verklaart hiermee geen verdere aanspraken te hebben, voor zover wettelijk toegestaan.</p>
      ${v.guardian ? `<p>Namens de minderjarige getekend door wettelijk vertegenwoordiger: ${(v.guardian)}.</p>` : ''}`,
  },
  dealmemo: {
    title: 'Deal memo crew',
    fields: [['name', 'Naam'], ['role', 'Functie'], ['period', 'Periode (voorbereiding + draai)'], ['days', 'Aantal werkdagen'], ['rate', 'Dagtarief (€, excl. btw)'], ['hours', 'Werkdag (uren) en overwerkregeling'], ['credit', 'Creditvermelding'], ['extra', 'Overige afspraken', 'textarea']],
    body: (v, p) => `
      <p><b>Productie:</b> ${(v.company || '[productie]')} · <b>Film:</b> “${esc(p.meta.title)}”</p>
      <p><b>Crewlid:</b> ${(v.name || '[naam]')} · <b>Functie:</b> ${(v.role || '[functie]')}</p>
      <p><b>Periode:</b> ${(v.period || '[periode]')} · <b>Werkdagen:</b> ${(v.days || '[aantal]')}</p>
      <p><b>Tarief:</b> € ${(v.rate || '[tarief]')} per dag (excl. btw) · <b>Werkdag en overwerk:</b> ${(v.hours || '[regeling]')}</p>
      <p><b>Credit:</b> ${(v.credit || '[vermelding]')}</p>
      <p><b>Rechten:</b> Alle resultaten van de werkzaamheden voor deze film komen toe aan de Productie, voor zover wettelijk mogelijk.</p>
      <p><b>Overig:</b> ${(v.extra || 'Geen.')}</p>`,
  },
};

export default {
  id: 'gids', title: 'Gids & sjablonen', icon: 'book', group: 'Gereedschap',
  render(root, ctx) {
    const p = ctx.project;
    root.append(pageHead('Gids & sjablonen', 'Praktische kennis voor elke fase, de opmaakregels van een scenario, een woordenlijst, financiering en invulbare overeenkomsten.'),
      tabs([['fasen', 'Per fase'], ['opmaak', 'Scenario-opmaak'], ['woorden', 'Woordenlijst'], ['geld', 'Financiering & regels'], ['sjablonen', 'Sjablonen']], tab, (t) => { tab = t; ctx.rerender(); }));

    if (tab === 'fasen') {
      root.append(h('div', { class: 'guide-grid' }, PHASES.map(([ph, sub, steps, done], i) => h('section', { class: 'card guide-card' },
        h('h3', {}, h('span', { class: 'num-badge' }, String(i + 1).padStart(2, '0')), ph),
        h('p', { class: 'muted' }, sub),
        h('ul', {}, steps.map((s) => h('li', {}, s))),
        h('p', { class: 'note', style: { marginTop: '12px', marginBottom: 0 } }, 'Klaar als: ', done)))));
    } else if (tab === 'opmaak') {
      root.append(h('div', { class: 'guide-grid' }, FORMAT.map(([t, items]) => h('section', { class: 'card guide-card' }, h('h3', {}, t), h('ul', {}, items.map((s) => h('li', {}, s)))))));
    } else if (tab === 'woorden') {
      const s = h('input', { type: 'search', placeholder: 'Zoek een term…', value: q, style: { maxWidth: '360px', marginBottom: '16px' } });
      const list = h('div', { class: 'gloss' });
      const draw = () => {
        const n = q.toLowerCase();
        const items = GLOSSARY.filter(([a, b]) => !n || (a + ' ' + b).toLowerCase().includes(n));
        list.replaceChildren(...(items.length ? items.map(([a, b]) => h('div', {}, h('b', {}, a), h('small', {}, b))) : [h('p', { class: 'muted' }, 'Geen term gevonden.')]));
      };
      s.addEventListener('input', () => { q = s.value; draw(); });
      root.append(section(null, s, list));
      draw();
    } else if (tab === 'geld') {
      root.append(h('p', { class: 'note', style: { marginBottom: '16px' } }, 'Regelingen, percentages en voorwaarden veranderen regelmatig. Gebruik dit als startpunt en controleer altijd de actuele informatie bij het fonds of de instantie zelf.'),
        h('h2', { style: { margin: '6px 0 12px' } }, 'Financiering'),
        h('div', { class: 'guide-grid' }, MONEY.map(([t, items]) => h('section', { class: 'card guide-card' }, h('h3', {}, t), h('ul', {}, items.map((s) => h('li', {}, s)))))),
        h('h2', { style: { margin: '24px 0 12px' } }, 'Rechten, vergunningen & veiligheid'),
        h('div', { class: 'guide-grid' }, RULES.map(([t, items]) => h('section', { class: 'card guide-card' }, h('h3', {}, t), h('ul', {}, items.map((s) => h('li', {}, s)))))));
    } else {
      p.docs ??= {};
      const D = DOCS[doc];
      const v = p.docs[doc] ??= {};
      p.docs.common ??= {};
      Object.assign(v, Object.fromEntries(COMMON.map(([k]) => [k, v[k] ?? p.docs.common[k] ?? (k === 'company' ? p.meta.author : '')])));
      const preview = h('div', { class: 'doc-preview' });
      // Alle ingevulde waarden worden HTML-veilig gemaakt voordat ze in het document komen.
      const safe = new Proxy(v, { get: (t, k) => (typeof t[k] === 'string' ? esc(t[k]) : t[k]) });
      const html = () => `<h2>${D.title}</h2>${D.body(safe, p)}
        <table style="width:100%;margin-top:28px;border-collapse:collapse"><tr>
        <td style="width:50%;vertical-align:top;padding-right:16px">Voor de productie<br><br><br>____________________<br>${safe.rep || ''}</td>
        <td style="vertical-align:top">Voor akkoord<br><br><br>____________________<br>${safe.owner || safe.name || ''}</td></tr></table>
        <p style="margin-top:18px;font-size:.85em">${safe.place || '[plaats]'}, ${fmtDate(todayISO(), { day: 'numeric', month: 'long', year: 'numeric' })}</p>`;
      const upd = () => { preview.innerHTML = html(); COMMON.forEach(([k]) => { p.docs.common[k] = v[k]; }); };
      root.append(h('p', { class: 'note', style: { marginBottom: '16px' } }, 'Voorbeeldteksten om mee te beginnen — geen juridisch advies. Laat belangrijke overeenkomsten (zeker over rechten en geld) nakijken door een jurist.'),
        h('div', { class: 'chips', style: { marginBottom: '16px' } }, Object.entries(DOCS).map(([k, d]) => h('button', { type: 'button', class: 'chip' + (k === doc ? ' on' : ''), onclick: () => { doc = k; ctx.rerender(); } }, d.title))),
        h('div', { class: 'grid g2', style: { alignItems: 'start' } },
          section('Gegevens', h('div', { class: 'stack' },
            [...COMMON, ...D.fields].map(([k, l, type]) => field(l, bind(v, k, ctx, { type: type || 'text', rows: 3, onchange: upd }))),
            btn('Afdrukken / PDF', () => printDoc(D.title, html(), 'body{font-family:Georgia,serif;font-size:11pt;line-height:1.6;max-width:170mm}h2{font-family:system-ui}'), { icon: 'print', class: 'primary' }))),
          preview));
      upd();
    }
  },
};
