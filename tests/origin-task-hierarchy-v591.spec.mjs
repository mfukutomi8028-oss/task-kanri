import {test,expect} from '@playwright/test';

// Test-only room and deliberately synthetic task data. No production access.
async function openOrigin(page,width,roomSuffix){
  await page.setViewportSize({width,height:width<768?820:920});
  const room='origin-hierarchy-v591-'+roomSuffix+'-'+width;
  await page.route('**/*',route=>
    new URL(route.request().url()).origin==='http://127.0.0.1:4173'
      ?route.continue():route.abort('blockedbyclient'));
  await page.addInitScript(roomName=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskRoomId',roomName);
    localStorage.setItem('systemTaskUser','OriginAuditUser');
  },room);
  await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  const host=page.locator('#modernOriginRoot');
  await expect(host).toBeVisible();
  const seeded=await page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
    const input=[
      {title:'電子カルテの更新手順を確認',description:'検証項目と運用手順を整理して担当部署と共有する',days:0,priority:'高',checklist:'事前確認\n手順確認\n結果共有'},
      {title:'端末更新の作業日程を調整',description:'現場業務に支障が出ない時間帯を調整する',days:2,priority:'中',checklist:'利用部署へ確認\n日程確定'},
      {title:'ネットワーク機器の設定を確認',description:'機器設定と運用資料の差分を確認する',days:6,priority:'低',checklist:''}
    ];
    const created=[];
    for(const t of input){
      const d=new Date(); d.setDate(d.getDate()+t.days);
      const dueDate=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
      const response=await bridge.dispatch({type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,assignee:s.users?.[0]||s.currentUser,status:s.statuses.includes('未着手')?'未着手':s.statuses[0],category:s.categories[0],title:t.title,description:t.description,requester:'',tags:'',checklist:t.checklist,priority:t.priority,dueDate,dueTime:'15:30',pinned:false});
      if(!response?.ok)throw Error('task.create fixture: '+JSON.stringify(response));
      created.push(response.id);
    }
    return created;
  });
  await host.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="tasks"]').click();
  const rows=host.locator('.origin-task-collection .item-row');
  await expect(rows).toHaveCount(3);
  return {host,rows,seeded};
}

