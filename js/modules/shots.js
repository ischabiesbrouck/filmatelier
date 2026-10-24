import { h, bind, btn, iconBtn, icon, pageHead, empty, tabs, modal, uid, esc, printDoc, pickFile, compressImage, sortable, moveItem, confirmDlg } from '../util.js';

export const SIZES = ['EWS — extreem wijd', 'WS — wijd', 'FS — totaal', 'MLS — Amerikaans', 'MS — medium', 'MCU — medium close-up', 'CU — close-up', 'ECU — extreme close-up', 'OTS — over de schouder', 'POV — point of view', '2-shot', 'Insert', 'Establishing'];
export const ANGLES = ['Ooghoogte', 'Hoog', 'Laag', 'Vogelvlucht', 'Kikvors', 'Dutch / scheef', 'Overhead'];
export const MOVES = ['Statisch', 'Pan', 'Tilt', 'Dolly in', 'Dolly uit', 'Rijder / truck', 'Kraan / jib', 'Handheld', 'Steadicam / gimbal', 'Zoom', 'Drone', 'Volgen'];
const MOVE_GEAR = ['Statief', 'Slider', 'Dolly + rails', 'Gimbal', 'Steadicam', 'Kraan / jib', 'Drone', 'Autohouder', 'Handheld rig', 'Hi-hat', 'Rookmachine'];
const STATUS = [['gepland', 'Gepland'], ['gedraaid', 'Gedraaid ✓'], ['geschrapt', 'Geschrapt']];
const AR = { '2.39:1': 2.39, '1.85:1': 1.85, '16:9': 16 / 9, '4:3': 4 / 3, '1.66:1': 1.66, '2:1': 2, '1:1': 1, '9:16': 9 / 16 };

let sceneKey = null;
let view = 'list';
const letters = (i) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));
export const shotNo = (scene, i, shot) => shot.num || `${scene?.num ?? '?'}${letters(i)}`;
const short = (s) => (s || '').split(' — ')[0];

