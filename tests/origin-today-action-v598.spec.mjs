import {test,expect} from '@playwright/test';

async function launch(page,room,width=1366){
  await page.setViewportSize({width,height:width<600?800:900});
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'
    ?route.continue():route.abort('blockedbyclient'));
  await page.addInitScript(name=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskRoomId',name);
    localStorage.setItem('systemTaskUser','福冨');
  },room);
  await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  const root=page.locator('#modernOriginRoot');
  await expect(root).toBeVisible();
  await root.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="today"]').click();
  return root;
}

test('Today highlights the earliest overdue task and explains its urgency without writing data',async({page})=>{
  const root=await launch(page,'origin-today-action-priority');
  const original=await page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
    const due=new Date();due.setDate(due.getDate()-2);
    const dueDate=[due.getFullYear(),String(due.getMonth()+1).padStart(2,'0'),String(due.getDate()).padStart(2,'0')].join('-');
    const created=await bridge.dispatch({
      type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
      assignee:s.currentUser,status:s.statuses.includes('未着手')?'未着手':s.statuses[0],
      category:s.categories[0],title:'期限を過ぎた点検',description:'今日の優先を把握する',
      requester:'',tags:'',checklist:'',checklistDone:[],priority:'高',
      dueDate,dueTime:'',pinned:false
    });
    if(!created?.ok)throw Error('fixture task.create: '+JSON.stringify(created));
    return bridge.readSnapshot().tasks.map(t=>({id:t.id,title:t.title,revision:t.revision}));
  });
  const brief=root.locator('.origin-day-briefing');
  await expect(brief).toContainText('期限を過ぎた点検');
  await expect(brief.locator('.origin-day-briefing-reason')).toContainText('期限超過');
  await expect(brief.locator('.origin-day-metric[data-kind="tasks"]')).toContainText('1');
  await expect(root.locator('.focus-item .origin-today-reason')).toContainText('期限超過');
  await brief.locator('[data-action="open"][data-kind="tasks"]').click();
  await expect(root.locator('#sheet')).toContainText('期限を過ぎた点検');
  await root.locator('#sheet .sheet-close').click();
  const after=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks.map(
    t=>({id:t.id,title:t.title,revision:t.revision})));
  expect(after).toEqual(original);
});

test('Today falls back to this day schedule and changes when the selected date changes',async({page})=>{
  const root=await launch(page,'origin-today-action-schedule');
  const date=await root.locator('.strip .day-chip:not(.active)').last().getAttribute('data-date');
  await root.locator('.strip .day-chip[data-date="'+date+'"]').click();
  await page.evaluate(async day=>{
    const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
    const start=new Date(day+'T10:00:00'),end=new Date(day+'T11:00:00');
    const result=await bridge.dispatch({type:'schedule.create',revision:0,
      ownerRoom:s.roomId,ownerUser:s.currentUser,values:{
        title:'選択日の打合せ',startAt:start.toISOString(),endAt:end.toISOString(),
        assignee:s.currentUser,category:s.categories[0],relatedTaskId:'',
        location:'会議室',memo:''
      }});
    if(!result?.ok)throw Error('fixture schedule.create: '+JSON.stringify(result));
  },date);
  const brief=root.locator('.origin-day-briefing');
  await expect(brief).toContainText('選択日の打合せ');
  await expect(brief).toContainText('選択日の一歩');
  await expect(brief.locator('.origin-day-metric[data-kind="events"]')).toContainText('1');
  await brief.locator('[data-action="open"][data-kind="events"]').click();
  await expect(root.locator('#sheet')).toContainText('選択日の打合せ');
  await root.locator('#sheet .sheet-close').click();
  const another=root.locator('.strip .day-chip:not(.active)').first();
  await another.click();
  await expect(brief).not.toContainText('選択日の打合せ');
  await expect(brief.locator('.origin-day-metric[data-kind="events"]')).toContainText('0');
});

test('Today starts with personal ToDo when neither priority tasks nor appointments exist',async({page})=>{
  const root=await launch(page,'origin-today-action-todo');
  const out=await page.evaluate(()=>window.WorkBoardPaletteBridge.dispatch({
    type:'todo.create',text:'報告書の下書きを作成',memo:'下書きの準備'
  }));
  expect(out?.ok).toBe(true);
  const brief=root.locator('.origin-day-briefing');
  await expect(brief).toContainText('報告書の下書きを作成');
  await expect(brief.locator('.origin-day-metric[data-kind="todos"]')).toContainText('1');
  await brief.locator('[data-action="open"][data-kind="todos"]').click();
  await expect(root.locator('#sheet')).toContainText('報告書の下書きを作成');
  await root.locator('#sheet .sheet-close').click();
  await root.locator('.mini-todo .todo-check').click();
  await expect(brief).not.toContainText('報告書の下書きを作成');
  await expect(brief.locator('.origin-day-metric[data-kind="todos"]')).toContainText('0');
  await expect(brief.locator('[data-action="open"]')).toHaveCount(0);
});

