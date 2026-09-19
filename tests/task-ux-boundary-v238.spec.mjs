import { test, expect } from '@playwright/test';

const ROOM = 'test-task-ux-boundary-v238';
const TASK_UX = 'task-ux-v146.js';

async function installLocalBoundary(page) {
  await page.addInitScript(({ room }) => {
    const now = Date.now();
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
      {
        id: 'task-zulu-v238', title: 'Zulu task', description: '', requester: '', assignee: '福冨',
        status: '未着手', priority: '中', category: 'PC', tags: [], dueDate: '', dueTime: '', pinned: false,
        checklist: [], comments: [], history: [], recurrence: 'none', recurrenceRule: {},
        createdAt: now - 20_000, createdBy: '福冨', updatedAt: now, updatedBy: '福冨',
        completedAt: 0, completedMemo: '', revision: 1
      },
      {
        id: 'task-alpha-v238', title: 'Alpha task', description: '', requester: '', assignee: '福冨',
        status: '対応中', priority: '中', category: 'PC', tags: [], dueDate: '', dueTime: '', pinned: false,
        checklist: [], comments: [], history: [], recurrence: 'none', recurrenceRule: {},
        createdAt: now - 30_000, createdBy: '福冨', updatedAt: now - 10_000, updatedBy: '福冨',
        completedAt: 0, completedMemo: '', revision: 1
      }
    ]));

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function bootVer239(page) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await installLocalBoundary(page);

  let requests = 0;
  page.on('request', request => {
    try {
      if (new URL(request.url()).pathname.endsWith(`/${TASK_UX}`)) requests += 1;
    } catch (_) {}
  });
  // Keep a no-op route as a tripwire: Ver.239+ must not request the retired sidecar at all.
  await page.route(`**/${TASK_UX}*`, route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: '/* retired Ver.239 task UX sidecar must not be requested */'
  }));

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => Number(window.WORK_BOARD_RELEASE?.version || 0) >= 239, undefined, { timeout: 8_000 });
  return () => requests;
}

async function clickCurrent(page, selector) {
  const clicked = await page.evaluate(target => {
    const node = document.querySelector(target);
    if (!(node instanceof HTMLElement)) return false;
    node.click();
    return true;
  }, selector);
  expect(clicked, `expected clickable element: ${selector}`).toBeTruthy();
}

async function rowOrder(page) {
  return page.locator('#listView tbody tr[data-task-id]').evaluateAll(rows => rows.map(row => row.dataset.taskId));
}

test('Ver.239+: app owns quick status while retired task-ux is never requested and dialog/column boundaries stay intact', async ({ page }) => {
  const taskUxRequests = await bootVer239(page);
  expect(taskUxRequests()).toBe(0);

  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.locator('#sortSelect').selectOption('updated');
  await clickCurrent(page, '[data-task-layout="list"]');

  await expect.poll(() => rowOrder(page)).toEqual(['task-zulu-v238', 'task-alpha-v238']);

  const titleHeader = page.locator('#listView th[data-list-sort-key="title"]');
  await expect(titleHeader).toBeVisible({ timeout: 10_000 });
  await titleHeader.click();
  await expect.poll(() => rowOrder(page)).toEqual(['task-alpha-v238', 'task-zulu-v238']);

  const clearColumnSort = page.locator('[data-clear-list-column-sort]');
  await expect(clearColumnSort).toBeVisible();
  await clearColumnSort.click();
  await expect.poll(() => page.evaluate(room => localStorage.getItem(`work-board-list-column-sort:${room}`), ROOM)).toBe(null);
  await expect.poll(() => rowOrder(page)).toEqual(['task-zulu-v238', 'task-alpha-v238']);

  await clickCurrent(page, '#listView tr[data-task-id="task-alpha-v238"]');
  await expect(page.locator('#detailBody [data-action="edit"]')).toBeVisible();
  const quickStatus = page.locator('#detailBody [data-quick-task-status]');
  await expect(quickStatus).toBeVisible();
  await expect(quickStatus).toHaveValue('対応中');
  await expect(page.locator('#taskDialog')).toBeHidden();

  await quickStatus.selectOption('保留');
  await expect(page.locator('#detailBody [data-quick-task-status]')).toHaveValue('保留');
  await expect(page.locator('#detailBody > .task-meta')).toContainText('保留');
  await expect.poll(() => page.evaluate(room => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    return tasks.find(task => task.id === 'task-alpha-v238')?.status || '';
  }, ROOM)).toBe('保留');
  await expect(page.locator('#taskDialog')).toBeHidden();
  expect(taskUxRequests()).toBe(0);

  await clickCurrent(page, '#detailBody [data-action="edit"]');
  const taskDialog = page.locator('#taskDialog');
  await expect(taskDialog).toBeVisible();
  await page.locator('#taskTitle').fill('Alpha task edited but unsaved');

  let confirmCount = 0;
  let acceptDiscard = false;
  page.on('dialog', async dialog => {
    confirmCount += 1;
    if (acceptDiscard) await dialog.accept();
    else await dialog.dismiss();
  });

  await page.locator('#closeTaskDialog').click();
  await expect(taskDialog).toBeVisible();
  expect(confirmCount).toBe(1);

  acceptDiscard = true;
  await page.locator('#closeTaskDialog').click();
  await expect(taskDialog).toBeHidden();
  expect(confirmCount).toBe(2);

  await clickCurrent(page, '#newTask');
  await expect(taskDialog).toBeVisible();
  await page.evaluate(() => {
    const dialog = document.getElementById('taskDialog');
    if (!(dialog instanceof HTMLDialogElement)) throw new Error('task dialog missing');
    const rect = dialog.getBoundingClientRect();
    dialog.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left - 12,
      clientY: rect.top - 12
    }));
  });
  await expect(taskDialog).toBeHidden();
  expect(confirmCount).toBe(2);
  expect(taskUxRequests()).toBe(0);
});
