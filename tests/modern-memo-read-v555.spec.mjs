import { test, expect } from '@playwright/test';

const ROOM='test-modern-memo-v555';
async function boot(page,{chosen=true,flag=true,empty=false,write=false}={}){
  await page.addInitScript(({room,chosen,flag,empty,write})=>{
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId',room);
    localStorage.setItem('system-task-users:'+room,JSON.stringify(['佐藤','福冨']));
    if(chosen)localStorage.setItem('systemTaskUser','佐藤');
    localStorage.setItem('system-task-tasks:'+room,JSON.stringify([]));
    localStorage.setItem('system-task-schedules:'+room,JSON.stringify([]));
    localStorage.setItem('system-task-todos:'+room,JSON.stringify([]));
    const memo=(id,title,body,category,pinned,updatedAt,extra={})=>({
      id,title,body,category,pinned,updatedAt,createdAt:updatedAt-1000,
      tags:['共有',id],createdBy:'佐藤',updatedBy:'福冨',revision:2,...extra
    });
    const longText=Array.from({length:95},(_,i)=>'運用手順 '+String(i+1)+'：確認事項を整理して記録する。').join('\n');
    const records=empty?{}:{
      'pin-b':memo('pin-b','固定B','固定メモの本文','手順',true,1800000000000),
      'pin-a':memo('pin-a','固定A','先に固定した内容','定型情報',true,1700000000000),
      'normal-b':memo('normal-b','共有URL','URL関連のテキスト','URL・リンク',false,1900000000000,{tags:['ｕｒｌ共有','引継ぎ']}),
      'normal-a':memo('normal-a','長文業務手順',longText,'手順',false,1600000000000),
      'hostile':memo('hostile','<svg onload=window.__injected=true>',
        '<img src=x onerror=window.__injected=true>','その他',false,1200000000000,{tags:['<script>alert(1)</script>']})
    };
    localStorage.setItem('system-business-memos:'+room,JSON.stringify(records));
    localStorage.setItem('workBoardMemoOrderV531:'+room+':佐藤',
      JSON.stringify(['pin-a','pin-b','normal-a','normal-b','hostile']));
    localStorage.setItem('workBoardMemoOrderV531:'+room+':福冨',
      JSON.stringify(['pin-b','pin-a','normal-b','normal-a','hostile']));
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null;},set(){}});
    window.WORK_BOARD_TEST=flag?{modernReadV555:true,modernWriteV563:write}:{};
  },{room:ROOM,chosen,flag,empty,write});
  await page.route('https://www.gstatic.com/firebasejs/**',r=>r.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,r=>r.abort('blockedbyclient'));
  await page.goto('/?room='+ROOM+'&modernReadV555=1'+(write?'&modernWriteV563=1':''),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
}
const modern=page=>page.frameLocator('iframe[data-modern-memo-v555]');
async function waitMemoOwner(page){
  await page.waitForFunction(()=>
    window.WorkBoardReadV550?.read()?.ready===true
    && window.WorkBoardBusinessMemoReadV555?.read()?.ready===true,undefined,{timeout:45000});
}

