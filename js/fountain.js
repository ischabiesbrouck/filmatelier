// Fountain-parser, paginering (schatting op industrienorm) en export naar HTML/FDX.
// Fountain-syntaxis: https://fountain.io/syntax

import { esc } from './util.js';

const SCENE_RE = /^(?:\.(?![.\s])|(?:INT\.?\/EXT|EXT\.?\/INT|INT|EXT|EST|I\/E|E\/I)[.\s])/i;
const TITLE_KEY = /^(title|titel|credit|author|authors|auteur|source|bron|draft date|datum|date|contact|copyright|notes|revision|versie)\s*:/i;
const TRANS_RE = /^(?:[^a-z]*\s(TO|NAAR):|FADE (IN|OUT)[:.]|FADE TO BLACK\.|CUT TO BLACK\.|ZWART\.|AFTITELING\.)$/;
const PAGE_LINES = 54;
const WIDTH = { action: 60, scene_heading: 60, character: 38, dialogue: 35, parenthetical: 26, transition: 60, centered: 60, lyrics: 35 };

const isBlank = (l) => l == null || l.trim() === '';

export const cueName = (s) => s.replace(/\^\s*$/, '').replace(/\s*\(.*?\)\s*/g, ' ').trim().toUpperCase();

export { SCENE_RE };

export function isCue(t) {
  const base = t.replace(/\^\s*$/, '').replace(/\(.*?\)/g, '').trim();
  return base.length > 0 && base.length < 40 && /\p{L}/u.test(base) && base === base.toUpperCase() && !/[!?:;,]$/.test(base);
}

export function headingInfo(text) {
  const m = text.match(/^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|E\/I\.?|INT\.?|EXT\.?|EST\.?)\s*(.*)$/i);
  let ie = '', rest = text;
  if (m) {
    const p = m[1].toUpperCase().replace(/\./g, '');
    ie = p === 'INT' ? 'INT' : p === 'EXT' || p === 'EST' ? 'EXT' : 'INT/EXT';
    rest = m[2];
  }
  const parts = rest.split(/\s+[-–—]\s+/);
  const tod = parts.length > 1 ? parts.pop().trim().toUpperCase() : '';
  const location = parts.join(' - ').trim().toUpperCase();
  const night = /NACHT|NIGHT|AVOND|EVENING|SCHEMER|DUSK|SCHEMERING/.test(tod);
  return { ie, location, tod, dn: night ? 'N' : 'D', norm: text.toUpperCase().replace(/\s+/g, ' ').trim() };
}

