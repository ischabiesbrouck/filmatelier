// Optionele AI-schrijfhulp via de Claude API (eigen API-sleutel, alleen lokaal bewaard).
// De SDK wordt pas geladen wanneer je de assistent voor het eerst gebruikt; de rest van de app werkt volledig offline.

import { h, clear, icon, iconBtn, btn, esc, toast, field, uid } from './util.js';
import { ctx } from './app.js';

const SDK_URL = 'https://esm.sh/@anthropic-ai/sdk@0.133.0';
const MODELS = [['claude-opus-5-5', 'Claude Opus 5.5 (beste kwaliteit)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (sneller, goedkoper)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (snelst, goedkoopst)']];

let panel = null;
let busy = false;
let abortCtl = null;
let pendingSelection = '';

const QUICK = {
  overzicht: ['Geef 5 scherpere varianten van mijn logline', 'Wat zijn de grootste risico’s van dit project en wat moet ik nu als eerste doen?'],
  ideeen: ['Bedenk 10 originele filmpremissen in mijn genre', 'Geef 8 “wat als”-varianten op mijn logline', 'Combineer mijn ideeënkaarten tot 3 mogelijke verhaallijnen'],
  structuur: ['Analyseer mijn beat sheet: waar zakt de spanning in?', 'Vul de lege beats in met concrete voorstellen'],
  personages: ['Verdiep mijn personages: geheimen, tegenstrijdigheden en arcs', 'Bedenk een sterke antagonist die het thema spiegelt', 'Geef elk personage een herkenbare manier van praten'],
  wereld: ['Welke research moet ik doen om deze wereld geloofwaardig te maken?'],
  treatment: ['Schrijf een synopsis van één pagina op basis van het project', 'Schrijf een pitch van 60 seconden'],
  scenario: ['Geef script coverage: sterke punten, zwakke punten, advies', 'Herschrijf de geselecteerde tekst met meer subtekst', 'Schrijf de volgende scène in Fountain-formaat'],
  kaarten: ['Stel een betere scènevolgorde voor en leg uit waarom'],
  breakdown: ['Stel per scène rekwisieten, kostuum en speciale benodigdheden voor'],
  shots: ['Stel een shotlist voor van de eerste scène, met shotgrootte, beweging en lens'],
  stripboard: ['Geef tips om het draaischema efficiënter te maken'],
  budget: ['Controleer mijn budget op ontbrekende posten en onrealistische bedragen'],
  festivals: ['Stel een festivalstrategie op voor deze film'],
  post: ['Maak een planning voor de postproductie'],
};

function systemPrompt(includeScript) {
  const p = ctx.project;
  const parsed = ctx.parsed();
  const m = p.meta;
  const chars = p.characters.map((c) => `- ${c.name}${c.role ? ` (${c.role})` : ''}: wil: ${c.want || '?'}; nodig: ${c.need || '?'}; fout: ${c.flaw || '?'}; arc: ${c.arc || '?'}${c.psych ? `; profiel: ${c.psych}` : ''}`).join('\n');
  const beats = Object.entries(p.structure.beats).filter(([, v]) => v?.trim()).map(([k, v]) => `- ${k}: ${v}`).join('\n');
  const scenes = parsed.scenes.map((s) => `${s.num}. ${s.heading}${s.synopsis.length ? ' — ' + s.synopsis.join(' ') : ''}`).join('\n');
  let script = '';
  if (includeScript && p.script.text.trim()) {
    const t = p.script.text;
    script = `\n\n<scenario formaat="fountain">\n${t.length > 400000 ? t.slice(0, 400000) + '\n[…ingekort…]' : t}\n</scenario>`;
  }
  return `Je bent een ervaren scriptconsultant, schrijver en filmproducent. Je helpt één maker bij het bedenken, schrijven en produceren van een lange speelfilm, binnen de app Filmatelier.
Antwoord in het Nederlands, tenzij de maker om een andere taal vraagt. Wees concreet, specifiek en eerlijk; geef liever drie goede opties dan tien vage. Gebruik korte kopjes en lijstjes waar dat helpt.
Schrijf scenariotekst altijd in Fountain-formaat (scènekoppen als "INT. LOCATIE - DAG", personagenamen in hoofdletters op een eigen regel, dialoog eronder).
Respecteer de stem en keuzes van de maker: stel voor, leg uit waarom, en neem geen beslissingen over zonder dat te benoemen.

<project>
Titel: ${m.title}
Logline: ${m.logline || '(nog niet ingevuld)'}
Genre: ${m.genre || '?'} · Doelduur: ${m.runtime || '?'} min · Thema: ${m.theme || '?'} · Doelgroep: ${m.audience || '?'} · Toon: ${m.tone || '?'} · Vergelijkbare titels: ${m.comps || '?'}
Premisse: ${p.treatment.premise || '?'}
Kernconflict: ${m.conflict || '?'} · Inzet: ${m.stakes || '?'}
Thematische vraag: ${m.themeQuestion || '?'} · Thematische stelling: ${m.themeStatement || '?'}
Huidige scenario-omvang: ${parsed.pages} pagina's, ${parsed.scenes.length} scènes.
Personages:
${chars || '(nog geen)'}
Structuur (${p.structure.template}):
${beats || '(nog niet ingevuld)'}
Synopsis: ${p.treatment.synopsis || '(nog niet ingevuld)'}
Scènelijst:
${scenes || '(nog geen scènes)'}
</project>${script}`;
}

