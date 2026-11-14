import { test, expect } from '@playwright/test';

// Exercise the shipped JOURNAL CSS against rendered Chromium geometry.
// Keep the room and task data synthetic, entirely within localhost.
test.use({ timezoneId: 'Asia/Tokyo' });
const ROOM = 'journal-visual-touch-v590';

async function boot(page, width) {
  await page.setViewportSize({width, height:900});
  await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4173'
    ? route.continue() : route.abort('blockedbyclient'));
  await page.addInitScript(({room})=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null;},set(){}});
    localStorage.setItem('systemTaskRoomId',room);
    localStorage.setItem('systemTaskUser','JournalTester');
    localStorage.setItem('system-task-users:'+room,JSON.stringify(['JournalTester']));
    const now=Date.now();
    const task={id:'j590-touch-task',title:'端末の長いタスク件名を実画面で確認する',status:'未着手',
      assignee:'JournalTester',priority:'高',createdAt:now,updatedAt:now,revision:1};
    localStorage.setItem('system-task-tasks:'+room,JSON.stringify([task]));
  },{room:ROOM});
  await page.goto('/?room='+ROOM,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="journal"]').evaluate(el=>el.click());
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','journal');
  await page.waitForFunction(()=>Boolean(document.querySelector('link[data-workboard-style="journal-display-v367.css"][data-loaded="true"]')),undefined,{timeout:30000});
  await expect(page.locator('.wb-journal-tabs-v367 [data-journal-route]')).toHaveCount(5);
}

async function route(page,width,name) {
  const root = width<=860?'#wbJournalDockV367':'.wb-journal-tabs-v367';
  await page.locator(root+' [data-journal-route="'+name+'"]').click();
}

async function geometryOf(locator) {
  return locator.evaluate(el=>{
    const r=el.getBoundingClientRect();
    return {width:r.width,height:r.height,visible:r.width>0&&r.height>0,
      text:getComputedStyle(el).fontSize};
  });
}

function atLeast44(geometry, label) {
  expect(geometry.visible,label+' should be rendered').toBe(true);
  expect(geometry.width,label+' width').toBeGreaterThanOrEqual(43.5);
  expect(geometry.height,label+' height').toBeGreaterThanOrEqual(43.5);
}

for (const width of [320,390,1366]) {
  test('JOURNAL V590 task, ToDo and memo touch actions fit at '+width+'px', async({page})=>{
    test.setTimeout(90000);
    await boot(page,width);

    await route(page,width,'tasks');
    await page.locator('#boardView [data-j420-layout="list"]').click();
    const star=page.locator('#listView .j425-index-record .j425-list-star').first();
    await expect(star).toBeVisible();
    atLeast44(await geometryOf(star),'task favorite');
    const starBounds=await star.evaluate(el=>{
      const a=el.getBoundingClientRect(),b=el.closest('.j425-index-record').getBoundingClientRect();
      return {left:a.left,right:a.right,parentLeft:b.left,parentRight:b.right};
    });
    expect(starBounds.left).toBeGreaterThanOrEqual(starBounds.parentLeft-1);
    expect(starBounds.right).toBeLessThanOrEqual(starBounds.parentRight+1);
    await star.focus();
    await expect(star).toBeFocused();

    await route(page,width,'todos');
    await page.locator('#todoView #todayTodoInput').fill('検証用ToDo');
    await page.locator('#todoView [data-j425-todo-create] button[type="submit"]').click();
    const arrows=page.locator('#todoView .j425-todo-record-move button');
    await expect(arrows.first()).toBeVisible();
    const arrowSizes=await arrows.evaluateAll(elements=>elements
      .filter(el=>el.getBoundingClientRect().width>0)
      .map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
    expect(arrowSizes.length).toBeGreaterThan(0);
    for (const size of arrowSizes) atLeast44({...size,visible:true},'ToDo movement');

    await route(page,width,'memo');
    await page.locator('#workMemoViewV167 [data-memo-new]').first().click();
    const dialog=page.locator('#workMemoDialogV167');
    await expect(dialog).toBeVisible();
    await dialog.locator('#workMemoTitleV167').fill('検証用の紙面メモ');
    await dialog.locator('#workMemoBodyV167').fill('メモの文字とボタンの幅を確認するための文章。');
    await dialog.locator('#workMemoFormV167 button[type="submit"]').click();
    await expect(dialog).toBeHidden();
    const card=page.locator('#workMemoViewV167 .work-memo-card-v167').filter({hasText:'検証用の紙面メモ'});
    await expect(card).toBeVisible();
    const buttons=card.locator('.work-memo-actions-v167 button');
    await expect(buttons.first()).toBeVisible();
    const sizes=await buttons.evaluateAll(elements=>elements.filter(el=>el.getBoundingClientRect().width>0)
      .map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
    expect(sizes.length).toBeGreaterThan(0);
    for(const size of sizes) atLeast44({...size,visible:true},'memo card action');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  });
}
