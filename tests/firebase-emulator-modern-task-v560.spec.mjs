import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-modern-task-v560';
const HOST = '127.0.0.1';
const PORT = 9000;
const PROD_DATABASE_RE = /https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i;

test.skip(process.env.WORK_BOARD_FIREBASE_E2E !== '1', 'isolated RTDB Emulator only');
test.describe.configure({ mode: 'serial' });

function url(path) {
  return 'http://' + HOST + ':' + PORT + '/' +
    path.split('/').map(encodeURIComponent).join('/') + '.json?ns=' + encodeURIComponent(PROJECT);
}
async function db(path, method = 'GET', value) {
  const response = await fetch(url(path), {
    method, headers: value === undefined ? undefined : { 'content-type': 'application/json' },
    body: value === undefined ? undefined : JSON.stringify(value)
  });
  if (!response.ok) throw new Error(method + ': ' + path + ' HTTP ' + response.status);
  return response.json();
}
const read = path => db(path);
const put = (path, value) => db(path, 'PUT', value);

function task(id, title, status, owner) {
  const now = Date.now();
  return {
    id, title, status, assignee: owner, category: 'PC', priority: '中',
    description: 'もとの詳細：' + id, requester: '確認元',
    createdAt: now - 5000, updatedAt: now, createdBy: '福冨',
    updatedBy: '福冨', completedAt: 0, completedMemo: '', dueDate: '',
    comments: [], checklist: [], history: [], recurrence: 'none', revision: 1
  };
}

test.beforeEach(async () => {
  await db('rooms/' + ROOM, 'DELETE');
  await put('rooms/' + ROOM + '/meta', {
    users: ['福冨', '森井'],
    userColors: { '福冨': '#3c92df', '森井': '#4ebd69' },
    _revisions: { users: 1, userColors: 1 }
  });
  await put('rooms/' + ROOM + '/tasks', {
    'base-1': task('base-1', '共同の設定作業', '対応中', '福冨'),
    'base-2': task('base-2', '別担当の確認', '未着手', '森井')
  });
});

