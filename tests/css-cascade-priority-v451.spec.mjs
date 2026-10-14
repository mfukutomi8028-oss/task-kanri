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
const VER458_GIT_BLOB = '2c94815860ed06a641274b76b42b82a97b4b326c';
const VER459_GIT_BLOB = '8796f7435710fa269b172fb1908f12426a17743a';
const CURRENT_GIT_BLOB = '8089d0781f240a8c01b9c58b15d4e29ca7ffca3e';
const VER460_RETIRED_HERO = [[51587,"/* ヘッダー右上の操作と共有ルームが重ならないように位置を分離 */\n.hero {\n  padding-right: 270px;\n}\n\n.hero-room-badge {\n  position: absolute !important;\n  top: 66px;\n  right: 34px;\n  z-index: 2;\n}\n\n"],[52882,"  .hero-room-badge {\n    position: relative !important;\n    top: auto;\n    right: auto;\n  }\n\n"],[53418,".hero {\n  position: relative !important;\n  padding-right: 320px !important;\n}\n\n"],[53737,"/* 共有ルームの上にボタンが透けて見えないよう、背景を少し濃くして可読性優先 */\n.hero-room-badge {\n  background: rgba(255,255,255,.22) !important;\n  border: 1px solid rgba(255,255,255,.36) !important;\n  color: #fff !important;\n  box-shadow: 0 10px 24px rgba(7,31,45,.16) !important;\n}\n\n"]];
// Four exact Ver.458 responsive toolbar fragments, for lossless historical restoration.
const VER459_RETIRED_TOOLBAR = [[51780,".toolbar {\n  grid-template-columns:\n    minmax(170px, 260px)\n    minmax(180px, 1fr)\n    minmax(200px, auto)\n    minmax(130px, auto)\n    minmax(260px, 1.15fr)\n    minmax(170px, 220px) !important;\n  max-width: 100%;\n  overflow: hidden;\n}\n\n"],[53027,"@media (max-width: 1500px) {\n  .toolbar {\n    grid-template-columns: minmax(170px, 260px) minmax(180px, 1fr) minmax(200px, auto) minmax(260px, 1fr) !important;\n  }\n\n  .search-box {\n    grid-column: 2 / 4;\n  }\n\n  .toolbar > #sortSelect {\n    grid-column: 4 / 5;\n  }\n}\n\n"],[53480,"  .toolbar {\n    grid-template-columns: 1fr !important;\n  }\n\n  .task-view-switcher,\n  .density-switcher {\n    width: 100%;\n  }\n\n  .task-view-buttons {\n    flex-wrap: wrap;\n  }\n\n  .search-box,\n  .toolbar > #sortSelect,\n  .density-switcher {\n    grid-column: auto;\n  }\n"],[55157,"  .toolbar,\n  .today-mode .toolbar,\n  .dashboard-mode .toolbar,\n  .schedule-mode .toolbar {\n    grid-template-columns: 1fr !important;\n    grid-template-areas:\n      \"new\"\n      \"quick\"\n      \"search\"\n      \"sort\"\n      \"density\"\n      \"view\" !important;\n  }\n\n  .quick-add {\n    grid-template-columns: minmax(180px, 1fr) 64px !important;\n  }\n"]];
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

function restoredVer459Css() {
  let restored = current;
  for (const [offset, fragment] of VER460_RETIRED_HERO) {
    restored = restored.slice(0, offset) + fragment + restored.slice(offset);
  }
  expect(blobSha(restored), 'Ver.459 stylesheet restoration must be exact').toBe(VER459_GIT_BLOB);
  return restored;
}

function restoredVer458Css() {
  let restored = restoredVer459Css();
  for (const [offset, fragment] of VER459_RETIRED_TOOLBAR) {
    restored = restored.slice(0, offset) + fragment + restored.slice(offset);
  }
  expect(blobSha(restored), 'Ver.458 stylesheet restoration must be exact').toBe(VER458_GIT_BLOB);
  return restored;
}

