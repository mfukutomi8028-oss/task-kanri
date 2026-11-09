import { test, expect } from '@playwright/test';

// JOURNAL is deployed for Japan-based workflows. Keep day boundaries
// consistent with production even when GitHub Actions runners use UTC.
test.use({ timezoneId: 'Asia/Tokyo' });

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
  // Optional JOURNAL CSS/JS are loaded only after the first mode selection.
  // Waiting for the mode attribute alone can observe the old Classic canvas.
  if (mode === 'journal') {
    await page.waitForFunction(() =>
      Boolean(document.getElementById('wbJournalHeaderV367'))
      && Boolean(document.querySelector('link[data-workboard-style="journal-display-v367.css"][data-loaded="true"]')),
    undefined, { timeout: 30000 });
    // A loaded bundle is not yet a rendered page after the first lazy switch.
    await expect(page.locator('.wb-journal-tabs-v367 [data-journal-route]')).toHaveCount(5);
    await expect.poll(() => page.evaluate(() => {
      if (document.body.classList.contains('today-mode')) {
        return Boolean(document.querySelector('#todayView .j420-today'));
      }
      if (document.body.classList.contains('task-mode')) {
        return Boolean(document.querySelector('#boardView .j420-atelier')
          || document.querySelector('#listView .j425-task-index')
          || document.querySelector('#timelineView .jv-chronicle-day'));
      }
      return true;
    }), { timeout: 12000 }).toBe(true);
  }
}

// The canonical task save selects the saved record and may open its detail
// panel. Tests that continue using desk or diary controls close that panel
// deliberately instead of clicking through a modal overlay.
async function dismissSavedTaskDetailForTest(page) {
  await page.locator('#closeDetail').evaluate(button=>button.click());
  await expect(page.locator('.detail-panel')).not.toHaveClass(/open/);
}

test('JOURNAL Today diary and Task Atelier are independent paper workspaces',async ({page})=>{
  test.setTimeout(90000);
  await boot(page,1792);await choose(page,'journal');
  const today=page.locator('#todayView .j420-today');
  await expect(today).toBeVisible();
  await expect(today.locator('.j420-planner')).toBeVisible();
  await expect(today.locator('.j420-focus')).toBeVisible();
  await expect(today.locator('.j420-pockets')).toBeVisible();
  const todayStationery=today.locator('.j425-today-stationery');
  await expect(todayStationery).toBeVisible();
  const bookmark=todayStationery.locator('img.j440-today-bookmark');
  await expect(bookmark).toBeVisible();
  await expect(bookmark).toHaveAttribute('src',/journal-bookmark-seal-v440\.svg/);
  const loaded=await bookmark.evaluate(img=>({
    complete:img.complete&&img.naturalWidth>0,
    inside:(()=>{const image=img.getBoundingClientRect(),space=img.parentElement.getBoundingClientRect();
      return image.left>=space.left-1&&image.right<=space.right+1;})()
  }));
  expect(loaded.complete).toBeTruthy();
  expect(loaded.inside).toBeTruthy();
  await expect(todayStationery.locator('.j425-svg-clip')).toHaveCount(0);
  await expect(today.locator('.j420-masthead-stats > span')).toHaveCount(3);
  await expect(page.locator('#todayView .today-grid')).toHaveCount(0);
  const linen=await today.locator('.j420-today-spread').evaluate(el=>getComputedStyle(el).borderRadius);
  await page.locator('[data-journal-settings]').click();
  await page.locator('[data-journal-theme="margin"]').click();
  const margin=await today.locator('.j420-today-spread').evaluate(el=>getComputedStyle(el).borderRadius);
  expect(margin).not.toBe(linen);
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  const atelier=page.locator('#boardView .j420-atelier');
  await expect(atelier).toBeVisible();
  await expect(atelier.locator('.j420-atelier-index')).toBeVisible();
  await expect(atelier.locator('.j420-atelier-desk')).toBeVisible();
  const cards=atelier.locator('.j441-atelier-cards');
  await expect(cards).toBeVisible();
  const cardImage=await cards.evaluate(el=>({
    loaded:el.complete && el.naturalWidth>0,
    source:el.getAttribute('src'),
    within:el.getBoundingClientRect().width<=el.closest('.j420-atelier-stationery').getBoundingClientRect().width
  }));
  expect(cardImage.loaded).toBeTruthy();
  expect(cardImage.source).toContain('journal-atelier-cards-v441.svg');
  expect(cardImage.within).toBeTruthy();
  await expect(atelier.locator('.j420-atelier-stationery .j425-svg-clip')).toHaveCount(0);
  await expect(atelier.locator('.j420-atelier-log')).toBeVisible();
  // The same note is moved between desktop desk and mobile shelves.
  await expect(page.locator('#boardView #j494AtelierNote')).toBeVisible();
  await atelier.locator('[data-j420-new-task]').click();
  await expect(page.locator('#taskDialog')).toBeVisible();
  await page.locator('#closeTaskDialog').evaluate(el=>el.click());
  await page.locator('[data-journal-settings]').click();
  await page.locator('[data-journal-open-drawer]').click();
  await page.locator('[data-wb-display-choice="classic"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
  await expect(page.locator('.main > .toolbar #newTask')).toHaveCount(1);
  await expect(page.locator('.j420-atelier')).toHaveCount(0);
});

test('JOURNAL Atelier, index and chronicle switch without task render errors',async ({page})=>{
  test.setTimeout(90000);await boot(page,1366);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView');
  await expect(board.locator('.j420-atelier')).toBeVisible();
  await board.locator('[data-j420-view="focus"]').click();
  await expect(board.locator('[data-j420-view="focus"]')).toHaveAttribute('aria-pressed','true');
  await board.locator('[data-j420-reset-view]').first().click();
  await expect(board.locator('[data-j420-view="all"]')).toHaveAttribute('aria-pressed','true');
  await board.locator('[data-j420-layout="list"]').click();
  await expect(page.locator('#listView .j425-task-index')).toBeVisible();
  await page.locator('#listView [data-j425-sort]').selectOption('title');
  await expect(page.locator('#listView [data-j425-sort]')).toHaveValue('title');
  await page.locator('#listView [data-j425-task-layout="board"]').click();
  await expect(page.locator('#boardView .j420-atelier')).toBeVisible();
  await page.locator('#boardView button[title="日付日誌"]').click();
  await expect(page.locator('#timelineView .jv-chronicle-day').first()).toBeVisible();
  await expect(page.getByText('画面の描画中にエラーが発生しました')).toHaveCount(0);
});

test('JOURNAL memo Cancel button uses the same compact type size as Save',async ({page})=>{
  test.setTimeout(90000);
  await boot(page);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="memo"]').click();
  await page.locator('.wb-journal-add-toggle-v367').click();
  await page.locator('[data-journal-create="memo"]').click();
  const dialog=page.locator('#workMemoDialogV167');
  await expect(dialog).toBeVisible();
  const cancel=dialog.locator('.work-memo-dialog-actions-v167 [data-memo-close]');
  const save=dialog.locator('.work-memo-dialog-actions-v167 button[type="submit"]');
  const cancelSize=await cancel.evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  const saveSize=await save.evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  expect(cancelSize).toBeLessThanOrEqual(16);
  expect(Math.abs(cancelSize-saveSize)).toBeLessThanOrEqual(2);
});

test('JOURNAL week planner is independent, editable and contains seven dated columns',async({page})=>{
  test.setTimeout(90000);await boot(page,1600);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="schedule"]').click();
  await expect(page.locator('#scheduleView .j425-week-column')).toHaveCount(7);
  await expect(page.locator('#scheduleView .j425-week-hours')).toBeVisible();
  const weekAdd=page.locator('#scheduleView [data-j443-add-schedule-date]');
  await expect(weekAdd).toHaveCount(7);
  const selectedDate=await weekAdd.first().getAttribute('data-j443-add-schedule-date');
  await weekAdd.first().click();
  await expect(page.locator('#scheduleDialog')).toBeVisible();
  await expect(page.locator('#scheduleStart')).toHaveValue(new RegExp('^'+selectedDate));
  await page.locator('#closeScheduleDialog').evaluate(el=>el.click());
  await page.locator('#scheduleView [data-j425-add-schedule]').click();
  await expect(page.locator('#scheduleDialog')).toBeVisible();
  await page.locator('#closeScheduleDialog').evaluate(el=>el.click());
});


test('JOURNAL ToDo and Memo use independent layouts and canonical editing',async({page})=>{
  test.setTimeout(90000);await boot(page,1440);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="todos"]').click();
  await expect(page.locator('#todoView .j425-todo-trays')).toBeVisible();
  await expect(page.locator('#todoView .j425-todo-reading')).toBeVisible();
  await page.locator('#todoView #todayTodoInput').fill('ノート専用のチェック項目');
  await page.locator('#todoView [data-j425-todo-create] button[type="submit"]').click();
  const row=page.locator('#todoView .j425-todo-record').filter({hasText:'ノート専用のチェック項目'});
  await expect(row).toBeVisible();
  await row.locator('[data-j425-todo-toggle]').check();
  await expect(page.locator('#todoView .j425-todo-done')).toContainText('ノート専用のチェック項目');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="memo"]').click();
  await expect(page.locator('#workMemoViewV167 .j425-memo-spread')).toBeVisible();
  await expect(page.locator('#workMemoViewV167 .j425-memo-gallery')).toBeVisible();
  await page.locator('.wb-journal-add-toggle-v367').click();
  await page.locator('[data-journal-create="memo"]').click();
  await expect(page.locator('#workMemoDialogV167')).toBeVisible();
});


test('JOURNAL ToDo paper rows remain readable with long text on desktop and mobile',async({page})=>{
  test.setTimeout(90000);await boot(page,1366);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="todos"]').click();
  // Empty personal rooms do not render an empty focus tray.
  await page.locator('#todayTodoInput').fill('備品管理システムのテストモジュール確認と完了履歴の表示確認');
  await page.locator('#todoView [data-j425-todo-create] button[type="submit"]').click();
  const tray=page.locator('#todoView .j425-todo-focus .j425-todo-items');
  await expect(tray).toBeVisible();
  const initial=await tray.locator('.j425-todo-record').count();
  await tray.evaluate(root=>{
    for(let i=0;i<30;i++){
      const el=document.createElement('article');el.className='j425-todo-record';el.innerHTML='<label class="j425-todo-check"><input type="checkbox"></label><button class="j425-todo-record-title"><strong>備品管理システムのテストモジュール確認と完了履歴の表示確認</strong></button><span></span><div></div>';
      root.append(el);
    }
  });
  const rows=tray.locator('.j425-todo-record');await expect(rows).toHaveCount(initial+30);
  const desktop=await rows.first().evaluate(el=>({width:el.getBoundingClientRect().width,text:el.querySelector('strong').getBoundingClientRect().width}));
  expect(desktop.text).toBeGreaterThan(180);
  await page.setViewportSize({width:390,height:840});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(2);
  const mobile=await rows.first().evaluate(el=>({width:el.getBoundingClientRect().width,text:el.querySelector('strong').getBoundingClientRect().width}));
  expect(mobile.width).toBeLessThanOrEqual(390);expect(mobile.text).toBeGreaterThan(95);
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
  await expect(card.locator('.work-memo-body-v167')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
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

test('JOURNAL task desk and editorial list remain distinct and dashboard remains available',async({page})=>{
  test.setTimeout(90000);await boot(page);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  await expect(page.locator('#boardView .j420-atelier-hero')).toContainText('案件アトリエ');
  await page.locator('#boardView [data-j420-layout="list"]').click();
  await expect(page.locator('#listView .j425-task-index')).toBeVisible();
  await expect(page.locator('#listView .j425-index-workpaper')).toBeVisible();
  await expect(page.locator('#listView .j425-task-preview')).toBeVisible();
  await expect(page.locator('#listView .task-table')).toHaveCount(0);
  await page.locator('[data-stat-layout="dashboard"]').evaluate(el=>el.click());
  await expect(page.locator('#dashboardView')).toBeVisible();
});


test('JOURNAL Ver.430 task facets and intact stationery remain interactive',async({page})=>{
  test.setTimeout(90000);await boot(page,1440);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  await page.locator('#boardView [data-j420-layout="list"]').click();
  const root=page.locator('#listView .j425-task-index');
  await expect(root).toBeVisible();
  await expect(root.locator('.j430-filter-section')).toHaveCount(3);
  const options=root.locator('[data-j430-facet="status"]');
  await expect(options.first()).toHaveAttribute('aria-pressed','true');
  if(await options.count()>1){
    await options.nth(1).click();
    await expect(options.nth(1)).toHaveAttribute('aria-pressed','true');
    await root.locator('[data-j425-reset]').click();
    await expect(root.locator('[data-j430-facet="status"]').first()).toHaveAttribute('aria-pressed','true');
  }
  await expect(root.locator('.j430-list-plant')).toBeVisible();
  await expect(root.locator('.j430-list-pen')).toBeVisible();
  const penGeometry=await root.locator('.j430-list-pen').evaluate(el=>{
    const img=el.getBoundingClientRect(),space=el.closest('.j425-list-props').getBoundingClientRect();
    return {width:img.width,height:img.height,inside:img.left>=space.left-1&&img.right<=space.right+1};
  });
  expect(penGeometry.width).toBeGreaterThan(100);
  expect(penGeometry.height).toBeGreaterThan(0);
  expect(penGeometry.inside).toBeTruthy();
});

test('JOURNAL Ver.430 ToDo tray folds, and schedule categories are local filters',async({page})=>{
  test.setTimeout(90000);await boot(page,1300);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="todos"]').click();
  const todo=page.locator('#todoView');
  await todo.locator('#todayTodoInput').fill('JOURNAL作業トレイ折りたたみ');
  await todo.locator('[data-j425-todo-create] button[type="submit"]').click();
  const fold=todo.locator('[data-j430-todo-fold="focus"]');
  await expect(fold).toBeVisible();
  await fold.click();
  await expect(fold).toHaveAttribute('aria-expanded','false');
  await expect(todo.locator('.j425-todo-focus .j425-todo-items')).toBeHidden();
  await fold.click();
  await expect(todo.locator('.j425-todo-focus .j425-todo-items')).toBeVisible();
  const todoArt=todo.locator('.j442-todo-stationery');
  await expect(todoArt).toBeVisible();
  expect(await todoArt.evaluate(el=>el.complete && el.naturalWidth>0)).toBeTruthy();
  await expect(todo.locator('.j430-todo-ruler')).toHaveCount(0);
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="schedule"]').click();
  const schedule=page.locator('#scheduleView');
  await expect(schedule.locator('[data-j430-schedule-category]')).not.toHaveCount(0);
  const scheduleArt=schedule.locator('.j442-schedule-botanical');
  await expect(scheduleArt).toBeVisible();
  expect(await scheduleArt.evaluate(el=>el.complete && el.naturalWidth>0)).toBeTruthy();
  await expect(schedule.locator('.j430-schedule-datestamp')).toHaveCount(0);
});
test('JOURNAL narrow phone shows all paper workspaces and modes can be restored',async({page})=>{
  test.setTimeout(90000);await boot(page,390);await choose(page,'journal');
  const dock=page.locator('#wbJournalDockV367');await expect(dock).toBeVisible();
  await expect(page.locator('#todayView .j420-planner')).toBeVisible();
  await dock.locator('[data-journal-route="tasks"]').click();
  await expect(page.locator('#boardView .j420-atelier-desk')).toBeVisible();
  await page.locator('#boardView [data-j420-layout="list"]').click();
  await expect(page.locator('#listView .j425-index-records')).toBeVisible();
  const filters=page.locator('#listView [data-j447-toggle-filters]');
  await expect(filters).toBeVisible();
  await expect(filters).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#listView #j447TaskFilterPanel')).toBeHidden();
  await filters.click();
  await expect(filters).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#listView #j447TaskFilterPanel')).toBeVisible();
  await filters.click();
  await expect(page.locator('#listView #j447TaskFilterPanel')).toBeHidden();
  await page.locator('#listView [data-j425-task-layout="timeline"]').click();
  await expect(page.locator('#timelineView .jv-chronicle-day').first()).toBeVisible();
  const dayAction=page.locator('#timelineView [data-jv-add-date]').first();
  await expect(dayAction).toBeVisible();
  const chosenDate=await dayAction.getAttribute('data-jv-add-date');
  expect(chosenDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await dayAction.click();
  await expect(page.locator('#taskDialog')).toBeVisible();
  await expect(page.locator('#taskDueDate')).toHaveValue(chosenDate);
  await page.keyboard.press('Escape');
  await dock.locator('[data-journal-route="todos"]').click();
  await expect(page.locator('#todoView .j425-todo-trays')).toBeVisible();
  await dock.locator('[data-journal-route="schedule"]').click();
  await expect(page.locator('#scheduleView .j425-schedule-planner')).toBeVisible();
  const phoneDateAdd=page.locator('#scheduleView [data-j443-add-schedule-date]').first();
  await expect(phoneDateAdd).toBeVisible();
  const phoneDate=await phoneDateAdd.getAttribute('data-j443-add-schedule-date');
  await phoneDateAdd.click();
  await expect(page.locator('#scheduleDialog')).toBeVisible();
  await expect(page.locator('#scheduleStart')).toHaveValue(new RegExp('^'+phoneDate));
  await page.locator('#closeScheduleDialog').evaluate(el=>el.click());
  await expect(dock.locator('[data-journal-route]')).toHaveCount(5);
  await dock.locator('[data-journal-route="memo"]').click();
  await expect(dock.locator('[data-journal-route="memo"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#workMemoViewV167 .j425-memo-spread')).toBeVisible();
  const memoArt=page.locator('#workMemoViewV167 .j442-memo-linen');
  await expect(memoArt).toBeVisible();
  expect(await memoArt.evaluate(el=>el.complete && el.naturalWidth>0)).toBeTruthy();
  await expect(page.locator('#workMemoViewV167 .j430-memo-seal')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(2);
  await choose(page,'classic');
  await expect(page.locator('#workMemoViewV167 .j425-memo-spread')).toHaveCount(0);
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
  page.once('dialog',prompt=>prompt.accept());
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
  await page.locator('#scheduleView [data-j425-add-schedule]').first().click();
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
  page.once('dialog',prompt=>prompt.accept());
  await dialog.locator('#closeScheduleDialog').click();
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
  // The outline is position:relative, scroll-compensated by the editor.
  expect(layout.position).toBe('relative');
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

test('JOURNAL memo and schedule search preserve Japanese IME composition',async({page})=>{
  test.setTimeout(90000);await boot(page,1366);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="memo"]').click();
  // JOURNAL intentionally owns one visible search field; the canonical memo
  // field stays hidden but receives the committed query through its adapter.
  const memo=page.locator('#wbJournalSearchV393');await expect(memo).toBeVisible();
  const during=await memo.evaluate(input=>{input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));input.value='きょう';input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));return input.isConnected});
  expect(during).toBe(true);
  await memo.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));
  await expect(memo).toHaveValue('きょう');
  await expect(page.locator('#workMemoViewV167 [data-memo-search]')).toHaveValue('きょう');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="schedule"]').click();
  const schedule=page.locator('#scheduleView [data-j425-schedule-query]');
  await expect(schedule).toBeVisible();
  expect(await schedule.evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));el.value='よてい';el.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));return el.isConnected})).toBe(true);
  await schedule.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));
  await expect(page.locator('#scheduleView [data-j425-schedule-query]')).toHaveValue('よてい');
  // Page-local IME input must replace the old common query before rerender.
  await expect(page.locator('#wbJournalSearchV393')).toHaveValue('よてい');
  await expect(page.locator('#searchInput')).toHaveValue('よてい');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="todos"]').click();
  const todoSearch=page.locator('#todoView [data-j425-todo-search]');
  await todoSearch.fill('個人のチェック');
  await expect(page.locator('#wbJournalSearchV393')).toHaveValue('個人のチェック');
  await expect(page.locator('#todoView [data-j425-todo-search]')).toHaveValue('個人のチェック');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  const taskSearch=page.locator('#boardView [data-j420-search]');
  await taskSearch.fill('設備点検');
  await expect(page.locator('#wbJournalSearchV393')).toHaveValue('設備点検');
  await expect(page.locator('#searchInput')).toHaveValue('設備点検');
});


