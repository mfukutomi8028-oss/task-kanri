import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('JOURNAL desk actions do not override a newer focused control',()=>{
  const from=app.indexOf('function journalRefreshAtelierControlV516(');
  const to=app.indexOf('// JOURNAL V530: one transient',from);
  const desk=app.slice(from,to);
  const reset=app.slice(app.indexOf('const resetAtelierV520='),app.indexOf("root.querySelectorAll('[data-j420-reset-view]')"));
  assert.ok(from>0&&to>from);
  for(const owner of [desk,reset]){
    assert.match(owner,/current=document\.activeElement/);
    assert.match(owner,/current\.isConnected&&current!==target\)return/);
    assert.match(owner,/target\.focus\(\{preventScroll:true\}\)/);
  }
});

test('JOURNAL desk search checks current action and keeps selected text',()=>{
  const from=app.indexOf("const input=root.querySelector('[data-j420-search]')");
  const to=app.indexOf('// State is view-only, scoped to JOURNAL;',from);
  const search=app.slice(from,to);
  assert.ok(from>0&&to>from);
  assert.match(app,/let journalAtelierSearchFocusTokenV551=0/);
  assert.match(search,/const token=\+\+journalAtelierSearchFocusTokenV551/);
  assert.match(search,/token!==journalAtelierSearchFocusTokenV551/);
  assert.match(search,/state\.taskLayout!=='board'/);
  assert.match(search,/current\.isConnected/);
  assert.match(search,/current!==next/);
  assert.match(search,/const end=input\.selectionEnd\?\?start/);
  assert.match(search,/next\.setSelectionRange\(start,end,direction\)/);
  assert.match(search,/compositionstart/);
  assert.match(search,/compositionend/);
  assert.doesNotMatch(search,/(?:persistTask|runTransaction|setDoc|onValue)\s*\(/);
});
