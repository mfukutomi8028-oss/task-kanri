import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-user-comments-e2e';
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

function seededMeta(revision = 4) {
  return {
    users: ['福冨', '森井'],
    userColors: {
      '福冨': '#3c92df',
      '森井': '#4ebd69'
    },
    usersUpdatedAt: Date.now() - 10_000,
    _revisions: {
      users: revision,
      userColors: revision,
      usersUpdatedAt: revision
    }
  };
}

function taskRecord(id, title, overrides = {}) {
  const now = Date.now();
  return {
    id,
    title,
    description: '',
    requester: '',
    assignee: '福冨',
    status: '対応中',
    priority: '中',
    category: 'その他',
    tags: [],
    dueDate: '',
    dueTime: '',
    pinned: false,
    checklist: [],
    comments: [],
    history: [],
    recurrence: 'none',
    recurrenceRule: {},
    createdAt: now - 10_000,
    createdBy: '福冨',
    updatedAt: now,
    updatedBy: '福冨',
    completedAt: 0,
    completedMemo: '',
    revision: 1,
    ...overrides
  };
}

async function installEmulatorBoundary(page, user = '福冨') {
  const productionRequests = [];

  await page.addInitScript(({ project, room, host, port, userName }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', userName);
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
  }, { project: PROJECT, room: ROOM, host: HOST, port: PORT, userName: user });

  await page.route(PROD_DATABASE_RE, route => {
    productionRequests.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  page.on('request', request => {
    if (PROD_DATABASE_RE.test(request.url())) productionRequests.push(request.url());
  });

  return productionRequests;
}

async function bootBoard(page, user = '福冨') {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const productionRequests = await installEmulatorBoundary(page, user);

  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('connectionPill')?.textContent?.includes('共同編集ON'), undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 15_000 });

  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);
  return { productionRequests, pageErrors };
}

async function waitForUsers(page, expected) {
  await page.waitForFunction(({ room, names }) => {
    try {
      const value = JSON.parse(localStorage.getItem(`system-task-users:${room}`) || '[]');
      return Array.isArray(value) && names.every(name => value.includes(name));
    } catch {
      return false;
    }
  }, { room: ROOM, names: expected }, { timeout: 15_000 });
}

async function waitForTask(page, id) {
  await page.waitForFunction(taskId => window.WorkBoardWorkflowV152?.taskMap?.().has(taskId), id, { timeout: 30_000 });
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
  await expect(page.locator('#manageUsers')).toBeAttached();
  await clickCurrent(page, '#manageUsers');
  await expect(page.locator('#userManageDialog')).toBeVisible();
}

async function submitNewUser(page, name, color) {
  await openUserManager(page);
  await page.locator('#newUserName').fill(name);
  await page.locator('#newUserColor').fill(color);
  await clickCurrent(page, '#userManageForm button[type="submit"]');
}

