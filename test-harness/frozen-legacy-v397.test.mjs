import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FROZEN_LEGACY_RUNTIME_BLOBS, FROZEN_ICON_CSS_BLOBS_V400, FROZEN_RETIRED_CSS_BLOBS_V401, FROZEN_RETIRED_CSS_BLOBS_V402, FROZEN_RETIRED_CSS_BLOBS_V403, FROZEN_RETIRED_CSS_BLOBS_V404, FROZEN_RETIRED_CSS_BLOBS_V405, FROZEN_RETIRED_JS_BLOBS_V406, FROZEN_RETIRED_JS_BLOBS_V407, FROZEN_RETIRED_JS_BLOBS_V408, FROZEN_RETIRED_JS_BLOBS_V409, FROZEN_RETIRED_JS_BLOBS_V410, FROZEN_RETIRED_JS_BLOBS_V411, FROZEN_RETIRED_JS_BLOBS_V412, FROZEN_RETIRED_JS_BLOBS_V413 } from './build-pages-runtime-v382.mjs';

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
  assert.deepEqual(Object.keys(originals).filter(name => Object.hasOwn(FROZEN_LEGACY_RUNTIME_BLOBS, name)).sort(), [...EXPECTED]);
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

const RETIRED_CSS_V401 = Object.freeze(['ui-v147.css', 'ui-v173.css']);

test('Ver.401 retains two retired feature stylesheets with immutable Git hashes and unchanged cache URLs', () => {
  const originals = JSON.parse(fs.readFileSync(path.join(ROOT, ARCHIVE), 'utf8'));
  const manifest = fs.readFileSync(path.join(ROOT, 'release-manifest.js'), 'utf8');
  assert.deepEqual(Object.keys(FROZEN_RETIRED_CSS_BLOBS_V401).sort(), [...RETIRED_CSS_V401]);
  assert.equal(Object.keys(FROZEN_LEGACY_RUNTIME_BLOBS).length, 10);
  assert.deepEqual(Object.keys(originals).sort(), [...EXPECTED, ...RETIRED_CSS_V401, ...RETIRED_CSS_V402, ...RETIRED_CSS_V403, ...RETIRED_CSS_V404, ...RETIRED_CSS_V405, ...RETIRED_JS_V406, ...RETIRED_JS_V407, ...RETIRED_JS_V408, ...RETIRED_JS_V409, ...RETIRED_JS_V410, ...RETIRED_JS_V411, ...RETIRED_JS_V412, ...RETIRED_JS_V413].sort(),
    'Ver.397, 401, 402, 403, 404, 405, 406, 407 408, 409, 410, 411 and 412 archives must contain exactly thirty-six original URLs');
  let total = 0;
  for (const name of RETIRED_CSS_V401) {
    assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'retired CSS must not stay in Git root: ' + name);
    assert.equal(manifest.includes('"' + name + '"'), false, 'retired stylesheet must stay out of current manifest');
    assert.equal(typeof originals[name], 'string');
    const payload = Buffer.from(originals[name], 'utf8');
    const sha = createHash('sha1').update('blob ' + payload.length + '\0').update(payload).digest('hex');
    assert.equal(sha, FROZEN_RETIRED_CSS_BLOBS_V401[name], 'historical CSS must be byte-for-byte unchanged: ' + name);
    total += payload.length;
  }
  assert.equal(total, 2421, 'original two stylesheet byte count is immutable');
});

const RETIRED_CSS_V402 = Object.freeze(['ui-v144.css', 'ui-v145.css', 'ui-v146.css']);

