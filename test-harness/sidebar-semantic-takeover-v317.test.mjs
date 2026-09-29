import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sidebar = readFileSync('desktop-sidebar-v242.js', 'utf8');
const workFeatures = readFileSync('work-features-v167.js', 'utf8');
const index = readFileSync('index.html', 'utf8');
const css = readFileSync('ui-sidebar-v180.css', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('SIDEBAR_SEMANTIC_TAKEOVER_AUDIT_V317.md', 'utf8');
const browser = readFileSync('tests/sidebar-semantic-takeover-v317.spec.mjs', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.317 audit keeps product runtime unchanged at the current release baseline', () => {
  assert.ok(release >= 278);
  assert.equal(String(responsibilities.baselineRelease), String(release));
  assert.match(audit, /Product runtime is not changed in this audit/);
  assert.match(audit, /desktop-sidebar-v242\.js` is unchanged in Ver\.317/);
  assert.match(audit, /work-features-v167\.js` is unchanged in Ver\.317/);
});

test('Ver.317 identifies the V158 startup semantic takeover exactly', () => {
  assert.match(sidebar, /function labelNavigationButtons\(\) \{/);
  assert.match(sidebar, /button\.dataset\.desktopSidebarLabel = label/);
  assert.match(sidebar, /if \(!button\.hasAttribute\("title"\)\) button\.title = label/);
  assert.match(sidebar, /if \(!button\.hasAttribute\("aria-label"\)\) button\.setAttribute\("aria-label", label\)/);
  assert.match(sidebar, /ensurePinButton\(\);\s*labelNavigationButtons\(\);\s*bindEvents\(\);/s);
});

test('Ver.317 static and dynamic navigation already own visible text labels', () => {
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
});

test('Ver.317 desktop-only generated dataset has no active sidebar CSS consumer', () => {
  assert.doesNotMatch(css, /data-desktop-sidebar-label/);
});

test('Ver.317 browser audit suppresses only labelNavigationButtons startup ownership', () => {
  assert.match(browser, /desktop-sidebar-v242\\\.js/);
  assert.match(browser, /labelNavigationButtons\(\);\\n    bindEvents\(\);/);
  assert.match(browser, /getByRole\('button', \{ name: '今日', exact: true \}\)/);
  assert.match(browser, /getByRole\('button', \{ name: '業務メモ', exact: true \}\)/);
  assert.match(browser, /861/);
  assert.match(browser, /860/);
  assert.match(browser, /data-desktop-sidebar-state/);
});
