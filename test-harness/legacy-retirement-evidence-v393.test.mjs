import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { auditLegacy, markdown } from './legacy-retirement-evidence-v393.mjs';

function withFixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-evidence-v393-'));
  const put = (name, value) => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value);
  };
  try {
    put('release-manifest.js',
      'window.RELEASE = {requiredAssets:["index.html","release-manifest.js","app.js","current.js","current.css"],optionalAssets:[],dynamicStyles:[],dynamicScripts:[],mobileScripts:[]};');
    put('index.html', '<script src="current.js"></script>');
    put('app.js', 'const old = "runtime-old.js";');
    put('current.js', 'const stable = 123;');
    put('current.css', '.current {display:block}');
    put('duplicate.js', 'const stable = 123;');
    put('runtime-old.js', 'window.oldRuntime = true;');
    put('historical.css', '.history {display:block}');
    put('unused.js', 'window.example = 1;');
    put('test-harness/test-owner.mjs', "read('historical.css');");
    // Generated staging must never affect retention evidence.
    put('.pages-runtime/generated.md', 'unused.js');
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('Ver.393 distinguishes current, runtime-referenced, test-owned and exact-copy legacy assets', () => {
  withFixture(root => {
    const before = fs.readFileSync(path.join(root, 'duplicate.js'));
    const report = auditLegacy(root);
    const paths = new Map(report.rows.map(row => [row.path, row]));
    assert.equal(report.summary.declaredRootAssets, 2);
    assert.equal(report.summary.undeclaredRootAssets, 4);
    assert.deepEqual(paths.get('duplicate.js').identicalDeclaredAssets, ['current.js']);
    assert.deepEqual(paths.get('runtime-old.js').runtimeRefs, ['app.js']);
    assert.deepEqual(paths.get('historical.css').testRefs, ['test-harness/test-owner.mjs']);
    assert.equal(paths.get('unused.js').reviewClass, 'unproven-unused');
    assert.equal(paths.get('unused.js').documentationRefs, 0);
    assert.equal(report.summary.exactCopyAliasReview, 1);
    assert.equal(report.summary.withRuntimeMentions, 1);
    assert.equal(report.summary.withTestMentions, 1);
    for (const row of report.rows) {
      assert.equal(row.publishedByRootCopy, true);
      assert.equal(row.oldCacheMayRequest, true);
      assert.equal(row.deletionAuthorized, false);
    }
    assert.deepEqual(fs.readFileSync(path.join(root, 'duplicate.js')), before);
    assert.match(markdown(report), /does not write, rename, delete/);
    assert.equal(fs.existsSync(path.join(root, 'report.json')), false);
  });
});

test('Ver.393 production evidence never interprets missing textual references as permission to delete', () => {
  const report = auditLegacy();
  assert.ok(report.summary.rootAssets > 50, 'root asset inventory unexpectedly empty');
  assert.ok(report.summary.undeclaredRootAssets > 0, 'expected legacy assets to audit');
  assert.deepEqual(report.summary.declaredMissing, []);
  assert.ok(report.rows.every(row => !row.deletionAuthorized && row.oldCacheMayRequest));
  console.log('VER393_LEGACY_AUDIT_SUMMARY', JSON.stringify(report.summary));
});
