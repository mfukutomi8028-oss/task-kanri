import { test, expect } from '@playwright/test';

const ROOM = 'test-list-sort-ownership-v228';
const SIDECAR = 'list-sort-v131.js';

function task(id, title, priority, dueDate, updatedAt) {
  return {
    id,
    title,
    requester: '監査',
    assignee: '福冨',
    status: '未着手',
    priority,
    category: 'PC',
    tags: [],
    description: '',
    checklist: [],
    dueDate,
    dueTime: '09:00',
    pinned: false,
    revision: 1,
    recurrence: 'none',
    createdAt: updatedAt - 1000,
    createdBy: '福冨',
    updatedAt,
    updatedBy: '福冨'
  };
}

async function installLocalState(page) {
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-room-name:${room}`, '一覧ソート監査');
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));
    localStorage.setItem(`system-task-layout:${room}`, 'list');

    const now = Date.now();
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
      {
        id: 'sort-charlie', title: 'Charlie', requester: '監査', assignee: '福冨', status: '未着手',
        priority: '低', category: 'PC', tags: [], description: '', checklist: [], dueDate: '2099-12-31',
        dueTime: '09:00', pinned: false, revision: 1, recurrence: 'none', createdAt: now - 3000,
        createdBy: '福冨', updatedAt: now - 3000, updatedBy: '福冨'
      },
      {
        id: 'sort-alpha', title: 'Alpha', requester: '監査', assignee: '福冨', status: '未着手',
        priority: '緊急', category: 'PC', tags: [], description: '', checklist: [], dueDate: '2099-01-01',
        dueTime: '09:00', pinned: false, revision: 1, recurrence: 'none', createdAt: now - 2000,
        createdBy: '福冨', updatedAt: now - 2000, updatedBy: '福冨'
      },
      {
        id: 'sort-bravo', title: 'Bravo', requester: '監査', assignee: '福冨', status: '未着手',
        priority: '中', category: 'PC', tags: [], description: '', checklist: [], dueDate: '2099-06-01',
        dueTime: '09:00', pinned: false, revision: 1, recurrence: 'none', createdAt: now - 1000,
        createdBy: '福冨', updatedAt: now - 1000, updatedBy: '福冨'
      }
    ]));

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });
}

async function blockRemoteFirebase(page) {
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, { disableSidecar = false } = {}) {
  await installLocalState(page);
  await blockRemoteFirebase(page);

  let sidecarRequests = 0;
  page.on('request', request => {
    try {
      if (new URL(request.url()).pathname.endsWith(`/${SIDECAR}`)) sidecarRequests += 1;
    } catch (_) {}
  });

  if (disableSidecar) {
    await page.route(`**/${SIDECAR}*`, route => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '/* Ver.228 audit: list-sort sidecar intentionally disabled */'
    }));
  }

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => Number(window.WORK_BOARD_RELEASE?.version || 0) >= 227, undefined, { timeout: 8_000 });

  await page.locator('.nav-item[data-layout="tasks"]').click();
  await expect(page.locator('#listView')).toBeVisible();
  await expect(page.locator('#listView tr[data-task-id]')).toHaveCount(3);

  return () => sidecarRequests;
}

async function rowIds(page) {
  return page.locator('#listView tbody tr[data-task-id]').evaluateAll(rows => rows.map(row => row.dataset.taskId));
}

test('Ver.228 audit: app base sort remains canonical when list-sort sidecar is disabled', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const getSidecarRequests = await boot(page, { disableSidecar: true });

  await expect(page.locator('#listView th[data-list-sort-key]')).toHaveCount(0);
  await expect(page.locator('#listView .list-column-sort-status')).toHaveCount(0);

  await page.locator('#sortSelect').selectOption('due');
  await expect.poll(() => rowIds(page)).toEqual(['sort-alpha', 'sort-bravo', 'sort-charlie']);

  await page.locator('#sortSelect').selectOption('updated');
  await expect.poll(() => rowIds(page)).toEqual(['sort-bravo', 'sort-alpha', 'sort-charlie']);

  expect(getSidecarRequests()).toBeGreaterThan(0);
});

test('Ver.228 audit: active sidecar owns column headers, secondary row order, and per-room persistence', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const getSidecarRequests = await boot(page);

  const titleHeader = page.locator('#listView th[data-list-sort-key="title"]');
  await expect(titleHeader).toBeVisible();
  await expect(page.locator('#listView .list-column-sort-status')).toBeVisible();

  await titleHeader.click();
  await expect.poll(() => rowIds(page)).toEqual(['sort-alpha', 'sort-bravo', 'sort-charlie']);
  await expect(titleHeader).toHaveAttribute('aria-sort', 'ascending');

  let persisted = await page.evaluate(room => localStorage.getItem(`work-board-list-column-sort:${room}`), ROOM);
  expect(JSON.parse(persisted)).toEqual({ key: 'title', direction: 'asc' });

  await titleHeader.click();
  await expect.poll(() => rowIds(page)).toEqual(['sort-charlie', 'sort-bravo', 'sort-alpha']);
  await expect(titleHeader).toHaveAttribute('aria-sort', 'descending');

  await page.locator('#sortSelect').selectOption('due');
  await expect.poll(() => rowIds(page)).toEqual(['sort-alpha', 'sort-bravo', 'sort-charlie']);
  persisted = await page.evaluate(room => localStorage.getItem(`work-board-list-column-sort:${room}`), ROOM);
  expect(persisted).toBeNull();
  await expect(page.locator('#listView .list-column-sort-status')).toContainText('期限が近い順');

  expect(getSidecarRequests()).toBeGreaterThan(0);
});
