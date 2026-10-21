import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findLiteralLines, parseGitIndex } from './root-markdown-reference-v426.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = 'docs/HISTORICAL_ROOT_AUDIT_LEDGER_V430.md';
const ARCHIVE_INDEXES = Object.freeze([
  'docs/HISTORICAL_ROOT_AUDITS_V427.md',
  'docs/HISTORICAL_FAVORITE_OBSERVER_AUDITS_V428.md',
  'docs/HISTORICAL_RUNTIME_INVENTORIES_V429.md',
  LEDGER,
  'docs/HISTORICAL_SUPERSEDED_AUDITS_V436.md',
  'docs/HISTORICAL_IMPLEMENTATION_NOTES_V437.md',
  'docs/STAGE_E_ROOT_MARKDOWN_TRIAGE_V438.md',
  'docs/HISTORICAL_FILE_RETIREMENT_NOTES_V447.md',
  'docs/HISTORICAL_PRODUCT_HANDOFF_NOTES_V448.md',
  'docs/HISTORICAL_MOBILE_RECOVERY_AUDITS_V510.md',
  'docs/HISTORICAL_MOBILE_INTERACTION_AUDITS_V511.md',
  'docs/HISTORICAL_MOBILE_RESIZE_SCHEDULE_AUDITS_V512.md'
]);
const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.yml', '.yaml', '.html', '.css', '.ps1', '.sh']);
const HISTORY_VALIDATORS = new Set([
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
  const names = parseHistoricalArchiveIndexes(archivePath =>
    fs.readFileSync(path.join(root, archivePath), 'utf8'));
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

/**
 * Collect retired root Markdown names from V427-V430 and later validated archive indexes.
 * Fail closed on malformed metadata, missing index files, or conflicting entries.
 */
export function parseHistoricalArchiveIndexes(readIndex, indexes = ARCHIVE_INDEXES) {
  const all = [];
  const seen = new Set();
  for (const indexPath of indexes) {
    const markdown = String(readIndex(indexPath));
    const names = indexPath === LEDGER
      ? parseLedgerArchivedNames(markdown)
      : parseHistoricalArchiveTable(markdown, indexPath);
    for (const name of names) {
      if (seen.has(name)) throw new Error('Duplicate archived Markdown across indexes: ' + name);
      seen.add(name);
      all.push(name);
    }
  }
  if (!all.length) throw new Error('No archived Markdown to audit');
  return all;
}

export function parseHistoricalArchiveTable(markdown, indexPath) {
  const result = [];
  const seen = new Set();
  for (const line of String(markdown).split(/\r?\n/)) {
    const cells = line.trim().split('|').slice(1, -1).map(x => x.trim());
    if (cells.length < 4 || !/^\x60[A-Za-z0-9][A-Za-z0-9_.-]*\.md\x60$/.test(cells[0])) continue;
    const name = cells[0].slice(1, -1);
    const blob = cells[1];
    if (!/^\x60[0-9a-f]{40}\x60$/.test(blob)) {
      throw new Error('Malformed blob SHA in ' + indexPath + ': ' + name);
    }
    const original = cells.find(c => c.includes('https://github.com/') && c.includes('/blob/'));
    if (!original || !original.includes('/' + name + ')') ||
        !/\/blob\/[0-9a-f]{40}\//.test(original)) {
      throw new Error('Missing immutable source URL in ' + indexPath + ': ' + name);
    }
    if (seen.has(name)) throw new Error('Duplicate archive row in ' + indexPath + ': ' + name);
    seen.add(name);
    result.push(name);
  }
  if (!result.length) throw new Error('No archived Markdown rows found in ' + indexPath);
  return result;
}