for(const width of [320,390]){
  test('Today summary and ToDo hit area stay usable at '+width+'px',async({page})=>{
    const root=await launch(page,'origin-today-action-mobile-'+width,width);
    const add=await page.evaluate(()=>window.WorkBoardPaletteBridge.dispatch({
      type:'todo.create',text:'スマホでの操作を確認する'.repeat(3),memo:'詳細を読み取る'
    }));
    expect(add?.ok).toBe(true);
    const brief=root.locator('.origin-day-briefing');
    await expect(brief).toBeVisible();
    const box=await brief.boundingBox();
    expect(box.width).toBeLessThanOrEqual(width);
    const hit=await root.locator('.mini-todo .origin-today-todo-hit').first().boundingBox();
    expect(hit.width).toBeGreaterThanOrEqual(44);
    expect(hit.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(3);
    await root.locator('.mini-todo .todo-title').first().click();
    await expect(root.locator('#sheet')).toBeVisible();
    await root.locator('#sheet .sheet-close').click();
  });
}


test('Today action hub opens task, next schedule and personal ToDo directly',async({page})=>{
  test.setTimeout(90000);
  const root=await launch(page,'origin-today-hub-three-actions');
  const created=await page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
    const today=new Date(),format=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
    const due=new Date(today);due.setDate(due.getDate()-1);
    const task=await bridge.dispatch({
      type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
      assignee:s.currentUser,status:s.statuses.includes('未着手')?'未着手':s.statuses[0],
      category:s.categories[0],title:'起点：期限超過の設備点検',description:'設備点検の記録',
      requester:'',tags:'',checklist:'',checklistDone:[],priority:'高',
      dueDate:format(due),dueTime:'',pinned:false
    });
    if(!task?.ok)throw Error('task.create '+task?.error);
    const start=new Date(today);start.setHours(17,0,0,0);
    const end=new Date(start);end.setHours(18,0,0,0);
    const event=await bridge.dispatch({type:'schedule.create',revision:0,ownerRoom:s.roomId,
      ownerUser:s.currentUser,values:{title:'起点：夕方の定例会議',
      startAt:start.toISOString(),endAt:end.toISOString(),assignee:s.currentUser,
      category:s.categories[0],relatedTaskId:'',location:'会議室',memo:''}});
    if(!event?.ok)throw Error('schedule.create '+event?.error);
    const todo=await bridge.dispatch({type:'todo.create',text:'起点：明細を確認',memo:'個人作業'});
    if(!todo?.ok)throw Error('todo.create '+todo?.error);
    return {tasks:bridge.readSnapshot().tasks.length,schedules:bridge.readSnapshot().schedules.length,
      todos:bridge.readSnapshot().todos.length};
  });
  expect(created).toEqual({tasks:1,schedules:1,todos:1});
  const hub=root.locator('.origin-day-briefing');
  const lanes=hub.locator('.origin-day-briefing-tile');
  await expect(lanes).toHaveCount(3);
  for(const [kind,title] of [
    ['tasks','起点：期限超過の設備点検'],
    ['events','起点：夕方の定例会議'],
    ['todos','起点：明細を確認']
  ]){
    const item=hub.locator('.origin-day-briefing-tile[data-kind="'+kind+'"]');
    await expect(item).toContainText(title);
    await expect(item).toHaveAttribute('data-action','open');
    await item.click();
    await expect(root.locator('#sheet')).toContainText(title);
    await root.locator('#sheet .sheet-close').click();
  }
  await expect(hub.locator('.origin-day-metric[data-kind="tasks"]')).toContainText('1');
  await expect(hub.locator('.origin-day-metric[data-kind="events"]')).toContainText('1');
  await expect(hub.locator('.origin-day-metric[data-kind="todos"]')).toContainText('1');
});

test('Today action hub offers each creation action when no work exists',async({page})=>{
  test.setTimeout(90000);
  const root=await launch(page,'origin-today-hub-empty');
  const lanes=root.locator('.origin-day-briefing-tile');
  await expect(lanes).toHaveCount(3);
  for(const kind of ['tasks','events','todos']){
    const tile=root.locator('.origin-day-briefing-tile[data-kind="'+kind+'"]');
    await expect(tile).toHaveAttribute('data-action','new');
    await tile.click();
    await expect(root.locator('#editForm')).toHaveAttribute('data-kind',kind);
    await root.locator('#sheet .sheet-close').click();
  }
  await expect(root.locator('.origin-day-briefing [data-action="open"]')).toHaveCount(0);
});

for(const width of [320,390,1280]){
  test('Today action hub keeps three clear keyboard and touch targets at '+width+'px',async({page})=>{
    test.setTimeout(90000);
    const root=await launch(page,'origin-today-hub-layout-'+width,width);
    const cards=root.locator('.origin-day-briefing-tile');
    await expect(cards).toHaveCount(3);
    for(const card of await cards.all()){
      const rect=await card.boundingBox();
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
      expect(rect.width).toBeLessThanOrEqual(width);
      await card.focus();
      expect(await card.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
  });
}


test('Today keeps the three existing sections without a duplicated briefing',async({page})=>{
  const root=await launch(page,'origin-today-no-duplicate-briefing');
  await expect(root.locator('.origin-day-briefing')).toHaveCount(0);
  await expect(root.getByRole('heading',{name:/先に進めたいこと/})).toBeVisible();
  await expect(root.getByRole('heading',{name:/今日の予定/})).toBeVisible();
  await expect(root.getByRole('heading',{name:/個人ToDo/})).toBeVisible();
  await expect(root.locator('.origin-today-shortcuts button')).toHaveCount(3);
});
