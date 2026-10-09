import { test, expect } from '@playwright/test';

const ROOM = 'test-inbox-read-feedback-v371';
const USER = 'QA371';
const ID = 'busy-event';
const READ = `[data-inbox-read-v153="${ID}"]`;

async function ready(page) {
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true);
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === window.WORK_BOARD_RELEASE.version);
  await page.locator('[data-open-personal-inbox-v153]').click();
}

async function boot(page, width) {
  await page.setViewportSize({ width, height: width > 860 ? 900 : 844 });
  // No production network access, including Firebase SDK and database endpoints.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === 'http://127.0.0.1:4173' ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(({ room, user, id }) => {
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
    const seeded = 'test-inbox-v371-seeded';
    if (localStorage.getItem(seeded)) return;
    localStorage.clear();
    const now = Date.now();
    localStorage.setItem('systemTaskUser', user);
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify([user, 'Peer371']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([{
      id: 'task-371', title: 'Inbox feedback test task', status: '\u672a\u7740\u624b',
      assignee: user, requester: '', category: '\u305d\u306e\u4ed6', priority: '\u4e2d',
      tags: [], description: '', checklist: [], recurrence: 'none', dueDate: '', dueTime: '',
      pinned: false, completedAt: 0, completedMemo: '', comments: [], history: [], revision: 1,
      createdBy: user, updatedBy: user, createdAt: now - 1000, updatedAt: now
    }]));
    localStorage.setItem(`work-board-workflow-v152:${room}`, JSON.stringify({
      inbox: { [user]: { [id]: { taskId: 'task-371', type: 'mention', title: 'Inbox test notification',
        body: 'Please check the task', actor: 'Peer371', createdAt: now, readAt: 0 } } },
      archives: {}, duplicates: {}
    }));
    localStorage.setItem(seeded, '1');
  }, { room: ROOM, user: USER, id: ID });
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await ready(page);
  await expect(page.locator(READ)).toBeVisible();
}

async function expectIdle(page) {
  await expect(page.locator(READ)).toBeEnabled();
  await expect(page.locator(READ)).not.toHaveAttribute('aria-busy', 'true');
}

for (const width of [1366, 390]) {
  test(`Ver.371 unchanged failure restores retry without rebuilding the row (${width}px)`, async ({ page }) => {
    await boot(page, width);
    await page.evaluate(selector => {
      const W = window.WorkBoardWorkflowV152;
      window.__originalRead371 = W.markInboxRead;
      window.__readCalls371 = 0;
      window.__row371 = document.querySelector(selector);
      W.markInboxRead = async () => { window.__readCalls371++; return { ok: false }; };
    }, READ);
    await page.locator(READ).click();
    await expect.poll(() => page.evaluate(() => window.__readCalls371)).toBe(1);
    await expectIdle(page);
    expect(await page.evaluate(selector => window.__row371 === document.querySelector(selector), READ)).toBe(true);
    expect(await page.evaluate(id => window.WorkBoardWorkflowV152.inboxFor()[id].readAt, ID)).toBe(0);
    await page.evaluate(() => { window.WorkBoardWorkflowV152.markInboxRead = window.__originalRead371; });
    await page.locator(READ).click();
    await expect.poll(() => page.evaluate(id => window.WorkBoardWorkflowV152.inboxFor()[id].readAt, ID)).toBeGreaterThan(0);
    await expect(page.locator(READ)).toHaveCount(0);
  });

  test(`Ver.371 pending redraw and reopen keep one busy operation (${width}px)`, async ({ page }) => {
    await boot(page, width);
    await page.evaluate(() => {
      window.__readCalls371 = 0;
      window.WorkBoardWorkflowV152.markInboxRead = () => {
        window.__readCalls371++;
        return new Promise(resolve => { window.__settle371 = resolve; });
      };
    });
    await page.locator(READ).click();
    await expect(page.locator(READ)).toBeDisabled();
    await page.evaluate(({ user, id }) => {
      window.WorkBoardWorkflowV152.v152.inbox[user][id].body = 'Incoming update during save';
      window.dispatchEvent(new CustomEvent('workflow-v152-update'));
    }, { user: USER, id: ID });
    await expect(page.locator('[data-inbox-list-v153]')).toContainText('Incoming update during save');
    await expect(page.locator(READ)).toBeDisabled();
    await expect(page.locator(READ)).toHaveAttribute('aria-busy', 'true');
    // Even a synthetic click on a disabled, reconstructed button must not duplicate the write.
    await page.locator(READ).evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(await page.evaluate(() => window.__readCalls371)).toBe(1);
    await page.locator('button[data-close-inbox-v153]').click();
    await page.locator('[data-open-personal-inbox-v153]').click();
    await expect(page.locator(READ)).toBeDisabled();
    await page.evaluate(() => window.__settle371({ ok: false, conflict: true }));
    await expectIdle(page);
    expect(await page.evaluate(id => window.WorkBoardWorkflowV152.inboxFor()[id].readAt, ID)).toBe(0);
  });

  test(`Ver.371 rejected operation releases busy state and reports failure (${width}px)`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await boot(page, width);
    await page.evaluate(() => {
      window.__notices371 = [];
      window.WorkBoardWorkflowV152.notify = (...args) => window.__notices371.push(args);
      window.WorkBoardWorkflowV152.markInboxRead = async () => { throw new Error('test-only rejected write'); };
    });
    await page.locator(READ).click();
    await expect.poll(() => page.evaluate(() => window.__notices371.length)).toBe(1);
    await expectIdle(page);
    expect(await page.evaluate(() => window.__notices371[0][1])).toBe(true);
    expect(errors).toEqual([]);
  });

  test(`Ver.371 successful read/unread remains usable and survives reload (${width}px)`, async ({ page }) => {
    await boot(page, width);
    await page.locator('[data-inbox-filter-v153="all"]').click();
    await page.locator(READ).click();
    await expect.poll(() => page.evaluate(id => window.WorkBoardWorkflowV152.inboxFor()[id].readAt, ID)).toBeGreaterThan(0);
    await expectIdle(page);
    await expect(page.locator('.workflow-inbox-item-v152.is-read').filter({ has: page.locator(READ) })).toHaveCount(1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready(page);
    await expect(page.locator(READ)).toHaveCount(0);
    await page.locator('[data-inbox-filter-v153="all"]').click();
    await expectIdle(page);
    await page.locator(READ).click();
    await expect.poll(() => page.evaluate(id => window.WorkBoardWorkflowV152.inboxFor()[id].readAt, ID)).toBe(0);
    await expectIdle(page);
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 2);
  });
}
