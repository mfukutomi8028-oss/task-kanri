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
  assert.match(release,/version: "330"/);
});
test('Mode and storage use the existing Classic settings owner, without a second writer',()=>{
  assert.match(js,/root\.dataset\.wbColorMode = selected\.mode === 'dark' \? 'dark' : 'light'/);
  assert.match(js,/const STORAGE_PREFIX = 'workBoardColorThemeV329:'/);
  assert.match(js,/const groups = new Map\(\)/);
  assert.match(css,/html\[data-wb-color-mode="dark"\] \.work-mobile-header/);
  assert.match(css,/html\[data-wb-color-mode="dark"\] \.task-card\.overdue/);
  assert.doesNotMatch(css,/\.status-完了\s*\{/);
  assert.doesNotMatch(css,/\.priority-緊急\s*\{/);
  const code=js.replace(/\/\*[\s\S]*?\*\//g,'');
  assert.doesNotMatch(code,/runTransaction|firebase|XMLHttpRequest|indexedDB|fetch\(/i);
  assert.equal(js.split('function selectTheme(').length-1,1);
});
