// Hulpfuncties rond scène-sleutels. Breakdown, shots en draaischema verwijzen naar scènes via een sleutel:
// "n:12" bij vastgezette scènenummers, anders "h:<KOP>#<volgnummer>". Bij wijzigingen houden we die verwijzingen heel.

import { parse } from './fountain.js';

export function migrateKeys(p, map) {
  const re = (k) => map[k] ?? k;
  const remapObj = (o) => {
    for (const [k, v] of Object.entries({ ...o })) {
      if (map[k] && map[k] !== k) { if (o[map[k]] == null) o[map[k]] = v; delete o[k]; }
    }
  };
  remapObj(p.breakdown);
  remapObj(p.shots);
  remapObj(p.script.sceneColors || {});
  p.schedule.days.forEach((d) => { d.scenes = d.scenes.map(re); });
  if (p.structure.links) for (const k of Object.keys(p.structure.links)) p.structure.links[k] = re(p.structure.links[k]);
  p.takes.forEach((t) => { if (t.sceneKey) t.sceneKey = re(t.sceneKey); });
}

/** Vervangt de scripttekst en neemt alle verwijzingen mee op basis van scènevolgorde-ankers. */
export function replaceScript(p, newText, oldParsed, mapping) {
  p.script.text = newText;
  if (mapping) { migrateKeys(p, mapping); return; }
  // Automatisch: koppel op positie als het aantal scènes gelijk bleef en koppen ongewijzigd zijn.
  const np = parse(newText);
  const map = {};
  if (oldParsed && oldParsed.scenes.length === np.scenes.length) {
    oldParsed.scenes.forEach((s, i) => { if (s.key !== np.scenes[i].key && s.norm === np.scenes[i].norm) map[s.key] = np.scenes[i].key; });
  }
  if (Object.keys(map).length) migrateKeys(p, map);
}

/** Zet scènenummers vast (#1#) in de tekst en verhuist alle gekoppelde gegevens naar de nieuwe sleutels. */
export function lockSceneNumbers(p) {
  const parsed = parse(p.script.text);
  const lines = p.script.text.replace(/\r\n?/g, '\n').split('\n');
  const map = {};
  const used = new Set(parsed.scenes.filter((s) => s.forcedNum).map((s) => s.num));
  let n = 0;
  parsed.scenes.forEach((s) => {
    if (s.forcedNum) { n = parseInt(s.num, 10) || n; return; }
    let num = String(++n);
    while (used.has(num)) num = String(++n);
    used.add(num);
    lines[s.line] = lines[s.line].replace(/\s+$/, '') + ` #${num}#`;
    map[s.key] = 'n:' + num;
  });
  p.script.text = lines.join('\n');
  migrateKeys(p, map);
  return Object.keys(map).length;
}

export function unlockSceneNumbers(p) {
  const before = parse(p.script.text);
  const text = p.script.text.replace(/^(\.?(?:INT|EXT|EST|I\/E|E\/I|INT\.?\/EXT|EXT\.?\/INT|\.).*?)\s*#[^#\n]+#\s*$/gim, '$1');
  const after = parse(text);
  const map = {};
  before.scenes.forEach((s, i) => { if (after.scenes[i]) map[s.key] = after.scenes[i].key; });
  p.script.text = text;
  migrateKeys(p, map);
}

/** Na het invoegen van een scène op positie `at`: verwijzingen van latere scènes meeschuiven (botsingsvrij). */
export function remapAfterInsert(p, oldParsed, at) {
  const np = parse(p.script.text);
  const tmp = {}, fin = {};
  oldParsed.scenes.forEach((s, i) => {
    const target = np.scenes[i < at ? i : i + 1];
    if (target && target.key !== s.key) { tmp[s.key] = `tmp:${i}`; fin[`tmp:${i}`] = target.key; }
  });
  migrateKeys(p, tmp); migrateKeys(p, fin);
  return np;
}

/** Sleutels waarnaar verwezen wordt maar die niet (meer) in het scenario staan. */
export function orphanKeys(p, parsed) {
  const live = new Set(parsed.scenes.map((s) => s.key));
  const all = new Set([...Object.keys(p.breakdown), ...Object.keys(p.shots).filter((k) => p.shots[k]?.length), ...p.schedule.days.flatMap((d) => d.scenes)]);
  return [...all].filter((k) => !live.has(k));
}

export const keyLabel = (k) => k.startsWith('n:') ? 'Scène ' + k.slice(2) : k.slice(2).replace(/#(\d+)$/, (_, n) => (n > 1 ? ` (${n})` : ''));
