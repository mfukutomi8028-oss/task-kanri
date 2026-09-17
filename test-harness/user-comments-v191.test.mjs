import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.191 activates feature-owned user and comment assets and retires legacy active names', () => {
  const manifest = read('release-manifest.js');
  const version = manifest.match(/version:\s*"(\d+)"/)?.[1];
  const required = extractStringArray(manifest, 'requiredAssets');
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const scripts = extractStringArray(manifest, 'dynamicScripts');

  assert.ok(Number(version) >= 191, 'Ver.191 responsibility split must remain present in later releases');

  const currentStyles = ['ui-comment-mentions-v191.css', 'ui-comment-reactions-v191.css'];
  const legacyStyles = ['ui-v156.css', 'ui-v165.css'];
  const currentScripts = ['user-registration-v191.js', 'comment-mentions-v191.js', 'comment-reactions-v191.js'];
  const legacyScripts = ['user-add-fix-v155.js', 'mention-picker-v156.js', 'comment-reactions-v165.js'];

  for (const name of currentStyles) {
    assert.equal(styles.filter(item => item === name).length, 1, `${name} must be active exactly once`);
    assert.ok(required.includes(name), `${name} must be required`);
  }
  for (const name of currentScripts) {
    assert.equal(scripts.filter(item => item === name).length, 1, `${name} must be active exactly once`);
    assert.ok(required.includes(name), `${name} must be required`);
  }
  for (const name of [...legacyStyles, ...legacyScripts]) {
    assert.ok(!styles.includes(name) && !scripts.includes(name), `${name} must not remain dynamically active`);
    assert.ok(!required.includes(name), `${name} must not remain required`);
    assert.ok(fs.existsSync(path.join(ROOT, name)), `${name} must remain physically available for cached manifests`);
  }

  assert.ok(styles.indexOf('ui-inbox-archive-v186.css') < styles.indexOf('ui-comment-mentions-v191.css'));
  assert.ok(styles.indexOf('ui-comment-mentions-v191.css') < styles.indexOf('ui-sidebar-v180.css'));
  assert.ok(styles.indexOf('ui-task-toolbar-v179.css') < styles.indexOf('ui-comment-reactions-v191.css'));
  assert.ok(styles.indexOf('ui-comment-reactions-v191.css') < styles.indexOf('ui-work-memo-v190.css'));
  assert.ok(scripts.indexOf('detail-layout-v154.js') < scripts.indexOf('user-registration-v191.js'));
  assert.ok(scripts.indexOf('user-registration-v191.js') < scripts.indexOf('comment-mentions-v191.js'));
  assert.ok(scripts.indexOf('comment-mentions-v191.js') < scripts.indexOf('comment-reactions-v191.js'));
  assert.ok(scripts.indexOf('comment-reactions-v191.js') < scripts.indexOf('work-features-v167.js'));
});

test('Ver.215 keeps mention presentation isolated and extends the comment interaction stylesheet without reactivating legacy CSS', () => {
  const mention = read('ui-comment-mentions-v191.css');
  const interaction = read('ui-comment-reactions-v191.css');

  assert.equal(mention, read('ui-v156.css'), 'mention CSS must preserve the established visual contract byte-for-byte');
  assert.match(mention, /workflow-mention-shell-v156/);
  assert.doesNotMatch(mention, /comment-reaction-chip-v165|comment-thread-v215/);

  assert.match(interaction, /comment-reaction-chip-v165/);
  assert.match(interaction, /comment-thread-v215/);
  assert.match(interaction, /comment-reply-list-v215/);
  assert.match(interaction, /comment-reply-compose-v215/);
  assert.doesNotMatch(interaction, /workflow-mention-shell-v156/);
  assert.ok(interaction.length > read('ui-v165.css').length, 'Ver.215 reply presentation must extend the former reaction-only stylesheet');
});

test('Ver.215 preserves user and mention implementations while comment interactions own reaction + reply behavior', () => {
  const reaction = read('comment-reactions-v191.js');
  assert.equal(read('user-registration-v191.js'), read('user-add-fix-v155.js'));
  assert.equal(read('comment-mentions-v191.js'), read('mention-picker-v156.js'));
  assert.notEqual(reaction, read('comment-reactions-v165.js'), 'Ver.215 intentionally extends the interaction implementation');
  assert.match(reaction, /installCommentInteractionsV215/);
  assert.match(reaction, /data-comment-id/);
  assert.match(reaction, /replyTo/);
  assert.match(reaction, /comment-thread-v215/);
});

test('Ver.215 preserves reaction transaction semantics and binds reactions by comment id after thread reordering', () => {
  const reaction = read('comment-reactions-v191.js');

  assert.match(reaction, /runTransaction\(target/);
  assert.match(reaction, /rooms\/\$\{roomId\(\)\}\/tasks\/\$\{taskId\}/);
  assert.match(reaction, /revision:\s*revision \+ 1/);
  assert.match(reaction, /node\.dataset\.commentId/);
  assert.match(reaction, /commentMap\(task\)/);
  assert.match(reaction, /commentThreadSignatureV215/,
    'thread structure must be signature-gated to avoid MutationObserver redraw loops');
  assert.match(reaction, /replyActionSignatureV215/);
  assert.match(reaction, /replyContextSignatureV215/);
  assert.match(reaction, /replyComposeSignatureV215/);
  assert.match(reaction, /if \(patchTimer\) return;/,
    'the proven non-starving patch scheduler must remain active');
  assert.doesNotMatch(reaction, /clearTimeout\(patchTimer\)/,
    'the former starvation-prone debounce must not return');
});

test('Ver.215 reply writes use structured replyTo remotely and reuse the existing addComment path in local-only mode', () => {
  const interaction = read('comment-reactions-v191.js');

  assert.match(interaction, /saveRemoteReply/);
  assert.match(interaction, /replyTo:\s*parentId/);
  assert.match(interaction, /updatedAt:\s*createdAt/);
  assert.match(interaction, /updatedBy:\s*user/);
  assert.match(interaction, /wb-reply:/,
    'local-only compatibility marker must remain available for the existing app comment write path');
  assert.match(interaction, /event\.stopImmediatePropagation\(\)/,
    'remote reply submit must not fall through to the legacy flat-comment submit listener');
  assert.match(interaction, /Ctrl \/ ⌘ \+ Enterで送信/);
});

test('Ver.215 reply notifications include the replied-to author and strip local compatibility markers from notification text', () => {
  const inbox = read('inbox-events-v183.js');

  assert.match(inbox, /function replyInfo\(comment\)/);
  assert.match(inbox, /comment\?\.replyTo/);
  assert.match(inbox, /wb-reply:/);
  assert.match(inbox, /const replyAuthor=String\(parent\?\.author\|\|''\)/);
  assert.match(inbox, /if\(replyAuthor\)recipients\.add\(replyAuthor\)/);
  assert.match(inbox, /コメントに返信がありました/);
  assert.match(inbox, /short\(reply\.text,100\)/,
    'notification body must use marker-free reply text');
});
