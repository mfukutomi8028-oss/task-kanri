import { test, expect } from '@playwright/test';

// Ver.551 runs only against Classic's existing local-only canonical owner.
// This page is never connected to production Firebase or the Modern demo store.
const ROOM = 'test-modern-task-v551';

async function boot(page, { chosen = true, flag = true, write = false, advanced = false, linked = false } = {}) {
  await page.addInitScript(({room, chosen, flag, write, advanced, linked}) => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('system-task-users:' + room, JSON.stringify(['佐藤','福冨']));
    if (chosen) localStorage.setItem('systemTaskUser', '佐藤');
    localStorage.setItem('system-task-tasks:' + room, JSON.stringify([
      {id:'t1',title:'端末入替の確認',status:'対応中',assignee:'佐藤',
        dueDate:'2026-10-28',category:'PC',priority:'高',revision:2},
      {id:'t2',title:'プリンタ設定待ち',status:'確認待ち',assignee:'福冨',
        dueDate:'2026-10-30',category:'プリンタ',priority:'中',revision:1},
      {id:'t3',title:'完了した作業',status:'完了',assignee:'佐藤',
        dueDate:'2026-10-25',category:'運用',priority:'低',revision:3},
      {id:'t4',title:'<img src=x onerror=window.__injected=true>',status:'未着手',
        assignee:'福冨',dueDate:'',category:'検証',priority:'中',revision:1}
    ]));
    localStorage.setItem('system-task-todos:' + room, JSON.stringify([
      {id:'one',owner:'佐藤',text:'佐藤の作業',completed:false,order:0,revision:1},
      {id:'two',owner:'福冨',text:'福冨の作業',completed:false,order:0,revision:1}
    ]));
    localStorage.setItem('system-task-schedules:' + room, JSON.stringify(linked ? [
      {id:'s-linked',title:'元タスクと関連する予定',relatedTaskId:'t1',revision:1,startDate:'2026-10-30'},
      {id:'s-other',title:'別タスクの予定',relatedTaskId:'t2',revision:1,startDate:'2026-10-31'}
    ] : []));
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    window.WORK_BOARD_TEST = flag ? {modernReadV551:true, modernWriteV560:write, modernWriteV561:advanced} : {};
  }, {room:ROOM,chosen,flag,write,advanced,linked});
  await page.route('https://www.gstatic.com/firebasejs/**',route=>route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,route=>route.abort('blockedbyclient'));
  await page.goto('/?room=' + ROOM + '&modernReadV551=1&modernWriteV560=1&modernWriteV561=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY === true,undefined,{timeout:30000});
}
const modern = page => page.frameLocator('iframe[data-modern-task-v551]');

test('Ver.551 desktop displays actual Classic task records in the Modern style without a second store', async ({page}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({width:1366,height:768});
  await boot(page);
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','ready');
  const rows=frame.locator('#taskRowsV551 tr[data-task-id]');
  await expect(rows).toHaveCount(4);
  await expect(rows.first()).toHaveAttribute('data-task-id','t1');
  await expect(frame.locator('#sourceV551')).toContainText('端末内保存');
  await expect(frame.locator('#sourceV551')).toContainText('ルーム：'+ ROOM);
  await expect(frame.locator('.read-only-flag')).toHaveText('閲覧専用');
  await expect(frame.locator('[data-task-id="t1"] .status')).toHaveText('対応中');
  await expect(frame.locator('[data-task-id="t1"] .priority')).toHaveText('高');
  await expect(frame.locator('[data-task-id="t1"]')).toHaveAttribute('data-revision','2');
  await expect(frame.locator('#countV551')).toHaveText('表示 4件 / 全 4件');
  await expect(frame.locator('html')).toHaveAttribute('data-palette','ink');
  expect(await frame.locator('body').evaluate(el => {
    const win = el.ownerDocument.defaultView;
    return Boolean(win.Demo || win.firebaseConfig);
  })).toBe(false);
  expect(await frame.locator('body').evaluate(el =>
    el.ownerDocument.documentElement.scrollWidth - el.ownerDocument.defaultView.innerWidth)).toBeLessThanOrEqual(1);
  const controls=await frame.locator('button').allTextContents();
  expect(controls).toEqual(expect.arrayContaining(['クラシックへ戻る','正本を再読込']));
  await expect(frame.locator('button[data-task],button[data-action="bulk-done"],input[data-select]')).toHaveCount(0);
});

