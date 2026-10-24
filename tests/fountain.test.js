import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, headingInfo, toFDX, fromFDX, inline, wrap } from '../js/fountain.js';

const SCRIPT = `Title: Test
Author: Iemand

INT. KEUKEN - NACHT

= Anna wacht.

ANNA (24) staart naar de TELEFOON. Bram komt binnen.

ANNA
(zacht)
Neem nou op.

BRAM (V.O.)
Ik ben er niet.

ANNA (CONT'D)
Natuurlijk niet.

> KNIPPEN NAAR:

EXT. STRAAT - DAG #12#

Regen.

CUT TO:

.FLASHBACK

>EINDE<

BRAM ^
Hoi.

/* weggelaten
INT. NIET - DAG
*/
`;

test('titelpagina, scènes en nummers', () => {
  const p = parse(SCRIPT);
  assert.equal(p.title.title, 'Test');
  assert.equal(p.title.author, 'Iemand');
  assert.equal(p.scenes.length, 3, 'boneyard-scène telt niet mee');
  assert.deepEqual(p.scenes.map((s) => s.num), ['1', '12', '3']);
  assert.equal(p.scenes[1].key, 'n:12');
  assert.equal(p.scenes[0].key, 'h:INT. KEUKEN - NACHT#1');
  assert.equal(p.scenes[2].heading, 'FLASHBACK');
});

test('scènekop-informatie', () => {
  assert.deepEqual({ ...headingInfo('INT. KEUKEN - NACHT'), norm: undefined }, { ie: 'INT', location: 'KEUKEN', tod: 'NACHT', dn: 'N', norm: undefined });
  assert.equal(headingInfo('EXT. STRAAT - DAG').dn, 'D');
  assert.equal(headingInfo('INT./EXT. AUTO - AVOND').ie, 'INT/EXT');
  assert.equal(headingInfo('INT./EXT. AUTO - AVOND').dn, 'N');
  assert.equal(headingInfo('I/E. BUS - DAGERAAD').location, 'BUS');
});

test('elementen herkennen', () => {
  const types = parse(SCRIPT).tokens.map((t) => t.type);
  for (const t of ['scene_heading', 'synopsis', 'action', 'character', 'parenthetical', 'dialogue', 'transition', 'centered']) assert.ok(types.includes(t), t);
  const p = parse(SCRIPT);
  assert.ok(p.tokens.some((t) => t.type === 'transition' && t.text === 'CUT TO:'), 'TO:-overgang');
  assert.ok(p.tokens.some((t) => t.type === 'character' && t.dual), 'dubbele dialoog');
});

test('personages, cast en voice-over', () => {
  const p = parse(SCRIPT);
  assert.deepEqual(Object.keys(p.characters).sort(), ['ANNA', 'BRAM']);
  assert.equal(p.characters.ANNA.lines, 2, 'CONT\'D telt als hetzelfde personage');
  const s = p.scenes[0];
  assert.deepEqual(s.chars.sort(), ['ANNA', 'BRAM']);
  assert.ok(s.cast.includes('ANNA'));
  assert.ok(s.cast.includes('BRAM'), 'Bram wordt in de actie genoemd, dus aanwezig ondanks V.O.');
  assert.deepEqual(parse('INT. A - DAG\n\nZe wacht.\n\nBRAM (V.O.)\nHallo.\n').scenes[0].cast, [], 'alleen voice-over = niet op de set');
});

test('paginering en achtsten', () => {
  const body = Array.from({ length: 60 }, (_, i) => `INT. RUIMTE ${i} - DAG\n\nEen regel actie die ongeveer zestig tekens lang is, best wel.\n\nANNA\nEen zin dialoog.\n`).join('\n');
  const p = parse(body);
  // Per scène: lege regel + kop + lege regel + 2 regels actie + lege regel + naam + dialoog = 8 regels.
  // 60 × 8 = 480 regels / 54 per pagina ≈ 8,9; koppen die niet los onderaan mogen staan kosten iets extra.
  assert.ok(p.pages >= 9 && p.pages <= 11, `verwacht 9–11 pagina’s, kreeg ${p.pages}`);
  assert.ok(p.scenes.every((s) => s.eighths >= 1));
  assert.ok(p.scenes.at(-1).page > 1);
});

test('FDX heen en terug behoudt de structuur', () => {
  const a = parse(SCRIPT);
  const b = parse(fromFDX(toFDX(a)));
  assert.equal(b.scenes.length, a.scenes.length);
  assert.deepEqual(Object.keys(b.characters).sort(), Object.keys(a.characters).sort());
  assert.match(fromFDX('<FinalDraft><Content><Paragraph Type="Action"><Text>Tom &amp; Jerry &#233;</Text></Paragraph></Content></FinalDraft>'), /Tom & Jerry é/);
});

test('inline-opmaak en woordafbreking', () => {
  assert.equal(inline('**vet** *schuin* _onder_ <x>'), '<b>vet</b> <i>schuin</i> <u>onder</u> &lt;x&gt;');
  assert.deepEqual(wrap('een twee drie vier', 9), ['een twee', 'drie vier']);
});
