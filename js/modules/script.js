import { h, fill, btn, iconBtn, icon, field, modal, confirmDlg, promptDlg, toast, download, pickFile, readText, debounce, slug, words, todayISO, uid, esc, printDoc, fmtDate } from '../util.js';
import { toHTML, toFDX, fromFDX, SCRIPT_CSS, SCENE_RE, isCue, parse } from '../fountain.js';
import { lockSceneNumbers, unlockSceneNumbers } from '../scenes.js';

let showPreview = true;
let focusMode = false;
let sprint = null; // { end, startWords, timer }

const lineBounds = (v, pos) => { const s = v.lastIndexOf('\n', pos - 1) + 1; let e = v.indexOf('\n', pos); if (e < 0) e = v.length; return [s, e]; };
const prevLine = (v, s) => { if (s === 0) return null; const ps = v.lastIndexOf('\n', s - 2) + 1; return v.slice(ps, s - 1); };
const blank = (l) => l == null || !l.trim();

/** Bepaalt het Fountain-element van de regel die begint op positie s. */
function lineKind(v, s) {
  const [, e] = lineBounds(v, s);
  const line = v.slice(s, e), t = line.trim();
  if (!t) return 'leeg';
  const pl = prevLine(v, s);
  if (blank(pl) && SCENE_RE.test(t)) return 'scènekop';
  if (t.startsWith('>') && t.endsWith('<')) return 'gecentreerd';
  if (t.startsWith('>')) return 'overgang';
  if (t.startsWith('#')) return 'sectie';
  if (t.startsWith('=')) return 'synopsis';
  if (t.startsWith('[[')) return 'notitie';
  // blokbegin zoeken
  let bs = s;
  while (bs > 0 && !blank(prevLine(v, bs))) bs = v.lastIndexOf('\n', bs - 2) + 1;
  const first = v.slice(bs, lineBounds(v, bs)[1]).trim();
  const firstIsCue = first.startsWith('@') || (isCue(first) && !SCENE_RE.test(first));
  if (bs === s) return firstIsCue && v.slice(e + 1, lineBounds(v, e + 1)[1]).trim() ? 'personage' : (firstIsCue ? 'personage' : 'actie');
  if (firstIsCue) return /^\(.*\)?$/.test(t) ? 'parenthetical' : 'dialoog';
  return 'actie';
}

