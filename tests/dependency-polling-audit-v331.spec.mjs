import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-dependency-polling-v331';

function task(id, title, status = '未着手', revision = 1) {
  const now = 1760000000000;
  return {
    id,
    title,
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

async function boot(page, room) {
  const blocker = task('blocker', '前提タスク');
  const target = task('target', '対象タスク');
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ room, blocker, target }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '土屋']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([blocker, target]));
    localStorage.setItem(`work-board-workflow-v148:${room}`, JSON.stringify({
      dependencies: { target: { blocker: true } },
      savedViews: {},
      relations: {},
      reminders: {}
    }));

    const nativeSetInterval = window.setInterval.bind(window);
    window.__v331DependencyInterval = null;
    window.setInterval = (callback, delay, ...args) => {
      const stack = String(new Error().stack || '');
      if (Number(delay) === 60000 && stack.includes('dependencies-v149.js')) {
        window.__v331DependencyInterval = { delay: Number(delay), callbacks: 0, callback };
        return 331000;
      }
      return nativeSetInterval(callback, delay, ...args);
    };

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room, blocker, target });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
  await page.goto(`/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV150?.dependencyState?.() === 'local-only', undefined, { timeout: 10_000 });
  await page.waitForFunction(() => Boolean(window.__v331DependencyInterval), undefined, { timeout: 8_000 });
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await page.waitForSelector('[data-task-id="target"]');
}

async function openTask(page, id) {
  await page.evaluate(taskId => document.querySelector(`[data-task-id="${CSS.escape(taskId)}"]`)?.click(), id);
  await page.waitForFunction(taskId => {
    const key = document.querySelector('#detailBody [data-action="delete"]')?.dataset?.operationKey || '';
    return key === `task-delete:${taskId}`;
  }, id);
}

async function cachedTask(page, room, id) {
  return page.evaluate(({ room, id }) => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    return tasks.find(item => String(item?.id || '') === id) || null;
  }, { room, id });
}

test('Ver.331 audit: startup dependency guard is correct with the 60s interval suppressed', async ({ page }) => {
  const room = `${ROOM_PREFIX}-startup`;
  await boot(page, room);
  await openTask(page, 'target');

  await expect(page.locator('#detailBody .workflow-prereq-pending-v149')).toContainText('前提タスク未完了');
  await expect(page.locator('#detailBody [data-action="done"]')).toHaveAttribute('aria-disabled', 'true');
  expect(await page.evaluate(() => window.__v331DependencyInterval?.callbacks || 0)).toBe(0);
});

test('Ver.331 audit: canonical task status change reconciles dependency UI without the 60s interval', async ({ page }) => {
  const room = `${ROOM_PREFIX}-status`;
  await boot(page, room);
  await openTask(page, 'blocker');

  page.once('dialog', dialog => dialog.accept(''));
  await page.locator('#detailBody [data-quick-task-status]').selectOption('完了');
  await expect.poll(async () => (await cachedTask(page, room, 'blocker'))?.status, { timeout: 3_000 }).toBe('完了');

  await openTask(page, 'target');
  await expect(page.locator('#detailBody .workflow-prereq-ready-v149')).toContainText('前提タスク完了');
  await expect(page.locator('#detailBody [data-action="done"]')).toHaveAttribute('aria-disabled', 'false');
  expect(await page.evaluate(() => window.__v331DependencyInterval?.callbacks || 0)).toBe(0);
});

test('Ver.331 audit: workflow dependency write reconciles immediately through workflow events without the 60s interval', async ({ page }) => {
  const room = `${ROOM_PREFIX}-workflow`;
  await boot(page, room);
  await openTask(page, 'target');
  await expect(page.locator('#detailBody .workflow-prereq-pending-v149')).toContainText('前提タスク未完了');
  await expect(page.locator('#detailBody [data-action="done"]')).toHaveAttribute('aria-disabled', 'true');

  const result = await page.evaluate(async () => window.WorkBoardWorkflowV150.writeDependencies('target', [], ['blocker']));
  expect(result?.ok).toBe(true);

  await expect(page.locator('#detailBody .workflow-prereq-pending-v149')).toHaveCount(0);
  await expect(page.locator('#detailBody [data-action="done"]')).toHaveAttribute('aria-disabled', 'false');
  expect(await page.evaluate(() => window.__v331DependencyInterval?.callbacks || 0)).toBe(0);
});
