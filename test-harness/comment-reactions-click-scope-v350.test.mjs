import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.350 rejected direct-root click scoping remains recorded after lifecycle productization', () => {
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const group = responsibilities.groups.find(item => item.id === 'user-and-comments');
  const reason = String(group?.reason || '');
  assert.match(reason, /Ver\.350監査/);
  assert.match(reason, /単純root化を棄却/);
  assert.match(reason, /詳細外click/);
  assert.match(reason, /reaction picker/);
});

test('Ver.351 successor evidence records lifecycle split that resolves the Ver.350 productization gate', () => {
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const group = responsibilities.groups.find(item => item.id === 'user-and-comments');
  const reason = String(group?.reason || '');
  assert.match(reason, /Ver\.351監査/);
  assert.match(reason, /固定#detailBody capture delegation/);
  assert.match(reason, /picker open中/);
  assert.match(reason, /閉鎖中document owner 0本/);
  assert.match(reason, /open中1本/);
  assert.match(reason, /close後0本/);
});

test('Ver.352 product keeps the accepted lifecycle instead of reviving the rejected always-on document click', () => {
  const source = read('comment-reactions-v191.js');
  assert.match(source, /root\.addEventListener\(\s*["']click["']\s*,\s*event\s*=>/);
  assert.doesNotMatch(source, /document\.addEventListener\(\s*["']click["']\s*,\s*event\s*=>/);
  assert.match(source, /document\.addEventListener\(\s*["']click["']\s*,\s*handlePickerOutsideClick\s*,\s*true\s*\)/);
  assert.match(source, /document\.removeEventListener\(\s*["']click["']\s*,\s*handlePickerOutsideClick\s*,\s*true\s*\)/);
  assert.match(source, /root\.addEventListener\(\s*['"]submit['"]/);
  assert.match(source, /root\.addEventListener\(\s*['"]keydown['"]/);
});

test('Ver.350 evidence remains durable while current release and cleanup priority advance', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);
  assert.ok(release >= 290);
  assert.equal(Number(responsibilities.baselineRelease), release);

  const candidate = responsibilities.priorityCandidates?.[0];
  assert.deepEqual(candidate?.scope, ['comment-reactions-v191.js']);
  assert.match(String(candidate?.goal || ''), /Ver\.353/);
  assert.match(String(candidate?.goal || ''), /MutationObserver semantic filter監査/);
});
