// Word-bestanden (.docx) maken en lezen zonder externe bibliotheek.
// Een .docx is een ZIP met XML (WordprocessingML). We schrijven ongecomprimeerd (Word accepteert dat)
// en lezen met de ingebouwde DecompressionStream('deflate-raw').

/* ---------- ZIP ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Maakt een ZIP (methode “stored”) van [{ name, data: string | Uint8Array }]. */
export function zip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const DOS_TIME = 0, DOS_DATE = (2026 - 1980) << 9 | 1 << 5 | 1;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, DOS_TIME, true); lh.setUint16(12, DOS_DATE, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, DOS_TIME, true); ch.setUint16(14, DOS_DATE, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

/** Leest een ZIP; geeft een Map naam → Promise<Uint8Array>. */
export async function unzip(buffer) {
  const b = new Uint8Array(buffer), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Geen geldig ZIP/DOCX-bestand');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = new Map();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('Beschadigd ZIP-bestand');
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true);
    const nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
    const name = dec.decode(b.subarray(p + 46, p + 46 + nl));
    const start = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true);
    const raw = b.subarray(start, start + size);
    out.set(name, method === 0 ? Promise.resolve(raw) : method === 8 ? inflate(raw) : Promise.reject(new Error('Onbekende compressie in ' + name)));
    p += 46 + nl + xl + cl;
  }
  return out;
}
const inflate = async (data) => new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());

/* ---------- HTML → DOCX ---------- */
const x = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const ALIGN = { left: 'left', center: 'center', right: 'right', justify: 'both' };
const HEAD = { H1: 'Heading1', H2: 'Heading2', H3: 'Heading3' };

