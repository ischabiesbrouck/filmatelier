import { h, btn, iconBtn, icon, pageHead, uid, toast, confirmDlg, promptDlg, modal, field, download, pickFile, readText, slug, printDoc, debounce, words, fmtDate, esc, todayISO } from '../util.js';
import { htmlToDocx, docxToHtml } from '../docx.js';

// Tekstverwerker: losse documenten (notities, brieven, aanvragen…) met Word-achtige opmaak en .docx-export/-import.

let activeId = null;
let zoom = 1;
let focus = false;
let filter = '';

/* ---------- Opschonen van HTML (plakken, importeren) ---------- */
const ALLOWED = { P: [], BR: [], B: [], STRONG: [], I: [], EM: [], U: [], S: [], STRIKE: [], DEL: [], SUB: [], SUP: [], H1: [], H2: [], H3: [], UL: [], OL: [], LI: [], BLOCKQUOTE: [], A: ['href'], TABLE: [], THEAD: [], TBODY: [], TR: [], TD: ['colspan', 'rowspan'], TH: ['colspan', 'rowspan'], HR: ['class'], SPAN: [], MARK: [] };
const RENAME = { DIV: 'P', H4: 'H3', H5: 'H3', H6: 'H3', FONT: 'SPAN', CODE: 'SPAN', PRE: 'P', SECTION: 'P', ARTICLE: 'P', HEADER: 'P', FOOTER: 'P', ADDRESS: 'P' };
const DROP = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'SVG', 'IMG', 'PICTURE', 'VIDEO', 'AUDIO', 'CANVAS', 'INPUT', 'BUTTON', 'FORM', 'SELECT', 'TEXTAREA', 'TEMPLATE', 'XML', 'HEAD']);
const STYLE_OK = ['text-align', 'color', 'background-color', 'font-weight', 'font-style', 'text-decoration'];

