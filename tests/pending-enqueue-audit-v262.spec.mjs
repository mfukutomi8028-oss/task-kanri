import { test, expect } from '@playwright/test';

const ROOM = 'test-pending-enqueue-v262';
const LEGACY_PENDING_KEY = `work-board-inbox-pending-v253:${ROOM}`;
const PENDING_PREFIX = `work-board-inbox-pending-v254:${ROOM}:`;

async function installHarness(context) {
  let waiting = [];
  await context.route('**/v262-barrier*', route => new Promise(resolve => {
    waiting.push({ route, resolve });
    if (waiting.length < 2) return;
    const release = waiting;
    waiting = [];
    Promise.all(release.map(item => item.route.fulfill({ status: 204 }).finally(item.resolve)));
  }));

  await context.route('**/v262-harness*', route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><html><body><script src="/inbox-events-v183.js"></script></body></html>'
  }));

  await context.addInitScript(room => {
    if (!location.pathname.includes('v262-harness')) return;
    const tab = new URL(location.href).searchParams.get('tab') || 'A';
    const id = tab === 'A' ? 'task-a' : 'task-b';
    const originalGet = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      if (key === `work-board-inbox-pending-v253:${room}` && window.__WB_V262_ARMED__) {
        const captured = originalGet.call(this, key);
        window.__WB_V262_ARMED__ = false;
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `/v262-barrier?tab=${encodeURIComponent(tab)}`, false);
        xhr.send();
        return captured;
      }
      return originalGet.call(this, key);
    };

    window.__WB_V262_TASK__ = {
      [id]: { id, title: id, assignee: '福冨', status: '対応中', updatedBy: '福冨', revision: 1, comments: [] }
    };
    window.__WB_V262_CALLS__ = [];
    window.WorkBoardWorkflowV152 = {
      ROOM_ID: room,
      users: () => ['福冨', '森井'],
      taskMap: () => new Map(Object.entries(window.__WB_V262_TASK__)),
      ensureRemote: async () => null,
      writeInboxEvent: async (recipient, eventId, event) => {
        window.__WB_V262_CALLS__.push({ recipient, eventId, taskId: event?.taskId || '' });
        return { ok: false, simulated: 'v262-enqueue-audit' };
      }
    };
  }, ROOM);
}

async function pendingIds(page) {
  return page.evaluate(({ prefix, legacyKey }) => {
    const ids = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      try {
        const item = JSON.parse(localStorage.getItem(key) || 'null');
        if (item?.id) ids.push(item.id);
      } catch {}
    }
    try {
      const legacy = JSON.parse(localStorage.getItem(legacyKey) || '{}');
      for (const item of Object.values(legacy || {})) if (item?.id) ids.push(item.id);
    } catch {}
    return [...new Set(ids)].sort();
  }, { prefix: PENDING_PREFIX, legacyKey: LEGACY_PENDING_KEY });
}

test('Ver.254 product: concurrent new enqueue from two tabs preserves both pending events', async ({ context }) => {
  test.slow();
  await installHarness(context);
  const a = await context.newPage();
  const b = await context.newPage();
  await Promise.all([a.goto('/v262-harness?tab=A'), b.goto('/v262-harness?tab=B')]);

  await a.waitForTimeout(1700);
  await b.waitForTimeout(1700);

  await Promise.all([
    a.evaluate(() => {
      window.__WB_V262_ARMED__ = true;
      window.__WB_V262_TASK__['task-a'] = { ...window.__WB_V262_TASK__['task-a'], assignee: '森井', updatedBy: '福冨', revision: 2 };
    }),
    b.evaluate(() => {
      window.__WB_V262_ARMED__ = true;
      window.__WB_V262_TASK__['task-b'] = { ...window.__WB_V262_TASK__['task-b'], assignee: '森井', updatedBy: '福冨', revision: 2 };
    })
  ]);

  await expect.poll(async () => {
    const counts = await Promise.all([
      a.evaluate(() => window.__WB_V262_CALLS__.length),
      b.evaluate(() => window.__WB_V262_CALLS__.length)
    ]);
    return counts;
  }, { timeout: 10_000 }).toEqual([1, 1]);

  await expect.poll(() => pendingIds(a), { timeout: 5_000 }).toEqual(['assign_task-a_2', 'assign_task-b_2']);
  expect(await a.evaluate(key => localStorage.getItem(key), LEGACY_PENDING_KEY)).toBeNull();

  const calls = [
    ...(await a.evaluate(() => structuredClone(window.__WB_V262_CALLS__))),
    ...(await b.evaluate(() => structuredClone(window.__WB_V262_CALLS__)))
  ].map(call => call.eventId).sort();
  expect(calls).toEqual(['assign_task-a_2', 'assign_task-b_2']);
});
