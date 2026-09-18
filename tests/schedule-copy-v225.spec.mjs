import { test, expect } from '@playwright/test';

const ROOM = 'test-schedule-copy-v225';
const SOURCE_ID = 'schedule-copy-source-v225';
const SOURCE = {
  id: SOURCE_ID,
  title: '定例システム会議',
  startAt: '2026-09-14T10:00:00.000Z',
  endAt: '2026-09-14T11:30:00.000Z',
  assignee: '福冨',
  location: '会議室A',
  category: 'その他',
  memo: '月次確認と共有事項',
  relatedTaskId: '',
  revision: 1,
  createdAt: 1789350000000,
  createdBy: '福冨',
  updatedAt: 1789350000000,
  updatedBy: '福冨'
};

async function installLocalOnly(page, extraSchedules = []) {
  await page.addInitScript(({ room, source }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));
    localStorage.setItem(`system-task-room-name:${room}`, '情報システム共有');
    localStorage.setItem(`system-task-schedules:${room}`, JSON.stringify([source, ...extraSchedules]));
    localStorage.setItem(`system-task-schedule-range:${room}`, 'month');
    localStorage.setItem(`system-task-schedule-anchor:${room}`, '2026-09-14');
    localStorage.setItem(`system-task-schedule-display-mode:${room}`, 'list');

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM, source: SOURCE, extraSchedules });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, viewport = { width: 1366, height: 900 }, extraSchedules = []) {
  await page.setViewportSize(viewport);
  await installLocalOnly(page, extraSchedules);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="schedule"]')?.click());
  await expect(page.locator('#scheduleView')).toBeVisible();
  await expect(page.locator(`[data-schedule-id="${SOURCE_ID}"]`)).toBeVisible();
}

async function openCopy(page) {
  await page.locator(`[data-schedule-id="${SOURCE_ID}"]`).click();
  await expect(page.locator('#scheduleDialog')).toBeVisible();
  await expect(page.locator('#copySchedule')).toBeVisible();
  await page.locator('#copySchedule').click();
  await expect(page.locator('#scheduleCopyDialog')).toBeVisible();
  await expect(page.locator('#scheduleCopySourceTitle')).toHaveText(SOURCE.title);
}

