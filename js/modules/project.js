import { h, bind, field, section, btn, iconBtn, pageHead, toast, confirmDlg, num, download, slug } from '../util.js';
import { exportProject, importProjectFile, createProject, exportAll, restoreBackup } from '../app.js';
import { deleteProject, listProjects, listBackups, backupProject, deleteBackup, SCHEMA_VERSION } from '../store.js';
import { folderSupported, getFolder, chooseFolder, forgetFolder, folderPermission, writeToFolder } from '../folder.js';

/** Lijst met automatische en handmatige momentopnamen van het project. */
function backupsSection(ctx, p) {
  const box = h('div', { class: 'stack tight' }, h('p', { class: 'muted small' }, 'Laden…'));
  const draw = async () => {
    const list = await listBackups(p.id);
    box.replaceChildren(
      h('p', { class: 'muted small' }, 'Bij het werken wordt elk uur automatisch een momentopname bewaard (de laatste 15). Terugzetten maakt eerst nog een back-up van de huidige stand.'),
      list.length ? h('table', { class: 'tbl' }, h('tbody', {}, list.map((b) => h('tr', {},
        h('td', {}, h('b', {}, new Date(b.date).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })), h('div', { class: 'faint small' }, b.label)),
        h('td', { class: 'num faint small' }, `${num(b.size / 1e6, 2)} MB`),
        h('td', { class: 'right nowrap' },
          btn('Terugzetten', async () => {
            if (!(await confirmDlg(`Het project terugzetten naar ${new Date(b.date).toLocaleString('nl-NL')}?`, 'Terugzetten'))) return;
            await restoreBackup(b); toast('Back-up teruggezet');
          }, { class: 'sm' }),
          iconBtn('download', 'Downloaden', () => download(`${slug(b.title)}-${b.date.slice(0, 16).replace(/[:T]/g, '-')}.filmatelier.json`, b.data, 'application/json')),
          iconBtn('trash', 'Verwijderen', async () => { await deleteBackup(b.id); draw(); }, 'danger')))))) : h('p', { class: 'muted' }, 'Nog geen back-ups.'),
      h('div', {}, btn('Nu een back-up maken', async () => { ctx.saveNow(); await backupProject(p, { force: true, label: 'Handmatig' }); toast('Back-up gemaakt'); draw(); }, { icon: 'plus', class: 'sm' })));
  };
  draw();
  return section('Automatische back-ups', box);
}

/** Optionele back-up naar een map op de schijf. */
function folderSection(p) {
  const box = h('div', { class: 'stack tight' });
  const draw = async () => {
    if (!folderSupported()) { box.replaceChildren(h('p', { class: 'muted small' }, 'Deze browser ondersteunt geen schrijven naar een map. Gebruik Chrome of Edge op een computer, of download back-ups handmatig.')); return; }
    const f = await getFolder();
    const perm = await folderPermission();
    box.replaceChildren(
      h('p', { class: 'muted small' }, 'Kies een map (bijvoorbeeld in OneDrive of Dropbox). Filmatelier schrijft daar elke paar minuten het project (.json) en het scenario (.fountain) naartoe.'),
      f ? h('p', {}, 'Map: ', h('b', {}, f.name), ' · ', perm === 'granted' ? h('span', { class: 'badge green' }, 'actief') : h('span', { class: 'badge amber' }, 'toestemming nodig')) : null,
      h('div', { class: 'row wrap' },
        btn(f ? 'Andere map kiezen' : 'Map kiezen', async () => { try { await chooseFolder(); await writeToFolder(p, { force: true }); toast('Back-upmap ingesteld'); } catch (e) { if (e.name !== 'AbortError') toast('Map kiezen mislukt: ' + e.message, 'err'); } draw(); }, { icon: 'folder', class: f ? 'sm' : 'sm primary' }),
        f && perm !== 'granted' ? btn('Toestemming geven', async () => { await folderPermission(true); draw(); }, { class: 'sm primary' }) : null,
        f && perm === 'granted' ? btn('Nu wegschrijven', async () => { await writeToFolder(p, { force: true }); toast('Weggeschreven naar ' + f.name); }, { class: 'sm' }) : null,
        f ? btn('Ontkoppelen', async () => { await forgetFolder(); draw(); }, { class: 'sm ghost' }) : null));
  };
  draw();
  return section('Back-upmap op je computer', box);
}

