// Opslag: projecten in IndexedDB (werkt offline, ruimte voor afbeeldingen), instellingen in localStorage.
// Stores: projects (werkversie), backups (automatische momentopnamen), meta (o.a. de gekozen back-upmap).

import { uid, todayISO } from './util.js';

const DB_NAME = 'filmatelier';
export const SCHEMA_VERSION = 2;
const BACKUP_KEEP = 15;
const BACKUP_INTERVAL = 60 * 60 * 1000; // hooguit één automatische back-up per uur per project

let dbp;
const db = () => dbp ??= new Promise((res, rej) => {
  const r = indexedDB.open(DB_NAME, 2);
  r.onupgradeneeded = (e) => {
    const d = r.result;
    if (e.oldVersion < 1) d.createObjectStore('projects', { keyPath: 'id' });
    if (e.oldVersion < 2) {
      d.createObjectStore('backups', { keyPath: 'id' }).createIndex('project', 'projectId');
      d.createObjectStore('meta', { keyPath: 'key' });
    }
  };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.onblocked = () => rej(new Error('De database wordt geblokkeerd door een ander venster met een oudere versie. Sluit andere Filmatelier-vensters en herlaad.'));
});

async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}

export const listProjects = async () =>
  ((await tx('projects', 'readonly', (s) => s.getAll())) || [])
    .map((p) => ({ id: p.id, title: p.meta?.title || 'Naamloos', updated: p.updated, logline: p.meta?.logline || '' }))
    .sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));

export const loadProject = async (id) => { const p = await tx('projects', 'readonly', (s) => s.get(id)); return p ? migrate(normalize(p)) : null; };
export const saveProject = (p) => { p.updated = new Date().toISOString(); return tx('projects', 'readwrite', (s) => s.put(p)); };
export const deleteProject = async (id) => {
  await tx('projects', 'readwrite', (s) => s.delete(id));
  for (const b of await listBackups(id)) await tx('backups', 'readwrite', (s) => s.delete(b.id));
};
export const allProjects = async () => ((await tx('projects', 'readonly', (s) => s.getAll())) || []).map((p) => migrate(normalize(p)));

/* ---------- Automatische back-ups ---------- */
const lastBackup = {};
export async function listBackups(projectId) {
  const d = await db();
  return new Promise((res, rej) => {
    const r = d.transaction('backups').objectStore('backups').index('project').getAll(projectId);
    r.onsuccess = () => res((r.result || []).sort((a, b) => b.date.localeCompare(a.date)));
    r.onerror = () => rej(r.error);
  });
}
/** Maakt (hooguit eens per uur, of geforceerd) een momentopname van het hele project en ruimt oude op. */
export async function backupProject(p, { force = false, label = 'Automatisch' } = {}) {
  const now = Date.now();
  if (!force && lastBackup[p.id] && now - lastBackup[p.id] < BACKUP_INTERVAL) return false;
  const list = await listBackups(p.id);
  if (!force && list[0] && now - Date.parse(list[0].date) < BACKUP_INTERVAL) { lastBackup[p.id] = Date.parse(list[0].date); return false; }
  lastBackup[p.id] = now;
  const data = JSON.stringify(p);
  await tx('backups', 'readwrite', (s) => s.put({ id: `${p.id}:${now}`, projectId: p.id, date: new Date(now).toISOString(), label, title: p.meta.title, size: data.length, data }));
  const auto = list.filter((b) => b.label === 'Automatisch');
  for (const b of auto.slice(BACKUP_KEEP - 1)) await tx('backups', 'readwrite', (s) => s.delete(b.id));
  return true;
}
export const getBackup = (id) => tx('backups', 'readonly', (s) => s.get(id));
export const deleteBackup = (id) => tx('backups', 'readwrite', (s) => s.delete(id));

/* ---------- Meta (sleutel/waarde, ook voor bestandsmap-handles) ---------- */
export const getMeta = async (key) => (await tx('meta', 'readonly', (s) => s.get(key)))?.value;
export const setMeta = (key, value) => tx('meta', 'readwrite', (s) => s.put({ key, value }));

/* ---------- Schemaversies ---------- */
/** Brengt oudere projecten naar het huidige formaat. Elke stap is idempotent. */
export function migrate(p) {
  if ((p.version || 1) < 2) {
    // v2: gear, castExclude/storyDay in breakdown, relaties als lijst
    p.gear ??= { items: [] };
    for (const d of Object.values(p.breakdown || {})) { d.items ??= {}; d.castExclude ??= []; }
    for (const c of p.characters || []) c.relations ??= [];
    p.version = 2;
  }
  return p;
}

