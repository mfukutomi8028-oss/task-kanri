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

  await expect.poll(async () => {
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

  const { productionRequests } = await bootTodoPage(page);
  await putDb(`rooms/${ROOM}/todos/${id}`, todoRecord(id, 'Emulator ToDo履歴確認', {
    memo: '履歴表示用メモ',
    completed: true,
    completedAt,
    updatedAt: completedAt,
    revision: 4
  }));

  await expect.poll(async () => page.locator('#todoView .todo-history-v146').textContent(), { timeout: 30_000 })
    .toContain('Emulator ToDo履歴確認');

  await clickCurrent(page, '#todoView .todo-history-toggle-v146');
  await expect(page.locator('#todoView .todo-history-body-v146')).toBeVisible();
  await expect(page.locator(`#todoView [data-history-todo-id="${id}"]`)).toContainText('Emulator ToDo履歴確認');
  await expect(page.locator(`#todoView [data-history-todo-id="${id}"]`)).toContainText('履歴表示用メモ');
  expect(productionRequests).toEqual([]);
});

test('remote changes keep a draft visible and require loading latest before saving', async ({ page }) => {
  const id = 'todo-concurrent-draft-v527';
  const first = todoRecord(id, '共有の確認事項', { memo: 'もとのメモ' });
  await putDb('rooms/' + ROOM + '/todos/' + id, first);
  const { productionRequests } = await bootTodoPage(page);
  const row = page.locator('#todoView [data-todo-id="' + id + '"]');
  await row.locator('.todo-summary-button').click();
  await row.locator('.todo-detail input').fill('私が編集中の件名');
  await row.locator('.todo-detail textarea').fill('途中まで入力した文章');

  await putDb('rooms/' + ROOM + '/todos/' + id, {
    ...first, text: 'ほかの端末が更新した件名', memo: '先方の追加事項',
    revision: 2, updatedAt: first.updatedAt + 1000
  });
  await expect(row.locator('.todo-edit-conflict-v527')).toBeVisible({ timeout: 30_000 });
  await expect(row.locator('.todo-detail input')).toHaveValue('私が編集中の件名');
  await expect(row.locator('.todo-detail textarea')).toHaveValue('途中まで入力した文章');
  await expect(row.locator('.todo-detail-save')).toBeDisabled();
  await row.locator('.todo-edit-conflict-v527 summary').click();
  await expect(row.locator('.todo-edit-latest-v527')).toContainText('ほかの端末が更新した件名');
  const mine = row.locator('.todo-edit-mine-v529');
  const remote = row.locator('.todo-edit-latest-v529');
  await expect(mine).toContainText('私が編集中の件名');
  await expect(mine).toContainText('途中まで入力した文章');
  await expect(remote).toContainText('先方の追加事項');
  await expect(row.locator('.todo-edit-differences-v529')).toContainText('両方が変更');

  // Comparison follows further draft typing; it never writes into Firebase.
  await row.locator('.todo-detail textarea').fill('さらに下書きを修正した文章');
  await expect(mine).toContainText('さらに下書きを修正した文章');
  await expect(row.locator('.todo-detail-save')).toBeDisabled();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 812 });
    const overflow = await row.locator('.todo-edit-compare-columns-v529').evaluate(
      node => node.scrollWidth > node.clientWidth + 2);
    expect(overflow, 'comparison should fit mobile viewport at ' + width + 'px').toBe(false);
  }
  await expect(await readTodo(id)).toMatchObject({ text: 'ほかの端末が更新した件名', memo: '先方の追加事項', revision: 2 });

  page.once('dialog', dialog => dialog.accept());
  await row.locator('.todo-edit-reload-v527').click();
  await expect(row.locator('.todo-detail input')).toHaveValue('ほかの端末が更新した件名');
  await expect(row.locator('.todo-detail textarea')).toHaveValue('先方の追加事項');
  await expect(row.locator('.todo-edit-conflict-v527')).toHaveCount(0);
  await row.locator('.todo-detail textarea').fill('最新を確認してから追記した内容');
  await row.locator('.todo-detail-save').click();
  await expect.poll(() => readTodo(id), { timeout: 15_000 }).toMatchObject({
    text: 'ほかの端末が更新した件名',
    memo: '最新を確認してから追記した内容',
    revision: 3
  });
  expect(productionRequests).toEqual([]);
});

test('an unrelated remote edit keeps the unsaved ToDo and create form, and deletion exposes recovery text', async ({ page }) => {
  const draftId = 'todo-remote-draft-v527';
  const otherId = 'todo-remote-other-v527';
  const draft = todoRecord(draftId, '編集中の対象', { order: 10 });
  const other = todoRecord(otherId, '別のToDo', { order: 20 });
  await putDb('rooms/' + ROOM + '/todos', { [draftId]: draft, [otherId]: other });
  const { productionRequests } = await bootTodoPage(page);
  const row = page.locator('#todoView [data-todo-id="' + draftId + '"]');
  await row.locator('.todo-summary-button').click();
  await row.locator('.todo-detail textarea').fill('消えては困る下書き');
  await page.locator('#todayTodoInput').fill('新規ToDoも入力途中');
  await putDb('rooms/' + ROOM + '/todos/' + otherId, {
    ...other, text: '別のToDoの更新', revision: 2, updatedAt: other.updatedAt + 1000
  });
  await expect(page.locator('#todoView [data-todo-id="' + otherId + '"] .todo-text')).toHaveText('別のToDoの更新');
  await expect(row.locator('.todo-detail textarea')).toHaveValue('消えては困る下書き');
  await expect(page.locator('#todayTodoInput')).toHaveValue('新規ToDoも入力途中');
  await expect(row.locator('.todo-edit-conflict-v527')).toHaveCount(0);

  await deleteDb('rooms/' + ROOM + '/todos/' + draftId);
  await expect(row).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('#todoView .todo-draft-recovery-v527 textarea')).toHaveValue(/消えては困る下書き/);
  await expect(await readTodo(draftId)).toBeNull();
  expect(productionRequests).toEqual([]);
});

