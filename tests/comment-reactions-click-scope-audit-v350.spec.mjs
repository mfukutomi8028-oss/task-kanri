import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-comment-reactions-click-v350';
const TASK_ID = 'task-comment-reactions-v350';
const COMMENT_ID = 'comment-comment-reactions-v350';

function taskRecord() {
  const now = Date.now();
  return {
    id: TASK_ID,
    title: 'Ver.350 click scope判断の耐久回帰',
    description: '', requester: '', assignee: '福冨', status: '対応中', priority: '中', category: 'その他', tags: [],
    dueDate: '', dueTime: '', pinned: false, checklist: [],
    comments: [{ id: COMMENT_ID, author: '森井', type: '作業メモ', text: 'Ver.350の製品化ゲートを後続runtimeでも確認します', createdAt: now - 1000 }],
    history: [], recurrence: 'none', recurrenceRule: {}, createdAt: now - 5000, createdBy: '福冨', updatedAt: now,
    updatedBy: '福冨', completedAt: 0, completedMemo: '', revision: 1
  };
}

async function clickCurrent(page, selector) {
  const clicked = await page.evaluate(sel => {
    const node = document.querySelector(sel);
    if (!(node instanceof HTMLElement)) return false;
    node.click();
    return true;
  }, selector);
  expect(clicked, `expected clickable element: ${selector}`).toBeTruthy();
}

async function boot(page, suffix) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ room, task }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([task]));
    window.__WB_COMMENT_CLICK_V350__ = { registrations: [], root: null };

    const nativeAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const stack = String(new Error().stack || '');
      if (type === 'click' && stack.includes('comment-reactions-v191.js') && typeof listener === 'function') {
        const target = this === document ? 'document' : this?.id ? `#${this.id}` : String(this?.constructor?.name || 'unknown');
        const capture = options === true || Boolean(options && typeof options === 'object' && options.capture);
        window.__WB_COMMENT_CLICK_V350__.registrations.push({ target, capture });
      }
      return nativeAdd.call(this, type, listener, options);
    };

    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
  }, { room, task: taskRecord() });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${encodeURIComponent(room)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.waitForSelector(`[data-task-id="${TASK_ID}"]`, { state: 'attached', timeout: 15_000 });
  await clickCurrent(page, `[data-task-id="${TASK_ID}"]`);
  await expect(page.locator('.task-detail-tab-v149[data-tab="comments"]')).toBeVisible({ timeout: 15_000 });
  await clickCurrent(page, '.task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator(`.activity-comment[data-comment-id="${COMMENT_ID}"]`)).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => { window.__WB_COMMENT_CLICK_V350__.root = document.getElementById('detailBody'); });
}

async function stats(page) {
  return page.evaluate(() => {
    const state = window.__WB_COMMENT_CLICK_V350__;
    return {
      registrations: state.registrations.map(item => ({ ...item })),
      rootStable: state.root === document.getElementById('detailBody')
    };
  });
}

async function addOutsideButton(page) {
  await page.evaluate(() => {
    document.getElementById('v350OutsideClick')?.remove();
    const button = document.createElement('button');
    button.id = 'v350OutsideClick';
    button.type = 'button';
    button.textContent = 'outside detail';
    document.body.append(button);
  });
}

async function openPicker(page) {
  await clickCurrent(page, `[data-comment-reaction-picker="${COMMENT_ID}"]`);
  await expect(page.locator('.comment-reaction-picker-v165:not([hidden])')).toHaveCount(1);
}

async function openReply(page) {
  await clickCurrent(page, `[data-comment-reply-target="${COMMENT_ID}"]`);
  await expect(page.locator('.comment-reply-compose-v215')).toBeVisible();
}

test('Ver.350 gate stays resolved: closed product is root-scoped and open picker adds transient document ownership', async ({ page }) => {
  await boot(page, 'lifecycle');
  const initial = await stats(page);
  expect(initial.registrations).toEqual([{ target: '#detailBody', capture: true }]);
  expect(initial.rootStable).toBe(true);

  await openPicker(page);
  const opened = await stats(page);
  expect(opened.registrations).toEqual([
    { target: '#detailBody', capture: true },
    { target: 'document', capture: true }
  ]);

  await addOutsideButton(page);
  await clickCurrent(page, '#v350OutsideClick');
  await expect(page.locator('.comment-reaction-picker-v165:not([hidden])')).toHaveCount(0);
});

test('Ver.350 rejected simple-root limitation stays fixed: outside-detail dismissal works in current product', async ({ page }) => {
  await boot(page, 'outside-dismiss');
  await openPicker(page);
  await addOutsideButton(page);
  await clickCurrent(page, '#v350OutsideClick');
  await expect(page.locator('.comment-reaction-picker-v165:not([hidden])')).toHaveCount(0);

  const registrations = (await stats(page)).registrations;
  expect(registrations.filter(item => item.target === '#detailBody')).toHaveLength(1);
  expect(registrations.filter(item => item.target === 'document')).toHaveLength(1);
});

test('Ver.350 local interaction evidence remains intact after lifecycle productization', async ({ page }) => {
  await boot(page, 'local-actions');

  await openReply(page);
  await clickCurrent(page, '[data-cancel-comment-reply-v215]');
  await expect(page.locator('.comment-reply-compose-v215')).toHaveCount(0);

  await openPicker(page);
  await clickCurrent(page, '#detailBody .task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator('.comment-reaction-picker-v165:not([hidden])')).toHaveCount(0);
});

test('Ver.350 redraw evidence remains intact with fixed root delegation and transient dismissal', async ({ page }) => {
  await boot(page, 'redraw');
  const initial = await stats(page);

  await clickCurrent(page, '.nav-item[data-layout="today"]');
  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.waitForSelector(`[data-task-id="${TASK_ID}"]`, { state: 'attached', timeout: 15_000 });
  await clickCurrent(page, `[data-task-id="${TASK_ID}"]`);
  await clickCurrent(page, '.task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator(`[data-comment-reaction-picker="${COMMENT_ID}"]`)).toBeVisible({ timeout: 15_000 });

  const after = await stats(page);
  expect(after.registrations.filter(item => item.target === '#detailBody')).toEqual([{ target: '#detailBody', capture: true }]);
  expect(after.rootStable).toBe(true);
  expect(after.registrations.filter(item => item.target === '#detailBody')).toEqual(initial.registrations);

  await openPicker(page);
  await clickCurrent(page, '#detailBody .task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator('.comment-reaction-picker-v165:not([hidden])')).toHaveCount(0);
});
