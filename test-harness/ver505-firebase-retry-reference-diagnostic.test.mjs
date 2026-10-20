import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('Ver.505 temporary read-only Firebase retry Protocol reference inventory', () => {
  const targets = [
    'firebase-module-retry-v255.test.mjs',
    'firebase-singleflight-v256.test.mjs',
    'firebase-init-retry-v257.test.mjs',
    'firebase-transaction-retry-v258.test.mjs'
  ];
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const ignored = new Set(['test-harness/ver505-firebase-retry-reference-diagnostic.test.mjs', ...targets.map(name => 'test-harness/' + name)]);
  const refs = Object.fromEntries(targets.map(name => [name, []]));
  const errors = [];
  let scannedTextCount = 0;
  for (const path of files) {
    if (ignored.has(path)) continue;
    try {
      const data = readFileSync(path);
      if (data.includes(0)) continue;
      scannedTextCount++;
      const body = data.toString('utf8');
      for (const name of targets) if (body.includes(name)) refs[name].push(path);
    } catch (error) {
      errors.push({ path, error: String(error) });
    }
  }
  console.log('VER505_TRACKED_REFERENCE_AUDIT', JSON.stringify({
    trackedCount: files.length, scannedTextCount, refs, errors
  }));
  assert.deepEqual(errors, [], 'tracked text files must be readable');
});
