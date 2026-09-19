import { test, expect } from '@playwright/test';

const ROOM = 'test-task-ux-sort-bridge-v239';
const TASK_UX = 'task-ux-v239.js';

async function installLocalBoundary(page, room = ROOM) {
  await page.addInitScript(({ roomId }) => {
    const now = Date.now();
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', roomId);
    localStorage.setItem(`system-task-tasks:${roomId}`, JSON.stringify([
      {
        id: 'task-zulu-v239', title: 'Zulu task', description: '', requester: '', assignee: '福冨',
        status: '未着手', priority: '中', category: 'PC', tags: [], dueDate: '', dueTime: '', pinned: false,
        checklist: [], comments: [], history: [], recurrence: 'none', recurrenceRule: {},
        createdAt: now - 20_000, createdBy: '福冨', updatedAt: now, updatedBy: '福冨',
        completedAt: 0, completedMemo: '', revision: 1
      },
      {
        id: 'task-alpha-v239', title: 'Alpha task', description: '', requester: '', assignee: '福冨',
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
  }, { roomId: room });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, { disableTaskUx = false } = {}) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await installLocalBoundary(page);

  let taskUxRequests = 0;
  page.on('request', request => {
    try {
      if (new URL(request.url()).pathname.endsWith(`/${TASK_UX}`)) taskUxRequests += 1;
    } catch (_) {}
  });

  if (disableTaskUx) {
    await page.route(`**/${TASK_UX}*`, route => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '/* Ver.239 boundary audit: task UX intentionally disabled */'
    }));
  }

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => String(window.WORK_BOARD_RELEASE?.version || '') === '239', undefined, { timeout: 8_000 });
  return () => taskUxRequests;
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

test('Ver.239 list-column owner restores primary order even when task UX is disabled', async ({ page }) => {
  const taskUxRequests = await boot(page, { disableTaskUx: true });
  expect(taskUxRequests()).toBe(1);

  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.locator('#sortSelect').selectOption('updated');
  await clickCurrent(page, '[data-task-layout="list"]');
  await expect.poll(() => rowOrder(page)).toEqual(['task-zulu-v239', 'task-alpha-v239']);

  const titleHeader = page.locator('#listView th[data-list-sort-key="title"]');
  await expect(titleHeader).toBeVisible({ timeout: 10_000 });
  await titleHeader.click();
  await expect.poll(() => rowOrder(page)).toEqual(['task-alpha-v239', 'task-zulu-v239']);

  const clearColumnSort = page.locator('[data-clear-list-column-sort]');
  await expect(clearColumnSort).toBeVisible();
  await clearColumnSort.click();
  await expect.poll(() => page.evaluate(room => localStorage.getItem(`work-board-list-column-sort:${room}`), ROOM)).toBe(null);
  await expect.poll(() => rowOrder(page)).toEqual(['task-zulu-v239', 'task-alpha-v239']);

  // The remaining task UX duties disappear when only that successor is disabled.
  await clickCurrent(page, '#listView tr[data-task-id="task-alpha-v239"]');
  await expect(page.locator('.detail-status-control-v146')).toHaveCount(0);

  await clickCurrent(page, '#detailBody [data-action="edit"]');
  const taskDialog = page.locator('#taskDialog');
  await expect(taskDialog).toBeVisible();
  await page.locator('#taskTitle').fill('Alpha task edited but unsaved');

  let confirmCount = 0;
  page.on('dialog', async dialog => {
    confirmCount += 1;
    await dialog.dismiss();
  });
  await page.locator('#closeTaskDialog').click();
  await expect(taskDialog).toBeHidden();
  expect(confirmCount).toBe(0);

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
  await expect(taskDialog).toBeVisible();
  await page.locator('#closeTaskDialog').click();
});

test('Ver.239 task UX successor preserves quick status, discard guard, and backdrop close', async ({ page }) => {
  const taskUxRequests = await boot(page);
  expect(taskUxRequests()).toBe(1);

  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await clickCurrent(page, '[data-task-layout="list"]');
  await clickCurrent(page, '#listView tr[data-task-id="task-alpha-v239"]');
  await expect(page.locator('.detail-status-control-v146')).toBeVisible({ timeout: 10_000 });

  await clickCurrent(page, '#detailBody [data-action="edit"]');
  const taskDialog = page.locator('#taskDialog');
  await expect(taskDialog).toBeVisible();
  await page.locator('#taskTitle').fill('Alpha task edited but unsaved');

  const dismissed = new Promise(resolve => {
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('入力内容が変更されています。保存せずに閉じますか？');
      await dialog.dismiss();
      resolve();
    });
  });
  await page.locator('#closeTaskDialog').click();
  await dismissed;
  await expect(taskDialog).toBeVisible();

  const accepted = new Promise(resolve => {
    page.once('dialog', async dialog => {
      await dialog.accept();
      resolve();
    });
  });
  await page.locator('#closeTaskDialog').click();
  await accepted;
  await expect(taskDialog).toBeHidden();

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
});
