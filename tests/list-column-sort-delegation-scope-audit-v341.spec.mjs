import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-list-column-sort-delegation-v341';

async function boot(page, suffix, { baseSort = 'updated' } = {}) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  await page.setViewportSize({ width: 1366, height: 900 });

  await page.addInitScript(({ room, baseSort }) => {
    const seedMarker = `v341-list-column-seeded:${room}`;
    if (sessionStorage.getItem(seedMarker) !== '1') {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
      localStorage.setItem(`system-task-room-name:${room}`, '一覧列ソートdelegation監査');
      localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '土屋']));
      localStorage.setItem(`system-task-layout:${room}`, 'list');
      localStorage.setItem(`work-board-base-sort:${room}`, baseSort);
      const now = Date.now();
      localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
        { id: 'sort-charlie', title: 'Charlie', requester: '監査', assignee: '福冨', status: '未着手', priority: '低', category: 'PC', tags: [], description: '', checklist: [], dueDate: '2099-12-31', dueTime: '09:00', pinned: false, revision: 1, recurrence: 'none', createdAt: now - 3000, createdBy: '福冨', updatedAt: now - 3000, updatedBy: '福冨' },
        { id: 'sort-alpha', title: 'Alpha', requester: '監査', assignee: '福冨', status: '未着手', priority: '緊急', category: 'PC', tags: [], description: '', checklist: [], dueDate: '2099-01-01', dueTime: '09:00', pinned: false, revision: 1, recurrence: 'none', createdAt: now - 2000, createdBy: '福冨', updatedAt: now - 2000, updatedBy: '福冨' },
        { id: 'sort-bravo', title: 'Bravo', requester: '監査', assignee: '福冨', status: '未着手', priority: '中', category: 'PC', tags: [], description: '', checklist: [], dueDate: '2099-06-01', dueTime: '09:00', pinned: false, revision: 1, recurrence: 'none', createdAt: now - 1000, createdBy: '福冨', updatedAt: now - 1000, updatedBy: '福冨' }
      ]));
      sessionStorage.setItem(seedMarker, '1');
    }

    window.__v341DelegationAudit = { listeners: [], callbacks: [], mutations: [] };
    const describeTarget = target => target === document
      ? 'document'
      : target === window
        ? 'window'
        : target?.id
          ? `#${target.id}`
          : target?.tagName
            ? target.tagName
            : String(target?.constructor?.name || 'unknown');
    const nativeAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const stack = String(new Error().stack || '');
      const isSidecar = stack.includes('list-column-sort-v229.js');
      if (isSidecar && ['click', 'keydown', 'input'].includes(type)) {
        const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
        window.__v341DelegationAudit.listeners.push({ type, target: describeTarget(this), capture });
      }
      if (isSidecar && ['click', 'keydown'].includes(type) && typeof listener === 'function') {
        const wrapped = function (event) {
          window.__v341DelegationAudit.callbacks.push({ type, eventTarget: describeTarget(event?.target) });
          return listener.call(this, event);
        };
        return nativeAdd.call(this, type, wrapped, options);
      }
      return nativeAdd.call(this, type, listener, options);
    };

    const nativeSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      const stack = String(new Error().stack || '');
      if (stack.includes('list-column-sort-v229.js') && String(key).startsWith('work-board-list-column-sort:')) {
        window.__v341DelegationAudit.mutations.push({ op: 'set', key: String(key), value: String(value) });
      }
      return nativeSet.call(this, key, value);
    };
    const nativeRemove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      const stack = String(new Error().stack || '');
      if (stack.includes('list-column-sort-v229.js') && String(key).startsWith('work-board-list-column-sort:')) {
        window.__v341DelegationAudit.mutations.push({ op: 'remove', key: String(key) });
      }
      return nativeRemove.call(this, key);
    };

    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
  }, { room, baseSort });

  await page.route('**/list-column-sort-v229.js*', async route => {
    const response = await route.fetch();
    let source = await response.text();
    source = source
      .replace("document.addEventListener('click', event => {", "document.querySelector(LIST_SELECTOR)?.addEventListener('click', event => {")
      .replace("document.addEventListener('keydown', event => {", "document.querySelector(LIST_SELECTOR)?.addEventListener('keydown', event => {");
    await route.fulfill({ response, body: source, contentType: 'application/javascript; charset=utf-8' });
  });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.evaluate(() => document.querySelector('[data-task-layout="list"]')?.click());
  await expect(page.locator('#listView')).toBeVisible();
  await expect(page.locator('#listView tr[data-task-id]')).toHaveCount(3);
  return { room };
}

const auditState = page => page.evaluate(() => ({
  listeners: [...(window.__v341DelegationAudit?.listeners || [])],
  callbacks: [...(window.__v341DelegationAudit?.callbacks || [])],
  mutations: [...(window.__v341DelegationAudit?.mutations || [])]
}));