async function boot(page, { advanced = false } = {}) {
  const unsafeRequests = [];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(({ room, project, host, port, advanced }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', '福冨');
    const config = Object.freeze({
      apiKey: 'demo-api-key', authDomain: project + '.firebaseapp.com',
      databaseURL: 'http://' + host + ':' + port + '/?ns=' + project,
      projectId: project, appId: '1:000000000000:web:firebase-emulator-only'
    });
    window.WORK_BOARD_TEST = Object.freeze({
      emulator: true, host, port, modernReadV551: true, modernWriteV560: true,
      modernWriteV561: advanced
    });
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return config; }, set() {}
    });
  }, { room: ROOM, project: PROJECT, host: HOST, port: PORT, advanced });
  await page.route(PROD_DATABASE_RE, route => {
    unsafeRequests.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  page.on('request', request => {
    if (PROD_DATABASE_RE.test(request.url())) unsafeRequests.push(request.url());
  });
  await page.goto('/?room=' + ROOM + '&modernReadV551=1&modernWriteV560=1&modernWriteV561=1',
    { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const source = window.WorkBoardReadV550?.read?.();
    return window.WORK_BOARD_ASSETS_READY === true
      && source?.ready === true && source?.source === 'remote-online'
      && source.tasks.some(task => task.id === 'base-1' && task.revision >= 1);
  }, undefined, { timeout: 30000 });
  const frame = page.frameLocator('iframe[data-modern-task-v551]');
  await frame.locator('#refreshV551').click();
  await expect(frame.locator('body')).toHaveAttribute('data-task-write-v560', 'enabled');
  expect(pageErrors).toEqual([]);
  expect(unsafeRequests).toEqual([]);
  return { frame, unsafeRequests, pageErrors };
}

test('Modern task status and completed memo persist through Classic RTDB writer', async ({ page }) => {
  const safety = await boot(page);
  const selector = safety.frame.locator('tr[data-task-id="base-1"] [data-task-status-v560]');
  const otherBefore = await read('rooms/' + ROOM + '/tasks/base-2');
  await selector.selectOption('確認待ち');
  await expect.poll(() => read('rooms/' + ROOM + '/tasks/base-1'))
    .toMatchObject({ status: '確認待ち', revision: 2 });
  page.once('dialog', async dialog => dialog.accept('作業完了時の記録'));
  await selector.selectOption('完了');
  await expect.poll(() => read('rooms/' + ROOM + '/tasks/base-1'))
    .toMatchObject({ status: '完了', completedMemo: '作業完了時の記録', revision: 3 });
  const saved = await read('rooms/' + ROOM + '/tasks/base-1');
  expect(saved.completedAt).toBeGreaterThan(0);
  expect(saved.history.length).toBeGreaterThan(0);
  expect(await read('rooms/' + ROOM + '/tasks/base-2')).toEqual(otherBefore);
  expect(safety.unsafeRequests).toEqual([]);
  expect(safety.pageErrors).toEqual([]);
});

test('Modern task new/edit opens the real Classic form and saves RTDB revisions', async ({ page }) => {
  const safety = await boot(page);
  await safety.frame.locator('#taskNewV560').click();
  await expect(page.locator('iframe[data-modern-task-v551]')).toHaveCount(0);
  await expect(page.locator('#taskDialog')).toBeVisible();
  await page.locator('#taskTitle').fill('Modernから作成する新規タスク');
  await page.locator('#taskDescription').fill('Classicの共通フォームで保存');
  await page.locator('#taskForm button[type="submit"]').click();
  await expect(page.locator('#taskDialog')).not.toBeVisible();
  await expect.poll(async () => Object.values(await read('rooms/' + ROOM + '/tasks') || {})
    .some(row => row.title === 'Modernから作成する新規タスク')).toBe(true);
  const all = await read('rooms/' + ROOM + '/tasks');
  expect(Object.values(all).filter(row => row.title === 'Modernから作成する新規タスク'))
    .toHaveLength(1);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WorkBoardReadV550?.read?.()?.ready === true,
    undefined, { timeout: 30000 });
  const frame = page.frameLocator('iframe[data-modern-task-v551]');
  await frame.locator('#refreshV551').click();
  await frame.locator('tr[data-task-id="base-1"] [data-task-act-v560="edit"]').click();
  await expect(page.locator('#taskDialog')).toBeVisible();
  await expect(page.locator('#taskTitle')).toHaveValue('共同の設定作業');
  await page.locator('#taskTitle').fill('共同の設定作業を更新');
  await page.locator('#taskForm button[type="submit"]').click();
  await expect(page.locator('#taskDialog')).not.toBeVisible();
  await expect.poll(() => read('rooms/' + ROOM + '/tasks/base-1'))
    .toMatchObject({ title: '共同の設定作業を更新', revision: 2, status: '対応中' });
  const edited = await read('rooms/' + ROOM + '/tasks/base-1');
  expect(edited.history.length).toBeGreaterThan(0);
  expect(await read('rooms/' + ROOM + '/tasks/base-2')).toMatchObject({ title: '別担当の確認', revision: 1 });
  expect(safety.unsafeRequests).toEqual([]);
  expect(safety.pageErrors).toEqual([]);
});

