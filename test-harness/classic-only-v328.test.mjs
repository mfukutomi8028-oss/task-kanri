import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFileSync(path.join(root,file),'utf8');

test('Ver.328 Classic is the only shipped user interface',()=>{
  const app=read('app.js'),manifest=read('release-manifest.js');
  const builder=read('test-harness/build-pages-runtime-v382.mjs');
  assert.equal(existsSync(path.join(root,'modern')),false);
  assert.doesNotMatch(app,/installModern|modernProductionSession|modernClassicHandoff|WorkBoardModern|modernV593/i);
  assert.doesNotMatch(manifest,/modern\//i);
  assert.doesNotMatch(builder,/modernPilotAssets|modern\/layout\.css/);
  assert.doesNotMatch(read('index.html'),/modern\//i);
  assert.match(app,/function init\(\)/);
  assert.match(app,/function installDialogFallback\(\)/);
  assert.match(app,/function render\(\)/);
});

test('Ver.328 Classic keeps canonical task, ToDo, schedule and memo writers',()=>{
  const app=read('app.js'),memos=read('work-features-v167.js');
  assert.match(app,/async function applyBulkAction\(options = null\)/);
  assert.match(app,/planDeleteMutation\(deleteBases\.get\(original\.id\)/);
  assert.match(app,/async function toggleTodo\(/);
  assert.match(app,/async function saveTaskFromForm\(/);
  assert.match(memos,/function memoList\(/);
  assert.doesNotMatch(memos,/WorkBoardBusinessMemoActionsV563|WorkBoardModernProductionV580/);
  assert.doesNotMatch(read('bulk-actions-v243.js'),/commitModern/);
});
