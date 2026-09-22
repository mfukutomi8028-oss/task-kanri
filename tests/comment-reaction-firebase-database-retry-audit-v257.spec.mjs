import { test, expect } from '@playwright/test';

const ROOM = 'test-comment-reaction-firebase-database-retry-v257';

function taskRecord(id) {
  const now = Date.now();
  return {
    id, title: 'Ver.257 getDatabase retry audit', description: '', requester: '', assignee: '福冨',
    status: '対応中', priority: '中', category: 'その他', tags: [], dueDate: '', dueTime: '', pinned: false, checklist: [],
    comments: [{ id: 'parent-v257-db', author: '森井', type: '作業メモ', text: 'database retry parent', createdAt: now - 2000 }],
    history: [], recurrence: 'none', recurrenceRule: {}, createdAt: now - 20_000, createdBy: '森井',
    updatedAt: now - 2000, updatedBy: '森井', completedAt: 0, completedMemo: '', revision: 10
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
  await expect(page.locator('.activity-comment[data-comment-id="parent-v257-db"]')).toBeVisible({ timeout: 15_000 });
}

async function cachedTask(page, taskId) {
  return page.evaluate(({ room, id }) => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    return tasks.find(item => String(item?.id || '') === id) || null;
  }, { room: ROOM, id: taskId });
}

test('getDatabase transient failure reuses loaded modules and initialized app on the next same-page attempt', async ({ page }) => {
  const taskId = 'task-v257-db-retry';
  const seeded = taskRecord(taskId);
  const requests = { app: 0, database: 0 };
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.addInitScript(({ room, task }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([task]));
    window.__WB_V257_DB_CONFIG__ = null;
    window.__WB_V257_DB_REMOTE_TASK__ = structuredClone(task);
    window.__WB_V257_DB_INIT_CALLS__ = 0;
    window.__WB_V257_DB_GET_CALLS__ = 0;
    window.__WB_V257_DB_TX_CALLS__ = 0;
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return window.__WB_V257_DB_CONFIG__; },
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
        'export function initializeApp(config){ globalThis.__WB_V257_DB_INIT_CALLS__ += 1; const app = { config }; apps.push(app); return app; }'
      ].join('\n')
    });
  });

  await page.route(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-database\.js(?:\?wb-retry=\d+)?$/, route => {
    requests.database += 1;
    return route.fulfill({
      status: 200, contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
      body: [
        'export function getDatabase(app){',
        '  globalThis.__WB_V257_DB_GET_CALLS__ += 1;',
        '  if (globalThis.__WB_V257_DB_GET_CALLS__ === 1) throw new Error("v257-db-transient");',
        '  return { app };',
        '}',
        'export function ref(db, path){ return { db, path }; }',
        'export async function runTransaction(target, updater){',
        '  globalThis.__WB_V257_DB_TX_CALLS__ += 1;',
        '  const current = structuredClone(globalThis.__WB_V257_DB_REMOTE_TASK__);',
        '  const next = updater(current);',
        '  if (next === undefined) return { committed: false, snapshot: { val: () => structuredClone(globalThis.__WB_V257_DB_REMOTE_TASK__) } };',
        '  globalThis.__WB_V257_DB_REMOTE_TASK__ = structuredClone(next);',
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
    window.__WB_V257_DB_CONFIG__ = { apiKey: 'v257-db-retry', databaseURL: 'https://example.invalid', projectId: 'v257-db-audit' };
    const pill = document.getElementById('connectionPill');
    if (pill) pill.textContent = '共同編集ON';
  });

  await clickCurrent(page, '[data-comment-reaction-picker="parent-v257-db"]');
  const choice = page.locator('.comment-reaction-choice-v165[data-comment-reaction-id="parent-v257-db"][data-comment-reaction-emoji="👍"]');
  await choice.evaluate(node => node.click());
  await expect(page.locator('#toast')).toContainText('リアクションを保存できませんでした');
  await expect(choice).toBeEnabled();
  expect(requests).toEqual({ app: 1, database: 1 });
  expect((await cachedTask(page, taskId)).revision).toBe(10);
  let runtime = await page.evaluate(() => ({ init: window.__WB_V257_DB_INIT_CALLS__, getDb: window.__WB_V257_DB_GET_CALLS__, tx: window.__WB_V257_DB_TX_CALLS__ }));
  expect(runtime).toEqual({ init: 1, getDb: 1, tx: 0 });

  await choice.evaluate(node => node.click());
  await expect.poll(async () => Number((await cachedTask(page, taskId))?.revision || 0), { timeout: 8_000 }).toBe(11);
  expect(requests).toEqual({ app: 1, database: 1 });
  runtime = await page.evaluate(() => ({
    init: window.__WB_V257_DB_INIT_CALLS__, getDb: window.__WB_V257_DB_GET_CALLS__, tx: window.__WB_V257_DB_TX_CALLS__,
    remote: structuredClone(window.__WB_V257_DB_REMOTE_TASK__)
  }));
  expect(runtime.init).toBe(1);
  expect(runtime.getDb).toBe(2);
  expect(runtime.tx).toBe(1);
  expect(runtime.remote.revision).toBe(11);
  expect(runtime.remote.comments[0].reactions?.['👍']).toEqual(['福冨']);
  await expect(page.locator('.comment-reaction-chip-v165[data-comment-reaction-emoji="👍"]')).toHaveCount(1);
  expect(pageErrors).toEqual([]);
});