export default {
  id: 'project', title: 'Project & instellingen', icon: 'folder', group: 'Gereedschap',
  render(root, ctx) {
    const p = ctx.project, s = ctx.settings;
    const storage = h('span', { class: 'muted' }, '…');
    navigator.storage?.estimate?.().then((e) => { storage.textContent = `${num((e.usage || 0) / 1e6, 1)} MB gebruikt van ±${num((e.quota || 0) / 1e9, 1)} GB beschikbaar`; }).catch(() => { storage.textContent = 'onbekend'; });
    const persisted = h('span', { class: 'muted' });
    navigator.storage?.persisted?.().then((v) => { persisted.textContent = v ? 'Opslag is beschermd tegen automatisch opschonen.' : 'Let op: de browser kan opslag opschonen bij ruimtegebrek. Installeer de app en maak regelmatig back-ups.'; });
    const smart = h('input', { type: 'checkbox', checked: s.smartEnter !== false, onchange: (e) => { s.smartEnter = e.target.checked; } });
    const tw = h('input', { type: 'checkbox', checked: s.typewriter !== false, onchange: (e) => { s.typewriter = e.target.checked; } });
    const jsonSize = new Blob([JSON.stringify(p)]).size;

    root.append(pageHead('Project & instellingen', 'Back-ups, gegevens van de schrijver en voorkeuren.'),
      h('div', { class: 'grid g2', style: { alignItems: 'start' } },
        h('div', { class: 'stack' },
          section('Projectgegevens',
            h('div', { class: 'stack' },
              field('Titel', bind(p.meta, 'title', ctx, { onchange: () => ctx.refreshNav() })),
              field('Schrijver(s) / maker(s)', bind(p.meta, 'author', ctx)),
              field('Contactgegevens (titelpagina)', bind(p.meta, 'contact', ctx, { type: 'textarea', rows: 2 })),
              h('p', { class: 'muted small' }, 'Titelpagina van het scenario staat bovenaan het scenario (Title:, Author:, Contact:, Draft date:).'))),
          section('Schrijven',
            h('div', { class: 'stack' },
              field('Dagelijks woorddoel', bind(p.script, 'goal', ctx, { type: 'number', min: 0, step: 50 })),
              h('label', { class: 'check' }, smart, 'Slimme Enter in de scenario-editor (automatisch lege regel na actie en dialoog)'),
              h('label', { class: 'check' }, tw, 'Typemachine-scrollen in de afleidingsvrije modus (huidige regel blijft in het midden)'),
              writingLog(p)))),
        h('div', { class: 'stack' },
          section('Back-up & uitwisselen',
            h('p', { class: 'muted' }, 'Alles wordt automatisch lokaal in deze browser bewaard en werkt offline. Maak regelmatig een back-up — zeker vóór je je browsergegevens wist of van apparaat wisselt.'),
            h('div', { class: 'row wrap' },
              btn('Back-up downloaden (.json)', () => { exportProject(); toast('Back-up gedownload'); }, { icon: 'download', class: 'primary' }),
              btn('Project importeren', () => importProjectFile(), { icon: 'upload' }),
              btn('Alle projecten exporteren', () => exportAll(), { icon: 'download', class: 'ghost' })),
            h('p', { class: 'muted small', style: { marginTop: '10px' } }, `Grootte van dit project: ${num(jsonSize / 1e6, 2)} MB (inclusief afbeeldingen) · gegevensformaat v${p.version || 1} (huidig v${SCHEMA_VERSION}).`),
            h('p', { class: 'small' }, storage), h('p', { class: 'small' }, persisted)),
          backupsSection(ctx, p),
          folderSection(p),
          section('Nieuw',
            h('div', { class: 'row wrap' },
              btn('Leeg project', async () => { await createProject('blank'); ctx.go('overzicht'); }, { icon: 'plus' }),
              btn('Voorbeeldproject', async () => { await createProject('demo'); ctx.go('overzicht'); }, { icon: 'film', class: 'ghost' }))),
          section('Gevarenzone',
            btn('Dit project verwijderen', async () => {
              if (!(await confirmDlg(`“${p.meta.title}” en alle bijbehorende gegevens definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`, 'Definitief verwijderen', true))) return;
              await deleteProject(p.id);
              const rest = await listProjects();
              if (rest.length) { const { openProject } = await import('../app.js'); await openProject(rest[0].id); } else await createProject('blank');
              ctx.go('overzicht'); toast('Project verwijderd');
            }, { icon: 'trash', class: 'danger' })),
          section('Over Filmatelier',
            h('p', { class: 'muted small' }, 'Een offline werkende app (PWA) om een speelfilm te bedenken, schrijven en produceren: van idee, structuur en scenario (Fountain) tot breakdown, draaischema, callsheets, budget, post en festivals. De optionele AI-schrijfhulp gebruikt je eigen Claude-API-sleutel.'),
            h('p', { class: 'muted small' }, 'Sneltoetsen: Ctrl+S opslaan · in de editor Ctrl+1–6 elementtype, Tab personage/(…)/aanvullen, Ctrl+B/I/U opmaak.')))));
  },
};

function writingLog(p) {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push([k, d]);
  }
  // Per dag: netto geschreven woorden ≈ verschil tussen beginstand van die dag en de beginstand van de volgende geregistreerde dag.
  const keys = Object.keys(p.script.log).sort();
  const nowWords = (p.script.text.match(/[\p{L}\p{N}'’-]+/gu) || []).length;
  const written = (k) => {
    const i = keys.indexOf(k);
    if (i < 0) return 0;
    const end = i + 1 < keys.length ? p.script.log[keys[i + 1]].start : nowWords;
    return Math.max(0, end - p.script.log[k].start);
  };
  const vals = days.map(([k]) => written(k));
  const max = Math.max(Number(p.script.goal) || 0, ...vals, 1);
  return h('div', {},
    h('div', { class: 'lbl muted small', style: { marginBottom: '6px' } }, 'Woorden per dag (laatste 14 dagen)'),
    h('div', { style: { display: 'flex', gap: '4px', alignItems: 'flex-end', height: '80px' } }, days.map(([k, d], i) => h('div', {
      title: `${d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}: ${vals[i]} woorden`,
      style: { flex: 1, height: Math.max(2, (vals[i] / max) * 80) + 'px', background: vals[i] >= (Number(p.script.goal) || Infinity) ? 'var(--green)' : 'var(--accent)', borderRadius: '3px 3px 0 0', opacity: vals[i] ? 1 : 0.25 },
    }))));
}
