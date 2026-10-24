import { h, bind, btn, iconBtn, pageHead, empty, uid, todayISO, download, slug, eighths, fmtDate, esc, printDoc } from '../util.js';
import { shotNo } from './shots.js';

const STATUS = [['goed', 'Goed ✓'], ['print', 'Print ★'], ['ng', 'NG ✗'], ['inc', 'Incompleet'], ['fs', 'False start']];
let day = todayISO();

export default {
  id: 'opnamelog', title: 'Opnamelog', icon: 'list', group: 'Productie',
  render(root, ctx) {
    const p = ctx.project;
    const parsed = ctx.parsed();
    const byKey = Object.fromEntries(parsed.scenes.map((s) => [s.key, s]));
    const dates = [...new Set([todayISO(), ...p.takes.map((t) => t.date)])].sort().reverse();
    const takes = p.takes.filter((t) => t.date === day);
    const last = takes[takes.length - 1];
    const add = (base) => {
      const t = base ? { ...base, id: uid(), take: (Number(base.take) || 0) + 1, status: 'goed', notes: '', tc: '' }
        : { id: uid(), date: day, sceneKey: parsed.scenes[0]?.key || '', shot: '', take: 1, camRoll: 'A001', soundRoll: 'S001', tc: '', lens: '', status: 'goed', notes: '' };
      p.takes.push(t); ctx.save(); ctx.rerender();
    };
    const daySel = h('input', { type: 'date', value: day, style: { width: 'auto' }, onchange: (e) => { day = e.target.value || todayISO(); ctx.rerender(); } });
    const doneScenes = p.schedule.days.find((d) => d.date === day)?.scenes || [];
    const shotScenes = [...new Set(takes.map((t) => t.sceneKey))];
    const setups = new Set(takes.map((t) => t.sceneKey + '|' + t.shot)).size;

    root.append(pageHead('Opnamelog', 'Take-registratie voor script supervisor en camera: per take scène, shot, rolnummers, timecode en continuïteitsnotities. Dient als dagrapport.',
      btn(last ? `Volgende take (${(Number(last.take) || 0) + 1})` : 'Eerste take', () => add(last), { icon: 'plus', class: 'primary' }),
      btn('Nieuw shot', () => add(last ? { ...last, take: 0, shot: '' } : null), { icon: 'camera' }),
      btn('Dagrapport', () => printReport(p, day, takes, byKey), { icon: 'print', class: 'ghost' }),
      btn('CSV voor montage', () => download(`${slug(p.meta.title)}-opnamelog.csv`, toCSV(p.takes, byKey), 'text/csv;charset=utf-8'), { icon: 'download', class: 'ghost' })),
    h('div', { class: 'row wrap', style: { marginBottom: '14px' } }, h('label', { class: 'check' }, 'Draaidag', daySel),
      h('div', { class: 'chips' }, dates.slice(0, 8).map((d) => h('button', { class: 'chip' + (d === day ? ' on' : ''), type: 'button', onclick: () => { day = d; ctx.rerender(); } }, fmtDate(d, { day: 'numeric', month: 'short' }))))),
    h('div', { class: 'grid g4', style: { marginBottom: '14px' } },
      h('div', { class: 'stat' }, h('div', { class: 'v' }, takes.length), h('div', { class: 'l' }, 'Takes')),
      h('div', { class: 'stat' }, h('div', { class: 'v' }, setups), h('div', { class: 'l' }, 'Setups')),
      h('div', { class: 'stat' }, h('div', { class: 'v' }, shotScenes.length), h('div', { class: 'l' }, 'Scènes gedraaid'), h('div', { class: 's' }, doneScenes.length ? `${doneScenes.length} gepland vandaag` : '')),
      h('div', { class: 'stat' }, h('div', { class: 'v' }, eighths(shotScenes.reduce((a, k) => a + (byKey[k]?.eighths || 0), 0))), h('div', { class: 'l' }, 'Pagina’s'))));

    if (!takes.length) { root.append(empty('Nog geen takes op deze dag.', btn('Eerste take', () => add(null), { icon: 'plus' }))); return; }
    const sceneOpts = parsed.scenes.map((s) => [s.key, `${s.num} · ${s.location.slice(0, 22)}`]);
    root.append(h('div', { class: 'card table-wrap' }, h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, ['Scène', 'Shot', 'Take', 'Camerarol', 'Geluidsrol', 'TC in', 'Lens', 'Status', 'Notities / continuïteit', ''].map((x) => h('th', {}, x)))),
      h('tbody', {}, takes.map((t) => {
        const sc = byKey[t.sceneKey];
        const shots = (p.shots[t.sceneKey] || []).map((s, i) => shotNo(sc, i, s));
        return h('tr', { style: { opacity: t.status === 'ng' || t.status === 'fs' ? 0.6 : 1 } },
          h('td', { style: { minWidth: '150px' } }, bind(t, 'sceneKey', ctx, { type: 'select', options: sceneOpts, onchange: () => ctx.rerender() })),
          h('td', { style: { width: '80px' } }, bind(t, 'shot', ctx, { list: 'shots-' + t.id, placeholder: '1A' }), h('datalist', { id: 'shots-' + t.id }, shots.map((s) => h('option', { value: s })))),
          h('td', { style: { width: '60px' } }, bind(t, 'take', ctx, { type: 'number', min: 1 })),
          h('td', { style: { width: '90px' } }, bind(t, 'camRoll', ctx)),
          h('td', { style: { width: '90px' } }, bind(t, 'soundRoll', ctx)),
          h('td', { style: { width: '120px' } }, bind(t, 'tc', ctx, { placeholder: '00:00:00:00', class: 'mono' })),
          h('td', { style: { width: '70px' } }, bind(t, 'lens', ctx, { placeholder: 'mm' })),
          h('td', { style: { width: '120px' } }, bind(t, 'status', ctx, { type: 'select', options: STATUS, onchange: (v) => {
            if (v === 'goed' || v === 'print') { const i = shots.indexOf(t.shot); if (i >= 0) { p.shots[t.sceneKey][i].status = 'gedraaid'; ctx.save(); } }
            ctx.rerender();
          } })),
          h('td', { style: { minWidth: '220px' } }, bind(t, 'notes', ctx, { placeholder: 'bijv. glas in linkerhand, jas open' })),
          h('td', {}, iconBtn('trash', 'Verwijderen', () => { p.takes.splice(p.takes.indexOf(t), 1); ctx.save(); ctx.rerender(); }, 'danger')));
      })))));
  },
};

