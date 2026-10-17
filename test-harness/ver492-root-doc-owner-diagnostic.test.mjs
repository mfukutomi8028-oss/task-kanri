// Ver.492 temporary read-only CI inventory; remove before final PR approval.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { auditRootMarkdown, parseGitIndex } from './root-markdown-reference-v426.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
test('Ver.492 read-only root Markdown ownership inventory', () => {
  const index = execFileSync('git', ['ls-files', '--stage', '-z'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const report = auditRootMarkdown(parseGitIndex(index), p =>
    fs.readFileSync(path.join(ROOT, p), 'utf8'));
  assert.equal(report.readErrors.length, 0, 'unreadable source must stop retirement');
  for (const row of report.rows) {
    const info = {
      name: row.path,
      sha: row.blobSha,
      bytes: fs.statSync(path.join(ROOT, row.path)).size,
      refs: row.byKind,
      sources: row.references.map(x => ({name:x.path, kind:x.kind}))
    };
    console.log('VER492_DOC_OWNER', JSON.stringify(info));
  }
  console.log('VER492_DOC_COUNTS', JSON.stringify({
    documents: report.trackedRootMarkdown,
    sources: report.entriesScanned,
    zero_literal_owners: report.withoutLiteralOwners
  }));
});
