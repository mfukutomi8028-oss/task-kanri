from pathlib import Path
import json
import re

ROOT = Path('.')


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, got {count}')
    return text.replace(old, new, 1)

# 1) app.js: strengthen preview clarity without touching copy/write semantics.
app = read('app.js')
pattern = re.compile(r'function syncScheduleCopyPreview\(\) \{.*?\n\}\n\nasync function copyScheduleOccurrences', re.S)
new_preview = r'''function syncScheduleCopyPreview() {
  const source = scheduleCopySource();
  const result = buildScheduleCopyDates(source);
  const summary = $("scheduleCopyPreviewSummary");
  const datesHost = $("scheduleCopyPreviewDates");
  const note = $("scheduleCopyPreviewNote");
  const allDetails = $("scheduleCopyPreviewAll");
  const allSummary = $("scheduleCopyPreviewAllSummary");
  const allDatesHost = $("scheduleCopyPreviewAllDates");
  const conflictDetails = $("scheduleCopyConflictDetails");
  const conflictSummary = $("scheduleCopyConflictSummary");
  const conflictList = $("scheduleCopyConflictList");
  if (!summary || !datesHost || !note) return;

  const submit = $("scheduleCopySubmit");
  const resetDetails = () => {
    if (allDetails) allDetails.hidden = true;
    if (allDatesHost) allDatesHost.innerHTML = "";
    if (conflictDetails) conflictDetails.hidden = true;
    if (conflictList) conflictList.innerHTML = "";
  };

  if (result.error) {
    summary.textContent = result.error;
    datesHost.innerHTML = "";
    note.textContent = "";
    resetDetails();
    if (submit) { submit.disabled = true; submit.textContent = "条件を確認してください"; }
    return;
  }

  const conflicts = scheduleCopyConflicts(source, result.dates);
  const conflictsByDate = new Map();
  conflicts.forEach(item => {
    if (!conflictsByDate.has(item.date)) conflictsByDate.set(item.date, []);
    conflictsByDate.get(item.date).push(item);
  });
  const renderDateChip = date => {
    const hasConflict = conflictsByDate.has(date);
    return `<span${hasConflict ? ' class="has-conflict"' : ''} data-copy-preview-date="${escapeHtml(date)}">${escapeHtml(formatScheduleCopyDate(date))}${hasConflict ? '<b>重複</b>' : ''}</span>`;
  };

  summary.textContent = `${result.dates.length}件の予定を作成`;
  if (submit) {
    submit.disabled = result.truncated || result.dates.length < 1 || result.dates.length > SCHEDULE_COPY_MAX;
    submit.textContent = submit.disabled ? "条件を確認してください" : `${result.dates.length}件コピーする`;
  }

  datesHost.innerHTML = result.dates.slice(0, 8).map(renderDateChip).join("");
  if (allDetails && allSummary && allDatesHost) {
    if (result.dates.length > 8) {
      allDetails.hidden = false;
      allDetails.open = false;
      allSummary.textContent = `すべての日付を確認（${result.dates.length}件）`;
      allDatesHost.innerHTML = result.dates.map(renderDateChip).join("");
    } else {
      allDetails.hidden = true;
      allDetails.open = false;
      allDatesHost.innerHTML = "";
    }
  }

  if (conflictDetails && conflictSummary && conflictList) {
    if (conflictsByDate.size) {
      conflictDetails.hidden = false;
      conflictDetails.open = false;
      conflictSummary.textContent = `重複候補を確認（${conflictsByDate.size}日）`;
      conflictList.innerHTML = [...conflictsByDate.entries()].map(([date, items]) => {
        const titles = [...new Set(items.map(item => String(item.conflict?.title || "既存予定")))];
        return `<div class="schedule-copy-conflict-item"><strong>${escapeHtml(formatScheduleCopyDate(date))}</strong><span>${titles.map(escapeHtml).join(" / ")}</span></div>`;
      }).join("");
    } else {
      conflictDetails.hidden = true;
      conflictDetails.open = false;
      conflictList.innerHTML = "";
    }
  }

  const notes = [];
  if (result.truncated) notes.push(`最大${SCHEDULE_COPY_MAX}件を超えています。期間または間隔を調整してください。`);
  if (["monthlyDay", "yearly"].includes($("scheduleCopyMethod").value)) notes.push("存在しない日付（例：2月30日）は自動でスキップします。");
  if (conflictsByDate.size) notes.push(`「重複」表示のコピー先が${conflictsByDate.size}日あります。既存予定を確認してからコピーしてください。`);
  note.textContent = notes.join(" ");
}

async function copyScheduleOccurrences'''
app, count = pattern.subn(new_preview, app, count=1)
if count != 1:
    raise RuntimeError(f'app.js preview function: expected one replacement, got {count}')
