import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync('origin-modern-v372.js','utf8');
const css = readFileSync('modern-display-v356.css','utf8');
const app = readFileSync('app.js','utf8');
const manifest = readFileSync('release-manifest.js','utf8');
test('origin independent Modern reads the canonical data owner', () => {
  assert.match(source,/attachShadow/);
  assert.match(source,/WorkBoardPaletteBridge/);
  assert.match(source,/WorkBoardPaletteMemoBridgeV369/);
  assert.match(source,/workboard:canonical-bridge-ready/);
  assert.match(source,/originDisplaySelect/);
  assert.match(source,/WorkBoardPaletteMemoBridgeV369\?\.readSnapshot/);
  assert.doesNotMatch(source,/localStorage\.setItem/);
  assert.match(css,/data-modern-origin-ready/);
  assert.match(css,/body > \.app-shell/);
  assert.match(css,/data-wb-palette-next-preview/);
});
test('origin delegates schedule editing and safe task deletion', () => {
  assert.match(app,/WorkBoardOriginScheduleBridge = Object\.freeze/);
  assert.match(app,/openScheduleDialog\(record\)/);
  assert.match(app,/requestDeleteWithSeries\('task', id/);
  assert.match(app,/workboard:canonical-bridge-ready/);
  assert.doesNotMatch(source,/firebase\/database|runTransaction/);
});
test('origin belongs to the release manifest', () => {
  assert.match(manifest,/origin-modern-v372\.css/);
  assert.match(manifest,/origin-modern-v372\.js/);
});
