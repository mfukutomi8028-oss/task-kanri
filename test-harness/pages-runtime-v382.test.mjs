import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { LEGACY_BOOT_IMAGE_URLS_V433, EXTRA_LEGACY_PNG_URLS_V433, PINNED_LEGACY_PNG_BLOBS_V433 } from './legacy-png-contract-v433.mjs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPages, LEGACY_RUNTIME_ALIASES, FROZEN_MOBILE_SCRIPT_BLOBS, FROZEN_LEGACY_RUNTIME_BLOBS, FROZEN_ICON_CSS_BLOBS_V400, FROZEN_RETIRED_CSS_BLOBS_V401, FROZEN_RETIRED_CSS_BLOBS_V402, FROZEN_RETIRED_CSS_BLOBS_V403, FROZEN_RETIRED_CSS_BLOBS_V404, FROZEN_RETIRED_CSS_BLOBS_V405, FROZEN_RETIRED_JS_BLOBS_V406, FROZEN_RETIRED_JS_BLOBS_V407, FROZEN_RETIRED_JS_BLOBS_V408, FROZEN_RETIRED_JS_BLOBS_V409, FROZEN_RETIRED_JS_BLOBS_V410, FROZEN_RETIRED_JS_BLOBS_V411, FROZEN_RETIRED_JS_BLOBS_V412, FROZEN_RETIRED_JS_BLOBS_V413, FROZEN_RETIRED_JS_BLOBS_V414, FROZEN_RETIRED_JS_BLOBS_V415, FROZEN_RETIRED_JS_BLOBS_V416, FROZEN_RETIRED_JS_BLOBS_V417, FROZEN_RETIRED_JS_BLOBS_V418, FROZEN_RETIRED_JS_BLOBS_V419, FROZEN_RETIRED_JS_BLOBS_V420, FROZEN_RETIRED_JS_BLOBS_V421, FROZEN_RETIRED_JS_BLOBS_V422, FROZEN_RETIRED_JS_BLOBS_V423 } from './build-pages-runtime-v382.mjs';

import { fingerprintPagesDirectory } from './pages-payload-fingerprint-v506.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.pages-runtime');
const EXPECTED_HISTORICAL_BLOBS = Object.freeze({
  'user-add-fix-v155.js': '4f1161f5de6a3b42f0c7b9ba67b47222395c91d3',
  'ui-v156.css': '794b18eeb0237b15e8d563fc5c9450be77c8d4da',
  'assets/summary-today.png': '54639e7b18cd77f35cf027a4b7ce0a52d7e8025a',
  'assets/brand-v184.png': '2c271253286f4d422d4e64b2801eb7d64956f9fe',
});