/* ---------- Eenvoudige markdown-weergave ---------- */
function md(src) {
  const lines = esc(src).split('\n');
  let out = '', list = null, code = false;
  const inl = (s) => s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  const closeList = () => { if (list) { out += `</${list}>`; list = null; } };
  for (const l of lines) {
    if (l.startsWith('```')) { closeList(); out += code ? '</pre>' : '<pre>'; code = !code; continue; }
    if (code) { out += l + '\n'; continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)/))) { closeList(); out += `<h${Math.min(6, m[1].length + 2)}>${inl(m[2])}</h${Math.min(6, m[1].length + 2)}>`; }
    else if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { closeList(); out += '<ul>'; list = 'ul'; } out += `<li>${inl(m[1])}</li>`; }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { closeList(); out += '<ol>'; list = 'ol'; } out += `<li>${inl(m[1])}</li>`; }
    else if (!l.trim()) { closeList(); out += ''; }
    else { closeList(); out += `<p>${inl(l)}</p>`; }
  }
  closeList();
  if (code) out += '</pre>';
  return out;
}

/* ---------- Paneel ---------- */
export function closeAI() { panel?.remove(); panel = null; document.body.classList.remove('ai-open'); }

/** Opent de assistent; optioneel met een voorgestelde vraag en geselecteerde tekst als context. */
export function openAI(opts = {}) {
  if (typeof opts === 'string') opts = { prompt: opts };
  pendingSelection = opts.selection || '';
  if (!panel) {
    panel = h('aside', { class: 'ai-panel', 'aria-label': 'AI-schrijfhulp' });
    document.body.append(panel);
    document.body.classList.add('ai-open');
  }
  renderPanel(opts.prompt || '');
}

