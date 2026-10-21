import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.352 product keeps comment click operations on fixed detail root and outside dismissal lifecycle-bound', () => {
  const source = read('comment-reactions-v191.js');
  assert.match(source, /function\s+bindGlobalEvents\s*\(root\)/);
  assert.match(source, /root\.addEventListener\(\s*["']click["']\s*,\s*event\s*=>/);
  assert.doesNotMatch(source, /document\.addEventListener\(\s*["']click["']\s*,\s*event\s*=>/);
  assert.match(source, /let\s+pickerOutsideClickBound\s*=\s*false/);
  assert.match(source, /function\s+handlePickerOutsideClick\s*\(event\)/);
  assert.match(source, /function\s+setPickerOutsideClick\s*\(active\)/);
  assert.match(source, /document\.addEventListener\(\s*["']click["']\s*,\s*handlePickerOutsideClick\s*,\s*true\s*\)/);
  assert.match(source, /document\.removeEventListener\(\s*["']click["']\s*,\s*handlePickerOutsideClick\s*,\s*true\s*\)/);
  assert.match(source, /if\s*\(next\s*===\s*pickerOutsideClickBound\)\s*return/);
  assert.match(source, /setPickerOutsideClick\(opening\)/);
  assert.match(source, /setPickerOutsideClick\(Boolean\(document\.querySelector\(["']\.comment-reaction-picker-v165:not\(\[hidden\]\)["']\)\)\)/);
});

test('Ver.352 product preserves reply/reaction semantics and existing detail submit/keydown ownership', () => {
  const source = read('comment-reactions-v191.js');
  assert.match(source, /event\.target\.closest\(['"]\[data-comment-reply-target\]['"]\)/);
  assert.match(source, /event\.target\.closest\(["']\[data-comment-reaction-picker\]["']\)/);
  assert.match(source, /event\.target\.closest\(["']\[data-comment-reaction-id\]\[data-comment-reaction-emoji\]["']\)/);
  assert.match(source, /if\s*\(!event\.target\.closest\(["']\.comment-reactions-v165["']\)\)\s*closePickers\(\)/);
  assert.match(source, /root\.addEventListener\(\s*['"]submit['"]/);
  assert.match(source, /root\.addEventListener\(\s*['"]keydown['"]/);
  assert.match(source, /if\s*\(event\.key\s*===\s*['"]Escape['"]\)/);
  assert.match(source, /\.observe\(root,\s*\{\s*childList:\s*true,\s*subtree:\s*true\s*\}\)/);
});

test('Ver.352 release-291 product history remains durable in later aligned releases', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);
  assert.ok(release >= 291);
  assert.equal(Number(responsibilities.baselineRelease), release);

  const group = responsibilities.groups.find(item => item.id === 'user-and-comments');
  const reason = String(group?.reason || '');
  assert.match(reason, /Ver\.352製品/);
  assert.match(reason, /常設document capture clickを撤去/);
  assert.match(reason, /release 291へ更新/);
});

test('Ver.352 handoff to the observer audit remains recorded after later observer productization', () => {
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const group = responsibilities.groups.find(item => item.id === 'user-and-comments');
  const reason = String(group?.reason || '');
  assert.match(reason, /Ver\.353監査/);
  assert.match(reason, /#detailBody subtree childList observer/);
  assert.match(reason, /semantic candidate/);
  assert.match(reason, /Ver\.354製品/);

  const source = read('comment-reactions-v191.js');
  assert.match(source, /new\s+MutationObserver\(mutations\s*=>/);
  assert.match(source, /mutationTouchesCommentSurfaceV354/);
  assert.doesNotMatch(source, /mutations\.some\(item\s*=>\s*item\.addedNodes\.length\s*\|\|\s*item\.removedNodes\.length\)/);
});

// Ver.492: original Ver.347 tests (15 assertions), unchanged.
test('Ver.347 product scopes comment-reactions keydown to fixed detail root', () => {
  const source = read('comment-reactions-v191.js');
  assert.match(source, /function\s+bindGlobalEvents\s*\(root\)/);
  assert.match(source, /root\.addEventListener\(['"]keydown['"],\s*event\s*=>/);
  assert.doesNotMatch(source, /document\.addEventListener\(['"]keydown['"],\s*event\s*=>/);
  assert.match(source, /bindGlobalEvents\(root\)/);
  assert.match(source, /event\.key\s*===\s*['"]Escape['"]/);
  assert.match(source, /\(event\.ctrlKey\s*\|\|\s*event\.metaKey\)\s*&&\s*event\.key\s*===\s*['"]Enter['"]/);
});

test('Ver.347 product keeps click and detail observer ownership after later submit-scope cleanup', () => {
  const source = read('comment-reactions-v191.js');
  assert.match(source, /document\.addEventListener\(["']click["']/);
  assert.match(source, /const\s+root\s*=\s*document\.getElementById\(["']detailBody["']\)/);
  assert.match(source, /\.observe\(root,\s*\{\s*childList:\s*true,\s*subtree:\s*true\s*\}\)/);
  assert.match(source, /bindGlobalEvents\(root\)/);
});

test('Ver.347 release history remains durable in later aligned releases', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1];
  assert.ok(Number(release) >= 289);
  assert.equal(String(responsibilities.baselineRelease), release);
  const owner = responsibilities.groups?.find(group => group.id === 'user-and-comments');
  assert.ok(owner, 'user-and-comments responsibility must remain mapped');
  assert.match(String(owner.reason || ''), /Ver\.347製品/);
  assert.match(String(owner.reason || ''), /release 289/);
});

test('Ver.492 retired Ver.347 suite stays absent', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'test-harness/comment-reactions-keydown-scope-v346.test.mjs')), false);
});

// Ver.493: original Ver.349 tests (24 assertions), unchanged.
test('Ver.349 submit delegation remains scoped to fixed detail root after later click lifecycle cleanup', () => {
  const source = read('comment-reactions-v191.js');
  assert.match(source, /root\.addEventListener\(\s*['"]submit['"]\s*,/);
  assert.doesNotMatch(source, /document\.addEventListener\(\s*['"]submit['"]\s*,/);
  assert.match(source, /root\.addEventListener\(['"]keydown['"]/);
  assert.match(source, /const\s+root\s*=\s*document\.getElementById\(["']detailBody["']\)/);
  assert.match(source, /bindGlobalEvents\(root\)/);
});

test('Ver.349 reply submit capture semantics and canonical handoff remain intact', () => {
  const source = read('comment-reactions-v191.js');
  const start = source.indexOf("root.addEventListener('submit'");
  const end = source.indexOf('root.addEventListener("click"', start);
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  assert.match(block, /event\.target\.closest\?\.\('#detailBody \.comment-form, #detailBody #commentForm'\)/);
  assert.match(block, /if\s*\(!form\s*\|\|\s*!replyTarget\)\s*return/);
  assert.match(block, /handleReplySubmit\(form,\s*event\)/);
  assert.match(block, /\},\s*true\);\s*$/);

  assert.match(source, /if\s*\(!isRemoteOnline\(\)\)/);
  assert.match(source, /if\s*\(window\.firebaseConfig\)/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /event\.stopImmediatePropagation\(\)/);
  assert.match(source, /返信内容は保持しています/);
  assert.match(source, /textarea\.dataset\.commentReplyTargetV250\s*=\s*replyTarget\.commentId/);
  assert.match(source, /textarea\.closest\('form'\)\?\.requestSubmit\(\)/);
});

test('Ver.349 release-290 product history remains durable in later aligned releases', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);
  assert.ok(release >= 290);
  assert.equal(Number(responsibilities.baselineRelease), release);

  const group = responsibilities.groups.find(item => item.id === 'user-and-comments');
  const reason = String(group?.reason || '');
  assert.match(reason, /Ver\.349製品/);
  assert.match(reason, /document submit ownershipを撤去/);
  assert.match(reason, /release 290へ更新/);
});

test('Ver.349 handoff history survives while later comment cleanup advances', () => {
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const group = responsibilities.groups.find(item => item.id === 'user-and-comments');
  const reason = String(group?.reason || '');
  assert.match(reason, /Ver\.350監査/);
  assert.match(reason, /Ver\.351監査/);
});

// Ver.493: original Ver.350 tests (18 assertions), unchanged.
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
  assert.doesNotMatch(source, /document\.addEventListener\(\s*["']click["']\s*,\s*event\s*=>/);
  assert.match(source, /document\.addEventListener\(\s*["']click["']\s*,\s*handlePickerOutsideClick\s*,\s*true\s*\)/);
  assert.match(source, /document\.removeEventListener\(\s*["']click["']\s*,\s*handlePickerOutsideClick\s*,\s*true\s*\)/);
});

test('Ver.350 evidence remains durable while current release and cleanup priority advance', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);
  assert.ok(release >= 290);
  assert.equal(Number(responsibilities.baselineRelease), release);

  const group = responsibilities.groups.find(item => item.id === 'user-and-comments');
  const reason = String(group?.reason || '');
  assert.match(reason, /Ver\.350監査/);
  assert.match(reason, /Ver\.351監査/);

  const candidate = responsibilities.priorityCandidates?.[0];
  assert.ok(candidate?.goal && candidate?.precondition);
});

test('Ver.493 retired Ver.349 and Ver.350 standalone suites stay absent', () => {
  for (const name of [
    'comment-reactions-submit-scope-v348.test.mjs',
    'comment-reactions-click-scope-v350.test.mjs'
  ]) {
    assert.equal(fs.existsSync(path.join(ROOT, 'test-harness', name)), false,
      'retired Protocol suite must stay absent: ' + name);
  }
});


// Ver.520: original Ver.354 Protocol assertions preserved under the comment click/observer owner.
{
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

}
