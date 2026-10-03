import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);

const oldLifecycle = `function installScheduleTodayLifecycle() {
  const sync = () => syncScheduleTodayAnchor({ rerender: state.layout === "schedule" });
  sync();
  window.addEventListener("pageshow", sync);
  window.addEventListener("focus", sync);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) sync();
  });
  setInterval(sync, 60 * 1000);
}`;

const newLifecycle = `function installScheduleTodayLifecycle() {
  let dayBoundaryTimerV359 = 0;
  const sync = () => syncScheduleTodayAnchor({ rerender: state.layout === "schedule" });
  const clearDayBoundaryV359 = () => {
    if (!dayBoundaryTimerV359) return;
    clearTimeout(dayBoundaryTimerV359);
    dayBoundaryTimerV359 = 0;
  };
  const armDayBoundaryV359 = () => {
    clearDayBoundaryV359();
    if (document.hidden) return;
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const delay = Math.max(1, next.getTime() - now.getTime());
    dayBoundaryTimerV359 = setTimeout(() => {
      dayBoundaryTimerV359 = 0;
      sync();
      armDayBoundaryV359();
    }, delay);
  };
  const resumeDayBoundaryV359 = () => {
    sync();
    armDayBoundaryV359();
  };
  sync();
  armDayBoundaryV359();
  window.addEventListener("pageshow", resumeDayBoundaryV359);
  window.addEventListener("focus", resumeDayBoundaryV359);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearDayBoundaryV359();
    else resumeDayBoundaryV359();
  });
}`;

let app = read('app.js');
if (!app.includes(oldLifecycle)) throw new Error('Ver.359: current Schedule Today lifecycle not found exactly once');
if (app.split(oldLifecycle).length !== 2) throw new Error('Ver.359: Schedule Today lifecycle match is not unique');
app = app.replace(oldLifecycle, newLifecycle);
write('app.js', app);

