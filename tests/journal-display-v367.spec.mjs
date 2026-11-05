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
  await row.locator('.todo-state-toggle-v144').click();
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
  await page.locator('.j-memo-color-choice-v396[data-journal-memo-color="mint"]').click();
  await expect(card).toBeVisible();
  await page.locator('.j-memo-color-choice-v396[data-journal-memo-color="lemon"]').click();
  await expect(card).toBeHidden();
  await page.locator('.j-memo-color-choice-v396[data-journal-memo-color="all"]').click();
  await expect(card).toBeVisible();
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


test('JOURNAL paper date fields and memo cancel are large enough without rounded input chips', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1366);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  await page.locator('#newTask').evaluate(el=>el.click());
  const editor = page.locator('#taskDialog');
  await expect(editor.locator('.j-entry-outline-v385')).toBeVisible();
  const layout = await editor.evaluate(el => {
    const input = el.querySelector('#taskStartDateV167');
    const wrapper = input.closest('.date-segment-control-v127');
    const year = wrapper?.querySelector('.date-segment-year-v127');
    const outline = el.querySelector('.j-entry-outline-v385');
    const d = wrapper?.getBoundingClientRect(), y = year?.getBoundingClientRect();
    return {
      width: d?.width || 0, yearWidth:y?.width || 0,
      radius:wrapper ? parseFloat(getComputedStyle(wrapper).borderTopLeftRadius) : 100,
      position:getComputedStyle(outline).position
    };
  });
  expect(layout.width).toBeGreaterThan(250);
  expect(layout.yearWidth).toBeGreaterThan(52);
  expect(layout.radius).toBeLessThanOrEqual(3);
  expect(layout.position).toBe('sticky');
  await editor.locator('#closeTaskDialog').click();
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="memo"]').click();
  await page.locator('#workMemoViewV167 [data-memo-new]').first().click();
  const memo = page.locator('#workMemoDialogV167');
  const cancel = memo.locator('button[data-memo-close]').last();
  await expect(cancel).toBeVisible();
  const dimensions = await cancel.evaluate(el => ({
    width:el.getBoundingClientRect().width,
    whiteSpace:getComputedStyle(el).whiteSpace,
    text:el.textContent.trim()
  }));
  expect(dimensions.text).toBe('キャンセル');
  expect(dimensions.width).toBeGreaterThan(100);
  expect(dimensions.whiteSpace).toBe('nowrap');
  await cancel.click();
  await expect(memo).toBeHidden();
});

test('JOURNAL memo and schedule search do not destroy their input during Japanese conversion', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1366);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="memo"]').click();
  const memoSearch=page.locator('#workMemoViewV167 [data-memo-search]');
  await expect(memoSearch).toBeVisible();
  const duringMemo=await memoSearch.evaluate(input => {
    input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'き'}));
    input.value='きょう';
    input.dispatchEvent(new InputEvent('input',{bubbles:true,data:'う',isComposing:true}));
    return input.isConnected && input === document.querySelector('[data-memo-search]');
  });
  expect(duringMemo).toBe(true);
  await memoSearch.evaluate(input => input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'きょう'})));
  await expect(page.locator('[data-memo-search]')).toHaveValue('きょう');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="schedule"]').click();
  const scheduleSearch=page.locator('#scheduleView .schedule-search-v176 input');
  await expect(scheduleSearch).toBeVisible();
  const duringSchedule=await scheduleSearch.evaluate(input => {
    input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'よ'}));
    input.value='よてい';
    input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));
    return input.isConnected && input === document.querySelector('#scheduleView .schedule-search-v176 input');
  });
  expect(duringSchedule).toBe(true);
  await scheduleSearch.evaluate(input => input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'よてい'})));
  await expect(page.locator('#scheduleView .schedule-search-v176 input')).toHaveValue('よてい');
});

