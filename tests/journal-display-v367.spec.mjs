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
  await expect(page.locator('#wbDisplayChoiceV356 [data-wb-display-choice="classic"]')).toBeVisible();
  await page.locator('[data-wb-display-choice="classic"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
  await expect(page.locator('.j-task-console-v372')).toHaveCount(0);
  await expect(page.locator('.main > .toolbar #newTask')).toHaveCount(1);
  await expect(page.locator('.main > .summary-grid')).toBeVisible();
});

test('JOURNAL keeps the seven-day planner inside Schedule rather than duplicating a week tab', async ({page}) => {
  test.setTimeout(90000);
  await boot(page);
  await choose(page,'journal');
  await expect(page.locator('[data-journal-route="week"]')).toHaveCount(0);
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="schedule"]').click();
  await page.locator('#scheduleView [data-schedule-range="week"]').click();
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
  await expect(page.locator('body')).toHaveClass(/todo-mode/);
  await expect(page.locator('#todoView .todo-page')).toBeVisible();
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

test('JOURNAL completed history keeps fifty long entries horizontal on desktop and mobile', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1366);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="todos"]').click();
  await expect(page.locator('#todoView .j-todo-spread-v372')).toBeVisible();

  // Presentation-only fixture: no production or Firebase writes.
  await page.evaluate(() => {
    const target = document.querySelector('#todoView [data-todo-lists]');
    const section = document.createElement('section');
    section.className = 'todo-list todo-history-v146';
    section.dataset.journalHistoryFixture = 'true';
    const ul = document.createElement('ul');
    ul.className = 'todo-items todo-history-items-v146';
    for (let i = 0; i < 50; i += 1) {
      const li = document.createElement('li');
      li.className = 'todo-item todo-history-item-v146';
      li.innerHTML = '<div class="todo-history-main-v146"><div class="todo-history-title-row-v146">'
        + '<span class="todo-history-done-v146">✓</span>'
        + '<span class="todo-text">備品管理システムのテストモジュール確認と完了履歴の表示確認</span>'
        + '</div></div><time class="todo-history-date-v146">11/4（水）10:12</time>';
      ul.append(li);
    }
    section.append(ul);
    target.append(section);
  });

  const rows = page.locator('[data-journal-history-fixture] .todo-history-item-v146');
  await expect(rows).toHaveCount(50);
  async function dimensions() {
    return rows.first().evaluate(el => ({
      rowHeight: el.getBoundingClientRect().height,
      textWidth: el.querySelector('.todo-text').getBoundingClientRect().width,
      rowWidth: el.getBoundingClientRect().width,
      radius: parseFloat(getComputedStyle(el.querySelector('.todo-history-done-v146')).borderTopLeftRadius)
    }));
  }
  const desktop = await dimensions();
  expect(desktop.textWidth).toBeGreaterThan(200);
  expect(desktop.rowHeight).toBeLessThan(135);
  expect(desktop.radius).toBeLessThanOrEqual(3);

  const headerFont = await page.locator('#todoView .todo-page-head h3').evaluate(el => getComputedStyle(el).fontFamily);
  expect(headerFont).not.toMatch(/Mincho|Georgia|明朝/i);

  await page.setViewportSize({width:390,height:840});
  const mobile = await dimensions();
  expect(mobile.textWidth).toBeGreaterThan(135);
  expect(mobile.rowHeight).toBeLessThan(170);
  expect(mobile.rowWidth).toBeLessThanOrEqual(390);
});

