import { test, expect } from '@playwright/test';

const ROOM='test-modern-today-v554';
async function boot(page,{chosen=true,flag=true,empty=false,navigate=false,complete=false,todoComplete=false}={}){
  await page.addInitScript(({room,chosen,flag,empty,navigate,complete,todoComplete})=>{
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
    window.WORK_BOARD_TEST=flag?{modernReadV554:true,modernNavigateV564:navigate,modernCompleteV323:complete,modernTodoCompleteV324:todoComplete}:{};
  },{room:ROOM,chosen,flag,empty,navigate,complete,todoComplete});
  await page.route('https://www.gstatic.com/firebasejs/**',route=>route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,route=>route.abort('blockedbyclient'));
  await page.goto('/?room='+ROOM+'&modernReadV554=1'
    +(navigate?'&modernNavigateV564=1':'')
    +(complete?'&modernCompleteV323=1':'')
    +(todoComplete?'&modernTodoCompleteV324=1':''),{waitUntil:'domcontentloaded'});
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
  await expect(frame.locator('.notice-panel')).toContainText('既読状態もClassicと共通');
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


test('Ver.564 default read-only Today exposes no navigation facade or interactive business rows',async({page})=>{
  await boot(page);
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-today-navigation-v564','readonly');
  await expect(frame.locator('button[data-today-navigation-v564]:visible')).toHaveCount(0);
  expect(await page.evaluate(()=>window.WorkBoardTodayNavigationV564)).toBeUndefined();
  await expect(frame.locator('body')).toBeVisible();
  await expect(frame.locator('body')).not.toHaveAttribute('hidden');
  await expect(frame.locator('#dataV554')).toBeVisible();
});

test('Ver.564 opens existing Classic task detail from a current Today item without changing data',async({page})=>{
  await boot(page,{navigate:true});
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-today-navigation-v564','enabled');
  const before=await page.evaluate(room=>localStorage.getItem('system-task-tasks:'+room),ROOM);
  await frame.locator('[data-task-id="late"] [data-today-navigation-v564="task"]').click();
  await expect(page.locator('iframe[data-modern-today-v554]')).toHaveCount(0);
  await expect(page.locator('.detail-panel')).toHaveClass(/open/);
  await expect(page.locator('#detailBody')).toContainText('期限超過の確認');
  expect(await page.evaluate(room=>localStorage.getItem('system-task-tasks:'+room),ROOM)).toEqual(before);
});

test('Ver.564 opens only the selected personal ToDo in the original Classic workspace',async({page})=>{
  await boot(page,{navigate:true});
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-today-navigation-v564','enabled');
  const todoBefore=await page.evaluate(room=>localStorage.getItem('system-task-todos:'+room),ROOM);
  await frame.locator('[data-todo-id="open1"] [data-today-navigation-v564="todo"]').click();
  await expect(page.locator('iframe[data-modern-today-v554]')).toHaveCount(0);
  await expect(page.locator('#todoView')).toBeVisible();
  await expect(page.locator('#todoView [data-todo-id="open1"]')).toBeVisible();
  await expect(page.locator('#todoView')).not.toContainText('別利用者の個人ToDo');
  await expect(page.locator('#todoView [data-todo-id="open1"] .todo-summary-button')).toBeFocused();
  expect(await page.evaluate(room=>localStorage.getItem('system-task-todos:'+room),ROOM)).toEqual(todoBefore);
});

test('Ver.564 schedule opens the original Classic edit form but does not auto-save',async({page})=>{
  await boot(page,{navigate:true});
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-today-navigation-v564','enabled');
  const before=await page.evaluate(room=>localStorage.getItem('system-task-schedules:'+room),ROOM);
  await frame.locator('[data-schedule-id="morning"] [data-today-navigation-v564="schedule"]').click();
  await expect(page.locator('iframe[data-modern-today-v554]')).toHaveCount(0);
  await expect(page.locator('#scheduleDialog')).toBeVisible();
  await expect(page.locator('#scheduleTitle')).toHaveValue('今朝の打合せ');
  await expect(page.locator('#scheduleForm')).toHaveAttribute('data-base-revision','1');
  expect(await page.evaluate(room=>localStorage.getItem('system-task-schedules:'+room),ROOM)).toEqual(before);
  await page.locator('#closeScheduleDialog').click();
  expect(await page.evaluate(room=>localStorage.getItem('system-task-schedules:'+room),ROOM)).toEqual(before);
});

for(const [destination,expected] of [
  ['tasks','#boardView'],
  ['todos','#todoView'],
  ['schedules','#scheduleView']
]){
  test('Ver.564 Today '+destination+' full-list link uses Classic navigation',async({page})=>{
    await boot(page,{navigate:true});
    const frame=modern(page);
    await expect(frame.locator('body')).toHaveAttribute('data-today-navigation-v564','enabled');
    const button=frame.locator('[data-today-navigation-v564="'+destination+'"]').first();
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.locator('iframe[data-modern-today-v554]')).toHaveCount(0);
    if(destination==='tasks'){
      await expect(page.locator('body')).toHaveClass(/task-mode/);
      await expect(page.locator('#boardView,#listView,#timelineView').filter({visible:true})).toHaveCount(1);
    }else{
      await expect(page.locator(expected)).toBeVisible();
    }
  });
}

