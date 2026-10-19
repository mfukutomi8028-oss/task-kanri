import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('Ver.502 temporary read-only tracked-text reference inventory', () => {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0').filter(Boolean);
  const oldName = 'personal-reminder-polling-v362.test.mjs';
  const nextName = 'personal-reminder-one-shot-v363.test.mjs';
  const excluded = new Set([
    'test-harness/ver502-reference-diagnostic.test.mjs',
    'test-harness/' + oldName,
    'test-harness/' + nextName
  ]);
  const oldReferences = [];
  const newReferences = [];
  const errors = [];
  let scanned = 0;
  for (const path of files) {
    if (excluded.has(path)) continue;
    try {
      const contents = readFileSync(path);
      if (contents.includes(0)) continue;
      const text = contents.toString('utf8');
      scanned += 1;
      if (text.includes(oldName)) oldReferences.push(path);
      if (text.includes(nextName)) newReferences.push(path);
    } catch (error) {
      errors.push({ path, error: String(error) });
    }
  }
  console.log('VER502_TRACKED_REFERENCE_AUDIT', JSON.stringify({
    trackedCount: files.length, scannedTextCount: scanned,
    oldReferences, newReferences, errors
  }));
  assert.deepEqual(errors, [], 'tracked file reads must succeed');
  assert.deepEqual(oldReferences, [], 'old Protocol must have zero direct external references before retirement');
});
