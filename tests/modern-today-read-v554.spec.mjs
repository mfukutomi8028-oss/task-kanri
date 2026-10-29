import { test, expect } from '@playwright/test';

const ROOM='test-modern-today-v554';
async function boot(page,{chosen=true,flag=true,empty=false}={}){
  await page.addInitScript(({room,chosen,flag,empty})=>{
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId',room);
    localStorage.setItem('system-task-users:'+room,JSON.stringify(['佐藤','福冨']));
    if(chosen)localStorage.setItem('systemTaskUser','佐藤');
    const now=new Date();
    const iso=offset=>{
      const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset);
      return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
    };
    const at=(offset,hour,minute=0)=>new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset,hour,minute).toISOString();
    const tasks=empty?[]:[
      {id:'late',title:'期限超過の確認',status:'対応中',assignee:'佐藤',category:'PC',
        dueDate:iso(-1),dueTime:'10:00',priority:'高',pinned:false,revision:3},
      {id:'holdLate',title:'保留中の期限超過',status:'保留',assignee:'福冨',category:'PC',
        dueDate:iso(-2),priority:'低',revision:1},
      {id:'dueToday',title:'今日の印刷確認',status:'未着手',assignee:'佐藤',category:'プリンタ',
        dueDate:iso(0),priority:'中',revision:2},
      {id:'holdToday',title:'保留中の今日締切',status:'保留',assignee:'福冨',
        dueDate:iso(0),category:'PC',priority:'低',revision:1},
      {id:'complete',title:'過去に完了',status:'完了',assignee:'佐藤',
        dueDate:iso(-3),priority:'中',revision:1},
      {id:'future',title:'後日の作業',status:'未着手',assignee:'福冨',
        dueDate:iso(1),priority:'中',revision:1}
    ];
    const todos=empty?[]:[
      {id:'open2',owner:'佐藤',text:'自分のToDo後',memo:'手順書を確認',order:7,completed:false,revision:2},
      {id:'open1',owner:'佐藤',text:'自分のToDo先',memo:'<img src=x onerror=window.__injected=true>',order:-3,completed:false,revision:1},
      {id:'done',owner:'佐藤',text:'本日完了',completed:true,order:0,
        completedAt:new Date(now.getFullYear(),now.getMonth(),now.getDate(),11,30).getTime(),revision:2},
      {id:'history',owner:'佐藤',text:'過去完了',completed:true,order:0,
        completedAt:new Date(now.getFullYear(),now.getMonth(),now.getDate()-10,11,30).getTime(),revision:1},
      {id:'other',owner:'福冨',text:'別利用者の個人ToDo',memo:'他の利用者の非公開メモ',
        completed:false,order:-10,revision:1}
    ];
    const schedules=empty?[]:[
      {id:'previous',title:'前日夜の予定',startAt:at(-1,23,30),endAt:at(0,1,0),
        assignee:'佐藤',location:'会議室',category:'運用',relatedTaskId:'late',revision:1},
      {id:'morning',title:'今朝の打合せ',startAt:at(0,8,20),endAt:at(0,9,0),
        assignee:'佐藤',location:'システム課',category:'運用',relatedTaskId:'late',revision:1},
      {id:'cross',title:'夜間点検',startAt:at(0,23,10),endAt:at(1,1,0),
        assignee:'福冨',location:'サーバー室',category:'PC',revision:2},
      {id:'tomorrow',title:'明日の予定',startAt:at(1,10,0),endAt:at(1,11,0),
        assignee:'佐藤',location:'会議室',category:'運用',revision:1}
    ];
    localStorage.setItem('system-task-tasks:'+room,JSON.stringify(tasks));
    localStorage.setItem('system-task-todos:'+room,JSON.stringify(todos));
    localStorage.setItem('system-task-schedules:'+room,JSON.stringify(schedules));
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null;},set(){}});
    window.WORK_BOARD_TEST=flag?{modernReadV554:true}:{};
  },{room:ROOM,chosen,flag,empty});
  await page.route('https://www.gstatic.com/firebasejs/**',route=>route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,route=>route.abort('blockedbyclient'));
  await page.goto('/?room='+ROOM+'&modernReadV554=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
}
const modern=page=>page.frameLocator('iframe[data-modern-today-v554]');

