import { test, expect } from '@playwright/test';

async function startClassic(page, room) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === 'http://127.0.0.1:4173'
      ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(room => {
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', 'SwitchRetryTester');
  }, room);
}

test('display switch: a failed JOURNAL bundle can retry without leaving Classic broken', async ({ page }) => {
  const room = 'switch-retry-journal';
  await startClassic(page, room);
  let requests = 0;
  await page.route('**/journal-display-v367.js?v=*', route => {
    requests += 1;
    return requests === 1 ? route.abort('failed') : route.continue();
  });

  await page.goto('/?room=' + room, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, {timeout:30000});
  await page.locator('[data-wb-display-choice="journal"]').evaluate(button => button.click());
  await expect(page.locator('#wbDisplaySwitchV459')).toBeVisible();
  await expect(page.locator('#wbDisplaySwitchV459 [data-wb-display-retry]')).toBeVisible({timeout:15000});
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','journal');

  await page.locator('#wbDisplaySwitchV459 [data-wb-display-retry]').click();
  await expect(page.locator('#wbJournalHeaderV367')).toBeVisible({timeout:15000});
  await expect(page.locator('#wbDisplaySwitchV459')).toBeHidden();
  await expect(page.locator('script[data-workboard-stable="journal-display-v367.js"][data-loaded="true"]')).toHaveCount(1);
  expect(requests).toBe(2);

  await page.locator('[data-wb-display-choice="classic"]').evaluate(button => button.click());
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
  await page.locator('[data-wb-display-choice="journal"]').evaluate(button => button.click());
  await expect(page.locator('#wbDisplaySwitchV459')).toBeHidden();
  expect(requests).toBe(2);
});

test('display switch: Classic escape remains available while view code is pending', async ({ page }) => {
  const room = 'switch-cancel-journal';
  await startClassic(page, room);
  await page.route('**/journal-display-v367.js?v=*', async route => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    await route.continue();
  });
  await page.goto('/?room=' + room, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, {timeout:30000});

  await page.locator('[data-wb-display-choice="journal"]').evaluate(button => button.click());
  await expect(page.locator('#wbDisplaySwitchV459')).toBeVisible();
  await page.locator('#wbDisplaySwitchV459 [data-wb-display-classic]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
  await expect(page.locator('#wbDisplaySwitchV459')).toBeHidden();
  await expect(page.locator('.app-shell')).toBeVisible();
  // The old request may complete after the user left; it must not reopen the layer.
  await page.waitForTimeout(2200);
  await expect(page.locator('#wbDisplaySwitchV459')).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
});
