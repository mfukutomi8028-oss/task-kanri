import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-notification-idempotency-v250';
const HOST = '127.0.0.1';
const PORT = 9000;
const PROD_DATABASE_RE = /https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i;

test.skip(process.env.WORK_BOARD_FIREBASE_E2E !== '1', 'requires the isolated RTDB emulator');
test.describe.configure({ mode: 'serial' });

function emulatorUrl(path = '') {
  const encoded = String(path || '').split('/').filter(Boolean).map(segment => encodeURIComponent(segment)).join('/');
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

function taskRecord(id, revision = 10) {
  const now = Date.now();
  return {
    id,
    title: '通知冪等性監査',
    description: '', requester: '', assignee: '佐藤',
    status: '対応中', priority: '中', category: 'その他', tags: [],
    dueDate: '', dueTime: '', pinned: false, checklist: [],
    comments: [{ id: 'parent-v250', author: '森井', type: '作業メモ', text: '確認をお願いします', createdAt: now - 2000 }],
    history: [], recurrence: 'none', recurrenceRule: {},
    createdAt: now - 20_000, createdBy: '森井',
    updatedAt: now - 2000, updatedBy: '森井',
    lastChange: { label: '作業メモ追加', summary: '作業メモが追加されました', details: ['作業メモ: 確認をお願いします'] },
    completedAt: 0, completedMemo: '', revision
  };
}

async function seedMeta() {
  await putDb(`rooms/${ROOM}/meta`, {
    users: ['福冨', '森井', '佐藤'],
    userColors: { '福冨': '#3c92df', '森井': '#4ebd69', '佐藤': '#8b6ccf' },
    _revisions: { users: 1, userColors: 1 }
  });
}

async function configurePage(page, user, initialTasks) {
  const productionRequests = [];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(({ project, room, host, port, userName, tasks }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', userName);
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify(Array.isArray(tasks) ? tasks : []));
    const demoConfig = Object.freeze({
      apiKey: 'demo-api-key',
      authDomain: `${project}.firebaseapp.com`,
      databaseURL: `http://${host}:${port}/?ns=${project}`,
      projectId: project,
      appId: '1:000000000000:web:firebase-emulator-only'
    });
    window.WORK_BOARD_TEST = Object.freeze({ emulator: true, host, port });
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return demoConfig; }, set() {} });
  }, { project: PROJECT, room: ROOM, host: HOST, port: PORT, userName: user, tasks: initialTasks });
  await page.route(PROD_DATABASE_RE, route => { productionRequests.push(route.request().url()); return route.abort('blockedbyclient'); });
  page.on('request', request => { if (PROD_DATABASE_RE.test(request.url())) productionRequests.push(request.url()); });
  return { productionRequests, pageErrors };
}

async function bootObserver(browser, user, initialTasks) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const safety = await configurePage(page, user, initialTasks);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('connectionPill')?.textContent?.includes('共同編集ON'), undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 15_000 });
  await page.waitForTimeout(500);
  return { context, page, ...safety };
}

async function inboxMap(user = '森井') {
  const value = await readDb(`rooms/${ROOM}/workflowV152/inbox/${user}`);
  return value && typeof value === 'object' ? value : {};
}

async function duplicateWriter(page, recipient, id, event) {
  return page.evaluate(async ({ recipientName, eventId, item }) => {
    return window.WorkBoardWorkflowV152.writeInboxEvent(recipientName, eventId, item);
  }, { recipientName: recipient, eventId: id, item: event });
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
  await seedMeta();
});

