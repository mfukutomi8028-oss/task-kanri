import { test, expect } from '@playwright/test';

const ROOM = 'test-list-sort-boundary-v229';
const SIDECAR = 'list-column-sort-v229.js';
const LEGACY = 'list-sort-v131.js';

async function installLocalState(page, { baseSort = '' } = {}) {
  await page.addInitScript(({ room, baseSortValue }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-room-name:${room}`, '一覧ソート境界テスト');
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));
    localStorage.setItem(`system-task-layout:${room}`, 'list');
    if (baseSortValue) localStorage.setItem(`work-board-base-sort:${room}`, baseSortValue);

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
  }, { room: ROOM, baseSortValue: baseSort });
}

async function blockRemoteFirebase(page) {
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, { disableSidecar = false, baseSort = '' } = {}) {
  await installLocalState(page, { baseSort });
  await blockRemoteFirebase(page);

  let sidecarRequests = 0;
  let legacyRequests = 0;
  page.on('request', request => {
    try {
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith(`/${SIDECAR}`)) sidecarRequests += 1;
      if (pathname.endsWith(`/${LEGACY}`)) legacyRequests += 1;
    } catch (_) {}
  });

  if (disableSidecar) {
    await page.route(`**/${SIDECAR}*`, route => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '/* Ver.229 test: list-column sidecar intentionally disabled */'
    }));
  }

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => Number(window.WORK_BOARD_RELEASE?.version || 0) >= 229, undefined, { timeout: 8_000 });

  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.locator('[data-task-layout="list"]').click();
  await expect(page.locator('#listView')).toBeVisible();
  await expect(page.locator('#listView tr[data-task-id]')).toHaveCount(3);

  return {
    getSidecarRequests: () => sidecarRequests,
    getLegacyRequests: () => legacyRequests
  };
}

async function rowIds(page) {
  return page.locator('#listView tbody tr[data-task-id]').evaluateAll(rows => rows.map(row => row.dataset.taskId));
}

async function activateHeader(header) {
  // CIのデスクトップsidebarが左端見出しへ重なる場合があるため、
  // 物理ポインタのhit-testではなくnative click contractを検証する。
  await header.evaluate(element => element.click());
}

test('Ver.229: saved views restores and persists primary sort without the column sidecar', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const requests = await boot(page, { disableSidecar: true, baseSort: 'priority' });

  await expect(page.locator('#sortSelect')).toHaveValue('priority');
  await expect.poll(() => rowIds(page)).toEqual(['sort-alpha', 'sort-bravo', 'sort-charlie']);
  await expect(page.locator('#listView th[data-list-sort-key]')).toHaveCount(0);

  await page.locator('#sortSelect').selectOption('due');
  await expect.poll(() => rowIds(page)).toEqual(['sort-alpha', 'sort-bravo', 'sort-charlie']);
  await expect.poll(() => page.evaluate(room => localStorage.getItem(`work-board-base-sort:${room}`), ROOM)).toBe('due');

  await page.locator('#sortSelect').selectOption('updated');
  await expect.poll(() => rowIds(page)).toEqual(['sort-bravo', 'sort-alpha', 'sort-charlie']);
  await expect.poll(() => page.evaluate(room => localStorage.getItem(`work-board-base-sort:${room}`), ROOM)).toBe('updated');

  expect(requests.getSidecarRequests()).toBeGreaterThan(0);
  expect(requests.getLegacyRequests()).toBe(0);
});

test('Ver.229: active column sidecar owns header sorting and clears it when primary sort changes', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const requests = await boot(page, { baseSort: 'updated' });

  await expect(page.locator('#sortSelect')).toHaveValue('updated');
  await expect.poll(() => rowIds(page)).toEqual(['sort-bravo', 'sort-alpha', 'sort-charlie']);

  const titleHeader = page.locator('#listView th[data-list-sort-key="title"]');
  await expect(titleHeader).toBeVisible();
  await expect(page.locator('#listView .list-column-sort-status')).toBeVisible();

  await activateHeader(titleHeader);
  await expect.poll(() => rowIds(page)).toEqual(['sort-alpha', 'sort-bravo', 'sort-charlie']);
  await expect(titleHeader).toHaveAttribute('aria-sort', 'ascending');

  let persisted = await page.evaluate(room => localStorage.getItem(`work-board-list-column-sort:${room}`), ROOM);
  expect(JSON.parse(persisted)).toEqual({ key: 'title', direction: 'asc' });

  await activateHeader(titleHeader);
  await expect.poll(() => rowIds(page)).toEqual(['sort-charlie', 'sort-bravo', 'sort-alpha']);
  await expect(titleHeader).toHaveAttribute('aria-sort', 'descending');

  await page.locator('#sortSelect').selectOption('due');
  await expect.poll(() => rowIds(page)).toEqual(['sort-alpha', 'sort-bravo', 'sort-charlie']);
  persisted = await page.evaluate(room => localStorage.getItem(`work-board-list-column-sort:${room}`), ROOM);
  expect(persisted).toBeNull();
  await expect(page.locator('#listView .list-column-sort-status')).toContainText('期限が近い順');
  await expect.poll(() => page.evaluate(room => localStorage.getItem(`work-board-base-sort:${room}`), ROOM)).toBe('due');

  expect(requests.getSidecarRequests()).toBeGreaterThan(0);
  expect(requests.getLegacyRequests()).toBe(0);
});
