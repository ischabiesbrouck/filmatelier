// Filmatelier — app-shell, router en gedeelde context.

import { h, clear, icon, iconBtn, btn, debounce, modal, confirmDlg, promptDlg, toast, download, pickFile, readText, slug, fmtDate } from './util.js';
import { listProjects, loadProject, saveProject, deleteProject, blankProject, demoProject, normalize, migrate, settings, backupProject, allProjects } from './store.js';
import { parse } from './fountain.js';
import { openAI, closeAI } from './ai.js';
import { migrateKeys } from './scenes.js';
import { writeToFolder } from './folder.js';
import { openPalette } from './palette.js';

import dashboard from './modules/dashboard.js';
import ideas from './modules/ideas.js';
import structure from './modules/structure.js';
import characters from './modules/characters.js';
import world from './modules/world.js';
import treatment from './modules/treatment.js';
import script from './modules/script.js';
import cards from './modules/cards.js';
import analysis from './modules/analysis.js';
import tableread from './modules/tableread.js';
import writer from './modules/writer.js';
import guide from './modules/guide.js';
import breakdown from './modules/breakdown.js';
import shots from './modules/shots.js';
import stripboard from './modules/stripboard.js';
import people from './modules/people.js';
import locations from './modules/locations.js';
import budget from './modules/budget.js';
import mood from './modules/mood.js';
import gear from './modules/gear.js';
import tasks from './modules/tasks.js';
import callsheet from './modules/callsheet.js';
import takes from './modules/takes.js';
import post from './modules/post.js';
import festivals from './modules/festivals.js';
import tools from './modules/tools.js';
import project from './modules/project.js';

export const MODULES = [dashboard, ideas, structure, characters, world, treatment, script, cards, analysis, tableread, writer, breakdown, shots, stripboard, people, locations, gear, budget, mood, tasks, callsheet, takes, post, festivals, tools, guide, project];
const GROUPS = ['Start', 'Ontwikkeling', 'Schrijven', 'Pre-productie', 'Productie', 'Post & distributie', 'Gereedschap'];

const state = { project: null, route: 'overzicht', cleanup: null, parsedFor: null, parsed: null, dirty: false };

// Uniek per venster, zodat we eigen opslagberichten kunnen negeren.
const TAB_ID = Math.random().toString(36).slice(2);
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('filmatelier') : null;

const persist = debounce(async () => {
  if (!state.project) return;
  const p = state.project;
  try {
    await saveProject(p);
    state.dirty = false;
    setStatus('Opgeslagen');
    channel?.postMessage({ type: 'saved', id: p.id, updated: p.updated, tab: TAB_ID });
    backupProject(p).catch((e) => console.warn('Back-up', e));
    writeToFolder(p).catch((e) => console.warn('Back-upmap', e));
  } catch (e) {
    console.error(e);
    setStatus('Opslaan mislukt', true);
    const quota = e?.name === 'QuotaExceededError' || /quota/i.test(e?.message || '');
    toast(quota ? 'Opslag vol: verwijder grote afbeeldingen of oude back-ups (Project & instellingen), en download een back-up.' : 'Opslaan mislukt: ' + (e?.message || e), 'err');
  }
}, 500);

/* Meerdere vensters: als een ander venster hetzelfde project opslaat, hier bijwerken of waarschuwen. */
channel?.addEventListener('message', async (e) => {
  const m = e.data;
  if (m?.type !== 'saved' || m.tab === TAB_ID || m.id !== state.project?.id) return;
  if (state.dirty || document.visibilityState === 'visible') {
    const t = h('div', { class: 'toast' }, 'Dit project is in een ander venster gewijzigd. ',
      h('button', { class: 'btn sm', type: 'button', onclick: async () => { t.remove(); await reloadCurrent(); } }, 'Herladen'));
    document.body.append(h('div', { class: 'toasts' }, t));
    setTimeout(() => t.remove(), 12000);
  } else {
    await reloadCurrent();
  }
});

async function reloadCurrent() {
  const p = await loadProject(state.project.id);
  if (!p) return;
  state.project = p; state.parsedFor = null; state.parsed = null; state.dirty = false;
  renderNav(); renderView(true);
}