write('app.js', app)

# 2) index.html: expose expandable all-date/conflict review and clarify the back action.
index = read('index.html')
old_preview = '''        <div id="scheduleCopyPreviewDates" class="schedule-copy-preview-dates"></div><p id="scheduleCopyPreviewNote"></p>'''
new_preview_html = '''        <div id="scheduleCopyPreviewDates" class="schedule-copy-preview-dates"></div>
        <details id="scheduleCopyPreviewAll" class="schedule-copy-preview-all" hidden>
          <summary id="scheduleCopyPreviewAllSummary">すべての日付を確認</summary>
          <div id="scheduleCopyPreviewAllDates" class="schedule-copy-preview-dates schedule-copy-preview-all-dates"></div>
        </details>
        <details id="scheduleCopyConflictDetails" class="schedule-copy-conflict-details" hidden>
          <summary id="scheduleCopyConflictSummary">重複候補を確認</summary>
          <div id="scheduleCopyConflictList" class="schedule-copy-conflict-list"></div>
        </details>
        <p id="scheduleCopyPreviewNote"></p>'''
index = replace_once(index, old_preview, new_preview_html, 'index preview block')
index = replace_once(index, '<button id="scheduleCopyBack" class="ghost-button" type="button">戻る</button>', '<button id="scheduleCopyBack" class="ghost-button" type="button">予定詳細へ戻る</button>', 'back button label')
write('index.html', index)

# 3) CSS: conflict emphasis, expandable verification lists, mobile readability.
css = read('ui-schedule-copy-v225.css')
marker = '/* Ver.227 preview verification */'
if marker in css:
    raise RuntimeError('Ver.227 CSS marker already exists')
css += '''\n/* Ver.227 preview verification */
.schedule-copy-preview-dates span.has-conflict{display:inline-flex;align-items:center;gap:6px;border:1px solid #e5b55b;background:#fff4de;color:#76511b}
.schedule-copy-preview-dates span.has-conflict b{border-radius:999px;background:#b96a22;color:#fff;padding:2px 6px;font-size:9px;line-height:1.2;letter-spacing:.03em}
.schedule-copy-preview-all,.schedule-copy-conflict-details{margin:0;border-top:1px solid #e1ebf1;padding-top:8px}
.schedule-copy-preview-all summary,.schedule-copy-conflict-details summary{cursor:pointer;color:#315f7c;font-size:12px;font-weight:1000;list-style-position:inside}
.schedule-copy-preview-all-dates{max-height:190px;overflow:auto;padding:10px 2px 2px}
.schedule-copy-conflict-details{border:1px solid #efd69a;border-radius:13px;background:#fffaf0;padding:10px 12px}
.schedule-copy-conflict-details summary{color:#805b22}
.schedule-copy-conflict-list{display:grid;gap:8px;padding-top:10px}
.schedule-copy-conflict-item{display:grid;grid-template-columns:minmax(122px,auto) 1fr;gap:10px;align-items:start;padding-top:8px;border-top:1px dashed #ead6aa}
.schedule-copy-conflict-item:first-child{padding-top:0;border-top:0}
.schedule-copy-conflict-item strong{color:#6e4d1f;font-size:11px}
.schedule-copy-conflict-item span{color:#6d6251;font-size:11px;font-weight:800;line-height:1.5}
@media(max-width:640px){
  .schedule-copy-preview-all-dates{max-height:160px}
  .schedule-copy-conflict-item{grid-template-columns:1fr;gap:3px}
  #scheduleCopyBack{font-size:12px;padding-inline:8px}
}
'''
write('ui-schedule-copy-v225.css', css)