test('Ver.551 filters rows, renders hostile task text as text, and never changes cached business records', async ({page}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({width:390,height:844});
  await boot(page);
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','ready');
  const before=await page.evaluate(room=>({
    tasks:localStorage.getItem('system-task-tasks:'+room),
    todos:localStorage.getItem('system-task-todos:'+room),
    schedules:localStorage.getItem('system-task-schedules:'+room)
  }),ROOM);
  expect(await frame.locator('body').evaluate(el => el.ownerDocument.defaultView.__injected)).toBeUndefined();
  await expect(frame.locator('#taskRowsV551 img')).toHaveCount(0);
  await expect(frame.locator('[data-task-id="t4"]')).toContainText('<img src=x onerror=window.__injected=true>');
  await frame.locator('#taskSearchV551').fill('プリンタ');
  await expect(frame.locator('#taskRowsV551 tr')).toHaveCount(1);
  await expect(frame.locator('#taskRowsV551 tr')).toHaveAttribute('data-task-id','t2');
  await frame.locator('#taskSearchV551').fill('');
  await frame.locator('#taskStatusV551').selectOption('完了');
  await expect(frame.locator('#taskRowsV551 tr')).toHaveCount(1);
  await expect(frame.locator('#taskRowsV551 tr')).toHaveAttribute('data-task-id','t3');
  await frame.locator('#taskStatusV551').selectOption('all');
  await expect(frame.locator('#taskRowsV551 tr')).toHaveCount(4);
  expect(await frame.locator('body').evaluate(el =>
    el.ownerDocument.documentElement.scrollWidth - el.ownerDocument.defaultView.innerWidth)).toBeLessThanOrEqual(1);
  const after=await page.evaluate(room=>({
    tasks:localStorage.getItem('system-task-tasks:'+room),
    todos:localStorage.getItem('system-task-todos:'+room),
    schedules:localStorage.getItem('system-task-schedules:'+room)
  }),ROOM);
  expect(after).toEqual(before);
  await frame.locator('#closeReadonly').click();
  await expect(page.locator('iframe[data-modern-task-v551]')).toHaveCount(0);
  await expect(page.locator('#currentUserSelect')).toHaveValue('佐藤');
});

test('Ver.551 manual refresh observes the current Classic selected user and preserves room task scope', async ({page}) => {
  test.setTimeout(90_000);
  await boot(page);
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','ready');
  await expect(frame.locator('#sourceV551')).toContainText('利用者：佐藤');
  await page.evaluate(()=>{
    const select=document.getElementById('currentUserSelect');
    select.value='福冨';
    select.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect.poll(async()=>page.evaluate(()=>window.WorkBoardReadV550.read().selectedUser)).toBe('福冨');
  await frame.locator('#refreshV551').click();
  await expect(frame.locator('#sourceV551')).toContainText('利用者：福冨');
  await expect(frame.locator('#taskRowsV551 tr')).toHaveCount(4);
});

test('Ver.551 refuses direct navigation and does not auto-open without the explicit test flag', async ({page}) => {
  test.setTimeout(90_000);
  await boot(page,{flag:false});
  await expect(page.locator('iframe[data-modern-task-v551]')).toHaveCount(0);
  await page.goto('/modern/product/task-list-read-v551.html');
  await expect(page.locator('body')).toHaveAttribute('data-read-state','unavailable');
  await expect(page.locator('#taskRowsV551 tr')).toHaveCount(0);
});

test('Ver.551 does not expose cached tasks before a local user profile is selected', async ({page}) => {
  test.setTimeout(90_000);
  await boot(page,{chosen:false,flag:true});
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','unavailable');
  await expect(frame.locator('#sourceV551')).toContainText('利用者を選択');
  await expect(frame.locator('#taskRowsV551 tr')).toHaveCount(0);
});

const taskRowsV560 = page => page.evaluate(room =>
  JSON.parse(localStorage.getItem('system-task-tasks:' + room) || '[]'), ROOM);

test('Ver.560 creates and edits a task using the original Classic form', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 850 });
  await boot(page, { write: true });
  const frame = modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-task-write-v560', 'enabled');
  await expect(frame.locator('#taskNewV560')).toBeVisible();
  await frame.locator('#taskNewV560').click();
  await expect(page.locator('iframe[data-modern-task-v551]')).toHaveCount(0);
  await expect(page.locator('#taskDialog')).toBeVisible();
  await page.locator('#taskTitle').fill('Ver560 新規作成');
  await page.locator('#taskDescription').fill('Classic既存フォームで作成');
  await page.locator('#taskStatus').selectOption('未着手');
  await page.locator('#taskForm button[type="submit"]').click();
  await expect(page.locator('#taskDialog')).not.toBeVisible();
  const records = await taskRowsV560(page);
  const created = records.find(row => row.title === 'Ver560 新規作成');
  expect(created).toMatchObject({
    revision: 1, description: 'Classic既存フォームで作成', status: '未着手', assignee: '佐藤'
  });
  expect(created.history.some(entry => String(entry?.text ?? entry).includes('タスクを作成しました'))).toBeTruthy();
  expect(records.find(row => row.id === 't2')).toMatchObject({ title: 'プリンタ設定待ち', revision: 1 });
});

