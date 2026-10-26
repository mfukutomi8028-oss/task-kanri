import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const manifest=read('release-manifest.js');
const styles=read('ui-signal-light-v535.css');
const priority=read('signal-priority-v535.js');
const required=key=>[...manifest.match(new RegExp(key+':\\s*\\[([\\s\\S]*?)\\]'))[1].matchAll(/"([^"]+)"/g)].map(x=>x[1]);
const responsibilities=JSON.parse(read('patch-responsibilities.json'));

function contrast(fg,bg) {
 const luminance=hex=>{
  const p=hex.match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16)/255)
   .map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  return .2126*p[0]+.7152*p[1]+.0722*p[2];
 };
 const a=luminance(fg),b=luminance(bg);
 return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
test('Ver.535 loads one SIGNAL Light layer before motion and mobile shell',()=>{
 const css=required('dynamicStyles');
 assert.deepEqual(css.slice(-3),['ui-signal-light-v535.css','ui-motion-v533.css','ui-mobile-shell-v234.css']);
 assert.equal(css.filter(x=>x==='ui-signal-light-v535.css').length,1);
 assert.equal(required('dynamicScripts').at(-1),'signal-priority-v535.js');
 for(const file of ['ui-signal-light-v535.css','signal-priority-v535.js'])assert.ok(required('requiredAssets').includes(file));
 assert.match(read('index.html'),/<html lang="ja" class="wb-signal-light-v535">/);
 assert.match(manifest,/version:\s*"304"/);
 assert.equal(responsibilities.baselineRelease,'304');
 assert.deepEqual(responsibilities.groups.find(g=>g.id==='signal-light-visual-language').assets,['ui-signal-light-v535.css','signal-priority-v535.js']);
});
test('Ver.535 primary blue has readable normal text contrast',()=>{
 const tokens=Object.fromEntries([...styles.matchAll(/--(signal-[a-z-]+):\s*(#[a-f0-9]{6})/gi)].map(m=>[m[1],m[2]]));
 for(const [fg,bg] of [
  ['signal-primary','signal-surface'],['signal-primary-deep','signal-primary-wash'],
  ['signal-text','signal-surface'],['signal-text-secondary','signal-surface'],
  ['signal-warning','signal-warning-bg'],['signal-success','signal-success-bg']
 ])assert.ok(contrast(tokens[fg],tokens[bg])>=4.5,fg+' text contrast');
});
test('Ver.535 preserves original icons, responsive shell, reduced motion',()=>{
 assert.match(styles,/\.sidebar/);
 assert.match(styles,/work-mobile-header/);
 assert.match(styles,/\.today-grid/);
 assert.match(styles,/work-memo-card-v167/);
 assert.match(styles,/prefers-reduced-motion/);
 assert.doesNotMatch(styles,/\bdisplay:\s*none\s*!important/);
 assert.doesNotMatch(styles,/\.nav-icon[^{}]*\{[^}]*filter:/s);
});
test('Ver.535 priority copies visible canonical cards without writing',()=>{
 assert.match(priority,/canonicalOverduePanel/);
 assert.match(priority,/\.today-grid > \.today-panel/);
 assert.match(priority,/root\.prepend\(section\)/);
 assert.match(priority,/card\.click\(\)/);
 assert.doesNotMatch(priority,/\b(?:localStorage|sessionStorage|firebase|set\(|update\(|remove\(|push\()/i);
 assert.doesNotMatch(priority,/innerHTML\s*=/);
 assert.doesNotMatch(priority,/subtree:\s*true/);
});
