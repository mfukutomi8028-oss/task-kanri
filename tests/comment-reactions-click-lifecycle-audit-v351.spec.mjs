import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-comment-reactions-click-v351';
const TASK_ID = 'task-comment-reactions-v351';
const COMMENT_ID = 'comment-comment-reactions-v351';

function taskRecord() {
  const now = Date.now();
  return {
    id: TASK_ID,
    title: 'Ver.351 コメントclick lifecycle監査',
    description: '', requester: '', assignee: '福冨', status: '対応中', priority: '中', category: 'その他', tags: [],
    dueDate: '', dueTime: '', pinned: false, checklist: [],
    comments: [{ id: COMMENT_ID, author: '森井', type: '作業メモ', text: 'outside click lifecycleを監査します', createdAt: now - 1000 }],
    history: [], recurrence: 'none', recurrenceRule: {}, createdAt: now - 5000, createdBy: '福冨', updatedAt: now,
    updatedBy: '福冨', completedAt: 0, completedMemo: '', revision: 1
  };
}

function transformCandidate(source) {
  const replaceOnce = (before, after, label) => {
    if (!source.includes(before)) throw new Error(`Ver.351 candidate anchor missing: ${label}`);
    source = source.replace(before, after);
  };

  replaceOnce(
    '  let replyTarget = null;\n',
    '  let replyTarget = null;\n  let pickerOutsideClickBound = false;\n',
    'picker outside-click lifecycle state'
  );

  const oldClose = `  function closePickers(except = null) {\n    document.querySelectorAll(".comment-reaction-picker-v165:not([hidden])").forEach(picker => {\n      if (picker === except) return;\n      picker.hidden = true;\n      picker.parentElement?.querySelector("[data-comment-reaction-picker]")?.setAttribute("aria-expanded", "false");\n    });\n  }\n\n  function bindGlobalEvents(root) {`;
  const nextClose = `  function closePickers(except = null) {\n    document.querySelectorAll(".comment-reaction-picker-v165:not([hidden])").forEach(picker => {\n      if (picker === except) return;\n      picker.hidden = true;\n      picker.parentElement?.querySelector("[data-comment-reaction-picker]")?.setAttribute("aria-expanded", "false");\n    });\n    setPickerOutsideClick(Boolean(document.querySelector(".comment-reaction-picker-v165:not([hidden])")));\n  }\n\n  function handlePickerOutsideClick(event) {\n    if (!document.querySelector(".comment-reaction-picker-v165:not([hidden])")) {\n      setPickerOutsideClick(false);\n      return;\n    }\n    if (!event.target.closest?.(".comment-reactions-v165")) closePickers();\n  }\n\n  function setPickerOutsideClick(active) {\n    const next = Boolean(active);\n    if (next === pickerOutsideClickBound) return;\n    pickerOutsideClickBound = next;\n    if (next) document.addEventListener("click", handlePickerOutsideClick, true);\n    else document.removeEventListener("click", handlePickerOutsideClick, true);\n  }\n\n  function bindGlobalEvents(root) {`;
  replaceOnce(oldClose, nextClose, 'closePickers lifecycle split');
  replaceOnce('    document.addEventListener("click", event => {', '    root.addEventListener("click", event => {', 'local click delegation root');
  replaceOnce(
    '        pickerButton.setAttribute("aria-expanded", opening ? "true" : "false");\n        return;',
    '        pickerButton.setAttribute("aria-expanded", opening ? "true" : "false");\n        setPickerOutsideClick(opening);\n        return;',
    'picker open/close lifecycle sync'
  );
  return source;
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

async function boot(page, suffix, { candidate = true } = {}) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ room, task }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([task]));

    const state = window.__WB_COMMENT_CLICK_V351__ = {
      adds: [], removes: [], callbacks: { document: 0, root: 0 },
      activeDocument: 0, activeRoot: 0, maxActiveDocument: 0, root: null
    };
    const wrapped = new WeakMap();
    const nativeAdd = EventTarget.prototype.addEventListener;
    const nativeRemove = EventTarget.prototype.removeEventListener;
    const targetName = target => target === document ? 'document' : target?.id === 'detailBody' ? 'root' : 'other';
    const captureOf = options => options === true || Boolean(options && typeof options === 'object' && options.capture);

    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const stack = String(new Error().stack || '');
      if (type === 'click' && stack.includes('comment-reactions-v191.js') && typeof listener === 'function') {
        const name = targetName(this);
        const capture = captureOf(options);
        const proxy = function (...args) {
          if (name === 'document' || name === 'root') state.callbacks[name] += 1;
          return listener.apply(this, args);
        };
        wrapped.set(listener, proxy);
        state.adds.push({ target: name, capture });
        if (name === 'document') {
          state.activeDocument += 1;
          state.maxActiveDocument = Math.max(state.maxActiveDocument, state.activeDocument);
        }
        if (name === 'root') state.activeRoot += 1;
        return nativeAdd.call(this, type, proxy, options);
      }
      return nativeAdd.call(this, type, listener, options);
    };

    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      const stack = String(new Error().stack || '');
      if (type === 'click' && stack.includes('comment-reactions-v191.js') && typeof listener === 'function') {
        const name = targetName(this);
        state.removes.push({ target: name, capture: captureOf(options) });
        if (name === 'document') state.activeDocument = Math.max(0, state.activeDocument - 1);
        if (name === 'root') state.activeRoot = Math.max(0, state.activeRoot - 1);
        return nativeRemove.call(this, type, wrapped.get(listener) || listener, options);
      }
      return nativeRemove.call(this, type, listener, options);
    };

    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
  }, { room, task: taskRecord() });

  await page.route(/\/comment-reactions-v191\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let source = await response.text();
    if (candidate) source = transformCandidate(source);
    source = `window.__WB_V351_MODE__ = ${JSON.stringify(candidate ? 'candidate' : 'product')};\n${source}`;
    await route.fulfill({ response, body: source });
  });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${encodeURIComponent(room)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.__WB_V351_MODE__, undefined, { timeout: 10_000 });
  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.waitForSelector(`[data-task-id="${TASK_ID}"]`, { state: 'attached', timeout: 15_000 });
  await clickCurrent(page, `[data-task-id="${TASK_ID}"]`);
  await expect(page.locator('.task-detail-tab-v149[data-tab="comments"]')).toBeVisible({ timeout: 15_000 });
  await clickCurrent(page, '.task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator(`.activity-comment[data-comment-id="${COMMENT_ID}"]`)).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => { window.__WB_COMMENT_CLICK_V351__.root = document.getElementById('detailBody'); });
}

