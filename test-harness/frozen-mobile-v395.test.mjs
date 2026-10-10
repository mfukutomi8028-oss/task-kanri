import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FROZEN_MOBILE_SCRIPT_BLOBS } from './build-pages-runtime-v382.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVE = 'compat/frozen-mobile-scripts-v395.json';
const EXPECTED = [
  'mobile-board-scroll-fix.js',
  'mobile-interaction-filter-v104.js',
  'mobile-native-scroll-version-v106.js',
  'mobile-native-tabs-today-filter-v105.js',
  'mobile-safe-final-v107.js',
  'mobile-scroll-unlock-v103.js'
].sort();

test('Ver.395 freezes six formerly published mobile scripts without changing any historical bytes', () => {
  const archived = JSON.parse(fs.readFileSync(path.join(ROOT, ARCHIVE), 'utf8'));
  assert.deepEqual(Object.keys(archived).sort(), EXPECTED);
  assert.deepEqual(Object.keys(FROZEN_MOBILE_SCRIPT_BLOBS).sort(), EXPECTED);
  const manifest = fs.readFileSync(path.join(ROOT, 'release-manifest.js'), 'utf8');
  let total = 0;
  for (const old of EXPECTED) {
    assert.equal(fs.existsSync(path.join(ROOT, old)), false, 'retired mobile asset must not be tracked: ' + old);
    assert.equal(manifest.includes('"' + old + '"'), false, 'frozen legacy asset must remain absent from release declaration');
    assert.equal(typeof archived[old], 'string', 'frozen content must be UTF-8 text');
    const bytes = Buffer.from(archived[old], 'utf8');
    const sha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    assert.equal(sha, FROZEN_MOBILE_SCRIPT_BLOBS[old], 'Git blob SHA must match published historical source: ' + old);
    total += bytes.length;
  }
  assert.equal(total, 34593, 'historical mobile payload must preserve its source byte count');
});
