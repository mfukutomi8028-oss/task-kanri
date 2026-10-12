import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_EXTENSIONS = new Set([
  '.md', '.mdx', '.mjs', '.cjs', '.js', '.ts', '.tsx', '.css', '.html',
  '.json', '.yml', '.yaml', '.ps1', '.sh', '.txt', '.xml', '.svg'
]);
const SELF_EXCLUSIONS = new Set([
  'test-harness/root-markdown-reference-v426.mjs',
  'test-harness/root-markdown-reference-v426.test.mjs',
  'docs/ROOT_MARKDOWN_REFERENCE_AUDIT_V426.md'
]);

export function parseGitIndex(output) {
  return String(output).split('\0').filter(Boolean).map(entry => {
    const match = /^([0-7]{6}) ([0-9a-f]{40,64}) ([0-3])\t([\s\S]+)$/.exec(entry);
    if (!match) throw new Error('Unrecognized tracked file entry');
    return { path: match[4], blobSha: match[2] };
  });
}

export function findLiteralLines(content, basename, limit = 8) {
  const escaped = basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exact = new RegExp('(^|[^A-Za-z0-9_.-])' + escaped + '(?=$|[^A-Za-z0-9_.-])');
  const hits = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    if (exact.test(lines[index])) {
      hits.push({ line: index + 1, excerpt: lines[index].trim().slice(0, 160) });
      if (hits.length >= limit) break;
    }
  }
  return hits;
}

function sourceKind(p) {
  if (p.startsWith('tests/') || p.startsWith('test-harness/') || /\.test\.|\.spec\./.test(p)) return 'test_or_tool';
  if (/\.mdx?$/.test(p)) return 'documentation';
  return 'runtime_or_config';
}

export function auditRootMarkdown(entries, readText) {
  const documents = entries.filter(e => !e.path.includes('/') && e.path.endsWith('.md'))
    .sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const sources = entries.filter(e => !SELF_EXCLUSIONS.has(e.path) &&
    SCAN_EXTENSIONS.has(path.extname(e.path).toLowerCase()));
  const contentByPath = new Map();
  const readErrors = [];
  for (const entry of sources) {
    try { contentByPath.set(entry.path, String(readText(entry.path))); }
    catch (error) { readErrors.push({ path: entry.path, reason: String(error?.message || error) }); }
  }

  const rows = documents.map(doc => {
    const references = [];
    for (const source of sources) {
      if (source.path === doc.path || !contentByPath.has(source.path)) continue;
      const matches = findLiteralLines(contentByPath.get(source.path), doc.path);
      if (matches.length) references.push({
        path: source.path, kind: sourceKind(source.path), lineNumbers: matches.map(x => x.line),
        sample: matches[0].excerpt
      });
    }
    references.sort((a, b) => a.path.localeCompare(b.path, 'en'));
    const byKind = { documentation: 0, test_or_tool: 0, runtime_or_config: 0 };
    for (const ref of references) byKind[ref.kind]++;
    return { path: doc.path, blobSha: doc.blobSha, ownerCount: references.length,
      byKind, references, reviewRequired: true };
  });
  return { auditVersion: 426, trackedRootMarkdown: documents.length,
    entriesScanned: sources.length, readErrors,
    withoutLiteralOwners: rows.filter(x => x.ownerCount === 0).length, rows,
    caution: 'Textual matches, not dependency proof. Zero matches NEVER authorize deletion; dynamic and cached references require manual review.' };
}

export function toMarkdown(report) {
  const out = [
    '# Root Markdown reference evidence (Ver.426)', '',
    `Tracked root Markdown: ${report.trackedRootMarkdown}`,
    `Text sources considered: ${report.entriesScanned}`,
    `Files with no literal owner found: ${report.withoutLiteralOwners}`,
    `Unreadable source files: ${report.readErrors.length}`, '',
    '**Read-only heuristic. No file is approved for deletion.**', '',
    '| Root Markdown | Doc refs | Tests/tools | Runtime/config | SHA |',
    '| --- | ---: | ---: | ---: | --- |'
  ];
  for (const row of report.rows) out.push(`| ${row.path} | ${row.byKind.documentation} | ${row.byKind.test_or_tool} | ${row.byKind.runtime_or_config} | \`${row.blobSha}\` |`);
  out.push('', 'Refer to the `--json` output for owner paths, line numbers and evidence excerpts.');
  return out.join('\n') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raw = execFileSync('git', ['ls-files', '--stage', '-z'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const report = auditRootMarkdown(parseGitIndex(raw), p => fs.readFileSync(path.join(ROOT, p), 'utf8'));
  process.stdout.write(process.argv.includes('--json') ? JSON.stringify(report, null, 2) + '\n' : toMarkdown(report));
  if (report.readErrors.length) process.exitCode = 1;
}
