import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-comment-notification-reconnect-v260';
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

function taskRecord(id) {
  const now = Date.now();
  return {
    id, title: 'Ver.260 notification reconnect audit', description: '', requester: '', assignee: '福冨',
    status: '対応中', priority: '中', category: 'その他', tags: [], dueDate: '', dueTime: '', pinned: false, checklist: [],
    comments: [{ id: 'parent-v260', author: '森井', type: '作業メモ', text: 'notification reconnect parent', createdAt: now - 2000 }],
    history: [], recurrence: 'none', recurrenceRule: {}, createdAt: now - 20_000, createdBy: '森井',
    updatedAt: now - 2000, updatedBy: '森井', completedAt: 0, completedMemo: '', revision: 10
  };
}

async function seedMeta() {
  await putDb(`rooms/${ROOM}/meta`, {
    users: ['福冨', '森井'],
    userColors: { '福冨': '#3c92df', '森井': '#4ebd69' },
    _revisions: { users: 1, userColors: 1 }
  });
}

async function configurePage(page, initialTasks) {
  const productionRequests = [];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(({ project, room, host, port, tasks }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify(tasks));
    const config = Object.freeze({
      apiKey: 'demo-api-key', authDomain: `${project}.firebaseapp.com`,
      databaseURL: `http://${host}:${port}/?ns=${project}`, projectId: project,
      appId: '1:000000000000:web:firebase-emulator-only'
    });
    window.WORK_BOARD_TEST = Object.freeze({ emulator: true, host, port });
    window.__WB_V260_NOTIFICATION_TRACE__ = [];
    window.__WB_V260_NOTIFICATION_ATTEMPTS__ = {};
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return config; }, set() {} });
  }, { project: PROJECT, room: ROOM, host: HOST, port: PORT, tasks: initialTasks });
  await page.route(PROD_DATABASE_RE, route => {
    productionRequests.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  page.on('request', request => {
    if (PROD_DATABASE_RE.test(request.url())) productionRequests.push(request.url());
  });
  return { productionRequests, pageErrors };
}

async function boot(page, initialTasks) {
  const safety = await configurePage(page, initialTasks);
  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('connectionPill')?.textContent?.includes('共同編集ON'), undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 15_000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const workflow = window.WorkBoardWorkflowV152;
    const original = workflow?.writeInboxEvent?.bind(workflow);
    if (!original) throw new Error('v260-writeInboxEvent-missing');
    workflow.writeInboxEvent = async (recipient, id, event) => {
      const stack = String(new Error().stack || '');
      const direct = stack.includes('deliverPersonal') || stack.includes('toggleReaction') || stack.includes('saveRemoteReply');
      const attempts = (window.__WB_V260_NOTIFICATION_ATTEMPTS__[id] || 0) + 1;
      window.__WB_V260_NOTIFICATION_ATTEMPTS__[id] = attempts;
      window.__WB_V260_NOTIFICATION_TRACE__.push({ recipient, id, type: event?.type || '', direct, attempts });
      if (attempts <= 2) return { ok: false, simulated: 'v260-direct-and-observer-transient' };
      return original(recipient, id, event);
    };
  });
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
  await expect(page.locator('.activity-comment[data-comment-id="parent-v260"]')).toBeVisible({ timeout: 15_000 });
}

async function inboxMap() {
  const value = await readDb(`rooms/${ROOM}/workflowV152/inbox/森井`);
  return value && typeof value === 'object' ? value : {};
}

async function trace(page) {
  return page.evaluate(() => structuredClone(window.__WB_V260_NOTIFICATION_TRACE__ || []));
}

async function assertMissingAfterReconnect(page, prefix) {
  expect(Object.keys(await inboxMap()).filter(key => key.startsWith(prefix))).toEqual([]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 20_000 });
  await page.waitForTimeout(1200);
  expect(Object.keys(await inboxMap()).filter(key => key.startsWith(prefix))).toEqual([]);
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
  await seedMeta();
});

test('reaction notification is lost when direct and observer delivery both fail before reconnect', async ({ page }) => {
  const taskId = 'task-v260-reaction-loss';
  const seeded = taskRecord(taskId);
  await putDb(`rooms/${ROOM}/tasks/${taskId}`, seeded);
  const safety = await boot(page, [seeded]);
  await openTaskComments(page, taskId);

  await clickCurrent(page, '[data-comment-reaction-picker="parent-v260"]');
  const choice = page.locator('.comment-reaction-choice-v165[data-comment-reaction-id="parent-v260"][data-comment-reaction-emoji="👍"]');
  await choice.evaluate(node => node.click());

  await expect.poll(async () => Number((await readDb(`rooms/${ROOM}/tasks/${taskId}`))?.revision || 0), { timeout: 20_000 }).toBe(11);
  const eventId = `reaction_${taskId}_parent-v260_👍_福冨_11`;
  await expect.poll(async () => (await trace(page)).filter(call => call.id === eventId).length, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);

  const calls = (await trace(page)).filter(call => call.id === eventId);
  expect(calls.some(call => call.direct)).toBe(true);
  expect(calls.some(call => !call.direct)).toBe(true);
  expect((await readDb(`rooms/${ROOM}/tasks/${taskId}`)).comments[0].reactions?.['👍']).toEqual(['福冨']);
  await assertMissingAfterReconnect(page, 'reaction_');
  expect(safety.pageErrors).toEqual([]);
  expect(safety.productionRequests).toEqual([]);
});

test('reply notification is lost when direct and observer delivery both fail before reconnect', async ({ page }) => {
  const taskId = 'task-v260-reply-loss';
  const seeded = taskRecord(taskId);
  await putDb(`rooms/${ROOM}/tasks/${taskId}`, seeded);
  const safety = await boot(page, [seeded]);
  await openTaskComments(page, taskId);

  await clickCurrent(page, '[data-comment-reply-target="parent-v260"]');
  await page.locator('#commentText').fill('double notification failure reply');
  await page.locator('#commentForm button[type="submit"]').evaluate(node => node.click());

  await expect.poll(async () => Number((await readDb(`rooms/${ROOM}/tasks/${taskId}`))?.revision || 0), { timeout: 20_000 }).toBe(11);
  const stored = await readDb(`rooms/${ROOM}/tasks/${taskId}`);
  const replies = stored.comments.filter(comment => comment?.replyTo === 'parent-v260');
  expect(replies).toHaveLength(1);
  const eventId = `reply_${taskId}_${replies[0].id}_森井`;
  await expect.poll(async () => (await trace(page)).filter(call => call.id === eventId).length, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);

  const calls = (await trace(page)).filter(call => call.id === eventId);
  expect(calls.some(call => call.direct)).toBe(true);
  expect(calls.some(call => !call.direct)).toBe(true);
  expect(replies[0].text).toBe('double notification failure reply');
  await assertMissingAfterReconnect(page, 'reply_');
  expect(safety.pageErrors).toEqual([]);
  expect(safety.productionRequests).toEqual([]);
});
