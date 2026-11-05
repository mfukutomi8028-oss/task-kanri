import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const css = read('color-themes-v329.css');
const js = read('color-themes-v329.js');
const manifest = read('release-manifest.js');
const html = read('index.html');
const themes = ['default','sky','lavender','mint','rose','peach','amber','slate','pastel-blue','pastel-lilac','pastel-mint','pastel-rose','pastel-peach','pastel-lemon','night-navy','night-charcoal','night-forest','night-plum','night-mocha'];

test('Classic palette assets precede Modern and Palette presentations', () => {
  const extract = key => [...manifest.match(new RegExp(key + ':\\s*\\[([\\s\\S]*?)\\]', 'm'))?.[1].matchAll(/"([^"]+)"/g) || []].map(x => x[1]);
  const styles = extract('dynamicStyles');
  const scripts = extract('dynamicScripts');
  const required = extract('requiredAssets');
  assert.ok(styles.indexOf('color-themes-v329.css') < styles.indexOf('ui-motion-v533.css'));
  assert.equal(styles.at(-1), 'ui-mobile-shell-v234.css');
  const originModern = scripts.includes('origin-modern-v372.js');
  assert.equal(scripts.at(originModern ? -5 : -4), 'color-themes-v329.js');
  assert.equal(scripts.at(originModern ? -4 : -3), 'modern-display-v356.js');
  if (originModern) assert.equal(scripts.at(-3), 'origin-modern-v372.js');
  assert.equal(scripts.at(-2), 'palette-display-v358.js');
  assert.equal(scripts.at(-1), 'journal-display-v367.js');
  assert.equal(styles.filter(x => x === 'modern-display-v356.css').length, 1);
  for (const asset of ['color-themes-v329.css','color-themes-v329.js']) {
    assert.equal(required.filter(x => x === asset).length,1);
  }
  const release = manifest.match(/version:\s*"(\d+)"/)?.[1];
  assert.ok(Number(release) >= 349);
  assert.match(html, new RegExp('style\\.css\\?v=' + release + '(?:["&])'));
  assert.match(html, new RegExp('app\\.js\\?v=' + release + '(?:["&])'));
});

