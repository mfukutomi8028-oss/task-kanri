import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-keydown-lifecycle-v311';

async function installInstrumentation(page, { width = 430, candidate = true } = {}) {
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
    window.__WB_KEYDOWN_V311__ = {
      baselineCallbacks: 0,
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

    const permanentNeedle = `    document.addEventListener("keydown", event => {\n      if (event.key === "Escape") {\n        closeMobileMenu();\n        closeCreateMenu();\n      }\n    });`;
    if (!body.includes(permanentNeedle)) throw new Error('Ver.311 current permanent keydown listener not found');

    if (!candidate) {
      const instrumentedPermanent = `    document.addEventListener("keydown", event => {\n      window.__WB_KEYDOWN_V311__.baselineCallbacks += 1;\n      if (event.key === "Escape") {\n        closeMobileMenu();\n        closeCreateMenu();\n      }\n    });`;
      body = body.replace(permanentNeedle, instrumentedPermanent);
    } else {
      const stateNeedle = `  let createMenuOutsideClickBound = false;`;
      const stateReplacement = `${stateNeedle}\n  let mobileEscapeKeydownBound = false;\n\n  function handleMobileEscapeKeydown(event) {\n    window.__WB_KEYDOWN_V311__.callbacks += 1;\n    if (event.key !== "Escape") return;\n    closeMobileMenu();\n    closeCreateMenu();\n  }\n\n  function syncMobileEscapeKeydownBound() {\n    const shouldBind = Boolean(\n      document.body?.classList.contains("work-mobile-menu-open") ||\n      document.getElementById("workMobileCreateMenu")?.classList.contains("open")\n    );\n    if (mobileEscapeKeydownBound === shouldBind) return;\n    mobileEscapeKeydownBound = shouldBind;\n    window.__WB_KEYDOWN_V311__.bound = shouldBind;\n    if (shouldBind) {\n      window.__WB_KEYDOWN_V311__.bindAdds += 1;\n      document.addEventListener("keydown", handleMobileEscapeKeydown);\n      return;\n    }\n    window.__WB_KEYDOWN_V311__.bindRemoves += 1;\n    document.removeEventListener("keydown", handleMobileEscapeKeydown);\n  }`;
      const closeMobileNeedle = `  function closeMobileMenu() {\n    document.body?.classList.remove("work-mobile-menu-open");\n    syncMobileMenuButton();\n  }`;
      const closeMobileReplacement = `  function closeMobileMenu() {\n    document.body?.classList.remove("work-mobile-menu-open");\n    syncMobileMenuButton();\n    syncMobileEscapeKeydownBound();\n  }`;
      const toggleCreateNeedle = `  function toggleCreateMenu() {\n    const menu = document.getElementById("workMobileCreateMenu");\n    const button = document.querySelector(".work-mobile-action-button");\n    if (!menu) return;\n    const open = !menu.classList.contains("open");\n    menu.classList.toggle("open", open);\n    button?.setAttribute("aria-expanded", open ? "true" : "false");\n    setCreateMenuOutsideClickBound(open);\n  }`;
      const toggleCreateReplacement = `  function toggleCreateMenu() {\n    const menu = document.getElementById("workMobileCreateMenu");\n    const button = document.querySelector(".work-mobile-action-button");\n    if (!menu) return;\n    const open = !menu.classList.contains("open");\n    menu.classList.toggle("open", open);\n    button?.setAttribute("aria-expanded", open ? "true" : "false");\n    setCreateMenuOutsideClickBound(open);\n    syncMobileEscapeKeydownBound();\n  }`;
      const closeCreateNeedle = `  function closeCreateMenu() {\n    document.getElementById("workMobileCreateMenu")?.classList.remove("open");\n    document.querySelector(".work-mobile-action-button")?.setAttribute("aria-expanded", "false");\n    setCreateMenuOutsideClickBound(false);\n  }`;
      const closeCreateReplacement = `  function closeCreateMenu() {\n    document.getElementById("workMobileCreateMenu")?.classList.remove("open");\n    document.querySelector(".work-mobile-action-button")?.setAttribute("aria-expanded", "false");\n    setCreateMenuOutsideClickBound(false);\n    syncMobileEscapeKeydownBound();\n  }`;

      for (const [needle, label] of [
        [stateNeedle, 'state marker'],
        [closeMobileNeedle, 'closeMobileMenu'],
        [toggleCreateNeedle, 'toggleCreateMenu'],
        [closeCreateNeedle, 'closeCreateMenu']
      ]) {
        if (!body.includes(needle)) throw new Error(`Ver.311 ${label} not found`);
      }

      body = body
        .replace(stateNeedle, stateReplacement)
        .replace(permanentNeedle, '')
        .replace(closeMobileNeedle, closeMobileReplacement)
        .replace(toggleCreateNeedle, toggleCreateReplacement)
        .replace(closeCreateNeedle, closeCreateReplacement);
    }

    body = `window.__WB_KEYDOWN_V311__.shellRequests += 1;\n${body}`;
    await route.fulfill({ response, body });
  });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, options = {}) {
  await installInstrumentation(page, options);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  const release = await page.evaluate(() => String(window.WORK_BOARD_RELEASE?.version || ''));
  await page.waitForFunction(version => document.documentElement.dataset.firstPaintVersion === version, release, { timeout: 8_000 });
  return release;
}

