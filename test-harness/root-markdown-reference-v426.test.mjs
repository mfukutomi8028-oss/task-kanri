import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { auditRootMarkdown, findLiteralLines, parseGitIndex, toMarkdown } from './root-markdown-reference-v426.mjs';

const blob = '1234567890abcdef1234567890abcdef12345678';

test('Ver.426 parses tracked entries without changing their paths or Git blob IDs', () => {
  const result = parseGitIndex(`100644 ${blob} 0\tfixture-note.md\0` +
    `100755 ${blob} 0\ttests/fixture-check.mjs\0`);
  assert.deepEqual(result, [
    { path: 'fixture-note.md', blobSha: blob },
    { path: 'tests/fixture-check.mjs', blobSha: blob }
  ]);
  assert.throws(() => parseGitIndex('not a valid Git index record\0'), /Unrecognized/);
});

test('Ver.426 distinguishes exact names from suffix, prefix, and extension collisions', () => {
  const s = 'fixture-note.md\nother-fixture-note.md\nfixture-note.md.js\n' +
    '[text](docs/fixture-note.md)\nfixture-note.mdx\n';
  assert.deepEqual(findLiteralLines(s, 'fixture-note.md').map(x => x.line), [1, 4]);
});

test('Ver.426 excludes self references and scanner fixtures but preserves independent owners', () => {
  const entries = [
    { path: 'fixture-note.md', blobSha: blob },
    { path: 'other-note.md', blobSha: blob },
    { path: 'README.md', blobSha: blob },
    { path: 'tests/link-contract.spec.mjs', blobSha: blob },
    { path: 'src/notes.js', blobSha: blob },
    { path: 'test-harness/root-markdown-reference-v426.test.mjs', blobSha: blob },
    { path: 'docs/ROOT_MARKDOWN_REFERENCE_AUDIT_V426.md', blobSha: blob }
  ];
  const content = {
    'fixture-note.md': 'self fixture-note.md',
    'other-note.md': 'not a reference',
    'README.md': 'See [fixture](fixture-note.md)',
    'tests/link-contract.spec.mjs': "const target = 'fixture-note.md';",
    'src/notes.js': 'const unrelated = "fixture-note.md.js";',
    'test-harness/root-markdown-reference-v426.test.mjs': 'other-note.md',
    'docs/ROOT_MARKDOWN_REFERENCE_AUDIT_V426.md': 'other-note.md'
  };
  const report = auditRootMarkdown(entries, p => content[p]);
  assert.equal(report.trackedRootMarkdown, 3);
  const row = report.rows.find(x => x.path === 'fixture-note.md');
  assert.equal(row.ownerCount, 2);
  assert.deepEqual(row.byKind, { documentation: 1, test_or_tool: 1, runtime_or_config: 0 });
  assert.equal(row.reviewRequired, true);
  assert.equal(report.rows.find(x => x.path === 'other-note.md').ownerCount, 0);
  assert.match(toMarkdown(report), /No file is approved for deletion/);
});

test('Ver.426 reports failed reads rather than silently treating them as no reference', () => {
  const entries = [{ path: 'fixture-note.md', blobSha: blob },
    { path: 'src/broken.js', blobSha: blob }];
  const report = auditRootMarkdown(entries, p => {
    if (p.endsWith('.js')) throw new Error('cannot read source');
    return '';
  });
  assert.deepEqual(report.readErrors.map(x => x.path), ['src/broken.js']);
});

test('Ver.426 inventories the tracked checkout without changing files', t => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  if (!fs.existsSync(path.join(root, '.git'))) return t.skip('Not a Git checkout');
  const index = execFileSync('git', ['ls-files', '--stage', '-z'],
    { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const rows = auditRootMarkdown(parseGitIndex(index), name =>
    fs.readFileSync(path.join(root, name), 'utf8'));
  assert.equal(rows.readErrors.length, 0);
  assert.ok(rows.trackedRootMarkdown > 0);
  assert.ok(rows.rows.every(row => row.reviewRequired && /^[0-9a-f]{40}$/.test(row.blobSha)));
  console.log('VER426_MARKDOWN_REFERENCE_SUMMARY', JSON.stringify({
    rootMarkdown: rows.trackedRootMarkdown, filesScanned: rows.entriesScanned,
    withoutLiteralOwners: rows.withoutLiteralOwners
  }));
  console.log('VER426_ZERO_LITERAL_OWNER_SAMPLES', JSON.stringify(
    rows.rows.filter(row => row.ownerCount === 0).slice(0, 200)
      .map(row => ({ path: row.path, blobSha: row.blobSha }))));
});
