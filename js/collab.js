// Samenwerken met een code: apparaten koppelen rechtstreeks via WebRTC (PeerJS).
// De openbare PeerJS-server helpt alleen elkaar te vinden; projectgegevens gaan direct tussen de apparaten (versleuteld).
// Topologie: één gastheer, gasten verbinden met de gastheer; de gastheer stuurt wijzigingen door naar de anderen.

const LIB = 'https://esm.sh/peerjs@1.5.5';
const PREFIX = 'filmatelier-v1-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // zonder 0/O/1/I
const SKIP = new Set(['id', 'updated', 'created', 'version', 'ai']); // AI-gesprekken blijven privé
const SPLIT = new Set(['meta', 'script', 'structure', 'treatment', 'schedule', 'budget', 'post', 'gear', 'writer', 'tableRead', 'distribution', 'docs', 'callsheets', 'breakdown', 'shots']);

export const S = { role: null, code: null, projectId: null, status: 'uit', peers: {}, error: '' };
let peer = null;
let conns = [];
let last = {};
let api = null;
const listeners = new Set();
const emit = () => listeners.forEach((f) => { try { f(); } catch (e) { console.warn(e); } });
export const onCollabChange = (f) => { listeners.add(f); return () => listeners.delete(f); };

/** api: { project(), adopt(p), applied(paths, from), route(), name(), ask(name) → Promise<bool>, toast(msg, kind) } */
export function initCollab(a) { api = a; }
export const active = () => S.status === 'verbonden' || S.status === 'wacht';
export const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHA[b % ALPHA.length]).join('');
export const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

/* ---------- Wijzigingen per pad ---------- */
/** Maakt van een project een platte lijst paden → JSON. Lijsten met id’s worden per item opgesplitst. */
export function flatten(p) {
  const out = {};
  const put = (path, v) => {
    if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === 'object' && typeof x.id === 'string')) {
      out[path + '@'] = JSON.stringify(v.map((x) => x.id));
      for (const x of v) out[path + '#' + x.id] = JSON.stringify(x);
    } else out[path] = JSON.stringify(v ?? null);
  };
  for (const [k, v] of Object.entries(p)) {
    if (SKIP.has(k)) continue;
    if (SPLIT.has(k) && v && typeof v === 'object' && !Array.isArray(v)) for (const [k2, v2] of Object.entries(v)) put(`${k}.${k2}`, v2);
    else put(k, v);
  }
  return out;
}

export function diff(prev, cur) {
  const patch = {};
  for (const [k, v] of Object.entries(cur)) if (prev[k] !== v) patch[k] = v;
  for (const k of Object.keys(prev)) if (!(k in cur)) patch[k] = null;
  return patch;
}

/** Past een patch toe op een project (in place).
 *  Volgorde is belangrijk: eerst hele paden verwijderen, dan hele waarden zetten, dan losse lijstitems, en pas
 *  als laatste de volgorde. Anders kan het verwijderen van een “oude lege lijst” een net toegevoegd item wissen. */
