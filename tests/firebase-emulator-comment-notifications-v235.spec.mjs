import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-comment-notifications-v235';
const HOST = '127.0.0.1';
const PORT = 9000;
const PROD_DATABASE_RE = /https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i;

test.skip(process.env.WORK_BOARD_FIREBASE_E2E !== '1', 'requires the isolated RTDB emulator');
test.describe.configure({ mode: 'serial' });

function emulatorUrl(path = '') {
  const encoded = String(path || '').split('/').filter(Boolean).map(segment => encodeURIComponent(segment)).join('/');
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

function taskRecord(id, { author = '森井', assignee = '佐藤', revision = 4 } = {}) {
  const now = Date.now();
  return {
    id,
    title: 'コメント通知テスト',
    description: '', requester: '', assignee,
    status: '対応中', priority: '中', category: 'その他', tags: [],
    dueDate: '', dueTime: '', pinned: false, checklist: [],
    comments: [{ id: 'parent-v235', author, type: '作業メモ', text: '確認をお願いします', createdAt: now - 2000 }],
    history: [], recurrence: 'none', recurrenceRule: {},
    createdAt: now - 20_000, createdBy: '森井',
    updatedAt: now - 2000, updatedBy: '森井',
    lastChange: { label: '作業メモ追加', summary: '作業メモが追加されました', details: ['作業メモ: 確認をお願いします'] },
    completedAt: 0, completedMemo: '', revision
  };
}

async function seedMeta() {
  await putDb(`rooms/${ROOM}/meta`, {
    users: ['福冨', '森井', '佐藤'],
    userColors: { '福冨': '#3c92df', '森井': '#4ebd69', '佐藤': '#8b6ccf' },
    _revisions: { users: 1, userColors: 1 }
  });
}

async function configurePage(page, user = '福冨') {
  const productionRequests = [];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(({ project, room, host, port, userName }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', userName);
    localStorage.setItem('systemTaskRoomId', room);
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
  return { productionRequests, pageErrors };
}

async function boot(page, user = '福冨') {
  const safety = await configurePage(page, user);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('connectionPill')?.textContent?.includes('共同編集ON'), undefined, { timeout: 30_000 });
  return safety;
}

async function openTaskComments(page, taskId) {
  await page.waitForFunction(id => window.WorkBoardWorkflowV152?.taskMap?.().has(id), taskId, { timeout: 30_000 });
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await page.waitForSelector(`[data-task-id="${taskId}"]`, { timeout: 15_000 });
  await page.evaluate(id => document.querySelector(`[data-task-id="${CSS.escape(id)}"]`)?.click(), taskId);
  await expect(page.locator('.task-detail-tab-v149[data-tab="comments"]')).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => document.querySelector('.task-detail-tab-v149[data-tab="comments"]')?.click());
  await expect(page.locator('.task-detail-panel-v149[data-tab-panel="comments"]')).toBeVisible();
}

async function inboxValues(user) {
  const map = await readDb(`rooms/${ROOM}/workflowV152/inbox/${user}`);
  return Object.values(map && typeof map === 'object' ? map : {});
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
  await seedMeta();
});

test('reply notifies only the replied-to author and does not become a room-wide task update', async ({ page }) => {
  const taskId = 'task-reply-routing-v235';
  const seeded = taskRecord(taskId);
  await putDb(`rooms/${ROOM}/tasks/${taskId}`, seeded);
  const { productionRequests, pageErrors } = await boot(page, '福冨');
  await openTaskComments(page, taskId);

  const parent = page.locator('.activity-comment[data-comment-id="parent-v235"]');
  await expect(parent).toBeVisible({ timeout: 15_000 });
  await parent.locator('[data-comment-reply-target="parent-v235"]').click();
  await page.locator('#commentText').fill('返信内容です');
  await page.locator('#commentForm button[type="submit"]').click();

  await expect.poll(async () => {
    const task = await readDb(`rooms/${ROOM}/tasks/${taskId}`);
    const reply = (task?.comments || []).find(comment => comment?.replyTo === 'parent-v235');
    return { revision: Number(task?.revision || 0), reply, updatedAt: Number(task?.updatedAt || 0), updatedBy: String(task?.updatedBy || '') };
  }, { timeout: 20_000 }).toMatchObject({
    revision: seeded.revision + 1,
    reply: { author: '福冨', text: '返信内容です', replyTo: 'parent-v235' },
    updatedAt: seeded.updatedAt,
    updatedBy: seeded.updatedBy
  });

  await expect.poll(async () => (await inboxValues('森井')).filter(item => item.type === 'reply').length, { timeout: 15_000 }).toBe(1);
  const morii = await inboxValues('森井');
  expect(morii.find(item => item.type === 'reply')).toMatchObject({
    taskId,
    title: 'コメントに返信がありました',
    actor: '福冨',
    readAt: 0
  });
  expect((await inboxValues('佐藤')).filter(item => item.type === 'comment' || item.type === 'reply')).toHaveLength(0);

  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);
});

