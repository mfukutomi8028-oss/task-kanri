import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = 'docs/HISTORICAL_FAVORITE_OBSERVER_AUDITS_V428.md';
const SOURCE = '92b309e75ef58d29c0ed4a6578060df3133147b7';
const FILES = Object.freeze({
  'FAVORITE_OBSERVER_SEMANTIC_AUDIT_V366.md': 'f444b4a0467036700d69edf3c3b0699786cfd4db',
  'FAVORITE_OBSERVER_BROWSER_AUDIT_V367.md': 'a00a5c6d9a385719118e475f3ac46f2ec9e82905',
  'FAVORITE_OBSERVER_TARGET_AUDIT_V370.md': '919e0134b190889c2e6a2ac1ca89f96acde9c56c'
});
const ACTIVE = Object.freeze([
  'README.md', 'REGRESSION_TESTS.md', 'PATCH_RESPONSIBILITY_MAP.md',
  'DEVELOPMENT_PLAN_V371.md', 'release-notes.md',
  'release-manifest.js', 'index.html', 'package.json'
]);

test('Ver.428 retires only the selected three root audits with stable recovery sources', () => {
  const doc = fs.readFileSync(path.join(ROOT, INDEX), 'utf8');
  assert.equal(Object.keys(FILES).length, 3);
  assert.ok(doc.includes('5,789'));
  for (const [name, blob] of Object.entries(FILES)) {
    assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'old audit still in Git root: ' + name);
    assert.ok(doc.includes(blob), 'original Git blob SHA missing: ' + name);
    const url = 'https://github.com/mfukutomi8028-oss/task-kanri/blob/' + SOURCE + '/' + name;
    assert.ok(doc.includes(url), 'fixed Git recovery link missing: ' + name);
  }
});

test('Ver.428 does not leave retired-document literals in active entrypoints', () => {
  for (const name of ACTIVE) {
    const source = fs.readFileSync(path.join(ROOT, name), 'utf8');
    for (const removed of Object.keys(FILES)) {
      assert.equal(source.includes(removed), false, name + ' still references ' + removed);
    }
  }
});

test('Ver.428 retains external URL risk and independent acceptance requirements', () => {
  const doc = fs.readFileSync(path.join(ROOT, INDEX), 'utf8');
  assert.ok(doc.includes('Issue #292'));
  assert.ok(doc.includes('GitHub Pages'));
  assert.ok(doc.includes('expected-head'));
  assert.ok(doc.includes('checkpoint'));
  assert.ok(doc.includes('blob/main/'));
});
