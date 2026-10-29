import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FROZEN_RETIRED_CSS_BLOBS_V401, FROZEN_RETIRED_CSS_BLOBS_V405, FROZEN_RETIRED_JS_BLOBS_V410 } from './build-pages-runtime-v382.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.244 product: current work-feature split stays active once and keeps core before presentation', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  const version = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);

  assert.ok(version >= 244, 'product contract requires the completed Ver.244 release or later');
  assert.equal(scripts.filter(name => name === 'work-features-v167.js').length, 1);
  assert.equal(scripts.filter(name => name === 'work-features-ui-v190.js').length, 1);
  assert.ok(required.includes('workspace-memo-v539.js'));
  assert.equal(scripts.filter(name => name === 'workspace-memo-v539.js').length, 1);
  assert.ok(scripts.indexOf('workspace-memo-v539.js') < scripts.indexOf('work-features-v167.js'));
  assert.ok(required.includes('workspace-start-date-v548.js'));
  assert.equal(scripts.filter(name => name === 'workspace-start-date-v548.js').length, 1);
  assert.ok(scripts.indexOf('workspace-start-date-v548.js') < scripts.indexOf('work-features-v167.js'));
  assert.ok(required.includes('work-features-v167.js'));
  assert.ok(required.includes('work-features-ui-v190.js'));
  assert.ok(scripts.indexOf('work-features-v167.js') < scripts.indexOf('work-features-ui-v190.js'));
});