/* ---------- Instellingen (per apparaat) ---------- */
const SKEY = 'filmatelier.settings';
export const settings = (() => {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SKEY) || '{}'); } catch { /* privémodus */ }
  return new Proxy(s, {
    set(t, k, v) { t[k] = v; try { localStorage.setItem(SKEY, JSON.stringify(t)); } catch { /* negeren */ } return true; },
  });
})();

/* ---------- Projectstructuur ---------- */
export function blankProject(title = 'Nieuwe film') {
  return {
    id: uid(), version: SCHEMA_VERSION, created: new Date().toISOString(), updated: new Date().toISOString(),
    meta: { title, logline: '', genre: '', format: 'Speelfilm', runtime: 100, tagline: '', theme: '', audience: '', comps: '', author: '', contact: '', budgetLevel: '', status: 'Ontwikkeling', aspect: '2.39:1', fps: 24 },
    ideas: [],
    structure: { template: 'savethecat', beats: {}, notes: '' },
    characters: [],
    world: [],
    treatment: { premise: '', synopsis: '', onepager: '', treatment: '', pitch: '', statement: '' },
    script: { text: '', snapshots: [], goal: 1000, log: {}, sceneColors: {} },
    breakdown: {},
    shots: {},
    schedule: { days: [], startDate: '' },
    people: [],
    locations: [],
    gear: { items: [] },
    budget: { currency: 'EUR', contingency: 10, insurance: 2, overhead: 5, items: [] },
    tasks: [],
    mood: [],
    takes: [],
    callsheets: {},
    post: { vfx: [], cues: [], adr: [], deliverables: [], reels: [] },
    festivals: [],
    ai: { history: [] },
    tableRead: { voices: {}, pitch: {}, rate: 1, narrate: true, headings: true },
    writer: { docs: [] },
  };
}

export function normalize(p) {
  const base = blankProject();
  for (const [k, v] of Object.entries(base)) {
    if (p[k] == null) p[k] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v)) if (p[k][k2] == null) p[k][k2] = v2;
    }
  }
  return p;
}

/* ---------- Standaardsjablonen ---------- */
export const BUDGET_TEMPLATE = [
  ['Boven de lijn', '1100', 'Verhaal & rechten (optie, boek)', 1, 'forfait', 0],
  ['Boven de lijn', '1200', 'Scenarist(en)', 1, 'forfait', 0],
  ['Boven de lijn', '1300', 'Producent(en)', 1, 'forfait', 0],
  ['Boven de lijn', '1400', 'Regisseur', 1, 'forfait', 0],
  ['Boven de lijn', '1500', 'Hoofdcast', 1, 'forfait', 0],
  ['Productie', '2000', 'Productieteam (productieleider, opnameleiders)', 1, 'week', 0],
  ['Productie', '2100', 'Bijrollen & figuratie', 1, 'dag', 0],
  ['Productie', '2200', 'Camera-afdeling + huur', 1, 'week', 0],
  ['Productie', '2300', 'Licht & grip', 1, 'week', 0],
  ['Productie', '2400', 'Geluid op de set', 1, 'week', 0],
  ['Productie', '2500', 'Art department / decor', 1, 'forfait', 0],
  ['Productie', '2600', 'Kostuum', 1, 'forfait', 0],
  ['Productie', '2700', 'Grime & haar', 1, 'forfait', 0],
  ['Productie', '2800', 'Locaties & vergunningen', 1, 'dag', 0],
  ['Productie', '2900', 'Vervoer & logistiek', 1, 'dag', 0],
  ['Productie', '3000', 'Catering', 1, 'dag', 0],
  ['Productie', '3100', 'Opslag & data (DIT, schijven)', 1, 'forfait', 0],
  ['Postproductie', '4000', 'Montage (editor + suite)', 1, 'week', 0],
  ['Postproductie', '4100', 'Geluidsontwerp & mix', 1, 'forfait', 0],
  ['Postproductie', '4200', 'Muziek (componist / licenties)', 1, 'forfait', 0],
  ['Postproductie', '4300', 'Kleurcorrectie', 1, 'forfait', 0],
  ['Postproductie', '4400', 'VFX & titels', 1, 'forfait', 0],
  ['Postproductie', '4500', 'Deliverables (DCP, ondertitels)', 1, 'forfait', 0],
  ['Overig', '5000', 'Verzekeringen & juridisch', 1, 'forfait', 0],
  ['Overig', '5100', 'Marketing, festivals & publiciteit', 1, 'forfait', 0],
  ['Overig', '5200', 'Kantoor & administratie', 1, 'forfait', 0],
];