function cssColor(c) {
  if (!c) return null;
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
  if (m) return m[4] === '0' ? null : [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
  const h = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (h) return (h[1].length === 3 ? h[1].replace(/./g, '$&$&') : h[1]).toUpperCase();
  return null;
}

/** Zet de inhoud van een (opgeschoonde) editor-DOM om naar een .docx-Blob. */
export function htmlToDocx(root, title = 'Document') {
  const rels = [];
  const nums = []; // { abs: 0 | 1 }
  const body = [];

  const rPr = (f) => {
    const o = [];
    if (f.b) o.push('<w:b/>');
    if (f.i) o.push('<w:i/>');
    if (f.u) o.push('<w:u w:val="single"/>');
    if (f.s) o.push('<w:strike/>');
    if (f.color) o.push(`<w:color w:val="${f.color}"/>`);
    if (f.bg) o.push(`<w:shd w:val="clear" w:color="auto" w:fill="${f.bg}"/>`);
    if (f.sup) o.push('<w:vertAlign w:val="superscript"/>');
    if (f.sub) o.push('<w:vertAlign w:val="subscript"/>');
    if (f.link) o.push('<w:rStyle w:val="Hyperlink"/>');
    return o.length ? `<w:rPr>${o.join('')}</w:rPr>` : '';
  };
  const runs = (node, f = {}) => {
    if (node.nodeType === 3) {
      const t = node.nodeValue.replace(/\s+/g, ' ');
      return t ? [`<w:r>${rPr(f)}<w:t xml:space="preserve">${x(t)}</w:t></w:r>`] : [];
    }
    if (node.nodeType !== 1) return [];
    const tag = node.tagName;
    if (tag === 'BR') return ['<w:r><w:br/></w:r>'];
    const g = { ...f };
    if (tag === 'B' || tag === 'STRONG') g.b = true;
    if (tag === 'I' || tag === 'EM') g.i = true;
    if (tag === 'U') g.u = true;
    if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') g.s = true;
    if (tag === 'SUP') g.sup = true;
    if (tag === 'SUB') g.sub = true;
    if (tag === 'MARK') g.bg = 'FFF59D';
    const st = node.style;
    if (st) {
      if (st.fontWeight === 'bold' || +st.fontWeight >= 600) g.b = true;
      if (st.fontStyle === 'italic') g.i = true;
      if (/underline/.test(st.textDecoration || st.textDecorationLine || '')) g.u = true;
      if (/line-through/.test(st.textDecoration || st.textDecorationLine || '')) g.s = true;
      const c = cssColor(st.color); if (c) g.color = c;
      const bg = cssColor(st.backgroundColor); if (bg) g.bg = bg;
    }
    if (tag === 'A' && /^(https?:|mailto:)/i.test(node.getAttribute('href') || '')) {
      const id = `rIdL${rels.length + 1}`;
      rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${x(node.getAttribute('href'))}" TargetMode="External"/>`);
      return [`<w:hyperlink r:id="${id}">${[...node.childNodes].flatMap((c) => runs(c, { ...g, link: true })).join('')}</w:hyperlink>`];
    }
    return [...node.childNodes].flatMap((c) => runs(c, g));
  };
  const para = (inner, { style, align, num, border } = {}) => {
    const pp = [];
    if (style) pp.push(`<w:pStyle w:val="${style}"/>`);
    if (num) pp.push(`<w:numPr><w:ilvl w:val="${num.lvl}"/><w:numId w:val="${num.id}"/></w:numPr>`);
    if (border) pp.push('<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr>');
    if (align && ALIGN[align]) pp.push(`<w:jc w:val="${ALIGN[align]}"/>`);
    return `<w:p>${pp.length ? `<w:pPr>${pp.join('')}</w:pPr>` : ''}${inner}</w:p>`;
  };
  const alignOf = (el) => (el.style?.textAlign || el.getAttribute?.('align') || '').toLowerCase();
  const INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'SPAN', 'A', 'MARK', 'SUB', 'SUP', 'BR', 'FONT', 'CODE']);

  const list = (el, lvl, out) => {
    const id = nums.length + 1;
    nums.push({ abs: el.tagName === 'OL' ? 1 : 0 });
    for (const li of el.children) {
      if (li.tagName !== 'LI') continue;
      const inline = [...li.childNodes].filter((c) => c.nodeType === 3 || INLINE.has(c.tagName));
      out.push(para(inline.flatMap((c) => runs(c)).join(''), { num: { id, lvl: Math.min(lvl, 8) }, align: alignOf(li) }));
      for (const c of li.children) if (c.tagName === 'UL' || c.tagName === 'OL') list(c, lvl + 1, out);
      for (const c of li.children) if (['P', 'DIV'].includes(c.tagName)) out.push(para(runs(c).join(''), { num: { id, lvl } }));
    }
  };

  const block = (el, out, ctx = {}) => {
    if (el.nodeType === 3) { if (el.nodeValue.trim()) out.push(para(runs(el).join(''), ctx)); return; }
    if (el.nodeType !== 1) return;
    const tag = el.tagName;
    if (HEAD[tag]) out.push(para(runs(el).join(''), { style: HEAD[tag], align: alignOf(el) }));
    else if (tag === 'P' || tag === 'DIV' || tag === 'LI') {
      const hasBlocks = [...el.children].some((c) => !INLINE.has(c.tagName));
      if (hasBlocks) [...el.childNodes].forEach((c) => block(c, out, ctx));
      else out.push(para(runs(el).join(''), { ...ctx, align: alignOf(el) || ctx.align }));
    } else if (tag === 'BLOCKQUOTE') {
      const hasBlocks = [...el.children].some((c) => !INLINE.has(c.tagName));
      if (hasBlocks) [...el.childNodes].forEach((c) => block(c, out, { style: 'Quote' }));
      else out.push(para(runs(el).join(''), { style: 'Quote' }));
    } else if (tag === 'UL' || tag === 'OL') list(el, 0, out);
    else if (tag === 'HR') out.push(el.classList.contains('page-break') ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : para('', { border: true }));
    else if (tag === 'TABLE') {
      const rows = [...el.querySelectorAll('tr')];
      const cols = Math.max(1, ...rows.map((r) => r.children.length));
      const w = Math.floor(9000 / cols);
      out.push(`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="4" w:color="999999"/>`).join('')}</w:tblBorders></w:tblPr>`
        + `<w:tblGrid>${`<w:gridCol w:w="${w}"/>`.repeat(cols)}</w:tblGrid>`
        + rows.map((r) => `<w:tr>${[...r.children].map((c) => {
          const inner = [];
          block(c.tagName === 'TH' ? Object.assign(document.createElement('p'), { innerHTML: `<b>${c.innerHTML}</b>` }) : wrapCell(c), inner);
          return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${inner.join('') || '<w:p/>'}</w:tc>`;
        }).join('')}</w:tr>`).join('') + '</w:tbl><w:p/>');
    } else if (INLINE.has(tag)) out.push(para(runs(el).join(''), ctx));
    else [...el.childNodes].forEach((c) => block(c, out, ctx));
  };
  const wrapCell = (c) => { const d = document.createElement('div'); d.innerHTML = c.innerHTML; return d; };

  // Losse inline-stukken op het hoogste niveau samen in één alinea
  let pending = [];
  const flush = () => { if (pending.length) { const d = document.createElement('p'); pending.forEach((n) => d.append(n.cloneNode(true))); block(d, body); pending = []; } };
  for (const c of root.childNodes) {
    if (c.nodeType === 3 || INLINE.has(c.tagName)) { pending.push(c); continue; }
    flush(); block(c, body);
  }
  flush();

  const lvls = (abs) => Array.from({ length: 9 }, (_, i) => {
    const fmt = abs === 0 ? 'bullet' : ['decimal', 'lowerLetter', 'lowerRoman'][i % 3];
    const txt = abs === 0 ? ['•', '◦', '▪'][i % 3] : `%${i + 1}.`;
    return `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${txt}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr></w:lvl>`;
  }).join('');
  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${W_NS}>`
    + [0, 1].map((a) => `<w:abstractNum w:abstractNumId="${a}"><w:multiLevelType w:val="hybridMultilevel"/>${lvls(a)}</w:abstractNum>`).join('')
    + nums.map((n, i) => `<w:num w:numId="${i + 1}"><w:abstractNumId w:val="${n.abs}"/>${n.abs === 1 ? '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride>' : ''}</w:num>`).join('')
    + '</w:numbering>';

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W_NS}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="nl-NL"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
${[1, 2, 3].map((n) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${[360, 240, 200][n - 1]}" w:after="120"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${[36, 28, 24][n - 1]}"/><w:szCs w:val="${[36, 28, 24][n - 1]}"/></w:rPr></w:style>`).join('')}
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="720" w:right="720"/></w:pPr><w:rPr><w:i/><w:color w:val="555555"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;

  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W_NS}><w:body>${body.join('') || '<w:p/>'}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  return zip([
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
    { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(title)}</dc:title><dc:creator>Filmatelier</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>` },
    { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${rels.join('')}</Relationships>` },
    { name: 'word/document.xml', data: doc },
    { name: 'word/styles.xml', data: styles },
    { name: 'word/numbering.xml', data: numbering },
  ]);
}

