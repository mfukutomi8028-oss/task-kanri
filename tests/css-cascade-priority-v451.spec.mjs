import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const current = readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const ORIGINAL_GIT_BLOB = 'dd210b34000eff6703b24f0d32dd69a54e0675b9';
const VER451_GIT_BLOB = '4f2465e7f3367518ba71e931e60af2ea06bd52fd';
const VER455_GIT_BLOB = '19f3b65c6bd098efaf42b9a25d9c774802319539';
const VER456_GIT_BLOB = '62ec1fe101f2a6fdcc8351d27bf77fbd92f534e5';
const VER457_GIT_BLOB = '3542e775bb7eb6a63edcc51a3e1993be3394865a';
const CURRENT_GIT_BLOB = '2c94815860ed06a641274b76b42b82a97b4b326c';
// Exact Ver.32 block to restore the validated Ver.457 stylesheet.
const VER458_RETIRED_TOOLBAR = "/* タスク管理ツールバー：1行目に主要操作、2行目に表示設定を置いて入力欄を広く確保 */\n.toolbar {\n  display: grid !important;\n  grid-template-columns: minmax(220px, 280px) minmax(340px, 1fr) minmax(460px, 1.35fr) minmax(180px, 230px) !important;\n  grid-template-areas:\n    \"new quick search sort\"\n    \"density view view view\" !important;\n  gap: 12px !important;\n  align-items: center !important;\n  max-width: 100% !important;\n  overflow: visible !important;\n}\n\n.toolbar-new-task {\n  grid-area: new !important;\n  width: 100% !important;\n}\n\n.quick-add {\n  grid-area: quick !important;\n  display: grid !important;\n  grid-template-columns: minmax(260px, 1fr) 64px !important;\n  gap: 8px !important;\n  min-width: 0 !important;\n  width: 100% !important;\n}\n\n.quick-add input {\n  min-width: 0 !important;\n  width: 100% !important;\n}\n\n.quick-add .ghost-button,\n#quickAddButton {\n  min-width: 64px !important;\n  width: 64px !important;\n  padding-left: 0 !important;\n  padding-right: 0 !important;\n  justify-content: center !important;\n}\n\n.search-box {\n  grid-area: search !important;\n  min-width: 0 !important;\n  width: 100% !important;\n}\n\n#sortSelect {\n  grid-area: sort !important;\n  width: 100% !important;\n  min-width: 180px !important;\n}\n\n.task-view-switcher {\n  grid-area: view !important;\n  justify-self: start !important;\n  width: auto !important;\n  max-width: 100% !important;\n}\n\n.task-view-buttons {\n  flex-wrap: wrap !important;\n}\n\n/* 今日・ダッシュボード・スケジュールではタスク専用の表示切替を隠し、ツールバーを自然に詰める */\n.today-mode .toolbar,\n.dashboard-mode .toolbar,\n.schedule-mode .toolbar {\n  grid-template-columns: minmax(220px, 280px) minmax(340px, 1fr) minmax(460px, 1.35fr) minmax(180px, 230px) !important;\n  grid-template-areas: \"new quick search sort\" !important;\n}\n\n.today-mode .density-switcher,\n.today-mode .task-view-switcher,\n.dashboard-mode .density-switcher,\n.dashboard-mode .task-view-switcher,\n.schedule-mode .density-switcher,\n.schedule-mode .task-view-switcher {\n  display: none !important;\n}\n\n/* 中幅では検索欄を2行目に伸ばして窮屈さを回避 */\n@media (max-width: 1450px) {\n  .toolbar {\n    grid-template-columns: minmax(200px, 260px) minmax(320px, 1fr) minmax(180px, 230px) !important;\n    grid-template-areas:\n      \"new quick sort\"\n      \"search search search\"\n      \"density view view\" !important;\n  }\n\n  .today-mode .toolbar,\n  .dashboard-mode .toolbar,\n  .schedule-mode .toolbar {\n    grid-template-columns: minmax(200px, 260px) minmax(320px, 1fr) minmax(180px, 230px) !important;\n    grid-template-areas:\n      \"new quick sort\"\n      \"search search search\" !important;\n  }\n}\n\n";
const VER458_REINSERT_BEFORE = "/* 狭幅・タブレットでは縦積みにする */\n";
// Exact unmodified Ver.456 CSS blocks and byte positions, prior to Ver.457 retirement.
const VER457_RETIRED_STYLES = [[47359,".hero-actions {\n  display: flex;\n  align-items: center;\n  justify-content: flex-end;\n}\n\n"],[47447,".hero-compact-button {\n  background: rgba(255,255,255,.22) !important;\n  color: #fff !important;\n  border-color: rgba(255,255,255,.35) !important;\n}\n\n"],[49145,".compact-density .task-card {\n  padding: 10px 12px;\n  gap: 6px;\n}\n\n"],[49212,".compact-density .task-title {\n  font-size: 14px;\n}\n\n"],[49310,".compact-density .badge {\n  padding: 4px 7px;\n  font-size: 11px;\n}\n\n"],[52084,".hero-actions {\n  position: absolute;\n  top: 18px;\n  right: 34px;\n  z-index: 3;\n}\n\n"],[52264,".hero-compact-button {\n  min-height: 32px !important;\n  padding: 6px 12px !important;\n  border-radius: 12px !important;\n  background: rgba(255,255,255,.92) !important;\n  color: #17445f !important;\n  border: 1px solid rgba(255,255,255,.55) !important;\n  box-shadow: 0 8px 18px rgba(0,0,0,.10);\n  font-size: 12px;\n}\n\n"],[54211,"  .hero-actions {\n    top: 16px;\n    right: 22px;\n  }\n\n"],[55148,".hero-actions {\n  position: absolute !important;\n  top: 18px !important;\n  right: 34px !important;\n  z-index: 6 !important;\n  display: flex !important;\n}\n\n"],[55303,".hero-compact-button {\n  min-height: 34px !important;\n  padding: 7px 14px !important;\n  border-radius: 999px !important;\n  background: #ffffff !important;\n  color: #17445f !important;\n  border: 1px solid rgba(255,255,255,.78) !important;\n  box-shadow: 0 10px 22px rgba(10,32,48,.18) !important;\n  font-size: 12px !important;\n  font-weight: 1000 !important;\n  opacity: 1 !important;\n  backdrop-filter: none !important;\n}\n\n"],[58970,"  .hero-actions {\n    top: 18px !important;\n    right: 22px !important;\n  }\n\n"]];
// Exact substrings and offsets in the last verified Ver.455 stylesheet.
const VER456_RETIRED_STYLES = [[47597,".compact-header .hero {\n  min-height: 96px;\n  padding-top: 22px;\n  padding-bottom: 22px;\n}\n\n"],[47689,".compact-header .hero .eyebrow {\n  display: none;\n}\n\n"],[47742,".compact-header .hero h2 {\n  font-size: clamp(30px, 3vw, 46px);\n}\n\n"],[48057,".density-switcher {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  white-space: nowrap;\n  color: #61798d;\n  font-size: 12px;\n  font-weight: 1000;\n}\n\n"],[48220,".density-switcher select {\n  min-height: 48px;\n  border-radius: 16px;\n  border: 1px solid #d9e6ef;\n  padding: 0 12px;\n  font-weight: 1000;\n}\n\n"],[53930,".density-switcher {\n  min-width: 0;\n}\n\n"],[53969,".density-switcher select {\n  width: 120px;\n}\n\n"],[54618,"  .density-switcher {\n    grid-column: 1 / 2;\n  }\n\n"],[58060,".density-switcher {\n  grid-area: density !important;\n  width: 100% !important;\n  justify-self: start !important;\n}\n\n"],[58176,".density-switcher select {\n  width: 180px !important;\n}\n\n"]];
// Reinsert Ver.455's exact deleted block to preserve Ver.451 immutable CSS lineage.
const RETIRED_V455_DECORATION = ".saved-filter-list {\n  display: grid;\n  gap: 8px;\n}\n\n.saved-filter-item {\n  display: grid;\n  grid-template-columns: 1fr auto;\n  gap: 6px;\n}\n\n.saved-filter-item button:first-child {\n  border: 1px solid rgba(255,255,255,.16);\n  background: rgba(255,255,255,.13);\n  color: #fff;\n  border-radius: 14px;\n  padding: 9px 10px;\n  text-align: left;\n  font-weight: 1000;\n  cursor: pointer;\n}\n\n.delete-saved-filter {\n  border: 1px solid rgba(255,255,255,.18);\n  background: rgba(255,255,255,.10);\n  color: #fff;\n  border-radius: 12px;\n  width: 34px;\n  font-weight: 1000;\n  cursor: pointer;\n}\n\n";
const REINSERT_BEFORE = ".today-view {\n  display: grid;\n  gap: 16px;\n}";
const priorityStart = '.priority-card {\n  border-left-width: 5px !important;\n  border-left-style: solid !important;\n}\n\n';
const earlyAnchor = '.priority-row {\n  border-left: 5px solid transparent;\n}';
const afterCanonical = '/* 今日までのタスクは、左端の橙ラインを廃止してバッジと薄い枠で表現 */';

