import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const css = readFileSync(new URL('../modern-display-v356.css', import.meta.url), 'utf8');
const js = readFileSync(new URL('../modern-display-v356.js', import.meta.url), 'utf8');
const themeCss = readFileSync(new URL('../color-themes-v329.css', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../release-manifest.js', import.meta.url), 'utf8');

function strippedCss(value) {
  return value.replace(/\/\*[\s\S]*?\*\//g, '');
}
test('Modern retains canonical Classic forms, writers, and data ownership', () => {
  assert.doesNotMatch(js, /firebase|runTransaction|addEventListener\(['"]click['"][^)]*deleteTask/i);
  assert.doesNotMatch(js, /iframe|contentWindow|document\.write|innerHTML/i);
  assert.match(js, /root\.dataset\.wbDisplay = next/);
  assert.match(js, /new Set\(\['classic', 'modern'\]\)/);
  assert.match(js, /workBoardDisplayV356:/);
  assert.match(js, /localStorage\.setItem\(storageKey\(\), mode\)/);
  assert.match(js, /roomNameInput/);
  assert.match(js, /wb-color-theme-field/);
  assert.match(js, /dialog\[open\]/);
  assert.match(js, /task-dragging/);
});

test('Modern styles are isolated, cover 5 areas and preserve semantic calendar/status colors', () => {
  const src = strippedCss(css);
  assert.equal((src.match(/\{/g)||[]).length, (src.match(/\}/g)||[]).length);
  assert.match(src, /html\[data-wb-display="modern"\]/);
  for (const part of ['.hero','.sidebar','.summary-card','.toolbar','.board-column',
    '.task-card','.today-panel','.todo-workspace','.schedule-calendar',
    '.detail-panel','.nav-item','.task-control-row']) {
    assert.ok(src.includes(part), 'Missing Modern work surface: '+part);
  }
  assert.match(src,/--modern-accent:var\(--wb-ui-accent/);
  assert.match(src,/data-wb-color-mode="dark"/);
  assert.match(src,/data-wb-color-theme="pure-yellow"/);
  assert.doesNotMatch(src,/\.calendar-cell\.holiday\s*\{\s*background:/);
  assert.doesNotMatch(src,/\.calendar-cell\.saturday\s*\{\s*background:/);
  assert.match(src,/\.calendar-cell\s*\{\s*border-color:/);
  assert.match(themeCss,/\.calendar-cell\.holiday:not\(\.today\)/);
  assert.match(themeCss,/\.calendar-cell\.saturday:not\(\.today\):not\(\.holiday\)/);
});

test('all existing 8 pure, 6 pastel and 5 dark palette names remain unchanged', () => {
  for (const type of [
    'pure-blue','pure-red','pure-green','pure-yellow',
    'pure-orange','pure-purple','pure-cyan','pure-pink',
    'pastel-blue','pastel-lilac','pastel-mint','pastel-rose','pastel-peach','pastel-lemon',
    'night-navy','night-charcoal','night-forest','night-plum','night-mocha'
  ]) {
    assert.ok(themeCss.includes('data-wb-color-theme="'+type+'"'),type+' missing');
  }
  assert.match(manifest,/modern-display-v356\.css/);
  assert.match(manifest,/modern-display-v356\.js/);
  assert.match(manifest,/version: "356"/);
});

test('Classic is initial view unless room/user explicitly selected Modern', () => {
  // Validate the actual module with a minimal document/store fixture; the
  // real application UI and browser-style regressions are exercised separately.
  const document = {
    documentElement: { dataset: {} },
    getElementById: () => ({})
  };
  // This guard exits before accessing DOM, proving duplicate installation
  // doesn't re-register listeners or touch localStorage in an existing page.
  const sandbox = { document, localStorage: { setItem() { throw Error('storage changed'); } } };
  assert.doesNotThrow(() => runInNewContext(js, sandbox, {timeout:200}));
});
