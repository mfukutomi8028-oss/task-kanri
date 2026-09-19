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

test('Ver.216 keeps mention presentation isolated and extends the comment interaction stylesheet without reactivating legacy CSS', () => {
  const mention = read('ui-comment-mentions-v191.css');
  const interaction = read('ui-comment-reactions-v191.css');

  assert.equal(mention, read('ui-v156.css'), 'mention CSS must preserve the established visual contract byte-for-byte');
  assert.match(mention, /workflow-mention-shell-v156/);
  assert.doesNotMatch(mention, /comment-reaction-chip-v165|comment-thread-v215/);

  assert.match(interaction, /comment-reaction-chip-v165/);
  assert.match(interaction, /comment-thread-v215/);
  assert.match(interaction, /comment-reply-list-v215/);
  assert.match(interaction, /comment-reply-compose-v215/);
  assert.match(interaction, /grid-template-columns:auto minmax\(0,1fr\)/,
    'reply context must remain readable without a decorative symbol column');
  assert.match(interaction, /\.comment-submit-hint-v215\{[\s\S]*?grid-column:1 \/ -1;/,
    'submit hint must stay inside the explicit single-column comment composer');
  assert.doesNotMatch(interaction, /\.comment-submit-hint-v215\{[^}]*grid-column:2 \/ 4;/s,
    'submit hint must not create implicit columns inside the narrow detail pane');
  assert.doesNotMatch(interaction, /workflow-mention-shell-v156/);
  assert.ok(interaction.length > read('ui-v165.css').length, 'Ver.215 reply presentation must extend the former reaction-only stylesheet');
});

test('Ver.218 keeps the mobile reaction picker anchored to its invoking comment instead of the viewport', () => {
  const interaction = read('ui-comment-reactions-v191.css');
  assert.match(interaction, /\.comment-reaction-picker-v165\{[\s\S]*?position:absolute;[\s\S]*?bottom:calc\(100% \+ 7px\);/,
    'reaction picker must stay anchored to the reaction row');
  const mobile = interaction.match(/@media \(max-width:860px\)\{([\s\S]*)\}\s*$/)?.[1] || '';
  assert.match(mobile, /\.comment-reaction-picker-v165\{/,
    'mobile picker styling must remain present');
  assert.doesNotMatch(mobile, /\.comment-reaction-picker-v165\{[^}]*position:fixed;/s,
    'mobile must not detach the picker from the comment with viewport-fixed positioning');
  assert.doesNotMatch(mobile, /\.comment-reaction-picker-v165\{[^}]*bottom:14px;/s,
    'mobile must not pin the picker to the bottom of the viewport');
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
  assert.match(reaction, /button\.textContent = '返信'/,
    'reply action must use plain text instead of a decorative reply symbol');
  assert.doesNotMatch(reaction, /↩|↳/,
    'Ver.215 reply UI must not add decorative arrow/emoji-like symbols');
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

test('Ver.235 reply writes keep structured history but do not advertise a directed reply as a room-wide task update', () => {
  const interaction = read('comment-reactions-v191.js');

  assert.match(interaction, /saveRemoteReply/);
  assert.match(interaction, /replyTo:\s*parentId/);
  assert.match(interaction, /const historyId = `history-\$\{replyId\.slice\('reply-'\.length\)\}`/);
  assert.match(interaction, /text:\s*`\$\{replyType\}を追加しました。`/,
    'reply must remain available in task history');
  assert.match(interaction, /return \{ \.\.\.current, comments, history, revision: revision \+ 1 \};/,
    'reply transaction must update comments/history/revision without bumping room-wide updatedAt/updatedBy metadata');
  assert.doesNotMatch(interaction, /return \{ \.\.\.current, comments, history, revision: revision \+ 1, updatedAt:/,
    'directed replies must not become shared activity-feed updates');
  assert.match(interaction, /deliverPersonal\(recipient, cleanEventId\('reply'/,
    'reply author must receive a durable personal inbox event from the writer client');
  assert.match(interaction, /\.slice\(-80\)/,
    'reply history must preserve the existing 80-entry history cap');
  assert.match(interaction, /wb-reply:/,
    'local-only compatibility marker must remain available for the existing app comment write path');
  assert.match(interaction, /event\.stopImmediatePropagation\(\)/,
    'remote reply submit must not fall through to the legacy flat-comment submit listener');
  assert.match(interaction, /Ctrl \/ ⌘ \+ Enterで送信/);
});

test('Ver.235 personal notifications route replies and reaction additions without mixing reaction noise into actionable items', () => {
  const interaction = read('comment-reactions-v191.js');
  const inbox = read('inbox-events-v183.js');
  const ui = read('inbox-ui-v183.js');
  const css = read('ui-inbox-archive-v186.css');

  assert.match(interaction, /type:\s*"reaction"/);
  assert.match(interaction, /title:\s*"コメントにリアクションがありました"/);
  assert.match(interaction, /const added = normalizeReactionUsers/,
    'reaction removal must not emit a new personal notification');
  assert.match(inbox, /function queueReactionAdditions/);
  assert.match(inbox, /eventId\('reaction',taskId,cid,emoji,reactor,nextRevision\)/,
    'observer fallback must use the same revision-scoped idempotent reaction event shape');
  assert.match(inbox, /if\(!reply\.replyTo&&assignee\)recipients\.add\(assignee\)/,
    'directed replies must not fan out as generic comment notifications to an unrelated assignee');
  assert.match(inbox, /const kind=isReply\?'reply':isMention\?'mention':'comment'/,
    'the replied-to author gets one reply event even if they are also mentioned');

  assert.match(ui, /data-inbox-category-v235="important"/);
  assert.match(ui, /data-inbox-category-v235="reaction"/);
  assert.match(ui, /category==='reaction'\?items\.filter\(isReaction\):items\.filter\(item=>!isReaction\(item\)\)/);
  assert.match(ui, /このタブを既読/,
    'bulk read action must stay scoped when reaction categories are present');
  assert.match(css, /workflow-inbox-category-tabs-v235/);
  assert.match(css, /data-inbox-type-v235="reaction"/);
});

test('Ver.235 reply notifications include the replied-to author and strip local compatibility markers from notification text', () => {
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
