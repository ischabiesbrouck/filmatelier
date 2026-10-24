import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tcToFrames, framesToTc } from '../js/timecode.js';
import { sunTimes } from '../js/sun.js';

test('timecode non-drop', () => {
  assert.equal(tcToFrames('01:00:00:00', '25'), 90000);
  assert.equal(framesToTc(tcToFrames('01:00:00:00', '25') + tcToFrames('00:00:10:12', '25'), '25'), '01:00:10:12');
  assert.equal(framesToTc(-25, '25'), '-00:00:01:00');
});

test('timecode drop-frame 29,97', () => {
  assert.equal(tcToFrames('00:01:00;02', '29.97df'), 1800);
  assert.equal(tcToFrames('00:10:00;00', '29.97df'), 17982);
  assert.equal(tcToFrames('01:00:00;00', '29.97df'), 107892);
  for (const tc of ['00:00:59;29', '00:01:00;02', '00:09:59;29', '00:10:00;00', '23:59:59;29']) {
    assert.equal(framesToTc(tcToFrames(tc, '29.97df'), '29.97df'), tc);
  }
});

test('zon: Amsterdam rond de langste dag', () => {
  const t = sunTimes(new Date(Date.UTC(2026, 5, 21, 11)), 52.37, 4.9);
  const utc = (d) => d.getUTCHours() + d.getUTCMinutes() / 60;
  assert.ok(Math.abs(utc(t.sunrise) - 3.3) < 0.15, `zonsopkomst ${t.sunrise.toISOString()}`);
  assert.ok(Math.abs(utc(t.sunset) - 20.1) < 0.15, `zonsondergang ${t.sunset.toISOString()}`);
  assert.ok(t.goldenStart < t.sunset && t.dusk > t.sunset && t.dawn < t.sunrise);
});

test('zon: poolnacht geeft geen opkomst', () => {
  const t = sunTimes(new Date(Date.UTC(2026, 11, 21, 12)), 80, 15);
  assert.equal(t.sunrise, null);
});
