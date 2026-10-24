// Kleine DOM- en hulpfuncties die alle modules delen.

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PROPS = new Set(['value', 'checked', 'selected', 'indeterminate']);

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sv == null) continue;
          if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv;
        }
      }
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (PROPS.has(k)) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, kids);
  return el;
}

export function append(el, kids) {
  for (const k of [kids].flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : String(k));
  }
  return el;
}

export const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };

/** Vervangt de inhoud van el; null/false-kinderen worden overgeslagen (anders dan replaceChildren). */
export const fill = (el, ...kids) => append(clear(el), kids);

export function debounce(fn, ms) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  return d;
}

/* ---------- Iconen (eigen lijnset, 24×24) ---------- */
const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  bulb: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z',
  structure: 'M3 5h18M3 12h12M3 19h7',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8',
  pen: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  cards: 'M3 4h8v7H3zM13 4h8v7h-8zM3 13h8v7H3zM13 13h8v7h-8z',
  tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01',
  camera: 'M23 7l-7 5 7 5zM1 5h15v14H1z',
  strip: 'M3 4h18v4H3zM3 10h18v4H3zM3 16h18v4H3z',
  id: 'M3 4h18v16H3zM8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 17c.5-2 2-3 3-3s2.5 1 3 3M14 9h4M14 13h4',
  pin: 'M12 22s7-7.5 7-13a7 7 0 0 0-14 0c0 5.5 7 13 7 13zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  euro: 'M18 6.5A7 7 0 1 0 18 17.5M4 10h10M4 14h10',
  image: 'M3 3h18v18H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  check: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  megaphone: 'M3 10v4h4l7 5V5L7 10zM18 8.5a5 5 0 0 1 0 7',
  clapper: 'M4 11h16v9H4zM3.5 10.5L19 6.5l-1-4L2.5 6.5zM8 5.3l2 4M13 4l2 4',
  film: 'M2 3h20v18H2zM7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5M2 12h20',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
  calc: 'M5 2h14v20H5zM8 6h8v4H8zM8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01',
  folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  plus: 'M12 5v14M5 12h14',
  x: 'M18 6L6 18M6 6l12 12',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
  up: 'M18 15l-6-6-6 6',
  down: 'M6 9l6 6 6-6',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  menu: 'M3 6h18M3 12h18M3 18h18',
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z',
  print: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  dice: 'M3 3h18v18H3zM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  grip: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  copy: 'M9 9h13v13H9zM5 15H2V2h13v3',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  palette: 'M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22zM7.5 11h.01M10 7h.01M14.5 7h.01M17 11h.01',
  play: 'M5 3l14 9-14 9z',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  edit: 'M11 4H4v16h16v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z',
  focus: 'M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5',
  wand: 'M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5',
  arrowUpRight: 'M7 17L17 7M8 7h9v9',
  chart: 'M3 3v18h18M7 15v3M11 10v8M15 6v12M19 12v6',
  type: 'M4 7V4h16v3M9 20h6M12 4v16',
  undo: 'M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8',
  redo: 'M21 7v6h-6M21 13a9 9 0 1 1-3-7.7L21 8',
  listOl: 'M10 6h11M10 12h11M10 18h11M4 4h1v5M4 9h2M6 19H4c0-1.5 2-2 2-3.2 0-.8-.6-1.3-1.2-1.3-.5 0-.9.2-1.1.6',
  alignLeft: 'M3 6h18M3 12h12M3 18h16',
  alignCenter: 'M3 6h18M6 12h12M4 18h16',
  alignRight: 'M3 6h18M9 12h12M5 18h16',
  alignJustify: 'M3 6h18M3 12h18M3 18h18',
  indent: 'M3 8l4 4-4 4M10 6h11M10 12h11M10 18h11',
  outdent: 'M7 8l-4 4 4 4M10 6h11M10 12h11M10 18h11',
  minus: 'M4 12h16',
  pageBreak: 'M5 3v5h14V3M5 21v-5h14v5M2 12h3M8 12h3M13 12h3M19 12h3',
  calendar: 'M3 5h18v16H3zM16 3v4M8 3v4M3 10h18',
  eraser: 'M7 21h10M4.5 16.5l9-9a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L13 18H7z',
  volume: 'M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  stop: 'M6 6h12v12H6z',
  skip: 'M5 4l10 8-10 8zM19 5v14',
  package:'M16.5 9.4l-9-5.2M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7zM3.3 7L12 12l8.7-5M12 22V12',
  grid: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
  expand: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
};

export function icon(name, size = 18) {
  const s = document.createElement('span');
  s.className = 'ico';
  s.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name] || ICONS.doc}"/></svg>`;
  return s;
}

export const btn = (label, onclick, opts = {}) =>
  h('button', { class: 'btn ' + (opts.class || ''), onclick, title: opts.title, type: 'button', disabled: opts.disabled },
    opts.icon ? icon(opts.icon, 16) : null, label ? h('span', {}, label) : null);

