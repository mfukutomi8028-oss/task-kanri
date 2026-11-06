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
});


test('JOURNAL ToDo records have accessible controls and appear in grouped trays',async({page})=>{
  test.setTimeout(90000);await boot(page,1366);await choose(page,'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="todos"]').click();
  await expect(page.locator('#todoView .j425-todo-layout')).toBeVisible();
  await expect(page.locator('#todoView .j425-todo-tray')).toHaveCount(3);
  await page.locator('#todayTodoInput').fill('今日のチェック確認');
  await page.locator('[data-j425-todo-create] button[type="submit"]').click();
  const row=page.locator('.j425-todo-record').filter({hasText:'今日のチェック確認'});
  await expect(row).toBeVisible();
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
    await expect.poll(async()=>index.evaluate(el=>getComputedStyle(el).transform))
      .not.toBe('none');
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