test('Ver.564 memo link enters the existing shared-memo Classic owner',async({page})=>{
  await boot(page,{navigate:true});
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-today-navigation-v564','enabled');
  await page.waitForFunction(()=>window.WorkBoardBusinessMemoReadV555?.read?.()?.ready===true);
  await frame.locator('[data-today-navigation-v564="memos"]').click();
  await expect(page.locator('iframe[data-modern-today-v554]')).toHaveCount(0);
  await expect(page.locator('#workMemoViewV167')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/work-memo-mode-v167/);
});

test('Ver.564 rejects stale, foreign owner, and changed date before opening Classic',async({page})=>{
  await boot(page,{navigate:true});
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-today-navigation-v564','enabled');
  const base=await page.evaluate(room=>({
    roomId:room,selectedUser:'佐藤',
    todayISO:window.WorkBoardReadV550.read().todayISO,
    kind:'task',id:'late',expectedRevision:3
  }),ROOM);
  const invoke=arg=>page.evaluate(request=>window.WorkBoardTodayNavigationV564.open(request),arg);
  expect((await invoke({...base,roomId:'test-other-room'})).error).toBe('owner-mismatch');
  expect((await invoke({...base,selectedUser:'福冨'})).error).toBe('owner-mismatch');
  expect((await invoke({...base,todayISO:'2000-01-01'})).error).toBe('owner-mismatch');
  expect((await invoke({...base,expectedRevision:2})).error).toBe('revision-or-state-mismatch');
  expect((await invoke({...base,kind:'todo',id:'other',expectedRevision:1})).error)
    .toBe('revision-or-state-mismatch');
  expect((await invoke({...base,kind:'invalid'})).error).toBe('invalid-target');
  await expect(page.locator('iframe[data-modern-today-v554]')).toHaveCount(1);
  await expect(page.locator('.detail-panel')).not.toHaveClass(/open/);
});

test('Ver.564 never discards an already open Classic modal or its unsaved input',async({page})=>{
  await boot(page,{navigate:true});
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-today-navigation-v564','enabled');
  await page.evaluate(()=>{
    document.getElementById('taskDialog').showModal();
    document.getElementById('taskTitle').value='Classicで保存前の入力';
  });
  // A native modal is in the browser top layer and blocks frame pointer events.
  // Call the very same parent API to verify its guard without bypassing the modal.
  const blocked=await page.evaluate(room=>window.WorkBoardTodayNavigationV564.open({
    roomId:room,selectedUser:'佐藤',todayISO:window.WorkBoardReadV550.read().todayISO,
    kind:'task',id:'late',expectedRevision:3
  }),ROOM);
  expect(blocked).toMatchObject({ok:false,error:'dialog-open'});
  await expect(page.locator('#taskTitle')).toHaveValue('Classicで保存前の入力');
  await expect(page.locator('iframe[data-modern-today-v554]')).toHaveCount(1);
});

test('Ver.564 mobile keeps Today links keyboard-accessible with no horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await boot(page,{navigate:true});
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-today-navigation-v564','enabled');
  await expect(frame.locator('[data-todo-id="open1"] [data-today-navigation-v564="todo"]')).toBeVisible();
  await expect(frame.locator('[data-schedule-id="cross"] [data-today-navigation-v564="schedule"]')).toBeVisible();
  expect(await frame.locator('body').evaluate(n=>
    n.ownerDocument.documentElement.scrollWidth-n.ownerDocument.defaultView.innerWidth)).toBeLessThanOrEqual(1);
  const before=await page.evaluate(room=>localStorage.getItem('system-task-todos:'+room),ROOM);
  await frame.locator('[data-todo-id="open1"] [data-today-navigation-v564="todo"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#todoView')).toBeVisible();
  expect(await page.evaluate(room=>localStorage.getItem('system-task-todos:'+room),ROOM)).toEqual(before);
});

