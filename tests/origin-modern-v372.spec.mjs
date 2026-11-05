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
  await expect(page.locator('html')).toHaveAttribute('data-modern-origin-ready','true');
  await expect(page.locator('#modernOriginRoot')).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveCSS('display','none');
  const rootVersion=await page.locator('#modernOriginRoot').getAttribute('data-release-version');
  const manifestVersion=await page.evaluate(()=>String(window.WORK_BOARD_RELEASE_VERSION));
  expect(rootVersion).toBe(manifestVersion);
  await expect(page.locator('#modernOriginRoot').locator('.brand-small')).toContainText('Ver.'+manifestVersion);
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

test('Origin ToDo changes appear in Classic with the same data source', async ({page}) => {
  test.setTimeout(90000);
  await page.setViewportSize({width:1366,height:900});
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'
    ?route.continue():route.abort('blockedbyclient'));
  await page.addInitScript(()=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskUser','OriginTester');
    localStorage.setItem('systemTaskRoomId','origin-v374-to-do-room');
  });
  await page.goto('/?room=origin-v374-to-do-room',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  const host=page.locator('#modernOriginRoot');
  await expect(host).toBeVisible();
  await host.locator('#desktopNav [data-route="todos"]').click();
  await host.locator('[data-form="quick-todo"] input[name="title"]').fill('共通データ接続の確認');
  await host.locator('[data-form="quick-todo"] button[type="submit"]').click();
  await expect(host.locator('#workspace')).toContainText('共通データ接続の確認');
  await host.locator('#originDisplaySelect').selectOption('classic');
  await page.locator('.nav-item[data-layout="todos"]').evaluate(el=>el.click());
  await expect(page.locator('#todoView')).toContainText('共通データ接続の確認');
});