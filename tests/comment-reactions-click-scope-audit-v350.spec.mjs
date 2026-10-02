import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-comment-reactions-click-v350';
const TASK_ID = 'task-comment-reactions-v350';
const COMMENT_ID = 'comment-comment-reactions-v350';

function taskRecord() {
  const now = Date.now();
  return {
    id: TASK_ID,
    title: 'Ver.350 コメントclick scope監査',
    description: '', requester: '', assignee: '福冨', status: '対応中', priority: '中', category: 'その他', tags: [],
    dueDate: '', dueTime: '', pinned: false, checklist: [],
    comments: [{ id: COMMENT_ID, author: '森井', type: '作業メモ', text: 'click delegationの境界を監査します', createdAt: now - 1000 }],
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

async function boot(page, suffix, { candidate = false } = {}) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ room, task }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([task]));
    window.__WB_COMMENT_CLICK_V350__ = { registrations: [], callbacks: 0, root: null };

    const nativeAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const stack = String(new Error().stack || '');
      if (type === 'click' && stack.includes('comment-reactions-v191.js') && typeof listener === 'function') {
        const state = window.__WB_COMMENT_CLICK_V350__;
        const target = this === document ? 'document' : this?.id ? `#${this.id}` : String(this?.constructor?.name || 'unknown');
        const capture = options === true || Boolean(options && typeof options === 'object' && options.capture);
        state.registrations.push({ target, capture });
        const wrapped = function (...args) {
          state.callbacks += 1;
          return listener.apply(this, args);
        };
        return nativeAdd.call(this, type, wrapped, options);
      }
      return nativeAdd.call(this, type, listener, options);
    };

    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
  }, { room, task: taskRecord() });

  await page.route(/\/comment-reactions-v191\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let source = await response.text();
    const documentPattern = /document\.addEventListener\(\s*["']click["']\s*,/;
    const rootPattern = /root\.addEventListener\(\s*["']click["']\s*,/;
    if (candidate) {
      if (!documentPattern.test(source)) throw new Error('Ver.350 document click candidate not found');
      source = source.replace(documentPattern, 'root.addEventListener("click",');
      if (documentPattern.test(source) || !rootPattern.test(source)) throw new Error('Ver.350 candidate did not converge on #detailBody click');
    }
    source = `window.__WB_V350_MODE__ = ${JSON.stringify(candidate ? 'candidate' : 'product')};\n${source}`;
    await route.fulfill({ response, body: source });
  });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${encodeURIComponent(room)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.__WB_V350_MODE__, undefined, { timeout: 10_000 });
  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.waitForSelector(`[data-task-id="${TASK_ID}"]`, { state: 'attached', timeout: 15_000 });
  await clickCurrent(page, `[data-task-id="${TASK_ID}"]`);
  await expect(page.locator('.task-detail-tab-v149[data-tab="comments"]')).toBeVisible({ timeout: 15_000 });
  await clickCurrent(page, '.task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator(`.activity-comment[data-comment-id="${COMMENT_ID}"]`)).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => { window.__WB_COMMENT_CLICK_V350__.root = document.getElementById('detailBody'); });
  return { room };
}

async function stats(page) {
  return page.evaluate(() => {
    const state = window.__WB_COMMENT_CLICK_V350__;
    return { registrations: state.registrations.map(item => ({ ...item })), callbacks: state.callbacks, rootStable: state.root === document.getElementById('detailBody') };
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
  await expect(page.locator(`.comment-reactions-v165[data-comment-reactions-for="${COMMENT_ID}"] .comment-reaction-picker-v165`)).toBeVisible();
}

async function openReply(page) {
  await clickCurrent(page, `[data-comment-reply-target="${COMMENT_ID}"]`);
  await expect(page.locator('.comment-reply-compose-v215')).toBeVisible();
}

test('Ver.350 product baseline owns one document capture click and dismisses picker outside detail', async ({ page }) => {
  await boot(page, 'baseline');
  const initial = await stats(page);
  expect(initial.registrations).toEqual([{ target: 'document', capture: true }]);
  expect(initial.rootStable).toBe(true);

  await openPicker(page);
  await addOutsideButton(page);
  const before = (await stats(page)).callbacks;
  await clickCurrent(page, '#v350OutsideClick');
  await expect(page.locator('.comment-reaction-picker-v165:not([hidden])')).toHaveCount(0);
  expect((await stats(page)).callbacks).toBe(before + 1);
});

test('Ver.350 direct-root candidate removes unrelated outside wake-up but loses outside-detail dismissal', async ({ page }) => {
  await boot(page, 'candidate-outside', { candidate: true });
  const initial = await stats(page);
  expect(initial.registrations).toEqual([{ target: '#detailBody', capture: true }]);
  expect(initial.rootStable).toBe(true);

  await openPicker(page);
  await addOutsideButton(page);
  const before = (await stats(page)).callbacks;
  await clickCurrent(page, '#v350OutsideClick');
  expect((await stats(page)).callbacks).toBe(before);
  await expect(page.locator('.comment-reaction-picker-v165:not([hidden])')).toHaveCount(1);
});

test('Ver.350 direct-root candidate keeps reply open/cancel and picker local dismissal', async ({ page }) => {
  await boot(page, 'local-actions', { candidate: true });

  await openReply(page);
  await clickCurrent(page, '[data-cancel-comment-reply-v215]');
  await expect(page.locator('.comment-reply-compose-v215')).toHaveCount(0);

  await openPicker(page);
  await clickCurrent(page, '#detailBody .task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator('.comment-reaction-picker-v165:not([hidden])')).toHaveCount(0);
});

test('Ver.350 direct-root candidate keeps picker behavior after detail redraw', async ({ page }) => {
  await boot(page, 'redraw', { candidate: true });
  const initial = await stats(page);

  await clickCurrent(page, '.nav-item[data-layout="today"]');
  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.waitForSelector(`[data-task-id="${TASK_ID}"]`, { state: 'attached', timeout: 15_000 });
  await clickCurrent(page, `[data-task-id="${TASK_ID}"]`);
  await clickCurrent(page, '.task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator(`[data-comment-reaction-picker="${COMMENT_ID}"]`)).toBeVisible({ timeout: 15_000 });

  const after = await stats(page);
  expect(after.registrations).toEqual([{ target: '#detailBody', capture: true }]);
  expect(after.rootStable).toBe(true);
  expect(after.registrations).toEqual(initial.registrations);

  await openPicker(page);
  await clickCurrent(page, '#detailBody .task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator('.comment-reaction-picker-v165:not([hidden])')).toHaveCount(0);
});
