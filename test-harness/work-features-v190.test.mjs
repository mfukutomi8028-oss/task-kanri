import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FROZEN_RETIRED_CSS_BLOBS_V401, FROZEN_RETIRED_CSS_BLOBS_V405 } from './build-pages-runtime-v382.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.190 assets remain active in later releases', () => {
  const manifest = read('release-manifest.js');
  const version = manifest.match(/version:\s*"(\d+)"/)?.[1];
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');

  assert.ok(Number(version) >= 190, 'Ver.190 responsibility split must remain present in later releases');

  for (const name of ['ui-work-memo-v190.css', 'ui-reserved-task-v190.css']) {
    assert.equal(styles.filter(item => item === name).length, 1, `${name} must be active exactly once`);
    assert.ok(required.includes(name), `${name} must be required`);
  }

  assert.ok(styles.indexOf('ui-work-memo-v190.css') < styles.indexOf('ui-reserved-task-v190.css'));
  assert.ok(styles.indexOf('ui-reserved-task-v190.css') < styles.indexOf('ui-icon-system-v178.css'),
    'feature-owned styles must keep the former work-feature cascade position before icon-system CSS');

  for (const name of ['ui-v167.css', 'ui-v168.css', 'ui-v173.css']) {
    assert.ok(!styles.includes(name), `${name} must not remain dynamically active`);
    assert.ok(!required.includes(name), `${name} must not remain required`);
    if (name === 'ui-v173.css') {
      const frozen = JSON.parse(read('compat/frozen-legacy-runtime-v397.json'));
      assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'Ver.401 removes the redundant Git root copy');
      assert.equal(typeof frozen[name], 'string', 'old cached manifest CSS must still be available in the archive');
      assert.equal(FROZEN_RETIRED_CSS_BLOBS_V401[name], 'ef244b75a132fd21b1cb50aacd9dedadf3f1f7f6', 'cached CSS must retain the original Git hash');
    } else {
      assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'retired memo CSS Git root copy must be absent: ' + name);
      const frozen = JSON.parse(read('compat/frozen-legacy-runtime-v397.json'));
      assert.equal(typeof frozen[name], 'string', 'original cached memo CSS must remain archived: ' + name);
      assert.ok(Object.hasOwn(FROZEN_RETIRED_CSS_BLOBS_V405, name), 'original Git SHA must remain pinned: ' + name);
    }
  }

  assert.equal(scripts.filter(item => item === 'work-features-v167.js').length, 1,
    'write-side work feature core must remain active exactly once');
  assert.equal(scripts.filter(item => item === 'work-features-ui-v190.js').length, 1,
    'Ver.190 presentation helper must be active exactly once');
  assert.ok(required.includes('work-features-v167.js'));
  assert.ok(required.includes('work-features-ui-v190.js'));
  assert.ok(!scripts.includes('work-features-ui-v168.js'));
  assert.ok(!required.includes('work-features-ui-v168.js'));
  assert.ok(fs.existsSync(path.join(ROOT, 'work-features-ui-v168.js')),
    'legacy UI helper must remain physically available for cached manifests');
  assert.ok(scripts.indexOf('work-features-v167.js') < scripts.indexOf('work-features-ui-v190.js'),
    'write-side core must initialize before the presentation helper');
});

test('Ver.190 CSS ownership separates business memo presentation from reserved-task presentation', () => {
  const memo = read('ui-work-memo-v190.css');
  const reserved = read('ui-reserved-task-v190.css');

  assert.match(memo, /work-memo-card-v167/);
  assert.match(memo, /work-memo-dialog-v167/);
  assert.match(memo, /work-memo-new-v176/,
    'Ver.190 keeps the established memo toolbar hook so DOM/visual baselines remain compatible');
  assert.doesNotMatch(memo, /work-memo-new-v190/,
    'responsibility ownership should change without needless DOM hook renaming');
  assert.doesNotMatch(memo, /reserved-task-card-v167/);
  assert.doesNotMatch(memo, /task-start-date-field-v167/);
  assert.doesNotMatch(memo, /nav-item\[data-layout="todos"\]/,
    'work memo CSS must not own ToDo icon geometry');

  assert.match(reserved, /future-task-v167-hidden/);
  assert.match(reserved, /task-start-date-field-v167/);
  assert.match(reserved, /reserved-task-card-v167/);
  assert.match(reserved, /task-start-detail-v167/);
  assert.doesNotMatch(reserved, /work-memo-card-v167/);
  assert.doesNotMatch(reserved, /work-memo-pin-v167/);
});

test('Ver.190 presentation helper is DOM-only and no longer observes the whole body', () => {
  const ui = read('work-features-ui-v190.js');

  assert.match(ui, /workMemoViewV167/);
  assert.match(ui, /new MutationObserver\(schedulePatch\)/);
  assert.match(ui, /memoObserver\.observe\(root, \{ childList: true, subtree: true \}\)/);
  assert.match(ui, /classList\.add\('work-memo-new-v176'\)/,
    'presentation helper must preserve the established memo toolbar DOM hook');
  assert.doesNotMatch(ui, /observe\(document\.body/);
  assert.doesNotMatch(ui, /patchNavIcons/,
    'icon replacement belongs to the release/icon system, not the work-feature UI helper');
  assert.doesNotMatch(ui, /runTransaction|firebaseModules|businessMemos\/|taskStarts\//,
    'presentation helper must not contain Firebase write/read responsibilities');
});

test('Ver.190 preserves work-feature revision transactions in the unchanged core', () => {
  const core = read('work-features-v167.js');

  assert.match(core, /businessMemos\/\$\{next\.id\}/);
  assert.match(core, /taskStarts\/\$\{id\}/);
  assert.match(core, /runTransaction/);
  assert.match(core, /pendingStartSave/);
  assert.match(core, /finiteRevision/);
  assert.match(core, /verifyAndPersistStartDate/);
});
