import { h, bind, btn, pageHead, tabs, uid, esc, printDoc, money } from '../util.js';
import { gridEditor } from '../grid.js';
import { DELIVERABLES } from '../store.js';
import { tcToFrames, framesToTc, FPS } from '../timecode.js';

let tab = 'cuts';

export default {
  id: 'post', title: 'Postproductie', icon: 'film', group: 'Post & distributie',
  render(root, ctx) {
    const p = ctx.project, P = p.post;
    P.fps ??= '24';
    const parsed = ctx.parsed();
    const sceneList = h('datalist', { id: 'post-scenes' }, parsed.scenes.map((s) => h('option', { value: s.num }, s.heading)));
    const chars = h('datalist', { id: 'post-chars' }, Object.keys(parsed.characters).map((c) => h('option', { value: c })));
    root.append(pageHead('Postproductie', 'Montageversies, VFX-shots, muziekcues, ADR en deliverables bijhouden tot de eindoplevering.',
      btn('AI: postplanning', () => ctx.openAI('Maak een realistische postproductieplanning (weken) voor mijn film: montage, picture lock, geluid, muziek, kleur, VFX, mix en deliverables. Benoem afhankelijkheden.'), { icon: 'sparkles', class: 'ghost' })),
    sceneList, chars,
    tabs([['cuts', `Montageversies (${P.reels.length})`], ['vfx', `VFX (${P.vfx.length})`], ['cues', `Muziekcues (${P.cues.length})`], ['adr', `ADR (${P.adr.length})`], ['deliv', 'Deliverables']], tab, (t) => { tab = t; ctx.rerender(); }));

    if (tab === 'cuts') {
      root.append(h('p', { class: 'muted' }, 'Houd elke versie bij met looptijd en feedback van screenings. Doel: ', h('b', {}, `${p.meta.runtime} min`), '.'),
        gridEditor(ctx, P.reels, [
          { key: 'name', label: 'Versie', placeholder: 'Assembly / Rough cut 1 / Fine cut…', width: '180px' },
          { key: 'date', label: 'Datum', type: 'date', width: '140px' },
          { key: 'runtime', label: 'Duur (min)', type: 'number', width: '90px' },
          { key: 'notes', label: 'Feedback / notities', type: 'textarea' },
          { key: 'locked', label: 'Picture lock', type: 'checkbox', width: '60px' },
        ], () => ({ name: `Versie ${P.reels.length + 1}`, date: new Date().toISOString().slice(0, 10), runtime: '', notes: '', locked: false }), { addLabel: 'Versie toevoegen', emptyText: 'Nog geen montageversies.' }));
    } else if (tab === 'vfx') {
      const total = P.vfx.reduce((a, v) => a + (Number(v.cost) || 0), 0);
      root.append(h('p', { class: 'muted' }, `${P.vfx.length} VFX-shots · ${P.vfx.filter((v) => v.status === 'Final').length} final · totaal ${money(total, p.budget.currency)}`),
        gridEditor(ctx, P.vfx, [
          { key: 'code', label: 'ID', placeholder: 'VFX_010', width: '90px' },
          { key: 'scene', label: 'Scène', list: 'post-scenes', width: '70px' },
          { key: 'shot', label: 'Shot', width: '70px' },
          { key: 'desc', label: 'Omschrijving', type: 'textarea', placeholder: 'Wire removal, sky replacement…' },
          { key: 'vendor', label: 'Leverancier', width: '130px' },
          { key: 'status', label: 'Status', type: 'select', options: ['Te bieden', 'Toegekend', 'In productie', 'Review', 'Final', 'Geschrapt'], width: '130px' },
          { key: 'cost', label: 'Kosten', type: 'number', width: '100px' },
          { key: 'due', label: 'Deadline', type: 'date', width: '140px' },
        ], () => ({ code: `VFX_${String((P.vfx.length + 1) * 10).padStart(3, '0')}`, scene: '', shot: '', desc: '', vendor: '', status: 'Te bieden', cost: '', due: '' }), { addLabel: 'VFX-shot toevoegen', emptyText: 'Nog geen VFX-shots.' }));
    } else if (tab === 'cues') {
      const fpsSel = bind(P, 'fps', ctx, { type: 'select', options: FPS, onchange: () => ctx.rerender(), style: 'width:auto' });
      const dur = (c) => (c.in && c.out ? framesToTc(tcToFrames(c.out, P.fps) - tcToFrames(c.in, P.fps), P.fps) : '');
      const updDur = (c) => { const el = root.querySelector(`[data-dur="${c.id}"]`); if (el) el.textContent = dur(c); };
      root.append(h('div', { class: 'row wrap', style: { marginBottom: '10px' } }, h('label', { class: 'check' }, 'Framerate', fpsSel), h('div', { class: 'spacer' }),
        btn('Cuesheet afdrukken', () => printCues(p, dur), { icon: 'print', class: 'sm' })),
        gridEditor(ctx, P.cues, [
          { key: 'cue', label: 'Cue', placeholder: '1M1', width: '70px' },
          { key: 'title', label: 'Titel', width: '160px' },
          { key: 'scene', label: 'Scène', list: 'post-scenes', width: '70px' },
          { key: 'in', label: 'TC in', placeholder: '01:00:00:00', width: '120px', onchange: (v, c) => updDur(c) },
          { key: 'out', label: 'TC uit', placeholder: '01:01:30:00', width: '120px', onchange: (v, c) => updDur(c) },
          { key: 'dur', label: 'Duur', render: (c) => h('span', { class: 'mono', 'data-dur': c.id }, dur(c)) },
          { key: 'type', label: 'Gebruik', type: 'select', options: ['Score (achtergrond)', 'Source (in beeld)', 'Vocaal', 'Titel'], width: '150px' },
          { key: 'composer', label: 'Componist / uitgever', width: '170px' },
          { key: 'rights', label: 'Rechten', type: 'select', options: ['Origineel (eigen)', 'Aan te vragen', 'Aangevraagd', 'Geklaard', 'Afgewezen'], width: '140px' },
        ], () => ({ cue: `1M${P.cues.length + 1}`, title: '', scene: '', in: '', out: '', type: 'Score (achtergrond)', composer: '', rights: 'Origineel (eigen)' }), { addLabel: 'Cue toevoegen', emptyText: 'Nog geen muziekcues.' }));
    } else if (tab === 'adr') {
      root.append(gridEditor(ctx, P.adr, [
        { key: 'character', label: 'Personage', list: 'post-chars', width: '130px' },
        { key: 'scene', label: 'Scène', list: 'post-scenes', width: '70px' },
        { key: 'tc', label: 'TC', width: '120px' },
        { key: 'line', label: 'Tekst', type: 'textarea' },
        { key: 'reason', label: 'Reden', type: 'select', options: ['Ruis / techniek', 'Performance', 'Tekstwijziging', 'Toegevoegd (wild line)', 'Walla / achtergrond'], width: '150px' },
        { key: 'status', label: 'Status', type: 'select', options: ['Te plannen', 'Gepland', 'Opgenomen', 'Ingemixt'], width: '120px' },
      ], () => ({ character: '', scene: '', tc: '', line: '', reason: 'Ruis / techniek', status: 'Te plannen' }), { addLabel: 'ADR-regel toevoegen', emptyText: 'Nog geen ADR-regels.' }));
    } else {
      if (!P.deliverables.length) P.deliverables = DELIVERABLES.map((name) => ({ id: uid(), name, done: false, notes: '' }));
      const done = P.deliverables.filter((d) => d.done).length;
      root.append(h('div', { class: 'stack tight', style: { marginBottom: '10px' } }, h('div', { class: 'row' }, h('span', { class: 'muted' }, `${done}/${P.deliverables.length} geleverd`)),
        h('div', { class: 'progress' }, h('i', { style: { width: `${(done / P.deliverables.length) * 100}%` } }))),
      gridEditor(ctx, P.deliverables, [
        { key: 'done', label: '✓', type: 'checkbox', width: '40px', onchange: () => ctx.rerender() },
        { key: 'name', label: 'Deliverable', width: '240px' },
        { key: 'notes', label: 'Specificatie / notities', type: 'textarea' },
      ], () => ({ name: '', done: false, notes: '' }), { addLabel: 'Deliverable toevoegen' }));
    }
  },
};

function printCues(p, dur) {
  printDoc(`${p.meta.title} — muziekcuesheet`, `<h1>${esc(p.meta.title)} — Muziekcuesheet</h1><p class="muted">Framerate ${esc(p.post.fps)}</p>
  <table><tr><th>Cue</th><th>Titel</th><th>Sc.</th><th>In</th><th>Uit</th><th>Duur</th><th>Gebruik</th><th>Componist / uitgever</th><th>Rechten</th></tr>
  ${p.post.cues.map((c) => `<tr><td>${esc(c.cue)}</td><td>${esc(c.title)}</td><td>${esc(c.scene)}</td><td>${esc(c.in)}</td><td>${esc(c.out)}</td><td>${esc(dur(c))}</td><td>${esc(c.type)}</td><td>${esc(c.composer)}</td><td>${esc(c.rights)}</td></tr>`).join('')}</table>`);
}