async function openTaskComments(page, taskId) {
  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.waitForFunction(id => Boolean(document.querySelector(`[data-task-id="${CSS.escape(id)}"]`)), taskId, { timeout: 15_000 });
  await clickCurrent(page, `[data-task-id="${taskId}"]`);
  const commentsTab = page.locator('.task-detail-tab-v149[data-tab="comments"]');
  await expect(commentsTab).toBeVisible({ timeout: 15_000 });
  await clickCurrent(page, '.task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator('.task-detail-panel-v149[data-tab-panel="comments"]')).toBeVisible();
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('adds a shared user through the real manager and updates meta revisions once', async ({ page }) => {
  const initialRevision = 4;
  const name = 'Emulator新規';
  const color = '#336699';
  await putDb(`rooms/${ROOM}/meta`, seededMeta(initialRevision));

  const { productionRequests } = await bootBoard(page);
  await waitForUsers(page, ['福冨', '森井']);
  await submitNewUser(page, name, color);

  await expect.poll(() => readDb(`rooms/${ROOM}/meta`), { timeout: 20_000 }).toMatchObject({
    users: ['福冨', '森井', name],
    userColors: {
      '福冨': '#3c92df',
      '森井': '#4ebd69',
      [name]: color
    },
    _revisions: {
      users: initialRevision + 1,
      userColors: initialRevision + 1,
      usersUpdatedAt: initialRevision + 1
    }
  });

  const stored = await readDb(`rooms/${ROOM}/meta`);
  expect(Number(stored.usersUpdatedAt || 0)).toBeGreaterThan(0);
  await waitForUsers(page, ['福冨', '森井', name]);
  expect(productionRequests).toEqual([]);
});

test('keeps one user and one meta revision increment when two clients add the same name', async ({ browser }) => {
  const initialRevision = 10;
  const name = '同時追加確認';
  const color = '#6b4fd3';
  await putDb(`rooms/${ROOM}/meta`, seededMeta(initialRevision));

  const pageA = await browser.newPage();
  const pageB = await browser.newPage();
  const safetyA = await bootBoard(pageA);
  const safetyB = await bootBoard(pageB);
  await waitForUsers(pageA, ['福冨', '森井']);
  await waitForUsers(pageB, ['福冨', '森井']);

  await openUserManager(pageA);
  await openUserManager(pageB);
  await pageA.locator('#newUserName').fill(name);
  await pageA.locator('#newUserColor').fill(color);
  await pageB.locator('#newUserName').fill(name);
  await pageB.locator('#newUserColor').fill(color);

  await Promise.all([
    clickCurrent(pageA, '#userManageForm button[type="submit"]'),
    clickCurrent(pageB, '#userManageForm button[type="submit"]')
  ]);

  await expect.poll(async () => {
    const meta = await readDb(`rooms/${ROOM}/meta`);
    return Array.isArray(meta?.users) ? meta.users.filter(user => user === name).length : 0;
  }, { timeout: 20_000 }).toBe(1);

  const stored = await readDb(`rooms/${ROOM}/meta`);
  expect(stored.users.filter(user => user === name)).toHaveLength(1);
  expect(stored.userColors?.[name]).toBe(color);
  expect(stored._revisions).toMatchObject({
    users: initialRevision + 1,
    userColors: initialRevision + 1,
    usersUpdatedAt: initialRevision + 1
  });
  expect(safetyA.productionRequests).toEqual([]);
  expect(safetyB.productionRequests).toEqual([]);

  await pageA.close();
  await pageB.close();
});

test('adds a comment reaction through the real picker and increments the task revision', async ({ page }) => {
  const taskId = 'task-reaction-add-e2e';
  const commentId = 'comment-reaction-add-e2e';
  const comment = {
    id: commentId,
    author: '森井',
    text: 'リアクション追加確認',
    createdAt: Date.now() - 1000
  };
  await putDb(`rooms/${ROOM}/meta`, seededMeta());
  await putDb(`rooms/${ROOM}/tasks/${taskId}`, taskRecord(taskId, 'リアクション追加テスト', {
    comments: [comment],
    revision: 3
  }));

  const { productionRequests } = await bootBoard(page);
  await waitForTask(page, taskId);
  await openTaskComments(page, taskId);

  const wrap = page.locator(`.comment-reactions-v165[data-comment-reactions-for="${commentId}"]`);
  await expect(wrap).toBeVisible({ timeout: 15_000 });
  await clickCurrent(page, `[data-comment-reaction-picker="${commentId}"]`);
  await expect(page.locator(`.comment-reaction-picker-v165:not([hidden])`)).toBeVisible();
  await clickCurrent(page, `.comment-reaction-choice-v165[data-comment-reaction-id="${commentId}"][data-comment-reaction-emoji="👍"]`);

  await expect.poll(() => readDb(`rooms/${ROOM}/tasks/${taskId}`), { timeout: 20_000 }).toMatchObject({
    revision: 4,
    comments: [{
      id: commentId,
      reactions: { '👍': ['福冨'] }
    }]
  });

  const chip = page.locator(`.comment-reaction-chip-v165[data-comment-reaction-id="${commentId}"][data-comment-reaction-emoji="👍"]`);
  await expect(chip).toBeVisible({ timeout: 15_000 });
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(chip).toContainText('1');
  expect(productionRequests).toEqual([]);
});

test('removes only the current user from an existing reaction and increments revision once', async ({ page }) => {
  const taskId = 'task-reaction-remove-e2e';
  const commentId = 'comment-reaction-remove-e2e';
  const comment = {
    id: commentId,
    author: '森井',
    text: 'リアクション解除確認',
    createdAt: Date.now() - 1000,
    reactions: { '👍': ['福冨', '森井'] }
  };
  await putDb(`rooms/${ROOM}/meta`, seededMeta());
  await putDb(`rooms/${ROOM}/tasks/${taskId}`, taskRecord(taskId, 'リアクション解除テスト', {
    comments: [comment],
    revision: 7
  }));

  const { productionRequests } = await bootBoard(page);
  await waitForTask(page, taskId);
  await openTaskComments(page, taskId);

  const chip = page.locator(`.comment-reaction-chip-v165[data-comment-reaction-id="${commentId}"][data-comment-reaction-emoji="👍"]`);
  await expect(chip).toBeVisible({ timeout: 15_000 });
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(chip).toContainText('2');
  await clickCurrent(page, `.comment-reaction-chip-v165[data-comment-reaction-id="${commentId}"][data-comment-reaction-emoji="👍"]`);

  await expect.poll(() => readDb(`rooms/${ROOM}/tasks/${taskId}`), { timeout: 20_000 }).toMatchObject({
    revision: 8,
    comments: [{
      id: commentId,
      reactions: { '👍': ['森井'] }
    }]
  });

  await expect(page.locator(`.comment-reaction-chip-v165[data-comment-reaction-id="${commentId}"][data-comment-reaction-emoji="👍"]`)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator(`.comment-reaction-chip-v165[data-comment-reaction-id="${commentId}"][data-comment-reaction-emoji="👍"]`)).toContainText('1');
  expect(productionRequests).toEqual([]);
});
