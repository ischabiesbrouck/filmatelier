import { h, bind, btn, iconBtn, icon, pageHead, empty, uid, pickFile, compressImage, toast, modal } from '../util.js';

const BOARDS = ['Look & licht', 'Kleur', 'Locaties', 'Kostuum', 'Personages', 'Referentiefilms', 'Titels & grafisch', 'Overig'];
const TAGS = ['Belichting', 'Kleurpalet', 'Kostuum', 'Locatie', 'Camera', 'Sfeer', 'Decor', 'Grime', 'Typografie'];
let board = '';
let tag = '';

/** Haalt de k dominante kleuren uit een afbeelding (k-means op een verkleinde versie). */
export function extractPalette(src, k = 5) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 64;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(im, 0, 0, 64, 64);
      const d = g.getImageData(0, 0, 64, 64).data;
      const px = [];
      for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
      let cent = Array.from({ length: k }, (_, i) => px[Math.floor((i + 0.5) * px.length / k)].slice());
      for (let it = 0; it < 10; it++) {
        const sum = cent.map(() => [0, 0, 0, 0]);
        for (const p of px) {
          let bi = 0, bd = Infinity;
          cent.forEach((c, ci) => { const dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (dd < bd) { bd = dd; bi = ci; } });
          const s = sum[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
        }
        cent = sum.map((s, i) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : cent[i]));
      }
      const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
      res(cent.sort((a, b) => lum(a) - lum(b)).map(hex));
    };
    im.onerror = () => res([]);
    im.src = src;
  });
}
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const ink = (hex) => (lum([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))) > 140 ? '#111' : '#fff');