test('JOURNAL ToDo records have accessible controls and appear in grouped trays',async({page})=>{
  test.setTimeout(90000);await boot(page,1366);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="todos"]').click();
  await expect(page.locator('#todoView .j425-todo-layout')).toBeVisible();
  // Empty categories are not rendered: the checklist is immediately visible.
  await expect(page.locator('#todoView .j425-todo-trays')).toBeVisible();
  expect(await page.locator('#todoView .j425-todo-tray').count()).toBeLessThanOrEqual(3);
  await page.locator('#todayTodoInput').fill('今日のチェック確認');
  await page.locator('[data-j425-todo-create] button[type="submit"]').click();
  const row=page.locator('.j425-todo-record').filter({hasText:'今日のチェック確認'});
  await expect(row).toBeVisible();
  const trayCounts=await page.locator('#todoView .j425-todo-tray').evaluateAll(trays=>
    trays.map(tray=>tray.querySelectorAll('.j425-todo-record').length));
  expect(trayCounts.length).toBeGreaterThan(0);
  expect(trayCounts.every(count=>count>0)).toBeTruthy();
  await row.locator('[data-j425-todo-select]').click();
  await expect(page.locator('.j425-todo-reading form')).toBeVisible();
  await expect(row.locator('input[type="checkbox"]')).toHaveCount(1);
  await row.locator('[data-j425-todo-toggle]').check();
  await expect(page.locator('.j425-todo-done')).toContainText('今日のチェック確認');
});


test('JOURNAL monthly planner and mini calendar have live day controls',async({page})=>{
  test.setTimeout(90000);await boot(page,1440);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="schedule"]').click();
  await page.locator('#scheduleView [data-j425-mode="month"]').click();
  await expect(page.locator('#scheduleView .j425-month-grid button')).toHaveCount(42);
  await expect(page.locator('#scheduleView .j425-schedule-sidebar')).toBeVisible();
  await page.locator('#scheduleView .j425-month-grid button').nth(15).click();
  await expect(page.locator('#scheduleView .j425-week-grid.is-single-day')).toBeVisible();
  await page.locator('#scheduleView [data-j425-today]').click();
  await expect(page.locator('#scheduleView .j425-schedule-datebar')).toBeVisible();
});


test('JOURNAL global search continues to control canonical search and local memo bridge',async({page})=>{
  test.setTimeout(90000);await boot(page,1440);await choose(page,'journal');
  const search=page.locator('#wbJournalSearchV393');await expect(search).toBeVisible();
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  await search.fill('検証メモ');
  await expect(page.locator('#searchInput')).toHaveValue('検証メモ');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="memo"]').click();
  await expect(page.locator('#workMemoViewV167 [data-memo-search]')).toHaveValue('検証メモ');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="todos"]').click();
  await expect(page.locator('#todoView [data-j425-todo-search]')).toHaveValue('検証メモ');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="schedule"]').click();
  await expect(page.locator('#searchInput')).toHaveValue('検証メモ');
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
  await expect(book.locator('.j-settings-optional-filters-v396')).toHaveCount(0);
  await expect(page.locator('.sidebar > .side-card.filters')).toBeHidden();
  await book.locator('[data-journal-settings-tab="display"]').click();
  await book.locator('[data-wb-display-choice="classic"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
  await expect(page.locator('#jSettingsBookV393')).toHaveCount(0);
  await expect(page.locator('.sidebar .user-card #wbDisplayChoiceV356')).toHaveCount(1);
  await expect(page.locator('.sidebar > .nav')).toHaveCount(1);
});

test('JOURNAL illustrated navigation opens a real standalone Today planner',async ({page})=>{
  test.setTimeout(90000);await boot(page,1366);await choose(page,'journal');
  const tabs=page.locator('.wb-journal-tabs-v367 button');
  await expect(tabs).toHaveCount(5);
  await expect(page.locator('.wb-journal-tabs-v367 .j-tab-illustration-v412 svg')).toHaveCount(5);
  await expect(page.locator('#todayView .j420-agenda')).toBeVisible();
  await expect(page.locator('#todayView .today-panel')).toHaveCount(0);
  await expect(page.locator('#todayView .j420-work-note').first().or(page.locator('#todayView .j420-empty').first())).toBeVisible();
});

test('JOURNAL task index remains alongside the final editor page when dialog scrolls to bottom', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,1366);
  await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  await page.locator('#boardView [data-j420-new-task]').click();
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

test('JOURNAL Atelier and weekly planner open canonical editing dialogs',async({page})=>{
  test.setTimeout(90000);await boot(page,1450);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  await expect(page.locator('#boardView .j420-atelier-tools')).toBeVisible();
  await page.locator('#boardView [data-j420-new-task]').click();
  await expect(page.locator('#taskDialog')).toBeVisible();
  await page.locator('#closeTaskDialog').evaluate(el=>el.click());
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="schedule"]').click();
  await expect(page.locator('#scheduleView .j425-week-grid')).toBeVisible();
  await page.locator('#scheduleView [data-j425-add-schedule]').click();
  await expect(page.locator('#scheduleDialog')).toBeVisible();
  await page.locator('#closeScheduleDialog').evaluate(el=>el.click());
  await choose(page,'classic');
  await expect(page.locator('#scheduleView .j425-schedule')).toHaveCount(0);
  // The canonical Classic schedule must return, not a hidden JOURNAL planner.
  await expect(page.locator('#scheduleView .schedule-head')).toBeVisible();
  await choose(page,'journal');
  await expect(page.locator('#scheduleView .j425-schedule-layout')).toBeVisible();
});


test('JOURNAL retains two notebook themes across ToDo and schedule',async({page})=>{
  test.setTimeout(90000);await boot(page,1740);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="todos"]').click();
  await expect(page.locator('#todoView .j425-todo-layout')).toBeVisible();
  await page.locator('[data-journal-settings]').click();
  await page.locator('#wbJournalPreferencesV370 [data-journal-theme="margin"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-journal-theme','margin');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="schedule"]').click();
  await expect(page.locator('#scheduleView .j425-schedule-layout')).toBeVisible();
});


test('JOURNAL weekly schedule navigation is compact, responsive and usable',async({page})=>{
  test.setTimeout(90000);await boot(page,1440);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="schedule"]').click();
  await expect(page.locator('#scheduleView .j425-schedule-datebar')).toBeVisible();
  await expect(page.locator('#scheduleView .j425-week-column')).toHaveCount(7);
  await page.locator('#scheduleView [data-j425-shift="1"]').click();
  await expect(page.locator('#scheduleView .j425-week-column')).toHaveCount(7);
  await page.locator('#scheduleView [data-j425-mode="month"]').click();
  await expect(page.locator('#scheduleView .j425-month-grid')).toBeVisible();
});


test('JOURNAL Atelier toolbar can create a task and search without covering other controls',async ({page})=>{
  test.setTimeout(90000);await boot(page,1440);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  const create=page.locator('#boardView [data-j420-new-task]');
  const search=page.locator('#boardView [data-j420-search]');
  await expect(create).toBeVisible();await expect(search).toBeVisible();
  const a=await create.boundingBox(),b=await search.boundingBox();
  expect(a.x+a.width<=b.x+1 || b.x+b.width<=a.x+1 || a.y+a.height<=b.y+1).toBeTruthy();
  await search.fill('案件を探す');
  await expect(page.locator('#searchInput')).toHaveValue('案件を探す');
  await expect(page.locator('#boardView [data-j420-search]')).toHaveValue('案件を探す');
  await page.locator('#boardView [data-j420-new-task]').click();
  await expect(page.locator('#taskDialog')).toBeVisible();
});

test('JOURNAL ToDo uses its own form and Classic form is restored after mode change',async({page})=>{
  test.setTimeout(90000);await boot(page,1366);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="todos"]').click();
  const f=page.locator('#todoView [data-j425-todo-create]');
  await expect(f.locator('#todayTodoInput')).toBeVisible();
  await expect(f.locator('button[type="submit"]')).toBeVisible();
  await choose(page,'classic');
  await expect(page.locator('#todoView [data-j425-todo-create]')).toHaveCount(0);
  await expect(page.locator('#todoView [data-todo-form]')).toBeVisible();
  // Re-entering JOURNAL should recreate its one original ToDo form.
  await choose(page,'journal');
  await expect(page.locator('#todoView [data-j425-todo-create]')).toBeVisible();
  await expect(page.locator('#todoView [data-todo-form]')).toHaveCount(0);
});


test('JOURNAL Memo has live index, color filters and varied fastener styles',async({page})=>{
  test.setTimeout(90000);await boot(page,1440);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="memo"]').click();
  await expect(page.locator('#workMemoViewV167 .j425-memo-spread')).toBeVisible();
  await expect(page.locator('#workMemoViewV167 .j425-memo-index')).toBeVisible();
  await expect(page.locator('#workMemoViewV167 .j425-memo-reader')).toBeVisible();
  await expect(page.locator('.j-memo-color-choice-v396')).toHaveCount(7);
  await page.locator('.j-memo-color-choice-v396[data-journal-memo-color="mint"]').click();
  await expect(page.locator('.j-memo-color-choice-v396[data-journal-memo-color="mint"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('.j-memo-color-choice-v396[data-journal-memo-color="all"]').click();
  await choose(page,'classic');
  await expect(page.locator('#workMemoViewV167 .j425-memo-spread')).toHaveCount(0);
});


test('JOURNAL Task Atelier renders indexed shelves and a bottom notebook instead of a Classic Kanban',async ({page})=>{
  test.setTimeout(90000);await boot(page,1680);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView');
  await expect(board.locator('.j420-atelier')).toBeVisible();
  // V520 deliberately suppresses empty shelves when no cases exist. The
  // original four-shelf contract applies once a real case is available.
  await expect(board.locator('.j520-atelier-empty')).toBeVisible();
  await board.locator('[data-j420-new-task]').click();
  const editor=page.locator('#taskDialog');
  await expect(editor).toBeVisible();
  await editor.locator('#taskTitle').fill('JOURNAL 棚の表示確認');
  await editor.locator('#taskForm button[type="submit"]').click();
  await expect(editor).toBeHidden();
  await expect(board.locator('.j420-island').first()).toBeVisible();
  await expect(board.locator('.j420-project-note')).toBeVisible();
  await expect(board.locator('.board-column')).toHaveCount(0);
  expect(await board.locator('.j420-island').count()).toBeGreaterThanOrEqual(4);
  await expect(board.locator('[data-j420-new-task]')).toBeVisible();
});

test('JOURNAL timeline is a vertically dated chronicle rather than Classic grid',async ({page})=>{
  test.setTimeout(90000);await boot(page,1440);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  await page.locator('#boardView .j420-atelier-switch [data-j420-layout="timeline"]').click();
  const timeline=page.locator('#timelineView');
  await expect(timeline.locator('.jv-chronicle-day').first()).toBeVisible();
  await expect(timeline.locator('.timeline-grid')).toHaveCount(0);
  await expect(timeline.locator('[data-timeline-range]')).toHaveValue('14');
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
    await expect(index).toHaveCSS('position','sticky');
    expect(await index.evaluate(el=>el.style.transform)).toBe('');
    const after=await index.boundingBox();
    expect(after.y).toBeGreaterThanOrEqual(before.y-35);
  }
});

test('JOURNAL 320px dock opens Memo and Settings without overflow',async({page})=>{
  test.setTimeout(90000);
  await boot(page,320);
  await choose(page,'journal');
  const dock=page.locator('#wbJournalDockV367');
  await expect(dock.locator('[data-journal-route]')).toHaveCount(5);
  await expect(dock.locator('.wb-journal-more-v367')).toBeVisible();
  await dock.locator('[data-journal-route="memo"]').click();
  await expect(page.locator('#workMemoViewV167 .j425-memo-spread')).toBeVisible();
  await expect(dock.locator('[data-journal-route="memo"]')).toHaveAttribute('aria-current','page');
  await dock.locator('.wb-journal-more-v367').click();
  await expect(page.locator('body')).toHaveAttribute('data-journal-settings-open','true');
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-journal-settings-open','false');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});

test('JOURNAL desktop memo index follows the paper; phone ToDo filters are compact',async({page})=>{
  test.setTimeout(90000);
  await boot(page,1366);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="memo"]').click();
  const index=page.locator('#workMemoViewV167 .j425-memo-spread>.j425-memo-index');
  await expect(index).toBeVisible();
  await expect(index).toHaveCSS('position','sticky');
  await expect(index).toHaveCSS('overflow-y','auto');
  expect(await index.evaluate(el=>el.style.transform)).toBe('');
  await page.setViewportSize({width:390,height:844});
  await expect(index).toHaveCSS('position','static');
  await page.locator('#wbJournalDockV367 [data-journal-route="todos"]').click();
  const filterRail=page.locator('#todoView .j425-todo-layout>.j425-index-rail');
  await expect(filterRail).toHaveCSS('display','flex');
  await expect(filterRail.locator('[data-j425-todo-filter]')).toHaveCount(4);
  await expect(page.locator('#todoView .j425-todo-trays')).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

test('JOURNAL Ver.450 mobile ToDo jumps to its existing note and returns to the row',async({page})=>{
  test.setTimeout(90000);await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="todos"]').click();
  await page.locator('#todayTodoInput').fill('JOURNAL編集ノートへ移動');
  await page.locator('[data-j425-todo-create] button[type="submit"]').click();
  const row=page.locator('#todoView .j425-todo-record').filter({hasText:'JOURNAL編集ノートへ移動'});
  await expect(row).toBeVisible();
  await row.locator('[data-j425-todo-select]').click();
  await expect(page.locator('#j450TodoNote .j425-todo-detail h3')).toHaveText('JOURNAL編集ノートへ移動');
  await expect(page.locator('#j450TodoNote .j425-todo-detail h3')).toBeFocused();
  await page.locator('[data-j450-todo-back]').click();
  await expect(row.locator('[data-j425-todo-select]')).toBeFocused();
});

test('JOURNAL Ver.450 memo index lookup does not hide canonical memo cards',async({page})=>{
  test.setTimeout(90000);await boot(page,1366);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="memo"]').click();
  await page.locator('#workMemoViewV167 [data-memo-new]').first().click();
  await page.locator('#workMemoTitleV167').fill('JOURNAL索引内検索');
  await page.locator('#workMemoBodyV167').fill('一覧の正本はフィルタしない');
  await page.locator('#workMemoFormV167 button[type="submit"]').click();
  const card=page.locator('#workMemoViewV167 .work-memo-card-v167').filter({hasText:'JOURNAL索引内検索'});
  await expect(card).toBeVisible();
  const lookup=page.locator('[data-j450-memo-find]');
  await lookup.fill('見つからない文字');
  await expect(card).toBeVisible();
  const emptyIndex=page.locator('#workMemoViewV167 .j558-memo-index-empty');
  await expect(emptyIndex).toContainText('検索に一致するメモはありません');
  await expect(page.locator('#workMemoViewV167 .j-memo-index-heading-v383 small'))
    .toHaveText(/^0 \/ \d+ 件$/);
  await emptyIndex.locator('[data-j558-memo-index-reset]').click();
  await expect(lookup).toHaveValue('');
  await expect(lookup).toBeFocused();
  await expect(emptyIndex).toBeHidden();
  await expect(card).toBeVisible();
  await lookup.fill('JOURNAL索引内検索');
  const item=page.locator('.j-memo-index-link-v383').filter({hasText:'JOURNAL索引内検索'});
  await expect(item).toBeVisible();
  await item.click();
  await expect(item).toHaveAttribute('aria-current','true');
});

test('JOURNAL phone memo search explains no matches and resets without hiding saved cards',async({page})=>{
  test.setTimeout(90000);await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="memo"]').click();
  await page.locator('#workMemoViewV167 [data-memo-new]').first().click();
  await page.locator('#workMemoTitleV167').fill('JOURNAL検索復旧サンプル');
  await page.locator('#workMemoBodyV167').fill('検索の対象外になっても本文は維持する');
  await page.locator('#workMemoFormV167 button[type="submit"]').click();
  const card=page.locator('#workMemoViewV167 .work-memo-card-v167')
    .filter({hasText:'JOURNAL検索復旧サンプル'});
  await expect(card).toBeVisible();
  const finder=page.locator('#workMemoViewV167 [data-j450-memo-find]');
  await finder.fill('存在しない検索語');
  const notice=page.locator('#workMemoViewV167 .j558-memo-index-empty');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('検索に一致するメモはありません');
  const reset=notice.locator('[data-j558-memo-index-reset]');
  await expect(reset).toBeVisible();
  const targetSize=await reset.evaluate(el=>el.getBoundingClientRect().height);
  expect(targetSize).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-
    document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await reset.click();
  await expect(finder).toHaveValue('');
  await expect(finder).toBeFocused();
  await expect(notice).toBeHidden();
  await expect(card).toBeVisible();
  await expect(page.locator('.j-memo-index-link-v383')
    .filter({hasText:'JOURNAL検索復旧サンプル'})).toBeVisible();
});

test('JOURNAL compact phone planner retains dates and hides unused hourly space',async({page})=>{
  test.setTimeout(90000);await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="schedule"]').click();
  const options=page.locator('#scheduleView [data-j451-schedule-options]');
  await expect(options).not.toHaveAttribute('open','');
  await expect(page.locator('#scheduleView .j425-week-hours')).toBeHidden();
  const dayColumns=page.locator('#scheduleView .j425-week-column');
  await expect(dayColumns).toHaveCount(7);
  const layout=await page.locator('#scheduleView .j425-week-grid').evaluate(el=>({
    width:el.getBoundingClientRect().width,
    windowWidth:window.innerWidth,
    columns:getComputedStyle(el).gridTemplateColumns.split(' ').length
  }));
  expect(layout.columns).toBe(1);
  expect(layout.width).toBeLessThan(layout.windowWidth);
  await options.locator('summary').click();
  await expect(options).toHaveAttribute('open','');
  await expect(options.locator('.j425-mini-calendar')).toBeVisible();
  await page.locator('#scheduleView [data-j425-mode="day"]').click();
  await expect(page.locator('#scheduleView .j425-week-grid.is-single-day')).toBeVisible();
});

test('JOURNAL compact memo selection opens the reading folio and returns to its card',async({page})=>{
  test.setTimeout(90000);await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="memo"]').click();
  await page.locator('#workMemoViewV167 [data-memo-new]').first().click();
  await page.locator('#workMemoTitleV167').fill('JOURNAL手帳本文の往復');
  await page.locator('#workMemoBodyV167').fill('短い記録をすぐに読んで戻る');
  await page.locator('#workMemoFormV167 button[type="submit"]').click();
  const card=page.locator('#workMemoViewV167 .work-memo-card-v167').filter({hasText:'JOURNAL手帳本文の往復'});
  await expect(card).toBeVisible();
  await page.locator('.j-memo-index-link-v383').filter({hasText:'JOURNAL手帳本文の往復'}).click();
  const reader=page.locator('#workMemoViewV167 .j425-memo-reader');
  await expect(reader).toBeFocused();
  await expect(reader).toContainText('短い記録をすぐに読んで戻る');
  await reader.locator('.j451-memo-back').click();
  await expect(card).toBeFocused();
});

test('JOURNAL day reading slip keeps editing and copying canonical',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="schedule"]').click();
  await page.locator('#scheduleView [data-j425-mode="day"]').click();
  await page.locator('#scheduleView [data-j443-add-schedule-date]').first().click();
  const dialog=page.locator('#scheduleDialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#scheduleTitle').fill('JOURNAL日別確認テスト');
  await dialog.locator('[data-journal-entry-jump="notes"]').click();
  await dialog.locator('#scheduleMemo').fill('閲覧ノートから編集・コピーを選ぶ');
  await dialog.locator('#scheduleForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  const row=page.locator('#scheduleView .j459-day-record').filter({hasText:'JOURNAL日別確認テスト'});
  await expect(row).toBeVisible();
  await row.locator('[data-j459-review]').click();
  const preview=page.locator('#j459SchedulePreview');
  await expect(preview).toBeVisible();
  await expect(preview).toBeFocused();
  await expect(preview).toContainText('閲覧ノートから編集・コピーを選ぶ');
  await preview.locator('[data-j459-copy]').click();
  const copyDialog=page.locator('#scheduleCopyDialog');
  await expect(copyDialog).toBeVisible();
  await expect(copyDialog.locator('#scheduleCopySourceTitle')).toHaveText('JOURNAL日別確認テスト');
  await copyDialog.locator('#closeScheduleCopyDialog').click();
  await expect(copyDialog).toBeHidden();
  await expect(dialog).toBeHidden();
  await expect(preview).toBeVisible();
  await expect(preview).toBeFocused();
  await preview.locator('[data-j459-edit]').click();
  await expect(dialog.locator('#scheduleTitle')).toHaveValue('JOURNAL日別確認テスト');
  await dialog.locator('#closeScheduleDialog').click();
  await expect(preview).toBeFocused();
  await preview.locator('[data-j459-back]').click();
  await expect(row.locator('[data-j459-review]')).toBeFocused();
  await page.locator('[data-j459-return-week]').click();
  await expect(page.locator('#scheduleView .j425-week-column')).toHaveCount(7);
  await expect(page.locator('#scheduleView [data-j425-mode="week"]')).toBeFocused();
});

