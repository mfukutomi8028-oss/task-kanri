import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [icons, index, workFeatures, manifest] = await Promise.all([
  read('icon-system-v169.js'),
  read('index.html'),
  read('work-features-v167.js'),
  read('release-manifest.js')
]);

test('Ver.270 audit: icon system applies once then polls every 250ms up to 24 times', () => {
  assert.match(icons, /applyIcons\(\);\s*let attempts = 0;/);
  assert.match(icons, /window\.setInterval\(\(\) => \{/);
  assert.match(icons, /attempts >= 24/);
  assert.match(icons, /\}, 250\);/);
});

test('Ver.270 audit: core nav and summary icon targets already exist in static HTML', () => {
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

test('Ver.270 audit: work memo navigation is created synchronously by work-features init', () => {
  assert.match(workFeatures, /function createMemoNav\(\)/);
  const init = workFeatures.match(/async function init\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(init.length > 0);
  assert.match(init, /createMemoNav\(\);/);
});

test('Ver.270 audit: loader order places work-features before icon-system', () => {
  const scripts = manifest.match(/dynamicScripts:\s*\[([^\]]+)\]/)?.[1] || '';
  const workIndex = scripts.indexOf('work-features-v167.js');
  const iconIndex = scripts.indexOf('icon-system-v169.js');
  assert.ok(workIndex >= 0 && iconIndex >= 0 && workIndex < iconIndex);
});
