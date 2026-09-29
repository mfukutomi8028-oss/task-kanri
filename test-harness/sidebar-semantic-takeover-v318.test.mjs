import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './user-reported-stability-v319.test.mjs';
import './task-dialog-ui-v320.test.mjs';
import './task-dialog-polish-v321.test.mjs';

const sidebar = readFileSync('desktop-sidebar-v242.js', 'utf8');
const workFeatures = readFileSync('work-features-v167.js', 'utf8');
const index = readFileSync('index.html', 'utf8');
const css = readFileSync('ui-sidebar-v180.css', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const product = readFileSync('SIDEBAR_SEMANTIC_TAKEOVER_PRODUCT_V318.md', 'utf8');
const browser = readFileSync('tests/sidebar-semantic-takeover-v318.spec.mjs', 'utf8');
const listenerProduct = readFileSync('SIDEBAR_GLOBAL_LISTENER_PRODUCT_V324.md', 'utf8');
const listenerBrowser = readFileSync('tests/sidebar-global-listener-audit-v323.spec.mjs', 'utf8');
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

test('Ver.324 product keeps document keydown dragend and drop behind the expanded unpinned desktop lifecycle', () => {
  assert.match(sidebar, /let documentLifecycleBoundV324 = false/);
  assert.match(sidebar, /const shouldBind = Boolean\(media\.matches && !pinned && expanded\)/);
  assert.match(sidebar, /document\.addEventListener\("keydown", handleDocumentKeydownV324\)/);
  assert.match(sidebar, /document\.addEventListener\("dragend", handleDocumentDragEndV324, true\)/);
  assert.match(sidebar, /document\.addEventListener\("drop", handleDocumentDropV324, true\)/);
  assert.match(sidebar, /document\.removeEventListener\("keydown", handleDocumentKeydownV324\)/);
  assert.match(sidebar, /document\.removeEventListener\("dragend", handleDocumentDragEndV324, true\)/);
  assert.match(sidebar, /document\.removeEventListener\("drop", handleDocumentDropV324, true\)/);
  assert.doesNotMatch(sidebar, /document\.addEventListener\("keydown", event =>/);
  assert.doesNotMatch(sidebar, /document\.addEventListener\("dragend", \(\) =>/);
  assert.doesNotMatch(sidebar, /document\.addEventListener\("drop", \(\) =>/);
});

test('Ver.324 state transitions synchronize listener ownership through applyState without changing Release 279', () => {
  assert.match(sidebar, /body\.removeAttribute\("data-desktop-sidebar-state"\);\s*syncDocumentLifecycleV324\(\);\s*return;/s);
  assert.match(sidebar, /body\.dataset\.desktopSidebarState = pinned \? "pinned" : \(expanded \? "expanded" : "collapsed"\);[\s\S]{0,200}syncDocumentLifecycleV324\(\);/);
  assert.equal(release, 279);
  assert.equal(String(responsibilities.baselineRelease), '279');
  assert.match(listenerProduct, /scoped maintenance change inside the existing Release 279 asset set/);
});

test('Ver.324 browser regression measures product runtime lifecycle without an injected candidate', () => {
  assert.match(listenerBrowser, /Ver\.324 product: collapsed desktop owns no document keydown\/drag lifecycle/);
  assert.match(listenerBrowser, /Ver\.324 product: keyboard expansion binds once and Escape collapses then releases ownership/);
  assert.match(listenerBrowser, /Ver\.324 product: drag reveal retains cleanup until dragend then releases all three listeners/);
  assert.match(listenerBrowser, /Ver\.324 product: pinning and 861 to 860 transition release transient ownership/);
  assert.doesNotMatch(listenerBrowser, /page\.route\(\/\\\/desktop-sidebar-v242/);
  assert.doesNotMatch(listenerBrowser, /mode = 'candidate'/);
});
