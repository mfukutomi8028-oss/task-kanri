import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-create-menu-outside-click-v310';

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
    window.__WB_CREATE_MENU_V310__ = {
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

    const handleNeedle = `  function handleCreateMenuOutsideClick(event) {\n    if (!event.target?.closest?.("#workMobileHeader")) closeCreateMenu();\n  }`;
    const handleReplacement = `  function handleCreateMenuOutsideClick(event) {\n    window.__WB_CREATE_MENU_V310__.callbacks += 1;\n    if (!event.target?.closest?.("#workMobileHeader")) closeCreateMenu();\n  }`;
    const setterNeedle = `  function setCreateMenuOutsideClickBound(shouldBind) {\n    if (createMenuOutsideClickBound === shouldBind) return;\n    createMenuOutsideClickBound = shouldBind;\n    if (shouldBind) {\n      document.addEventListener("click", handleCreateMenuOutsideClick);\n      return;\n    }\n    document.removeEventListener("click", handleCreateMenuOutsideClick);\n  }`;
    const setterReplacement = `  function setCreateMenuOutsideClickBound(shouldBind) {\n    if (createMenuOutsideClickBound === shouldBind) return;\n    createMenuOutsideClickBound = shouldBind;\n    window.__WB_CREATE_MENU_V310__.bound = shouldBind;\n    if (shouldBind) {\n      window.__WB_CREATE_MENU_V310__.bindAdds += 1;\n      document.addEventListener("click", handleCreateMenuOutsideClick);\n      return;\n    }\n    window.__WB_CREATE_MENU_V310__.bindRemoves += 1;\n    document.removeEventListener("click", handleCreateMenuOutsideClick);\n  }`;

    if (!body.includes(handleNeedle)) throw new Error('Ver.310 product outside-click handler not found');
    if (!body.includes(setterNeedle)) throw new Error('Ver.310 product outside-click lifecycle setter not found');
    body = body.replace(handleNeedle, handleReplacement).replace(setterNeedle, setterReplacement);
    body = `window.__WB_CREATE_MENU_V310__.shellRequests += 1;\n${body}`;
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
  return page.evaluate(() => ({ ...window.__WB_CREATE_MENU_V310__ }));
}

async function openCreateMenu(page) {
  await page.locator('.work-mobile-action-button').click();
  await expect(page.locator('#workMobileCreateMenu')).toHaveClass(/open/);
  await expect(page.locator('.work-mobile-action-button')).toHaveAttribute('aria-expanded', 'true');
}

test('Ver.310 product: closed menu has no document outside-click wake-ups', async ({ page }) => {
  expect(await boot(page)).toBe('276');
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  expect(await stats(page)).toMatchObject({ callbacks: 0, bindAdds: 0, bindRemoves: 0, bound: false, shellRequests: 1 });

  await page.locator('#mainContent').click({ position: { x: 12, y: 12 } });
  await page.locator('#mainContent').click({ position: { x: 24, y: 24 } });
  expect(await stats(page)).toMatchObject({ callbacks: 0, bindAdds: 0, bindRemoves: 0, bound: false, shellRequests: 1 });
});

test('Ver.310 product: inside header keeps menu open, outside click closes and unbinds', async ({ page }) => {
  await boot(page);
  await openCreateMenu(page);
  expect(await stats(page)).toMatchObject({ bindAdds: 1, bindRemoves: 0, bound: true });

  await page.locator('.work-mobile-title').click();
  await expect(page.locator('#workMobileCreateMenu')).toHaveClass(/open/);
  expect(await stats(page)).toMatchObject({ callbacks: 1, bindAdds: 1, bindRemoves: 0, bound: true });

  await page.locator('#mainContent').click({ position: { x: 12, y: 12 } });
  await expect(page.locator('#workMobileCreateMenu')).not.toHaveClass(/open/);
  expect(await stats(page)).toMatchObject({ callbacks: 2, bindAdds: 1, bindRemoves: 1, bound: false });

  await page.locator('#mainContent').click({ position: { x: 24, y: 24 } });
  expect((await stats(page)).callbacks).toBe(2);
});

test('Ver.310 product: Escape and Schedule action both remove the transient listener', async ({ page }) => {
  await boot(page);

  await openCreateMenu(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#workMobileCreateMenu')).not.toHaveClass(/open/);
  expect(await stats(page)).toMatchObject({ bindAdds: 1, bindRemoves: 1, bound: false });

  await openCreateMenu(page);
  await page.locator("[data-mobile-create='schedule']").click();
  await expect(page.locator('#scheduleDialog')).toHaveAttribute('open', '');
  await expect(page.locator('#workMobileCreateMenu')).not.toHaveClass(/open/);
  expect(await stats(page)).toMatchObject({ bindAdds: 2, bindRemoves: 2, bound: false });
});

test('Ver.310 product: repeated open-close cycles do not accumulate outside-click callbacks', async ({ page }) => {
  await boot(page);

  for (let index = 0; index < 3; index += 1) {
    await openCreateMenu(page);
    await page.locator('#mainContent').click({ position: { x: 12 + index, y: 12 + index } });
    await expect(page.locator('#workMobileCreateMenu')).not.toHaveClass(/open/);
  }

  expect(await stats(page)).toMatchObject({ callbacks: 3, bindAdds: 3, bindRemoves: 3, bound: false });
});

test('Ver.310 product: 861 to 860 late mobile-shell load keeps transient outside-click lifecycle', async ({ page }) => {
  await boot(page, { width: 861 });
  await expect(page.locator('#workMobileHeader')).toHaveCount(0);
  expect(await stats(page)).toMatchObject({ callbacks: 0, bindAdds: 0, bindRemoves: 0, bound: false, shellRequests: 0 });

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  await openCreateMenu(page);
  expect(await stats(page)).toMatchObject({ bound: true, shellRequests: 1 });

  await page.locator('#mainContent').click({ position: { x: 12, y: 12 } });
  await expect(page.locator('#workMobileCreateMenu')).not.toHaveClass(/open/);
  expect(await stats(page)).toMatchObject({ callbacks: 1, bindAdds: 1, bindRemoves: 1, bound: false, shellRequests: 1 });
});

test('Ver.310 product: desktop width does not load mobile shell or bind create-menu listener', async ({ page }) => {
  await boot(page, { width: 1000 });
  await expect(page.locator('#workMobileHeader')).toHaveCount(0);
  expect(await stats(page)).toMatchObject({ callbacks: 0, bindAdds: 0, bindRemoves: 0, bound: false, shellRequests: 0 });
});