function blobSha(source) {
  const bytes = Buffer.from(source, 'utf8');
  return createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
}

function restoredVer457Css() {
  const at = current.indexOf(VER458_REINSERT_BEFORE);
  expect(current.split(VER458_REINSERT_BEFORE)).toHaveLength(2);
  expect(at, 'the narrow viewport block must remain as our unique anchor').toBeGreaterThan(-1);
  const restored = current.slice(0, at) + VER458_RETIRED_TOOLBAR + current.slice(at);
  expect(blobSha(restored), 'Ver.457 stylesheet restoration must be exact').toBe(VER457_GIT_BLOB);
  return restored;
}

function restoredVer456Css(ver457) {
  let restored = ver457;
  for (const [offset, fragment] of VER457_RETIRED_STYLES) {
    restored = restored.slice(0, offset) + fragment + restored.slice(offset);
  }
  expect(blobSha(restored), 'Ver.456 stylesheet restoration must be exact').toBe(VER456_GIT_BLOB);
  return restored;
}

function restoredVer455Css(ver456) {
  let restored = ver456;
  for (const [offset, fragment] of VER456_RETIRED_STYLES) {
    restored = restored.slice(0, offset) + fragment + restored.slice(offset);
  }
  expect(blobSha(restored), 'Ver.455 stylesheet restoration must be exact').toBe(VER455_GIT_BLOB);
  return restored;
}

