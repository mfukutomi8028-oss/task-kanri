import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sidebar = readFileSync('desktop-sidebar-v242.js', 'utf8');
const workFeatures = readFileSync('work-features-v167.js', 'utf8');
const index = readFileSync('index.html', 'utf8');
const css = readFileSync('ui-sidebar-v180.css', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const product = readFileSync('SIDEBAR_SEMANTIC_TAKEOVER_PRODUCT_V318.md', 'utf8');
const browser = readFileSync('tests/sidebar-semantic-takeover-v318.spec.mjs', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.318 advances product release and responsibility baseline to 279', () => {
  assert.equal(release, 279);
  assert.equal(String(responsibilities.baselineRelease), '279');
  assert.match(product, /Release and responsibility baseline advance from 278 to 279/);
});

test('Ver.318 retires the V158 startup semantic takeover from the active runtime', () => {
  assert.doesNotMatch(sidebar, /function labelNavigationButtons\(\)/);
  assert.doesNotMatch(sidebar, /desktopSidebarLabel/);
  assert.doesNotMatch(sidebar, /setAttribute\("aria-label", label\)/);
  assert.doesNotMatch(sidebar, /button\.title = label/);
  assert.match(sidebar, /ensurePinButton\(\);\s*bindEvents\(\);\s*applyState\(\);/s);
});

test('Ver.318 static and dynamic navigation retain native visible-text semantic ownership', () => {
  for (const [layout, label] of [
    ['today', '今日'],
    ['todos', 'ToDo'],
    ['tasks', 'タスク'],
    ['schedule', 'スケジュール']
  ]) {
    assert.match(index, new RegExp(`data-layout=["']${layout}["'][\\s\\S]{0,500}${label}`));
  }

  assert.match(workFeatures, /button\.className = 'nav-item work-memo-nav-v167'/);
  assert.match(workFeatures, /button\.innerHTML = `<span class="nav-icon"><img[^`]+<\/span>業務メモ`/);
  assert.doesNotMatch(workFeatures, /desktopSidebarLabel/);
  assert.doesNotMatch(css, /data-desktop-sidebar-label/);
});

test('Ver.318 product browser regression covers semantics, interaction, and the exact responsive boundary', () => {
  assert.match(browser, /getByRole\('button', \{ name: '今日', exact: true \}\)/);
  assert.match(browser, /getByRole\('button', \{ name: '業務メモ', exact: true \}\)/);
  assert.match(browser, /expectNoGeneratedSemantics/);
  assert.match(browser, /861/);
  assert.match(browser, /860/);
  assert.match(browser, /data-desktop-sidebar-state/);
  assert.doesNotMatch(browser, /suppressSemanticTakeover/);
});
