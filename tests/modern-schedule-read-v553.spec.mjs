import { test, expect } from '@playwright/test';

// No production account, no Firebase network, no Modern demo-store.
// All fixtures live in a unique local-only test room.
const ROOM='test-modern-schedule-v553';
async function boot(page,{chosen=true,flag=true}={}){
  await page.addInitScript(({room,chosen,flag})=>{
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId',room);
    localStorage.setItem('system-task-users:'+room,JSON.stringify(['佐藤','福冨']));
    if(chosen)localStorage.setItem('systemTaskUser','佐藤');
    localStorage.setItem('system-task-tasks:'+room,JSON.stringify([
      {id:'task1',title:'確認作業タスク',status:'未着手',assignee:'佐藤',revision:1}
    ]));
    localStorage.setItem('system-task-todos:'+room,JSON.stringify([]));
    const now=new Date(), day=(offset,hour,minute)=>{
      const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset,hour,minute);
      return d.toISOString();
    };
    const events=[
      {id:'before',title:'前日の夜',startAt:day(-1,23,40),endAt:day(0,0,30),
        assignee:'佐藤',category:'PC',location:'前日',relatedTaskId:'task1',revision:1},
      {id:'morning',title:'機器確認',startAt:day(0,8,15),endAt:day(0,9,0),
        assignee:'佐藤',category:'PC',location:'システム課',memo:'手順の確認',
        relatedTaskId:'task1',revision:2},
      {id:'afternoon',title:'打合せ',startAt:day(0,13,20),endAt:day(0,14,0),
        assignee:'福冨',category:'運用',location:'会議室B',
        memo:'<img src=x onerror=window.__injected=true>',
        relatedTaskId:'missing-task',revision:3},
      {id:'cross',title:'夜間作業',startAt:day(0,23,15),endAt:day(1,1,0),
        assignee:'佐藤',category:'PC',location:'サーバー室',revision:2},
      {id:'last',title:'7日目の予定',startAt:day(6,9,30),endAt:day(6,10,0),
        assignee:'佐藤',category:'運用',location:'事務室',revision:1},
      {id:'later',title:'8日目の予定',startAt:day(7,9,30),endAt:day(7,10,30),
        assignee:'福冨',category:'運用',location:'事務室',revision:1}
    ];
    localStorage.setItem('system-task-schedules:'+room,JSON.stringify(events));
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    window.WORK_BOARD_TEST=flag?{modernReadV553:true}:{};
  },{room:ROOM,chosen,flag});
  await page.route('https://www.gstatic.com/firebasejs/**',r=>r.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,r=>r.abort('blockedbyclient'));
  await page.goto('/?room='+ROOM+'&modernReadV553=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
}
const modern=page=>page.frameLocator('iframe[data-modern-schedule-v553]');

test('Ver.553 desktop reads Classic-local schedules and related-task names without a second owner',async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width:1366,height:768});
  await boot(page);
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','ready');
  await expect(frame.locator('#sourceV553')).toContainText('端末内保存');
  await expect(frame.locator('#sourceV553')).toContainText('ルーム：'+ROOM);
  await expect(frame.locator('#sourceV553')).toContainText('利用者：佐藤');
  const rows=frame.locator('#daysV553 [data-schedule-id]');
  await expect(rows).toHaveCount(3);
  expect(await rows.evaluateAll(nodes=>nodes.map(n=>n.dataset.scheduleId))).toEqual(['morning','afternoon','cross']);
  await expect(frame.locator('[data-schedule-id="morning"]')).toContainText('08:15');
  await expect(frame.locator('[data-schedule-id="morning"]')).toContainText('関連タスク：確認作業タスク');
  await expect(frame.locator('[data-schedule-id="morning"]')).toContainText('システム課');
  await expect(frame.locator('[data-schedule-id="afternoon"]')).toContainText('現在のタスク一覧で確認できません');
  await expect(frame.locator('[data-schedule-id="cross"]')).toContainText('終了：');
  await expect(frame.locator('#countV553')).toHaveText('表示 3件 / 期間内 3件');
  await expect(frame.locator('html')).toHaveAttribute('data-palette','ink');
  expect(await frame.locator('body').evaluate(node=>{
    const window=node.ownerDocument.defaultView;return Boolean(window.Demo||window.firebaseConfig);
  })).toBe(false);
  await expect(frame.locator('form,input[type=checkbox],button[data-action="schedule-edit"]')).toHaveCount(0);
  expect(await frame.locator('body').evaluate(node=>node.ownerDocument.documentElement.scrollWidth-node.ownerDocument.defaultView.innerWidth)).toBeLessThanOrEqual(1);
});

