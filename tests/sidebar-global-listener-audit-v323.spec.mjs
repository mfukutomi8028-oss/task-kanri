import { test, expect } from '@playwright/test';

const ROOM = 'test-sidebar-global-listener-audit-v323';

const CURRENT_BLOCK = `    document.addEventListener("keydown", event => {
      pointerNavActivation = false;
      if (event.key !== "Escape" || pinned) return;
      setExpanded(false);
    });

    document.addEventListener("dragend", () => scheduleCollapse(180), true);
    document.addEventListener("drop", () => scheduleCollapse(180), true);`;

const CURRENT_INSTRUMENTED_BLOCK = `    window.__WB_SIDEBAR_GLOBAL_V323__.bindAdds += 3;
    window.__WB_SIDEBAR_GLOBAL_V323__.bound = true;
    document.addEventListener("keydown", event => {
      window.__WB_SIDEBAR_GLOBAL_V323__.callbacks.keydown += 1;
      pointerNavActivation = false;
      if (event.key !== "Escape" || pinned) return;
      setExpanded(false);
    });

    document.addEventListener("dragend", () => {
      window.__WB_SIDEBAR_GLOBAL_V323__.callbacks.dragend += 1;
      scheduleCollapse(180);
    }, true);
    document.addEventListener("drop", () => {
      window.__WB_SIDEBAR_GLOBAL_V323__.callbacks.drop += 1;
      scheduleCollapse(180);
    }, true);`;

const CANDIDATE_HELPERS = `  let documentLifecycleBoundV323 = false;

  function handleDocumentKeydownV323(event) {
    window.__WB_SIDEBAR_GLOBAL_V323__.callbacks.keydown += 1;
    pointerNavActivation = false;
    if (event.key !== "Escape" || pinned) return;
    setExpanded(false);
  }

  function handleDocumentDragEndV323() {
    window.__WB_SIDEBAR_GLOBAL_V323__.callbacks.dragend += 1;
    scheduleCollapse(180);
  }

  function handleDocumentDropV323() {
    window.__WB_SIDEBAR_GLOBAL_V323__.callbacks.drop += 1;
    scheduleCollapse(180);
  }

  function syncDocumentLifecycleV323() {
    const shouldBind = Boolean(media.matches && !pinned && expanded);
    if (documentLifecycleBoundV323 === shouldBind) return;
    documentLifecycleBoundV323 = shouldBind;
    window.__WB_SIDEBAR_GLOBAL_V323__.bound = shouldBind;
    if (shouldBind) {
      window.__WB_SIDEBAR_GLOBAL_V323__.bindAdds += 3;
      document.addEventListener("keydown", handleDocumentKeydownV323);
      document.addEventListener("dragend", handleDocumentDragEndV323, true);
      document.addEventListener("drop", handleDocumentDropV323, true);
      return;
    }
    window.__WB_SIDEBAR_GLOBAL_V323__.bindRemoves += 3;
    document.removeEventListener("keydown", handleDocumentKeydownV323);
    document.removeEventListener("dragend", handleDocumentDragEndV323, true);
    document.removeEventListener("drop", handleDocumentDropV323, true);
  }`;

const BIND_EVENTS_NEEDLE = `  function bindEvents() {`;
const APPLY_STATE_NEEDLE = `  function applyState() {
    const body = document.body;
    if (!body) return;`;
const APPLY_STATE_CANDIDATE = `  function applyState() {
    const body = document.body;
    if (!body) return;
    syncDocumentLifecycleV323();`;

async function installAudit(page, { mode = 'current', width = 1366 } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ room, mode }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
    window.__WB_SIDEBAR_GLOBAL_V323__ = {
      mode,
      callbacks: { keydown: 0, dragend: 0, drop: 0 },
      bindAdds: 0,
      bindRemoves: 0,
      bound: false,
      scriptRequests: 0
    };
  }, { room: ROOM, mode });

  await page.route(/\/desktop-sidebar-v242\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let body = await response.text();
    if (!body.includes(CURRENT_BLOCK)) throw new Error('Ver.323 audit target listener block not found');

    if (mode === 'current') {
      body = body.replace(CURRENT_BLOCK, CURRENT_INSTRUMENTED_BLOCK);
    } else {
      if (!body.includes(APPLY_STATE_NEEDLE)) throw new Error('Ver.323 audit applyState target not found');
      if (!body.includes(BIND_EVENTS_NEEDLE)) throw new Error('Ver.323 audit bindEvents target not found');
      body = body
        .replace(BIND_EVENTS_NEEDLE, `${CANDIDATE_HELPERS}\n\n${BIND_EVENTS_NEEDLE}`)
        .replace(CURRENT_BLOCK, `    syncDocumentLifecycleV323();`)
        .replace(APPLY_STATE_NEEDLE, APPLY_STATE_CANDIDATE);
    }

    body = `window.__WB_SIDEBAR_GLOBAL_V323__.scriptRequests += 1;\n${body}`;
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
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await page.waitForTimeout(300);
}

async function stats(page) {
  return page.evaluate(() => JSON.parse(JSON.stringify(window.__WB_SIDEBAR_GLOBAL_V323__)));
}