test('Ver.402 retains three pre-Ver.189 ToDo stylesheet payloads with exact original Git SHA and cached URL', () => {
  const originals = JSON.parse(fs.readFileSync(path.join(ROOT, ARCHIVE), 'utf8'));
  const manifest = fs.readFileSync(path.join(ROOT, 'release-manifest.js'), 'utf8');
  assert.deepEqual(Object.keys(FROZEN_RETIRED_CSS_BLOBS_V402).sort(), [...RETIRED_CSS_V402]);
  assert.deepEqual(Object.keys(originals).sort(), [...EXPECTED, ...RETIRED_CSS_V401, ...RETIRED_CSS_V402, ...RETIRED_CSS_V403, ...RETIRED_CSS_V404, ...RETIRED_CSS_V405, ...RETIRED_JS_V406, ...RETIRED_JS_V407, ...RETIRED_JS_V408, ...RETIRED_JS_V409, ...RETIRED_JS_V410, ...RETIRED_JS_V411, ...RETIRED_JS_V412, ...RETIRED_JS_V413].sort());
  let total = 0;
  for (const name of RETIRED_CSS_V402) {
    assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'redundant ToDo CSS Git root copy remains: ' + name);
    assert.equal(manifest.includes('"' + name + '"'), false, 'old CSS must stay out of current manifest: ' + name);
    assert.equal(typeof originals[name], 'string');
    const bytes = Buffer.from(originals[name], 'utf8');
    const sha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    assert.equal(sha, FROZEN_RETIRED_CSS_BLOBS_V402[name], 'original Git blob changed: ' + name);
    total += bytes.length;
  }
  assert.equal(total, 21022, 'the three original ToDo stylesheet payloads must retain their byte count');
});

const RETIRED_CSS_V403 = Object.freeze(['ui-v152.css', 'ui-v153.css', 'ui-v157.css']);

test('Ver.403 freezes three workflow/mobile CSS sources with original Git blobs and old public URLs', () => {
  const originals = JSON.parse(fs.readFileSync(path.join(ROOT, ARCHIVE), 'utf8'));
  const manifest = fs.readFileSync(path.join(ROOT, 'release-manifest.js'), 'utf8');
  assert.deepEqual(Object.keys(FROZEN_RETIRED_CSS_BLOBS_V403).sort(), [...RETIRED_CSS_V403]);
  assert.deepEqual(Object.keys(originals).sort(),
    [...EXPECTED, ...RETIRED_CSS_V401, ...RETIRED_CSS_V402, ...RETIRED_CSS_V403, ...RETIRED_CSS_V404, ...RETIRED_CSS_V405, ...RETIRED_JS_V406, ...RETIRED_JS_V407, ...RETIRED_JS_V408, ...RETIRED_JS_V409, ...RETIRED_JS_V410, ...RETIRED_JS_V411, ...RETIRED_JS_V412, ...RETIRED_JS_V413].sort(),
    'exact frozen archive inventory must not grow or lose historical URLs');
  let originalBytes = 0;
  for (const name of RETIRED_CSS_V403) {
    assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'old workflow CSS must no longer be in Git root: ' + name);
    assert.equal(manifest.includes('"' + name + '"'), false, 'old workflow CSS must not load in current runtime: ' + name);
    assert.equal(typeof originals[name], 'string');
    const bytes = Buffer.from(originals[name], 'utf8');
    const sha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    assert.equal(sha, FROZEN_RETIRED_CSS_BLOBS_V403[name], 'original cached stylesheet bytes changed: ' + name);
    originalBytes += bytes.length;
  }
  assert.equal(originalBytes, 17168, 'original workflow/mobile stylesheets must preserve exact total bytes');
});

const RETIRED_CSS_V404 = Object.freeze(['ui-v158.css', 'ui-v159.css', 'ui-v160.css', 'ui-v164.css']);

test('Ver.404 freezes four original desktop sidebar CSS URL payloads', () => {
  const originals = JSON.parse(fs.readFileSync(path.join(ROOT, ARCHIVE), 'utf8'));
  const manifest = fs.readFileSync(path.join(ROOT, 'release-manifest.js'), 'utf8');
  assert.deepEqual(Object.keys(FROZEN_RETIRED_CSS_BLOBS_V404).sort(), [...RETIRED_CSS_V404]);
  assert.deepEqual(Object.keys(originals).sort(),
    [...EXPECTED, ...RETIRED_CSS_V401, ...RETIRED_CSS_V402, ...RETIRED_CSS_V403, ...RETIRED_CSS_V404, ...RETIRED_CSS_V405, ...RETIRED_JS_V406, ...RETIRED_JS_V407, ...RETIRED_JS_V408, ...RETIRED_JS_V409, ...RETIRED_JS_V410, ...RETIRED_JS_V411, ...RETIRED_JS_V412, ...RETIRED_JS_V413].sort(),
    'the exact historical cache archive inventory must be maintained');
  let total = 0;
  for (const name of RETIRED_CSS_V404) {
    assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'old sidebar CSS still in Git root: ' + name);
    assert.equal(manifest.includes('"' + name + '"'), false, 'retired sidebar stylesheet may not load in current manifest: ' + name);
    assert.equal(typeof originals[name], 'string', 'historical sidebar CSS must be archived: ' + name);
    const bytes = Buffer.from(originals[name], 'utf8');
    const sha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    assert.equal(sha, FROZEN_RETIRED_CSS_BLOBS_V404[name], 'original Git blob bytes changed: ' + name);
    total += bytes.length;
  }
  assert.equal(total, 19494, 'the four sidebar CSS original payloads must equal 19,494 bytes');
});

