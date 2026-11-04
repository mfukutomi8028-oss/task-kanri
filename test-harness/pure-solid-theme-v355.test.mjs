import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../color-themes-v329.css', import.meta.url), 'utf8');
const names = ['blue','red','green','yellow','orange','purple','cyan','pink'];
function tokens(name) {
  const start = css.indexOf(':root[data-wb-color-theme="pure-' + name + '"]');
  assert.ok(start !== -1, 'missing pure-' + name);
  const end = css.indexOf('\n}', start);
  assert.ok(end > start, 'missing palette closing brace ' + name);
  const declarations = css.slice(start, end);
  return Object.fromEntries([...declarations.matchAll(/--wb-theme-([\w-]+):\s*(#[\da-f]{6});/gi)]
    .map(match => [match[1],match[2].toLowerCase()]));
}
function lightness(hex) {
  assert.match(hex, /^#[\da-f]{6}$/);
  const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255)
    .map(value => value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
}
function contrast(a,b) {
  const l1=lightness(a),l2=lightness(b);
  return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
}

test('every pure palette uses vivid highlights but neutral, high-contrast working surfaces', () => {
  for (const name of names) {
    const t=tokens(name);
    for(const key of ['page','sidebar-a','hero-a','highlight-a','highlight-b',
      'highlight-ink','accent','ink','muted','surface','surface-soft','line','pure-on-color']) {
      assert.ok(t[key], name + ' missing role ' + key);
    }
    assert.equal(t['sidebar-a'], t['hero-a'], name + ' flat saturated header and sidebar');
    assert.equal(t['hero-a'], t['highlight-a'], name + ' one pure anchor hue');
    assert.equal(t.surface,'#ffffff',name + ' cards stay white');
    assert.ok(lightness(t.page)>=.9,name + ' page not saturated');
    assert.ok(lightness(t['surface-soft'])>=.90,name + ' controls not dark');
    assert.ok(lightness(t.line)>=.65,name + ' line not dark');
    assert.ok(contrast(t.surface,t.ink)>=7,name + ' body text WCAG AAA');
    assert.ok(contrast(t.surface,t.muted)>=4.5,name + ' muted text WCAG AA');
    assert.ok(contrast(t['hero-a'],t['pure-on-color'])>=4.5,name + ' hero text AA');
    assert.ok(contrast(t['highlight-a'],t['highlight-ink'])>=4.5,name + ' primary AA');
    assert.ok(contrast(t['highlight-b'],t['highlight-ink'])>=4.5,name + ' hover AA');
    assert.ok(lightness(t['hero-a']) < lightness(t.page)-.2,name+' vivid header vs paper');
  }
});

test('weekday backgrounds do not inherit accent-panel colors in any nondefault light theme',()=>{
  assert.doesNotMatch(css,/\.schedule-calendar \.calendar-cell:not\(\.today\):not\(\.holiday\),/);
  assert.match(css, /data-wb-color-mode="light"[\s\S]*?\.schedule-calendar \.calendar-cell:not\(\.muted\):not\(\.today\):not\(\.holiday\):not\(\.saturday\)/);
  assert.match(css, /\.calendar-cell\.saturday:not\(\.today\):not\(\.holiday\)/);
  assert.match(css, /\.calendar-cell\.holiday:not\(\.today\)/);
  assert.match(css, /\.calendar-cell\.today:hover/);
  assert.match(css, /background:#ffffff !important;/);
  assert.match(css, /background:#fffbe8 !important;/);
});

test('pure overrides apply only to light pure palettes; default, pastel and dark retain their rules',()=>{
  const start=css.indexOf('/* Pure-color system, not eight copies');
  const end=css.indexOf('/* Registration dialogs must share',start);
  assert.ok(start>0 && end>start);
  const segment=css.slice(start,end);
  assert.match(segment,/data-wb-color-mode="light"/);
  assert.match(segment,/data-wb-color-theme\^="pure-"/);
  assert.doesNotMatch(segment,/data-wb-color-theme="default"/);
  assert.doesNotMatch(segment,/data-wb-color-theme\^="pastel-"/);
  assert.doesNotMatch(segment,/data-wb-color-mode="dark"/);
  assert.match(segment,/\.todo-workspace \.todo-item:not\(\.completed\):not\(\.is-completed\)/);
  assert.match(segment,/\.hero::after/);
  assert.match(segment,/\.sidebar :is\(input,select\)/);
});
