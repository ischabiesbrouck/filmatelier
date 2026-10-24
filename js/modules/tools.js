import { h, fill, field, section, btn, pageHead, tabs, num, todayISO, toast } from '../util.js';
import { sunTimes, hhmm } from '../sun.js';
import { tcToFrames, framesToTc, FPS } from '../timecode.js';

let tab = 'sun';
const st = { date: todayISO(), lat: 52.3702, lon: 4.8952, focal: 35, fstop: 2.8, dist: 3, sensor: 's35', fpsTc: '24', tcA: '01:00:00:00', tcB: '00:00:10:12', frames: 1000,
  codec: 'prores422hq', res: 'uhd', fpsData: 24, minutes: 120, days: 25, cams: 1, copies: 3, mbps: null, pages: 100, ratio: 10, ppd: 4.5, fpsSh: 24, angle: 180,
  arW: 4096, arH: 2160, target: 2.39 };

const SENSORS = { ff: ['Full frame (36×24)', 36, 24, 0.030], lf: ['ARRI Alexa LF (36,7×25,5)', 36.7, 25.5, 0.030], s35: ['Super 35 (24,9×14)', 24.9, 14, 0.025], apsc: ['APS-C (23,5×15,6)', 23.5, 15.6, 0.020], mft: ['Micro Four Thirds (17,3×13)', 17.3, 13, 0.015], one: ['1 inch (13,2×8,8)', 13.2, 8.8, 0.011], s16: ['Super 16 (12,5×7,4)', 12.5, 7.4, 0.012], phone: ['Smartphone (≈ 9,8×7,3)', 9.8, 7.3, 0.006] };
// Mb/s bij 1080p 24 fps; wordt geschaald naar resolutie en framerate. Waarden zijn gangbare benaderingen.
const CODECS = { prores4444: ['ProRes 4444', 264], prores422hq: ['ProRes 422 HQ', 176], prores422: ['ProRes 422', 117], proreslt: ['ProRes 422 LT', 82], proresproxy: ['ProRes Proxy', 36], dnxhr_hq: ['DNxHR HQ', 145], braw5: ['Blackmagic RAW 5:1', 120], arriraw: ['ARRIRAW (benadering)', 560], h265: ['H.265 10-bit (camera)', 25], h264: ['H.264 (camera)', 50] };
const RES = { hd: ['HD 1920×1080', 1], '2k': ['2K DCI 2048×1080', 1.07], uhd: ['UHD 3840×2160', 4], '4k': ['4K DCI 4096×2160', 4.27], '6k': ['6K 6144×3240', 9.6], '8k': ['8K 7680×4320', 16] };

export default {
  id: 'gereedschap', title: 'Gereedschap', icon: 'calc', group: 'Gereedschap',
  render(root, ctx) {
    const sl = sessionStorage.getItem('fa.sunloc');
    if (sl) { sessionStorage.removeItem('fa.sunloc'); const v = JSON.parse(sl); if (v.lat && v.lon) { st.lat = +v.lat; st.lon = +v.lon; tab = 'sun'; } }
    else if (!st._init) { const l = ctx.project.locations.find((x) => x.lat && x.lon); if (l) { st.lat = +l.lat; st.lon = +l.lon; } st._init = true; }
    root.append(pageHead('Gereedschap', 'Rekenhulpen voor op de set en in de voorbereiding.'),
      tabs([['sun', 'Zon & licht'], ['dof', 'Scherptediepte & lens'], ['tc', 'Timecode'], ['data', 'Opslag'], ['time', 'Speelduur & ratio'], ['shutter', 'Sluiter'], ['ar', 'Beeldverhouding']], tab, (t) => { tab = t; ctx.rerender(); }));
    const body = h('div', {});
    root.append(body);
    ({ sun, dof, tc, data, time, shutter, ar })[tab](body, ctx);
  },
};

/** Invoerveld dat `st[key]` bijwerkt en de berekening opnieuw uitvoert. */
function inp(key, label, recalc, o = {}) {
  let el;
  if (o.options) {
    el = h('select', {}, Object.entries(o.options).map(([v, l]) => h('option', { value: v }, Array.isArray(l) ? l[0] : l)));
    el.value = st[key];
  } else {
    el = h('input', { type: o.type || 'number', step: o.step || 'any', min: o.min, value: st[key] ?? '' });
  }
  el.addEventListener(o.options ? 'change' : 'input', () => { st[key] = o.options || o.type === 'text' || o.type === 'date' ? el.value : parseFloat(el.value); recalc(); });
  return field(label, el, o.hint);
}
const res = (big, label, sub) => h('div', { class: 'result' }, h('div', { class: 'big' }, big), h('div', { class: 'muted small' }, label), sub ? h('div', { class: 'small' }, sub) : null);

