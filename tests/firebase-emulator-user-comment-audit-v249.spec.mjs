import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-user-comment-audit-v249';
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

function seededMeta(revision = 20) {
  return {
    users: ['福冨', '森井'],
    userColors: { '福冨': '#3c92df', '森井': '#4ebd69' },
    usersUpdatedAt: Date.now() - 10_000,
    _revisions: { users: revision, userColors: revision, usersUpdatedAt: revision }
  };
}

function taskRecord(id, overrides = {}) {
  const now = Date.now();
  return {
    id,
    title: 'Ver.249 audit task',
    description: '', requester: '', assignee: '福冨', status: '対応中', priority: '中', category: 'その他',
    tags: [], dueDate: '', dueTime: '', pinned: false, checklist: [], comments: [], history: [],
    recurrence: 'none', recurrenceRule: {}, createdAt: now - 10_000, createdBy: '福冨',
    updatedAt: now, updatedBy: '福冨', completedAt: 0, completedMemo: '', revision: 1,
    ...overrides
  };
}

async function installBoundary(page, user, initialTasks = []) {
  const productionRequests = [];
  await page.addInitScript(({ project, room, host, port, userName, tasks }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', userName);
      localStorage.setItem('systemTaskRoomId', room);
      localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify(tasks));
    } catch {}
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

async function bootBoard(page, user = '福冨', initialTasks = []) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const productionRequests = await installBoundary(page, user, initialTasks);
  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('connectionPill')?.textContent?.includes('共同編集ON'), undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 15_000 });
  expect(errors).toEqual([]);
  expect(productionRequests).toEqual([]);
  return { errors, productionRequests };
}

