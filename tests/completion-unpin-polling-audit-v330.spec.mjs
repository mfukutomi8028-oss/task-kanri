import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-completion-unpin-polling-v330';

function task(id, status = '未着手', pinned = true, revision = 1) {
  const now = 1760000000000;
  return {
    id,
    title: `Ver.330 ${id}`,
    status,
    assignee: '福冨',
    requester: '',
    category: 'その他',
    priority: '中',
    tags: [],
    description: '',
    checklist: [],
    recurrence: 'none',
    dueDate: '',
    dueTime: '',
    pinned,
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

async function boot(page, { room, initialTask }) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ room, initialTask }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '土屋']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([initialTask]));

    const nativeSetInterval = window.setInterval.bind(window);
    window.__v330Intervals = [];
    window.setInterval = (callback, delay, ...args) => {
      const record = { delay: Number(delay), callbacks: 0 };
      const wrapped = (...callbackArgs) => {
        record.callbacks += 1;
        return callback(...callbackArgs);
      };
      const id = nativeSetInterval(wrapped, delay, ...args);
      record.id = Number(id);
      window.__v330Intervals.push(record);
      return id;
    };

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room, initialTask });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV150?.dependencyState?.() === 'local-only', undefined, { timeout: 10_000 });
  await page.waitForFunction(() => window.__v330Intervals.some(item => item.delay === 1500), undefined, { timeout: 8_000 });
}

async function cachedTask(page, room, id) {
  return page.evaluate(({ room, id }) => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    return tasks.find(item => String(item?.id || '') === id) || null;
  }, { room, id });
}

async function waitForFirstRepairTick(page) {
  await page.waitForFunction(() => {
    const timer = window.__v330Intervals.find(item => item.delay === 1500);
    return Number(timer?.callbacks || 0) >= 1;
  }, undefined, { timeout: 5_000 });
}

async function writeCompletedPinned(page, room, id) {
  await page.evaluate(({ room, id }) => {
    const key = `system-task-tasks:${room}`;
    const tasks = JSON.parse(localStorage.getItem(key) || '[]');
    const next = tasks.map(item => String(item?.id || '') === id
      ? { ...item, status: '完了', pinned: true, completedAt: Date.now() }
      : item);
    localStorage.setItem(key, JSON.stringify(next));
  }, { room, id });
}

test('Ver.330 audit: local-only task cache change is repaired by the 1500ms fallback when no workflow event fires', async ({ page }) => {
  const room = `${ROOM_PREFIX}-poll`;
  const id = 'poll-target';
  await boot(page, { room, initialTask: task(id) });
  await waitForFirstRepairTick(page);

  const before = await page.evaluate(() => {
    const timer = window.__v330Intervals.find(item => item.delay === 1500);
    return { callbacks: timer?.callbacks || 0, intervals: window.__v330Intervals.filter(item => item.delay === 1500).length };
  });
  expect(before.intervals).toBe(1);

  await writeCompletedPinned(page, room, id);
  await page.waitForTimeout(300);
  const beforeNextTick = await cachedTask(page, room, id);
  expect(beforeNextTick?.pinned).toBe(true);
  expect(beforeNextTick?.revision).toBe(1);

  await page.waitForFunction(({ room, id }) => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    const current = tasks.find(item => String(item?.id || '') === id);
    const timer = window.__v330Intervals.find(item => item.delay === 1500);
    return current?.pinned === false && Number(timer?.callbacks || 0) > 1;
  }, { room, id }, { timeout: 3_500 });

  const repaired = await cachedTask(page, room, id);
  expect(repaired?.pinned).toBe(false);
  expect(repaired?.revision).toBe(2);
});

test('Ver.330 audit: workflow-v150-update can repair immediately, but only when that workflow event is explicitly emitted', async ({ page }) => {
  const room = `${ROOM_PREFIX}-event`;
  const id = 'event-target';
  await boot(page, { room, initialTask: task(id) });
  await waitForFirstRepairTick(page);

  const baselineCallbacks = await page.evaluate(() => window.__v330Intervals.find(item => item.delay === 1500)?.callbacks || 0);
  await writeCompletedPinned(page, room, id);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('workflow-v150-update')));

  await expect.poll(async () => (await cachedTask(page, room, id))?.pinned, { timeout: 800 }).toBe(false);
  const after = await cachedTask(page, room, id);
  expect(after?.revision).toBe(2);
  expect(await page.evaluate(() => window.__v330Intervals.find(item => item.delay === 1500)?.callbacks || 0)).toBe(baselineCallbacks);
});

test('Ver.330 audit: startup local repair fixes a pre-existing completed pinned task before polling is needed', async ({ page }) => {
  const room = `${ROOM_PREFIX}-startup`;
  const id = 'startup-target';
  await boot(page, { room, initialTask: task(id, '完了', true, 4) });

  await expect.poll(async () => (await cachedTask(page, room, id))?.pinned, { timeout: 800 }).toBe(false);
  const repaired = await cachedTask(page, room, id);
  expect(repaired?.revision).toBe(5);
  expect(await page.evaluate(() => window.__v330Intervals.filter(item => item.delay === 1500).length)).toBe(1);
});