export const TASK_TEMPLATE = [
  ['Ontwikkeling', 'Logline en premisse vastleggen'], ['Ontwikkeling', 'Beat sheet afronden'], ['Ontwikkeling', 'Personagebijbel schrijven'],
  ['Ontwikkeling', 'Treatment schrijven'], ['Ontwikkeling', 'Eerste versie scenario'], ['Ontwikkeling', 'Leesronde / feedback verzamelen'],
  ['Ontwikkeling', 'Herschrijving'], ['Ontwikkeling', 'Rechten & ketenafspraken regelen'], ['Ontwikkeling', 'Financieringsplan + fondsaanvragen'],
  ['Pre-productie', 'Scènenummers vastzetten (locked script)'], ['Pre-productie', 'Scène-breakdown maken'], ['Pre-productie', 'Budget opstellen'],
  ['Pre-productie', 'Casting'], ['Pre-productie', 'Crew samenstellen + contracten'], ['Pre-productie', 'Locaties scouten + vergunningen'],
  ['Pre-productie', 'Shotlist & storyboard'], ['Pre-productie', 'Draaischema maken'], ['Pre-productie', 'Leesrepetitie (table read)'],
  ['Pre-productie', 'Productieverzekering'], ['Pre-productie', 'Camera- en lichttest'],
  ['Productie', 'Dagelijkse callsheets versturen'], ['Productie', 'Dagrapporten bijhouden'], ['Productie', 'Data back-up (3-2-1)'], ['Productie', 'Dailies bekijken'],
  ['Postproductie', 'Assembly / ruwe montage'], ['Postproductie', 'Director’s cut'], ['Postproductie', 'Picture lock'], ['Postproductie', 'Geluidsmontage & ADR'],
  ['Postproductie', 'Muziek'], ['Postproductie', 'Kleurcorrectie'], ['Postproductie', 'Mix'], ['Postproductie', 'DCP & deliverables'],
  ['Distributie', 'Festivalstrategie'], ['Distributie', 'Perskit & trailer'], ['Distributie', 'Sales agent / distributeur'], ['Distributie', 'Première'],
];

export const DELIVERABLES = ['DCP (2K/4K)', 'ProRes 4444 master', 'Stereomix + 5.1 mix', 'M&E-track', 'Ondertitels NL (SRT)', 'Ondertitels EN (SRT)', 'Audiodescriptie', 'Trailer', 'Posters / key art', 'Stills (persfoto’s)', 'Muziek-cuesheet', 'Credits-lijst', 'E&O-verzekering', 'Ketenovereenkomsten / chain of title'];

/* ---------- Voorbeeldproject ---------- */
const DEMO_SCRIPT = `Title: De Laatste Veerboot
Credit: Geschreven door
Author: Jouw Naam
Draft date: ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
Contact: jouw@email.nl

FADE IN:

EXT. VEERSTOEP - DAGERAAD

= Henk bereidt zijn laatste vaarweek voor.

Mist hangt boven de rivier. Een oude VEERPONT ligt aangemeerd, roest op de reling. Een bord: "VEERDIENST STOPT 1 NOVEMBER".

HENK (68), schipper, verweerd gezicht, schroeft met zorg een koperen BEL vast aan de stuurhut.

INT. STUURHUT VEERPONT - DAG

Henk start de MOTOR. Hij hoest, de motor hoest mee.

HENK
(tegen de motor)
Nog één week, ouwe. Dan mogen we allebei met pensioen.

Zijn telefoon trilt. Op het scherm: "SANNE".

HENK (CONT'D)
Niet nu, meisje.

EXT. NIEUWE BRUG - DAG

= De brug als tegenstander: vooruitgang met een glimlach.

Een gigantische betonnen BRUG overspant de rivier, bijna af. Kranen, bouwvakkers, een rood LINT voor de opening.

WETHOUDER DIJKSTRA (50), glimlach van een folder, poseert voor een FOTOGRAAF.

DIJKSTRA
Vooruitgang, mensen! Vijf minuten in plaats van twintig.

FOTOGRAAF
Iets meer naar links, wethouder. De pont moet erachter.

INT. CAFÉ DE OVERKANT - AVOND

Een bruin café vol vaste gasten. Henk zit aan de bar. SANNE (24), zijn kleindochter, laptop onder de arm, schuift naast hem.

SANNE
Je neemt je telefoon nooit op.

HENK
Daar heb ik een telefoon voor.

SANNE
Ik heb een plan, opa. Een documentaire. Over de laatste week van de pont.

Henk kijkt naar zijn glas. Lang.

HENK
Wie wil er nou naar een boot kijken?

SANNE
Iedereen die erop heeft gezeten.

EXT. RIVIER - NACHT

De pont vaart leeg over het zwarte water. Alleen de lichten van de brug weerspiegelen.

INT. STUURHUT VEERPONT - NACHT

Henk luidt de koperen bel. Eén keer. Het geluid draagt ver.

SANNE (V.O.)
Dag één. Opa zegt dat de rivier geen haast heeft.

EXT. VEERSTOEP - DAG

Een lange RIJ mensen wacht: fietsers, een boer met een TRACTOR, schoolkinderen, oude stelletjes. Sanne filmt met een kleine CAMERA.

BOER JANSEN
Veertig jaar neem ik deze pont. Mijn vrouw heb ik hier ontmoet.

Henk kijkt verbaasd naar de rij. Hij zet zijn pet recht.

> KNIPPEN NAAR:

EXT. NIEUWE BRUG - DAG

Dijkstra knipt het lint. Applaus. Maar de brug is leeg. Iedereen staat aan de oever, kijkend naar de pont.

> FADE OUT.
`;

