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

test('Ver.186 keeps workflow detail and inbox/archive CSS split while retaining legacy files', () => {
  const manifest = read('release-manifest.js');
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const required = extractStringArray(manifest, 'requiredAssets');
  const detail = 'ui-workflow-detail-v186.css';
  const inboxArchive = 'ui-inbox-archive-v186.css';
  const legacy = ['ui-v152.css', 'ui-v153.css'];

  for (const name of [detail, inboxArchive]) {
    assert.ok(styles.includes(name), `${name} must stay dynamically active`);
    assert.ok(required.includes(name), `${name} must stay required`);
    assert.equal(styles.filter(item => item === name).length, 1, `${name} must load exactly once`);
  }

  assert.ok(styles.indexOf(detail) < styles.indexOf(inboxArchive),
    'workflow detail CSS must load before inbox/archive CSS');
  assert.ok(styles.indexOf(inboxArchive) < styles.indexOf('ui-v154.css'),
    'Ver.186 workflow CSS must keep the former v152/v153 position before ui-v154.css');
  assert.ok(styles.indexOf('ui-v157.css') > styles.indexOf(inboxArchive),
    'mobile regression fixes in ui-v157.css must continue to refine Ver.186 inbox/archive CSS');

  for (const name of legacy) {
    assert.ok(!styles.includes(name), `legacy workflow CSS must not remain dynamically active: ${name}`);
    assert.ok(!required.includes(name), `legacy workflow CSS must not remain required: ${name}`);
    assert.ok(fs.existsSync(path.join(ROOT, name)), `legacy workflow CSS is retained for cached-manifest compatibility: ${name}`);
  }

  const currentInboxCss = read(inboxArchive);
  assert.doesNotMatch(currentInboxCss, /\.workflow-inbox-nav-v152/,
    'current inbox/archive CSS must not restore the removed legacy inbox navigation');
  assert.doesNotMatch(currentInboxCss, /\.workflow-archive-nav-v152/,
    'current inbox/archive CSS must not restore the removed legacy archive navigation');
});
