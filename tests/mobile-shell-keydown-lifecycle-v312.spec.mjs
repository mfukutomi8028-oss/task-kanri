import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-keydown-lifecycle-v312';

async function installProductInstrumentation(page, { width = 430 } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
    window.__WB_KEYDOWN_V312__ = {
      callbacks: 0,
      bindAdds: 0,
      bindRemoves: 0,
      bound: false,
      shellRequests: 0
    };
  }, { room: ROOM });

  await page.route(/\/mobile-shell-v234\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let body = await response.text();

    const handleNeedle = `  function handleMobileEscapeKeydown(event) {\n    if (event.key !== "Escape") return;\n    closeMobileMenu();\n    closeCreateMenu();\n  }`;
    const handleReplacement = `  function handleMobileEscapeKeydown(event) {\n    window.__WB_KEYDOWN_V312__.callbacks += 1;\n    if (event.key !== "Escape") return;\n    closeMobileMenu();\n    closeCreateMenu();\n  }`;
    const syncNeedle = `  function syncMobileEscapeKeydownBound() {\n    const shouldBind = Boolean(\n      document.body?.classList.contains("work-mobile-menu-open") ||\n      document.getElementById("workMobileCreateMenu")?.classList.contains("open")\n    );\n    if (mobileEscapeKeydownBound === shouldBind) return;\n    mobileEscapeKeydownBound = shouldBind;\n    if (shouldBind) {\n      document.addEventListener("keydown", handleMobileEscapeKeydown);\n      return;\n    }\n    document.removeEventListener("keydown", handleMobileEscapeKeydown);\n  }`;
    const syncReplacement = `  function syncMobileEscapeKeydownBound() {\n    const shouldBind = Boolean(\n      document.body?.classList.contains("work-mobile-menu-open") ||\n      document.getElementById("workMobileCreateMenu")?.classList.contains("open")\n    );\n    if (mobileEscapeKeydownBound === shouldBind) return;\n    mobileEscapeKeydownBound = shouldBind;\n    window.__WB_KEYDOWN_V312__.bound = shouldBind;\n    if (shouldBind) {\n      window.__WB_KEYDOWN_V312__.bindAdds += 1;\n      document.addEventListener("keydown", handleMobileEscapeKeydown);\n      return;\n    }\n    window.__WB_KEYDOWN_V312__.bindRemoves += 1;\n    document.removeEventListener("keydown", handleMobileEscapeKeydown);\n  }`;

    if (!body.includes(handleNeedle)) throw new Error('Ver.312 product Escape handler not found');
    if (!body.includes(syncNeedle)) throw new Error('Ver.312 product Escape lifecycle sync not found');
    body = body.replace(handleNeedle, handleReplacement).replace(syncNeedle, syncReplacement);
    body = `window.__WB_KEYDOWN_V312__.shellRequests += 1;\n${body}`;
    await route.fulfill({ response, body });
  });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, options = {}) {
  await installProductInstrumentation(page, options);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  const release = await page.evaluate(() => String(window.WORK_BOARD_RELEASE?.version || ''));
  await page.waitForFunction(version => document.documentElement.dataset.firstPaintVersion === version, release, { timeout: 8_000 });
  return release;
}

async function stats(page) {
  return page.evaluate(() => ({ ...window.__WB_KEYDOWN_V312__ }));
}

async function openCreateMenu(page) {
  await page.locator('.work-mobile-action-button').click();
  await expect(page.locator('#workMobileCreateMenu')).toHaveClass(/open/);
}

async function openDrawer(page) {
  await page.locator('.work-mobile-menu-button').click();
  await expect(page.locator('body')).toHaveClass(/work-mobile-menu-open/);
}

async function clickExposedOverlay(page) {
  const box = await page.locator('.work-mobile-overlay').boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box.x + box.width - 8, box.y + box.height / 2);
}

test('Ver.312 product: closed transient UI has zero keydown wake-ups', async ({ page }) => {
  expect(await boot(page)).toBe('277');
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  expect(await stats(page)).toMatchObject({ callbacks: 0, bindAdds: 0, bindRemoves: 0, bound: false, shellRequests: 1 });
});