export default {
  id: 'shots', title: 'Shotlist & storyboard', icon: 'camera', group: 'Pre-productie',
  render(root, ctx) {
    const p = ctx.project;
    const parsed = ctx.parsed();
    const ar = AR[p.meta.aspect] || 16 / 9;
    root.style.setProperty('--ar', ar);
    root.append(pageHead('Shotlist & storyboard', 'Plan per scène je shots en teken of plak een storyboardbeeld per shot.',
      btn('Afdrukken', () => printShots(p, parsed, view === 'board'), { icon: 'print' }),
      btn('AI: shotlist voorstellen', () => { const s = parsed.scenes.find((x) => x.key === sceneKey); ctx.openAI({ prompt: `Stel een shotlist voor van scène ${s?.num ?? ''} met shotgrootte, hoek, beweging, lens en een korte beschrijving. Denk aan dekking voor de montage.`, selection: s ? p.script.text.split('\n').slice(s.line, s.endLine + 1).join('\n') : '' }); }, { icon: 'sparkles', class: 'ghost' })));
    if (!parsed.scenes.length) { root.append(empty('Nog geen scènes in het scenario.')); return; }
    if (!parsed.scenes.find((s) => s.key === sceneKey)) sceneKey = parsed.scenes[0].key;
    const scene = parsed.scenes.find((s) => s.key === sceneKey);
    const shots = p.shots[sceneKey] ??= [];

    const sel = h('select', { style: { maxWidth: '420px' } }, parsed.scenes.map((s) => h('option', { value: s.key }, `${s.num}. ${s.heading} (${(p.shots[s.key] || []).length} shots)`)));
    sel.value = sceneKey; sel.onchange = () => { sceneKey = sel.value; ctx.rerender(); };
    const arSel = bind(p.meta, 'aspect', ctx, { type: 'select', options: Object.keys(AR), onchange: () => ctx.rerender(), style: 'width:auto' });
    const total = Object.values(p.shots).reduce((a, l) => a + l.length, 0);
    root.append(h('div', { class: 'row wrap', style: { marginBottom: '12px' } },
      iconBtn('left', 'Vorige scène', () => { const i = parsed.scenes.indexOf(scene); if (i > 0) { sceneKey = parsed.scenes[i - 1].key; ctx.rerender(); } }),
      sel,
      iconBtn('right', 'Volgende scène', () => { const i = parsed.scenes.indexOf(scene); if (i < parsed.scenes.length - 1) { sceneKey = parsed.scenes[i + 1].key; ctx.rerender(); } }),
      h('label', { class: 'check' }, 'Beeldverhouding', arSel),
      h('div', { class: 'spacer' }), h('span', { class: 'muted small' }, `${total} shots in totaal`)),
    tabs([['list', 'Shotlist'], ['board', 'Storyboard'], ['all', 'Alle shots']], view, (v) => { view = v; ctx.rerender(); }));

    const addShot = (extra = {}) => { shots.push({ id: uid(), num: '', size: 'MS — medium', angle: 'Ooghoogte', move: 'Statisch', lens: '35', desc: '', sound: 'Sync', dur: '', status: 'gepland', notes: '', img: '', ...extra }); ctx.save(); ctx.rerender(); };

    if (view === 'all') return allShots(root, ctx, p, parsed);
    if (scene.synopsis.length) root.append(h('p', { class: 'muted' }, scene.synopsis.join(' ')));

    if (view === 'list') {
      if (!shots.length) { root.append(empty('Nog geen shots voor deze scène.', h('div', { class: 'row', style: { justifyContent: 'center' } }, btn('Shot toevoegen', () => addShot(), { icon: 'plus', class: 'primary' }), btn('Standaarddekking (master + 2 close-ups)', () => { addShot({ size: 'WS — wijd', desc: 'Master' }); addShot({ size: 'MCU — medium close-up', desc: 'Close-up A' }); addShot({ size: 'MCU — medium close-up', desc: 'Close-up B (tegenshot)' }); }, { class: 'ghost' })))); return; }
      const body = h('tbody', {}, shots.map((s, i) => h('tr', { 'data-index': i },
        h('td', { class: 'faint', style: { cursor: 'grab' }, draggable: 'true', title: 'Slepen om te verplaatsen' }, icon('grip', 14)),
        h('td', { style: { width: '70px' } }, bind(s, 'num', ctx, { placeholder: shotNo(scene, i, {}) })),
        h('td', {}, bind(s, 'size', ctx, { type: 'select', options: SIZES })),
        h('td', {}, bind(s, 'angle', ctx, { type: 'select', options: ANGLES })),
        h('td', {}, bind(s, 'move', ctx, { type: 'select', options: MOVES })),
        h('td', { style: { width: '70px' } }, bind(s, 'lens', ctx, { placeholder: 'mm' })),
        h('td', { style: { minWidth: '220px' } }, bind(s, 'desc', ctx, { placeholder: 'Wat zien we?' })),
        h('td', { style: { width: '80px' } }, bind(s, 'sound', ctx, { type: 'select', options: ['Sync', 'MOS', 'Wild', 'Playback'] })),
        h('td', { style: { minWidth: '150px' } }, bind(s, 'gear', ctx, { list: 'gear-names', placeholder: 'bijv. slider, gimbal' })),
        h('td', { style: { width: '70px' } }, bind(s, 'dur', ctx, { placeholder: 'sec' })),
        h('td', {}, bind(s, 'status', ctx, { type: 'select', options: STATUS })),
        h('td', { class: 'nowrap' },
          iconBtn('image', 'Storyboard tekenen', () => drawEditor(ctx, s, ar)),
          iconBtn('copy', 'Dupliceren', () => { shots.splice(i + 1, 0, { ...s, id: uid(), num: '' }); ctx.save(); ctx.rerender(); }),
          iconBtn('trash', 'Verwijderen', () => { shots.splice(i, 1); ctx.save(); ctx.rerender(); }, 'danger')))));
      sortable(body, 'tr', (from, to) => { moveItem(shots, from, to); ctx.save(); ctx.rerender(); });
      root.append(h('div', { class: 'card table-wrap' }, h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, ['', 'Nr', 'Grootte', 'Hoek', 'Beweging', 'Lens', 'Beschrijving', 'Geluid', 'Apparatuur', 'Duur', 'Status', ''].map((x) => h('th', {}, x)))), body),
      h('datalist', { id: 'gear-names' }, [...new Set([...MOVE_GEAR, ...(p.gear?.items || []).map((g) => g.name).filter(Boolean)])].map((n) => h('option', { value: n }))),
      h('div', { style: { marginTop: '10px' } }, btn('Shot toevoegen', () => addShot(), { icon: 'plus' }))));
    } else {
      root.append(h('div', { class: 'board-grid' },
        shots.map((s, i) => h('div', { class: 'frame' },
          h('div', { class: 'img', onclick: () => drawEditor(ctx, s, ar), title: 'Klik om te tekenen' }, s.img ? h('img', { src: s.img, alt: `Storyboard ${shotNo(scene, i, s)}` }) : h('div', { class: 'ph' }, icon('pen', 22), 'Tekenen of afbeelding')),
          h('div', { class: 'cap' },
            h('div', { class: 'row' }, h('b', {}, shotNo(scene, i, s)), h('span', { class: 'muted small' }, `${short(s.size)} · ${s.angle} · ${s.move}${s.lens ? ' · ' + s.lens + 'mm' : ''}`)),
            bind(s, 'desc', ctx, { type: 'textarea', rows: 2, placeholder: 'Beschrijving / actie', style: 'font-size:.85rem' })))),
        h('button', { class: 'frame', type: 'button', style: { cursor: 'pointer', color: 'var(--muted)', font: 'inherit', placeItems: 'center', display: 'grid', minHeight: '160px' }, onclick: () => addShot() }, h('span', {}, icon('plus', 22), ' Shot toevoegen'))));
    }
  },
};

