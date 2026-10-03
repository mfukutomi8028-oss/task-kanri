import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-schedule-today-polling-v358';
const CURRENT_LIFECYCLE = `function installScheduleTodayLifecycle() {
  const sync = () => syncScheduleTodayAnchor({ rerender: state.layout === "schedule" });
  sync();
  window.addEventListener("pageshow", sync);
  window.addEventListener("focus", sync);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) sync();
  });
  setInterval(sync, 60 * 1000);
}`;

const CANDIDATE_LIFECYCLE = `function installScheduleTodayLifecycle() {
  let dayBoundaryTimerV358 = 0;
  const sync = () => syncScheduleTodayAnchor({ rerender: state.layout === "schedule" });
  const clearDayBoundaryV358 = () => {
    if (!dayBoundaryTimerV358) return;
    clearTimeout(dayBoundaryTimerV358);
    dayBoundaryTimerV358 = 0;
  };
  const armDayBoundaryV358 = () => {
    clearDayBoundaryV358();
    if (document.hidden) return;
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const delay = Math.max(1, next.getTime() - now.getTime());
    dayBoundaryTimerV358 = setTimeout(() => {
      dayBoundaryTimerV358 = 0;
      sync();
      armDayBoundaryV358();
    }, delay);
  };
  const resumeDayBoundaryV358 = () => {
    sync();
    armDayBoundaryV358();
  };
  sync();
  armDayBoundaryV358();
  window.addEventListener("pageshow", resumeDayBoundaryV358);
  window.addEventListener("focus", resumeDayBoundaryV358);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearDayBoundaryV358();
    else resumeDayBoundaryV358();
  });
}`;

async function boot(page, suffix) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '土屋']));
    localStorage.setItem(`system-task-schedule-range:${room}`, 'today');
    localStorage.setItem(`system-task-schedule-anchor:${room}`, '2026-10-03');

    const NativeDate = Date;
    let syntheticNow = new NativeDate(2026, 9, 3, 23, 59, 30, 0).getTime();
    class AuditDate extends NativeDate {
      constructor(...args) {
        if (args.length === 0) super(syntheticNow);
        else super(...args);
      }
      static now() { return syntheticNow; }
    }
    window.Date = AuditDate;
    window.__v358Advance = ms => { syntheticNow += Number(ms || 0); };

    let syntheticHidden = false;
    try { Object.defineProperty(document, 'hidden', { configurable: true, get: () => syntheticHidden }); }
    catch { Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => syntheticHidden }); }

    const nativeSetInterval = window.setInterval.bind(window);
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    let fakeTimerId = 958000;
    const boundaryTimers = new Map();
    window.__v358ScheduleIntervals = [];

    window.setInterval = (callback, delay, ...args) => {
      const stack = String(new Error().stack || '');
      if (Number(delay) === 60000 && stack.includes('app.js')) window.__v358ScheduleIntervals.push({ delay: Number(delay), stack });
      return nativeSetInterval(callback, delay, ...args);
    };
    window.setTimeout = (callback, delay, ...args) => {
      if (String(callback).includes('armDayBoundaryV358')) {
        const id = ++fakeTimerId;
        boundaryTimers.set(id, { callback, delay: Number(delay), active: true });
        return id;
      }
      return nativeSetTimeout(callback, delay, ...args);
    };
    window.clearTimeout = id => {
      const owned = boundaryTimers.get(Number(id));
      if (owned) { owned.active = false; return; }
      return nativeClearTimeout(id);
    };
    window.__v358TimerState = () => ({
      intervals: window.__v358ScheduleIntervals.length,
      activeBoundaryTimers: [...boundaryTimers.values()].filter(item => item.active).length,
      boundaryDelays: [...boundaryTimers.values()].filter(item => item.active).map(item => item.delay)
    });
    window.__v358FireBoundaryTimer = () => {
      const entry = [...boundaryTimers.values()].find(item => item.active);
      if (!entry) return false;
      entry.active = false;
      entry.callback();
      return true;
    };
    window.__v358SetHidden = value => {
      syntheticHidden = Boolean(value);
      document.dispatchEvent(new Event('visibilitychange'));
    };
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
  }, { room });

  await page.route(/\/app\.js(?:\?|$)/, async route => {
    const response = await route.fetch();
    const source = await response.text();
    if (!source.includes(CURRENT_LIFECYCLE)) throw new Error('Ver.358 audit could not locate current Schedule Today lifecycle');
    const body = source.replace(CURRENT_LIFECYCLE, CANDIDATE_LIFECYCLE);
    await route.fulfill({ response, contentType: 'application/javascript; charset=utf-8', body });
  });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.goto(`/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  return room;
}

const timerState = page => page.evaluate(() => window.__v358TimerState());

test('Ver.358 audit candidate replaces Schedule Today 60-second polling with one day-boundary timer', async ({ page }) => {
  await boot(page, 'ownership');
  const state = await timerState(page);
  expect(state.intervals).toBe(0);
  expect(state.activeBoundaryTimers).toBe(1);
  expect(state.boundaryDelays[0]).toBe(30_000);
});

test('Ver.358 audit candidate releases the day-boundary timer while hidden and rearms idempotently on resume', async ({ page }) => {
  await boot(page, 'visibility');
  await page.evaluate(() => window.__v358SetHidden(true));
  expect((await timerState(page)).activeBoundaryTimers).toBe(0);
  await page.evaluate(() => window.__v358SetHidden(false));
  expect((await timerState(page)).activeBoundaryTimers).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect((await timerState(page)).activeBoundaryTimers).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  expect((await timerState(page)).activeBoundaryTimers).toBe(1);
});

test('Ver.358 audit candidate reconciles Today across midnight and rearms for the next day', async ({ page }) => {
  const room = await boot(page, 'midnight');
  await expect.poll(() => page.evaluate(room => localStorage.getItem(`system-task-schedule-anchor:${room}`), room)).toBe('2026-10-03');
  await page.evaluate(() => window.__v358Advance(61_000));
  expect(await page.evaluate(() => window.__v358FireBoundaryTimer())).toBe(true);
  await expect.poll(() => page.evaluate(room => localStorage.getItem(`system-task-schedule-anchor:${room}`), room)).toBe('2026-10-04');
  const state = await timerState(page);
  expect(state.activeBoundaryTimers).toBe(1);
  expect(state.boundaryDelays[0]).toBeGreaterThan(23 * 60 * 60 * 1000);
  expect(state.boundaryDelays[0]).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
});

test('Ver.358 audit candidate catches up a missed midnight immediately when returning visible', async ({ page }) => {
  const room = await boot(page, 'resume');
  await page.evaluate(() => window.__v358SetHidden(true));
  expect((await timerState(page)).activeBoundaryTimers).toBe(0);
  await page.evaluate(() => window.__v358Advance(61_000));
  expect(await page.evaluate(() => window.__v358FireBoundaryTimer())).toBe(false);
  await page.evaluate(() => window.__v358SetHidden(false));
  await expect.poll(() => page.evaluate(room => localStorage.getItem(`system-task-schedule-anchor:${room}`), room)).toBe('2026-10-04');
  expect((await timerState(page)).activeBoundaryTimers).toBe(1);
});
