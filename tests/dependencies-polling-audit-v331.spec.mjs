import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-dependencies-polling-v331';

function task(id, title, { status = '未着手', revision = 1 } = {}) {
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

async function boot(page, suffix) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  const blocker = task('blocker', 'Ver.331 前提タスク');
  const dependent = task('dependent', 'Ver.331 依存タスク');

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ room, blocker, dependent }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '土屋']));
    localStorage.setItem(`system-task-layout:${room}`, 'board');
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([blocker, dependent]));
    localStorage.setItem(`work-board-workflow-v148:${room}`, JSON.stringify({
      dependencies: { dependent: { blocker: true } },
      savedViews: {},
      relations: {},
      reminders: {}
    }));

    const nativeSetInterval = window.setInterval.bind(window);
    window.__v331DependencyIntervals = [];
    window.setInterval = (callback, delay, ...args) => {
      const stack = String(new Error().stack || '');
      const owned = Number(delay) === 60000 && stack.includes('dependencies-v149.js');
      if (owned) {
        const record = { delay: Number(delay), stack, callbacks: 0, suppressed: true };
        window.__v331DependencyIntervals.push(record);
        return 933100 + window.__v331DependencyIntervals.length;
      }
      return nativeSetInterval(callback, delay, ...args);
    };

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room, blocker, dependent });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV150?.dependencyState?.() === 'local-only', undefined, { timeout: 10_000 });
  await page.waitForFunction(() => window.__v331DependencyIntervals?.length === 1, undefined, { timeout: 8_000 });

  await page.locator('.nav-item[data-layout="tasks"]').click();
  await expect(page.locator('.task-card[data-task-id="dependent"]')).toBeVisible();

  return { room };
}

async function openTask(page, id) {
  const card = page.locator(`.task-card[data-task-id="${id}"]`);
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.locator('#detailBody')).toContainText(id === 'blocker' ? 'Ver.331 前提タスク' : 'Ver.331 依存タスク');
}

function dependencyTimerState(page) {
  return page.evaluate(() => ({
    count: window.__v331DependencyIntervals?.length || 0,
    callbacks: (window.__v331DependencyIntervals || []).reduce((sum, item) => sum + Number(item.callbacks || 0), 0),
    suppressed: (window.__v331DependencyIntervals || []).every(item => item.suppressed === true)
  }));
}

test('Ver.331 audit: startup dependency UI is correct while the owned 60s interval is suppressed', async ({ page }) => {
  await boot(page, 'startup');

  const dependent = page.locator('.task-card[data-task-id="dependent"]');
  await expect(dependent).toHaveClass(/workflow-has-prereq-pending-v149/);
  await expect(dependent.locator('.workflow-prereq-inline-v149')).toContainText('前提タスク未完了 1');

  await openTask(page, 'dependent');
  await expect(page.locator('#detailBody .workflow-dependencies-v149')).toContainText('1件の前提タスクが未完了です。');
  await expect(page.locator('#detailBody [data-action="done"]')).toHaveAttribute('aria-disabled', 'true');

  expect(await dependencyTimerState(page)).toEqual({ count: 1, callbacks: 0, suppressed: true });
});

test('Ver.331 audit: canonical task completion reconciles dependency guard without the 60s interval', async ({ page }) => {
  const { room } = await boot(page, 'task-completion');

  await openTask(page, 'blocker');
  page.once('dialog', dialog => dialog.accept('Ver.331 audit completion'));
  await page.locator('#detailBody [data-quick-task-status]').selectOption('完了');

  await expect.poll(async () => page.evaluate(({ room }) => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    return tasks.find(item => item.id === 'blocker')?.status || '';
  }, { room })).toBe('完了');

  const dependent = page.locator('.task-card[data-task-id="dependent"]');
  await expect(dependent).not.toHaveClass(/workflow-has-prereq-pending-v149/);
  await expect(dependent.locator('.workflow-prereq-inline-v149')).toHaveCount(0);

  await openTask(page, 'dependent');
  await expect(page.locator('#detailBody .workflow-dependencies-v149')).toContainText('前提タスクはすべて完了しています。');
  await expect(page.locator('#detailBody [data-action="done"]')).toHaveAttribute('aria-disabled', 'false');

  expect(await dependencyTimerState(page)).toEqual({ count: 1, callbacks: 0, suppressed: true });
});

test('Ver.331 audit: canonical dependency removal reconciles immediately through workflow events without the 60s interval', async ({ page }) => {
  await boot(page, 'dependency-write');
  await openTask(page, 'dependent');

  const section = page.locator('#detailBody .workflow-dependencies-v149');
  await expect(section).toContainText('1件の前提タスクが未完了です。');
  await section.locator('[data-remove-dependency-v149="blocker"]').click();

  await expect(section).toContainText('このタスクより先に完了しておくタスクを設定できます。');
  await expect(page.locator('#detailBody [data-action="done"]')).toHaveAttribute('aria-disabled', 'false');
  await expect(page.locator('.task-card[data-task-id="dependent"]')).not.toHaveClass(/workflow-has-prereq-pending-v149/);

  const dependencyIds = await page.evaluate(() => window.WorkBoardWorkflowV150?.depIds?.('dependent') || []);
  expect(dependencyIds).toEqual([]);
  expect(await dependencyTimerState(page)).toEqual({ count: 1, callbacks: 0, suppressed: true });
});