function allShots(root, ctx, p, parsed) {
  const rows = parsed.scenes.flatMap((sc) => (p.shots[sc.key] || []).map((s, i) => [sc, s, i]));
  if (!rows.length) { root.append(empty('Nog geen shots.')); return; }
  const done = rows.filter(([, s]) => s.status === 'gedraaid').length;
  root.append(h('p', { class: 'muted' }, `${rows.length} shots · ${done} gedraaid · ${rows.filter(([, s]) => s.status === 'geschrapt').length} geschrapt`),
    h('div', { class: 'card table-wrap' }, h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, ['Shot', 'Scène', 'Grootte', 'Hoek', 'Beweging', 'Lens', 'Beschrijving', 'Status'].map((x) => h('th', {}, x)))),
      h('tbody', {}, rows.map(([sc, s, i]) => h('tr', { style: { opacity: s.status === 'geschrapt' ? 0.45 : 1 } },
        h('td', { class: 'mono' }, shotNo(sc, i, s)), h('td', { class: 'small' }, sc.heading), h('td', {}, short(s.size)), h('td', {}, s.angle), h('td', {}, s.move), h('td', {}, s.lens), h('td', {}, s.desc),
        h('td', {}, bind(s, 'status', ctx, { type: 'select', options: STATUS }))))))));
}

/* ---------- Tekeneditor ---------- */
function drawEditor(ctx, shot, ar) {
  const W = 1200, H = Math.round(W / ar);
  const cv = h('canvas', { class: 'draw-canvas', width: W, height: H });
  const g = cv.getContext('2d');
  const undo = [];
  const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => { g.drawImage(im, 0, 0, W, H); res(); }; im.onerror = res; im.src = src; });
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  if (shot.img) load(shot.img);
  let tool = 'pen', color = '#111', size = 4, drawing = false, last = null, start = null, snap = null;
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)]; };
  const pushUndo = () => { undo.push(g.getImageData(0, 0, W, H)); if (undo.length > 30) undo.shift(); };
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId); drawing = true; pushUndo();
    last = start = pos(e); snap = g.getImageData(0, 0, W, H);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const pt = pos(e);
    if (tool === 'arrow' || tool === 'frame') {
      g.putImageData(snap, 0, 0);
      g.strokeStyle = color; g.lineWidth = size; g.lineCap = 'round';
      if (tool === 'arrow') arrow(g, start, pt, size);
      else { g.setLineDash([12, 8]); g.strokeRect(start[0], start[1], pt[0] - start[0], pt[1] - start[1]); g.setLineDash([]); }
      return;
    }
    const pr = e.pressure && e.pointerType === 'pen' ? 0.4 + e.pressure : 1;
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = tool === 'eraser' ? '#fff' : tool === 'marker' ? hexA(color, 0.35) : color;
    g.lineWidth = (tool === 'eraser' ? size * 6 : tool === 'marker' ? size * 5 : size) * pr;
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(...last); g.lineTo(...pt); g.stroke();
    last = pt;
  });
  const end = () => { drawing = false; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

  const toolBtn = (id, label) => h('button', { class: 'btn sm' + (tool === id ? ' primary' : ''), type: 'button', 'data-tool': id, onclick: (e) => { tool = id; e.currentTarget.parentElement.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('primary', b.dataset.tool === id)); } }, label);
  const colors = ['#111', '#777', '#d33', '#2a6fd8', '#2b9a4a', '#f2b544'];
  const sw = h('div', { class: 'row' }, colors.map((c) => h('button', { class: 'swatch' + (c === color ? ' on' : ''), type: 'button', style: { background: c }, title: c, onclick: (e) => { color = c; sw.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('on', x === e.currentTarget)); } })));
  const sizeIn = h('input', { type: 'range', min: 1, max: 20, value: size, style: { width: '100px' }, oninput: (e) => { size = +e.target.value; } });

  modal({
    title: 'Storyboard tekenen', wide: true,
    body: h('div', { class: 'draw-wrap' },
      h('div', { class: 'row wrap' }, toolBtn('pen', 'Potlood'), toolBtn('marker', 'Stift'), toolBtn('arrow', 'Pijl (beweging)'), toolBtn('frame', 'Kader'), toolBtn('eraser', 'Gum'), sw, sizeIn,
        h('div', { class: 'spacer' }),
        btn('Ongedaan', () => { const u = undo.pop(); if (u) g.putImageData(u, 0, 0); }, { class: 'sm ghost' }),
        btn('Wissen', () => { pushUndo(); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); }, { class: 'sm ghost' }),
        btn('Foto/afbeelding', async () => { const [f] = await pickFile('image/*'); if (!f) return; pushUndo(); await load(await compressImage(f, 1600)); }, { class: 'sm ghost', icon: 'image' })),
      cv,
      h('p', { class: 'muted small' }, 'Tip: gebruik “Kader” voor de beelduitsnede van een volgend shot en “Pijl” voor camera- of acteursbeweging. Werkt met muis, touch en pen (drukgevoelig).')),
    actions: [
      { label: 'Annuleren' },
      shot.img ? { label: 'Beeld verwijderen', danger: true, onClick: async () => { if (await confirmDlg('Storyboardbeeld verwijderen?', 'Verwijderen', true)) { shot.img = ''; ctx.save(); ctx.rerender(); } } } : null,
      { label: 'Opslaan', primary: true, onClick: () => { shot.img = cv.toDataURL('image/jpeg', 0.85); ctx.save(); ctx.rerender(); } },
    ].filter(Boolean),
  });
}

