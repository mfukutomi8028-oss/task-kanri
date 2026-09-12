import { test, expect } from '@playwright/test';

const ROOM = 'test-workspace-density-v188';
const VIEWPORTS = [
  { name: 'desktop-1366', width: 1366, height: 900 },
  { name: 'compact-980', width: 980, height: 900 },
  { name: 'mobile-boundary-860', width: 860, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 }
];

async function installProductionSafetyBoundary(page) {
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
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await page.waitForTimeout(350);

  const summary = await page.evaluate(() => window.WORK_BOARD_ASSET_SUMMARY);
  expect(summary?.styles?.failed).toBe(0);
  expect(summary?.scripts?.failed).toBe(0);
  expect(pageErrors).toEqual([]);
}

async function clickCurrent(page, selector) {
  const clicked = await page.evaluate(sel => {
    const node = document.querySelector(sel);
    if (!(node instanceof HTMLElement)) return false;
    node.click();
    return true;
  }, selector);
  expect(clicked, `expected clickable element: ${selector}`).toBeTruthy();
}

async function openCoreLayout(page, layout, visibleSelector) {
  await clickCurrent(page, `.nav-item[data-layout="${layout}"]`);
  await expect(page.locator(visibleSelector)).toBeVisible();
  await page.waitForTimeout(120);
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth, `${label} should not create page-level horizontal overflow`)
    .toBeLessThanOrEqual(dimensions.width + 2);
}

async function stabilizeTodayActivityTimestamp(page) {
  await page.evaluate(() => {
    const node = document.querySelector('#todayView .activity-empty p');
    if (!node) return;
    const text = String(node.textContent || '');
    if (text.startsWith('最終確認：')) node.textContent = '最終確認：09/12 00:00';
  });
}

for (const viewport of VIEWPORTS) {
  test(`Ver.187 workspace density baseline: ${viewport.name}`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await installProductionSafetyBoundary(page);
    await boot(page);

    await openCoreLayout(page, 'today', '#todayView');
    await expect(page.locator('#todayView .today-head')).toHaveCount(0);
    const activityActions = page.locator('#todayView .activity-panel .activity-actions');
    await expect(activityActions.locator('[data-layout-jump="schedule"]')).toHaveCount(1);
    await expect(activityActions.locator('[data-new-task]')).toHaveCount(1);
    await assertNoHorizontalOverflow(page, `${viewport.name} today`);
    await stabilizeTodayActivityTimestamp(page);
    await expect(page.locator('#todayView .activity-panel')).toHaveScreenshot(
      `workspace-density-${viewport.name}-today.png`,
      { animations: 'disabled' }
    );

    await openCoreLayout(page, 'todos', '#todoView');
    await expect(page.locator('#todoView .todo-page-head')).toHaveCount(0);
    const todoTools = page.locator('#todoView .todo-tools-v145');
    await expect(todoTools.locator('.todo-search-input-v145')).toHaveCount(1);
    await expect(todoTools.locator('.todo-tools-actions-v176')).toHaveCount(1);
    await expect(todoTools.locator('[data-layout-jump="today"]')).toHaveCount(1);
    await expect(todoTools.locator('[data-layout-jump="tasks"]')).toHaveCount(1);
    await assertNoHorizontalOverflow(page, `${viewport.name} todo`);
    await expect(todoTools).toHaveScreenshot(
      `workspace-density-${viewport.name}-todo.png`,
      { animations: 'disabled' }
    );

    await openCoreLayout(page, 'schedule', '#scheduleView');
    const scheduleHead = page.locator('#scheduleView .schedule-head');
    await expect(scheduleHead.locator('.schedule-toolbar-v176')).toHaveCount(1);
    await expect(scheduleHead.locator('.schedule-toolbar-controls-v176')).toHaveCount(1);
    await expect(scheduleHead.locator('.schedule-date-v176')).toHaveCount(1);
    await expect(scheduleHead.locator('.schedule-search-v176 input')).toHaveCount(1);
    await assertNoHorizontalOverflow(page, `${viewport.name} schedule`);
    await expect(scheduleHead).toHaveScreenshot(
      `workspace-density-${viewport.name}-schedule.png`,
      { animations: 'disabled' }
    );

    const scheduleFocus = await page.evaluate(() => {
      const input = document.querySelector('#scheduleView .schedule-search-v176 input');
      if (!(input instanceof HTMLInputElement)) return { dispatched: false };
      input.focus();
      input.value = '会議';
      input.setSelectionRange(1, 1);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return { dispatched: true };
    });
    expect(scheduleFocus.dispatched).toBeTruthy();
    await expect.poll(() => page.evaluate(() => {
      const input = document.querySelector('#scheduleView .schedule-search-v176 input');
      return input instanceof HTMLInputElement ? input.value : '';
    }), { timeout: 3_000 }).toBe('会議');
    const scheduleState = await page.evaluate(() => {
      const input = document.querySelector('#scheduleView .schedule-search-v176 input');
      const source = document.getElementById('searchInput');
      return {
        sourceValue: source?.value || '',
        focused: document.activeElement === input,
        selectionStart: input instanceof HTMLInputElement ? input.selectionStart : null,
        selectionEnd: input instanceof HTMLInputElement ? input.selectionEnd : null
      };
    });
    expect(scheduleState.sourceValue).toBe('会議');
    expect(scheduleState.focused).toBeTruthy();
    expect(scheduleState.selectionStart).toBe(1);
    expect(scheduleState.selectionEnd).toBe(1);

    await clickCurrent(page, '[data-work-memo-layout]');
    await expect(page.locator('#workMemoViewV167')).toBeVisible();
    await page.waitForTimeout(120);
    await expect(page.locator('#workMemoViewV167 .work-memo-head-v167')).toHaveCount(0);
    const memoTools = page.locator('#workMemoViewV167 .work-memo-tools-v167');
    await expect(memoTools.locator('.work-memo-new-v176')).toHaveCount(1);
    await expect(memoTools.locator('[data-memo-search]')).toHaveCount(1);
    await assertNoHorizontalOverflow(page, `${viewport.name} memo`);
    await expect(memoTools).toHaveScreenshot(
      `workspace-density-${viewport.name}-memo.png`,
      { animations: 'disabled' }
    );
  });
}