function restoredVer451Css(ver455) {
  const anchorAt = ver455.indexOf(REINSERT_BEFORE);
  expect(ver455.split(REINSERT_BEFORE)).toHaveLength(2);
  expect(anchorAt, 'the Today CSS anchor must be retained').toBeGreaterThan(-1);
  const restored = ver455.slice(0, anchorAt) + RETIRED_V455_DECORATION + ver455.slice(anchorAt);
  expect(blobSha(restored), 'Ver.451 stylesheet restoration must be exact').toBe(VER451_GIT_BLOB);
  return restored;
}

function originalBeforeDedupe(ver451) {
  const start = ver451.indexOf(priorityStart);
  const end = ver451.indexOf(afterCanonical, start);
  expect(start, 'retained canonical priority group must exist').toBeGreaterThan(-1);
  expect(end, 'canonical group boundary must exist').toBeGreaterThan(start);
  const canonical = ver451.slice(start, end);
  expect(ver451.split(priorityStart)).toHaveLength(2);
  expect(ver451.split(earlyAnchor)).toHaveLength(2);
  expect(canonical).toContain('.priority-row.priority-緊急');
  expect(canonical).toContain('.priority-row.priority-低');
  expect(canonical.endsWith('\n\n')).toBe(true);
  return ver451.replace(earlyAnchor, canonical + earlyAnchor);
}

const variants = [
  'task-card priority-card priority-緊急',
  'task-card priority-card priority-高',
  'task-card priority-card priority-中',
  'task-card priority-card priority-低',
  'priority-row priority-緊急',
  'priority-row priority-高',
  'priority-row priority-中',
  'priority-row priority-低',
  'task-card priority-card priority-緊急 due-today',
  'task-card priority-card priority-高 overdue',
  'task-card priority-card priority-低 pinned',
  'task-card priority-card priority-中 stale'
];
const fields = [
  'border-left-color', 'border-left-style', 'border-left-width',
  'border-color', 'border-style', 'border-width', 'box-shadow', 'background-color',
  'background-image', 'color', 'display', 'box-sizing', 'padding-left', 'margin-left',
  'outline-color', 'outline-style', 'outline-width'
];

