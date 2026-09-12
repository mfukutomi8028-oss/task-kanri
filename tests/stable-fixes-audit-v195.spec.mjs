import { test, expect } from '@playwright/test';

const ROOM = 'test-stable-fixes-audit-v195';

async function installLocalOnlyBoundary(page) {
  await page.addInitScript(({ room }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
    } catch {}

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installLocalOnlyBoundary(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
}

test('stable fixes applies date constraints to native controls inserted after boot', async ({ page }) => {
  await boot(page);

  await page.evaluate(() => {
    const host = document.createElement('section');
    host.id = 'stable-date-dynamic-v195';
    host.innerHTML = `
      <input id="dynamicDateV195" type="date">
      <input id="dynamicDateTimeV195" type="datetime-local">
    `;
    document.body.appendChild(host);
  });

  await expect.poll(() => page.locator('#dynamicDateV195').evaluate(node => Boolean(node.__stableDateV108))).toBe(true);
  await expect(page.locator('#dynamicDateV195')).toHaveAttribute('min', '1900-01-01');
  await expect(page.locator('#dynamicDateV195')).toHaveAttribute('max', '9999-12-31');
  await expect(page.locator('#dynamicDateV195')).toHaveAttribute('maxlength', '10');

  await expect.poll(() => page.locator('#dynamicDateTimeV195').evaluate(node => Boolean(node.__stableDateV108))).toBe(true);
  await expect(page.locator('#dynamicDateTimeV195')).toHaveAttribute('min', '1900-01-01T00:00');
  await expect(page.locator('#dynamicDateTimeV195')).toHaveAttribute('max', '9999-12-31T23:59');
});

test('stable fixes preserves Today status exclusions and mine/group assignee filtering', async ({ page }) => {
  await boot(page);

  await page.evaluate(({ room }) => {
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
      { id: 'hold', status: '保留', assignee: '福冨' },
      { id: 'waiting-spare', status: '確認待ち', assignee: '福冨' },
      { id: 'mine', status: '未着手', assignee: '福冨' },
      { id: 'group', status: '対応中', assignee: 'システム課' },
      { id: 'other', status: '未着手', assignee: '森井' }
    ]));
    localStorage.setItem(`system-task-schedules:${room}`, JSON.stringify([
      { id: 'schedule-group', assignee: '全員' },
      { id: 'schedule-other', assignee: '森井' }
    ]));

    const user = document.getElementById('currentUserSelect');
    if (user && [...user.options].some(option => option.value === '福冨')) user.value = '福冨';

    document.querySelectorAll('.nav-filter[data-filter="mine"]').forEach(node => node.classList.remove('active'));
    let mine = document.querySelector('.nav-filter[data-filter="mine"]');
    if (!mine) {
      mine = document.createElement('button');
      mine.className = 'nav-filter';
      mine.dataset.filter = 'mine';
      document.body.appendChild(mine);
    }
    mine.classList.add('active');

    const today = document.getElementById('todayView');
    today.hidden = false;
    const fixture = document.createElement('section');
    fixture.id = 'stable-today-fixture-v195';
    fixture.innerHTML = `
      <div class="today-panel"><h4>今日のタスク</h4><div>
        <article class="task-card" data-task-id="hold"></article>
        <article class="task-card" data-task-id="mine"></article>
        <article class="task-card" data-task-id="group"></article>
        <article class="task-card" data-task-id="other"></article>
        <article class="schedule-card" data-schedule-id="schedule-group"></article>
        <article class="schedule-card" data-schedule-id="schedule-other"></article>
      </div></div>
      <div class="today-panel"><h4>空き時間</h4><div>
        <article class="task-card" data-task-id="waiting-spare"></article>
      </div></div>
    `;
    today.appendChild(fixture);
  }, { room: ROOM });

  await expect(page.locator('[data-task-id="hold"]')).toBeHidden();
  await expect(page.locator('[data-task-id="waiting-spare"]')).toBeHidden();
  await expect(page.locator('[data-task-id="mine"]')).toBeVisible();
  await expect(page.locator('[data-task-id="group"]')).toBeVisible();
  await expect(page.locator('[data-task-id="other"]')).toBeHidden();
  await expect(page.locator('[data-schedule-id="schedule-group"]')).toBeVisible();
  await expect(page.locator('[data-schedule-id="schedule-other"]')).toBeHidden();

  await expect(page.locator('[data-task-id="other"]')).toHaveAttribute('data-v108-hidden', '');
  await expect(page.locator('[data-schedule-id="schedule-other"]')).toHaveAttribute('data-v108-hidden', '');
});

test('stable mobile status scrollIntoView moves only the horizontal status row', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await boot(page);

  const result = await page.evaluate(async () => {
    const row = document.createElement('div');
    row.id = 'stable-status-row-v195';
    row.className = 'work-mobile-status-tabs';
    const button = document.createElement('button');
    button.id = 'stable-status-button-v195';
    button.className = 'work-mobile-status-tab';
    row.appendChild(button);
    document.body.appendChild(row);

    Object.defineProperty(row, 'clientWidth', { configurable: true, value: 200 });
    Object.defineProperty(button, 'offsetLeft', { configurable: true, value: 300 });
    Object.defineProperty(button, 'offsetWidth', { configurable: true, value: 40 });
    row.scrollLeft = 0;

    const started = performance.now();
    while (!button.__stableScrollIntoViewV108 && performance.now() - started < 3000) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }

    window.scrollTo(0, 0);
    button.scrollIntoView();
    return {
      patched: Boolean(button.__stableScrollIntoViewV108),
      rowScrollLeft: row.scrollLeft,
      pageScrollY: window.scrollY
    };
  });

  expect(result.patched).toBe(true);
  expect(result.rowScrollLeft).toBe(220);
  expect(result.pageScrollY).toBe(0);
});
