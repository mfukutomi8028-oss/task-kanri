import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-list-column-sort-listener-scope-v339';
const SIDECAR = 'list-column-sort-v229.js';

async function installCandidate(page) {
  let transformed = 0;
  await page.route(`**/${SIDECAR}*`, async route => {
    const response = await route.fetch();
    let body = await response.text();
    const current = `  document.addEventListener('input', handleBaseSortChange, true);\n  document.addEventListener('change', handleBaseSortChange, true);\n\n  function start() {\n    const select = document.querySelector(SORT_SELECT_SELECTOR);\n    if (select) lastBaseValue = select.value;`;
    const candidate = `  function start() {\n    const select = document.querySelector(SORT_SELECT_SELECTOR);\n    if (select) {\n      lastBaseValue = select.value;\n      select.addEventListener('input', handleBaseSortChange);\n    }`;
    if (!body.includes(current)) throw new Error('Ver.339 audit transform target not found');
    body = body.replace(current, candidate);
    transformed += 1;
    await route.fulfill({ response, body, contentType: 'application/javascript' });
  });
  return () => transformed;
}

async function boot(page, suffix, { baseSort = 'updated' } = {}) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  await page.setViewportSize({ width: 1366, height: 900 });
  const getTransformCount = await installCandidate(page);

  await page.addInitScript(({ room, baseSort }) => {
    const seedMarker = `v339-list-column-seeded:${room}`;
    if (sessionStorage.getItem(seedMarker) !== '1') {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
      localStorage.setItem(`system-task-room-name:${room}`, '一覧列ソートlistener監査');
      localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '土屋']));
      localStorage.setItem(`system-task-layout:${room}`, 'list');
      localStorage.setItem(`work-board-base-sort:${room}`, baseSort);

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
      sessionStorage.setItem(seedMarker, '1');
    }

    window.__v339ListColumnAudit = { listeners: [], mutations: [] };

    const nativeAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const stack = String(new Error().stack || '');
      if (stack.includes('list-column-sort-v229.js') && ['click', 'keydown', 'input', 'change'].includes(type)) {
        const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
        const target = this === document
          ? 'document'
          : this === window
            ? 'window'
            : this?.id
              ? `#${this.id}`
              : String(this?.constructor?.name || 'unknown');
        window.__v339ListColumnAudit.listeners.push({ type, target, capture });
      }
      return nativeAddEventListener.call(this, type, listener, options);
    };

    const nativeSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      const stack = String(new Error().stack || '');
      if (stack.includes('list-column-sort-v229.js') && String(key).startsWith('work-board-list-column-sort:')) {
        window.__v339ListColumnAudit.mutations.push({ op: 'set', key: String(key), value: String(value) });
      }
      return nativeSetItem.call(this, key, value);
    };

    const nativeRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      const stack = String(new Error().stack || '');
      if (stack.includes('list-column-sort-v229.js') && String(key).startsWith('work-board-list-column-sort:')) {
        window.__v339ListColumnAudit.mutations.push({ op: 'remove', key: String(key) });
      }
      return nativeRemoveItem.call(this, key);
    };

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room, baseSort });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.evaluate(() => document.querySelector('[data-task-layout="list"]')?.click());
  await expect(page.locator('[data-task-layout="list"]')).toHaveClass(/active/);
  await expect(page.locator('#listView')).toBeVisible();
  await expect(page.locator('#listView tr[data-task-id]')).toHaveCount(3);
  expect(getTransformCount()).toBeGreaterThan(0);
  return { room, getTransformCount };
}

async function rowIds(page) {
  return page.locator('#listView tbody tr[data-task-id]').evaluateAll(rows => rows.map(row => rows.length ? row.dataset.taskId : ''));
}

async function auditState(page) {
  return page.evaluate(() => ({
    listeners: [...(window.__v339ListColumnAudit?.listeners || [])],
    mutations: [...(window.__v339ListColumnAudit?.mutations || [])]
  }));
}

async function resetAuditMutations(page) {
  await page.evaluate(() => { window.__v339ListColumnAudit.mutations = []; });
}

async function activateHeader(header) {
  await header.evaluate(element => element.click());
}

