import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPages, LEGACY_RUNTIME_ALIASES } from './build-pages-runtime-v382.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.pages-runtime');
const EXPECTED_HISTORICAL_BLOBS = Object.freeze({
  'user-add-fix-v155.js': '4f1161f5de6a3b42f0c7b9ba67b47222395c91d3',
  'ui-v156.css': '794b18eeb0237b15e8d563fc5c9450be77c8d4da',
  'assets/summary-today.png': '54639e7b18cd77f35cf027a4b7ce0a52d7e8025a',
});

test('Ver.382 publishes all declared runtime files and historical boot-compatible images, not developer assets', () => {
  try {
    const result = buildPages(root, output);
    assert.ok(result.count > 65);
    for (const required of ['index.html','app.js','config.js','release-manifest.js',
      'assets/brand.png','assets/nav-today-v87.png','assets/nav-done.png',
      'assets/nav-today-v169.svg','assets/nav-memo-v167.svg']) {
      assert.ok(result.files.includes(required), 'required runtime or legacy cache asset: ' + required);
      assert.deepEqual(fs.readFileSync(path.join(output, required)),
        fs.readFileSync(path.join(root, required)), 'byte-for-byte retention: ' + required);
    }
    for (const excluded of ['README.md','package.json','patch-responsibilities.json',
      'firebase-rules.json','firebase.json','test-harness','tests','.github','docs','REGRESSION_TESTS.md']) {
      assert.equal(fs.existsSync(path.join(output, excluded)), false, 'private/test resource leaked: ' + excluded);
    }
    for (const [oldPath, currentPath] of Object.entries(LEGACY_RUNTIME_ALIASES)) {
      assert.equal(fs.existsSync(path.join(root, oldPath)), false,
        'legacy duplicate must be absent from the Git working tree: ' + oldPath);
      assert.ok(result.files.includes(oldPath), 'cached asset URL must remain published: ' + oldPath);
      assert.deepEqual(fs.readFileSync(path.join(output, oldPath)),
        fs.readFileSync(path.join(root, currentPath)), 'old asset URL must retain exact bytes: ' + oldPath);
    }
    for (const [legacy, expected] of Object.entries(EXPECTED_HISTORICAL_BLOBS)) {
      const current = LEGACY_RUNTIME_ALIASES[legacy];
      assert.ok(current, 'missing legacy alias mapping: ' + legacy);
      const data = fs.readFileSync(path.join(root, current));
      const sha = createHash('sha1').update('blob ' + data.length + '\0').update(data).digest('hex');
      assert.equal(sha, expected, 'legacy alias must retain the original Git blob: ' + legacy);
    }
    assert.equal(result.count, result.files.length);
    assert.ok(result.bytes > 100000);
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
  }
});

test('Ver.382 fails closed when manifest references a missing runtime asset', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-v382-'));
  try {
    fs.writeFileSync(path.join(tmp,'index.html'), '<html></html>');
    fs.writeFileSync(path.join(tmp,'release-manifest.js'),
      'requiredAssets: ["index.html","missing.js"], optionalAssets: [], dynamicScripts: [], dynamicStyles: [], mobileScripts: []');
    fs.mkdirSync(path.join(tmp,'assets'));
    assert.throws(() => buildPages(tmp,path.join(tmp,'.pages-runtime')), /Runtime asset missing: missing\.js/);
    assert.throws(() => buildPages(tmp,tmp), /isolated subdirectory/);
  } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});
