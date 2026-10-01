import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-list-column-sort-observer-v344';

async function boot(page, suffix, { baseSort = 'updated' } = {}) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  await page.setViewportSize({ width: 1366, height: 900 });

  await page.addInitScript(({ room, baseSort }) => {
    const marker = `v344-list-column-seeded:${room}`;
    if (sessionStorage.getItem(marker) !== '1') {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
      localStorage.setItem(`system-task-room-name:${room}`, '一覧列ソートObserver製品回帰');
      localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '土屋']));
      localStorage.setItem(`system-task-layout:${room}`, 'list');
      localStorage.setItem(`work-board-base-sort:${room}`, baseSort);
      const now = Date.now();
      localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
        { id: 'sort-charlie', title: 'Charlie', requester: '監査', assignee: '福冨', status: '未着手', priority: '低', category: 'PC', tags: [], description: '', checklist: [], dueDate: '2099-12-31', dueTime: '09:00', pinned: false, revision: 1, recurrence: 'none', createdAt: now - 3000, createdBy: '福冨', updatedAt: now - 3000, updatedBy: '福冨' },
        { id: 'sort-alpha', title: 'Alpha', requester: '監査', assignee: '福冨', status: '未着手', priority: '緊急', category: 'PC', tags: [], description: '', checklist: [], dueDate: '2099-01-01', dueTime: '09:00', pinned: false, revision: 1, recurrence: 'none', createdAt: now - 2000, createdBy: '福冨', updatedAt: now - 2000, updatedBy: '福冨' },
        { id: 'sort-bravo', title: 'Bravo', requester: '監査', assignee: '福冨', status: '未着手', priority: '中', category: 'PC', tags: [], description: '', checklist: [], dueDate: '2099-06-01', dueTime: '09:00', pinned: false, revision: 1, recurrence: 'none', createdAt: now - 1000, createdBy: '福冨', updatedAt: now - 1000, updatedBy: '福冨' }
      ]));
      sessionStorage.setItem(marker, '1');
    }

    window.__v344ObserverAudit = { registrations: [], callbacks: 0 };
    const NativeMutationObserver = window.MutationObserver;
    window.MutationObserver = class extends NativeMutationObserver {
      constructor(callback) {
        const stack = String(new Error().stack || '');
        const isSidecar = stack.includes('list-column-sort-v229.js');
        super((records, observer) => {
          if (isSidecar) window.__v344ObserverAudit.callbacks += 1;
          callback(records, observer);
        });
        this.__v344Sidecar = isSidecar;
      }
      observe(target, options) {
        if (this.__v344Sidecar) {
          window.__v344ObserverAudit.registrations.push({
            target: target?.id ? `#${target.id}` : String(target?.tagName || 'unknown'),
            childList: Boolean(options?.childList),
            subtree: Boolean(options?.subtree),
            attributes: Boolean(options?.attributes),
            characterData: Boolean(options?.characterData)
          });
        }
        return super.observe(target, options);
      }
    };

    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
  }, { room, baseSort });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.evaluate(() => document.querySelector('[data-task-layout="list"]')?.click());
  await expect(page.locator('#listView')).toBeVisible();
  await expect(page.locator('#listView tr[data-task-id]')).toHaveCount(3);
  await settle(page);
  return { room };
}

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

const state = page => page.evaluate(() => ({ ...window.__v344ObserverAudit }));
const rowIds = page => page.locator('#listView tbody tr[data-task-id]').evaluateAll(rows => rows.map(row => row.dataset.taskId));

async function resetObserverActivity(page) {
  await page.evaluate(() => {
    window.__v344ObserverAudit.callbacks = 0;
  });
}

async function activate(locator) {
  await locator.evaluate(element => element.click());
}

test('Ver.344 product: list observer owns direct childList only and ignores descendant churn', async ({ page }) => {
  await boot(page, 'scope');
  expect((await state(page)).registrations).toEqual([
    { target: '#listView', childList: true, subtree: false, attributes: false, characterData: false }
  ]);

  await resetObserverActivity(page);
  await page.evaluate(() => {
    const row = document.querySelector('#listView tr[data-task-id]');
    row?.appendChild(document.createElement('span'));
  });
  await settle(page);
  expect((await state(page)).callbacks).toBe(0);

  await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.dataset.v344Probe = 'unrelated-direct-child';
    document.getElementById('listView')?.appendChild(probe);
  });
  await settle(page);
  expect((await state(page)).callbacks).toBeGreaterThanOrEqual(1);
});

