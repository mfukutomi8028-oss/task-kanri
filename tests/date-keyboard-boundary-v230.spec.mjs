import { test, expect } from '@playwright/test';

const ROOM = 'test-date-keyboard-boundary-v230';
const SIDECAR = 'date-keyboard-fix-v127.js';

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

async function boot(page, { disableDateKeyboard = false } = {}) {
  await installLocalState(page);
  await blockRemoteFirebase(page);

  let sidecarRequests = 0;
  page.on('request', request => {
    try {
      if (new URL(request.url()).pathname.endsWith(`/${SIDECAR}`)) sidecarRequests += 1;
    } catch (_) {}
  });

  if (disableDateKeyboard) {
    await page.route(`**/${SIDECAR}*`, route => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '/* Ver.230 audit: date keyboard intentionally disabled */'
    }));
  }

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => Number(window.WORK_BOARD_RELEASE?.version || 0) >= 229, undefined, { timeout: 8_000 });
  return () => sidecarRequests;
}

async function openTaskDialog(page) {
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await page.evaluate(() => document.getElementById('newTask')?.click());
  await expect(page.locator('#taskDialog')).toBeVisible();
}

test('Ver.230 audit: app and work-features keep native date ownership when date keyboard is disabled', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const getSidecarRequests = await boot(page, { disableDateKeyboard: true });

  await expect(page.locator('#dateSegmentControlStyleV127')).toHaveCount(0);
  await expect(page.locator('.date-segment-control-v127')).toHaveCount(0);

  await openTaskDialog(page);

  const due = page.locator('#taskDueDate');
  const start = page.locator('#taskStartDateV167');
  await expect(due).toHaveAttribute('type', 'date');
  await expect(start).toHaveAttribute('type', 'date');
  await expect(due).not.toHaveAttribute('data-date-segment-v127', 'true');
  await expect(start).not.toHaveAttribute('data-date-segment-v127', 'true');

  // app.js owns reading the native due-date value during task save. The audit
  // intentionally removes only the presentation sidecar and verifies that the
  // canonical native form path still persists the date unchanged.
  await page.locator('#taskTitle').fill('Ver.230 native date audit');
  await due.fill('2026-09-30');
  await page.locator('#taskForm button[type="submit"]').click();
  await expect(page.locator('#taskDialog')).not.toBeVisible();

  await expect.poll(async () => page.evaluate(room => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    return tasks.find(task => task?.title === 'Ver.230 native date audit')?.dueDate || '';
  }, ROOM)).toBe('2026-09-30');

  expect(getSidecarRequests()).toBeGreaterThan(0);
});

test('Ver.230 audit: date keyboard exclusively owns segmented UI, validation bridge, and dynamic adoption', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const getSidecarRequests = await boot(page);

  await expect(page.locator('#dateSegmentControlStyleV127')).toHaveCount(1);
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

  await dueWrapper.getByLabel('期限日 年').fill('2026');
  await dueWrapper.getByLabel('期限日 月').fill('09');
  await dueWrapper.getByLabel('期限日 日').fill('30');
  await expect(due).toHaveValue('2026-09-30');

  // Native-source changes made by app code are synchronized back into the
  // segmented presentation through the sidecar's source change bridge.
  await due.evaluate(source => {
    source.value = '2027-01-15';
    source.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(dueWrapper.getByLabel('期限日 年')).toHaveValue('2027');
  await expect(dueWrapper.getByLabel('期限日 月')).toHaveValue('01');
  await expect(dueWrapper.getByLabel('期限日 日')).toHaveValue('15');

  await page.locator('#closeTaskDialog').click();
  await expect(page.locator('#taskDialog')).not.toBeVisible();
  await openTaskDialog(page);
  await expect(page.locator('#taskDialog #taskStartDateV167')).toHaveCount(1);
  await expect(page.locator('#taskDialog .date-segment-control-v127')).toHaveCount(2);

  expect(getSidecarRequests()).toBeGreaterThan(0);
});
