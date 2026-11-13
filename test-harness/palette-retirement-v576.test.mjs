import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../'+name, import.meta.url),'utf8');
const deleted = [
  'palette-display-v358.css','palette-display-v358.js',
  'palette-next-v369.css','palette-next-v369.js',
  'test-harness/palette-next-v369.test.mjs',
  'tests/palette-display-v358.spec.mjs','tests/palette-next-v369.spec.mjs',
  'tests/startup-palette-lazy-v456.spec.mjs'
];

test('retired Palette screen and its tests are physically absent',()=>{
  for(const path of deleted)
    assert.equal(existsSync(new URL('../'+path, import.meta.url)),false,path+' must be removed');
});

test('three selectable views remain and legacy Palette preferences become Classic',()=>{
  const modes=read('modern-display-v356.js');
  const manifest=read('release-manifest.js');
  for(const code of [modes,manifest])
    assert.match(code,/new Set\(\['classic',\s*'modern',\s*'journal'\]\)/);
  assert.doesNotMatch(modes,/\['palette',\s*'Palette'/);
  assert.doesNotMatch(modes,/loadPaletteNext|paletteNextRoot|palette-next-v369/);
  assert.match(modes,/buttons\.forEach/);
  assert.match(manifest,/root\.dataset\.wbDisplay = savedMode\(\)/);
  assert.doesNotMatch(manifest,/if \(mode === 'palette'\)/);
  assert.doesNotMatch(manifest,/palette-display-v358|palette-next-v369|deferredDisplayAssets:[\s\S]*palette:/);
});

test('Origin and JOURNAL still share the canonical business adapters',()=>{
  const app=read('app.js');
  const origin=read('origin-modern-v372.js');
  const journal=read('journal-display-v367.js');
  assert.match(app,/window\.WorkBoardPaletteBridge = Object\.freeze/);
  assert.match(origin,/WorkBoardPaletteMemoBridgeV369/);
  assert.match(origin,/WorkBoardPaletteBridge/);
  assert.match(journal,/WorkBoardPaletteBridge/);
});

test('retired Palette assets and tests are absent from CI and release ownership',()=>{
  const scope=read('test-harness/ci-scope-v590.mjs');
  const inventory=read('patch-responsibilities.json');
  const style=read('modern-display-v356.css');
  assert.doesNotMatch(scope,/const PALETTE = \[/);
  assert.doesNotMatch(inventory,/"id": "palette-display"/);
  assert.doesNotMatch(style,/#wbPaletteNextPreviewV369/);
});
