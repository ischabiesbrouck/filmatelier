import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../js/fountain.js';
import { lockSceneNumbers, unlockSceneNumbers, remapAfterInsert, orphanKeys } from '../js/scenes.js';
import { moveScene } from '../js/modules/cards.js';
import { blankProject, migrate, normalize } from '../js/store.js';
import { budgetTotals } from '../js/modules/budget.js';
import { analyse } from '../js/modules/analysis.js';
import { buildQueue } from '../js/modules/tableread.js';

const TXT = 'INT. A - DAG\n\nEen.\n\nINT. B - NACHT\n\nTwee.\n\nINT. A - DAG\n\nDrie.\n';
const project = () => {
  const p = blankProject('Test');
  p.script.text = TXT;
  const s = parse(TXT).scenes;
  p.breakdown[s[1].key] = { items: { props: ['Lamp'] } };
  p.breakdown[s[2].key] = { items: { props: ['Tas'] } };
  p.schedule.days.push({ id: 'd1', date: '', notes: '', scenes: [s[2].key] });
  return p;
};
const propsOf = (p, i) => p.breakdown[parse(p.script.text).scenes[i].key]?.items?.props;

test('scènenummers vastzetten en losmaken behoudt koppelingen', () => {
  const p = project();
  assert.equal(lockSceneNumbers(p), 3);
  assert.match(p.script.text, /INT\. B - NACHT #2#/);
  assert.deepEqual(propsOf(p, 1), ['Lamp']);
  assert.deepEqual(p.schedule.days[0].scenes, ['n:3']);
  unlockSceneNumbers(p);
  assert.doesNotMatch(p.script.text, /#\d#/);
  assert.deepEqual(propsOf(p, 2), ['Tas']);
  assert.deepEqual(orphanKeys(p, parse(p.script.text)), []);
});

test('scène verplaatsen verhuist gegevens van dubbele koppen correct', () => {
  const p = project();
  moveScene(p, 2, 0); // derde scène (A, tweede keer) naar voren
  const s = parse(p.script.text).scenes;
  assert.equal(s[0].action[0], 'Drie.');
  assert.deepEqual(propsOf(p, 0), ['Tas']);
  assert.deepEqual(propsOf(p, 2), ['Lamp']);
  assert.deepEqual(orphanKeys(p, parse(p.script.text)), []);
});

test('scène invoegen schuift latere koppelingen mee', () => {
  const p = project();
  const before = parse(p.script.text);
  const lines = p.script.text.split('\n');
  lines.splice(0, 0, 'INT. A - DAG', '', 'Nul.', '');
  p.script.text = lines.join('\n');
  remapAfterInsert(p, before, 0);
  assert.deepEqual(propsOf(p, 3), ['Tas']);
  assert.deepEqual(propsOf(p, 2), ['Lamp']);
  assert.equal(propsOf(p, 0), undefined);
});

test('migratie naar het huidige formaat', () => {
  const old = { id: 'x', version: 1, meta: { title: 'Oud' }, script: { text: '' }, breakdown: { k: { items: {} } }, characters: [{ name: 'A' }] };
  const p = migrate(normalize(old));
  assert.equal(p.version, 2);
  assert.deepEqual(p.gear, { items: [] });
  assert.deepEqual(p.breakdown.k.castExclude, []);
  assert.deepEqual(p.characters[0].relations, []);
  assert.ok(Array.isArray(p.festivals));
});

test('budgettotalen met opslagen', () => {
  const p = blankProject();
  p.budget = { currency: 'EUR', overhead: 10, insurance: 0, contingency: 10, items: [{ cat: 'Productie', qty: 2, rate: 500, actual: 300 }, { cat: 'Overig', qty: 1, rate: 1000, actual: 0 }] };
  const t = budgetTotals(p);
  assert.equal(t.sub, 2000);
  assert.equal(t.overhead, 200);
  assert.equal(t.contingency, 220);
  assert.equal(t.grand, 2420);
  assert.equal(t.actual, 300);
});

test('analyse en leesrepetitie-wachtrij', () => {
  const parsed = parse('INT. A - DAG\n\nAnna kijkt eigenlijk gewoon.\n\nANNA\nEigenlijk wil ik weg.\n\nBRAM\n(boos)\nGa dan.\n');
  const A = analyse(parsed);
  assert.equal(A.fill.eigenlijk, 2);
  assert.equal(A.chars.length, 2);
  const q = buildQueue(parsed, { narrate: false, headings: true });
  assert.deepEqual(q.map((x) => x.kind), ['h', 'a', 'd', 'd']);
  assert.ok(q[1].skip, 'actie wordt overgeslagen als vertellen uit staat');
  assert.equal(q[3].who, 'BRAM');
  assert.equal(q[0].say, 'binnen. a, dag');
});
