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
// Historical Ver.394 source inputs are now immutable Ver.516 evidence, not live root files.
const RETAINED_CONTRACT_NOTES = Object.freeze([
  { version: 276, stem: 'FIRST_PAINT_VERSION_HANDOFF', blob: 'd184687720701e1c29186e7d33a5be23d714a38d', bytes: 8619,
    owner: 'test-harness/first-paint-version-handoff-v276.test.mjs' },
  { version: 278, stem: 'POSTLOAD_VERSION_SYNC', blob: '3811233b99ef6cd84d6a19e35d5ea252c3079990', bytes: 5001,
    owner: 'test-harness/postload-version-sync-v278.test.mjs' }
]);
const V516_SOURCE_SHA = '43231a69957f8bc70f6f0ad5d7e20dc6d3015c73';
const V516_INDEX = 'docs/HISTORICAL_VERSION_BRAND_HANDOFF_AUDITS_V516.md';
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

test('Ver.394 historical Protocol inputs remain pinned and verified after Ver.516 archival', () => {
  const index = fs.readFileSync(path.join(ROOT, V516_INDEX), 'utf8');
  for (const entry of RETAINED_CONTRACT_NOTES) {
    // Construct the historical path from independent parts to avoid introducing a
    // new active literal path dependency on a deliberately retired root document.
    const oldName = entry.stem + '_AUDIT_V' + entry.version + '.md';
    assert.equal(fs.existsSync(path.join(ROOT, oldName)), false, 'retired root source returned: ' + oldName);
    assert.ok(index.includes('| `' + oldName + '` | `' + entry.blob + '` | ' +
      entry.bytes.toLocaleString('en-US') + ' |'), 'original hash/size missing: ' + oldName);
    assert.ok(index.includes('https://github.com/mfukutomi8028-oss/task-kanri/blob/' +
      V516_SOURCE_SHA + '/' + oldName + ')'), 'immutable original missing: ' + oldName);
    const liveOwner = path.join(ROOT, entry.owner);
    assert.equal(fs.existsSync(liveOwner), true, 'current Protocol owner missing: ' + entry.owner);
    assert.ok(fs.readFileSync(liveOwner, 'utf8').includes(V516_INDEX), 'current owner is not reading archived evidence: ' + entry.owner);
  }
});

const SOURCE_SHA_V396 = '746ddd728163dd23beaa432dedb3b9d49aec3ab6';
const REMOVED_DIALOG_NOTES_V396 = Object.freeze([
  'docs/ver320-task-dialog-ux.md',
  'docs/ver321-regression-scope.md',
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
  assert.ok(fs.existsSync(path.join(ROOT, 'docs/ver321-task-dialog-polish.md')),
    'Ver.321 rollback and release contract note must remain for its existing test');
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
