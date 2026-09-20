import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-workflow-v148-audit-v248';
const HOST = '127.0.0.1';
const PORT = 9000;
const PROD_DATABASE_RE = /https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i;

test.skip(process.env.WORK_BOARD_FIREBASE_E2E !== '1', 'requires the isolated RTDB emulator');
test.describe.configure({ mode: 'serial' });

function emulatorUrl(path = '') {
  const encoded = String(path || '')
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');
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

async function installEmulatorBoundary(page) {
  const productionRequests = [];
  await page.addInitScript(({ project, room, host, port }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
    } catch {}
    const demoConfig = Object.freeze({
      apiKey: 'demo-api-key',
      authDomain: `${project}.firebaseapp.com`,
      databaseURL: `http://${host}:${port}/?ns=${project}`,
      projectId: project,
      appId: '1:000000000000:web:firebase-emulator-only'
    });
    window.WORK_BOARD_TEST = Object.freeze({ emulator: true, host, port });
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return demoConfig; },
      set() {}
    });
  }, { project: PROJECT, room: ROOM, host: HOST, port: PORT });

  await page.route(PROD_DATABASE_RE, route => {
    productionRequests.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  page.on('request', request => {
    if (PROD_DATABASE_RE.test(request.url())) productionRequests.push(request.url());
  });
  return productionRequests;
}

async function boot(page) {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const productionRequests = await installEmulatorBoundary(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV150?.dependencyState?.() === 'ready', undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.WorkBoardWorkflowV152?.v152State === 'ready', undefined, { timeout: 30_000 });
  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);
}

async function waitFor(page, predicate, arg) {
  await page.waitForFunction(predicate, arg, { timeout: 15_000 });
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('Ver.248 audit: stale dependency edit overwrites a newer remote dependency', async ({ page }) => {
  const taskId = 'dependency-root-v248';
  const path = `rooms/${ROOM}/workflowV148/dependencies/${taskId}`;
  await putDb(path, { 'dep-base-v248': true });
  await boot(page);
  await waitFor(page, id => window.WorkBoardWorkflowV150.depIds(id).includes('dep-base-v248'), taskId);

  const remoteWinner = { 'dep-base-v248': true, 'dep-remote-v248': true };
  await putDb(path, remoteWinner);
  await waitFor(page, id => window.WorkBoardWorkflowV150.depIds(id).includes('dep-remote-v248'), taskId);

  const result = await page.evaluate(id => window.WorkBoardWorkflowV150.writeDependencies(id, ['dep-base-v248', 'dep-client-v248']), taskId);
  expect(result?.ok).toBe(true);

  // Audit evidence: the stale caller list is treated as authoritative and drops the remote addition.
  expect(await readDb(path)).toEqual({ 'dep-base-v248': true, 'dep-client-v248': true });
});

test('Ver.248 audit: stale saved view can replace a newer server view despite older updatedAt', async ({ page }) => {
  const viewId = 'saved-view-v248';
  const path = `rooms/${ROOM}/workflowV148/savedViews/${viewId}`;
  const initial = { taskLayout: 'board', columnSort: null, updatedAt: 1000 };
  await putDb(path, initial);
  await boot(page);
  await waitFor(page, id => window.WorkBoardWorkflowV150.workflow.savedViews?.[id]?.updatedAt === 1000, viewId);

  const remoteWinner = { taskLayout: 'timeline', columnSort: { key: 'updatedAt', direction: 'desc' }, updatedAt: 9000 };
  await putDb(path, remoteWinner);
  await waitFor(page, id => window.WorkBoardWorkflowV150.workflow.savedViews?.[id]?.updatedAt === 9000, viewId);

  const staleView = { taskLayout: 'list', columnSort: { key: 'title', direction: 'asc' }, updatedAt: 2000 };
  await page.evaluate(({ id, view }) => window.WorkBoardWorkflowV150.writeSavedView(id, view), { id: viewId, view: staleView });

  // Audit evidence: updatedAt is metadata only; the older view still becomes the server winner.
  await expect.poll(() => readDb(path)).toEqual(staleView);
});

test('Ver.248 audit: stale relation edit removes a newer remote peer while preserving its own additions', async ({ page }) => {
  const root = 'relation-root-v248';
  const base = 'relation-base-v248';
  const remote = 'relation-remote-v248';
  const client = 'relation-client-v248';
  const path = `rooms/${ROOM}/workflowV148/relations`;

  await putDb(path, {
    [root]: { [base]: true },
    [base]: { [root]: true }
  });
  await boot(page);
  await waitFor(page, id => window.WorkBoardWorkflowV150.relationIds(id).includes('relation-base-v248'), root);

  await putDb(path, {
    [root]: { [base]: true, [remote]: true },
    [base]: { [root]: true },
    [remote]: { [root]: true }
  });
  await waitFor(page, id => window.WorkBoardWorkflowV150.relationIds(id).includes('relation-remote-v248'), root);

  const result = await page.evaluate(({ rootId, baseId, clientId }) => window.WorkBoardWorkflowV150.writeRelations(rootId, [baseId, clientId]), {
    rootId: root,
    baseId: base,
    clientId: client
  });
  expect(result?.ok).toBe(true);

  // Audit evidence: a newer remote relation disappears because the stale caller set is authoritative.
  expect(await readDb(path)).toEqual({
    [root]: { [base]: true, [client]: true },
    [base]: { [root]: true },
    [client]: { [root]: true }
  });
});

test('Ver.248 audit: relation writer does not repair a reverse-only orphan edge', async ({ page }) => {
  const root = 'relation-orphan-root-v248';
  const peer = 'relation-orphan-peer-v248';
  const path = `rooms/${ROOM}/workflowV148/relations`;

  await putDb(path, { [peer]: { [root]: true } });
  await boot(page);
  await waitFor(page, id => window.WorkBoardWorkflowV150.relationIds(id).includes('relation-orphan-root-v248'), peer);
  expect(await page.evaluate(id => window.WorkBoardWorkflowV150.relationIds(id), root)).toEqual([]);

  const result = await page.evaluate(id => window.WorkBoardWorkflowV150.writeRelations(id, []), root);
  expect(result?.ok).toBe(true);

  // Audit evidence: reverse-only state survives because peers absent from root's current map are never visited.
  expect(await readDb(path)).toEqual({ [peer]: { [root]: true } });
});
