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

test('Origin sticky color button keeps an opaque contrasting surface',()=>{
 const toggle=style('.sticky-origin-card-head button.sticky-origin-color-toggle');
 assert.match(toggle,/background:\s*#fff\b/i);
 assert.match(toggle,/border:\s*1px solid\s+#[0-9a-f]{3,8}\b/i);
 const swatch=style('.sticky-origin-color-preview');
 assert.match(swatch,/border:\s*2px solid\s+#[0-9a-f]{3,8}\b/i);
});
test('Origin sticky counter reserves space for desktop resize handle',()=>{
 const footer=style('.sticky-origin-foot');
 assert.match(footer,/padding-right:\s*(3[6-9]|4[0-9])px\b/i);
 const counter=style('.sticky-origin-char-count');
 assert.match(counter,/white-space:\s*nowrap/i);
 assert.match(source,/@media\(max-width:767px\)\{[\s\S]*?\.sticky-origin-foot\{padding-right:1[0-4]px\}/);
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
