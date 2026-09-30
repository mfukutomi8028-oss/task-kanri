import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-inbox-events-polling-v333';

function task(id, title, { status = '未着手', assignee = '土屋', revision = 1 } = {}) {
  const now = 1760000000000;
  return {
    id,
    title,
    status,
    assignee,
    requester: '',
    category: 'その他',
    priority: '中',
    tags: [],
    description: '',
    checklist: [],
    recurrence: 'none',
    dueDate: '',
    dueTime: '',
    pinned: false,
    completedAt: status === '完了' ? now : 0,
    completedMemo: '',
    comments: [],
    history: [],
    revision,
    createdBy: '福冨',
    createdAt: now,
    updatedBy: '福冨',
    updatedAt: now
  };
}

async function boot(page, suffix) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  const target = task('target', 'Ver.333 通知監査タスク');

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ room, target }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '土屋']));
    localStorage.setItem(`system-task-layout:${room}`, 'tasks');
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([target]));

    const nativeSetInterval = window.setInterval.bind(window);
    window.__v333InboxIntervals = [];
    window.setInterval = (callback, delay, ...args) => {
      const stack = String(new Error().stack || '');
      const owned = Number(delay) === 1500 && stack.includes('inbox-events-v183.js');
      if (owned) {
        const record = { delay: Number(delay), stack, callbacks: 0, suppressed: true, callback };
        window.__v333InboxIntervals.push(record);
        return 933300 + window.__v333InboxIntervals.length;
      }
      return nativeSetInterval(callback, delay, ...args);
    };

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room, target });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.dependencyState?.() === 'local-only', undefined, { timeout: 10_000 });
  await page.waitForFunction(() => window.__v333InboxIntervals?.length === 1, undefined, { timeout: 8_000 });

  await page.locator('.nav-item[data-layout="tasks"]').click();
  await expect(page.locator('.task-card[data-task-id="target"]')).toBeVisible();
  return { room };
}

async function invokeOwnedPoll(page) {
  await page.evaluate(() => {
    const record = window.__v333InboxIntervals?.[0];
    if (!record) throw new Error('Ver.333 inbox interval not captured');
    record.callbacks += 1;
    record.callback();
  });
}

async function pendingEntries(page, room) {
  return page.evaluate(({ room }) => {
    const prefix = `work-board-inbox-pending-v254:${room}:`;
    const out = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      try { out.push(JSON.parse(localStorage.getItem(key) || 'null')); } catch (_) {}
    }
    return out.filter(Boolean);
  }, { room });
}

test('Ver.333 audit: local-only canonical task update is detected only when the inbox-owned poll runs', async ({ page }) => {
  const { room } = await boot(page, 'status');

  expect(await page.evaluate(() => ({
    count: window.__v333InboxIntervals?.length || 0,
    callbacks: window.__v333InboxIntervals?.[0]?.callbacks || 0,
    suppressed: window.__v333InboxIntervals?.[0]?.suppressed === true
  }))).toEqual({ count: 1, callbacks: 0, suppressed: true });

  // Establish the same initial snapshot the real 1500ms poll would establish.
  await invokeOwnedPoll(page);
  expect(await pendingEntries(page, room)).toEqual([]);

  const card = page.locator('.task-card[data-task-id="target"]');
  await card.evaluate(node => node.click());
  await expect(page.locator('#detailBody')).toContainText('Ver.333 通知監査タスク');
  await page.locator('#detailBody [data-quick-task-status]').selectOption('進行中');

  await expect.poll(async () => page.evaluate(({ room }) => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    return tasks.find(item => item.id === 'target')?.status || '';
  }, { room })).toBe('進行中');

  // No workflow event or DOM reconciliation path calls processSnapshot in local-only mode.
  await page.waitForTimeout(250);
  expect(await pendingEntries(page, room)).toEqual([]);
  expect(await page.evaluate(() => window.__v333InboxIntervals?.[0]?.callbacks || 0)).toBe(1);

  // The owned poll is the mechanism that notices the revision change and generates the durable event.
  await invokeOwnedPoll(page);
  await expect.poll(async () => (await pendingEntries(page, room)).length).toBe(1);
  const [entry] = await pendingEntries(page, room);
  expect(entry.recipient).toBe('土屋');
  expect(entry.event?.type).toBe('status');
  expect(entry.event?.taskId).toBe('target');
  expect(entry.event?.body).toContain('未着手 → 進行中');
});
