import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { inventory, markdown } from './asset-retirement-inventory-v379.mjs';

function withFixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-audit-v379-'));
  const put = (name, text) => {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  };
  try {
    put('release-manifest.js', 'window.RELEASE = {requiredAssets:["release-manifest.js","index.html","app.js","current.js","assets/current.svg"],optionalAssets:[],dynamicStyles:["deferred.css"],dynamicScripts:["deferred.js"],mobileScripts:["mobile-lazy.js"]};');
    put('index.html', '<img src="assets/boot-legacy.png"><script src="current.js"></script>');
    put('app.js', "const run = () => 'assets/runtime-only.svg';");
    put('current.js', "'use strict';");
    put('deferred.js', "'use strict';");
    put('deferred.css', 'body { color: inherit; }');
    put('mobile-lazy.js', "'use strict';");
    put('unused.js', 'console.log("not referenced");');
    put('historical.css', '.legacy { display:block; }');
    put('assets/boot-legacy.png', 'fake-image');
    put('assets/current.svg', '<svg></svg>');
    put('assets/runtime-only.svg', '<svg></svg>');
    put('assets/unreferenced.png', 'fake-image');
    put('assets/nav-today-v87.png', 'historical-icon-original');
    put('assets/brand.png', 'historical-brand-original');
    put('test-harness/owner.test.mjs', "const css = read('historical.css');");
    put('docs/history.md', 'The old assets/unreferenced.png was used years ago.');
    put('.pages-runtime/generated.md', 'unused.js');
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
test('Ver.379 inventory distinguishes declarations, runtime references, test contracts and review-only candidates', () => {
  withFixture(root => {
    const report = inventory(root);
    const byPath = new Map(report.rows.map(row => [row.path, row]));
    assert.equal(byPath.get('current.js').classification, 'declared-active');
    for (const deferred of ['deferred.js', 'deferred.css', 'mobile-lazy.js']) {
      assert.equal(byPath.get(deferred)?.classification, 'declared-active', deferred + ' must not be a deletion candidate');
      assert.equal(byPath.get(deferred)?.declared, true);
    }
    assert.equal(byPath.get('assets/current.svg').classification, 'declared-active');
    assert.equal(byPath.get('assets/boot-legacy.png').classification, 'runtime-reference');
    assert.equal(byPath.get('assets/runtime-only.svg').classification, 'runtime-reference');
    assert.equal(byPath.get('historical.css').classification, 'test-contract-or-reference');
    assert.equal(byPath.get('unused.js').classification, 'candidate-manual-review');
    assert.equal(byPath.get('unused.js').documentationRefs, 0, 'generated Pages docs are excluded');
    assert.equal(byPath.get('assets/unreferenced.png').classification, 'candidate-manual-review');
    for (const [physical, url] of [
      ['assets/nav-today-v87.png', 'assets/summary-today.png'],
      ['assets/brand.png', 'assets/brand-v184.png']
    ]) {
      assert.equal(byPath.get(physical)?.declared, false, physical + ' is not declared');
      assert.equal(byPath.get(physical)?.runtimeRefs.length, 0, physical + ' has no runtime owner');
      assert.equal(byPath.get(physical)?.classification, 'published-alias-target',
        physical + ' is used for a cached Pages URL');
      assert.deepEqual(byPath.get(physical)?.legacyAliasUrls, [url]);
    }
    assert.equal(report.summary.byClass['published-alias-target'], 2);
    assert.ok(byPath.get('assets/unreferenced.png').documentationRefs > 0);
    assert.equal(report.summary.byClass['candidate-manual-review'], 2);
    assert.deepEqual(report.summary.declaredMissing, []);
  });
});

test('Ver.379 audit produces a deterministic read-only report with explicit manual review caveat', () => {
  withFixture(root => {
    const before = fs.readFileSync(path.join(root, 'unused.js'), 'utf8');
    const output = markdown(inventory(root));
    assert.match(output, /does not delete or modify/);
    assert.match(output, /candidate-manual-review/);
    assert.match(output, /published-alias-target/);
    assert.match(output, /Legacy alias URLs/);
    assert.match(output, /assets\/boot-legacy\.png/);
    assert.equal(fs.readFileSync(path.join(root, 'unused.js'), 'utf8'), before);
    assert.equal(fs.readdirSync(root).includes('report.json'), false);
  });
});

test('Ver.379 product inventory recognizes old memo image as a runtime source dependency', () => {
  const report = inventory();
  const byPath = new Map(report.rows.map(row => [row.path, row]));
  assert.equal(byPath.get('app.js')?.classification, 'declared-active');
  assert.equal(byPath.get('assets/nav-memo-v167.svg')?.classification, 'runtime-reference');
  assert.ok(byPath.get('assets/nav-memo-v167.svg')?.runtimeRefs.includes('work-features-v167.js'));
  assert.ok(byPath.get('assets/nav-today-v87.png')?.legacyAliasUrls.includes('assets/summary-today.png'));
  assert.notEqual(byPath.get('assets/nav-today-v87.png')?.classification, 'candidate-manual-review');
  assert.deepEqual(report.summary.declaredMissing, []);
  // Ver.482: all tracked root JS/CSS are declared runtime assets or the source-only example.
  const rootFiles = fs.readdirSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'))
    .filter(file => /\.(?:js|css)$/.test(file)).sort();
  assert.deepEqual(rootFiles.filter(file => !byPath.get(file)?.declared), ['config.example.js']);
  assert.equal(byPath.get('config.example.js')?.classification, 'source-only-developer-config');
  assert.equal(report.summary.byClass['source-only-developer-config'], 1);
  assert.equal(report.rows.filter(row => /\.(?:js|css)$/.test(row.path)).length, rootFiles.length);
  assert.ok(rootFiles.length >= 60, 'root JS/CSS unexpectedly reduced');
  assert.equal(report.rows.filter(row => /\.(?:js|css)$/.test(row.path)
    && row.classification === 'candidate-manual-review').length, 0,
    'unclassified root JS/CSS requires review before any deletion');
});