async function setDate(page, selector, value) {
  await page.locator(selector).evaluate((input, next) => {
    input.value = next;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function previewDates(page) {
  return page.locator('#scheduleCopyPreviewDates span').allTextContents();
}

async function selectMethod(page, method) {
  await page.locator('#scheduleCopyMethod').selectOption(method);
}

test('schedule copy exposes rich copy methods behind one simple Copy action', async ({ page }) => {
  await boot(page);
  await openCopy(page);

  const options = await page.locator('#scheduleCopyMethod option').evaluateAll(nodes => nodes.map(node => ({ value: node.value, text: node.textContent?.trim() || '' })));
  expect(options.map(item => item.value)).toEqual([
    'once', 'dates', 'daily', 'weekdays', 'weekly', 'monthlyDay', 'monthlyNth', 'monthEnd', 'lastWeekday', 'yearly'
  ]);
  expect(options.map(item => item.text)).toEqual([
    '1回だけ（日付指定）',
    '複数の日付を指定',
    '毎日 / N日ごと',
    '平日（月〜金）',
    '毎週（曜日指定）',
    '毎月（日付指定）',
    '毎月（第n / 最終曜日）',
    '毎月（月末）',
    '毎月（最終平日）',
    '毎年（同じ月日）'
  ]);
  await expect(page.locator('#scheduleCopyPreviewSummary')).toContainText('1件の予定を作成');
  await expect(page.locator('#scheduleCopyMethodGuideTitle')).toHaveText('指定した日に1件コピー');
  await expect(page.locator('#scheduleCopyMethodGuideSteps')).toContainText('コピー先の日付');
  await expect(page.locator('#scheduleCopyIntervalRow')).toBeHidden();
  await expect(page.locator('#scheduleCopyEndRow')).toBeHidden();
  await expect(page.locator('#scheduleCopySubmit')).toHaveText('1件コピーする');
});

test('schedule copy method reveals only relevant inputs and explains the next action', async ({ page }) => {
  await boot(page); await openCopy(page);
  await selectMethod(page, 'dates');
  await expect(page.locator('#scheduleCopyMethodGuideTitle')).toHaveText('必要な日だけ複数選んでコピー');
  await expect(page.locator('#scheduleCopyStartRow')).toBeHidden();
  await expect(page.locator('#scheduleCopyDatesRow')).toBeVisible();
  await expect(page.locator('#scheduleCopyEndRow')).toBeHidden();
  await expect(page.locator('#scheduleCopySubmit')).toBeDisabled();
  await selectMethod(page, 'weekly');
  await expect(page.locator('#scheduleCopyMethodGuideSteps')).toContainText('開始日 → 間隔 → 曜日 → 終了条件');
  await expect(page.locator('#scheduleCopyStartRow')).toBeVisible();
  await expect(page.locator('#scheduleCopyIntervalRow')).toBeVisible();
  await expect(page.locator('#scheduleCopyWeekdayRow')).toBeVisible();
  await expect(page.locator('#scheduleCopyMonthDayRow')).toBeHidden();
  await expect(page.locator('#scheduleCopyNthRow')).toBeHidden();
  await expect(page.locator('#scheduleCopyEndRow')).toBeVisible();
  await selectMethod(page, 'monthlyNth');
  await expect(page.locator('#scheduleCopyMethodGuideTitle')).toHaveText('毎月、第n曜日にコピー');
  await expect(page.locator('#scheduleCopyNthRow')).toBeVisible();
  await expect(page.locator('#scheduleCopyWeekdayRow')).toBeHidden();
  await selectMethod(page, 'yearly');
  await expect(page.locator('#scheduleCopyMethodGuideText')).toContainText('コピー元の月日を維持');
  await expect(page.locator('#scheduleCopyStartRow')).toContainText('最初に作る年の基準日');
});

test('schedule copy previews weekly, nth-weekday, month-end, last-weekday, skipped-day and explicit-date rules', async ({ page }) => {
  await boot(page);
  await openCopy(page);

  await selectMethod(page, 'weekly');
  await setDate(page, '#scheduleCopyStartDate', '2026-09-14');
  await page.locator('[data-copy-weekday]').evaluateAll(inputs => {
    inputs.forEach(input => {
      input.checked = false;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
  await page.locator('[data-copy-weekday][value="1"]').check();
  await page.locator('[data-copy-weekday][value="3"]').check();
  await page.locator('[data-copy-weekday][value="5"]').check();
  await page.locator('#scheduleCopyCount').fill('6');
  await expect.poll(() => previewDates(page)).toEqual([
    '2026-09-14（月）', '2026-09-16（水）', '2026-09-18（金）',
    '2026-09-21（月）', '2026-09-23（水）', '2026-09-25（金）'
  ]);

  await selectMethod(page, 'monthlyNth');
  await setDate(page, '#scheduleCopyStartDate', '2026-10-01');
  await page.locator('#scheduleCopyNth').selectOption('2');
  await page.locator('#scheduleCopyNthWeekday').selectOption('4');
  await page.locator('#scheduleCopyCount').fill('3');
  await expect.poll(() => previewDates(page)).toEqual([
    '2026-10-08（木）', '2026-11-12（木）', '2026-12-10（木）'
  ]);

  await selectMethod(page, 'monthEnd');
  await expect.poll(() => previewDates(page)).toEqual([
    '2026-10-31（土）', '2026-11-30（月）', '2026-12-31（木）'
  ]);

  await selectMethod(page, 'lastWeekday');
  await expect.poll(() => previewDates(page)).toEqual([
    '2026-10-30（金）', '2026-11-30（月）', '2026-12-31（木）'
  ]);

  await selectMethod(page, 'monthlyDay');
  await page.locator('#scheduleCopyMonthDay').fill('31');
  await expect.poll(() => previewDates(page)).toEqual([
    '2026-10-31（土）', '2026-12-31（木）', '2027-01-31（日）'
  ]);
  await expect(page.locator('#scheduleCopyPreviewNote')).toContainText('存在しない日付');

  await selectMethod(page, 'dates');
  await setDate(page, '#scheduleCopyDateInput', '2026-10-05');
  await page.locator('#scheduleCopyAddDate').click();
  await setDate(page, '#scheduleCopyDateInput', '2026-10-22');
  await page.locator('#scheduleCopyAddDate').click();
  await expect.poll(() => previewDates(page)).toEqual(['2026-10-05（月）', '2026-10-22（木）']);
  await page.locator('[data-remove-copy-date="2026-10-05"]').click();
  await expect.poll(() => previewDates(page)).toEqual(['2026-10-22（木）']);
});

test('schedule copy lets users inspect every generated date before copying', async ({ page }) => {
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

test('one-date copy writes an independent schedule while preserving source time, duration and fields', async ({ page }) => {
  await boot(page);
  await openCopy(page);

  await selectMethod(page, 'once');
  await setDate(page, '#scheduleCopyStartDate', '2026-09-20');
  await expect(page.locator('#scheduleCopyPreviewSummary')).toHaveText('1件の予定を作成');
  await page.locator('#scheduleCopySubmit').click();
  await expect(page.locator('#scheduleCopyDialog')).not.toBeVisible();
  await expect(page.locator('#toast')).toContainText('1件の予定をコピーしました');

  const records = await page.evaluate(room => JSON.parse(localStorage.getItem(`system-task-schedules:${room}`) || '[]'), ROOM);
  expect(records).toHaveLength(2);
  const copied = records.find(item => item.id !== SOURCE_ID);
  expect(copied).toBeTruthy();
  expect(copied.id).not.toBe(SOURCE_ID);
  expect(copied.revision).toBe(1);
  expect(copied.title).toBe(SOURCE.title);
  expect(copied.assignee).toBe(SOURCE.assignee);
  expect(copied.location).toBe(SOURCE.location);
  expect(copied.category).toBe(SOURCE.category);
  expect(copied.memo).toBe(SOURCE.memo);
  expect(copied.relatedTaskId).toBe(SOURCE.relatedTaskId);

  const timing = await page.evaluate(({ startAt, endAt, copiedStart, copiedEnd }) => {
    const start = new Date(startAt);
    const end = new Date(endAt);
    const copyStart = new Date(copiedStart);
    const copyEnd = new Date(copiedEnd);
    const pad = value => String(value).padStart(2, '0');
    return {
      date: `${copyStart.getFullYear()}-${pad(copyStart.getMonth() + 1)}-${pad(copyStart.getDate())}`,
      sourceClock: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
      copiedClock: `${pad(copyStart.getHours())}:${pad(copyStart.getMinutes())}`,
      sourceDuration: end.getTime() - start.getTime(),
      copiedDuration: copyEnd.getTime() - copyStart.getTime()
    };
  }, { startAt: SOURCE.startAt, endAt: SOURCE.endAt, copiedStart: copied.startAt, copiedEnd: copied.endAt });

  expect(timing.date).toBe('2026-09-20');
  expect(timing.copiedClock).toBe(timing.sourceClock);
  expect(timing.copiedDuration).toBe(timing.sourceDuration);
});

test('schedule copy dialog stays usable without horizontal overflow on mobile', async ({ page }) => {
  await boot(page, { width: 390, height: 844 });
  await openCopy(page);

  await selectMethod(page, 'monthlyNth');
  const geometry = await page.locator('#scheduleCopyDialog').evaluate(dialog => ({
    rect: dialog.getBoundingClientRect().toJSON(),
    scrollWidth: dialog.scrollWidth,
    clientWidth: dialog.clientWidth
  }));
  expect(geometry.rect.x).toBeGreaterThanOrEqual(0);
  expect(geometry.rect.right).toBeLessThanOrEqual(390);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  await expect(page.locator('#scheduleCopyBack')).toBeVisible();
  await expect(page.locator('#scheduleCopySubmit')).toBeVisible();
});
