import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deployedVer476 = readFileSync(path.join(ROOT, 'style.css'), 'utf8');
// Exact UTF-16 source offsets from Ver.475; restore before immutable Ver.451-475 lineage checks.
const VER476_RETIRED_RULES = [[128954,".activity-head::before {\n  content: none !important;\n}\n\n"],[132162,".activity-head::before {\n  content: none !important;\n}\n\n"],[132659,".activity-title-main {\n  display: contents !important;\n}\n\n"],[134007,".activity-count {\n  display: inline-flex !important;\n  align-items: center !important;\n  justify-content: center !important;\n  min-width: 34px !important;\n  height: 24px !important;\n  padding: 0 9px !important;\n  border-radius: 999px !important;\n  background: #fff3f5 !important;\n  color: #d53b55 !important;\n  border: 1px solid #ffbdc7 !important;\n  box-shadow: none !important;\n  font-size: 12px !important;\n  font-weight: 1000 !important;\n  line-height: 1 !important;\n}\n\n"],[134700,".activity-head::before {\n  content: none !important;\n}\n\n"],[135196,".activity-title-main {\n  display: contents !important;\n}\n\n"],[135835,".activity-title-bell::before,\n.activity-title-bell::after {\n  content: none !important;\n  display: none !important;\n}\n\n"],[135954,".activity-title-text {\n  color: #0d2f4a !important;\n  font-size: 19px !important;\n  font-weight: 1000 !important;\n  letter-spacing: .02em !important;\n  line-height: 1 !important;\n  padding: 0 !important;\n  border: 0 !important;\n  border-radius: 0 !important;\n  background: transparent !important;\n  box-shadow: none !important;\n}\n\n"],[136285,".activity-count {\n  display: inline-flex !important;\n  align-items: center !important;\n  justify-content: center !important;\n  min-width: 34px !important;\n  height: 24px !important;\n  padding: 0 9px !important;\n  border-radius: 999px !important;\n  background: #fff3f5 !important;\n  color: #d53b55 !important;\n  border: 1px solid #ffbdc7 !important;\n  box-shadow: none !important;\n  font-size: 12px !important;\n  font-weight: 1000 !important;\n  line-height: 1 !important;\n}\n\n"]];
const deployedVer475 = restoreDeletedFragments(
  deployedVer476, VER476_RETIRED_RULES, '6324f0fa114f28517c7c28949654fbfb180a323e', '475'
);
const VER475_LEGACY_ICON_RULE = ".activity-title-icon {\n  display: none !important;\n}\n";
const VER475_LEGACY_ICON_RULE_BLOCK = ".activity-title-icon {\n  display: none !important;\n}\n\n";
const VER475_REMOVED_EARLY_ICON = "/* v66の旧アイコン指定が残っていても非表示にする */\n.activity-title-icon {\n  display: none !important;\n}\n\n\n";
const VER475_ANCHOR_V68 = "/* =========================================================\n   v68 お知らせタイトルUI再調整";
const VER475_ANCHOR_V70 = "/* =========================================================\n   v70-fixed お知らせタイトルUI";
const VER475_ANCHOR_V71 = "/* =========================================================\n   v71-fixed お知らせタイトルUI";
const VER475_ANCHOR_BG = ".activity-head {\n  background: linear-gradient(135deg, rgba(255,255,255,.94), rgba(241,248,252,.78)) !important;\n}\n\n.activity-head p {\n  margin-top: 10px !important;\n}\n";
// Restore the exact Ver.474 CSS so existing Ver.451-474 lineage checks are unchanged.
function restoredVer474Css(source) {
  if (source.includes(VER475_REMOVED_EARLY_ICON) ||
      source.split(VER475_LEGACY_ICON_RULE).length !== 2 ||
      source.split(VER475_ANCHOR_V71).length !== 2) {
    throw new Error('Ver.475 legacy-icon removal is not unique');
  }
  let result = source;
  for (const [anchor, removed] of [
    [VER475_ANCHOR_BG, VER475_LEGACY_ICON_RULE_BLOCK],
    [VER475_ANCHOR_V70, VER475_LEGACY_ICON_RULE_BLOCK],
    [VER475_ANCHOR_V68, VER475_REMOVED_EARLY_ICON]
  ]) {
    const index = result.indexOf(anchor);
    if (index < 0 || result.indexOf(anchor, index + anchor.length) >= 0) {
      throw new Error('Ver.475 restoration anchor is missing or duplicated');
    }
    result = result.slice(0, index) + removed + result.slice(index);
  }
  return result;
}
const deployed = restoredVer474Css(deployedVer475);
const VER474_REMOVED_EARLY_BLOCK = "/* 見出し下の区切りを少しだけ強め、D案らしく整理 */\n.activity-head {\n  background: linear-gradient(135deg, rgba(255,255,255,.94), rgba(241,248,252,.78)) !important;\n}\n\n.activity-head p {\n  margin-top: 10px !important;\n}\n\n\n";
const VER474_IDENTICAL_RULES = ".activity-head {\n  background: linear-gradient(135deg, rgba(255,255,255,.94), rgba(241,248,252,.78)) !important;\n}\n\n.activity-head p {\n  margin-top: 10px !important;\n}\n\n";
const VER474_ANCHOR = "/* =========================================================\n   v70-fixed お知らせタイトルUI";
// Restore the exact Ver.473 baseline before running immutable Ver.451–463 lineage tests.
function restoredVer473Css(source) {
  const position = source.indexOf(VER474_ANCHOR);
  if (position < 0 || source.indexOf(VER474_ANCHOR, position + VER474_ANCHOR.length) >= 0 ||
      source.includes(VER474_REMOVED_EARLY_BLOCK)) {
    throw new Error('Ver.474 activity-header restoration anchor or removed block is not unique');
  }
  return source.slice(0, position) + VER474_REMOVED_EARLY_BLOCK + source.slice(position);
}
const current = restoredVer473Css(deployed);
const ORIGINAL_GIT_BLOB = 'dd210b34000eff6703b24f0d32dd69a54e0675b9';
const VER451_GIT_BLOB = '4f2465e7f3367518ba71e931e60af2ea06bd52fd';
const VER455_GIT_BLOB = '19f3b65c6bd098efaf42b9a25d9c774802319539';
const VER456_GIT_BLOB = '62ec1fe101f2a6fdcc8351d27bf77fbd92f534e5';
const VER457_GIT_BLOB = '3542e775bb7eb6a63edcc51a3e1993be3394865a';
const VER458_GIT_BLOB = '2c94815860ed06a641274b76b42b82a97b4b326c';
const VER459_GIT_BLOB = '8796f7435710fa269b172fb1908f12426a17743a';
const VER460_GIT_BLOB = '8089d0781f240a8c01b9c58b15d4e29ca7ffca3e';
const VER461_GIT_BLOB = '7b4ba7d0fb0cdda7063c2365acd3017d196ef175';
const VER462_GIT_BLOB = '34866959f0cad0c73d86eb0ada670a9f3fb101df';
const CURRENT_GIT_BLOB = '6076091053232a392e37749fda74ac00db95649d';
const VER474_GIT_BLOB = '54e880f0defb70a07fc85d13abdaa2a6648749f1';
// Keep the exact Ver.462 sidebar block to guarantee byte-identical historical restoration.
const VER463_SIDEBAR_REPLACEMENT = {"offset":51893,"before":"/* 左メニューはページスクロールに追従し、下側が切れないよう独立スクロールにする */\n.sidebar {\n  position: sticky !important;\n  top: 0 !important;\n  align-self: flex-start !important;\n  height: 100vh !important;\n  max-height: 100vh !important;\n  overflow-y: auto !important;\n  overflow-x: hidden !important;\n}\n\n","after":"/* 旧画面のサイドバー整列は維持。固定位置・高さ・スクロールはv33が管理 */\n.sidebar {\n  align-self: flex-start !important;\n}\n\n"};
// Lossless Ver.461 reconstruction: original UTF-16 offsets and exact removed fragments.
const VER462_RETIRED_STYLES = [[28209,".toolbar {\n  grid-template-columns: 260px minmax(420px, 1fr) 220px !important;\n  align-items: center !important;\n}\n\n"],[28345,"  width: 260px !important;\n"],[28442,".search-box {\n  min-width: 0 !important;\n}\n\n"],[28536,"@media (max-width: 1100px) {\n  .toolbar {\n    grid-template-columns: 230px minmax(280px, 1fr) 190px !important;\n  }\n\n  .toolbar-new-task {\n    width: 230px !important;\n  }\n}\n\n"],[28711,"@media (max-width: 860px) {\n  .toolbar {\n    grid-template-columns: 1fr !important;\n  }\n\n  .toolbar-new-task {\n    width: 100% !important;\n  }\n}\n\n"],[47359,".quick-add {\n  display: grid;\n  grid-template-columns: minmax(180px, 1fr) auto;\n  gap: 8px;\n  min-width: 360px;\n}\n\n"]];
// Immutable Ver.460 snippets and original UTF-16 offsets; inserts reproduce the exact Git blob.
const VER461_RETIRED_STYLES = [[51692,".quick-add {\n  min-width: 0 !important;\n  grid-template-columns: minmax(120px, 1fr) auto !important;\n}\n\n"],[51796,".quick-add input {\n  min-width: 0;\n}\n\n"],[51861,"  min-width: 58px;\n  padding-left: 14px;\n  padding-right: 14px;\n"],[52184,".search-box {\n  min-width: 0;\n}\n\n"],[53397,"/* 狭幅・タブレットでは縦積みにする */\n@media (max-width: 980px) {\n  .sidebar {\n    position: relative !important;\n    height: auto !important;\n    max-height: none !important;\n  }\n\n  .hero {\n    padding-right: 24px !important;\n    padding-top: 76px !important;\n  }\n\n  .hero-room-badge {\n    position: relative !important;\n    top: auto !important;\n    right: auto !important;\n    margin-top: 12px !important;\n  }\n\n}\n\n"]];
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

