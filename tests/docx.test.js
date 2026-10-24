import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, zip, unzip } from '../js/docx.js';

test('CRC-32 volgens de standaard-testvector', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('ZIP schrijven en weer lezen (ook met UTF-8-namen)', async () => {
  const blob = zip([{ name: 'word/document.xml', data: '<a>héllo</a>' }, { name: 'map/ç.txt', data: new Uint8Array([1, 2, 3]) }]);
  const files = await unzip(await blob.arrayBuffer());
  assert.deepEqual([...files.keys()], ['word/document.xml', 'map/ç.txt']);
  assert.equal(new TextDecoder().decode(await files.get('word/document.xml')), '<a>héllo</a>');
  assert.deepEqual([...(await files.get('map/ç.txt'))], [1, 2, 3]);
});

test('ongeldig bestand geeft een duidelijke fout', async () => {
  await assert.rejects(unzip(new Uint8Array([1, 2, 3, 4]).buffer), /Geen geldig ZIP/);
});
