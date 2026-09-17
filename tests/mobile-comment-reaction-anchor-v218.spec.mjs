import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-comment-reaction-anchor-v218';
const TASK_ID = 'task-mobile-reaction-v218';
const TARGET_COMMENT_ID = 'target-low-v218';

function taskRecord() {
  const now = Date.now();
  const comments = Array.from({ length: 8 }, (_, index) => ({
    id: index === 0 ? TARGET_COMMENT_ID : `comment-v218-${index}`,
    author: index % 2 ? '福冨' : '森井',
    type: '作業メモ',
    text: index === 0 ? '下の方にあるリアクション対象コメントです' : `コメント ${index + 1}`,
    createdAt: now - (8 - index) * 1000
  }));
  return {
    id: TASK_ID,
    title: 'モバイルリアクション位置テスト',
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
    comments,
    history: [],
    recurrence: 'none',
    recurrenceRule: {},
    createdAt: now - 20_000,
    createdBy: '福冨',
    updatedAt: now,
    updatedBy: '福冨',
    completedAt: 0,
    completedMemo: '',
    revision: 1
  };
}

async function boot(page) {
  await page.setViewportSize({ width: 430, height: 820 });
  await page.addInitScript(({ room, task }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([task]));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM, task: taskRecord() });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await page.waitForSelector(`[data-task-id="${TASK_ID}"]`, { state: 'attached', timeout: 15_000 });
  await page.evaluate(id => document.querySelector(`[data-task-id="${id}"]`)?.click(), TASK_ID);
  await expect(page.locator('.task-detail-tab-v149[data-tab="comments"]')).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => document.querySelector('.task-detail-tab-v149[data-tab="comments"]')?.click());
  await expect(page.locator('.task-detail-panel-v149[data-tab-panel="comments"]')).toBeVisible();
}

test('mobile reaction picker opens beside the comment that invoked it instead of at the viewport/composer', async ({ page }) => {
  await boot(page);

  const comment = page.locator(`.activity-comment[data-comment-id="${TARGET_COMMENT_ID}"]`);
  const add = comment.locator('.comment-reaction-add-v165');
  const picker = comment.locator('.comment-reaction-picker-v165');
  await comment.scrollIntoViewIfNeeded();
  await expect(add).toBeVisible();

  const scrollBefore = await page.evaluate(() => window.scrollY);
  await add.click();
  await expect(picker).toBeVisible();
  await expect(add).toHaveAttribute('aria-expanded', 'true');

  const placement = await page.evaluate(commentId => {
    const comment = document.querySelector(`.activity-comment[data-comment-id="${commentId}"]`);
    const add = comment?.querySelector('.comment-reaction-add-v165');
    const picker = comment?.querySelector('.comment-reaction-picker-v165');
    const wrap = add?.closest('.comment-reactions-v165');
    const addRect = add?.getBoundingClientRect();
    const pickerRect = picker?.getBoundingClientRect();
    const commentRect = comment?.getBoundingClientRect();
    return {
      position: picker ? getComputedStyle(picker).position : '',
      sameOwner: Boolean(picker && wrap && picker.parentElement === wrap),
      verticalGap: addRect && pickerRect ? addRect.top - pickerRect.bottom : 999,
      pickerLeft: pickerRect?.left || 0,
      pickerRight: pickerRect?.right || 0,
      commentLeft: commentRect?.left || 0,
      viewportWidth: document.documentElement.clientWidth,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      scrollY: window.scrollY
    };
  }, TARGET_COMMENT_ID);

  expect(placement.position).toBe('absolute');
  expect(placement.sameOwner).toBe(true);
  expect(placement.verticalGap).toBeGreaterThanOrEqual(0);
  expect(placement.verticalGap).toBeLessThanOrEqual(20);
  expect(placement.pickerLeft).toBeGreaterThanOrEqual(placement.commentLeft - 1);
  expect(placement.pickerRight).toBeLessThanOrEqual(placement.viewportWidth - 8);
  expect(placement.overflowX).toBeLessThanOrEqual(1);
  expect(Math.abs(placement.scrollY - scrollBefore)).toBeLessThanOrEqual(2);
});
