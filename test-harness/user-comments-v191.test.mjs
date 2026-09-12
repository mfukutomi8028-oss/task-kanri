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

  assert.equal(version, '191');

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

  assert.ok(styles.indexOf('ui-v154.css') < styles.indexOf('ui-comment-mentions-v191.css'));
  assert.ok(styles.indexOf('ui-comment-mentions-v191.css') < styles.indexOf('ui-sidebar-v180.css'));
  assert.ok(styles.indexOf('ui-task-toolbar-v179.css') < styles.indexOf('ui-comment-reactions-v191.css'));
  assert.ok(styles.indexOf('ui-comment-reactions-v191.css') < styles.indexOf('ui-work-memo-v190.css'));
  assert.ok(scripts.indexOf('detail-layout-v154.js') < scripts.indexOf('user-registration-v191.js'));
  assert.ok(scripts.indexOf('user-registration-v191.js') < scripts.indexOf('comment-mentions-v191.js'));
  assert.ok(scripts.indexOf('comment-mentions-v191.js') < scripts.indexOf('comment-reactions-v191.js'));
  assert.ok(scripts.indexOf('comment-reactions-v191.js') < scripts.indexOf('work-features-v167.js'));
});

test('Ver.191 keeps mention and reaction CSS byte-equivalent while separating ownership by filename', () => {
  const mention = read('ui-comment-mentions-v191.css');
  const reaction = read('ui-comment-reactions-v191.css');

  assert.equal(mention, read('ui-v156.css'), 'mention CSS must preserve the established visual contract byte-for-byte');
  assert.equal(reaction, read('ui-v165.css'), 'reaction CSS must preserve the established visual contract byte-for-byte');
  assert.match(mention, /workflow-mention-shell-v156/);
  assert.doesNotMatch(mention, /comment-reaction-chip-v165/);
  assert.match(reaction, /comment-reaction-chip-v165/);
  assert.doesNotMatch(reaction, /workflow-mention-shell-v156/);
});

test('Ver.191 semantic JavaScript assets preserve the proven legacy bodies byte-for-byte', () => {
  assert.equal(read('user-registration-v191.js'), read('user-add-fix-v155.js'));
  assert.equal(read('comment-mentions-v191.js'), read('mention-picker-v156.js'));
  assert.equal(read('comment-reactions-v191.js'), read('comment-reactions-v165.js'));
});

test('Ver.191 preserves user and reaction write boundaries while mention remains presentation-only', () => {
  const user = read('user-registration-v191.js');
  const mention = read('comment-mentions-v191.js');
  const reaction = read('comment-reactions-v191.js');

  assert.match(user, /ensureRemote/);
  assert.match(user, /runTransaction\(metaRef/);
  assert.match(user, /\['users','userColors','usersUpdatedAt'\]/);
  assert.match(user, /_revisions/);

  assert.doesNotMatch(mention, /runTransaction|ensureRemote|firebaseConfig|firebaseio|firebasedatabase/);
  assert.match(mention, /workflow-mention-shell-v156/);
  assert.match(mention, /MutationObserver/);

  assert.match(reaction, /runTransaction\(target/);
  assert.match(reaction, /rooms\/\$\{roomId\(\)\}\/tasks\/\$\{taskId\}/);
  assert.match(reaction, /revision:\s*revision \+ 1/);
  assert.match(reaction, /if \(patchTimer\) return;/,
    'the proven non-starving reaction patch scheduler must remain active');
  assert.doesNotMatch(reaction, /clearTimeout\(patchTimer\)/,
    'the former starvation-prone debounce must not return');
});