# 4) Browser regressions: full-date inspection, overlap visibility, clearer back action.
test_path = 'tests/schedule-copy-v225.spec.mjs'
test_src = read(test_path)
test_src = replace_once(test_src, 'async function installLocalOnly(page) {', 'async function installLocalOnly(page, extraSchedules = []) {', 'installLocalOnly signature')
test_src = replace_once(test_src, "localStorage.setItem(`system-task-schedules:${room}`, JSON.stringify([source]));", "localStorage.setItem(`system-task-schedules:${room}`, JSON.stringify([source, ...extraSchedules]));", 'schedule seed')
test_src = replace_once(test_src, '  }, { room: ROOM, source: SOURCE });', '  }, { room: ROOM, source: SOURCE, extraSchedules });', 'init script args')
test_src = replace_once(test_src, 'async function boot(page, viewport = { width: 1366, height: 900 }) {\n  await page.setViewportSize(viewport);\n  await installLocalOnly(page);', 'async function boot(page, viewport = { width: 1366, height: 900 }, extraSchedules = []) {\n  await page.setViewportSize(viewport);\n  await installLocalOnly(page, extraSchedules);', 'boot signature')
insert_before = "test('one-date copy writes an independent schedule while preserving source time, duration and fields', async ({ page }) => {"
new_tests = r'''test('schedule copy lets users inspect every generated date before copying', async ({ page }) => {
  await boot(page);
  await openCopy(page);

  await selectMethod(page, 'daily');
  await setDate(page, '#scheduleCopyStartDate', '2026-09-20');
  await page.locator('#scheduleCopyCount').fill('12');
  await expect(page.locator('#scheduleCopyPreviewSummary')).toHaveText('12件の予定を作成');
  await expect(page.locator('#scheduleCopyPreviewDates span')).toHaveCount(8);
  await expect(page.locator('#scheduleCopyPreviewAll')).toBeVisible();
  await expect(page.locator('#scheduleCopyPreviewAllSummary')).toHaveText('すべての日付を確認（12件）');
  await page.locator('#scheduleCopyPreviewAllSummary').click();
  await expect(page.locator('#scheduleCopyPreviewAllDates span')).toHaveCount(12);
  await expect(page.locator('#scheduleCopyPreviewAllDates span').last()).toContainText('2026-10-01');
  await expect(page.locator('#scheduleCopyBack')).toHaveText('予定詳細へ戻る');
});

test('schedule copy marks overlapping dates and shows the conflicting schedules before confirmation', async ({ page }) => {
  const overlap = {
    ...SOURCE,
    id: 'schedule-copy-overlap-v227',
    title: '既存の重複予定',
    startAt: '2026-09-20T10:15:00.000Z',
    endAt: '2026-09-20T10:45:00.000Z',
    revision: 2
  };
  await boot(page, { width: 1366, height: 900 }, [overlap]);
  await openCopy(page);

  await selectMethod(page, 'once');
  await setDate(page, '#scheduleCopyStartDate', '2026-09-20');
  await expect(page.locator('#scheduleCopyPreviewDates .has-conflict')).toHaveCount(1);
  await expect(page.locator('#scheduleCopyPreviewDates .has-conflict')).toContainText('重複');
  await expect(page.locator('#scheduleCopyConflictDetails')).toBeVisible();
  await expect(page.locator('#scheduleCopyConflictSummary')).toHaveText('重複候補を確認（1日）');
  await page.locator('#scheduleCopyConflictSummary').click();
  await expect(page.locator('#scheduleCopyConflictList')).toContainText('既存の重複予定');
  await expect(page.locator('#scheduleCopyPreviewNote')).toContainText('既存予定を確認してからコピー');

  let confirmation = '';
  page.once('dialog', async dialog => {
    confirmation = dialog.message();
    await dialog.dismiss();
  });
  await page.locator('#scheduleCopySubmit').click();
  await expect.poll(() => confirmation).toContain('既存予定と時間が重なるコピー先が1日あります');
  await expect(page.locator('#scheduleCopyDialog')).toBeVisible();
});

'''
test_src = replace_once(test_src, insert_before, new_tests + insert_before, 'new browser tests')
write(test_path, test_src)