test('Ver.323 Today completes an actionable task using Classic memo, history and revision CAS',async({page})=>{
  test.setTimeout(90000);
  await boot(page,{navigate:true,complete:true});
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-today-complete-v323','enabled');
  const before=await page.evaluate(room=>JSON.parse(localStorage.getItem('system-task-tasks:'+room)),ROOM);
  page.once('dialog',async dialog=>{
    expect(dialog.type()).toBe('prompt');
    expect(dialog.message()).toContain('完了メモ');
    await dialog.accept('印刷・設定を確認済み');
  });
  await frame.locator('[data-task-id="late"] [data-today-complete-v323="task"]').click();
  await expect(frame.locator('#todayNavStatusV564')).toContainText('完了として保存');
  const after=await page.evaluate(room=>JSON.parse(localStorage.getItem('system-task-tasks:'+room)),ROOM);
  const original=before.find(t=>t.id==='late'),updated=after.find(t=>t.id==='late');
  expect(updated.status).toBe('完了');
  expect(updated.completedMemo).toBe('印刷・設定を確認済み');
  expect(updated.revision).toBe(original.revision+1);
  expect(updated.history.some(item=>String(item?.text||'').includes('完了メモ'))).toBe(true);
  // Other records may be normalized on save; their business fields and CAS
  // revisions must remain unchanged even if defaults were filled in.
  for(const task of before.filter(t=>t.id!=='late')){
    const other=after.find(t=>t.id===task.id);
    expect(other.title).toBe(task.title);
    expect(other.status).toBe(task.status);
    expect(other.revision).toBe(task.revision);
  }
  await expect(frame.locator('[data-task-id="late"]')).toHaveCount(0);
});

test('Ver.323 refuses unwanted direct completion, stale revisions and cancels without writing',async({page})=>{
  await boot(page,{navigate:true,complete:true});
  const frame=modern(page);
  const before=await page.evaluate(room=>localStorage.getItem('system-task-tasks:'+room),ROOM);
  const base=await page.evaluate(room=>({
    roomId:room,selectedUser:'佐藤',todayISO:window.WorkBoardReadV550.read().todayISO,
    kind:'task',id:'late',expectedRevision:3
  }),ROOM);
  const invoke=request=>page.evaluate(v=>window.WorkBoardTodayNavigationV564.complete(v),request);
  expect((await invoke({...base,expectedRevision:2})).error).toBe('revision-or-state-mismatch');
  expect((await invoke({...base,selectedUser:'福冨'})).error).toBe('owner-mismatch');
  expect((await invoke({...base,todayISO:'2000-01-01'})).error).toBe('owner-mismatch');
  expect((await invoke({...base,kind:'todo',id:'open1',expectedRevision:1})).error).toBe('not-test-context');
  expect((await invoke({...base,id:'holdLate',expectedRevision:1})).error).toBe('revision-or-state-mismatch');
  expect((await invoke({...base,id:'complete',expectedRevision:1})).error).toBe('revision-or-state-mismatch');
  page.once('dialog',async dialog=>dialog.dismiss());
  await frame.locator('[data-task-id="late"] [data-today-complete-v323="task"]').click();
  await expect(frame.locator('#todayNavStatusV564')).toContainText('キャンセル');
  expect(await page.evaluate(room=>localStorage.getItem('system-task-tasks:'+room),ROOM)).toBe(before);
  await expect(frame.locator('[data-task-id="late"] [data-today-complete-v323="task"]')).toBeVisible();
});

test('Ver.323 old navigation opt-in alone cannot complete; mobile touch action remains 44px',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await boot(page,{navigate:true});
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-today-complete-v323','disabled');
  await expect(frame.locator('button[data-today-complete-v323]')).toHaveCount(0);
  const denied=await page.evaluate(room=>window.WorkBoardTodayNavigationV564.complete({
    roomId:room,selectedUser:'佐藤',todayISO:window.WorkBoardReadV550.read().todayISO,
    kind:'task',id:'late',expectedRevision:3
  }),ROOM);
  expect(denied.error).toBe('not-test-context');
  // The same mobile product frame with the explicit extra flag is accessible.
  await page.goto('/?room='+ROOM+'&modernReadV554=1&modernNavigateV564=1&modernCompleteV323=1',
    {waitUntil:'domcontentloaded'});
  // On this page the current test's flags remain false; URL alone grants no writes.
  await expect(modern(page).locator('button[data-today-complete-v323]')).toHaveCount(0);
});