test('reply writer and two observers converge on one inbox event across reconnect', async ({ browser }) => {
  const taskId = 'task-reply-idempotency-v250';
  const seeded = taskRecord(taskId, 10);
  await putDb(`rooms/${ROOM}/tasks/${taskId}`, seeded);
  const a = await bootObserver(browser, '福冨', [seeded]);
  const b = await bootObserver(browser, '佐藤', [seeded]);
  try {
    const replyId = 'reply-fixed-v250';
    const createdAt = Date.now();
    const next = structuredClone(seeded);
    next.comments.push({ id: replyId, author: '福冨', type: '作業メモ', text: '返信の冪等性を確認します', createdAt, replyTo: 'parent-v250' });
    next.revision = seeded.revision + 1;
    await putDb(`rooms/${ROOM}/tasks/${taskId}`, next);

    const eventId = `reply_${taskId}_${replyId}_森井`;
    await expect.poll(async () => Object.keys(await inboxMap()).filter(key => key.startsWith('reply_')).sort(), { timeout: 15_000 }).toEqual([eventId]);

    await duplicateWriter(a.page, '森井', eventId, {
      taskId, type: 'reply', title: 'コメントに返信がありました', body: '福冨：返信の冪等性を確認します', actor: '福冨', createdAt
    });
    await duplicateWriter(b.page, '森井', eventId, {
      taskId, type: 'reply', title: 'コメントに返信がありました', body: '福冨：返信の冪等性を確認します', actor: '福冨', createdAt: createdAt + 999
    });
    expect(Object.keys(await inboxMap()).filter(key => key.startsWith('reply_'))).toEqual([eventId]);

    await a.page.reload({ waitUntil: 'domcontentloaded' });
    await a.page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 20_000 });
    await a.page.waitForTimeout(700);
    expect(Object.keys(await inboxMap()).filter(key => key.startsWith('reply_'))).toEqual([eventId]);
    expect(a.pageErrors).toEqual([]);
    expect(b.pageErrors).toEqual([]);
    expect(a.productionRequests).toEqual([]);
    expect(b.productionRequests).toEqual([]);
  } finally {
    await a.context.close();
    await b.context.close();
  }
});

test('reaction writer and two observers converge per revision while a later re-add gets a new event', async ({ browser }) => {
  const taskId = 'task-reaction-idempotency-v250';
  const seeded = taskRecord(taskId, 20);
  await putDb(`rooms/${ROOM}/tasks/${taskId}`, seeded);
  const a = await bootObserver(browser, '福冨', [seeded]);
  const b = await bootObserver(browser, '佐藤', [seeded]);
  try {
    const added = structuredClone(seeded);
    added.comments[0].reactions = { '👍': ['福冨'] };
    added.revision = 21;
    await putDb(`rooms/${ROOM}/tasks/${taskId}`, added);

    const event21 = `reaction_${taskId}_parent-v250_👍_福冨_21`;
    await expect.poll(async () => Object.keys(await inboxMap()).filter(key => key.startsWith('reaction_')).sort(), { timeout: 15_000 }).toEqual([event21]);
    await duplicateWriter(a.page, '森井', event21, {
      taskId, type: 'reaction', title: 'コメントにリアクションがありました', body: '福冨：👍「確認をお願いします」', actor: '福冨', createdAt: Date.now()
    });
    await duplicateWriter(b.page, '森井', event21, {
      taskId, type: 'reaction', title: 'コメントにリアクションがありました', body: '福冨：👍「確認をお願いします」', actor: '福冨', createdAt: Date.now() + 999
    });
    expect(Object.keys(await inboxMap()).filter(key => key.startsWith('reaction_'))).toEqual([event21]);

    const removed = structuredClone(added);
    delete removed.comments[0].reactions;
    removed.revision = 22;
    await putDb(`rooms/${ROOM}/tasks/${taskId}`, removed);
    await a.page.waitForTimeout(700);
    expect(Object.keys(await inboxMap()).filter(key => key.startsWith('reaction_'))).toEqual([event21]);

    const readded = structuredClone(removed);
    readded.comments[0].reactions = { '👍': ['福冨'] };
    readded.revision = 23;
    await putDb(`rooms/${ROOM}/tasks/${taskId}`, readded);
    const event23 = `reaction_${taskId}_parent-v250_👍_福冨_23`;
    await expect.poll(async () => Object.keys(await inboxMap()).filter(key => key.startsWith('reaction_')).sort(), { timeout: 15_000 }).toEqual([event21, event23].sort());

    await a.page.reload({ waitUntil: 'domcontentloaded' });
    await a.page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 20_000 });
    await a.page.waitForTimeout(700);
    expect(Object.keys(await inboxMap()).filter(key => key.startsWith('reaction_')).sort()).toEqual([event21, event23].sort());
    expect(a.pageErrors).toEqual([]);
    expect(b.pageErrors).toEqual([]);
    expect(a.productionRequests).toEqual([]);
    expect(b.productionRequests).toEqual([]);
  } finally {
    await a.context.close();
    await b.context.close();
  }
});
