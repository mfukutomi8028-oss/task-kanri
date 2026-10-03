import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-insights-polling-v357-product';

function makeTask(id, title) {
  const now = Date.now();
  return {
    id,
    title,
    status: '未着手',
    assignee: '福冨',
    requester: '',
    category: 'その他',
    priority: '中',
    tags: [],
    description: '',
    checklist: [],
    recurrence: 'none',
    dueDate: '',
    dueTime: '',
    pinned: false,
    completedAt: 0,
    completedMemo: '',
    comments: [],
    history: [],
    revision: 1,
    createdBy: '福冨',
    createdAt: now - 10 * 60_000,
    updatedBy: '福冨',
    updatedAt: now - 2 * 60_000
  };
}

async function boot(page, suffix) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  const task = makeTask('insight-task', 'Ver.357 insights task');

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ room, task }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '土屋']));
    localStorage.setItem(`system-task-layout:${room}`, 'board');
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([task]));

    const nativeSetInterval = window.setInterval.bind(window);
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    const realNow = Date.now.bind(Date);
    let syntheticHidden = false;
    let fakeTimerId = 900000;
    let minuteFires = 0;
    const minuteTimers = new Map();

    window.__v356InsightIntervals = [];
    window.__v356NowOffset = 0;
    Date.now = () => realNow() + Number(window.__v356NowOffset || 0);

    try {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => syntheticHidden
      });
    } catch {
      Object.defineProperty(Document.prototype, 'hidden', {
        configurable: true,
        get: () => syntheticHidden
      });
    }

    window.setInterval = (callback, delay, ...args) => {
      const stack = String(new Error().stack || '');
      if (Number(delay) === 60000 && stack.includes('insights-v148.js')) {
        window.__v356InsightIntervals.push({ delay: Number(delay), stack });
      }
      return nativeSetInterval(callback, delay, ...args);
    };

    window.setTimeout = (callback, delay, ...args) => {
      if (String(callback).includes('armMinuteTimerV356')) {
        const id = ++fakeTimerId;
        minuteTimers.set(id, { callback, delay: Number(delay), active: true });
        return id;
      }
      return nativeSetTimeout(callback, delay, ...args);
    };

    window.clearTimeout = id => {
      const owned = minuteTimers.get(Number(id));
      if (owned) {
        owned.active = false;
        return;
      }
      return nativeClearTimeout(id);
    };

    window.__v356TimerState = () => ({
      intervals: window.__v356InsightIntervals.length,
      activeMinuteTimers: [...minuteTimers.values()].filter(item => item.active).length,
      minuteDelays: [...minuteTimers.values()].filter(item => item.active).map(item => item.delay),
      minuteFires
    });
    window.__v356FireMinuteTimer = () => {
      const entry = [...minuteTimers.values()].find(item => item.active);
      if (!entry) return false;
      entry.active = false;
      minuteFires += 1;
      entry.callback();
      return true;
    };
    window.__v356SetHidden = value => {
      syntheticHidden = Boolean(value);
      document.dispatchEvent(new Event('visibilitychange'));
    };

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room, task });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.locator('.nav-item[data-layout="tasks"]').click();
  await expect(page.locator('.task-card[data-task-id="insight-task"]')).toBeVisible();
  return { room };
}

async function timerState(page) {
  return page.evaluate(() => window.__v356TimerState());
}

async function openTask(page) {
  const card = page.locator('.task-card[data-task-id="insight-task"]');
  await card.evaluate(node => node.click());
  await expect(page.locator('#detailBody')).toContainText('Ver.357 insights task');
  await expect(page.locator('#detailBody .workflow-timing-cards-v148')).toBeVisible();
}

function updatedTiming(page) {
  return page.locator('#detailBody .workflow-timing-cards-v148 .field-card')
    .filter({ hasText: '最終更新から' })
    .locator('strong');
}

test('Ver.357 product owns no 60-second interval and exactly one visible minute timer', async ({ page }) => {
  await boot(page, 'owner');
  const state = await timerState(page);
  expect(state.intervals).toBe(0);
  expect(state.activeMinuteTimers).toBe(1);
  expect(state.minuteDelays[0]).toBeGreaterThan(0);
  expect(state.minuteDelays[0]).toBeLessThanOrEqual(60000);
});

test('Ver.357 product pauses minute ownership while hidden and restores one timer when visible', async ({ page }) => {
  await boot(page, 'lifecycle');

  let state = await timerState(page);
  expect(state.intervals).toBe(0);
  expect(state.activeMinuteTimers).toBe(1);

  await page.evaluate(() => window.__v356SetHidden(true));
  state = await timerState(page);
  expect(state.activeMinuteTimers).toBe(0);

  await page.evaluate(() => window.__v356SetHidden(false));
  state = await timerState(page);
  expect(state.activeMinuteTimers).toBe(1);

  await page.evaluate(() => window.__v356SetHidden(false));
  state = await timerState(page);
  expect(state.activeMinuteTimers).toBe(1);
});

test('Ver.357 product minute boundary refreshes detail timing and visibility recovery catches up', async ({ page }) => {
  await boot(page, 'refresh');
  await openTask(page);

  const timing = updatedTiming(page);
  const before = await timing.textContent();

  await page.evaluate(() => {
    window.__v356NowOffset += 61_000;
    if (!window.__v356FireMinuteTimer()) throw new Error('expected active Ver.357 minute timer');
  });
  await expect.poll(async () => timing.textContent()).not.toBe(before);
  let state = await timerState(page);
  expect(state.minuteFires).toBe(1);
  expect(state.activeMinuteTimers).toBe(1);

  await page.evaluate(() => window.__v356SetHidden(true));
  state = await timerState(page);
  expect(state.activeMinuteTimers).toBe(0);

  await page.evaluate(() => {
    window.__v356NowOffset += 61_000;
  });
  expect(await page.evaluate(() => window.__v356FireMinuteTimer())).toBe(false);
  state = await timerState(page);
  expect(state.activeMinuteTimers).toBe(0);
  expect(state.minuteFires).toBe(1);

  await page.evaluate(() => window.__v356SetHidden(false));
  state = await timerState(page);
  expect(state.activeMinuteTimers).toBe(1);
  expect(state.minuteFires).toBe(1);

  const expectedCurrent = await page.evaluate(() => {
    const room = localStorage.getItem('systemTaskRoomId') || '';
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    const task = tasks.find(item => String(item?.id || '') === 'insight-task');
    const minutes = Math.floor(Math.max(0, Date.now() - Number(task?.updatedAt || 0)) / 60000);
    return `${Math.max(1, minutes)}分前`;
  });
  await expect(timing).toHaveText(expectedCurrent);
});
