import { test, expect } from '@playwright/test';

async function boot(page, suffix) {
  const room = 'test-personal-reminder-v363-' + suffix;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('system-task-users:' + room, JSON.stringify(['福冨', '土屋']));
    const NativeDate = Date;
    let now = new NativeDate(2026, 9, 8, 23, 59, 40, 0).getTime();
    class Clock extends NativeDate {
      constructor(...args) { if (!args.length) super(now); else super(...args); }
      static now() { return now; }
    }
    window.Date = Clock;
    window.__v363Advance = ms => { now += Number(ms || 0); };
    let hidden = false;
    try { Object.defineProperty(document, 'hidden', { configurable:true, get: () => hidden }); }
    catch { Object.defineProperty(Document.prototype, 'hidden', { configurable:true, get: () => hidden }); }
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    const nativeSetInterval = window.setInterval.bind(window);
    let nextId = 363000;
    const timers = new Map();
    const intervals = [];
    window.setInterval = (cb, delay, ...args) => {
      const stack = String(new Error().stack || '');
      if (stack.includes('reminders-v152.js')) intervals.push(Number(delay));
      return nativeSetInterval(cb, delay, ...args);
    };
    window.setTimeout = (cb, delay, ...args) => {
      const stack = String(new Error().stack || '');
      if (stack.includes('reminders-v152.js') && String(cb).includes('reminderTimeoutV363=0')) {
        const id = ++nextId;
        timers.set(id, {cb, delay:Number(delay), active:true});
        return id;
      }
      return nativeSetTimeout(cb, delay, ...args);
    };
    window.clearTimeout = id => {
      if (timers.has(Number(id))) {timers.get(Number(id)).active=false;return;}
      return nativeClearTimeout(id);
    };
    window.__v363State = () => ({
      intervals,
      active: [...timers.values()].filter(x => x.active).length,
      delays: [...timers.values()].filter(x => x.active).map(x => x.delay)
    });
    window.__v363Fire = () => {
      const timer = [...timers.values()].find(x => x.active);
      if (!timer) return false;
      timer.active=false;timer.cb();return true;
    };
    window.__v363Hidden = value => {
      hidden=Boolean(value);
      document.dispatchEvent(new Event('visibilitychange'));
    };
    Object.defineProperty(window, 'firebaseConfig', {configurable:true,get(){return null},set(){}});
  }, { room });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.goto('/?room=' + room, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, {timeout:30000});
}

const state = page => page.evaluate(() => window.__v363State());

test('Ver.363 owns one next-midnight personal-reminder timeout without 30-second polling', async ({page}) => {
  await boot(page, 'owner');
  await expect.poll(() => state(page)).toMatchObject({active:1,intervals:[]});
  expect((await state(page)).delays).toEqual([20000]);
});

test('Ver.363 keeps timer in background and re-arms once on visible/focus/pageshow', async ({page}) => {
  await boot(page, 'resume');
  await expect.poll(() => state(page)).toMatchObject({active:1});
  await page.evaluate(() => window.__v363Hidden(true));
  expect((await state(page)).active).toBe(1);
  await page.evaluate(() => window.__v363Hidden(false));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted:true})));
  expect((await state(page)).active).toBe(1);
});

test('Ver.363 wakes at midnight and schedules the following day without an interval', async ({page}) => {
  await boot(page, 'midnight');
  await expect.poll(() => state(page)).toMatchObject({active:1});
  await page.evaluate(() => window.__v363Advance(20000));
  expect(await page.evaluate(() => window.__v363Fire())).toBe(true);
  await expect.poll(() => state(page)).toMatchObject({active:1});
  const result = await state(page);
  expect(result.delays[0]).toBe(24 * 60 * 60 * 1000);
  expect(result.intervals).toEqual([]);
});
