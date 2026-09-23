import { test, expect } from '@playwright/test';

const ROOM = 'test-comment-notification-reconnect-v260';

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
  await page.addInitScript(({ room }) => {
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
        window.__WB_V260_CALLS__.push({ recipient, id, type: event?.type || '' });
        return { ok: false, simulated: 'v260-observer-delivery-failure' };
      }
    };
  }, { room: ROOM });
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

test('observer delivery failure is not retried from the same snapshot or reconstructed after reconnect', async ({ page }) => {
  await installHarness(page);
  const before = taskRecord();
  const after = structuredClone(before);
  after.revision = 11;
  after.updatedAt = 2000;
  after.updatedBy = '福冨';
  after.comments[0].reactions = { '👍': ['福冨'] };

  await page.goto('/v260-observer-harness');
  await page.waitForFunction(() => typeof window.__WB_V260_ONVALUE__ === 'function');
  await feed(page, { [before.id]: before });
  await feed(page, { [after.id]: after });

  await expect.poll(() => page.evaluate(() => window.__WB_V260_CALLS__.length)).toBe(1);
  let calls = await page.evaluate(() => structuredClone(window.__WB_V260_CALLS__));
  expect(calls[0].id).toBe('reaction_task-v260-browser_parent-v260_👍_福冨_11');

  await feed(page, { [after.id]: after });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__WB_V260_CALLS__.length)).toBe(1);

  await page.reload();
  await page.waitForFunction(() => typeof window.__WB_V260_ONVALUE__ === 'function');
  await feed(page, { [after.id]: after });
  await page.waitForTimeout(100);
  calls = await page.evaluate(() => structuredClone(window.__WB_V260_CALLS__));
  expect(calls).toEqual([]);
});
