import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('Ver.503 temporary read-only pending Protocol reference inventory', () => {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const targets = [
    'pending-multitab-v261.test.mjs',
    'pending-enqueue-v262.test.mjs',
    'pending-cross-tab-v263.test.mjs'
  ];
  const excluded = new Set(['test-harness/ver503-pending-reference-diagnostic.test.mjs', ...targets.map(name => 'test-harness/' + name)]);
  const references = Object.fromEntries(targets.map(name => [name, []]));
  const errors = [];
  let scannedTextCount = 0;
  for (const path of files) {
    if (excluded.has(path)) continue;
    try {
      const blob = readFileSync(path);
      if (blob.includes(0)) continue;
      scannedTextCount++;
      const content = blob.toString('utf8');
      for (const name of targets) if (content.includes(name)) references[name].push(path);
    } catch (error) {
      errors.push({ path, message: String(error) });
    }
  }
  console.log('VER503_TRACKED_REFERENCE_AUDIT', JSON.stringify({
    trackedCount: files.length, scannedTextCount, references, errors
  }));
  assert.deepEqual(errors, [], 'every tracked file should be readable');
});
