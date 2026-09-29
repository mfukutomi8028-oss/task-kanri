import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const sidebar = readFileSync('desktop-sidebar-v242.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('SIDEBAR_GLOBAL_LISTENER_AUDIT_V323.md', 'utf8');
const product = readFileSync('SIDEBAR_GLOBAL_LISTENER_PRODUCT_V324.md', 'utf8');
const browser = readFileSync('tests/sidebar-global-listener-lifecycle-v324.spec.mjs', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.324 remains published at release and responsibility baseline 280 or later', () => {
  assert.ok(release >= 280);
  assert.equal(String(responsibilities.baselineRelease), String(release));
  assert.match(product, /Release and responsibility baseline advance from 279 to 280/);
});

test('Ver.324 scopes the three desktop document listeners to expanded unpinned desktop state', () => {
  assert.match(sidebar, /let documentLifecycleBoundV324 = false/);
  assert.match(sidebar, /function syncDocumentLifecycleV324\(\)/);
  assert.match(sidebar, /Boolean\(media\.matches && !pinned && expanded\)/);
  assert.match(sidebar, /document\.addEventListener\("keydown", handleDocumentKeydownV324\)/);
  assert.match(sidebar, /document\.addEventListener\("dragend", handleDocumentDragEndV324, true\)/);
  assert.match(sidebar, /document\.addEventListener\("drop", handleDocumentDropV324, true\)/);
  assert.match(sidebar, /document\.removeEventListener\("keydown", handleDocumentKeydownV324\)/);
  assert.match(sidebar, /document\.removeEventListener\("dragend", handleDocumentDragEndV324, true\)/);
  assert.match(sidebar, /document\.removeEventListener\("drop", handleDocumentDropV324, true\)/);
  assert.match(sidebar, /if \(!body\) return;\s*syncDocumentLifecycleV324\(\);/s);

  assert.doesNotMatch(sidebar, /document\.addEventListener\("keydown", event =>/);
  assert.doesNotMatch(sidebar, /document\.addEventListener\("dragend", \(\) =>/);
  assert.doesNotMatch(sidebar, /document\.addEventListener\("drop", \(\) =>/);
});

test('Ver.324 preserves Ver.323 evidence and records the promoted responsive boundary', () => {
  assert.match(audit, /Ver\.323/);
  assert.match(audit, /keydown/);
  assert.match(audit, /dragend/);
  assert.match(audit, /drop/);
  assert.equal(existsSync('tests/sidebar-global-listener-audit-v323.spec.mjs'), false,
    'superseded injected Ver.323 browser audit must stay retired after product promotion');

  const responsive = responsibilities.groups.find(group => group.id === 'responsive-sidebar-toolbar');
  assert.ok(responsive, 'responsive sidebar responsibility group must remain present');
  assert.match(responsive.reason, /Ver\.323監査/);
  assert.match(responsive.reason, /Ver\.324製品/);
  assert.match(responsive.reason, /release 280/);
});

test('Ver.324 browser regression measures the named product lifecycle without source replacement', () => {
  assert.match(browser, /handleDocumentKeydownV324/);
  assert.match(browser, /handleDocumentDragEndV324/);
  assert.match(browser, /handleDocumentDropV324/);
  assert.match(browser, /861 to 860/);
  assert.match(browser, /mobile cold boot/);
  assert.match(browser, /documentLifecycle|SIDEBAR_V324|active/);
  assert.doesNotMatch(browser, /route\([^\n]*desktop-sidebar-v242/);
});