const RETIRED_CSS_V405 = Object.freeze(['ui-v165.css', 'ui-v167.css', 'ui-v168.css', 'ui-v176.css']);

test('Ver.405 preserves original comment, memo, and density CSS byte-identical old URLs', () => {
  const originals = JSON.parse(fs.readFileSync(path.join(ROOT, ARCHIVE), 'utf8'));
  const manifest = fs.readFileSync(path.join(ROOT, 'release-manifest.js'), 'utf8');
  assert.deepEqual(Object.keys(FROZEN_RETIRED_CSS_BLOBS_V405).sort(), [...RETIRED_CSS_V405]);
  assert.deepEqual(Object.keys(originals).sort(),
    [...EXPECTED, ...RETIRED_CSS_V401, ...RETIRED_CSS_V402, ...RETIRED_CSS_V403,
      ...RETIRED_CSS_V404, ...RETIRED_CSS_V405, ...RETIRED_JS_V406, ...RETIRED_JS_V407, ...RETIRED_JS_V408, ...RETIRED_JS_V409, ...RETIRED_JS_V410, ...RETIRED_JS_V411, ...RETIRED_JS_V412, ...RETIRED_JS_V413].sort(),
    'frozen historical CSS and JS archive must contain exactly thirty-six unchanged URL names');
  let total = 0;
  for (const name of RETIRED_CSS_V405) {
    assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'old CSS must not remain in Git root: ' + name);
    assert.equal(manifest.includes('"' + name + '"'), false, 'retired CSS must not be a manifest asset: ' + name);
    assert.equal(typeof originals[name], 'string', 'historical CSS must remain archived: ' + name);
    const bytes = Buffer.from(originals[name], 'utf8');
    const sha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    assert.equal(sha, FROZEN_RETIRED_CSS_BLOBS_V405[name], 'original historical CSS Git blob changed: ' + name);
    total += bytes.length;
  }
  assert.equal(total, 23262, 'original four comment, memo and density styles must preserve 23,262 bytes');
});

const RETIRED_JS_V406 = Object.freeze([
  'core-view-density-v188.js', 'desktop-sidebar-compat-v159.js', 'sidebar-polish-v160.js'
]);

test('Ver.406 archives retired core density and sidebar helpers with exact original Git SHA', () => {
  const originals = JSON.parse(fs.readFileSync(path.join(ROOT, ARCHIVE), 'utf8'));
  const manifest = fs.readFileSync(path.join(ROOT, 'release-manifest.js'), 'utf8');
  assert.deepEqual(Object.keys(FROZEN_RETIRED_JS_BLOBS_V406).sort(), [...RETIRED_JS_V406].sort(), 'Ver.406 original JS inventory must not be conflated with Ver.407');
  assert.deepEqual(Object.keys(originals).sort(),
    [...EXPECTED, ...RETIRED_CSS_V401, ...RETIRED_CSS_V402, ...RETIRED_CSS_V403,
      ...RETIRED_CSS_V404, ...RETIRED_CSS_V405, ...RETIRED_JS_V406, ...RETIRED_JS_V407, ...RETIRED_JS_V408, ...RETIRED_JS_V409, ...RETIRED_JS_V410, ...RETIRED_JS_V411, ...RETIRED_JS_V412, ...RETIRED_JS_V413].sort(),
    'frozen cache archive must contain exactly thirty-six historical URLs');
  let total = 0;
  for (const name of RETIRED_JS_V406) {
    assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'retired helper JS must no longer be in Git root: ' + name);
    assert.equal(manifest.includes('"' + name + '"'), false, 'retired helper must not load in current manifest: ' + name);
    assert.equal(typeof originals[name], 'string', 'original cached helper JS must be archived: ' + name);
    const bytes = Buffer.from(originals[name], 'utf8');
    const sha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    assert.equal(sha, FROZEN_RETIRED_JS_BLOBS_V406[name], 'original cached JavaScript Git blob changed: ' + name);
    total += bytes.length;
  }
  assert.equal(total, 2530, 'three original retired helper JavaScript payloads must retain 2,530 bytes');
});

