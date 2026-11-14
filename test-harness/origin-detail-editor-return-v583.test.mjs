import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync('origin-modern-v372.js','utf8');

test('Origin detail editing offers a return path for every existing record kind',()=>{
  assert.match(source,/const detailReturn=edit&&id&&panelOpen&&panelMode==='detail'/);
  assert.match(source,/panelKind===kind&&panelId===id/);
  assert.match(source,/originDetailEditReturn=detailReturn/);
  assert.match(source,/originDetailEditReturn\?\.kind===kind&&originDetailEditReturn\?\.id===id/);
  assert.match(source,/function returnOriginEditorToDetail\(\)/);
  assert.match(source,/\['tasks','todos','events','memos'\]\.includes\(kind\)/);
});
test('Origin detail return keeps existing guard, scroll and focus and avoids canonical writes',()=>{
  assert.match(source,/if\(!closePanel\(false,false\)\)return false;/);
  assert.match(source,/body\.scrollTop=state\.scrollTop/);
  assert.match(source,/\#sheet \.origin-sheet-primary \[data-action="edit"\]/);
  assert.match(source,/if\(originTaskScheduleSource&&kind==='events'\)return closePanel\(\)/);
  assert.doesNotMatch(source,/originDetailEditReturn.*localStorage\.setItem/);
});