function restoredVer457Css(ver458) {
  const at = ver458.indexOf(VER458_REINSERT_BEFORE);
  expect(ver458.split(VER458_REINSERT_BEFORE)).toHaveLength(2);
  expect(at, 'the narrow viewport block must remain as our unique anchor').toBeGreaterThan(-1);
  const restored = ver458.slice(0, at) + VER458_RETIRED_TOOLBAR + ver458.slice(at);
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
  const ver459 = restoredVer459Css();
  const ver458 = restoredVer458Css();
  const ver457 = restoredVer457Css(ver458);
  const ver456 = restoredVer456Css(ver457);
  const ver455 = restoredVer455Css(ver456);
  const ver451 = restoredVer451Css(ver455);
  const original = originalBeforeDedupe(ver451);
  expect(blobSha(original), 'the restored old stylesheet must exactly match Git Ver.450').toBe(ORIGINAL_GIT_BLOB);
  expect(blobSha(current), 'Ver.460 current stylesheet must be exact').toBe(CURRENT_GIT_BLOB);
  expect(Buffer.byteLength(original) - Buffer.byteLength(ver451)).toBe(510);
  expect(Buffer.byteLength(ver451) - Buffer.byteLength(ver455)).toBe(582);
  expect(Buffer.byteLength(ver455) - Buffer.byteLength(ver456)).toBe(826);
  expect(Buffer.byteLength(ver456) - Buffer.byteLength(ver457)).toBe(1532);
  expect(Buffer.byteLength(ver457) - Buffer.byteLength(ver458)).toBe(2714);
  expect(Buffer.byteLength(ver458) - Buffer.byteLength(ver459)).toBe(1114);
  expect(Buffer.byteLength(ver459) - Buffer.byteLength(current)).toBe(719);

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
    const afterVer458 = await computedStyles(page, ver458);
    const afterVer459 = await computedStyles(page, ver459);
    const afterVer460 = await computedStyles(page, current);
    expect(afterVer451, 'Ver.451 must match immutable Ver.450 at width ' + width).toEqual(before);
    expect(afterVer455, 'Ver.455 must preserve the Ver.451 cascade at width ' + width).toEqual(afterVer451);
    expect(afterVer456, 'Ver.456 must preserve the Ver.455 cascade at width ' + width).toEqual(afterVer455);
    expect(afterVer457, 'Ver.457 must preserve the Ver.456 cascade at width ' + width).toEqual(afterVer456);
    expect(afterVer458, 'Ver.458 must preserve the Ver.457 cascade at width ' + width).toEqual(afterVer457);
    expect(afterVer459, 'Ver.459 must preserve the Ver.458 cascade at width ' + width).toEqual(afterVer458);
    expect(afterVer460, 'Ver.460 must preserve the Ver.459 cascade at width ' + width).toEqual(afterVer459);
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
  const ver458 = restoredVer458Css();
  const ver457 = restoredVer457Css(ver458);
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
    const afterVer458 = await cachedLayoutSnapshot(page, ver458);
    const after = await cachedLayoutSnapshot(page, current);
    expect(before.legacyDensityDisplay).toBe('none');
    expect(before.legacyDensityOccupiedSpace).toEqual([0, 0]);
    expect(afterVer456, 'Ver.456 legacy controls changed at ' + width + 'px').toEqual(before);
    expect(afterVer457, 'Ver.457 legacy controls changed at ' + width + 'px').toEqual(afterVer456);
    expect(afterVer458, 'Ver.458 legacy controls changed at ' + width + 'px').toEqual(afterVer457);
    expect(after, 'Ver.459 legacy controls changed at ' + width + 'px').toEqual(afterVer458);
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
  const ver458 = restoredVer458Css();
  const ver457 = restoredVer457Css(ver458);
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
    const afterVer458 = await legacyCompactSnapshot(page, ver458);
    const after = await legacyCompactSnapshot(page, current);
    expect(before.removedActions, 'old hero actions should be hidden at ' + width + 'px').toEqual(['none', 0, 0]);
    expect(afterVer457, 'Ver.457 visible/cached layout changed at ' + width + 'px').toEqual(before);
    expect(afterVer458, 'Ver.458 visible/cached layout changed at ' + width + 'px').toEqual(afterVer457);
    expect(after, 'Ver.459 visible/cached layout changed at ' + width + 'px').toEqual(afterVer458);
  }
});

async function taskToolbarSnapshot(page, stylesheetText) {
  const sheet = await page.addStyleTag({ content: stylesheetText });
  try {
    return await page.evaluate(() => {
      const measure = (selector, properties, withBox = false) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error('Missing toolbar fixture node: ' + selector);
        const css = getComputedStyle(el);
        const values = Object.fromEntries(properties.map(p => [p, css.getPropertyValue(p)]));
        if (withBox) {
          const box = el.getBoundingClientRect();
          values.rect = [box.x, box.y, box.width, box.height];
        }
        return values;
      };
      return {
        toolbar: measure('.toolbar', ['display', 'grid-template-columns', 'grid-template-areas', 'gap', 'align-items', 'max-width', 'overflow-x', 'overflow-y'], true),
        addTask: measure('.toolbar-new-task', ['display', 'grid-area', 'width'], true),
        quick: measure('.quick-add', ['display', 'grid-area', 'grid-template-columns', 'gap', 'width', 'min-width'], true),
        quickInput: measure('.quick-add input', ['width', 'min-width'], true),
        quickButton: measure('#quickAddButton', ['width', 'min-width', 'padding-left', 'padding-right'], true),
        search: measure('.search-box', ['display', 'grid-area', 'grid-column', 'width'], true),
        sort: measure('#sortSelect', ['display', 'grid-area', 'grid-column', 'width'], true),
        switcher: measure('.task-view-switcher', ['display', 'grid-area', 'width', 'max-width'], true),
        switchButtons: measure('.task-view-buttons', ['display', 'flex-wrap'], true),
        legacyDensity: measure('.density-switcher', ['display'], true),
        room: measure('.hero-room-badge', ['display', 'position', 'top', 'right'], true)
      };
    });
  } finally {
    await sheet.evaluate(node => node.remove());
  }
}