test('Ver.555 desktop shows real shared notes, pinned grouping and the same personal order as Classic',async({page})=>{
  test.setTimeout(100000);
  await page.setViewportSize({width:1366,height:768});
  await boot(page);await waitMemoOwner(page);
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','ready');
  await expect(frame.locator('#sourceV555')).toContainText('ルーム：'+ROOM);
  await expect(frame.locator('#sourceV555')).toContainText('利用者：佐藤');
  await expect(frame.locator('#sourceV555')).toContainText('端末内保存');
  await expect(frame.locator('#countV555')).toContainText('全 5件（固定 2件）');
  const rows=frame.locator('#memoGridV555 article[data-memo-id]');
  await expect(rows).toHaveCount(5);
  expect(await rows.evaluateAll(nodes=>nodes.map(n=>n.dataset.memoId)))
    .toEqual(['pin-a','pin-b','normal-a','normal-b','hostile']);
  await expect(frame.locator('[data-memo-id="pin-a"]')).toContainText('固定中');
  await expect(frame.locator('[data-memo-id="normal-a"]')).not.toContainText('固定中');
  await expect(frame.locator('[data-memo-id="normal-b"]')).toContainText('ｕｒｌ共有');
  await expect(frame.locator('html')).toHaveAttribute('data-palette','ink');
  expect(await frame.locator('body').evaluate(body=>
    Boolean(body.ownerDocument.defaultView.Demo||body.ownerDocument.defaultView.firebaseConfig))).toBe(false);
  // Compare directly against Classic's own business-memo UI using identical room data.
  const classicOrder=await page.evaluate(()=>{
    document.querySelector('[data-work-memo-layout]')?.click();
    return [...document.querySelectorAll('#workMemoViewV167 .work-memo-card-v167')]
      .map(node=>node.dataset.memoSortId);
  });
  expect(classicOrder).toEqual(['pin-a','pin-b','normal-a','normal-b','hostile']);
  expect(await rows.evaluateAll(nodes=>nodes.map(n=>n.dataset.memoId))).toEqual(classicOrder);
  await expect(frame.locator('[data-memo-pin],[data-action],[draggable],form,textarea')).toHaveCount(0);
  expect(await frame.locator('body').evaluate(body=>
    body.ownerDocument.documentElement.scrollWidth-body.ownerDocument.defaultView.innerWidth))
    .toBeLessThanOrEqual(1);
});

test('Ver.555 mobile scrolls long body, normalizes search/tag matches, and never writes business memo storage',async({page})=>{
  test.setTimeout(100000);
  await page.setViewportSize({width:390,height:844});
  await boot(page);await waitMemoOwner(page);
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','ready');
  const keys=await page.evaluate(room=>({
    data:localStorage.getItem('system-business-memos:'+room),
    sato:localStorage.getItem('workBoardMemoOrderV531:'+room+':佐藤'),
    fuku:localStorage.getItem('workBoardMemoOrderV531:'+room+':福冨')
  }),ROOM);
  const pre=frame.locator('[data-memo-id="normal-a"] .readonly-copy');
  await expect(pre).toBeVisible();
  expect(await pre.evaluate(node=>node.scrollHeight>node.clientHeight)).toBe(true);
  await pre.evaluate(node=>{node.scrollTop=350;});
  expect(await pre.evaluate(node=>node.scrollTop)).toBeGreaterThan(0);
  await expect(frame.locator('#memoGridV555 img,#memoGridV555 script,#memoGridV555 svg')).toHaveCount(0);
  await expect(frame.locator('[data-memo-id="hostile"]')).toContainText('<img src=x onerror=window.__injected=true>');
  expect(await frame.locator('body').evaluate(node=>node.ownerDocument.defaultView.__injected)).toBeUndefined();
  await frame.locator('#memoSearchV555').fill('URL共有');
  await expect(frame.locator('#memoGridV555 article')).toHaveCount(1);
  await expect(frame.locator('#memoGridV555 article')).toHaveAttribute('data-memo-id','normal-b');
  await frame.locator('#memoSearchV555').fill('');
  await frame.locator('#memoCategoryV555').selectOption('手順');
  await expect(frame.locator('#memoGridV555 article')).toHaveCount(2);
  await frame.locator('#memoCategoryV555').selectOption('');
  await frame.locator('#refreshV555').click();
  await expect(frame.locator('#memoGridV555 article')).toHaveCount(5);
  expect(await frame.locator('body').evaluate(node=>
    node.ownerDocument.documentElement.scrollWidth-node.ownerDocument.defaultView.innerWidth))
    .toBeLessThanOrEqual(1);
  const after=await page.evaluate(room=>({
    data:localStorage.getItem('system-business-memos:'+room),
    sato:localStorage.getItem('workBoardMemoOrderV531:'+room+':佐藤'),
    fuku:localStorage.getItem('workBoardMemoOrderV531:'+room+':福冨')
  }),ROOM);
  expect(after).toEqual(keys);
  await frame.locator('#closeV555').click();
  await expect(page.locator('iframe[data-modern-memo-v555]')).toHaveCount(0);
  await expect(page.locator('#currentUserSelect')).toHaveValue('佐藤');
});