async function stats(page) {
  return page.evaluate(() => {
    const s = window.__WB_COMMENT_CLICK_V351__;
    return {
      adds: s.adds.map(item => ({ ...item })), removes: s.removes.map(item => ({ ...item })),
      callbacks: { ...s.callbacks }, activeDocument: s.activeDocument, activeRoot: s.activeRoot,
      maxActiveDocument: s.maxActiveDocument, rootStable: s.root === document.getElementById('detailBody')
    };
  });
}

async function addOutsideButton(page) {
  await page.evaluate(() => {
    document.getElementById('v351OutsideClick')?.remove();
    const button = document.createElement('button');
    button.id = 'v351OutsideClick';
    button.type = 'button';
    button.textContent = 'outside detail';
    document.body.append(button);
  });
}

async function openPicker(page) {
  await clickCurrent(page, `[data-comment-reaction-picker="${COMMENT_ID}"]`);
  await expect(page.locator('.comment-reaction-picker-v165:not([hidden])')).toHaveCount(1);
}

test('Ver.351 candidate has no document click owner while picker is closed', async ({ page }) => {
  await boot(page, 'closed');
  await addOutsideButton(page);
  const before = await stats(page);
  expect(before.activeRoot).toBe(1);
  expect(before.activeDocument).toBe(0);
  expect(before.rootStable).toBe(true);

  await clickCurrent(page, '#v351OutsideClick');
  const after = await stats(page);
  expect(after.callbacks.document).toBe(before.callbacks.document);
  expect(after.callbacks.root).toBe(before.callbacks.root);
  expect(after.activeDocument).toBe(0);
});

