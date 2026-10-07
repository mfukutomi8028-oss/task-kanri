import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-schedule-reminder-v361';

async function boot(page, suffix) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '土屋']));

    const NativeDate = Date;
    let syntheticNow = new NativeDate(2026, 9, 7, 10, 0, 0, 0).getTime();
    class ProductDate extends NativeDate {
      constructor(...args) {
        if (args.length === 0) super(syntheticNow);
        else super(...args);
      }
      static now() { return syntheticNow; }
    }
    window.Date = ProductDate;
    window.__v361Advance = ms => { syntheticNow += Number(ms || 0); };

    const start = new NativeDate(2026, 9, 7, 10, 20, 0, 0).toISOString();
    const end = new NativeDate(2026, 9, 7, 11, 20, 0, 0).toISOString();
    localStorage.setItem(`system-task-schedules:${room}`, JSON.stringify([{
      id: 'schedule-v361',
      title: 'Ver.361 reminder',
      startAt: start,
      endAt: end,
      assignee: '福冨',
      location: '会議室',
      category: 'その他',
      memo: ''
    }]));

    let syntheticHidden = false;
    try { Object.defineProperty(document, 'hidden', { configurable: true, get: () => syntheticHidden }); }
    catch { Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => syntheticHidden }); }

    const nativeSetInterval = window.setInterval.bind(window);
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    let fakeTimerId = 361000;
    const ownedTimers = new Map();
    window.__v361Intervals = [];

    window.setInterval = (callback, delay, ...args) => {
      const stack = String(new Error().stack || '');
      if (Number(delay) === 30000 && stack.includes('app.js')) {
        window.__v361Intervals.push({ delay: Number(delay), stack });
      }
      return nativeSetInterval(callback, delay, ...args);
    };

    window.setTimeout = (callback, delay, ...args) => {
      const stack = String(new Error().stack || '');
      if (
        Number(delay) !== 1200 &&
        stack.includes('app.js') &&
        String(callback).includes('syncScheduleReminderWatcher')
      ) {
        const id = ++fakeTimerId;
        ownedTimers.set(id, { callback, delay: Number(delay), active: true });
        return id;
      }
      return nativeSetTimeout(callback, delay, ...args);
    };

    window.clearTimeout = id => {
      const owned = ownedTimers.get(Number(id));
      if (owned) {
        owned.active = false;
        return;
      }
      return nativeClearTimeout(id);
    };

    window.__v361TimerState = () => ({
      intervals: window.__v361Intervals.length,
      activeTimers: [...ownedTimers.values()].filter(item => item.active).length,
      delays: [...ownedTimers.values()].filter(item => item.active).map(item => item.delay)
    });

    window.__v361FireTimer = () => {
      const entry = [...ownedTimers.values()].find(item => item.active);
      if (!entry) return false;
      entry.active = false;
      entry.callback();
      return true;
    };

    window.__v361SetHidden = value => {
      syntheticHidden = Boolean(value);
      document.dispatchEvent(new Event('visibilitychange'));
    };

    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
  }, { room });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.goto(`/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  return room;
}

const timerState = page => page.evaluate(() => window.__v361TimerState());

test('Ver.361 product replaces 30-second reminder polling with one next-boundary timeout', async ({ page }) => {
  await boot(page, 'ownership');
  await expect.poll(() => timerState(page)).toMatchObject({
    intervals: 0,
    activeTimers: 1
  });
  const state = await timerState(page);
  expect(state.delays[0]).toBe(5 * 60 * 1000);
});

test('Ver.361 reminder timeout remains armed while hidden and resume is idempotent', async ({ page }) => {
  await boot(page, 'background');
  await expect.poll(() => timerState(page)).toMatchObject({ activeTimers: 1 });

  await page.evaluate(() => window.__v361SetHidden(true));
  expect((await timerState(page)).activeTimers).toBe(1);

  await page.evaluate(() => window.__v361SetHidden(false));
  expect((await timerState(page)).activeTimers).toBe(1);

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect((await timerState(page)).activeTimers).toBe(1);

  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  expect((await timerState(page)).activeTimers).toBe(1);
});

test('Ver.361 timer fires at the 15-minute boundary, records dedup state, and retires when no next reminder exists', async ({ page }) => {
  const room = await boot(page, 'boundary');
  await expect.poll(() => timerState(page)).toMatchObject({ activeTimers: 1 });

  await page.evaluate(() => window.__v361Advance(5 * 60 * 1000));
  expect(await page.evaluate(() => window.__v361FireTimer())).toBe(true);

  await expect.poll(() => page.evaluate(room => {
    const seen = JSON.parse(localStorage.getItem(`system-task-schedule-reminders:${room}:福冨`) || '{}');
    return Object.keys(seen).some(key => key.startsWith('schedule-v361:'));
  }, room)).toBe(true);

  expect((await timerState(page)).activeTimers).toBe(0);
});
