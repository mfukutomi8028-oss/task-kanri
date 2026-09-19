import { test, expect } from '@playwright/test';

const ROOM = 'test-task-ux-boundary-v238';
const AUDITED_TASK_UX = 'task-ux-v146.js';
const AUDITED_LIST_SORT = 'list-column-sort-v229.js';
const CURRENT_TASK_UX = 'task-ux-v239.js';
const CURRENT_LIST_SORT = 'list-column-sort-v239.js';

async function installLocalBoundary(page) {
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([{
      id: 'task-v238-lineage', title: 'Ver.238 lineage task', description: '', requester: '', assignee: '福冨',
      status: '未着手', priority: '中', category: 'PC', tags: [], dueDate: '', dueTime: '', pinned: false,
      checklist: [], comments: [], history: [], recurrence: 'none', recurrenceRule: {},
      createdAt: Date.now() - 20_000, createdBy: '福冨', updatedAt: Date.now(), updatedBy: '福冨',
      completedAt: 0, completedMemo: '', revision: 1
    }]));

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

test('Ver.238 audited mixed assets stay inactive after Ver.239 semantic successors take ownership', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await installLocalBoundary(page);

  const requests = new Map([
    [AUDITED_TASK_UX, 0],
    [AUDITED_LIST_SORT, 0],
    [CURRENT_TASK_UX, 0],
    [CURRENT_LIST_SORT, 0]
  ]);
  page.on('request', request => {
    try {
      const path = new URL(request.url()).pathname;
      for (const name of requests.keys()) {
        if (path.endsWith(`/${name}`)) requests.set(name, requests.get(name) + 1);
      }
    } catch (_) {}
  });

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => String(window.WORK_BOARD_RELEASE?.version || '') === '239', undefined, { timeout: 8_000 });

  expect(requests.get(AUDITED_TASK_UX)).toBe(0);
  expect(requests.get(AUDITED_LIST_SORT)).toBe(0);
  expect(requests.get(CURRENT_TASK_UX)).toBe(1);
  expect(requests.get(CURRENT_LIST_SORT)).toBe(1);

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await page.evaluate(() => document.querySelector('[data-task-layout="list"]')?.click());
  await page.evaluate(() => document.querySelector('#listView tr[data-task-id]')?.click());
  await expect(page.locator('.detail-status-control-v146')).toBeVisible({ timeout: 10_000 });
});
