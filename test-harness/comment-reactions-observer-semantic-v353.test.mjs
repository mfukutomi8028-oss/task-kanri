import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const reactions = read('comment-reactions-v191.js');
const manifest = read('release-manifest.js');
const responsibilities = JSON.parse(read('patch-responsibilities.json'));

test('Ver.354 product keeps #detailBody subtree observer but filters scheduling semantically', () => {
  assert.match(reactions, /const COMMENT_SURFACE_SELECTOR_V354 = "\.task-comments-panel-v149, \.activity-comments-panel, #commentForm, \.comment-form, \.activity-comment"/);
  assert.match(reactions, /const COMMENT_OWNED_SELECTOR_V354 = "\.comment-thread-v215, \.comment-reactions-v165, \.comment-thread-actions-v215, \.comment-reply-compose-v215, \.comment-reply-context-v215"/);
  assert.match(reactions, /function mutationTouchesCommentSurfaceV354\(mutation\)/);
  assert.match(reactions, /mutations\.some\(mutationTouchesCommentSurfaceV354\)\) schedulePatch\(\)/);
  assert.match(reactions, /\.observe\(root, \{ childList: true, subtree: true \}\)/);
  assert.doesNotMatch(reactions, /mutations\.some\(item => item\.addedNodes\.length \|\| item\.removedNodes\.length\)\) schedulePatch\(\)/);
});

test('Ver.354 product ignores sidecar-owned roots while accepting canonical comment surfaces', () => {
  assert.match(reactions, /if \(node\.matches\(COMMENT_OWNED_SELECTOR_V354\)\) return false/);
  assert.match(reactions, /node\.matches\(COMMENT_SURFACE_SELECTOR_V354\) \|\| Boolean\(node\.querySelector\(COMMENT_SURFACE_SELECTOR_V354\)\)/);
});

test('Ver.354 preserves click, submit, keydown and explicit local reply reconciliation boundaries', () => {
  assert.match(reactions, /root\.addEventListener\('submit'/);
  assert.match(reactions, /root\.addEventListener\("click"/);
  assert.match(reactions, /root\.addEventListener\('keydown'/);
  assert.match(reactions, /document\.addEventListener\('workboard:local-reply-saved-v250'/);
  assert.match(reactions, /setPickerOutsideClick\(opening\)/);
  assert.match(reactions, /document\.addEventListener\("click", handlePickerOutsideClick, true\)/);
});

test('Ver.354 release-292 product history remains durable in later synchronized releases', () => {
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1];
  assert.ok(Number(release) >= 292);
  assert.equal(String(responsibilities.baselineRelease), release);
  const comments = responsibilities.groups.find(group => group.id === 'user-and-comments');
  assert.ok(comments);
  assert.match(comments.reason, /Ver\.353監査/);
  assert.match(comments.reason, /Ver\.354製品/);
  assert.match(comments.reason, /release 292/);
});

test('Ver.354 advances cleanup planning to a fresh runtime wakeup inventory', () => {
  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.match(next.goal, /Ver\.355/);
  assert.match(next.goal, /runtime wakeup/i);
  assert.match(next.precondition, /release manifest \/ baselineReleaseが292/);
});
