import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const obsolete=[
  'palette-display-v358.css','palette-display-v358.js',
  'palette-next-v369.css','palette-next-v369.js',
  'test-harness/palette-next-v369.test.mjs',
  'tests/palette-display-v358.spec.mjs',
  'tests/palette-next-v369.spec.mjs',
  'tests/startup-palette-lazy-v456.spec.mjs'
];

test('retired Palette presentation and dedicated tests are physically absent',()=>{
  for(const asset of obsolete)
    assert.equal(fs.existsSync(path.join(root,asset)),false,'obsolete file: '+asset);
});

test('only Classic, Origin and JOURNAL can be selected or booted',()=>{
  const manifest=read('release-manifest.js');
  const controller=read('modern-display-v356.js');
  const css=read('modern-display-v356.css');
  assert.match(manifest,/validModes = new Set\(\['classic','modern','journal'\]\)/);
  assert.match(controller,/new Set\(\['classic', 'modern', 'journal'\]\)/);
  assert.doesNotMatch(controller,/loadPaletteNext|palette-display-v358|palette-next-v369|\['palette', 'Palette'/);
  assert.doesNotMatch(manifest,/palette-display-v358|palette-next-v369|palette:\s*\{/);
  assert.doesNotMatch(css,/wbPaletteNextPreview|wb-palette-preview-link|data-wb-palette-next-preview/);
  assert.match(controller,/3つの画面/);
  assert.match(manifest,/return validModes\.has\(mode\) \? mode : 'classic'/);
});

test('shared canonical task and memo adapters survive removal under neutral names',()=>{
  const app=read('app.js');
  const memos=read('work-features-v167.js');
  const origin=read('origin-modern-v372.js');
  const journal=read('journal-display-v367.js');
  const comments=read('comment-reactions-v191.js');
  assert.match(app,/window\.WorkBoardSharedBridge = Object\.freeze\(\{/);
  assert.match(memos,/window\.WorkBoardSharedMemoBridge = Object\.freeze\(\{/);
  assert.match(origin,/window\.WorkBoardSharedBridge/);
  assert.match(origin,/window\.WorkBoardSharedMemoBridge/);
  assert.match(journal,/window\.WorkBoardSharedBridge/);
  assert.match(comments,/window\.WorkBoardSharedBridge/);
  for(const source of [app,memos,origin,journal,comments])
    assert.doesNotMatch(source,/WorkBoardPaletteBridge|WorkBoardPaletteMemoBridgeV369/);
  assert.match(app,/readSnapshot:\s*sharedSnapshot/);
  assert.match(memos,/readSnapshot:\s*sharedMemoSnapshot/);
});

test('deploy and patch inventories contain no retired runtime assets',()=>{
  const manifest=read('release-manifest.js');
  const index=read('index.html');
  const inventory=JSON.parse(read('patch-responsibilities.json'));
  assert.equal(inventory.baselineRelease,manifest.match(/version:\s*"(\d+)"/)?.[1]);
  assert.equal(manifest.match(/version:\s*"(\d+)"/)?.[1],'575');
  assert.match(index,/release-manifest\.js\?v=575/);
  for(const asset of obsolete.slice(0,4)){
    assert.ok(!manifest.includes(asset),'retired asset still in manifest: '+asset);
  }
  assert.equal(inventory.groups.some(group=>group.id==='palette-display'),false);
  assert.equal(inventory.priorityCandidates?.some(item=>item.scope?.some(asset=>asset.startsWith('palette-')))||false,false);
});