export const ctx = {
  get project() { return state.project; },
  get route() { return state.route; },
  settings,
  save() { state.dirty = true; setStatus('Bewaren…'); persist(); },
  saveNow() { persist.flush(); },
  rerender() { renderView(true); },
  go(route) { location.hash = '#/' + route; },
  /** Geparste versie van het scenario (gememoïseerd). */
  parsed() {
    const t = state.project.script.text;
    if (state.parsedFor !== t) {
      const old = state.parsed;
      const np = parse(t);
      // Hernoemde scènekop (zelfde aantal scènes, oude sleutel verdwenen, nieuwe erbij): gekoppelde gegevens meeverhuizen.
      if (old && old.scenes.length === np.scenes.length) {
        const oldKeys = new Set(old.scenes.map((s) => s.key)), newKeys = new Set(np.scenes.map((s) => s.key));
        const map = {};
        old.scenes.forEach((s, i) => { const nk = np.scenes[i].key; if (s.key !== nk && !newKeys.has(s.key) && !oldKeys.has(nk)) map[s.key] = nk; });
        if (Object.keys(map).length) { migrateKeys(state.project, map); ctx.save(); }
      }
      state.parsed = np;
      state.parsedFor = t;
    }
    return state.parsed;
  },
  sceneByKey(key) { return ctx.parsed().scenes.find((s) => s.key === key); },
  /** Castnummers op basis van aantal scènes (industrie-gewoonte: 1 = hoofdrol). */
  castNumbers() {
    const chars = Object.values(ctx.parsed().characters).sort((a, b) => b.scenes.size - a.scenes.size || a.first - b.first);
    const map = {};
    chars.forEach((c, i) => { map[c.name] = i + 1; });
    return map;
  },
  refreshNav() { renderNav(); },
  openAI,
};

/* ---------- Shell ---------- */
let els = {};

function buildShell() {
  const root = document.getElementById('app');
  clear(root);
  els.nav = h('nav', { class: 'nav', 'aria-label': 'Onderdelen' });
  els.projBtn = h('button', { class: 'proj-btn', type: 'button', onclick: projectSwitcher, title: 'Wissel van project' });
  els.install = btn('App installeren', () => installPrompt?.prompt(), { icon: 'download', class: 'ghost sm hidden' });
  els.sidebar = h('aside', { class: 'sidebar' },
    h('div', { class: 'brand' }, h('span', { class: 'logo', html: LOGO }), h('span', {}, 'Film', h('em', {}, 'atelier'))),
    els.projBtn,
    els.nav,
    h('div', { class: 'side-foot' },
      els.install,
      h('div', { class: 'row' },
        iconBtn('moon', 'Licht/donker wisselen', toggleTheme),
        iconBtn('sparkles', 'AI-schrijfhulp', () => openAI()),
        iconBtn('folder', 'Projecten', projectSwitcher))));
  els.status = h('span', { class: 'save-status', 'aria-live': 'polite' }, '');
  els.crumb = h('div', { class: 'crumb' });
  els.view = h('main', { id: 'view', class: 'view', tabindex: '-1' });
  els.scrim = h('div', { class: 'scrim', onclick: () => document.body.classList.remove('nav-open') });
  const top = h('header', { class: 'topbar' },
    iconBtn('menu', 'Menu', () => document.body.classList.toggle('nav-open'), 'only-mobile'),
    els.crumb,
    h('div', { class: 'spacer' }),
    els.status,
    h('button', { class: 'search-pill', type: 'button', onclick: () => palette(), 'aria-label': 'Zoeken en opdrachten (Ctrl+K)' },
      icon('search', 15), h('span', {}, 'Zoeken'), h('span', { class: 'kbd' }, 'Ctrl K')),
    btn('AI-hulp', () => openAI(), { icon: 'sparkles', class: 'ghost sm ai-top' }));
  root.append(els.sidebar, els.scrim, h('div', { class: 'main' }, top, els.view));
}

