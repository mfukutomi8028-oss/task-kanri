import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditLegacy } from './legacy-retirement-evidence-v393.mjs';
import { buildLegacyOwnershipMatrix, classifyOwnership, exactAssetMention } from './legacy-ownership-v399.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Ver.399 separates runtime/test filename owners without authorizing deletion', () => {
  const stub = (runtimeRefs, testRefs) => ({ runtimeRefs, testRefs });
  assert.equal(classifyOwnership(stub(['app.js'], ['test-harness/a.mjs'])), 'runtime-and-test');
  assert.equal(classifyOwnership(stub(['app.js'], [])), 'runtime-only');
  assert.equal(classifyOwnership(stub([], ['test-harness/a.mjs'])), 'test-only');
  assert.equal(classifyOwnership(stub([], [])), 'no-literal-refs');
  // Synthetic names must not change the real audit's reference inventory.
  assert.equal(exactAssetMention("read('sample-owned.js')", 'sample-owned.js'), true);
  assert.equal(exactAssetMention("read('test-sample-owned.js')", 'sample-owned.js'), false);
  assert.equal(exactAssetMention("url('../sample-style.css?v=304')", 'sample-style.css'), true);
  assert.equal(exactAssetMention("/* migrated from sample-style.css. */", 'sample-style.css'), true);
  assert.equal(exactAssetMention("sample-style.css.map", 'sample-style.css'), false);
});

test('Ver.399 retains all baseline legacy files and gathers reproducible reference evidence', () => {
  const baseline = auditLegacy(ROOT);
  const matrix = buildLegacyOwnershipMatrix(ROOT);
  const categories = Object.values(matrix.summary.byCategory);
  const count = categories.reduce((sum, row) => sum + row.count, 0);
  const bytes = categories.reduce((sum, row) => sum + row.bytes, 0);
  assert.equal(count, baseline.summary.undeclaredRootAssets);
  assert.equal(bytes, baseline.summary.undeclaredBytes);
  const refined = Object.values(matrix.summary.byRefinedCategory);
  assert.equal(refined.reduce((sum, row) => sum + row.count, 0), count);
  assert.equal(refined.reduce((sum, row) => sum + row.bytes, 0), bytes);
  assert.deepEqual(matrix.summary.declaredMissing, []);
  assert.deepEqual(new Set(matrix.rows.map(r => r.path)).size, count);
  assert.ok(matrix.rows.every(row => row.pagesRootUrlPreserved &&
    row.mayBeRequestedByCachedHtml && !row.deletionAuthorized));
  for (const row of matrix.rows) {
    const item = baseline.rows.find(source => source.path === row.path);
    assert.ok(item);
    assert.equal(row.bytes, item.bytes);
    assert.equal(fs.statSync(path.join(ROOT, row.path)).size, row.bytes);
    assert.deepEqual(row.runtimeRefs, item.runtimeRefs);
    assert.deepEqual(row.testRefs, item.testRefs);
    assert.ok(row.testEvidence.every(entry => entry.totalMatches > 0));
    assert.ok(row.runtimeEvidence.every(entry => entry.totalMatches > 0));
    assert.equal(row.refinedCategory, classifyOwnership({
      runtimeRefs: row.executableRuntimeRefs, testRefs: row.strictTestRefs
    }));
    assert.ok(row.substringOnlyTestOwners.every(owner => row.testRefs.includes(owner)));
    assert.ok(row.commentOnlyRuntimeOwners.every(owner => row.runtimeRefs.includes(owner)));
    assert.ok(/^[0-9a-f]{40}$/.test(row.blobSha));
  }
  console.log('VER399_OWNERSHIP_SUMMARY', JSON.stringify(matrix.summary));
  for (const row of matrix.rows) {
    console.log('VER399_OWNERSHIP_ROW', JSON.stringify({
      path: row.path, bytes: row.bytes, category: row.category,
      refinedCategory: row.refinedCategory, blobSha: row.blobSha,
      strictTestRefs: row.strictTestRefs,
      executableRuntimeRefs: row.executableRuntimeRefs,
      commentOnlyRuntimeOwners: row.commentOnlyRuntimeOwners,
      substringOnlyTestOwners: row.substringOnlyTestOwners,
      runtimeRefs: row.runtimeRefs, testRefs: row.testRefs,
      runtimeEvidence: row.runtimeEvidence,
      testEvidence: row.testEvidence,
      identicalDeclaredAssets: row.identicalDeclaredAssets,
      nextAction: row.nextAction
    }));
  }
});