test('JOURNAL same-day appointment paging keeps the date and keyboard focus',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="schedule"]').click();
  await page.locator('#scheduleView [data-j425-mode="day"]').click();
  const date=await page.locator('#scheduleView [data-j443-add-schedule-date]').first()
    .getAttribute('data-j443-add-schedule-date');
  for(const [title,start,end] of [
    ['午前の確認','09:00','09:30'],['午後の確認','13:00','13:30']
  ]){
    await page.locator('#scheduleView [data-j443-add-schedule-date]').first().click();
    const dialog=page.locator('#scheduleDialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('#scheduleTitle').fill(title);
    await dialog.locator('#scheduleStart').fill(date+'T'+start);
    await dialog.locator('#scheduleEnd').fill(date+'T'+end);
    await dialog.locator('#scheduleForm button[type="submit"]').click();
    await expect(dialog).toBeHidden();
  }
  await expect(page.locator('#scheduleView .j459-day-record')).toHaveCount(2);
  await page.locator('[data-j459-record]').filter({hasText:'午前の確認'})
    .locator('[data-j459-review]').click();
  const note=page.locator('#j459SchedulePreview');
  await expect(note.locator('h3')).toHaveText('午前の確認');
  await expect(note).toContainText('1 / 2件');
  await expect(note.locator('[data-j460-preview-step="-1"]')).toBeDisabled();
  await note.locator('[data-j460-preview-step="1"]').click();
  await expect(note.locator('h3')).toHaveText('午後の確認');
  await expect(note).toContainText('2 / 2件');
  await expect(note.locator('[data-j460-preview-step="1"]')).toBeDisabled();
  await expect(note).toBeFocused();
  await note.locator('[data-j460-preview-step="-1"]').click();
  await expect(note.locator('h3')).toHaveText('午前の確認');
  await note.locator('[data-j459-back]').click();
  await expect(page.locator('[data-j459-record]').filter({hasText:'午前の確認'})
    .locator('[data-j459-review]')).toBeFocused();
});

test('JOURNAL week outlook opens a day without changing the shared view',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="schedule"]').click();
  const outlook=page.locator('#scheduleView .j463-week-overview');
  await expect(outlook).toBeVisible();
  await expect(outlook).toContainText('現在の表示条件での予定登録状況');
  const days=outlook.locator('.j463-day-link');
  await expect(days).toHaveCount(7);
  const selectedDay=await days.nth(2).getAttribute('data-j425-day');
  await days.nth(2).click();
  await expect(page.locator('#scheduleView .j425-week-grid.is-single-day')).toBeVisible();
  await expect(page.locator('#scheduleView .j463-week-overview')).toHaveCount(0);
  const parts=selectedDay.split('-').map(Number);
  await expect(page.locator('#scheduleView .j425-week-column>header>span'))
    .toContainText(parts[1]+'/'+parts[2]);
  await page.locator('#scheduleView [data-j459-return-week]').click();
  await expect(page.locator('#scheduleView .j463-week-overview .j463-day-link')).toHaveCount(7);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth))
    .toBeLessThanOrEqual(2);
});

test('JOURNAL week gap action prefills canonical schedule form without saving',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="schedule"]').click();
  const overview=page.locator('#scheduleView .j463-week-overview');
  await expect(overview).toBeVisible();
  const gapAction=overview.locator('[data-j464-gap-date]').first();
  await expect(gapAction).toBeVisible();
  const day=await gapAction.getAttribute('data-j464-gap-date');
  const aria=await gapAction.getAttribute('aria-label');
  const gap=aria.match(/(\d{2}:\d{2})〜(\d{2}:\d{2})/);
  expect(gap).not.toBeNull();
  await gapAction.click();
  const dialog=page.locator('#scheduleDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#scheduleDialogTitle')).toHaveText('新しい予定');
  await expect(dialog.locator('#scheduleId')).toHaveValue('');
  await expect(dialog.locator('#scheduleStart')).toHaveValue(day+'T'+gap[1]);
  const end=await dialog.locator('#scheduleEnd').inputValue();
  expect(end.startsWith(day+'T')).toBeTruthy();
  const minutes=str=>Number(str.slice(11,13))*60+Number(str.slice(14,16));
  expect(minutes(end)-minutes(day+'T'+gap[1])).toBeGreaterThanOrEqual(30);
  expect(minutes(end)-minutes(day+'T'+gap[1])).toBeLessThanOrEqual(60);
  expect(minutes(end)).toBeLessThanOrEqual(minutes(day+'T'+gap[2]));
  await dialog.locator('#closeScheduleDialog').click();
  await expect(dialog).toBeHidden();
  await expect(overview.locator('[data-j464-gap-date]')).not.toHaveCount(0);
});

test('JOURNAL duration selector navigates only after confirmed save',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="schedule"]').click();
  const overview=page.locator('#scheduleView .j463-week-overview');
  await expect(overview).toBeVisible();
  await expect(overview.locator('[data-j466-duration]')).toHaveCount(2);
  await expect(overview.locator('[data-j466-duration="60"]')).toHaveAttribute('aria-pressed','true');
  await overview.locator('[data-j466-duration="30"]').click();
  await expect(overview.locator('[data-j466-duration="30"]')).toHaveAttribute('aria-pressed','true');
  const action=overview.locator('[data-j464-gap-date]').first();
  await expect(action).toBeVisible();
  await expect(action).toContainText('30分で作成');
  await action.click();
  const dialog=page.locator('#scheduleDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#scheduleId')).toHaveValue('');
  const start=await dialog.locator('#scheduleStart').inputValue();
  const end=await dialog.locator('#scheduleEnd').inputValue();
  expect(new Date(end).getTime()-new Date(start).getTime()).toBe(30*60000);
  await dialog.locator('#scheduleTitle').fill('JOURNAL 30分予定の保存確認');
  await dialog.locator('#scheduleForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#scheduleView .j425-week-grid.is-single-day')).toBeVisible();
  const note=page.locator('#j459SchedulePreview');
  await expect(note).toBeVisible();
  await expect(note.locator('h3')).toHaveText('JOURNAL 30分予定の保存確認');
  await expect(note).toBeFocused();
  const saved=page.locator('#scheduleView .j459-day-record')
    .filter({hasText:'JOURNAL 30分予定の保存確認'});
  await expect(saved).toBeVisible();
  await note.locator('[data-j459-back]').click();
  await expect(saved.locator('[data-j459-review]')).toBeFocused();
  await page.locator('[data-j459-return-week]').click();
  await expect(page.locator('#scheduleView .j463-week-overview')).toBeVisible();
  await expect(page.locator('#scheduleView [data-j466-duration="30"]')).toHaveAttribute('aria-pressed','true');
});

test('JOURNAL V469 start-time picker prefills the chosen start without saving',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="schedule"]').click();
  const overview=page.locator('#scheduleView .j463-week-overview');
  await expect(overview).toBeVisible();
  const picker=overview.locator('[data-j469-gap-start]').first();
  await expect(picker).toBeVisible();
  const day=await picker.getAttribute('data-j469-gap-start');
  const values=await picker.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
  expect(values.length).toBeGreaterThan(1);
  await picker.selectOption(values[1]);
  const chosen=await picker.inputValue();
  await overview.locator('[data-j464-gap-date="'+day+'"]').click();
  const dialog=page.locator('#scheduleDialog');
  await expect(dialog).toBeVisible();
  const start=await dialog.locator('#scheduleStart').inputValue();
  const end=await dialog.locator('#scheduleEnd').inputValue();
  expect(await page.evaluate(value=>new Date(value).getTime(),start)).toBe(Number(chosen));
  expect(new Date(end).getTime()-new Date(start).getTime()).toBe(60*60000);
  await dialog.locator('#closeScheduleDialog').click();
  await overview.locator('[data-j466-duration="30"]').click();
  await expect(overview.locator('[data-j469-gap-start="'+day+'"]')).toHaveValue(chosen);
});

test('Ver.471: initial deferred JOURNAL switch repaints Today and Classic restores its view',async ({page})=>{
  test.setTimeout(90000);
  await boot(page,1366);
  // The initial Classic render is not a JOURNAL canvas.
  await expect(page.locator('#todayView .j420-today')).toHaveCount(0);
  await choose(page,'journal');
  await expect(page.locator('#todayView .j420-today')).toBeVisible({timeout:15000});
  await expect(page.locator('#todayView .today-panel')).toHaveCount(0);
  await choose(page,'classic');
  await expect(page.locator('#todayView .j420-today')).toHaveCount(0);
  await choose(page,'journal');
  await expect(page.locator('#todayView .j420-today')).toBeVisible({timeout:15000});
});

test('JOURNAL V470 chooses a non-longest window without changing canonical save',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="schedule"]').click();
  const date=await page.locator('#scheduleView [data-j443-add-schedule-date]').first()
    .getAttribute('data-j443-add-schedule-date');
  await page.locator('#scheduleView [data-j443-add-schedule-date="'+date+'"]').first().click();
  const dialog=page.locator('#scheduleDialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#scheduleTitle').fill('複数空き枠テスト');
  await dialog.locator('#scheduleStart').fill(date+'T12:00');
  await dialog.locator('#scheduleEnd').fill(date+'T13:00');
  await dialog.locator('#scheduleForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  const overview=page.locator('#scheduleView .j463-week-overview');
  const gap=overview.locator('[data-j470-gap="'+date+'"]');
  await expect(gap).toBeVisible();
  const options=await gap.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
  expect(options).toHaveLength(2);
  expect(await page.evaluate(value=>new Date(Number(value)).getHours(),options[0])).toBe(8);
  expect(await page.evaluate(value=>new Date(Number(value)).getHours(),options[1])).toBe(13);
  await gap.selectOption(options[0]);
  await expect(gap).toHaveValue(options[0]);
  await expect(gap).toBeFocused();
  const start=overview.locator('[data-j469-gap-start="'+date+'"]');
  await expect(start).toHaveValue(options[0]);
  await start.selectOption({label:'10:30'});
  await overview.locator('[data-j464-gap-date="'+date+'"]').click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#scheduleId')).toHaveValue('');
  await expect(dialog.locator('#scheduleStart')).toHaveValue(date+'T10:30');
  await expect(dialog.locator('#scheduleEnd')).toHaveValue(date+'T11:30');
  await dialog.locator('#closeScheduleDialog').click();
  await overview.locator('[data-j466-duration="30"]').click();
  await expect(overview.locator('[data-j470-gap="'+date+'"]')).toHaveValue(options[0]);
  await expect(overview.locator('[data-j469-gap-start="'+date+'"]')).toHaveValue(
    String(await page.evaluate(day=>new Date(day+'T10:30').getTime(),date)));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth))
    .toBeLessThanOrEqual(2);
});

test('JOURNAL V473 desktop free-time strip opens the canonical draft at its tapped time',async({page})=>{
  test.setTimeout(90000);
  await boot(page,1366);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="schedule"]').click();
  const date=await page.locator('#scheduleView [data-j443-add-schedule-date]').first()
    .getAttribute('data-j443-add-schedule-date');
  await page.locator('#scheduleView [data-j443-add-schedule-date="'+date+'"]').click();
  const dialog=page.locator('#scheduleDialog');
  await dialog.locator('#scheduleTitle').fill('予定表示を維持する');
  await dialog.locator('#scheduleStart').fill(date+'T12:00');
  await dialog.locator('#scheduleEnd').fill(date+'T13:00');
  await dialog.locator('#scheduleForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  const column=page.locator('#scheduleView .j425-week-column')
    .filter({has:page.locator('[data-j473-free-date="'+date+'"]')});
  const strip=column.locator('.j473-grid-gap').first();
  await expect(column.locator('.j473-grid-gap')).toHaveCount(2);
  await expect(strip).toBeVisible();
  const booked=column.locator('[data-schedule-id]').first();
  await booked.click();
  await expect(dialog.locator('#scheduleDialogTitle')).toHaveText('予定を編集');
  await dialog.locator('#closeScheduleDialog').click();
  // Top of first 08:00-12:00 interval + 130px corresponds to 10:30.
  await strip.click({position:{x:20,y:130}});
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#scheduleId')).toHaveValue('');
  await expect(dialog.locator('#scheduleStart')).toHaveValue(date+'T10:30');
  await expect(dialog.locator('#scheduleEnd')).toHaveValue(date+'T11:30');
  await dialog.locator('#closeScheduleDialog').click();
  await expect(page.locator('#scheduleView [data-j469-gap-start="'+date+'"]'))
    .toHaveValue(String(await page.evaluate(day=>new Date(day+'T10:30').getTime(),date)));
});
test('JOURNAL V473 phone day slip discloses free times without replacing scheduled items',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="schedule"]').click();
  const column=page.locator('#scheduleView .j425-week-column').first();
  await expect(column.locator('.j473-grid-gap')).toBeHidden();
  const disclosure=column.locator('.j473-mobile-gaps');
  await expect(disclosure).toBeVisible();
  // A nested time-picker adds another summary; click the outer disclosure only.
  await disclosure.locator(':scope > summary').click();
  const action=disclosure.locator('[data-j473-free-date]').first();
  await expect(action).toBeVisible();
  const date=await action.getAttribute('data-j473-free-date');
  await action.click();
  const dialog=page.locator('#scheduleDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#scheduleId')).toHaveValue('');
  await expect(dialog.locator('#scheduleStart')).toHaveValue(date+'T08:00');
  await expect(dialog.locator('#scheduleEnd')).toHaveValue(date+'T09:00');
  await dialog.locator('#closeScheduleDialog').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth))
    .toBeLessThanOrEqual(2);
});

test('JOURNAL V475 phone keeps the chosen free window visible after cancelling the draft',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="schedule"]').click();
  const day=page.locator('#scheduleView .j425-week-column').first();
  const details=day.locator('.j473-mobile-gaps');
  // Avoid matching the separate nested time-picker summary.
  await details.locator(':scope > summary').click();
  const action=details.locator('[data-j473-free-date]').first();
  await expect(action).toBeVisible();
  const date=await action.getAttribute('data-j473-free-date');
  await action.click();
  const dialog=page.locator('#scheduleDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#scheduleId')).toHaveValue('');
  await dialog.locator('#closeScheduleDialog').click();
  const retained=page.locator('#scheduleView [data-j475-mobile-date="'+date+'"]');
  await expect(retained).toHaveAttribute('open','');
  await expect(retained.locator('[data-j475-selected="true"]')).toHaveCount(1);
  const card=page.locator('#scheduleView .j464-week-day')
    .filter({has:page.locator('[data-j469-gap-start="'+date+'"]')});
  await expect(card.locator('.j475-selected-range')).toContainText('08:00〜09:00');
  await page.locator('#scheduleView [data-j466-duration="30"]').click();
  await expect(page.locator('#scheduleView .j464-week-day')
    .filter({has:page.locator('[data-j469-gap-start="'+date+'"]')})
    .locator('.j475-selected-range')).toContainText('08:00〜08:30');
});

test('JOURNAL V476 mobile adjusts, clears and recreates a draft without saving',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="schedule"]').click();
  const day=page.locator('#scheduleView .j425-week-column').first();
  const date=await day.locator('[data-j475-mobile-date]').getAttribute('data-j475-mobile-date');
  const outer=page.locator('#scheduleView [data-j475-mobile-date="'+date+'"]');
  await outer.locator('summary').first().click();
  const precise=outer.locator('[data-j476-mobile-precision="'+date+'"]');
  await precise.locator('summary').click();
  const start=page.locator('[data-j476-mobile-start="'+date+'"]');
  const values=await start.locator('option').evaluateAll(items=>items.map(n=>n.value));
  expect(values.length).toBeGreaterThan(2);
  await start.selectOption(values[2]);
  await expect(page.locator('#scheduleView [data-j475-mobile-date="'+date+'"]')).toHaveAttribute('open','');
  await expect(page.locator('#scheduleView [data-j476-mobile-precision="'+date+'"]')).toHaveAttribute('open','');
  await expect(page.locator('#scheduleView [data-j476-mobile-start="'+date+'"]')).toHaveValue(values[2]);
  await expect(page.locator('#scheduleView .j464-week-day')
    .filter({has:page.locator('[data-j469-gap-start="'+date+'"]')})
    .locator('.j475-selected-range')).toBeVisible();
  await page.locator('#scheduleView [data-j475-mobile-date="'+date+'"] [data-j476-clear-date]').click();
  await expect(page.locator('#scheduleView .j464-week-day')
    .filter({has:page.locator('[data-j469-gap-start="'+date+'"]')})
    .locator('.j475-selected-range')).toHaveCount(0);
  await expect(page.locator('#scheduleView [data-j475-mobile-date="'+date+'"]')).toHaveAttribute('open','');
  await expect(page.locator('#scheduleView [data-j476-mobile-precision="'+date+'"]')).toHaveAttribute('open','');
  await page.locator('#scheduleView [data-j476-mobile-create="'+date+'"]').click();
  const dialog=page.locator('#scheduleDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#scheduleId')).toHaveValue('');
  await dialog.locator('#closeScheduleDialog').click();
  await expect(page.locator('#scheduleView [data-j475-mobile-date="'+date+'"]')).toHaveAttribute('open','');
});

test('JOURNAL V478 mobile note sits below its card, moves on resize and closes to the same card',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="schedule"]').click();
  await page.locator('#scheduleView [data-j425-mode="day"]').click();
  await page.locator('#scheduleView [data-j443-add-schedule-date]').first().click();
  const dialog=page.locator('#scheduleDialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#scheduleTitle').fill('JOURNAL詳細インライン');
  await dialog.locator('#scheduleForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  const row=page.locator('#scheduleView .j459-day-record').filter({hasText:'JOURNAL詳細インライン'});
  await row.locator('[data-j459-review]').click();
  const note=page.locator('#j459SchedulePreview');
  await expect(note).toBeVisible();
  await expect(note).toBeFocused();
  await expect(note.locator('[data-j459-edit]')).toBeVisible();
  await expect(note.locator('[data-j459-copy]')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>{
    const row=document.querySelector('#scheduleView .j459-day-record.is-selected');
    const note=document.querySelector('#j459SchedulePreview');
    return Boolean(row&&row.nextElementSibling===note);
  })).toBe(true);
  await expect(page.locator('#scheduleView #j459SchedulePreview')).toHaveCount(1);
  await page.setViewportSize({width:1366,height:900});
  await expect.poll(()=>page.evaluate(()=>{
    const note=document.querySelector('#j459SchedulePreview');
    return Boolean(note?.closest('.j425-schedule-sidebar'));
  })).toBe(true);
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>{
    const row=document.querySelector('#scheduleView .j459-day-record.is-selected');
    return Boolean(row?.nextElementSibling?.id==='j459SchedulePreview');
  })).toBe(true);
  await note.locator('[data-j459-back]').click();
  await expect(page.locator('#j459SchedulePreview')).toHaveCount(0);
  await expect(row.locator('[data-j459-review]')).toBeFocused();
  await expect(row.locator('[data-j459-review]')).toHaveAttribute('aria-expanded','false');
});

test('JOURNAL V479 editing and changing the date returns to the updated day note',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="schedule"]').click();
  await page.locator('#scheduleView [data-j425-mode="day"]').click();
  await page.locator('#scheduleView [data-j443-add-schedule-date]').first().click();
  const dialog=page.locator('#scheduleDialog');
  const current=await dialog.locator('#scheduleStart').inputValue();
  await dialog.locator('#scheduleTitle').fill('JOURNAL編集前');
  await dialog.locator('#scheduleForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  await page.locator('#scheduleView .j459-day-record').filter({hasText:'JOURNAL編集前'})
    .locator('[data-j459-review]').click();
  const note=page.locator('#j459SchedulePreview');
  await expect(note).toBeFocused();
  await note.locator('[data-j459-edit]').click();
  const newDay=new Date(current);
  newDay.setDate(newDay.getDate()+1);
  const next=[newDay.getFullYear(),String(newDay.getMonth()+1).padStart(2,'0'),
    String(newDay.getDate()).padStart(2,'0')].join('-');
  await dialog.locator('#scheduleTitle').fill('JOURNAL編集後');
  await dialog.locator('#scheduleStart').fill(next+'T14:00');
  await dialog.locator('#scheduleEnd').fill(next+'T15:00');
  await dialog.locator('#scheduleForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  await expect(note).toBeVisible();
  await expect(note).toBeFocused();
  await expect(note.locator('h3')).toHaveText('JOURNAL編集後');
  await expect(page.locator('#scheduleView [data-j459-record]')).toHaveCount(1);
  await expect(page.locator('#scheduleView [data-j459-record]').filter({hasText:'JOURNAL編集後'}))
    .toBeVisible();
});