// All historical offsets are UTF-16 positions in the source of the preceding version.
// Keep the insertion order and per-version blob validation unchanged.
function restoreDeletedFragments(source, fragments, expectedSha, version) {
  let restored = source;
  for (const [offset, fragment] of fragments) {
    restored = restored.slice(0, offset) + fragment + restored.slice(offset);
  }
  expect(blobSha(restored), 'Ver.' + version + ' stylesheet restoration must be exact').toBe(expectedSha);
  return restored;
}

function restoredVer462Css() {
  const { offset, before, after } = VER463_SIDEBAR_REPLACEMENT;
  expect(current.slice(offset, offset + after.length), 'Ver.463 replacement must remain at its original offset').toBe(after);
  const restored = current.slice(0, offset) + before + current.slice(offset + after.length);
  expect(blobSha(restored), 'Ver.462 stylesheet restoration must be exact').toBe(VER462_GIT_BLOB);
  return restored;
}

function restoredVer461Css() {
  return restoreDeletedFragments(restoredVer462Css(), VER462_RETIRED_STYLES, VER461_GIT_BLOB, '461');
}

function restoredVer460Css() {
  return restoreDeletedFragments(restoredVer461Css(), VER461_RETIRED_STYLES, VER460_GIT_BLOB, '460');
}