test('Ver.560 edit opens Classic details and preserves original form conflict protection', async ({ page }) => {
  await boot(page, { write: true });
  const frame = modern(page);
  await frame.locator('#taskRowsV551 tr[data-task-id="t1"] [data-task-act-v560="edit"]').click();
  await expect(page.locator('iframe[data-modern-task-v551]')).toHaveCount(0);
  await expect(page.locator('#taskDialog')).toBeVisible();
  await expect(page.locator('#taskTitle')).toHaveValue('端末入替の確認');
  await expect(page.locator('#taskStatus')).toHaveValue('対応中');
  await page.locator('#taskTitle').fill('端末入替の修正');
  await page.locator('#taskDescription').fill('詳細の修正履歴');
  await page.locator('#taskForm button[type="submit"]').click();
  await expect(page.locator('#taskDialog')).not.toBeVisible();
  const rows = await taskRowsV560(page);
  expect(rows.find(row => row.id === 't1')).toMatchObject({
    title: '端末入替の修正', description: '詳細の修正履歴', status: '対応中', revision: 3
  });
  expect(rows.find(row => row.id === 't2')).toMatchObject({ title: 'プリンタ設定待ち', revision: 1 });
});

test('Ver.560 status uses Classic transition, revision, completion memo and cancellation', async ({ page }) => {
  await boot(page, { write: true });
  const frame = modern(page);
  const selector = frame.locator('tr[data-task-id="t1"] [data-task-status-v560]');
  await selector.selectOption('確認待ち');
  await expect(frame.locator('#taskActionStatusV560')).toContainText('保存');
  await expect.poll(async () => (await taskRowsV560(page)).find(row => row.id === 't1').revision).toBe(3);
  let saved = (await taskRowsV560(page)).find(row => row.id === 't1');
  expect(saved.status).toBe('確認待ち');
  expect(saved.history.length).toBeGreaterThan(0);

  page.once('dialog', async dialog => dialog.dismiss());
  await selector.selectOption('完了');
  await expect(frame.locator('#taskActionStatusV560')).toContainText('キャンセル');
  saved = (await taskRowsV560(page)).find(row => row.id === 't1');
  expect(saved).toMatchObject({ status: '確認待ち', revision: 3 });

  page.once('dialog', async dialog => dialog.accept('完了時の確認メモ'));
  await selector.selectOption('完了');
  await expect.poll(async () => (await taskRowsV560(page)).find(row => row.id === 't1').revision).toBe(4);
  saved = (await taskRowsV560(page)).find(row => row.id === 't1');
  expect(saved).toMatchObject({ status: '完了', completedMemo: '完了時の確認メモ', revision: 4 });
  expect(saved.completedAt).toBeGreaterThan(0);

  await selector.selectOption('未着手');
  await expect.poll(async () => (await taskRowsV560(page)).find(row => row.id === 't1').revision).toBe(5);
  saved = (await taskRowsV560(page)).find(row => row.id === 't1');
  expect(saved).toMatchObject({ status: '未着手', completedAt: 0, completedMemo: '', revision: 5 });
});

