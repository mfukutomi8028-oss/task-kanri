import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-comment-reply-audit-v251';
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
    users: ['福冨', '森井', '佐藤'],
    userColors: { '福冨': '#3c92df', '森井': '#4ebd69', '佐藤': '#8b6ccf' },
    _revisions: { users: 1, userColors: 1 }
  };
}

function taskRecord(id, overrides = {}) {
  const now = Date.now();
  return {
    id,
    title: 'Ver.251 返信共同編集監査',
    description: '', requester: '', assignee: '福冨', status: '対応中', priority: '中', category: 'その他',
    tags: [], dueDate: '', dueTime: '', pinned: false, checklist: [],
    comments: [{ id: 'parent-v251', author: '佐藤', type: '作業メモ', text: '同時返信の親コメント', createdAt: now - 2000, reactions: { '✅': ['佐藤'] } }],
    history: [], recurrence: 'none', recurrenceRule: {},
    createdAt: now - 20_000, createdBy: '佐藤', updatedAt: now - 2000, updatedBy: '佐藤',
    lastChange: { label: '作業メモ追加', summary: '作業メモが追加されました', details: ['作業メモ: 同時返信の親コメント'] },
    completedAt: 0, completedMemo: '', revision: 10,
    ...overrides
  };
}

async function installBoundary(page, user, initialTasks) {
  const productionRequests = [];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
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
  page.on('request', request => {
    if (PROD_DATABASE_RE.test(request.url())) productionRequests.push(request.url());
  });
  return { productionRequests, pageErrors };
}

async function boot(page, user, initialTasks) {
  const safety = await installBoundary(page, user, initialTasks);
  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('connectionPill')?.textContent?.includes('共同編集ON'), undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 15_000 });
  expect(safety.pageErrors).toEqual([]);
  expect(safety.productionRequests).toEqual([]);
  return safety;
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