test('JOURNAL V479 direct copy completion restores the note, without opening the editor',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="schedule"]').click();
  await page.locator('#scheduleView [data-j425-mode="day"]').click();
  await page.locator('#scheduleView [data-j443-add-schedule-date]').first().click();
  const dialog=page.locator('#scheduleDialog');
  await dialog.locator('#scheduleTitle').fill('JOURNALコピー元');
  await dialog.locator('#scheduleForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  const row=page.locator('#scheduleView .j459-day-record').filter({hasText:'JOURNALコピー元'});
  await row.locator('[data-j459-review]').click();
  const note=page.locator('#j459SchedulePreview');
  await note.locator('[data-j459-copy]').click();
  const copy=page.locator('#scheduleCopyDialog');
  await expect(copy).toBeVisible();
  await copy.locator('#scheduleCopySubmit').click();
  await expect(copy).toBeHidden();
  await expect(dialog).toBeHidden();
  await expect(note).toBeVisible();
  await expect(note).toBeFocused();
  await expect(note.locator('h3')).toHaveText('JOURNALコピー元');
});

test('JOURNAL V481 phone appointment note prioritizes schedule, actions and compact metadata',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="schedule"]').click();
  await page.locator('#scheduleView [data-j425-mode="day"]').click();
  await page.locator('#scheduleView [data-j443-add-schedule-date]').first().click();
  const dialog=page.locator('#scheduleDialog');
  await dialog.locator('#scheduleTitle').fill('JOURNALコンパクト表示');
  await dialog.locator('#scheduleLocation').fill('第2会議室');
  await dialog.locator('#scheduleMemo').fill('短いメモをそのまま表示');
  await dialog.locator('#scheduleForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  const row=page.locator('#scheduleView .j459-day-record').filter({hasText:'JOURNALコンパクト表示'});
  await row.locator('[data-j459-review]').click();
  const note=page.locator('#j459SchedulePreview');
  await expect(note).toBeVisible();
  await expect(note.locator('.j481-date-row')).toBeVisible();
  await expect(note.locator('.j481-category')).toBeVisible();
  await expect(note.locator('.j481-preview-meta>div')).toHaveCount(2);
  await expect(note.locator('.j481-preview-meta')).toContainText('第2会議室');
  await expect(note.locator('.j481-memo-details')).toHaveCount(0);
  await expect(note.locator('.j481-memo-block')).toContainText('短いメモをそのまま表示');
  const order=await note.evaluate(node=>Array.from(node.children).map(child=>child.className||child.tagName));
  expect(order.indexOf('j459-preview-actions')).toBeLessThan(order.indexOf('j459-preview-meta j481-preview-meta'));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(2);
});

test('JOURNAL V481 long memo excerpt expands and remains open across editor cancel',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="schedule"]').click();
  await page.locator('#scheduleView [data-j425-mode="day"]').click();
  await page.locator('#scheduleView [data-j443-add-schedule-date]').first().click();
  const dialog=page.locator('#scheduleDialog');
  const message='長い記録を全文で確認する。'.repeat(30);
  await dialog.locator('#scheduleTitle').fill('JOURNAL長文確認');
  await dialog.locator('#scheduleMemo').fill(message);
  await dialog.locator('#scheduleForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  await page.locator('#scheduleView .j459-day-record').filter({hasText:'JOURNAL長文確認'})
    .locator('[data-j459-review]').click();
  const note=page.locator('#j459SchedulePreview');
  const memo=note.locator('.j481-memo-details');
  await expect(memo).toBeVisible();
  await expect(memo).not.toHaveAttribute('open','');
  await expect(memo.locator('.j481-memo-excerpt')).toBeVisible();
  await memo.locator('summary').click();
  await expect(memo).toHaveAttribute('open','');
  await expect(memo.locator('.j459-preview-memo')).toContainText(message);
  await note.locator('[data-j459-edit]').click();
  await expect(dialog).toBeVisible();
  await dialog.locator('#closeScheduleDialog').click();
  await expect(note).toBeVisible();
  await expect(note.locator('.j481-memo-details')).toHaveAttribute('open','');
  await expect(note.locator('.j481-memo-details .j459-preview-memo')).toContainText(message);
});

test('JOURNAL V484 320px/390px note wraps long titles and keeps paging reachable',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="schedule"]').click();
  await page.locator('#scheduleView [data-j425-mode="day"]').click();
  const date=await page.locator('#scheduleView [data-j443-add-schedule-date]').first()
    .getAttribute('data-j443-add-schedule-date');
  const title='引継ぎ会議および設備点検の予定を長い件名でも省略せず確認するための記録';
  const titles=[title,'二件目の予定を確認する','三件目の予定を確認する'];
  const memo='機器の確認事項と作業記録を全文で閲覧する。'.repeat(28);
  for(let i=0;i<3;i++){
    await page.locator('#scheduleView [data-j443-add-schedule-date="'+date+'"]').first().click();
    const dialog=page.locator('#scheduleDialog');
    await dialog.locator('#scheduleTitle').fill(titles[i]);
    await dialog.locator('#scheduleStart').fill(date+'T'+String(9+2*i).padStart(2,'0')+':00');
    await dialog.locator('#scheduleEnd').fill(date+'T'+String(10+2*i).padStart(2,'0')+':00');
    if(i===0)await dialog.locator('#scheduleMemo').fill(memo);
    await dialog.locator('#scheduleForm button[type="submit"]').click();
    await expect(dialog).toBeHidden();
  }
  await page.locator('#scheduleView .j459-day-record').filter({hasText:title})
    .locator('[data-j459-review]').click();
  const note=page.locator('#j459SchedulePreview');
  await expect(note.locator('h3')).toHaveText(title);
  for(const width of [320,390]){
    await page.setViewportSize({width,height:800});
    await expect(note).toBeVisible();
    const geometry=await note.evaluate(element=>{
      const title=element.querySelector('h3');
      const box=element.getBoundingClientRect(),name=title.getBoundingClientRect();
      const font=parseFloat(getComputedStyle(title).lineHeight);
      return {overflow:element.scrollWidth-element.clientWidth,
        noteLeft:box.left,noteRight:box.right,titleRight:name.right,
        titleHeight:name.height,lineHeight:font,viewport:window.innerWidth};
    });
    expect(geometry.overflow).toBeLessThanOrEqual(2);
    expect(geometry.noteLeft).toBeGreaterThanOrEqual(-2);
    expect(geometry.noteRight).toBeLessThanOrEqual(geometry.viewport+2);
    expect(geometry.titleRight).toBeLessThanOrEqual(geometry.noteRight+1);
    expect(geometry.titleHeight).toBeGreaterThan(geometry.lineHeight*1.6);
  }
  const details=note.locator('.j481-memo-details');
  await details.locator('summary').click();
  await expect(details).toHaveAttribute('open','');
  await expect(details.locator('.j459-preview-memo')).toContainText(memo);
  await note.locator('[data-j460-preview-step="1"]').click();
  await expect(note.locator('h3')).toHaveText(titles[1]);
  await expect(note.locator('[data-j460-preview-step="1"]')).toBeFocused();
  await expect(note.locator('.j460-preview-paging [role="status"]')).toContainText('2 / 3件');
  await note.locator('[data-j460-preview-step="1"]').click();
  await expect(note.locator('h3')).toHaveText(titles[2]);
  await expect(note).toBeFocused();
  await note.locator('[data-j460-preview-step="-1"]').click();
  await expect(note.locator('h3')).toHaveText(titles[1]);
  await expect(note.locator('[data-j460-preview-step="-1"]')).toBeFocused();
  await note.locator('[data-j460-preview-step="-1"]').click();
  await expect(note.locator('h3')).toHaveText(title);
  await expect(note.locator('.j481-memo-details')).toHaveAttribute('open','');
  const positions=await note.evaluate(element=>({
    pager:element.querySelector('.j460-preview-paging')?.getBoundingClientRect().top,
    title:element.querySelector('h3')?.getBoundingClientRect().top
  }));
  expect(positions.pager).toBeLessThan(positions.title);
  await note.locator('[data-j488-memo-collapse]').click();
  await expect(note.locator('.j481-memo-details')).not.toHaveAttribute('open','');
  await expect(note.locator('.j481-memo-details>summary')).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth))
    .toBeLessThanOrEqual(2);
});

test('JOURNAL V491 phone ToDo detail appears beside its row and returns without scrolling a long list',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="todos"]').click();
  for(const name of ['J491先頭の記入','J491次の記入']){
    await page.locator('#todayTodoInput').fill(name);
    await page.locator('[data-j425-todo-create] button[type="submit"]').click();
    await expect(page.locator('#todoView .j425-todo-record').filter({hasText:name})).toBeVisible();
  }
  const note=page.locator('#j450TodoNote');
  await expect(note).toBeHidden();
  const row=page.locator('#todoView .j425-todo-record').filter({hasText:'J491先頭の記入'});
  await row.locator('[data-j425-todo-select]').click();
  await expect(note).toBeVisible();
  await expect(note).toHaveClass(/j491-inline-detail/);
  expect(await row.evaluate(el=>el.nextElementSibling?.id==='j450TodoNote')).toBeTruthy();
  await page.setViewportSize({width:320,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  await note.locator('[data-j450-todo-back]').click();
  await expect(note).toBeHidden();
  await expect(row.locator('[data-j425-todo-select]')).toBeFocused();
  await page.setViewportSize({width:1366,height:900});
  await expect(note).toBeVisible();
  expect(await note.evaluate(el=>el.parentElement?.classList.contains('j425-todo-layout'))).toBeTruthy();
});

test('JOURNAL V491 selected task note moves inline on phones and memo footer returns to the card',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  await page.locator('#boardView [data-j420-layout="list"]').click();
  await page.locator('#listView [data-j425-new-task]').click();
  const dialog=page.locator('#taskDialog');
  await dialog.locator('#taskTitle').fill('JOURNALスマホタスク閲覧テスト');
  await dialog.locator('#taskForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  const row=page.locator('#listView .j425-index-record').filter({hasText:'JOURNALスマホタスク閲覧テスト'});
  await expect(row).toBeVisible();
  const note=page.locator('#listView .j425-task-preview');
  await expect(note).toBeHidden();
  await row.click();
  await expect(note).toHaveClass(/j491-inline-detail/);
  await expect(note).toBeVisible();
  expect(await row.evaluate(el=>el.nextElementSibling?.classList.contains('j425-task-preview'))).toBeTruthy();
  await expect(note.locator('.j425-index-preview h3')).toBeFocused();
  await page.setViewportSize({width:1366,height:900});
  expect(await note.evaluate(el=>el.parentElement?.classList.contains('j425-task-index-layout'))).toBeTruthy();
  await page.setViewportSize({width:390,height:840});
  await note.locator('[data-j491-task-return]').first().click();
  await expect(note).toBeHidden();
  await expect(row).toBeFocused();

  await page.locator('#wbJournalDockV367 [data-journal-route="memo"]').click();
  await page.locator('#workMemoViewV167 [data-memo-new]').first().click();
  await page.locator('#workMemoTitleV167').fill('JOURNALスマホメモ閲覧テスト');
  await page.locator('#workMemoBodyV167').fill('引き継ぎ記録の内容。'.repeat(120));
  await page.locator('#workMemoFormV167 button[type="submit"]').click();
  const card=page.locator('#workMemoViewV167 .work-memo-card-v167')
    .filter({hasText:'JOURNALスマホメモ閲覧テスト'});
  await expect(card).toBeVisible();
  await card.click({position:{x:24,y:40}});
  const reader=page.locator('#workMemoViewV167 .j425-memo-reader');
  await expect(reader).toBeFocused();
  await expect(reader.locator('.j491-memo-footer-back')).toBeVisible();
  await reader.locator('.j491-memo-footer-back').click();
  await expect(card).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});

test('JOURNAL V494 desk keeps one selected task note beside its mobile card',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView');
  await board.locator('[data-j420-new-task]').click();
  const dialog=page.locator('#taskDialog');
  await dialog.locator('#taskTitle').fill('JOURNAL V494 案件ノート往復');
  await dialog.locator('#taskForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  await dismissSavedTaskDetailForTest(page);
  const row=board.locator('[data-j420-task-id]').filter({hasText:'JOURNAL V494 案件ノート往復'});
  await expect(row).toBeVisible();
  const note=board.locator('#j494AtelierNote');
  await expect(note).toBeHidden();
  await row.click();
  await expect(note).toBeVisible();
  await expect(note).toHaveClass(/j494-inline-note/);
  expect(await row.evaluate(el=>el.nextElementSibling?.id==='j494AtelierNote')).toBeTruthy();
  await expect(row).toHaveAttribute('aria-expanded','true');
  await expect(note.locator('.j420-note-lead h4')).toBeFocused();
  await page.setViewportSize({width:320,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth))
    .toBeLessThanOrEqual(2);
  await note.locator('[data-j494-atelier-back]').click();
  await expect(note).toBeHidden();
  await expect(row).toBeFocused();
  await expect(row).toHaveAttribute('aria-expanded','false');
  await page.setViewportSize({width:1366,height:900});
  await expect(note).toBeVisible();
  // Await asynchronous matchMedia change and DOM re-parenting.
  await expect.poll(()=>note.evaluate(el=>el.parentElement?.classList.contains('j420-atelier'))).toBe(true);
});

test('JOURNAL V494 phone chronicle exposes date actions and restores focus from detail',async({page})=>{
  test.setTimeout(90000);
  await boot(page,320);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  // The activity log also offers a timeline shortcut; target the view switch.
  await page.locator('#boardView .j420-atelier-switch [data-j420-layout="timeline"]').click();
  const day=page.locator('#timelineView [data-jv-add-date]').first();
  await expect(day).toBeVisible();
  const targetDate=await day.getAttribute('data-jv-add-date');
  await day.click();
  const dialog=page.locator('#taskDialog');
  await expect(dialog.locator('#taskDueDate')).toHaveValue(targetDate);
  await dialog.locator('#taskTitle').fill('JOURNAL V494 日付日誌で確認');
  await dialog.locator('#taskForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  const row=page.locator('#timelineView .jv-day-item').filter({hasText:'JOURNAL V494 日付日誌で確認'});
  await expect(row).toBeVisible();
  const detail=row.locator('[data-j494-open-task]');
  const move=row.locator('[data-move-to-timeline]');
  await expect(detail).toBeVisible();
  await expect(move).toBeVisible();
  expect(await row.evaluate(el=>el.querySelector('.j494-day-actions')?.contains(el.querySelector('[data-j494-open-task]')))).toBeTruthy();
  await detail.click();
  await expect(page.locator('.app-shell')).toHaveClass(/detail-open/);
  await expect(page.locator('#detailBody .detail-title')).toBeFocused();
  await page.locator('#closeDetail').click();
  await expect(page.locator('.app-shell')).not.toHaveClass(/detail-open/);
  await expect(detail).toBeFocused();
  await detail.click();
  await expect(page.locator('.app-shell')).toHaveClass(/detail-open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.app-shell')).not.toHaveClass(/detail-open/);
  await expect(detail).toBeFocused();
  const nav=page.locator('#timelineView .jv-time-controls>button');
  await expect(nav).toHaveCount(3);
  const controls=await nav.evaluateAll(buttons=>buttons.map(b=>b.getBoundingClientRect().width));
  expect(controls.every(width=>width>50)).toBeTruthy();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth))
    .toBeLessThanOrEqual(2);
});

test('JOURNAL V495 mobile task folio keeps primary actions short and returns from long content',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  // The activity log also offers a timeline shortcut; target the view switch.
  await page.locator('#boardView .j420-atelier-switch [data-j420-layout="timeline"]').click();
  const newDay=page.locator('#timelineView [data-jv-add-date]').first();
  await expect(newDay).toBeVisible();
  await newDay.click();
  const editor=page.locator('#taskDialog');
  await editor.locator('#taskTitle').fill('JOURNAL V495 長い件名で詳細を読みやすく確認するタスク');
  await editor.locator('#taskDescription').fill('申し送り内容と状況の詳細です。\\n'+
    '確認事項を長文で記録します。'.repeat(50)+'\\n'+ 'A'.repeat(120));
  await editor.locator('#taskForm button[type="submit"]').click();
  await expect(editor).toBeHidden();
  const row=page.locator('#timelineView .jv-day-item').filter({hasText:'JOURNAL V495 長い件名'});
  await expect(row).toBeVisible();
  const launch=row.locator('[data-j494-open-task]');
  await launch.click();
  const folio=page.locator('.detail-panel');
  await expect(folio).toBeVisible();
  const taskTitle='JOURNAL V495 長い件名で詳細を読みやすく確認するタスク';
  await expect(folio.locator('.detail-head strong')).toHaveText(taskTitle);
  const actions=folio.locator('.detail-actions');
  const extra=folio.locator('.j495-detail-more');
  await expect(actions.locator('.main-actions [data-action="edit"]')).toBeVisible();
  await expect(extra.locator('summary')).toBeVisible();
  await expect(extra).not.toHaveAttribute('open','');
  await expect(extra.locator('[data-action="delete"]')).toBeHidden();
  await extra.locator('summary').click();
  await expect(extra).toHaveAttribute('open','');
  await expect(extra.locator('[data-action="delete"]')).toBeVisible();
  await expect(folio.locator('.description').first()).toHaveCSS('white-space','pre-wrap');
  const footer=folio.locator('.j495-detail-footer');
  await expect(footer.locator('.j495-detail-footer-top')).toBeVisible();
  await folio.evaluate(element=>element.scrollTop=element.scrollHeight);
  await footer.locator('.j495-detail-footer-top').click();
  await expect(folio.locator('.detail-title')).toBeFocused();
  expect(await folio.evaluate(element=>element.scrollTop)).toBeLessThan(10);
  await page.setViewportSize({width:320,height:800});
  const fit=await folio.evaluate(element=>({
    outer:document.documentElement.scrollWidth-window.innerWidth,
    inner:element.scrollWidth-element.clientWidth
  }));
  expect(fit.outer).toBeLessThanOrEqual(2);
  expect(fit.inner).toBeLessThanOrEqual(2);
  await page.setViewportSize({width:1366,height:900});
  await expect(folio.locator('.detail-head strong')).toHaveText('タスク詳細');
  await expect(folio.locator('.j495-detail-more')).toHaveCount(0);
  await expect(folio.locator('.j495-detail-footer')).toHaveCount(0);
  await expect(actions.locator('.sub-actions [data-action="delete"]')).toBeVisible();
  await page.setViewportSize({width:390,height:900});
  await expect(folio.locator('.j495-detail-more')).toBeVisible();
  await folio.locator('.j495-detail-footer-edit').click();
  await expect(editor).toBeVisible();
  await editor.locator('#closeTaskDialog').click();
  await expect(editor).toBeHidden();
  await folio.evaluate(element=>element.scrollTop=element.scrollHeight);
  await folio.locator('#closeDetail').click();
  await expect(page.locator('.app-shell')).not.toHaveClass(/detail-open/);
  await expect(launch).toBeFocused();
  // A second record opening must not inherit the previous long record's scroll.
  await launch.click();
  await expect(folio.locator('.detail-head strong')).toHaveText(taskTitle);
  expect(await folio.evaluate(element=>element.scrollTop)).toBeLessThan(10);
  await folio.locator('#closeDetail').click();
  await expect(launch).toBeFocused();
});

