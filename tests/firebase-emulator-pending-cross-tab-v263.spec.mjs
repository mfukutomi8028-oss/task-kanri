import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-pending-cross-tab-v263';
const HOST = '127.0.0.1';
const PORT = 9000;
const PREFIX = `work-board-inbox-pending-v254:${ROOM}:`;
const PROD_DATABASE_RE = /https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i;

test.skip(process.env.WORK_BOARD_FIREBASE_E2E !== '1', 'requires the isolated RTDB emulator');

test.describe.configure({ mode: 'serial' });

function emulatorUrl(path = '') {
  const encoded = String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return `http://${HOST}:${PORT}/${encoded ? `${encoded}.json` : '.json'}?ns=${encodeURIComponent(PROJECT)}`;
}
async function request(path, { method = 'GET', value } = {}) {
  const response = await fetch(emulatorUrl(path), {
    method,
    headers: value === undefined ? undefined : { 'content-type': 'application/json' },
    body: value === undefined ? undefined : JSON.stringify(value)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
const readDb = path => request(path);
const putDb = (path, value) => request(path, { method: 'PUT', value });
const deleteDb = path => request(path, { method: 'DELETE' });

function storageKey(recipient, id) {
  return `${PREFIX}${encodeURIComponent(JSON.stringify([recipient, id]))}`;
}
function pendingEntry(recipient, id, body, queuedAt) {
  return {
    recipient,
    id,
    event: { taskId: `task-${id}`, type: 'reaction', title: '監査通知', body, actor: '福冨', createdAt: queuedAt },
    queuedAt
  };
}
function triggerTask(id, revision) {
  const now = Date.now();
  return {
    id,
    title: id,
    description: '',
    assignee: '福冨',
    status: '対応中',
    priority: '中',
    category: 'その他',
    comments: [],
    checklist: [],
    history: [],
    createdAt: now - 1000,
    createdBy: '福冨',
    updatedAt: now,
    updatedBy: '福冨',
    revision
  };
}

async function configure(page) {
  const productionRequests = [];
  await page.addInitScript(({ project, room, host, port }) => {
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));
    const config = Object.freeze({
      apiKey: 'demo-api-key',
      authDomain: `${project}.firebaseapp.com`,
      databaseURL: `http://${host}:${port}/?ns=${project}`,
      projectId: project,
      appId: '1:000000000000:web:firebase-emulator-only'
    });
    window.WORK_BOARD_TEST = Object.freeze({ emulator: true, host, port });
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return config; }, set() {} });
  }, { project: PROJECT, room: ROOM, host: HOST, port: PORT });
  await page.route(PROD_DATABASE_RE, route => {
    productionRequests.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  page.on('request', req => { if (PROD_DATABASE_RE.test(req.url())) productionRequests.push(req.url()); });
  return productionRequests;
}

async function boot(page) {
  const productionRequests = await configure(page);
  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 20_000 });
  await page.waitForFunction(() => String(window.WORK_BOARD_RELEASE?.version || '') === '254', undefined, { timeout: 10_000 });
  return productionRequests;
}

async function installFlushBarrier(context) {
  let waiting = [];
  await context.route('**/v263-flush-barrier*', route => new Promise(resolve => {
    waiting.push({ route, resolve });
    if (waiting.length < 2) return;
    const release = waiting;
    waiting = [];
    Promise.all(release.map(item => item.route.fulfill({ status: 204 }).finally(item.resolve)));
  }));
}

async function wrapWriter(page, tab, successId, failingId) {
  await page.evaluate(({ tabName, success, failing }) => {
    const workflow = window.WorkBoardWorkflowV152;
    const original = workflow.writeInboxEvent.bind(workflow);
    window.__WB_V263_FLUSH_CALLS__ = [];
    workflow.writeInboxEvent = async (recipient, id, item) => {
      window.__WB_V263_FLUSH_CALLS__.push({ recipient, id, body: item?.body || '' });
      if (id === success) {
        await fetch(`/v263-flush-barrier?tab=${encodeURIComponent(tabName)}&id=${encodeURIComponent(id)}`);
        return original(recipient, id, item);
      }
      if (id === failing) return { ok: false, simulated: 'v263-keep-unrelated-pending' };
      return original(recipient, id, item);
    };
  }, { tabName: tab, success: successId, failing: failingId });
}

