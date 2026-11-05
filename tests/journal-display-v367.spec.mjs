import { test, expect } from '@playwright/test';

const ROOM = 'test-journal-display-v372';

async function boot(page, width = 1366) {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === 'http://127.0.0.1:4173'
      ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(({ room }) => {
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', 'JournalTester');
  }, { room: ROOM });
  await page.goto('/?room=' + ROOM, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, {timeout:30000});
  await expect(page.locator('#wbDisplayChoiceV356 [data-wb-display-choice]')).toHaveCount(4);
}
async function choose(page, mode) {
  await page.locator('[data-wb-display-choice="' + mode + '"]').evaluate(el => el.click());
  await expect(page.locator('html')).toHaveAttribute('data-wb-display', mode);
}

test('JOURNAL composes an original full-width two-page book; Linen and Margin differ physically', async ({page}) => {
  test.setTimeout(90000);
  await boot(page, 1792);
  await choose(page,'journal');
  await expect(page.locator('#todayView .j-day-spread-v372')).toBeVisible();
  await expect(page.locator('#todayView .j-leaf-day-left-v372 .today-grid')).toBeVisible();
  await expect(page.locator('#todayView .j-leaf-day-right-v372 .today-todo-preview')).toBeVisible();
  const linen = await page.locator('.j-day-spread-v372').evaluate(el =>
    getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat));
  expect(Math.abs(linen[0] - linen[1])).toBeLessThan(10);
  await page.locator('[data-journal-settings]').click();
  await expect(page.locator('#wbJournalPreferencesV370')).toBeVisible();
  await page.locator('[data-journal-theme="margin"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-journal-theme','margin');
  const margin = await page.locator('.j-day-spread-v372').evaluate(el =>
    getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat));
  expect(margin[0]).toBeGreaterThan(margin[1] + 140);
  const width = await page.locator('.app-shell .main').evaluate(el =>
    el.getBoundingClientRect().width / window.innerWidth);
  expect(width).toBeGreaterThan(.95);
  await expect(page.locator('.main > .summary-grid')).toBeHidden();
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  await expect(page.locator('.j-task-console-v372')).toBeVisible();
  await expect(page.locator('.j-task-console-v372 > .toolbar #newTask')).toHaveCount(1);
  await page.locator('.wb-journal-add-toggle-v367').click();
  await page.locator('[data-journal-create="task"]').click();
  await expect(page.locator('#taskDialog')).toBeVisible();
  await page.locator('#closeTaskDialog').evaluate(el=>el.click());
  await page.locator('[data-journal-settings]').click();
  await page.locator('[data-journal-open-drawer]').click();
  await expect(page.locator('.sidebar')).toBeVisible();
  await page.locator('[data-wb-display-choice="classic"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
  await expect(page.locator('.j-task-console-v372')).toHaveCount(0);
  await expect(page.locator('.main > .toolbar #newTask')).toHaveCount(1);
  await expect(page.locator('.main > .summary-grid')).toBeVisible();
});

test('JOURNAL week shows seven actual dated sheets and preserves canonical schedule editor', async ({page}) => {
  test.setTimeout(90000);
  await boot(page);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="week"]').click();
  await expect(page.locator('body')).toHaveClass(/schedule-mode/);
  await expect(page.locator('#scheduleView [data-schedule-range="week"]')).toHaveClass(/active/);
  await expect(page.locator('#scheduleView .j-week-ledger-v372 .j-week-day-v372')).toHaveCount(7);
  await expect(page.locator('#scheduleView .j-week-number-v372').first()).toBeVisible();
  await page.locator('.wb-journal-add-toggle-v367').click();
  await page.locator('[data-journal-create="schedule"]').click();
  await expect(page.locator('#scheduleDialog')).toBeVisible();
  await page.locator('#closeScheduleDialog').evaluate(el=>el.click());
});

test('JOURNAL ToDo and memo use real relocated controls and stay editable', async ({page}) => {
  test.setTimeout(90000);
  await boot(page);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="todos"]').click();
  await expect(page.locator('#todoView .j-todo-spread-v372')).toBeVisible();
  await expect(page.locator('#todoView .j-leaf-todo-compose-v372 [data-todo-form]')).toBeVisible();
  await expect(page.locator('#todoView .j-leaf-todo-list-v372 [data-todo-lists]')).toBeVisible();
  await page.locator('#todayTodoInput').fill('ノート専用のチェック項目');
  await page.locator('[data-todo-form] button[type="submit"]').click();
  await expect(page.locator('#todoView')).toContainText('ノート専用のチェック項目');
  const row = page.locator('#todoView .todo-item').filter({hasText:'ノート専用のチェック項目'});
  await row.locator('.todo-check').check();
  await expect(page.locator('#todoView .todo-list.is-completed')).toContainText('ノート専用のチェック項目');

  await page.locator('.wb-journal-tabs-v367 [data-journal-route="memo"]').click();
  await expect(page.locator('#workMemoViewV167 .j-memo-spread-v372')).toBeVisible();
  await expect(page.locator('#workMemoViewV167 .j-leaf-memo-index-v372 [data-memo-new]')).toBeVisible();
  await expect(page.locator('#scheduleView')).toBeHidden();
  await page.locator('.wb-journal-add-toggle-v367').click();
  await page.locator('[data-journal-create="memo"]').click();
  await expect(page.locator('#workMemoDialogV167')).toBeVisible();
});

test('JOURNAL task register, list and canonical dashboard are distinct from Classic cards', async ({page}) => {
  test.setTimeout(90000);
  await boot(page);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  await expect(page.locator('.j-task-title-v372')).toContainText('案件台帳');
  await page.locator('[data-task-layout="list"]').click();
  await expect(page.locator('#listView')).toBeVisible();
  await expect(page.locator('#listView .task-table')).toBeVisible();
  await expect(page.locator('.j-task-console-v372 > .task-control-row')).toBeVisible();
  await page.locator('[data-stat-layout="dashboard"]').click();
  await expect(page.locator('#dashboardView')).toBeVisible();
  await expect(page.locator('#dashboardView .dashboard-kpi')).toHaveCount(5);
  await expect(page.locator('.main > .summary-grid')).toBeHidden();
});

test('JOURNAL 390px screen switches pages without horizontal overflow; other modes restore', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,390);
  await choose(page,'journal');
  const dock=page.locator('#wbJournalDockV367');
  await expect(dock).toBeVisible();
  await expect(dock.locator('button')).toHaveCount(5);
  await expect(page.locator('#todayView .j-leaf-day-left-v372')).toBeVisible();
  await expect(page.locator('#todayView .j-leaf-day-right-v372')).toBeHidden();
  await page.locator('[data-journal-sheet="right"]').click();
  await expect(page.locator('#todayView .j-leaf-day-right-v372')).toBeVisible();
  await expect(page.locator('#todayView .j-leaf-day-left-v372')).toBeHidden();
  await dock.locator('[data-journal-route="todos"]').click();
  await expect(page.locator('#todoView .j-leaf-todo-list-v372')).toBeVisible();
  await page.locator('[data-journal-settings]').click();
  await page.locator('[data-journal-theme="margin"]').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await dock.locator('.wb-journal-more-v367').click();
  await expect(page.locator('.sidebar')).toBeVisible();
  await page.locator('[data-wb-display-choice="palette"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','palette');
  await expect(dock).toBeHidden();
  await expect(page.locator('.j-todo-spread-v372')).toHaveCount(0);
});
