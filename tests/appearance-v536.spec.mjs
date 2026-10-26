import { test, expect } from '@playwright/test';

async function boot(page, width, room) {
  await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
  await page.addInitScript(roomId => {
    if (!sessionStorage.getItem('appearance-v536-bootstrapped')) {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', roomId);
      localStorage.setItem('system-task-users:' + roomId, JSON.stringify(['福冨', '佐藤']));
      sessionStorage.setItem('appearance-v536-bootstrapped', '1');
    }
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
  }, room);
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
  await page.goto('/?room=' + room, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true && window.WORK_BOARD_APPEARANCE_VERSION === '536', undefined, {timeout: 30_000});
}

async function settings(page, width) {
  if (width <= 860) {
    await page.locator('.work-mobile-menu-button').click();
  } else {
    await page.locator('.sidebar').hover();
  }
  await page.locator('#wbOpenSettings').click();
  await expect(page.locator('#wbSettingsDialog')).toBeVisible();
}

test('Ver.536 Classic remains the default and SIGNAL is opt-in', async ({ page }) => {
  await boot(page, 1366, 'test-v536-default');
  await expect(page.locator('body')).toHaveAttribute('data-wb-design', 'classic');
  await settings(page, 1366);
  await expect(page.locator('#wbToneSettings')).toBeDisabled();
  await page.locator('input[name="wbPreferenceDesign"][value="signal"]').check();
  await expect(page.locator('body')).toHaveAttribute('data-wb-design', 'signal');
  await expect(page.locator('#wbToneSettings')).toBeEnabled();
  const tone = await page.locator('body').evaluate(el => getComputedStyle(el).getPropertyValue('--signal-sidebar').trim());
  expect(tone).toBe('#eef2ff');
  await page.locator('input[name="wbPreferenceTone"][value="midnight"]').check();
  await expect(page.locator('body')).toHaveAttribute('data-wb-tone', 'midnight');
  const dark = await page.locator('body').evaluate(el => getComputedStyle(el).getPropertyValue('--signal-sidebar').trim());
  expect(dark).toBe('#1c2942');
  await page.locator('#wbCloseSettings').click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_APPEARANCE_VERSION === '536');
  await expect(page.locator('body')).toHaveAttribute('data-wb-design', 'signal');
  await expect(page.locator('body')).toHaveAttribute('data-wb-tone', 'midnight');
});

test('Ver.536 reuses existing settings and scopes preference to the selected user', async ({ page }) => {
  await boot(page, 1366, 'test-v536-users');
  await settings(page, 1366);
  await page.locator('input[name="wbPreferenceDesign"][value="signal"]').check();
  await page.locator('[data-wb-existing-setting="manageUsers"]').click();
  await expect(page.locator('#userManageDialog')).toBeVisible();
  await page.locator('#closeUserManage').click();
  await page.locator('#currentUserSelect').selectOption('佐藤');
  await expect(page.locator('body')).toHaveAttribute('data-wb-design', 'classic');
  await page.locator('#currentUserSelect').selectOption('福冨');
  await expect(page.locator('body')).toHaveAttribute('data-wb-design', 'signal');
});

test('Ver.536 keeps calendar/list display and the canonical ToDo create form', async ({ page }) => {
  await boot(page, 1440, 'test-v536-functionality');
  await settings(page, 1440);
  await page.locator('input[name="wbPreferenceDesign"][value="signal"]').check();
  await page.locator('#wbCloseSettings').click();
  await page.locator('.nav-item[data-layout="schedule"]').click();
  await expect(page.locator('#scheduleView [data-schedule-mode="calendar"]')).toBeVisible();
  await page.locator('#scheduleView [data-schedule-mode="calendar"]').click();
  await expect(page.locator('#scheduleView .schedule-calendar')).toBeVisible();
  await page.locator('#scheduleView [data-schedule-mode="list"]').click();
  await expect(page.locator('#scheduleView .schedule-list')).toBeVisible();
  await page.locator('.nav-item[data-layout="todos"]').click();
  const correctOrder = await page.locator('#todoView').evaluate(view => {
    const form = view.querySelector('.todo-create-form');
    const list = view.querySelector('[data-todo-lists]');
    return Boolean(form && list && (form.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(correctOrder).toBe(true);
  await expect(page.locator('#todoView [data-todo-form]')).toBeVisible();
});

test('Ver.536 mobile settings are reachable without a second sidebar or horizontal overflow', async ({ page }) => {
  await boot(page, 390, 'test-v536-mobile');
  await settings(page, 390);
  await page.locator('input[name="wbPreferenceDesign"][value="signal"]').check();
  await page.locator('input[name="wbPreferenceTone"][value="midnight"]').check();
  await page.locator('#wbCloseSettings').click();
  const metrics = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    sidebarCount: document.querySelectorAll('aside.sidebar').length,
    design: document.body.dataset.wbDesign,
    tone: document.body.dataset.wbTone
  }));
  expect(metrics.sidebarCount).toBe(1);
  expect(metrics.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(metrics.design).toBe('signal');
  expect(metrics.tone).toBe('midnight');
});