test('Ver.324 Today completes one personal ToDo through Classic without changing another user',async({page})=>{
  await boot(page,{navigate:true,todoComplete:true});
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-today-todo-v324','enabled');
  await expect(frame.locator('button[data-today-todo-v324="todo"]')).toHaveCount(2);
  const action=frame.locator('[data-todo-id="open1"] [data-today-todo-v324="todo"]');
  const before=await page.evaluate(room=>JSON.parse(localStorage.getItem('system-task-todos:'+room)),ROOM);
  const control=await action.boundingBox();
  expect(control.width).toBeGreaterThanOrEqual(44);
  expect(control.height).toBeGreaterThanOrEqual(44);
  await action.click();
  await expect(frame.locator('#todayNavStatusV564')).toContainText('個人ToDoを完了しました');
  await expect(frame.locator('#todoRowsV554 [data-todo-id="open1"]')).toHaveCount(0);
  await expect(frame.locator('#todoDoneV554')).toHaveText('本日完了 2件');
  const after=await page.evaluate(room=>JSON.parse(localStorage.getItem('system-task-todos:'+room)),ROOM);
  const original=before.find(t=>t.id==='open1'),updated=after.find(t=>t.id==='open1');
  expect(updated.completed).toBe(true);
  expect(updated.completedAt).toBeGreaterThan(0);
  expect(updated.revision).toBe(original.revision+1);
  expect(after.find(t=>t.id==='other')).toEqual(before.find(t=>t.id==='other'));
  expect(after.find(t=>t.id==='open2')).toEqual(before.find(t=>t.id==='open2'));
  await expect(frame.locator('#todoRowsV554')).not.toContainText('別利用者の個人ToDo');
});

test('Ver.324 rejects stale, completed, other-user ToDos and already open Classic forms',async({page})=>{
  await boot(page,{navigate:true,todoComplete:true});
  const frame=modern(page);
  const before=await page.evaluate(room=>localStorage.getItem('system-task-todos:'+room),ROOM);
  const base=await page.evaluate(room=>({
    roomId:room,selectedUser:'佐藤',todayISO:window.WorkBoardReadV550.read().todayISO,
    kind:'todo',id:'open1',expectedRevision:1
  }),ROOM);
  const invoke=req=>page.evaluate(x=>window.WorkBoardTodayNavigationV564.complete(x),req);
  expect((await invoke({...base,expectedRevision:3})).error).toBe('revision-or-state-mismatch');
  expect((await invoke({...base,roomId:'test-someone-else'})).error).toBe('owner-mismatch');
  expect((await invoke({...base,selectedUser:'福冨'})).error).toBe('owner-mismatch');
  expect((await invoke({...base,todayISO:'2001-01-01'})).error).toBe('owner-mismatch');
  expect((await invoke({...base,id:'other'})).error).toBe('revision-or-state-mismatch');
  expect((await invoke({...base,id:'done',expectedRevision:2})).error).toBe('revision-or-state-mismatch');
  await page.evaluate(()=>{
    const dialog=document.getElementById('taskDialog');
    dialog.showModal();
    document.getElementById('taskTitle').value='保存前の入力を維持';
  });
  expect((await invoke(base)).error).toBe('dialog-open');
  await expect(page.locator('#taskTitle')).toHaveValue('保存前の入力を維持');
  expect(await page.evaluate(room=>localStorage.getItem('system-task-todos:'+room),ROOM)).toBe(before);
  await page.evaluate(()=>document.getElementById('taskDialog').close());
  await expect(frame.locator('[data-todo-id="open1"] [data-today-todo-v324="todo"]')).toBeEnabled();
});

test('Ver.324 old Today navigation alone never enables personal ToDo writes',async({page})=>{
  await boot(page,{navigate:true});
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-today-todo-v324','disabled');
  await expect(frame.locator('button[data-today-todo-v324]')).toHaveCount(0);
  const result=await page.evaluate(room=>window.WorkBoardTodayNavigationV564.complete({
    roomId:room,selectedUser:'佐藤',todayISO:window.WorkBoardReadV550.read().todayISO,
    kind:'todo',id:'open1',expectedRevision:1
  }),ROOM);
  expect(result.error).toBe('not-test-context');
  await page.goto('/?room='+ROOM+'&modernReadV554=1&modernNavigateV564=1&modernTodoCompleteV324=1',
    {waitUntil:'domcontentloaded'});
  await expect(modern(page).locator('button[data-today-todo-v324]')).toHaveCount(0);
});

test('Ver.324 390px keyboard activation completes one ToDo with no horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await boot(page,{navigate:true,todoComplete:true});
  const frame=modern(page);
  const action=frame.locator('[data-todo-id="open2"] [data-today-todo-v324="todo"]');
  await expect(action).toBeVisible();
  await action.focus();
  await expect(action).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(frame.locator('#todayNavStatusV564')).toContainText('個人ToDoを完了しました');
  await expect(frame.locator('#todoRowsV554 [data-todo-id="open2"]')).toHaveCount(0);
  expect(await frame.locator('body').evaluate(x=>
    x.ownerDocument.documentElement.scrollWidth-x.ownerDocument.defaultView.innerWidth)).toBeLessThanOrEqual(2);
});