const RETIRED_JS_V407 = Object.freeze(['version-display-lock.js']);

test('Ver.407 archives the old version-display sidecar at byte-identical cached URL', () => {
  const originals = JSON.parse(fs.readFileSync(path.join(ROOT, ARCHIVE), 'utf8'));
  const manifest = fs.readFileSync(path.join(ROOT, 'release-manifest.js'), 'utf8');
  assert.deepEqual(Object.keys(FROZEN_RETIRED_JS_BLOBS_V407), [...RETIRED_JS_V407]);
  assert.deepEqual(Object.keys(originals).sort(),
    [...EXPECTED, ...RETIRED_CSS_V401, ...RETIRED_CSS_V402, ...RETIRED_CSS_V403,
      ...RETIRED_CSS_V404, ...RETIRED_CSS_V405, ...RETIRED_JS_V406, ...RETIRED_JS_V407, ...RETIRED_JS_V408, ...RETIRED_JS_V409, ...RETIRED_JS_V410, ...RETIRED_JS_V411, ...RETIRED_JS_V412, ...RETIRED_JS_V413].sort(),
    'thirty-six historical URLs must remain immutable and complete');
  const name = RETIRED_JS_V407[0];
  assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'retired version sidecar must leave Git root');
  assert.equal(manifest.includes('"' + name + '"'), false, 'retired version sidecar must not load in current release');
  assert.equal(typeof originals[name], 'string', 'old sidecar JavaScript source must stay archived');
  const bytes = Buffer.from(originals[name], 'utf8');
  const sha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
  assert.equal(sha, FROZEN_RETIRED_JS_BLOBS_V407[name], 'old version sidecar original Git SHA changed');
  assert.equal(bytes.length, 1679, 'old version sidecar must preserve its 1,679 original bytes');
});

const RETIRED_JS_V408 = Object.freeze(['schedule-today-lock-v129.js']);

test('Ver.408 preserves original cached Schedule Today sidecar at immutable Git blob hash', () => {
  const originals = JSON.parse(fs.readFileSync(path.join(ROOT, ARCHIVE), 'utf8'));
  const manifest = fs.readFileSync(path.join(ROOT, 'release-manifest.js'), 'utf8');
  assert.deepEqual(Object.keys(FROZEN_RETIRED_JS_BLOBS_V408), [...RETIRED_JS_V408]);
  assert.deepEqual(Object.keys(originals).sort(),
    [...EXPECTED, ...RETIRED_CSS_V401, ...RETIRED_CSS_V402, ...RETIRED_CSS_V403,
      ...RETIRED_CSS_V404, ...RETIRED_CSS_V405, ...RETIRED_JS_V406, ...RETIRED_JS_V407,
      ...RETIRED_JS_V408, ...RETIRED_JS_V409, ...RETIRED_JS_V410, ...RETIRED_JS_V411, ...RETIRED_JS_V412, ...RETIRED_JS_V413].sort(),
    'all thirty-six original JS/CSS URLs must remain preserved');
  const name = RETIRED_JS_V408[0];
  assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'old Today sidecar must leave Git root');
  assert.equal(manifest.includes('"' + name + '"'), false, 'old Today sidecar must not load in current manifest');
  assert.equal(typeof originals[name], 'string', 'old Today sidecar must remain published from its original archive');
  const bytes = Buffer.from(originals[name], 'utf8');
  const sha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
  assert.equal(sha, FROZEN_RETIRED_JS_BLOBS_V408[name], 'original cached Today sidecar Git SHA changed');
  assert.equal(bytes.length, 3277, 'original cached Today sidecar byte count changed');
});

const RETIRED_JS_V409 = Object.freeze(['stable-fixes-v108.js']);