const browserSpec = `import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-schedule-today-polling-v359';

async function boot(page, suffix) {
  const room = \`${'${ROOM_PREFIX}'}-${'${suffix}'}\`;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(\`system-task-users:${'${room}'}\`, JSON.stringify(['福冨', '土屋']));
    localStorage.setItem(\`system-task-schedule-range:${'${room}'}\`, 'today');
    localStorage.setItem(\`system-task-schedule-anchor:${'${room}'}\`, '2026-10-03');

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
    window.__v359Advance = ms => { syntheticNow += Number(ms || 0); };

    let syntheticHidden = false;
    try { Object.defineProperty(document, 'hidden', { configurable: true, get: () => syntheticHidden }); }
    catch { Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => syntheticHidden }); }

    const nativeSetInterval = window.setInterval.bind(window);
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    let fakeTimerId = 959000;
    const boundaryTimers = new Map();
    window.__v359ScheduleIntervals = [];

    window.setInterval = (callback, delay, ...args) => {
      const stack = String(new Error().stack || '');
      if (Number(delay) === 60000 && stack.includes('app.js')) window.__v359ScheduleIntervals.push({ delay: Number(delay), stack });
      return nativeSetInterval(callback, delay, ...args);
    };
    window.setTimeout = (callback, delay, ...args) => {
      if (String(callback).includes('armDayBoundaryV359')) {
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
    window.__v359TimerState = () => ({
      intervals: window.__v359ScheduleIntervals.length,
      activeBoundaryTimers: [...boundaryTimers.values()].filter(item => item.active).length,
      boundaryDelays: [...boundaryTimers.values()].filter(item => item.active).map(item => item.delay)
    });
    window.__v359FireBoundaryTimer = () => {
      const entry = [...boundaryTimers.values()].find(item => item.active);
      if (!entry) return false;
      entry.active = false;
      entry.callback();
      return true;
    };
    window.__v359SetHidden = value => {
      syntheticHidden = Boolean(value);
      document.dispatchEvent(new Event('visibilitychange'));
    };
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
  }, { room });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\\/\\/[^/]*(?:firebaseio\\.com|firebasedatabase\\.app)\\//i, route => route.abort('blockedbyclient'));
  await page.goto(\`/?room=${'${room}'}\`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  return room;
}

const timerState = page => page.evaluate(() => window.__v359TimerState());

test('Ver.359 product replaces Schedule Today 60-second polling with one day-boundary timer', async ({ page }) => {
  await boot(page, 'ownership');
  const state = await timerState(page);
  expect(state.intervals).toBe(0);
  expect(state.activeBoundaryTimers).toBe(1);
  expect(state.boundaryDelays[0]).toBe(30_000);
});

test('Ver.359 product releases the day-boundary timer while hidden and rearms idempotently on resume', async ({ page }) => {
  await boot(page, 'visibility');
  await page.evaluate(() => window.__v359SetHidden(true));
  expect((await timerState(page)).activeBoundaryTimers).toBe(0);
  await page.evaluate(() => window.__v359SetHidden(false));
  expect((await timerState(page)).activeBoundaryTimers).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect((await timerState(page)).activeBoundaryTimers).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  expect((await timerState(page)).activeBoundaryTimers).toBe(1);
});

test('Ver.359 product reconciles Today across midnight and rearms for the next day', async ({ page }) => {
  const room = await boot(page, 'midnight');
  await expect.poll(() => page.evaluate(room => localStorage.getItem(\`system-task-schedule-anchor:${'${room}'}\`), room)).toBe('2026-10-03');
  await page.evaluate(() => window.__v359Advance(61_000));
  expect(await page.evaluate(() => window.__v359FireBoundaryTimer())).toBe(true);
  await expect.poll(() => page.evaluate(room => localStorage.getItem(\`system-task-schedule-anchor:${'${room}'}\`), room)).toBe('2026-10-04');
  const state = await timerState(page);
  expect(state.activeBoundaryTimers).toBe(1);
  expect(state.boundaryDelays[0]).toBeGreaterThan(23 * 60 * 60 * 1000);
  expect(state.boundaryDelays[0]).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
});

test('Ver.359 product catches up a missed midnight immediately when returning visible', async ({ page }) => {
  const room = await boot(page, 'resume');
  await page.evaluate(() => window.__v359SetHidden(true));
  expect((await timerState(page)).activeBoundaryTimers).toBe(0);
  await page.evaluate(() => window.__v359Advance(61_000));
  expect(await page.evaluate(() => window.__v359FireBoundaryTimer())).toBe(false);
  await page.evaluate(() => window.__v359SetHidden(false));
  await expect.poll(() => page.evaluate(room => localStorage.getItem(\`system-task-schedule-anchor:${'${room}'}\`), room)).toBe('2026-10-04');
  expect((await timerState(page)).activeBoundaryTimers).toBe(1);
});
`;
write('tests/schedule-today-polling-audit-v358.spec.mjs', browserSpec);