test('Ver.382 publishes all declared runtime files and historical boot-compatible images, not developer assets', () => {
  try {
    const result = buildPages(root, output);
    assert.ok(result.count > 65);
    // Ver.433: cached pre-Release304 image URLs must survive a Pages build,
    // regardless of whether their bytes came from retained files or a future archive.
    const oldManifest = fs.readFileSync(path.join(root, 'release-manifest.js'), 'utf8');
    for (const legacy of LEGACY_BOOT_IMAGE_URLS_V433) {
      assert.ok(oldManifest.includes("'" + legacy + "'"),
        'bootstrap compatibility key missing: ' + legacy);
    }
    for (const legacy of [...LEGACY_BOOT_IMAGE_URLS_V433, ...EXTRA_LEGACY_PNG_URLS_V433]) {
      assert.ok(result.files.includes(legacy), 'cached image URL missing from package: ' + legacy);
      assert.ok(fs.existsSync(path.join(output, legacy)), 'cached image not emitted: ' + legacy);
    }
    for (const [legacy, originalSha] of Object.entries(PINNED_LEGACY_PNG_BLOBS_V433)) {
      const bytes = fs.readFileSync(path.join(output, legacy));
      const hash = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
      assert.equal(hash, originalSha, 'legacy PNG changed published bytes: ' + legacy);
    }

    for (const required of ['index.html','app.js','config.js','release-manifest.js',
      'assets/brand.png','assets/nav-today-v87.png','assets/nav-done.png',
      'assets/nav-today-v169.svg','assets/nav-memo-v167.svg']) {
      assert.ok(result.files.includes(required), 'required runtime or legacy cache asset: ' + required);
      assert.deepEqual(fs.readFileSync(path.join(output, required)),
        fs.readFileSync(path.join(root, required)), 'byte-for-byte retention: ' + required);
    }
    for (const excluded of ['README.md','package.json','patch-responsibilities.json',
      'config.example.js', 'firebase-rules.json','firebase.json','test-harness','tests','.github','docs','compat','REGRESSION_TESTS.md']) {
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
    const frozenMobile = JSON.parse(fs.readFileSync(path.join(root, 'compat/frozen-mobile-scripts-v395.json'), 'utf8'));
    for (const legacy of Object.keys(FROZEN_MOBILE_SCRIPT_BLOBS)) {
      assert.ok(result.files.includes(legacy), 'frozen old URL missing from Pages package: ' + legacy);
      assert.deepEqual(fs.readFileSync(path.join(output, legacy)), Buffer.from(frozenMobile[legacy], 'utf8'),
        'frozen legacy mobile URL must preserve historical bytes: ' + legacy);
    }
    const frozenLegacy = JSON.parse(fs.readFileSync(path.join(root, 'compat/frozen-legacy-runtime-v397.json'), 'utf8'));
    for (const legacy of Object.keys({ ...FROZEN_LEGACY_RUNTIME_BLOBS, ...FROZEN_RETIRED_CSS_BLOBS_V401, ...FROZEN_RETIRED_CSS_BLOBS_V402, ...FROZEN_RETIRED_CSS_BLOBS_V403, ...FROZEN_RETIRED_CSS_BLOBS_V404, ...FROZEN_RETIRED_CSS_BLOBS_V405, ...FROZEN_RETIRED_JS_BLOBS_V406, ...FROZEN_RETIRED_JS_BLOBS_V407, ...FROZEN_RETIRED_JS_BLOBS_V408, ...FROZEN_RETIRED_JS_BLOBS_V409, ...FROZEN_RETIRED_JS_BLOBS_V410, ...FROZEN_RETIRED_JS_BLOBS_V411, ...FROZEN_RETIRED_JS_BLOBS_V412, ...FROZEN_RETIRED_JS_BLOBS_V413, ...FROZEN_RETIRED_JS_BLOBS_V414, ...FROZEN_RETIRED_JS_BLOBS_V415, ...FROZEN_RETIRED_JS_BLOBS_V416, ...FROZEN_RETIRED_JS_BLOBS_V417, ...FROZEN_RETIRED_JS_BLOBS_V418, ...FROZEN_RETIRED_JS_BLOBS_V419, ...FROZEN_RETIRED_JS_BLOBS_V420, ...FROZEN_RETIRED_JS_BLOBS_V421, ...FROZEN_RETIRED_JS_BLOBS_V422, ...FROZEN_RETIRED_JS_BLOBS_V423 })) {
      assert.ok(result.files.includes(legacy), 'historical URL not staged: ' + legacy);
      assert.deepEqual(fs.readFileSync(path.join(output, legacy)), Buffer.from(frozenLegacy[legacy], 'utf8'),
        'historical byte-for-byte Pages compatibility: ' + legacy);
    }
    const frozenIcons = JSON.parse(fs.readFileSync(path.join(root, 'compat/frozen-icon-css-v400.json'), 'utf8'));
    for (const legacy of Object.keys(FROZEN_ICON_CSS_BLOBS_V400)) {
      assert.ok(result.files.includes(legacy), 'cached icon CSS URL missing from output: ' + legacy);
      assert.deepEqual(fs.readFileSync(path.join(output, legacy)), Buffer.from(frozenIcons[legacy], 'utf8'),
        'old icon CSS URL byte equality: ' + legacy);
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


test('Ver.450 source-only config example stays in Git but is not staged for public Pages', () => {
  const sample = path.join(root, 'config.example.js');
  assert.ok(fs.existsSync(sample), 'retain setup example in source repository');
  const manifest = fs.readFileSync(path.join(root, 'release-manifest.js'), 'utf8');
  assert.doesNotMatch(manifest, /"config\.example\.js"/, 'developer example must not be declared active');
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'index.html'), 'utf8'),
    /config\.example\.js/, 'bootstrap must not depend on example');
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'config.js'), 'utf8'),
    /config\.example\.js/, 'runtime loader must not depend on example');
});

