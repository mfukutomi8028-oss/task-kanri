import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FROZEN_LEGACY_RUNTIME_BLOBS, FROZEN_ICON_CSS_BLOBS_V400 } from './build-pages-runtime-v382.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVE = 'compat/frozen-legacy-runtime-v397.json';
const EXPECTED = Object.freeze([
  "archive-duplicate-v152.js",
  "brand-v184.js",
  "dependencies-v148.js",
  "inbox-v152.js",
  "relationships-v150.js",
  "reminders-v150.js",
  "ui-v162.css",
  "ui-v163.css",
  "workflow-core-v148.js",
  "workflow-core-v149.js"
]);

test('Ver.397 archives exactly ten historical JS/CSS URLs while preserving original Git blob hashes', () => {
  const originals = JSON.parse(fs.readFileSync(path.join(ROOT, ARCHIVE), 'utf8'));
  const manifest = fs.readFileSync(path.join(ROOT, 'release-manifest.js'), 'utf8');
  assert.deepEqual(Object.keys(originals).sort(), [...EXPECTED]);
  assert.deepEqual(Object.keys(FROZEN_LEGACY_RUNTIME_BLOBS).sort(), [...EXPECTED]);
  let total = 0;
  for (const legacy of EXPECTED) {
    assert.equal(fs.existsSync(path.join(ROOT, legacy)), false, 'retired root path still present: ' + legacy);
    assert.equal(manifest.includes('"' + legacy + '"'), false, 'historical runtime unexpectedly in manifest: ' + legacy);
    assert.equal(typeof originals[legacy], 'string');
    const data = Buffer.from(originals[legacy], 'utf8');
    const sha = createHash('sha1').update('blob ' + data.length + '\0').update(data).digest('hex');
    assert.equal(sha, FROZEN_LEGACY_RUNTIME_BLOBS[legacy], 'original Git blob changed: ' + legacy);
    total += data.length;
  }
  assert.equal(total, 62756, 'original ten JS/CSS payloads must remain byte-identical');
});

const ICON_CSS_V400_NAMES = ['ui-v169.css', 'ui-v170.css', 'ui-v171.css'];

test('Ver.400 retains original bytes and historical URLs for three icon-era stylesheets', () => {
  const archive = JSON.parse(fs.readFileSync(path.join(ROOT, 'compat/frozen-icon-css-v400.json'), 'utf8'));
  const manifest = fs.readFileSync(path.join(ROOT, 'release-manifest.js'), 'utf8');
  assert.deepEqual(Object.keys(archive).sort(), [...ICON_CSS_V400_NAMES]);
  assert.deepEqual(Object.keys(FROZEN_ICON_CSS_BLOBS_V400).sort(), [...ICON_CSS_V400_NAMES]);
  let total = 0;
  for (const name of ICON_CSS_V400_NAMES) {
    assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'old CSS must not remain tracked: ' + name);
    assert.equal(manifest.includes('"' + name + '"'), false, 'retired CSS must not be declared: ' + name);
    const bytes = Buffer.from(archive[name], 'utf8');
    const sha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    assert.equal(sha, FROZEN_ICON_CSS_BLOBS_V400[name]);
    total += bytes.length;
  }
  assert.equal(total, 11734, 'original icon CSS total bytes must not change');
});
