import { test, expect } from '@playwright/test';

const ROOM = 'test-comment-firebase-transaction-retry-v258';

function taskRecord(id) {
  const now = Date.now();
  return {
    id, title: 'Ver.258 transaction retry audit', description: '', requester: '', assignee: '福冨',
    status: '対応中', priority: '中', category: 'その他', tags: [], dueDate: '', dueTime: '', pinned: false, checklist: [],
    comments: [{ id: 'parent-v258', author: '福冨', type: '作業メモ', text: 'transaction retry parent', createdAt: now - 2000 }],
    history: [], recurrence: 'none', recurrenceRule: {}, createdAt: now - 20_000, createdBy: '福冨',
    updatedAt: now - 2000, updatedBy: '福冨', completedAt: 0, completedMemo: '', revision: 10
  };
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
  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.waitForFunction(id => Boolean(document.querySelector(`[data-task-id="${CSS.escape(id)}"]`)), taskId, { timeout: 15_000 });
  await clickCurrent(page, `[data-task-id="${taskId}"]`);
  await expect(page.locator('.task-detail-tab-v149[data-tab="comments"]')).toBeVisible({ timeout: 15_000 });
  await clickCurrent(page, '.task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator('.activity-comment[data-comment-id="parent-v258"]')).toBeVisible({ timeout: 15_000 });
}

async function cachedTask(page, taskId) {
  return page.evaluate(({ room, id }) => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    return tasks.find(item => String(item?.id || '') === id) || null;
  }, { room: ROOM, id: taskId });
}