test('Ver.409 preserves the original retired stable Today script for cached releases', () => {
  const originals = JSON.parse(fs.readFileSync(path.join(ROOT, ARCHIVE), 'utf8'));
  const manifest = fs.readFileSync(path.join(ROOT, 'release-manifest.js'), 'utf8');
  assert.deepEqual(Object.keys(FROZEN_RETIRED_JS_BLOBS_V409), [...RETIRED_JS_V409]);
  assert.deepEqual(Object.keys(originals).sort(),
    [...EXPECTED, ...RETIRED_CSS_V401, ...RETIRED_CSS_V402, ...RETIRED_CSS_V403,
      ...RETIRED_CSS_V404, ...RETIRED_CSS_V405, ...RETIRED_JS_V406,
      ...RETIRED_JS_V407, ...RETIRED_JS_V408, ...RETIRED_JS_V409, ...RETIRED_JS_V410, ...RETIRED_JS_V411, ...RETIRED_JS_V412, ...RETIRED_JS_V413].sort(),
    'all thirty-six historical JS/CSS URLs must remain immutable');
  const name = RETIRED_JS_V409[0];
  assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'retired stable Today JS must leave Git root');
  assert.equal(manifest.includes('"' + name + '"'), false, 'retired stable Today JS must stay out of active manifest');
  assert.equal(typeof originals[name], 'string', 'original cached stable Today JS must remain archived');
  const bytes = Buffer.from(originals[name], 'utf8');
  const sha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
  assert.equal(sha, FROZEN_RETIRED_JS_BLOBS_V409[name], 'retired stable Today original Git SHA changed');
  assert.equal(bytes.length, 5088, 'stable Today original 5,088-byte body must remain unchanged');
});

const RETIRED_JS_V410 = Object.freeze(['work-features-ui-v168.js']);

test('Ver.410 freezes historical work-feature UI script at original cached URL', () => {
  const originals = JSON.parse(fs.readFileSync(path.join(ROOT, ARCHIVE), 'utf8'));
  const manifest = fs.readFileSync(path.join(ROOT, 'release-manifest.js'), 'utf8');
  assert.deepEqual(Object.keys(FROZEN_RETIRED_JS_BLOBS_V410), [...RETIRED_JS_V410]);
  assert.deepEqual(Object.keys(originals).sort(),
    [...EXPECTED, ...RETIRED_CSS_V401, ...RETIRED_CSS_V402, ...RETIRED_CSS_V403,
      ...RETIRED_CSS_V404, ...RETIRED_CSS_V405, ...RETIRED_JS_V406,
      ...RETIRED_JS_V407, ...RETIRED_JS_V408, ...RETIRED_JS_V409, ...RETIRED_JS_V410, ...RETIRED_JS_V411, ...RETIRED_JS_V412, ...RETIRED_JS_V413].sort(),
    'all thirty-six cached original JS/CSS URLs must remain immutable');
  const name = RETIRED_JS_V410[0];
  assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'retired work UI helper must leave Git root');
  assert.equal(manifest.includes('"' + name + '"'), false, 'old work UI helper must not load with current release');
  assert.equal(typeof originals[name], 'string', 'old work UI helper must be retained in original archive');
  const bytes = Buffer.from(originals[name], 'utf8');
  const sha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
  assert.equal(sha, FROZEN_RETIRED_JS_BLOBS_V410[name], 'work UI original Git SHA changed');
  assert.equal(bytes.length, 4709, 'original work UI 4,709 bytes must remain unchanged');
});

const RETIRED_JS_V411 = Object.freeze(['workspace-density-v176.js']);

test('Ver.411 preserves historical workspace density JavaScript bytes and cached URL', () => {
  const originals = JSON.parse(fs.readFileSync(path.join(ROOT, ARCHIVE), 'utf8'));
  const manifest = fs.readFileSync(path.join(ROOT, 'release-manifest.js'), 'utf8');
  assert.deepEqual(Object.keys(FROZEN_RETIRED_JS_BLOBS_V411), [...RETIRED_JS_V411]);
  assert.deepEqual(Object.keys(originals).sort(),
    [...EXPECTED, ...RETIRED_CSS_V401, ...RETIRED_CSS_V402, ...RETIRED_CSS_V403,
      ...RETIRED_CSS_V404, ...RETIRED_CSS_V405, ...RETIRED_JS_V406, ...RETIRED_JS_V407,
      ...RETIRED_JS_V408, ...RETIRED_JS_V409, ...RETIRED_JS_V410, ...RETIRED_JS_V411, ...RETIRED_JS_V412, ...RETIRED_JS_V413].sort(),
    'all thirty-six historical JS/CSS cache URLs must remain immutable');
  const name = RETIRED_JS_V411[0];
  assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'historical density helper must leave Git root');
  assert.equal(manifest.includes('"' + name + '"'), false, 'historical density helper must stay out of active manifest');
  assert.equal(typeof originals[name], 'string', 'historical density helper source must stay archived');
  const bytes = Buffer.from(originals[name], 'utf8');
  const sha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
  assert.equal(sha, FROZEN_RETIRED_JS_BLOBS_V411[name], 'original cached density source Git SHA changed');
  assert.equal(bytes.length, 6561, 'original cached density JavaScript must preserve 6,561 bytes');
});