test('JOURNAL ToDo forms the actual divided book and uses accessible paper check controls', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1366);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="todos"]').click();
  await expect(page.locator('#todoView .j-todo-spread-v372')).toBeVisible();
  await expect(page.locator('#todoView .j-leaf-todo-compose-v372 .todo-search-box-v145')).toBeVisible();
  await expect(page.locator('#todoView .j-leaf-todo-list-v372 .todo-lists')).toBeVisible();
  const statHeight = await page.locator('#todoView .todo-page-stat-card').first()
    .evaluate(el => el.getBoundingClientRect().height);
  expect(statHeight).toBeLessThan(65);
  await page.locator('#todayTodoInput').fill('記入欄の完了ボタン確認');
  await page.locator('[data-todo-form] button[type="submit"]').click();
  const row=page.locator('#todoView .todo-item').filter({hasText:'記入欄の完了ボタン確認'});
  await expect(row).toBeVisible();
  const complete=row.locator('.todo-state-toggle-v144');
  await expect(complete).toBeVisible();
  const width=await complete.evaluate(el=>el.getBoundingClientRect().width);
  expect(width).toBeGreaterThanOrEqual(39);
  await complete.click();
  await expect(page.locator('#todoView .todo-list.is-completed')).toContainText('記入欄の完了ボタン確認');
});

test('JOURNAL month calendar includes a right-hand daily note with canonical appointment actions', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1440);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="schedule"]').click();
  await page.locator('#scheduleView [data-schedule-mode="calendar"]').click();
  await expect(page.locator('#scheduleView .j-calendar-layout-v389')).toBeVisible();
  await expect(page.locator('#scheduleView .j-calendar-today-v389')).toBeVisible();
  const geometry=await page.locator('.j-calendar-layout-v389').evaluate(el => {
    const calendar=el.querySelector('.schedule-calendar').getBoundingClientRect();
    const note=el.querySelector('.j-calendar-today-v389').getBoundingClientRect();
    return {calendarRight:calendar.right,noteLeft:note.left,noteWidth:note.width};
  });
  expect(geometry.noteLeft).toBeGreaterThan(geometry.calendarRight);
  expect(geometry.noteWidth).toBeGreaterThan(240);
  await page.locator('.j-calendar-go-today-v389').click();
  await expect(page.locator('#scheduleView [data-schedule-mode="calendar"]')).toHaveClass(/active/);
});


test('JOURNAL has one visible global search that follows each original page filter', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1440);
  await choose(page,'journal');
  const search=page.locator('#wbJournalSearchV393');
  await expect(search).toBeVisible();
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  await expect(page.locator('.j-task-console-v372 .j-task-capture-v393 #newTask')).toBeVisible();
  await search.fill('検証メモ');
  await expect(page.locator('#searchInput')).toHaveValue('検証メモ');
  await expect(page.locator('.j-task-browse-v393 .search-box')).toBeHidden();
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="todos"]').click();
  await expect(page.locator('#todoView .j-todo-spread-v372')).toBeVisible();
  await expect(page.locator('#todoView .todo-search-input-v145')).toHaveValue('検証メモ');
  await expect(page.locator('#todoView .todo-search-box-v145')).toBeHidden();
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="memo"]').click();
  await expect(page.locator('#workMemoViewV167 [data-memo-search]')).toHaveValue('検証メモ');
  await expect(page.locator('#workMemoViewV167 .work-memo-search-v167')).toBeHidden();
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="schedule"]').click();
  await expect(page.locator('#searchInput')).toHaveValue('検証メモ');
  await expect(search).toHaveValue('検証メモ');
  await search.evaluate(el => {
    el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'て'}));
    el.value='てすと';
    el.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,data:'と'}));
  });
  await expect(page.locator('#searchInput')).toHaveValue('検証メモ');
  await search.evaluate(el => el.dispatchEvent(
    new CompositionEvent('compositionend',{bubbles:true,data:'テスト'})));
  await expect(page.locator('#searchInput')).toHaveValue('てすと');
  await page.locator('[data-journal-search-clear]').click();
  await expect(page.locator('#searchInput')).toHaveValue('');
});