test('Ver.554 desktop integrates Classic counts and hold-excluding actionable rows without mock notices',async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width:1366,height:768});
  await boot(page);
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','ready');
  await expect(frame.locator('#sourceV554')).toContainText('ルーム：'+ROOM);
  await expect(frame.locator('#sourceV554')).toContainText('利用者：佐藤');
  await expect(frame.locator('#sourceV554')).toContainText('端末内保存');
  await expect(frame.locator('#statOpenV554')).toHaveText('5');
  await expect(frame.locator('#statOverdueV554')).toHaveText('2');
  await expect(frame.locator('#statTodayV554')).toHaveText('2');
  await expect(frame.locator('#overdueCountV554')).toHaveText('1');
  await expect(frame.locator('#todayTaskCountV554')).toHaveText('1');
  await expect(frame.locator('#overdueRowsV554 [data-task-id]')).toHaveCount(1);
  await expect(frame.locator('#overdueRowsV554 [data-task-id="late"]')).toContainText('期限超過の確認');
  await expect(frame.locator('#todayTaskRowsV554 [data-task-id="dueToday"]')).toContainText('今日の印刷確認');
  await expect(frame.locator('#dataV554')).not.toContainText('保留中の期限超過');
  await expect(frame.locator('#todoOpenCountV554')).toHaveText('2');
  await expect(frame.locator('#todoDoneV554')).toHaveText('本日完了 1件');
  await expect(frame.locator('#scheduleCountV554')).toHaveText('2');
  await expect(frame.locator('#scheduleRowsV554 [data-schedule-id]')).toHaveCount(2);
  await expect(frame.locator('#scheduleRowsV554 [data-schedule-id="morning"]')).toContainText('08:20');
  await expect(frame.locator('#scheduleRowsV554 [data-schedule-id="cross"]')).toContainText('夜間点検');
  await expect(frame.locator('.notice-panel')).toContainText('未接続');
  await expect(frame.locator('html')).toHaveAttribute('data-palette','ink');
  expect(await frame.locator('body').evaluate(node=>Boolean(
    node.ownerDocument.defaultView.Demo||node.ownerDocument.defaultView.firebaseConfig))).toBe(false);
  await expect(frame.locator('input,form,button[data-task-id],button[data-todo-id]')).toHaveCount(0);
  expect(await frame.locator('body').evaluate(node=>
    node.ownerDocument.documentElement.scrollWidth-node.ownerDocument.defaultView.innerWidth
  )).toBeLessThanOrEqual(1);
});

test('Ver.554 mobile safely renders hostile personal text and never alters local business records',async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width:390,height:844});
  await boot(page);
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','ready');
  const before=await page.evaluate(room=>({
    tasks:localStorage.getItem('system-task-tasks:'+room),
    todos:localStorage.getItem('system-task-todos:'+room),
    schedules:localStorage.getItem('system-task-schedules:'+room)
  }),ROOM);
  await expect(frame.locator('#todoRowsV554 [data-todo-id]')).toHaveCount(2);
  expect(await frame.locator('#todoRowsV554 [data-todo-id]').evaluateAll(nodes=>
    nodes.map(n=>n.dataset.todoId))).toEqual(['open1','open2']);
  await expect(frame.locator('#todoRowsV554')).toContainText('<img src=x onerror=window.__injected=true>');
  await expect(frame.locator('#todoRowsV554 img')).toHaveCount(0);
  expect(await frame.locator('body').evaluate(node=>node.ownerDocument.defaultView.__injected)).toBeUndefined();
  expect(await frame.locator('body').evaluate(node=>
    node.ownerDocument.documentElement.scrollWidth-node.ownerDocument.defaultView.innerWidth
  )).toBeLessThanOrEqual(1);
  await frame.locator('#refreshV554').click();
  await expect(frame.locator('#overdueRowsV554 [data-task-id]')).toHaveCount(1);
  const after=await page.evaluate(room=>({
    tasks:localStorage.getItem('system-task-tasks:'+room),
    todos:localStorage.getItem('system-task-todos:'+room),
    schedules:localStorage.getItem('system-task-schedules:'+room)
  }),ROOM);
  expect(after).toEqual(before);
  await frame.locator('#closeV554').click();
  await expect(page.locator('iframe[data-modern-today-v554]')).toHaveCount(0);
  await expect(page.locator('#currentUserSelect')).toHaveValue('佐藤');
});

