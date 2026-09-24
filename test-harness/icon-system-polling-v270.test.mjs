import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [icons, index, workFeatures, manifest, responsibilities] = await Promise.all([
  read('icon-system-v169.js'),
  read('index.html'),
  read('work-features-v167.js'),
  read('release-manifest.js'),
  read('patch-responsibilities.json')
]);

test('Ver.271 product: icon system applies exactly once without finite polling', () => {
  const start = icons.match(/function start\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(start.length > 0);
  assert.match(start, /applyIcons\(\);/);
  assert.doesNotMatch(icons, /setInterval\(/);
  assert.doesNotMatch(icons, /clearInterval\(/);
  assert.doesNotMatch(icons, /attempts\s*[+<>=]/);
});

test('Ver.271 product: core nav and summary icon targets remain static HTML contracts', () => {
  for (const layout of ['today', 'todos', 'tasks', 'schedule']) {
    assert.match(index, new RegExp(`data-layout="${layout}"[\\s\\S]*?<img`));
  }
  for (const filter of ['mine', 'favorite', 'done']) {
    assert.match(index, new RegExp(`data-filter="${filter}"[\\s\\S]*?<img`));
  }
  for (const id of ['openCount', 'overdueCount', 'todayCount', 'myCount']) {
    assert.match(index, new RegExp(`summary-icon[\\s\\S]*?id="${id}"`));
  }
});

test('Ver.271 product: work memo navigation is created before icon-system loader runs', () => {
  assert.match(workFeatures, /function createMemoNav\(\)/);
  const init = workFeatures.match(/async function init\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(init.length > 0);
  assert.match(init, /createMemoNav\(\);/);
  const scripts = manifest.match(/dynamicScripts:\s*\[([^\]]+)\]/)?.[1] || '';
  const workIndex = scripts.indexOf('work-features-v167.js');
  const iconIndex = scripts.indexOf('icon-system-v169.js');
  assert.ok(workIndex >= 0 && iconIndex >= 0 && workIndex < iconIndex);
});

test('Ver.271 product: runtime change publishes release 258 and responsibility baseline matches', () => {
  assert.match(manifest, /const VERSION = '258'/);
  assert.match(manifest, /version:\s*"258"/);
  const ledger = JSON.parse(responsibilities);
  assert.equal(ledger.baselineRelease, '258');
  assert.match(ledger.groups.find(group => group.id === 'icon-system')?.reason || '', /Ver\.271/);
  assert.match(ledger.priorityCandidates?.[0]?.goal || '', /Ver\.272/);
});
