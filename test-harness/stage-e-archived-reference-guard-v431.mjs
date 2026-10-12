import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findLiteralLines, parseGitIndex } from './root-markdown-reference-v426.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = 'docs/HISTORICAL_ROOT_AUDIT_LEDGER_V430.md';
const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.yml', '.yaml', '.html', '.css', '.ps1', '.sh']);
const HISTORY_VALIDATORS = new Set([
  'test-harness/historical-root-audits-v427.test.mjs',
  'test-harness/historical-root-audits-v428.test.mjs',
  'test-harness/historical-runtime-inventories-v429.test.mjs',
  'test-harness/historical-root-audit-ledger-v430.test.mjs',
  'test-harness/stage-e-archived-reference-guard-v431.test.mjs'
]);

export function parseLedgerArchivedNames(markdown) {
  const tick = String.fromCharCode(96);
  const result = [];
  const seen = new Set();
  for (const line of String(markdown).split(/\r?\n/)) {
    if (!line.startsWith('| ' + tick)) continue;
    const cells = line.split('|').slice(1, -1).map(s => s.trim());
    if (cells.length !== 6 || !cells[0].startsWith(tick) || !cells[0].endsWith(tick)) {
      throw new Error('Unexpected historical ledger row shape');
    }
    const name = cells[0].slice(1, -1);
    const shaOK = value => value.startsWith(tick) && value.endsWith(tick) &&
      /^[0-9a-f]{40}$/.test(value.slice(1, -1));
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*\.md$/.test(name) || !shaOK(cells[1]) || !shaOK(cells[2])) {
      throw new Error('Invalid historical ledger row metadata: ' + name);
    }
    if (seen.has(name)) throw new Error('Duplicate historical ledger entry: ' + name);
    seen.add(name);
    result.push(name);
  }
  if (!result.length) throw new Error('No retired Markdown rows in the historical ledger');
  return result;
}

export function scanArchivedCodeReferences(retiredNames, sourceEntries, readSource) {
  const hits = [];
  const readErrors = [];
  const trackedCode = sourceEntries.filter(entry => CODE_EXT.has(path.extname(entry.path).toLowerCase()) &&
    !HISTORY_VALIDATORS.has(entry.path));
  for (const entry of trackedCode) {
    let content;
    try { content = String(readSource(entry.path)); }
    catch (error) {
      readErrors.push({ path: entry.path, reason: String(error?.message || error) });
      continue;
    }
    for (const retired of retiredNames) {
      if (!content.includes(retired)) continue;
      for (const match of findLiteralLines(content, retired, 4)) {
        hits.push({ source: entry.path, retired, line: match.line, excerpt: match.excerpt });
      }
    }
  }
  return { scannedFiles: trackedCode.length, retiredCount: retiredNames.length, hits, readErrors };
}

export function auditCurrentCheckout(root = ROOT) {
  const markdown = fs.readFileSync(path.join(root, LEDGER), 'utf8');
  const names = parseLedgerArchivedNames(markdown);
  const index = execFileSync('git', ['ls-files', '--stage', '-z'], {
    cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024
  });
  const entries = parseGitIndex(index);
  const rootNames = new Set(entries.map(row => row.path));
  const stillTracked = names.filter(name => rootNames.has(name));
  const report = scanArchivedCodeReferences(names, entries,
    source => fs.readFileSync(path.join(root, source), 'utf8'));
  return { ...report, stillTracked };
}