function arrow(g, [x1, y1], [x2, y2], w) {
  const a = Math.atan2(y2 - y1, x2 - x1), L = 14 + w * 3;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
  g.moveTo(x2, y2); g.lineTo(x2 - L * Math.cos(a - 0.45), y2 - L * Math.sin(a - 0.45));
  g.moveTo(x2, y2); g.lineTo(x2 - L * Math.cos(a + 0.45), y2 - L * Math.sin(a + 0.45));
  g.stroke();
}
const hexA = (hex, a) => { const n = parseInt(hex.slice(1).replace(/^(.)(.)(.)$/, '$1$1$2$2$3$3'), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

function printShots(p, parsed, board) {
  const ar = AR[p.meta.aspect] || 16 / 9;
  const html = parsed.scenes.filter((sc) => (p.shots[sc.key] || []).length).map((sc) => {
    const list = p.shots[sc.key];
    if (board) {
      return `<h2>${esc(sc.num)}. ${esc(sc.heading)}</h2><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10pt">${list.map((s, i) => `<div style="break-inside:avoid"><div style="border:1px solid #333;aspect-ratio:${ar};display:flex;align-items:center;justify-content:center;overflow:hidden">${s.img ? `<img src="${s.img}" style="width:100%;height:100%;object-fit:cover">` : ''}</div><div style="font-size:8.5pt;margin-top:3pt"><b>${esc(shotNo(sc, i, s))}</b> ${esc(short(s.size))} · ${esc(s.move)}${s.lens ? ' · ' + esc(s.lens) + 'mm' : ''}<br>${esc(s.desc)}</div></div>`).join('')}</div>`;
    }
    return `<h2>${esc(sc.num)}. ${esc(sc.heading)}</h2><table><tr><th>Shot</th><th>Grootte</th><th>Hoek</th><th>Beweging</th><th>Lens</th><th>Beschrijving</th><th>Geluid</th><th>Apparatuur</th><th>✓</th></tr>${list.map((s, i) => `<tr><td><b>${esc(shotNo(sc, i, s))}</b></td><td>${esc(short(s.size))}</td><td>${esc(s.angle)}</td><td>${esc(s.move)}</td><td>${esc(s.lens)}</td><td>${esc(s.desc)}</td><td>${esc(s.sound)}</td><td>${esc(s.gear || '')}</td><td>${s.status === 'gedraaid' ? '✓' : ''}</td></tr>`).join('')}</table>`;
  }).join('');
  printDoc(`${p.meta.title} — ${board ? 'storyboard' : 'shotlist'}`, `<h1>${esc(p.meta.title)} — ${board ? 'Storyboard' : 'Shotlist'}</h1>${html || '<p>Geen shots.</p>'}`);
}