test('Ver.560 rejects stale, wrong-user, wrong-room, and invalid status commands', async ({ page }) => {
  await boot(page, { write: true });
  const oldRecords = await taskRowsV560(page);
  const call = (method, request) => page.evaluate(({ method, request }) =>
    window.WorkBoardTaskActionsV560[method](request), { method, request });
  const request = { roomId: ROOM, selectedUser: '佐藤', id: 't1', expectedRevision: 2 };
  expect((await call('edit', { ...request, expectedRevision: 1 })).error).toBe('revision-or-state-mismatch');
  expect((await call('status', { ...request, selectedUser: '福冨', status: '完了' })).error).toBe('owner-mismatch');
  expect((await call('status', { ...request, roomId: 'test-other', status: '完了' })).error).toBe('owner-mismatch');
  expect((await call('status', { ...request, status: '__unapproved__' })).error).toBe('invalid-status');
  expect((await call('status', { ...request, status: '対応中' })).error).toBe('invalid-status');
  expect(await taskRowsV560(page)).toEqual(oldRecords);
  await page.evaluate(() => {
    const select = document.getElementById('currentUserSelect');
    select.value = '福冨';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(modern(page).locator('#sourceV551')).toContainText('利用者：福冨');
  expect((await call('create', { roomId: ROOM, selectedUser: '佐藤' })).error).toBe('owner-mismatch');
  expect((await call('edit', request)).error).toBe('owner-mismatch');
  await expect(page.locator('#taskDialog')).not.toBeVisible();
});

test('Ver.560 remains read-only without write flag or selected user', async ({ page }) => {
  await boot(page);
  const frame = modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-task-write-v560', 'readonly');
  await expect(frame.locator('#taskNewV560')).toBeHidden();
  await expect(frame.locator('[data-task-act-v560], [data-task-status-v560]')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.WorkBoardTaskActionsV560)).toBe('undefined');
  await page.reload();
  await expect(frame.locator('#taskNewV560')).toBeHidden();
  await page.goto('/modern/product/task-list-read-v551.html');
  await expect(page.locator('body')).toHaveAttribute('data-read-state', 'unavailable');
  await expect(page.locator('#taskNewV560')).toBeHidden();
});

test('Ver.560 mobile status/edit controls render without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, { write: true });
  const frame = modern(page);
  await expect(frame.locator('#taskNewV560')).toBeVisible();
  await expect(frame.locator('[data-task-status-v560]')).toHaveCount(4);
  await expect(frame.locator('[data-task-act-v560="edit"]')).toHaveCount(4);
  expect(await frame.locator('body').evaluate(body =>
    body.ownerDocument.documentElement.scrollWidth - body.ownerDocument.defaultView.innerWidth))
    .toBeLessThanOrEqual(1);
  await expect(frame.locator('#taskRowsV551 img')).toHaveCount(0);
});


test('Ver.561 opens the original Classic detail with comments, history and controls', async ({ page }) => {
  await boot(page, { write: true, advanced: true });
  const frame = modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-task-advanced-v561', 'enabled');
  await expect(frame.locator('[data-task-act-v560="detail"]')).toHaveCount(4);
  await frame.locator('tr[data-task-id="t1"] [data-task-act-v560="detail"]').click();
  await expect(page.locator('iframe[data-modern-task-v551]')).toHaveCount(0);
  await expect(page.locator('.detail-title')).toHaveText('端末入替の確認');
  await expect(page.locator('.detail-panel')).toHaveClass(/open/);
  await expect(page.locator('#detailBody [data-action="delete"]')).toBeVisible();
  await expect(page.locator('#detailBody [data-action="edit"]')).toBeVisible();
  expect((await taskRowsV560(page)).find(t => t.id === 't1').revision).toBe(2);
});