test('JOURNAL mode settings is a categorized paper booklet with original settings controls', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1366);
  await choose(page,'journal');
  await page.locator('[data-journal-settings]').click();
  await page.locator('[data-journal-open-drawer]').click();
  const book=page.locator('#jSettingsBookV393');
  await expect(book).toBeVisible();
  await expect(book.locator('#wbDisplayChoiceV356 [data-wb-display-choice]')).toHaveCount(4);
  await book.locator('[data-journal-book-theme="margin"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-journal-theme','margin');
  await book.locator('[data-journal-settings-tab="personal"]').click();
  await expect(book.locator('#currentUserSelect')).toBeVisible();
  await expect(book.locator('#roomNameInput')).toBeVisible();
  await expect(book.locator('[data-journal-settings-tab]')).toHaveCount(2);
  await expect(book.locator('[data-journal-settings-tab="filters"]')).toHaveCount(0);
  await book.locator('.j-settings-optional-filters-v396 > summary').click();
  await expect(book.locator('#statusFilter')).toBeVisible();
  await book.locator('[data-journal-settings-tab="display"]').click();
  await book.locator('[data-wb-display-choice="classic"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
  await expect(page.locator('#jSettingsBookV393')).toHaveCount(0);
  await expect(page.locator('.sidebar .user-card #wbDisplayChoiceV356')).toHaveCount(1);
  await expect(page.locator('.sidebar > .nav')).toHaveCount(1);
});

test('JOURNAL task index remains alongside the final editor page when dialog scrolls to bottom', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1366);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  await page.locator('.j-task-capture-v393 #newTask').click();
  const dialog=page.locator('#taskDialog');
  await expect(dialog).toBeVisible();
  const outline=dialog.locator('.j-entry-outline-v385');
  await expect(outline).toBeVisible();
  const before=await outline.boundingBox();
  const metrics=await dialog.evaluate(el => {
    const available=el.scrollHeight-el.clientHeight;
    el.scrollTop=el.scrollHeight;
    return {available, max:el.scrollHeight};
  });
  expect(metrics.available).toBeGreaterThan(150);
  await expect.poll(async () => {
    const box=await outline.boundingBox();
    return Math.round(Math.abs(box.y - before.y));
  }).toBeLessThan(25);
  await expect(dialog.locator('#taskChecklist')).toBeVisible();
  await expect(dialog.locator('.dialog-actions button[type="submit"]')).toBeVisible();
});

test('JOURNAL task and schedule have separate writing leaves, with reversible Classic restore', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1450);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  await expect(page.locator('.j-task-console-v372 .j-task-capture-v393')).toBeVisible();
  await expect(page.locator('.j-task-console-v372 .j-task-browse-v393 #sortSelect')).toBeVisible();
  await expect(page.locator('.j-task-console-v372 .j-task-switches-v393 .task-view-switcher')).toBeVisible();
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="schedule"]').click();
  await expect(page.locator('#scheduleView .j-schedule-book-v393')).toBeVisible();
  await expect(page.locator('#scheduleView .j-schedule-dates-v393 [data-schedule-move="today"]')).toBeVisible();
  await expect(page.locator('#scheduleView .j-schedule-modes-v393 [data-schedule-mode="calendar"]')).toBeVisible();
  await choose(page,'classic');
  await expect(page.locator('.j-task-capture-v393')).toHaveCount(0);
  await expect(page.locator('.j-schedule-book-v393')).toHaveCount(0);
  await expect(page.locator('.main > .toolbar #newTask')).toHaveCount(1);
});