async function openTaskComments(page, taskId) {
  await page.waitForFunction(id => window.WorkBoardWorkflowV152?.taskMap?.().has(id), taskId, { timeout: 30_000 });
  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.waitForFunction(id => Boolean(document.querySelector(`[data-task-id="${CSS.escape(id)}"]`)), taskId, { timeout: 15_000 });
  await clickCurrent(page, `[data-task-id="${taskId}"]`);
  await expect(page.locator('.task-detail-tab-v149[data-tab="comments"]')).toBeVisible({ timeout: 15_000 });
  await clickCurrent(page, '.task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator('.task-detail-panel-v149[data-tab-panel="comments"]')).toBeVisible();
  await expect(page.locator('.activity-comment[data-comment-id="parent-v251"]')).toBeVisible({ timeout: 15_000 });
}

async function prepareReply(page, text, type) {
  await clickCurrent(page, '[data-comment-reply-target="parent-v251"]');
  await expect(page.locator('.comment-reply-compose-v215')).toBeVisible();
  await page.locator('#commentText').fill(text);
  await page.locator('#commentType').selectOption({ label: type });
}

async function inboxValues(user) {
  const map = await readDb(`rooms/${ROOM}/workflowV152/inbox/${user}`);
  return Object.values(map && typeof map === 'object' ? map : {});
}

async function seedTask(task) {
  await putDb(`rooms/${ROOM}/meta`, seededMeta());
  await putDb(`rooms/${ROOM}/tasks/${task.id}`, task);
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('concurrent replies to the same parent preserve both replies, histories, revision increments, and parent reactions', async ({ browser }) => {
  const taskId = 'task-v251-concurrent-replies';
  const seeded = taskRecord(taskId);
  await seedTask(seeded);

  const pageA = await browser.newPage();
  const pageB = await browser.newPage();
  const safetyA = await boot(pageA, '福冨', [seeded]);
  const safetyB = await boot(pageB, '森井', [seeded]);
  await openTaskComments(pageA, taskId);
  await openTaskComments(pageB, taskId);
  await prepareReply(pageA, '福冨から同時返信', '確認依頼');
  await prepareReply(pageB, '森井から同時返信', '申し送り');

  await Promise.all([
    clickCurrent(pageA, '#commentForm button[type="submit"]'),
    clickCurrent(pageB, '#commentForm button[type="submit"]')
  ]);

  await expect.poll(async () => {
    const task = await readDb(`rooms/${ROOM}/tasks/${taskId}`);
    const replies = (task?.comments || []).filter(comment => comment?.replyTo === 'parent-v251');
    return { revision: Number(task?.revision || 0), replyCount: replies.length, historyCount: (task?.history || []).length };
  }, { timeout: 20_000 }).toEqual({ revision: 12, replyCount: 2, historyCount: 2 });

  const stored = await readDb(`rooms/${ROOM}/tasks/${taskId}`);
  const replies = stored.comments.filter(comment => comment?.replyTo === 'parent-v251');
  expect(replies.map(comment => comment.author).sort()).toEqual(['森井', '福冨'].sort());
  expect(replies.map(comment => comment.text).sort()).toEqual(['森井から同時返信', '福冨から同時返信'].sort());
  expect(stored.comments.find(comment => comment.id === 'parent-v251')?.reactions).toEqual({ '✅': ['佐藤'] });
  expect(stored.history.map(item => item.text).sort()).toEqual(['申し送りを追加しました。', '確認依頼を追加しました。'].sort());

  await expect.poll(async () => (await inboxValues('佐藤')).filter(item => item.type === 'reply' && item.taskId === taskId).length, { timeout: 15_000 }).toBe(2);
  expect(safetyA.pageErrors).toEqual([]);
  expect(safetyB.pageErrors).toEqual([]);
  expect(safetyA.productionRequests).toEqual([]);
  expect(safetyB.productionRequests).toEqual([]);
  await pageA.close();
  await pageB.close();
});

test('reply and reaction racing on the same parent preserve both mutations and revision increments', async ({ browser }) => {
  const taskId = 'task-v251-reply-reaction-race';
  const seeded = taskRecord(taskId);
  await seedTask(seeded);

  const replyPage = await browser.newPage();
  const reactionPage = await browser.newPage();
  const replySafety = await boot(replyPage, '福冨', [seeded]);
  const reactionSafety = await boot(reactionPage, '森井', [seeded]);
  await openTaskComments(replyPage, taskId);
  await openTaskComments(reactionPage, taskId);
  await prepareReply(replyPage, '返信とリアクションを同時保存', '確認依頼');

  const reactionAdd = reactionPage.locator('[data-comment-reaction-picker="parent-v251"]');
  await expect(reactionAdd).toBeVisible({ timeout: 15_000 });
  await clickCurrent(reactionPage, '[data-comment-reaction-picker="parent-v251"]');
  const reactionChoice = reactionPage.locator('.comment-reaction-choice-v165[data-comment-reaction-id="parent-v251"][data-comment-reaction-emoji="👍"]');
  await expect(reactionChoice).toBeVisible();
  await expect(reactionChoice).toHaveAttribute('data-comment-reaction-expected-pressed', 'false');

  await Promise.all([
    clickCurrent(replyPage, '#commentForm button[type="submit"]'),
    clickCurrent(reactionPage, '.comment-reaction-choice-v165[data-comment-reaction-id="parent-v251"][data-comment-reaction-emoji="👍"]')
  ]);

  await expect.poll(async () => {
    const task = await readDb(`rooms/${ROOM}/tasks/${taskId}`);
    const parent = (task?.comments || []).find(comment => comment?.id === 'parent-v251');
    const reply = (task?.comments || []).find(comment => comment?.replyTo === 'parent-v251');
    return {
      revision: Number(task?.revision || 0),
      replyText: String(reply?.text || ''),
      users: Array.isArray(parent?.reactions?.['👍']) ? parent.reactions['👍'] : []
    };
  }, { timeout: 20_000 }).toEqual({ revision: 12, replyText: '返信とリアクションを同時保存', users: ['森井'] });

  const stored = await readDb(`rooms/${ROOM}/tasks/${taskId}`);
  expect(stored.comments.find(comment => comment.id === 'parent-v251')?.reactions?.['✅']).toEqual(['佐藤']);
  expect(stored.history).toHaveLength(1);
  expect(stored.history[0]?.text).toBe('確認依頼を追加しました。');
  await expect.poll(async () => (await inboxValues('佐藤')).filter(item => item.type === 'reply' && item.taskId === taskId).length, { timeout: 15_000 }).toBe(1);
  await expect.poll(async () => (await inboxValues('佐藤')).filter(item => item.type === 'reaction' && item.taskId === taskId).length, { timeout: 15_000 }).toBe(1);

  expect(replySafety.pageErrors).toEqual([]);
  expect(reactionSafety.pageErrors).toEqual([]);
  expect(replySafety.productionRequests).toEqual([]);
  expect(reactionSafety.productionRequests).toEqual([]);
  await replyPage.close();
  await reactionPage.close();
});