test('JOURNAL memo index navigates cards and note color persists through canonical memo storage', async ({page}) => {
  test.setTimeout(90000);
  await boot(page);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="memo"]').click();
  await expect(page.locator('.j-memo-index-v383')).toBeVisible();
  await page.locator('#workMemoViewV167 [data-memo-new]').first().click();
  await expect(page.locator('#workMemoDialogV167')).toBeVisible();
  await page.locator('#workMemoTitleV167').fill('JOURNAL付箋動作確認');
  await page.locator('#workMemoBodyV167').fill('付箋の本文は白い紙で読みやすく表示する');
  await page.locator('#workMemoFormV167 button[type="submit"]').click();
  const card=page.locator('#workMemoViewV167 .work-memo-card-v167').filter({hasText:'JOURNAL付箋動作確認'});
  await expect(card).toBeVisible();
  await expect(page.locator('.j-memo-index-link-v383').filter({hasText:'JOURNAL付箋動作確認'})).toBeVisible();
  await card.locator('[data-memo-paper-color]').selectOption('mint');
  await expect(card).toHaveAttribute('data-memo-paper-color','mint');
  await expect(card.locator('.work-memo-body-v167')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await page.locator('[data-journal-route="today"]').first().click();
  await page.locator('[data-journal-route="memo"]').first().click();
  await expect(page.locator('#workMemoViewV167 .work-memo-card-v167').filter({hasText:'JOURNAL付箋動作確認'}))
    .toHaveAttribute('data-memo-paper-color','mint');
  await page.locator('.j-memo-index-sort-v383 select').selectOption('category');
  await expect(page.locator('.j-memo-index-group-v383')).not.toHaveCount(0);
  await page.locator('.j-memo-index-link-v383').filter({hasText:'JOURNAL付箋動作確認'}).click();
  await expect(card).toBeFocused();
  await page.locator('[data-journal-settings]').click();
  await page.locator('[data-journal-open-drawer]').click();
  await page.locator('[data-wb-display-choice="classic"]').click();
  await expect(page.locator('#workMemoViewV167 .j-memo-spread-v372')).toHaveCount(0);
  await expect(page.locator('#workMemoViewV167 .j-memo-paper-select-v383').first()).toBeHidden();
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


test('JOURNAL task editor is a three-leaf notebook and restores canonical fields in Classic', async ({page}) => {
  test.setTimeout(90000);
  await boot(page, 1366);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  await page.locator('#newTask').evaluate(el=>el.click());
  const dialog=page.locator('#taskDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveClass(/j-entry-task-v385/);
  await expect(dialog.locator('.j-entry-leaf-v385')).toHaveCount(3);
  await expect(dialog.locator('#taskTitle')).toBeVisible();
  await expect(dialog.locator('#taskRecurrence')).toBeVisible();
  await dialog.locator('#taskTitle').fill('JOURNAL専用の入力ページ');
  await dialog.locator('[data-journal-entry-jump="dates"]').click();
  await expect(dialog.locator('[data-journal-entry-page="dates"]')).toBeInViewport();
  await dialog.locator('#taskRecurrence').selectOption('weekly');
  await expect(dialog.locator('#recurrenceOptions')).toBeVisible();
  await dialog.locator('#closeTaskDialog').click();
  await expect(dialog).toBeHidden();
  await choose(page,'classic');
  await expect(dialog.locator('.j-entry-leaf-v385')).toHaveCount(0);
  await expect(dialog.locator('#taskForm > .form-grid > label')).not.toHaveCount(0);
  await expect(dialog.locator('#taskTitle')).toHaveCount(1);
  await expect(dialog.locator('#taskRecurrence')).toHaveCount(1);
});

test('JOURNAL schedule form keeps its canonical date fields and notebook index', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1366);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="schedule"]').click();
  await page.locator('#scheduleView [data-new-schedule]').first().click();
  const dialog=page.locator('#scheduleDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveClass(/j-entry-schedule-v385/);
  await expect(dialog.locator('.j-entry-leaf-v385')).toHaveCount(3);
  await dialog.locator('#scheduleTitle').fill('JOURNAL予定登録テスト');
  await dialog.locator('[data-journal-entry-jump="people"]').click();
  await expect(dialog.locator('#scheduleAssignee')).toBeVisible();
  await dialog.locator('[data-journal-entry-jump="notes"]').click();
  await expect(dialog.locator('#scheduleMemo')).toBeVisible();
  await dialog.locator('#scheduleMemo').fill('手帳ページに記録したメモ');
  await dialog.locator('#closeScheduleDialog').evaluate(el=>el.click());
  await expect(dialog).toBeHidden();
  await choose(page,'classic');
  await expect(dialog.locator('.j-entry-leaf-v385')).toHaveCount(0);
  await expect(dialog.locator('#scheduleForm > .form-grid > label')).toHaveCount(8);
});

test('JOURNAL memo editor shows a writable white note and saves its chosen paper color', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1366);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="memo"]').click();
  await page.locator('#workMemoViewV167 [data-memo-new]').first().click();
  const dialog=page.locator('#workMemoDialogV167');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveClass(/j-entry-memo-v385/);
  await expect(dialog.locator('.j-entry-memo-pages-v385')).toBeVisible();
  await expect(dialog.locator('#workMemoBodyV167')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await dialog.locator('#workMemoTitleV167').fill('付箋メモ編集テスト');
  await dialog.locator('#workMemoBodyV167').fill('記録は白い用紙に読みやすく残す');
  await dialog.locator('#workMemoPaperColorV385').selectOption('lavender');
  await expect(dialog).toHaveAttribute('data-journal-memo-paper','lavender');
  await dialog.locator('#workMemoFormV167 button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  const card=page.locator('.work-memo-card-v167').filter({hasText:'付箋メモ編集テスト'});
  await expect(card).toHaveAttribute('data-memo-paper-color','lavender');
  await card.locator('[data-memo-edit]').click();
  await expect(dialog.locator('#workMemoPaperColorV385')).toHaveValue('lavender');
  await dialog.locator('#workMemoBodyV167').fill('編集後の記録も色と一緒に保存');
  await dialog.locator('#workMemoFormV167 button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  await expect(card).toHaveAttribute('data-memo-paper-color','lavender');
});

test('JOURNAL mobile entry screen has one-column fields and no horizontal overflow', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,390);
  await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  await page.locator('#newTask').evaluate(el=>el.click());
  const dialog=page.locator('#taskDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.j-entry-outline-v385')).toBeVisible();
  const size=await dialog.evaluate(el=>{
    const grid=el.querySelector('.j-entry-fields-v385');
    return {
      dialogWidth:el.getBoundingClientRect().width,
      viewportWidth:innerWidth,
      scrollWidth:el.scrollWidth,
      gridColumns:getComputedStyle(grid).gridTemplateColumns.split(' ').length
    };
  });
  expect(size.dialogWidth).toBeLessThanOrEqual(size.viewportWidth);
  expect(size.scrollWidth).toBeLessThanOrEqual(size.dialogWidth+1);
  expect(size.gridColumns).toBe(1);
});
