import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path,import.meta.url),'utf8');
const css=read('color-themes-v329.css');
const js=read('color-themes-v329.js');
const release=read('release-manifest.js');
const themes=['night-navy','night-charcoal','night-forest','night-plum','night-mocha'];

function luminance(hex){
  const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4));
  return c[0]*.2126+c[1]*.7152+c[2]*.0722;
}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
test('5 dark palettes are defined once, readable, and keep 8 existing palettes',()=>{
  for(const id of themes){
    assert.equal(js.split("id: '"+id+"'").length-1,1,id);
    assert.match(js,new RegExp("id: '"+id+"', label: '[^']+', mode: 'dark'"));
    const pattern=new RegExp(':root\\[data-wb-color-theme="'+id+'"\\][^\\{]*\\{([\\s\\S]*?)\\}');
    const body=css.match(pattern)?.[1];
    assert.ok(body,'missing palette '+id);
    const token=key=>body.match(new RegExp('--wb-theme-'+key+':(#[0-9a-fA-F]{6});'))?.[1];
    for(const key of ['page','surface','surface-soft','ink','muted','accent','highlight-ink','highlight-a','highlight-b'])assert.ok(token(key),key+' missing on '+id);
    assert.ok(contrast(token('ink'),token('surface'))>=7,'ink contrast on '+id);
    assert.ok(contrast(token('muted'),token('surface'))>=4.5,'muted contrast on '+id);
    assert.ok(contrast(token('accent'),token('surface'))>=4.5,'accent contrast on '+id);
    assert.ok(contrast(token('highlight-ink'),token('highlight-b'))>=4.5,'button contrast on '+id);
  }
  assert.equal((js.match(/id: '(?:default|sky|lavender|mint|rose|peach|amber|slate)'/g)||[]).length,8);
  assert.match(release,/version: "340"/);
});
test('Dark palette controller uses one existing storage mechanism',()=>{
  assert.match(js,/root\.dataset\.wbColorMode = selected\.mode === 'dark' \? 'dark' : 'light'/);
  assert.match(js,/const STORAGE_PREFIX = 'workBoardColorThemeV329:'/);
  assert.equal(js.split('function selectTheme(').length-1,1);
  const code=js.replace(/\/\*[\s\S]*?\*\//g,'');
  assert.doesNotMatch(code,/runTransaction|firebase|XMLHttpRequest|indexedDB|fetch\(/i);
});
test('Ver.332 replaces old dark CSS rather than stacking patches',()=>{
  assert.equal(css.split('Ver.332: one coherent Classic dark-mode design.').length-1,1);
  for(const obsolete of ['Ver.331: coherent dark surfaces','Dark readability completion','Ver.331: Classic dark-mode surface/contrast audit.']){
    assert.doesNotMatch(css,new RegExp(obsolete));
  }
  assert.match(css,/--wb-dark-canvas:var\(--wb-theme-page\)/);
  assert.match(css,/--wb-dark-raised:var\(--wb-theme-surface-soft\)/);
  assert.match(css,/--wb-dark-ink:var\(--wb-theme-ink\)/);
  for(const name of [
    '.task-control-row','.bulk-bar','.user-badge.group-badge',
    '.task-view-button.active','#listView .list-column-sort-status',
    '.dashboard-head','.dashboard-kpi','.attention-item',
    '.workflow-inbox-item-v152','.today-reminders-v152',
    '.today-reminders-head-v152 h4','.workflow-archive-modal-v153',
    '.schedule-copy-preview','.task-comment-compose-v149',
    '.calendar-weekdays','.schedule-day h4','.todo-workspace .todo-item',
    '.work-memo-body-v167','.work-memo-search-v167',
    '.task-table tbody tr.priority-row.overdue'
  ])assert.ok(css.includes(name),'missing dark component: '+name);
  assert.doesNotMatch(css,/\.priority-緊急\s*\{/);
  assert.doesNotMatch(css,/\.status-完了\s*\{/);
  assert.equal(JSON.parse(read('patch-responsibilities.json')).baselineRelease,'340');
});