function sun(body) {
  const out = h('div', { class: 'stack' });
  const calc = () => {
    const d = new Date(st.date + 'T12:00:00');
    const t = sunTimes(d, st.lat, st.lon);
    const mins = (x) => (x ? x.getHours() * 60 + x.getMinutes() : null);
    const seg = (a, b, col) => (mins(a) != null && mins(b) != null ? h('div', { style: { left: (mins(a) / 1440) * 100 + '%', width: ((mins(b) - mins(a)) / 1440) * 100 + '%', background: col } }) : null);
    const dayLen = t.sunrise && t.sunset ? (t.sunset - t.sunrise) / 36e5 : 0;
    fill(out,
      h('div', { class: 'sun-bar', title: '00:00 — 24:00' },
        seg(t.dawn, t.sunrise, '#3b4a8a'), seg(t.sunrise, t.goldenEnd, '#f2b544'), seg(t.goldenEnd, t.goldenStart, '#9fd3f5'), seg(t.goldenStart, t.sunset, '#f2b544'), seg(t.sunset, t.dusk, '#3b4a8a')),
      h('div', { class: 'row muted small', style: { justifyContent: 'space-between' } }, ['00', '06', '12', '18', '24'].map((x) => h('span', {}, x + ':00'))),
      h('div', { class: 'grid g4' },
        res(hhmm(t.dawn), 'Begin burgerlijke schemering', `Blauw uur tot ${hhmm(t.blueEnd)}`),
        res(hhmm(t.sunrise), 'Zonsopkomst', `Gouden uur tot ${hhmm(t.goldenEnd)}`),
        res(hhmm(t.noon), 'Zon het hoogst', `${dayLen.toFixed(1).replace('.', ',')} uur daglicht`),
        res(hhmm(t.sunset), 'Zonsondergang', `Gouden uur vanaf ${hhmm(t.goldenStart)}`),
        res(hhmm(t.dusk), 'Einde burgerlijke schemering', `Blauw uur vanaf ${hhmm(t.blueStart)}`)),
      h('p', { class: 'muted small' }, 'Tijden in de tijdzone van dit apparaat. Gouden uur: zon tussen 6° boven en −4° onder de horizon; blauw uur: tussen −4° en −6°.'));
  };
  body.append(section(null, h('div', { class: 'grid g4' },
    inp('date', 'Datum', calc, { type: 'date' }), inp('lat', 'Breedtegraad', calc), inp('lon', 'Lengtegraad', calc),
    h('div', { style: { alignSelf: 'end' } }, btn('Huidige positie', () => navigator.geolocation?.getCurrentPosition((p) => { st.lat = +p.coords.latitude.toFixed(4); st.lon = +p.coords.longitude.toFixed(4); body.replaceChildren(); sun(body); }, () => toast('Positie niet beschikbaar')), { icon: 'pin' }))),
  h('div', { style: { height: '14px' } }), out));
  calc();
}