test('JOURNAL V500 recent log opens the correct filtered-out task on phone and desktop',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView');
  await board.locator('[data-j420-new-task]').click();
  const editor=page.locator('#taskDialog');
  const title='JOURNAL V500 最近の記録から開く案件';
  await editor.locator('#taskTitle').fill(title);
  await editor.locator('#taskDescription').fill('引継ぎ番号:'+('Z'.repeat(140)));
  await editor.locator('#taskForm button[type="submit"]').click();
  await expect(editor).toBeHidden();
  // V502: filters are intentionally folded on phones until the bookmark opens.
  await board.locator('[data-j502-toggle-index]').click();
  await board.locator('[data-j420-view="waiting"]').click();
  await expect(board.locator('[data-j420-task-id]').filter({hasText:title})).toHaveCount(0);
  const log=board.locator('[data-j420-log-task]').filter({hasText:title});
  await expect(log).toBeVisible();
  await log.click();
  await expect(board.locator('[data-j420-view="all"]')).toHaveAttribute('aria-pressed','true');
  const row=board.locator('[data-j420-task-id]').filter({hasText:title});
  const note=board.locator('#j494AtelierNote');
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute('aria-expanded','true');
  await expect(note).toBeVisible();
  await expect(note.locator('.j420-note-lead h4')).toHaveText(title);
  await expect(note.locator('.j420-note-lead h4')).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth))
    .toBeLessThanOrEqual(2);
  await page.setViewportSize({width:320,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth))
    .toBeLessThanOrEqual(2);
  await page.setViewportSize({width:1366,height:900});
  await expect.poll(()=>note.evaluate(el=>el.parentElement?.classList.contains('j420-atelier'))).toBe(true);
  await board.locator('[data-j420-view="waiting"]').click();
  await expect(board.locator('[data-j420-task-id]').filter({hasText:title})).toHaveCount(0);
  await board.locator('[data-j420-log-task]').filter({hasText:title}).click();
  await expect(board.locator('[data-j420-view="all"]')).toHaveAttribute('aria-pressed','true');
  await expect(note.locator('.j420-note-lead h4')).toHaveText(title);
  await expect(note.locator('.j420-note-lead h4')).toBeFocused();
});