function renderPanel(prefill = '') {
  clear(panel);
  const s = ctx.settings;
  panel.append(h('header', {}, icon('sparkles'), h('h2', {}, 'AI-schrijfhulp'), h('div', { class: 'spacer' }),
    iconBtn('edit', 'Instellingen', () => renderSettings()), iconBtn('x', 'Sluiten', closeAI)));
  if (!s.apiKey) { renderSettings(); return; }

  const log = h('div', { class: 'ai-log' });
  const hist = ctx.project.ai.history;
  if (!hist.length) log.append(h('div', { class: 'ai-hello muted' }, h('p', {}, 'Stel een vraag over je film, of kies een snelle opdracht. De assistent kent je logline, personages, structuur en (optioneel) het volledige scenario.')));
  hist.forEach((m) => log.append(bubble(m)));

  const ta = h('textarea', { rows: 3, placeholder: 'Vraag iets… (Enter = versturen, Shift+Enter = nieuwe regel)' });
  ta.value = prefill;
  const incl = h('input', { type: 'checkbox', checked: s.aiIncludeScript !== false });
  incl.addEventListener('change', () => { s.aiIncludeScript = incl.checked; });
  const sendBtn = btn('Versturen', () => send(ta.value), { icon: 'send', class: 'primary sm' });
  const stopBtn = btn('Stop', () => abortCtl?.abort(), { icon: 'pause', class: 'sm hidden' });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(ta.value); } });

  const quick = h('div', { class: 'chips' }, [...(QUICK[ctx.route] || []), 'Wat is de volgende logische stap voor mijn film?'].map((q) =>
    h('button', { class: 'chip', type: 'button', onclick: () => send(q) }, q)));

  const sel = pendingSelection ? h('div', { class: 'ai-sel' }, h('small', { class: 'muted' }, 'Geselecteerde tekst wordt meegestuurd:'), h('pre', {}, pendingSelection.slice(0, 600) + (pendingSelection.length > 600 ? '…' : ''))) : null;

  panel.append(log, h('div', { class: 'ai-input' }, quick, sel, ta,
    h('div', { class: 'row' }, h('label', { class: 'check' }, incl, 'Scenario meesturen'), h('div', { class: 'spacer' }),
      iconBtn('trash', 'Gesprek wissen', () => { ctx.project.ai.history = []; ctx.save(); renderPanel(); }), stopBtn, sendBtn)));
  log.scrollTop = log.scrollHeight;
  setTimeout(() => ta.focus(), 50);

  async function send(text) {
    text = text.trim();
    if (!text || busy) return;
    busy = true; ta.value = ''; sendBtn.disabled = true; stopBtn.classList.remove('hidden');
    log.querySelector('.ai-hello')?.remove();
    const content = pendingSelection ? `${text}\n\n<selectie>\n${pendingSelection}\n</selectie>` : text;
    pendingSelection = '';
    panel.querySelector('.ai-sel')?.remove();
    const userMsg = { id: uid(), role: 'user', content };
    hist.push(userMsg);
    log.append(bubble(userMsg));
    const asst = { id: uid(), role: 'assistant', content: '' };
    const b = bubble(asst, true);
    log.append(b);
    log.scrollTop = log.scrollHeight;
    const body = b.querySelector('.ai-body');
    try {
      const { default: Anthropic } = await import(SDK_URL);
      const client = new Anthropic({ apiKey: s.apiKey, dangerouslyAllowBrowser: true });
      abortCtl = new AbortController();
      const messages = hist.slice(-20).filter((m) => m.content).map((m) => ({ role: m.role, content: m.content }));
      while (messages.length && messages[0].role !== 'user') messages.shift();
      const model = s.aiModel || 'claude-opus-5-5';
      const params = {
        model,
        max_tokens: 16000,
        system: systemPrompt(incl.checked),
        messages,
        output_config: { effort: s.aiEffort || 'medium' },
      };
      // Server-side fallback: als het model om veiligheidsredenen weigert, probeert de API automatisch een ander model.
      const stream = client.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, { signal: abortCtl.signal });
      stream.on('text', (d) => {
        asst.content += d;
        body.innerHTML = md(asst.content);
        if (log.scrollHeight - log.scrollTop - log.clientHeight < 120) log.scrollTop = log.scrollHeight;
      });
      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') {
        asst.content += (asst.content ? '\n\n' : '') + '_De assistent heeft dit verzoek niet beantwoord. Probeer het anders te formuleren._';
      } else if (final.stop_reason === 'max_tokens') {
        asst.content += '\n\n_(Antwoord afgekapt: maximale lengte bereikt.)_';
      }
      body.innerHTML = md(asst.content);
      hist.push(asst);
    } catch (e) {
      const msg = errorText(e);
      if (asst.content) { asst.content += `\n\n_(${msg})_`; hist.push(asst); }
      body.innerHTML = md(asst.content || '') + `<p class="err-text">${esc(msg)}</p>`;
    } finally {
      busy = false; sendBtn.disabled = false; stopBtn.classList.add('hidden');
      b.classList.remove('streaming');
      if (hist.length > 60) hist.splice(0, hist.length - 60);
      ctx.save();
    }
  }
}

