import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync('origin-modern-v372.js','utf8');
test('Origin mobile editor follows visual viewport while retaining canonical save',()=>{
 assert.match(source,/function syncOriginEditorViewport\(\)/);
 assert.match(source,/window\.visualViewport\?\.addEventListener\('resize',syncOriginEditorViewport\)/);
 assert.match(source,/window\.visualViewport\?\.addEventListener\('scroll',syncOriginEditorViewport\)/);
 assert.match(source,/Math\.max\(220,Math\.round\(height\)\)/);
 assert.match(source,/keepOriginEditorFieldVisible\(\)/);
 assert.match(source,/sheet\.dataset\.originKeyboard/);
 assert.match(source,/form="editForm"/);
 assert.match(source,/if\(!window\.confirm\('入力中の変更を破棄して閉じますか？'\)\)return false/);
});
test('Origin editor indicates modified records without saving drafts to storage',()=>{
 assert.match(source,/id="originDraftState"/);
 assert.match(source,/function updateOriginDraftState\(\)/);
 assert.match(source,/formSnapshot\(form\)!==initialFormSnapshot/);
 assert.match(source,/未保存の変更があります/);
 assert.match(source,/mount\.addEventListener\('focusin'/);
 assert.match(source,/updateOriginDraftState\(\)/);
 assert.doesNotMatch(source,/localStorage\.setItem|firebase\/database|runTransaction/);
});
