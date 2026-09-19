import { test, expect } from '@playwright/test';

const ROOM = 'test-date-keyboard-boundary-v230';
const CONTROLLER = 'date-segment-controls-v230.js';
const PRESENTATION = 'ui-date-segment-controls-v230.css';

async function installLocalState(page) {
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });
}

async function blockRemoteFirebase(page) {
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, { disableDateController = false } = {}) {
  await installLocalState(page);
  await blockRemoteFirebase(page);

  let controllerRequests = 0;
  page.on('request', request => {
    try {
      if (new URL(request.url()).pathname.endsWith(`/${CONTROLLER}`)) controllerRequests += 1;
    } catch (_) {}
  });

  if (disableDateController) {
    await page.route(`**/${CONTROLLER}*`, route => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '/* Ver.230 audit: semantic date controller intentionally disabled */'
    }));
  }

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => Number(window.WORK_BOARD_RELEASE?.version || 0) >= 230, undefined, { timeout: 8_000 });
  await page.waitForFunction(name => Array.from(document.styleSheets).some(sheet => {
    try { return new URL(sheet.href || '', location.href).pathname.endsWith(`/${name}`); }
    catch (_) { return false; }
  }), PRESENTATION, { timeout: 8_000 });
  return () => controllerRequests;
}

async function openTaskDialog(page) {
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await page.evaluate(() => document.getElementById('newTask')?.click());
  await expect(page.locator('#taskDialog')).toBeVisible();
}

test('Ver.230 product: app and work-features keep native date ownership when semantic date controller is disabled', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const getControllerRequests = await boot(page, { disableDateController: true });

  await expect(page.locator('#dateSegmentControlStyleV127')).toHaveCount(0);
  await expect(page.locator('.date-segment-control-v127')).toHaveCount(0);

  await openTaskDialog(page);

  const due = page.locator('#taskDueDate');
  const start = page.locator('#taskStartDateV167');
  await expect(due).toHaveAttribute('type', 'date');
  await expect(start).toHaveAttribute('type', 'date');
  await expect(due).not.toHaveAttribute('data-date-segment-v127', 'true');
  await expect(start).not.toHaveAttribute('data-date-segment-v127', 'true');

  // app.js owns reading the native due-date value during task save. Disabling
  // only the segmented controller must not alter the canonical native form path.
  await page.locator('#taskTitle').fill('Ver.230 native date audit');
  await due.fill('2026-09-30');
  await page.locator('#taskForm button[type="submit"]').click();
  await expect(page.locator('#taskDialog')).not.toBeVisible();

  await expect.poll(async () => page.evaluate(room => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    return tasks.find(task => task?.title === 'Ver.230 native date audit')?.dueDate || '';
  }, ROOM)).toBe('2026-09-30');

  expect(getControllerRequests()).toBeGreaterThan(0);
});

test('Ver.230 product: semantic controller owns behavior while external CSS owns segmented presentation', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const getControllerRequests = await boot(page);

  // The old controller-injected style is gone; release CSS is loaded separately.
  await expect(page.locator('#dateSegmentControlStyleV127')).toHaveCount(0);
  await openTaskDialog(page);

  const due = page.locator('#taskDueDate');
  const dueWrapper = due.locator('xpath=..');
  const start = page.locator('#taskStartDateV167');
  const startWrapper = start.locator('xpath=..');

  await expect(due).toHaveAttribute('data-date-segment-v127', 'true');
  await expect(dueWrapper).toHaveClass(/date-segment-control-v127/);
  await expect(start).toHaveAttribute('data-date-segment-v127', 'true');
  await expect(startWrapper).toHaveClass(/date-segment-control-v127/);
  await expect(page.locator('#taskDialog .date-segment-control-v127')).toHaveCount(2);
  await expect(dueWrapper).toHaveCSS('display', 'flex');
  await expect(dueWrapper).toHaveCSS('min-height', '52px');

  await dueWrapper.getByLabel('期限日 年').fill('2026');
  await dueWrapper.getByLabel('期限日 月').fill('09');
  await dueWrapper.getByLabel('期限日 日').fill('30');
  await expect(due).toHaveValue('2026-09-30');

  // Native-source changes made by app code are synchronized back into the
  // segmented presentation through the controller's source change bridge.
  await due.evaluate(source => {
    source.value = '2027-01-15';
    source.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(dueWrapper.getByLabel('期限日 年')).toHaveValue('2027');
  await expect(dueWrapper.getByLabel('期限日 月')).toHaveValue('01');
  await expect(dueWrapper.getByLabel('期限日 日')).toHaveValue('15');

  // Bypass the product's separate unsaved-change confirmation so this test
  // isolates the dialog-open lifecycle owned by the date controller.
  await page.evaluate(() => document.getElementById('taskDialog')?.close());
  await expect(page.locator('#taskDialog')).not.toBeVisible();
  await openTaskDialog(page);
  await expect(page.locator('#taskDialog #taskStartDateV167')).toHaveCount(1);
  await expect(page.locator('#taskDialog .date-segment-control-v127')).toHaveCount(2);

  expect(getControllerRequests()).toBeGreaterThan(0);
});