export function parse(src) {
  const text = String(src || '').replace(/\r\n?/g, '\n').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
  const lines = text.split('\n');
  const title = {};
  let i = 0;
  if (lines.length && TITLE_KEY.test(lines[0])) {
    let key = null;
    for (; i < lines.length; i++) {
      const l = lines[i];
      if (l.trim() === '') { i++; break; }
      const m = l.match(/^([^:]+):\s*(.*)$/);
      if (m && !/^\s/.test(l)) { key = m[1].trim().toLowerCase(); title[key] = m[2].trim(); }
      else if (key) title[key] = (title[key] ? title[key] + '\n' : '') + l.trim();
    }
  }
  const bodyStart = i;
  const tokens = [];
  let inDialogue = false;

  const pushAction = (t, line) => {
    const last = tokens[tokens.length - 1];
    if (last && last.type === 'action' && last.endLine === line - 1) { last.text += '\n' + t; last.endLine = line; }
    else tokens.push({ type: 'action', text: t, line, endLine: line });
  };

  for (; i < lines.length; i++) {
    const line = lines[i].replace(/\[\[[\s\S]*?\]\]/g, '').trimEnd();
    const t = line.trim();
    if (t === '') { inDialogue = false; continue; }
    const prevBlank = i === bodyStart || isBlank(lines[i - 1]);
    if (inDialogue) {
      if (/^\(.*\)$/.test(t)) tokens.push({ type: 'parenthetical', text: t, line: i });
      else if (t.startsWith('~')) tokens.push({ type: 'lyrics', text: t.slice(1).trim(), line: i });
      else {
        const last = tokens[tokens.length - 1];
        if (last.type === 'dialogue') last.text += '\n' + t;
        else tokens.push({ type: 'dialogue', text: t, line: i });
      }
      continue;
    }
    if (/^={3,}$/.test(t)) { tokens.push({ type: 'page_break', line: i }); continue; }
    if (t.startsWith('#')) { const m = t.match(/^(#+)\s*(.*)$/); tokens.push({ type: 'section', level: m[1].length, text: m[2], line: i }); continue; }
    if (t.startsWith('=')) { tokens.push({ type: 'synopsis', text: t.slice(1).trim(), line: i }); continue; }
    if (t.startsWith('!')) { pushAction(t.slice(1), i); continue; }
    if (t.startsWith('~')) { tokens.push({ type: 'lyrics', text: t.slice(1).trim(), line: i }); continue; }
    if (/^>.*<$/.test(t)) { tokens.push({ type: 'centered', text: t.slice(1, -1).trim(), line: i }); continue; }
    if (t.startsWith('>')) { tokens.push({ type: 'transition', text: t.slice(1).trim().toUpperCase(), line: i }); continue; }
    if (prevBlank && SCENE_RE.test(t)) {
      let head = t.startsWith('.') ? t.slice(1).trim() : t;
      let number = null;
      const nm = head.match(/\s*#([^#]+)#\s*$/);
      if (nm) { number = nm[1].trim(); head = head.slice(0, nm.index).trim(); }
      tokens.push({ type: 'scene_heading', text: head.toUpperCase(), number, line: i });
      continue;
    }
    const nextBlank = isBlank(lines[i + 1]);
    if (prevBlank && nextBlank && TRANS_RE.test(t)) { tokens.push({ type: 'transition', text: t, line: i }); continue; }
    if (prevBlank && !nextBlank && (t.startsWith('@') || isCue(t))) {
      let name = t.startsWith('@') ? t.slice(1).trim() : t;
      let dual = false;
      if (name.endsWith('^')) { dual = true; name = name.slice(0, -1).trim(); }
      tokens.push({ type: 'character', text: name, name: cueName(name), dual, line: i });
      inDialogue = true;
      continue;
    }
    pushAction(t, i);
  }

  // Scènes verzamelen
  const scenes = [];
  const seen = {};
  let cur = null;
  tokens.forEach((tk) => {
    if (tk.type === 'scene_heading') {
      const info = headingInfo(tk.text);
      seen[info.norm] = (seen[info.norm] || 0) + 1;
      cur = {
        index: scenes.length, num: tk.number || String(scenes.length + 1), forcedNum: !!tk.number,
        heading: tk.text, ...info,
        key: tk.number ? 'n:' + tk.number : 'h:' + info.norm + '#' + seen[info.norm],
        line: tk.line, chars: [], speaking: {}, onset: new Set(), synopsis: [], action: [], words: 0, lines: 0, page: 1,
      };
      scenes.push(cur);
      tk.scene = cur.index;
    } else if (cur) {
      tk.scene = cur.index;
      if (tk.type === 'character') {
        if (!cur.chars.includes(tk.name)) cur.chars.push(tk.name);
        cur.speaking[tk.name] = (cur.speaking[tk.name] || 0) + 1;
        if (!/\(\s*V\.?\s*O\.?\s*\)/i.test(tk.text)) cur.onset.add(tk.name);
      } else if (tk.type === 'synopsis') cur.synopsis.push(tk.text);
      else if (tk.type === 'action') cur.action.push(tk.text);
    }
  });
  scenes.forEach((s, n) => { s.endLine = n + 1 < scenes.length ? scenes[n + 1].line - 1 : lines.length - 1; });

  const pages = paginate(tokens, scenes);

  // Personages over het hele script
  const characters = {};
  let sceneIdx = -1;
  tokens.forEach((tk) => {
    if (tk.type === 'scene_heading') sceneIdx = tk.scene;
    if (tk.type === 'character') {
      const c = characters[tk.name] ??= { name: tk.name, lines: 0, words: 0, scenes: new Set(), first: tk.scene ?? 0 };
      c.lines++;
      if (sceneIdx >= 0) c.scenes.add(sceneIdx);
    }
    if (tk.type === 'dialogue') {
      const prevChar = findPrevCharacter(tokens, tk);
      if (prevChar && characters[prevChar]) characters[prevChar].words += (tk.text.match(/\S+/g) || []).length;
    }
  });
  let dialogueWords = 0, actionWords = 0;
  tokens.forEach((tk) => {
    const w = (tk.text?.match(/\S+/g) || []).length;
    if (tk.type === 'dialogue') dialogueWords += w;
    else if (tk.type === 'action') actionWords += w;
  });
  scenes.forEach((s) => { s.eighths = Math.max(1, Math.round((s.lines / PAGE_LINES) * 8)); });

  // Cast per scène = personages die op de set nodig zijn: sprekend (niet alleen als voice-over)
  // plus bekende personages die in de actie in HOOFDLETTERS voorkomen (bijv. "HENK (68) loopt…").
  const known = Object.keys(characters).sort((a, b) => b.length - a.length);
  scenes.forEach((s) => {
    const act = s.action.join('\n');
    const cast = new Set(s.onset);
    for (const n of known) {
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu');
      if (re.test(act)) cast.add(n);
    }
    s.cast = [...cast];
    delete s.onset;
  });

  return { title, tokens, scenes, characters, pages, dialogueWords, actionWords, lineCount: lines.length };
}

function findPrevCharacter(tokens, tk) {
  for (let j = tokens.indexOf(tk) - 1; j >= 0; j--) if (tokens[j].type === 'character') return tokens[j].name;
  return null;
}

export function wrap(s, w) {
  const out = [];
  for (const para of String(s).split('\n')) {
    let cur = '';
    for (const wd of para.split(/\s+/).filter(Boolean)) {
      if (!cur) cur = wd;
      else if ((cur + ' ' + wd).length <= w) cur += ' ' + wd;
      else { out.push(cur); cur = wd; }
      while (cur.length > w) { out.push(cur.slice(0, w)); cur = cur.slice(w); }
    }
    out.push(cur);
  }
  return out;
}

const PRINTABLE = new Set(['scene_heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition', 'centered', 'lyrics']);

/** Kent paginanummers toe; geeft aantal pagina's terug en vult scene.lines/page. */
function paginate(tokens, scenes) {
  const blocks = [];
  for (let j = 0; j < tokens.length; j++) {
    const tk = tokens[j];
    if (tk.type === 'page_break') { blocks.push({ brk: true, tokens: [tk] }); continue; }
    if (!PRINTABLE.has(tk.type)) continue;
    tk.lineCount = wrap(tk.text.replace(/[*_]/g, ''), WIDTH[tk.type]).length;
    if (tk.type === 'character') {
      const b = { tokens: [tk], lines: tk.lineCount, split: false };
      while (tokens[j + 1] && ['parenthetical', 'dialogue', 'lyrics'].includes(tokens[j + 1].type)) {
        const n = tokens[++j];
        n.lineCount = wrap(n.text, WIDTH[n.type]).length;
        b.tokens.push(n); b.lines += n.lineCount;
      }
      // Dubbele dialoog: tweede blok staat naast het eerste
      const prev = blocks[blocks.length - 1];
      if (tk.dual && prev && prev.tokens[0].type === 'character') {
        prev.tokens.push(...b.tokens);
        prev.lines = Math.max(prev.lines, b.lines);
        continue;
      }
      blocks.push(b);
    } else {
      blocks.push({ tokens: [tk], lines: tk.lineCount, split: tk.type === 'action' });
    }
  }
  let page = 1, used = 0;
  for (let b = 0; b < blocks.length; b++) {
    const blk = blocks[b];
    if (blk.brk) { if (used > 0) { page++; used = 0; } blk.tokens[0].page = page; continue; }
    let need = (used === 0 ? 0 : 1) + blk.lines;
    const head = blk.tokens[0].type === 'scene_heading';
    const keepNext = head && blocks[b + 1] && !blocks[b + 1].brk ? 1 + Math.min(blocks[b + 1].lines, 2) : 0;
    const remain = PAGE_LINES - used;
    if (used > 0 && (need + keepNext > remain) && !(blk.split && remain - 1 >= 3)) { page++; used = 0; need = blk.lines; }
    blk.tokens.forEach((t) => { t.page = page; });
    const sc = scenes[blk.tokens[0].scene];
    if (sc) { sc.lines += need; if (head) sc.page = page; }
    used += need;
    while (used > PAGE_LINES) { page++; used -= PAGE_LINES; }
  }
  return blocks.length ? page : 0;
}

/* ---------- Inline-opmaak ---------- */
export function inline(s) {
  return esc(s)
    .replace(/\\\*/g, '&#42;').replace(/\\_/g, '&#95;')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/_(.+?)_/g, '<u>$1</u>')
    .replace(/\n/g, '<br>');
}

const TITLE_LABELS = { title: 'title', titel: 'title', credit: 'credit', author: 'author', authors: 'author', auteur: 'author', source: 'source', bron: 'source' };

export function titlePageHTML(title) {
  if (!Object.keys(title).length) return '';
  const g = (k) => title[k] || title[Object.keys(TITLE_LABELS).find((x) => TITLE_LABELS[x] === k && title[x])] || '';
  const t = title.title || title.titel || '';
  return `<div class="sp-page sp-title">
    <div class="tp-center"><div class="tp-title">${inline(t).toUpperCase()}</div>
    ${g('credit') ? `<div class="tp-credit">${inline(g('credit'))}</div>` : ''}
    ${title.author || title.authors || title.auteur ? `<div class="tp-author">${inline(title.author || title.authors || title.auteur)}</div>` : ''}
    ${title.source || title.bron ? `<div class="tp-source">${inline(title.source || title.bron)}</div>` : ''}</div>
    <div class="tp-bottom"><div>${inline(title.contact || '')}</div><div>${inline(title['draft date'] || title.datum || title.date || '')}${title.revision || title.versie ? '<br>' + inline(title.revision || title.versie) : ''}</div></div>
  </div>`;
}

/** Zet tokens om naar HTML-pagina's in standaardopmaak. */
export function toHTML(parsed, { sceneNumbers = true, titlePage = true, notesAndSections = false } = {}) {
  const pages = [];
  let cur = [];
  let pageNo = 1;
  const flush = () => { pages.push({ n: pageNo, html: cur.join('') }); cur = []; };
  const toks = parsed.tokens;
  for (let j = 0; j < toks.length; j++) {
    const tk = toks[j];
    if (tk.page && tk.page !== pageNo) { flush(); pageNo = tk.page; }
    if (tk.type === 'page_break') continue;
    if (!PRINTABLE.has(tk.type)) {
      if (notesAndSections && (tk.type === 'section' || tk.type === 'synopsis')) cur.push(`<div class="el el-${tk.type}">${inline(tk.text)}</div>`);
      continue;
    }
    if (tk.type === 'character') {
      // Dialoogblok verzamelen (eventueel dubbel)
      const grab = (start) => {
        const parts = [`<div class="el el-character">${inline(toks[start].text)}</div>`];
        let k = start + 1;
        while (toks[k] && ['parenthetical', 'dialogue', 'lyrics'].includes(toks[k].type)) {
          parts.push(`<div class="el el-${toks[k].type}">${inline(toks[k].text)}</div>`); k++;
        }
        return [parts.join(''), k];
      };
      const [a, next] = grab(j);
      if (toks[next] && toks[next].type === 'character' && toks[next].dual) {
        const [b, next2] = grab(next);
        cur.push(`<div class="dual"><div>${a}</div><div>${b}</div></div>`);
        j = next2 - 1;
      } else {
        cur.push(`<div class="dlg">${a}</div>`);
        j = next - 1;
      }
      continue;
    }
    if (tk.type === 'scene_heading') {
      const n = parsed.scenes[tk.scene]?.num;
      const num = sceneNumbers && n ? `<span class="sn l">${esc(n)}</span><span class="sn r">${esc(n)}</span>` : '';
      cur.push(`<div class="el el-scene_heading" data-scene="${tk.scene}">${num}${inline(tk.text)}</div>`);
      continue;
    }
    cur.push(`<div class="el el-${tk.type}">${inline(tk.text)}</div>`);
  }
  flush();
  const body = pages.filter((p) => p.html || p.n === 1).map((p) => `<div class="sp-page">${p.n > 1 ? `<div class="pn">${p.n}.</div>` : ''}${p.html}</div>`).join('');
  return (titlePage ? titlePageHTML(parsed.title) : '') + body;
}

/** CSS voor scenario-opmaak (Courier 12pt, Letter/A4-marges). */
export const SCRIPT_CSS = `
.sp-page{position:relative;background:#fff;color:#111;width:8.5in;min-height:11in;padding:1in 1in 1in 1.5in;margin:0 auto 24px;font:12pt/1 "Courier Prime","Courier New",Courier,monospace;box-shadow:0 2px 14px rgba(0,0,0,.25)}
.sp-page .el{white-space:pre-wrap;margin:0 0 12pt;line-height:12pt}
.sp-page .el-scene_heading{font-weight:bold;position:relative;margin-top:12pt}
.sp-page .sn{position:absolute;top:0;font-weight:bold}.sp-page .sn.l{left:-0.75in}.sp-page .sn.r{right:-0.6in}
.sp-page .dlg{margin:0 0 12pt}
.sp-page .el-character{margin:0 0 0 2.2in}
.sp-page .el-parenthetical{margin:0 0 0 1.6in;width:2.2in}
.sp-page .el-dialogue{margin:0 0 0 1in;width:3.5in}
.sp-page .el-lyrics{margin:0 0 0 1in;width:3.5in;font-style:italic}
.sp-page .dual{display:grid;grid-template-columns:1fr 1fr;gap:.2in;margin-bottom:12pt}
.sp-page .dual .el-character{margin-left:.9in}.sp-page .dual .el-parenthetical{margin-left:.4in;width:auto}.sp-page .dual .el-dialogue{margin-left:0;width:auto}
.sp-page .el-transition{text-align:right}
.sp-page .el-centered{text-align:center}
.sp-page .el-section{color:#888;font-family:system-ui;font-size:10pt}
.sp-page .el-synopsis{color:#888;font-style:italic}
.sp-page .pn{position:absolute;top:.5in;right:1in}
.sp-title{display:flex;flex-direction:column;justify-content:space-between}
.sp-title .tp-center{text-align:center;margin-top:3in;line-height:1.2}
.sp-title .tp-title{font-weight:bold;text-decoration:underline;margin-bottom:24pt}
.sp-title .tp-credit,.sp-title .tp-author,.sp-title .tp-source{margin-bottom:12pt}
.sp-title .tp-bottom{display:flex;justify-content:space-between;line-height:1.2}
@media print{.sp-page{box-shadow:none;margin:0;width:auto;min-height:0;padding:0;break-after:page}
.sp-page .sn.l{left:-.6in}.sp-page .sn.r{right:-.5in}
@page{size:letter;margin:1in 1in 1in 1.5in}}`;

/** Final Draft (.fdx) export */
export function toFDX(parsed) {
  const map = { scene_heading: 'Scene Heading', action: 'Action', character: 'Character', parenthetical: 'Parenthetical', dialogue: 'Dialogue', transition: 'Transition', centered: 'Action', lyrics: 'Dialogue' };
  const x = (s) => esc(String(s).replace(/[*_]/g, ''));
  const paras = parsed.tokens.filter((t) => map[t.type]).map((t) => {
    const num = t.type === 'scene_heading' && parsed.scenes[t.scene] ? ` Number="${x(parsed.scenes[t.scene].num)}"` : '';
    const align = t.type === 'centered' ? ' Alignment="Center"' : '';
    return `    <Paragraph Type="${map[t.type]}"${num}${align}>\n${String(t.text).split('\n').map((l) => `      <Text>${x(l)}</Text>`).join('\n')}\n    </Paragraph>`;
  });
  const tp = parsed.title;
  const tpara = (s, align = 'Center') => `      <Paragraph Alignment="${align}" Type="General"><Text>${x(s || '')}</Text></Paragraph>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="5">
  <Content>
${paras.join('\n')}
  </Content>
  <TitlePage>
    <Content>
${[tpara(tp.title || tp.titel), tpara(tp.credit), tpara(tp.author || tp.authors || tp.auteur), tpara(tp.contact, 'Left'), tpara(tp['draft date'] || tp.datum, 'Left')].join('\n')}
    </Content>
  </TitlePage>
</FinalDraft>`;
}

const unxml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()];
});

