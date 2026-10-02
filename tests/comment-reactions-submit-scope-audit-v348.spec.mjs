import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-comment-reactions-submit-v348';
const TASK_ID = 'task-comment-reactions-v348';
const COMMENT_ID = 'comment-comment-reactions-v348';

function taskRecord() {
  const now = Date.now();
  return {
    id: TASK_ID,
    title: 'Ver.348 コメントsubmit scope監査',
    description: '',
    requester: '',
    assignee: '福冨',
    status: '対応中',
    priority: '中',
    category: 'その他',
    tags: [],
    dueDate: '',
    dueTime: '',
    pinned: false,
    checklist: [],
    comments: [{
      id: COMMENT_ID,
      author: '森井',
      type: '作業メモ',
      text: 'submit delegationの境界を監査します',
      createdAt: now - 1000
    }],
    history: [],
    recurrence: 'none',
    recurrenceRule: {},
    createdAt: now - 5000,
    createdBy: '福冨',
    updatedAt: now,
    updatedBy: '福冨',
    completedAt: 0,
    completedMemo: '',
    revision: 1
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

    const state = window.__WB_COMMENT_SUBMIT_V348__ = {
      registrations: [],
      callbacks: 0,
      requestSubmits: 0,
      root: null
    };
    const nativeAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const stack = String(new Error().stack || '');
      if (type === 'submit' && stack.includes('comment-reactions-v191.js') && typeof listener === 'function') {
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

    const nativeRequestSubmit = HTMLFormElement.prototype.requestSubmit;
    HTMLFormElement.prototype.requestSubmit = function (...args) {
      state.requestSubmits += 1;
      return nativeRequestSubmit.apply(this, args);
    };

    window.__WB_TEST_FIREBASE_CONFIG_V348__ = null;
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return window.__WB_TEST_FIREBASE_CONFIG_V348__; },
      set() {}
    });
  }, { room, task: taskRecord() });

  await page.route(/\/comment-reactions-v191\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let source = await response.text();
    const documentPattern = /document\.addEventListener\(\s*['"]submit['"]\s*,/;
    const rootPattern = /root\.addEventListener\(\s*['"]submit['"]\s*,/;
    if (documentPattern.test(source)) {
      source = source.replace(documentPattern, "root.addEventListener('submit',");
    } else if (!rootPattern.test(source)) {
      throw new Error('Ver.348 submit contract found neither document candidate nor productized #detailBody listener');
    }
    if (documentPattern.test(source) || !rootPattern.test(source)) {
      throw new Error('Ver.348 submit contract did not converge on the #detailBody listener');
    }
    source = `window.__WB_V348_CANDIDATE_LOADED__ = true;\n${source}`;
    await route.fulfill({ response, body: source });
  });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${encodeURIComponent(room)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.__WB_V348_CANDIDATE_LOADED__ === true, undefined, { timeout: 10_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.dependencyState?.() === 'local-only', undefined, { timeout: 10_000 });
  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.waitForSelector(`[data-task-id="${TASK_ID}"]`, { state: 'attached', timeout: 15_000 });
  await clickCurrent(page, `[data-task-id="${TASK_ID}"]`);
  await expect(page.locator('.task-detail-tab-v149[data-tab="comments"]')).toBeVisible({ timeout: 15_000 });
  await clickCurrent(page, '.task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator('.task-detail-panel-v149[data-tab-panel="comments"]')).toBeVisible();
  await expect(page.locator(`.activity-comment[data-comment-id="${COMMENT_ID}"]`)).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => {
    window.__WB_COMMENT_SUBMIT_V348__.root = document.getElementById('detailBody');
  });
  return { room };
}

async function stats(page) {
  return page.evaluate(() => {
    const state = window.__WB_COMMENT_SUBMIT_V348__;
    return {
      registrations: state.registrations.map(item => ({ ...item })),
      callbacks: state.callbacks,
      requestSubmits: state.requestSubmits,
      rootStable: state.root === document.getElementById('detailBody')
    };
  });
}

async function storedTask(page, room) {
  return page.evaluate(({ room, id }) => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    return tasks.find(item => item.id === id) || null;
  }, { room, id: TASK_ID });
}

async function openReply(page) {
  await clickCurrent(page, `[data-comment-reply-target="${COMMENT_ID}"]`);
  await expect(page.locator('.comment-reply-compose-v215')).toBeVisible();
}

test('Ver.348 audit candidate scopes capture submit to fixed #detailBody and ignores outside forms', async ({ page }) => {
  await boot(page, 'scope');
  const initial = await stats(page);
  expect(initial.registrations).toEqual([{ target: '#detailBody', capture: true }]);
  expect(initial.rootStable).toBe(true);

  const before = initial.callbacks;
  await page.evaluate(() => {
    const form = document.createElement('form');
    document.body.append(form);
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    form.remove();
  });
  expect((await stats(page)).callbacks).toBe(before);
});

test('Ver.348 audit candidate keeps ordinary local-only comments on the canonical writer', async ({ page }) => {
  const { room } = await boot(page, 'ordinary');
  const before = await stats(page);

  await page.locator('#commentText').fill('Ver.348 通常コメント');
  await clickCurrent(page, '#commentForm button[type="submit"]');

  await expect.poll(async () => {
    const task = await storedTask(page, room);
    return task?.comments?.length || 0;
  }, { timeout: 10_000 }).toBe(2);

  const stored = await storedTask(page, room);
  const comment = stored.comments.find(item => item.id !== COMMENT_ID);
  expect(comment?.text).toBe('Ver.348 通常コメント');
  expect(String(comment?.replyTo || '')).toBe('');
  expect((await stats(page)).callbacks).toBe(before.callbacks + 1);
});

test('Ver.348 audit candidate keeps local-only structured reply handoff', async ({ page }) => {
  const { room } = await boot(page, 'local-reply');
  const before = await stats(page);

  await openReply(page);
  await page.locator('#commentType').selectOption({ label: '確認依頼' });
  await page.locator('#commentText').fill('Ver.348 structured reply');
  await clickCurrent(page, '#commentForm button[type="submit"]');

  await expect.poll(async () => {
    const task = await storedTask(page, room);
    return (task?.comments || []).some(item => item.text === 'Ver.348 structured reply' && item.replyTo === COMMENT_ID);
  }, { timeout: 10_000 }).toBe(true);

  expect((await stats(page)).callbacks).toBe(before.callbacks + 1);
  await expect(page.locator('.comment-reply-compose-v215')).toHaveCount(0);
  await expect(page.locator('#commentText')).toHaveValue('');
});

test('Ver.348 audit candidate preserves configured degraded reply read-only guard', async ({ page }) => {
  const { room } = await boot(page, 'degraded');

  await page.evaluate(() => {
    window.__WB_TEST_FIREBASE_CONFIG_V348__ = {
      apiKey: 'configured-for-v348-boundary-test',
      databaseURL: 'https://example.invalid'
    };
    const pill = document.getElementById('connectionPill');
    if (pill) pill.textContent = '共同データ読込エラー（保存不可）';
  });

  await openReply(page);
  await page.locator('#commentText').fill('接続復旧後に送るVer.348返信');
  await clickCurrent(page, '#commentForm button[type="submit"]');

  await page.waitForTimeout(250);
  await expect(page.locator('#commentText')).toHaveValue('接続復旧後に送るVer.348返信');
  await expect(page.locator('.comment-reply-compose-v215')).toBeVisible();
  expect((await storedTask(page, room))?.comments?.length).toBe(1);
  await expect(page.locator('#toast')).toContainText('返信内容は保持しています');
});

test('Ver.348 audit candidate keeps Ctrl/Meta+Enter requestSubmit and survives detail redraw', async ({ page }) => {
  const { room } = await boot(page, 'request-submit');

  await openReply(page);
  await page.locator('#commentText').fill('Ver.348 requestSubmit reply');
  const beforeRequest = (await stats(page)).requestSubmits;
  await page.locator('#commentText').press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');

  await expect.poll(async () => {
    const task = await storedTask(page, room);
    return (task?.comments || []).some(item => item.text === 'Ver.348 requestSubmit reply' && item.replyTo === COMMENT_ID);
  }, { timeout: 10_000 }).toBe(true);
  expect((await stats(page)).requestSubmits).toBe(beforeRequest + 1);

  await clickCurrent(page, '.nav-item[data-layout="today"]');
  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.waitForSelector(`[data-task-id="${TASK_ID}"]`, { state: 'attached', timeout: 15_000 });
  await clickCurrent(page, `[data-task-id="${TASK_ID}"]`);
  await clickCurrent(page, '.task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator('#commentText')).toBeVisible();

  const afterRedraw = await stats(page);
  expect(afterRedraw.rootStable).toBe(true);
  expect(afterRedraw.registrations).toEqual([{ target: '#detailBody', capture: true }]);

  await openReply(page);
  await page.locator('#commentText').fill('Ver.348 after redraw reply');
  await clickCurrent(page, '#commentForm button[type="submit"]');

  await expect.poll(async () => {
    const task = await storedTask(page, room);
    return (task?.comments || []).some(item => item.text === 'Ver.348 after redraw reply' && item.replyTo === COMMENT_ID);
  }, { timeout: 10_000 }).toBe(true);
});