export const iconBtn = (name, title, onclick, cls = '') =>
  h('button', { class: 'icon-btn ' + cls, title, 'aria-label': title, onclick, type: 'button' }, icon(name, 17));

/* ---------- Formulieren ---------- */
export function bind(obj, key, ctx, o = {}) {
  const type = o.type || 'text';
  let el;
  if (type === 'textarea') {
    el = h('textarea', { rows: o.rows || 4, placeholder: o.placeholder || '' });
    el.value = obj[key] ?? '';
  } else if (type === 'select') {
    el = h('select', {}, (o.options || []).map((op) => {
      const [v, l] = Array.isArray(op) ? op : [op, op];
      return h('option', { value: v }, l);
    }));
    el.value = obj[key] ?? o.default ?? '';
  } else if (type === 'checkbox') {
    el = h('input', { type: 'checkbox' });
    el.checked = !!obj[key];
  } else {
    el = h('input', { type, placeholder: o.placeholder || '', step: o.step, min: o.min, max: o.max, list: o.list });
    el.value = obj[key] ?? '';
  }
  const ev = ['select', 'checkbox', 'date', 'color', 'time'].includes(type) ? 'change' : 'input';
  el.addEventListener(ev, () => {
    let v = el.value;
    if (type === 'checkbox') v = el.checked;
    else if (type === 'number') v = el.value === '' ? '' : Number(el.value);
    obj[key] = v;
    ctx.save();
    o.onchange?.(v, el);
  });
  if (o.class) el.className = o.class;
  if (o.style) el.style.cssText = o.style;
  if (o.title) el.title = o.title;
  return el;
}

export const field = (label, control, hint, cls = '') =>
  h('label', { class: 'field ' + cls }, h('span', { class: 'lbl' }, label), control, hint ? h('small', { class: 'hint' }, hint) : null);

export const section = (title, ...kids) => h('section', { class: 'card' }, title ? h('h3', { class: 'card-title' }, title) : null, ...kids);

export function pageHead(title, sub, ...actions) {
  return h('div', { class: 'page-head' },
    h('div', {}, h('h1', {}, title), sub ? h('p', { class: 'muted' }, sub) : null),
    actions.length ? h('div', { class: 'page-actions' }, actions) : null);
}

export function tabs(items, active, onSelect) {
  return h('div', { class: 'tabs', role: 'tablist' }, items.map(([id, label]) =>
    h('button', { class: 'tab' + (id === active ? ' active' : ''), role: 'tab', 'aria-selected': String(id === active), type: 'button', onclick: () => onSelect(id) }, label)));
}

export const empty = (text, ...kids) => h('div', { class: 'empty' }, h('p', {}, text), ...kids);

/* ---------- Dialogen ---------- */
export function modal({ title, body, actions = [], wide = false }) {
  const prev = document.activeElement;
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  const content = typeof body === 'function' ? body(close) : body;
  const ov = h('div', { class: 'modal-ov', onmousedown: (e) => { if (e.target === ov) close(); } },
    h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('header', {}, h('h2', {}, title), iconBtn('x', 'Sluiten', close)),
      h('div', { class: 'modal-body' }, content),
      actions.length ? h('footer', {}, actions.map((a) => h('button', {
        type: 'button',
        class: 'btn ' + (a.primary ? 'primary' : a.danger ? 'danger' : ''),
        onclick: async () => { const r = await a.onClick?.(); if (r !== false) close(); },
      }, a.label))) : null));
  document.body.append(ov);
  document.addEventListener('keydown', onKey);
  setTimeout(() => ov.querySelector('.modal-body input, .modal-body textarea, .modal-body select, footer .btn.primary')?.focus(), 30);
  return close;
}

export const confirmDlg = (msg, okLabel = 'OK', danger = false) => new Promise((res) => {
  let done = false;
  const close = modal({
    title: 'Bevestigen', body: h('p', {}, msg),
    actions: [
      { label: 'Annuleren', onClick: () => { done = true; res(false); } },
      { label: okLabel, primary: !danger, danger, onClick: () => { done = true; res(true); } },
    ],
  });
  const ov = document.body.lastElementChild;
  new MutationObserver((_, obs) => { if (!ov.isConnected) { obs.disconnect(); if (!done) res(false); } }).observe(document.body, { childList: true });
  return close;
});

export const promptDlg = (title, value = '', label = '', multiline = false) => new Promise((res) => {
  const input = multiline ? h('textarea', { rows: 6 }) : h('input', { type: 'text' });
  input.value = value;
  let done = false;
  const ok = () => { done = true; res(input.value.trim()); };
  if (!multiline) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { ok(); close(); } });
  const close = modal({
    title, body: field(label || title, input),
    actions: [{ label: 'Annuleren', onClick: () => { done = true; res(null); } }, { label: 'OK', primary: true, onClick: ok }],
  });
  const ov = document.body.lastElementChild;
  new MutationObserver((_, obs) => { if (!ov.isConnected) { obs.disconnect(); if (!done) res(null); } }).observe(document.body, { childList: true });
});