async function computedStyles(page, source) {
  const element = await page.addStyleTag({ content: source });
  try {
    return await page.evaluate(props => [...document.querySelectorAll('[data-css-v451]')].map(node => {
      const style = getComputedStyle(node);
      return Object.fromEntries(props.map(property => [property, style.getPropertyValue(property)]));
    }), fields);
  } finally {
    await element.evaluate(node => node.remove());
  }
}

test('Ver.451: deleting only earlier duplicate priority declarations preserves Chromium cascade', async ({ page }) => {
  const ver457 = restoredVer457Css();
  const ver456 = restoredVer456Css(ver457);
  const ver455 = restoredVer455Css(ver456);
  const ver451 = restoredVer451Css(ver455);
  const original = originalBeforeDedupe(ver451);
  expect(blobSha(original), 'the restored old stylesheet must exactly match Git Ver.450').toBe(ORIGINAL_GIT_BLOB);
  expect(blobSha(current), 'Ver.458 current stylesheet must be exact').toBe(CURRENT_GIT_BLOB);
  expect(Buffer.byteLength(original) - Buffer.byteLength(ver451)).toBe(510);
  expect(Buffer.byteLength(ver451) - Buffer.byteLength(ver455)).toBe(582);
  expect(Buffer.byteLength(ver455) - Buffer.byteLength(ver456)).toBe(826);
  expect(Buffer.byteLength(ver456) - Buffer.byteLength(ver457)).toBe(1532);
  expect(Buffer.byteLength(ver457) - Buffer.byteLength(current)).toBe(2714);

  await page.setContent('<!doctype html><html><body><main class="app-shell"><section class="today-mode">' +
    variants.map((classes, index) => '<div data-css-v451="' + index + '" class="' + classes + '">Fixture</div>').join('') +
    '</section></main></body></html>');

  for (const width of [390, 860, 861, 980, 1366, 1450, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const before = await computedStyles(page, original);
    const afterVer451 = await computedStyles(page, ver451);
    const afterVer455 = await computedStyles(page, ver455);
    const afterVer456 = await computedStyles(page, ver456);
    const afterVer457 = await computedStyles(page, ver457);
    const afterVer458 = await computedStyles(page, current);
    expect(afterVer451, 'Ver.451 must match immutable Ver.450 at width ' + width).toEqual(before);
    expect(afterVer455, 'Ver.455 must preserve the Ver.451 cascade at width ' + width).toEqual(afterVer451);
    expect(afterVer456, 'Ver.456 must preserve the Ver.455 cascade at width ' + width).toEqual(afterVer455);
    expect(afterVer457, 'Ver.457 must preserve the Ver.456 cascade at width ' + width).toEqual(afterVer456);
    expect(afterVer458, 'Ver.458 must preserve the Ver.457 cascade at width ' + width).toEqual(afterVer457);
  }
});

async function cachedLayoutSnapshot(page, source) {
  const stylesheet = await page.addStyleTag({ content: source });
  try {
    return await page.evaluate(() => {
      const styleValues = (selector, fields) => {
        const element = document.querySelector(selector);
        const style = getComputedStyle(element);
        return Object.fromEntries(fields.map(field => [field, style.getPropertyValue(field)]));
      };
      const density = document.querySelector('.density-switcher');
      const densityRect = density.getBoundingClientRect();
      return {
        legacyDensityDisplay: getComputedStyle(density).display,
        legacyDensityOccupiedSpace: [densityRect.width, densityRect.height],
        hero: styleValues('.hero', ['min-height', 'padding-top', 'padding-bottom', 'height']),
        eyebrow: styleValues('.hero .eyebrow', ['display', 'font-size']),
        title: styleValues('.hero h2', ['font-size', 'line-height']),
        toolbar: styleValues('.toolbar', ['display', 'grid-template-columns', 'grid-template-areas', 'gap']),
        search: styleValues('.search-box', ['display', 'width']),
        sort: styleValues('#sortSelect', ['display', 'width'])
      };
    });
  } finally {
    await stylesheet.evaluate(node => node.remove());
  }
}

test('Ver.456: obsolete cached density and compact-header markup stays visually neutral', async ({ page }) => {
  const ver457 = restoredVer457Css();
  const ver456 = restoredVer456Css(ver457);
  const ver455 = restoredVer455Css(ver456);
  await page.setContent(
    '<!doctype html><html><body><div class="app-shell compact-header">' +
    '<aside class="sidebar">Menu</aside><main class="main">' +
    '<header class="hero"><div><p class="eyebrow">Board</p><h2>Work Board</h2></div></header>' +
    '<section class="toolbar">' +
    '<div class="density-switcher"><select><option>Old density</option></select></div>' +
    '<label class="search-box"><input aria-label="Search" /></label>' +
    '<select id="sortSelect"><option>Priority</option></select>' +
    '</section></main></div></body></html>'
  );
  for (const width of [390, 860, 861, 980, 1100, 1366, 1450, 1500, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const before = await cachedLayoutSnapshot(page, ver455);
    const afterVer456 = await cachedLayoutSnapshot(page, ver456);
    const afterVer457 = await cachedLayoutSnapshot(page, ver457);
    const after = await cachedLayoutSnapshot(page, current);
    expect(before.legacyDensityDisplay).toBe('none');
    expect(before.legacyDensityOccupiedSpace).toEqual([0, 0]);
    expect(afterVer456, 'Ver.456 legacy controls changed at ' + width + 'px').toEqual(before);
    expect(afterVer457, 'Ver.457 legacy controls changed at ' + width + 'px').toEqual(afterVer456);
    expect(after, 'Ver.458 legacy controls changed at ' + width + 'px').toEqual(afterVer457);
  }
});

async function legacyCompactSnapshot(page, source) {
  const stylesheet = await page.addStyleTag({ content: source });
  try {
    return await page.evaluate(() => {
      const capture = (selector, keys) => {
        const element = document.querySelector(selector);
        const style = getComputedStyle(element);
        return Object.fromEntries(keys.map(key => [key, style.getPropertyValue(key)]));
      };
      const hidden = document.querySelector('.hero-actions');
      const rect = hidden.getBoundingClientRect();
      return {
        hero: capture('.hero', ['display', 'height', 'padding-top', 'padding-right', 'min-height']),
        roomBadge: capture('.hero-room-badge', ['display', 'position', 'top', 'right']),
        removedActions: [getComputedStyle(hidden).display, rect.width, rect.height],
        card: capture('.task-card', ['display', 'padding-top', 'padding-left', 'gap', 'border-width']),
        title: capture('.task-title', ['font-size', 'line-height']),
        badge: capture('.task-meta .badge', ['font-size', 'padding-left']),
        // These two declarations are intentionally retained because older cached
        // compact-density markup still uses them.
        meta: capture('.task-meta', ['gap']),
        due: capture('.due-line', ['font-size']),
        toolbar: capture('.toolbar', ['display', 'grid-template-areas']),
        sort: capture('#sortSelect', ['display', 'width'])
      };
    });
  } finally {
    await stylesheet.evaluate(node => node.remove());
  }
}

test('Ver.457: retired compact density and hidden hero action styles do not change rendered layout', async ({ page }) => {
  const ver457 = restoredVer457Css();
  const ver456 = restoredVer456Css(ver457);
  await page.setContent(
    '<!doctype html><html><body><div class="app-shell compact-density">' +
    '<aside class="sidebar">Menu</aside><main class="main">' +
    '<header class="hero"><div><p class="eyebrow">Board</p><h2>Work Board</h2></div>' +
    '<div class="hero-actions"><button class="hero-compact-button">Old UI</button></div>' +
    '<span class="hero-room-badge">Room</span></header>' +
    '<section class="toolbar"><select id="sortSelect"><option>Priority</option></select></section>' +
    '<section class="task-list"><article class="task-card">' +
    '<h3 class="task-title">Existing task</h3>' +
    '<div class="task-meta"><span class="badge">Medium</span></div>' +
    '<div class="due-line">2026-10-14</div></article></section>' +
    '</main></div></body></html>'
  );
  for (const width of [390, 860, 861, 980, 1100, 1366, 1450, 1500, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const before = await legacyCompactSnapshot(page, ver456);
    const afterVer457 = await legacyCompactSnapshot(page, ver457);
    const after = await legacyCompactSnapshot(page, current);
    expect(before.removedActions, 'old hero actions should be hidden at ' + width + 'px').toEqual(['none', 0, 0]);
    expect(afterVer457, 'Ver.457 visible/cached layout changed at ' + width + 'px').toEqual(before);
    expect(after, 'Ver.458 visible/cached layout changed at ' + width + 'px').toEqual(afterVer457);
  }
});
