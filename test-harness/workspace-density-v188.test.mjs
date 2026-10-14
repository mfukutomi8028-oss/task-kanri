import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FROZEN_RETIRED_CSS_BLOBS_V405, FROZEN_RETIRED_JS_BLOBS_V406, FROZEN_RETIRED_JS_BLOBS_V410, FROZEN_RETIRED_JS_BLOBS_V411 } from './build-pages-runtime-v382.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.224 keeps core density CSS active while retiring the no-op JavaScript sidecar', () => {
  const manifest = read('release-manifest.js');
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);

  assert.ok(release >= 224, `core density sidecar retirement requires release 224 or later, got ${release}`);

  const currentStyle = 'ui-core-density-v188.css';
  const retiredScript = 'core-view-density-v188.js';
  assert.equal(styles.filter(item => item === currentStyle).length, 1, `${currentStyle} must load exactly once`);
  assert.ok(required.includes(currentStyle), `${currentStyle} must remain required`);
  assert.equal(scripts.filter(item => item === retiredScript).length, 0, `${retiredScript} must no longer load dynamically`);
  assert.ok(!required.includes(retiredScript), `${retiredScript} must no longer be required`);
  assert.equal(fs.existsSync(path.join(ROOT, retiredScript)), false, 'retired density helper JS must leave Git root');
  const archivedDensityJs = JSON.parse(read('compat/frozen-legacy-runtime-v397.json'))[retiredScript];
  assert.equal(typeof archivedDensityJs, 'string', 'old cached density helper must be immutable in the archive');
  assert.ok(Object.hasOwn(FROZEN_RETIRED_JS_BLOBS_V406, retiredScript), 'old density helper Git SHA must be fixed');

  for (const legacy of ['ui-v176.css', 'workspace-density-v176.js']) {
    assert.ok(!styles.includes(legacy), `${legacy} must not remain an active style`);
    assert.ok(!scripts.includes(legacy), `${legacy} must not remain an active script`);
    assert.ok(!required.includes(legacy), `${legacy} must not remain required`);
    if (legacy === 'ui-v176.css') {
      assert.equal(fs.existsSync(path.join(ROOT, legacy)), false, 'retired density CSS must no longer exist in Git root');
      const original = JSON.parse(read('compat/frozen-legacy-runtime-v397.json'))[legacy];
      assert.equal(typeof original, 'string', 'cached density stylesheet must be archived');
      assert.ok(Object.hasOwn(FROZEN_RETIRED_CSS_BLOBS_V405, legacy), 'density CSS original Git hash must remain pinned');
    } else {
      assert.equal(fs.existsSync(path.join(ROOT, legacy)), false,
        'retired workspace density JS must be archived instead of Git root: ' + legacy);
      const original = JSON.parse(read('compat/frozen-legacy-runtime-v397.json'))[legacy];
      assert.equal(typeof original, 'string', 'original cached workspace density code must remain archived');
      assert.ok(Object.hasOwn(FROZEN_RETIRED_JS_BLOBS_V411, legacy),
        'original workspace density Git SHA must remain fixed');
    }
  }
});