let toastWrap;
export function toast(msg, kind = '') {
  toastWrap ??= document.body.appendChild(h('div', { class: 'toasts', 'aria-live': 'polite' }));
  const t = h('div', { class: 'toast ' + kind }, msg);
  toastWrap.append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
}

/* ---------- Bestanden ---------- */
export function download(name, data, mime = 'text/plain;charset=utf-8') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export const pickFile = (accept, multiple = false) => new Promise((res) => {
  const i = h('input', { type: 'file', accept, multiple, style: { display: 'none' } });
  i.addEventListener('change', () => { res([...i.files]); i.remove(); });
  document.body.append(i);
  i.click();
});

export const readText = (file) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file);
});

/** Verkleint een afbeelding tot max px aan de langste zijde en geeft een JPEG data-URL terug. */
export async function compressImage(file, max = 1400, q = 0.82) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q);
}

/* ---------- Opmaak ---------- */
export const money = (n, cur = 'EUR') =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: cur || 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);

export const num = (n, d = 0) => new Intl.NumberFormat('nl-NL', { maximumFractionDigits: d, minimumFractionDigits: d }).format(Number(n) || 0);

export const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

export const fmtDate = (iso, opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) =>
  iso ? new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('nl-NL', opts) : '';

export const eighths = (n) => {
  const whole = Math.floor(n / 8), rest = n % 8;
  return (whole ? whole + (rest ? ' ' : '') : '') + (rest ? rest + '/8' : (whole ? '' : '0'));
};

export const words = (s) => (String(s || '').match(/[\p{L}\p{N}'’-]+/gu) || []).length;

export function slug(s) { return String(s || 'film').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'film'; }

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ---------- Afdrukken via een verborgen iframe ---------- */
const PRINT_BASE = `
*{box-sizing:border-box}body{font:11pt/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111;margin:0;padding:0}
h1{font-size:20pt;margin:0 0 4pt}h2{font-size:14pt;margin:14pt 0 6pt}h3{font-size:12pt;margin:10pt 0 4pt}
table{border-collapse:collapse;width:100%;margin:6pt 0}th,td{border:1px solid #999;padding:4pt 6pt;text-align:left;vertical-align:top;font-size:9.5pt}
th{background:#eee}.muted{color:#555}.right{text-align:right}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10pt}
.box{border:1px solid #999;padding:6pt 8pt;border-radius:3pt}.pb{break-after:page}img{max-width:100%}
@page{margin:14mm}`;

export async function printDoc(title, bodyHTML, css = '') {
  const f = h('iframe', { style: { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' }, title: 'afdrukken' });
  document.body.append(f);
  const d = f.contentDocument;
  d.open();
  d.write(`<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_BASE}${css}</style></head><body>${bodyHTML}</body></html>`);
  d.close();
  await Promise.all([...d.images].map((i) => i.decode().catch(() => {})));
  await new Promise((r) => setTimeout(r, 120));
  f.contentWindow.focus();
  f.contentWindow.print();
  setTimeout(() => f.remove(), 2000);
}

/** Maakt een lijstje sorteerbaar met slepen (muis/pen); roept onMove(from, to) aan. */
export function sortable(container, itemSelector, onMove, handleSelector) {
  let dragEl = null;
  container.addEventListener('dragstart', (e) => {
    const it = e.target.closest(itemSelector);
    if (!it || (handleSelector && !e.target.closest(handleSelector) && e.target !== it)) return;
    dragEl = it; it.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  });
  container.addEventListener('dragover', (e) => {
    if (!dragEl) return;
    e.preventDefault();
    const over = e.target.closest(itemSelector);
    if (!over || over === dragEl || over.parentElement !== dragEl.parentElement) return;
    const r = over.getBoundingClientRect();
    const horizontal = getComputedStyle(over.parentElement).display.includes('grid') || getComputedStyle(over.parentElement).flexDirection === 'row';
    const after = horizontal ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
    over.parentElement.insertBefore(dragEl, after ? over.nextSibling : over);
  });
  container.addEventListener('dragend', () => {
    if (!dragEl) return;
    const items = [...dragEl.parentElement.querySelectorAll(':scope > ' + itemSelector)];
    const from = Number(dragEl.dataset.index), to = items.indexOf(dragEl);
    dragEl.classList.remove('dragging'); dragEl = null;
    if (from !== to && to >= 0) onMove(from, to);
  });
}

export const moveItem = (arr, from, to) => { const [x] = arr.splice(from, 1); arr.splice(to, 0, x); return arr; };
