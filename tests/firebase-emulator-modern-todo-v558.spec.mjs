import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-modern-todo-v558';
const HOST = '127.0.0.1';
const PORT = 9000;
const PROD_DATABASE_RE = /https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i;

test.skip(process.env.WORK_BOARD_FIREBASE_E2E !== '1', 'isolated RTDB Emulator only');
test.describe.configure({ mode: 'serial' });

function emulatorUrl(path) {
  return 'http://' + HOST + ':' + PORT + '/' +
    path.split('/').map(encodeURIComponent).join('/') + '.json?ns=' + encodeURIComponent(PROJECT);
}
async function dbRequest(path, method = 'GET', body) {
  const response = await fetch(emulatorUrl(path), {
    method, headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) throw new Error(method + ' ' + path + ': HTTP ' + response.status);
  return response.json();
}
const dbRead = path => dbRequest(path);
const dbPut = (path, body) => dbRequest(path, 'PUT', body);
const dbDelete = path => dbRequest(path, 'DELETE');

function todo(id, text, owner, order) {
  const now = Date.now();
  return {
    id, owner, text, memo: '初期メモ：' + id,
    order, completed: false, completedAt: 0,
    createdAt: now - 10000, updatedAt: now, revision: 1
  };
}
const BASE = () => ({
  'base-1': todo('base-1', '共同編集の対象', '福冨', 0),
  'base-2': todo('base-2', '並べ替えの相手', '福冨', 1024),
  'other': todo('other', '別ユーザーの情報', '森井', 2048)
});
test.beforeEach(async () => {
  await dbDelete('rooms/' + ROOM);
  await dbPut('rooms/' + ROOM + '/meta', {
    users: ['福冨', '森井'],
    userColors: { '福冨': '#3c92df', '森井': '#4ebd69' },
    _revisions: { users: 1, userColors: 1 }
  });
  await dbPut('rooms/' + ROOM + '/todos', BASE());
});

async function boot(page) {
  const unsafeRequests = [];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(({ room, project, host, port }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', '福冨');
    const config = Object.freeze({
      apiKey: 'demo-api-key', authDomain: project + '.firebaseapp.com',
      databaseURL: 'http://' + host + ':' + port + '/?ns=' + project,
      projectId: project, appId: '1:000000000000:web:firebase-emulator-only'
    });
    window.WORK_BOARD_TEST = Object.freeze({
      emulator: true, host, port,
      modernReadV552: true, modernWriteV557: true, modernWriteV558: true
    });
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return config; }, set() {}
    });
  }, { room: ROOM, project: PROJECT, host: HOST, port: PORT });
  await page.route(PROD_DATABASE_RE, route => {
    unsafeRequests.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  page.on('request', request => {
    if (PROD_DATABASE_RE.test(request.url())) unsafeRequests.push(request.url());
  });
  await page.goto('/?room=' + ROOM + '&modernReadV552=1&modernWriteV557=1&modernWriteV558=1',
    { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true,
    undefined, { timeout: 30000 });
  await page.waitForFunction(() => {
    const read = window.WorkBoardReadV550?.read?.();
    return read?.ready === true && read?.source === 'remote-online'
      && read.todos.some(row => row.id === 'base-1' && row.revision === 1);
  }, undefined, { timeout: 30000 });
  const frame = page.frameLocator('iframe[data-modern-todo-v552]');
  await frame.locator('#refreshV552').click();
  await expect(frame.locator('body')).toHaveAttribute('data-read-state', 'ready');
  await expect(frame.locator('body')).toHaveAttribute('data-todo-manage-v558', 'enabled');
  expect(pageErrors).toEqual([]);
  expect(unsafeRequests).toEqual([]);
  return { frame, unsafeRequests, pageErrors };
}

test('Modern ToDo CRUD persists via the existing Classic Firebase owner', async ({ page }) => {
  const safety = await boot(page);
  const frame = safety.frame;
  const otherBefore = await dbRead('rooms/' + ROOM + '/todos/other');
  await frame.locator('#todoNewV558').click();
  await frame.locator('#todoTextV558').fill('Modernから共同作成');
  await frame.locator('#todoMemoV558').fill('Classic経由で共同保存');
  await frame.locator('#todoSaveV558').click();
  await expect(frame.locator('#todoFormV558')).toHaveCount(0);
  const records = await dbRead('rooms/' + ROOM + '/todos');
  const createdEntry = Object.entries(records).find(([, row]) => row.text === 'Modernから共同作成');
  expect(createdEntry).toBeTruthy();
  const [id, created] = createdEntry;
  expect(created).toMatchObject({
    id, owner: '福冨', memo: 'Classic経由で共同保存', completed: false, revision: 1
  });

  await frame.locator('#openRowsV552 [data-todo-id="' + id + '"] [data-todo-act-v558="update"]').click();
  await frame.locator('#todoTextV558').fill('Modernから共同編集');
  await frame.locator('#todoMemoV558').fill('共同編集後の詳細');
  await frame.locator('#todoSaveV558').click();
  await expect(frame.locator('#todoFormV558')).toHaveCount(0);
  await expect.poll(() => dbRead('rooms/' + ROOM + '/todos/' + id))
    .toMatchObject({ text: 'Modernから共同編集', memo: '共同編集後の詳細', revision: 2 });

  await frame.locator('#openRowsV552 [data-todo-id="' + id
    + '"] [data-todo-act-v558="reorder"][data-direction="1"]').click();
  await expect(frame.locator('#openRowsV552 [data-todo-id]').first())
    .toHaveAttribute('data-todo-id', 'base-1');
  const moved = await dbRead('rooms/' + ROOM + '/todos');
  expect(moved[id].revision).toBe(3);
  expect(moved['base-1'].revision).toBe(2);

  page.once('dialog', dialog => dialog.accept());
  await frame.locator('#openRowsV552 [data-todo-id="' + id
    + '"] [data-todo-act-v558="remove"]').click();
  await expect(frame.locator('#openRowsV552 [data-todo-id="' + id + '"]')).toHaveCount(0);
  expect(await dbRead('rooms/' + ROOM + '/todos/' + id)).toBeNull();
  expect(await dbRead('rooms/' + ROOM + '/todos/other')).toEqual(otherBefore);
  expect(safety.unsafeRequests).toEqual([]);
  expect(safety.pageErrors).toEqual([]);
});

test('Modern ToDo refuses a stale edit from another browser context', async ({ browser }) => {
  const pageA = await browser.newPage();
  const pageB = await browser.newPage();
  try {
    const a = await boot(pageA);
    const b = await boot(pageB);
    await b.frame.locator('#openRowsV552 [data-todo-id="base-1"] [data-todo-act-v558="update"]').click();
    await b.frame.locator('#todoTextV558').fill('Bが入力した未保存内容');
    await b.frame.locator('#todoMemoV558').fill('編集中のメモも保持する');
    await a.frame.locator('#openRowsV552 [data-todo-id="base-1"] [data-todo-act-v558="update"]').click();
    await a.frame.locator('#todoTextV558').fill('Aが先に保存した内容');
    await a.frame.locator('#todoMemoV558').fill('Aの保存が正本');
    await a.frame.locator('#todoSaveV558').click();
    await expect.poll(async () => (await dbRead('rooms/' + ROOM + '/todos/base-1')).revision)
      .toBe(2);
    await pageB.waitForFunction(() => {
      const read = window.WorkBoardReadV550?.read?.();
      return read?.ready === true && [...read.todos, ...read.todoHistory]
        .some(row => row.id === 'base-1' && row.revision === 2);
    }, undefined, { timeout: 30000 });
    await b.frame.locator('#todoSaveV558').click();
    await expect(b.frame.locator('#todoActionStatusV557')).toContainText('保存できませんでした');
    await expect(b.frame.locator('#todoTextV558')).toHaveValue('Bが入力した未保存内容');
    await expect(b.frame.locator('#todoMemoV558')).toHaveValue('編集中のメモも保持する');
    expect(await dbRead('rooms/' + ROOM + '/todos/base-1')).toMatchObject({
      text: 'Aが先に保存した内容', memo: 'Aの保存が正本', revision: 2
    });
    expect(a.unsafeRequests).toEqual([]);
    expect(b.unsafeRequests).toEqual([]);
    expect(a.pageErrors).toEqual([]);
    expect(b.pageErrors).toEqual([]);
  } finally {
    await pageA.close();
    await pageB.close();
  }
});
