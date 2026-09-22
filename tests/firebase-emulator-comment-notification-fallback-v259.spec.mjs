import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-comment-notification-fallback-v259';
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
    id, title: 'Ver.259 notification fallback emulator', description: '', requester: '', assignee: '福冨',
    status: '対応中', priority: '中', category: 'その他', tags: [], dueDate: '', dueTime: '', pinned: false, checklist: [],
    comments: [{ id: 'parent-v259', author: '森井', type: '作業メモ', text: 'observer fallback parent', createdAt: now - 2000 }],
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
    window.__WB_V259_NOTIFICATION_TRACE__ = [];
    window.__WB_V259_DIRECT_FAILURES__ = {};
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
    if (!original) throw new Error('v259-writeInboxEvent-missing');
    workflow.writeInboxEvent = async (recipient, id, event) => {
      const stack = String(new Error().stack || '');
      const direct = stack.includes('deliverPersonal') || stack.includes('toggleReaction') || stack.includes('saveRemoteReply');
      window.__WB_V259_NOTIFICATION_TRACE__.push({ recipient, id, type: event?.type || '', direct });
      if (direct && !window.__WB_V259_DIRECT_FAILURES__[id]) {
        window.__WB_V259_DIRECT_FAILURES__[id] = true;
        return { ok: false, simulated: 'v259-direct-notification-transient' };
      }
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
  await expect(page.locator('.activity-comment[data-comment-id="parent-v259"]')).toBeVisible({ timeout: 15_000 });
}

async function inboxMap() {
  const value = await readDb(`rooms/${ROOM}/workflowV152/inbox/森井`);
  return value && typeof value === 'object' ? value : {};
}

async function trace(page) {
  return page.evaluate(() => ({
    calls: structuredClone(window.__WB_V259_NOTIFICATION_TRACE__ || []),
    failures: structuredClone(window.__WB_V259_DIRECT_FAILURES__ || {})
  }));
}

async function reloadAndAssertSingle(page, prefix, expectedId) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 20_000 });
  await page.waitForTimeout(800);
  const keys = Object.keys(await inboxMap()).filter(key => key.startsWith(prefix));
  expect(keys).toEqual([expectedId]);
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
  await seedMeta();
});

test('reaction direct notification failure is healed by observer fallback once and stays singular after reconnect', async ({ page }) => {
  const taskId = 'task-v259-reaction-fallback';
  const seeded = taskRecord(taskId);
  await putDb(`rooms/${ROOM}/tasks/${taskId}`, seeded);
  const safety = await boot(page, [seeded]);
  await openTaskComments(page, taskId);

  await clickCurrent(page, '[data-comment-reaction-picker="parent-v259"]');
  const choice = page.locator('.comment-reaction-choice-v165[data-comment-reaction-id="parent-v259"][data-comment-reaction-emoji="👍"]');
  await choice.evaluate(node => node.click());

  await expect.poll(async () => Number((await readDb(`rooms/${ROOM}/tasks/${taskId}`))?.revision || 0), { timeout: 20_000 }).toBe(11);
  const eventId = `reaction_${taskId}_parent-v259_👍_福冨_11`;
  await expect.poll(async () => Object.keys(await inboxMap()).filter(key => key.startsWith('reaction_')), { timeout: 20_000 }).toEqual([eventId]);

  const stored = await readDb(`rooms/${ROOM}/tasks/${taskId}`);
  expect(stored.comments[0].reactions?.['👍']).toEqual(['福冨']);
  const observed = await trace(page);
  expect(observed.failures[eventId]).toBe(true);
  expect(observed.calls.some(call => call.id === eventId && call.direct)).toBe(true);
  expect(observed.calls.some(call => call.id === eventId && !call.direct)).toBe(true);
  expect(Object.keys(await inboxMap()).filter(key => key.startsWith('reaction_'))).toEqual([eventId]);

  await reloadAndAssertSingle(page, 'reaction_', eventId);
  expect(safety.pageErrors).toEqual([]);
  expect(safety.productionRequests).toEqual([]);
});

test('reply direct notification failure is healed by observer fallback once and stays singular after reconnect', async ({ page }) => {
  const taskId = 'task-v259-reply-fallback';
  const seeded = taskRecord(taskId);
  await putDb(`rooms/${ROOM}/tasks/${taskId}`, seeded);
  const safety = await boot(page, [seeded]);
  await openTaskComments(page, taskId);

  await clickCurrent(page, '[data-comment-reply-target="parent-v259"]');
  await page.locator('#commentText').fill('observer fallback reply');
  await page.locator('#commentForm button[type="submit"]').evaluate(node => node.click());

  await expect.poll(async () => Number((await readDb(`rooms/${ROOM}/tasks/${taskId}`))?.revision || 0), { timeout: 20_000 }).toBe(11);
  const stored = await readDb(`rooms/${ROOM}/tasks/${taskId}`);
  const replies = stored.comments.filter(comment => comment?.replyTo === 'parent-v259');
  expect(replies).toHaveLength(1);
  expect(replies[0].text).toBe('observer fallback reply');
  const eventId = `reply_${taskId}_${replies[0].id}_森井`;
  await expect.poll(async () => Object.keys(await inboxMap()).filter(key => key.startsWith('reply_')), { timeout: 20_000 }).toEqual([eventId]);

  const observed = await trace(page);
  expect(observed.failures[eventId]).toBe(true);
  expect(observed.calls.some(call => call.id === eventId && call.direct)).toBe(true);
  expect(observed.calls.some(call => call.id === eventId && !call.direct)).toBe(true);
  expect(Object.keys(await inboxMap()).filter(key => key.startsWith('reply_'))).toEqual([eventId]);

  await reloadAndAssertSingle(page, 'reply_', eventId);
  expect(safety.pageErrors).toEqual([]);
  expect(safety.productionRequests).toEqual([]);
});
