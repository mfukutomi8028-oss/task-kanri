import { test, expect } from '@playwright/test';

const ROOM='test-modern-todo-v552';
async function boot(page, { chosen=true, flag=true }={}) {
  await page.addInitScript(({ room, chosen, flag }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId',room);
    localStorage.setItem('system-task-users:'+room,JSON.stringify(['佐藤','福冨']));
    if(chosen) localStorage.setItem('systemTaskUser','佐藤');
    localStorage.setItem('system-task-tasks:'+room,JSON.stringify([]));
    localStorage.setItem('system-task-schedules:'+room,JSON.stringify([]));
    const now=new Date();
    const doneToday=new Date(now.getFullYear(),now.getMonth(),now.getDate(),11,45).getTime();
    const doneYesterday=new Date(now.getFullYear(),now.getMonth(),now.getDate()-1,13,20).getTime();
    const doneOld=new Date(now.getFullYear(),now.getMonth(),now.getDate()-40,8,50).getTime();
    const row=(id, owner, text, memo, order, completed=false,completedAt=0)=>({
      id,owner,text,memo,order,completed,completedAt,
      createdAt:100000+order,updatedAt:100001+order,revision:2
    });
    localStorage.setItem('system-task-todos:'+room,JSON.stringify([
      row('a','佐藤','未完了：後','詳細メモ',20),
      row('b','佐藤','未完了：先','改行あり\n手順の確認',-10),
      row('done-late','佐藤','本日完了：後','確認した内容',8,true,doneToday),
      row('done-first','佐藤','本日完了：先','当日完了の情報',-4,true,doneToday),
      row('old','佐藤','昔の完了','1か月以上前の履歴メモ',7,true,doneOld),
      row('yesterday','佐藤','昨日完了','<img src=x onerror=window.__injected=true>',4,true,doneYesterday),
      row('missing-time','佐藤','完了日時なし','内容が残る',6,true,0),
      row('other','福冨','別の利用者の完了','他人用の個人メモ',-100,true,doneYesterday)
    ]));
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    window.WORK_BOARD_TEST=flag?{modernReadV552:true}:{};
  },{room:ROOM,chosen,flag});
  await page.route('https://www.gstatic.com/firebasejs/**',route=>route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,route=>route.abort('blockedbyclient'));
  await page.goto('/?room='+ROOM+'&modernReadV552=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
}
const modern=page=>page.frameLocator('iframe[data-modern-todo-v552]');

test('Ver.552 desktop shows owner-scoped canonical open/today/history segments in Modern view',async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width:1366,height:768});
  await boot(page);
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','ready');
  await expect(frame.locator('#sourceV552')).toContainText('利用者：佐藤');
  await expect(frame.locator('#sourceV552')).toContainText('端末内保存');
  await expect(frame.locator('#openRowsV552 [data-todo-id]')).toHaveCount(2);
  await expect(frame.locator('#todayRowsV552 [data-todo-id]')).toHaveCount(2);
  await expect(frame.locator('#historyRowsV552 [data-todo-id]')).toHaveCount(3);
  expect(await frame.locator('#openRowsV552 [data-todo-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.todoId))).toEqual(['b','a']);
  expect(await frame.locator('#todayRowsV552 [data-todo-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.todoId))).toEqual(['done-first','done-late']);
  expect(await frame.locator('#historyRowsV552 [data-todo-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.todoId))).toEqual(['yesterday','old','missing-time']);
  await expect(frame.locator('#countsV552')).toContainText('全 7件');
  await expect(frame.locator('#historyV552 summary')).toContainText('過去に完了したToDo（3）');
  await frame.locator('#historyV552 summary').click();
  await expect(frame.locator('#historyRowsV552 [data-todo-id="old"]')).toContainText('1か月以上前の履歴メモ');
  await expect(frame.locator('#historyRowsV552 [data-todo-id="missing-time"]')).toContainText('完了日時不明');
  await expect(frame.locator('html')).toHaveAttribute('data-palette','ink');
  expect(await frame.locator('body').evaluate(body=>Boolean(body.ownerDocument.defaultView.Demo||body.ownerDocument.defaultView.firebaseConfig))).toBe(false);
  await expect(frame.locator('button[data-action],input[type=checkbox],form')).toHaveCount(0);
  expect(await frame.locator('body').evaluate(body=>body.ownerDocument.documentElement.scrollWidth-body.ownerDocument.defaultView.innerWidth)).toBeLessThanOrEqual(1);
});

test('Ver.552 mobile searches memo/history, escapes hostile input and never touches canonical storage',async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width:390,height:844});
  await boot(page);
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','ready');
  const before=await page.evaluate(room=>({
    todos:localStorage.getItem('system-task-todos:'+room),
    tasks:localStorage.getItem('system-task-tasks:'+room),
    schedules:localStorage.getItem('system-task-schedules:'+room)
  }),ROOM);
  await frame.locator('#historyV552 summary').click();
  await expect(frame.locator('#historyRowsV552 img')).toHaveCount(0);
  await expect(frame.locator('[data-todo-id="yesterday"]')).toContainText('<img src=x onerror=window.__injected=true>');
  expect(await frame.locator('body').evaluate(body=>body.ownerDocument.defaultView.__injected)).toBeUndefined();
  await frame.locator('#todoSearchV552').fill('1か月以上前');
  await expect(frame.locator('#openRowsV552 [data-todo-id]')).toHaveCount(0);
  await expect(frame.locator('#todayRowsV552 [data-todo-id]')).toHaveCount(0);
  await expect(frame.locator('#historyRowsV552 [data-todo-id]')).toHaveCount(1);
  await expect(frame.locator('#historyRowsV552 [data-todo-id]')).toHaveAttribute('data-todo-id','old');
  await frame.locator('#todoSearchV552').fill('');
  await expect(frame.locator('#historyRowsV552 [data-todo-id]')).toHaveCount(3);
  expect(await frame.locator('body').evaluate(body=>body.ownerDocument.documentElement.scrollWidth-body.ownerDocument.defaultView.innerWidth)).toBeLessThanOrEqual(1);
  const after=await page.evaluate(room=>({
    todos:localStorage.getItem('system-task-todos:'+room),
    tasks:localStorage.getItem('system-task-tasks:'+room),
    schedules:localStorage.getItem('system-task-schedules:'+room)
  }),ROOM);
  expect(after).toEqual(before);
  await frame.locator('#closeV552').click();
  await expect(page.locator('iframe[data-modern-todo-v552]')).toHaveCount(0);
  await expect(page.locator('#currentUserSelect')).toHaveValue('佐藤');
});

test('Ver.552 switches user without a manual refresh and removes previous personal data',async({page})=>{
  test.setTimeout(90000);
  await boot(page);
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','ready');
  await expect(frame.locator('#openRowsV552 [data-todo-id]')).toHaveCount(2);
  await page.evaluate(()=>{
    const select=document.getElementById('currentUserSelect');
    select.value='福冨';
    select.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect.poll(async()=>page.evaluate(()=>window.WorkBoardReadV550.read().selectedUser)).toBe('福冨');
  await expect(frame.locator('#sourceV552')).toContainText('利用者：福冨');
  await expect(frame.locator('#openRowsV552 [data-todo-id]')).toHaveCount(0);
  await expect(frame.locator('#todayRowsV552 [data-todo-id]')).toHaveCount(0);
  await expect(frame.locator('#historyRowsV552 [data-todo-id]')).toHaveCount(1);
  await expect(frame.locator('#historyRowsV552 [data-todo-id]')).toHaveAttribute('data-todo-id','other');
  await expect(frame.locator('#main')).not.toContainText('1か月以上前の履歴メモ');
  await expect(frame.locator('#main')).not.toContainText('未完了：先');
  await page.evaluate(()=>{
    const select=document.getElementById('currentUserSelect');
    select.value='佐藤';
    select.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect(frame.locator('#sourceV552')).toContainText('利用者：佐藤');
  await expect(frame.locator('#historyRowsV552 [data-todo-id]')).toHaveCount(3);
  await expect(frame.locator('#main')).not.toContainText('他人用の個人メモ');
});

test('Ver.552 refuses direct URL and missing opt-in, exposing no cached ToDo records',async({page})=>{
  test.setTimeout(90000);
  await boot(page,{flag:false});
  await expect(page.locator('iframe[data-modern-todo-v552]')).toHaveCount(0);
  await page.goto('/modern/product/todo-list-read-v552.html');
  await expect(page.locator('body')).toHaveAttribute('data-read-state','unavailable');
  await expect(page.locator('#openRowsV552 [data-todo-id]')).toHaveCount(0);
  await expect(page.locator('#historyRowsV552 [data-todo-id]')).toHaveCount(0);
  await expect(page.locator('#sourceV552')).toContainText('localhost');
});

test('Ver.552 refuses to show local caches when the user is not selected',async({page})=>{
  test.setTimeout(90000);
  await boot(page,{chosen:false});
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','unavailable');
  await expect(frame.locator('#sourceV552')).toContainText('利用者が選択されていません');
  await expect(frame.locator('#openRowsV552 [data-todo-id]')).toHaveCount(0);
  await expect(frame.locator('#todayRowsV552 [data-todo-id]')).toHaveCount(0);
  await expect(frame.locator('#historyRowsV552 [data-todo-id]')).toHaveCount(0);
});
