import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Source-level regression guard; Playwright verifies computed geometry and
// visibility across paper colors and at the minimum resize dimensions.
const source=readFileSync(new URL('../origin-personal-sticky-v659.js',import.meta.url),'utf8');
function style(selector){
 const key=selector+'{';
 const start=source.indexOf(key);
 assert.notEqual(start,-1,'Missing expected sticky CSS selector: '+selector);
 return source.slice(start+key.length,source.indexOf('}',start));
}

test('Origin sticky color button is a compact round swatch in the footer',()=>{
 const toggle=style('.sticky-origin-card button.sticky-origin-color-toggle');
 assert.match(toggle,/background:\s*#fff\b/i);
 assert.match(toggle,/border-radius:\s*50%/i);
 assert.match(toggle,/width:\s*32px/i);
 const swatch=style('.sticky-origin-color-preview');
 assert.match(swatch,/border-radius:\s*50%/i);
 assert.match(swatch,/border:\s*2px solid/i);
 assert.match(source,/top\.append\(grip,mobileActions,front,back,focus,fold\)/);
 assert.match(source,/foot\.append\(colorToggle,remove,spacer,pageMove,createElement\('span','sticky-origin-char-count',textarea\.value\.length\+'\/2000'\),resize\)/);
 assert.match(source,/feedback\.textContent=show\?message:'';/);
 assert.match(source,/feedback\.hidden=!show;/);
 assert.doesNotMatch(source,/createElement\('span','',saving\.get\(note\.id\)\|\|'保存済み'\)/);
});
test('Origin sticky character counter and resize handle use distinct footer cells',()=>{
 const footer=style('.sticky-origin-foot');
 assert.match(footer,/grid-template-columns:32px 32px minmax\(0,1fr\) 42px auto 32px/i);
 const resize=style('.sticky-origin-card button.sticky-origin-resize');
 assert.match(resize,/position:static/i);
 assert.match(resize,/min-width:32px/i);
 const counter=style('.sticky-origin-char-count');
 assert.match(counter,/white-space:\s*nowrap/i);
 assert.match(source,/foot\.append\(colorToggle,remove,spacer,pageMove,createElement\('span','sticky-origin-char-count',textarea\.value\.length\+'\/2000'\),resize\)/);
 assert.match(source,/\.sticky-origin-foot\{[^}]*grid-template-columns:44px 44px minmax\(0,1fr\) 44px auto;/);
 assert.match(source,/\.sticky-origin-card button\.sticky-origin-resize\{display:none\}/);
});

test('all six sticky paper colors are harmonized light pastel tones',()=>{
 const palette=source.match(/const COLORS = \[([\s\S]*?)\n  \];/)?.[1]??'';
 const found=Object.fromEntries([...palette.matchAll(/\['(ivory|lemon|peach|mint|sky|lavender)','[^']+','(#[0-9a-f]{6})'\]/g)].map(m=>[m[1],m[2]]));
 assert.deepEqual(found,{
  ivory:'#f6f2eb',lemon:'#faf3c9',peach:'#fae3db',
  mint:'#dff0e6',sky:'#e1edf8',lavender:'#eee6f8'
 });
 for(const [name,hex] of Object.entries(found)){
  const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  assert.ok(Math.min(...rgb)>=195, name+' is too dark for a pastel note');
  assert.ok(Math.max(...rgb)-Math.min(...rgb)<=60,name+' is too saturated');
 }
});

test('Origin sticky keeps its board scroll when reactive store updates repaint controls',()=>{
 assert.match(source,/const previousStage=panel\.querySelector\('\.sticky-origin-stage'\)/);
 assert.match(source,/stage\.scrollTop=previousScrollTop/);
 assert.doesNotMatch(source,/sticky-origin-scope-note/);
});
test('Origin sticky uses Shift for opt-in 28px grid drag and retains free drag',()=>{
 assert.match(source,/e\.shiftKey/);
 assert.match(source,/Math\.round\([^\n]*\/28\)\*28/);
 assert.match(source,/Shift/);
});
test('obsolete automatic arrangement is absent from the sticky UI and store',()=>{
 const core=readFileSync(new URL('../personal-sticky-core-v659.js',import.meta.url),'utf8');
 const store=readFileSync(new URL('../personal-sticky-store-v659.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/sticky-arrange|stickyArrange|sticky\.arrange|自動整列/);
 assert.doesNotMatch(core,/planStickyArrangement/);
 assert.doesNotMatch(store,/sticky\.arrange|planStickyArrangement|async function arrange/);
});
