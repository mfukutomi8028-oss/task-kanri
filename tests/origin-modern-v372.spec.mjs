import { test, expect } from '@playwright/test';
test('Modern origin renders real app data and can switch back to Classic', async ({page}) => {
  test.setTimeout(90000);
  await page.setViewportSize({width:1366,height:900});
  await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4173'
    ? route.continue() : route.abort('blockedbyclient'));
  await page.addInitScript(() => {
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskUser','OriginTester');
    localStorage.setItem('systemTaskRoomId','origin-v372-browser-room');
  });
  await page.goto('/?room=origin-v372-browser-room',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','modern');
  await expect(page.locator('#modernOriginRoot')).toBeVisible();
  await expect(page.locator('.app-shell')).toBeHidden();
  const root=page.locator('#modernOriginRoot');
  await expect(root.locator('#workspace')).toBeVisible();
  await root.locator('#desktopNav [data-route="tasks"]').click();
  await expect(root.locator('#workspace')).toContainText('タスク');
  await root.locator('#desktopNav [data-route="todos"]').click();
  await expect(root.locator('#workspace')).toContainText('ToDo');
  await root.locator('#originDisplaySelect').selectOption('classic');
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
  await expect(root).toBeHidden();
  await expect(page.locator('.app-shell')).toBeVisible();
});