import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-comment-reactions-keydown-v347';
const TASK_ID = 'task-comment-reactions-v347';
const COMMENT_ID = 'comment-comment-reactions-v347';

function taskRecord() {
  const now = Date.now();
  return {
    id: TASK_ID,
    title: 'Ver.347 コメントkeydown製品回帰',
    description: '',
    requester: '',
    assignee: '福冨',
    status: '対応中',
    priority: '中',
    category: 'その他',
    tags: [],
    dueDate: '',
    dueTime: '',
    pinned: false,
    checklist: [],
    comments: [{
      id: COMMENT_ID,
      author: '森井',
      type: '作業メモ',
      text: '返信とリアクションのkeydown境界を製品回帰します',
      createdAt: now - 1000
    }],
    history: [],
    recurrence: 'none',
    recurrenceRule: {},
    createdAt: now - 5000,
    createdBy: '福冨',
    updatedAt: now,
    updatedBy: '福冨',
    completedAt: 0,
    completedMemo: '',
    revision: 1
  };
}

async function boot(page, suffix) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  await page.setViewportSize({ width: 1366, height: 900 });

  await page.addInitScript(({ room, task }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([task]));

    const state = window.__WB_COMMENT_KEYDOWN_V347__ = { registrations: [], callbacks: 0 };
    const nativeAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const stack = String(new Error().stack || '');
      if (type === 'keydown' && stack.includes('comment-reactions-v191.js') && typeof listener === 'function') {
        const target = this === document ? 'document' : this?.id ? `#${this.id}` : String(this?.constructor?.name || 'unknown');
        state.registrations.push(target);
        const wrapped = function (...args) {
          state.callbacks += 1;
          return listener.apply(this, args);
        };
        return nativeAdd.call(this, type, wrapped, options);
      }
      return nativeAdd.call(this, type, listener, options);
    };

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room, task: taskRecord() });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.dependencyState?.() === 'local-only', undefined, { timeout: 10_000 });
  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.waitForSelector(`[data-task-id="${TASK_ID}"]`, { state: 'attached', timeout: 15_000 });
  await page.evaluate(id => document.querySelector(`[data-task-id="${id}"]`)?.click(), TASK_ID);
  await expect(page.locator('.task-detail-tab-v149[data-tab="comments"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('.task-detail-tab-v149[data-tab="comments"]').click();
  await expect(page.locator('.task-detail-panel-v149[data-tab-panel="comments"]')).toBeVisible();
  return { room };
}

async function stats(page) {
  return page.evaluate(() => ({ ...window.__WB_COMMENT_KEYDOWN_V347__ }));
}

test('Ver.347 product binds comment reaction keydown to fixed #detailBody and ignores outside keys', async ({ page }) => {
  await boot(page, 'scope');
  expect((await stats(page)).registrations).toEqual(['#detailBody']);

  const before = (await stats(page)).callbacks;
  await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ProductOutside', bubbles: true })));
  expect((await stats(page)).callbacks).toBe(before);

  await page.locator('#commentText').dispatchEvent('keydown', { key: 'ProductInside' });
  expect((await stats(page)).callbacks).toBe(before + 1);
});

test('Ver.347 product keeps Escape reply cancel and reaction picker close inside detail', async ({ page }) => {
  await boot(page, 'escape');

  const comment = page.locator(`.activity-comment[data-comment-id="${COMMENT_ID}"]`);
  await comment.locator(`[data-comment-reply-target="${COMMENT_ID}"]`).click();
  await expect(page.locator('.comment-reply-compose-v215')).toBeVisible();

  const add = comment.locator('[data-comment-reaction-picker]');
  const picker = comment.locator('.comment-reaction-picker-v165');
  await add.click();
  await expect(picker).toBeVisible();
  await expect(add).toHaveAttribute('aria-expanded', 'true');

  await page.locator('#commentText').press('Escape');
  await expect(page.locator('.comment-reply-compose-v215')).toHaveCount(0);
  await expect(picker).toBeHidden();
  await expect(add).toHaveAttribute('aria-expanded', 'false');
});

test('Ver.347 product keeps Ctrl/Meta+Enter reply submission after detail redraw', async ({ page }) => {
  const { room } = await boot(page, 'submit');

  const openReply = async () => {
    const comment = page.locator(`.activity-comment[data-comment-id="${COMMENT_ID}"]`);
    await comment.locator(`[data-comment-reply-target="${COMMENT_ID}"]`).click();
    await expect(page.locator('.comment-reply-compose-v215')).toBeVisible();
  };

  await openReply();
  await page.locator('#commentText').fill('Ver.347 keydown scope reply');
  await page.locator('#commentText').press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');

  await expect.poll(async () => page.evaluate(({ room }) => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    const task = tasks.find(item => item.id === 'task-comment-reactions-v347');
    return (task?.comments || []).some(comment => comment.text === 'Ver.347 keydown scope reply' && comment.replyTo === 'comment-comment-reactions-v347');
  }, { room }), { timeout: 15_000 }).toBe(true);

  await page.locator('.nav-item[data-layout="today"]').click();
  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.waitForSelector(`[data-task-id="${TASK_ID}"]`, { state: 'attached', timeout: 15_000 });
  await page.evaluate(id => document.querySelector(`[data-task-id="${id}"]`)?.click(), TASK_ID);
  await page.locator('.task-detail-tab-v149[data-tab="comments"]').click();
  await expect(page.locator('#commentText')).toBeVisible();

  const before = (await stats(page)).callbacks;
  await page.locator('#commentText').dispatchEvent('keydown', { key: 'ProductAfterRedraw' });
  expect((await stats(page)).callbacks).toBe(before + 1);
  expect((await stats(page)).registrations).toEqual(['#detailBody']);
});
