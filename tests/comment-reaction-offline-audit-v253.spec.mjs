import { test, expect } from '@playwright/test';

const ROOM = 'test-comment-reaction-offline-audit-v253';

function taskRecord(id) {
  const now = Date.now();
  return {
    id,
    title: 'Ver.251 リアクション接続境界回帰',
    description: '', requester: '', assignee: '福冨', status: '対応中', priority: '中', category: 'その他',
    tags: [], dueDate: '', dueTime: '', pinned: false, checklist: [],
    comments: [{ id: 'parent-v253', author: '森井', type: '作業メモ', text: 'リアクション接続境界の親コメント', createdAt: now - 2000 }],
    history: [], recurrence: 'none', recurrenceRule: {},
    createdAt: now - 20_000, createdBy: '森井', updatedAt: now - 2000, updatedBy: '森井',
    lastChange: { label: '作業メモ追加', summary: '作業メモが追加されました', details: ['作業メモ: リアクション接続境界の親コメント'] },
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
  await expect(page.locator('.activity-comment[data-comment-id="parent-v253"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-comment-reaction-picker="parent-v253"]')).toBeVisible({ timeout: 15_000 });
}

async function bootLocalOnly(page, taskId) {
  const seeded = taskRecord(taskId);
  await page.addInitScript(({ room, user, task }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', user);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([task]));
    window.__WB_TEST_FIREBASE_CONFIG_V253__ = null;
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return window.__WB_TEST_FIREBASE_CONFIG_V253__ || null; },
      set() {}
    });
  }, { room: ROOM, user: '福冨', task: seeded });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('connectionPill')?.textContent?.includes('端末内保存'), undefined, { timeout: 15_000 });
  await openTaskComments(page, taskId);
  return seeded;
}

async function dispatchThumbsUp(page) {
  await clickCurrent(page, '[data-comment-reaction-picker="parent-v253"]');
  await expect(page.locator('[data-comment-reaction-id="parent-v253"][data-comment-reaction-emoji="👍"]')).toBeVisible();
  return page.evaluate(() => {
    const node = document.querySelector('[data-comment-reaction-id="parent-v253"][data-comment-reaction-emoji="👍"]');
    if (!(node instanceof HTMLButtonElement)) return false;
    node.click();
    return node.disabled;
  });
}

async function storedTask(page, taskId) {
  return page.evaluate(({ room, id }) => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    return tasks.find(item => item.id === id) || null;
  }, { room: ROOM, id: taskId });
}

test('local-only blocks reaction before the remote writer starts and leaves task state unchanged', async ({ page }) => {
  const taskId = 'task-v253-local-only';
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await bootLocalOnly(page, taskId);

  const disabledDuringDispatch = await dispatchThumbsUp(page);
  expect(disabledDuringDispatch).toBe(false);
  await expect(page.locator('#toast')).toContainText('リアクションは共同編集ONで利用できます');

  const stored = await storedTask(page, taskId);
  expect(stored.revision).toBe(10);
  expect(stored.comments[0].reactions || {}).toEqual({});
  await expect(page.locator('.comment-reaction-chip-v165[data-comment-reaction-emoji="👍"]')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('configured degraded state blocks reaction before Firebase and an online retry still reaches the writer without ghost state', async ({ page }) => {
  const taskId = 'task-v253-degraded';
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await bootLocalOnly(page, taskId);

  await page.evaluate(() => {
    window.__WB_TEST_FIREBASE_CONFIG_V253__ = { apiKey: 'configured-for-v253-regression', databaseURL: 'https://example.invalid' };
    const pill = document.getElementById('connectionPill');
    if (pill) pill.textContent = '共同データ読込エラー（保存不可）';
  });

  let disabledDuringDispatch = await dispatchThumbsUp(page);
  expect(disabledDuringDispatch).toBe(false);
  await expect(page.locator('#toast')).toContainText('共同データを保存できる状態ではありません');

  let stored = await storedTask(page, taskId);
  expect(stored.revision).toBe(10);
  expect(stored.comments[0].reactions || {}).toEqual({});
  await expect(page.locator('.comment-reaction-chip-v165[data-comment-reaction-emoji="👍"]')).toHaveCount(0);

  await page.evaluate(() => {
    const pill = document.getElementById('connectionPill');
    if (pill) pill.textContent = '共同編集ON';
  });
  disabledDuringDispatch = await dispatchThumbsUp(page);
  expect(disabledDuringDispatch).toBe(true);
  await expect(page.locator('#toast')).toContainText('リアクションを保存できませんでした');

  stored = await storedTask(page, taskId);
  expect(stored.revision).toBe(10);
  expect(stored.comments[0].reactions || {}).toEqual({});
  expect(pageErrors).toEqual([]);
});
