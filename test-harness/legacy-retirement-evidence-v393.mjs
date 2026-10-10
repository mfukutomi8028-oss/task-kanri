// Ver.393: conservative, read-only evidence for undeclared root JS/CSS.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { inventory } from './asset-retirement-inventory-v379.mjs';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS_CSS = new Set(['.js', '.css']);

function blobSha(file) {
  const content = fs.readFileSync(file);
  return createHash('sha1').update('blob ' + content.length + '\0').update(content).digest('hex');
}

export function auditLegacy(root = DEFAULT_ROOT) {
  const fullRoot = path.resolve(root);
  const source = inventory(fullRoot);
  // Root JS/CSS are copied to Pages regardless of manifest membership.
  // Neither "not declared" nor "not literally referenced" permits deletion.
  const rootAssets = source.rows.filter(row =>
    JS_CSS.has(row.ext) && !row.path.includes('/'));
  const currentAssets = rootAssets.filter(row => row.declared);
  const currentBySha = new Map();
  for (const item of currentAssets) {
    const sha = blobSha(path.join(fullRoot, item.path));
    const paths = currentBySha.get(sha) || [];
    paths.push(item.path);
    currentBySha.set(sha, paths);
  }

  const rows = rootAssets.filter(row => !row.declared).map(row => {
    const identicalDeclaredAssets = currentBySha.get(blobSha(path.join(fullRoot, row.path))) || [];
    const runtimeRefs = [...row.runtimeRefs].sort();
    const testRefs = [...row.testRefs].sort();
    return {
      path: row.path,
      bytes: row.bytes,
      runtimeRefs,
      testRefs,
      documentationRefs: row.documentationRefs,
      identicalDeclaredAssets,
      publishedByRootCopy: true,
      oldCacheMayRequest: true,
      deletionAuthorized: false,
      reviewClass: identicalDeclaredAssets.length
        ? 'exact-copy-alias-review'
        : runtimeRefs.length || testRefs.length
          ? 'referenced-or-test-owned'
          : 'unproven-unused'
    };
  }).sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));

  return {
    summary: {
      rootAssets: rootAssets.length,
      declaredRootAssets: currentAssets.length,
      undeclaredRootAssets: rows.length,
      undeclaredBytes: rows.reduce((n, row) => n + row.bytes, 0),
      withRuntimeMentions: rows.filter(row => row.runtimeRefs.length).length,
      withTestMentions: rows.filter(row => row.testRefs.length).length,
      withoutLiteralRuntimeOrTestMentions: rows.filter(row =>
        !row.runtimeRefs.length && !row.testRefs.length).length,
      exactCopyAliasReview: rows.filter(row => row.identicalDeclaredAssets.length).length,
      declaredMissing: source.summary.declaredMissing
    },
    rows
  };
}

export function markdown(report) {
  const { summary, rows } = report;
  return [
    '# Legacy JS/CSS retention evidence (read-only; no deletion authorized)',
    '',
    'Manifest-undeclared root JS/CSS: ' + summary.undeclaredRootAssets +
      ' / ' + summary.undeclaredBytes + ' bytes.',
    'Runtime textual mentions: ' + summary.withRuntimeMentions +
      '; test textual mentions: ' + summary.withTestMentions +
      '; neither: ' + summary.withoutLiteralRuntimeOrTestMentions + '.',
    'Exact-byte copies of manifest-declared assets: ' + summary.exactCopyAliasReview + '.',
    '',
    'Every listed root JS/CSS is currently copied to GitHub Pages even if undeclared.',
    'A cached HTML or manifest may still request its old URL. No references found',
    'is not proof of safety, and an exact-byte match is only a *review candidate*',
    'until an immutable legacy URL, tests, and rollback have been addressed.',
    'This tool does not write, rename, delete, or authorize the removal of files.',
    '',
    '| Legacy file | Bytes | Runtime refs | Test refs | Same-byte declared asset | Review status |',
    '| --- | ---: | ---: | ---: | --- | --- |',
    ...rows.map(row => '| ' + row.path + ' | ' + row.bytes +
      ' | ' + row.runtimeRefs.length + ' | ' + row.testRefs.length +
      ' | ' + (row.identicalDeclaredAssets.join(', ') || '-') +
      ' | ' + row.reviewClass + ' |'),
    ''
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditLegacy();
  process.stdout.write(process.argv.includes('--json')
    ? JSON.stringify(result, null, 2) + '\n'
    : markdown(result));
}