/* ---------- DOCX → HTML ---------- */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Leest een .docx (ArrayBuffer) en geeft eenvoudige, schone HTML terug. */
export async function docxToHtml(buffer) {
  const files = await unzip(buffer);
  const text = async (n) => (files.has(n) ? new TextDecoder().decode(await files.get(n)) : '');
  const xmlDoc = (s) => new DOMParser().parseFromString(s, 'application/xml');
  const docXml = await text('word/document.xml');
  if (!docXml) throw new Error('Dit lijkt geen Word-document (word/document.xml ontbreekt)');
  const doc = xmlDoc(docXml);
  const kids = (el, name) => [...el.children].filter((c) => c.localName === name);
  const kid = (el, name) => kids(el, name)[0];
  const val = (el) => el?.getAttribute('w:val') ?? el?.getAttributeNS?.('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'val');

  // Hyperlinks en lijsttypes
  const rels = {};
  const relDoc = xmlDoc(await text('word/_rels/document.xml.rels') || '<r/>');
  for (const r of relDoc.getElementsByTagName('Relationship')) rels[r.getAttribute('Id')] = r.getAttribute('Target');
  const numFmt = {};
  const numDoc = xmlDoc(await text('word/numbering.xml') || '<r/>');
  const absFmt = {};
  for (const a of [...numDoc.getElementsByTagName('*')].filter((e) => e.localName === 'abstractNum')) {
    const id = a.getAttribute('w:abstractNumId');
    absFmt[id] = {};
    for (const l of kids(a, 'lvl')) absFmt[id][l.getAttribute('w:ilvl')] = val(kid(l, 'numFmt'));
  }
  for (const n of [...numDoc.getElementsByTagName('*')].filter((e) => e.localName === 'num')) numFmt[n.getAttribute('w:numId')] = absFmt[val(kid(n, 'abstractNumId'))] || {};

  const runHtml = (r) => {
    const pr = kid(r, 'rPr');
    let out = '';
    for (const c of r.children) {
      if (c.localName === 't') out += esc(c.textContent);
      else if (c.localName === 'tab') out += '&emsp;';
      else if (c.localName === 'br') out += c.getAttribute('w:type') === 'page' ? '\u0000PB\u0000' : '<br>';
    }
    if (!out || !pr) return out;
    const has = (n) => { const e = kid(pr, n); return e && !['0', 'false', 'none'].includes(val(e)); };
    if (has('b')) out = `<b>${out}</b>`;
    if (has('i')) out = `<i>${out}</i>`;
    if (has('u')) out = `<u>${out}</u>`;
    if (has('strike')) out = `<s>${out}</s>`;
    const color = val(kid(pr, 'color'));
    const shd = kid(pr, 'shd')?.getAttribute('w:fill');
    const hl = val(kid(pr, 'highlight'));
    const st = [];
    if (color && /^[0-9a-f]{6}$/i.test(color) && color !== '000000') st.push(`color:#${color}`);
    if (shd && /^[0-9a-f]{6}$/i.test(shd) && shd !== 'FFFFFF') st.push(`background-color:#${shd}`);
    else if (hl && hl !== 'none') st.push(`background-color:${{ yellow: '#fff59d', green: '#c8e6c9', cyan: '#b2ebf2', magenta: '#f8bbd0', lightGray: '#e0e0e0' }[hl] || '#fff59d'}`);
    if (st.length) out = `<span style="${st.join(';')}">${out}</span>`;
    return out;
  };
  const inline = (p) => [...p.children].map((c) => {
    if (c.localName === 'r') return runHtml(c);
    if (c.localName === 'hyperlink') {
      const href = rels[c.getAttribute('r:id')];
      const inner = kids(c, 'r').map(runHtml).join('');
      return href && /^(https?:|mailto:)/i.test(href) ? `<a href="${esc(href)}">${inner}</a>` : inner;
    }
    if (['ins', 'smartTag', 'sdt', 'fldSimple'].includes(c.localName)) return inline(c.localName === 'sdt' ? kid(c, 'sdtContent') || c : c);
    return '';
  }).join('');

  const out = [];
  const listStack = []; // [{ tag, lvl }]
  const closeLists = (toLvl = -1) => { while (listStack.length && listStack.at(-1).lvl > toLvl) out.push(`</li></${listStack.pop().tag}>`); };
  for (const el of kid(doc.documentElement, 'body')?.children || []) {
    if (el.localName === 'p') {
      const pPr = kid(el, 'pPr');
      const style = val(kid(pPr || el, 'pStyle')) || '';
      const jc = val(kid(pPr || el, 'jc'));
      const align = { center: 'center', right: 'right', end: 'right', both: 'justify', distribute: 'justify' }[jc];
      const sty = align ? ` style="text-align:${align}"` : '';
      let html = inline(el);
      const numPr = pPr && kid(pPr, 'numPr');
      if (numPr && val(kid(numPr, 'numId')) !== '0') {
        const lvl = +val(kid(numPr, 'ilvl')) || 0;
        const fmt = numFmt[val(kid(numPr, 'numId'))]?.[lvl] || 'bullet';
        const tag = fmt === 'bullet' || fmt === 'none' ? 'ul' : 'ol';
        closeLists(lvl); // diepere lijsten sluiten
        const top = listStack.at(-1);
        if (top && top.lvl === lvl && top.tag === tag) out.push(`</li><li${sty}>`); // volgend item, zelfde lijst
        else {
          if (top && top.lvl === lvl) closeLists(lvl - 1); // zelfde niveau, ander lijsttype
          out.push(`<${tag}><li${sty}>`);
          listStack.push({ tag, lvl });
        }
        out.push(html || '<br>');
        continue;
      }
      closeLists();
      const parts = html.split('\u0000PB\u0000');
      parts.forEach((part, i) => {
        if (i) out.push('<hr class="page-break">');
        const m = style.match(/^(heading|kop)\s*(\d)$/i);
        if (/^(title|titel)$/i.test(style)) out.push(`<h1${sty}>${part || '<br>'}</h1>`);
        else if (m) out.push(`<h${Math.min(3, +m[2])}${sty}>${part || '<br>'}</h${Math.min(3, +m[2])}>`);
        else if (/quote|citaat/i.test(style)) out.push(`<blockquote>${part || '<br>'}</blockquote>`);
        else if (part || i === parts.length - 1) out.push(`<p${sty}>${part || '<br>'}</p>`);
      });
    } else if (el.localName === 'tbl') {
      closeLists();
      out.push('<table><tbody>' + kids(el, 'tr').map((tr) => '<tr>' + kids(tr, 'tc').map((tc) => `<td>${kids(tc, 'p').map(inline).join('<br>') || '<br>'}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
    }
  }
  closeLists();
  return out.join('');
}