test('manual conflict resolution chooses draft title and latest memo without writing until Save', async ({ page }) => {
  const id = 'todo-selective-rebase-v530';
  const first = todoRecord(id, 'もとの件名', { memo: 'もとのメモ' });
  const unrelatedId = 'todo-unrelated-choice-v530';
  const unrelated = todoRecord(unrelatedId, '別件のToDo', { order: 200 });
  await putDb('rooms/' + ROOM + '/todos', { [id]: first, [unrelatedId]: unrelated });
  await page.setViewportSize({ width: 390, height: 812 });
  const { productionRequests } = await bootTodoPage(page);
  const row = page.locator('#todoView [data-todo-id="' + id + '"]');
  await row.locator('.todo-summary-button').click();
  await row.locator('.todo-detail input').fill('手元で書いた新しい件名');
  await row.locator('.todo-detail textarea').fill('自分のメモ案');
  await putDb('rooms/' + ROOM + '/todos/' + id, {
    ...first, text: '共有側の件名', memo: '共有側の重要メモ',
    revision: 2, updatedAt: first.updatedAt + 1000
  });
  await expect(row.locator('.todo-edit-conflict-v527')).toBeVisible({ timeout: 30000 });
  const apply = row.locator('.todo-edit-resume-v530');
  await expect(apply).toBeDisabled();
  await row.locator('[data-todo-resolve-field="text"]').selectOption('mine');
  await expect(apply).toBeDisabled();
  await row.locator('[data-todo-resolve-field="memo"]').selectOption('latest');
  await expect(apply).toBeEnabled();
  await expect(row.locator('.todo-edit-preview-text-v530')).toContainText('手元で書いた新しい件名');
  await expect(row.locator('.todo-edit-preview-memo-v530')).toContainText('共有側の重要メモ');
  // Changing a different ToDo must not reset the selection or draft.
  await putDb('rooms/' + ROOM + '/todos/' + unrelatedId, {
    ...unrelated, text: '別件だけ更新', revision: 2, updatedAt: unrelated.updatedAt + 1000
  });
  await expect(page.locator('#todoView [data-todo-id="' + unrelatedId + '"] .todo-text')).toHaveText('別件だけ更新');
  await expect(row.locator('[data-todo-resolve-field="text"]')).toHaveValue('mine');
  await expect(row.locator('[data-todo-resolve-field="memo"]')).toHaveValue('latest');
  await expect(row.locator('.todo-edit-preview-memo-v530')).toContainText('共有側の重要メモ');
  expect(await readTodo(id)).toMatchObject({ text: '共有側の件名', memo: '共有側の重要メモ', revision: 2 });

  page.once('dialog', dialog => dialog.dismiss());
  await apply.click();
  await expect(row.locator('.todo-detail-save')).toBeDisabled();
  await expect(row.locator('.todo-detail textarea')).toHaveValue('自分のメモ案');

  page.once('dialog', dialog => dialog.accept());
  await apply.click();
  await expect(row.locator('.todo-edit-conflict-v527')).toHaveCount(0);
  await expect(row.locator('.todo-detail input')).toHaveValue('手元で書いた新しい件名');
  await expect(row.locator('.todo-detail textarea')).toHaveValue('共有側の重要メモ');
  await expect(row.locator('.todo-detail-save')).toBeEnabled();
  // Picking the fields must not perform a Firebase write by itself.
  expect(await readTodo(id)).toMatchObject({ text: '共有側の件名', memo: '共有側の重要メモ', revision: 2 });
  await row.locator('.todo-detail-save').click();
  await expect.poll(() => readTodo(id), { timeout: 15000 }).toMatchObject({
    text: '手元で書いた新しい件名', memo: '共有側の重要メモ', revision: 3
  });
  expect(productionRequests).toEqual([]);
});


test('remote update during navigation back to Classic ToDo retains draft and blocks stale save', async ({ page }) => {
  const id = 'todo-route-remote-v532';
  const first = todoRecord(id, '最初の件名', { memo: 'もとの本文' });
  await putDb('rooms/' + ROOM + '/todos/' + id, first);
  const { productionRequests } = await bootTodoPage(page);
  const row = page.locator('#todoView [data-todo-id="' + id + '"]');
  await row.locator('.todo-summary-button').click();
  await row.locator('.todo-detail input').fill('手元に残す件名532');
  await row.locator('.todo-detail textarea').fill('手元の追記532');
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="today"]').click());
  await expect(page.locator('#todoView .todo-page')).toHaveCount(0);
  await putDb('rooms/' + ROOM + '/todos/' + id, {
    ...first, text: '別端末の件名532', memo: '別端末の本文532',
    revision: 2, updatedAt: first.updatedAt + 1000
  });
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="todos"]').click());
  await expect(row.locator('.todo-detail input')).toHaveValue('手元に残す件名532');
  await expect(row.locator('.todo-detail textarea')).toHaveValue('手元の追記532');
  await expect(row.locator('.todo-edit-conflict-v527')).toBeVisible({ timeout: 30_000 });
  await expect(row.locator('.todo-detail-save')).toBeDisabled();
  expect(await readTodo(id)).toMatchObject({ text: '別端末の件名532', memo: '別端末の本文532', revision: 2 });
  expect(productionRequests).toEqual([]);
});
