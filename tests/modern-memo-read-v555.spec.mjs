import { test, expect } from '@playwright/test';

const ROOM='test-modern-memo-v555';
async function boot(page,{chosen=true,flag=true,empty=false}={}){
  await page.addInitScript(({room,chosen,flag,empty})=>{
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
    window.WORK_BOARD_TEST=flag?{modernReadV555:true}:{};
  },{room:ROOM,chosen,flag,empty});
  await page.route('https://www.gstatic.com/firebasejs/**',r=>r.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,r=>r.abort('blockedbyclient'));
  await page.goto('/?room='+ROOM+'&modernReadV555=1',{waitUntil:'domcontentloaded'});
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
