import { h, section, btn, pageHead, field, toast, icon } from '../util.js';
import { S, host, join, stop, active, onCollabChange, normCode } from '../collab.js';
import { MODULES } from '../app.js';

const routeName = (r) => MODULES.find((m) => m.id === r)?.title || '—';

export default {
  id: 'samenwerken', title: 'Samenwerken', icon: 'link', group: 'Start',
  badge: () => (active() ? Object.keys(S.peers).length + 1 : null),
  render(root, ctx) {
    const s = ctx.settings;
    const pre = sessionStorage.getItem('fa.joincode');
    if (pre) sessionStorage.removeItem('fa.joincode');

    const nameIn = h('input', { value: s.collabName || '', placeholder: 'Bijv. Ischa', maxlength: 40, 'aria-label': 'Jouw naam' });
    nameIn.addEventListener('input', () => { s.collabName = nameIn.value.trim(); });
    const needName = () => { if (!(s.collabName || '').trim()) { nameIn.focus(); toast('Vul eerst je naam in, zodat anderen zien wie je bent', 'err'); return true; } return false; };

    root.append(pageHead('Samenwerken', 'Werk met anderen tegelijk aan dit project. Koppel met een code van 6 tekens; wijzigingen gaan direct van apparaat naar apparaat.'));
    const body = h('div', {});
    root.append(body);

    const draw = () => {
      body.replaceChildren();
      if (S.error && !active()) body.append(h('p', { class: 'note', style: { marginBottom: '16px', background: 'color-mix(in srgb, var(--red) 14%, transparent)' } }, S.error));

      if (S.status === 'start') { body.append(section(null, h('p', { class: 'muted' }, 'Verbinden…'))); return; }

      if (!active()) {
        const codeIn = h('input', { class: 'code-input', value: pre || '', placeholder: 'K7Q2MX', maxlength: 8, autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Code' });
        codeIn.addEventListener('input', () => { const c = normCode(codeIn.value); if (c !== codeIn.value) codeIn.value = c; });
        const doJoin = async () => {
          if (needName()) return;
          try { await join(codeIn.value); toast('Verbonden — je werkt nu samen'); } catch (e) { toast(e.message, 'err'); }
        };
        codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
        body.append(
          h('div', { class: 'grid g3', style: { alignItems: 'start' } },
            section('Jouw naam', h('div', { class: 'stack' }, field('Zo zien anderen je', nameIn), h('p', { class: 'muted small' }, 'Je naam wordt alleen gedeeld met de mensen in je sessie.'))),
            section('Sessie starten', h('div', { class: 'stack' },
              h('p', { class: 'muted' }, `Deel “${ctx.project.meta.title}” met anderen. Je krijgt een code die je doorgeeft; jij laat iedereen toe.`),
              btn('Sessie starten', async () => { if (needName()) return; try { await host(); } catch (e) { toast(e.message, 'err'); } }, { icon: 'link', class: 'primary' }))),
            section('Meedoen met een code', h('div', { class: 'stack' },
              h('p', { class: 'muted' }, 'Vul de code van de gastheer in. Je krijgt een eigen kopie van het project die live meeloopt.'),
              codeIn,
              btn('Meedoen', doJoin, { icon: 'arrowUpRight', class: 'primary' })))),
          h('div', { style: { height: '18px' } }),
          section('Hoe het werkt', h('ul', { class: 'muted', style: { margin: 0, paddingLeft: '18px', lineHeight: 1.8 } },
            h('li', {}, 'De gastheer start een sessie en geeft de code door (of de link). Elke deelnemer moet eerst worden toegelaten.'),
            h('li', {}, 'Wijzigingen worden per onderdeel verstuurd: een personage, een taak, een document, de scenariotekst. Wie wat bewerkt, zie je in de deelnemerslijst.'),
            h('li', {}, 'Werk je met twee mensen in hetzelfde tekstveld tegelijk, dan wint de laatste. De app waarschuwt als iemand anders in hetzelfde onderdeel zit.'),
            h('li', {}, 'Gegevens gaan versleuteld rechtstreeks tussen de apparaten (WebRTC). Een openbare koppelserver (PeerJS) helpt alleen om elkaar te vinden. AI-gesprekken worden nooit gedeeld.'),
            h('li', {}, 'De sessie loopt zolang de gastheer de app open heeft. Daarna houdt iedereen zijn eigen bijgewerkte kopie.'),
            h('li', {}, 'Werkt het verbinden niet? Sommige zakelijke netwerken blokkeren directe verbindingen; probeer dan een ander netwerk of een mobiele hotspot.'))));
        if (pre) setTimeout(() => codeIn.focus(), 30);
        return;
      }

      const link = `${location.origin}${location.pathname}?samen=${S.code}`;
      const people = [{ name: s.collabName || 'Ik', route: ctx.route, host: S.role === 'host', me: true }, ...Object.values(S.peers)];
      body.append(h('div', { class: 'grid g2', style: { alignItems: 'start' } },
        h('section', { class: 'card ink-card' },
          h('div', { class: 'row' }, h('span', { class: 'live-dot' }), h('b', {}, S.role === 'host' ? (S.status === 'wacht' ? 'Wacht op deelnemers' : 'Sessie actief') : 'Verbonden'), h('div', { class: 'spacer' }),
            h('span', { class: 'pill-o' }, S.role === 'host' ? 'Gastheer' : 'Deelnemer')),
          h('div', { class: 'code-big', 'aria-label': `Code ${S.code.split('').join(' ')}` }, S.code.slice(0, 3), h('span', {}, '·'), S.code.slice(3)),
          h('p', { style: { color: 'var(--ink-muted)', margin: '0 0 16px' } }, S.role === 'host' ? `Geef deze code door. Project: “${ctx.project.meta.title}”.` : `Je werkt mee aan “${ctx.project.meta.title}”.`),
          h('div', { class: 'row wrap' },
            S.role === 'host' ? btn('Code kopiëren', () => navigator.clipboard.writeText(S.code).then(() => toast('Code gekopieerd')), { icon: 'copy', class: 'sm' }) : null,
            S.role === 'host' ? btn('Link kopiëren', () => navigator.clipboard.writeText(link).then(() => toast('Link gekopieerd')), { icon: 'link', class: 'sm' }) : null,
            h('div', { class: 'spacer' }),
            btn(S.role === 'host' ? 'Sessie stoppen' : 'Verbinding verbreken', () => stop(), { class: 'sm danger' }))),
        section(`Deelnemers (${people.length})`, h('div', { class: 'stack tight' }, people.map((x) => h('div', { class: 'list-item', style: { cursor: 'default' } },
          h('div', { class: 'avatar' }, (x.name || '?').slice(0, 2).toUpperCase()),
          h('div', { style: { flex: 1, minWidth: 0 } }, h('b', {}, x.name + (x.me ? ' (jij)' : '')), h('div', { class: 'muted small' }, x.host ? 'Gastheer · ' : '', 'in ', routeName(x.route))),
          h('span', { class: 'live-dot' })))))));
      if (S.error) body.append(h('p', { class: 'muted small', style: { marginTop: '12px' } }, S.error));
    };

    draw();
    const off = onCollabChange(() => { const a = document.activeElement; if (!(a && body.contains(a) && a.tagName === 'INPUT')) draw(); });
    return off;
  },
};