test('Ver.351 picker open owns one document outside-click listener and releases it after dismissal', async ({ page }) => {
  await boot(page, 'outside-dismiss');
  const initial = await stats(page);
  await openPicker(page);
  const opened = await stats(page);
  expect(opened.activeDocument).toBe(1);
  expect(opened.maxActiveDocument).toBe(1);
  expect(opened.callbacks.document).toBe(initial.callbacks.document);

  await addOutsideButton(page);
  await clickCurrent(page, '#v351OutsideClick');
  await expect(page.locator('.comment-reaction-picker-v165:not([hidden])')).toHaveCount(0);
  const closed = await stats(page);
  expect(closed.callbacks.document).toBe(opened.callbacks.document + 1);
  expect(closed.activeDocument).toBe(0);
  expect(closed.removes.filter(item => item.target === 'document')).toHaveLength(1);
});

test('Ver.351 picker toggle and reopen cycles never duplicate the document listener', async ({ page }) => {
  await boot(page, 'cycles');
  await openPicker(page);
  expect((await stats(page)).activeDocument).toBe(1);

  await clickCurrent(page, `[data-comment-reaction-picker="${COMMENT_ID}"]`);
  await expect(page.locator('.comment-reaction-picker-v165:not([hidden])')).toHaveCount(0);
  expect((await stats(page)).activeDocument).toBe(0);

  await openPicker(page);
  const reopened = await stats(page);
  expect(reopened.activeDocument).toBe(1);
  expect(reopened.maxActiveDocument).toBe(1);

  await clickCurrent(page, '#detailBody .task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator('.comment-reaction-picker-v165:not([hidden])')).toHaveCount(0);
  const final = await stats(page);
  expect(final.activeDocument).toBe(0);
  expect(final.maxActiveDocument).toBe(1);
});

test('Ver.351 keeps reply actions local and Escape releases picker outside-click ownership', async ({ page }) => {
  await boot(page, 'reply-escape');
  await clickCurrent(page, `[data-comment-reply-target="${COMMENT_ID}"]`);
  await expect(page.locator('.comment-reply-compose-v215')).toBeVisible();
  expect((await stats(page)).activeDocument).toBe(0);
  await clickCurrent(page, '[data-cancel-comment-reply-v215]');
  await expect(page.locator('.comment-reply-compose-v215')).toHaveCount(0);

  await openPicker(page);
  expect((await stats(page)).activeDocument).toBe(1);
  await page.locator(`[data-comment-reaction-picker="${COMMENT_ID}"]`).press('Escape');
  await expect(page.locator('.comment-reaction-picker-v165:not([hidden])')).toHaveCount(0);
  expect((await stats(page)).activeDocument).toBe(0);
});

test('Ver.351 navigation closes picker before detail redraw and leaves no document click owner', async ({ page }) => {
  await boot(page, 'redraw');
  await openPicker(page);
  expect((await stats(page)).activeDocument).toBe(1);

  await clickCurrent(page, '.nav-item[data-layout="today"]');
  await expect(page.locator('.comment-reaction-picker-v165:not([hidden])')).toHaveCount(0);
  expect((await stats(page)).activeDocument).toBe(0);

  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.waitForSelector(`[data-task-id="${TASK_ID}"]`, { state: 'attached', timeout: 15_000 });
  await clickCurrent(page, `[data-task-id="${TASK_ID}"]`);
  await clickCurrent(page, '.task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator(`[data-comment-reaction-picker="${COMMENT_ID}"]`)).toBeVisible({ timeout: 15_000 });
  await openPicker(page);
  const final = await stats(page);
  expect(final.activeDocument).toBe(1);
  expect(final.maxActiveDocument).toBe(1);
  expect(final.rootStable).toBe(true);
});
