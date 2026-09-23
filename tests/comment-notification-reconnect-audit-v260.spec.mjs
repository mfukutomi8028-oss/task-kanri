import { test, expect } from '@playwright/test';

const ROOM = 'test-comment-notification-reconnect-v260';
const PENDING_KEY = `work-board-inbox-pending-v253:${ROOM}`;
const ATTEMPT_KEY = `v260-delivery-attempts:${ROOM}`;

function taskRecord() {
  return {
    id: 'task-v260-browser', title: 'Ver.260 observer reconnect audit', description: '', requester: '', assignee: '福冨',
    status: '対応中', priority: '中', category: 'その他', tags: [], dueDate: '', dueTime: '', pinned: false, checklist: [],
    comments: [{ id: 'parent-v260', author: '森井', type: '作業メモ', text: 'reconnect parent', createdAt: 1000 }],
    history: [], recurrence: 'none', recurrenceRule: {}, createdAt: 100, createdBy: '森井',
    updatedAt: 1000, updatedBy: '森井', completedAt: 0, completedMemo: '', revision: 10
  };
}

async function installHarness(page) {
  await page.addInitScript(({ room, attemptKey }) => {
    window.__WB_V260_CALLS__ = [];
    window.__WB_V260_ONVALUE__ = null;
    window.WorkBoardWorkflowV152 = {
      ROOM_ID: room,
      users: () => ['福冨', '森井'],
      taskMap: () => new Map(),
      ensureRemote: async () => ({
        db: {},
        ref: (_db, path) => ({ path }),
        onValue: (_target, next) => { window.__WB_V260_ONVALUE__ = next; }
      }),
      writeInboxEvent: async (recipient, id, event) => {
        const attempts = Number(localStorage.getItem(attemptKey) || 0) + 1;
        localStorage.setItem(attemptKey, String(attempts));
        window.__WB_V260_CALLS__.push({ recipient, id, type: event?.type || '', attempts });
        return { ok: attempts >= 3, simulated: attempts < 3 ? 'v260-transient-delivery-failure' : '' };
      }
    };
  }, { room: ROOM, attemptKey: ATTEMPT_KEY });
  await page.route('**/v260-observer-harness', route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><html><body><script src="/inbox-events-v183.js"></script></body></html>'
  }));
}

async function feed(page, value) {
  await page.evaluate(snapshot => {
    if (typeof window.__WB_V260_ONVALUE__ !== 'function') throw new Error('v260-onValue-missing');
    window.__WB_V260_ONVALUE__({ val: () => structuredClone(snapshot) });
  }, value);
}

async function pendingEntries(page) {
  return page.evaluate(key => {
    try { return Object.values(JSON.parse(localStorage.getItem(key) || '{}')); }
    catch { return []; }
  }, PENDING_KEY);
}

test('failed observer delivery stays durable and reload flushes the same deterministic event id once', async ({ page }) => {
  await installHarness(page);
  const before = taskRecord();
  const after = structuredClone(before);
  after.revision = 11;
  after.updatedAt = 2000;
  after.updatedBy = '福冨';
  after.comments[0].reactions = { '👍': ['福冨'] };
  const eventId = 'reaction_task-v260-browser_parent-v260_👍_福冨_11';

  await page.goto('/v260-observer-harness');
  await page.waitForFunction(() => typeof window.__WB_V260_ONVALUE__ === 'function');
  await feed(page, { [before.id]: before });
  await feed(page, { [after.id]: after });

  await expect.poll(() => page.evaluate(() => window.__WB_V260_CALLS__.length)).toBe(1);
  let pending = await pendingEntries(page);
  expect(pending).toHaveLength(1);
  expect(pending[0].id).toBe(eventId);

  // A repeated current snapshot represents the reconnect path. The pending retry fails once more,
  // but the same event stays durable instead of depending on the already-advanced snapshot baseline.
  await feed(page, { [after.id]: after });
  await expect.poll(() => page.evaluate(() => window.__WB_V260_CALLS__.length)).toBe(2);
  pending = await pendingEntries(page);
  expect(pending).toHaveLength(1);
  expect(pending[0].id).toBe(eventId);

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__WB_V260_CALLS__.length)).toBe(1);
  const calls = await page.evaluate(() => structuredClone(window.__WB_V260_CALLS__));
  expect(calls[0]).toMatchObject({ recipient: '森井', id: eventId, type: 'reaction', attempts: 3 });
  expect(await pendingEntries(page)).toEqual([]);

  await page.waitForFunction(() => typeof window.__WB_V260_ONVALUE__ === 'function');
  await feed(page, { [after.id]: after });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__WB_V260_CALLS__.length)).toBe(1);
});