export function demoProject() {
  const p = blankProject('De Laatste Veerboot');
  Object.assign(p.meta, {
    logline: 'Wanneer de veerpont van een rivierdorp wordt opgeheven voor een nieuwe brug, moet een koppige oude schipper samen met zijn kleindochter de laatste vaarweek vastleggen — voordat het verhaal van het dorp voorgoed verdwijnt.',
    genre: 'Tragikomedie', runtime: 95, tagline: 'Sommige overtochten duren een leven lang.',
    theme: 'Vooruitgang versus verbondenheid', audience: '35+, arthouse, festivals', comps: 'Bon Voyage × Nebraska',
    author: 'Jouw Naam',
  });
  p.script.text = DEMO_SCRIPT;
  p.ideas = [
    { id: uid(), text: 'De bel van de pont wordt aan het eind aan de brug gehangen.', tag: 'Beeld', color: 'amber', pinned: true },
    { id: uid(), text: 'Sanne’s camera-beelden als film-in-de-film (4:3, korrelig).', tag: 'Stijl', color: 'blue' },
    { id: uid(), text: 'Wat als de wethouder zelf ooit verliefd werd op de pont?', tag: 'Wat als', color: 'rose' },
  ];
  const mk = (name, role, want, need, flaw, arc) => ({ id: uid(), name, role, age: '', description: '', want, need, wound: '', flaw, arc, voice: '', backstory: '', notes: '', color: '' });
  p.characters = [
    mk('HENK', 'Protagonist', 'De pont met waardigheid laten eindigen, zonder poespas.', 'Toestaan dat anderen zijn verhaal delen; afscheid kunnen nemen.', 'Koppig, sluit zich af', 'Van eenzame wachter naar verteller van het dorp.'),
    mk('SANNE', 'Co-protagonist', 'Een documentaire maken die haar carrière lanceert.', 'Verbinding met haar familie en geschiedenis.', 'Ziet alles door een lens', 'Van observator naar deelnemer.'),
    mk('DIJKSTRA', 'Antagonist', 'De brug openen als hoogtepunt van haar ambtstermijn.', 'Erkennen wat er verloren gaat.', 'IJdelheid', 'Leert dat vooruitgang ook iets kost.'),
  ];
  p.locations = [
    { id: uid(), name: 'Veerstoep', match: 'VEERSTOEP', address: 'Veerweg 1, Rivierdorp', lat: 51.83, lon: 5.86, contact: 'Gemeente', phone: '', permit: 'Aangevraagd', cost: 0, parking: 'Dijk, 20 plekken', power: 'Aggregaat nodig', hospital: '', notes: '', photos: [] },
    { id: uid(), name: 'Café De Overkant', match: 'CAFÉ DE OVERKANT', address: 'Dorpsstraat 12', lat: '', lon: '', contact: 'Uitbater Marja', phone: '', permit: 'Akkoord', cost: 750, parking: '', power: 'Aanwezig', hospital: '', notes: 'Alleen draaien op maandag (gesloten).', photos: [] },
  ];
  p.people = [
    { id: uid(), name: '', type: 'cast', role: 'HENK', dept: 'Cast', phone: '', email: '', rate: '', notes: '', availability: '' },
    { id: uid(), name: '', type: 'cast', role: 'SANNE', dept: 'Cast', phone: '', email: '', rate: '', notes: '', availability: '' },
    { id: uid(), name: '', type: 'crew', role: 'Regisseur', dept: 'Regie', phone: '', email: '', rate: '', notes: '', availability: '' },
    { id: uid(), name: '', type: 'crew', role: 'Director of Photography', dept: 'Camera', phone: '', email: '', rate: '', notes: '', availability: '' },
  ];
  p.budget.items = BUDGET_TEMPLATE.map(([cat, acct, desc, qty, unit, rate]) => ({ id: uid(), cat, acct, desc, qty, unit, rate, actual: 0 }));
  p.tasks = TASK_TEMPLATE.slice(0, 12).map(([phase, title], n) => ({ id: uid(), title, phase, status: n < 3 ? 'klaar' : n < 5 ? 'bezig' : 'todo', due: '', who: '' }));
  p.schedule.startDate = todayISO();
  return p;
}
