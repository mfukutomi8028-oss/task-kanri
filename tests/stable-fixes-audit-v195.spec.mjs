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

test('stable fixes marks Today status exclusions and mine/group assignee decisions', async ({ page }) => {
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

  for (const selector of [
    '[data-task-id="hold"]',
    '[data-task-id="waiting-spare"]',
    '[data-task-id="other"]',
    '[data-schedule-id="schedule-other"]'
  ]) {
    await expect(page.locator(selector)).toHaveAttribute('data-v108-hidden', '');
  }

  for (const selector of [
    '[data-task-id="mine"]',
    '[data-task-id="group"]',
    '[data-schedule-id="schedule-group"]'
  ]) {
    await expect(page.locator(selector)).not.toHaveAttribute('data-v108-hidden', '');
  }
});

test('stable no longer overrides mobile status-tab scrollIntoView', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await boot(page);

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect(page.locator('.work-mobile-status-tab').first()).toBeVisible();

  const result = await page.locator('.work-mobile-status-tab').first().evaluate(button => ({
    stableMarker: Boolean(button.__stableScrollIntoViewV108),
    ownScrollIntoView: Object.prototype.hasOwnProperty.call(button, 'scrollIntoView')
  }));

  expect(result.stableMarker).toBe(false);
  expect(result.ownScrollIntoView).toBe(false);
});

test('real mobile status-tab click uses mobile row scrolling without a stable override or moving the page', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await boot(page);

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect(page.locator('.work-mobile-status-tab').last()).toBeVisible();

  const result = await page.evaluate(() => {
    const row = document.querySelector('.work-mobile-status-tabs');
    const buttons = [...(row?.querySelectorAll('.work-mobile-status-tab') || [])];
    const board = document.querySelector('.board-view');
    const columns = [...(board?.querySelectorAll('.board-column') || [])];
    const button = buttons.at(-1);
    if (!row || !board || !button || !columns.length || buttons.length !== columns.length) return null;

    const spacer = document.createElement('div');
    spacer.id = 'status-tab-scroll-spacer-v204';
    spacer.style.height = '2200px';
    document.body.appendChild(spacer);
    window.scrollTo(0, 300);

    let assignedScrollLeft = 0;
    let scrollIntoViewCalls = 0;
    Object.defineProperty(row, 'clientWidth', { configurable: true, value: 200 });
    Object.defineProperty(row, 'scrollLeft', {
      configurable: true,
      get() { return assignedScrollLeft; },
      set(value) { assignedScrollLeft = Number(value); }
    });
    Object.defineProperty(button, 'offsetLeft', { configurable: true, value: 420 });
    Object.defineProperty(button, 'offsetWidth', { configurable: true, value: 60 });
    button.scrollIntoView = () => { scrollIntoViewCalls += 1; };

    const beforeY = window.scrollY;
    button.click();
    const selectedIndex = buttons.length - 1;
    return {
      selectedIndex,
      stableMarker: Boolean(button.__stableScrollIntoViewV108),
      scrollIntoViewCalls,
      rowScrollLeft: assignedScrollLeft,
      beforeY,
      afterY: window.scrollY,
      activePressed: button.getAttribute('aria-pressed'),
      activeButton: button.classList.contains('active'),
      activeColumn: columns[selectedIndex]?.classList.contains('work-mobile-active-column') || false
    };
  });

  expect(result).not.toBeNull();
  expect(result.stableMarker).toBe(false);
  expect(result.scrollIntoViewCalls).toBe(0);
  expect(result.rowScrollLeft).toBe(350);
  expect(result.beforeY).toBe(300);
  expect(result.afterY).toBe(300);
  expect(result.activePressed).toBe('true');
  expect(result.activeButton).toBe(true);
  expect(result.activeColumn).toBe(true);
});

test('mobile preserves status-tab layout and scrolling when duplicate stable CSS declarations are suppressed', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await boot(page);

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect(page.locator('.work-mobile-status-tab').last()).toBeVisible();

  const result = await page.evaluate(() => {
    const stableStyle = document.getElementById('stableFixesV108Style');
    const row = document.querySelector('.work-mobile-status-tabs');
    const buttons = [...(row?.querySelectorAll('.work-mobile-status-tab') || [])];
    const board = document.querySelector('.board-view');
    const columns = [...(board?.querySelectorAll('.board-column') || [])];
    const button = buttons.at(-1);
    if (!stableStyle || !row || !board || !button || !columns.length || buttons.length !== columns.length) return null;

    stableStyle.textContent = stableStyle.textContent
      .replace('display: flex !important;', '')
      .replace('gap: 8px !important;', '')
      .replace('overflow-x: auto !important;', '')
      .replace('scrollbar-width: none !important;', '')
      .replace('flex: 0 0 auto !important;', '');

    const rowStyle = getComputedStyle(row);
    const buttonStyle = getComputedStyle(button);
    const computed = {
      display: rowStyle.display,
      gap: rowStyle.gap,
      overflowX: rowStyle.overflowX,
      scrollbarWidth: rowStyle.scrollbarWidth,
      flexWrap: rowStyle.flexWrap,
      overflowY: rowStyle.overflowY,
      scrollSnapType: rowStyle.scrollSnapType,
      flexGrow: buttonStyle.flexGrow,
      flexShrink: buttonStyle.flexShrink,
      flexBasis: buttonStyle.flexBasis,
      userSelect: buttonStyle.userSelect
    };

    const spacer = document.createElement('div');
    spacer.id = 'status-tab-css-audit-spacer-v205';
    spacer.style.height = '2200px';
    document.body.appendChild(spacer);
    window.scrollTo(0, 300);

    let assignedScrollLeft = 0;
    Object.defineProperty(row, 'clientWidth', { configurable: true, value: 200 });
    Object.defineProperty(row, 'scrollLeft', {
      configurable: true,
      get() { return assignedScrollLeft; },
      set(value) { assignedScrollLeft = Number(value); }
    });
    Object.defineProperty(button, 'offsetLeft', { configurable: true, value: 420 });
    Object.defineProperty(button, 'offsetWidth', { configurable: true, value: 60 });

    const beforeY = window.scrollY;
    button.click();
    const selectedIndex = buttons.length - 1;
    return {
      ...computed,
      rowScrollLeft: assignedScrollLeft,
      beforeY,
      afterY: window.scrollY,
      activePressed: button.getAttribute('aria-pressed'),
      activeButton: button.classList.contains('active'),
      activeColumn: columns[selectedIndex]?.classList.contains('work-mobile-active-column') || false
    };
  });

  expect(result).not.toBeNull();
  expect(result.display).toBe('flex');
  expect(result.gap).toBe('8px');
  expect(result.overflowX).toBe('auto');
  expect(result.scrollbarWidth).toBe('none');
  expect(result.flexWrap).toBe('nowrap');
  expect(result.overflowY).toBe('hidden');
  expect(result.scrollSnapType).toBe('none');
  expect(result.flexGrow).toBe('0');
  expect(result.flexShrink).toBe('0');
  expect(result.flexBasis).toBe('auto');
  expect(result.userSelect).toBe('none');
  expect(result.rowScrollLeft).toBe(350);
  expect(result.beforeY).toBe(300);
  expect(result.afterY).toBe(300);
  expect(result.activePressed).toBe('true');
  expect(result.activeButton).toBe(true);
  expect(result.activeColumn).toBe(true);
});