test('Ver.312 product: create menu owns one listener and Escape releases it', async ({ page }) => {
  await boot(page);
  await openCreateMenu(page);
  expect(await stats(page)).toMatchObject({ bindAdds: 1, bindRemoves: 0, bound: true });
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#workMobileCreateMenu')).toHaveClass(/open/);
  expect(await stats(page)).toMatchObject({ callbacks: 1, bindAdds: 1, bound: true });
  await page.keyboard.press('Escape');
  await expect(page.locator('#workMobileCreateMenu')).not.toHaveClass(/open/);
  expect(await stats(page)).toMatchObject({ callbacks: 2, bindAdds: 1, bindRemoves: 1, bound: false });
});

test('Ver.312 product: drawer overlap, overlay, nav, and repeated cycles keep one transient listener', async ({ page }) => {
  await boot(page);
  await openDrawer(page);
  await openCreateMenu(page);
  expect(await stats(page)).toMatchObject({ bindAdds: 1, bindRemoves: 0, bound: true });
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/work-mobile-menu-open/);
  await expect(page.locator('#workMobileCreateMenu')).not.toHaveClass(/open/);
  expect(await stats(page)).toMatchObject({ callbacks: 1, bindAdds: 1, bindRemoves: 1, bound: false });

  await openDrawer(page);
  await clickExposedOverlay(page);
  expect(await stats(page)).toMatchObject({ bindAdds: 2, bindRemoves: 2, bound: false });

  await openDrawer(page);
  await page.locator('.nav .nav-item').first().evaluate(node => node.click());
  await expect(page.locator('body')).not.toHaveClass(/work-mobile-menu-open/);
  expect(await stats(page)).toMatchObject({ bindAdds: 3, bindRemoves: 3, bound: false });

  for (let index = 0; index < 3; index += 1) {
    await openCreateMenu(page);
    await page.keyboard.press('Escape');
  }
  expect(await stats(page)).toMatchObject({ callbacks: 4, bindAdds: 6, bindRemoves: 6, bound: false });
});

test('Ver.312 product: Task and Schedule create handoff leave no stale Escape listener', async ({ page }) => {
  await boot(page);
  await openCreateMenu(page);
  await page.locator("[data-mobile-create='task']").click();
  await expect(page.locator('#workMobileCreateMenu')).not.toHaveClass(/open/);
  expect(await stats(page)).toMatchObject({ bindAdds: 1, bindRemoves: 1, bound: false });

  await openCreateMenu(page);
  await page.locator("[data-mobile-create='schedule']").click();
  await expect(page.locator('#scheduleDialog')).toHaveAttribute('open', '');
  expect(await stats(page)).toMatchObject({ bindAdds: 2, bindRemoves: 2, bound: false });
});

test('Ver.312 product: 861 to 860 late load keeps lifecycle, desktop does not load shell', async ({ page }) => {
  await boot(page, { width: 861 });
  await expect(page.locator('#workMobileHeader')).toHaveCount(0);
  expect(await stats(page)).toMatchObject({ callbacks: 0, bindAdds: 0, bindRemoves: 0, bound: false, shellRequests: 0 });

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  await openDrawer(page);
  expect(await stats(page)).toMatchObject({ bindAdds: 1, bound: true, shellRequests: 1 });
  await page.keyboard.press('Escape');
  expect(await stats(page)).toMatchObject({ callbacks: 1, bindAdds: 1, bindRemoves: 1, bound: false, shellRequests: 1 });
});

test('Ver.312 product: desktop cold boot has no mobile Escape ownership', async ({ page }) => {
  await boot(page, { width: 1000 });
  await expect(page.locator('#workMobileHeader')).toHaveCount(0);
  await page.keyboard.press('Escape');
  expect(await stats(page)).toMatchObject({ callbacks: 0, bindAdds: 0, bindRemoves: 0, bound: false, shellRequests: 0 });
});