test('Ver.554 selected-user changes immediately replace personal ToDo while tasks/schedules stay shared',async({page})=>{
  test.setTimeout(90000);
  await boot(page);
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','ready');
  await expect(frame.locator('#todoOwnerV554')).toContainText('佐藤');
  await page.evaluate(()=>{
    const select=document.getElementById('currentUserSelect');
    select.value='福冨';
    select.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect.poll(async()=>page.evaluate(()=>window.WorkBoardReadV550.read().selectedUser)).toBe('福冨');
  await expect(frame.locator('#sourceV554')).toContainText('利用者：福冨');
  await expect(frame.locator('#todoRowsV554 [data-todo-id]')).toHaveCount(1);
  await expect(frame.locator('#todoRowsV554 [data-todo-id]')).toHaveAttribute('data-todo-id','other');
  await expect(frame.locator('#dataV554')).not.toContainText('自分のToDo先');
  await expect(frame.locator('#dataV554')).not.toContainText('手順書を確認');
  await expect(frame.locator('#dataV554')).toContainText('他の利用者の非公開メモ');
  await expect(frame.locator('#overdueRowsV554 [data-task-id]')).toHaveCount(1);
  await expect(frame.locator('#scheduleRowsV554 [data-schedule-id]')).toHaveCount(2);
  await page.evaluate(()=>{
    const select=document.getElementById('currentUserSelect');
    select.value='佐藤';
    select.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect(frame.locator('#sourceV554')).toContainText('利用者：佐藤');
  await expect(frame.locator('#todoRowsV554 [data-todo-id]')).toHaveCount(2);
  await expect(frame.locator('#dataV554')).not.toContainText('他の利用者の非公開メモ');
});

test('Ver.554 empty canonical records show true zero summary without fake daily announcements',async({page})=>{
  test.setTimeout(90000);
  await boot(page,{empty:true});
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','ready');
  for(const id of ['statOpenV554','statOverdueV554','statTodayV554','statMineV554',
    'overdueCountV554','todayTaskCountV554','todoOpenCountV554','scheduleCountV554'])
    await expect(frame.locator('#'+id)).toHaveText('0');
  await expect(frame.locator('#overdueEmptyV554')).toBeVisible();
  await expect(frame.locator('#todayTaskEmptyV554')).toBeVisible();
  await expect(frame.locator('#todoEmptyV554')).toBeVisible();
  await expect(frame.locator('#scheduleEmptyV554')).toBeVisible();
  await expect(frame.locator('#todoProgressV554')).toHaveText('0 / 0件');
  await expect(frame.locator('#dataV554')).toContainText('お知らせ・業務メモ');
  await expect(frame.locator('.notice-panel')).not.toContainText('手順書の確認依頼が届いています');
});

test('Ver.554 rejects direct navigation and missing test opt-in',async({page})=>{
  test.setTimeout(90000);
  await boot(page,{flag:false});
  await expect(page.locator('iframe[data-modern-today-v554]')).toHaveCount(0);
  await page.goto('/modern/product/today-read-v554.html');
  await expect(page.locator('body')).toHaveAttribute('data-read-state','unavailable');
  await expect(page.locator('#dataV554')).toBeHidden();
  await expect(page.locator('#todoRowsV554 [data-todo-id]')).toHaveCount(0);
  await expect(page.locator('#overdueRowsV554 [data-task-id]')).toHaveCount(0);
  await expect(page.locator('#sourceV554')).toContainText('localhost');
});

test('Ver.554 rejects unselected user before exposing locally cached tasks and ToDo',async({page})=>{
  test.setTimeout(90000);
  await boot(page,{chosen:false});
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','unavailable');
  await expect(frame.locator('#sourceV554')).toContainText('クラシックで利用者を選択');
  await expect(frame.locator('#dataV554')).toBeHidden();
  await expect(frame.locator('#todoRowsV554 [data-todo-id]')).toHaveCount(0);
  await expect(frame.locator('#scheduleRowsV554 [data-schedule-id]')).toHaveCount(0);
});
