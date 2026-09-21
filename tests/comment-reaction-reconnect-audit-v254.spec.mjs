import { test, expect } from '@playwright/test';

const ROOM = 'test-comment-reaction-reconnect-audit-v254';

function taskRecord(id) {
  const now = Date.now();
  return {
    id,
    title: 'Ver.254 リアクション再接続監査',
    description: '', requester: '', assignee: '福冨', status: '対応中', priority: '中', category: 'その他',
    tags: [], dueDate: '', dueTime: '', pinned: false, checklist: [],
    comments: [{ id: 'parent-v254', author: '森井', type: '作業メモ', text: '接続復帰監査の親コメント', createdAt: now - 2000 }],
    history: [], recurrence: 'none', recurrenceRule: {},
    createdAt: now - 20_000, createdBy: '森井', updatedAt: now - 2000, updatedBy: '森井',
    lastChange: { label: '作業メモ追加', summary: '作業メモが追加されました', details: ['作業メモ: 接続復帰監査の親コメント'] },
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

async function boot(page, task) {
  await page.addInitScript(({ room, taskRecordValue }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([taskRecordValue]));
    window.__WB_V254_CONFIG__ = { apiKey: 'v254-browser-audit', databaseURL: 'https://example.invalid' };
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return window.__WB_V254_CONFIG__; },
      set() {}
    });
  }, { room: ROOM, taskRecordValue: task });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.waitForFunction(id => Boolean(document.querySelector(`[data-task-id="${CSS.escape(id)}"]`)), task.id, { timeout: 15_000 });
  await clickCurrent(page, `[data-task-id="${task.id}"]`);
  await expect(page.locator('.task-detail-tab-v149[data-tab="comments"]')).toBeVisible({ timeout: 15_000 });
  await clickCurrent(page, '.task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator('[data-comment-reaction-picker="parent-v254"]')).toBeVisible({ timeout: 15_000 });
  await clickCurrent(page, '[data-comment-reaction-picker="parent-v254"]');
  await expect(page.locator('[data-comment-reaction-id="parent-v254"][data-comment-reaction-emoji="👍"]')).toBeVisible();
}

test('degraded no-op preserves rendered expected state until reconnect retry begins', async ({ page }) => {
  const task = taskRecord('task-v254-browser');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await boot(page, task);

  const choice = page.locator('[data-comment-reaction-id="parent-v254"][data-comment-reaction-emoji="👍"]');
  await expect(choice).toHaveAttribute('data-comment-reaction-expected-pressed', 'false');

  await page.evaluate(() => {
    const pill = document.getElementById('connectionPill');
    if (pill) pill.textContent = '共同データ読込エラー（保存不可）';
  });
  const degradedStarted = await page.evaluate(() => {
    const node = document.querySelector('[data-comment-reaction-id="parent-v254"][data-comment-reaction-emoji="👍"]');
    if (!(node instanceof HTMLButtonElement)) return null;
    node.click();
    return node.disabled;
  });
  expect(degradedStarted).toBe(false);
  await expect(page.locator('#toast')).toContainText('共同データを保存できる状態ではありません');
  await expect(choice).toHaveAttribute('data-comment-reaction-expected-pressed', 'false');

  await page.evaluate(() => {
    const pill = document.getElementById('connectionPill');
    if (pill) pill.textContent = '共同編集ON';
  });
  const onlineStarted = await page.evaluate(() => {
    const node = document.querySelector('[data-comment-reaction-id="parent-v254"][data-comment-reaction-emoji="👍"]');
    if (!(node instanceof HTMLButtonElement)) return null;
    node.click();
    return node.disabled;
  });
  expect(onlineStarted).toBe(true);
  await expect(page.locator('#toast')).toContainText('リアクションを保存できませんでした');
  await expect(choice).toHaveAttribute('data-comment-reaction-expected-pressed', 'false');
  expect(errors).toEqual([]);
});