test('Ver.561 cancelling Modern delete never changes tasks or linked schedules', async ({ page }) => {
  await boot(page, { write: true, advanced: true, linked: true });
  const before = await page.evaluate(room => ({
    tasks: localStorage.getItem('system-task-tasks:' + room),
    schedules: localStorage.getItem('system-task-schedules:' + room)
  }), ROOM);
  page.once('dialog', dialog => dialog.dismiss());
  await modern(page).locator('tr[data-task-id="t1"] [data-task-act-v560="remove"]').click();
  await expect(modern(page).locator('#taskActionStatusV560')).toContainText('キャンセル');
  const after = await page.evaluate(room => ({
    tasks: localStorage.getItem('system-task-tasks:' + room),
    schedules: localStorage.getItem('system-task-schedules:' + room)
  }), ROOM);
  expect(after).toEqual(before);
  await expect(modern(page).locator('#taskRowsV551 tr[data-task-id]')).toHaveCount(4);
});

test('Ver.561 Modern delete uses Classic cleanup for linked schedule and keeps unrelated rows', async ({ page }) => {
  await boot(page, { write: true, advanced: true, linked: true });
  const frame = modern(page);
  const before = await page.evaluate(() => window.WorkBoardReadV550.read().tasks);
  page.once('dialog', dialog => dialog.accept());
  await frame.locator('tr[data-task-id="t1"] [data-task-act-v560="remove"]').click();
  await expect(frame.locator('#taskActionStatusV560')).toContainText('タスクを削除しました');
  await expect(frame.locator('#taskRowsV551 tr[data-task-id]')).toHaveCount(3);
  const remaining = await page.evaluate(() => window.WorkBoardReadV550.read().tasks);
  expect(remaining.some(task => task.id === 't1')).toBe(false);
  // The legacy local seed omits timestamps, which Classic synthesizes
  // when persisting the full normalized collection. Compare every canonical
  // business field and revision, excluding only generated seed timestamps.
  const stable = row => {
    const { createdAt, updatedAt, ...fields } = row;
    return fields;
  };
  for (const id of ['t2', 't3', 't4']) {
    expect(stable(remaining.find(task => task.id === id)))
      .toEqual(stable(before.find(task => task.id === id)));
  }
  const schedules = await page.evaluate(room =>
    JSON.parse(localStorage.getItem('system-task-schedules:' + room) || '[]'), ROOM);
  expect(schedules.find(item => item.id === 's-linked')).toMatchObject({
    relatedTaskId: '', revision: 2
  });
  expect(schedules.find(item => item.id === 's-other')).toMatchObject({
    relatedTaskId: 't2', revision: 1
  });
});

