import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLedgerArchivedNames, parseHistoricalArchiveTable, parseHistoricalArchiveIndexes, scanArchivedCodeReferences, auditCurrentCheckout } from './stage-e-archived-reference-guard-v431.mjs';

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
  assert.ok(report.retiredCount >= 20);
  assert.deepEqual(report.stillTracked, [], 'Retired file returned in tracked root');
  assert.deepEqual(report.readErrors, [], 'Unreadable tracked source');
  assert.deepEqual(report.hits, [], 'Active code references retired Markdown');
  console.log('VER431_ARCHIVED_CODE_REFERENCE_AUDIT', JSON.stringify({
    retired: report.retiredCount, codeFiles: report.scannedFiles,
    errors: report.readErrors.length, liveReferences: report.hits.length
  }));
});

test('Ver.432 extends live-reference guard across all four historical indexes', () => {
  const ref = '0123456789abcdef0123456789abcdef01234567';
  const blob = 'fedcba9876543210fedcba9876543210fedcba98';
  const row = name => '| `' + name + '` | `' + blob + '` | 42 | [source](https://github.com/example/task/blob/' + ref + '/' + name + ') |';
  const names = parseHistoricalArchiveIndexes(p =>
    p.endsWith('V430.md')
      ? '| `FOUR.md` | `' + ref + '` | `' + blob + '` | 42 | `SUCCESSOR.md` | [source](https://github.com/example) |'
      : row(p.includes('V427') ? 'ONE.md' : p.includes('V428') ? 'TWO.md' : p.includes('V429') ? 'THREE.md' : 'FIVE.md'));
  assert.deepEqual(names, ['ONE.md', 'TWO.md', 'THREE.md', 'FOUR.md', 'FIVE.md']);
  assert.throws(() => parseHistoricalArchiveIndexes(() => row('DUPLICATE.md')), /Duplicate/);
  assert.throws(() => parseHistoricalArchiveTable(row('VALID.md').replace(blob, 'bad'), 'fixture'), /Malformed/);
  assert.throws(() => parseHistoricalArchiveTable(row('VALID.md').replace('/blob/', '/tree/'), 'fixture'), /Missing immutable/);
  assert.throws(() => parseHistoricalArchiveIndexes(() => { throw new Error('missing index'); }), /missing index/);
});

test('Ver.436 preserves three superseded audit originals at immutable SHA and retires root copies', () => {
  const source = 'bd843e4eb27775fa9ad4e9b50362ae636b6f6209';
  const archive = 'docs/HISTORICAL_SUPERSEDED_AUDITS_V436.md';
  const text = fs.readFileSync(path.join(ROOT, archive), 'utf8');
  const expected = Object.freeze({
    'BRAND_BOOTSTRAP_AUDIT_V280.md': 'fd47dd9c21b17a85f9d17532a4e2560fa1f4d313',
    'INSIGHTS_POLLING_SCOPE_AUDIT_V356.md': 'c3f215bfc0c8967bdb8d04a808951025ef56331c',
    'REGRESSION_PARALLEL_V381.md': '72f1bfed98b6499a592d0ffa365fec77f9cf95ac'
  });
  const parsed = parseHistoricalArchiveTable(text, archive);
  assert.deepEqual(parsed.slice().sort(), Object.keys(expected).sort());
  for (const [oldName, blob] of Object.entries(expected)) {
    assert.equal(fs.existsSync(path.join(ROOT, oldName)), false, 'retired audit returned: ' + oldName);
    assert.ok(text.includes('`' + blob + '`'), 'source blob hash not pinned: ' + oldName);
    assert.ok(text.includes('https://github.com/mfukutomi8028-oss/task-kanri/blob/' +
      source + '/' + oldName + ')'), 'immutable recovery URL missing: ' + oldName);
  }
  assert.ok(text.includes('11,683'), 'byte count of historical originals changed');
  assert.ok(text.includes('Issue #292'));
  assert.ok(text.includes('blob/main/'), 'external cached link risk not documented');
});
