import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [savedViews, manifest, responsibilityText, browserProduct] = await Promise.all([
  read('saved-views-v148.js'),
  read('release-manifest.js'),
  read('patch-responsibilities.json'),
  read('tests/saved-views-polling-v334.spec.mjs')
]);
const responsibilities = JSON.parse(responsibilityText);

test('Ver.334 product: saved-view completion retires the 250ms retry polling', () => {
  assert.doesNotMatch(savedViews, /setInterval\s*\(/);
  assert.doesNotMatch(savedViews, /attempts\s*>=\s*24/);
  assert.doesNotMatch(savedViews, /\},\s*250\s*\)/);
  assert.match(savedViews, /document\.getElementById\('savedFilterList'\)/);
  assert.match(savedViews, /saveObserver\s*=\s*new MutationObserver/);
  assert.match(savedViews, /saveObserver\.observe\(root,\s*\{\s*childList:\s*true,\s*subtree:\s*true\s*\}\)/);
  assert.match(savedViews, /saveTimeout\s*=\s*setTimeout\(resetPendingSave,\s*7000\)/);
});

test('Ver.334 product: canonical saved-filter creation still hands the created id to the existing workflow writer', () => {
  assert.match(savedViews, /ctx\s*=\s*\{\s*before:\s*ids\(\),\s*view:\s*snapshot\(\)\s*\}/);
  assert.match(savedViews, /const created = \[\.\.\.ids\(\)\]\.find\(id => !ctx\.before\.has\(id\)\)/);
  assert.match(savedViews, /W\.writeSavedView\(created,\s*view,\s*null\)/);
  assert.match(savedViews, /if \(!ctx \|\| completeCreatedFilter\(\)\) return/);
  assert.match(savedViews, /if \(completeCreatedFilter\(\)\) return/);
  assert.match(savedViews, /絞り込み・並び順・表示形式を保存しました。/);
});

test('Ver.334 product: browser regression uses the real save control and proves no saved-view interval is registered', () => {
  assert.match(browserProduct, /#saveCurrentFilter/);
  assert.match(browserProduct, /window\.prompt = \(\) => 'Ver\.334 保存ビュー'/);
  assert.match(browserProduct, /stack\.includes\('saved-views-v148\.js'\)/);
  assert.match(browserProduct, /ownedIntervals/);
  assert.match(browserProduct, /workflow\?\.savedViews/);
  assert.doesNotMatch(browserProduct, /page\.route\([^\n]*saved-views-v148\.js/);
});

test('Ver.334 product: release and responsibility baseline advance together to 284', () => {
  const release = manifest.match(/version:\s*"(\d+)"/)?.[1];
  assert.equal(release, '284');
  assert.equal(responsibilities.baselineRelease, '284');

  const workflowGroup = responsibilities.groups?.find(group => group.id === 'workflow-and-detail');
  assert.match(workflowGroup?.reason || '', /Ver\.334製品/);
  assert.match(workflowGroup?.reason || '', /saved-views-v148\.js/);
  assert.match(workflowGroup?.reason || '', /release 284/);

  const next = responsibilities.priorityCandidates?.[0];
  assert.deepEqual(next?.scope, ['saved-views-v148.js']);
  assert.match(next?.goal || '', /Ver\.335/);
  assert.match(next?.precondition || '', /Ver\.334/);
});