test('Ver.561 refuses stale task revision and foreign identity before prompting', async ({ page }) => {
  await boot(page, { write: true, advanced: true });
  const before = await taskRowsV560(page);
  const request = {roomId: ROOM, selectedUser: '佐藤', id: 't1', expectedRevision: 2};
  const call = (method, payload) => page.evaluate(({method,payload}) =>
    window.WorkBoardTaskActionsV560[method](payload), {method,payload});
  expect((await call('remove', {...request, expectedRevision: 1})).error)
    .toBe('revision-or-state-mismatch');
  expect((await call('detail', {...request, selectedUser: '福冨'})).error)
    .toBe('owner-mismatch');
  expect((await call('remove', {...request, roomId: 'test-foreign'})).error)
    .toBe('owner-mismatch');
  expect(await taskRowsV560(page)).toEqual(before);
  await expect(page.locator('.detail-panel')).not.toHaveClass(/open/);
  await page.evaluate(() => {
    const select = document.getElementById('currentUserSelect');
    select.value = '福冨';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect((await call('remove', request)).error).toBe('owner-mismatch');
  expect((await call('detail', request)).error).toBe('owner-mismatch');
  expect(await taskRowsV560(page)).toEqual(before);
});

test('Ver.561 remains on Ver.560 controls without the new opt-in flag', async ({ page }) => {
  await boot(page, { write: true });
  const frame = modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-task-advanced-v561', 'readonly');
  await expect(frame.locator('[data-task-act-v560="remove"], [data-task-act-v560="detail"]'))
    .toHaveCount(0);
  await expect(frame.locator('[data-task-act-v560="edit"]')).toHaveCount(4);
  expect(await page.evaluate(() => typeof window.WorkBoardTaskActionsV560.remove))
    .toBe('undefined');
  expect(await page.evaluate(() => typeof window.WorkBoardTaskActionsV560.detail))
    .toBe('undefined');
});

test('Ver.561 mobile detail/delete controls remain accessible without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, { write: true, advanced: true });
  const frame = modern(page);
  await expect(frame.locator('[data-task-act-v560="remove"]')).toHaveCount(4);
  await expect(frame.locator('[data-task-act-v560="detail"]')).toHaveCount(4);
  expect(await frame.locator('body').evaluate(body =>
    body.ownerDocument.documentElement.scrollWidth - body.ownerDocument.defaultView.innerWidth))
    .toBeLessThanOrEqual(1);
  await expect(frame.locator('#taskRowsV551 img')).toHaveCount(0);
});

for(const width of [1366,390]){
  test('Ver.592 Modern task board/timeline share Classic records, filters and actions at '+width+'px',async({page})=>{
    test.setTimeout(90000);
    await page.setViewportSize({width,height:width>860?900:844});
    await boot(page,{write:true,advanced:true});
    const frame=modern(page);
    const before=await page.evaluate(room=>localStorage.getItem('system-task-tasks:'+room),ROOM);
    await expect(frame.locator('#taskRowsV551 tr[data-task-id]')).toHaveCount(4);
    await frame.locator('[data-task-mode-v318="board"]').click();
    await expect(frame.locator('[data-task-mode-v318="board"]')).toHaveAttribute('aria-pressed','true');
    await expect(frame.locator('#taskBoardV318 [data-task-id]')).toHaveCount(4);
    await expect(frame.locator('#taskRowsV551 tr[data-task-id]')).toHaveCount(0);
    await expect(frame.locator('#taskBoardV318 [data-task-id="t1"] [data-task-status-v560]')).toHaveValue('対応中');
    await expect(frame.locator('#taskBoardV318 [data-task-id="t1"] [data-task-act-v560="detail"]')).toBeVisible();
    await expect(frame.locator('#taskBoardV318 [data-task-id="t1"] [data-task-act-v560="remove"]')).toBeVisible();
    await frame.locator('#taskSearchV551').fill('プリンタ');
    await expect(frame.locator('#taskBoardV318 [data-task-id]')).toHaveCount(1);
    await expect(frame.locator('#taskBoardV318 [data-task-id="t2"]')).toBeVisible();
    await frame.locator('#taskSearchV551').fill('');
    await frame.locator('[data-task-mode-v318="timeline"]').click();
    await expect(frame.locator('#taskTimelineV318 [data-task-id]')).toHaveCount(4);
    await expect(frame.locator('#taskTimelineV318')).toContainText('期限未設定');
    await expect(frame.locator('#taskTimelineV318 [data-task-id="t4"]')).toContainText('<img src=x onerror=window.__injected=true>');
    await expect(frame.locator('#taskTimelineV318 img')).toHaveCount(0);
    expect(await frame.locator('body').evaluate(e=>e.ownerDocument.defaultView.__injected)).toBeUndefined();
    const dimensions=await frame.locator('body').evaluate(e=>{
      const d=e.ownerDocument,win=d.defaultView;
      const buttons=[...d.querySelectorAll('[data-task-mode-v318]')];
      return {overflow:d.documentElement.scrollWidth-win.innerWidth,
        minButton:Math.min(...buttons.map(b=>b.getBoundingClientRect().height))};
    });
    expect(dimensions.overflow).toBeLessThanOrEqual(2);
    expect(dimensions.minButton).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(room=>localStorage.getItem('system-task-tasks:'+room),ROOM)).toBe(before);
    await frame.locator('[data-task-mode-v318="list"]').click();
    await expect(frame.locator('#taskRowsV551 tr[data-task-id]')).toHaveCount(4);
    await expect(frame.locator('#taskBoardV318 [data-task-id]')).toHaveCount(0);
  });
}