async function stats(page) {
  return page.evaluate(() => ({ ...window.__WB_KEYDOWN_V311__ }));
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
  const overlayBox = await page.locator('.work-mobile-overlay').boundingBox();
  expect(overlayBox).not.toBeNull();
  await page.mouse.click(
    overlayBox.x + overlayBox.width - 8,
    overlayBox.y + overlayBox.height / 2
  );
}

test('Ver.311 baseline: current permanent keydown listener wakes while transient UI is closed', async ({ page }) => {
  expect(await boot(page, { candidate: false })).toBe('276');
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  expect(await stats(page)).toMatchObject({ baselineCallbacks: 1, shellRequests: 1 });
  await expect(page.locator('body')).not.toHaveClass(/work-mobile-menu-open/);
  await expect(page.locator('#workMobileCreateMenu')).not.toHaveClass(/open/);
});

test('Ver.311 candidate: closed transient UI has no keydown wake-ups', async ({ page }) => {
  expect(await boot(page)).toBe('276');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  expect(await stats(page)).toMatchObject({ callbacks: 0, bindAdds: 0, bindRemoves: 0, bound: false, shellRequests: 1 });
});

test('Ver.311 candidate: create menu binds once, ignores non-Escape state changes, and Escape unbinds', async ({ page }) => {
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

test('Ver.311 candidate: mobile drawer binds once and Escape closes and unbinds', async ({ page }) => {
  await boot(page);
  await openDrawer(page);
  expect(await stats(page)).toMatchObject({ bindAdds: 1, bindRemoves: 0, bound: true });

  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/work-mobile-menu-open/);
  expect(await stats(page)).toMatchObject({ callbacks: 1, bindAdds: 1, bindRemoves: 1, bound: false });
});

test('Ver.311 candidate: drawer and create-menu overlap still owns one keydown listener', async ({ page }) => {
  await boot(page);
  await openDrawer(page);
  await openCreateMenu(page);
  await expect(page.locator('body')).toHaveClass(/work-mobile-menu-open/);
  await expect(page.locator('#workMobileCreateMenu')).toHaveClass(/open/);
  expect(await stats(page)).toMatchObject({ bindAdds: 1, bindRemoves: 0, bound: true });

  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/work-mobile-menu-open/);
  await expect(page.locator('#workMobileCreateMenu')).not.toHaveClass(/open/);
  expect(await stats(page)).toMatchObject({ callbacks: 1, bindAdds: 1, bindRemoves: 1, bound: false });
});

test('Ver.311 candidate: overlay, nav, and repeated cycles leave no stale listener', async ({ page }) => {
  await boot(page);

  await openDrawer(page);
  await clickExposedOverlay(page);
  await expect(page.locator('body')).not.toHaveClass(/work-mobile-menu-open/);
  expect(await stats(page)).toMatchObject({ bindAdds: 1, bindRemoves: 1, bound: false });

  await openDrawer(page);
  await page.locator('.nav .nav-item').first().click();
  await expect(page.locator('body')).not.toHaveClass(/work-mobile-menu-open/);
  expect(await stats(page)).toMatchObject({ bindAdds: 2, bindRemoves: 2, bound: false });

  for (let index = 0; index < 3; index += 1) {
    await openCreateMenu(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#workMobileCreateMenu')).not.toHaveClass(/open/);
  }
  expect(await stats(page)).toMatchObject({ bindAdds: 5, bindRemoves: 5, bound: false });
});

test('Ver.311 candidate: 861 to 860 late mobile-shell load keeps transient keydown lifecycle', async ({ page }) => {
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

test('Ver.311 candidate: desktop width does not load mobile shell or bind keydown listener', async ({ page }) => {
  await boot(page, { width: 1000 });
  await expect(page.locator('#workMobileHeader')).toHaveCount(0);
  await page.keyboard.press('Escape');
  expect(await stats(page)).toMatchObject({ callbacks: 0, bindAdds: 0, bindRemoves: 0, bound: false, shellRequests: 0 });
});