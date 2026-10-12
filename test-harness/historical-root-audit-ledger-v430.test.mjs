import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = 'docs/HISTORICAL_ROOT_AUDIT_LEDGER_V430.md';
const REPO = 'mfukutomi8028-oss/task-kanri';
const FIRST_BATCH = Object.freeze([
  'PERSONAL_REMINDER_POLLING_AUDIT_V362.md',
  'SCHEDULE_REMINDER_POLLING_AUDIT_V360.md',
  'SCHEDULE_TODAY_POLLING_AUDIT_V358.md',
  'SIDEBAR_COMPATIBILITY_AUDIT_V289.md',
  'SIDEBAR_SEMANTIC_TAKEOVER_AUDIT_V317.md',
  'WORK_FEATURES_OBSERVER_BOUNDARY_AUDIT_V314.md'
]);
const ACTIVE_ENTRYPOINTS = Object.freeze([
  'README.md', 'REGRESSION_TESTS.md', 'PATCH_RESPONSIBILITY_MAP.md',
  'DEVELOPMENT_PLAN_V371.md', 'release-notes.md', 'release-manifest.js',
  'index.html', 'package.json'
]);

function readLedger() {
  const markdown = fs.readFileSync(path.join(ROOT, LEDGER), 'utf8');
  const tick = String.fromCharCode(96);
  const rows = markdown.split('\n')
    .filter(line => line.startsWith('| ' + tick))
    .map(line => {
      const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
      assert.equal(cells.length, 6, 'ledger row must have six columns: ' + line);
      const unquote = value => {
        assert.ok(value.startsWith(tick) && value.endsWith(tick), 'expected quoted metadata: ' + value);
        return value.slice(1, -1);
      };
      const retired = unquote(cells[0]);
      const sourceCommit = unquote(cells[1]);
      const blobSha = unquote(cells[2]);
      const successor = unquote(cells[4]);
      const bytes = Number(cells[3].replaceAll(',', ''));
      const match = /^\[原本\]\((https:\/\/github\.com\/[^)]+)\)$/.exec(cells[5]);
      assert.ok(match, 'invalid fixed recovery link: ' + retired);
      return { retired, sourceCommit, blobSha, bytes, successor, url: match[1] };
    });
  return { markdown, rows };
}

test('Ver.430 audit ledger retains all original eight reports and reusable future rows', () => {
  const { markdown, rows } = readLedger();
  assert.ok(markdown.includes('Issue #292'));
  assert.ok(markdown.includes('Ver.429'));
  assert.ok(markdown.includes('checkpoint'));
  assert.ok(markdown.includes('blob/main/'));
  assert.ok(rows.length >= FIRST_BATCH.length);
  const seen = new Set();
  for (const row of rows) {
    assert.match(row.sourceCommit, /^[0-9a-f]{40}$/);
    assert.match(row.blobSha, /^[0-9a-f]{40}$/);
    assert.ok(row.retired.endsWith('.md') && !row.retired.includes('/'));
    assert.ok(row.successor.endsWith('.md') && !row.successor.includes('/'));
    assert.ok(!seen.has(row.retired), 'duplicate original: ' + row.retired);
    seen.add(row.retired);
    assert.ok(Number.isSafeInteger(row.bytes) && row.bytes > 0);
    assert.equal(fs.existsSync(path.join(ROOT, row.retired)), false, 'old root audit still present: ' + row.retired);
    assert.ok(fs.existsSync(path.join(ROOT, row.successor)), 'retained successor missing: ' + row.successor);
    assert.equal(row.url, 'https://github.com/' + REPO + '/blob/' +
      row.sourceCommit + '/' + row.retired, 'recovery URL is not commit pinned');
  }
  for (const old of FIRST_BATCH) assert.ok(seen.has(old), 'Ver.430 audit row missing: ' + old);
});

test('Historical ledger archives do not leave stale paths in current entrypoints', () => {
  const { rows } = readLedger();
  for (const target of ACTIVE_ENTRYPOINTS) {
    const src = fs.readFileSync(path.join(ROOT, target), 'utf8');
    for (const row of rows) {
      assert.equal(src.includes(row.retired), false, target + ' refers to retired ' + row.retired);
    }
  }
});