# 5) Release source -> Ver.227, keeping the existing v225 CSS asset name.
manifest = read('release-manifest.js')
for old, new, label in [
    ('installFirstPaintGuardV226', 'installFirstPaintGuardV227', 'guard function'),
    ("const VERSION = '226';", "const VERSION = '227';", 'guard version'),
    ("const bootClass = 'wb-first-paint-v226';", "const bootClass = 'wb-first-paint-v227';", 'boot class'),
    ("guardStyle.id = 'wb-first-paint-style-v226';", "guardStyle.id = 'wb-first-paint-style-v227';", 'guard style id'),
    ('window.__WB_LEGACY_ICON_OBSERVER_V226__ = iconObserver;', 'window.__WB_LEGACY_ICON_OBSERVER_V227__ = iconObserver;', 'observer name'),
    ('version: "226"', 'version: "227"', 'release version')
]:
    manifest = replace_once(manifest, old, new, label)
write('release-manifest.js', manifest)

version_test = read('test-harness/version-source-v194.test.mjs')
version_test = replace_once(version_test, "test('Ver.226 manifest is the release-version source and stable is no longer active'", "test('Ver.227 manifest is the release-version source and stable is no longer active'", 'version test title')
version_test = replace_once(version_test, "/version:\\s*[\"']226[\"']/", "/version:\\s*[\"']227[\"']/", 'version assertion')
version_test = replace_once(version_test, "/const VERSION = [\"']226[\"']/", "/const VERSION = [\"']227[\"']/", 'guard assertion')
version_test = replace_once(version_test, "test('Ver.219 app.js ownership of Today semantics remains canonical in Ver.226'", "test('Ver.219 app.js ownership of Today semantics remains canonical in Ver.227'", 'Today title')
write('test-harness/version-source-v194.test.mjs', version_test)

# 6) Responsibility inventory and regression notes.
responsibility_path = 'patch-responsibilities.json'
responsibility = json.loads(read(responsibility_path))
if responsibility.get('baselineRelease') != '226':
    raise RuntimeError(f"unexpected baselineRelease: {responsibility.get('baselineRelease')}")
responsibility['baselineRelease'] = '227'
for group in responsibility['groups']:
    if group.get('id') == 'schedule-mobile-ux':
        old = 'Ver.226でコピー方法ごとの操作ガイド、必要項目だけの段階表示、件数連動の実行ボタン、条件不成立時の実行抑止を追加。'
        new = old + 'Ver.227で8件を超える生成日をすべて展開確認できるプレビュー、重複日チップ、重複予定の詳細一覧、戻り先が分かる「予定詳細へ戻る」表記を追加。'
        if old not in group['reason']:
            raise RuntimeError('schedule-mobile-ux reason baseline not found')
        group['reason'] = group['reason'].replace(old, new, 1)
        break
else:
    raise RuntimeError('schedule-mobile-ux group not found')
write(responsibility_path, json.dumps(responsibility, ensure_ascii=False, indent=2) + '\n')

regression = read('REGRESSION_TESTS.md')
append = '''\n\n## Ver.227 スケジュールコピー事前確認UX
- 8件を超えるコピーでも、折りたたみの「すべての日付を確認」から生成対象日を全件確認できること。
- 既存予定と時間が重なるコピー先はプレビュー上で「重複」と明示されること。
- 重複候補の詳細を開くと、対象日と重なる既存予定名をコピー実行前に確認できること。
- 既存の最終確認ダイアログは残し、重複予定がある場合の二段階の誤操作防止を維持すること。
- コピー画面の「戻る」は「予定詳細へ戻る」とし、戻り先を明確にすること。
- Ver.225の日付生成、最大200件、コピー元revision確認、local-only `transactionRoom()`、Firebase `schedulesRef` atomic transactionを変更しないこと。
- 390px幅でも全件確認・重複詳細・下部操作が横にはみ出さず利用できること。

## Ver.227 復旧地点
- Ver.226正式main: `bc1a29d96b85a0d977c8465d1f5b8b3681f39031`
- Ver.227着手前: `backup/ver226-before-schedule-copy-preview-ux`
'''
if '## Ver.227 スケジュールコピー事前確認UX' in regression:
    raise RuntimeError('Ver.227 regression section already exists')
write('REGRESSION_TESTS.md', regression.rstrip() + append + '\n')

print('Ver.227 product migration applied successfully')