test('Ver.244 product: presentation helper owns DOM polish only and no persistence boundary', () => {
  const ui = read('work-features-ui-v190.js');

  assert.match(ui, /patchStartDateField/);
  assert.match(ui, /patchMemoDialog/);
  assert.match(ui, /patchMemoCards/);
  assert.match(ui, /patchMemoDensity/);
  assert.match(ui, /memoObserver\.observe\(root, \{ childList: true, subtree: true \}\)/);
  assert.doesNotMatch(ui, /firebaseModules|runTransaction|connectDatabaseEmulator|businessMemos\/|taskStarts\//);
  assert.doesNotMatch(ui, /localStorage\.(?:setItem|removeItem)/);
});

test('Ver.244 product: memo and start-date user writes remain child transactions while task body remains app-owned', () => {
  const core = read('work-features-v167.js');

  const writer = read('workspace-memo-v539.js');
  assert.match(core, /window\.WorkBoardMemoPersistenceV539\.create\(/);
  assert.match(core, /return memoRepository\.commit\(next, expectedRevision\)/);
  assert.match(core, /memoRepository\.remove\(id, expectedRevision\)/);
  assert.ok(writer.includes('rooms/${state.roomId}/businessMemos/${next.id}'));
  assert.match(writer, /runTransaction\(ref\(state\.db/);
  assert.match(writer, /finiteRevision\(current\.revision\) !== finiteRevision\(expectedRevision\)/);
  const startWriter = read('workspace-start-date-v548.js');
  assert.match(core, /window\.WorkBoardStartDatePersistenceV548\.create\(/);
  assert.match(core, /startDateRepository\.save\(id, nextDate, expected\)/);
  assert.ok(startWriter.includes('rooms/${state.roomId}/taskStarts/${id}'));
  assert.match(startWriter, /runTransaction\(ref\(state\.db,/);
  assert.match(startWriter, /finiteRevision\(current\?\.revision\) !== expected/);
  assert.ok(!core.includes('runTransaction(ref(featureState.db, `rooms/${featureState.roomId}/taskStarts/${id}`)'), 'only the shared writer owns the start-date save');
  assert.match(core, /const snapshot = await get\(ref\(featureState\.db, `rooms\/\$\{featureState\.roomId\}\/tasks\/\$\{id\}`\)\)/,
    'start-date bridge must verify the canonical task from Firebase before writing its companion record');
  assert.match(core, /verifyAndPersistStartDate/);
  assert.doesNotMatch(core, /runTransaction\(ref\(featureState\.db, `rooms\/\$\{featureState\.roomId\}\/tasks\/\$\{id\}`\)/,
    'work-feature core must not become a second owner of canonical task-body writes');
});

test('Ver.244/549 product: orphan cleanup delegates to shared owner and retains double-check and child revision guard', () => {
  const core = read('work-features-v167.js');
  const writer = read('workspace-start-date-v548.js');
  const cleanup = core.match(/async function cleanupOrphanStarts\(\) \{([\s\S]*?)\n  \}\n\n  function futureTasks/)?.[1] || '';

  assert.ok(cleanup, 'cleanupOrphanStarts must remain inspectable');
  assert.match(cleanup, /return startDateRepository\.cleanupOrphans\(\)/);
  assert.match(writer, /if \(!state\.tasksLoaded \|\| !state\.startsLoaded\) return/);
  assert.match(writer, /const orphanIds = Object\.keys\(state\.taskStarts \|\| \{\}\)\.filter\(id => !state\.tasks\[id\]\)/);
  assert.match(writer, /const \{ ref, get, runTransaction \} = firebaseModules/);
  assert.ok(writer.includes('rooms/${state.roomId}/tasks/${id}'));
  assert.ok(writer.includes('rooms/${state.roomId}/taskStarts/${id}'));
  assert.match(writer, /const taskSnapshot = await get\(taskRef\)/);
  assert.match(writer, /const startSnapshot = await get\(startRef\)/);
  assert.match(writer, /const taskRecheck = await get\(taskRef\)/);
  assert.match(writer, /runTransaction\(startRef, current =>/);
  assert.match(writer, /finiteRevision\(current\.revision\) !== expectedRevision/);
  assert.doesNotMatch(writer, /\bset\(/,
    'remote orphan cleanup must not perform an unguarded set(null) delete');
  assert.doesNotMatch(cleanup, /runTransaction|firebaseModules|localStorage/,
    'Classic must delegate deletion without creating another writer');
});

test('Ver.244 product: core observer is limited to main/detail feature surfaces while presentation observer stays memo-scoped', () => {
  const core = read('work-features-v167.js');
  const ui = read('work-features-ui-v190.js');

  assert.match(core, /const main = document\.getElementById\('mainContent'\)/);
  assert.match(core, /const detail = document\.getElementById\('detailBody'\)/);
  assert.match(core, /const roots = \[main, detail\]\.filter\(Boolean\)/);
  assert.match(core, /roots\.forEach\(root => featureState\.domObserver\.observe\(root, \{ childList: true, subtree: true \}\)\)/);
  assert.doesNotMatch(core, /document\.querySelector\('\.app-shell'\)/,
    'work-feature core must no longer observe the whole app shell');
  assert.match(ui, /const root = document\.getElementById\('workMemoViewV167'\)/);
  assert.match(ui, /memoObserver\.observe\(root, \{ childList: true, subtree: true \}\)/);
  assert.doesNotMatch(ui, /\.app-shell/);
});

test('Ver.244 product: inventory keeps the hardened persistence boundary when later observer cleanup returns to work-features', () => {
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  const group = inventory.groups.find(item => item.id === 'work-memo-and-reserved');
  const candidate = inventory.priorityCandidates?.[0];

  assert.ok(Number(inventory.baselineRelease) >= 244);
  assert.ok(group);
  assert.equal(group.consolidation, 'consolidated-v244');
  assert.deepEqual(group.assets, [
    'ui-work-memo-v190.css',
    'ui-reserved-task-v190.css',
    'workspace-memo-v539.js',
    'workspace-start-date-v548.js',
    'work-features-v167.js',
    'work-features-ui-v190.js'
  ]);
  assert.match(group.reason, /Ver\.244製品/);
  assert.match(group.reason, /server再確認/);
  assert.match(group.reason, /revision transaction/);
  assert.match(group.reason, /#mainContent/);
  assert.match(group.reason, /#detailBody/);
  assert.ok(candidate);
  assert.ok(Array.isArray(candidate.scope) && candidate.scope.length >= 1);

  if (candidate.scope.includes('work-features-v167.js')) {
    assert.match(group.reason, /Ver\.314監査/);
    assert.match(group.reason, /Ver\.315製品/);
    assert.match(group.reason, /release 278/);
    assert.match(candidate.goal || '', /監査/);
    assert.match(candidate.goal || '', /製品runtime・release値・Firebase・業務データ経路を変更しない/);
    assert.match(candidate.precondition || '', /baselineRelease/);
  } else {
    assert.ok(candidate.scope.every(asset => !['work-features-v167.js', 'work-features-ui-v190.js'].includes(asset)),
      'without new observer evidence, the completed Ver.244 work-feature boundary stays outside the active cleanup priority');
  }
});

// Ver.525: original Ver.190 CSS, presentation and cached URL assertions consolidated under current work-feature owner.
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
  assert.equal(fs.existsSync(path.join(ROOT, 'work-features-ui-v168.js')), false,
    'old work UI helper should be archived instead of physically present in Git root');
  const oldWorkUi = JSON.parse(read('compat/frozen-legacy-runtime-v397.json'))['work-features-ui-v168.js'];
  assert.equal(typeof oldWorkUi, 'string', 'historical work UI code must remain published at original URL');
  assert.equal(FROZEN_RETIRED_JS_BLOBS_V410['work-features-ui-v168.js'],
    '8e81ee3a52539caa370af0dc3282b9798d07c3d2');
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

test('Ver.190 preserves work-feature revision transactions with a canonical memo writer and the existing start-date core', () => {
  const core = read('work-features-v167.js');

  const writer = read('workspace-memo-v539.js');
  assert.match(core, /memoRepository\.commit\(next, expectedRevision\)/);
  assert.ok(writer.includes('businessMemos/${next.id}'));
  assert.match(writer, /runTransaction/);
  const startWriter = read('workspace-start-date-v548.js');
  assert.match(startWriter, /taskStarts\/\$\{id\}/);
  assert.match(startWriter, /runTransaction/);
  assert.match(core, /startDateRepository\.save/);
  assert.match(core, /pendingStartSave/);
  assert.match(core, /finiteRevision/);
  assert.match(core, /verifyAndPersistStartDate/);
});
