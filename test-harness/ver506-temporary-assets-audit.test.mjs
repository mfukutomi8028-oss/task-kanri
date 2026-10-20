import test from 'node:test';
import assert from 'node:assert/strict';
import { inventory } from './asset-retirement-inventory-v379.mjs';

test('Ver.506 read-only asset and legacy owner inventory for consolidation decision', () => {
  const report = inventory();
  const images = report.rows.filter(item => item.path.startsWith('assets/'));
  console.log('VER506_ASSET_EVIDENCE', JSON.stringify({
    summary: report.summary,
    images: images.map(row => ({
      path: row.path, bytes: row.bytes, classification: row.classification,
      declared: row.declared, legacyAliasUrls: row.legacyAliasUrls,
      runtimeRefs: row.runtimeRefs, testRefs: row.testRefs,
      documentationRefs: row.documentationRefs
    }))
  }));
  assert.deepEqual(report.summary.declaredMissing, [], 'every declared asset must be available');
});
