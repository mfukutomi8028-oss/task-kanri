import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPages, LEGACY_CSS_ALIASES } from './build-pages-runtime-v382.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.pages-runtime');

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
    for (const [oldPath, currentPath] of Object.entries(LEGACY_CSS_ALIASES)) {
      assert.equal(fs.existsSync(path.join(root, oldPath)), false,
        'legacy duplicate must be absent from the Git working tree: ' + oldPath);
      assert.ok(result.files.includes(oldPath), 'cached CSS URL must remain published: ' + oldPath);
      assert.deepEqual(fs.readFileSync(path.join(output, oldPath)),
        fs.readFileSync(path.join(root, currentPath)), 'old CSS URL must retain exact bytes: ' + oldPath);
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
