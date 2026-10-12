import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLedgerArchivedNames, scanArchivedCodeReferences, auditCurrentCheckout } from './stage-e-archived-reference-guard-v431.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = 'a'.repeat(40);
const old = 'MOBILE_SHELL_BOARD_OBSERVER_AUDIT_V299.md';
const tick = String.fromCharCode(96);

test('Ver.431 parses SHA-pinned archived ledger rows and rejects duplicate/bad entries', () => {
  const row = name => '| ' + tick + name + tick + ' | ' + tick + sha + tick +
    ' | ' + tick + sha + tick + ' | 100 | ' + tick + 'PRODUCT.md' + tick +
    ' | [original](https://github.com/example) |';
  assert.deepEqual(parseLedgerArchivedNames(row(old)), [old]);
  assert.throws(() => parseLedgerArchivedNames(row(old) + '\n' + row(old)), /Duplicate/);
  assert.throws(() => parseLedgerArchivedNames(row('bad/path.md')), /Invalid/);
});

test('Ver.431 catches the old V299 missing-Markdown regression without false suffix hits', () => {
  const entries = [
    { path: 'test-harness/mobile-shell-board-observer-v299.test.mjs' },
    { path: 'README.md' },
    { path: 'test-harness/historical-root-audit-ledger-v430.test.mjs' },
    { path: 'test-harness/another.test.mjs' }
  ];
  const content = {
    [entries[0].path]: "const x = readFileSync('" + old + "', 'utf8');",
    [entries[1].path]: 'Historic: ' + old,
    [entries[2].path]: "const expected = '" + old + "'",
    [entries[3].path]: "'OTHER_" + old + "' and '" + old + ".backup' should not match"
  };
  const report = scanArchivedCodeReferences([old], entries, p => content[p]);
  assert.equal(report.scannedFiles, 2);
  assert.deepEqual(report.hits.map(x => ({ source: x.source, retired: x.retired })),
    [{ source: entries[0].path, retired: old }]);
});

test('Ver.431 refuses to count unreadable tracked code as no references', () => {
  const result = scanArchivedCodeReferences([old], [{ path: 'tests/broken.spec.mjs' }], () => {
    throw new Error('unable to read');
  });
  assert.equal(result.hits.length, 0);
  assert.equal(result.readErrors.length, 1);
});

test('Ver.431 Git checkout has no reintroduced archived docs or active references', t => {
  if (!fs.existsSync(path.join(ROOT, '.git'))) return t.skip('Requires Git checkout');
  const report = auditCurrentCheckout(ROOT);
  assert.ok(report.retiredCount >= 6);
  assert.deepEqual(report.stillTracked, [], 'Retired file returned in tracked root');
  assert.deepEqual(report.readErrors, [], 'Unreadable tracked source');
  assert.deepEqual(report.hits, [], 'Active code references retired Markdown');
  console.log('VER431_ARCHIVED_CODE_REFERENCE_AUDIT', JSON.stringify({
    retired: report.retiredCount, codeFiles: report.scannedFiles,
    errors: report.readErrors.length, liveReferences: report.hits.length
  }));
});
