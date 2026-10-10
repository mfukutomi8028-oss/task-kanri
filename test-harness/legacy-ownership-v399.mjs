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

// Require a complete filename token. Substring matches (e.g. a filename
// prefixed by "test-") are not evidence of a reference to the shorter file.
export function exactAssetMention(line, asset) {
  let start = 0;
  let at = -1;
  while ((at = line.indexOf(asset, start)) !== -1) {
    const before = at > 0 ? line[at - 1] : '';
    const after = line[at + asset.length] || '';
    if (!/[A-Za-z0-9_.-]/.test(before) && !/[A-Za-z0-9_.-]/.test(after)) return true;
    start = at + asset.length;
  }
  return false;
}

function nonCommentSource(raw, owner) {
  if (!/\.(?:js|mjs|cjs|css)$/.test(owner)) return raw;
  // Keep newlines/offsets for line-accurate evidence. This is only a
  // heuristic: unusual inline comments and template syntax need manual review.
  let source = raw.replace(/\/\*[\s\S]*?\*\//g,
    matched => matched.replace(/[^\r\n]/g, ' '));
  if (/\.(?:js|mjs|cjs)$/.test(owner)) {
    source = source.replace(/^[ \t]*\/\/.*$/gm,
      matched => matched.replace(/[^\r\n]/g, ' '));
  }
  return source;
}

function sourceEvidence(root, owner, asset) {
  const filename = path.resolve(root, owner);
  const relative = path.relative(root, filename);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Audit reference escapes repository: ' + owner);
  }
  const raw = fs.readFileSync(filename, 'utf8');
  const lines = raw.split(/\r?\n/);
  const codeLines = nonCommentSource(raw, owner).split(/\r?\n/);
  const matches = lines.flatMap((line, i) => {
    if (!line.includes(asset) && !line.includes('/' + path.basename(asset))) return [];
    const exact = exactAssetMention(line, asset);
    const code = exact && exactAssetMention(codeLines[i] || '', asset);
    const hint = !exact ? 'substring-only'
      : !code ? 'comment-only'
        : /(?:readFileSync|existsSync|statSync|openSync|readFile|fetch\(|request\.get\()/i.test(line)
          ? 'possible-file-access'
          : /(?:expect|assert|match|toContain|toEqual|test\(|describe\()/i.test(line)
            ? 'possible-assertion' : 'literal-mention';
    return [{ line: i + 1, hint, exact, code, text: line.trim().slice(0, 240) }];
  });
  return {
    owner, matches: matches.slice(0, 6), totalMatches: matches.length,
    strictMatches: matches.filter(row => row.exact).length,
    codeMatches: matches.filter(row => row.code).length
  };
}
export function buildLegacyOwnershipMatrix(root = DEFAULT_ROOT) {
  const directory = path.resolve(root);
  const report = auditLegacy(directory);
  const rows = report.rows.map(item => {
    const buffer = fs.readFileSync(path.join(directory, item.path));
    const category = classifyOwnership(item); // historical Ver.393 substring heuristic
    const testEvidence = item.testRefs.map(owner => sourceEvidence(directory, owner, item.path));
    const runtimeEvidence = item.runtimeRefs.map(owner => sourceEvidence(directory, owner, item.path));
    const strictTestRefs = testEvidence.filter(row => row.strictMatches > 0).map(row => row.owner);
    const executableRuntimeRefs = runtimeEvidence.filter(row => row.codeMatches > 0).map(row => row.owner);
    const refinedCategory = classifyOwnership({ testRefs: strictTestRefs, runtimeRefs: executableRuntimeRefs });
    return {
      path: item.path, bytes: item.bytes, blobSha: gitBlobSha(buffer),
      category, refinedCategory,
      runtimeRefs: [...item.runtimeRefs], testRefs: [...item.testRefs],
      strictTestRefs, executableRuntimeRefs,
      commentOnlyRuntimeOwners: runtimeEvidence.filter(row => row.strictMatches > 0 &&
        row.codeMatches === 0).map(row => row.owner),
      substringOnlyTestOwners: testEvidence.filter(row => row.strictMatches === 0).map(row => row.owner),
      testEvidence, runtimeEvidence,
      documentationRefs: item.documentationRefs,
      identicalDeclaredAssets: [...item.identicalDeclaredAssets],
      pagesRootUrlPreserved: true,
      mayBeRequestedByCachedHtml: true,
      deletionAuthorized: false,
      nextAction: refinedCategory === 'test-only' ? 'inspect-test-contract-and-legacy-url'
        : refinedCategory === 'no-literal-refs' ? 'inspect-indirect-loads-and-legacy-url'
          : 'trace-non-comment-runtime-ownership-and-legacy-url'
    };
  }).sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));

  const categories = ['runtime-and-test', 'runtime-only', 'test-only', 'no-literal-refs'];
  const byCategory = Object.fromEntries(categories.map(category => [
    category, { count: rows.filter(x => x.category === category).length,
      bytes: rows.filter(x => x.category === category).reduce((sum, x) => sum + x.bytes, 0) }
  ]));
  const byRefinedCategory = Object.fromEntries(categories.map(category => [
    category, { count: rows.filter(x => x.refinedCategory === category).length,
      bytes: rows.filter(x => x.refinedCategory === category).reduce((sum, x) => sum + x.bytes, 0) }
  ]));
  return {
    summary: {
      ...report.summary,
      byCategory, byRefinedCategory,
      commentOnlyRuntimeRows: rows.filter(row => row.commentOnlyRuntimeOwners.length > 0).length,
      substringOnlyTestRows: rows.filter(row => row.substringOnlyTestOwners.length > 0).length,
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