function toCSV(takes, byKey) {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  return '﻿' + [['Datum', 'Scène', 'Shot', 'Take', 'Camerarol', 'Geluidsrol', 'TC in', 'Lens', 'Status', 'Notities'].join(';'),
    ...takes.map((t) => [t.date, byKey[t.sceneKey]?.num ?? '', t.shot, t.take, t.camRoll, t.soundRoll, t.tc, t.lens, t.status, t.notes].map(q).join(';'))].join('\r\n');
}

function printReport(p, day, takes, byKey) {
  const lbl = Object.fromEntries(STATUS);
  printDoc(`Dagrapport ${day}`, `<h1>${esc(p.meta.title)} — Dagrapport</h1><p>${fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
  <table><tr><th>Scène</th><th>Shot</th><th>Take</th><th>Cam</th><th>Geluid</th><th>TC</th><th>Status</th><th>Notities</th></tr>
  ${takes.map((t) => `<tr><td>${esc(byKey[t.sceneKey]?.num ?? '')}</td><td>${esc(t.shot)}</td><td>${esc(String(t.take))}</td><td>${esc(t.camRoll)}</td><td>${esc(t.soundRoll)}</td><td>${esc(t.tc)}</td><td>${lbl[t.status] || ''}</td><td>${esc(t.notes)}</td></tr>`).join('')}</table>
  <p>Takes: ${takes.length} · Setups: ${new Set(takes.map((t) => t.sceneKey + '|' + t.shot)).size} · Scènes: ${[...new Set(takes.map((t) => byKey[t.sceneKey]?.num))].join(', ')}</p>`);
}
