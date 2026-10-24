import { h, section, btn, icon, pageHead, empty, field } from '../util.js';

// Leesrepetitie (table read) met de spraakstemmen van het besturingssysteem/de browser.
// Elk personage krijgt een eigen stem + toonhoogte; de verteller leest scènekoppen en actie.

const NARRATOR = '__verteller';
const PITCHES = [1, 0.82, 1.18, 0.92, 1.1, 0.75, 1.25, 1.03];
let idx = 0;
let playing = false;
let run = 0; // verhoogd bij elke start/stop zodat oude callbacks niets meer doen

const clean = (s) => String(s || '').replace(/[*_]/g, '').replace(/\s+/g, ' ').trim();
const speakHeading = (t) => clean(t).replace(/^INT\.?\/EXT\.?\s*/i, 'Binnen en buiten. ').replace(/^INT\.?\s*/i, 'Binnen. ').replace(/^EXT\.?\s*/i, 'Buiten. ').replace(/\s+[-–—]\s+/g, ', ').replace(/#[^#]+#/g, '').toLowerCase();

export function buildQueue(parsed, { narrate = true, headings = true } = {}) {
  const q = [];
  let who = null;
  for (const t of parsed.tokens) {
    if (t.type === 'scene_heading') { who = null; q.push({ kind: 'h', who: NARRATOR, text: t.text, say: speakHeading(t.text), scene: t.scene, skip: !headings }); }
    else if (t.type === 'action' || t.type === 'centered') { who = null; q.push({ kind: 'a', who: NARRATOR, text: t.text, say: clean(t.text), scene: t.scene, skip: !narrate }); }
    else if (t.type === 'character') who = t.name;
    else if ((t.type === 'dialogue' || t.type === 'lyrics') && who) q.push({ kind: 'd', who, label: t.name || who, text: t.text, say: clean(t.text), scene: t.scene });
  }
  return q;
}

export default {
  id: 'leesrepetitie', title: 'Leesrepetitie', icon: 'volume', group: 'Schrijven',
  render(root, ctx) {
    const p = ctx.project;
    const TR = p.tableRead ??= { voices: {}, pitch: {}, rate: 1, narrate: true, headings: true };
    TR.voices ??= {}; TR.pitch ??= {};
    const synth = window.speechSynthesis;
    root.append(pageHead('Leesrepetitie', 'Laat je scenario voorlezen: elk personage een eigen stem, de verteller leest koppen en actie. Hoor waar dialoog stroef loopt of een scène te lang duurt.'));
    if (!synth) { root.append(empty('Deze browser ondersteunt geen spraak (Web Speech API). Probeer Chrome, Edge of Safari.')); return; }
    const parsed = ctx.parsed();
    if (!parsed.tokens.some((t) => t.type === 'dialogue')) { root.append(empty('Nog geen dialoog om voor te lezen.', btn('Naar scenario', () => ctx.go('scenario'), { icon: 'pen' }))); return; }

    let queue = buildQueue(parsed, TR);
    if (idx >= queue.length) idx = 0;
    const cast = Object.values(parsed.characters).sort((a, b) => b.lines - a.lines).map((c) => c.name);
    const roles = [NARRATOR, ...cast];

    const voiceBox = h('div', { class: 'stack tight' });
    const scriptEl = h('div', { class: 'tr-script', 'aria-label': 'Scenario' });
    const playBtn = h('button', { class: 'go', type: 'button', 'aria-label': 'Afspelen', onclick: () => (playing ? pause() : play()) }, icon('play', 20));
    const status = h('div', { class: 'muted small' });

    const voices = () => synth.getVoices();
    const nlVoices = () => { const v = voices(); const nl = v.filter((x) => /^nl/i.test(x.lang)); return nl.length ? nl : v; };
    const voiceFor = (who) => {
      const v = voices();
      const chosen = v.find((x) => x.voiceURI === TR.voices[who]);
      if (chosen) return chosen;
      const pool = nlVoices();
      return pool.length ? pool[roles.indexOf(who) % pool.length] : null;
    };
    const pitchFor = (who) => TR.pitch[who] ?? PITCHES[Math.max(0, roles.indexOf(who)) % PITCHES.length];

    function drawVoices() {
      const v = voices();
      const sorted = [...v].sort((a, b) => (/^nl/i.test(b.lang) - /^nl/i.test(a.lang)) || a.name.localeCompare(b.name));
      voiceBox.replaceChildren(...roles.slice(0, 16).map((r) => {
        const sel = h('select', { 'aria-label': `Stem voor ${r === NARRATOR ? 'verteller' : r}`, onchange: (e) => { TR.voices[r] = e.target.value; ctx.save(); } },
          h('option', { value: '' }, 'Automatisch'), sorted.map((x) => h('option', { value: x.voiceURI }, `${x.name} (${x.lang})`)));
        sel.value = TR.voices[r] || '';
        const pitch = h('input', { type: 'range', min: 0.5, max: 1.6, step: 0.05, value: pitchFor(r), title: 'Toonhoogte', 'aria-label': 'Toonhoogte', oninput: (e) => { TR.pitch[r] = +e.target.value; ctx.save(); } });
        return h('div', { class: 'tr-voice' }, h('b', {}, r === NARRATOR ? 'Verteller' : r), sel, pitch);
      }), v.length ? null : h('p', { class: 'muted small' }, 'Stemmen worden geladen… Op sommige systemen moet je eerst een Nederlandse stem installeren (Windows: Instellingen → Tijd en taal → Spraak).'));
    }

    function drawScript() {
      scriptEl.replaceChildren(...queue.map((it, i) => {
        const el = it.kind === 'd'
          ? h('div', { class: 'tr-line c', 'data-i': i }, h('b', {}, it.label), h('span', {}, it.text))
          : h('div', { class: 'tr-line' + (it.kind === 'h' ? ' h' : ''), 'data-i': i, style: it.skip ? { opacity: 0.45 } : null }, it.text);
        el.addEventListener('click', () => { idx = i; play(); });
        return el;
      }));
      mark();
    }

    function mark() {
      scriptEl.querySelector('.now')?.classList.remove('now');
      const el = scriptEl.querySelector(`[data-i="${idx}"]`);
      el?.classList.add('now');
      if (el && playing) {
        const r = el.getBoundingClientRect(), c = scriptEl.getBoundingClientRect();
        if (r.top < c.top + 40 || r.bottom > c.bottom - 40) scriptEl.scrollTop += r.top - c.top - c.height / 3;
      }
      const s = parsed.scenes[queue[idx]?.scene];
      status.textContent = s ? `Scène ${s.num} · ${s.heading}` : '';
    }

    function speak(i, token) {
      while (i < queue.length && queue[i].skip) i++;
      if (token !== run) return;
      if (i >= queue.length) { stop(); idx = 0; mark(); return; }
      idx = i; mark();
      const it = queue[i];
      const u = new SpeechSynthesisUtterance(it.say);
      const v = voiceFor(it.who);
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'nl-NL';
      u.rate = Number(TR.rate) || 1;
      u.pitch = pitchFor(it.who);
      u.onend = () => { if (token === run && playing) setTimeout(() => speak(i + 1, token), it.kind === 'h' ? 350 : 120); };
      u.onerror = (e) => { if (token === run && playing && !['interrupted', 'canceled'].includes(e.error)) setTimeout(() => speak(i + 1, token), 50); };
      synth.speak(u);
    }
    function play() {
      synth.cancel();
      playing = true; run++;
      playBtn.replaceChildren(icon('pause', 20)); playBtn.setAttribute('aria-label', 'Pauzeren');
      speak(idx, run);
    }
    function pause() {
      playing = false; run++; synth.cancel();
      playBtn.replaceChildren(icon('play', 20)); playBtn.setAttribute('aria-label', 'Afspelen');
    }
    function stop() { pause(); }

    const sceneSel = h('select', { 'aria-label': 'Begin bij scène', onchange: (e) => { const k = queue.findIndex((q) => q.scene === +e.target.value); if (k >= 0) { idx = k; if (playing) play(); else mark(); } } },
      parsed.scenes.map((s) => h('option', { value: s.index }, `${s.num}. ${s.heading}`)));
    sceneSel.value = String(queue[idx]?.scene ?? 0);
    const rate = h('input', { type: 'range', min: 0.6, max: 1.8, step: 0.05, value: TR.rate || 1, 'aria-label': 'Tempo', oninput: (e) => { TR.rate = +e.target.value; rateLbl.textContent = `${(+e.target.value).toFixed(2)}×`; ctx.save(); } });
    const rateLbl = h('span', { class: 'small', style: { minWidth: '44px' } }, `${(TR.rate || 1).toFixed(2)}×`);
    const opt = (k, label) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: TR[k] !== false, onchange: (e) => { TR[k] = e.target.checked; ctx.save(); queue = buildQueue(parsed, TR); drawScript(); } }), label);
    const totalWords = queue.reduce((a, q) => a + (q.skip ? 0 : q.say.split(' ').length), 0);

    root.append(h('div', { class: 'tr-wrap' },
      h('div', { class: 'stack tr-controls' },
        section(null,
          h('div', { class: 'tr-player' }, playBtn,
            h('button', { class: 'icon-btn', type: 'button', title: 'Volgende regel', 'aria-label': 'Volgende regel', onclick: () => { idx = Math.min(queue.length - 1, idx + 1); playing ? play() : mark(); } }, icon('skip', 18)),
            h('button', { class: 'icon-btn', type: 'button', title: 'Terug naar begin', 'aria-label': 'Terug naar begin', onclick: () => { stop(); idx = 0; mark(); scriptEl.scrollTop = 0; } }, icon('stop', 18)),
            h('div', { style: { flex: 1, minWidth: 0 } }, status)),
          h('div', { class: 'stack', style: { marginTop: '16px' } },
            field('Begin bij scène', sceneSel),
            field('Tempo', h('div', { class: 'row' }, rate, rateLbl)),
            opt('narrate', 'Actie voorlezen'), opt('headings', 'Scènekoppen voorlezen'),
            h('p', { class: 'faint small' }, `≈ ${Math.round(totalWords / (150 * (TR.rate || 1)))} minuten voorleestijd bij dit tempo.`))),
        section('Stemmen', h('p', { class: 'muted small' }, 'Weinig Nederlandse stemmen? Dan helpt een andere toonhoogte per rol om ze uit elkaar te houden.'), voiceBox)),
      scriptEl));

    drawVoices();
    drawScript();
    const onVoices = () => drawVoices();
    synth.addEventListener?.('voiceschanged', onVoices);
    return () => { playing = false; run++; synth.cancel(); synth.removeEventListener?.('voiceschanged', onVoices); };
  },
};