test('Ver.344 product: sidecar sorting does not recursively wake observer processing', async ({ page }) => {
  const { room } = await boot(page, 'self-mutation');
  await resetObserverActivity(page);
  await activate(page.locator('#listView th[data-list-sort-key="title"]'));
  await expect.poll(() => rowIds(page)).toEqual(['sort-alpha', 'sort-bravo', 'sort-charlie']);
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-list-column-sort:${roomId}`), room))
    .toBe(JSON.stringify({ key: 'title', direction: 'asc' }));
  await settle(page);
  expect((await state(page)).callbacks).toBe(0);

  await page.locator('#listView th[data-list-sort-key="title"]').focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => rowIds(page)).toEqual(['sort-charlie', 'sort-bravo', 'sort-alpha']);
  await settle(page);
  expect((await state(page)).callbacks).toBe(0);
});

test('Ver.344 product: canonical board-list rerender is detected and restores secondary sort', async ({ page }) => {
  const { room } = await boot(page, 'rerender');
  await activate(page.locator('#listView th[data-list-sort-key="priority"]'));
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-list-column-sort:${roomId}`), room))
    .toBe(JSON.stringify({ key: 'priority', direction: 'asc' }));

  await resetObserverActivity(page);
  await page.evaluate(() => document.querySelector('[data-task-layout="board"]')?.click());
  await page.evaluate(() => document.querySelector('[data-task-layout="list"]')?.click());
  await expect(page.locator('#listView')).toBeVisible();
  await expect(page.locator('#listView th[data-list-sort-key="priority"]')).toHaveAttribute('aria-sort', 'ascending');
  await expect.poll(() => rowIds(page)).toEqual(['sort-charlie', 'sort-bravo', 'sort-alpha']);
  await settle(page);
  expect((await state(page)).callbacks).toBeGreaterThanOrEqual(1);
});

test('Ver.344 product: primary handoff, clear-to-primary, and reload remain intact', async ({ page }) => {
  const { room } = await boot(page, 'handoff', { baseSort: 'updated' });
  await activate(page.locator('#listView th[data-list-sort-key="title"]'));
  await expect.poll(() => rowIds(page)).toEqual(['sort-alpha', 'sort-bravo', 'sort-charlie']);

  await page.locator('#sortSelect').selectOption('due');
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-list-column-sort:${roomId}`), room)).toBeNull();
  await expect.poll(() => rowIds(page)).toEqual(['sort-alpha', 'sort-bravo', 'sort-charlie']);

  await activate(page.locator('#listView th[data-list-sort-key="title"]'));
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-list-column-sort:${roomId}`), room))
    .toBe(JSON.stringify({ key: 'title', direction: 'asc' }));
  await activate(page.locator('#listView [data-clear-list-column-sort]'));
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-list-column-sort:${roomId}`), room)).toBeNull();
  await expect.poll(() => rowIds(page)).toEqual(['sort-alpha', 'sort-bravo', 'sort-charlie']);

  await activate(page.locator('#listView th[data-list-sort-key="priority"]'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.evaluate(() => document.querySelector('[data-task-layout="list"]')?.click());
  await expect(page.locator('#listView th[data-list-sort-key="priority"]')).toHaveAttribute('aria-sort', 'ascending');
  expect((await state(page)).registrations).toEqual([
    { target: '#listView', childList: true, subtree: false, attributes: false, characterData: false }
  ]);
});

test('Ver.344 product contract: observer uses semantic canonical-list filter without subtree ownership', async ({ request }) => {
  const response = await request.get('/list-column-sort-v229.js');
  const source = await response.text();
  expect(source).toContain('function containsCanonicalListRender(records)');
  expect(source).toContain("node.matches?.('table.task-table') || node.querySelector?.('table.task-table')");
  expect(source).toContain('if (!containsCanonicalListRender(records)) return;');
  expect(source).toContain("new MutationObserver(handleObservedListRender).observe(listView, { childList: true })");
  expect(source).not.toContain('{ childList: true, subtree: true }');
});
