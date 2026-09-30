import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.324 product publishes the scoped sidebar lifecycle on release 280 or later', () => {
  const manifest = read('release-manifest.js');
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*"(\d+)"/)?.[1];

  assert.ok(Number(release) >= 280, 'Ver.324 must be cache-busted by release 280 or later');
  assert.equal(inventory.baselineRelease, release,
    'Ver.324 responsibility baseline must advance with the release');
});

test('Ver.324 product owns document listeners only while desktop sidebar is expanded and unpinned', () => {
  const source = read('desktop-sidebar-v242.js');

  assert.match(source, /let documentLifecycleBound = false;/);
  assert.match(source, /function syncDocumentLifecycle\(\)/);
  assert.match(source, /const shouldBind = Boolean\(media\.matches && !pinned && expanded\);/);
  assert.match(source, /function handleDocumentKeydown\(event\)/);
  assert.match(source, /function handleDocumentDragEnd\(\)/);
  assert.match(source, /function handleDocumentDrop\(\)/);

  for (const type of ['keydown', 'dragend', 'drop']) {
    assert.match(source, new RegExp(`document\\.addEventListener\\("${type}"`), `${type} must be lifecycle-bound`);
    assert.match(source, new RegExp(`document\\.removeEventListener\\("${type}"`), `${type} must be lifecycle-unbound`);
  }

  assert.match(source, /function applyState\(\)[\s\S]*?syncDocumentLifecycle\(\);/,
    'state application must synchronize document ownership before rendering desktop state');
  assert.doesNotMatch(source, /document\.addEventListener\("keydown",\s*event\s*=>/,
    'the old permanent anonymous keydown listener must stay retired');
  assert.doesNotMatch(source, /document\.addEventListener\("dragend",\s*\(\)\s*=>/,
    'the old permanent anonymous dragend listener must stay retired');
  assert.doesNotMatch(source, /document\.addEventListener\("drop",\s*\(\)\s*=>/,
    'the old permanent anonymous drop listener must stay retired');
});

test('Ver.324 keeps the Ver.323 audit evidence and product decision durable', () => {
  const audit = read('SIDEBAR_GLOBAL_LISTENER_AUDIT_V323.md');
  const product = read('SIDEBAR_GLOBAL_LISTENER_LIFECYCLE_PRODUCT_V324.md');

  assert.match(audit, /Ver\.323/);
  assert.match(audit, /keydown/);
  assert.match(audit, /dragend/);
  assert.match(audit, /drop/);
  assert.match(product, /Ver\.324/);
  assert.match(product, /expanded/);
  assert.match(product, /unpinned/);
  assert.match(product, /861/);
  assert.match(product, /860/);
});
