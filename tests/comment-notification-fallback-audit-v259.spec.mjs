import { test, expect } from '@playwright/test';

const ROOM = 'test-comment-notification-fallback-v259';

function taskRecord(id) {
  const now = Date.now();
  return {
    id, title: 'Ver.259 notification fallback audit', description: '', requester: '', assignee: '福冨',
    status: '対応中', priority: '中', category: 'その他', tags: [], dueDate: '', dueTime: '', pinned: false, checklist: [],
    comments: [{ id: 'parent-v259', author: '森井', type: '作業メモ', text: 'notification fallback parent', createdAt: now - 2000 }],
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
  await expect(page.locator('.activity-comment[data-comment-id="parent-v259"]')).toBeVisible({ timeout: 15_000 });
}

async function cachedTask(page, taskId) {
  return page.evaluate(({ room, id }) => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    return tasks.find(item => String(item?.id || '') === id) || null;
  }, { room: ROOM, id: taskId });
}

test('direct inbox failure after commit does not roll back reaction or reply state', async ({ page }) => {
  const taskId = 'task-v259-direct-failure';
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
    window.__WB_V259_CONFIG__ = null;
    window.__WB_V259_REMOTE_TASK__ = structuredClone(task);
    window.__WB_V259_NOTIFICATION_CALLS__ = [];
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return window.__WB_V259_CONFIG__; },
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
        'export function initializeApp(config){ const app = { config }; apps.push(app); return app; }'
      ].join('\n')
    });
  });

  await page.route(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-database\.js(?:\?wb-retry=\d+)?$/, route => {
    requests.database += 1;
    return route.fulfill({
      status: 200, contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
      body: [
        'export function getDatabase(app){ return { app }; }',
        'export function ref(db, path){ return { db, path }; }',
        'export async function runTransaction(target, updater){',
        '  const current = structuredClone(globalThis.__WB_V259_REMOTE_TASK__);',
        '  const next = updater(current);',
        '  if (next === undefined) return { committed: false, snapshot: { val: () => structuredClone(globalThis.__WB_V259_REMOTE_TASK__) } };',
        '  globalThis.__WB_V259_REMOTE_TASK__ = structuredClone(next);',
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
    const workflow = window.WorkBoardWorkflowV152;
    if (!workflow?.writeInboxEvent) throw new Error('v259-workflow-missing');
    workflow.writeInboxEvent = async (recipient, id, event) => {
      window.__WB_V259_NOTIFICATION_CALLS__.push({ recipient, id, type: event?.type || '' });
      throw new Error('v259-direct-inbox-transient');
    };
    window.__WB_V259_CONFIG__ = { apiKey: 'v259-notification-fallback', databaseURL: 'https://example.invalid', projectId: 'v259-audit' };
    const pill = document.getElementById('connectionPill');
    if (pill) pill.textContent = '共同編集ON';
  });

  await clickCurrent(page, '[data-comment-reaction-picker="parent-v259"]');
  const choice = page.locator('.comment-reaction-choice-v165[data-comment-reaction-id="parent-v259"][data-comment-reaction-emoji="👍"]');
  await choice.evaluate(node => node.click());
  await expect.poll(async () => Number((await cachedTask(page, taskId))?.revision || 0), { timeout: 8_000 }).toBe(11);
  await expect(page.locator('.comment-reaction-chip-v165[data-comment-reaction-emoji="👍"]')).toHaveCount(1);

  await clickCurrent(page, '[data-comment-reply-target="parent-v259"]');
  const textarea = page.locator('#commentText');
  await textarea.fill('notification fallback reply');
  const submit = page.locator('#commentForm button[type="submit"]');
  await submit.evaluate(node => node.click());
  await expect.poll(async () => Number((await cachedTask(page, taskId))?.revision || 0), { timeout: 8_000 }).toBe(12);
  await expect(textarea).toHaveValue('');
  await expect(page.locator('.comment-reply-compose-v215')).toHaveCount(0);

  const cached = await cachedTask(page, taskId);
  expect(cached.comments.find(comment => comment?.id === 'parent-v259')?.reactions?.['👍']).toEqual(['福冨']);
  expect(cached.comments.filter(comment => comment?.replyTo === 'parent-v259')).toHaveLength(1);
  expect(cached.comments.find(comment => comment?.replyTo === 'parent-v259')?.text).toBe('notification fallback reply');
  expect(cached.history).toHaveLength(1);

  const runtime = await page.evaluate(() => ({
    remote: structuredClone(window.__WB_V259_REMOTE_TASK__),
    notifications: structuredClone(window.__WB_V259_NOTIFICATION_CALLS__)
  }));
  expect(runtime.remote.revision).toBe(12);
  expect(runtime.remote.comments.find(comment => comment?.id === 'parent-v259')?.reactions?.['👍']).toEqual(['福冨']);
  expect(runtime.remote.comments.filter(comment => comment?.replyTo === 'parent-v259')).toHaveLength(1);
  expect(runtime.notifications.filter(item => item.type === 'reaction')).toHaveLength(1);
  expect(runtime.notifications.filter(item => item.type === 'reply')).toHaveLength(1);
  expect(runtime.notifications.find(item => item.type === 'reaction')?.id).toBe(`reaction_${taskId}_parent-v259_👍_福冨_11`);
  expect(runtime.notifications.find(item => item.type === 'reply')?.id).toMatch(new RegExp(`^reply_${taskId}_reply-.+_森井$`));
  expect(requests).toEqual({ app: 1, database: 1 });
  expect(pageErrors).toEqual([]);
});
