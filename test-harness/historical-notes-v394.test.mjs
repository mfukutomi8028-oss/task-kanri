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

const SOURCE_SHA_V396 = '746ddd728163dd23beaa432dedb3b9d49aec3ab6';
const REMOVED_DIALOG_NOTES_V396 = Object.freeze([
  'docs/ver320-task-dialog-ux.md',
  'docs/ver321-regression-scope.md',
  'docs/ver321-task-dialog-polish.md',
  'docs/ver321-ui-notes.md',
  'docs/ver321-user-reported-ui.md',
]);

test('Ver.396 archived old task-dialog notes are absent and have immutable recovery URLs', () => {
  const index = fs.readFileSync(path.join(ROOT, ARCHIVE), 'utf8');
  for (const old of REMOVED_DIALOG_NOTES_V396) {
    assert.equal(fs.existsSync(path.join(ROOT, old)), false, 'retired task-dialog note still present: ' + old);
    const fixed = 'https://github.com/mfukutomi8028-oss/task-kanri/blob/' + SOURCE_SHA_V396 + '/' + old;
    assert.ok(index.includes(fixed), 'immutable original link missing: ' + old);
  }
});

test('Ver.396 no current source, test or runbook depends on retired task-dialog note paths', () => {
  const ignored = new Set(['.git', 'node_modules', '.pages-runtime', 'test-results',
    'playwright-report', 'coverage', '.firebase']);
  const textual = /\.(?:js|mjs|cjs|css|html|json|md|yml|yaml|ps1)$/i;
  const exceptions = new Set([ARCHIVE, 'test-harness/historical-notes-v394.test.mjs']);
  const stale = [];
  function walk(folder, prefix = '') {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const rel = prefix ? prefix + '/' + entry.name : entry.name;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!ignored.has(entry.name)) walk(path.join(folder, entry.name), rel);
        continue;
      }
      if (!entry.isFile() || !textual.test(entry.name) || exceptions.has(rel)) continue;
      const content = fs.readFileSync(path.join(folder, entry.name), 'utf8');
      for (const old of REMOVED_DIALOG_NOTES_V396) {
        if (content.includes(old) || content.includes(path.posix.basename(old))) {
          stale.push(rel + ' -> ' + old);
        }
      }
    }
  }
  walk(ROOT);
  assert.deepEqual(stale, [], 'unexpected references to retired Ver.320/321 notes');
});
