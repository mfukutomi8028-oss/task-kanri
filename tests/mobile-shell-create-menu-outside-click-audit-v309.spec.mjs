import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-create-menu-outside-click-v309';

async function installAudit(page, { candidate = false, width = 430 } = {}) {
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
    window.__WB_CREATE_MENU_V309__ = {
      callbacks: 0,
      bindAdds: 0,
      bindRemoves: 0,
      bound: false
    };
  }, { room: ROOM });

  await page.route(/\/mobile-shell-v234\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let body = await response.text();

    const permanentListener = `    document.addEventListener("click", event => {\n      if (!event.target?.closest?.("#workMobileHeader")) closeCreateMenu();\n    });`;
    if (!body.includes(permanentListener)) {
      throw new Error('Ver.309 permanent create-menu outside-click listener not found');
    }

    if (!candidate) {
      body = body.replace(permanentListener, `    window.__WB_CREATE_MENU_V309__.bound = true;\n    document.addEventListener("click", event => {\n      window.__WB_CREATE_MENU_V309__.callbacks += 1;\n      if (!event.target?.closest?.("#workMobileHeader")) closeCreateMenu();\n    });`);
    } else {
      const stateNeedle = `  const STORAGE_ACTIVE_STATUS = "workBoardMobileBoardStatusIndex";`;
      const lifecycle = `${stateNeedle}\n\n  let createMenuOutsideClickBound = false;\n\n  function handleCreateMenuOutsideClick(event) {\n    window.__WB_CREATE_MENU_V309__.callbacks += 1;\n    if (!event.target?.closest?.("#workMobileHeader")) closeCreateMenu();\n  }\n\n  function setCreateMenuOutsideClickBound(bound) {\n    if (bound === createMenuOutsideClickBound) return;\n    createMenuOutsideClickBound = bound;\n    window.__WB_CREATE_MENU_V309__.bound = bound;\n    if (bound) {\n      window.__WB_CREATE_MENU_V309__.bindAdds += 1;\n      document.addEventListener('click', handleCreateMenuOutsideClick);\n    } else {\n      window.__WB_CREATE_MENU_V309__.bindRemoves += 1;\n      document.removeEventListener('click', handleCreateMenuOutsideClick);\n    }\n  }`;
      if (!body.includes(stateNeedle)) throw new Error('Ver.309 lifecycle state insertion point not found');
      body = body.replace(stateNeedle, lifecycle);
      body = body.replace(permanentListener, '');

      const toggleNeedle = `    menu.classList.toggle("open", open);\n    button?.setAttribute("aria-expanded", open ? "true" : "false");`;
      const toggleReplacement = `${toggleNeedle}\n    setCreateMenuOutsideClickBound(open);`;
      if (!body.includes(toggleNeedle)) throw new Error('Ver.309 toggle lifecycle insertion point not found');
      body = body.replace(toggleNeedle, toggleReplacement);

      const closeNeedle = `    document.getElementById("workMobileCreateMenu")?.classList.remove("open");\n    document.querySelector(".work-mobile-action-button")?.setAttribute("aria-expanded", "false");`;
      const closeReplacement = `${closeNeedle}\n    setCreateMenuOutsideClickBound(false);`;
      if (!body.includes(closeNeedle)) throw new Error('Ver.309 close lifecycle insertion point not found');
      body = body.replace(closeNeedle, closeReplacement);
    }

    await route.fulfill({ response, body });
  });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, options = {}) {
  await installAudit(page, options);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  const release = await page.evaluate(() => String(window.WORK_BOARD_RELEASE?.version || ''));
  await page.waitForFunction(version => document.documentElement.dataset.firstPaintVersion === version, release, { timeout: 8_000 });
  return release;
}

async function stats(page) {
  return page.evaluate(() => ({ ...window.__WB_CREATE_MENU_V309__ }));
}

async function openCreateMenu(page) {
  await page.locator('.work-mobile-action-button').click();
  await expect(page.locator('#workMobileCreateMenu')).toHaveClass(/open/);
  await expect(page.locator('.work-mobile-action-button')).toHaveAttribute('aria-expanded', 'true');
}

test('Ver.309 baseline: permanent document listener still wakes while create menu is closed', async ({ page }) => {
  await boot(page);
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  expect((await stats(page)).bound).toBe(true);

  const before = (await stats(page)).callbacks;
  await page.locator('#mainContent').click({ position: { x: 12, y: 12 } });
  await page.locator('#mainContent').click({ position: { x: 24, y: 24 } });
  expect((await stats(page)).callbacks).toBeGreaterThanOrEqual(before + 2);
  await expect(page.locator('#workMobileCreateMenu')).not.toHaveClass(/open/);
});

test('Ver.309 candidate: closed menu has no document outside-click wake-ups', async ({ page }) => {
  await boot(page, { candidate: true });
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  expect(await stats(page)).toMatchObject({ callbacks: 0, bindAdds: 0, bindRemoves: 0, bound: false });

  await page.locator('#mainContent').click({ position: { x: 12, y: 12 } });
  await page.locator('#mainContent').click({ position: { x: 24, y: 24 } });
  expect(await stats(page)).toMatchObject({ callbacks: 0, bindAdds: 0, bindRemoves: 0, bound: false });
});

test('Ver.309 candidate: inside header keeps menu open, outside click closes and unbinds', async ({ page }) => {
  await boot(page, { candidate: true });
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

test('Ver.309 candidate: Escape and Schedule action both remove the transient listener', async ({ page }) => {
  await boot(page, { candidate: true });

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

test('Ver.309 candidate: repeated open-close cycles do not accumulate outside-click callbacks', async ({ page }) => {
  await boot(page, { candidate: true });

  for (let index = 0; index < 3; index += 1) {
    await openCreateMenu(page);
    await page.locator('#mainContent').click({ position: { x: 12 + index, y: 12 + index } });
    await expect(page.locator('#workMobileCreateMenu')).not.toHaveClass(/open/);
  }

  expect(await stats(page)).toMatchObject({ callbacks: 3, bindAdds: 3, bindRemoves: 3, bound: false });
});

test('Ver.309 candidate: 861 to 860 late mobile-shell load keeps transient outside-click lifecycle', async ({ page }) => {
  await boot(page, { candidate: true, width: 861 });
  await expect(page.locator('#workMobileHeader')).toHaveCount(0);
  expect(await stats(page)).toMatchObject({ callbacks: 0, bindAdds: 0, bindRemoves: 0, bound: false });

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  await openCreateMenu(page);
  expect((await stats(page)).bound).toBe(true);

  await page.locator('#mainContent').click({ position: { x: 12, y: 12 } });
  await expect(page.locator('#workMobileCreateMenu')).not.toHaveClass(/open/);
  expect(await stats(page)).toMatchObject({ callbacks: 1, bindAdds: 1, bindRemoves: 1, bound: false });
});

test('Ver.309 audit: desktop width does not introduce a mobile create-menu listener', async ({ page }) => {
  await boot(page, { candidate: true, width: 1000 });
  await expect(page.locator('#workMobileHeader')).toHaveCount(0);
  expect(await stats(page)).toMatchObject({ callbacks: 0, bindAdds: 0, bindRemoves: 0, bound: false });
});