test('reaction creates one personal event and the inbox separates it from actionable notifications', async ({ page }) => {
  const taskId = 'task-reaction-routing-v235';
  await putDb(`rooms/${ROOM}/tasks/${taskId}`, taskRecord(taskId, { assignee: '森井', revision: 9 }));
  const { productionRequests, pageErrors } = await boot(page, '福冨');
  await openTaskComments(page, taskId);

  await page.locator('[data-comment-reaction-picker="parent-v235"]').click();
  await page.locator('.comment-reaction-choice-v165[data-comment-reaction-id="parent-v235"][data-comment-reaction-emoji="👍"]').click();

  await expect.poll(async () => {
    const task = await readDb(`rooms/${ROOM}/tasks/${taskId}`);
    return task?.comments?.[0]?.reactions?.['👍'] || [];
  }, { timeout: 20_000 }).toContain('福冨');
  await expect.poll(async () => (await inboxValues('森井')).filter(item => item.type === 'reaction').length, { timeout: 15_000 }).toBe(1);

  await putDb(`rooms/${ROOM}/workflowV152/inbox/森井/important-v235`, {
    taskId,
    type: 'reply',
    title: '要確認テスト',
    body: '確認が必要な通知です',
    actor: '佐藤',
    createdAt: Date.now() + 1,
    readAt: 0
  });

  await page.evaluate(() => {
    localStorage.setItem('systemTaskUser', '森井');
    location.reload();
  });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.unreadCount?.() >= 2, undefined, { timeout: 20_000 });
  await expect(page.locator('.workflow-inbox-entry-badge-v153')).toHaveText('2');
  await page.locator('[data-open-personal-inbox-v153]').click();

  const categories = page.locator('[data-inbox-category-tabs-v235]');
  await expect(categories).toBeVisible();
  await expect(page.locator('[data-inbox-category-v235="important"]')).toHaveClass(/active/);
  await expect(page.locator('[data-inbox-category-count-v235="important"]')).toHaveText('1');
  await expect(page.locator('[data-inbox-category-count-v235="reaction"]')).toHaveText('1');
  await expect(page.locator('[data-inbox-list-v153]')).toContainText('要確認テスト');
  await expect(page.locator('[data-inbox-list-v153]')).not.toContainText('コメントにリアクションがありました');

  await page.locator('[data-inbox-category-v235="reaction"]').click();
  await expect(page.locator('[data-inbox-list-v153]')).toContainText('コメントにリアクションがありました');
  await expect(page.locator('[data-inbox-list-v153]')).not.toContainText('要確認テスト');
  await expect(page.locator('[data-mark-all-v153]')).toHaveText('このタブを既読');
  await page.locator('[data-mark-all-v153]').click();

  await expect.poll(async () => (await inboxValues('森井')).filter(item => item.type === 'reaction' && !item.readAt).length, { timeout: 15_000 }).toBe(0);
  await expect.poll(async () => (await inboxValues('森井')).filter(item => item.type !== 'reaction' && !item.readAt).length, { timeout: 15_000 }).toBe(1);
  await expect(page.locator('.workflow-inbox-entry-badge-v153')).toHaveText('1');

  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);
});
