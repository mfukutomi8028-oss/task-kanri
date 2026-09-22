import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-singleflight-v256';
const HOST = '127.0.0.1';
const PORT = 9000;
const PROD_DATABASE_RE = /https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i;

test.skip(process.env.WORK_BOARD_FIREBASE_E2E !== '1', 'requires the isolated RTDB emulator');
test.describe.configure({ mode: 'serial' });

function emulatorUrl(path = '') {
  const encoded = String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return `http://${HOST}:${PORT}/${encoded ? `${encoded}.json` : '.json'}?ns=${encodeURIComponent(PROJECT)}`;
}

async function emulatorRequest(path, { method = 'GET', value } = {}) {
  const response = await fetch(emulatorUrl(path), {
    method,
    headers: value === undefined ? undefined : { 'content-type': 'application/json' },
    body: value === undefined ? undefined : JSON.stringify(value)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path || '/'} failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const readDb = path => emulatorRequest(path);
const putDb = (path, value) => emulatorRequest(path, { method: 'PUT', value });
const deleteDb = path => emulatorRequest(path, { method: 'DELETE' });

function taskRecord(id) {
  const now = Date.now();
  return {
    id,
    title: 'Ver.256 Firebase emulator single-flight',
    description: '', requester: '', assignee: '福冨', status: '対応中', priority: '中', category: 'その他',
    tags: [], dueDate: '', dueTime: '', pinned: false, checklist: [],
    comments: [{ id: 'parent-v256', author: '福冨', type: '作業メモ', text: 'emulator single-flight parent', createdAt: now - 2000 }],
    history: [], recurrence: 'none', recurrenceRule: {},
    createdAt: now - 20_000, createdBy: '福冨', updatedAt: now - 2000, updatedBy: '福冨',
    completedAt: 0, completedMemo: '', revision: 10
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

async function openTaskComments(page, taskId) {
  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.waitForFunction(id => Boolean(document.querySelector(`[data-task-id="${CSS.escape(id)}"]`)), taskId, { timeout: 15_000 });
  await clickCurrent(page, `[data-task-id="${taskId}"]`);
  await expect(page.locator('.task-detail-tab-v149[data-tab="comments"]')).toBeVisible({ timeout: 15_000 });
  await clickCurrent(page, '.task-detail-tab-v149[data-tab="comments"]');
  await expect(page.locator('.activity-comment[data-comment-id="parent-v256"]')).toBeVisible({ timeout: 15_000 });
}

async function cachedTask(page, taskId) {
  return page.evaluate(({ room, id }) => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    return tasks.find(item => String(item?.id || '') === id) || null;
  }, { room: ROOM, id: taskId });
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('retry generation shares one module load while reaction and reply commit once each to the emulator', async ({ page }) => {
  const taskId = 'task-v256-emulator-singleflight';
  const seeded = taskRecord(taskId);
  await putDb(`rooms/${ROOM}/tasks/${taskId}`, seeded);

  const pageErrors = [];
  const productionRequests = [];
  const requests = { app: 0, database: 0 };
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('request', request => {
    if (PROD_DATABASE_RE.test(request.url())) productionRequests.push(request.url());
  });

  await page.addInitScript(({ room, task }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([task]));
    window.__WB_V256_CONFIG__ = null;
    window.__WB_V256_INIT_APP_CALLS__ = 0;
    window.__WB_V256_GET_DB_CALLS__ = 0;
    window.__WB_V256_TX_CALLS__ = 0;
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return window.__WB_V256_CONFIG__; },
      set() {}
    });
  }, { room: ROOM, task: seeded });

  await page.route(PROD_DATABASE_RE, route => {
    productionRequests.push(route.request().url());
    return route.abort('blockedbyclient');
  });

  await page.route(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-app\.js(?:\?wb-retry=\d+)?$/, async route => {
    requests.app += 1;
    if (requests.app === 1) return route.abort('failed');
    await new Promise(resolve => setTimeout(resolve, 120));
    return route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
      body: [
        'const apps = [];',
        'export function getApps(){ return apps; }',
        'export function getApp(){ return apps[0]; }',
        'export function initializeApp(config){ globalThis.__WB_V256_INIT_APP_CALLS__ += 1; const app = { config }; apps.push(app); return app; }'
      ].join('\n')
    });
  });

  await page.route(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-database\.js(?:\?wb-retry=\d+)?$/, async route => {
    requests.database += 1;
    if (requests.database === 1) return route.abort('failed');
    await new Promise(resolve => setTimeout(resolve, 120));
    return route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
      body: [
        'let queue = Promise.resolve();',
        `const base = ${JSON.stringify(`http://${HOST}:${PORT}`)};`,
        `const project = ${JSON.stringify(PROJECT)};`,
        'function url(path){ const encoded = String(path || "").split("/").filter(Boolean).map(encodeURIComponent).join("/"); return `${base}/${encoded}.json?ns=${encodeURIComponent(project)}`; }',
        'async function read(path){ const response = await fetch(url(path)); if(!response.ok) throw new Error(`emulator-read-${response.status}`); return response.json(); }',
        'async function write(path, value){ const response = await fetch(url(path), { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(value) }); if(!response.ok) throw new Error(`emulator-write-${response.status}`); return response.json(); }',
        'export function getDatabase(app){ globalThis.__WB_V256_GET_DB_CALLS__ += 1; return { app }; }',
        'export function ref(db, path){ return { db, path }; }',
        'export function runTransaction(target, updater){',
        '  globalThis.__WB_V256_TX_CALLS__ += 1;',
        '  const execute = async () => {',
        '    const current = await read(target.path);',
        '    const next = updater(structuredClone(current));',
        '    if (next === undefined) return { committed: false, snapshot: { val: () => structuredClone(current) } };',
        '    await write(target.path, next);',
        '    return { committed: true, snapshot: { val: () => structuredClone(next) } };',
        '  };',
        '  const result = queue.then(execute, execute);',
        '  queue = result.then(() => undefined, () => undefined);',
        '  return result;',
        '}'
      ].join('\n')
    });
  });

  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('connectionPill')?.textContent?.includes('端末内保存'), undefined, { timeout: 15_000 });
  await openTaskComments(page, taskId);

  await page.evaluate(() => {
    window.__WB_V256_CONFIG__ = { apiKey: 'v256-singleflight', databaseURL: 'https://example.invalid', projectId: 'v256-audit' };
    const pill = document.getElementById('connectionPill');
    if (pill) pill.textContent = '共同編集ON';
  });

  await clickCurrent(page, '[data-comment-reaction-picker="parent-v256"]');
  const choice = page.locator('.comment-reaction-choice-v165[data-comment-reaction-id="parent-v256"][data-comment-reaction-emoji="👍"]');
  await choice.evaluate(node => node.click());
  await expect(page.locator('#toast')).toContainText('リアクションを保存できませんでした');
  expect(requests).toEqual({ app: 1, database: 1 });
  expect((await readDb(`rooms/${ROOM}/tasks/${taskId}`)).revision).toBe(10);

  await clickCurrent(page, '[data-comment-reply-target="parent-v256"]');
  await page.locator('#commentText').fill('emulator single-flight reply');
  await clickCurrent(page, '[data-comment-reaction-picker="parent-v256"]');
  await expect(choice).toBeVisible();

  await page.evaluate(() => {
    const reaction = document.querySelector('.comment-reaction-choice-v165[data-comment-reaction-id="parent-v256"][data-comment-reaction-emoji="👍"]');
    const form = document.querySelector('#commentForm');
    if (!(reaction instanceof HTMLButtonElement) || !(form instanceof HTMLFormElement)) throw new Error('v256-emulator-controls-missing');
    reaction.click();
    form.requestSubmit();
  });

  await expect.poll(async () => {
    const task = await readDb(`rooms/${ROOM}/tasks/${taskId}`);
    return {
      revision: Number(task?.revision || 0),
      replyCount: (task?.comments || []).filter(comment => comment?.replyTo === 'parent-v256').length,
      reacted: (task?.comments || []).find(comment => comment?.id === 'parent-v256')?.reactions?.['👍'] || []
    };
  }, { timeout: 20_000 }).toEqual({ revision: 12, replyCount: 1, reacted: ['福冨'] });

  const stored = await readDb(`rooms/${ROOM}/tasks/${taskId}`);
  expect(stored.comments.filter(comment => comment?.replyTo === 'parent-v256')[0]?.text).toBe('emulator single-flight reply');
  expect(stored.history).toHaveLength(1);
  expect(requests).toEqual({ app: 2, database: 2 });

  const runtime = await page.evaluate(() => ({
    initApp: window.__WB_V256_INIT_APP_CALLS__,
    getDb: window.__WB_V256_GET_DB_CALLS__,
    tx: window.__WB_V256_TX_CALLS__
  }));
  expect(runtime).toEqual({ initApp: 1, getDb: 1, tx: 2 });

  await expect.poll(async () => Number((await cachedTask(page, taskId))?.revision || 0), { timeout: 10_000 }).toBe(12);
  const cached = await cachedTask(page, taskId);
  expect(cached.comments.filter(comment => comment?.replyTo === 'parent-v256')).toHaveLength(1);
  expect(cached.comments.find(comment => comment?.id === 'parent-v256')?.reactions?.['👍']).toEqual(['福冨']);
  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);
});
