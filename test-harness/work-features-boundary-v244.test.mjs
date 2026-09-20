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

test('Ver.244 product: current work-feature split stays active once and keeps core before presentation', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  const version = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);

  assert.ok(version >= 244, 'product contract requires the completed Ver.244 release or later');
  assert.equal(scripts.filter(name => name === 'work-features-v167.js').length, 1);
  assert.equal(scripts.filter(name => name === 'work-features-ui-v190.js').length, 1);
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

  assert.match(core, /runTransaction\(ref\(featureState\.db, `rooms\/\$\{featureState\.roomId\}\/businessMemos\/\$\{next\.id\}`\)/);
  assert.match(core, /runTransaction\(ref\(featureState\.db, `rooms\/\$\{featureState\.roomId\}\/taskStarts\/\$\{id\}`\)/);
  assert.match(core, /const snapshot = await get\(ref\(featureState\.db, `rooms\/\$\{featureState\.roomId\}\/tasks\/\$\{id\}`\)\)/,
    'start-date bridge must verify the canonical task from Firebase before writing its companion record');
  assert.match(core, /verifyAndPersistStartDate/);
  assert.doesNotMatch(core, /runTransaction\(ref\(featureState\.db, `rooms\/\$\{featureState\.roomId\}\/tasks\/\$\{id\}`\)/,
    'work-feature core must not become a second owner of canonical task-body writes');
});

test('Ver.244 product: orphan cleanup rechecks the canonical task and deletes only the server revision it inspected', () => {
  const core = read('work-features-v167.js');
  const cleanup = core.match(/async function cleanupOrphanStarts\(\) \{([\s\S]*?)\n  \}\n\n  function futureTasks/)?.[1] || '';

  assert.ok(cleanup, 'cleanupOrphanStarts must be inspectable');
  assert.match(cleanup, /orphanIds/);
  assert.match(cleanup, /const \{ ref, get, runTransaction \} = firebaseModules/);
  assert.match(cleanup, /const taskRef = ref\(featureState\.db, `rooms\/\$\{featureState\.roomId\}\/tasks\/\$\{id\}`\)/);
  assert.match(cleanup, /const startRef = ref\(featureState\.db, `rooms\/\$\{featureState\.roomId\}\/taskStarts\/\$\{id\}`\)/);
  assert.match(cleanup, /const taskSnapshot = await get\(taskRef\)/);
  assert.match(cleanup, /const startSnapshot = await get\(startRef\)/);
  assert.match(cleanup, /const taskRecheck = await get\(taskRef\)/);
  assert.match(cleanup, /runTransaction\(startRef, current =>/);
  assert.match(cleanup, /finiteRevision\(current\.revision\) !== expectedRevision/);
  assert.doesNotMatch(cleanup, /\bset\(/,
    'remote orphan cleanup must not perform an unguarded set(null) delete');
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

test('Ver.244 product: inventory records the hardened boundary while later cleanup stays outside work-features', () => {
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  const group = inventory.groups.find(item => item.id === 'work-memo-and-reserved');
  const candidate = inventory.priorityCandidates?.[0];

  assert.ok(Number(inventory.baselineRelease) >= 244);
  assert.ok(group);
  assert.equal(group.consolidation, 'consolidated-v244');
  assert.deepEqual(group.assets, [
    'ui-work-memo-v190.css',
    'ui-reserved-task-v190.css',
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
  assert.ok(candidate.scope.every(asset => !['work-features-v167.js', 'work-features-ui-v190.js'].includes(asset)),
    'completed work-feature boundary must not return to the active cleanup priority');
});