export function applyPatch(p, patch) {
  const rank = ([path, json]) => (path.endsWith('@') ? 3 : path.includes('#') ? 2 : json === null ? 0 : 1);
  const entries = Object.entries(patch).sort((a, b) => rank(a) - rank(b));
  for (const [path, json] of entries) {
    const m = path.match(/^([^.#@]+)(?:\.([^#@]+))?(?:(@)|#(.+))?$/);
    if (!m) continue;
    const [, k1, k2, order, id] = m;
    const val = json === null ? undefined : JSON.parse(json);
    const parent = k2 ? (p[k1] && typeof p[k1] === 'object' ? p[k1] : (p[k1] = {})) : p;
    const key = k2 || k1;
    if (order) {
      if (val === undefined) continue;
      const arr = Array.isArray(parent[key]) ? parent[key] : [];
      const byId = new Map(arr.map((x) => [x?.id, x]));
      parent[key] = val.map((i) => byId.get(i)).filter(Boolean); // nooit lege plaatshouders maken
    } else if (id) {
      if (!Array.isArray(parent[key])) parent[key] = [];
      const arr = parent[key];
      const i = arr.findIndex((x) => x?.id === id);
      if (val === undefined) { if (i >= 0) arr.splice(i, 1); } else if (i >= 0) arr[i] = val; else arr.push(val);
    } else if (val === undefined) delete parent[key];
    else parent[key] = val;
  }
  return p;
}

/* ---------- Verbinding ---------- */
async function loadPeer() {
  const mod = await import(LIB);
  return mod.Peer || mod.default;
}
const errText = (e) => ({
  'peer-unavailable': 'Geen sessie gevonden met deze code. Controleer de code, en of de gastheer de sessie nog open heeft.',
  'unavailable-id': 'Deze code is al in gebruik. Probeer het opnieuw.',
  network: 'Geen verbinding met de koppelserver. Samenwerken heeft internet nodig.',
  'server-error': 'De koppelserver is tijdelijk niet bereikbaar. Probeer het later opnieuw.',
  'browser-incompatible': 'Deze browser ondersteunt geen WebRTC.',
  'socket-error': 'Verbinding met de koppelserver verbroken.',
  disconnected: 'Verbinding met de koppelserver verbroken.',
}[e?.type] || (e?.message || String(e)));

function send(conn, msg) { try { if (conn.open) conn.send(msg); } catch (e) { console.warn('send', e); } }
const broadcast = (msg, except) => conns.forEach((c) => c !== except && send(c, msg));

function roster() {
  const me = { name: api.name(), route: api.route(), host: S.role === 'host' };
  return [me, ...Object.values(S.peers)];
}
function pushRoster() { if (S.role === 'host') broadcast({ t: 'roster', list: roster() }); emit(); }

/** Start een sessie voor het huidige project; geeft de code terug. */
export async function host() {
  await stop(true);
  const Peer = await loadPeer();
  S.role = 'host'; S.status = 'start'; S.error = ''; S.projectId = api.project().id; S.peers = {};
  emit();
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newCode();
    try {
      peer = await new Promise((res, rej) => {
        const pr = new Peer(PREFIX + code, { debug: 0 });
        pr.on('open', () => res(pr));
        pr.on('error', (e) => rej(e));
      });
      S.code = code;
      break;
    } catch (e) {
      if (e?.type !== 'unavailable-id' || attempt === 2) { S.status = 'uit'; S.role = null; S.error = errText(e); emit(); throw new Error(S.error); }
    }
  }
  last = flatten(api.project());
  S.status = 'wacht';
  peer.on('connection', (conn) => onIncoming(conn));
  peer.on('disconnected', () => { if (S.role === 'host') peer.reconnect(); });
  peer.on('error', (e) => { S.error = errText(e); emit(); });
  emit();
  return S.code;
}

async function onIncoming(conn) {
  conn.on('open', async () => {
    const name = String(conn.metadata?.name || 'Iemand').slice(0, 40);
    const ok = await api.ask(name);
    if (!ok) { send(conn, { t: 'denied' }); setTimeout(() => conn.close(), 300); return; }
    conns.push(conn);
    S.peers[conn.peer] = { name, route: '', host: false };
    S.status = 'verbonden';
    const p = { ...api.project() };
    delete p.ai;
    send(conn, { t: 'hello', project: p, host: api.name() });
    pushRoster();
    api.toast(`${name} doet mee`);
  });
  conn.on('data', (m) => onData(conn, m));
  conn.on('close', () => {
    const who = S.peers[conn.peer]?.name;
    conns = conns.filter((c) => c !== conn);
    delete S.peers[conn.peer];
    if (S.role === 'host' && !conns.length) S.status = 'wacht';
    pushRoster();
    if (who) api.toast(`${who} is weg`);
  });
}

/** Doe mee met een code. */
export async function join(code) {
  code = normCode(code);
  if (code.length !== 6) throw new Error('Een code bestaat uit 6 tekens.');
  await stop(true);
  const Peer = await loadPeer();
  S.role = 'guest'; S.status = 'start'; S.error = ''; S.code = code; S.peers = {};
  emit();
  try {
    peer = await new Promise((res, rej) => { const pr = new Peer({ debug: 0 }); pr.on('open', () => res(pr)); pr.on('error', rej); });
  } catch (e) { S.status = 'uit'; S.role = null; S.error = errText(e); emit(); throw new Error(S.error); }
  return new Promise((resolve, reject) => {
    const conn = peer.connect(PREFIX + code, { reliable: true, metadata: { name: api.name() } });
    let settled = false;
    const fail = (msg) => { if (settled) return; settled = true; S.status = 'uit'; S.role = null; S.error = msg; emit(); stop(true); reject(new Error(msg)); };
    const timer = setTimeout(() => fail('Geen reactie van de gastheer. Staat de sessie nog open, en heeft de gastheer je toegelaten?'), 60000);
    peer.on('error', (e) => { clearTimeout(timer); fail(errText(e)); });
    conn.on('open', () => { S.status = 'wacht'; emit(); });
    conn.on('data', async (m) => {
      if (m?.t === 'denied') { clearTimeout(timer); fail('De gastheer heeft je verzoek geweigerd.'); return; }
      if (m?.t === 'hello' && !settled) {
        clearTimeout(timer);
        settled = true;
        conns = [conn];
        await api.adopt(m.project, m.host);
        S.projectId = m.project.id;
        last = flatten(api.project());
        S.status = 'verbonden';
        send(conn, { t: 'presence', name: api.name(), route: api.route() });
        emit();
        resolve();
        return;
      }
      onData(conn, m);
    });
    conn.on('close', () => {
      if (!settled) { clearTimeout(timer); fail('Verbinding gesloten.'); return; }
      if (S.role === 'guest') { api.toast('De sessie is beëindigd door de gastheer of de verbinding viel weg. Je lokale kopie blijft bewaard.', 'err'); stop(true); }
    });
  });
}

function onData(conn, m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'patch' && m.patch && api.project().id === S.projectId) {
    const p = api.project();
    applyPatch(p, m.patch);
    for (const [k, v] of Object.entries(m.patch)) { if (v === null) delete last[k]; else last[k] = v; }
    api.applied(Object.keys(m.patch), m.from);
    if (S.role === 'host') broadcast(m, conn);
  } else if (m.t === 'presence' && S.role === 'host') {
    S.peers[conn.peer] = { ...(S.peers[conn.peer] || {}), name: String(m.name || 'Iemand').slice(0, 40), route: String(m.route || '') };
    pushRoster();
  } else if (m.t === 'roster' && S.role === 'guest') {
    S.peers = Object.fromEntries((m.list || []).filter((x) => !(x.name === api.name() && !x.host)).map((x, i) => [String(i), x]));
    emit();
  }
}

/** Na elk lokaal opslaan: verstuur alleen wat er veranderd is. */
export function onLocalSave(p) {
  if (!conns.length || p.id !== S.projectId) return;
  const cur = flatten(p);
  const patch = diff(last, cur);
  last = cur;
  if (Object.keys(patch).length) broadcast({ t: 'patch', from: api.name(), patch });
}

export function announceRoute() {
  if (!active()) return;
  if (S.role === 'guest') conns.forEach((c) => send(c, { t: 'presence', name: api.name(), route: api.route() }));
  else pushRoster();
}

/** Wie anders dan ik zit in dit onderdeel? */
export const othersOn = (route) => (active() ? Object.values(S.peers).filter((x) => x.route === route).map((x) => x.name) : []);

export async function stop(silent = false) {
  conns.forEach((c) => { try { c.close(); } catch { /* al dicht */ } });
  conns = [];
  try { peer?.destroy(); } catch { /* al weg */ }
  peer = null;
  const was = S.status;
  Object.assign(S, { role: null, code: null, projectId: null, status: 'uit', peers: {} });
  if (!silent && was !== 'uit') api?.toast('Samenwerksessie gestopt');
  emit();
}