export default {
  id: 'moodboard', title: 'Moodboard', icon: 'image', group: 'Pre-productie',
  render(root, ctx) {
    const p = ctx.project;
    const addFiles = async (files) => {
      const imgs = [...files].filter((f) => f.type.startsWith('image/'));
      if (!imgs.length) return;
      toast(`${imgs.length} afbeelding(en) verwerken…`);
      for (const f of imgs) {
        const img = await compressImage(f, 1200, 0.8);
        p.mood.unshift({ id: uid(), img, caption: f.name.replace(/\.[^.]+$/, ''), board: board || BOARDS[0], tags: tag ? [tag] : [], palette: await extractPalette(img) });
      }
      ctx.save(); ctx.rerender();
    };
    root.append(pageHead('Moodboard', 'Verzamel beelden voor look, kleur, kostuum en locaties. Kleurpaletten worden automatisch uit je beelden gehaald. Plakken (Ctrl+V) en slepen werkt ook.',
      btn('Afbeeldingen toevoegen', async () => addFiles(await pickFile('image/*', true)), { icon: 'plus', class: 'primary' }),
      btn('Filmpalet', () => paletteView(p), { icon: 'palette' })),
    h('div', { class: 'chips', style: { marginBottom: '14px' } }, ['', ...BOARDS].map((b) => h('button', { class: 'chip' + (board === b ? ' on' : ''), type: 'button', onclick: () => { board = b; ctx.rerender(); } }, `${b || 'Alles'} (${b ? p.mood.filter((m) => m.board === b).length : p.mood.length})`))));

    const dz = h('div', { class: 'dropzone' }, 'Sleep afbeeldingen hierheen, of plak met Ctrl+V');
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); addFiles(e.dataTransfer.files); });
    const usedTags = [...new Set(p.mood.flatMap((m) => m.tags || []))].sort();
    if (tag && !usedTags.includes(tag)) tag = '';
    const items = p.mood.filter((m) => (!board || m.board === board) && (!tag || (m.tags || []).includes(tag)));
    if (usedTags.length) {
      root.append(h('div', { class: 'row wrap', style: { marginBottom: '12px' } }, h('span', { class: 'muted small' }, 'Tags:'),
        h('div', { class: 'chips' }, ['', ...usedTags].map((t) => h('button', { class: 'chip' + (tag === t ? ' on' : ''), type: 'button', onclick: () => { tag = t; ctx.rerender(); } }, t ? '#' + t : 'alle')))));
    }
    root.append(dz, h('div', { style: { height: '14px' } }), h('datalist', { id: 'mood-tags' }, [...new Set([...TAGS, ...usedTags])].map((t) => h('option', { value: t }))));
    const tagRow = (m) => {
      m.tags ??= [];
      const inp = h('input', { placeholder: '+ tag', list: 'mood-tags', style: { width: '90px', padding: '2px 6px', fontSize: '.78rem' } });
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !inp.value.trim()) return;
        const t = inp.value.trim().replace(/^#/, '');
        if (!m.tags.includes(t)) m.tags.push(t);
        ctx.save(); ctx.rerender();
      });
      return h('div', { class: 'chips', style: { padding: '0 8px 8px', gap: '4px' } },
        m.tags.map((t) => h('span', { class: 'chip', style: { fontSize: '.74rem', padding: '0 7px' } }, '#' + t,
          h('span', { class: 'x', title: 'Tag verwijderen', onclick: () => { m.tags.splice(m.tags.indexOf(t), 1); ctx.save(); ctx.rerender(); } }, icon('x', 11)))),
        inp);
    };
    if (!items.length) root.append(empty('Nog geen beelden in dit bord.'));
    else root.append(h('div', { class: 'mood-grid' }, items.map((m) => h('div', { class: 'mood-item' },
      h('img', { src: m.img, alt: m.caption || '', loading: 'lazy', onclick: () => modal({ title: m.caption || 'Beeld', wide: true, body: h('img', { src: m.img, alt: '', style: { width: '100%', borderRadius: '6px' } }) }) }),
      m.palette?.length ? h('div', { class: 'p' }, m.palette.map((c) => h('i', { style: { background: c }, title: c + ' (klik = kopiëren)', onclick: () => navigator.clipboard.writeText(c).then(() => toast(c + ' gekopieerd')) }))) : null,
      h('div', { class: 'cap' }, bind(m, 'caption', ctx, { placeholder: 'Bijschrift' }),
        bind(m, 'board', ctx, { type: 'select', options: BOARDS, style: 'width:auto;font-size:.75rem;padding:2px 4px', onchange: () => board && ctx.rerender() }),
        iconBtn('trash', 'Verwijderen', () => { p.mood.splice(p.mood.indexOf(m), 1); ctx.save(); ctx.rerender(); }, 'danger')),
      tagRow(m)))));

    const onPaste = (e) => {
      if (e.target.closest?.('input, textarea')) return;
      const files = [...(e.clipboardData?.files || [])];
      if (files.length) { e.preventDefault(); addFiles(files); }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  },
};

async function paletteView(p) {
  const all = p.mood.flatMap((m) => m.palette || []);
  const body = h('div', { class: 'stack' });
  if (!all.length) body.append(h('p', { class: 'muted' }, 'Voeg eerst beelden toe.'));
  else {
    // Paletten samenvoegen tot één filmpalet: clusteren van alle kleuren
    const c = document.createElement('canvas'); c.width = all.length; c.height = 1;
    const g = c.getContext('2d');
    all.forEach((hex, i) => { g.fillStyle = hex; g.fillRect(i, 0, 1, 1); });
    const film = await extractPalette(c.toDataURL(), Math.min(8, all.length));
    body.append(h('p', { class: 'muted' }, 'Gecombineerd palet uit alle moodboardbeelden. Klik op een kleur om de hexcode te kopiëren — handig voor de kleurcorrectie, art department en kostuum.'),
      h('div', { class: 'palette-big' }, film.map((hx) => h('div', { style: { background: hx, color: ink(hx) }, onclick: () => navigator.clipboard.writeText(hx).then(() => toast(hx + ' gekopieerd')) }, hx))),
      h('h4', {}, 'Per bord'),
      ...BOARDS.map((b) => { const cols = p.mood.filter((m) => m.board === b).flatMap((m) => m.palette || []); return cols.length ? h('div', {}, h('small', { class: 'muted' }, b), h('div', { class: 'palette-big', style: { height: '28px' } }, cols.slice(0, 40).map((hx) => h('div', { style: { background: hx }, title: hx })))) : null; }));
  }
  modal({ title: 'Filmpalet', wide: true, body });
}