function dof(body) {
  const out = h('div', { class: 'grid g4' });
  const calc = () => {
    const [, sw, sh, coc] = SENSORS[st.sensor];
    const f = st.focal, N = st.fstop, s = st.dist * 1000;
    const H = (f * f) / (N * coc) + f;
    const near = (s * (H - f)) / (H + s - 2 * f);
    const far = s >= H ? Infinity : (s * (H - f)) / (H - s);
    const hfov = 2 * Math.atan(sw / (2 * f)) * 180 / Math.PI, vfov = 2 * Math.atan(sh / (2 * f)) * 180 / Math.PI;
    const m = (x) => (x === Infinity ? '∞' : `${num(x / 1000, 2)} m`);
    const ffEq = f * (Math.hypot(36, 24) / Math.hypot(sw, sh));
    const wAt = 2 * st.dist * Math.tan((hfov * Math.PI / 180) / 2);
    out.replaceChildren(
      res(m(near), 'Nabije scherptegrens'), res(m(far), 'Verre scherptegrens'), res(far === Infinity ? '∞' : m(far - near), 'Totale scherptediepte'), res(m(H), 'Hyperfocale afstand', 'Focus hier: scherp van H/2 tot ∞'),
      res(`${num(hfov, 1)}°`, 'Horizontale beeldhoek', `verticaal ${num(vfov, 1)}°`), res(`${num(ffEq, 0)} mm`, 'Full-frame-equivalent'), res(`${num(wAt, 2)} m`, `Beeldbreedte op ${num(st.dist, 1)} m`), res(`${coc} mm`, 'Gebruikte cirkel van onscherpte'));
  };
  body.append(section(null, h('div', { class: 'grid g4' },
    inp('sensor', 'Sensor', calc, { options: SENSORS }), inp('focal', 'Brandpuntsafstand (mm)', calc), inp('fstop', 'Diafragma (f/ of T)', calc), inp('dist', 'Focusafstand (m)', calc)),
  h('div', { style: { height: '14px' } }), out));
  calc();
}

function tc(body) {
  const out = h('div', { class: 'grid g3' });
  const calc = () => {
    const a = tcToFrames(st.tcA, st.fpsTc), b = tcToFrames(st.tcB, st.fpsTc);
    const fps = parseFloat(st.fpsTc);
    out.replaceChildren(
      res(framesToTc(a + b, st.fpsTc), 'A + B'), res(framesToTc(a - b, st.fpsTc), 'A − B'), res(`${num(a)} frames`, 'A in frames', `${num(a / fps, 2)} s werkelijke tijd`),
      res(framesToTc(st.frames || 0, st.fpsTc), `${num(st.frames || 0)} frames als timecode`), res(`${num((st.frames || 0) / fps, 2)} s`, 'Frames in seconden'), res(`${num(b)} frames`, 'B in frames'));
  };
  body.append(section(null, h('div', { class: 'grid g4' },
    inp('fpsTc', 'Framerate', calc, { options: Object.fromEntries(FPS) }), inp('tcA', 'Timecode A', calc, { type: 'text' }), inp('tcB', 'Timecode B', calc, { type: 'text' }), inp('frames', 'Aantal frames', calc)),
  h('div', { style: { height: '14px' } }), out));
  calc();
}

function data(body) {
  const out = h('div', { class: 'grid g4' });
  const mb = h('input', { type: 'number', step: 'any' });
  const calc = (fromCodec = false) => {
    const auto = CODECS[st.codec][1] * RES[st.res][1] * (st.fpsData / 24);
    if (fromCodec || st.mbps == null) { st.mbps = Math.round(auto); mb.value = st.mbps; }
    const gbPerMin = (st.mbps * 60) / 8 / 1000;
    const perDay = gbPerMin * st.minutes * st.cams;
    const total = perDay * st.days;
    out.replaceChildren(
      res(`${num(gbPerMin, 2)} GB`, 'Per minuut per camera'), res(`${num(perDay / 1000, 2)} TB`, 'Per draaidag', `${num(perDay)} GB`),
      res(`${num(total / 1000, 1)} TB`, 'Hele productie (1 kopie)'), res(`${num((total * st.copies) / 1000, 1)} TB`, `Met ${st.copies} kopieën (back-up)`, 'Regel 3-2-1: 3 kopieën, 2 media, 1 elders'));
  };
  mb.addEventListener('input', () => { st.mbps = parseFloat(mb.value) || 0; calc(); });
  const recalcCodec = () => calc(true);
  body.append(section(null, h('div', { class: 'grid g4' },
    inp('codec', 'Codec', recalcCodec, { options: CODECS }), inp('res', 'Resolutie', recalcCodec, { options: RES }), inp('fpsData', 'Framerate', recalcCodec), field('Bitrate (Mb/s, aanpasbaar)', mb, 'Controleer de exacte waarde in de specificaties van je camera'),
    inp('minutes', 'Opgenomen minuten per dag per camera', calc), inp('cams', 'Aantal camera’s', calc), inp('days', 'Draaidagen', calc), inp('copies', 'Aantal kopieën', calc)),
  h('div', { style: { height: '14px' } }), out));
  calc(true);
}