async function resetActivity(page) {
  await page.evaluate(() => {
    window.__v341DelegationAudit.callbacks = [];
    window.__v341DelegationAudit.mutations = [];
  });
}

async function rowIds(page) {
  return page.locator('#listView tbody tr[data-task-id]').evaluateAll(rows => rows.map(row => row.dataset.taskId));
}

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function activate(locator) {
  await locator.evaluate(element => element.click());
}

test('Ver.341 audit: click/keydown delegation can be scoped from document to fixed #listView', async ({ page }) => {
  await boot(page, 'scope');
  expect((await auditState(page)).listeners).toEqual([
    { type: 'click', target: '#listView', capture: false },
    { type: 'keydown', target: '#listView', capture: false },
    { type: 'input', target: '#sortSelect', capture: false }
  ]);

  await resetActivity(page);
  await page.locator('#quickAddButton').click();
  await page.locator('#quickAddInput').focus();
  await page.keyboard.press('Enter');
  await page.evaluate(() => {
    const probe = document.createElement('button');
    probe.type = 'button';
    document.body.appendChild(probe);
    probe.click();
    probe.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    probe.remove();
  });
  expect((await auditState(page)).callbacks).toEqual([]);
  expect((await auditState(page)).mutations).toEqual([]);
});

test('Ver.341 audit: scoped delegation preserves header mouse/keyboard sorting and clear-to-primary', async ({ page }) => {
  const { room } = await boot(page, 'interaction');
  await expect.poll(() => rowIds(page)).toEqual(['sort-bravo', 'sort-alpha', 'sort-charlie']);

  let titleHeader = page.locator('#listView th[data-list-sort-key="title"]');
  await activate(titleHeader);
  await expect.poll(() => rowIds(page)).toEqual(['sort-alpha', 'sort-bravo', 'sort-charlie']);
  await expect(titleHeader).toHaveAttribute('aria-sort', 'ascending');

  await titleHeader.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => rowIds(page)).toEqual(['sort-charlie', 'sort-bravo', 'sort-alpha']);
  await expect(titleHeader).toHaveAttribute('aria-sort', 'descending');

  titleHeader = page.locator('#listView th[data-list-sort-key="title"]');
  await titleHeader.focus();
  await page.keyboard.press('Space');
  await expect.poll(() => rowIds(page)).toEqual(['sort-alpha', 'sort-bravo', 'sort-charlie']);
  await expect(titleHeader).toHaveAttribute('aria-sort', 'ascending');

  const clearButton = page.locator('#listView [data-clear-list-column-sort]');
  await expect(clearButton).toBeVisible();
  await activate(clearButton);
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-list-column-sort:${roomId}`), room)).toBeNull();
  await expect.poll(() => rowIds(page)).toEqual(['sort-bravo', 'sort-alpha', 'sort-charlie']);

  const callbacks = (await auditState(page)).callbacks;
  expect(callbacks.some(item => item.type === 'click' && item.eventTarget === 'TH')).toBe(true);
  expect(callbacks.some(item => item.type === 'click' && item.eventTarget === 'BUTTON')).toBe(true);
  expect(callbacks.filter(item => item.type === 'keydown')).toHaveLength(2);
});

test('Ver.341 audit: fixed #listView delegation survives canonical rerender and reload', async ({ page }) => {
  const { room } = await boot(page, 'rerender');
  await activate(page.locator('#listView th[data-list-sort-key="priority"]'));
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-list-column-sort:${roomId}`), room))
    .toBe(JSON.stringify({ key: 'priority', direction: 'asc' }));

  await page.evaluate(() => document.querySelector('[data-task-layout="board"]')?.click());
  await page.evaluate(() => document.querySelector('[data-task-layout="list"]')?.click());
  await expect(page.locator('#listView')).toBeVisible();
  await expect(page.locator('#listView th[data-list-sort-key="priority"]')).toHaveAttribute('aria-sort', 'ascending');

  await resetActivity(page);
  await activate(page.locator('#listView th[data-list-sort-key="priority"]'));
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-list-column-sort:${roomId}`), room))
    .toBe(JSON.stringify({ key: 'priority', direction: 'desc' }));
  expect((await auditState(page)).callbacks.some(item => item.type === 'click')).toBe(true);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.evaluate(() => document.querySelector('[data-task-layout="list"]')?.click());
  await expect(page.locator('#listView')).toBeVisible();
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-list-column-sort:${roomId}`), room))
    .toBe(JSON.stringify({ key: 'priority', direction: 'desc' }));
  await expect(page.locator('#listView th[data-list-sort-key="priority"]')).toHaveAttribute('aria-sort', 'descending');
  expect((await auditState(page)).listeners).toEqual([
    { type: 'click', target: '#listView', capture: false },
    { type: 'keydown', target: '#listView', capture: false },
    { type: 'input', target: '#sortSelect', capture: false }
  ]);
  await settle(page);
});
