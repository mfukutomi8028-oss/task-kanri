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
  await expect(atelier.locator('.j420-project-note')).toBeVisible();
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
  const tray=page.locator('#todoView .j425-todo-focus .j425-todo-items');
  await tray.evaluate(root=>{
    for(let i=0;i<30;i++){
      const el=document.createElement('article');el.className='j425-todo-record';el.innerHTML='<label class="j425-todo-check"><input type="checkbox"></label><button class="j425-todo-record-title"><strong>備品管理システムのテストモジュール確認と完了履歴の表示確認</strong></button><span></span><div></div>';
      root.append(el);
    }
  });
  const rows=tray.locator('.j425-todo-record');await expect(rows).toHaveCount(30);
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
  await expect(board.locator('.j420-island').first()).toBeVisible();
  await expect(board.locator('.j420-project-note')).toBeVisible();
  await expect(board.locator('.board-column')).toHaveCount(0);
  expect(await board.locator('.j420-island').count()).toBeGreaterThanOrEqual(4);
  await expect(board.locator('[data-j420-new-task]')).toBeVisible();
});

test('JOURNAL timeline is a vertically dated chronicle rather than Classic grid',async ({page})=>{
  test.setTimeout(90000);await boot(page,1440);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  await page.locator('[data-task-layout="timeline"]').click();
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
  await page.locator('[data-j450-memo-find]').fill('見つからない文字');
  await expect(card).toBeVisible();
  await page.locator('[data-j450-memo-find]').fill('JOURNAL索引内検索');
  const item=page.locator('.j-memo-index-link-v383').filter({hasText:'JOURNAL索引内検索'});
  await expect(item).toBeVisible();
  await item.click();
  await expect(item).toHaveAttribute('aria-current','true');
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
  expect(new Date(start).getTime()).toBe(Number(chosen));
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
  expect(new Date(Number(options[0])).getHours()).toBe(8);
  expect(new Date(Number(options[1])).getHours()).toBe(13);
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
    String(new Date(date+'T10:30').getTime()));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth))
    .toBeLessThanOrEqual(2);
});

test('JOURNAL V473 desktop free-time strip opens the canonical draft at its tapped time',async({page})=>{
  test.setTimeout(90000);
  await boot(page,1366);await choose(page,'journal');
  await page.locator('#wbJournalDockV367 [data-journal-route="schedule"]').click();
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
    .toHaveValue(String(new Date(date+'T10:30').getTime()));
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
  await note.locator('[data-j491-task-return]').click();
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
