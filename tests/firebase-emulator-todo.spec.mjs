import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-todo-e2e';
const HOST = '127.0.0.1';
const PORT = 9000;
const PROD_DATABASE_RE = /https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i;

test.skip(process.env.WORK_BOARD_FIREBASE_E2E !== '1', 'requires the isolated RTDB emulator');
test.describe.configure({ mode: 'serial' });

function emulatorUrl(path = '') {
  const encoded = String(path || '')
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return `http://${HOST}:${PORT}/${encoded ? `${encoded}.json` : '.json'}?ns=${encodeURIComponent(PROJECT)}`;
}

async function emulatorRequest(path, { method = 'GET', value } = {}) {
  const response = await fetch(emulatorUrl(path), {
    method,
    headers: value === undefined ? undefined : { 'content-type': 'application/json' },
    body: value === undefined ? undefined : JSON.stringify(value)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path || '/'} failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const readDb = path => emulatorRequest(path);
const putDb = (path, value) => emulatorRequest(path, { method: 'PUT', value });
const deleteDb = path => emulatorRequest(path, { method: 'DELETE' });

function todoRecord(id, text, overrides = {}) {
  const now = Date.now();
  return {
    id,
    text,
    memo: '',
    completed: false,
    order: 100,
    owner: '福冨',
    revision: 1,
    createdAt: now - 10_000,
    updatedAt: now,
    completedAt: 0,
    ...overrides
  };
}

async function installEmulatorBoundary(page) {
  const productionRequests = [];

  await page.addInitScript(({ project, room, host, port }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
    } catch {}

    const demoConfig = Object.freeze({
      apiKey: 'demo-api-key',
      authDomain: `${project}.firebaseapp.com`,
      databaseURL: `http://${host}:${port}/?ns=${project}`,
      projectId: project,
      appId: '1:000000000000:web:firebase-emulator-only'
    });

    window.WORK_BOARD_TEST = Object.freeze({ emulator: true, host, port });
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return demoConfig; },
      set() {}
    });
  }, { project: PROJECT, room: ROOM, host: HOST, port: PORT });

  await page.route(PROD_DATABASE_RE, route => {
    productionRequests.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  page.on('request', request => {
    if (PROD_DATABASE_RE.test(request.url())) productionRequests.push(request.url());
  });

  return productionRequests;
}

async function clickCurrent(page, selector) {
  const clicked = await page.evaluate(sel => {
    const node = document.querySelector(sel);
    if (!(node instanceof HTMLElement)) return false;
    node.click();
    return true;
  }, selector);
  expect(clicked, `expected clickable element: ${selector}`).toBeTruthy();
}

async function bootTodoPage(page) {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const productionRequests = await installEmulatorBoundary(page);

  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('connectionPill')?.textContent?.includes('共同編集ON'), undefined, { timeout: 30_000 });
  await clickCurrent(page, '.nav-item[data-layout="todos"]');
  await expect(page.locator('#todoView')).toBeVisible();
  await expect(page.locator('#todoView [data-todo-form]')).toBeVisible();

  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);
  return { productionRequests };
}

async function waitForTodoRow(page, id) {
  await expect(page.locator(`#todoView .todo-item[data-todo-id="${id}"]`)).toBeVisible({ timeout: 30_000 });
}

async function readTodo(id) {
  return readDb(`rooms/${ROOM}/todos/${id}`);
}