test('Margin notebook has asymmetric loose leaves unlike Linen stitched book', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1740);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="todos"]').click();
  const spread=page.locator('#todoView .j-todo-spread-v372');
  await expect(spread).toBeVisible();
  const linen=await spread.locator('.j-leaf-todo-compose-v372').evaluate(el =>
    ({width:el.getBoundingClientRect().width, shadow:getComputedStyle(el).boxShadow}));
  await page.locator('[data-journal-settings]').click();
  await page.locator('#wbJournalPreferencesV370 [data-journal-theme="margin"]').click();
  const margin=await spread.locator('.j-leaf-todo-compose-v372').evaluate(el =>
    ({width:el.getBoundingClientRect().width, shadow:getComputedStyle(el).boxShadow}));
  expect(margin.width).toBeGreaterThan(linen.width + 20);
  expect(margin.shadow).not.toBe(linen.shadow);
});


test('JOURNAL schedule uses a short horizontal control strip rather than two tall cards', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1440);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="schedule"]').click();
  const book=page.locator('#scheduleView .j-schedule-book-v393');
  await expect(book).toBeVisible();
  await expect(book.locator('[data-schedule-range="month"]')).toBeVisible();
  await expect(book.locator('[data-schedule-move="today"]')).toBeVisible();
  await expect(book.locator('[data-schedule-mode="calendar"]')).toBeVisible();
  await expect(book.locator('[data-new-schedule]')).toBeVisible();
  const height=await book.evaluate(el => el.getBoundingClientRect().height);
  expect(height).toBeLessThan(185);
  expect(await page.locator('#scheduleView .j-schedule-leaf-title-v393').count()).toBe(0);
  await book.locator('[data-schedule-mode="calendar"]').click();
  await expect(page.locator('#scheduleView .j-calendar-layout-v389')).toBeVisible();
});

test('JOURNAL task header keeps quick add, create and sort controls separate without overlap', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1440);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  const create=page.locator('.j-task-capture-v393 #newTask');
  const quick=page.locator('.j-task-capture-v393 #quickAddInput');
  const sort=page.locator('.j-task-browse-v393 #sortSelect');
  await expect(create).toBeVisible();
  await expect(quick).toBeVisible();
  await expect(sort).toBeVisible();
  const createBox=await create.boundingBox(), quickBox=await quick.boundingBox();
  expect(quickBox.x).toBeGreaterThan(createBox.x + createBox.width + 4);
  const height=await page.locator('.j-task-console-v372 > .toolbar')
    .evaluate(el => el.getBoundingClientRect().height);
  expect(height).toBeLessThan(160);
  await expect(page.locator('.j-task-legend-v393 > summary')).toBeVisible();
  await page.locator('.j-task-legend-v393 > summary').click();
  await expect(page.locator('.j-task-legend-v393 .task-color-legend')).toBeVisible();
});

test('JOURNAL ToDo follows writing order and moves the original submit back to Classic', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1366);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="todos"]').click();
  const form=page.locator('#todoView .j-leaf-todo-compose-v372 form[data-todo-form]');
  const title=form.locator('#todayTodoInput');
  const memo=form.locator('.todo-compose-details');
  const add=form.locator(':scope > .todo-add-button');
  await expect(title).toBeVisible();
  await expect(add).toBeVisible();
  const titleStyle=await title.evaluate(el => ({
    height:el.getBoundingClientRect().height,border:parseFloat(getComputedStyle(el).borderLeftWidth)
  }));
  expect(titleStyle.height).toBeGreaterThanOrEqual(52);
  expect(titleStyle.border).toBeGreaterThanOrEqual(2);
  const m=await memo.boundingBox(), a=await add.boundingBox(), f=await form.boundingBox();
  expect(a.y).toBeGreaterThanOrEqual(m.y + m.height - 2);
  expect(Math.abs((a.x+a.width)-(f.x+f.width))).toBeLessThan(34);
  await choose(page,'classic');
  await expect(page.locator('#todoView .todo-compose-main > .todo-add-button')).toHaveCount(1);
});