async function attachScreenshot(testInfo,page,title){
  await testInfo.attach(title,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
}

for(const width of [320,390,1366]){
  test('Origin compact list shows separated and scannable work rows at '+width+'px',async({page},testInfo)=>{
    test.setTimeout(90000);
    const {host,rows}=await openOrigin(page,width,'compact');
    const list=host.locator('.origin-task-layout-list.origin-tasks-compact');
    await expect(list).toBeVisible();
    await attachScreenshot(testInfo,page,'origin-tasks-compact-'+width);
    const geometry=await rows.evaluateAll(elements=>elements.map(el=>{
      const r=el.getBoundingClientRect(),title=el.querySelector('.item-name');
      return {y:r.y,height:r.height,borderRadius:parseFloat(getComputedStyle(el).borderTopLeftRadius),font:parseFloat(getComputedStyle(title).fontSize)};
    }));
    expect(geometry.every(x=>x.borderRadius>=10&&x.font>=14)).toBe(true);
    if(width<768){
      // Keep the task name readable: the action cluster must occupy the next row.
      const placement=await rows.first().evaluate(el=>{
        const main=el.querySelector('.origin-task-main').getBoundingClientRect();
        const actions=el.querySelector('.row-last').getBoundingClientRect();
        return {mainWidth:main.width,mainBottom:main.bottom,actionsTop:actions.top};
      });
      expect(placement.mainWidth).toBeGreaterThanOrEqual(205);
      expect(placement.actionsTop).toBeGreaterThanOrEqual(placement.mainBottom-1);
    }
    for(let i=1;i<geometry.length;i++)expect(geometry[i].y-(geometry[i-1].y+geometry[i-1].height)).toBeGreaterThanOrEqual(5);
    await expect(rows.first().locator('[data-action="open"][data-kind="tasks"]')).toBeVisible();
    await expect(rows.first().locator('[data-action="list-quick-edit"]')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
  });
}

for(const width of [390,1366]){
  test('Origin detailed list presents work briefs with labeled due and assignee at '+width+'px',async({page},testInfo)=>{
    test.setTimeout(90000);
    const {host}=await openOrigin(page,width,'expanded');
    // Mobile density settings live within the deliberately collapsed advanced filters.
    if(width<768){
      await host.locator('[data-action="task-advanced-toggle"]').click();
      await expect(host.locator('[data-action="task-density"]')).toBeVisible();
    }
    await host.locator('[data-action="task-density"]').click();
    const list=host.locator('.origin-task-layout-list:not(.origin-tasks-compact)');
    const rows=list.locator('.item-row');
    await expect(rows).toHaveCount(3);
    await attachScreenshot(testInfo,page,'origin-tasks-detailed-'+width);
    const titleSize=await rows.first().locator('.item-name').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
    expect(titleSize).toBeGreaterThanOrEqual(width>=768?16:15);
    const description=rows.first().locator('.origin-task-insight-description');
    await expect(description).toBeVisible();
    if(width>=768){
      await expect(rows.first().locator('.item-date .origin-task-fact-label')).toBeVisible();
      await expect(rows.first().locator('.item-assignee .origin-task-fact-label')).toBeVisible();
    }
    const cards=await rows.evaluateAll(elements=>elements.map(el=>({y:el.getBoundingClientRect().y,height:el.getBoundingClientRect().height,radius:parseFloat(getComputedStyle(el).borderTopLeftRadius)})));
    expect(cards.every(x=>x.radius>=12)).toBe(true);
    for(let i=1;i<cards.length;i++)expect(cards[i].y-(cards[i-1].y+cards[i-1].height)).toBeGreaterThanOrEqual(8);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
  });

  test('Origin task inspector has a clear overview and retains existing editing actions at '+width+'px',async({page},testInfo)=>{
    test.setTimeout(90000);
    const {host,rows}=await openOrigin(page,width,'detail');
    await rows.first().locator('.item-name').click();
    const sheet=host.locator('#sheet');
    await expect(sheet.locator('.origin-task-detail')).toBeVisible();
    await attachScreenshot(testInfo,page,'origin-task-inspector-'+width);
    const overview=sheet.locator('#originTaskOverview');
    await expect(overview.locator('dt')).toContainText(['期限日・時刻','担当者','依頼者','状態']);
    const section=sheet.locator('.origin-task-detail>.origin-task-section').first();
    const border=await section.evaluate(el=>parseFloat(getComputedStyle(el).borderLeftWidth));
    expect(border).toBe(0);
    await expect(sheet.locator('.origin-sheet-primary [data-action="edit"]')).toBeVisible();
    await expect(sheet.locator('[data-action="task-check"]')).toHaveCount(3);
    await sheet.locator('.sheet-close').click();
    await expect(host.locator('#overlay')).toBeHidden();
  });
}


for(const width of [390,1366]){
  test('Origin inline task status keeps keyboard context after regrouping at '+width+'px',async({page})=>{
    test.setTimeout(90000);
    const {host,seeded}=await openOrigin(page,width,'status-return');
    if(width<768)await host.locator('[data-action="task-advanced-toggle"]').click();
    await host.locator('#groupSelect').selectOption('status');
    const select=host.locator('.origin-task-collection [data-action="task-inline-status"][data-id="'+seeded[0]+'"]');
    await select.focus();
    await select.selectOption('対応中');
    await expect.poll(()=>page.evaluate(id=>
      window.WorkBoardPaletteBridge.readSnapshot().tasks.find(task=>task.id===id)?.status,seeded[0]
    )).toBe('対応中');
    await expect(select).toBeFocused();
    await expect(select).toHaveValue('対応中');
    const groupName=await select.evaluate(el=>el.closest('.origin-task-group')?.querySelector('.group-title')?.textContent||'');
    expect(groupName).toContain('対応中');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(3);
  });

  test('Origin task completion keeps the next actionable row focused at '+width+'px',async({page})=>{
    test.setTimeout(90000);
    const {host,seeded}=await openOrigin(page,width,'done-return');
    const done=host.locator('.origin-task-collection [data-action="task-done"][data-id="'+seeded[2]+'"]');
    await done.focus();
    // The canonical task.complete action requests an optional completion memo.
    page.once('dialog',dialog=>dialog.accept(''));
    await done.click();
    await expect.poll(()=>page.evaluate(id=>
      window.WorkBoardPaletteBridge.readSnapshot().tasks.find(task=>task.id===id)?.completed,seeded[2]
    )).toBe(true);
    await expect(host.locator('.origin-task-collection [data-action="task-done"][data-id="'+seeded[2]+'"]')).toHaveCount(0);
    await expect(host.locator('.origin-task-collection .item-name[data-id="'+seeded[1]+'"]')).toBeFocused();
    await expect(host.locator('.origin-task-toolbar [data-action="task-filter"][data-value="active"]')).toHaveAttribute('aria-pressed','true');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(3);
  });
}

test('Origin returns focus to filtered neighbor or search when a task leaves the results',async({page})=>{
  test.setTimeout(90000);
  const {host,seeded}=await openOrigin(page,1366,'filtered-return');
  await host.locator('.status-rail [data-action="filter-status"][data-status="未着手"]').click();
  const select=host.locator('.origin-task-collection [data-action="task-inline-status"][data-id="'+seeded[0]+'"]');
  await select.selectOption('対応中');
  await expect.poll(()=>page.evaluate(id=>
    window.WorkBoardPaletteBridge.readSnapshot().tasks.find(t=>t.id===id)?.status,seeded[0]
  )).toBe('対応中');
  await expect(select).toHaveCount(0);
  await expect(host.locator('.origin-task-collection .item-name[data-id="'+seeded[1]+'"]')).toBeFocused();
  await expect(host.locator('.status-rail [data-action="filter-status"][data-status="未着手"]')).toHaveAttribute('aria-pressed','true');
  const search=host.locator('#originTaskQuery');
  await search.fill('ネットワーク機器');
  await expect(host.locator('.origin-task-collection .item-row')).toHaveCount(1);
  page.once('dialog',dialog=>dialog.accept(''));
  await host.locator('.origin-task-collection [data-action="task-done"][data-id="'+seeded[2]+'"]').click();
  await expect.poll(()=>page.evaluate(id=>
    window.WorkBoardPaletteBridge.readSnapshot().tasks.find(t=>t.id===id)?.completed,seeded[2]
  )).toBe(true);
  await expect(host.locator('.origin-task-collection .item-row')).toHaveCount(0);
  await expect(search).toHaveValue('ネットワーク機器');
  await expect(search).toBeFocused();
});

test('Origin board keeps horizontal position when task controls rerender the workspace',async({page})=>{
  test.setTimeout(90000);
  const {host,seeded}=await openOrigin(page,390,'board-scroll');
  const result=await page.evaluate(async ids=>{
    const bridge=window.WorkBoardPaletteBridge;
    return Promise.all([
      bridge.dispatch({type:'task.status',id:ids[1],status:'対応中'}),
      bridge.dispatch({type:'task.status',id:ids[2],status:'確認待ち'})
    ]);
  },seeded);
  expect(result.every(x=>x?.ok)).toBe(true);
  await host.locator('[data-action="task-layout"][data-value="board"]').click();
  const board=host.locator('.origin-task-collection.origin-task-layout-board');
  await expect(board.locator('.origin-task-group')).toHaveCount(3);
  const start=await board.evaluate(el=>{
    if(el.scrollWidth<=el.clientWidth+50)throw Error('Expected board to overflow horizontally');
    el.scrollLeft=125;
    return el.scrollLeft;
  });
  expect(start).toBeGreaterThan(50);
  await host.locator('[data-action="task-advanced-toggle"]').click();
  await host.locator('[data-action="task-density"]').click();
  const end=await board.evaluate(el=>el.scrollLeft);
  expect(end).toBeGreaterThanOrEqual(start-3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(3);
});


test('Origin compact rows show task priorities and checklist progress without expanding work briefs',async({page})=>{
  test.setTimeout(90000);
  const {host,rows}=await openOrigin(page,1366,'compact-context');
  const row=rows.first();
  await expect(host.locator('.origin-task-collection')).toHaveClass(/origin-tasks-compact/);
  await expect(row.locator('.row-under .origin-task-meta')).toBeVisible();
  await expect(row.locator('.row-under .origin-task-meta')).toContainText('高優先');
  await expect(row.locator('.row-under .origin-task-progress-pill')).toBeVisible();
  await expect(row.locator('.row-under .origin-task-progress-pill')).toContainText('残り3件');
  await expect(row.locator('.origin-task-insight')).toBeHidden();
  const compactHeight=await row.evaluate(el=>el.getBoundingClientRect().height);
  await host.locator('[data-action="task-density"]').click();
  await expect(host.locator('.origin-task-collection')).not.toHaveClass(/origin-tasks-compact/);
  await expect(row.locator('.origin-task-insight-description')).toBeVisible();
  await expect(row.locator('.origin-task-insight-next')).toContainText('事前確認');
  const detailedHeight=await row.evaluate(el=>el.getBoundingClientRect().height);
  expect(detailedHeight).toBeGreaterThan(compactHeight+20);
  await expect(row.locator('[data-action="task-done"]')).toBeVisible();
  await expect(row.locator('[data-action="list-quick-edit"]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
});

for(const width of [320,390,1366]){
  test('Origin display density control reports its current mode and switches at '+width+'px',async({page})=>{
    test.setTimeout(90000);
    const {host}=await openOrigin(page,width,'density-state');
    if(width<768)await host.locator('[data-action="task-advanced-toggle"]').click();
    const density=host.locator('[data-action="task-density"]');
    await expect(density).toBeVisible();
    await expect(density).toContainText('表示：コンパクト');
    await expect(density).toHaveAttribute('aria-pressed','false');
    await expect(density).toHaveAttribute('aria-label',/現在.*コンパクト.*詳細表示/);
    await density.click();
    await expect(host.locator('.origin-task-collection')).not.toHaveClass(/origin-tasks-compact/);
    await expect(density).toContainText('表示：詳細');
    await expect(density).toHaveAttribute('aria-pressed','true');
    await expect(density).toHaveAttribute('aria-label',/現在.*詳細.*コンパクト表示/);
    await density.click();
    await expect(host.locator('.origin-task-collection')).toHaveClass(/origin-tasks-compact/);
    await expect(density).toContainText('表示：コンパクト');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
  });
}

for(const width of [320,390]){
  test('Origin mobile task actions show a readable edit label and fit the row at '+width+'px',async({page})=>{
    test.setTimeout(90000);
    const {host,rows}=await openOrigin(page,width,'edit-label');
    const row=rows.first();
    const edit=row.locator('[data-action="list-quick-edit"]');
    const status=row.locator('[data-action="task-inline-status"]');
    const done=row.locator('[data-action="task-done"]');
    await expect(edit.locator('.origin-task-edit-label')).toBeVisible();
    await expect(edit).toContainText('編集');
    await expect(status).toBeVisible();
    await expect(done).toBeVisible();
    const boxes=await row.evaluate(el=>{
      const outer=el.getBoundingClientRect();
      const nodes=['task-inline-status','list-quick-edit','task-done']
        .map(name=>el.querySelector('[data-action="'+name+'"]').getBoundingClientRect());
      return {outside:nodes.some(r=>r.left<outer.left-1||r.right>outer.right+1),
        overlaps:nodes.some((a,i)=>nodes.slice(i+1).some(b=>
          a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1)),
        sizes:nodes.map(r=>({w:r.width,h:r.height}))};
    });
    expect(boxes.outside).toBe(false);
    expect(boxes.overlaps).toBe(false);
    expect(boxes.sizes.every(b=>b.h>=44&&b.w>=44)).toBe(true);
    expect(boxes.sizes[1].w).toBeGreaterThanOrEqual(64);
    await edit.click();
    await expect(host.locator('#sheet #editForm[data-kind="tasks"]')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
  });
}
