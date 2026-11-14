import {test,expect} from '@playwright/test';

// Offline synthetic room: no external requests or real user data.
async function openOrigin(page,room,width=1366){
  await page.setViewportSize({width,height:width<600?800:900});
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'
    ?route.continue():route.abort('blockedbyclient'));
  await page.addInitScript(name=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskRoomId',name);
    localStorage.setItem('systemTaskUser','OriginTodoContextAudit');
  },room);
  await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  const root=page.locator('#modernOriginRoot');
  await expect(root).toBeVisible();
  await root.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="todos"]').click();
  return root;
}

async function createTodos(page){
  return page.evaluate(async()=>{
    const bridge=window.WorkBoardPaletteBridge;
    const sample=[
      ['点検表を確認','受付端末の稼働状況を確認\n接続確認は午後に実施'],
      ['簡単な連絡',''],
      ['会議資料を準備','周知文の最終確認と回覧']
    ];
    for(const [text,memo] of sample){
      const result=await bridge.dispatch({type:'todo.create',text,memo});
      if(!result?.ok)throw Error('todo fixture create: '+JSON.stringify(result));
    }
    return bridge.readSnapshot().todos.map(t=>({id:t.id,title:t.text,memo:t.memo,revision:t.revision,completed:t.completed}));
  });
}

test('ToDo rows reveal saved memo context without changing the title button or canonical records',async({page})=>{
  test.setTimeout(90000);
  const root=await openOrigin(page,'origin-todo-context-preview',1366);
  const original=await createTodos(page);
  const row=root.locator('.origin-todo-list .todo-entry',{hasText:'点検表を確認'});
  await expect(row.locator('.origin-todo-preview')).toContainText('受付端末の稼働状況を確認');
  await expect(row.locator('.origin-todo-preview')).toContainText('接続確認は午後に実施');
  await expect(row.locator('.todo-text')).toHaveText('点検表を確認');
  await expect(root.locator('.origin-todo-list .todo-entry',{hasText:'簡単な連絡'}).locator('.origin-todo-preview')).toHaveCount(0);
  await row.locator('.todo-text').click();
  await expect(root.locator('#sheet')).toBeVisible();
  await root.locator('#sheet .sheet-close').click();
  await expect(row.locator('.todo-text')).toBeFocused();
  const after=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().todos.map(t=>({
    id:t.id,title:t.text,memo:t.memo,revision:t.revision,completed:t.completed
  })));
  expect(after).toEqual(original);
});

test('Search misses offer a direct clear action and return focus to the query',async({page})=>{
  const root=await openOrigin(page,'origin-todo-context-noresult');
  await createTodos(page);
  await root.locator('[data-action="todo-search-toggle"]').click();
  const search=root.locator('#originTodoQuery');
  await search.fill('一致しない架空文字列');
  await expect(root.locator('.origin-todo-list .todo-entry')).toHaveCount(0);
  const empty=root.locator('.origin-todo-empty');
  await expect(empty).toContainText('一致する未完了ToDoはありません');
  await empty.locator('[data-action="todo-clear-query"]').click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await expect(root.locator('.origin-todo-list .todo-entry')).toHaveCount(3);
});

test('An empty pending list offers an explicit create action without inventing ToDo metadata',async({page})=>{
  const root=await openOrigin(page,'origin-todo-context-first');
  const empty=root.locator('.origin-todo-empty');
  await expect(empty).toContainText('未完了のToDoはありません');
  const create=empty.locator('[data-action="todo-new-focus"]');
  await expect(create).toBeVisible();
  await create.click();
  const input=root.locator('.origin-todo-add [name="title"]');
  await expect(input).toBeFocused();
  await input.fill('簡単な作業を追加');
  await input.press('Enter');
  await expect(root.locator('.origin-todo-list .todo-text')).toHaveText('簡単な作業を追加');
  const saved=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().todos);
  expect(saved).toHaveLength(1);
  expect(saved[0].memo||'').toBe('');
});

test('Completed history search uses matching items, not the total completed count',async({page})=>{
  const root=await openOrigin(page,'origin-todo-context-archive-count');
  await createTodos(page);
  await root.locator('.origin-todo-list .todo-entry',{hasText:'点検表を確認'}).locator('.todo-check').click();
  await expect(root.locator('.origin-todo-list .todo-entry')).toHaveCount(2);
  await root.locator('[data-action="todo-search-toggle"]').click();
  await root.locator('[data-action="todo-search-history"]').click();
  const search=root.locator('#originTodoQuery');
  await search.fill('どのToDoにも存在しない検索語');
  const empty=root.locator('.origin-todo-empty');
  await expect(empty).toContainText('一致する未完了ToDoはありません');
  await expect(empty).not.toContainText('完了履歴に');
  await expect(empty.locator('[data-action="jump-result"]')).toHaveCount(0);
  await search.fill('点検表を確認');
  await expect(empty).toContainText('完了履歴に1件の一致');
  await root.locator('.origin-todo-search-row [data-action="jump-result"]').click();
  await expect(root.locator('#originCompletedTodos .todo-text',{hasText:'点検表を確認'})).toBeFocused();
});

for(const width of [320,390]){
  test('ToDo context rows remain readable and touch-safe at '+width+'px',async({page})=>{
    const root=await openOrigin(page,'origin-todo-context-mobile-'+width,width);
    await createTodos(page);
    const row=root.locator('.origin-todo-list .todo-entry',{hasText:'点検表を確認'});
    await expect(row.locator('.origin-todo-preview')).toBeVisible();
    const rowBox=await row.boundingBox();
    const touch=await row.locator('.origin-todo-check-hit').boundingBox();
    expect(touch.width).toBeGreaterThanOrEqual(44);
    expect(touch.height).toBeGreaterThanOrEqual(44);
    const titleBox=await row.locator('.todo-text').boundingBox();
    const editBox=await row.locator('.origin-list-quick-edit').boundingBox();
    const detailBox=await row.locator('.todo-edit').boundingBox();
    expect(titleBox.width).toBeGreaterThan(55);
    expect(editBox.height).toBeGreaterThanOrEqual(44);
    expect(detailBox.height).toBeGreaterThanOrEqual(44);
    expect(rowBox.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(3);
    await row.locator('.todo-text').click();
    await expect(root.locator('#sheet')).toBeVisible();
    await root.locator('#sheet .sheet-close').click();
  });
}