test('Modern task stale Classic form refuses a simultaneous editor and retains input', async ({ browser }) => {
  const a = await browser.newPage();
  const b = await browser.newPage();
  try {
    const first = await boot(a);
    const second = await boot(b);
    await second.frame.locator('tr[data-task-id="base-1"] [data-task-act-v560="edit"]').click();
    await expect(b.locator('#taskDialog')).toBeVisible();
    await b.locator('#taskTitle').fill('Bが入力した未保存の変更');
    await first.frame.locator('tr[data-task-id="base-1"] [data-task-status-v560]')
      .selectOption('確認待ち');
    await expect.poll(() => read('rooms/' + ROOM + '/tasks/base-1'))
      .toMatchObject({ status: '確認待ち', revision: 2 });
    await b.waitForFunction(() =>
      window.WorkBoardReadV550?.read?.()?.tasks.some(t => t.id === 'base-1' && t.revision === 2),
      undefined, { timeout: 30000 });
    await b.locator('#taskForm button[type="submit"]').click();
    await expect(b.locator('#taskDialog')).toBeVisible();
    await expect(b.locator('#taskTitle')).toHaveValue('Bが入力した未保存の変更');
    expect(await read('rooms/' + ROOM + '/tasks/base-1')).toMatchObject({
      title: '共同の設定作業', status: '確認待ち', revision: 2
    });
    expect(first.unsafeRequests).toEqual([]);
    expect(second.unsafeRequests).toEqual([]);
    expect(first.pageErrors).toEqual([]);
    expect(second.pageErrors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});


test('Modern task completion prompt retains the old revision while a peer edits', async ({ browser }) => {
  const a = await browser.newPage();
  const b = await browser.newPage();
  try {
    const first = await boot(a);
    const second = await boot(b);
    const opened = new Promise(resolve => b.once('dialog', resolve));
    const attempted = second.frame.locator('tr[data-task-id="base-1"] [data-task-status-v560]')
      .selectOption('完了');
    const prompt = await opened;
    expect(prompt.type()).toBe('prompt');
    await first.frame.locator('tr[data-task-id="base-1"] [data-task-status-v560]')
      .selectOption('確認待ち');
    await expect.poll(() => read('rooms/' + ROOM + '/tasks/base-1'))
      .toMatchObject({ status: '確認待ち', revision: 2 });
    await prompt.accept('更新前に開始した完了メモ');
    await attempted;
    await expect(second.frame.locator('#taskActionStatusV560')).toContainText('操作できませんでした');
    const winner = await read('rooms/' + ROOM + '/tasks/base-1');
    expect(winner).toMatchObject({
      status: '確認待ち', revision: 2, completedMemo: '', completedAt: 0
    });
    expect(first.unsafeRequests).toEqual([]);
    expect(second.unsafeRequests).toEqual([]);
    expect(first.pageErrors).toEqual([]);
    expect(second.pageErrors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});


test('Modern task delete preserves unrelated task and cleans linked schedules and knowledge in RTDB', async ({ page }) => {
  await put('rooms/' + ROOM + '/schedules', {
    's-link': {id:'s-link',title:'連携中の予定',relatedTaskId:'base-1',revision:1,startDate:'2026-10-31'},
    's-other': {id:'s-other',title:'無関係の予定',relatedTaskId:'base-2',revision:1,startDate:'2026-11-01'}
  });
  await put('rooms/' + ROOM + '/knowledge', {
    'k-link': {id:'k-link',title:'タスクのナレッジ',taskId:'base-1',revision:1},
    'k-other': {id:'k-other',title:'別のナレッジ',taskId:'base-2',revision:1}
  });
  const safety = await boot(page, { advanced: true });
  const frame = safety.frame;
  await expect(frame.locator('body')).toHaveAttribute('data-task-advanced-v561','enabled');
  const unrelatedTask = await read('rooms/' + ROOM + '/tasks/base-2');
  const unrelatedSchedule = await read('rooms/' + ROOM + '/schedules/s-other');
  const unrelatedKnowledge = await read('rooms/' + ROOM + '/knowledge/k-other');
  page.once('dialog', dialog => dialog.accept());
  await frame.locator('tr[data-task-id="base-1"] [data-task-act-v560="remove"]').click();
  await expect.poll(() => read('rooms/' + ROOM + '/tasks/base-1')).toBeNull();
  await expect.poll(() => read('rooms/' + ROOM + '/schedules/s-link'))
    .toMatchObject({relatedTaskId:'',revision:2});
  await expect.poll(() => read('rooms/' + ROOM + '/knowledge/k-link')).toBeNull();
  await expect(frame.locator('#taskActionStatusV560')).toContainText('タスクを削除しました');
  expect(await read('rooms/' + ROOM + '/tasks/base-2')).toEqual(unrelatedTask);
  expect(await read('rooms/' + ROOM + '/schedules/s-other')).toEqual(unrelatedSchedule);
  expect(await read('rooms/' + ROOM + '/knowledge/k-other')).toEqual(unrelatedKnowledge);
  expect(safety.unsafeRequests).toEqual([]);
  expect(safety.pageErrors).toEqual([]);
});

test('Modern task delete sees a related-record conflict and reuses the Classic review dialog', async ({ page }) => {
  await put('rooms/' + ROOM + '/schedules/s-link',
    {id:'s-link',title:'現在の関連予定',relatedTaskId:'base-1',revision:1,startDate:'2026-10-31'});
  const safety = await boot(page, { advanced: true });
  const original = await read('rooms/' + ROOM + '/tasks/base-1');
  page.once('dialog', async dialog => {
    // Another user adds a related schedule while the confirmation is open.
    await put('rooms/' + ROOM + '/schedules/s-new',
      {id:'s-new',title:'別利用者の追加予定',relatedTaskId:'base-1',revision:1,startDate:'2026-11-02'});
    await dialog.accept();
  });
  await safety.frame.locator('tr[data-task-id="base-1"] [data-task-act-v560="remove"]').click();
  await expect(page.locator('iframe[data-modern-task-v551]')).toHaveCount(0);
  await expect(page.locator('#deleteConflictDialog')).toBeVisible();
  await expect(page.locator('#deleteConflictSummary')).toContainText('更新');
  expect(await read('rooms/' + ROOM + '/tasks/base-1')).toEqual(original);
  expect(await read('rooms/' + ROOM + '/schedules/s-new')).toMatchObject({
    relatedTaskId:'base-1',revision:1
  });
  await page.locator('#cancelDeleteConflict').click();
  await expect(page.locator('#deleteConflictDialog')).not.toBeVisible();
  expect(safety.unsafeRequests).toEqual([]);
  expect(safety.pageErrors).toEqual([]);
});

test('Modern task detail routes to Classic and never mutates Firebase on open', async ({ page }) => {
  const safety = await boot(page, { advanced: true });
  const before = await read('rooms/' + ROOM + '/tasks');
  await safety.frame.locator('tr[data-task-id="base-1"] [data-task-act-v560="detail"]').click();
  await expect(page.locator('iframe[data-modern-task-v551]')).toHaveCount(0);
  await expect(page.locator('.detail-panel')).toHaveClass(/open/);
  await expect(page.locator('.detail-title')).toHaveText('共同の設定作業');
  await expect(page.locator('#detailBody [data-action="delete"]')).toBeVisible();
  await expect(page.locator('#detailBody [data-action="edit"]')).toBeVisible();
  expect(await read('rooms/' + ROOM + '/tasks')).toEqual(before);
  expect(safety.unsafeRequests).toEqual([]);
  expect(safety.pageErrors).toEqual([]);
});

test('Modern task delete rejects stale or foreign intent without opening a confirmation', async ({ page }) => {
  const safety = await boot(page, { advanced: true });
  const old = await read('rooms/' + ROOM + '/tasks/base-1');
  await put('rooms/' + ROOM + '/tasks/base-1',{
    ...old,title:'別端末が先に更新した件名',revision:2,updatedAt:Date.now()
  });
  await page.waitForFunction(() => window.WorkBoardReadV550?.read?.()?.tasks
    .some(task => task.id === 'base-1' && task.revision === 2), undefined, {timeout:30000});
  const call = request => page.evaluate(request => window.WorkBoardTaskActionsV560.remove(request), request);
  const request = {roomId:ROOM,selectedUser:'福冨',id:'base-1',expectedRevision:1};
  expect((await call(request)).error).toBe('revision-or-state-mismatch');
  expect((await call({...request,roomId:'test-other'})).error).toBe('owner-mismatch');
  expect((await call({...request,selectedUser:'森井'})).error).toBe('owner-mismatch');
  expect(await read('rooms/' + ROOM + '/tasks/base-1')).toMatchObject({
    title:'別端末が先に更新した件名',revision:2
  });
  expect(safety.unsafeRequests).toEqual([]);
  expect(safety.pageErrors).toEqual([]);
});
