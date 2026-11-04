import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const PASTELS=['pastel-blue','pastel-lilac','pastel-mint','pastel-rose','pastel-peach','pastel-lemon'];
function contrast(first,second) {
  const luminance = hex => [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
    .map(c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4))
    .reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
  const a=luminance(first),b=luminance(second);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

test('Ver.340 recurrence generation does not require or assign a deadline',()=>{
  const app=read('app.js'),html=read('index.html');
  assert.doesNotMatch(app,/繰り返しを設定するには期限日を入力してください/);
  assert.match(app,/function nextRecurringChild\(parent\)/);
  assert.match(app,/getRecurringDates\(parent.recurrence, rule, afterDate, 1\)/);
  assert.match(app,/dueDate: "", \/\/ The independent deadline is not auto-populated/);
  assert.match(app,/dueTime: ""/);
  assert.match(app,/recurrenceRule: \{ \.\.\.rule, seriesId: rule.seriesId \|\| parent.id, occurrenceDate: repeatDate \}/);
  assert.match(app,/if \(child && \(child.recurringParentId !== original.id/);
  assert.doesNotMatch(app,/function maybeCreateNextRecurringTask\(/);
  assert.doesNotMatch(app,/function getRecurringDueDates\(/);
  assert.doesNotMatch(app,/applyRecurrenceDefaultsFromDueDate/);
  assert.match(html,/id="taskRecurrenceAnchorDate"/);
  assert.match(html,/期限日とは独立しており、期限日なしでも設定できます/);
  assert.match(app,/function getRecurringDates\(recurrence, rule = \{\}, afterDate = todayISO\(\), count = 1\)/);
});

test('Ver.340 six pastel light palettes have usable text contrast',()=>{
  const css=read('color-themes-v329.css'),js=read('color-themes-v329.js');
  for(const id of PASTELS){
    assert.equal(js.split("id: '"+id+"'").length-1,1,id+' JS owner');
    assert.match(js,new RegExp("id: '"+id+"', label: '[^']+', group: 'pastel'"));
    const matched=css.match(new RegExp(':root\\[data-wb-color-theme="'+id+'"\\][^\\{]*\\{([^}]+)\\}'));
    assert.ok(matched,id+' CSS owner');
    const value=name=>matched[1].match(new RegExp('--wb-theme-'+name+':(#[0-9a-fA-F]{6});'))?.[1];
    for(const name of ['page','surface','surface-soft','sidebar-a','sidebar-b','sidebar-c',
      'hero-a','hero-b','ink','muted','accent','highlight-ink','highlight-a','highlight-b','line']) {
      assert.ok(value(name),id+' missing '+name);
    }
    for(const surface of ['sidebar-a','sidebar-c','hero-a','hero-b']){
      assert.ok(contrast(value('ink'),value(surface))>=4.5,id+' '+surface+' contrast');
    }
    assert.ok(contrast(value('muted'),value('page'))>=4.5,id+' muted contrast');
    assert.ok(contrast(value('highlight-ink'),value('highlight-b'))>=4.5,id+' action contrast');
  }
  assert.match(js,/\['pastel','パステルテーマ'\]/);
  assert.match(js,/groups\.get\(theme\.group \|\| theme\.mode \|\| 'light'\)/);
  assert.match(css,/data-wb-color-theme\^="pastel-".*\.hero/);
  assert.match(css,/color:var\(--wb-theme-ink\) !important;/);
  assert.match(js,/const STORAGE_PREFIX = 'workBoardColorThemeV329:'/);
});

test('Ver.340 version and handoff are synchronized',()=>{
  const manifest=read('release-manifest.js'),html=read('index.html');
  assert.match(manifest,/version: "340"/);
  assert.match(html,/app\.js\?v=340/);
  assert.equal(JSON.parse(read('patch-responsibilities.json')).baselineRelease,'340');
});
