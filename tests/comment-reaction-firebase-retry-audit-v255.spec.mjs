import { test, expect } from '@playwright/test';

const ROOM = 'test-comment-reaction-firebase-retry-v255';
const APP_URL = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
const DB_URL = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';

function taskRecord(id) {
  const now = Date.now();
  return {
    id,
    title: 'Ver.255 Firebase module retry',
    description: '', requester: '', assignee: '福冨', status: '対応中', priority: '中', category: 'その他',
    tags: [], dueDate: '', dueTime: '', pinned: false, checklist: [],
    comments: [{ id: 'parent-v255', author: '福冨', type: '作業メモ', text: 'module retry parent', createdAt: now - 2000 }],
    history: [], recurrence: 'none', recurrenceRule: {},
    createdAt: now - 20_000, createdBy: '福冨', updatedAt: now - 2000, updatedBy: '福冨',
    completedAt: 0, completedMemo: '', revision: 10
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
  await expect(page.locator('[data-comment-reaction-picker="parent-v255"]')).toBeVisible({ timeout: 15_000 });
  await clickCurrent(page, '[data-comment-reaction-picker="parent-v255"]');
  await expect(page.locator('[data-comment-reaction-id="parent-v255"][data-comment-reaction-emoji="👍"]')).toBeVisible();
}

async function cachedTask(page, taskId) {
  return page.evaluate(({ room, id }) => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    return tasks.find(item => String(item?.id || '') === id) || null;
  }, { room: ROOM, id: taskId });
}

test('Ver.252 retries transient Firebase module failure with a fresh specifier and commits the second reaction attempt', async ({ page }) => {
  const taskId = 'task-v255-retry';
  const seeded = taskRecord(taskId);
  const pageErrors = [];
  const requestCounts = { app: 0, database: 0 };
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.addInitScript(({ room, task }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([task]));
    window.__WB_V255_CONFIG__ = null;
    window.__WB_V255_REMOTE_TASK__ = structuredClone(task);
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return window.__WB_V255_CONFIG__; },
      set() {}
    });
  }, { room: ROOM, task: seeded });

  await page.route(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-app\.js(?:\?wb-retry=\d+)?$/, async route => {
    requestCounts.app += 1;
    if (requestCounts.app === 1) return route.abort('failed');
    return route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
      body: [
        'const apps = [];',
        'export function getApps(){ return apps; }',
        'export function getApp(){ return apps[0]; }',
        'export function initializeApp(config){ const app = { config }; apps.push(app); return app; }'
      ].join('\n')
    });
  });

  await page.route(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-database\.js(?:\?wb-retry=\d+)?$/, async route => {
    requestCounts.database += 1;
    if (requestCounts.database === 1) return route.abort('failed');
    return route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
      body: [
        'export function getDatabase(app){ return { app }; }',
        'export function ref(db, path){ return { db, path }; }',
        'export async function runTransaction(target, updater){',
        '  const current = structuredClone(globalThis.__WB_V255_REMOTE_TASK__);',
        '  const next = updater(current);',
        '  if (next === undefined) return { committed: false, snapshot: { val: () => structuredClone(globalThis.__WB_V255_REMOTE_TASK__) } };',
        '  globalThis.__WB_V255_REMOTE_TASK__ = structuredClone(next);',
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
    window.__WB_V255_CONFIG__ = {
      apiKey: 'v255-transient-module-retry',
      databaseURL: 'https://example.invalid',
      projectId: 'v255-audit'
    };
    const pill = document.getElementById('connectionPill');
    if (pill) pill.textContent = '共同編集ON';
  });

  const choice = page.locator('[data-comment-reaction-id="parent-v255"][data-comment-reaction-emoji="👍"]');
  await choice.evaluate(node => node.click());
  await expect(page.locator('#toast')).toContainText('リアクションを保存できませんでした');
  await expect(choice).toBeEnabled();

  let cached = await cachedTask(page, taskId);
  expect(cached.revision).toBe(10);
  expect(cached.comments[0].reactions || {}).toEqual({});
  expect(await page.evaluate(() => window.__WB_V255_REMOTE_TASK__.revision)).toBe(10);
  expect(requestCounts).toEqual({ app: 1, database: 1 });

  await choice.evaluate(node => node.click());
  await expect.poll(async () => Number((await cachedTask(page, taskId))?.revision || 0), { timeout: 8_000 }).toBe(11);
  await expect(choice).toBeEnabled();

  cached = await cachedTask(page, taskId);
  expect(cached.revision).toBe(11);
  expect(cached.comments[0].reactions['👍']).toEqual(['福冨']);
  expect(await page.evaluate(() => window.__WB_V255_REMOTE_TASK__.revision)).toBe(11);
  expect(requestCounts).toEqual({ app: 2, database: 2 });
  await expect(page.locator('.comment-reaction-chip-v165[data-comment-reaction-emoji="👍"]')).toHaveCount(1);
  expect(pageErrors).toEqual([]);
});
