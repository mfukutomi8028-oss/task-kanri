const fs = require('fs');

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, text) { fs.writeFileSync(path, text); }
function exact(text, from, to, label) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 exact match, got ${count}`);
  return text.replace(from, to);
}
function replaceRange(text, start, end, replacement, label) {
  const a = text.indexOf(start);
  if (a < 0) throw new Error(`${label}: start missing`);
  const b = text.indexOf(end, a + start.length);
  if (b < 0) throw new Error(`${label}: end missing`);
  if (text.indexOf(start, a + 1) >= 0) throw new Error(`${label}: duplicate start`);
  return text.slice(0, a) + replacement + text.slice(b);
}

// mobile: remove the final Today-only dead helper.
{
  const path = 'mobile-fixes.js';
  let s = read(path);
  const fn = `
  function normalizeText(value) {
    return String(value || "").normalize("NFKC").trim().toLowerCase().replace(/\\s+/g, "");
  }
`;
  s = exact(s, fn, '\n', 'mobile normalizeText');
  for (const retired of ['normalizeText(', 'patchTodayView', 'data-workboard-auto-hidden', 'TODAY_EXCLUDED_STATUSES', 'SPARE_EXCLUDED_STATUSES', 'PROTECTED_DELETE_STATUSES']) {
    if (s.includes(retired)) throw new Error(`mobile Today residue: ${retired}`);
  }
  for (const kept of ['patchMobileBoardTabs', 'patchScheduleRangeButtons', 'syncMobileHeaderTitle', 'bindGlobalClicks', 'new MutationObserver(schedulePatch)']) {
    if (!s.includes(kept)) throw new Error(`unrelated mobile responsibility disappeared: ${kept}`);
  }
  write(path, s);
}

// stable comment only; behavior remains unchanged.
{
  const path = 'stable-fixes-v108.js';
  let s = read(path);
  const firstNl = s.indexOf('\n');
  if (firstNl < 0 || !s.slice(0, firstNl).includes('安定版補正')) throw new Error('stable header unexpected');
  s = '// Ver.202: 安定版補正。native日付制約とToday最終可視性は本ファイル、状態削除保護は app.js、スケジュール表示ラベルは schedule-today-lock-v129.js が所有する。' + s.slice(firstNl);
  write(path, s);
}

// release manifest: version only; inventory/order stays byte-for-byte otherwise.
{
  const path = 'release-manifest.js';
  let s = read(path);
  for (const [from, to, label] of [
    ['// Ver.201 のリリース正本。', '// Ver.202 のリリース正本。', 'manifest comment'],
    ['installFirstPaintGuardV201', 'installFirstPaintGuardV202', 'manifest guard'],
    ["const VERSION = '201';", "const VERSION = '202';", 'manifest VERSION'],
    ["const bootClass = 'wb-first-paint-v201';", "const bootClass = 'wb-first-paint-v202';", 'manifest boot'],
    ["guardStyle.id = 'wb-first-paint-style-v201';", "guardStyle.id = 'wb-first-paint-style-v202';", 'manifest style'],
    ['window.__WB_LEGACY_ICON_OBSERVER_V201__ = iconObserver;', 'window.__WB_LEGACY_ICON_OBSERVER_V202__ = iconObserver;', 'manifest observer'],
    ['version: "201",', 'version: "202",', 'manifest version']
  ]) s = exact(s, from, to, label);
  write(path, s);
}

// static Today ownership contract.
{
  const path = 'test-harness/foundation-overlap-v200.test.mjs';
  let s = read(path);
  const start = "test('Today ownership stays split: stable owns mine/group decisions while mobile owns status-only auto-hide markers', () => {";
  const end = "test('observer scopes stay distinct after mobile date retirement', () => {";
  const block = `test('Today final visibility is owned by stable while mobile retires status filtering', () => {
  const stableToday = functionBody(stable, '  function applyTodayFilters()');
  assert.match(stable, /const GROUP_ASSIGNEES = \\["システム課", "システム担当", "システム", "全員", "共通"\\];/);
  assert.match(stableToday, /mineFilterIsActive\\(\\)/);
  assert.match(stableToday, /isAllowedAssignee\\(task\\.assignee, currentUser\\)/);
  assert.match(stableToday, /data-v108-hidden/);
  assert.match(stableToday, /normalize\\("保留"\\)/);
  assert.match(stableToday, /normalize\\("確認待ち"\\)/);
  assert.match(stable, /#todayView \\[data-v108-hidden\\]\\s*\\{[\\s\\S]*?display: none !important;/);
  assert.doesNotMatch(stable, /#todayView \\[data-v108-hidden="true"\\]/);

  const mobilePatchAll = functionBody(mobile, '  function patchAll()');
  assert.doesNotMatch(mobile, /function patchTodayView\\s*\\(/);
  assert.doesNotMatch(mobile, /TODAY_EXCLUDED_STATUSES|SPARE_EXCLUDED_STATUSES|PROTECTED_DELETE_STATUSES/);
  assert.doesNotMatch(mobile, /data-workboard-auto-hidden/);
  assert.doesNotMatch(mobile, /getTaskStatus|readStatusFromTaskCard|loadTasksSnapshot|getRoomIdForStorage|normalizeText/);
  assert.doesNotMatch(mobilePatchAll, /patchTodayView/);
});

`;
  s = replaceRange(s, start, end, block, 'static Today block');
  write(path, s);
}

// foundation browser marker contract.
{
  const path = 'tests/foundation-overlap-v200.spec.mjs';
  let s = read(path);
  s = exact(s,
    "test('Today markers expose the current split between status exclusions and mine/group filtering on mobile', async ({ page }) => {",
    "test('Today visibility marker is owned only by stable on mobile', async ({ page }) => {", 'foundation UI title');
  s = exact(s, "await expect(hold).toHaveAttribute('data-workboard-auto-hidden', 'true');", "await expect(hold).not.toHaveAttribute('data-workboard-auto-hidden', 'true');", 'hold mobile marker');
  s = exact(s, "await expect(waiting).toHaveAttribute('data-workboard-auto-hidden', 'true');", "await expect(waiting).not.toHaveAttribute('data-workboard-auto-hidden', 'true');", 'waiting mobile marker');
  write(path, s);
}

// Ver.201 final-visibility contract remains authoritative and must not rely on mobile marker.
{
  const path = 'tests/today-visibility-v201.spec.mjs';
  let s = read(path);
  s = exact(s,
    '// stable/mobile双方の起動時遅延補正が完了してから競合遷移を検証する。',
    '// stableの起動時遅延補正が完了してから可視性遷移を検証する。', 'visibility boot comment');
  s = exact(s,
    "await expect(dualOther).toHaveAttribute('data-workboard-auto-hidden', 'true');",
    "await expect(dualOther).not.toHaveAttribute('data-workboard-auto-hidden', 'true');", 'dual mobile marker');
  write(path, s);
}

// release version contract.
{
  const path = 'test-harness/version-source-v194.test.mjs';
  let s = read(path);
  s = exact(s, 'Ver.201 manifest is the release-version source', 'Ver.202 manifest is the release-version source', 'version title');
  s = exact(s, 'version:\\s*["\']201["\']', 'version:\\s*["\']202["\']', 'version regex');
  s = exact(s, 'const VERSION = ["\']201["\']', 'const VERSION = ["\']202["\']', 'VERSION regex');
  write(path, s);
}

// machine-readable responsibility baseline.
{
  const path = 'patch-responsibilities.json';
  const data = JSON.parse(read(path));
  if (data.baselineRelease !== '201') throw new Error(`unexpected baseline ${data.baselineRelease}`);
  data.baselineRelease = '202';
  const foundation = data.groups.find(g => g.id === 'legacy-foundation');
  if (!foundation) throw new Error('legacy-foundation missing');
  foundation.reason += ' Ver.202でmobile側のToday状態除外・storage fallback・auto-hidden markerを退役し、状態除外とmine/groupを含む最終可視性をstable単独所有へ統一。';
  data.priorityCandidates = [{
    order: 1,
    scope: ['mobile-fixes.js'],
    goal: 'Ver.202でToday重複を退役したため、次はschedule-today-lock-v129.jsとmobile-fixes.jsに残る7日間表示補正の重複を監査し、schedule側を正本としてmobile側補正を退役できるか確認する。モバイル状態タブ・ヘッダー・メニュー・body-wide Observerは同時に変更しない。',
    precondition: 'Ver.202のstatic contract 67件、通常ブラウザ67件、Firebase Emulator 19件がgreenで、release-manifestがVer.202、mainのRegressionとPagesが成功していること。'
  }];
  write(path, JSON.stringify(data, null, 2) + '\n');
}

// historical audit: additive record.
{
  const path = 'FOUNDATION_OVERLAP_AUDIT_V200.md';
  let s = read(path);
  if (s.includes('## Ver.201〜202追補')) throw new Error('audit addendum exists');
  s += '\n## Ver.201〜202追補\n\nVer.201では最終可視性テストにより、空値の `data-v108-hidden` markerと値一致CSS selectorの不整合を検出し、`#todayView [data-v108-hidden]` を最終非表示安全網として修復した。\n\nVer.202ではその安全網を前提に、`mobile-fixes.js` のToday専用状態定数・storage snapshot読取・status fallback・`patchTodayView()`・`data-workboard-auto-hidden` markerを退役する。Todayの `保留`、空き時間の `確認待ち`、mine/group担当者判定、task/schedule最終可視性は `stable-fixes-v108.js` 単独所有とする。モバイル状態タブ・ヘッダー・スケジュール表示・Observerはこの工程では変更しない。\n';
  write(path, s);
}

// current responsibility map.
{
  const path = 'PATCH_RESPONSIBILITY_MAP.md';
  let s = read(path);
  s = exact(s, '# パッチ責務マップ（Ver.201 基準）', '# パッチ責務マップ（Ver.202 基準）', 'map title');
  s = exact(s,
    '| 基盤・旧安定化ロジック | 高 | **Ver.201でToday最終可視性を契約化しCSS安全網を修復。状態除外のstable/mobile重複は次工程で整理** |',
    '| 基盤・旧安定化ロジック | 高 | **Ver.202でToday状態除外のmobile重複を退役し、最終可視性をstable単独所有へ統一** |', 'map table');
  s = exact(s,
    '- Ver.201: Todayの最終可視性と状態/mine理由の遷移を実ブラウザで固定。監査で発見した空値 `data-v108-hidden` markerとCSS selectorの不一致を `[data-v108-hidden]` へ修復',
    '- Ver.201: Todayの最終可視性と状態/mine理由の遷移を実ブラウザで固定。監査で発見した空値 `data-v108-hidden` markerとCSS selectorの不一致を `[data-v108-hidden]` へ修復\n- Ver.202: mobile側のToday状態除外・snapshot読取・auto-hidden markerを退役し、状態除外＋mine/groupをstable単独所有へ統一', 'map history');
  const todayStart = '## Todayの現在境界';
  const recovery = '## 復旧地点';
  const todaySection = `## Todayの現在境界

- stable: \`保留\`、空き時間の\`確認待ち\`、mine/group担当者判定、task/scheduleの最終可視性を単独所有
- stable CSS: \`#todayView [data-v108-hidden]\` がmarker存在中の最終非表示を保証
- mobile: Ver.202でToday状態除外、storage snapshot読取、status fallback、\`data-workboard-auto-hidden\` を退役

Ver.201で固定した最終可視性契約はVer.202でも維持し、mobile markerが存在しないことを追加で確認する。

`;
  s = replaceRange(s, todayStart, recovery, todaySection, 'map Today');
  s = exact(s,
    '- `backup/ver200-before-today-visibility-audit`: `e9e281ac1b5e7eaa31e02fcaabfe45c98cdf9325`',
    '- `backup/ver200-before-today-visibility-audit`: `e9e281ac1b5e7eaa31e02fcaabfe45c98cdf9325`\n- `backup/ver201-before-today-owner`: `abeae4c79b887557a4077eb848173fce4b9a946e`', 'map recovery');
  const next = '## 次の工程';
  const i = s.indexOf(next);
  if (i < 0) throw new Error('map next missing');
  s = s.slice(0, i) + `## 次の工程

Todayの重複所有はVer.202で解消した。次は \`schedule-today-lock-v129.js\` と \`mobile-fixes.js\` に残る7日間表示補正の重複を監査し、schedule側へ正本化できるかを安全網先行で確認する。モバイル状態タブ・ヘッダー・メニュー・body-wide Observerの整理は別工程とする。
`;
  write(path, s);
}

// regression guide.
{
  const path = 'REGRESSION_TESTS.md';
  let s = read(path);
  s = exact(s, '# 回帰テスト基盤（Ver.201）', '# 回帰テスト基盤（Ver.202）', 'reg title');
  const firstBreak = s.indexOf('\n\n## CIで確認する範囲');
  if (firstBreak < 0) throw new Error('reg intro boundary missing');
  s = '# 回帰テスト基盤（Ver.202）\n\nこのテスト群は、業務管理ボードの整理・改修で既存挙動や見た目を壊さないための安全網です。Ver.202ではVer.201で固定したToday最終可視性を維持したまま、mobile側の重複状態除外を退役し、stableをToday可視性の単独正本にします。' + s.slice(firstBreak);
  s = exact(s, '- release versionが **201** であること', '- release versionが **202** であること', 'reg version');
  s = exact(s,
    '- Todayのmine/group担当者判定がstable固有で、mobileは状態除外だけを持つこと',
    '- Todayの状態除外・mine/group担当者判定・最終markerをstableが単独所有し、mobileにはTodayフィルタが残っていないこと', 'reg Today static');
  s = exact(s,
    '構造・契約テストは **67件**です。Ver.201では既存Today所有境界テスト内にCSS fallback契約を追加し、件数は増やしません。',
    '構造・契約テストは **67件**です。Ver.202では既存Today所有境界テストをstable単独所有契約へ更新し、件数は増やしません。', 'reg protocol');
  s = exact(s,
    'Ver.201では430px幅で、markerの有無だけでなく**最終可視性**を固定する専用テストを追加します。',
    'Ver.202では430px幅の最終可視性契約を維持し、mobileの旧 `data-workboard-auto-hidden` markerが付かないことも確認します。', 'reg browser');
  const changes = '## Ver.201で変更するもの';
  const firebase = '## Firebase Emulator E2E';
  const replacement = `## Ver.202で変更するもの

- \`mobile-fixes.js\` のToday専用状態定数・storage snapshot読取・status fallback・\`patchTodayView()\` を退役
- \`data-workboard-auto-hidden\` markerを退役
- stableをToday状態除外＋mine/group＋最終可視性の単独正本へ統一
- \`release-manifest.js\` をVer.202へ更新
- static/browser契約と責務台帳をVer.202へ更新

## Ver.202で変更しないもの

- \`stable-fixes-v108.js\` のToday判定意味論
- mine/group担当者ルール
- \`date-keyboard-fix-v127.js\`
- モバイル状態タブ・ヘッダー・メニュー・スケジュール表示
- dynamic CSS/JSの個数とロード順
- Firebase書込経路
- body-wide MutationObserver

つまりVer.202は、**Todayの重複状態除外を退役し、既存の最終可視性意味論をstable単独所有へ整理する版**です。

`;
  s = replaceRange(s, changes, firebase, replacement, 'reg change block');
  s = exact(s,
    '現在は **19件**です。Ver.201ではFirebase書込JavaScriptを変更しませんが、安全網として全件を継続実行します。',
    '現在は **19件**です。Ver.202でもFirebase書込JavaScriptを変更しませんが、安全網として全件を継続実行します。', 'reg emulator');
  s = exact(s,
    '- `backup/ver200-before-today-visibility-audit`: `e9e281ac1b5e7eaa31e02fcaabfe45c98cdf9325`',
    '- `backup/ver200-before-today-visibility-audit`: `e9e281ac1b5e7eaa31e02fcaabfe45c98cdf9325`\n- `backup/ver201-before-today-owner`: `abeae4c79b887557a4077eb848173fce4b9a946e`', 'reg recovery');
  const next = '## 次の段階';
  const i = s.indexOf(next);
  if (i < 0) throw new Error('reg next missing');
  s = s.slice(0, i) + `## 次の段階

Ver.202がgreenになった後は、\`schedule-today-lock-v129.js\` と \`mobile-fixes.js\` に残る7日間表示補正の重複を監査します。Todayと日付は正本化済みなので、body-wide MutationObserver削減はさらにその後の独立工程とします。
`;
  write(path, s);
}

const mobile = read('mobile-fixes.js');
const manifest = read('release-manifest.js');
if (/patchTodayView|data-workboard-auto-hidden|TODAY_EXCLUDED_STATUSES|SPARE_EXCLUDED_STATUSES|PROTECTED_DELETE_STATUSES|function normalizeText/.test(mobile)) throw new Error('mobile Today residue after finalize');
if (!manifest.includes('version: "202"') || !manifest.includes("const VERSION = '202';")) throw new Error('manifest not Ver.202');
console.log('Ver.202 finalizer completed');
