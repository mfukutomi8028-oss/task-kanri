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

test('Ver.492 read-only owner scan for retiring historical keydown Protocol', () => {
  const index = execFileSync('git', ['ls-files', '--stage', '-z'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const oldBase = 'comment-reactions-keydown-scope-v346.test.mjs';
  const oldFull = 'test-harness/' + oldBase;
  const extensions = new Set(['.md','.mjs','.js','.json','.yml','.yaml','.html','.css','.ps1','.ts','.cjs','.txt']);
  const hits = [];
  const readErrors = [];
  for (const entry of parseGitIndex(index)) {
    if (entry.path === oldFull || entry.path.endsWith('ver492-root-doc-owner-diagnostic.test.mjs')) continue;
    if (!extensions.has(path.extname(entry.path).toLowerCase())) continue;
    let content;
    try { content = fs.readFileSync(path.join(ROOT, entry.path), 'utf8'); }
    catch (error) { readErrors.push(entry.path + ': ' + String(error)); continue; }
    if (content.includes(oldFull) || content.includes(oldBase)) {
      hits.push({ source: entry.path, kind: /^test-harness\/|^tests\//.test(entry.path) ? 'test' : entry.path.endsWith('.md') ? 'documentation' : 'runtime_or_config' });
    }
  }
  console.log('VER492_TEST_FILE_REFS', JSON.stringify({oldFull, hits, readErrors}));
  assert.equal(readErrors.length, 0);
});
