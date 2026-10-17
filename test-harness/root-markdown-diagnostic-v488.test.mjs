// Ver.488 temporary read-only diagnostic; remove from the final PR.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseGitIndex, auditRootMarkdown } from './root-markdown-reference-v426.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Ver.488 diagnostic: classify root note owners without deletion or source updates', () => {
  const raw = execFileSync('git', ['ls-files', '--stage', '-z'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024
  });
  const report = auditRootMarkdown(parseGitIndex(raw),
    relative => fs.readFileSync(path.join(ROOT, relative), 'utf8'));
  assert.deepEqual(report.readErrors, []);
  assert.ok(report.rows.length >= 40);
  console.log('VER488_ROOT_OWNER_SUMMARY', JSON.stringify({
    tracked: report.trackedRootMarkdown,
    sources: report.entriesScanned,
    noLiteralOwner: report.withoutLiteralOwners,
    docOnly: report.rows.filter(row =>
      row.byKind.documentation > 0 && row.byKind.test_or_tool === 0
      && row.byKind.runtime_or_config === 0).length,
    executableOrTest: report.rows.filter(row =>
      row.byKind.test_or_tool || row.byKind.runtime_or_config).length
  }));
  console.log('VER488_ROOT_OWNER_DETAIL', JSON.stringify(report.rows.map(row => ({
    file: row.path, blobSha: row.blobSha,
    byKind: row.byKind,
    owners: row.references.map(ref => ({ path: ref.path, kind: ref.kind,
      line: ref.lineNumbers[0], sample: ref.sample.slice(0, 120) }))
  }))));
});