test('Ver.592 readonly task board never creates controls or a separate writer',async({page})=>{
  await page.setViewportSize({width:320,height:780});
  await boot(page);
  const frame=modern(page);
  await expect(frame.locator('body')).toHaveAttribute('data-read-state','ready');
  await frame.locator('[data-task-mode-v318="board"]').click();
  await expect(frame.locator('#taskBoardV318 [data-task-id]')).toHaveCount(4);
  await expect(frame.locator('#taskBoardV318 [data-task-act-v560]')).toHaveCount(0);
  await expect(frame.locator('#taskBoardV318 [data-task-status-v560]')).toHaveCount(0);
  const overflow=await frame.locator('body').evaluate(e=>e.ownerDocument.documentElement.scrollWidth-e.ownerDocument.defaultView.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

test('Ver.592 board status change calls Classic once and retains its revision and history',async({page})=>{
  await boot(page,{write:true,advanced:true});
  const frame=modern(page);
  await frame.locator('[data-task-mode-v318="board"]').click();
  await frame.locator('#taskBoardV318 [data-task-id="t1"] [data-task-status-v560]').selectOption('確認待ち');
  await expect.poll(async()=> (await taskRowsV560(page)).find(row=>row.id==='t1').revision).toBe(3);
  const canonical=(await taskRowsV560(page)).find(row=>row.id==='t1');
  expect(canonical.status).toBe('確認待ち');
  expect(canonical.history.length).toBeGreaterThan(0);
  await expect(frame.locator('#taskBoardV318 [data-task-id="t1"] [data-task-status-v560]')).toHaveValue('確認待ち');
  await frame.locator('[data-task-mode-v318="timeline"]').click();
  await expect(frame.locator('#taskTimelineV318 [data-task-id="t1"] [data-task-status-v560]')).toHaveValue('確認待ち');
  expect((await taskRowsV560(page)).filter(row=>row.id==='t1')).toHaveLength(1);
});

for(const width of [1366,390]){
  test('Ver.593 Modern bulk status/assignee shares Classic write and retains CAS at '+width+'px',async({page})=>{
    test.setTimeout(90000);
    await page.setViewportSize({width,height:width===390?844:860});
    await boot(page,{write:true,advanced:true});
    const frame=modern(page);
    await expect(frame.locator('#taskBulkV593')).toBeVisible();
    await expect(frame.locator('#taskRowsV551 [data-task-select-v593]')).toHaveCount(4);
    expect(await frame.locator('#taskRowsV551 .task-bulk-hit-v593').first().evaluate(
      el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await frame.locator('#taskRowsV551 [data-task-id="t1"] [data-task-select-v593]').check();
    await frame.locator('#taskRowsV551 [data-task-id="t4"] [data-task-select-v593]').check();
    await expect(frame.locator('[data-bulk-count-v593]')).toHaveText('2件選択中');
    await frame.locator('#taskBulkActionV593').selectOption('assignee');
    await frame.locator('#taskBulkTargetV593').selectOption('福冨');
    page.once('dialog',async dialog=>{
      expect(dialog.message()).toContain('2件');
      expect(dialog.message()).toContain('担当者');
      await dialog.accept();
    });
    await frame.locator('#taskBulkApplyV593').click();
    await expect(frame.locator('#taskActionStatusV560')).toContainText('2件の一括操作が完了');
    await expect(frame.locator('[data-bulk-count-v593]')).toHaveText('0件選択中');
    const rows=await taskRowsV560(page);
    for(const id of ['t1','t4']){
      expect(rows.find(row=>row.id===id).assignee).toBe('福冨');
      expect(rows.find(row=>row.id===id).history.length).toBeGreaterThan(0);
    }
    expect(rows.find(row=>row.id==='t2').revision).toBe(1);
    const oldUser=await page.evaluate(()=>window.WorkBoardTaskActionsV560.bulk({
      roomId:'other-room',selectedUser:'佐藤',items:[{id:'t1',expectedRevision:3}],
      action:'status',target:'確認待ち'
    }));
    expect(oldUser).toMatchObject({ok:false,error:'owner-mismatch'});
    const stale=await page.evaluate(room=>window.WorkBoardTaskActionsV560.bulk({
      roomId:room,selectedUser:'佐藤',items:[{id:'t1',expectedRevision:2}],
      action:'status',target:'確認待ち'
    }),ROOM);
    expect(stale).toMatchObject({ok:false,error:'revision-or-state-mismatch'});
    const badTarget=await page.evaluate(room=>window.WorkBoardTaskActionsV560.bulk({
      roomId:room,selectedUser:'佐藤',items:[{id:'t2',expectedRevision:1}],
      action:'assignee',target:'未登録の職員'
    }),ROOM);
    expect(badTarget).toMatchObject({ok:false,error:'invalid-target'});
    const overflow=await frame.locator('body').evaluate(el=>
      el.ownerDocument.documentElement.scrollWidth-el.ownerDocument.defaultView.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });
}

test('Ver.593 bulk cancel, filter change and display switch discard unsafe selections',async({page})=>{
  await boot(page,{write:true,advanced:true});
  const frame=modern(page);
  await frame.locator('#taskRowsV551 [data-task-id="t1"] [data-task-select-v593]').check();
  const before=await page.evaluate(room=>localStorage.getItem('system-task-tasks:'+room),ROOM);
  await frame.locator('#taskBulkActionV593').selectOption('delete');
  page.once('dialog',async d=>d.dismiss());
  await frame.locator('#taskBulkApplyV593').click();
  await expect(frame.locator('#taskActionStatusV560')).toContainText('キャンセル');
  expect(await page.evaluate(room=>localStorage.getItem('system-task-tasks:'+room),ROOM)).toBe(before);
  await frame.locator('#taskSearchV551').fill('プリンタ');
  await expect(frame.locator('[data-bulk-count-v593]')).toHaveText('0件選択中');
  await frame.locator('#taskSearchV551').fill('');
  await frame.locator('#taskRowsV551 [data-task-id="t2"] [data-task-select-v593]').check();
  await frame.locator('[data-task-mode-v318="board"]').click();
  await expect(frame.locator('#taskBulkV593')).toBeHidden();
  await frame.locator('[data-task-mode-v318="list"]').click();
  await expect(frame.locator('[data-bulk-count-v593]')).toHaveText('0件選択中');
  await expect(frame.locator('#taskRowsV551 [data-task-select-v593]:checked')).toHaveCount(0);
});

test('Ver.593 Classic bulk delete removes the task and detaches a linked schedule',async({page})=>{
  await boot(page,{write:true,advanced:true,linked:true});
  const frame=modern(page);
  await frame.locator('#taskRowsV551 [data-task-id="t1"] [data-task-select-v593]').check();
  await frame.locator('#taskBulkActionV593').selectOption('delete');
  page.once('dialog',async d=>{
    expect(d.message()).toContain('関連する予定');
    await d.accept();
  });
  await frame.locator('#taskBulkApplyV593').click();
  await expect(frame.locator('#taskActionStatusV560')).toContainText('一括操作が完了');
  const records=await taskRowsV560(page);
  expect(records.some(row=>row.id==='t1')).toBe(false);
  expect(records.some(row=>row.id==='t2')).toBe(true);
  const schedules=await page.evaluate(room=>JSON.parse(localStorage.getItem('system-task-schedules:'+room)),ROOM);
  expect(schedules.find(x=>x.id==='s-linked').relatedTaskId).toBe('');
  expect(schedules.find(x=>x.id==='s-other').relatedTaskId).toBe('t2');
});

test('Ver.593 readonly Modern tasks expose no bulk selectors or write calls',async({page})=>{
  await boot(page);
  const frame=modern(page);
  await expect(frame.locator('#taskBulkV593')).toBeHidden();
  await expect(frame.locator('[data-task-select-v593]')).toHaveCount(0);
  await expect(frame.locator('body')).toHaveAttribute('data-task-write-v560','readonly');
  await expect(frame.locator('#taskRowsV551 [data-task-id]')).toHaveCount(4);
});
