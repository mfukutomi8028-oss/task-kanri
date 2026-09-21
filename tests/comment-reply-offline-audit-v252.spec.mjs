import { test, expect } from '@playwright/test';

const ROOM = 'test-comment-reply-offline-audit-v252';

function taskRecord(id) {
  const now = Date.now();
  return {
    id,
    title: 'Ver.250 オフライン返信製品確認',
    description: '', requester: '', assignee: '福冨', status: '対応中', priority: '中', category: 'その他',
    tags: [], dueDate: '', dueTime: '', pinned: false, checklist: [],
    comments: [{ id: 'parent-v252', author: '森井', type: '作業メモ', text: 'ローカル返信の親コメント', createdAt: now - 2000 }],
    history: [], recurrence: 'none', recurrenceRule: {},
    createdAt: now - 20_000, createdBy: '森井', updatedAt: now - 2000, updatedBy: '森井',
    lastChange: { label: '作業メモ追加', summary: '作業メモが追加されました', details: ['作業メモ: ローカル返信の親コメント'] },
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
  await expect(page.locator('.activity-comment[data-comment-id="parent-v252"]')).toBeVisible({ timeout: 15_000 });
}

async function bootLocalOnly(page, taskId) {
  const seeded = taskRecord(taskId);
  await page.addInitScript(({ room, user, task }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', user);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([task]));
    window.__WB_TEST_FIREBASE_CONFIG_V250__ = null;
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return window.__WB_TEST_FIREBASE_CONFIG_V250__ || null; },
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

test('local-only reply is stored once as structured directed reply without task-wide update metadata churn', async ({ page }) => {
  const taskId = 'task-v252-local-only';
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const seeded = await bootLocalOnly(page, taskId);

  await clickCurrent(page, '[data-comment-reply-target="parent-v252"]');
  await expect(page.locator('.comment-reply-compose-v215')).toBeVisible();
  await page.locator('#commentType').selectOption({ label: '確認依頼' });
  await page.locator('#commentText').fill('ローカル返信本文');
  await clickCurrent(page, '#commentForm button[type="submit"]');

  await expect.poll(async () => page.evaluate(({ room, id }) => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    const task = tasks.find(item => item.id === id);
    return task?.comments?.length || 0;
  }, { room: ROOM, id: taskId }), { timeout: 10_000 }).toBe(2);

  const stored = await page.evaluate(({ room, id }) => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    return tasks.find(item => item.id === id);
  }, { room: ROOM, id: taskId });

  const reply = stored.comments.find(comment => comment.id !== 'parent-v252');
  expect(reply.text).toBe('ローカル返信本文');
  expect(reply.replyTo).toBe('parent-v252');
  expect(stored.revision).toBe(11);
  expect(stored.updatedAt).toBe(seeded.updatedAt);
  expect(stored.updatedBy).toBe(seeded.updatedBy);
  expect(stored.lastChange).toEqual(seeded.lastChange);

  await expect(page.locator('.comment-reply-item-v215 .activity-text')).toContainText('ローカル返信本文');
  await expect(page.locator('.comment-reply-item-v215 .activity-text')).not.toContainText('[[wb-reply:');
  await expect(page.locator('.comment-reply-compose-v215')).toHaveCount(0);
  await expect(page.locator('#commentText')).toHaveValue('');
  expect(pageErrors).toEqual([]);
});

test('configured non-online reply keeps the draft and reply target instead of delegating to canonical save', async ({ page }) => {
  const taskId = 'task-v252-degraded';
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await bootLocalOnly(page, taskId);

  await page.evaluate(() => {
    window.__WB_TEST_FIREBASE_CONFIG_V250__ = { apiKey: 'configured-for-boundary-test', databaseURL: 'https://example.invalid' };
    const pill = document.getElementById('connectionPill');
    if (pill) pill.textContent = '共同データ読込エラー（保存不可）';
  });

  await clickCurrent(page, '[data-comment-reply-target="parent-v252"]');
  await expect(page.locator('.comment-reply-compose-v215')).toBeVisible();
  await page.locator('#commentText').fill('接続復旧後に送る返信');
  await clickCurrent(page, '#commentForm button[type="submit"]');

  await page.waitForTimeout(250);
  await expect(page.locator('#commentText')).toHaveValue('接続復旧後に送る返信');
  await expect(page.locator('.comment-reply-compose-v215')).toBeVisible();
  const storedCount = await page.evaluate(({ room, id }) => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    return tasks.find(item => item.id === id)?.comments?.length || 0;
  }, { room: ROOM, id: taskId });
  expect(storedCount).toBe(1);
  await expect(page.locator('#toast')).toContainText('返信内容は保持しています');
  expect(pageErrors).toEqual([]);
});
