import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = 'docs/HISTORICAL_RUNTIME_INVENTORIES_V429.md';
const SOURCE = '92b309e75ef58d29c0ed4a6578060df3133147b7';
const ORIGINALS = Object.freeze({
  'FINAL_RUNTIME_INVENTORY_AUDIT_V325.md': '88cb27f9c6d23736e7c9779bfae4b86e574b2cb8',
  'FINAL_RUNTIME_INVENTORY_AUDIT_V345.md': '138e3a858d5bc9e0773b1ab8b9932bed1041e443',
  'FINAL_RUNTIME_WAKEUP_INVENTORY_AUDIT_V355.md': '662fb34be2f6fce68bc5c39925e11636a0ecd26e'
});
const CURRENT = Object.freeze([
  'README.md', 'REGRESSION_TESTS.md', 'PATCH_RESPONSIBILITY_MAP.md',
  'DEVELOPMENT_PLAN_V371.md', 'release-notes.md', 'release-manifest.js',
  'index.html', 'package.json'
]);

test('Ver.429 preserves fixed Git recovery references for exactly three former inventory files', () => {
  const index = fs.readFileSync(path.join(ROOT, INDEX), 'utf8');
  assert.equal(Object.keys(ORIGINALS).length, 3);
  assert.ok(index.includes('13,467'));
  for (const [name, sha] of Object.entries(ORIGINALS)) {
    assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'old root report still present: ' + name);
    assert.ok(index.includes(sha), 'missing original Git blob SHA: ' + name);
    assert.ok(index.includes('https://github.com/mfukutomi8028-oss/task-kanri/blob/' + SOURCE + '/' + name),
      'missing fixed recovery URL: ' + name);
  }
});

test('Ver.429 does not leave stale inventory references in active docs and entrypoints', () => {
  for (const target of CURRENT) {
    const content = fs.readFileSync(path.join(ROOT, target), 'utf8');
    for (const name of Object.keys(ORIGINALS)) {
      assert.equal(content.includes(name), false, target + ' still references retired ' + name);
    }
  }
});

test('Ver.429 clearly states history preservation and the external-link risk', () => {
  const index = fs.readFileSync(path.join(ROOT, INDEX), 'utf8');
  assert.ok(index.includes('Issue #292'));
  assert.ok(index.includes('GitHub Pages'));
  assert.ok(index.includes('blob/main/'));
  assert.ok(index.includes('checkpoint'));
  assert.ok(index.includes('Release304'));
});