test('Ver.339 audit: base-sort ownership shrinks to direct #sortSelect input while document click/keydown delegation stays intact', async ({ page }) => {
  const { room } = await boot(page, 'scope', { baseSort: 'updated' });
  await expect(page.locator('#sortSelect')).toHaveValue('updated');

  expect((await auditState(page)).listeners).toEqual([
    { type: 'click', target: 'document', capture: false },
    { type: 'keydown', target: 'document', capture: false },
    { type: 'input', target: '#sortSelect', capture: false }
  ]);

  await page.evaluate(roomId => {
    localStorage.setItem(`work-board-list-column-sort:${roomId}`, JSON.stringify({ key: 'title', direction: 'asc' }));
  }, room);
  await resetAuditMutations(page);

  await page.locator('#quickAddInput').fill('unrelated input probe');
  await page.evaluate(() => {
    const probe = document.createElement('input');
    document.body.appendChild(probe);
    probe.dispatchEvent(new Event('input', { bubbles: true }));
    probe.dispatchEvent(new Event('change', { bubbles: true }));
    probe.remove();
  });
  expect((await auditState(page)).mutations).toEqual([]);
  expect(await page.evaluate(roomId => localStorage.getItem(`work-board-list-column-sort:${roomId}`), room))
    .toBe(JSON.stringify({ key: 'title', direction: 'asc' }));

  await page.locator('#sortSelect').selectOption('due');
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-list-column-sort:${roomId}`), room)).toBeNull();
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-base-sort:${roomId}`), room)).toBe('due');
  await expect.poll(() => rowIds(page)).toEqual(['sort-alpha', 'sort-bravo', 'sort-charlie']);
  await expect(page.locator('#listView .list-column-sort-status')).toContainText('期限が近い順');
  expect((await auditState(page)).mutations.filter(item => item.op === 'remove')).toHaveLength(1);
});

test('Ver.339 audit: canonical programmatic input clears secondary sort while change-only is intentionally noncanonical', async ({ page }) => {
  const { room } = await boot(page, 'programmatic', { baseSort: 'smart' });

  await page.evaluate(roomId => {
    localStorage.setItem(`work-board-list-column-sort:${roomId}`, JSON.stringify({ key: 'due', direction: 'desc' }));
    const select = document.getElementById('sortSelect');
    select.value = 'priority';
    select.dispatchEvent(new Event('input', { bubbles: true }));
  }, room);
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-list-column-sort:${roomId}`), room)).toBeNull();
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-base-sort:${roomId}`), room)).toBe('priority');

  await page.evaluate(roomId => {
    localStorage.setItem(`work-board-list-column-sort:${roomId}`, JSON.stringify({ key: 'priority', direction: 'asc' }));
  }, room);
  await resetAuditMutations(page);
  await page.evaluate(() => {
    const select = document.getElementById('sortSelect');
    select.value = 'updated';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });

  expect((await auditState(page)).mutations).toEqual([]);
  expect(await page.evaluate(roomId => localStorage.getItem(`work-board-list-column-sort:${roomId}`), room))
    .toBe(JSON.stringify({ key: 'priority', direction: 'asc' }));
  expect(await page.evaluate(roomId => localStorage.getItem(`work-board-base-sort:${roomId}`), room)).toBe('priority');
});

test('Ver.339 audit: header mouse/keyboard sorting, clear-to-primary, and reload remain intact with the candidate', async ({ page }) => {
  const { room, getTransformCount } = await boot(page, 'interaction', { baseSort: 'updated' });
  await expect.poll(() => rowIds(page)).toEqual(['sort-bravo', 'sort-alpha', 'sort-charlie']);

  let titleHeader = page.locator('#listView th[data-list-sort-key="title"]');
  await expect(titleHeader).toBeVisible();
  await activateHeader(titleHeader);
  await expect.poll(() => rowIds(page)).toEqual(['sort-alpha', 'sort-bravo', 'sort-charlie']);
  await expect(titleHeader).toHaveAttribute('aria-sort', 'ascending');

  await titleHeader.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => rowIds(page)).toEqual(['sort-charlie', 'sort-bravo', 'sort-alpha']);
  await expect(titleHeader).toHaveAttribute('aria-sort', 'descending');

  const clearButton = page.locator('[data-clear-list-column-sort]');
  await expect(clearButton).toBeVisible();
  await clearButton.click();
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-list-column-sort:${roomId}`), room)).toBeNull();
  await expect.poll(() => rowIds(page)).toEqual(['sort-bravo', 'sort-alpha', 'sort-charlie']);

  titleHeader = page.locator('#listView th[data-list-sort-key="title"]');
  await activateHeader(titleHeader);
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-list-column-sort:${roomId}`), room))
    .toBe(JSON.stringify({ key: 'title', direction: 'asc' }));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.evaluate(() => document.querySelector('[data-task-layout="list"]')?.click());
  await expect(page.locator('#listView')).toBeVisible();
  await expect.poll(() => rowIds(page)).toEqual(['sort-alpha', 'sort-bravo', 'sort-charlie']);
  await expect(page.locator('#listView th[data-list-sort-key="title"]')).toHaveAttribute('aria-sort', 'ascending');
  expect(getTransformCount()).toBeGreaterThan(1);
  expect((await auditState(page)).listeners).toEqual([
    { type: 'click', target: 'document', capture: false },
    { type: 'keydown', target: 'document', capture: false },
    { type: 'input', target: '#sortSelect', capture: false }
  ]);
});
