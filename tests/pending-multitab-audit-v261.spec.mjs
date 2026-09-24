import { test, expect } from '@playwright/test';

const ROOM = 'test-pending-multitab-v261';
const LEGACY_PENDING_KEY = `work-board-inbox-pending-v253:${ROOM}`;
const PENDING_PREFIX = `work-board-inbox-pending-v254:${ROOM}:`;

function pendingEntry(recipient, id, type = 'reaction') {
  return {
    recipient,
    id,
    event: { taskId: `task-${id}`, type, title: '監査通知', body: id, actor: '福冨', createdAt: Date.now() },
    queuedAt: Date.now()
  };
}

function pendingKey(recipient, id) {
  return JSON.stringify([recipient, id]);
}

async function installHarness(context) {
  await context.route('**/v261-seed', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body>seed</body></html>' }));
  await context.route('**/v261-harness*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><script src="/inbox-events-v183.js"></script></body></html>' }));
  await context.addInitScript(room => {
    if (!location.pathname.includes('v261-harness')) return;
    const tab = new URL(location.href).searchParams.get('tab') || 'A';
    window.__WB_V261_CALLS__ = [];
    window.WorkBoardWorkflowV152 = {
      ROOM_ID: room,
      users: () => ['福冨', '森井'],
      taskMap: () => new Map(),
      ensureRemote: async () => ({ db: {}, ref: (_db, path) => ({ path }), onValue: () => {} }),
      writeInboxEvent: async (recipient, id, event) => {
        window.__WB_V261_CALLS__.push({ tab, recipient, id, type: event?.type || '' });
        const ok = (tab === 'A' && id === 'event-a') || (tab === 'B' && id === 'event-b');
        await new Promise(resolve => setTimeout(resolve, id === 'event-a' ? 40 : 10));
        return { ok, simulated: ok ? '' : 'v261-complementary-failure' };
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

test('Ver.254 product: legacy aggregate migrates and complementary two-tab flush converges to empty', async ({ context }) => {
  await installHarness(context);
  const seed = await context.newPage();
  await seed.goto('/v261-seed');
  await seed.evaluate(({ key, entries }) => localStorage.setItem(key, JSON.stringify(entries)), {
    key: LEGACY_PENDING_KEY,
    entries: {
      [pendingKey('森井', 'event-a')]: pendingEntry('森井', 'event-a'),
      [pendingKey('森井', 'event-b')]: pendingEntry('森井', 'event-b', 'reply')
    }
  });

  const a = await context.newPage();
  const b = await context.newPage();
  await Promise.all([a.goto('/v261-harness?tab=A'), b.goto('/v261-harness?tab=B')]);
  await expect.poll(() => pendingIds(a), { timeout: 10_000 }).toEqual([]);
  expect(await a.evaluate(key => localStorage.getItem(key), LEGACY_PENDING_KEY)).toBeNull();

  const callsA = await a.evaluate(() => structuredClone(window.__WB_V261_CALLS__));
  const callsB = await b.evaluate(() => structuredClone(window.__WB_V261_CALLS__));
  expect(callsA.map(call => call.id)).toEqual(['event-a', 'event-b']);
  expect(callsB.map(call => call.id)).toEqual(['event-a', 'event-b']);
});

test('Ver.254 product: local-only successful fallback does not leave a remote pending residue', async ({ page }) => {
  let current = {
    t1: { id: 't1', title: 'local', assignee: '森井', status: '対応中', updatedBy: '森井', revision: 1, comments: [] }
  };
  await page.addInitScript(({ room, initial }) => {
    window.__WB_V261_LOCAL__ = structuredClone(initial);
    window.WorkBoardWorkflowV152 = {
      ROOM_ID: room,
      users: () => ['福冨', '森井'],
      taskMap: () => new Map(Object.entries(window.__WB_V261_LOCAL__)),
      ensureRemote: async () => null,
      writeInboxEvent: async () => ({ ok: true, localOnly: true })
    };
  }, { room: ROOM, initial: current });
  await page.route('**/v261-local', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><script src="/inbox-events-v183.js"></script></body></html>' }));
  await page.goto('/v261-local');
  await page.waitForTimeout(1700);
  await page.evaluate(() => {
    window.__WB_V261_LOCAL__.t1 = { ...window.__WB_V261_LOCAL__.t1, assignee: '福冨', updatedBy: '森井', revision: 2 };
  });
  await page.waitForTimeout(1800);
  expect(await pendingIds(page)).toEqual([]);
});
