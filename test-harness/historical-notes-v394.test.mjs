import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_SHA = 'b534de7aa7a2b6e67b5c2a6be99a49479a111beb';
const ARCHIVE = 'docs/HISTORICAL_NOTES_ARCHIVE_V394.md';
const REMOVED = Object.freeze([
  'TODO_HISTORY_BOUNDARY_AUDIT_V266.md',
  'TODO_HISTORY_TARGETING_V267.md',
  'ICON_OBSERVER_BOUNDARY_AUDIT_V268.md',
  'ICON_OBSERVER_TARGETING_V269.md',
  'ICON_SYSTEM_POLLING_AUDIT_V270.md',
  'ICON_SYSTEM_SINGLE_PASS_V271.md',
  'BRAND_LIFECYCLE_AUDIT_V272.md',
  'VERSION_LIFECYCLE_AUDIT_V274.md',
  'FIRST_PAINT_VERSION_HANDOFF_V277.md',
  'POSTLOAD_VERSION_SYNC_PRODUCT_V279.md'
]);
const RETAINED_CONTRACT_NOTES = Object.freeze([
  'FIRST_PAINT_VERSION_HANDOFF_AUDIT_V276.md',
  'POSTLOAD_VERSION_SYNC_AUDIT_V278.md'
]);
const CURRENT_RUNBOOKS = Object.freeze([
  'README.md', 'REGRESSION_TESTS.md', 'DEVELOPMENT_PLAN_V371.md',
  '.github/README.md', 'release-notes.md'
]);

test('Ver.394 old audit documents are absent at root with immutable recovery URLs', () => {
  const index = fs.readFileSync(path.join(ROOT, ARCHIVE), 'utf8');
  for (const old of REMOVED) {
    assert.equal(fs.existsSync(path.join(ROOT, old)), false, 'retired note still at root: ' + old);
    const fixed = 'https://github.com/mfukutomi8028-oss/task-kanri/blob/' + SOURCE_SHA + '/' + old;
    assert.ok(index.includes(fixed), 'fixed recovery URL missing: ' + old);
  }
});

test('Ver.394 current runbooks do not link to retired root documents', () => {
  for (const current of CURRENT_RUNBOOKS) {
    const text = fs.readFileSync(path.join(ROOT, current), 'utf8');
    for (const old of REMOVED) {
      assert.equal(text.includes(old), false, 'stale root reference: ' + current + ' -> ' + old);
    }
  }
});

test('Ver.394 retains old audit source files still consumed by protocol tests', () => {
  for (const name of RETAINED_CONTRACT_NOTES) {
    assert.equal(fs.existsSync(path.join(ROOT, name)), true, 'required historical test input missing: ' + name);
  }
});
