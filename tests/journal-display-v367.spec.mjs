import { test, expect } from '@playwright/test';

const ROOM = 'test-journal-display-v367';
async function boot(page, width = 1366) {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === 'http://127.0.0.1:4173'
      ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(({ room }) => {
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', 'JournalTester');
  }, { room: ROOM });
  await page.goto('/?room=' + ROOM, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30000 });
  await expect(page.locator('#wbDisplayChoiceV356 [data-wb-display-choice]')).toHaveCount(4);
}
async function choose(page, mode) {
  await page.locator('[data-wb-display-choice="' + mode + '"]').evaluate(el => el.click());
  await expect(page.locator('html')).toHaveAttribute('data-wb-display', mode);
}

test('JOURNAL Linen and Margin have materially different desktop layouts without a second data owner', async ({ page }) => {
  test.setTimeout(90000);
  await boot(page);
  const originalTodo = await page.locator('#todayView .today-todo-preview').count();
  await choose(page, 'journal');
  await expect(page.locator('#wbJournalHeaderV367')).toBeVisible();
  await expect(page.locator('#todayView > .today-grid')).toBeVisible();
  await expect(page.locator('#todayView > .today-todo-preview')).toBeVisible();
  await expect(page.locator('[data-journal-theme="linen"]')).toHaveAttribute('aria-pressed','true');
  const linen = await page.locator('#todayView').evaluate(el => {
    const widths = getComputedStyle(el).gridTemplateColumns.split(' ').map(Number.parseFloat);
    return { widths, bg: getComputedStyle(el).backgroundImage };
  });
  await page.locator('[data-journal-theme="margin"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-journal-theme','margin');
  const margin = await page.locator('#todayView').evaluate(el => {
    const widths = getComputedStyle(el).gridTemplateColumns.split(' ').map(Number.parseFloat);
    return { widths, bg: getComputedStyle(el).backgroundImage };
  });
  expect(Math.abs(linen.widths[0]-linen.widths[1])).toBeLessThan(10);
  expect(margin.widths[0]).toBeGreaterThan(margin.widths[1] + 100);
  expect(margin.bg).not.toBe(linen.bg);
  expect(await page.locator('#todayView .today-todo-preview').count()).toBe(originalTodo);

  await page.locator('[data-journal-route="tasks"]').first().click();
  await expect(page.locator('body')).toHaveClass(/task-mode/);
  await page.locator('.wb-journal-add-toggle-v367').click();
  await page.locator('[data-journal-create="task"]').click();
  await expect(page.locator('#taskDialog')).toBeVisible();
  await page.locator('[data-wb-display-choice="classic"]').evaluate(el => el.click());
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','journal');
  await page.locator('#closeTaskDialog').evaluate(el => el.click());

  await page.locator('[data-journal-settings]').click();
  await expect(page.locator('#wbJournalPreferencesV370')).toBeVisible();
  await page.locator('[data-journal-open-drawer]').click();
  await expect(page.locator('.sidebar')).toBeVisible();
  await page.locator('[data-wb-display-choice="classic"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
  await expect(page.locator('#wbJournalHeaderV367')).toBeHidden();
});

test('JOURNAL week/date navigation and canonical ToDo and schedule editors remain usable', async ({ page }) => {
  test.setTimeout(90000);
  await boot(page);
  await choose(page, 'journal');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="week"]').click();
  await expect(page.locator('body')).toHaveClass(/schedule-mode/);
  await expect(page.locator('#scheduleView [data-schedule-range="week"]')).toHaveClass(/active/);
  await page.locator('.wb-journal-add-toggle-v367').click();
  await page.locator('[data-journal-create="schedule"]').click();
  await expect(page.locator('#scheduleDialog')).toBeVisible();
  await page.locator('#closeScheduleDialog').evaluate(el=>el.click());
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="todos"]').click();
  await expect(page.locator('body')).toHaveClass(/todo-mode/);
  await expect(page.locator('#todayTodoInput')).toBeVisible();
  await page.locator('#todayTodoInput').fill('JOURNALで作成したToDo');
  await page.locator('[data-todo-form] button[type="submit"]').click();
  await expect(page.locator('#todoView')).toContainText('JOURNALで作成したToDo');
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="memo"]').click();
  await expect(page.locator('#workMemoViewV167')).toBeVisible();
  await page.locator('.wb-journal-add-toggle-v367').click();
  await page.locator('[data-journal-create="memo"]').click();
  await expect(page.locator('#workMemoDialogV167')).toBeVisible();
});