test('Ver.450 Pages build rejects unclassified new root JavaScript instead of silently publishing it', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-allowlist-v450-'));
  const stage = path.join(tmp, '.pages-runtime');
  try {
    fs.mkdirSync(path.join(tmp, 'assets'));
    fs.writeFileSync(path.join(tmp, 'index.html'), '<!doctype html><title>fixture</title>');
    fs.writeFileSync(path.join(tmp, 'release-manifest.js'),
      'requiredAssets: ["index.html","release-manifest.js","app.js"], optionalAssets: [], dynamicScripts: [], dynamicStyles: [], mobileScripts: []');
    fs.writeFileSync(path.join(tmp, 'app.js'), "'use strict';");
    fs.writeFileSync(path.join(tmp, 'config.example.js'), 'window.firebaseConfig = {};');
    fs.writeFileSync(path.join(tmp, 'untracked-runtime-v450.js'), "console.log('unexpected');");
    assert.throws(() => buildPages(tmp, stage), /Unclassified root runtime asset: untracked-runtime-v450\.js/);
    assert.equal(fs.existsSync(stage), false, 'unclassified source must fail before touching the stage');
    fs.rmSync(path.join(tmp, 'untracked-runtime-v450.js'));
    const result = buildPages(tmp, stage);
    assert.deepEqual(result.files, ['app.js', 'index.html', 'release-manifest.js']);
    assert.equal(fs.existsSync(path.join(stage, 'config.example.js')), false);
    assert.ok(fs.existsSync(path.join(tmp, 'config.example.js')), 'source example remains untouched');
    fs.writeFileSync(path.join(tmp, 'release-manifest.js'),
      'requiredAssets: ["index.html","release-manifest.js","app.js","config.example.js"], optionalAssets: [], dynamicScripts: [], dynamicStyles: [], mobileScripts: []');
    assert.throws(() => buildPages(tmp, stage), /Developer-only asset declared active: config\.example\.js/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});


test('Ver.506 Pages payload fingerprint is stable for identical bytes despite changed timestamps and write order', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-fingerprint-v506-'));
  try {
    const put = (relative, content) => {
      const target = path.join(tmp, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    };
    put('index.html', 'ABCD');
    put('assets/icon.svg', 'WXYZ');
    const initial = fingerprintPagesDirectory(tmp);
    assert.equal(initial.files, 2);
    assert.equal(initial.bytes, 8);
    assert.match(initial.sha256, /^[a-f0-9]{64}$/);
    fs.utimesSync(path.join(tmp, 'index.html'), new Date('2020-01-01T00:00:00Z'),
      new Date('2020-01-01T00:00:00Z'));
    fs.unlinkSync(path.join(tmp, 'assets/icon.svg'));
    put('assets/icon.svg', 'WXYZ');
    assert.deepEqual(fingerprintPagesDirectory(tmp), initial, 'mtime and write order must not change digest');

    put('index.html', 'ABCE');
    const changedContent = fingerprintPagesDirectory(tmp);
    assert.equal(changedContent.files, initial.files);
    assert.equal(changedContent.bytes, initial.bytes);
    assert.notEqual(changedContent.sha256, initial.sha256, 'same-sized content corruption must be visible');

    put('index.html', 'ABCD');
    fs.renameSync(path.join(tmp, 'assets/icon.svg'), path.join(tmp, 'assets/mark.svg'));
    const changedPath = fingerprintPagesDirectory(tmp);
    assert.equal(changedPath.files, initial.files);
    assert.equal(changedPath.bytes, initial.bytes);
    assert.notEqual(changedPath.sha256, initial.sha256, 'same-sized renamed URLs must be visible');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('Ver.506 Pages payload fingerprint refuses missing, empty and symlink-containing packages', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-fingerprint-guard-v506-'));
  try {
    assert.throws(() => fingerprintPagesDirectory(path.join(tmp, 'missing')), /ENOENT/);
    assert.throws(() => fingerprintPagesDirectory(tmp), /no files/);
    fs.writeFileSync(path.join(tmp, 'index.html'), 'ok');
    const initial = fingerprintPagesDirectory(tmp);
    try {
      fs.symlinkSync(path.join(tmp, 'index.html'), path.join(tmp, 'alias.html'));
    } catch (error) {
      if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error?.code)) throw error;
      return; // Windows without symlink privilege cannot run this part.
    }
    assert.throws(() => fingerprintPagesDirectory(tmp), /symlink/);
    assert.equal(initial.files, 1);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('Ver.506 fingerprint records exactly the staged Pages fixture without altering its public payload', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-fingerprint-builder-v506-'));
  const stage = path.join(tmp, '.pages-runtime');
  try {
    fs.mkdirSync(path.join(tmp, 'assets'));
    fs.writeFileSync(path.join(tmp, 'index.html'), '<img src="assets/icon.svg"><script src="app.js"></script>');
    fs.writeFileSync(path.join(tmp, 'app.js'), "'use strict';");
    fs.writeFileSync(path.join(tmp, 'assets/icon.svg'), '<svg></svg>');
    fs.writeFileSync(path.join(tmp, 'release-manifest.js'),
      'window.WORK_BOARD_RELEASE = { requiredAssets: ["index.html","release-manifest.js","app.js","assets/icon.svg"], optionalAssets: [], dynamicStyles: [], dynamicScripts: [], mobileScripts: [] };');
    const firstBuild = buildPages(tmp, stage);
    const first = fingerprintPagesDirectory(stage);
    assert.equal(first.files, firstBuild.count);
    assert.equal(first.bytes, firstBuild.bytes);
    const outputBefore = fs.readFileSync(path.join(stage, 'index.html'));
    assert.deepEqual(fs.readFileSync(path.join(stage, 'index.html')), outputBefore);
    const secondBuild = buildPages(tmp, stage);
    assert.deepEqual(fingerprintPagesDirectory(stage), first, 'fresh independent staging must be byte-stable');
    assert.equal(secondBuild.count, first.files);
    assert.equal(secondBuild.bytes, first.bytes);
    assert.deepEqual(fs.readFileSync(path.join(stage, 'index.html')), outputBefore);
    const pagesWorkflow = fs.readFileSync(path.join(root, '.github/workflows/pages.yml'), 'utf8');
    assert.match(pagesWorkflow,
      /run: node test-harness\/pages-payload-fingerprint-v506\.mjs \.pages-runtime/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

