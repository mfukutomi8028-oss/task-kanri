import { test, expect } from '@playwright/test';

const ROOM = 'test-pending-cross-tab-v263';
const LEGACY_KEY = `work-board-inbox-pending-v253:${ROOM}`;
const PREFIX = `work-board-inbox-pending-v254:${ROOM}:`;

function event(recipient, id, body, queuedAt) {
  return {
    recipient,
    id,
    event: { taskId: `task-${id}`, type: 'reaction', title: '監査通知', body, actor: '福冨', createdAt: queuedAt },
    queuedAt
  };
}
function eventKey(recipient, id) {
  return `${PREFIX}${encodeURIComponent(JSON.stringify([recipient, id]))}`;
}
function legacyMap(entries) {
  return Object.fromEntries(entries.map(entry => [JSON.stringify([entry.recipient, entry.id]), entry]));
}

async function installHarness(context) {
  let waiting = [];
  await context.route('**/v263-migration-barrier*', route => new Promise(resolve => {
    waiting.push({ route, resolve });
    if (waiting.length < 2) return;
    const release = waiting;
    waiting = [];
    Promise.all(release.map(item => item.route.fulfill({ status: 204 }).finally(item.resolve)));
  }));
  await context.route('**/v263-seed', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body>seed</body></html>' }));
  await context.route('**/v263-harness*', route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><html><body><script src="/inbox-events-v183.js"></script></body></html>'
  }));
  await context.addInitScript(room => {
    if (!location.pathname.includes('v263-harness')) return;
    const tab = new URL(location.href).searchParams.get('tab') || 'A';
    const originalGet = Storage.prototype.getItem;
    let armed = true;
    Storage.prototype.getItem = function(key) {
      if (armed && key === `work-board-inbox-pending-v253:${room}`) {
        armed = false;
        const captured = originalGet.call(this, key);
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `/v263-migration-barrier?tab=${encodeURIComponent(tab)}`, false);
        xhr.send();
        return captured;
      }
      return originalGet.call(this, key);
    };
    window.__WB_V263_CALLS__ = [];
    window.WorkBoardWorkflowV152 = {
      ROOM_ID: room,
      users: () => ['福冨', '森井'],
      taskMap: () => new Map(),
      ensureRemote: async () => ({ db: {}, ref: (_db, path) => ({ path }), onValue: () => {} }),
      writeInboxEvent: async (recipient, id, item) => {
        window.__WB_V263_CALLS__.push({ tab, recipient, id, body: item?.body || '' });
        return { ok: false, simulated: 'keep-pending-for-audit' };
      }
    };
  }, ROOM);
}

async function storedEntries(page) {
  return page.evaluate(prefix => {
    const out = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        if (value?.id) out[value.id] = value;
      } catch {}
    }
    return out;
  }, PREFIX);
}

test('Ver.263 audit: two-tab legacy migration preserves all events and never overwrites an existing per-event winner', async ({ context }) => {
  test.slow();
  await installHarness(context);
  const seed = await context.newPage();
  await seed.goto('/v263-seed');

  const now = Date.now();
  const legacyA = event('森井', 'event-a', 'legacy-a', now - 3000);
  const legacyB = event('森井', 'event-b', 'legacy-b', now - 2000);
  const currentA = event('森井', 'event-a', 'current-v254-a', now - 1000);
  await seed.evaluate(({ legacyKey, legacy, currentKey, current }) => {
    localStorage.setItem(legacyKey, JSON.stringify(legacy));
    localStorage.setItem(currentKey, JSON.stringify(current));
  }, {
    legacyKey: LEGACY_KEY,
    legacy: legacyMap([legacyA, legacyB]),
    currentKey: eventKey('森井', 'event-a'),
    current: currentA
  });

  const a = await context.newPage();
  const b = await context.newPage();
  await Promise.all([a.goto('/v263-harness?tab=A'), b.goto('/v263-harness?tab=B')]);

  await expect.poll(() => a.evaluate(key => localStorage.getItem(key), LEGACY_KEY), { timeout: 10_000 }).toBeNull();
  await expect.poll(async () => Object.keys(await storedEntries(a)).sort(), { timeout: 10_000 }).toEqual(['event-a', 'event-b']);

  const entries = await storedEntries(a);
  expect(entries['event-a'].event.body).toBe('current-v254-a');
  expect(entries['event-a'].queuedAt).toBe(currentA.queuedAt);
  expect(entries['event-b'].event.body).toBe('legacy-b');
  expect(entries['event-b'].queuedAt).toBe(legacyB.queuedAt);

  const calls = [
    ...(await a.evaluate(() => structuredClone(window.__WB_V263_CALLS__))),
    ...(await b.evaluate(() => structuredClone(window.__WB_V263_CALLS__)))
  ];
  expect(calls.filter(call => call.id === 'event-a').every(call => call.body === 'current-v254-a')).toBe(true);
});
