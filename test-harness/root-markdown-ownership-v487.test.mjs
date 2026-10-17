// Ver.487: read-only Stage D root-document ownership triage.
// Do not interpret lack of literal references or "documentation-only" as permission to delete.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { auditRootMarkdown, parseGitIndex } from './root-markdown-reference-v426.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function summarizeRootOwnership(report) {
  const summary = { total: report.rows.length, runtimeOrConfig: 0, testOrTool: 0,
    documentationOnly: 0, noLiteralOwner: 0, reviewOnly: true };
  const rows = report.rows.map(row => {
    const code = row.byKind.runtime_or_config;
    const tests = row.byKind.test_or_tool;
    const docs = row.byKind.documentation;
    const group = code ? 'runtime-or-config-reference'
      : tests ? 'test-or-tool-reference'
      : docs ? 'documentation-only-reference'
      : 'no-literal-owner';
    if (code) summary.runtimeOrConfig++;
    else if (tests) summary.testOrTool++;
    else if (docs) summary.documentationOnly++;
    else summary.noLiteralOwner++;
    return {
      path: row.path, blobSha: row.blobSha, group, counts: { runtimeOrConfig: code, testOrTool: tests, documentation: docs },
      owners: row.references.map(ref => ({ path: ref.path, kind: ref.kind }))
    };
  });
  assert.equal(summary.total,
    summary.runtimeOrConfig + summary.testOrTool + summary.documentationOnly + summary.noLiteralOwner);
  return { summary, rows };
}

test('Ver.487 reports documentation-only vs test and runtime owners without authorizing deletions', () => {
  const sha = 'a'.repeat(40);
  const names = ['a.md', 'b.md', 'c.md', 'd.md'];
  const entries = [
    ...names.map(p => ({ path: p, blobSha: sha })),
    { path: 'docs/linked.md', blobSha: sha },
    { path: 'tests/owned.spec.mjs', blobSha: sha },
    { path: 'app.js', blobSha: sha }
  ];
  const source = Object.fromEntries(entries.map(e => [e.path, '']));
  source['docs/linked.md'] = 'See [a](../a.md)';
  source['tests/owned.spec.mjs'] = "const filename = 'b.md';";
  source['app.js'] = "const file = 'c.md';";
  const classified = summarizeRootOwnership(auditRootMarkdown(entries, p => source[p]));
  assert.equal(classified.summary.total, 4);
  assert.equal(classified.summary.runtimeOrConfig, 1);
  assert.equal(classified.summary.testOrTool, 1);
  assert.equal(classified.summary.documentationOnly, 1);
  assert.equal(classified.summary.noLiteralOwner, 1);
  assert.equal(classified.summary.reviewOnly, true);
  assert.deepEqual(Object.fromEntries(classified.rows.map(r => [r.path, r.group])), {
    'a.md': 'documentation-only-reference', 'b.md': 'test-or-tool-reference',
    'c.md': 'runtime-or-config-reference', 'd.md': 'no-literal-owner'
  });
});

test('Ver.487 inventories exact tracked root document owners on the actual checkout', t => {
  if (!fs.existsSync(path.join(ROOT, '.git'))) return t.skip('Requires Git checkout');
  const stage = execFileSync('git', ['ls-files', '--stage', '-z'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024
  });
  const report = auditRootMarkdown(parseGitIndex(stage), p =>
    fs.readFileSync(path.join(ROOT, p), 'utf8'));
  assert.deepEqual(report.readErrors, [], 'No unreadable tracked code or docs may be counted as unreferenced');
  const evidence = summarizeRootOwnership(report);
  assert.equal(evidence.summary.total, report.trackedRootMarkdown);
  assert.ok(evidence.summary.total >= 30, 'Unexpected tracked root document drop');
  assert.ok(evidence.rows.every(r => /^[0-9a-f]{40}$/.test(r.blobSha)));
  assert.ok(evidence.rows.every(r => r.counts.runtimeOrConfig + r.counts.testOrTool +
    r.counts.documentation === r.owners.length));

  console.log('VER487_ROOT_OWNERSHIP_COUNTS', JSON.stringify(evidence.summary));
  console.log('VER487_DOCS_ONLY_AND_UNOWNED', JSON.stringify(evidence.rows.filter(r =>
    r.group === 'documentation-only-reference' || r.group === 'no-literal-owner')));
  // Only report tool/test-level owners for the lower-risk historical audit documents;
  // literal matches are hints, not proof a test executes a file read.
  console.log('VER487_HISTORICAL_AUDIT_OWNER_INDEX', JSON.stringify(evidence.rows
    .filter(r => /_AUDIT_|_RETIREMENT_|_V3\d\d\.md$/.test(r.path))
    .map(r => ({ path: r.path, group: r.group, counts: r.counts,
      codeOwners: r.owners.filter(o => o.kind !== 'documentation').map(o => o.path) }))));
});