export function sanitizeHtml(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const clean = (node) => {
    for (const c of [...node.childNodes]) {
      if (c.nodeType === 8) { c.remove(); continue; }
      if (c.nodeType !== 1) continue;
      if (DROP.has(c.tagName) || c.tagName.includes(':')) { c.remove(); continue; }
      clean(c);
      const tag = RENAME[c.tagName] || c.tagName;
      if (!ALLOWED[tag]) { c.replaceWith(...c.childNodes); continue; }
      let el = c;
      if (tag !== c.tagName) { el = document.createElement(tag); for (const a of c.attributes) el.setAttribute(a.name, a.value); el.append(...c.childNodes); c.replaceWith(el); }
      for (const a of [...el.attributes]) if (!ALLOWED[tag].includes(a.name) && a.name !== 'style') el.removeAttribute(a.name);
      if (tag === 'A') {
        if (!/^(https?:|mailto:)/i.test(el.getAttribute('href') || '')) el.removeAttribute('href');
        else { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener'); }
      }
      if (tag === 'HR' && el.getAttribute('class') !== 'page-break') el.removeAttribute('class');
      if (el.hasAttribute('style')) {
        const keep = STYLE_OK.map((p) => [p, el.style.getPropertyValue(p)]).filter(([, v]) => v && !/expression|url\(|javascript:/i.test(v));
        el.removeAttribute('style');
        keep.forEach(([p, v]) => el.style.setProperty(p, v));
        if (!el.getAttribute('style')) el.removeAttribute('style');
      }
    }
  };
  clean(tpl.content);
  return tpl.innerHTML;
}

const textToHtml = (t) => String(t).replace(/\r\n?/g, '\n').split(/\n{2,}/).map((para) => `<p>${esc(para).replace(/\n/g, '<br>') || '<br>'}</p>`).join('');

/* ---------- Sjablonen ---------- */
function templates(p) {
  const today = fmtDate(todayISO(), { day: 'numeric', month: 'long', year: 'numeric' });
  const me = esc(p.meta.author || '[Je naam]');
  const t = esc(p.meta.title);
  return [
    ['Leeg document', '', '<p><br></p>'],
    ['Brief', 'Brief', `<p style="text-align:right">[Plaats], ${today}</p><p>[Naam ontvanger]<br>[Adres]<br>[Postcode en plaats]</p><p><b>Betreft:</b> [onderwerp]</p><p>Beste [naam],</p><p>[Tekst]</p><p>Met vriendelijke groet,</p><p>${me}</p>`],
    ['Notulen', 'Notulen', `<h1>Notulen — [onderwerp]</h1><p><b>Datum:</b> ${today}<br><b>Aanwezig:</b> <br><b>Afwezig:</b> <br><b>Notulist:</b> ${me}</p><h2>Agenda</h2><ol><li>Opening</li><li>[Agendapunt]</li><li>Rondvraag en sluiting</li></ol><h2>Besluiten</h2><ul><li><br></li></ul><h2>Actiepunten</h2><table><tbody><tr><th>Wat</th><th>Wie</th><th>Wanneer</th></tr><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table>`],
    ['Persbericht', 'Persbericht', `<p><b>PERSBERICHT</b></p><h1>[Kop van het persbericht over “${t}”]</h1><p><b>[Plaats], ${today}</b> — [Openingsalinea: wie, wat, waar, wanneer, waarom.]</p><p>[Citaat van regisseur of producent.]</p><p>[Achtergrond over de film: ${esc(p.meta.logline || 'logline')}]</p><p style="text-align:center">###</p><h3>Noot voor de redactie</h3><p>Voor meer informatie, stills of interviews: ${me}, [telefoon], [e-mail].</p>`],
    ['Regienotities', 'Regienotities', `<h1>Regienotities — ${t}</h1><h2>Toon en stijl</h2><p><br></p><h2>Acteurs</h2><p><br></p><h2>Camera en licht</h2><p><br></p><h2>Geluid en muziek</h2><p><br></p><h2>Montage</h2><p><br></p>`],
    ['Projectplan / fondsaanvraag', 'Projectplan', `<h1>${t}</h1><p><i>${esc(p.meta.tagline || '')}</i></p><p><b>Genre:</b> ${esc(p.meta.genre || '')} · <b>Duur:</b> ${esc(String(p.meta.runtime || ''))} min · <b>Fase:</b> ${esc(p.meta.status || '')}</p><h2>Logline</h2><p>${esc(p.meta.logline || '')}</p><h2>Synopsis</h2>${textToHtml(p.treatment.synopsis || '')}<h2>Regievisie</h2>${textToHtml(p.treatment.statement || '')}<h2>Doelgroep en verspreiding</h2><p>${esc(p.meta.audience || '')}</p><h2>Team</h2><p><br></p><h2>Planning</h2><p><br></p><h2>Begroting en financiering</h2><p><br></p>`],
  ];
}

export default {
  id: 'tekst', title: 'Tekstverwerker', icon: 'type', group: 'Schrijven',
  badge: (ctx) => ctx.project.writer?.docs?.length || null,
  render(root, ctx) {
    const p = ctx.project;
    const W = p.writer ??= { docs: [] };
    W.docs ??= [];
    const want = sessionStorage.getItem('fa.seldoc');
    if (want) { sessionStorage.removeItem('fa.seldoc'); activeId = want; }
    if (!W.docs.find((d) => d.id === activeId)) activeId = [...W.docs].sort((a, b) => b.updated.localeCompare(a.updated))[0]?.id || null;

    const newDoc = (html = '<p><br></p>', title = 'Naamloos document') => {
      const d = { id: uid(), title, html, created: new Date().toISOString(), updated: new Date().toISOString() };
      W.docs.push(d); activeId = d.id; ctx.save(); ctx.rerender();
      setTimeout(() => root.querySelector('.wr-page')?.focus(), 50);
    };
    const chooseTemplate = () => modal({
      title: 'Nieuw document',
      body: (close) => h('div', { class: 'wr-templates' }, templates(p).map(([label, title, html]) => h('button', { type: 'button', class: 'wr-tpl', onclick: () => { close(); newDoc(html, title || 'Naamloos document'); } },
        h('span', { class: 'go' }, icon(label === 'Leeg document' ? 'plus' : 'type', 16)), h('b', {}, label)))),
    });
    const importDoc = async () => {
      const [f] = await pickFile('.docx,.txt,.md,.html,.htm');
      if (!f) return;
      try {
        let html;
        if (/\.docx$/i.test(f.name)) html = await docxToHtml(await f.arrayBuffer());
        else if (/\.html?$/i.test(f.name)) html = await readText(f);
        else html = textToHtml(await readText(f));
        newDoc(sanitizeHtml(html) || '<p><br></p>', f.name.replace(/\.[^.]+$/, ''));
        toast(`“${f.name}” geïmporteerd`);
      } catch (e) { toast('Importeren mislukt: ' + e.message, 'err'); }
    };

    root.append(pageHead('Tekstverwerker', 'Typ vrij: notities, brieven, aanvragen, regienotities. Met opmaak zoals in Word, en export naar .docx en PDF.',
      btn('Nieuw document', chooseTemplate, { icon: 'plus', class: 'primary' }),
      btn('Importeren', importDoc, { icon: 'upload', class: 'ghost' })));

    // --- lijst ---
    const search = h('input', { type: 'search', placeholder: 'Zoek in documenten…', value: filter, 'aria-label': 'Zoek in documenten' });
    const listEl = h('div', { class: 'stack tight' });
    const drawList = () => {
      const n = filter.toLowerCase();
      const docs = [...W.docs].sort((a, b) => b.updated.localeCompare(a.updated)).filter((d) => !n || d.title.toLowerCase().includes(n) || d.html.replace(/<[^>]+>/g, ' ').toLowerCase().includes(n));
      listEl.replaceChildren(...(docs.length ? docs.map((d) => h('div', { class: 'list-item' + (d.id === activeId ? ' active' : ''), onclick: () => { if (d.id !== activeId) { activeId = d.id; ctx.rerender(); } } },
        h('div', { class: 'avatar', style: { borderRadius: '12px' } }, icon('type', 16)),
        h('div', { style: { minWidth: 0, flex: 1 } }, h('div', { style: { fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, d.title || 'Naamloos'),
          h('small', { class: 'muted' }, `${fmtDate(d.updated.slice(0, 10), { day: 'numeric', month: 'short' })} · ${words(d.html.replace(/<[^>]+>/g, ' '))} woorden`)))) : [h('p', { class: 'muted small' }, W.docs.length ? 'Niets gevonden.' : 'Nog geen documenten.')]));
    };
    search.addEventListener('input', () => { filter = search.value; drawList(); });
    drawList();
    const side = h('div', { class: 'card stack tight' }, search, listEl);

    const doc = W.docs.find((d) => d.id === activeId);
    if (!doc) {
      root.append(h('div', { class: 'master' }, side, h('div', { class: 'empty' }, h('p', {}, 'Begin met een leeg document of kies een sjabloon (brief, notulen, persbericht, regienotities, projectplan).'),
        h('div', { class: 'row', style: { justifyContent: 'center' } }, btn('Nieuw document', chooseTemplate, { icon: 'plus', class: 'primary' }), btn('Word-bestand importeren', importDoc, { icon: 'upload' })))));
      return;
    }

    // --- editor ---
    document.execCommand('defaultParagraphSeparator', false, 'p');
    const page = h('div', { class: 'wr-page', contenteditable: 'true', spellcheck: 'true', lang: 'nl', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Documenttekst' });
    page.innerHTML = doc.html || '<p><br></p>';
    page.style.zoom = zoom;
    const titleIn = h('input', { class: 'wr-title', value: doc.title, placeholder: 'Titel van het document', 'aria-label': 'Titel' });
    const stats = h('div', { class: 'wr-stats' });
    let saved = null;

    const persist = debounce(() => {
      doc.html = page.innerHTML; doc.updated = new Date().toISOString();
      ctx.save(); drawList(); drawStats();
    }, 400);
    const drawStats = () => {
      const t = page.innerText || '';
      const w = words(t);
      stats.replaceChildren(h('span', {}, h('b', {}, w.toLocaleString('nl-NL')), ' woorden'), h('span', {}, h('b', {}, t.replace(/\s/g, '').length.toLocaleString('nl-NL')), ' tekens'),
        h('span', {}, '≈ ', h('b', {}, Math.max(1, Math.ceil(w / 450))), ' A4'), h('span', {}, h('b', {}, Math.max(1, Math.round(w / 230))), ' min lezen'),
        h('span', { class: 'faint' }, 'Ctrl+klik opent een link'));
    };
    titleIn.addEventListener('input', () => { doc.title = titleIn.value; persist(); });

    // Selectie bewaren zodat knoppen en kleurkiezers op de juiste tekst werken
    const onSel = () => { const s = getSelection(); if (s.rangeCount && page.contains(s.anchorNode)) { saved = s.getRangeAt(0).cloneRange(); updateState(); } };
    document.addEventListener('selectionchange', onSel);
    const restore = () => { page.focus({ preventScroll: true }); if (saved) { const s = getSelection(); s.removeAllRanges(); s.addRange(saved); } };
    const exec = (cmd, val = null) => { restore(); document.execCommand('styleWithCSS', false, ['foreColor', 'hiliteColor'].includes(cmd)); document.execCommand(cmd, false, val); persist(); updateState(); };

    const b = (ico, title, run, state) => {
      const el = h('button', { type: 'button', class: 'wr-btn', title, 'aria-label': title, onmousedown: (e) => e.preventDefault(), onclick: run }, typeof ico === 'string' && ico.length > 2 ? icon(ico, 16) : h('span', { class: 'wr-glyph' }, ico));
      if (state) el.dataset.state = state;
      return el;
    };
    const sep = () => h('span', { class: 'wr-sep' });
    const styleSel = h('select', { class: 'wr-style', 'aria-label': 'Alineastijl', onchange: (e) => exec('formatBlock', `<${e.target.value}>`) },
      [['p', 'Normaal'], ['h1', 'Kop 1'], ['h2', 'Kop 2'], ['h3', 'Kop 3'], ['blockquote', 'Citaat']].map(([v, l]) => h('option', { value: v }, l)));
    const colorIn = h('input', { type: 'color', value: '#c2410c', title: 'Tekstkleur', 'aria-label': 'Tekstkleur', oninput: (e) => exec('foreColor', e.target.value) });
    const markIn = h('input', { type: 'color', value: '#fff59d', title: 'Markeerkleur', 'aria-label': 'Markeerkleur', oninput: (e) => exec('hiliteColor', e.target.value) });

    const insertTable = () => {
      const r = h('input', { type: 'number', min: 1, max: 30, value: 3 }), c = h('input', { type: 'number', min: 1, max: 10, value: 3 });
      const head = h('input', { type: 'checkbox', checked: true });
      modal({ title: 'Tabel invoegen', body: h('div', { class: 'stack' }, h('div', { class: 'grid g2' }, field('Rijen', r), field('Kolommen', c)), h('label', { class: 'check' }, head, 'Eerste rij als kop')),
        actions: [{ label: 'Annuleren' }, { label: 'Invoegen', primary: true, onClick: () => {
          const rows = Math.max(1, Math.min(30, +r.value || 3)), cols = Math.max(1, Math.min(10, +c.value || 3));
          const cell = (i) => (i === 0 && head.checked ? '<th><br></th>' : '<td><br></td>');
          exec('insertHTML', `<table><tbody>${Array.from({ length: rows }, (_, i) => `<tr>${Array.from({ length: cols }, () => cell(i)).join('')}</tr>`).join('')}</tbody></table><p><br></p>`);
        } }] });
    };
    const insertLink = async () => {
      const sel = saved?.toString() || '';
      const url = await promptDlg('Link invoegen', 'https://', 'Webadres (https://… of mailto:…)');
      if (!url || !/^(https?:\/\/|mailto:)/i.test(url)) { if (url) toast('Alleen https://, http:// of mailto: links', 'err'); return; }
      if (sel) exec('createLink', url); else exec('insertHTML', `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>&nbsp;`);
    };

    const exportMenu = () => modal({
      title: 'Exporteren',
      body: (close) => h('div', { class: 'stack' },
        btn('Word-document (.docx)', () => { flushNow(); download(`${slug(doc.title)}.docx`, htmlToDocx(page, doc.title)); close(); toast('Word-bestand gedownload'); }, { icon: 'download', class: 'primary' }),
        btn('PDF / afdrukken', () => { close(); printNow(); }, { icon: 'print' }),
        btn('Webpagina (.html)', () => { download(`${slug(doc.title)}.html`, `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>${esc(doc.title)}</title><style>${DOC_CSS}</style></head><body>${page.innerHTML}</body></html>`, 'text/html'); close(); }, { icon: 'download' }),
        btn('Platte tekst (.txt)', () => { download(`${slug(doc.title)}.txt`, page.innerText); close(); }, { icon: 'download' })),
    });
    const printNow = () => printDoc(doc.title, page.innerHTML, DOC_CSS + '@page{size:A4;margin:25mm}hr.page-break{break-after:page;border:0;margin:0}');
    const flushNow = () => persist.flush();

    const tools = h('div', { class: 'wr-tools', role: 'toolbar', 'aria-label': 'Opmaak' },
      b('undo', 'Ongedaan maken (Ctrl+Z)', () => exec('undo')), b('redo', 'Opnieuw (Ctrl+Y)', () => exec('redo')), sep(),
      styleSel, sep(),
      b('B', 'Vet (Ctrl+B)', () => exec('bold'), 'bold'), b('I', 'Cursief (Ctrl+I)', () => exec('italic'), 'italic'), b('U', 'Onderstrepen (Ctrl+U)', () => exec('underline'), 'underline'), b('S', 'Doorhalen', () => exec('strikeThrough'), 'strikeThrough'),
      h('label', { class: 'wr-color', title: 'Tekstkleur' }, h('span', { class: 'wr-glyph', style: { borderBottom: '3px solid #c2410c' } }, 'A'), colorIn),
      h('label', { class: 'wr-color', title: 'Markeren' }, h('span', { class: 'wr-glyph', style: { background: '#fff59d', color: '#111', padding: '0 3px', borderRadius: '3px' } }, 'ab'), markIn), sep(),
      b('list', 'Opsomming', () => exec('insertUnorderedList'), 'insertUnorderedList'), b('listOl', 'Nummering', () => exec('insertOrderedList'), 'insertOrderedList'),
      b('outdent', 'Inspringing verkleinen', () => exec('outdent')), b('indent', 'Inspringing vergroten', () => exec('indent')), sep(),
      b('alignLeft', 'Links uitlijnen', () => exec('justifyLeft'), 'justifyLeft'), b('alignCenter', 'Centreren', () => exec('justifyCenter'), 'justifyCenter'), b('alignRight', 'Rechts uitlijnen', () => exec('justifyRight'), 'justifyRight'), b('alignJustify', 'Uitvullen', () => exec('justifyFull'), 'justifyFull'), sep(),
      b('link', 'Link invoegen', insertLink), b('grid', 'Tabel invoegen', insertTable), b('minus', 'Horizontale lijn', () => exec('insertHorizontalRule')),
      b('pageBreak', 'Pagina-einde', () => exec('insertHTML', '<hr class="page-break"><p><br></p>')), b('calendar', 'Datum invoegen', () => exec('insertText', fmtDate(todayISO(), { day: 'numeric', month: 'long', year: 'numeric' }))),
      b('eraser', 'Opmaak wissen', () => { exec('removeFormat'); exec('formatBlock', '<p>'); }));

    const zoomSel = h('select', { class: 'wr-zoom', 'aria-label': 'Zoom', onchange: (e) => { zoom = +e.target.value; page.style.zoom = zoom; } }, [0.75, 0.9, 1, 1.15, 1.3, 1.5].map((z) => h('option', { value: z, selected: z === zoom }, `${Math.round(z * 100)}%`)));
    const wrap = h('div', { class: 'wr-wrap' + (focus ? ' wr-focus' : '') });
    const setFocus = (on) => { focus = on; wrap.classList.toggle('wr-focus', on); document.body.classList.toggle('writing-focus', on); page.focus(); };

    const head = h('div', { class: 'wr-head' }, titleIn, h('div', { class: 'spacer' }), zoomSel,
      iconBtn('sparkles', 'AI over selectie of document', () => ctx.openAI({ prompt: 'Verbeter deze tekst: helderder, beter lopend, zelfde toon. Leg kort uit wat je veranderd hebt.', selection: (saved?.toString() || page.innerText).slice(0, 20000) })),
      iconBtn('expand', 'Schermvullend schrijven (Esc = terug)', () => setFocus(!focus)),
      iconBtn('copy', 'Dupliceren', () => { flushNow(); newDoc(doc.html, doc.title + ' (kopie)'); }),
      iconBtn('trash', 'Verwijderen', async () => { if (await confirmDlg(`“${doc.title}” verwijderen?`, 'Verwijderen', true)) { W.docs.splice(W.docs.indexOf(doc), 1); activeId = null; ctx.save(); ctx.rerender(); } }, 'danger'),
      btn('Exporteren', exportMenu, { icon: 'download', class: 'sm primary' }));

    wrap.append(head, tools, h('div', { class: 'wr-desk' }, page), stats);
    root.append(h('div', { class: 'master wr-master' }, side, wrap));

    function updateState() {
      tools.querySelectorAll('[data-state]').forEach((el) => { let on = false; try { on = document.queryCommandState(el.dataset.state); } catch { /* niet ondersteund */ } el.classList.toggle('on', on); });
      try { const v = String(document.queryCommandValue('formatBlock') || 'p').toLowerCase().replace(/[<>]/g, ''); styleSel.value = ['h1', 'h2', 'h3', 'blockquote'].includes(v) ? v : 'p'; } catch { /* niet ondersteund */ }
    }

    page.addEventListener('input', () => { if (!page.textContent.trim() && !page.querySelector('table,hr')) { /* leeg: één lege alinea houden */ if (!page.firstElementChild) page.innerHTML = '<p><br></p>'; } persist(); });
    page.addEventListener('paste', (e) => {
      const html = e.clipboardData?.getData('text/html');
      const text = e.clipboardData?.getData('text/plain');
      if (!html && !text) return;
      e.preventDefault();
      if (html) document.execCommand('insertHTML', false, sanitizeHtml(html));
      else document.execCommand('insertText', false, text);
      persist();
    });
    page.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a && (e.ctrlKey || e.metaKey) && /^(https?:|mailto:)/i.test(a.getAttribute('href') || '')) window.open(a.href, '_blank', 'noopener'); });
    page.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && focus) { e.preventDefault(); setFocus(false); }
      if (e.key === 'Tab' && !e.ctrlKey) { e.preventDefault(); exec(e.shiftKey ? 'outdent' : (document.queryCommandState('insertUnorderedList') || document.queryCommandState('insertOrderedList')) ? 'indent' : 'insertText', e.shiftKey ? null : ' '); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); printNow(); }
    });
    drawStats();
    if (focus) document.body.classList.add('writing-focus');
    setTimeout(() => { page.focus({ preventScroll: true }); const r = document.createRange(); r.selectNodeContents(page); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }, 30);

    return () => { persist.flush(); document.removeEventListener('selectionchange', onSel); document.body.classList.remove('writing-focus'); };
  },
};

export const DOC_CSS = `body{font:11pt/1.55 Calibri,"Segoe UI",Arial,sans-serif;color:#111}h1{font-size:18pt;margin:0 0 10pt}h2{font-size:14pt;margin:16pt 0 6pt}h3{font-size:12pt;margin:12pt 0 4pt}
p{margin:0 0 8pt}blockquote{margin:8pt 24pt;font-style:italic;color:#555}table{border-collapse:collapse;width:100%;margin:6pt 0 10pt}td,th{border:1px solid #999;padding:4pt 6pt;vertical-align:top}th{background:#f2f2f2;text-align:left}
hr{border:0;border-top:1px solid #999;margin:10pt 0}a{color:#0563c1}ul,ol{margin:0 0 8pt;padding-left:22pt}`;