function renderNav() {
  clear(els.nav);
  const t = state.project?.meta.title || 'Naamloos';
  const initials = t.replace(/^(de|het|een|the|a|an)\s+/i, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'F';
  els.projBtn.replaceChildren(h('span', { class: 'poster-chip' }, initials),
    h('span', { class: 'pt' }, h('b', {}, t), h('small', {}, state.project?.meta.status || 'Ontwikkeling')), icon('down', 14));
  for (const g of GROUPS) {
    const mods = MODULES.filter((m) => m.group === g);
    if (!mods.length) continue;
    els.nav.append(h('div', { class: 'nav-group' }, h('div', { class: 'nav-label' }, g),
      mods.map((m) => h('a', {
        href: '#/' + m.id, class: 'nav-item' + (m.id === state.route ? ' active' : ''),
        'aria-current': m.id === state.route ? 'page' : null,
        onclick: () => document.body.classList.remove('nav-open'),
      }, icon(m.icon, 17), h('span', {}, m.title), m.badge ? badge(m.badge(ctx)) : null))));
  }
}
const badge = (v) => (v ? h('span', { class: 'nav-badge' }, v) : null);

function renderView(keepScroll = false) {
  const mod = MODULES.find((m) => m.id === state.route) || MODULES[0];
  const y = keepScroll ? window.scrollY : 0;
  try { state.cleanup?.(); } catch (e) { console.warn(e); }
  state.cleanup = null;
  clear(els.view);
  els.view.className = 'view mod-' + mod.id;
  els.crumb.replaceChildren(h('span', { class: 'muted' }, mod.group), h('span', { class: 'sep' }, '/'), h('strong', {}, mod.title));
  document.title = `${mod.title} · ${state.project.meta.title || 'Filmatelier'}`;
  try {
    const r = mod.render(els.view, ctx);
    if (typeof r === 'function') state.cleanup = r;
    const head = els.view.querySelector(':scope > .page-head > div:first-child');
    if (head && !head.querySelector('.eyebrow')) head.prepend(h('div', { class: 'eyebrow' }, mod.group));
  } catch (e) {
    console.error(e);
    els.view.append(h('div', { class: 'card err' }, h('h3', {}, 'Er ging iets mis in dit onderdeel'), h('pre', {}, String(e?.stack || e))));
  }
  window.scrollTo(0, y);
}

function onRoute() {
  const r = (location.hash.replace(/^#\/?/, '') || 'overzicht').split('?')[0];
  state.route = MODULES.some((m) => m.id === r) ? r : 'overzicht';
  renderNav();
  renderView();
  if (!matchMedia('(max-width: 900px)').matches) els.view.focus({ preventScroll: true });
}

function setStatus(text, err = false) {
  if (!els.status) return;
  els.status.textContent = text;
  els.status.classList.toggle('err', err);
  els.status.classList.toggle('busy', !err && text.endsWith('…'));
}

/* ---------- Projecten ---------- */
export async function openProject(id) {
  const p = await loadProject(id);
  if (!p) return false;
  state.project = p;
  state.parsedFor = null;
  state.parsed = null;
  settings.lastProject = id;
  closeAI();
  renderNav();
  renderView();
  return true;
}

export async function createProject(kind = 'blank', title) {
  const p = kind === 'demo' ? demoProject() : blankProject(title || 'Nieuwe film');
  await saveProject(p);
  await openProject(p.id);
  return p;
}

export async function importProjectFile() {
  const [f] = await pickFile('.json,application/json');
  if (!f) return;
  try {
    const data = JSON.parse(await readText(f));
    const list = data?.format === 'filmatelier-bundle' ? data.projects : [data];
    if (!list?.length || list.some((x) => !x?.meta || !x?.script)) throw new Error('Geen Filmatelier-projectbestand');
    const ids = new Set((await listProjects()).map((x) => x.id));
    for (const p of list) {
      if (ids.has(p.id) && !(await confirmDlg(`Er bestaat al een project met deze ID (“${p.meta.title}”). Overschrijven? Kies Annuleren om het als kopie te importeren.`, 'Overschrijven', true))) {
        p.id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      }
      if (ids.has(p.id)) await backupProject(await loadProject(p.id), { force: true, label: 'Vóór import' });
      await saveProject(migrate(normalize(p)));
    }
    await openProject(list[0].id);
    toast(list.length > 1 ? `${list.length} projecten geïmporteerd` : 'Project geïmporteerd');
  } catch (e) {
    toast('Importeren mislukt: ' + e.message, 'err');
  }
}

export function exportProject(p = state.project) {
  download(`${slug(p.meta.title)}.filmatelier.json`, JSON.stringify(p), 'application/json');
}

/** Alle projecten in één bestand (handig bij wisselen van apparaat). */
export async function exportAll() {
  persist.flush();
  const projects = await allProjects();
  download(`filmatelier-alle-projecten-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ format: 'filmatelier-bundle', exported: new Date().toISOString(), projects }), 'application/json');
}

/** Zet een opgeslagen back-up terug als werkversie (de huidige stand wordt eerst zelf als back-up bewaard). */
export async function restoreBackup(backup) {
  persist.flush();
  const cur = await loadProject(backup.projectId);
  if (cur) await backupProject(cur, { force: true, label: 'Vóór herstel' });
  const p = migrate(normalize(JSON.parse(backup.data)));
  await saveProject(p);
  await openProject(p.id);
}

function palette() {
  openPalette({ ctx, modules: MODULES, actions: [
    ['Nieuw idee', 'bulb', async () => { const t = await promptDlg('Nieuw idee', '', 'Idee'); if (t) { state.project.ideas.unshift({ id: Math.random().toString(36).slice(2), text: t, tag: '', color: 'amber' }); ctx.save(); ctx.go('ideeen'); toast('Idee toegevoegd'); } }],
    ['Nieuwe taak', 'check', async () => { const t = await promptDlg('Nieuwe taak', '', 'Taak'); if (t) { state.project.tasks.push({ id: Math.random().toString(36).slice(2), title: t, phase: state.project.meta.status || 'Ontwikkeling', status: 'todo', due: '', who: '' }); ctx.save(); toast('Taak toegevoegd'); ctx.rerender(); } }],
    ['Licht/donker thema wisselen', 'moon', toggleTheme],
    ['Back-up van dit project downloaden', 'download', () => exportProject()],
    ['Alle projecten exporteren', 'download', () => exportAll()],
    ['Ander project openen', 'folder', projectSwitcher],
    ['AI-schrijfhulp openen', 'sparkles', () => openAI()],
  ] });
}

async function projectSwitcher() {
  persist.flush();
  const list = await listProjects();
  modal({
    title: 'Projecten',
    wide: true,
    body: (close) => h('div', { class: 'stack' },
      h('div', { class: 'row wrap' },
        btn('Nieuw project', async () => { const t = await promptDlg('Nieuw project', '', 'Werktitel van de film'); if (t) { close(); await createProject('blank', t); ctx.go('overzicht'); } }, { icon: 'plus', class: 'primary' }),
        btn('Voorbeeldproject', async () => { close(); await createProject('demo'); ctx.go('overzicht'); }, { icon: 'film' }),
        btn('Importeren (.json)', async () => { close(); await importProjectFile(); }, { icon: 'upload' }),
        btn('Alles exporteren', () => exportAll(), { icon: 'download', class: 'ghost' })),
      h('div', { class: 'proj-list' }, list.map((p) => h('div', { class: 'proj-row' + (p.id === state.project?.id ? ' current' : '') },
        h('button', { class: 'proj-open', type: 'button', onclick: async () => { close(); await openProject(p.id); } },
          h('strong', {}, p.title), h('small', { class: 'muted' }, p.logline ? p.logline.slice(0, 110) + (p.logline.length > 110 ? '…' : '') : 'Nog geen logline'),
          h('small', { class: 'muted' }, 'Bijgewerkt ' + fmtDate(p.updated?.slice(0, 10)))),
        iconBtn('download', 'Exporteren', async () => exportProject(await loadProject(p.id))),
        iconBtn('trash', 'Verwijderen', async () => {
          if (!(await confirmDlg(`“${p.title}” definitief verwijderen? Exporteer eerst een back-up als je twijfelt.`, 'Verwijderen', true))) return;
          await deleteProject(p.id);
          close();
          if (p.id === state.project?.id) {
            const rest = await listProjects();
            if (rest.length) await openProject(rest[0].id); else await createProject('blank');
          }
          projectSwitcher();
        }, 'danger'))))),
  });
}

/* ---------- Thema ---------- */
function applyTheme() {
  const t = settings.theme || 'light';
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'light' ? '#ececec' : '#000000');
}
function toggleTheme() { settings.theme = (settings.theme || 'light') === 'dark' ? 'light' : 'dark'; applyTheme(); }

/* ---------- PWA ---------- */
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; els.install?.classList.remove('hidden'); });
window.addEventListener('appinstalled', () => els.install?.classList.add('hidden'));

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          const t = h('div', { class: 'toast update' }, 'Nieuwe versie beschikbaar. ', h('button', { class: 'btn sm primary', type: 'button', onclick: () => { nw.postMessage('skipWaiting'); } }, 'Vernieuwen'));
          document.body.append(h('div', { class: 'toasts' }, t));
        }
      });
    });
  }).catch((e) => console.warn('SW', e));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; persist.flush(); location.reload(); } });
}

/* ---------- Start ---------- */
async function boot() {
  applyTheme();
  buildShell();
  navigator.storage?.persist?.().catch(() => {});
  let ok = false;
  if (settings.lastProject) ok = await openProject(settings.lastProject);
  if (!ok) {
    const list = await listProjects();
    if (list.length) ok = await openProject(list[0].id);
    else await createProject('demo');
  }
  window.addEventListener('hashchange', onRoute);
  onRoute();
  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); persist.flush(); toast('Opgeslagen'); }
    if ((e.ctrlKey || e.metaKey) && k === 'k') { e.preventDefault(); palette(); }
  });
  window.addEventListener('beforeunload', () => { if (state.dirty) persist.flush(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    if (state.dirty) persist.flush();
    if (state.project) writeToFolder(state.project, { force: true }).catch(() => {});
  });
  registerSW();
}

/* ---------- Onverwachte fouten zichtbaar maken (zonder te spammen) ---------- */
let lastErr = 0;
function reportError(err) {
  const msg = String(err?.message || err || '');
  if (!msg || /ResizeObserver loop/i.test(msg) || Date.now() - lastErr < 4000) return;
  lastErr = Date.now();
  console.error(err);
  toast('Er ging iets mis: ' + msg.slice(0, 140), 'err');
}
window.addEventListener('error', (e) => reportError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => reportError(e.reason));

const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11h16v9H4zM3.5 10.5L19 6.5l-1-4L2.5 6.5zM8 5.3l2 4M13 4l2 4"/></svg>';

boot();
