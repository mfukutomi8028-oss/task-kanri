import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function candidateSource() {
  const source = read('comment-reactions-v191.js');
  return source.replace(
    /document\.addEventListener\(\s*["']click["']\s*,/,
    'root.addEventListener("click",'
  );
}

test('Ver.350 audit isolates the remaining comment-reactions document click candidate', () => {
  const source = read('comment-reactions-v191.js');
  assert.match(source, /function\s+bindGlobalEvents\s*\(root\)/);
  assert.match(source, /document\.addEventListener\(\s*["']click["']\s*,/);
  assert.match(source, /root\.addEventListener\(\s*['"]submit['"]/);
  assert.match(source, /root\.addEventListener\(\s*['"]keydown['"]/);
  assert.match(source, /const\s+root\s*=\s*document\.getElementById\(["']detailBody["']\)/);
});

test('Ver.350 direct-root candidate moves only click capture delegation', () => {
  const source = read('comment-reactions-v191.js');
  const candidate = candidateSource();
  assert.notEqual(candidate, source);
  assert.match(candidate, /root\.addEventListener\(\s*["']click["']\s*,/);
  assert.doesNotMatch(candidate, /document\.addEventListener\(\s*["']click["']\s*,/);
  assert.match(candidate, /root\.addEventListener\(\s*['"]submit['"]/);
  assert.match(candidate, /root\.addEventListener\(\s*['"]keydown['"]/);
  assert.match(candidate, /event\.target\.closest\(['"]\[data-comment-reply-target\]['"]\)/);
  assert.match(candidate, /event\.target\.closest\(["']\[data-comment-reaction-picker\]["']\)/);
  assert.match(candidate, /event\.target\.closest\(["']\[data-comment-reaction-id\]\[data-comment-reaction-emoji\]["']\)/);
  assert.match(candidate, /if\s*\(!event\.target\.closest\(["']\.comment-reactions-v165["']\)\)\s*closePickers\(\)/);
});

test('Ver.350 audit records outside-detail dismissal as the productization gate', () => {
  const source = candidateSource();
  assert.match(source, /function\s+closePickers\s*\(/);
  assert.match(source, /if\s*\(!event\.target\.closest\(["']\.comment-reactions-v165["']\)\)\s*closePickers\(\)/);
  assert.doesNotMatch(source, /document\.addEventListener\(\s*["']click["']\s*,/);
  assert.match(source, /root\.addEventListener\(\s*["']click["']\s*,/);
});

test('Ver.350 audit keeps release 290 and responsibility candidate unchanged', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1];
  assert.equal(release, '290');
  assert.equal(String(responsibilities.baselineRelease), '290');
  const candidate = responsibilities.priorityCandidates?.[0];
  assert.deepEqual(candidate?.scope, ['comment-reactions-v191.js']);
  assert.match(String(candidate?.goal || ''), /Ver\.350/);
  assert.match(String(candidate?.goal || ''), /click scope監査/);
});
