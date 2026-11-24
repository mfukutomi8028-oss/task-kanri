import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../origin-modern-v372.js',import.meta.url),'utf8');
const sticky=fs.readFileSync(new URL('../origin-personal-sticky-v659.js',import.meta.url),'utf8');

test('Origin headings render one meaningful title and omit empty or decorative labels',()=>{
 const start=source.indexOf('function head('),end=source.indexOf('\n',start);
 const render=vm.runInNewContext(source.slice(start,end)+';head');
 const html=render('日本語の見出し','必要な説明','<button>追加</button>');
 assert.match(html,/<h1>日本語の見出し<\/h1>/);
 assert.match(html,/<p class="page-desc">必要な説明<\/p>/);
 assert.match(html,/<div class="heading-meta"><button>追加<\/button><\/div>/);
 assert.doesNotMatch(html,/eyebrow/);
 assert.doesNotMatch(render('その他',''),/class="page-desc"/);
});

test('Origin task command keeps search, density, view switching and sorting in DOM reading order',()=>{
 const start=source.indexOf('return `${head(',source.indexOf('function renderTasks('));
 const end=source.indexOf('id="originTaskStatusRail"',start);
 const markup=source.slice(start,end);
 const order=['id="originTaskQuery"','data-action="task-density"','class="origin-layout-controls"','data-action="task-advanced-toggle"','id="originTaskSort"'].map(key=>markup.indexOf(key));
 assert.ok(order.every(n=>n>=0));
 assert.deepEqual(order,[...order].sort((a,b)=>a-b));
 assert.doesNotMatch(source,/origin-task-tools>\.origin-(?:task-order-pair|density-button)\{order:/);
});

test('Origin progress, disabled controls and modal widths follow safe interaction rules',()=>{
 assert.doesNotMatch(source,/\.progress-fill\{[^}]*transition:width/);
 assert.match(source,/\.progress-fill\{[^}]*transform:scaleX\(var\(--origin-progress\)\)/);
 assert.match(source,/\.origin-jump-result:disabled\{[^}]*cursor:not-allowed/);
 assert.match(source,/\.origin-inbox-dialog\{[^}]*width:min\(870px,calc\(100% - 32px\)\)/);
 assert.match(sticky,/\.sticky-origin-editor\[open\]\{[^}]*width:min\(960px,calc\(100% - 36px\)\)/);
});