test('Color themes are entirely visual and preserve Classic data semantics', () => {
  for (const key of themes) {
    assert.match(js,new RegExp("id: '" + key + "'"));
    assert.match(css,new RegExp('data-theme="' + key + '"'));
  }
  assert.match(css,/\.task-card:not\(\.overdue\)/);
  assert.doesNotMatch(css,/\.priority-緊急\s*\{/);
  assert.doesNotMatch(css,/^\s*\.status-完了\s*\{/m);
  assert.match(js,/const STORAGE_PREFIX = 'workBoardColorThemeV329:'/);
  assert.match(js,/localStorage\.setItem\(scopeKey\(\), id\)/);
  assert.doesNotMatch(js.replace(/\/\*[\s\S]*?\*\//g, ''),/firebase|runTransaction|fetch\(|XMLHttpRequest|indexedDB/i);
  assert.match(html,/data-task-layout="timeline"/);
  assert.match(html,/data-task-layout="board"/);
});

test('Inventory tracks the complete CSS+JS owner without replacing other patches', () => {
  const inv = JSON.parse(read('patch-responsibilities.json'));
  assert.equal(inv.baselineRelease, manifest.match(/version:\s*"(\d+)"/)?.[1]);
  const group=inv.groups.find(x=>x.id==='classic-color-theme');
  assert.deepEqual(group.assets,['color-themes-v329.css','color-themes-v329.js']);
  assert.equal(inv.groups.filter(x=>x.id==='classic-color-theme').length,1);
  const modern=inv.groups.find(x=>x.id==='modern-display');
  const expectedModern=['modern-display-v356.css','modern-display-v356.js'];
  if (modern.assets.includes('origin-modern-v372.css')) {
    expectedModern.push('origin-modern-v372.css','origin-modern-v372.js');
  }
  assert.deepEqual(modern.assets,expectedModern);
  assert.equal(inv.groups.filter(x=>x.id==='modern-display').length,1);
});

test('Ver.348: all non-default palettes share explicit neutral surface and contrast roles',()=>{
  const themeCss=read('color-themes-v329.css');
  const start=themeCss.indexOf('/* Ver.348: nonsemantic UI roles');
  const end=themeCss.indexOf('/* Theme declarations are applied',start);
  assert.ok(start>=0&&end>start,'single neutral role owner');
  const roles=themeCss.slice(start,end);
  for(const role of ['paper','panel','gradient','control','line','line-soft','ink',
    'muted','hover','selected','accent','accent-line','shadow','focus-shadow',
    'sidebar-shadow','mobile-sidebar-shadow']) {
    assert.ok(roles.includes('--wb-ui-'+role+':'),'missing themed role: '+role);
  }
  assert.ok(roles.includes('html[data-wb-color-mode="dark"][data-wb-color-theme]'));
  assert.ok(roles.includes(':not([data-wb-color-theme="default"])'));
  const original=themeCss.slice(0,themeCss.indexOf(':root[data-wb-color-theme="sky"]'));
  assert.ok(!original.includes('--wb-ui-panel:'),'original Classic must keep literal fallbacks');
});
test('Ver.348: neutral base components use role fallbacks while semantic signals retain own colors',()=>{
  const owners=['style.css','todo-ui-v142.css','ui-todo-light-v189.css',
    'ui-task-light-v189.css','ui-task-list-sort-v193.css','ui-task-detail-tools-v192.css',
    'ui-task-prerequisites-comments-v192.css','ui-date-segment-controls-v230.css',
    'ui-schedule-copy-v225.css','ui-workflow-detail-v186.css',
    'ui-task-relations-reminders-v192.css','ui-comment-reactions-v191.css',
    'ui-comment-mentions-v191.css','ui-work-memo-v190.css','ui-inbox-archive-v186.css',
    'ui-activity-dialog-v193.css','ui-reserved-task-v190.css',
    'ui-workflow-insights-v192.css','ui-core-density-v188.css',
    'ui-mobile-shell-v234.css','ui-motion-v533.css'];
  for(const file of owners)assert.ok(read(file).includes('var(--wb-ui-'),'unthemed owner: '+file);
  const root=read('style.css');
  assert.match(root,/\.calendar-cell\.today\s*\{\s*background:\s*#fffbe8/);
  assert.match(root,/\.timeline-date\.today,\s*\.timeline-cell\.today\s*\{\s*background:\s*rgba\(255,\s*244,\s*194,\s*\.56\)/);
  assert.ok(root.includes('border-left-color: #ef4b62 !important'),'urgent line still conveys urgency');
  assert.ok(root.includes('border-left-color: #ff9f43 !important'),'high-priority line unchanged');
  assert.ok(root.includes('var(--wb-ui-gradient,linear-gradient(145deg, #fff, #f4fbff))'),'priority card paper is theme-neutral');
  assert.ok(read('ui-workflow-detail-v186.css').includes('background:linear-gradient(180deg,#fffdf7,#fff9e8)'),'semantic reminder warning stays amber');
});

test('Ver.349: weekend and holiday calendar colors stay semantic across all themes',()=>{
 const css=read('color-themes-v329.css');
 const base=read('style.css');
 assert.ok(css.includes('.schedule-calendar .calendar-cell:not(.holiday):not(.saturday) .calendar-date'));
 assert.ok(css.includes('.schedule-calendar .calendar-weekdays span:not(.sunday):not(.saturday)'));
 assert.ok(!css.includes('  .schedule-calendar .calendar-weekdays span,'));
 for(const token of ['.calendar-weekdays .sunday','.calendar-weekdays .saturday',
   '.calendar-cell.holiday .calendar-date','.calendar-cell.saturday .calendar-date']) {
   assert.ok(base.includes(token),'semantic date marker lost: '+token);
 }
});