async function moveAway(page) {
  const viewport = page.viewportSize();
  await page.mouse.move(Math.max(340, viewport.width - 24), 240);
}

async function settleCollapsed(page) {
  await moveAway(page);
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
}

async function dispatchDocumentDrag(page, type) {
  await page.evaluate(eventType => {
    document.dispatchEvent(new DragEvent(eventType, { bubbles: true }));
  }, type);
}

test('Ver.323 audit: current owner wakes keydown/dragend/drop listeners while desktop sidebar is idle', async ({ page }) => {
  await boot(page, { mode: 'current', width: 1366 });
  await settleCollapsed(page);
  expect(await stats(page)).toMatchObject({ bindAdds: 3, bindRemoves: 0, bound: true, scriptRequests: 1 });

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await dispatchDocumentDrag(page, 'dragend');
  await dispatchDocumentDrag(page, 'drop');
  await page.waitForTimeout(240);

  expect(await stats(page)).toMatchObject({
    callbacks: { keydown: 2, dragend: 1, drop: 1 },
    bindAdds: 3,
    bindRemoves: 0,
    bound: true
  });
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed');
});

test('Ver.323 audit: current owner keeps the same global listeners alive below the desktop boundary', async ({ page }) => {
  await boot(page, { mode: 'current', width: 800 });
  await expect(page.locator('body')).not.toHaveAttribute('data-desktop-sidebar-state', /.+/);
  expect(await stats(page)).toMatchObject({ bindAdds: 3, bindRemoves: 0, bound: true, scriptRequests: 1 });

  await page.keyboard.press('ArrowRight');
  await dispatchDocumentDrag(page, 'dragend');
  expect(await stats(page)).toMatchObject({ callbacks: { keydown: 1, dragend: 1, drop: 0 } });
});

test('Ver.323 candidate: collapsed and non-desktop states have zero document-listener wake-ups', async ({ page }) => {
  await boot(page, { mode: 'candidate', width: 1366 });
  await settleCollapsed(page);
  expect(await stats(page)).toMatchObject({ bindAdds: 0, bindRemoves: 0, bound: false, scriptRequests: 1 });

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await dispatchDocumentDrag(page, 'dragend');
  await dispatchDocumentDrag(page, 'drop');
  expect(await stats(page)).toMatchObject({
    callbacks: { keydown: 0, dragend: 0, drop: 0 },
    bindAdds: 0,
    bindRemoves: 0,
    bound: false
  });

  await page.setViewportSize({ width: 800, height: 900 });
  await page.keyboard.press('Escape');
  await dispatchDocumentDrag(page, 'dragend');
  expect(await stats(page)).toMatchObject({ callbacks: { keydown: 0, dragend: 0, drop: 0 }, bound: false });
});

test('Ver.323 candidate: keyboard expansion owns listeners only until Escape collapses it', async ({ page }) => {
  await boot(page, { mode: 'candidate', width: 1366 });
  await settleCollapsed(page);

  const today = page.locator('.nav-item[data-layout="today"]').first();
  await today.focus();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  expect(await stats(page)).toMatchObject({ bindAdds: 3, bindRemoves: 0, bound: true });

  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  await expect.poll(() => today.evaluate(node => document.activeElement === node)).toBeTruthy();
  expect(await stats(page)).toMatchObject({
    callbacks: { keydown: 1, dragend: 0, drop: 0 },
    bindAdds: 3,
    bindRemoves: 3,
    bound: false
  });
});

test('Ver.323 candidate: drag reveal keeps global cleanup until dragend then releases it', async ({ page }) => {
  await boot(page, { mode: 'candidate', width: 1366 });
  await settleCollapsed(page);

  await page.locator('.sidebar').evaluate(node => {
    node.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
  });
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  expect(await stats(page)).toMatchObject({ bindAdds: 3, bound: true });

  await moveAway(page);
  await dispatchDocumentDrag(page, 'dragend');
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  expect(await stats(page)).toMatchObject({
    callbacks: { keydown: 0, dragend: 1, drop: 0 },
    bindAdds: 3,
    bindRemoves: 3,
    bound: false
  });
});

test('Ver.323 candidate: pinning or leaving desktop releases transient document ownership', async ({ page }) => {
  await boot(page, { mode: 'candidate', width: 1366 });
  await settleCollapsed(page);

  await page.locator('.sidebar').hover();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  expect(await stats(page)).toMatchObject({ bindAdds: 3, bound: true });

  await page.locator('.desktop-sidebar-pin-v158').click();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'pinned', { timeout: 3_000 });
  expect(await stats(page)).toMatchObject({ bindAdds: 3, bindRemoves: 3, bound: false });

  await page.keyboard.press('Escape');
  expect(await stats(page)).toMatchObject({ callbacks: { keydown: 0, dragend: 0, drop: 0 } });

  await page.locator('.desktop-sidebar-pin-v158').click();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  await page.locator('.nav-item[data-layout="today"]').first().focus();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  expect(await stats(page)).toMatchObject({ bindAdds: 6, bindRemoves: 3, bound: true });

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('body')).not.toHaveAttribute('data-desktop-sidebar-state', /.+/, { timeout: 3_000 });
  expect(await stats(page)).toMatchObject({ bindAdds: 6, bindRemoves: 6, bound: false });
});