test('Ver.555 user switch preserves shared memo contents but immediately applies the new user personal order',async({page})=>{
  test.setTimeout(100000);
  await boot(page);await waitMemoOwner(page);
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','ready');
  await expect(frame.locator('#memoGridV555 article').first()).toHaveAttribute('data-memo-id','pin-a');
  await page.evaluate(()=>{
    const select=document.getElementById('currentUserSelect');
    select.value='福冨';select.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect.poll(async()=>page.evaluate(()=>window.WorkBoardReadV550.read().selectedUser)).toBe('福冨');
  await expect(frame.locator('#sourceV555')).toContainText('利用者：福冨');
  expect(await frame.locator('#memoGridV555 article').evaluateAll(nodes=>nodes.map(n=>n.dataset.memoId)))
    .toEqual(['pin-b','pin-a','normal-b','normal-a','hostile']);
  await expect(frame.locator('[data-memo-id="normal-a"]')).toContainText('長文業務手順');
  const classicOrder=await page.evaluate(()=>{
    document.querySelector('[data-work-memo-layout]')?.click();
    return [...document.querySelectorAll('#workMemoViewV167 .work-memo-card-v167')]
      .map(node=>node.dataset.memoSortId);
  });
  expect(classicOrder).toEqual(['pin-b','pin-a','normal-b','normal-a','hostile']);
  await page.evaluate(()=>{
    const select=document.getElementById('currentUserSelect');
    select.value='佐藤';select.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect(frame.locator('#sourceV555')).toContainText('利用者：佐藤');
  await expect(frame.locator('#memoGridV555 article').first()).toHaveAttribute('data-memo-id','pin-a');
});

test('Ver.555 valid empty shared room shows no demo notes',async({page})=>{
  test.setTimeout(100000);
  await boot(page,{empty:true});await waitMemoOwner(page);
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','ready');
  await expect(frame.locator('#countV555')).toContainText('全 0件');
  await expect(frame.locator('#memoGridV555 article')).toHaveCount(0);
  await expect(frame.locator('#memoEmptyV555')).toBeVisible();
  await expect(frame.locator('#memoV555')).not.toContainText('稟議メールの宛先');
});

test('Ver.555 no explicit flag and standalone URL never read shared memos',async({page})=>{
  test.setTimeout(100000);
  await boot(page,{flag:false});
  await expect(page.locator('iframe[data-modern-memo-v555]')).toHaveCount(0);
  await page.goto('/modern/product/memo-list-read-v555.html');
  await expect(page.locator('body')).toHaveAttribute('data-read-state','unavailable');
  await expect(page.locator('#memoGridV555 article')).toHaveCount(0);
  await expect(page.locator('#sourceV555')).toContainText('localhost');
});

test('Ver.555 no selected Classic user fails closed even when cached shared memos exist',async({page})=>{
  test.setTimeout(100000);
  await boot(page,{chosen:false});
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','unavailable');
  await expect(frame.locator('#sourceV555')).toContainText('クラシックで利用者を選択');
  await expect(frame.locator('#memoGridV555 article')).toHaveCount(0);
  await expect(frame.locator('#memoV555')).toBeHidden();
});


test('Ver.563 Modern adds and edits using the original Classic memo dialog',async({page})=>{
  await boot(page,{write:true});await waitMemoOwner(page);
  let frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-memo-write-v563','enabled');
  await frame.locator('#memoNewV563').click();
  await expect(page.locator('iframe[data-modern-memo-v555]')).toHaveCount(0);
  await expect(page.locator('#workMemoDialogV167')).toBeVisible();
  await page.locator('#workMemoTitleV167').fill('新規の引継ぎ手順');
  await page.locator('#workMemoBodyV167').fill('内容をClassicフォームから保存');
  await page.locator('#workMemoCategoryV167').selectOption('手順');
  await page.locator('#workMemoPinnedV167').check();
  await page.locator('#workMemoFormV167 button[type=submit]').click();
  await expect(page.locator('#workMemoDialogV167')).not.toBeVisible();
  const created=await page.evaluate(room=>
    Object.values(JSON.parse(localStorage.getItem('system-business-memos:'+room)||'{}'))
      .find(m=>m.title==='新規の引継ぎ手順'),ROOM);
  expect(created).toMatchObject({title:'新規の引継ぎ手順',revision:1,pinned:true,category:'手順'});
  await page.reload({waitUntil:'domcontentloaded'});await waitMemoOwner(page);
  frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-memo-write-v563','enabled');
  await frame.locator('[data-memo-id="normal-b"] [data-memo-action-v563="edit"]').click();
  await expect(page.locator('#workMemoDialogV167')).toBeVisible();
  await expect(page.locator('#workMemoTitleV167')).toHaveValue('共有URL');
  await page.locator('#workMemoTitleV167').fill('更新した共有URL');
  await page.locator('#workMemoBodyV167').fill('本文の変更内容');
  await page.locator('#workMemoFormV167 button[type=submit]').click();
  await expect(page.locator('#workMemoDialogV167')).not.toBeVisible();
  const saved=await page.evaluate(room=>JSON.parse(localStorage.getItem('system-business-memos:'+room)||'{}')['normal-b'],ROOM);
  expect(saved).toMatchObject({title:'更新した共有URL',body:'本文の変更内容',revision:3});
});

test('Ver.563 pin updates shared memo but personal reorder never updates shared records',async({page})=>{
  await boot(page,{write:true});await waitMemoOwner(page);
  const frame=modern(page);
  const before=await page.evaluate(room=>JSON.parse(localStorage.getItem('system-business-memos:'+room)||'{}'),ROOM);
  await frame.locator('[data-memo-id="normal-b"] [data-memo-action-v563="pin"]').click();
  await expect(frame.locator('[data-memo-id="normal-b"]')).toContainText('固定中');
  const pinned=await page.evaluate(room=>JSON.parse(localStorage.getItem('system-business-memos:'+room)||'{}'),ROOM);
  expect(pinned['normal-b']).toMatchObject({revision:3,pinned:true});
  expect(pinned['normal-a']).toEqual(before['normal-a']);
  // After pinning, the two remaining normal cards can still be reordered.
  await frame.locator('[data-memo-id="normal-a"] [data-memo-action-v563="move"]').last().click();
  await expect(frame.locator('#memoActionStatusV563')).toContainText('表示順');
  const after=await page.evaluate(room=>({
    data:JSON.parse(localStorage.getItem('system-business-memos:'+room)||'{}'),
    sato:JSON.parse(localStorage.getItem('workBoardMemoOrderV531:'+room+':佐藤')||'[]'),
    fuku:JSON.parse(localStorage.getItem('workBoardMemoOrderV531:'+room+':福冨')||'[]')
  }),ROOM);
  expect(after.data).toEqual(pinned);
  expect(after.fuku).toEqual(['pin-b','pin-a','normal-b','normal-a','hostile']);
  expect(after.sato).not.toEqual(['pin-a','pin-b','normal-a','normal-b','hostile']);
  const order=await frame.locator('#memoGridV555 article').evaluateAll(nodes=>nodes.map(n=>n.dataset.memoId));
  expect(order.filter(id=>id==='normal-a'||id==='hostile')).toEqual(['hostile','normal-a']);
});

test('Ver.563 delete cancel retains data, then deletes only selected memo',async({page})=>{
  await boot(page,{write:true});await waitMemoOwner(page);
  const frame=modern(page);
  const before=await page.evaluate(room=>JSON.parse(localStorage.getItem('system-business-memos:'+room)||'{}'),ROOM);
  page.once('dialog',d=>d.dismiss());
  await frame.locator('[data-memo-id="normal-b"] [data-memo-action-v563="remove"]').click();
  await expect(frame.locator('#memoActionStatusV563')).toContainText('キャンセル');
  expect(await page.evaluate(room=>JSON.parse(localStorage.getItem('system-business-memos:'+room)||'{}'),ROOM)).toEqual(before);
  page.once('dialog',d=>d.accept());
  await frame.locator('[data-memo-id="normal-b"] [data-memo-action-v563="remove"]').click();
  await expect(frame.locator('#memoActionStatusV563')).toContainText('削除しました');
  const after=await page.evaluate(room=>JSON.parse(localStorage.getItem('system-business-memos:'+room)||'{}'),ROOM);
  expect(after['normal-b']).toBeUndefined();
  expect(after['normal-a']).toEqual(before['normal-a']);
});

test('Ver.563 memo task action prefills Classic task form without saving a task',async({page})=>{
  await boot(page,{write:true});await waitMemoOwner(page);
  const frame=modern(page);
  const tasksBefore=await page.evaluate(room=>localStorage.getItem('system-task-tasks:'+room),ROOM);
  await frame.locator('[data-memo-id="normal-b"] [data-memo-action-v563="task"]').click();
  await expect(page.locator('iframe[data-modern-memo-v555]')).toHaveCount(0);
  await expect(page.locator('#taskDialog')).toBeVisible();
  await expect(page.locator('#taskTitle')).toHaveValue('共有URL');
  await expect(page.locator('#taskDescription')).toHaveValue('URL関連のテキスト');
  expect(await page.evaluate(room=>localStorage.getItem('system-task-tasks:'+room),ROOM)).toBe(tasksBefore);
});

test('Ver.563 clipboard copies text rather than creating a duplicate memo',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:'http://127.0.0.1:4173'});
  await boot(page,{write:true});await waitMemoOwner(page);
  const frame=modern(page);
  const before=await page.evaluate(room=>localStorage.getItem('system-business-memos:'+room),ROOM);
  await frame.locator('[data-memo-id="normal-b"] [data-memo-action-v563="copy"]').click();
  await expect(frame.locator('#memoActionStatusV563')).toContainText('本文をコピー');
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('URL関連のテキスト');
  expect(await page.evaluate(room=>localStorage.getItem('system-business-memos:'+room),ROOM)).toBe(before);
});

test('Ver.563 read-only and foreign/stale direct commands fail closed',async({page})=>{
  await boot(page);await waitMemoOwner(page);
  await expect(modern(page).locator('body')).toHaveAttribute('data-memo-write-v563','readonly');
  await expect(modern(page).locator('#memoNewV563')).toBeHidden();
  await expect(modern(page).locator('[data-memo-action-v563]')).toHaveCount(0);
  expect(await page.evaluate(()=>window.WorkBoardBusinessMemoActionsV563)).toBeUndefined();
  await page.reload({waitUntil:'domcontentloaded'});
});
test('Ver.563 API rejects wrong identity or outdated revision without opening modal',async({page})=>{
  await boot(page,{write:true});await waitMemoOwner(page);
  const call=r=>page.evaluate(req=>window.WorkBoardBusinessMemoActionsV563.edit(req),r);
  const base={roomId:ROOM,selectedUser:'佐藤',id:'normal-b',expectedRevision:2};
  expect((await call({...base,roomId:'test-foreign'})).error).toBe('owner-mismatch');
  expect((await call({...base,selectedUser:'福冨'})).error).toBe('owner-mismatch');
  expect((await call({...base,expectedRevision:1})).error).toBe('revision-or-state-mismatch');
  await expect(page.locator('#workMemoDialogV167')).not.toBeVisible();
});
