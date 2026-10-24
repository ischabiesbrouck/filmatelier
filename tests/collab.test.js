import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flatten, diff, applyPatch, normCode } from '../js/collab.js';
import { blankProject } from '../js/store.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

test('wijzigingen van twee mensen in verschillende items komen allebei door', () => {
  const base = blankProject('Samen');
  base.characters = [{ id: 'a', name: 'ANNA' }, { id: 'b', name: 'BRAM' }];
  base.script.text = 'INT. A - DAG';
  const A = clone(base), B = clone(base);
  const lastA = flatten(A), lastB = flatten(B);

  A.characters[0].name = 'ANNA DE VRIES';           // A wijzigt personage a
  B.characters[1].want = 'Weg uit het dorp';         // B wijzigt personage b
  B.script.text += '\n\nZe wacht.';                  // B schrijft verder
  const pA = diff(lastA, flatten(A));
  const pB = diff(lastB, flatten(B));
  assert.deepEqual(Object.keys(pA), ['characters#a']);
  assert.deepEqual(Object.keys(pB).sort(), ['characters#b', 'script.text']);

  applyPatch(A, pB); applyPatch(B, pA);
  assert.deepEqual(A.characters, B.characters);
  assert.equal(A.characters[0].name, 'ANNA DE VRIES');
  assert.equal(A.characters[1].want, 'Weg uit het dorp');
  assert.equal(A.script.text, B.script.text);
});

test('toevoegen, verwijderen en volgorde van lijstitems', () => {
  const A = blankProject('X');
  A.tasks = [{ id: 't1', title: 'Een' }, { id: 't2', title: 'Twee' }];
  const B = clone(A);
  const last = flatten(A);
  A.tasks.splice(0, 1);                               // t1 weg
  A.tasks.unshift({ id: 't3', title: 'Drie' });       // t3 vooraan erbij
  applyPatch(B, diff(last, flatten(A)));
  assert.deepEqual(B.tasks.map((t) => t.id), ['t3', 't2']);
  assert.equal(B.tasks[0].title, 'Drie');
});

test('lijst leeg maken en privé-gegevens blijven thuis', () => {
  const A = blankProject('X');
  A.ideas = [{ id: 'i1', text: 'idee' }];
  A.ai.history = [{ role: 'user', content: 'geheim' }];
  const B = clone(A); B.ai.history = [];
  const last = flatten(A);
  A.ideas = [];
  const patch = diff(last, flatten(A));
  assert.ok(!Object.keys(flatten(A)).some((k) => k.startsWith('ai')), 'AI-gesprek wordt nooit verstuurd');
  applyPatch(B, patch);
  assert.deepEqual(B.ideas, []);
  assert.deepEqual(B.ai.history, []);
});

test('codes normaliseren', () => {
  assert.equal(normCode(' k7q-2mx '), 'K7Q2MX');
  assert.equal(normCode('abcdefgh'), 'ABCDEF');
});