test('Ver.224 keeps Today and Schedule app-owned after the density sidecar leaves active runtime', () => {
  const manifest = read('release-manifest.js');
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const todoCssName = styles.includes('ui-todo-light-v189.css') ? 'ui-todo-light-v189.css' : 'ui-v145.css';
  const todoCss = todoCssName === 'ui-v145.css'
    ? JSON.parse(read('compat/frozen-legacy-runtime-v397.json'))[todoCssName]
    : read(todoCssName);
  assert.equal(typeof todoCss, 'string', 'the active or immutable historical ToDo CSS must be available');
  const todoJs = read('todo-tools-v145.js');
  assert.match(todoCss, /body\.todo-mode \.todo-tools-v145/);
  assert.match(todoCss, /\.todo-tools-actions-v176/);
  assert.match(todoJs, /function compactHeaderIntoTools\(/);
  assert.match(todoJs, /todo-tools-actions-v176/);

  const memoCss = JSON.parse(read('compat/frozen-legacy-runtime-v397.json'))['ui-v168.css'];
  assert.equal(typeof memoCss, 'string', 'historical memo density CSS must remain archived');
  const memoJs = JSON.parse(read('compat/frozen-legacy-runtime-v397.json'))['work-features-ui-v168.js'];
  assert.equal(typeof memoJs, 'string', 'historical Ver.168 memo UI behavior must remain frozen');
  assert.ok(Object.hasOwn(FROZEN_RETIRED_JS_BLOBS_V410, 'work-features-ui-v168.js'));
  assert.match(memoCss, /body\.work-memo-mode-v167 \.work-memo-tools-v167/);
  assert.match(memoCss, /\.work-memo-new-v176/);
  assert.match(memoJs, /function patchMemoDensity\(/);
  assert.match(memoJs, /work-memo-new-v176/);

  const coreCss = read('ui-core-density-v188.css');
  const retiredCoreJs = JSON.parse(read('compat/frozen-legacy-runtime-v397.json'))['core-view-density-v188.js'];
  assert.equal(typeof retiredCoreJs, 'string', 'Ver.223 frozen density sidecar source must remain available');
  const app = read('app.js');
  assert.match(coreCss, /body\.today-mode \.activity-panel \.activity-actions/);
  assert.match(coreCss, /body\.schedule-mode \.schedule-toolbar-v176/);
  assert.doesNotMatch(retiredCoreJs, /MutationObserver/);
  assert.doesNotMatch(retiredCoreJs, /observeRoot\(/);
  assert.doesNotMatch(retiredCoreJs, /patchSchedule\s*\(/);
  assert.doesNotMatch(retiredCoreJs, /patchToday\s*\(/);
  assert.match(retiredCoreJs, /observers: Object\.freeze\(\{ today: null, schedule: null \}\)/);
  assert.match(retiredCoreJs, /__WB_CORE_VIEW_DENSITY_V188__/);
  assert.match(app, /function renderScheduleNotificationSidebar\s*\(/);
  assert.match(app, /today-action-divider-v220/);
  assert.match(app, /today-compact-action-v176/);
  assert.match(app, /function bindScheduleSearchProxy\s*\(/);
  assert.match(app, /schedule-toolbar-v176/);
  assert.match(app, /schedule-toolbar-controls-v176/);
  assert.match(app, /schedule-toolbar-utility-v176/);
  assert.match(app, /schedule-date-v176/);
  assert.match(app, /schedule-search-v176/);
  assert.doesNotMatch(app, /today-head today-head-after-activity/);
  assert.doesNotMatch(app, /class="schedule-actions"/);
  assert.doesNotMatch(app, /class="schedule-title-block"/);
});

test('Ver.456 retires v29 density/header decoration but preserves cached-markup fail-safe resets', () => {
  const css = read('style.css');
  const html = read('index.html');
  const modern = read('ui-core-density-v188.css');
  const manifest = read('release-manifest.js');

  assert.doesNotMatch(css, /^\.compact-header \.hero\s*\{\s*min-height:\s*96px/m);
  assert.doesNotMatch(css, /^\.compact-header \.hero \.eyebrow\s*\{\s*display:\s*none/m);
  assert.doesNotMatch(css, /^\.compact-header \.hero h2\s*\{\s*font-size:\s*clamp\(/m);
  assert.doesNotMatch(css, /^\s*\.density-switcher select\s*\{/m);
  assert.doesNotMatch(css, /^\.density-switcher\s*\{\s*(?:display:\s*inline-flex|min-width:\s*0|grid-area:\s*density)/m);
  assert.match(css,
    /\.hero-actions\s*,\s*\.hero-compact-button\s*,\s*\.density-switcher\s*\{\s*display:\s*none\s*!important\s*;/,
    'old density selector must stay hidden for cached markup');
  assert.match(css,
    /\.compact-header \.hero\s*\{\s*min-height:\s*inherit\s*!important\s*;/,
    'cached compact header must still be reset');
  assert.match(css, /\.compact-header \.hero \.eyebrow\s*\{\s*display:\s*block\s*!important\s*;/);
  assert.match(css, /\.compact-density \.task-card\s*\{\s*padding:\s*inherit\s*!important\s*;/);
  assert.doesNotMatch(html, /\b(?:density-switcher|compact-header)\b/);
  assert.match(html, /id="sortSelect"/);
  assert.match(modern, /body\.today-mode \.activity-panel \.activity-actions/);
  assert.match(modern, /body\.schedule-mode \.schedule-toolbar-v176/);
  assert.match(manifest, /version:\s*"304"/);
});

test('Ver.457 removes old compact/hero decoration but preserves cache guards and live owners', () => {
  const css = read('style.css');
  const html = read('index.html');
  const app = read('app.js');
  const core = read('ui-core-density-v188.css');

  assert.doesNotMatch(css, /^\s*\.hero-actions\s*\{/m,
    'old standalone hero-actions positioning/decorations should be retired');
  assert.doesNotMatch(css, /^\.hero-compact-button\s*\{/m);
  assert.doesNotMatch(css, /\.compact-density \.task-card\s*\{\s*padding:\s*10px/);
  assert.doesNotMatch(css, /\.compact-density \.task-title\s*\{\s*font-size:\s*14px/);
  assert.doesNotMatch(css, /\.compact-density \.badge\s*\{\s*padding:\s*4px/);
  assert.match(css, /\.hero-actions\s*,\s*\.hero-compact-button\s*,\s*\.density-switcher\s*\{\s*display:\s*none\s*!important\s*;/,
    'old cached hero controls must stay hidden');
  assert.match(css, /\.hero-actions\[hidden\]\s*\{\s*display:\s*none\s*!important\s*;/);
  assert.match(css, /\.compact-density \.task-card\s*\{\s*padding:\s*inherit\s*!important\s*;/);
  assert.match(css, /\.compact-density \.task-title\s*\{\s*font-size:\s*inherit\s*!important\s*;/);
  assert.match(css, /\.compact-density \.badge\s*\{\s*padding:\s*inherit\s*!important\s*;/);
  assert.match(css, /\.compact-density \.task-meta\s*\{\s*gap:\s*4px\s*;/,
    'unoverridden cached compact-density rule is intentionally retained');
  assert.match(css, /\.compact-density \.due-line\s*\{\s*font-size:\s*11px\s*;/);
  assert.match(css, /\.hero-room-badge\s*\{\s*position:\s*absolute\s*!important\s*;/);
  assert.doesNotMatch(html, /\b(?:compact-density|hero-compact-button|hero-actions)\b/);
  assert.doesNotMatch(app, /\b(?:compact-density|hero-compact-button|hero-actions)\b/);
  assert.match(core, /body\.schedule-mode \.schedule-toolbar-v176/);
  assert.match(read('tests/css-cascade-priority-v451.spec.mjs'), /Ver\.457: retired compact density and hidden hero action styles/);
});

test('Ver.458 retires the overwritten Ver.32 task toolbar layout while preserving Ver.33 ownership', () => {
  const css = read('style.css');
  const html = read('index.html');
  const browser = read('tests/css-cascade-priority-v451.spec.mjs');

  assert.doesNotMatch(css, /\/\* タスク管理ツールバー：1行目に主要操作、2行目に表示設定を置いて入力欄を広く確保 \*\//);
  assert.doesNotMatch(css, /"density view view view"/);
  assert.doesNotMatch(css, /"density view view"/);
  assert.match(css,
    /\/\* ツールバー：表示密度を削除した分、クイック追加と検索を広めに確保 \*\/[\s\S]*?\.toolbar\s*\{[\s\S]*?"view view view view"/,
    'Ver.33 must continue owning the visible toolbar');
  assert.match(css, /\/\* 中幅では検索欄を2行目に広げる \*\//);
  assert.match(css, /\/\* スマホ幅では従来通り縦並びに戻す \*\//);
  assert.match(css, /\/\* 狭幅・タブレットでは縦積みにする \*\//,
    'the unrelated earlier narrow-screen group is retained');
  assert.match(css, /\.hero-actions\s*,\s*\.hero-compact-button\s*,\s*\.density-switcher\s*\{\s*display:\s*none\s*!important\s*;/);
  assert.match(html, /id="sortSelect"/);
  assert.match(browser, /VER458_RETIRED_TOOLBAR/);
  assert.match(browser, /Ver\.458 superseded toolbar v32 matches v33 across modes/);
});

test('Ver.459 retires superseded responsive toolbar declarations without altering v33 owners', () => {
  const css = read('style.css');
  const html = read('index.html');
  const spec = read('tests/css-cascade-priority-v451.spec.mjs');
  assert.doesNotMatch(css, /minmax\(170px, 260px\)\s*\n\s*minmax\(180px, 1fr\)/,
    'old six-column v31 task toolbar must be retired');
  assert.doesNotMatch(css, /grid-column:\s*2\s*\/\s*4\s*;/,
    'obsolete responsive search placement must be gone');
  assert.doesNotMatch(css, /grid-column:\s*4\s*\/\s*5\s*;/,
    'obsolete responsive sort placement must be gone');
  assert.doesNotMatch(css, /"density"\s*"view"\s*!important\s*;/,
    'old 980px six-row density track must be gone');
  assert.match(css, /\/\* 狭幅・タブレットでは縦積みにする \*\//,
    'v32 narrow-screen sidebar/hero safety block must remain');
  assert.match(css, /\/\* ツールバー：表示密度を削除した分、クイック追加と検索を広めに確保 \*\//);
  assert.match(css, /"new quick search sort"\s*"view view view view"\s*!important\s*;/,
    'active v33 task toolbar must own the rendered grid');
  assert.match(css, /\.toolbar > \*\s*\{\s*min-width:\s*0\s*;/,
    'shared child minimum-width correction must be preserved');
  assert.match(css, /\.hero-actions\s*,\s*\.hero-compact-button\s*,\s*\.density-switcher\s*\{\s*display:\s*none\s*!important\s*;/);
  assert.match(css, /\.compact-header \.hero\s*\{\s*min-height:\s*inherit\s*!important\s*;/);
  assert.match(css, /@media \(max-width:\s*980px\)\s*\{[\s\S]*?\.sidebar\s*\{\s*position:\s*relative\s*!important\s*;/,
    'old narrow-screen sidebar recovery is retained');
  assert.match(html, /id="sortSelect"/);
  assert.match(spec, /VER459_RETIRED_TOOLBAR/);
  assert.match(spec, /Ver\.459 toolbar layout changed/);
  assert.match(read('release-manifest.js'), /version:\s*"304"/);
});


test('Ver.460 retires superseded old hero and room badge decorations but keeps current and cached contracts', () => {
  const css = read('style.css');
  const spec = read('tests/css-cascade-priority-v451.spec.mjs');
  assert.doesNotMatch(css, /padding-right:\s*270px\s*;/, 'superseded v31 hero padding must be removed');
  assert.doesNotMatch(css, /padding-right:\s*320px\s*!important\s*;/, 'superseded v32 hero padding must be removed');
  assert.doesNotMatch(css, /top:\s*66px\s*;/, 'superseded v31 room positioning must be removed');
  assert.doesNotMatch(css, /box-shadow:\s*0 10px 24px rgba\(7,31,45,\.16\)\s*!important/, 'superseded v32 room decoration must be removed');
  assert.match(css, /\.hero\s*\{\s*position:\s*relative\s*!important;\s*padding-right:\s*250px\s*!important\s*;/,
    'v33 hero layout owner remains');
  assert.match(css, /\.hero-room-badge\s*\{\s*position:\s*absolute\s*!important;\s*top:\s*50%\s*!important;\s*right:\s*34px\s*!important;/,
    'v33 room positioning owner remains');
  assert.match(css, /\.hero-room-badge,\s*\.room-pill,\s*\.hero \.room-badge,\s*\.hero \[data-room-badge\]/,
    'legacy badge aliases remain for old cached markup');
  assert.match(css, /@media \(max-width:\s*1100px\)\s*\{\s*\.hero\s*\{\s*padding-right:\s*34px;/,
    'unrelated v31 hero mobile fallback stays');
  assert.match(css, /@media \(max-width:\s*980px\)\s*\{\s*\.sidebar\s*\{\s*position:\s*relative\s*!important;/,
    'v32 legacy sidebar recovery stays');
  assert.match(spec, /VER460_RETIRED_HERO/);
  assert.match(spec, /Ver\.460 hero\/badge layout changed/);
  assert.match(read('release-manifest.js'), /version:\s*"304"/);
});