test('JOURNAL V502 phone index folds without losing filters and the selected note stays usable',async({page})=>{
  test.setTimeout(90000);
  await boot(page,320);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView');
  const toggle=board.locator('[data-j502-toggle-index]');
  const index=board.locator('.j420-atelier-index');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(index.locator('[data-j420-view="waiting"]')).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await index.locator('[data-j420-view="waiting"]').click();
  await expect(board.locator('[data-j420-view="waiting"]')).toHaveAttribute('aria-pressed','true');
  await expect(board.locator('[data-j502-toggle-index]')).toHaveAttribute('aria-expanded','true');
  await board.locator('[data-j502-toggle-index]').click();
  await expect(board.locator('[data-j420-view="waiting"]')).toBeHidden();
  const create=board.locator('[data-j420-new-task]');
  await expect(create).toBeVisible();
  await create.click();
  const dialog=page.locator('#taskDialog');
  await dialog.locator('#taskTitle').fill('JOURNAL V502 机上の狭幅確認');
  await dialog.locator('#taskDescription').fill('LONG'+('X'.repeat(180)));
  await dialog.locator('#taskForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  await board.locator('[data-j502-toggle-index]').click();
  await board.locator('[data-j420-view="all"]').click();
  const row=board.locator('[data-j420-task-id]').filter({hasText:'JOURNAL V502 机上の狭幅確認'});
  await row.click();
  const note=board.locator('#j494AtelierNote');
  await expect(note).toBeVisible();
  await expect(note.locator('[data-j420-note-edit]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  await page.setViewportSize({width:390,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  await note.locator('[data-j494-atelier-back]').click();
  await expect(row).toBeFocused();
  await page.setViewportSize({width:1366,height:900});
  await expect(index.locator('[data-j420-view="all"]')).toBeVisible();
  await expect(toggle).toBeHidden();
});

test('JOURNAL V504 phone chronicle adds to populated dates, wraps titles and restores paging focus',async({page})=>{
  test.setTimeout(90000);
  await boot(page,320);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  await page.locator('#boardView .j420-atelier-switch [data-j420-layout="timeline"]').click();
  const timeline=page.locator('#timelineView');
  const emptyAdd=timeline.locator('.jv-day-records [data-jv-add-date]').first();
  await expect(emptyAdd).toBeVisible();
  const date=await emptyAdd.getAttribute('data-jv-add-date');
  await emptyAdd.click();
  const editor=page.locator('#taskDialog');
  await expect(editor.locator('#taskDueDate')).toHaveValue(date);
  const title='JOURNAL V504 日付日誌で長い案件名を表示するテスト '+'長文'.repeat(14)+'X'.repeat(20);
  await editor.locator('#taskTitle').fill(title);
  await editor.locator('#taskForm button[type="submit"]').click();
  await expect(editor).toBeHidden();
  const shelf=timeline.locator('[data-jv-date="'+date+'"]');
  const day=shelf.locator('xpath=..');
  const row=day.locator('.jv-day-item').filter({hasText:'JOURNAL V504 日付日誌で長い案件名'});
  await expect(row).toBeVisible();
  const quickAdd=day.locator('.jv-date .j504-day-add');
  await expect(quickAdd).toBeVisible();
  await expect(quickAdd).toHaveAttribute('data-jv-add-date',date);
  const dimensions=await row.evaluate(el=>({
    documentOverflow:document.documentElement.scrollWidth-innerWidth,
    recordOverflow:el.scrollWidth-el.clientWidth,
    title:getComputedStyle(el.querySelector('strong')).whiteSpace,
    actions:[...el.querySelectorAll('.j494-day-actions button')]
      .map(button=>button.getBoundingClientRect().height)
  }));
  expect(dimensions.documentOverflow).toBeLessThanOrEqual(2);
  expect(dimensions.recordOverflow).toBeLessThanOrEqual(2);
  expect(dimensions.title).toBe('normal');
  expect(dimensions.actions.every(height=>height>=43)).toBeTruthy();
  await quickAdd.click();
  await expect(editor).toBeVisible();
  await expect(editor.locator('#taskDueDate')).toHaveValue(date);
  await editor.locator('#closeTaskDialog').click();
  await expect(editor).toBeHidden();
  await row.locator('[data-j494-open-task]').click();
  await expect(page.locator('#detailBody .detail-title')).toHaveText(title);
  await page.locator('#closeDetail').click();
  await expect(row.locator('[data-j494-open-task]')).toBeFocused();
  await page.setViewportSize({width:390,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  await timeline.locator('[data-timeline-next]').click();
  await expect(timeline.locator('[data-timeline-next]')).toBeFocused();
  await timeline.locator('[data-timeline-prev]').click();
  await expect(timeline.locator('[data-timeline-prev]')).toBeFocused();
  await timeline.locator('[data-timeline-range]').selectOption('month');
  await expect(timeline.locator('[data-timeline-range]')).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});

test('JOURNAL V505 jumps to a day and returns to the same record after editing',async({page})=>{
  test.setTimeout(90000);
  await boot(page,320);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  await page.locator('#boardView .j420-atelier-switch [data-j420-layout="timeline"]').click();
  const timeline=page.locator('#timelineView');
  const jump=timeline.locator('[data-j505-date-jump]');
  await expect(jump).toBeVisible();
  const options=await jump.locator('option').evaluateAll(items=>items.map(o=>o.value));
  expect(options.length).toBe(15);
  const targetDate=options[9];
  await jump.selectOption(targetDate);
  const records=timeline.locator('.jv-day-records[data-jv-date="'+targetDate+'"]');
  const day=records.locator('xpath=..');
  const heading=day.locator('.jv-date');
  await expect(heading).toBeFocused();
  const title='JOURNAL V505 編集後も元の位置に戻れるタスク';
  await records.locator('[data-jv-add-date]').click();
  const editor=page.locator('#taskDialog');
  await expect(editor.locator('#taskDueDate')).toHaveValue(targetDate);
  await editor.locator('#taskTitle').fill(title);
  await editor.locator('#taskForm button[type="submit"]').click();
  await expect(editor).toBeHidden();
  const item=records.locator('.jv-day-item').filter({hasText:title});
  await expect(item).toBeVisible();
  const id=await item.getAttribute('data-task-id');
  const row=timeline.locator('.jv-day-item[data-task-id="'+id+'"]');
  await row.scrollIntoViewIfNeeded();
  await row.locator('[data-j494-open-task]').click();
  await expect(page.locator('#detailBody .detail-title')).toHaveText(title);
  await page.locator('#detailBody [data-action="edit"]').click();
  await expect(editor).toBeVisible();
  const changed=title+'（更新）';
  await editor.locator('#taskTitle').fill(changed);
  await editor.locator('#taskForm button[type="submit"]').click();
  await expect(editor).toBeHidden();
  await expect(page.locator('#detailBody .detail-title')).toHaveText(changed);
  await page.locator('#closeDetail').click();
  await expect(row.locator('[data-j494-open-task]')).toBeFocused();
  await expect(row.locator('strong')).toHaveText(changed);
  const top=await row.evaluate(element=>element.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(-5);
  expect(top).toBeLessThan(900);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(2);
  // A direct double click must also remember the source before opening the
  // canonical editor; cancel does not create or change any task.
  await row.dblclick({position:{x:11,y:11}});
  await expect(editor).toBeVisible();
  await editor.locator('#closeTaskDialog').click();
  await expect(editor).toBeHidden();
  await page.locator('#closeDetail').click();
  await expect(row.locator('[data-j494-open-task]')).toBeFocused();
  await page.setViewportSize({width:390,height:900});
  await timeline.locator('[data-timeline-range]').selectOption('month');
  await expect(timeline.locator('[data-j505-date-jump] option').first()).toHaveValue('');
  const monthOptions=await timeline.locator('[data-j505-date-jump] option').count();
  expect(monthOptions).toBeGreaterThan(28);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(2);
});

test('JOURNAL V507 phone chronicle restores cancelled moves and navigates to the saved date',async({page})=>{
  test.setTimeout(90000);
  await boot(page,320);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  await page.locator('#boardView .j420-atelier-switch [data-j420-layout="timeline"]').click();
  const timeline=page.locator('#timelineView');
  await timeline.locator('[data-timeline-range]').selectOption('14');
  const firstDateAction=timeline.locator('.jv-day-records [data-jv-add-date]').first();
  await expect(firstDateAction).toBeVisible();
  const originalDate=await firstDateAction.getAttribute('data-jv-add-date');
  await firstDateAction.click();
  const editor=page.locator('#taskDialog');
  const title='JOURNAL V507 日付変更の復帰確認';
  await editor.locator('#taskTitle').fill(title);
  await editor.locator('#taskForm button[type="submit"]').click();
  await expect(editor).toBeHidden();
  await dismissSavedTaskDetailForTest(page);
  const row=timeline.locator('.jv-day-item').filter({hasText:title});
  await expect(row).toBeVisible();
  const move=row.locator('[data-move-to-timeline]');
  await move.click();
  const dialog=page.locator('#timelineMoveDialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#cancelTimelineMove').click();
  await expect(dialog).toBeHidden();
  await expect(move).toBeFocused();
  await move.click();
  const destination=await page.evaluate(date=>{
    const day=new Date(date+'T00:00:00');
    day.setDate(day.getDate()+35);
    return [day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-');
  },originalDate);
  await dialog.locator('#timelineMoveDueDate').fill(destination);
  await dialog.locator('#confirmTimelineMove').click();
  await expect(dialog).toBeHidden();
  const moved=timeline.locator('.jv-day-records[data-jv-date="'+destination+'"]');
  await expect(moved).toBeVisible();
  await expect(moved.locator('.jv-day-item').filter({hasText:title})).toBeVisible();
  await expect(moved.locator('[data-j494-open-task]')).toBeFocused();
  const result=timeline.locator('.j507-move-result');
  await expect(result).toBeVisible();
  await expect(result).toContainText(destination);
  await result.getByRole('button',{name:'元の日誌へ戻る'}).click();
  await expect(timeline.locator('.jv-day-records[data-jv-date="'+originalDate+'"]')).toBeVisible();
  await expect(timeline.locator('.jv-day-records[data-jv-date="'+originalDate+'"]').locator('xpath=..').locator('.jv-date')).toBeFocused();
  // V513: the sticky shortcut supersedes duplicated per-week navigation.
  await expect(timeline.locator('[data-j507-up]')).toHaveCount(0);
  const stickyPicker=timeline.locator('.j511-chronicle-travel [data-j511-date-picker]');
  await expect(stickyPicker).toBeVisible();
  await stickyPicker.click();
  await expect(timeline.locator('[data-j505-date-jump]')).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(2);
  await page.setViewportSize({width:390,height:900});
  await expect(stickyPicker).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(2);
});

test('JOURNAL V509 mobile task pages reopen at the previous reading offset',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView');
  const index=page.locator('#listView');
  const diary=page.locator('#timelineView');
  await board.locator('.j420-atelier-switch [data-j420-layout="timeline"]').click();
  await expect(diary.locator('.j509-chronicle-switch')).toBeVisible();
  await diary.locator('[data-j509-layout="list"]').click();
  await expect(index.locator('.j425-task-index')).toBeVisible();
  await index.locator('[data-j425-task-layout="board"]').click();
  await expect(board.locator('.j420-atelier')).toBeVisible();
  await board.locator('.j420-atelier-switch [data-j420-layout="timeline"]').click();
  await expect(diary.locator('.jv-chronicle-day').first()).toBeVisible();
  // Keep the diary in the middle of a long page. A programmatic click
  // avoids Playwright's automatic scroll-to-top on the offscreen toolbar.
  const saved=await diary.evaluate(el=>{
    const absolute=window.scrollY+el.getBoundingClientRect().top;
    window.scrollTo({top:absolute+145,behavior:'auto'});
    return Math.max(0,-el.getBoundingClientRect().top);
  });
  expect(saved).toBeGreaterThan(40);
  await diary.locator('[data-j509-layout="board"]').evaluate(el=>el.click());
  await expect(board.locator('.j420-atelier')).toBeVisible();
  await board.locator('.j420-atelier-switch [data-j420-layout="timeline"]').evaluate(el=>el.click());
  await expect(diary.locator('.j509-chronicle-switch')).toBeVisible();
  await expect.poll(()=>diary.evaluate(el=>Math.max(0,-el.getBoundingClientRect().top)))
    .toBeGreaterThanOrEqual(saved-15);
  await page.setViewportSize({width:320,height:900});
  const measures=await diary.locator('.j509-chronicle-switch').evaluate(nav=>({
    width:nav.getBoundingClientRect().width,
    buttons:[...nav.querySelectorAll('button')].map(b=>b.getBoundingClientRect().height),
    overflow:document.documentElement.scrollWidth-innerWidth
  }));
  expect(measures.width).toBeLessThanOrEqual(320);
  expect(measures.buttons.every(height=>height>=43)).toBeTruthy();
  expect(measures.overflow).toBeLessThanOrEqual(2);
});

test('JOURNAL V511 phone diary navigation and lower note-return stay reachable',async({page})=>{
  test.setTimeout(90000);
  await boot(page,320);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView');
  await board.locator('[data-j420-new-task]').click();
  const editor=page.locator('#taskDialog');
  const title='JOURNAL V511 ノート末尾から一覧へ戻る';
  await editor.locator('#taskTitle').fill(title);
  await editor.locator('#taskDescription').fill('一覧から開いた長文ノートの下でも戻る。'.repeat(14));
  await editor.locator('#taskForm button[type="submit"]').click();
  await expect(editor).toBeHidden();
  await dismissSavedTaskDetailForTest(page);
  await board.locator('[data-j420-layout="list"]').click();
  const list=page.locator('#listView');
  const row=list.locator('[data-j425-row]').filter({hasText:title});
  await expect(row).toBeVisible();
  await row.scrollIntoViewIfNeeded();
  const sourceTop=await row.evaluate(el=>el.getBoundingClientRect().top);
  await row.click();
  const preview=list.locator('.j425-task-preview.j491-inline-detail');
  await expect(preview).toBeVisible();
  await expect(preview.locator('[data-j491-task-return]')).toHaveCount(2);
  await preview.locator('.j511-task-return-end').click();
  await expect(preview).toBeHidden();
  await expect(row).toBeFocused();
  const returnTop=await row.evaluate(el=>el.getBoundingClientRect().top);
  expect(Math.abs(returnTop-sourceTop)).toBeLessThanOrEqual(35);
  await list.locator('[data-j425-task-layout="timeline"]').click();
  const diary=page.locator('#timelineView');
  const nav=diary.locator('.j511-chronicle-travel');
  await expect(nav).toBeVisible();
  const datePicker=nav.locator('[data-j511-date-picker]');
  await expect(datePicker).toBeVisible();
  await diary.locator('.jv-chronicle-day').nth(9).scrollIntoViewIfNeeded();
  const geometry=await nav.evaluate(element=>({
    navTop:element.getBoundingClientRect().top,
    navWidth:element.getBoundingClientRect().width,
    viewport:innerWidth,
    overflow:document.documentElement.scrollWidth-innerWidth,
    datePickerHeight:element.querySelector('[data-j511-date-picker]').getBoundingClientRect().height
  }));
  expect(geometry.navTop).toBeGreaterThanOrEqual(-2);
  expect(geometry.navTop).toBeLessThan(100);
  expect(geometry.navWidth).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.overflow).toBeLessThanOrEqual(2);
  expect(geometry.datePickerHeight).toBeGreaterThanOrEqual(44);
  await datePicker.click();
  await expect(diary.locator('[data-j505-date-jump]')).toBeFocused();
  await page.setViewportSize({width:390,height:900});
  await expect(nav.locator('[data-j509-layout="board"]')).toBeVisible();
  await nav.locator('[data-j509-layout="board"]').click();
  await expect(board.locator('.j420-atelier')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});

test('JOURNAL V515 phone index keeps sorting and filter focus after list redraws',async({page})=>{
  test.setTimeout(90000);
  await boot(page,320);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  await page.locator('#boardView [data-j420-layout="list"]').click();
  const list=page.locator('#listView');
  const sort=list.locator('[data-j425-sort]');
  await expect(sort).toBeVisible();
  await sort.scrollIntoViewIfNeeded();
  const before=await sort.evaluate(el=>el.getBoundingClientRect().top);
  await sort.selectOption('updated');
  await expect(sort).toBeFocused();
  const after=await sort.evaluate(el=>el.getBoundingClientRect().top);
  expect(Math.abs(after-before)).toBeLessThanOrEqual(14);
  const query=list.locator('[data-j425-query]');
  await query.fill('JOURNAL V515');
  await expect(query).toBeFocused();
  await expect(query).toHaveValue('JOURNAL V515');
  await query.fill('');
  await expect(query).toBeFocused();
  await list.locator('[data-j447-toggle-filters]').click();
  const facet=list.locator('[data-j430-facet="status"]').first();
  await expect(facet).toBeVisible();
  await facet.click();
  await expect(facet).toBeFocused();
  const due=list.locator('[data-j425-due="none"]');
  await due.click();
  await expect(due).toBeFocused();
  const reset=list.locator('[data-j425-reset]');
  await reset.click();
  await expect(reset).toBeFocused();
  const geometry=await list.locator('.j425-workbench-toolbar').evaluate(el=>({
    width:el.getBoundingClientRect().width,
    viewport:innerWidth,
    overflow:document.documentElement.scrollWidth-innerWidth,
    searchWidth:el.querySelector('[data-j425-query]').getBoundingClientRect().width,
    sortHeight:el.querySelector('[data-j425-sort]').getBoundingClientRect().height
  }));
  expect(geometry.width).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.overflow).toBeLessThanOrEqual(2);
  expect(geometry.searchWidth).toBeGreaterThan(200);
  expect(geometry.sortHeight).toBeGreaterThanOrEqual(43);
  await page.setViewportSize({width:390,height:900});
  await expect(list.locator('[data-j425-sort]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});

test('JOURNAL V516 phone desk returns to its source card and filter keeps focus',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView');
  const view=board.locator('[data-j420-view="all"]');
  await board.locator('[data-j502-toggle-index]').click();
  await view.click();
  await expect(view).toBeFocused();
  await board.locator('[data-j502-toggle-index]').click();
  await board.locator('[data-j420-new-task]').click();
  const dialog=page.locator('#taskDialog');
  await dialog.locator('#taskTitle').fill('JOURNAL V516 机上の復帰位置');
  await dialog.locator('#taskForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  const card=board.locator('[data-j420-task-id]').filter({hasText:'JOURNAL V516 机上の復帰位置'});
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  const top=await card.evaluate(el=>el.getBoundingClientRect().top);
  await card.click();
  const note=board.locator('#j494AtelierNote');
  await expect(note).toHaveClass(/j494-inline-note/);
  await note.locator('[data-j494-atelier-back]').click();
  await expect(card).toBeFocused();
  expect(Math.abs((await card.evaluate(el=>el.getBoundingClientRect().top))-top)).toBeLessThanOrEqual(35);
  const deskHeight=await board.locator('.j420-atelier-desk').evaluate(el=>({
    minHeight:getComputedStyle(el).minHeight,
    width:el.getBoundingClientRect().width,
    overflow:document.documentElement.scrollWidth-innerWidth
  }));
  expect(deskHeight.minHeight).toBe('0px');
  expect(deskHeight.width).toBeLessThanOrEqual(390);
  expect(deskHeight.overflow).toBeLessThanOrEqual(2);
  await page.setViewportSize({width:320,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});


test('JOURNAL V518 phone diary compacts empty dates and empty task results recover inline',async({page})=>{
  test.setTimeout(90000);
  await boot(page,320);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView');
  await board.locator('.j420-atelier-switch [data-j420-layout="timeline"]').click();
  const diary=page.locator('#timelineView');
  const emptyDate=diary.locator('.jv-chronicle-day.is-empty').first();
  await expect(emptyDate).toBeVisible();
  const mobile=await emptyDate.evaluate(el=>{
    const button=el.querySelector('[data-jv-add-date]');
    return {
      height:el.getBoundingClientRect().height,
      buttonHeight:button.getBoundingClientRect().height,
      overflow:document.documentElement.scrollWidth-innerWidth
    };
  });
  expect(mobile.height).toBeLessThanOrEqual(62);
  expect(mobile.buttonHeight).toBeGreaterThanOrEqual(44);
  expect(mobile.overflow).toBeLessThanOrEqual(2);
  await emptyDate.locator('[data-jv-add-date]').click();
  await expect(page.locator('#taskDialog')).toBeVisible();
  await page.locator('#closeTaskDialog').click();
  await diary.locator('[data-j509-layout="list"]').click();
  const list=page.locator('#listView');
  await list.locator('[data-j425-new-task]').click();
  const dialog=page.locator('#taskDialog');
  const title='JOURNAL V518 空検索から復帰';
  await dialog.locator('#taskTitle').fill(title);
  await dialog.locator('#taskForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  const query=list.locator('[data-j425-query]');
  await query.fill('J518_NOT_FOUND_NEVER_MATCH');
  const notice=list.locator('.j518-index-empty');
  await expect(notice).toBeVisible();
  await expect(notice.locator('[data-j518-empty-reset]')).toBeVisible();
  await notice.locator('[data-j518-empty-reset]').click();
  await expect(query).toHaveValue('');
  await expect(query).toBeFocused();
  await expect(list.locator('[data-j425-row]').filter({hasText:title})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  await page.setViewportSize({width:390,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});


test('JOURNAL V519 mobile task detail closes onto originating desk and index controls',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView');
  await board.locator('[data-j420-new-task]').click();
  const dialog=page.locator('#taskDialog');
  const title='JOURNAL V519 詳細画面から戻る';
  await dialog.locator('#taskTitle').fill(title);
  await dialog.locator('#taskForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();

  const card=board.locator('[data-j420-task-id]').filter({hasText:title});
  await card.click();
  const deskAction=board.locator('#j494AtelierNote [data-j420-note-detail]');
  await expect(deskAction).toBeVisible();
  await deskAction.scrollIntoViewIfNeeded();
  const deskTop=await deskAction.evaluate(el=>el.getBoundingClientRect().top);
  await deskAction.click();
  await expect(page.locator('.detail-panel')).toHaveClass(/open/);
  await page.locator('#closeDetail').click();
  await expect(page.locator('.detail-panel')).not.toHaveClass(/open/);
  await expect(deskAction).toBeFocused();
  expect(Math.abs((await deskAction.evaluate(el=>el.getBoundingClientRect().top))-deskTop)).toBeLessThanOrEqual(35);

  await board.locator('[data-j420-layout="list"]').click();
  const list=page.locator('#listView');
  const row=list.locator('[data-j425-row]').filter({hasText:title});
  await row.click();
  const listAction=list.locator('.j425-task-preview [data-j425-preview-detail]');
  await expect(listAction).toBeVisible();
  await listAction.scrollIntoViewIfNeeded();
  const listTop=await listAction.evaluate(el=>el.getBoundingClientRect().top);
  await listAction.click();
  await expect(page.locator('.detail-panel')).toHaveClass(/open/);
  await page.locator('#closeDetail').click();
  await expect(page.locator('.detail-panel')).not.toHaveClass(/open/);
  await expect(listAction).toBeFocused();
  expect(Math.abs((await listAction.evaluate(el=>el.getBoundingClientRect().top))-listTop)).toBeLessThanOrEqual(35);

  await page.setViewportSize({width:320,height:800});
  await listAction.click();
  await expect(page.locator('.detail-panel')).toHaveClass(/open/);
  await page.locator('#closeDetail').click();
  await expect(listAction).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});


test('JOURNAL V520 mobile desk hides unused shelves and recovers from zero results',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView');
  await board.locator('[data-j420-new-task]').click();
  const dialog=page.locator('#taskDialog');
  const title='JOURNAL V520 空棚と絞り込み復帰';
  await dialog.locator('#taskTitle').fill(title);
  await dialog.locator('#taskForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  await dismissSavedTaskDetailForTest(page);
  await expect(board.locator('[data-j420-task-id]').filter({hasText:title})).toBeVisible();
  await expect(board.locator('.j420-island.j520-empty-island:visible')).toHaveCount(0);

  await board.locator('[data-j502-toggle-index]').click();
  await board.locator('[data-j420-view="material"]').click();
  const empty=board.locator('.j520-atelier-empty');
  await expect(empty).toBeVisible();
  await expect(board.locator('.j420-island:visible')).toHaveCount(0);
  await board.locator('[data-j502-toggle-index]').click();
  await expect(board.locator('.j520-index-filter-count')).toHaveText('1条件適用中');
  await empty.locator('[data-j520-empty-reset]').click();
  await expect(board.locator('[data-j420-search]')).toBeFocused();
  await expect(board.locator('[data-j420-task-id]').filter({hasText:title})).toBeVisible();

  const search=board.locator('[data-j420-search]');
  await search.fill('J520_NEVER_MATCH');
  await expect(board.locator('.j520-atelier-empty [data-j520-empty-reset]')).toBeVisible();
  await board.locator('[data-j520-empty-reset]').click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await expect(board.locator('[data-j420-task-id]').filter({hasText:title})).toBeVisible();

  await page.setViewportSize({width:1366,height:900});
  expect(await board.locator('.j420-island.j520-empty-island:visible').count()).toBeGreaterThan(0);
  await page.setViewportSize({width:320,height:800});
  await expect(board.locator('.j420-island.j520-empty-island:visible')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});


test('JOURNAL V522 quick-add cancel and save restore the correct day on 390px and 320px',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  await page.locator('#boardView .j420-atelier-switch [data-j420-layout="timeline"]').click();
  const empty=page.locator('#timelineView .jv-chronicle-day.is-empty [data-jv-add-date]').first();
  await expect(empty).toBeVisible();
  const date=await empty.getAttribute('data-jv-add-date');
  // Relative parent lookup avoids the nested #timelineView selector looking
  // for another timeline root inside a day (Playwright's has scoping).
  const shelf=page.locator('#timelineView [data-jv-date="'+date+'"]').locator('xpath=..');
  const dialog=page.locator('#taskDialog');
  await empty.scrollIntoViewIfNeeded();
  const top=await shelf.evaluate(el=>el.getBoundingClientRect().top);
  await empty.click();
  await expect(dialog.locator('#taskDueDate')).toHaveValue(date);
  await dialog.locator('#closeTaskDialog').click();
  await expect(dialog).toBeHidden();
  await expect(empty).toBeFocused();
  expect(Math.abs((await shelf.evaluate(el=>el.getBoundingClientRect().top))-top)).toBeLessThanOrEqual(38);

  await empty.click();
  const title='JOURNAL V522 日誌の追加後に戻る';
  await dialog.locator('#taskTitle').fill(title);
  await dialog.locator('#taskForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  const row=shelf.locator('.jv-day-item').filter({hasText:title});
  await expect(row).toBeVisible();
  await expect(row).toBeFocused();
  expect(Math.abs((await shelf.evaluate(el=>el.getBoundingClientRect().top))-top)).toBeLessThanOrEqual(38);

  await page.setViewportSize({width:320,height:800});
  const populatedAdd=shelf.locator('.j504-day-add');
  await expect(populatedAdd).toBeVisible();
  await populatedAdd.click();
  await expect(dialog.locator('#taskDueDate')).toHaveValue(date);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(populatedAdd).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});


test('JOURNAL V523 keeps the chosen date through page switches and opens sticky picker on phone',async({page})=>{
  test.setTimeout(90000);
  await boot(page,320);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  await page.locator('#boardView .j420-atelier-switch [data-j420-layout="timeline"]').click();
  const diary=page.locator('#timelineView');
  const picker=diary.locator('[data-j505-date-jump]');
  const sticky=diary.locator('[data-j511-date-picker]');
  const dayDates=await picker.locator('option').evaluateAll(options=>
    options.map(option=>option.value).filter(Boolean));
  const chosen=dayDates[8];
  await picker.selectOption(chosen);
  await expect(diary.locator('[data-jv-date="'+chosen+'"]').locator('xpath=..').locator('.jv-date')).toBeFocused();
  await expect(sticky.locator('.j523-selected-date')).toHaveText(chosen.slice(5).replace('-','/'));
  await diary.locator('[data-j509-layout="list"]').click();
  await page.locator('#listView [data-j425-task-layout="timeline"]').click();
  await expect(picker).toHaveValue(chosen);
  await expect(sticky.locator('.j523-selected-date')).toHaveText(chosen.slice(5).replace('-','/'));

  // Stub the native picker so the test can prove direct opening without
  // depending on an OS-specific popup or timing of its animation.
  await picker.evaluate(element=>{
    element.showPicker=function(){element.dataset.j523PickerOpened='yes'};
  });
  await sticky.click();
  await expect(picker).toBeFocused();
  await expect(picker).toHaveAttribute('data-j523-picker-opened','yes');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  await page.setViewportSize({width:390,height:900});
  await expect(picker).toHaveValue(chosen);
  await diary.locator('[data-timeline-next]').click();
  // The 14-day range advances with overlap. Preserve the chosen date while
  // it is still an option; clear it only after it leaves the visible range.
  const stillInRange=await picker.locator('option').evaluateAll((items,day)=>
    items.some(item=>item.value===day),chosen);
  await expect(picker).toHaveValue(stillInRange?chosen:'');
  await expect(sticky.locator('.j523-selected-date'))
    .toHaveText(stillInRange?chosen.slice(5).replace('-','/'):'');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});


test('JOURNAL V525 returns to the same diary day after earlier entries change height',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  await page.locator('#boardView .j420-atelier-switch [data-j420-layout="timeline"]').click();
  const diary=page.locator('#timelineView');
  const jump=diary.locator('[data-j505-date-jump]');
  const dates=await jump.locator('option').evaluateAll(items=>
    items.map(item=>item.value).filter(Boolean));
  const chosen=dates[9];
  await jump.selectOption(chosen);
  const day=diary.locator('.jv-day-records[data-jv-date="'+chosen+'"]').locator('xpath=..');
  await expect(day).toBeVisible();
  const sourceTop=await day.evaluate(el=>el.getBoundingClientRect().top);
  await diary.locator('[data-j509-layout="list"]').click();

  // Simulate new records growing a date earlier than the one being read.
  // The old pixel offset would land on the wrong date after this change.
  await page.addStyleTag({content:
    'html[data-wb-display="journal"] #timelineView .jv-chronicle-day:first-of-type {min-height:950px!important;}'});
  await page.locator('#listView [data-j425-task-layout="timeline"]').click();
  await expect(jump).toHaveValue(chosen);
  const restoredTop=await day.evaluate(el=>el.getBoundingClientRect().top);
  expect(Math.abs(restoredTop-sourceTop)).toBeLessThanOrEqual(38);

  await page.setViewportSize({width:320,height:800});
  await diary.locator('[data-j509-layout="list"]').click();
  await page.locator('#listView [data-j425-task-layout="timeline"]').click();
  const heading=day.locator('.jv-date');
  const geometry=await heading.evaluate(el=>({
    top:el.getBoundingClientRect().top,
    overflow:document.documentElement.scrollWidth-innerWidth
  }));
  expect(geometry.top).toBeGreaterThanOrEqual(-2);
  expect(geometry.top).toBeLessThan(220);
  expect(geometry.overflow).toBeLessThanOrEqual(2);
});


test('JOURNAL V528 remote repaint keeps diary date and focused add action on phones',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  // Instrument the JavaScript response only in this browser test; no debug
  // entry point is included in the deployed application.
  await page.route('**/app.js?v=*',async route=>{
    const response=await route.fetch();
    const source=await response.text();
    expect(source).toContain('function scheduleSubscribedRender() {');
    await route.fulfill({response,body:source.replace(
      'function scheduleSubscribedRender() {',
      'window.__journalV528TriggerSync = () => scheduleSubscribedRender();\nfunction scheduleSubscribedRender() {'
    )});
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
  await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  await page.locator('#boardView .j420-atelier-switch [data-j420-layout="timeline"]').click();
  const diary=page.locator('#timelineView');
  const picker=diary.locator('[data-j505-date-jump]');
  const options=await picker.locator('option').evaluateAll(items=>
    items.map(x=>x.value).filter(Boolean));
  const chosen=options[8];
  await picker.selectOption(chosen);
  const day=diary.locator('[data-jv-date="'+chosen+'"]').locator('xpath=..');
  const heading=day.locator('.jv-date');
  await expect(heading).toBeFocused();
  const top=await day.evaluate(el=>el.getBoundingClientRect().top);
  await page.evaluate(()=>window.__journalV528TriggerSync());
  await expect.poll(()=>page.evaluate(()=>new Promise(resolve=>
    requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(
      document.activeElement?.classList.contains('jv-date')
    )))
  ))).toBe(true);
  await expect(heading).toBeFocused();
  expect(Math.abs((await day.evaluate(el=>el.getBoundingClientRect().top))-top))
    .toBeLessThanOrEqual(38);
  const add=day.locator('[data-jv-add-date]').first();
  await add.scrollIntoViewIfNeeded();
  await add.focus();
  const addTop=await add.evaluate(el=>el.getBoundingClientRect().top);
  await page.evaluate(()=>window.__journalV528TriggerSync());
  await expect(add).toBeFocused();
  expect(Math.abs((await add.evaluate(el=>el.getBoundingClientRect().top))-addTop))
    .toBeLessThanOrEqual(38);
  await page.setViewportSize({width:320,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))
    .toBeLessThanOrEqual(2);
  // User navigation must not inherit the remote repaint's reading anchor.
  await diary.locator('[data-timeline-next]').click();
  await expect(diary.locator('[data-timeline-next]')).toBeFocused();
});


test('JOURNAL V530 remote snapshots preserve desk and list focus and IME text at phone widths',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  // Instrument the subscription trigger only in this test's loaded JS.
  await page.route('**/app.js?v=*',async route=>{
    const response=await route.fetch();
    const source=await response.text();
    expect(source).toContain('function scheduleSubscribedRender() {');
    await route.fulfill({response,body:source.replace(
      'function scheduleSubscribedRender() {',
      'window.__journalV530TriggerSync = () => scheduleSubscribedRender();\nfunction scheduleSubscribedRender() {'
    )});
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
  await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView');
  await board.locator('[data-j420-new-task]').click();
  const dialog=page.locator('#taskDialog');
  const title='JOURNAL V530 共同更新の焦点';
  await dialog.locator('#taskTitle').fill(title);
  await dialog.locator('#taskForm button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  await dismissSavedTaskDetailForTest(page);
  const card=board.locator('[data-j420-task-id]').filter({hasText:title});
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card.focus();
  const cardTop=await card.evaluate(el=>el.getBoundingClientRect().top);
  await page.evaluate(()=>window.__journalV530TriggerSync());
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  await expect(card).toBeFocused();
  expect(Math.abs((await card.evaluate(el=>el.getBoundingClientRect().top))-cardTop)).toBeLessThanOrEqual(38);

  await board.locator('[data-j420-layout="list"]').click();
  const list=page.locator('#listView');
  const query=list.locator('[data-j425-query]');
  await query.fill(title);
  await expect(query).toBeFocused();
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(done)));
  await query.evaluate(el=>el.setSelectionRange(7,7));
  await page.evaluate(()=>window.__journalV530TriggerSync());
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  await expect(query).toBeFocused();
  await expect(query).toHaveValue(title);
  expect(await query.evaluate(el=>el.selectionStart)).toBe(7);
  const row=list.locator('[data-j425-row]').filter({hasText:title});
  await row.scrollIntoViewIfNeeded();
  await row.focus();
  const rowTop=await row.evaluate(el=>el.getBoundingClientRect().top);
  await page.evaluate(()=>window.__journalV530TriggerSync());
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  await expect(row).toBeFocused();
  expect(Math.abs((await row.evaluate(el=>el.getBoundingClientRect().top))-rowTop)).toBeLessThanOrEqual(38);

  await query.focus();
  const composing=await query.elementHandle();
  await query.dispatchEvent('compositionstart',{data:'編'});
  await page.evaluate(()=>window.__journalV530TriggerSync());
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  expect(await composing.evaluate(el=>el.isConnected)).toBe(true);
  await query.dispatchEvent('compositionend',{data:'編集'});
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  await expect(query).toBeFocused();
  await expect(query).toHaveValue(title);
  await page.setViewportSize({width:320,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});

test('JOURNAL V532 remote deletion selects the next surviving desk/list case',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await page.route('**/app.js?v=*',async route=>{
    const response=await route.fetch(),source=await response.text();
    expect(source).toContain('function scheduleSubscribedRender() {');
    await route.fulfill({response,body:source.replace(
      'function scheduleSubscribedRender() {',
      'window.__journalV532Remove = id => { state.tasks=state.tasks.filter(t=>t.id!==id); scheduleSubscribedRender(); };\nfunction scheduleSubscribedRender() {'
    )});
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
  await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView');
  for(const name of ['V532 A','V532 B','V532 C','V532 D']){
    await board.locator('[data-j420-new-task]').click();
    const dialog=page.locator('#taskDialog');
    await dialog.locator('#taskTitle').fill(name);
    await dialog.locator('#taskForm button[type="submit"]').click();
    await expect(dialog).toBeHidden();
    await dismissSavedTaskDetailForTest(page);
  }
  const cards=board.locator('[data-j420-task-id]');
  await expect(cards).toHaveCount(4);
  const chosen=cards.nth(1),next=cards.nth(2);
  const deletedId=await chosen.getAttribute('data-j420-task-id');
  const nextId=await next.getAttribute('data-j420-task-id');
  await chosen.click();
  await expect(chosen).toHaveClass(/is-selected/);
  await chosen.focus();
  await page.evaluate(id=>window.__journalV532Remove(id),deletedId);
  await expect(board.locator('[data-j420-task-id="'+deletedId+'"]')).toHaveCount(0);
  await expect(board.locator('[data-j420-task-id="'+nextId+'"]')).toHaveClass(/is-selected/);
  await expect(board.locator('[data-j420-task-id="'+nextId+'"]')).toBeFocused();

  await board.locator('[data-j420-layout="list"]').click();
  const list=page.locator('#listView'),rows=list.locator('[data-j425-row]');
  await expect(rows).toHaveCount(3);
  const listChosen=rows.nth(1),listNext=rows.nth(2);
  const listDeleted=await listChosen.getAttribute('data-j425-row');
  const listNextId=await listNext.getAttribute('data-j425-row');
  await listChosen.click();
  await expect(listChosen).toHaveClass(/is-selected/);
  await listChosen.focus();
  await page.evaluate(id=>window.__journalV532Remove(id),listDeleted);
  await expect(list.locator('[data-j425-row="'+listDeleted+'"]')).toHaveCount(0);
  await expect(list.locator('[data-j425-row="'+listNextId+'"]')).toHaveClass(/is-selected/);
  await expect(list.locator('[data-j425-row="'+listNextId+'"]')).toBeFocused();
});

test('JOURNAL V534 carries explicitly selected cases across diary, list and desk without resetting filters',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView'),list=page.locator('#listView'),diary=page.locator('#timelineView');
  await board.locator('.j420-atelier-switch [data-j420-layout="timeline"]').click();
  const date=await diary.locator('[data-jv-add-date]').first().getAttribute('data-jv-add-date');
  for(const title of ['JOURNAL V534 A','JOURNAL V534 B']){
    await diary.locator('[data-jv-add-date="'+date+'"]').first().click();
    const editor=page.locator('#taskDialog');
    await expect(editor.locator('#taskDueDate')).toHaveValue(date);
    await editor.locator('#taskTitle').fill(title);
    await editor.locator('#taskForm button[type="submit"]').click();
    await expect(editor).toBeHidden();
    // Task save also opens the canonical detail folio; dismiss it before using the desk.
    await dismissSavedTaskDetailForTest(page);
  }
  const diaryB=diary.locator('.jv-day-item').filter({hasText:'JOURNAL V534 B'});
  const idB=await diaryB.getAttribute('data-task-id');
  await diaryB.locator('[data-j494-open-task]').click();
  await expect(page.locator('.app-shell')).toHaveClass(/detail-open/);
  await page.locator('#closeDetail').click();
  await expect(diaryB.locator('[data-j494-open-task]')).toBeFocused();

  await diary.locator('[data-j509-layout="list"]').evaluate(el=>el.click());
  const listB=list.locator('[data-j425-row="'+idB+'"]');
  await expect(listB).toHaveClass(/is-selected/);
  await expect(listB).toBeFocused();
  await list.locator('[data-j425-task-layout="board"]').evaluate(el=>el.click());
  const boardB=board.locator('[data-j420-task-id="'+idB+'"]');
  await expect(boardB).toHaveClass(/is-selected/);
  await expect(boardB).toBeFocused();

  const boardA=board.locator('[data-j420-task-id]').filter({hasText:'JOURNAL V534 A'});
  const idA=await boardA.getAttribute('data-j420-task-id');
  await boardA.click();
  await board.locator('[data-j420-layout="list"]').evaluate(el=>el.click());
  const listA=list.locator('[data-j425-row="'+idA+'"]');
  await expect(listA).toHaveClass(/is-selected/);
  await expect(listA).toBeFocused();
  await list.locator('[data-j425-task-layout="timeline"]').evaluate(el=>el.click());
  const diaryA=diary.locator('.jv-day-item[data-task-id="'+idA+'"]');
  await expect(diaryA).toBeFocused();
  await expect(diaryA).toBeInViewport();

  // A destination's own query takes precedence over an incompatible handoff.
  await diary.locator('[data-j509-layout="list"]').evaluate(el=>el.click());
  const query=list.locator('[data-j425-query]');
  await query.fill('JOURNAL V534 B');
  await expect(list.locator('[data-j425-row]')).toHaveCount(1);
  await list.locator('[data-j425-task-layout="board"]').evaluate(el=>el.click());
  await boardA.click();
  await board.locator('[data-j420-layout="list"]').evaluate(el=>el.click());
  await expect(query).toHaveValue('JOURNAL V534 B');
  await expect(listA).toHaveCount(0);
  await expect(listB).toHaveClass(/is-selected/);
  await page.setViewportSize({width:320,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});


test('JOURNAL V536 direct desk and index editing returns to the exact row after cancel',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView');
  await board.locator('[data-j420-new-task]').click();
  const editor=page.locator('#taskDialog');
  const title='JOURNAL V536 ダブルクリックで編集';
  await editor.locator('#taskTitle').fill(title);
  await editor.locator('#taskForm button[type="submit"]').click();
  await expect(editor).toBeHidden();
  await dismissSavedTaskDetailForTest(page);

  const card=board.locator('[data-j420-task-id]').filter({hasText:title});
  await card.scrollIntoViewIfNeeded();
  const cardTop=await card.evaluate(el=>el.getBoundingClientRect().top);
  await card.dblclick({position:{x:80,y:24}});
  await expect(editor).toBeVisible();
  await editor.locator('#closeTaskDialog').click();
  await expect(editor).toBeHidden();
  await expect(card).toBeFocused();
  expect(Math.abs((await card.evaluate(el=>el.getBoundingClientRect().top))-cardTop))
    .toBeLessThanOrEqual(38);

  await board.locator('[data-j420-layout="list"]').click();
  const list=page.locator('#listView');
  const row=list.locator('[data-j425-row]').filter({hasText:title});
  await row.scrollIntoViewIfNeeded();
  const rowTop=await row.evaluate(el=>el.getBoundingClientRect().top);
  await row.dblclick({position:{x:120,y:32}});
  await expect(editor).toBeVisible();
  await editor.locator('#closeTaskDialog').click();
  await expect(editor).toBeHidden();
  await expect(row).toBeFocused();
  expect(Math.abs((await row.evaluate(el=>el.getBoundingClientRect().top))-rowTop))
    .toBeLessThanOrEqual(38);

  await page.setViewportSize({width:320,height:800});
  await row.scrollIntoViewIfNeeded();
  await row.dblclick({position:{x:120,y:32}});
  await expect(editor).toBeVisible();
  await editor.locator('#closeTaskDialog').click();
  await expect(editor).toBeHidden();
  await expect(row).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))
    .toBeLessThanOrEqual(2);
});


test('JOURNAL V538 missing edited case returns to nearby desk and index rows on phones',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  // Only in the test response: emulate a committed local deletion while the
  // canonical editor is open. Production has no synthetic deletion endpoint.
  await page.route('**/app.js?v=*',async route=>{
    const response=await route.fetch(),source=await response.text();
    expect(source).toContain('function scheduleSubscribedRender() {');
    await route.fulfill({response,body:source.replace(
      'function scheduleSubscribedRender() {',
      'window.__journalV538Remove = id => { state.tasks=state.tasks.filter(t=>t.id!==id); render(); };\nfunction scheduleSubscribedRender() {'
    )});
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
  await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView'),editor=page.locator('#taskDialog');
  for(const title of ['V538 A','V538 B','V538 C','V538 D','V538 E']){
    await board.locator('[data-j420-new-task]').click();
    await editor.locator('#taskTitle').fill(title);
    await editor.locator('#taskForm button[type="submit"]').click();
    await expect(editor).toBeHidden();
    await dismissSavedTaskDetailForTest(page);
  }
  await board.locator('[data-j420-layout="list"]').click();
  const list=page.locator('#listView');
  await list.locator('[data-j425-sort]').selectOption('title');
  const rows=list.locator('[data-j425-row]');
  await expect(rows).toHaveCount(5);
  const removedId=await rows.nth(1).getAttribute('data-j425-row');
  const nextId=await rows.nth(2).getAttribute('data-j425-row');
  await rows.nth(1).scrollIntoViewIfNeeded();
  await rows.nth(1).dblclick({position:{x:105,y:35}});
  await expect(editor).toBeVisible();
  await page.evaluate(id=>window.__journalV538Remove(id),removedId);
  await expect(rows).toHaveCount(4);
  await editor.locator('#closeTaskDialog').click();
  await expect(editor).toBeHidden();
  const nextRow=list.locator('[data-j425-row="'+nextId+'"]');
  await expect(nextRow).toHaveClass(/is-selected/);
  await expect(nextRow).toBeFocused();

  await list.locator('[data-j425-task-layout="board"]').click();
  await page.setViewportSize({width:320,height:800});
  const cards=board.locator('[data-j420-task-id]');
  await expect(cards).toHaveCount(4);
  const boardRemoved=await cards.nth(1).getAttribute('data-j420-task-id');
  const boardNext=await cards.nth(2).getAttribute('data-j420-task-id');
  await cards.nth(1).scrollIntoViewIfNeeded();
  await cards.nth(1).dblclick({position:{x:50,y:20}});
  await expect(editor).toBeVisible();
  await page.evaluate(id=>window.__journalV538Remove(id),boardRemoved);
  await expect(cards).toHaveCount(3);
  await editor.locator('#closeTaskDialog').click();
  await expect(editor).toBeHidden();
  const nextCard=board.locator('[data-j420-task-id="'+boardNext+'"]');
  await expect(nextCard).toHaveClass(/is-selected/);
  await expect(nextCard).toBeFocused();
  await expect(nextCard).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))
    .toBeLessThanOrEqual(2);
});


test('JOURNAL V540 phone index browses filtered cases without returning to a long list',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView'),editor=page.locator('#taskDialog');
  for(const title of ['JOURNAL V540 C','JOURNAL V540 A','JOURNAL V540 B']){
    await board.locator('[data-j420-new-task]').click();
    await editor.locator('#taskTitle').fill(title);
    await editor.locator('#taskForm button[type="submit"]').click();
    await expect(editor).toBeHidden();
    await dismissSavedTaskDetailForTest(page);
  }
  await board.locator('[data-j420-layout="list"]').click();
  const list=page.locator('#listView');
  await list.locator('[data-j425-sort]').selectOption('title');
  const query=list.locator('[data-j425-query]');
  await query.fill('JOURNAL V540');
  const rows=list.locator('[data-j425-row]');
  await expect(rows).toHaveCount(3);
  await rows.first().click();

  const reader=list.locator('.j425-task-preview.j491-inline-detail');
  await expect(reader).toBeVisible();
  const previous=reader.locator('[data-j540-case-step="-1"]');
  const next=reader.locator('[data-j540-case-step="1"]');
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
  await expect(reader.locator('h3')).toHaveText('JOURNAL V540 A');

  await next.click();
  await expect(rows.nth(1)).toHaveClass(/is-selected/);
  await expect(reader.locator('h3')).toHaveText('JOURNAL V540 B');
  await expect(next).toBeFocused();
  await expect(next).toBeInViewport();

  await next.click();
  await expect(rows.nth(2)).toHaveClass(/is-selected/);
  await expect(reader.locator('h3')).toHaveText('JOURNAL V540 C');
  await expect(next).toBeDisabled();
  await expect(previous).toBeFocused();

  await page.setViewportSize({width:320,height:800});
  await previous.click();
  await expect(reader.locator('h3')).toHaveText('JOURNAL V540 B');
  await expect(previous).toBeFocused();
  await expect(query).toHaveValue('JOURNAL V540');
  await expect(reader).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))
    .toBeLessThanOrEqual(2);
});


test('JOURNAL V544 phone reader stays open after an edit leaves the filter and after another save',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView'),editor=page.locator('#taskDialog');
  for(const title of ['JOURNAL V544 C','JOURNAL V544 A','JOURNAL V544 B']){
    await board.locator('[data-j420-new-task]').click();
    await editor.locator('#taskTitle').fill(title);
    await editor.locator('#taskForm button[type="submit"]').click();
    await expect(editor).toBeHidden();
    await dismissSavedTaskDetailForTest(page);
  }
  await board.locator('[data-j420-layout="list"]').click();
  const list=page.locator('#listView'),query=list.locator('[data-j425-query]');
  await list.locator('[data-j425-sort]').selectOption('title');
  await query.fill('JOURNAL V544');
  const rows=list.locator('[data-j425-row]');
  await expect(rows).toHaveCount(3);
  await rows.first().click();
  const reader=list.locator('.j425-task-preview.j491-inline-detail');
  const next=reader.locator('[data-j540-case-step="1"]');
  await next.click();
  await expect(reader.locator('h3')).toHaveText('JOURNAL V544 B');
  await expect(next).toBeFocused();

  // Editing B to no longer match the query should keep the note open on C.
  await reader.locator('[data-j425-preview-edit]').click();
  await expect(editor).toBeVisible();
  await editor.locator('#taskTitle').fill('条件外の編集案件');
  await editor.locator('#taskForm button[type="submit"]').click();
  await expect(editor).toBeHidden();
  await expect(rows).toHaveCount(2);
  await expect(reader).toBeVisible();
  await expect(reader.locator('h3')).toHaveText('JOURNAL V544 C');
  await expect(reader.locator('h3')).toBeFocused();
  await expect(reader.locator('[data-j540-case-step="1"]')).toBeDisabled();
  await expect(query).toHaveValue('JOURNAL V544');

  // A second selection and save should return to the same inline reader.
  await page.setViewportSize({width:320,height:800});
  await reader.locator('[data-j540-case-step="-1"]').click();
  await expect(reader.locator('h3')).toHaveText('JOURNAL V544 A');
  await reader.locator('[data-j425-preview-edit]').click();
  await expect(editor).toBeVisible();
  await editor.locator('#taskDescription').fill('連続閲覧中の案件編集');
  await editor.locator('#taskForm button[type="submit"]').click();
  await expect(editor).toBeHidden();
  await expect(reader).toBeVisible();
  await expect(reader.locator('h3')).toHaveText('JOURNAL V544 A');
  await expect(reader.locator('[data-j425-preview-edit]')).toBeFocused();
  await expect(query).toHaveValue('JOURNAL V544');

  await reader.locator('[data-j491-task-return]').first().click();
  await expect(reader).toBeHidden();
  await expect(rows.first()).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))
    .toBeLessThanOrEqual(2);
});


test('JOURNAL V546 remote removals keep the active phone reader and recover an emptied search',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  // Inject a test-only Firebase subscription notification; production never
  // exposes this helper and the user data model is not changed by the test.
  await page.route('**/app.js?v=*',async route=>{
    const response=await route.fetch(),source=await response.text();
    expect(source).toContain('function scheduleSubscribedRender() {');
    await route.fulfill({response,body:source.replace(
      'function scheduleSubscribedRender() {',
      'window.__journalV546RemoteDelete = id => { state.tasks=state.tasks.filter(t=>t.id!==id); scheduleSubscribedRender(); };\nfunction scheduleSubscribedRender() {'
    )});
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
  await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView'),editor=page.locator('#taskDialog');
  for(const title of ['JOURNAL V546 C','JOURNAL V546 A','JOURNAL V546 B','条件外の案件']){
    await board.locator('[data-j420-new-task]').click();
    await editor.locator('#taskTitle').fill(title);
    await editor.locator('#taskForm button[type="submit"]').click();
    await expect(editor).toBeHidden();
    await dismissSavedTaskDetailForTest(page);
  }
  await board.locator('[data-j420-layout="list"]').click();
  const list=page.locator('#listView'),query=list.locator('[data-j425-query]');
  await list.locator('[data-j425-sort]').selectOption('title');
  await query.fill('JOURNAL V546');
  const rows=list.locator('[data-j425-row]');
  await expect(rows).toHaveCount(3);
  const ids={};
  for(const title of ['A','B','C']){
    ids[title]=await rows.filter({hasText:'JOURNAL V546 '+title})
      .getAttribute('data-j425-row');
  }
  await list.locator('[data-j425-row="'+ids.B+'"]').click();
  const reader=list.locator('.j425-task-preview.j491-inline-detail');
  const next=reader.locator('[data-j540-case-step="1"]');
  await expect(reader.locator('h3')).toHaveText('JOURNAL V546 B');
  await next.focus();
  await expect(next).toBeFocused();

  // Selected B disappears remotely. The notebook should remain open at C.
  await page.evaluate(id=>window.__journalV546RemoteDelete(id),ids.B);
  await expect(rows).toHaveCount(2);
  await expect(reader.locator('h3')).toHaveText('JOURNAL V546 C');
  await expect(reader.locator('[data-j540-case-step="-1"]')).toBeFocused();
  await expect(next).toBeDisabled();
  await expect(reader).toBeInViewport();

  // No next case remains; the reverse key also becomes disabled at A.
  await page.evaluate(id=>window.__journalV546RemoteDelete(id),ids.C);
  await expect(rows).toHaveCount(1);
  await expect(reader.locator('h3')).toHaveText('JOURNAL V546 A');
  await expect(reader.locator('h3')).toBeFocused();

  // The last matching case disappears; keep the user's query and make the
  // already-existing reset action visible and keyboard reachable.
  await page.setViewportSize({width:320,height:800});
  await page.evaluate(id=>window.__journalV546RemoteDelete(id),ids.A);
  await expect(rows).toHaveCount(0);
  const empty=list.locator('.j518-index-empty');
  const reset=empty.locator('[data-j518-empty-reset]');
  await expect(empty).toContainText('閲覧中の案件が同期更新で表示対象から外れました');
  await expect(reader).toBeHidden();
  await expect(reset).toBeFocused();
  await expect(reset).toBeInViewport();
  await expect(query).toHaveValue('JOURNAL V546');

  await reset.click();
  await expect(rows).toHaveCount(1);
  await expect(query).toHaveValue('');
  await expect(query).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))
    .toBeLessThanOrEqual(2);
});


test('JOURNAL V548 mobile case reader survives sort, search, facets and Japanese IME',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView'),editor=page.locator('#taskDialog');
  for(const title of ['JOURNAL V548 A','JOURNAL V548 B','JOURNAL V548 C']){
    await board.locator('[data-j420-new-task]').click();
    await editor.locator('#taskTitle').fill(title);
    await editor.locator('#taskStatus').selectOption(title.endsWith('C')?'対応中':'未着手');
    await editor.locator('#taskForm button[type="submit"]').click();
    await expect(editor).toBeHidden();
    await dismissSavedTaskDetailForTest(page);
  }
  await board.locator('[data-j420-layout="list"]').click();
  const list=page.locator('#listView'),sort=list.locator('[data-j425-sort]');
  const query=list.locator('[data-j425-query]'),rows=list.locator('[data-j425-row]');
  await sort.selectOption('title');
  await query.fill('JOURNAL V548');
  await expect(rows).toHaveCount(3);
  await rows.nth(1).click();
  const reader=list.locator('.j425-task-preview.j491-inline-detail');
  await expect(reader.locator('h3')).toHaveText('JOURNAL V548 B');

  // Sorting rearranges the list, but must not replace the selected case.
  await sort.focus();
  await sort.selectOption('updated');
  await expect(reader.locator('h3')).toHaveText('JOURNAL V548 B');
  await expect(sort).toBeFocused();
  await sort.selectOption('title');
  await expect(reader.locator('h3')).toHaveText('JOURNAL V548 B');

  // A local query that excludes B keeps the reader open on its next case.
  await query.fill('JOURNAL V548 C');
  await expect(rows).toHaveCount(1);
  await expect(reader.locator('h3')).toHaveText('JOURNAL V548 C');
  await expect(query).toBeFocused();
  await query.fill('JOURNAL V548');
  await expect(rows).toHaveCount(3);
  await expect(reader.locator('h3')).toHaveText('JOURNAL V548 C');

  // A status facet excludes C; the prior visible order chooses neighboring B.
  await list.locator('[data-j447-toggle-filters]').click();
  const facet=list.locator('[data-j430-facet="status"][data-j430-value="未着手"]');
  await facet.click();
  await expect(rows).toHaveCount(2);
  await expect(reader.locator('h3')).toHaveText('JOURNAL V548 B');
  await expect(facet).toBeFocused();

  // No rerender is permitted while Japanese IME is still composing.
  await page.setViewportSize({width:320,height:800});
  await query.evaluate(input=>{
    input.focus();
    input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'A'}));
    input.value='JOURNAL V548 A';
    input.setSelectionRange(input.value.length,input.value.length);
    input.dispatchEvent(new InputEvent('input',{
      bubbles:true,isComposing:true,inputType:'insertCompositionText',data:'A'
    }));
  });
  await expect(reader.locator('h3')).toHaveText('JOURNAL V548 B');
  await query.evaluate(input=>
    input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'A'})));
  await expect(rows).toHaveCount(1);
  await expect(reader.locator('h3')).toHaveText('JOURNAL V548 A');
  await expect(query).toHaveValue('JOURNAL V548 A');
  await expect(query).toBeFocused();

  // No matching cases closes the reader, but keeps the new query editable.
  await query.fill('JOURNAL V548 no match');
  await expect(rows).toHaveCount(0);
  await expect(reader).toBeHidden();
  await expect(list.locator('.j518-index-empty')).toBeVisible();
  await expect(query).toBeFocused();
  await list.locator('[data-j518-empty-reset]').click();
  await expect(query).toHaveValue('');
  await expect(query).toBeFocused();
  await expect(rows).toHaveCount(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))
    .toBeLessThanOrEqual(2);
});