test('reaction and reply recover from transient transaction rejection without reinitializing Firebase or duplicating state', async ({ page }) => {
  const taskId = 'task-v258-transaction-retry';
  const seeded = taskRecord(taskId);
  const requests = { app: 0, database: 0 };
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.addInitScript(({ room, task }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([task]));
    window.__WB_V258_CONFIG__ = null;
    window.__WB_V258_REMOTE_TASK__ = structuredClone(task);
    window.__WB_V258_INIT_CALLS__ = 0;
    window.__WB_V258_GET_DB_CALLS__ = 0;
    window.__WB_V258_TX_CALLS__ = 0;
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return window.__WB_V258_CONFIG__; },
      set() {}
    });
  }, { room: ROOM, task: seeded });

  await page.route(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-app\.js(?:\?wb-retry=\d+)?$/, route => {
    requests.app += 1;
    return route.fulfill({
      status: 200, contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
      body: [
        'const apps = [];',
        'export function getApps(){ return apps; }',
        'export function getApp(){ return apps[0]; }',
        'export function initializeApp(config){ globalThis.__WB_V258_INIT_CALLS__ += 1; const app = { config }; apps.push(app); return app; }'
      ].join('\n')
    });
  });

  await page.route(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-database\.js(?:\?wb-retry=\d+)?$/, route => {
    requests.database += 1;
    return route.fulfill({
      status: 200, contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
      body: [
        'export function getDatabase(app){ globalThis.__WB_V258_GET_DB_CALLS__ += 1; return { app }; }',
        'export function ref(db, path){ return { db, path }; }',
        'export async function runTransaction(target, updater){',
        '  globalThis.__WB_V258_TX_CALLS__ += 1;',
        '  const call = globalThis.__WB_V258_TX_CALLS__;',
        '  if (call === 1 || call === 3) throw new Error(`v258-transaction-transient-${call}`);',
        '  const current = structuredClone(globalThis.__WB_V258_REMOTE_TASK__);',
        '  const next = updater(current);',
        '  if (next === undefined) return { committed: false, snapshot: { val: () => structuredClone(globalThis.__WB_V258_REMOTE_TASK__) } };',
        '  globalThis.__WB_V258_REMOTE_TASK__ = structuredClone(next);',
        '  return { committed: true, snapshot: { val: () => structuredClone(next) } };',
        '}'
      ].join('\n')
    });
  });

  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('connectionPill')?.textContent?.includes('端末内保存'), undefined, { timeout: 15_000 });
  await openTaskComments(page, taskId);

  await page.evaluate(() => {
    window.__WB_V258_CONFIG__ = { apiKey: 'v258-transaction-retry', databaseURL: 'https://example.invalid', projectId: 'v258-audit' };
    const pill = document.getElementById('connectionPill');
    if (pill) pill.textContent = '共同編集ON';
  });

  await clickCurrent(page, '[data-comment-reaction-picker="parent-v258"]');
  let choice = page.locator('.comment-reaction-choice-v165[data-comment-reaction-id="parent-v258"][data-comment-reaction-emoji="👍"]');
  await choice.evaluate(node => node.click());
  await expect(page.locator('#toast')).toContainText('リアクションを保存できませんでした');
  await expect(choice).toBeEnabled();
  expect((await cachedTask(page, taskId)).revision).toBe(10);
  let runtime = await page.evaluate(() => ({ init: window.__WB_V258_INIT_CALLS__, getDb: window.__WB_V258_GET_DB_CALLS__, tx: window.__WB_V258_TX_CALLS__, remote: structuredClone(window.__WB_V258_REMOTE_TASK__) }));
  expect(requests).toEqual({ app: 1, database: 1 });
  expect(runtime.init).toBe(1);
  expect(runtime.getDb).toBe(1);
  expect(runtime.tx).toBe(1);
  expect(runtime.remote.revision).toBe(10);
  expect(runtime.remote.comments[0].reactions || {}).toEqual({});

  await choice.evaluate(node => node.click());
  await expect.poll(async () => Number((await cachedTask(page, taskId))?.revision || 0), { timeout: 8_000 }).toBe(11);
  await expect(page.locator('.comment-reaction-chip-v165[data-comment-reaction-emoji="👍"]')).toHaveCount(1);
  runtime = await page.evaluate(() => ({ init: window.__WB_V258_INIT_CALLS__, getDb: window.__WB_V258_GET_DB_CALLS__, tx: window.__WB_V258_TX_CALLS__, remote: structuredClone(window.__WB_V258_REMOTE_TASK__) }));
  expect(requests).toEqual({ app: 1, database: 1 });
  expect(runtime.init).toBe(1);
  expect(runtime.getDb).toBe(1);
  expect(runtime.tx).toBe(2);
  expect(runtime.remote.revision).toBe(11);
  expect(runtime.remote.comments[0].reactions?.['👍']).toEqual(['福冨']);

  await clickCurrent(page, '[data-comment-reply-target="parent-v258"]');
  const textarea = page.locator('#commentText');
  await textarea.fill('transaction retry reply');
  const submit = page.locator('#commentForm button[type="submit"]');
  await submit.evaluate(node => node.click());
  await expect(page.locator('#toast')).toContainText('返信を保存できませんでした');
  await expect(submit).toBeEnabled();
  await expect(textarea).toHaveValue('transaction retry reply');
  await expect(page.locator('.comment-reply-compose-v215')).toBeVisible();
  expect((await cachedTask(page, taskId)).revision).toBe(11);
  runtime = await page.evaluate(() => ({ init: window.__WB_V258_INIT_CALLS__, getDb: window.__WB_V258_GET_DB_CALLS__, tx: window.__WB_V258_TX_CALLS__, remote: structuredClone(window.__WB_V258_REMOTE_TASK__) }));
  expect(runtime.tx).toBe(3);
  expect(runtime.remote.revision).toBe(11);
  expect(runtime.remote.comments.filter(comment => comment?.replyTo === 'parent-v258')).toHaveLength(0);

  await submit.evaluate(node => node.click());
  await expect.poll(async () => Number((await cachedTask(page, taskId))?.revision || 0), { timeout: 8_000 }).toBe(12);
  await expect(textarea).toHaveValue('');
  await expect(page.locator('.comment-reply-compose-v215')).toHaveCount(0);

  const cached = await cachedTask(page, taskId);
  expect(cached.comments.filter(comment => comment?.replyTo === 'parent-v258')).toHaveLength(1);
  expect(cached.comments.find(comment => comment?.replyTo === 'parent-v258')?.text).toBe('transaction retry reply');
  expect(cached.comments.find(comment => comment?.id === 'parent-v258')?.reactions?.['👍']).toEqual(['福冨']);
  expect(cached.history).toHaveLength(1);

  runtime = await page.evaluate(() => ({ init: window.__WB_V258_INIT_CALLS__, getDb: window.__WB_V258_GET_DB_CALLS__, tx: window.__WB_V258_TX_CALLS__, remote: structuredClone(window.__WB_V258_REMOTE_TASK__) }));
  expect(requests).toEqual({ app: 1, database: 1 });
  expect(runtime.init).toBe(1);
  expect(runtime.getDb).toBe(1);
  expect(runtime.tx).toBe(4);
  expect(runtime.remote.revision).toBe(12);
  expect(runtime.remote.comments.filter(comment => comment?.replyTo === 'parent-v258')).toHaveLength(1);
  expect(runtime.remote.comments.find(comment => comment?.id === 'parent-v258')?.reactions?.['👍']).toEqual(['福冨']);
  expect(pageErrors).toEqual([]);
});
