import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-saved-views-listener-scope-v337';

const CANDIDATE = `// Ver.337 audit candidate: scope primary-sort persistence to the canonical select/input path.
(function installSavedViewsV337AuditCandidate() {
  const W = window.WorkBoardWorkflowV148;
  if (!W) return;

  const baseSortKey = \`work-board-base-sort:\${W.ROOM_ID}\`;
  const VALID_BASE_SORTS = new Set(['smart', 'due', 'updated', 'priority']);

  function currentBaseSort() {
    const select = document.getElementById('sortSelect');
    return select && VALID_BASE_SORTS.has(select.value) ? select.value : '';
  }

  function persistBaseSort() {
    const value = currentBaseSort();
    if (value) localStorage.setItem(baseSortKey, value);
  }

  function restoreBaseSort() {
    const select = document.getElementById('sortSelect');
    if (!select) return false;
    const saved = localStorage.getItem(baseSortKey) || '';
    if (VALID_BASE_SORTS.has(saved) && select.value !== saved) {
      select.value = saved;
      select.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
  }

  function start() {
    const select = document.getElementById('sortSelect');
    if (!select) return;
    select.addEventListener('input', persistBaseSort);
    restoreBaseSort();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
`;

async function boot(page, suffix, { baseSort = 'updated' } = {}) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ room, baseSort }) => {
    const seedMarker = `v337-saved-views-seeded:${room}`;
    if (sessionStorage.getItem(seedMarker) !== '1') {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
      localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '土屋']));
      localStorage.setItem(`work-board-base-sort:${room}`, baseSort);
      sessionStorage.setItem(seedMarker, '1');
    }

    window.__v337SavedViewsAudit = { listeners: [], writes: [] };

    const nativeAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const stack = String(new Error().stack || '');
      if (stack.includes('saved-views-v148.js') && (type === 'input' || type === 'change')) {
        const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
        const target = this === document
          ? 'document'
          : this === window
            ? 'window'
            : this?.id
              ? `#${this.id}`
              : String(this?.constructor?.name || 'unknown');
        window.__v337SavedViewsAudit.listeners.push({ type, target, capture });
      }
      return nativeAddEventListener.call(this, type, listener, options);
    };

    const nativeSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      const stack = String(new Error().stack || '');
      if (stack.includes('saved-views-v148.js') && String(key).startsWith('work-board-base-sort:')) {
        window.__v337SavedViewsAudit.writes.push({ key: String(key), value: String(value) });
      }
      return nativeSetItem.call(this, key, value);
    };

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room, baseSort });

  await page.route(/saved-views-v148\.js(?:\?.*)?$/, route => route.fulfill({
    status: 200,
    contentType: 'application/javascript; charset=utf-8',
    body: CANDIDATE
  }));
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV148?.dependencyState?.() === 'local-only', undefined, { timeout: 10_000 });
  return { room };
}

async function openTaskList(page) {
  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.evaluate(() => document.querySelector('[data-task-layout="list"]')?.click());
}

async function auditState(page) {
  return page.evaluate(() => ({
    listeners: [...(window.__v337SavedViewsAudit?.listeners || [])],
    writes: [...(window.__v337SavedViewsAudit?.writes || [])]
  }));
}

test('Ver.337 audit: saved views can use one direct #sortSelect input listener without document-wide capture wakeups', async ({ page }) => {
  const { room } = await boot(page, 'scope', { baseSort: 'updated' });
  await openTaskList(page);

  await expect(page.locator('#sortSelect')).toHaveValue('updated');
  expect((await auditState(page)).listeners).toEqual([
    { type: 'input', target: '#sortSelect', capture: false }
  ]);

  await page.evaluate(() => { window.__v337SavedViewsAudit.writes = []; });
  await page.locator('#quickAddInput').fill('listener scope probe');
  await page.evaluate(() => {
    const probe = document.createElement('input');
    document.body.appendChild(probe);
    probe.dispatchEvent(new Event('input', { bubbles: true }));
    probe.dispatchEvent(new Event('change', { bubbles: true }));
    probe.remove();
  });
  expect((await auditState(page)).writes).toEqual([]);

  await page.locator('#sortSelect').selectOption('due');
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-base-sort:${roomId}`), room)).toBe('due');
  expect((await auditState(page)).writes).toEqual([
    { key: `work-board-base-sort:${room}`, value: 'due' }
  ]);
});

test('Ver.337 audit: direct input binding preserves startup restore and reload persistence', async ({ page }) => {
  const { room } = await boot(page, 'reload', { baseSort: 'smart' });
  await openTaskList(page);
  await expect(page.locator('#sortSelect')).toHaveValue('smart');

  await page.locator('#sortSelect').selectOption('priority');
  await expect.poll(() => page.evaluate(roomId => localStorage.getItem(`work-board-base-sort:${roomId}`), room)).toBe('priority');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV148?.dependencyState?.() === 'local-only', undefined, { timeout: 10_000 });
  await openTaskList(page);

  await expect(page.locator('#sortSelect')).toHaveValue('priority');
  expect((await auditState(page)).listeners).toEqual([
    { type: 'input', target: '#sortSelect', capture: false }
  ]);
  expect(await page.evaluate(roomId => localStorage.getItem(`work-board-base-sort:${roomId}`), room)).toBe('priority');
});