function errorText(e) {
  const name = e?.constructor?.name || '';
  if (e?.name === 'AbortError' || name === 'APIUserAbortError') return 'Gestopt.';
  if (name === 'AuthenticationError' || e?.status === 401) return 'Ongeldige API-sleutel. Controleer de sleutel bij Instellingen.';
  if (name === 'PermissionDeniedError' || e?.status === 403) return 'Geen toegang met deze sleutel (403).';
  if (name === 'RateLimitError' || e?.status === 429) return 'Te veel verzoeken of tegoed op (429). Probeer het later opnieuw.';
  if (name === 'BadRequestError' || e?.status === 400) return 'Verzoek geweigerd (400): ' + (e?.error?.error?.message || e.message);
  if (e?.status >= 500) return `Serverfout bij Anthropic (${e.status}). Probeer het later opnieuw.`;
  if (name === 'APIConnectionError' || e instanceof TypeError) return 'Geen verbinding. De AI-hulp heeft internet nodig; de rest van de app werkt offline.';
  return 'Fout: ' + (e?.message || e);
}

function bubble(m, streaming = false) {
  const body = h('div', { class: 'ai-body' });
  if (m.role === 'assistant') body.innerHTML = md(m.content); else body.textContent = m.content.replace(/\n\n<selectie>[\s\S]*<\/selectie>$/, '\n[+ geselecteerde tekst]');
  const tools = m.role === 'assistant' ? h('div', { class: 'ai-tools' },
    iconBtn('copy', 'Kopiëren', () => { navigator.clipboard.writeText(m.content).then(() => toast('Gekopieerd')); }),
    iconBtn('bulb', 'Bewaren als idee', () => { ctx.project.ideas.unshift({ id: uid(), text: m.content, tag: 'AI', color: 'violet' }); ctx.save(); toast('Toegevoegd aan Ideeënlab'); })) : null;
  return h('div', { class: `ai-msg ${m.role}${streaming ? ' streaming' : ''}` }, body, tools);
}

function renderSettings() {
  clear(panel);
  const s = ctx.settings;
  const key = h('input', { type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off', spellcheck: 'false' });
  key.value = s.apiKey || '';
  const model = h('select', {}, MODELS.map(([v, l]) => h('option', { value: v }, l)));
  model.value = s.aiModel || 'claude-opus-5-5';
  const effort = h('select', {}, [['low', 'Laag (snel)'], ['medium', 'Gemiddeld'], ['high', 'Hoog (grondig)']].map(([v, l]) => h('option', { value: v }, l)));
  effort.value = s.aiEffort || 'medium';
  panel.append(
    h('header', {}, icon('sparkles'), h('h2', {}, 'AI-instellingen'), h('div', { class: 'spacer' }), iconBtn('x', 'Sluiten', closeAI)),
    h('div', { class: 'ai-settings stack' },
      h('p', { class: 'muted' }, 'De schrijfhulp gebruikt de Claude API met je eigen API-sleutel. De sleutel blijft alleen in deze browser op dit apparaat en gaat rechtstreeks naar Anthropic. Kosten gaan via je eigen Anthropic-account.'),
      field('API-sleutel', key, 'Maak er een aan op console.anthropic.com → API Keys.'),
      field('Model', model),
      field('Denkdiepte', effort),
      h('div', { class: 'row' },
        btn('Opslaan', () => {
          s.apiKey = key.value.trim(); s.aiModel = model.value; s.aiEffort = effort.value;
          toast(s.apiKey ? 'AI-instellingen opgeslagen' : 'Sleutel verwijderd');
          if (s.apiKey) renderPanel();
        }, { class: 'primary' }),
        s.apiKey ? btn('Sleutel wissen', () => { s.apiKey = ''; renderSettings(); }, { class: 'ghost' }) : null,
        s.apiKey ? btn('Terug', () => renderPanel(), { class: 'ghost' }) : null),
      h('p', { class: 'muted small' }, 'Zonder sleutel werkt alles behalve deze assistent gewoon. Ideeën-, naam- en plotgeneratoren in het Ideeënlab werken offline.')));
}
