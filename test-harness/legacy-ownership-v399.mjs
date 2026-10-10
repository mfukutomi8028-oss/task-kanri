// Ver.399: evidence-only ownership matrix for manifest-undeclared root JS/CSS.
// A textual reference and the absence of one are NOT permission to delete files.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { auditLegacy } from './legacy-retirement-evidence-v393.mjs';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function classifyOwnership(row) {
  const runtime = (row.runtimeRefs || []).length > 0;
  const tests = (row.testRefs || []).length > 0;
  if (runtime && tests) return 'runtime-and-test';
  if (runtime) return 'runtime-only';
  if (tests) return 'test-only';
  return 'no-literal-refs';
}

function gitBlobSha(content) {
  return createHash('sha1')
    .update('blob ' + content.length + '\0')
    .update(content).digest('hex');
}

function sourceEvidence(root, owner, asset) {
  const filename = path.resolve(root, owner);
  const relative = path.relative(root, filename);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Audit reference escapes repository: ' + owner);
  }
  const raw = fs.readFileSync(filename, 'utf8');
  const matches = raw.split(/\r?\n/).flatMap((line, i) => {
    // The earlier inventory may discover names in quoted or URL-prefixed form.
    if (!line.includes(asset) && !line.includes('/' + path.basename(asset))) return [];
    const hint = /(?:readFileSync|existsSync|statSync|openSync|readFile|fetch\(|request\.get\()/i.test(line)
      ? 'possible-file-access'
      : /(?:expect|assert|match|toContain|toEqual|test\(|describe\()/i.test(line)
        ? 'possible-assertion' : 'literal-mention';
    return [{ line: i + 1, hint, text: line.trim().slice(0, 240) }];
  });
  return { owner, matches: matches.slice(0, 6), totalMatches: matches.length };
}

export function buildLegacyOwnershipMatrix(root = DEFAULT_ROOT) {
  const directory = path.resolve(root);
  const report = auditLegacy(directory);
  const rows = report.rows.map(item => {
    const buffer = fs.readFileSync(path.join(directory, item.path));
    const category = classifyOwnership(item);
    return {
      path: item.path, bytes: item.bytes, blobSha: gitBlobSha(buffer),
      category, runtimeRefs: [...item.runtimeRefs],
      testRefs: [...item.testRefs],
      testEvidence: item.testRefs.map(owner => sourceEvidence(directory, owner, item.path)),
      runtimeEvidence: item.runtimeRefs.map(owner => sourceEvidence(directory, owner, item.path)),
      documentationRefs: item.documentationRefs,
      identicalDeclaredAssets: [...item.identicalDeclaredAssets],
      pagesRootUrlPreserved: true,
      mayBeRequestedByCachedHtml: true,
      deletionAuthorized: false,
      nextAction: category === 'test-only' ? 'inspect-test-contract-and-legacy-url'
        : category === 'no-literal-refs' ? 'inspect-indirect-loads-and-legacy-url'
          : 'trace-current-runtime-ownership-and-legacy-url'
    };
  }).sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));

  const categories = ['runtime-and-test', 'runtime-only', 'test-only', 'no-literal-refs'];
  const byCategory = Object.fromEntries(categories.map(category => [
    category, { count: rows.filter(x => x.category === category).length,
      bytes: rows.filter(x => x.category === category).reduce((sum, x) => sum + x.bytes, 0) }
  ]));
  return {
    summary: {
      ...report.summary,
      byCategory,
      testedFiles: rows.filter(row => row.testRefs.length).length,
      unmodifiedInventory: true,
      note: 'Read-only textual reference evidence. No file is approved for deletion.'
    },
    rows
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify(buildLegacyOwnershipMatrix(), null, 2) + '\n');
}