test('Ver.553 7-day navigation excludes the next boundary and calendar displays actual month',async({page})=>{
  test.setTimeout(90000);
  await boot(page);
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','ready');
  await frame.locator('[data-range-v553="week"]').click();
  await expect(frame.locator('#daysV553 [data-schedule-id="last"]')).toHaveCount(1);
  await expect(frame.locator('#daysV553 [data-schedule-id="later"]')).toHaveCount(0);
  await frame.locator('#nextV553').click();
  await expect(frame.locator('#daysV553 [data-schedule-id="later"]')).toHaveCount(1);
  await expect(frame.locator('#daysV553 [data-schedule-id="last"]')).toHaveCount(0);
  await frame.locator('#prevV553').click();
  await expect(frame.locator('#daysV553 [data-schedule-id="last"]')).toHaveCount(1);
  await frame.locator('[data-mode-v553="calendar"]').click();
  await expect(frame.locator('#calendarV553')).toBeVisible();
  await expect(frame.locator('#listV553')).toBeHidden();
  await expect(frame.locator('[data-mode-v553="calendar"]')).toHaveAttribute('aria-pressed','true');
  const today=await page.evaluate(()=>window.WorkBoardReadV550.read().todayISO);
  await expect(frame.locator('.calendar-day[data-date="'+today+'"]')).toContainText('機器確認');
  await expect(frame.locator('.calendar-day[data-date="'+today+'"]')).toContainText('打合せ');
  await expect(frame.locator('.calendar-day[data-date="'+today+'"]')).toContainText('夜間作業');
  await frame.locator('[data-mode-v553="list"]').click();
  await expect(frame.locator('#listV553')).toBeVisible();
  await expect(frame.locator('#calendarV553')).toBeHidden();
});

test('Ver.553 mobile filters real notes/location/assignee, escapes text and never saves',async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width:390,height:844});
  await boot(page);
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','ready');
  const before=await page.evaluate(room=>({
    tasks:localStorage.getItem('system-task-tasks:'+room),
    schedules:localStorage.getItem('system-task-schedules:'+room),
    todos:localStorage.getItem('system-task-todos:'+room)
  }),ROOM);
  await expect(frame.locator('#daysV553 img')).toHaveCount(0);
  await expect(frame.locator('[data-schedule-id="afternoon"]')).toContainText('<img src=x onerror=window.__injected=true>');
  expect(await frame.locator('body').evaluate(node=>node.ownerDocument.defaultView.__injected)).toBeUndefined();
  await frame.locator('#searchV553').fill('会議室B');
  await expect(frame.locator('#daysV553 [data-schedule-id]')).toHaveCount(1);
  await expect(frame.locator('[data-schedule-id="afternoon"]')).toBeVisible();
  await frame.locator('#searchV553').fill('');
  await frame.locator('#assigneeV553').selectOption('福冨');
  await expect(frame.locator('#daysV553 [data-schedule-id]')).toHaveCount(1);
  await frame.locator('#assigneeV553').selectOption('');
  await frame.locator('#categoryV553').selectOption('PC');
  await expect(frame.locator('#daysV553 [data-schedule-id]')).toHaveCount(2);
  await frame.locator('#categoryV553').selectOption('');
  await frame.locator('#refreshV553').click();
  await expect(frame.locator('#daysV553 [data-schedule-id]')).toHaveCount(3);
  expect(await frame.locator('body').evaluate(node=>node.ownerDocument.documentElement.scrollWidth-node.ownerDocument.defaultView.innerWidth)).toBeLessThanOrEqual(1);
  const after=await page.evaluate(room=>({
    tasks:localStorage.getItem('system-task-tasks:'+room),
    schedules:localStorage.getItem('system-task-schedules:'+room),
    todos:localStorage.getItem('system-task-todos:'+room)
  }),ROOM);
  expect(after).toEqual(before);
  await frame.locator('#closeV553').click();
  await expect(page.locator('iframe[data-modern-schedule-v553]')).toHaveCount(0);
});

test('Ver.553 user switch refreshes owner provenance but keeps shared schedules',async({page})=>{
  test.setTimeout(90000);
  await boot(page);
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','ready');
  await expect(frame.locator('#sourceV553')).toContainText('利用者：佐藤');
  await page.evaluate(()=>{
    const sel=document.getElementById('currentUserSelect');
    sel.value='福冨';sel.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect.poll(async()=>page.evaluate(()=>window.WorkBoardReadV550.read().selectedUser)).toBe('福冨');
  await expect(frame.locator('#sourceV553')).toContainText('利用者：福冨');
  await expect(frame.locator('#daysV553 [data-schedule-id]')).toHaveCount(3);
  await expect(frame.locator('[data-schedule-id="morning"]')).toContainText('機器確認');
});

test('Ver.553 unselected profile, missing opt-in and direct URL never expose schedules',async({page})=>{
  test.setTimeout(90000);
  await boot(page,{flag:false});
  await expect(page.locator('iframe[data-modern-schedule-v553]')).toHaveCount(0);
  await page.goto('/modern/product/schedule-list-read-v553.html');
  await expect(page.locator('body')).toHaveAttribute('data-read-state','unavailable');
  await expect(page.locator('#daysV553 [data-schedule-id]')).toHaveCount(0);
  await expect(page.locator('#calendarDaysV553 [data-schedule-id]')).toHaveCount(0);
  await boot(page,{chosen:false,flag:true});
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','unavailable');
  await expect(frame.locator('#sourceV553')).toContainText('クラシックで利用者を選択');
  await expect(frame.locator('#daysV553 [data-schedule-id]')).toHaveCount(0);
});