const RETIRED_JS_V412 = Object.freeze(['task-ux-v146.js']);

test('Ver.412 preserves old quick task UX sidecar bytes, hash and cache URL', () => {
  const originals = JSON.parse(fs.readFileSync(path.join(ROOT, ARCHIVE), 'utf8'));
  const manifest = fs.readFileSync(path.join(ROOT, 'release-manifest.js'), 'utf8');
  assert.deepEqual(Object.keys(FROZEN_RETIRED_JS_BLOBS_V412), [...RETIRED_JS_V412, ...RETIRED_JS_V413]);
  assert.deepEqual(Object.keys(originals).sort(),
    [...EXPECTED, ...RETIRED_CSS_V401, ...RETIRED_CSS_V402, ...RETIRED_CSS_V403,
      ...RETIRED_CSS_V404, ...RETIRED_CSS_V405, ...RETIRED_JS_V406,
      ...RETIRED_JS_V407, ...RETIRED_JS_V408, ...RETIRED_JS_V409, ...RETIRED_JS_V410,
      ...RETIRED_JS_V411, ...RETIRED_JS_V412, ...RETIRED_JS_V413].sort(),
    'all thirty-six historical original URLs must remain immutable');
  const name = RETIRED_JS_V412[0];
  assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'historical quick task UX should leave Git root');
  assert.equal(manifest.includes('"' + name + '"'), false, 'retired task UX must not load with current manifest');
  assert.equal(typeof originals[name], 'string', 'old cached task UX JavaScript must remain archived');
  const bytes = Buffer.from(originals[name], 'utf8');
  const sha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
  assert.equal(sha, FROZEN_RETIRED_JS_BLOBS_V412[name], 'original retired quick task UX Git SHA changed');
  assert.equal(bytes.length, 6306, 'old quick task UX sidecar must preserve 6,306 bytes');
});

const RETIRED_JS_V413 = Object.freeze(['user-ux-polish-v208.js']);

test('Ver.413 preserves cached user UX polish JavaScript at its original URL and SHA', () => {
  const originals = JSON.parse(fs.readFileSync(path.join(ROOT, ARCHIVE), 'utf8'));
  const manifest = fs.readFileSync(path.join(ROOT, 'release-manifest.js'), 'utf8');
  assert.deepEqual(Object.keys(FROZEN_RETIRED_JS_BLOBS_V413), [...RETIRED_JS_V413]);
  assert.deepEqual(Object.keys(originals).sort(),
    [...EXPECTED, ...RETIRED_CSS_V401, ...RETIRED_CSS_V402, ...RETIRED_CSS_V403,
      ...RETIRED_CSS_V404, ...RETIRED_CSS_V405, ...RETIRED_JS_V406, ...RETIRED_JS_V407,
      ...RETIRED_JS_V408, ...RETIRED_JS_V409, ...RETIRED_JS_V410, ...RETIRED_JS_V411,
      ...RETIRED_JS_V412, ...RETIRED_JS_V413].sort(),
    'exactly thirty-six historical cached URLs must remain complete');
  const name = RETIRED_JS_V413[0];
  assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'retired user polish helper must leave Git root');
  assert.equal(manifest.includes('"' + name + '"'), false, 'retired user polish helper must not load in current release');
  assert.equal(typeof originals[name], 'string', 'cached original user polish JavaScript must remain archived');
  const bytes = Buffer.from(originals[name], 'utf8');
  const sha = createHash('sha1').update('blob ' + bytes.length + '\\0').update(bytes).digest('hex');
  assert.equal(sha, FROZEN_RETIRED_JS_BLOBS_V413[name], 'cached user polish original Git blob changed');
  assert.equal(bytes.length, 7458, 'historical user polish JavaScript must retain 7,458 original bytes');
});