for (const mode of ['task-mode', 'today-mode', 'dashboard-mode', 'schedule-mode']) {
  test('Ver.458 superseded toolbar v32 matches v33 across modes: ' + mode, async ({ page }) => {
    const ver458 = restoredVer458Css();
  const ver457 = restoredVer457Css(ver458);
    await page.setContent(
      '<!doctype html><html><body class="' + mode + '">' +
      '<div class="app-shell"><aside class="sidebar">Menu</aside><main class="main">' +
      '<header class="hero"><span class="hero-room-badge">Room</span></header>' +
      '<section class="toolbar">' +
      '<button class="toolbar-new-task">New</button>' +
      '<div class="quick-add"><input aria-label="Quick task" /><button id="quickAddButton" class="ghost-button">+</button></div>' +
      '<label class="search-box"><input aria-label="Search" /></label>' +
      '<select id="sortSelect"><option>Priority</option></select>' +
      '<div class="density-switcher">Retired density</div>' +
      '<div class="task-view-switcher"><div class="task-view-buttons"><button>List</button></div></div>' +
      '</section></main></div></body></html>'
    );
    for (const width of [390, 860, 861, 979, 980, 981, 1099, 1100, 1101, 1280, 1366, 1450, 1451, 1499, 1500, 1501, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const before = await taskToolbarSnapshot(page, ver457);
      const afterVer458 = await taskToolbarSnapshot(page, ver458);
      const after = await taskToolbarSnapshot(page, current);
      expect(before.legacyDensity.display, 'retired control should remain hidden').toBe('none');
      expect(before.legacyDensity.rect.slice(2)).toEqual([0, 0]);
      expect(afterVer458, 'Ver.458 toolbar layout changed at ' + width + 'px in ' + mode).toEqual(before);
      expect(after, 'Ver.459 toolbar layout changed at ' + width + 'px in ' + mode).toEqual(afterVer458);
    }
  });
}

async function heroBadgeSnapshot(page, stylesheet) {
  const sheet = await page.addStyleTag({ content: stylesheet });
  try {
    return await page.evaluate(() => {
      const read = (selector, properties) => {
        const node = document.querySelector(selector);
        const style = getComputedStyle(node);
        const box = node.getBoundingClientRect();
        return { values: Object.fromEntries(properties.map(p => [p, style.getPropertyValue(p)])),
          rect: [box.x, box.y, box.width, box.height] };
      };
      return {
        hero: read('.hero', ['display', 'position', 'padding-right', 'padding-top', 'height', 'min-height']),
        room: read('.hero-room-badge', ['display', 'position', 'top', 'right', 'margin-top', 'transform', 'z-index', 'background-color', 'color', 'border-color', 'box-shadow']),
        aliasRoom: read('.room-pill', ['position', 'top', 'right', 'z-index', 'transform']),
        nestedBadge: read('.hero .room-badge', ['position', 'top', 'right', 'z-index', 'transform']),
        toolbar: read('.toolbar', ['grid-template-columns', 'grid-template-areas', 'gap']),
        sidebar: read('.sidebar', ['position', 'height'])
      };
    });
  } finally {
    await sheet.evaluate(el => el.remove());
  }
}

for (const mode of ['task-mode', 'today-mode', 'dashboard-mode', 'schedule-mode']) {
  test('Ver.460 superseded v31/v32 hero and badge declarations preserve v33: ' + mode, async ({ page }) => {
    const old = restoredVer459Css();
    await page.setContent('<!doctype html><html><body class="' + mode + '">' +
      '<div class="app-shell"><aside class="sidebar">Menu</aside><main class="main">' +
      '<header class="hero"><h2>Board</h2><span class="hero-room-badge">Room</span>' +
      '<span class="room-pill">Alias</span><span class="room-badge">Legacy</span></header>' +
      '<section class="toolbar"><button class="toolbar-new-task">New task</button>' +
      '<div class="quick-add"><input aria-label="Quick add" /></div>' +
      '<label class="search-box"><input /></label><select id="sortSelect"><option>Sort</option></select>' +
      '</section></main></div></body></html>');
    for (const width of [390, 760, 860, 861, 979, 980, 981, 1099, 1100, 1101, 1280, 1366, 1450, 1500, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const baseline = await heroBadgeSnapshot(page, old);
      const latest = await heroBadgeSnapshot(page, current);
      expect(latest, 'Ver.460 hero/badge layout changed at ' + width + 'px in ' + mode).toEqual(baseline);
    }
  });
}