const protocol = `import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(\`../${'${path}'}\`, import.meta.url), 'utf8');
const app = read('app.js');
const lock = read('schedule-today-lock-v129.js');
const manifest = read('release-manifest.js');
const v359Product = read('tests/schedule-today-polling-audit-v358.spec.mjs');

test('Ver.227 app exclusively owns Schedule Today anchor and movement semantics', () => {
  assert.match(app, /scheduleRange:\\s*localStorage\\.getItem\\(scheduleRangeKey\\(\\)\\)\\s*\\|\\|\\s*["']today["']/);
  assert.match(app, /scheduleAnchor:\\s*localStorage\\.getItem\\(scheduleAnchorKey\\(\\)\\)\\s*\\|\\|\\s*todayISO\\(\\)/);
  assert.match(app, /function syncScheduleTodayAnchor\\(/);
  assert.match(app, /if \\(state\\.scheduleRange !== "today"\\) return false/);
  assert.match(app, /state\\.scheduleAnchor = today/);
  assert.match(app, /localStorage\\.setItem\\(scheduleAnchorKey\\(\\), state\\.scheduleAnchor\\)/);
  assert.match(app, /function moveScheduleAnchor\\(direction\\)[\\s\\S]*state\\.scheduleRange === "today" && \\["prev", "next"\\]\\.includes\\(direction\\)/);
  assert.match(app, /data-schedule-move="prev"[^>]*disabled aria-disabled="true"/);
  assert.match(app, /data-schedule-move="next"[^>]*disabled aria-disabled="true"/);
});

test('Ver.359 app owns Today resume/day-boundary correction without a Schedule DOM observer or minute poll', () => {
  assert.match(app, /data-schedule-range="week" title="今日から7日間を表示します">7日間<\\/button>/);
  assert.match(app, /function installScheduleTodayLifecycle\\(\\)/);
  assert.match(app, /let dayBoundaryTimerV359 = 0/);
  assert.match(app, /next\\.setHours\\(24, 0, 0, 0\\)/);
  assert.match(app, /window\\.addEventListener\\("pageshow", resumeDayBoundaryV359\\)/);
  assert.match(app, /window\\.addEventListener\\("focus", resumeDayBoundaryV359\\)/);
  assert.match(app, /if \\(document\\.hidden\\) clearDayBoundaryV359\\(\\)/);
  assert.doesNotMatch(app, /setInterval\\(sync, 60 \\* 1000\\)/);
  assert.doesNotMatch(app, /new MutationObserver\\([^)]*schedule/i);
});

test('Ver.227 retires schedule-today-lock from active runtime while retaining the physical compatibility file', () => {
  const dynamicScriptsMatch = manifest.match(/dynamicScripts:\\s*\\[([\\s\\S]*?)\\]/);
  const requiredAssetsMatch = manifest.match(/requiredAssets:\\s*\\[([\\s\\S]*?)\\]/);
  assert.ok(dynamicScriptsMatch, 'dynamicScripts inventory must exist');
  assert.ok(requiredAssetsMatch, 'requiredAssets inventory must exist');
  assert.doesNotMatch(dynamicScriptsMatch[1], /schedule-today-lock-v129\\.js/);
  assert.doesNotMatch(requiredAssetsMatch[1], /schedule-today-lock-v129\\.js/);
  assert.ok(fs.existsSync(new URL('../schedule-today-lock-v129.js', import.meta.url)));
  assert.match(lock, /installScheduleTodayLockV129/);
});

test('Ver.359 promotes the audited day-boundary lifecycle into product runtime', () => {
  assert.doesNotMatch(app, /setInterval\\(sync, 60 \\* 1000\\)/);
  assert.match(v359Product, /Ver\\.359 product replaces Schedule Today 60-second polling/);
  assert.match(v359Product, /__v359TimerState/);
  assert.match(v359Product, /armDayBoundaryV359/);
  assert.doesNotMatch(v359Product, /CURRENT_LIFECYCLE|CANDIDATE_LIFECYCLE|source\\.replace/);
  assert.match(v359Product, /reconciles Today across midnight/);
  assert.match(v359Product, /catches up a missed midnight immediately when returning visible/);
  assert.equal(manifest.match(/version:\\s*["'](\\d+)["']/)?.[1], '294');
});
`;
write('test-harness/schedule-today-lock-ownership-v226.test.mjs', protocol);

let manifest = read('release-manifest.js');
if (!manifest.includes('293')) throw new Error('Ver.359: release 293 not found');
manifest = manifest.replaceAll('293', '294');
write('release-manifest.js', manifest);

let responsibilities = read('patch-responsibilities.json');
if (!responsibilities.includes('"baselineRelease": "293"')) throw new Error('Ver.359: baseline 293 not found');
responsibilities = responsibilities.replace('"baselineRelease": "293"', '"baselineRelease": "294"');
write('patch-responsibilities.json', responsibilities);

write('SCHEDULE_TODAY_POLLING_PRODUCT_V359.md', `# Ver.359 Schedule Today day-boundary lifecycle productization\n\n## Base\n- Ver.358 formal checkpoint: c1841b6c6fcdbbc75f9f2ab55a873543a2eafd12\n- Release / baseline: 293\n\n## Product change\n- Retire app.js Schedule Today 60-second polling.\n- While visible, own exactly one timeout aimed at the next local 00:00 boundary.\n- Clear the owned timeout while hidden.\n- On visible recovery, focus, and pageshow: reconcile Today immediately and idempotently re-arm one boundary timeout.\n- When the boundary timeout fires: reconcile the Today anchor and arm the next local day boundary.\n\n## Preserved behavior\n- app.js remains the exclusive Schedule Today anchor owner.\n- Today prev/next movement lock remains unchanged.\n- schedule rendering, schedule reminder watcher, Firebase/write paths, and schedule data semantics are unchanged.\n\n## Release\n- Release / baseline 293 -> 294.\n- Ver.358 route-only audit regression is promoted to direct product regression.\n`);

console.log('Ver.359 productization files updated');
