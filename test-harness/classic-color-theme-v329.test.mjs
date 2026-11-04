import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const css = read('color-themes-v329.css');
const js = read('color-themes-v329.js');
const manifest = read('release-manifest.js');
const html = read('index.html');
const themes = ['default','sky','lavender','mint','rose','peach','amber','slate','pastel-blue','pastel-lilac','pastel-mint','pastel-rose','pastel-peach','pastel-lemon','night-navy','night-charcoal','night-forest','night-plum','night-mocha'];

test('Classic palette assets are loaded last and registered once', () => {
  const extract = key => [...manifest.match(new RegExp(key + ':\\s*\\[([\\s\\S]*?)\\]', 'm'))?.[1].matchAll(/"([^"]+)"/g) || []].map(x => x[1]);
  const styles = extract('dynamicStyles');
  const scripts = extract('dynamicScripts');
  const required = extract('requiredAssets');
  assert.ok(styles.indexOf('color-themes-v329.css') < styles.indexOf('ui-motion-v533.css'));
  assert.equal(styles.at(-1), 'ui-mobile-shell-v234.css');
  assert.equal(scripts.at(-1), 'color-themes-v329.js');
  for (const asset of ['color-themes-v329.css','color-themes-v329.js']) {
    assert.equal(required.filter(x => x === asset).length,1);
  }
  assert.match(manifest,/version:\s*"345"/);
  assert.match(html,/style\.css\?v=345/);
  assert.match(html,/app\.js\?v=345/);
});

test('Color themes are entirely visual and preserve Classic data semantics', () => {
  for (const key of themes) {
    assert.match(js,new RegExp("id: '" + key + "'"));
    assert.match(css,new RegExp('data-theme="' + key + '"'));
  }
  assert.match(css,/\.task-card:not\(\.overdue\)/);
  assert.doesNotMatch(css,/\.priority-緊急\s*\{/);
  assert.doesNotMatch(css,/^\s*\.status-完了\s*\{/m);
  assert.match(js,/const STORAGE_PREFIX = 'workBoardColorThemeV329:'/);
  assert.match(js,/localStorage\.setItem\(scopeKey\(\), id\)/);
  assert.doesNotMatch(js.replace(/\/\*[\s\S]*?\*\//g, ''),/firebase|runTransaction|fetch\(|XMLHttpRequest|indexedDB/i);
  assert.match(html,/data-task-layout="timeline"/);
  assert.match(html,/data-task-layout="board"/);
});

test('Inventory tracks the complete CSS+JS owner without replacing other patches', () => {
  const inv = JSON.parse(read('patch-responsibilities.json'));
  assert.equal(inv.baselineRelease,'345');
  const group=inv.groups.find(x=>x.id==='classic-color-theme');
  assert.deepEqual(group.assets,['color-themes-v329.css','color-themes-v329.js']);
  assert.equal(inv.groups.filter(x=>x.id==='classic-color-theme').length,1);
});
