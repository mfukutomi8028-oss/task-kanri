import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-reaction-reconnect-v254';
const HOST = '127.0.0.1';
const PORT = 9000;
const PROD_DATABASE_RE = /https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i;

test.skip(process.env.WORK_BOARD_FIREBASE_E2E !== '1', 'requires the isolated RTDB emulator');
test.describe.configure({ mode: 'serial' });

function emulatorUrl(path = '') {
  const encoded = String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
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

function seededMeta() {
  return {
    users: ['福冨', '森井'],
    userColors: { '福冨': '#3c92df', '森井': '#4ebd69' },
    usersUpdatedAt: Date.now() - 10_000,
    _revisions: { users: 20, userColors: 20, usersUpdatedAt: 20 }
  };
}

function taskRecord(id, overrides = {}) {
  const now = Date.now();
  return {
    id,
    title: 'Ver.254 reconnect task',
    description: '', requester: '', assignee: '福冨', status: '対応中', priority: '中', category: 'その他',
    tags: [], dueDate: '', dueTime: '', pinned: false, checklist: [], comments: [], history: [],
    recurrence: 'none', recurrenceRule: {}, createdAt: now - 10_000, createdBy: '森井',
    updatedAt: now, updatedBy: '森井', completedAt: 0, completedMemo: '', revision: 10,
    ...overrides
  };
}

async function installBoundary(page, user, initialTasks = []) {
  const productionRequests = [];
  await page.addInitScript(({ project, room, host, port, userName, tasks }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', userName);
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify(tasks));
    const config = Object.freeze({
      apiKey: 'demo-api-key', authDomain: `${project}.firebaseapp.com`,
      databaseURL: `http://${host}:${port}/?ns=${project}`, projectId: project,
      appId: '1:000000000000:web:firebase-emulator-only'
    });
    window.WORK_BOARD_TEST = Object.freeze({ emulator: true, host, port });
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return config; }, set() {} });
  }, { project: PROJECT, room: ROOM, host: HOST, port: PORT, userName: user, tasks: initialTasks });
  await page.route(PROD_DATABASE_RE, route => {
    productionRequests.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  return productionRequests;
}

async function bootBoard(page, initialTasks = []) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const productionRequests = await installBoundary(page, '福冨', initialTasks);
  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('connectionPill')?.textContent?.includes('共同編集ON'), undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 15_000 });
  expect(errors).toEqual([]);
  expect(productionRequests).toEqual([]);
  return { errors, productionRequests };
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

async function openTaskComments(page, taskId, commentId) {
  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.waitForFunction(id => Boolean(document.querySelector(`[data-task-id="${CSS.escape(id)}"]`)), taskId, { timeout: 15_000 });
  await clickCurrent(page, `[data-task-id="${taskId}"]`);
  await expect(page.locator('.task-detail-tab-v149[data-tab="comments"]')).toBeVisible({ timeout: 15_000 });
  await clickCurrent(page, '.task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator(`[data-comment-reaction-picker="${commentId}"]`)).toBeVisible({ timeout: 15_000 });
  await clickCurrent(page, `[data-comment-reaction-picker="${commentId}"]`);
  await expect(page.locator(`[data-comment-reaction-id="${commentId}"][data-comment-reaction-emoji="👍"]`)).toBeVisible();
}

async function reactionUsers(taskId, commentId) {
  const task = await readDb(`rooms/${ROOM}/tasks/${taskId}`);
  const comment = (task?.comments || []).find(item => String(item?.id || '') === commentId);
  const value = comment?.reactions?.['👍'];
  return Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
}

async function reactionNotificationCount(taskId, recipient = '森井') {
  const inbox = await readDb(`rooms/${ROOM}/workflowV152/inbox/${recipient}`);
  return Object.values(inbox || {}).filter(event => event?.type === 'reaction' && event?.taskId === taskId).length;
}

async function cachedTask(page, taskId) {
  return page.evaluate(({ room, id }) => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    return tasks.find(item => String(item?.id || '') === id) || null;
  }, { room: ROOM, id: taskId });
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('reconnect stale add intent converges to remote winner without duplicate revision or notification', async ({ page }) => {
  const taskId = 'task-v254-reconnect-add';
  const commentId = 'comment-v254-reconnect-add';
  const base = taskRecord(taskId, {
    comments: [{ id: commentId, author: '森井', text: 'reconnect winner', createdAt: Date.now() - 1000 }],
    revision: 10
  });
  await putDb(`rooms/${ROOM}/meta`, seededMeta());
  await putDb(`rooms/${ROOM}/tasks/${taskId}`, base);
  const safety = await bootBoard(page, [base]);
  await openTaskComments(page, taskId, commentId);

  const choice = page.locator(`[data-comment-reaction-id="${commentId}"][data-comment-reaction-emoji="👍"]`);
  await expect(choice).toHaveAttribute('data-comment-reaction-expected-pressed', 'false');

  await page.evaluate(() => {
    const pill = document.getElementById('connectionPill');
    if (pill) pill.textContent = '共同データ読込エラー（保存不可）';
  });
  await clickCurrent(page, `[data-comment-reaction-id="${commentId}"][data-comment-reaction-emoji="👍"]`);
  await expect(page.locator('#toast')).toContainText('共同データを保存できる状態ではありません');
  let stored = await readDb(`rooms/${ROOM}/tasks/${taskId}`);
  expect(stored.revision).toBe(10);
  expect(await reactionUsers(taskId, commentId)).toEqual([]);

  const remoteWinner = taskRecord(taskId, {
    ...base,
    comments: [{ ...base.comments[0], reactions: { '👍': ['福冨'] } }],
    revision: 11
  });
  await putDb(`rooms/${ROOM}/tasks/${taskId}`, remoteWinner);
  await expect.poll(() => reactionUsers(taskId, commentId), { timeout: 10_000 }).toEqual(['福冨']);

  await page.evaluate(({ id }) => {
    const pill = document.getElementById('connectionPill');
    if (pill) pill.textContent = '共同編集ON';
    const node = document.querySelector(`[data-comment-reaction-id="${CSS.escape(id)}"][data-comment-reaction-emoji="👍"]`);
    if (node instanceof HTMLButtonElement) {
      node.dataset.commentReactionExpectedPressed = 'false';
      node.setAttribute('aria-pressed', 'false');
      node.click();
    }
  }, { id: commentId });

  await expect(page.locator('#toast')).toContainText('別の端末でリアクションが更新されています');
  await expect.poll(() => reactionUsers(taskId, commentId), { timeout: 10_000 }).toEqual(['福冨']);
  stored = await readDb(`rooms/${ROOM}/tasks/${taskId}`);
  expect(stored.revision).toBe(11);
  await expect.poll(() => reactionNotificationCount(taskId), { timeout: 5_000 }).toBe(0);
  await expect.poll(async () => Number((await cachedTask(page, taskId))?.revision || 0), { timeout: 10_000 }).toBe(11);
  const cached = await cachedTask(page, taskId);
  const cachedComment = cached.comments.find(item => item.id === commentId);
  expect(cachedComment.reactions['👍']).toEqual(['福冨']);
  expect(safety.errors).toEqual([]);
  expect(safety.productionRequests).toEqual([]);
});