async function pendingIds(page) {
  return page.evaluate(prefix => {
    const ids = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        if (value?.id) ids.push(value.id);
      } catch {}
    }
    return ids.sort();
  }, PREFIX);
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
  await putDb(`rooms/${ROOM}/meta`, {
    users: ['福冨', '森井'],
    userColors: { '福冨': '#3c92df', '森井': '#4ebd69' },
    _revisions: { users: 1, userColors: 1 }
  });
});

test('Ver.263 audit: same-event two-tab flush stays server-idempotent and successful clear preserves a failing unrelated event', async ({ context }) => {
  test.slow();
  await installFlushBarrier(context);
  const a = await context.newPage();
  const b = await context.newPage();
  const [prodA, prodB] = await Promise.all([boot(a), boot(b)]);

  const successId = 'reaction_task-v263_parent-v263_👍_福冨_13';
  const failingId = 'reply_task-v263_comment-v263_森井';
  const now = Date.now();
  await a.evaluate(({ successKey, failureKey, successEntry, failureEntry }) => {
    localStorage.setItem(successKey, JSON.stringify(successEntry));
    localStorage.setItem(failureKey, JSON.stringify(failureEntry));
  }, {
    successKey: storageKey('森井', successId),
    failureKey: storageKey('森井', failingId),
    successEntry: pendingEntry('森井', successId, 'same-event-success', now - 2000),
    failureEntry: pendingEntry('森井', failingId, 'unrelated-failure', now - 1000)
  });

  await Promise.all([
    wrapWriter(a, 'A', successId, failingId),
    wrapWriter(b, 'B', successId, failingId)
  ]);

  await putDb(`rooms/${ROOM}/tasks/trigger-v263`, triggerTask('trigger-v263', 1));

  await expect.poll(() => readDb(`rooms/${ROOM}/workflowV152/inbox/森井/${successId}`), { timeout: 15_000 }).toMatchObject({
    taskId: `task-${successId}`,
    body: 'same-event-success',
    actor: '福冨'
  });
  expect(await readDb(`rooms/${ROOM}/workflowV152/inbox/森井/${failingId}`)).toBeNull();
  await expect.poll(() => pendingIds(a), { timeout: 10_000 }).toEqual([failingId]);

  const firstCounts = await Promise.all([a, b].map(page => page.evaluate(({ success, failing }) => ({
    success: window.__WB_V263_FLUSH_CALLS__.filter(call => call.id === success).length,
    failing: window.__WB_V263_FLUSH_CALLS__.filter(call => call.id === failing).length
  }), { success: successId, failing: failingId })));
  expect(firstCounts).toEqual([{ success: 1, failing: 1 }, { success: 1, failing: 1 }]);

  await putDb(`rooms/${ROOM}/tasks/trigger-v263`, triggerTask('trigger-v263', 2));
  await expect.poll(async () => Promise.all([a, b].map(page => page.evaluate(id => window.__WB_V263_FLUSH_CALLS__.filter(call => call.id === id).length, failingId))), { timeout: 10_000 }).toEqual([2, 2]);

  const secondSuccessCounts = await Promise.all([a, b].map(page => page.evaluate(id => window.__WB_V263_FLUSH_CALLS__.filter(call => call.id === id).length, successId)));
  expect(secondSuccessCounts).toEqual([1, 1]);
  expect(await pendingIds(a)).toEqual([failingId]);

  const serverInbox = await readDb(`rooms/${ROOM}/workflowV152/inbox/森井`);
  expect(Object.keys(serverInbox || {})).toEqual([successId]);
  expect(prodA).toEqual([]);
  expect(prodB).toEqual([]);
});