test('JOURNAL V549 latest focus wins across filtering, Firebase repaint and IME on phones',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await page.route('**/app.js?v=*',async route=>{
    const response=await route.fetch(),source=await response.text();
    expect(source).toContain('function scheduleSubscribedRender() {');
    await route.fulfill({response,body:source.replace(
      'function scheduleSubscribedRender() {',
      'window.__journalV549TriggerSync = () => scheduleSubscribedRender();\nfunction scheduleSubscribedRender() {'
    )});
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
  await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView'),editor=page.locator('#taskDialog');
  for(const title of ['JOURNAL V549 A','JOURNAL V549 B','JOURNAL V549 C']){
    await board.locator('[data-j420-new-task]').click();
    await editor.locator('#taskTitle').fill(title);
    await editor.locator('#taskForm button[type="submit"]').click();
    await expect(editor).toBeHidden();
    await dismissSavedTaskDetailForTest(page);
  }
  await board.locator('[data-j420-layout="list"]').click();
  const list=page.locator('#listView'),rows=list.locator('[data-j425-row]');
  const query=list.locator('[data-j425-query]'),sort=list.locator('[data-j425-sort]');
  await sort.selectOption('title');
  await query.fill('JOURNAL V549');
  await expect(rows).toHaveCount(3);
  await rows.filter({hasText:'JOURNAL V549 B'}).click();
  const reader=list.locator('.j425-task-preview.j491-inline-detail');
  await expect(reader.locator('h3')).toHaveText('JOURNAL V549 B');

  // A subscription was queued before the search redraw. The user moves to
  // the sort control afterwards; an old search-focus frame must not steal it.
  await page.evaluate(()=>{
    window.__journalV549TriggerSync();
    const search=document.querySelector('#listView [data-j425-query]');
    search.value='JOURNAL V549 B';
    search.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#listView [data-j425-sort]').focus();
  });
  await page.evaluate(()=>new Promise(done=>
    requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(done)))));
  await expect(sort).toBeFocused();
  await expect(query).toHaveValue('JOURNAL V549 B');
  await expect(rows).toHaveCount(1);
  await expect(reader.locator('h3')).toHaveText('JOURNAL V549 B');

  // Reverse ordering: local input rerender starts first, then the subscription.
  // One winner restores the most recent query and its exact caret position.
  await page.evaluate(()=>{
    const search=document.querySelector('#listView [data-j425-query]');
    search.focus();
    search.value='JOURNAL V549';
    search.setSelectionRange(7,7);
    search.dispatchEvent(new Event('input',{bubbles:true}));
    window.__journalV549TriggerSync();
  });
  await page.evaluate(()=>new Promise(done=>
    requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(done)))));
  await expect(rows).toHaveCount(3);
  await expect(query).toBeFocused();
  await expect(query).toHaveValue('JOURNAL V549');
  expect(await query.evaluate(el=>el.selectionStart)).toBe(7);
  await expect(reader.locator('h3')).toHaveText('JOURNAL V549 B');

  // An active composition must survive a queued subscription without the
  // underlying input node being replaced. The final result selects C.
  await page.setViewportSize({width:320,height:800});
  const composing=await query.elementHandle();
  await query.evaluate(input=>{
    input.focus();
    input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'C'}));
    input.value='JOURNAL V549 C';
    input.dispatchEvent(new InputEvent('input',{
      bubbles:true,isComposing:true,inputType:'insertCompositionText',data:'C'
    }));
    window.__journalV549TriggerSync();
  });
  await page.evaluate(()=>new Promise(done=>
    requestAnimationFrame(()=>requestAnimationFrame(done))));
  expect(await composing.evaluate(el=>el.isConnected)).toBe(true);
  await expect(reader.locator('h3')).toHaveText('JOURNAL V549 B');
  await query.evaluate(input=>
    input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'C'})));
  await page.evaluate(()=>new Promise(done=>
    requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(done)))));
  await expect(rows).toHaveCount(1);
  await expect(reader.locator('h3')).toHaveText('JOURNAL V549 C');
  await expect(query).toHaveValue('JOURNAL V549 C');
  await expect(query).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))
    .toBeLessThanOrEqual(2);
});


