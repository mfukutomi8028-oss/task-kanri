import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.314 audit keeps release 277 and product date runtime unchanged while auditing dialog-open recovery', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const controller = read('date-segment-controls-v230.js');
  const audit = read('DATE_DIALOG_OBSERVER_AUDIT_V314.md');
  const browser = read('tests/date-dialog-observer-v314.spec.mjs');

  assert.match(manifest, /version:\s*"277"/);
  assert.equal(responsibilities.baselineRelease, '277');
  assert.match(controller, /function observeDialogs\(\)/);
  assert.match(controller, /new MutationObserver\(\(\) => \{/);
  assert.match(controller, /attributeFilter:\s*\["open"\]/);
  assert.match(controller, /patchAll\(\);\s*\n\s*syncAll\(\);/);

  assert.match(audit, /document に `toggle` capture listener を1本/);
  assert.match(audit, /製品 `date-segment-controls-v230\.js` は変更しない/);
  assert.match(browser, /installDateDialogCandidateV314/);
  assert.match(browser, /document\.addEventListener\("toggle", handler, true\)/);
  assert.match(browser, /patchWithin\(dialog\)/);
  assert.match(browser, /syncWithin\(dialog\)/);
});
