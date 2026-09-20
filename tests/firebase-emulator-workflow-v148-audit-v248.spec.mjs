import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-workflow-v148-audit-v248';
const HOST = '127.0.0.1';
const PORT = 9000;
const PROD_DATABASE_RE = /https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i;

test.skip(process.env.WORK_BOARD_FIREBASE_E2E !== '1', 'requires the isolated RTDB emulator');
test.describe.configure({ mode: 'serial' });

function emulatorUrl(path = '') { const encoded = String(path || '').split('/').filter(Boolean).map(segment => encodeURIComponent(segment)).join('/'); return `http://${HOST}:${PORT}/${encoded ? `${encoded}.json` : '.json'}?ns=${encodeURIComponent(PROJECT)}`; }
async function emulatorRequest(path, { method = 'GET', value } = {}) { const response = await fetch(emulatorUrl(path), { method, headers: value === undefined ? undefined : { 'content-type': 'application/json' }, body: value === undefined ? undefined : JSON.stringify(value) }); const text = await response.text(); if (!response.ok) throw new Error(`${method} ${path || '/'} failed: ${response.status} ${text}`); return text ? JSON.parse(text) : null; }
const readDb = path => emulatorRequest(path);
const putDb = (path, value) => emulatorRequest(path, { method: 'PUT', value });
const deleteDb = path => emulatorRequest(path, { method: 'DELETE' });

async function installEmulatorBoundary(page) {
  const productionRequests = [];
  await page.addInitScript(({ project, room, host, port }) => {
    try { localStorage.clear(); localStorage.setItem('systemTaskUser', '福冨'); localStorage.setItem('systemTaskRoomId', room); } catch {}
    const demoConfig = Object.freeze({ apiKey: 'demo-api-key', authDomain: `${project}.firebaseapp.com`, databaseURL: `http://${host}:${port}/?ns=${project}`, projectId: project, appId: '1:000000000000:web:firebase-emulator-only' });
    window.WORK_BOARD_TEST = Object.freeze({ emulator: true, host, port });
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return demoConfig; }, set() {} });
  }, { project: PROJECT, room: ROOM, host: HOST, port: PORT });
  await page.route(PROD_DATABASE_RE, route => { productionRequests.push(route.request().url()); return route.abort('blockedbyclient'); });
  page.on('request', request => { if (PROD_DATABASE_RE.test(request.url())) productionRequests.push(request.url()); });
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
async function waitFor(page, predicate, arg) { await page.waitForFunction(predicate, arg, { timeout: 15_000 }); }
test.beforeEach(async () => { await deleteDb(`rooms/${ROOM}`); });

test('Ver.248 product: stale dependency edit preserves the remote winner and fresh base can commit', async ({ page }) => {
  const taskId = 'dependency-root-v248';
  const path = `rooms/${ROOM}/workflowV148/dependencies/${taskId}`;
  const initial = { 'dep-base-v248': true };
  await putDb(path, initial);
  await boot(page);
  await waitFor(page, id => window.WorkBoardWorkflowV150.depIds(id).includes('dep-base-v248'), taskId);
  const remoteWinner = { 'dep-base-v248': true, 'dep-remote-v248': true };
  await putDb(path, remoteWinner);
  await waitFor(page, id => window.WorkBoardWorkflowV150.depIds(id).includes('dep-remote-v248'), taskId);

  const stale = await page.evaluate(({ id, expected }) => window.WorkBoardWorkflowV150.writeDependencies(id, ['dep-base-v248', 'dep-client-v248'], expected), { id: taskId, expected: ['dep-base-v248'] });
  expect(stale).toMatchObject({ ok: false, conflict: true });
  expect(await readDb(path)).toEqual(remoteWinner);

  const fresh = await page.evaluate(id => window.WorkBoardWorkflowV150.writeDependencies(id, ['dep-base-v248', 'dep-remote-v248', 'dep-client-v248'], ['dep-base-v248', 'dep-remote-v248']), taskId);
  expect(fresh?.ok).toBe(true);
  expect(await readDb(path)).toEqual({ 'dep-base-v248': true, 'dep-client-v248': true, 'dep-remote-v248': true });
});

test('Ver.248 product: stale saved view preserves newer server metadata and fresh base can commit', async ({ page }) => {
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

  const stale = await page.evaluate(({ id, view, expected }) => window.WorkBoardWorkflowV150.writeSavedView(id, view, expected), { id: viewId, view: staleView, expected: initial });
  expect(stale).toMatchObject({ ok: false, conflict: true });
  expect(await readDb(path)).toEqual(remoteWinner);

  const freshView = { taskLayout: 'list', columnSort: { key: 'title', direction: 'asc' }, updatedAt: 10000 };
  const fresh = await page.evaluate(({ id, view, expected }) => window.WorkBoardWorkflowV150.writeSavedView(id, view, expected), { id: viewId, view: freshView, expected: remoteWinner });
  expect(fresh?.ok).toBe(true);
  expect(await readDb(path)).toEqual(freshView);
});

test('Ver.248 product: stale relation edit preserves newer peer and fresh base commits symmetrically', async ({ page }) => {
  const root = 'relation-root-v248', base = 'relation-base-v248', remote = 'relation-remote-v248', client = 'relation-client-v248';
  const path = `rooms/${ROOM}/workflowV148/relations`;
  await putDb(path, { [root]: { [base]: true }, [base]: { [root]: true } });
  await boot(page);
  await waitFor(page, id => window.WorkBoardWorkflowV150.relationIds(id).includes('relation-base-v248'), root);
  const remoteWinner = { [root]: { [base]: true, [remote]: true }, [base]: { [root]: true }, [remote]: { [root]: true } };
  await putDb(path, remoteWinner);
  await waitFor(page, id => window.WorkBoardWorkflowV150.relationIds(id).includes('relation-remote-v248'), root);

  const stale = await page.evaluate(({ rootId, baseId, clientId }) => window.WorkBoardWorkflowV150.writeRelations(rootId, [baseId, clientId], [baseId]), { rootId: root, baseId: base, clientId: client });
  expect(stale).toMatchObject({ ok: false, conflict: true });
  expect(await readDb(path)).toEqual(remoteWinner);

  const fresh = await page.evaluate(({ rootId, baseId, remoteId, clientId }) => window.WorkBoardWorkflowV150.writeRelations(rootId, [baseId, remoteId, clientId], [baseId, remoteId]), { rootId: root, baseId: base, remoteId: remote, clientId: client });
  expect(fresh?.ok).toBe(true);
  expect(await readDb(path)).toEqual({ [root]: { [base]: true, [client]: true, [remote]: true }, [base]: { [root]: true }, [remote]: { [root]: true }, [client]: { [root]: true } });
});

test('Ver.248 product: relation writer repairs a reverse-only orphan edge', async ({ page }) => {
  const root = 'relation-orphan-root-v248', peer = 'relation-orphan-peer-v248';
  const path = `rooms/${ROOM}/workflowV148/relations`;
  await putDb(path, { [peer]: { [root]: true } });
  await boot(page);
  await waitFor(page, id => window.WorkBoardWorkflowV150.relationIds(id).includes('relation-orphan-root-v248'), peer);
  expect(await page.evaluate(id => window.WorkBoardWorkflowV150.relationIds(id), root)).toEqual([]);
  const result = await page.evaluate(id => window.WorkBoardWorkflowV150.writeRelations(id, [], []), root);
  expect(result?.ok).toBe(true);
  expect(await readDb(path)).toBeNull();
});
