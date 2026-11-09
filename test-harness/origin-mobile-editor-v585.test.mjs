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


test('Origin protects edits during asynchronous saving and reports invalid titles',()=>{
 assert.match(source,/function markOriginEditorSaving\(saving,command\)/);
 assert.match(source,/form\.inert=saving/);
 assert.match(source,/if\(!force&&panelMode==='edit'&&busy\)/);
 assert.match(source,/finally\{busy=false;if\(savingPanel\)markOriginEditorSaving\(false\)\}/);
 assert.match(source,/件名・タイトルを入力してください。/);
 assert.match(source,/id="originEditorError"/);
 assert.match(source,/originEditorInitialHeight-height>110/);
 assert.match(source,/updateOriginDraftState\(\);\s*return;\s*\}\s*if\(a==='new'\)/);
});