function insertText(ta, text) {
  ta.focus();
  if (!document.execCommand('insertText', false, text)) {
    ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function replaceLine(ta, fn, caretAtEnd = true) {
  const v = ta.value;
  const [s, e] = lineBounds(v, ta.selectionStart);
  const old = v.slice(s, e);
  const res = fn(old, v, s);
  if (res == null || res === old) return;
  ta.setSelectionRange(s, e);
  insertText(ta, res);
  if (!caretAtEnd) ta.setSelectionRange(s, s);
}

function caretTop(ta, pos) {
  const m = document.createElement('div');
  const cs = getComputedStyle(ta);
  for (const p of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'paddingTop', 'paddingLeft', 'paddingRight', 'letterSpacing', 'tabSize', 'boxSizing', 'wordSpacing']) m.style[p] = cs[p];
  Object.assign(m.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', width: ta.clientWidth + 'px', left: '-9999px', top: '0' });
  m.textContent = ta.value.slice(0, pos);
  const sp = document.createElement('span'); sp.textContent = '​'; m.append(sp);
  document.body.append(m);
  const top = sp.offsetTop; m.remove();
  return top;
}

function gotoLine(ta, line) {
  const v = ta.value;
  let pos = 0;
  for (let i = 0; i < line && pos >= 0; i++) pos = v.indexOf('\n', pos) + 1;
  pos = Math.max(0, pos);
  ta.focus({ preventScroll: true });
  ta.setSelectionRange(pos, pos);
  ta.scrollTop = Math.max(0, caretTop(ta, pos) - 60);
}

export default {
  id: 'scenario', title: 'Scenario', icon: 'pen', group: 'Schrijven',
  badge: (ctx) => { const n = ctx.parsed().pages; return n ? n + ' p' : null; },
  render(root, ctx) {
    const p = ctx.project, S = p.script;
    S.log ??= {};
    const today = todayISO();
    let baseWords = words(S.text);

    // --- editor ---
    const ta = h('textarea', { class: 'script-ta', spellcheck: 'true', lang: 'nl', 'aria-label': 'Scenario (Fountain)', placeholder: 'Begin hier… bijv.\n\nINT. KEUKEN - NACHT\n\nAnna staart naar de telefoon.\n\nANNA\nNeem nou op.' });
    ta.value = S.text;

    const nav = h('div', { class: 'scene-nav', 'aria-label': 'Scènes' });
    const preview = h('div', { class: 'preview' });
    const scaler = h('div', { class: 'scaler' });
    preview.append(h('style', {}, SCRIPT_CSS), scaler);
    const suggest = h('div', { class: 'suggest' });
    const status = h('div', { class: 'statusline' });
    const sprintBtn = btn('Sprint', () => toggleSprint(), { icon: 'clock', class: 'ghost', title: 'Schrijfsprint van 25 minuten' });

    const el = (label, key, title, fn) => h('button', { class: 'btn ghost', type: 'button', title: `${title} (Ctrl+${key})`, onclick: fn }, label);
    const tools = h('div', { class: 'editor-tools' },
      el('Scène', 1, 'Scènekop', () => toKind('heading')),
      el('Actie', 2, 'Actie', () => toKind('action')),
      el('Personage', 3, 'Personage', () => toKind('character')),
      el('( )', 4, 'Parenthetical', () => toKind('paren')),
      el('Overgang', 5, 'Overgang', () => toKind('transition')),
      el('>Midden<', 6, 'Gecentreerd', () => toKind('centered')),
      h('span', { class: 'faint' }, '|'),
      h('button', { class: 'btn ghost', type: 'button', title: 'Notitie [[ ]] (niet afgedrukt)', onclick: () => wrapSel('[[', ']]') }, '[[notitie]]'),
      h('button', { class: 'btn ghost', type: 'button', title: 'Synopsisregel (= …)', onclick: () => replaceLine(ta, (l) => '= ' + l.replace(/^=\s*/, '')) }, '= synopsis'),
      h('button', { class: 'btn ghost', type: 'button', title: 'Sectie (# akte/sequentie)', onclick: () => replaceLine(ta, (l) => '# ' + l.replace(/^#+\s*/, '')) }, '# sectie'),
      h('button', { class: 'btn ghost', type: 'button', title: 'Vet (Ctrl+B)', onclick: () => wrapSel('**', '**') }, h('b', {}, 'B')),
      h('button', { class: 'btn ghost', type: 'button', title: 'Cursief (Ctrl+I)', onclick: () => wrapSel('*', '*') }, h('i', {}, 'I')),
      h('button', { class: 'btn ghost', type: 'button', title: 'Onderstreept (Ctrl+U)', onclick: () => wrapSel('_', '_') }, h('u', {}, 'U')),
      h('div', { class: 'spacer' }),
      sprintBtn,
      iconBtn('sparkles', 'AI over selectie / huidige scène', () => {
        const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd) || currentSceneText();
        ctx.openAI({ prompt: 'Geef feedback op deze passage en stel een verbeterde versie voor (in Fountain):', selection: sel });
      }),
      iconBtn('expand', 'Afleidingsvrij schrijven, schermvullend (Esc = terug)', () => setFocus(!focusMode)),
      iconBtn('eye', 'Voorbeeld aan/uit', () => { showPreview = !showPreview; wrap.classList.toggle('no-preview', !showPreview); if (showPreview) renderPreview(); }));

    const wrap = h('div', { class: 'script-wrap' + (showPreview ? '' : ' no-preview') + (focusMode ? ' focus' : '') },
      nav, h('div', { class: 'editor-col' }, tools, ta, suggest, status), preview);

    root.append(
      h('div', { class: 'page-head' },
        h('div', {}, h('h1', {}, 'Scenario'), h('p', { class: 'muted' }, 'Schrijf in Fountain: platte tekst die automatisch als scenario wordt opgemaakt. ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); help(); } }, 'Fountain-spiekbriefje'))),
        h('div', { class: 'page-actions' },
          btn('Versies', () => versions(), { icon: 'history' }),
          btn('Zoeken & vervangen', () => findReplace(), { icon: 'search', class: 'ghost' }),
          btn('Importeren', () => importScript(), { icon: 'upload', class: 'ghost' }),
          btn('Exporteren', () => exportMenu(), { icon: 'download' }),
          btn('PDF / afdrukken', () => printScript(), { icon: 'print', class: 'primary' }))),
      wrap);

    // --- afleidingsvrije modus + typemachine-scrollen ---
    function setFocus(on) {
      focusMode = on;
      wrap.classList.toggle('focus', on);
      document.body.classList.toggle('writing-focus', on);
      if (on && document.fullscreenEnabled && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
      if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      ta.focus();
      typewriter();
    }
    const onFs = () => { if (!document.fullscreenElement && focusMode) setFocus(false); };
    document.addEventListener('fullscreenchange', onFs);
    let twRaf = 0;
    function typewriter() {
      if (!focusMode || ctx.settings.typewriter === false) return;
      cancelAnimationFrame(twRaf);
      twRaf = requestAnimationFrame(() => { ta.scrollTop = caretTop(ta, ta.selectionStart) - ta.clientHeight * 0.42; });
    }
    if (focusMode) document.body.classList.add('writing-focus');

    // --- render helpers ---
    let curScene = -1;
    function renderNav() {
      const parsed = ctx.parsed();
      nav.replaceChildren(
        h('div', { class: 'card-title', style: { margin: '2px 4px 6px' } }, `${parsed.scenes.length} scènes`),
        ...parsed.scenes.map((s) => h('button', { type: 'button', class: s.index === curScene ? 'cur' : '', title: s.heading + (s.synopsis.length ? '\n' + s.synopsis.join(' ') : ''), onclick: () => gotoLine(ta, s.line) },
          h('span', { class: 'sn' }, s.num), ` ${s.ie ? s.ie + '. ' : ''}${s.location || s.heading}`)));
    }
    function renderPreview() {
      if (!showPreview) return;
      scaler.innerHTML = toHTML(ctx.parsed(), { sceneNumbers: true });
      fitPreview();
    }
    function fitPreview() {
      const w = preview.clientWidth - 24;
      scaler.style.zoom = Math.min(1, Math.max(0.3, w / 816)).toFixed(3);
    }
    function renderStatus() {
      const parsed = ctx.parsed();
      const nowW = words(ta.value);
      const log = S.log[today];
      const todayW = log ? Math.max(0, nowW - log.start) : 0;
      const goal = Number(S.goal) || 0;
      const kind = lineKind(ta.value, lineBounds(ta.value, ta.selectionStart)[0]);
      fill(status,
        h('span', {}, 'Element: ', h('b', {}, kind)),
        h('span', {}, h('b', {}, parsed.pages), ' pagina’s'),
        h('span', {}, h('b', {}, parsed.scenes.length), ' scènes'),
        h('span', {}, '≈ ', h('b', {}, parsed.pages), ' min'),
        h('span', {}, h('b', {}, nowW.toLocaleString('nl-NL')), ' woorden'),
        h('span', { title: 'Woorden vandaag t.o.v. je dagdoel' }, 'Vandaag: ', h('b', { style: { color: goal && todayW >= goal ? 'var(--green)' : '' } }, todayW), goal ? `/${goal}` : ''),
        sprint ? h('span', {}, 'Sprint: ', h('b', {}, Math.max(0, nowW - sprint.startWords)), ' woorden') : null);
    }
    function currentSceneText() {
      const parsed = ctx.parsed();
      const s = parsed.scenes[curScene];
      if (!s) return '';
      return ta.value.split('\n').slice(s.line, s.endLine + 1).join('\n');
    }
    function trackCaret() {
      const parsed = ctx.parsed();
      const line = ta.value.slice(0, ta.selectionStart).split('\n').length - 1;
      let idx = -1;
      for (const s of parsed.scenes) { if (s.line <= line) idx = s.index; else break; }
      if (idx !== curScene) {
        curScene = idx;
        nav.querySelectorAll('button').forEach((b, i) => b.classList.toggle('cur', i === idx));
        nav.querySelector('button.cur')?.scrollIntoView({ block: 'nearest' });
        if (showPreview) {
          const t = scaler.querySelector(`[data-scene="${idx}"]`);
          if (t) preview.scrollTop += t.getBoundingClientRect().top - preview.getBoundingClientRect().top - 30;
        }
      }
      renderSuggest();
      renderStatus();
    }

    // --- suggesties (autocomplete) ---
    let suggestions = [];
    function renderSuggest() {
      const v = ta.value, pos = ta.selectionStart;
      const [s] = lineBounds(v, pos);
      const before = v.slice(s, pos);
      const parsed = ctx.parsed();
      suggestions = [];
      const t = before.trimStart();
      if (t && blank(prevLine(v, s))) {
        if (/^(int|ext|est|i\/e)/i.test(t) || t.startsWith('.')) {
          const heads = [...new Set(parsed.scenes.map((sc) => (sc.ie ? (sc.ie === 'INT/EXT' ? 'INT./EXT.' : sc.ie + '.') + ' ' : '') + sc.location))];
          suggestions = heads.filter((x) => x.toUpperCase().startsWith(t.toUpperCase()) && x.toUpperCase() !== t.toUpperCase()).slice(0, 6);
          const tods = ['DAG', 'NACHT', 'OCHTEND', 'AVOND', 'DAGERAAD', 'SCHEMERING', 'LATER', 'CONTINU'];
          const m = t.match(/\s[-–]\s*(\S*)$/);
          if (m) suggestions = tods.filter((x) => x.startsWith(m[1].toUpperCase()) && x !== m[1].toUpperCase()).map((x) => t.slice(0, t.length - m[1].length) + x);
        } else if (t === t.toUpperCase() && /\p{L}/u.test(t) && t.length >= 1) {
          const names = [...new Set([...Object.keys(parsed.characters), ...p.characters.map((c) => c.name.toUpperCase())])];
          suggestions = names.filter((n) => n.startsWith(t) && n !== t).slice(0, 6);
        }
      }
      if (suggestions.length) {
        suggest.replaceChildren(h('span', {}, h('span', { class: 'kbd' }, 'Tab'), ' '), ...suggestions.map((sg, i) => h('button', { class: 'chip' + (i === 0 ? ' on' : ''), type: 'button', onmousedown: (e) => { e.preventDefault(); accept(sg); } }, sg)));
      } else {
        suggest.replaceChildren(h('span', {}, h('span', { class: 'kbd' }, 'Tab'), ' personage / ( ) · ', h('span', { class: 'kbd' }, 'Enter'), ' slim nieuw element · ', h('span', { class: 'kbd' }, 'Shift+Enter'), ' gewone regel · ', h('span', { class: 'kbd' }, 'Ctrl+1–6'), ' elementtype'));
      }
    }
    function accept(sg) {
      const v = ta.value, pos = ta.selectionStart;
      const [s] = lineBounds(v, pos);
      ta.setSelectionRange(s, pos);
      insertText(ta, sg);
    }

    // --- elementconversies ---
    function toKind(kind) {
      replaceLine(ta, (line, v, s) => {
        let t = line.trim().replace(/^[.@!>]\s*/, '').replace(/\s*<$/, '');
        const needBlank = s > 0 && !blank(prevLine(v, s));
        const pre = needBlank && ['heading', 'character', 'transition', 'centered'].includes(kind) ? '\n' : '';
        switch (kind) {
          case 'heading': t = t.toUpperCase(); if (!SCENE_RE.test(t)) t = 'INT. ' + t; return pre + t;
          case 'action': return t.replace(/^\((.*)\)$/, '$1');
          case 'character': return pre + t.toUpperCase();
          case 'paren': return '(' + t.replace(/^\(|\)$/g, '') + ')';
          case 'transition': return pre + '> ' + (t.toUpperCase() || 'KNIPPEN NAAR:');
          case 'centered': return pre + '> ' + t + ' <';
        }
        return line;
      });
      if (kind === 'paren' && ta.value.slice(ta.selectionStart - 2, ta.selectionStart) === '()') ta.setSelectionRange(ta.selectionStart - 1, ta.selectionStart - 1);
    }
    function wrapSel(a, b) {
      const s = ta.selectionStart, e = ta.selectionEnd;
      const sel = ta.value.slice(s, e);
      insertText(ta, a + sel + b);
      if (!sel) ta.setSelectionRange(s + a.length, s + a.length);
    }

    // --- toetsenbord ---
    ta.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Escape' && focusMode) { e.preventDefault(); setFocus(false); return; }
      if (mod && /^[1-6]$/.test(e.key)) { e.preventDefault(); toKind(['heading', 'action', 'character', 'paren', 'transition', 'centered'][+e.key - 1]); return; }
      if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); wrapSel('**', '**'); return; }
      if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); wrapSel('*', '*'); return; }
      if (mod && e.key.toLowerCase() === 'u') { e.preventDefault(); wrapSel('_', '_'); return; }
      if (e.key === 'Tab' && !e.shiftKey && !mod) {
        e.preventDefault();
        if (suggestions.length) { accept(suggestions[0]); return; }
        const v = ta.value;
        const [s, en] = lineBounds(v, ta.selectionStart);
        const line = v.slice(s, en);
        const kind = lineKind(v, s);
        if (!line.trim()) {
          const pk = s > 0 ? lineKind(v, v.lastIndexOf('\n', s - 2) + 1) : 'leeg';
          if (['personage', 'dialoog', 'parenthetical'].includes(pk) && !blank(prevLine(v, s))) { insertText(ta, '()'); ta.setSelectionRange(ta.selectionStart - 1, ta.selectionStart - 1); }
          else insertText(ta, '');
          return;
        }
        if (kind === 'actie' || kind === 'personage') toKind(kind === 'personage' && line === line.toUpperCase() ? 'transition' : 'character');
        else if (kind === 'dialoog') toKind('paren');
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && !mod && ctx.settings.smartEnter !== false) {
        const v = ta.value, pos = ta.selectionStart;
        if (pos !== ta.selectionEnd) return;
        const [s, en] = lineBounds(v, pos);
        if (pos !== en) return;
        const line = v.slice(s, en);
        if (!line.trim()) return;
        const kind = lineKind(v, s);
        if (kind === 'scènekop') { e.preventDefault(); if (line !== line.toUpperCase()) { ta.setSelectionRange(s, en); insertText(ta, line.toUpperCase()); } insertText(ta, '\n\n'); }
        else if (kind === 'personage' || kind === 'parenthetical') { e.preventDefault(); if (kind === 'personage' && line !== line.toUpperCase()) { ta.setSelectionRange(s, en); insertText(ta, line.toUpperCase()); } insertText(ta, '\n'); }
        else if (['dialoog', 'actie', 'overgang', 'gecentreerd', 'synopsis', 'sectie'].includes(kind)) { e.preventDefault(); insertText(ta, '\n\n'); }
        return;
      }
      if (e.key === ')' && !mod && ta.selectionStart === ta.selectionEnd && ta.value[ta.selectionStart] === ')') {
        e.preventDefault(); ta.setSelectionRange(ta.selectionStart + 1, ta.selectionStart + 1); return;
      }
      if (e.key === '(' && !mod) {
        const v = ta.value, [s, en] = lineBounds(v, ta.selectionStart);
        if (!v.slice(s, en).trim() && !blank(prevLine(v, s)) && ['personage', 'dialoog'].includes(lineKind(v, v.lastIndexOf('\n', s - 2) + 1))) {
          e.preventDefault(); insertText(ta, '()'); ta.setSelectionRange(ta.selectionStart - 1, ta.selectionStart - 1);
        }
      }
    });

    const heavy = debounce(() => { renderNav(); renderPreview(); trackCaret(); }, 350);
    ta.addEventListener('input', () => {
      if (!S.log[today]) S.log[today] = { start: baseWords };
      S.text = ta.value;
      ctx.save();
      heavy();
      typewriter();
    });
    ta.addEventListener('keyup', (e) => { if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) { trackCaret(); if (e.key.startsWith('Arrow') || e.key.startsWith('Page')) typewriter(); } });
    ta.addEventListener('click', () => { trackCaret(); typewriter(); });
    const ro = new ResizeObserver(() => fitPreview());
    ro.observe(preview);

    renderNav(); renderPreview(); renderSuggest(); renderStatus();
    const jump = sessionStorage.getItem('fa.jump');
    setTimeout(() => {
      if (jump != null) { sessionStorage.removeItem('fa.jump'); gotoLine(ta, Number(jump)); }
      else { ta.focus({ preventScroll: true }); const pos = S.caret ?? 0; ta.setSelectionRange(pos, pos); ta.scrollTop = S.scroll || 0; }
      trackCaret();
    }, 30);

    // --- sprint ---
    function toggleSprint() {
      if (sprint) { clearInterval(sprint.timer); sprint = null; sprintBtn.querySelector('span:last-child').textContent = 'Sprint'; renderStatus(); return; }
      sprint = { end: Date.now() + 25 * 60e3, startWords: words(ta.value) };
      const tick = () => {
        const left = Math.max(0, sprint.end - Date.now());
        const lbl = sprintBtn.querySelector('span:last-child');
        if (lbl) lbl.textContent = `${Math.floor(left / 60e3)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
        if (!left) {
          const n = words(ta.value) - sprint.startWords;
          clearInterval(sprint.timer); sprint = null;
          if (lbl) lbl.textContent = 'Sprint';
          toast(`Sprint klaar! ${n} woorden geschreven.`);
          beep();
        }
      };
      sprint.timer = setInterval(tick, 1000); tick();
      ta.focus();
    }

    // --- dialogen ---
    function help() {
      const rows = [
        ['INT. KEUKEN - NACHT', 'Scènekop (begint met INT., EXT., INT./EXT. of een punt: .FLASHBACK)'],
        ['INT. KEUKEN - NACHT #12#', 'Scènekop met vast scènenummer'],
        ['Anna loopt naar het raam.', 'Actie (gewone tekst)'],
        ['ANNA', 'Personage (hoofdletters, lege regel erboven, tekst eronder)'],
        ['ANNA (V.O.)  /  ANNA (O.S.)', 'Voice-over / buiten beeld'],
        ['(fluisterend)', 'Parenthetical, onder de personagenaam'],
        ['BRAM ^', 'Dubbele dialoog (naast de vorige)'],
        ['> KNIPPEN NAAR:', 'Overgang (of hoofdletters eindigend op TO:/NAAR:)'],
        ['> EINDE <', 'Gecentreerde tekst'],
        ['!ALARM GAAT AF.', 'Geforceerde actie (in hoofdletters zonder personage te worden)'],
        ['@McCLANE', 'Geforceerd personage (met kleine letters)'],
        ['# AKTE 1', 'Sectie (niet afgedrukt, wel in navigatie)'],
        ['= Anna besluit te vertrekken.', 'Synopsis van de scène (niet afgedrukt; zichtbaar op kaarten)'],
        ['[[navragen bij regisseur]]', 'Notitie (niet afgedrukt)'],
        ['/* … */', 'Uitgecommentarieerde tekst (boneyard)'],
        ['===', 'Pagina-einde'],
        ['*cursief*  **vet**  _onderstreept_', 'Opmaak'],
        ['Title: / Author: / Draft date: / Contact:', 'Titelpagina (bovenaan het document)'],
      ];
      modal({ title: 'Fountain-spiekbriefje', wide: true, body: h('table', { class: 'tbl' }, h('tbody', {}, rows.map(([a, b]) => h('tr', {}, h('td', { class: 'mono', style: { whiteSpace: 'pre' } }, a), h('td', {}, b))))) });
    }

    function snapshot(label) {
      S.snapshots.unshift({ id: uid(), date: new Date().toISOString(), label: label || 'Versie', text: S.text, words: words(S.text) });
      if (S.snapshots.length > 60) S.snapshots.length = 60;
      ctx.save();
    }

    function versions() {
      modal({
        title: 'Versies van het scenario', wide: true,
        body: (close) => h('div', { class: 'stack' },
          h('div', { class: 'row wrap' },
            btn('Huidige versie bewaren', async () => { const l = await promptDlg('Versie bewaren', `Draft ${S.snapshots.length + 1}`, 'Naam (bijv. “Tweede draft – na leesronde”)'); if (l != null) { snapshot(l); close(); versions(); toast('Versie bewaard'); } }, { icon: 'plus', class: 'primary' }),
            btn(ctx.parsed().scenes.some((s) => !s.forcedNum) ? 'Scènenummers vastzetten' : 'Scènenummers losmaken', async () => {
              const locking = ctx.parsed().scenes.some((s) => !s.forcedNum);
              if (!(await confirmDlg(locking ? 'Alle scènes krijgen een vast nummer (#12#) in de tekst. Gebruikelijk vóór pre-productie: nieuwe scènes krijgen dan nummers als 12A. Breakdown, shots en planning blijven gekoppeld.' : 'Vaste scènenummers verwijderen? Scènes worden dan weer automatisch doorgenummerd.', locking ? 'Vastzetten' : 'Losmaken'))) return;
              snapshot(locking ? 'Vóór vastzetten scènenummers' : 'Vóór losmaken scènenummers');
              if (locking) { const n = lockSceneNumbers(p); toast(`${n} scènenummers vastgezet`); } else { unlockSceneNumbers(p); toast('Scènenummers losgemaakt'); }
              ctx.save(); close(); ctx.rerender();
            }, { icon: 'tag' })),
          S.snapshots.length ? h('table', { class: 'tbl' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Naam'), h('th', {}, 'Datum'), h('th', { class: 'num' }, 'Woorden'), h('th', { class: 'num' }, 'Verschil'), h('th', {}))),
            h('tbody', {}, S.snapshots.map((sn) => {
              const d = words(S.text) - (sn.words ?? words(sn.text));
              return h('tr', {},
                h('td', {}, sn.label), h('td', { class: 'nowrap' }, new Date(sn.date).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })),
                h('td', { class: 'num' }, (sn.words ?? words(sn.text)).toLocaleString('nl-NL')), h('td', { class: 'num muted' }, (d > 0 ? '+' : '') + d),
                h('td', { class: 'right nowrap' },
                  btn('Herstellen', async () => {
                    if (!(await confirmDlg(`Teruggaan naar “${sn.label}”? De huidige tekst wordt eerst als versie bewaard.`, 'Herstellen'))) return;
                    snapshot('Automatisch vóór herstel'); S.text = sn.text; ctx.save(); close(); ctx.rerender(); toast('Versie hersteld');
                  }, { class: 'sm' }),
                  iconBtn('download', 'Download .fountain', () => download(`${slug(p.meta.title)}-${slug(sn.label)}.fountain`, sn.text)),
                  iconBtn('trash', 'Verwijderen', async () => { if (await confirmDlg('Deze versie verwijderen?', 'Verwijderen', true)) { S.snapshots.splice(S.snapshots.indexOf(sn), 1); ctx.save(); close(); versions(); } }, 'danger')));
            }))) : h('p', { class: 'muted' }, 'Nog geen bewaarde versies. Bewaar een versie bij elke draft of vóór grote wijzigingen.')),
      });
    }

    function findReplace() {
      const f = h('input', { placeholder: 'Zoek…' }), r = h('input', { placeholder: 'Vervang door…' });
      const cs = h('input', { type: 'checkbox' }), ww = h('input', { type: 'checkbox' });
      const info = h('p', { class: 'muted small' }, ' ');
      const mkRe = () => {
        if (!f.value) return null;
        const src = f.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(ww.checked ? `(?<![\\p{L}\\p{N}])${src}(?![\\p{L}\\p{N}])` : src, 'gu' + (cs.checked ? '' : 'i'));
      };
      const count = () => { const re = mkRe(); info.textContent = re ? `${(ta.value.match(re) || []).length} gevonden` : ' '; };
      [f, cs, ww].forEach((x) => x.addEventListener('input', count));
      modal({
        title: 'Zoeken & vervangen',
        body: h('div', { class: 'stack' }, field('Zoeken', f), field('Vervangen', r),
          h('div', { class: 'row' }, h('label', { class: 'check' }, cs, 'Hoofdlettergevoelig'), h('label', { class: 'check' }, ww, 'Hele woorden')),
          info, h('p', { class: 'muted small' }, 'Tip: personage hernoemen? Zoek “HENK”, vervang door “HANS”, met hoofdlettergevoelig + hele woorden aan.')),
        actions: [
          { label: 'Volgende zoeken', onClick: () => { const re = mkRe(); if (!re) return false; re.lastIndex = 0; const all = [...ta.value.matchAll(re)]; const nx = all.find((m) => m.index >= ta.selectionEnd) || all[0]; if (nx) { ta.setSelectionRange(nx.index, nx.index + nx[0].length); ta.scrollTop = caretTop(ta, nx.index) - 80; } return false; } },
          { label: 'Alles vervangen', primary: true, onClick: () => {
            const re = mkRe(); if (!re) return false;
            const n = (ta.value.match(re) || []).length;
            if (!n) { toast('Niets gevonden'); return false; }
            snapshot(`Vóór vervangen “${f.value}”`);
            ta.select(); insertText(ta, ta.value.replace(re, r.value));
            toast(`${n}× vervangen`);
          } },
        ],
      });
    }

    async function importScript() {
      const [file] = await pickFile('.fountain,.spmd,.txt,.fdx,.md');
      if (!file) return;
      let text = await readText(file);
      if (/\.fdx$/i.test(file.name) || text.trimStart().startsWith('<?xml')) text = fromFDX(text);
      if (S.text.trim() && !(await confirmDlg(`Het huidige scenario vervangen door “${file.name}”? De huidige tekst wordt eerst als versie bewaard.`, 'Vervangen'))) return;
      if (S.text.trim()) snapshot('Vóór import ' + file.name);
      S.text = text.replace(/\r\n?/g, '\n');
      ctx.save(); ctx.rerender();
      toast(`Geïmporteerd: ${ctx.parsed().scenes.length} scènes, ${ctx.parsed().pages} pagina’s`);
    }

    function exportMenu() {
      const name = slug(p.meta.title);
      modal({
        title: 'Exporteren',
        body: (close) => h('div', { class: 'stack' },
          btn('Fountain (.fountain) — uitwisselbaar met Highland, WriterDuet, Slugline, Fade In', () => { download(`${name}.fountain`, S.text); close(); }, { icon: 'download' }),
          btn('Final Draft (.fdx)', () => { download(`${name}.fdx`, toFDX(ctx.parsed()), 'application/xml'); close(); }, { icon: 'download' }),
          btn('Platte tekst (.txt)', () => { download(`${name}.txt`, S.text.replace(/\[\[[\s\S]*?\]\]/g, '')); close(); }, { icon: 'download' }),
          btn('Dialoog per personage (sides, .txt)', () => { download(`${name}-dialoog.txt`, dialogueByCharacter(ctx.parsed())); close(); }, { icon: 'users' }),
          btn('PDF / afdrukken…', () => { close(); printScript(); }, { icon: 'print', class: 'primary' })),
      });
    }

    function printScript() {
      const nums = h('input', { type: 'checkbox', checked: true });
      const tp = h('input', { type: 'checkbox', checked: true });
      const notes = h('input', { type: 'checkbox' });
      modal({
        title: 'Scenario afdrukken / PDF',
        body: h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'Kies in het afdrukvenster “Opslaan als PDF” voor een PDF in standaardopmaak (Courier 12pt).'),
          h('label', { class: 'check' }, tp, 'Titelpagina'), h('label', { class: 'check' }, nums, 'Scènenummers'), h('label', { class: 'check' }, notes, 'Secties en synopsisregels tonen')),
        actions: [{ label: 'Annuleren' }, { label: 'Afdrukken', primary: true, onClick: () => {
          printDoc(p.meta.title, toHTML(ctx.parsed(), { sceneNumbers: nums.checked, titlePage: tp.checked, notesAndSections: notes.checked }), SCRIPT_CSS + '@page{margin:0}.sp-page{padding:1in 1in .8in 1.5in;width:8.5in;min-height:auto}');
        } }],
      });
    }

    return () => {
      S.caret = ta.selectionStart; S.scroll = ta.scrollTop;
      ro.disconnect();
      document.removeEventListener('fullscreenchange', onFs);
      document.body.classList.remove('writing-focus');
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      heavy.flush?.();
    };
  },
};

function beep() {
  try {
    const ac = new AudioContext();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 880; g.gain.setValueAtTime(0.15, ac.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.2);
      o.connect(g).connect(ac.destination); o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.2);
    });
  } catch { /* geen audio beschikbaar */ }
}

export function dialogueByCharacter(parsed) {
  const out = {};
  let who = null;
  parsed.tokens.forEach((t) => {
    if (t.type === 'character') who = t.name;
    else if ((t.type === 'dialogue' || t.type === 'parenthetical') && who) {
      const sc = parsed.scenes[t.scene];
      (out[who] ??= []).push(`[${sc ? sc.num + ' ' + sc.heading : '—'}] ${t.type === 'parenthetical' ? t.text : t.text.replace(/\n/g, ' ')}`);
    } else who = null;
  });
  return Object.entries(out).map(([n, l]) => `=== ${n} (${l.length}) ===\n${l.join('\n')}\n`).join('\n');
}
