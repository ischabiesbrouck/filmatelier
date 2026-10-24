import { h, bind, section, btn, pageHead, tabs, words, esc, printDoc, download, slug } from '../util.js';

const DOCS = [
  ['premise', 'Premisse', 120, 'De kern in een paar zinnen: wie, wat, waarom nu, en welke vraag de film stelt.'],
  ['synopsis', 'Synopsis', 500, 'Het hele verhaal inclusief einde, in de tegenwoordige tijd. ±½–1 pagina.'],
  ['onepager', 'One-pager', 700, 'Synopsis + toon, thema en waarom dit publiek dit wil zien. Voor fondsen en producenten.'],
  ['treatment', 'Treatment', 6000, 'Het verhaal scène voor scène in proza, 10–30 pagina’s. Beeldend, in de tegenwoordige tijd.'],
  ['pitch', 'Pitch', 250, 'Wat je zegt als je 60 seconden hebt. Begin met de haak.'],
  ['statement', 'Regievisie', 800, 'Waarom jij, waarom nu, en hoe de film eruit gaat zien en voelen.'],
];
let tab = 'synopsis';

export default {
  id: 'treatment', title: 'Synopsis & treatment', icon: 'doc', group: 'Ontwikkeling',
  render(root, ctx) {
    const p = ctx.project, T = p.treatment;
    const d = DOCS.find((x) => x[0] === tab);
    const count = h('span', { class: 'badge' });
    const upd = () => { const w = words(T[tab]); count.textContent = `${w} / ~${d[2]} woorden`; count.className = 'badge ' + (w > d[2] * 1.3 ? 'red' : w >= d[2] * 0.5 ? 'green' : ''); };
    root.append(pageHead('Synopsis & treatment', 'De documenten waarmee je je film verkoopt, aan fondsen, producenten en cast.',
      btn('Dossier afdrukken / PDF', () => printDossier(p), { icon: 'print' }),
      btn('Exporteer .md', () => download(`${slug(p.meta.title)}-dossier.md`, dossierMD(p), 'text/markdown'), { icon: 'download', class: 'ghost' })),
    tabs(DOCS.map(([k, l]) => [k, l]), tab, (t) => { tab = t; ctx.rerender(); }));
    const ta = bind(T, tab, ctx, { type: 'textarea', rows: 22, placeholder: d[3], onchange: upd });
    ta.style.cssText = 'font-size:15.5px;line-height:1.7;padding:16px 18px';
    root.append(section(null, h('div', { class: 'row wrap', style: { marginBottom: '10px' } }, h('span', { class: 'muted' }, d[3]), h('div', { class: 'spacer' }), count,
      btn('Schrijf met AI', () => ctx.openAI(`Schrijf een ${d[1].toLowerCase()} voor mijn film op basis van alles wat in het project staat. Richtlijn: ${d[3]}`), { icon: 'sparkles', class: 'ghost sm' })), ta));
    upd();
  },
};

function dossierMD(p) {
  const m = p.meta, T = p.treatment;
  return `# ${m.title}\n\n*${m.tagline || ''}*\n\n**Logline:** ${m.logline}\n\n**Genre:** ${m.genre} · **Duur:** ${m.runtime} min · **Vergelijkbaar:** ${m.comps}\n\n` +
    DOCS.filter(([k]) => T[k]?.trim()).map(([k, l]) => `## ${l}\n\n${T[k]}\n`).join('\n') +
    (p.characters.length ? `\n## Personages\n\n${p.characters.map((c) => `**${c.name}**${c.role ? ` (${c.role})` : ''} — ${c.description || ''} ${c.want ? `Wil: ${c.want}.` : ''} ${c.arc ? `Ontwikkeling: ${c.arc}` : ''}`).join('\n\n')}\n` : '');
}

function printDossier(p) {
  const m = p.meta, T = p.treatment;
  const para = (s) => esc(s).split(/\n{2,}/).map((x) => `<p>${x.replace(/\n/g, '<br>')}</p>`).join('');
  printDoc(m.title + ' — dossier', `
    <div style="text-align:center;margin:30mm 0 20mm"><h1 style="font-size:28pt">${esc(m.title)}</h1>
    <p class="muted" style="font-size:13pt"><i>${esc(m.tagline || '')}</i></p><p>${esc(m.genre || '')} · ${esc(String(m.runtime || ''))} min</p>
    <p style="max-width:120mm;margin:12mm auto;font-size:12pt">${esc(m.logline || '')}</p>${m.author ? `<p>${esc(m.author)}</p>` : ''}</div>
    <div class="pb"></div>
    ${DOCS.filter(([k]) => T[k]?.trim()).map(([k, l]) => `<h2>${l}</h2>${para(T[k])}`).join('')}
    ${p.characters.length ? `<h2>Personages</h2>${p.characters.map((c) => `<h3>${esc(c.name)}${c.role ? ` <span class="muted">— ${esc(c.role)}</span>` : ''}</h3><p>${esc(c.description || '')}</p>${c.want ? `<p><b>Wil:</b> ${esc(c.want)} <b>Heeft nodig:</b> ${esc(c.need || '')}</p>` : ''}${c.arc ? `<p><b>Ontwikkeling:</b> ${esc(c.arc)}</p>` : ''}`).join('')}` : ''}`,
  'body{font-family:Georgia,serif;font-size:11.5pt;line-height:1.6}h2{border-bottom:1px solid #999;padding-bottom:3pt;margin-top:18pt}');
}
