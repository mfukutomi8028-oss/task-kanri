import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.230 semantic date controller and presentation remain active in later releases while the combined legacy source stays retired', () => {
  const manifest = read('release-manifest.js');
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');

  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);
  assert.ok(release >= 230, 'Ver.230 date responsibility split must remain present in later releases');
  assert.equal(styles.filter(item => item === 'ui-date-segment-controls-v230.css').length, 1);
  assert.equal(scripts.filter(item => item === 'date-segment-controls-v230.js').length, 1);
  assert.ok(required.includes('ui-date-segment-controls-v230.css'));
  assert.ok(required.includes('date-segment-controls-v230.js'));

  assert.ok(!scripts.includes('date-keyboard-fix-v127.js'));
  assert.ok(!required.includes('date-keyboard-fix-v127.js'));
  assert.ok(fs.existsSync(path.join(ROOT, 'date-keyboard-fix-v127.js')),
    'legacy combined source must remain physically available for cached manifests and rollback');
});

test('Ver.230 controller keeps the proven v127 DOM contract without injecting presentation CSS', () => {
  const controller = read('date-segment-controls-v230.js');

  assert.match(controller, /const SELECTOR = 'input\[type="date"\], input\[type="datetime-local"\]';/);
  assert.match(controller, /const DATE_MIN = "1900-01-01";/);
  assert.match(controller, /const DATE_MAX = "9999-12-31";/);
  assert.match(controller, /function buildControl\(source\)/);
  assert.match(controller, /source\.dataset\.dateSegmentV127 = "true"/);
  assert.match(controller, /wrapper\.__syncDateSegmentsV127/);
  assert.match(controller, /function isValidDateParts\(year, month, day\)/);
  assert.match(controller, /function isValidTimeParts\(hour, minute\)/);
  assert.match(controller, /typeof source\.showPicker === "function"/);
  assert.match(controller, /attributeFilter: \["open"\]/);

  assert.doesNotMatch(controller, /function installStyle\s*\(/);
  assert.doesNotMatch(controller, /dateSegmentControlStyleV127/);
  assert.doesNotMatch(controller, /style\.textContent\s*=/);
  assert.doesNotMatch(controller, /document\.head\.appendChild\(style\)/);
});

test('Ver.230 presentation owns the former inline date-segment styling and legacy source remains unchanged in role', () => {
  const presentation = read('ui-date-segment-controls-v230.css');
  const legacy = read('date-keyboard-fix-v127.js');

  for (const selector of [
    '.date-segment-control-v127',
    '.date-segment-control-v127:focus-within',
    '.date-segment-control-v127.is-invalid',
    'input.date-segment-input-v127',
    'input.date-segment-year-v127',
    'input.date-segment-two-v127',
    '.date-segment-picker-v127',
    'input.date-native-source-v127'
  ]) {
    assert.ok(presentation.includes(selector), `presentation selector missing: ${selector}`);
  }
  assert.match(presentation, /@media \(max-width: 520px\)/);
  assert.match(presentation, /min-height:\s*52px\s*!important/);
  assert.match(presentation, /border-radius:\s*16px\s*!important/);

  assert.match(legacy, /function installStyle\(\)/,
    'legacy cached-manifest implementation must still carry its self-contained presentation');
  assert.match(legacy, /style\.id = "dateSegmentControlStyleV127"/);
});