function restoredVer459Css() {
  return restoreDeletedFragments(restoredVer460Css(), VER460_RETIRED_HERO, VER459_GIT_BLOB, '459');
}

function restoredVer458Css() {
  return restoreDeletedFragments(restoredVer459Css(), VER459_RETIRED_TOOLBAR, VER458_GIT_BLOB, '458');
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
  return restoreDeletedFragments(ver457, VER457_RETIRED_STYLES, VER456_GIT_BLOB, '456');
}

function restoredVer455Css(ver456) {
  return restoreDeletedFragments(ver456, VER456_RETIRED_STYLES, VER455_GIT_BLOB, '455');
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
  const ver462 = restoredVer462Css();
  const ver461 = restoredVer461Css();
  const ver460 = restoredVer460Css();
  const ver459 = restoredVer459Css();
  const ver458 = restoredVer458Css();
  const ver457 = restoredVer457Css(ver458);
  const ver456 = restoredVer456Css(ver457);
  const ver455 = restoredVer455Css(ver456);
  const ver451 = restoredVer451Css(ver455);
  const original = originalBeforeDedupe(ver451);
  expect(blobSha(original), 'the restored old stylesheet must exactly match Git Ver.450').toBe(ORIGINAL_GIT_BLOB);
  expect(blobSha(current), 'Ver.463 current stylesheet must be exact').toBe(CURRENT_GIT_BLOB);
  expect(Buffer.byteLength(original) - Buffer.byteLength(ver451)).toBe(510);
  expect(Buffer.byteLength(ver451) - Buffer.byteLength(ver455)).toBe(582);
  expect(Buffer.byteLength(ver455) - Buffer.byteLength(ver456)).toBe(826);
  expect(Buffer.byteLength(ver456) - Buffer.byteLength(ver457)).toBe(1532);
  expect(Buffer.byteLength(ver457) - Buffer.byteLength(ver458)).toBe(2714);
  expect(Buffer.byteLength(ver458) - Buffer.byteLength(ver459)).toBe(1114);
  expect(Buffer.byteLength(ver459) - Buffer.byteLength(ver460)).toBe(719);
  expect(Buffer.byteLength(ver460) - Buffer.byteLength(ver461)).toBe(673);
  expect(Buffer.byteLength(ver461) - Buffer.byteLength(ver462)).toBe(623);
  expect(Buffer.byteLength(ver462) - Buffer.byteLength(current)).toBe(191);

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
    const afterVer460 = await computedStyles(page, ver460);
    const afterVer461 = await computedStyles(page, ver461);
    const afterVer462 = await computedStyles(page, ver462);
    const afterVer463 = await computedStyles(page, current);
    expect(afterVer451, 'Ver.451 must match immutable Ver.450 at width ' + width).toEqual(before);
    expect(afterVer455, 'Ver.455 must preserve the Ver.451 cascade at width ' + width).toEqual(afterVer451);
    expect(afterVer456, 'Ver.456 must preserve the Ver.455 cascade at width ' + width).toEqual(afterVer455);
    expect(afterVer457, 'Ver.457 must preserve the Ver.456 cascade at width ' + width).toEqual(afterVer456);
    expect(afterVer458, 'Ver.458 must preserve the Ver.457 cascade at width ' + width).toEqual(afterVer457);
    expect(afterVer459, 'Ver.459 must preserve the Ver.458 cascade at width ' + width).toEqual(afterVer458);
    expect(afterVer460, 'Ver.460 must preserve the Ver.459 cascade at width ' + width).toEqual(afterVer459);
    expect(afterVer461, 'Ver.461 must preserve the Ver.460 cascade at width ' + width).toEqual(afterVer460);
    expect(afterVer462, 'Ver.462 must preserve the Ver.461 cascade at width ' + width).toEqual(afterVer461);
    expect(afterVer463, 'Ver.463 must preserve the Ver.462 cascade at width ' + width).toEqual(afterVer462);
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

async function v461ResponsiveSnapshot(page, text) {
  const sheet = await page.addStyleTag({ content: text });
  try {
    return await page.evaluate(() => {
      const inspect = (selector, properties) => {
        const node = document.querySelector(selector);
        if (!node) throw new Error('Missing Ver.461 fixture node: ' + selector);
        const cs = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return {
          css: Object.fromEntries(properties.map(prop => [prop, cs.getPropertyValue(prop)])),
          rect: [rect.x, rect.y, rect.width, rect.height]
        };
      };
      return {
        scrollWidth: document.documentElement.scrollWidth,
        sidebar: inspect('.sidebar', ['display', 'position', 'top', 'right', 'bottom', 'left', 'height', 'max-height', 'align-self', 'overflow-x', 'overflow-y']),
        hero: inspect('.hero', ['display', 'position', 'padding-top', 'padding-right', 'min-height', 'height']),
        room: inspect('.hero-room-badge', ['display', 'position', 'top', 'right', 'transform', 'margin-top', 'z-index']),
        legacyRoom: inspect('.room-pill', ['position', 'top', 'right', 'transform']),
        toolbar: inspect('.toolbar', ['display', 'grid-template-columns', 'grid-template-areas', 'gap']),
        quick: inspect('.quick-add', ['display', 'grid-area', 'grid-template-columns', 'gap', 'width', 'min-width']),
        quickInput: inspect('.quick-add input', ['width', 'min-width', 'min-height']),
        newTask: inspect('.toolbar-new-task', ['width', 'min-width', 'grid-area', 'justify-self', 'text-align', 'white-space']),
        quickButton: inspect('.quick-add .ghost-button', ['min-width', 'width', 'padding-left', 'padding-right', 'white-space']),
        search: inspect('.search-box', ['min-width', 'width', 'grid-area']),
        searchInput: inspect('.search-box input', ['width', 'min-width']),
        view: inspect('.task-view-switcher', ['display', 'min-width', 'gap']),
        oldDensity: inspect('.density-switcher', ['display'])
      };
    });
  } finally {
    await sheet.evaluate(node => node.remove());
  }
}

for (const fixture of [
  { name: 'task', mode: 'task-mode', shell: 'app-shell' },
  { name: 'today', mode: 'today-mode', shell: 'app-shell' },
  { name: 'dashboard', mode: 'dashboard-mode', shell: 'app-shell' },
  { name: 'schedule', mode: 'schedule-mode', shell: 'app-shell' },
  { name: 'cached compact markup', mode: 'task-mode', shell: 'app-shell compact-header compact-density' }
]) {
  test('Ver.461 v31 quick add and v32 narrow styles are superseded: ' + fixture.name, async ({ page }) => {
    const baseline = restoredVer460Css();
    await page.setContent('<!doctype html><html><body class="' + fixture.mode + '">' +
      '<div class="' + fixture.shell + '"><aside class="sidebar">Menu</aside><main class="main">' +
      '<header class="hero"><h2>Board</h2><span class="hero-room-badge">Room</span>' +
      '<span class="room-pill">Cached alias</span></header>' +
      '<section class="toolbar"><button class="toolbar-new-task">New task</button>' +
      '<div class="quick-add"><input aria-label="Quick task" />' +
      '<button class="ghost-button" id="quickAddButton">Add</button></div>' +
      '<label class="search-box"><input aria-label="Search" /></label>' +
      '<select id="sortSelect"><option>Priority</option></select>' +
      '<div class="task-view-switcher"><div class="task-view-buttons">List</div></div>' +
      '<div class="density-switcher">Old density</div>' +
      '</section></main></div></body></html>');
    for (const width of [390, 760, 859, 860, 861, 919, 920, 921, 979, 980, 981, 1099, 1100, 1101, 1280, 1366, 1500, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const before = await v461ResponsiveSnapshot(page, baseline);
      const after = await v461ResponsiveSnapshot(page, current);
      expect(after.oldDensity.css.display, 'retired density control must remain hidden').toBe('none');
      expect(after, 'Ver.461 legacy/modern layout changed at ' + width + 'px in ' + fixture.name).toEqual(before);
    }
  });
}

for (const fixture of [
  { name: 'task', mode: 'task-mode', shell: 'app-shell' },
  { name: 'today', mode: 'today-mode', shell: 'app-shell' },
  { name: 'dashboard', mode: 'dashboard-mode', shell: 'app-shell' },
  { name: 'schedule', mode: 'schedule-mode', shell: 'app-shell' },
  { name: 'detail-open', mode: 'task-mode', shell: 'app-shell detail-open' },
  { name: 'cached compact and old app markup', mode: 'task-mode', shell: 'app-shell compact-density compact-header app' }
]) {
  test('Ver.462 legacy v15 toolbar / v29 quick-add removal preserves layout: ' + fixture.name, async ({ page }) => {
    const oldCss = restoredVer461Css();
    await page.setContent('<!doctype html><html><body class="' + fixture.mode + '">' +
      '<div class="' + fixture.shell + '"><aside class="sidebar">Menu</aside><main class="main">' +
      '<header class="hero"><h2>Board</h2><span class="hero-room-badge">Room</span><span class="room-pill">Cached Room</span></header>' +
      '<section class="toolbar"><button class="toolbar-new-task">New task</button>' +
      '<div class="quick-add"><input aria-label="Quick task" />' +
      '<button class="ghost-button" id="quickAddButton">Add</button></div>' +
      '<label class="search-box"><input aria-label="Search" /></label>' +
      '<select id="sortSelect"><option>Priority</option></select>' +
      '<div class="task-view-switcher"><div class="task-view-buttons">List</div></div>' +
      '<div class="density-switcher">Old density</div>' +
      '</section></main></div></body></html>');
    for (const width of [390, 760, 859, 860, 861, 979, 980, 981, 1099, 1100, 1101, 1279, 1280, 1366, 1449, 1450, 1451, 1500, 1719, 1720, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const before = await v461ResponsiveSnapshot(page, oldCss);
      const after = await v461ResponsiveSnapshot(page, current);
      expect(after.oldDensity.css.display, 'retired density must remain hidden').toBe('none');
      expect(after, 'Ver.462 toolbar/quick-add changed at ' + width + 'px in ' + fixture.name).toEqual(before);
    }
  });
}

async function v463SidebarSnapshot(page, source) {
  const tag = await page.addStyleTag({ content: source });
  try {
    return await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      const shell = document.querySelector('.app-shell');
      window.scrollTo(0, 180);
      sidebar.scrollTop = 110;
      const style = getComputedStyle(sidebar);
      const s = getComputedStyle(shell);
      const rect = sidebar.getBoundingClientRect();
      return {
        sidebar: Object.fromEntries(['position', 'top', 'right', 'bottom', 'left', 'inset', 'align-self',
          'height', 'max-height', 'min-height', 'width', 'overflow-x', 'overflow-y', 'z-index']
          .map(p => [p, style.getPropertyValue(p)])),
        box: [rect.x, rect.y, rect.width, rect.height],
        scroll: [sidebar.scrollTop, sidebar.scrollHeight, sidebar.clientHeight, window.scrollY,
          document.documentElement.scrollWidth],
        shell: [s.display, s.gridTemplateColumns, s.marginLeft]
      };
    });
  } finally {
    await tag.evaluate(node => node.remove());
  }
}

for (const fixture of [
  { name: 'task', body: 'task-mode', shell: 'app-shell' },
  { name: 'today', body: 'today-mode', shell: 'app-shell' },
  { name: 'dashboard', body: 'dashboard-mode', shell: 'app-shell' },
  { name: 'schedule', body: 'schedule-mode', shell: 'app-shell' },
  { name: 'detail-open', body: 'task-mode', shell: 'app-shell detail-open' },
  { name: 'cached app and compact', body: 'task-mode', shell: 'app-shell app compact-header compact-density' },
  { name: 'desktop pinned', body: 'task-mode desktop-sidebar-v158 desktop-sidebar-pinned', shell: 'app-shell detail-open' }
]) {
  test('Ver.463 v32 sidebar override cleanup preserves scrolling and layout: ' + fixture.name, async ({ page }) => {
    const beforeCss = restoredVer462Css();
    await page.setContent('<!doctype html><html><body class="' + fixture.body + '">' +
      '<div class="' + fixture.shell + '">' +
      '<aside class="sidebar"><nav style="height:1800px">Cached menu content</nav></aside>' +
      '<main class="main" style="min-height:2400px"><header class="hero">' +
      '<span class="hero-room-badge">Room</span><span class="room-pill">Cached room</span>' +
      '</header><section class="toolbar"></section></main></div></body></html>');
    for (const width of [390, 430, 760, 859, 860, 861, 919, 920, 979, 980, 981, 1099,
      1100, 1101, 1280, 1281, 1366, 1450, 1720, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const before = await v463SidebarSnapshot(page, beforeCss);
      const after = await v463SidebarSnapshot(page, current);
      expect(after, 'Ver.463 sidebar layout/scroll changed at ' + width + 'px in ' + fixture.name).toEqual(before);
    }
  });
}

test('Ver.474: remove only the earlier exact activity-header background/margin duplicate', async ({ page }) => {
  expect(blobSha(deployed), 'the proposed Ver.474 stylesheet must be exact').toBe(VER474_GIT_BLOB);
  expect(blobSha(current), 'Ver.473 stylesheet must be reconstructed byte-for-byte').toBe(CURRENT_GIT_BLOB);
  expect(current.replace(VER474_REMOVED_EARLY_BLOCK, '')).toBe(deployed);
  expect(VER474_REMOVED_EARLY_BLOCK.length).toBe(200);
  expect(Buffer.byteLength(VER474_REMOVED_EARLY_BLOCK, 'utf8')).toBe(244);
  expect(Buffer.byteLength(current, 'utf8') - Buffer.byteLength(deployed, 'utf8'))
    .toBe(Buffer.byteLength(VER474_REMOVED_EARLY_BLOCK, 'utf8'));
  expect(current.split(VER474_IDENTICAL_RULES)).toHaveLength(3);
  expect(deployed.split(VER474_IDENTICAL_RULES)).toHaveLength(2);
  expect(deployed).toContain(VER474_ANCHOR);

  const props = [
    'display', 'position', 'background', 'background-color', 'background-image',
    'background-position', 'margin-top', 'margin-bottom', 'padding', 'border',
    'box-shadow', 'color', 'font-size', 'font-weight', 'line-height', 'width',
    'height', 'min-height', 'opacity', 'visibility', 'overflow-x', 'transform'
  ];
  const capture = async css => {
    const tag = await page.addStyleTag({ content: css });
    try {
      return await page.evaluate(properties => {
        const snapshot = [...document.querySelectorAll('[data-ver474]')].map(element => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            role: element.getAttribute('data-ver474'),
            css: Object.fromEntries(properties.map(property => [property, style.getPropertyValue(property)])),
            box: [rect.x, rect.y, rect.width, rect.height]
          };
        });
        const before = getComputedStyle(document.querySelector('.activity-head'), '::before');
        const pseudo = Object.fromEntries(['content', 'display', 'background', 'opacity']
          .map(property => [property, before.getPropertyValue(property)]));
        return { snapshot, pseudo };
      }, props);
    } finally {
      await tag.evaluate(element => element.remove());
    }
  };

  for (const mode of ['task-mode', 'today-mode', 'dashboard-mode', 'schedule-mode', 'task-mode compact-density']) {
    await page.setContent('<!doctype html><html lang="ja"><body class="' + mode + '">' +
      '<div class="app-shell"><aside class="sidebar"></aside><main class="main">' +
      '<section class="activity-board"><header class="activity-head" data-ver474="head">' +
      '<h3 class="activity-title activity-title-emoji" data-ver474="title">' +
      '<span class="activity-title-main" data-ver474="main">' +
      '<span class="activity-title-bell" data-ver474="bell">🔔</span>' +
      '<span class="activity-title-icon" data-ver474="legacy-icon">i</span>' +
      '<span class="activity-title-text" data-ver474="text">お知らせ</span></span>' +
      '<span class="activity-count" data-ver474="count">3</span></h3>' +
      '<p data-ver474="description">通知の補足説明</p></header>' +
      '<article class="activity-item" data-ver474="item">通知本文</article>' +
      '</section></main></div></body></html>');
    for (const width of [390, 860, 861, 980, 1366, 1450, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const before = await capture(current);
      const after = await capture(deployed);
      expect(after, 'Activity header cascade changed for ' + mode + ' at ' + width + 'px').toEqual(before);
      const afterVer475 = await capture(deployedVer475);
      expect(afterVer475, 'Ver.475 legacy icon display/geometry changed for ' + mode + ' at ' + width + 'px').toEqual(after);
      const afterVer476 = await capture(deployedVer476);
      expect(afterVer476, 'Ver.476 activity decoration cascade changed for ' + mode + ' at ' + width + 'px')
        .toEqual(afterVer475);
    }
  }
});

test('Ver.475: redundant legacy icon declarations are removed and Ver.474 restores exactly', () => {
  expect(blobSha(deployed), 'Ver.474 CSS must be restored byte-for-byte').toBe(VER474_GIT_BLOB);
  expect(deployed.split(VER475_LEGACY_ICON_RULE)).toHaveLength(5);
  expect(deployedVer475.split(VER475_LEGACY_ICON_RULE)).toHaveLength(2);
  expect(deployedVer475).not.toContain(VER475_REMOVED_EARLY_ICON);
  expect(deployedVer475).toContain(VER475_ANCHOR_V68);
  expect(deployedVer475).toContain(VER475_ANCHOR_V70);
  expect(deployedVer475).toContain(VER475_ANCHOR_V71);
  const removed = VER475_REMOVED_EARLY_ICON + VER475_LEGACY_ICON_RULE_BLOCK.repeat(2);
  expect(Buffer.byteLength(deployed, 'utf8') - Buffer.byteLength(deployedVer475, 'utf8'))
    .toBe(Buffer.byteLength(removed, 'utf8'));
});

test('Ver.476: historical activity decorations deduplicate without weakening lineage', () => {
  expect(blobSha(deployedVer475), 'restored Ver.475 Git blob').toBe('6324f0fa114f28517c7c28949654fbfb180a323e');
  expect(VER476_RETIRED_RULES).toHaveLength(9);
  for (let i = 1; i < VER476_RETIRED_RULES.length; i++) {
    expect(VER476_RETIRED_RULES[i][0]).toBeGreaterThan(VER476_RETIRED_RULES[i - 1][0]);
  }
  const removedBytes = VER476_RETIRED_RULES.reduce(
    (sum, [, fragment]) => sum + Buffer.byteLength(fragment, 'utf8'), 0);
  expect(Buffer.byteLength(deployedVer475, 'utf8') - Buffer.byteLength(deployedVer476, 'utf8'))
    .toBe(removedBytes);
  expect(deployedVer476).not.toContain('.activity-head::before {\n  content: none !important;\n}');
  expect(deployedVer476.split('.activity-title-main {\n  display: contents !important;\n}')).toHaveLength(2);
  expect(deployedVer476).toContain('.activity-head::before {\n  content: none !important;\n  display: none !important;\n}');
});