test('JOURNAL V552 phone desk note survives remote removals and offers empty recovery',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  // Test-only subscription notification; no live Firebase or persisted tasks.
  await page.route('**/app.js?v=*',async route=>{
    const response=await route.fetch(),source=await response.text();
    expect(source).toContain('function scheduleSubscribedRender() {');
    await route.fulfill({response,body:source.replace(
      'function scheduleSubscribedRender() {',
      'window.__journalV552RemoteDelete = id => { state.tasks=state.tasks.filter(t=>t.id!==id); scheduleSubscribedRender(); };\nfunction scheduleSubscribedRender() {'
    )});
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
  await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView'),editor=page.locator('#taskDialog');
  for(const title of ['JOURNAL V552 A','JOURNAL V552 B','JOURNAL V552 C','条件外の案件']){
    await board.locator('[data-j420-new-task]').click();
    await editor.locator('#taskTitle').fill(title);
    await editor.locator('#taskForm button[type="submit"]').click();
    await expect(editor).toBeHidden();
    await dismissSavedTaskDetailForTest(page);
  }
  const query=board.locator('[data-j420-search]');
  await query.fill('JOURNAL V552');
  const cards=board.locator('[data-j420-task-id]');
  await expect(cards).toHaveCount(3);
  // Use the actual visible order, not creation/title order, to check the
  // existing V532 next-then-previous fallback regardless of default sort.
  const chosen=cards.nth(1),next=cards.nth(2),last=cards.nth(0);
  const chosenId=await chosen.getAttribute('data-j420-task-id');
  const nextId=await next.getAttribute('data-j420-task-id');
  const lastId=await last.getAttribute('data-j420-task-id');
  const chosenTitle=await chosen.locator('.j420-card-content strong').innerText();
  const nextTitle=await next.locator('.j420-card-content strong').innerText();
  const lastTitle=await last.locator('.j420-card-content strong').innerText();

  await chosen.click();
  const note=board.locator('#j494AtelierNote.j494-inline-note');
  const heading=note.locator('.j420-note-lead h4');
  await expect(heading).toHaveText(chosenTitle);
  await expect(heading).toBeFocused();

  // The selected remote case disappears. Continue on the neighboring C
  // without folding the phone's open notebook or moving off the reading area.
  await page.evaluate(id=>window.__journalV552RemoteDelete(id),chosenId);
  await expect(cards).toHaveCount(2);
  await expect(note).toBeVisible();
  await expect(heading).toHaveText(nextTitle);
  await expect(heading).toBeFocused();
  await expect(note).toBeInViewport();
  await expect(board.locator('[data-j420-task-id="'+nextId+'"]')).toHaveAttribute('aria-expanded','true');

  await page.setViewportSize({width:320,height:800});
  await page.evaluate(id=>window.__journalV552RemoteDelete(id),nextId);
  await expect(cards).toHaveCount(1);
  await expect(note).toBeVisible();
  await expect(heading).toHaveText(lastTitle);
  await expect(heading).toBeFocused();

  // The last matching case goes away but an unrelated case still exists:
  // expose the already-existing reset instead of focusing a hidden note.
  await page.evaluate(id=>window.__journalV552RemoteDelete(id),lastId);
  await expect(cards).toHaveCount(0);
  const empty=board.locator('.j520-atelier-empty'),reset=empty.locator('[data-j520-empty-reset]');
  await expect(empty).toContainText('閲覧中の案件が同期更新で表示対象から外れました');
  await expect(note).toBeHidden();
  await expect(reset).toBeFocused();
  await expect(reset).toBeInViewport();
  await expect(query).toHaveValue('JOURNAL V552');
  await reset.click();
  await expect(cards).toHaveCount(1);
  await expect(query).toHaveValue('');
  await expect(query).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))
    .toBeLessThanOrEqual(2);
});


test('JOURNAL V553 phone desk browses real shelf order and restores focus after a sync',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await page.route('**/app.js?v=*',async route=>{
    const response=await route.fetch(),source=await response.text();
    expect(source).toContain('function scheduleSubscribedRender() {');
    await route.fulfill({response,body:source.replace(
      'function scheduleSubscribedRender() {',
      'window.__journalV553RemoteDelete = id => { state.tasks=state.tasks.filter(t=>t.id!==id); scheduleSubscribedRender(); };\nfunction scheduleSubscribedRender() {'
    )});
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
  await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView'),editor=page.locator('#taskDialog');
  for(const title of ['JOURNAL V553 C','JOURNAL V553 A','JOURNAL V553 B','条件外の案件']){
    await board.locator('[data-j420-new-task]').click();
    await editor.locator('#taskTitle').fill(title);
    await editor.locator('#taskForm button[type="submit"]').click();
    await expect(editor).toBeHidden();
    // Task save also opens the canonical detail folio; dismiss it before using the desk.
    await dismissSavedTaskDetailForTest(page);
  }
  const query=board.locator('[data-j420-search]');
  await query.fill('JOURNAL V553');
  const cards=board.locator('[data-j420-task-id]');
  await expect(cards).toHaveCount(3);
  const ids=[],titles=[];
  for(let i=0;i<3;i++){
    ids.push(await cards.nth(i).getAttribute('data-j420-task-id'));
    titles.push(await cards.nth(i).locator('.j420-card-content strong').innerText());
  }
  await cards.first().click();
  const note=board.locator('#j494AtelierNote');
  await expect(note).toHaveClass(/j494-inline-note/);
  const heading=note.locator('.j420-note-lead h4');
  const pager=note.locator('.j553-atelier-pager');
  const previous=pager.locator('[data-j553-case-step="-1"]');
  const next=pager.locator('[data-j553-case-step="1"]');
  const position=pager.locator('[data-j553-case-position]');
  await expect(pager).toBeVisible();
  await expect(position).toHaveText('1 / 3 件');
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();

  // Consecutive reading uses the actual shelf DOM order, even if category
  // shelves differ from canonical task creation order.
  await next.click();
  await expect(heading).toHaveText(titles[1]);
  await expect(position).toHaveText('2 / 3 件');
  await expect(next).toBeFocused();
  await expect(next).toBeInViewport();
  await next.click();
  await expect(heading).toHaveText(titles[2]);
  await expect(position).toHaveText('3 / 3 件');
  await expect(next).toBeDisabled();
  await expect(previous).toBeFocused();

  await page.setViewportSize({width:320,height:800});
  await previous.click();
  await expect(heading).toHaveText(titles[1]);
  await expect(previous).toBeFocused();
  await expect(position).toHaveText('2 / 3 件');

  // A remote update removes the selected case while the pager owns focus.
  // The next case stays open and the same available page direction survives.
  await page.evaluate(id=>window.__journalV553RemoteDelete(id),ids[1]);
  await expect(cards).toHaveCount(2);
  await expect(note).toHaveClass(/j494-inline-note/);
  await expect(heading).toHaveText(titles[2]);
  await expect(position).toHaveText('2 / 2 件');
  await expect(previous).toBeFocused();

  // The remaining previous case disappears: both directions are disabled;
  // the old pager focus must fall back to the visible note heading.
  await page.evaluate(id=>window.__journalV553RemoteDelete(id),ids[0]);
  await expect(cards).toHaveCount(1);
  await expect(heading).toHaveText(titles[2]);
  await expect(position).toHaveText('1 / 1 件');
  await expect(previous).toBeDisabled();
  await expect(next).toBeDisabled();
  await expect(heading).toBeFocused();

  await note.locator('[data-j494-atelier-back]').click();
  await expect(cards.first()).toBeFocused();
  await expect(note).not.toHaveClass(/j494-inline-note/);
  await expect(query).toHaveValue('JOURNAL V553');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))
    .toBeLessThanOrEqual(2);
  await page.setViewportSize({width:1366,height:900});
  await expect(pager).toBeHidden();
});


test('JOURNAL V554 latest focused control wins over card/pager frames and remote sync',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await page.route('**/app.js?v=*',async route=>{
    const response=await route.fetch(),source=await response.text();
    expect(source).toContain('function scheduleSubscribedRender() {');
    await route.fulfill({response,body:source.replace(
      'function scheduleSubscribedRender() {',
      'window.__journalV554TriggerSync = () => scheduleSubscribedRender();\nfunction scheduleSubscribedRender() {'
    )});
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
  await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView'),editor=page.locator('#taskDialog');
  for(const title of ['JOURNAL V554 Alpha','JOURNAL V554 Beta','JOURNAL V554 Gamma']){
    await board.locator('[data-j420-new-task]').click();
    await editor.locator('#taskTitle').fill(title);
    await editor.locator('#taskForm button[type="submit"]').click();
    await expect(editor).toBeHidden();
    // Task save also opens the canonical detail folio; dismiss it before using the desk.
    await dismissSavedTaskDetailForTest(page);
  }
  const search=board.locator('[data-j420-search]');
  await search.fill('JOURNAL V554');
  const cards=board.locator('[data-j420-task-id]');
  await expect(cards).toHaveCount(3);

  // Click a card and immediately focus another control in the same event
  // turn. The card's old requestAnimationFrame must not steal that focus.
  await cards.first().evaluate(el=>{
    el.focus();
    el.click();
    el.closest('#boardView').querySelector('[data-j420-search]').focus();
  });
  const note=board.locator('#j494AtelierNote.j494-inline-note');
  await expect(note).toBeVisible();
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  await expect(search).toBeFocused();

  // Directly focus the note's action after a page turn. A second focus jump
  // from the selection handler must not override it.
  await note.locator('[data-j553-case-step="1"]').evaluate(btn=>{
    btn.focus();
    btn.click();
    document.querySelector('#boardView #j494AtelierNote [data-j420-note-edit]').focus();
  });
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  await expect(note.locator('[data-j420-note-edit]')).toBeFocused();
  await expect(note.locator('[data-j553-case-position]')).toHaveText('2 / 3 件');

  // A subscribed repaint in the same interaction burst must preserve the
  // newest search focus while keeping the selected note and search intact.
  await page.evaluate(()=>{
    const current=document.querySelector('#boardView #j494AtelierNote');
    const previous=current.querySelector('[data-j553-case-step="-1"]');
    previous.focus();
    previous.click();
    document.querySelector('#boardView [data-j420-search]').focus();
    window.__journalV554TriggerSync();
  });
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>
    requestAnimationFrame(()=>requestAnimationFrame(done)))));
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('JOURNAL V554');
  await expect(note).toBeVisible();
  await expect(note.locator('[data-j553-case-position]')).toHaveText('1 / 3 件');

  // Normal pager operation still restores its own focus when no newer
  // interaction intervenes.
  await note.locator('[data-j553-case-step="1"]').click();
  await expect(note.locator('[data-j553-case-step="1"]')).toBeFocused();
  await expect(note.locator('[data-j553-case-position]')).toHaveText('2 / 3 件');
  await page.setViewportSize({width:320,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))
    .toBeLessThanOrEqual(2);
});


test('JOURNAL V556 long phone note stays at its reading section after sync and width changes',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await page.route('**/app.js?v=*',async route=>{
    const response=await route.fetch(),source=await response.text();
    expect(source).toContain('function scheduleSubscribedRender() {');
    await route.fulfill({response,body:source.replace(
      'function scheduleSubscribedRender() {',
      'window.__journalV556RemoteRepaint = () => scheduleSubscribedRender();\nfunction scheduleSubscribedRender() {'
    )});
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
  await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();

  const board=page.locator('#boardView'),dialog=page.locator('#taskDialog');
  const longMemo='引継ぎを確認しながら案件ノートを読み進める。'.repeat(250);
  for(const title of ['JOURNAL V556 深い案件ノート A','JOURNAL V556 深い案件ノート B']){
    await board.locator('[data-j420-new-task]').click();
    await dialog.locator('#taskTitle').fill(title);
    await dialog.locator('#taskDescription').fill(longMemo);
    await dialog.locator('#taskForm button[type="submit"]').click();
    await expect(dialog).toBeHidden();
    // Task save also opens the canonical detail folio; dismiss it before using the desk.
    await dismissSavedTaskDetailForTest(page);
  }
  const search=board.locator('[data-j420-search]');
  await search.fill('JOURNAL V556');
  const cards=board.locator('[data-j420-task-id]');
  await expect(cards).toHaveCount(2);
  await cards.first().click();
  const note=board.locator('#j494AtelierNote.j494-inline-note');
  const section=note.locator('.j420-note-description');
  const pager=note.locator('.j553-atelier-pager');
  await expect(section).toBeVisible();
  expect(await section.evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThan(800);

  // Read well below the title. The focused title is now offscreen, so a
  // remote subscription must not scroll back to the title on repaint.
  await section.evaluate(el=>{
    const rect=el.getBoundingClientRect();
    window.scrollTo({top:Math.max(0,window.scrollY+rect.top+Math.min(420,rect.height*.4)-72),behavior:'instant'});
  });
  const settle=()=>page.evaluate(()=>new Promise(done=>
    requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(done)))));
  await settle();
  const before=await section.evaluate(el=>el.getBoundingClientRect().top);
  expect(before).toBeLessThan(-120);
  await page.evaluate(()=>window.__journalV556RemoteRepaint());
  await settle();
  const afterSync=await section.evaluate(el=>el.getBoundingClientRect().top);
  expect(Math.abs(afterSync-before)).toBeLessThanOrEqual(75);
  await expect(note).toBeVisible();
  await expect(search).toHaveValue('JOURNAL V556');

  // 390→320 and back: neither change crosses the 760px media breakpoint,
  // so the dedicated width anchor must preserve the current reading section.
  await page.setViewportSize({width:320,height:800});
  await settle();
  const afterNarrow=await section.evaluate(el=>el.getBoundingClientRect().top);
  expect(Math.abs(afterNarrow-afterSync)).toBeLessThanOrEqual(75);
  await page.setViewportSize({width:390,height:800});
  await settle();
  const afterWide=await section.evaluate(el=>el.getBoundingClientRect().top);
  expect(Math.abs(afterWide-afterNarrow)).toBeLessThanOrEqual(75);

  // Explicit case paging still works normally, including its focus owner.
  await pager.locator('[data-j553-case-step="1"]').click();
  await expect(pager.locator('[data-j553-case-position]')).toHaveText('2 / 2 件');
  await expect(pager.locator('[data-j553-case-step="-1"]')).toBeFocused();

  // If the user subsequently focuses the search control, an additional
  // phone width change must not steal that focus to repair the note.
  await search.focus();
  await page.setViewportSize({width:320,height:800});
  await settle();
  await expect(search).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))
    .toBeLessThanOrEqual(2);
});


test('JOURNAL V558 detail and editor return to the phone note after width changes',async({page})=>{
  test.setTimeout(90000);
  await boot(page,390);
  await page.setViewportSize({width:390,height:800});
  await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const board=page.locator('#boardView'),dialog=page.locator('#taskDialog');
  const longMemo='案件の対応経過を確認し、続きを読むための長文です。'.repeat(105);
  for(const title of ['JOURNAL V558 A','JOURNAL V558 B','JOURNAL V558 C']){
    await board.locator('[data-j420-new-task]').click();
    await dialog.locator('#taskTitle').fill(title);
    await dialog.locator('#taskDescription').fill(longMemo);
    await dialog.locator('#taskForm button[type="submit"]').click();
    await expect(dialog).toBeHidden();
    // Task save also opens the canonical detail folio; dismiss it before using the desk.
    await dismissSavedTaskDetailForTest(page);
  }
  const search=board.locator('[data-j420-search]');
  await search.fill('JOURNAL V558');
  const cards=board.locator('[data-j420-task-id]');
  await expect(cards).toHaveCount(3);
  await cards.nth(1).click();
  const note=board.locator('#j494AtelierNote.j494-inline-note');
  await expect(note).toBeVisible();
  const action=note.locator('[data-j420-note-detail]');
  await action.scrollIntoViewIfNeeded();
  const before=await action.evaluate(el=>el.getBoundingClientRect().top);
  await action.click();
  const panel=page.locator('.detail-panel');
  await expect(panel).toHaveClass(/open/);
  await page.setViewportSize({width:320,height:800});
  await page.locator('#closeDetail').click();
  await expect(panel).not.toHaveClass(/open/);
  await expect(action).toBeFocused();
  const narrowTop=await action.evaluate(el=>el.getBoundingClientRect().top);
  expect(Math.abs(narrowTop-before)).toBeLessThanOrEqual(45);
  await expect(note).toBeVisible();
  await expect(note.locator('[data-j553-case-position]')).toHaveText('2 / 3 件');
  await expect(search).toHaveValue('JOURNAL V558');

  const edit=note.locator('[data-j420-note-edit]');
  await edit.scrollIntoViewIfNeeded();
  const editTop=await edit.evaluate(el=>el.getBoundingClientRect().top);
  await edit.click();
  await expect(dialog).toBeVisible();
  await page.setViewportSize({width:390,height:800});
  await dialog.locator('#closeTaskDialog').click();
  await expect(dialog).toBeHidden();
  await expect(edit).toBeFocused();
  const wideTop=await edit.evaluate(el=>el.getBoundingClientRect().top);
  expect(Math.abs(wideTop-editTop)).toBeLessThanOrEqual(45);
  await expect(note).toBeVisible();

  // A newer focus in the task page wins over the modal-close observer's
  // queued restoration when the close and subsequent action share a tick.
  await action.click();
  await expect(panel).toHaveClass(/open/);
  await page.locator('#closeDetail').evaluate(el=>{
    el.click();
    document.querySelector('#boardView [data-j420-search]').focus();
  });
  await page.evaluate(()=>new Promise(resolve=>
    requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(panel).not.toHaveClass(/open/);
  await expect(search).toBeFocused();
  await expect(note).toBeVisible();
  await expect(search).toHaveValue('JOURNAL V558');

  await page.setViewportSize({width:320,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))
    .toBeLessThanOrEqual(2);
});
