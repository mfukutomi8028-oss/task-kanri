import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = 'docs/HISTORICAL_ROOT_AUDITS_V427.md';
const SOURCE_SHA = 'dda377253979b6975d5148bad1028beab0d38394';
const PREVIOUS = Object.freeze({
  'BRAND_BFCACHE_RECOVERY_AUDIT_V288.md': 'ce01999e7c07d6f914a15901eefe49dc283f1847',
  'BRAND_DATASET_IDEMPOTENCY_AUDIT_V286.md': 'c03f52471fcad7534b8e2cc31fcc0e938fbec13d',
  'MOBILE_SHELL_BOARD_OBSERVER_SEMANTIC_AUDIT_V301.md': 'c7d53cee9b8038146b11d58b6dd28c9d7bf20dad',
  'COMMENT_MENTION_ESCAPE_AUDIT_V326.md': 'cd9faafce1ad028c65f717d081852340b81310b9',
  'FAVORITE_OBSERVER_REFINED_AUDIT_V368.md': 'cf6520a5c23036694d4a31b8647227ab26e16fab'
});
const CURRENT = Object.freeze([
  'README.md', 'REGRESSION_TESTS.md', 'PATCH_RESPONSIBILITY_MAP.md',
  'DEVELOPMENT_PLAN_V371.md', 'release-notes.md',
  'release-manifest.js', 'index.html', 'package.json'
]);

test('Ver.427 retires exactly five old root notes while preserving fixed recovery links', () => {
  const archive = fs.readFileSync(path.join(ROOT, INDEX), 'utf8');
  assert.equal(Object.keys(PREVIOUS).length, 5);
  assert.ok(archive.includes(SOURCE_SHA));
  for (const [old, blob] of Object.entries(PREVIOUS)) {
    assert.equal(fs.existsSync(path.join(ROOT, old)), false,
      'historical root document was restored: ' + old);
    const fixed = 'https://github.com/mfukutomi8028-oss/task-kanri/blob/' + SOURCE_SHA + '/' + old;
    assert.ok(archive.includes(fixed), 'immutable recovery URL missing: ' + old);
    assert.ok(archive.includes(blob), 'source Git blob SHA missing: ' + old);
  }
});

test('Ver.427 does not break literal references in current README, runtime entrypoints, or runbooks', () => {
  for (const active of CURRENT) {
    const source = fs.readFileSync(path.join(ROOT, active), 'utf8');
    for (const old of Object.keys(PREVIOUS)) {
      assert.equal(source.includes(old), false, 'current file still names retired document: ' + active + ' -> ' + old);
    }
  }
});

test('Ver.427 index explicitly describes external-link risk and keeps the cleanup independent of runtime', () => {
  const archive = fs.readFileSync(path.join(ROOT, INDEX), 'utf8');
  assert.ok(archive.includes('Issue #292'));
  assert.ok(archive.includes('14,168'));
  assert.ok(archive.includes('blob/main/'));
  assert.ok(archive.includes('GitHub Pages'));
  assert.ok(archive.includes('checkpoint'));
});