function time(body, ctx) {
  const parsed = ctx.parsed();
  if (st.pages === 100 && parsed.pages) st.pages = parsed.pages;
  const out = h('div', { class: 'grid g4' });
  const calc = () => {
    out.replaceChildren(
      res(`${num(st.pages)} min`, 'Geschatte speelduur', 'Vuistregel: 1 pagina ≈ 1 minuut'),
      res(`${num(st.pages / st.ppd, 1)}`, 'Benodigde draaidagen', `bij ${num(st.ppd, 1)} pagina’s per dag`),
      res(`${num((st.pages * st.ratio) / 60, 1)} uur`, 'Totaal materiaal', `opnameverhouding ${st.ratio}:1`),
      res(`${num((st.pages * st.ratio) / (st.pages / st.ppd || 1))} min`, 'Materiaal per draaidag'));
  };
  body.append(section(null, h('div', { class: 'grid g3' },
    inp('pages', 'Pagina’s scenario', calc, { hint: `Huidig scenario: ${parsed.pages} pagina’s` }), inp('ppd', 'Pagina’s per draaidag', calc, { hint: 'Speelfilm: 3–5; low budget: 5–8' }), inp('ratio', 'Opnameverhouding (x:1)', calc, { hint: 'Fictie digitaal: 10–30:1' })),
  h('div', { style: { height: '14px' } }), out));
  calc();
}

function shutter(body) {
  const out = h('div', { class: 'grid g3' });
  const calc = () => {
    const speed = (st.fpsSh * 360) / st.angle;
    out.replaceChildren(
      res(`1/${num(speed, 0)} s`, `Sluitertijd bij ${st.angle}° en ${st.fpsSh} fps`),
      res(`1/${num(st.fpsSh * 2, 0)} s`, '180°-regel (natuurlijke bewegingsonscherpte)'),
      res(st.fpsSh > 30 ? `${num(st.fpsSh / 24, 2)}× vertraagd` : '—', 'Slow motion bij afspelen op 24 fps'));
  };
  body.append(section(null, h('div', { class: 'grid g3' }, inp('fpsSh', 'Framerate (fps)', calc), inp('angle', 'Sluiterhoek (°)', calc, { hint: '45° = staccato (actie), 180° = normaal, 360° = vloeiend/dromerig' })),
    h('div', { style: { height: '14px' } }), out, h('p', { class: 'muted small', style: { marginTop: '10px' } }, 'Flikkering bij kunstlicht in Europa (50 Hz): kies 1/50, 1/100 of een sluiterhoek van 172,8° bij 24 fps.')));
  calc();
}

function ar(body) {
  const out = h('div', { class: 'stack' });
  const calc = () => {
    const src = st.arW / st.arH;
    let w = st.arW, hh = st.arH;
    if (st.target > src) hh = Math.round(st.arW / st.target); else w = Math.round(st.arH * st.target);
    const pct = ((w * hh) / (st.arW * st.arH)) * 100;
    out.replaceChildren(
      h('div', { class: 'grid g3' }, res(`${w} × ${hh}`, 'Beeldvlak binnen opname'), res(`${num(pct, 1)}%`, 'Gebruikt deel van de sensor'), res(st.target > src ? `${Math.round((st.arH - hh) / 2)} px` : `${Math.round((st.arW - w) / 2)} px`, st.target > src ? 'Balk boven en onder' : 'Balk links en rechts')),
      h('div', { class: 'frame-guide', style: { aspectRatio: `${st.arW}/${st.arH}`, maxWidth: '560px' } },
        h('div', { class: 'inner', style: { width: (w / st.arW) * 100 + '%', height: (hh / st.arH) * 100 + '%' } }, `${st.target}:1`)));
  };
  body.append(section(null, h('div', { class: 'grid g3' },
    inp('arW', 'Opnamebreedte (px)', calc), inp('arH', 'Opnamehoogte (px)', calc),
    inp('target', 'Doelverhouding', calc, { options: { 2.39: '2,39:1 (scope)', 2: '2:1 (univisium)', 1.85: '1,85:1 (flat)', 1.78: '16:9', 1.66: '1,66:1', 1.5: '3:2', 1.33: '4:3', 1: '1:1', 0.5625: '9:16 (verticaal)' } })),
  h('div', { style: { height: '14px' } }), out));
  const s = body.querySelector('select'); if (s) s.value = String(st.target);
  st.target = parseFloat(st.target);
  calc();
}