test('JOURNAL memo index follows viewport and filters physical cards by saved paper color', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1440);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="memo"]').click();
  const index=page.locator('#workMemoViewV167 .j-leaf-memo-index-v372');
  await expect(index).toBeVisible();
  const style=await index.evaluate(el => ({
    position:getComputedStyle(el).position,
    overflow:getComputedStyle(el).overflowY
  }));
  expect(style.position).toBe('sticky');
  expect(['auto','scroll']).toContain(style.overflow);
  await expect(page.locator('.j-memo-color-choice-v396')).toHaveCount(7);
  await page.locator('.j-memo-color-choice-v396[data-journal-memo-color="mint"]').click();
  await expect(page.locator('.j-memo-color-choice-v396[data-journal-memo-color="mint"]'))
    .toHaveAttribute('aria-pressed','true');
  const invisible=await page.locator('#workMemoViewV167 .work-memo-card-v167:not([data-memo-paper-color="mint"])')
    .evaluateAll(nodes => nodes.every(el => getComputedStyle(el).display === 'none'));
  expect(invisible).toBe(true);
  await page.locator('.j-memo-color-choice-v396[data-journal-memo-color="all"]').click();
  await page.locator('[data-journal-settings]').click();
  await page.locator('[data-journal-open-drawer]').click();
  await page.locator('#jSettingsBookV393 [data-wb-display-choice="classic"]').click();
  await expect(page.locator('#workMemoViewV167 .j-memo-color-choice-v396')).toHaveCount(0);
});


test('JOURNAL paper board uses close, sequential status columns without stretched gaps', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1680);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  await page.locator('[data-task-layout="board"]').click();
  const board=page.locator('#boardView');
  await expect(board).toBeVisible();
  const columns=board.locator('.board-column');
  await expect(columns.first()).toBeVisible();
  const layout=await board.evaluate(el => {
    const styles=getComputedStyle(el);
    const cols=Array.from(el.querySelectorAll('.board-column'));
    return {
      display:styles.display,columns:cols.length,
      widths:cols.map(x=>x.getBoundingClientRect().width),
      gaps:cols.slice(1).map((x,i)=>x.getBoundingClientRect().left-cols[i].getBoundingClientRect().right)
    };
  });
  expect(layout.display).toBe('flex');
  expect(layout.widths.every(x=>x>=245&&x<=315)).toBe(true);
  expect(layout.gaps.every(x=>x>=0&&x<=24)).toBe(true);
  await expect(page.locator('.j-task-capture-v393 #newTask')).toBeVisible();
  const create=await page.locator('.j-task-capture-v393 #newTask').boundingBox();
  expect(create.width).toBeLessThan(170);
});

test('JOURNAL task timeline is a lined planner instead of rounded dashboard cards', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1440);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  await page.locator('[data-task-layout="timeline"]').click();
  const timeline=page.locator('#timelineView');
  await expect(timeline).toBeVisible();
  const date=timeline.locator('.timeline-date').first();
  await expect(date).toBeVisible();
  const style=await date.evaluate(el=>({
    background:getComputedStyle(el).backgroundColor,
    border:getComputedStyle(el).borderRightStyle
  }));
  expect(style.border).toBe('solid');
  await expect(timeline.locator('.timeline-grid')).toBeVisible();
});

test('JOURNAL memo index visibly follows long-page scroll and tab says メモ', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1366);
  await choose(page,'journal');
  const tab=page.locator('.wb-journal-tabs-v367 [data-journal-route="memo"]');
  await expect(tab).toHaveText('メモ');
  await tab.click();
  const index=page.locator('#workMemoViewV167 .j-leaf-memo-index-v372');
  const spread=page.locator('#workMemoViewV167 .j-memo-spread-v372');
  await expect(index).toBeVisible();
  const before=await index.boundingBox();
  const measure=await spread.evaluate(el=>{
    const bottom=el.getBoundingClientRect().bottom;
    window.scrollBy(0,Math.min(450,Math.max(0,bottom-window.innerHeight)));
    return {height:el.getBoundingClientRect().height};
  });
  if(measure.height>1050) {
    await expect.poll(async()=>index.evaluate(el=>getComputedStyle(el).transform))
      .not.toBe('none');
    const after=await index.boundingBox();
    expect(after.y).toBeGreaterThanOrEqual(before.y-35);
  }
});