/** FDX-import (Final Draft) naar Fountain. Werkt zonder DOM, dus ook in tests en workers. */
export function fromFDX(xml) {
  const body = String(xml).replace(/<TitlePage\b[\s\S]*?<\/TitlePage>/gi, '');
  const out = [];
  for (const [, attrs, inner] of body.matchAll(/<Paragraph\b([^>]*)>([\s\S]*?)<\/Paragraph>/gi)) {
    const type = (attrs.match(/\bType="([^"]*)"/i) || [])[1] || 'Action';
    const txt = unxml([...inner.matchAll(/<Text\b[^>]*>([\s\S]*?)<\/Text>/gi)].map((m) => m[1]).join(''));
    if (!txt.trim()) continue;
    switch (type) {
      case 'Scene Heading': out.push('', SCENE_RE.test(txt) ? txt.toUpperCase() : '.' + txt.toUpperCase(), ''); break;
      case 'Character': out.push('', txt.toUpperCase()); break;
      case 'Parenthetical': out.push(txt.startsWith('(') ? txt : `(${txt})`); break;
      case 'Dialogue': out.push(txt); break;
      case 'Transition': out.push('', '> ' + txt.toUpperCase(), ''); break;
      case 'Shot': out.push('', txt.toUpperCase(), ''); break;
      default: out.push('', txt, '');
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export { PAGE_LINES };
