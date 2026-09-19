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

test('Ver.244 audit: current work-feature split stays active once and keeps core before presentation', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  const version = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);

  assert.ok(version >= 243, 'audit runs on the completed Ver.243 baseline or later');
  assert.equal(scripts.filter(name => name === 'work-features-v167.js').length, 1);
  assert.equal(scripts.filter(name => name === 'work-features-ui-v190.js').length, 1);
  assert.ok(required.includes('work-features-v167.js'));
  assert.ok(required.includes('work-features-ui-v190.js'));
  assert.ok(scripts.indexOf('work-features-v167.js') < scripts.indexOf('work-features-ui-v190.js'));
});

test('Ver.244 audit: presentation helper owns DOM polish only and no persistence boundary', () => {
  const ui = read('work-features-ui-v190.js');

  assert.match(ui, /patchStartDateField/);
  assert.match(ui, /patchMemoDialog/);
  assert.match(ui, /patchMemoCards/);
  assert.match(ui, /patchMemoDensity/);
  assert.match(ui, /memoObserver\.observe\(root, \{ childList: true, subtree: true \}\)/);
  assert.doesNotMatch(ui, /firebaseModules|runTransaction|connectDatabaseEmulator|businessMemos\/|taskStarts\//);
  assert.doesNotMatch(ui, /localStorage\.(?:setItem|removeItem)/);
});

test('Ver.244 audit: memo and start-date user writes are child transactions while task body remains app-owned', () => {
  const core = read('work-features-v167.js');

  assert.match(core, /runTransaction\(ref\(featureState\.db, `rooms\/\$\{featureState\.roomId\}\/businessMemos\/\$\{next\.id\}`\)/);
  assert.match(core, /runTransaction\(ref\(featureState\.db, `rooms\/\$\{featureState\.roomId\}\/taskStarts\/\$\{id\}`\)/);
  assert.match(core, /const snapshot = await get\(ref\(featureState\.db, `rooms\/\$\{featureState\.roomId\}\/tasks\/\$\{id\}`\)\)/,
    'start-date bridge must verify the canonical task from Firebase before writing its companion record');
  assert.match(core, /verifyAndPersistStartDate/);
  assert.doesNotMatch(core, /runTransaction\(ref\(featureState\.db, `rooms\/\$\{featureState\.roomId\}\/tasks\/\$\{id\}`\)/,
    'work-feature core must not become a second owner of canonical task-body writes');
});

test('Ver.244 audit: orphan cleanup is the one unguarded remote delete boundary', () => {
  const core = read('work-features-v167.js');
  const cleanup = core.match(/async function cleanupOrphanStarts\(\) \{([\s\S]*?)\n  \}\n\n  function futureTasks/)?.[1] || '';

  assert.ok(cleanup, 'cleanupOrphanStarts must be inspectable');
  assert.match(cleanup, /orphanIds/);
  assert.match(cleanup, /set\(ref\(featureState\.db, `rooms\/\$\{featureState\.roomId\}\/taskStarts\/\$\{id\}`\), null\)/);
  assert.doesNotMatch(cleanup, /runTransaction|get\(/,
    'current cleanup deletes from mirrored subscription state without a final server ownership/revision recheck');
});

test('Ver.244 audit: core observes the full app shell while presentation observer stays memo-scoped', () => {
  const core = read('work-features-v167.js');
  const ui = read('work-features-ui-v190.js');

  assert.match(core, /const root = document\.querySelector\('\.app-shell'\)/);
  assert.match(core, /featureState\.domObserver\.observe\(root, \{ childList: true, subtree: true \}\)/);
  assert.match(ui, /const root = document\.getElementById\('workMemoViewV167'\)/);
  assert.match(ui, /memoObserver\.observe\(root, \{ childList: true, subtree: true \}\)/);
  assert.doesNotMatch(ui, /\.app-shell/);
});

test('Ver.244 audit: inventory records audit evidence and narrows the product candidate to the core only', () => {
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  const group = inventory.groups.find(item => item.id === 'work-memo-and-reserved');
  const candidate = inventory.priorityCandidates?.[0];

  assert.ok(group);
  assert.deepEqual(group.assets, [
    'ui-work-memo-v190.css',
    'ui-reserved-task-v190.css',
    'work-features-v167.js',
    'work-features-ui-v190.js'
  ]);
  assert.match(group.reason, /Ver\.244監査/);
  assert.match(group.reason, /presentation-only/);
  assert.match(group.reason, /cleanupOrphanStarts/);
  assert.deepEqual(candidate?.scope, ['work-features-v167.js']);
  assert.match(candidate?.goal || '', /最終server再確認/);
  assert.match(candidate?.goal || '', /\.app-shell全体MutationObserver/);
  assert.match(candidate?.goal || '', /work-features-ui-v190\.jsはpresentation-only.*修正対象から外す/);
});
