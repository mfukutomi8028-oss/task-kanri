import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('Ver.504 temporary read-only comment reply Protocol reference inventory', () => {
  const targets = ['comment-reply-boundary-v251.test.mjs', 'comment-reply-offline-v252.test.mjs'];
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const ignored = new Set(['test-harness/ver504-reply-reference-diagnostic.test.mjs', ...targets.map(name => 'test-harness/' + name)]);
  const refs = Object.fromEntries(targets.map(name => [name, []]));
  const errors = [];
  let scannedTextCount = 0;
  for (const path of files) {
    if (ignored.has(path)) continue;
    try {
      const content = readFileSync(path);
      if (content.includes(0)) continue;
      scannedTextCount++;
      const text = content.toString('utf8');
      for (const name of targets) {
        if (text.includes(name)) refs[name].push(path);
      }
    } catch (error) {
      errors.push({ path, error: String(error) });
    }
  }
  console.log('VER504_TRACKED_REFERENCE_AUDIT', JSON.stringify({
    trackedCount: files.length, scannedTextCount, refs, errors
  }));
  assert.deepEqual(errors, [], 'tracked text files must be readable');
});
