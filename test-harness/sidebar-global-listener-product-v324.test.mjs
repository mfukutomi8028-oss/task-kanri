import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.324 product scopes desktop sidebar document listeners to expanded unpinned desktop state', () => {
  const source = read('desktop-sidebar-v242.js');

  assert.match(source, /let documentLifecycleBound = false;/);
  assert.match(source, /function syncDocumentLifecycle\(\)/);
  assert.match(source, /media\.matches && !pinned && expanded/);
  assert.match(source, /document\.addEventListener\("keydown", handleDocumentKeydown\)/);
  assert.match(source, /document\.addEventListener\("dragend", handleDocumentDragEnd, true\)/);
  assert.match(source, /document\.addEventListener\("drop", handleDocumentDrop, true\)/);
  assert.match(source, /document\.removeEventListener\("keydown", handleDocumentKeydown\)/);
  assert.match(source, /document\.removeEventListener\("dragend", handleDocumentDragEnd, true\)/);
  assert.match(source, /document\.removeEventListener\("drop", handleDocumentDrop, true\)/);
  assert.doesNotMatch(source, /document\.addEventListener\("keydown",\s*event\s*=>/,
    'the old unconditional anonymous Escape owner must stay retired');
  assert.doesNotMatch(source, /document\.addEventListener\("dragend",\s*\(\)\s*=>/,
    'the old unconditional dragend owner must stay retired');
  assert.doesNotMatch(source, /document\.addEventListener\("drop",\s*\(\)\s*=>/,
    'the old unconditional drop owner must stay retired');
});

test('Ver.324 keeps applyState as the lifecycle convergence boundary', () => {
  const source = read('desktop-sidebar-v242.js');
  const apply = source.match(/function applyState\(\) \{([\s\S]*?)\n  \}\n\n  function setExpanded/)?.[1] || '';

  assert.match(apply, /syncDocumentLifecycle\(\)/);
  assert.match(source, /function setExpanded[\s\S]*?applyState\(\)/);
  assert.match(source, /function setPinned[\s\S]*?applyState\(\)/);
  assert.match(source, /function onMediaChange[\s\S]*?applyState\(\)/);
  assert.match(source, /window\.addEventListener\("pageshow", applyState\)/);
});

test('Ver.323 audit remains durable evidence for the Ver.324 product decision', () => {
  const audit = read('SIDEBAR_GLOBAL_LISTENER_AUDIT_V323.md');
  const browser = read('tests/sidebar-global-listener-product-v324.spec.mjs');

  assert.match(audit, /media\.matches && !pinned && expanded/);
  assert.match(audit, /861 -> 860/);
  assert.match(browser, /collapsed desktop and mobile own no sidebar document listeners/);
  assert.match(browser, /keyboard expansion owns listeners only until Escape collapse/);
  assert.match(browser, /drag reveal retains cleanup through dragend then releases listeners/);
  assert.match(browser, /pinning and desktop boundary release transient ownership without accumulation/);
});