async function findTaskByTitle(title) {
  const tasks = await readDb(`rooms/${ROOM}/tasks`) || {};
  const entry = Object.entries(tasks).find(([, task]) => task?.title === title);
  return entry ? { id: entry[0], ...entry[1] } : null;
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('adds a personal ToDo with memo through the real form and persists a canonical record', async ({ page }) => {
  const { productionRequests } = await bootTodoPage(page);

  await page.locator('#todayTodoInput').fill('Emulator ToDo追加確認');
  const memoDisclosure = page.locator('.todo-compose-details > summary');
  await memoDisclosure.focus();
  await page.keyboard.press('Enter');
  await page.locator('#todayTodoMemo').fill('追加時のメモもRTDBへ保存する');
  await page.locator('[data-todo-form] .todo-add-button').click();

  const created = await expect.poll(async () => {
    const records = await readDb(`rooms/${ROOM}/todos`) || {};
    const entry = Object.entries(records).find(([, todo]) => todo?.text === 'Emulator ToDo追加確認');
    return entry ? { key: entry[0], ...entry[1] } : null;
  }, { timeout: 15_000 }).toMatchObject({
    text: 'Emulator ToDo追加確認',
    memo: '追加時のメモもRTDBへ保存する',
    owner: '福冨',
    completed: false,
    revision: 1
  });

  const records = await readDb(`rooms/${ROOM}/todos`) || {};
  const [id, record] = Object.entries(records).find(([, todo]) => todo?.text === 'Emulator ToDo追加確認');
  expect(record.id).toBe(id);
  expect(Number(record.createdAt)).toBeGreaterThan(0);
  expect(Number(record.updatedAt)).toBeGreaterThan(0);
  expect(productionRequests).toEqual([]);
});

test('completes a ToDo through the Ver.144 control and persists completion metadata', async ({ page }) => {
  const id = 'todo-complete-e2e';
  await putDb(`rooms/${ROOM}/todos/${id}`, todoRecord(id, 'Emulator ToDo完了確認'));

  const { productionRequests } = await bootTodoPage(page);
  await waitForTodoRow(page, id);
  const selector = `#todoView .todo-item[data-todo-id="${id}"] .todo-state-toggle-v144`;
  await expect(page.locator(selector)).toBeVisible();
  await clickCurrent(page, selector);

  await expect.poll(() => readTodo(id), { timeout: 15_000 }).toMatchObject({
    id,
    text: 'Emulator ToDo完了確認',
    completed: true,
    revision: 2
  });
  const stored = await readTodo(id);
  expect(Number(stored.completedAt)).toBeGreaterThan(0);
  expect(Number(stored.updatedAt)).toBeGreaterThan(0);
  expect(productionRequests).toEqual([]);
});

test('edits ToDo title and memo and increments revision', async ({ page }) => {
  const id = 'todo-edit-e2e';
  const initial = todoRecord(id, '編集前ToDo', { memo: '編集前メモ' });
  await putDb(`rooms/${ROOM}/todos/${id}`, initial);

  const { productionRequests } = await bootTodoPage(page);
  await waitForTodoRow(page, id);
  const row = page.locator(`#todoView .todo-item[data-todo-id="${id}"]`);
  await row.locator('.todo-summary-button').click();
  await row.locator('.todo-detail input').fill('編集後ToDo');
  await row.locator('.todo-detail textarea').fill('編集後メモ');
  await clickCurrent(page, `#todoView .todo-item[data-todo-id="${id}"] .todo-detail-save`);

  await expect.poll(() => readTodo(id), { timeout: 15_000 }).toMatchObject({
    id,
    text: '編集後ToDo',
    memo: '編集後メモ',
    completed: false,
    revision: 2
  });
  const stored = await readTodo(id);
  expect(Number(stored.updatedAt)).toBeGreaterThanOrEqual(Number(initial.updatedAt));
  expect(productionRequests).toEqual([]);
});

test('promotes a ToDo into a task while carrying memo forward and completing the source ToDo', async ({ page }) => {
  const id = 'todo-promote-e2e';
  const title = 'Emulator ToDoタスク化確認';
  const memo = 'このメモを正式タスクへ引き継ぐ';
  await putDb(`rooms/${ROOM}/todos/${id}`, todoRecord(id, title, { memo }));

  const { productionRequests } = await bootTodoPage(page);
  await waitForTodoRow(page, id);
  await clickCurrent(page, `#todoView .todo-item[data-todo-id="${id}"] .todo-promote-button`);

  await expect(page.locator('#taskDialog')).toBeVisible();
  await expect(page.locator('#taskTitle')).toHaveValue(title);
  await expect(page.locator('#taskDescription')).toHaveValue(memo);
  await page.locator('#taskForm button[type="submit"]').click();

  await expect.poll(() => findTaskByTitle(title), { timeout: 20_000 }).toMatchObject({
    title,
    description: memo,
    createdBy: '福冨'
  });
  await expect.poll(() => readTodo(id), { timeout: 20_000 }).toMatchObject({
    id,
    text: title,
    memo,
    completed: true,
    revision: 2
  });
  const storedTodo = await readTodo(id);
  expect(Number(storedTodo.completedAt)).toBeGreaterThan(0);
  expect(productionRequests).toEqual([]);
});

test('shows a Firebase-synchronized prior completion in the read-only seven-day history', async ({ page }) => {
  const id = 'todo-history-e2e';
  const completedAt = Date.now() - 24 * 60 * 60 * 1000;
  await putDb(`rooms/${ROOM}/todos/${id}`, todoRecord(id, 'Emulator ToDo履歴確認', {
    memo: '履歴表示用メモ',
    completed: true,
    completedAt,
    updatedAt: completedAt,
    revision: 4
  }));

  const { productionRequests } = await bootTodoPage(page);
  await expect.poll(async () => page.locator('#todoView .todo-history-v146').textContent(), { timeout: 30_000 })
    .toContain('Emulator ToDo履歴確認');

  await clickCurrent(page, '#todoView .todo-history-toggle-v146');
  await expect(page.locator('#todoView .todo-history-body-v146')).toBeVisible();
  await expect(page.locator(`#todoView [data-history-todo-id="${id}"]`)).toContainText('Emulator ToDo履歴確認');
  await expect(page.locator(`#todoView [data-history-todo-id="${id}"]`)).toContainText('履歴表示用メモ');
  expect(productionRequests).toEqual([]);
});