test('JOURNAL mobile uses single-page switch, dock and settings; other modes stay intact', async ({ page }) => {
  test.setTimeout(90000);
  await boot(page,390);
  await choose(page,'journal');
  const dock=page.locator('#wbJournalDockV367');
  await expect(dock).toBeVisible();
  await expect(dock.locator('button')).toHaveCount(5);
  await expect(page.locator('#todayView > .today-grid')).toBeVisible();
  await expect(page.locator('#todayView > .today-todo-preview')).toBeHidden();
  await page.locator('[data-journal-sheet="right"]').click();
  await expect(page.locator('#todayView > .today-todo-preview')).toBeVisible();
  await expect(page.locator('#todayView > .today-grid')).toBeHidden();
  await page.locator('[data-journal-settings]').click();
  await page.locator('[data-journal-theme="margin"]').click();
  const horizontal=await page.evaluate(() => document.documentElement.scrollWidth-window.innerWidth);
  expect(horizontal).toBeLessThanOrEqual(0);
  await dock.locator('[data-journal-route="todos"]').click();
  await expect(page.locator('#todoView')).toBeVisible();
  await dock.locator('[data-journal-route="today"]').click();
  await expect(page.locator('body')).toHaveClass(/today-mode/);
  await dock.locator('.wb-journal-more-v367').click();
  await expect(page.locator('.sidebar')).toBeVisible();
  await page.locator('[data-wb-display-choice="palette"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','palette');
  await expect(dock).toBeHidden();
});


test('JOURNAL v368 fills desktop canvas and replaces Classic illustrations only inside Journal', async ({ page }) => {
  test.setTimeout(90000);
  await boot(page, 1792);
  await choose(page, 'journal');
  const main = page.locator('.app-shell .main');
  await expect(main).toBeVisible();
  const geometry = await main.evaluate(el => ({
    width: el.getBoundingClientRect().width,
    viewport: window.innerWidth,
    pageOverflow: document.documentElement.scrollWidth - window.innerWidth
  }));
  expect(geometry.width / geometry.viewport).toBeGreaterThan(0.95);
  expect(geometry.pageOverflow).toBeLessThanOrEqual(0);
  await expect(page.locator('.main > .summary-grid')).toBeHidden();
  const icons = page.locator('#todayView .today-grid > .today-panel .wb-journal-line-icon-v367 svg');
  await expect(icons.first()).toBeVisible();
  await page.locator('[data-journal-settings]').click();
  await expect(page.locator('#wbJournalPreferencesV370')).toBeVisible();
  await page.locator('[data-journal-theme="margin"]').click();
  await expect(icons.first()).toBeVisible();
  const marginWidth = await main.evaluate(el => el.getBoundingClientRect().width / window.innerWidth);
  expect(marginWidth).toBeGreaterThan(0.95);
  await page.locator('[data-journal-open-drawer]').click();
  await page.locator('[data-wb-display-choice="classic"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
  await expect(page.locator('.main > .summary-grid .summary-card .summary-icon img').first()).toBeVisible();
  await expect(icons.first()).toBeHidden();
  await expect(page.locator('.main > .summary-grid')).toBeVisible();
});


test('JOURNAL only shows overall task counters within the canonical dashboard', async ({page}) => {
  test.setTimeout(90000);
  await boot(page);
  await choose(page, 'journal');
  await expect(page.locator('.main > .summary-grid')).toBeHidden();
  await page.locator('[data-layout="dashboard"]').first().evaluate(el => el.click());
  await expect(page.locator('#dashboardView')).toBeVisible();
  await expect(page.locator('#dashboardView .dashboard-kpi')).toHaveCount(5);
  await expect(page.locator('.main > .summary-grid')).toBeHidden();
  const shape = await page.locator('#dashboardView .dashboard-kpi').first().evaluate(el => ({
    background:getComputedStyle(el).backgroundColor,
    border:getComputedStyle(el).borderLeftWidth
  }));
  expect(parseFloat(shape.border)).toBeGreaterThan(0);
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="schedule"]').click();
  await expect(page.locator('#scheduleView')).toBeVisible();
  await expect(page.locator('.main > .summary-grid')).toBeHidden();
});