async function waitForUsers(page, names) {
  await page.waitForFunction(({ room, expected }) => {
    try {
      const users = JSON.parse(localStorage.getItem(`system-task-users:${room}`) || '[]');
      return Array.isArray(users) && expected.every(name => users.includes(name));
    } catch { return false; }
  }, { room: ROOM, expected: names }, { timeout: 15_000 });
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

async function openUserManager(page) {
  await clickCurrent(page, '#manageUsers');
  await expect(page.locator('#userManageDialog')).toBeVisible();
}

async function openTaskComments(page, taskId) {
  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.waitForFunction(id => Boolean(document.querySelector(`[data-task-id="${CSS.escape(id)}"]`)), taskId, { timeout: 15_000 });
  await clickCurrent(page, `[data-task-id="${taskId}"]`);
  await expect(page.locator('.task-detail-tab-v149[data-tab="comments"]')).toBeVisible({ timeout: 15_000 });
  await clickCurrent(page, '.task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator('.task-detail-panel-v149[data-tab-panel="comments"]')).toBeVisible();
}

async function openReactionPicker(page, commentId) {
  const wrap = page.locator(`.comment-reactions-v165[data-comment-reactions-for="${commentId}"]`);
  await expect(wrap).toBeVisible({ timeout: 15_000 });
  await clickCurrent(page, `[data-comment-reaction-picker="${commentId}"]`);
  await expect(page.locator('.comment-reaction-picker-v165:not([hidden])')).toBeVisible();
}

async function waitForTask(page, id) {
  await page.waitForFunction(taskId => window.WorkBoardWorkflowV152?.taskMap?.().has(taskId), id, { timeout: 30_000 });
}

async function reactionUsers(taskId, commentId, emoji = '👍') {
  const task = await readDb(`rooms/${ROOM}/tasks/${taskId}`);
  const comment = (task?.comments || []).find(item => String(item?.id || '') === commentId);
  const value = comment?.reactions?.[emoji];
  return Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('concurrent distinct user registrations preserve both server additions', async ({ browser }) => {
  await putDb(`rooms/${ROOM}/meta`, seededMeta(20));
  const pageA = await browser.newPage();
  const pageB = await browser.newPage();
  const safetyA = await bootBoard(pageA);
  const safetyB = await bootBoard(pageB);
  await waitForUsers(pageA, ['福冨', '森井']);
  await waitForUsers(pageB, ['福冨', '森井']);

  await openUserManager(pageA);
  await openUserManager(pageB);
  await pageA.locator('#newUserName').fill('同時追加A');
  await pageA.locator('#newUserColor').fill('#315a9d');
  await pageB.locator('#newUserName').fill('同時追加B');
  await pageB.locator('#newUserColor').fill('#9d5a31');

  await Promise.all([
    clickCurrent(pageA, '#userManageForm button[type="submit"]'),
    clickCurrent(pageB, '#userManageForm button[type="submit"]')
  ]);

  await expect.poll(async () => (await readDb(`rooms/${ROOM}/meta`))?.users || [], { timeout: 20_000 })
    .toEqual(expect.arrayContaining(['福冨', '森井', '同時追加A', '同時追加B']));
  const meta = await readDb(`rooms/${ROOM}/meta`);
  expect(meta.userColors).toMatchObject({ '同時追加A': '#315a9d', '同時追加B': '#9d5a31' });
  expect(meta._revisions).toMatchObject({ users: 22, userColors: 22, usersUpdatedAt: 22 });
  expect(safetyA.productionRequests).toEqual([]);
  expect(safetyB.productionRequests).toEqual([]);
  await pageA.close();
  await pageB.close();
});

test('stale add intent toggles off the same-user remote reaction after reconnect', async ({ context, page }) => {
  const taskId = 'task-v249-stale-add';
  const commentId = 'comment-v249-stale-add';
  const base = taskRecord(taskId, {
    comments: [{ id: commentId, author: '森井', text: 'stale add audit', createdAt: Date.now() - 1000 }],
    revision: 1
  });
  await putDb(`rooms/${ROOM}/meta`, seededMeta());
  await putDb(`rooms/${ROOM}/tasks/${taskId}`, base);
  await bootBoard(page, '福冨', [base]);
  await waitForTask(page, taskId);
  await openTaskComments(page, taskId);
  await openReactionPicker(page, commentId);

  await context.setOffline(true);
  try {
    await clickCurrent(page, `.comment-reaction-choice-v165[data-comment-reaction-id="${commentId}"][data-comment-reaction-emoji="👍"]`);
    await page.waitForTimeout(400);
    const remoteWinner = taskRecord(taskId, {
      ...base,
      comments: [{ ...base.comments[0], reactions: { '👍': ['福冨'] } }],
      revision: 2
    });
    await putDb(`rooms/${ROOM}/tasks/${taskId}`, remoteWinner);
  } finally {
    await context.setOffline(false);
  }

  await expect.poll(() => reactionUsers(taskId, commentId), { timeout: 20_000 }).toEqual([]);
  const stored = await readDb(`rooms/${ROOM}/tasks/${taskId}`);
  expect(stored.revision).toBe(3);
});

test('stale remove intent toggles the same-user reaction back on and emits an add notification', async ({ context, page }) => {
  const taskId = 'task-v249-stale-remove';
  const commentId = 'comment-v249-stale-remove';
  const base = taskRecord(taskId, {
    comments: [{ id: commentId, author: '森井', text: 'stale remove audit', createdAt: Date.now() - 1000, reactions: { '👍': ['福冨'] } }],
    revision: 1
  });
  await putDb(`rooms/${ROOM}/meta`, seededMeta());
  await putDb(`rooms/${ROOM}/tasks/${taskId}`, base);
  await bootBoard(page, '福冨', [base]);
  await waitForTask(page, taskId);
  await openTaskComments(page, taskId);
  const chip = page.locator(`.comment-reaction-chip-v165[data-comment-reaction-id="${commentId}"][data-comment-reaction-emoji="👍"]`);
  await expect(chip).toBeVisible({ timeout: 15_000 });
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  await context.setOffline(true);
  try {
    await clickCurrent(page, `.comment-reaction-chip-v165[data-comment-reaction-id="${commentId}"][data-comment-reaction-emoji="👍"]`);
    await page.waitForTimeout(400);
    const remoteWinner = taskRecord(taskId, {
      ...base,
      comments: [{ id: commentId, author: '森井', text: 'stale remove audit', createdAt: base.comments[0].createdAt }],
      revision: 2
    });
    await putDb(`rooms/${ROOM}/tasks/${taskId}`, remoteWinner);
  } finally {
    await context.setOffline(false);
  }

  await expect.poll(() => reactionUsers(taskId, commentId), { timeout: 20_000 }).toEqual(['福冨']);
  const stored = await readDb(`rooms/${ROOM}/tasks/${taskId}`);
  expect(stored.revision).toBe(3);
  await expect.poll(async () => {
    const inbox = await readDb(`rooms/${ROOM}/workflowV152/inbox/森井`);
    return Object.values(inbox || {}).filter(event => event?.type === 'reaction' && event?.taskId === taskId).length;
  }, { timeout: 20_000 }).toBeGreaterThan(0);
});
