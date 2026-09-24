import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-pending-multitab-v261';
const HOST = '127.0.0.1';
const PORT = 9000;
const PROD_DATABASE_RE = /https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i;

test.skip(process.env.WORK_BOARD_FIREBASE_E2E !== '1', 'requires the isolated RTDB emulator');

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

async function configure(page) {
  const productionRequests = [];
  await page.addInitScript(({ project, room, host, port }) => {
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));
    const config = Object.freeze({
      apiKey: 'demo-api-key', authDomain: `${project}.firebaseapp.com`,
      databaseURL: `http://${host}:${port}/?ns=${project}`, projectId: project,
      appId: '1:000000000000:web:firebase-emulator-only'
    });
    window.WORK_BOARD_TEST = Object.freeze({ emulator: true, host, port });
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return config; }, set() {} });
  }, { project: PROJECT, room: ROOM, host: HOST, port: PORT });
  await page.route(PROD_DATABASE_RE, route => {
    productionRequests.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  return productionRequests;
}

async function boot(page) {
  const productionRequests = await configure(page);
  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 20_000 });
  return productionRequests;
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
  await putDb(`rooms/${ROOM}/meta`, {
    users: ['福冨', '森井'], userColors: { '福冨': '#3c92df', '森井': '#4ebd69' }, _revisions: { users: 1, userColors: 1 }
  });
});

test('Ver.261 audit: two tabs writing the same deterministic event id converge to one server record', async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  const [prodA, prodB] = await Promise.all([boot(a), boot(b)]);
  const eventId = 'reaction_task-v261_parent-v261_👍_福冨_11';
  const event = { taskId: 'task-v261', type: 'reaction', title: 'コメントにリアクションがありました', body: '福冨：👍', actor: '福冨', createdAt: 261000 };

  const results = await Promise.all([
    a.evaluate(({ id, item }) => window.WorkBoardWorkflowV152.writeInboxEvent('森井', id, item), { id: eventId, item: event }),
    b.evaluate(({ id, item }) => window.WorkBoardWorkflowV152.writeInboxEvent('森井', id, item), { id: eventId, item: event })
  ]);
  expect(results.every(result => result?.ok)).toBe(true);

  const stored = await readDb(`rooms/${ROOM}/workflowV152/inbox/森井`);
  expect(Object.keys(stored || {})).toEqual([eventId]);
  expect(stored[eventId]).toMatchObject({ taskId: 'task-v261', type: 'reaction', actor: '福冨' });
  expect(prodA).toEqual([]);
  expect(prodB).toEqual([]);
});
