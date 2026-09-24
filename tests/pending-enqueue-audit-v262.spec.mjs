import { test, expect } from '@playwright/test';

const ROOM = 'test-pending-enqueue-v262';
const PENDING_KEY = `work-board-inbox-pending-v253:${ROOM}`;

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
  return page.evaluate(key => {
    try {
      return Object.values(JSON.parse(localStorage.getItem(key) || '{}'))
        .map(item => item?.id || '').filter(Boolean).sort();
    } catch { return []; }
  }, PENDING_KEY);
}

test('Ver.262 audit: concurrent new enqueue from two tabs loses one pending event via localStorage read-modify-write', async ({ context }) => {
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

  const ids = await pendingIds(a);
  expect(ids).toHaveLength(1);
  expect(['assign_task-a_2', 'assign_task-b_2']).toContain(ids[0]);

  const calls = [
    ...(await a.evaluate(() => structuredClone(window.__WB_V262_CALLS__))),
    ...(await b.evaluate(() => structuredClone(window.__WB_V262_CALLS__)))
  ].map(call => call.eventId).sort();
  expect(calls).toEqual(['assign_task-a_2', 'assign_task-b_2']);
});
