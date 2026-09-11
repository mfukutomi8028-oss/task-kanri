import { test, expect } from '@playwright/test';

const ROOM = 'test-sidebar-visual';

async function installProductionSafetyBoundary(page) {
  await page.addInitScript(({ room }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
    } catch {}

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, width, height = 900) {
  await page.setViewportSize({ width, height });
  await installProductionSafetyBoundary(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await page.waitForTimeout(300);
}

async function settleCollapsed(page) {
  const viewport = page.viewportSize();
  await page.mouse.move(Math.max(340, viewport.width - 24), 240);
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  await expect.poll(() => page.locator('.sidebar').evaluate(node => node.getBoundingClientRect().width), {
    timeout: 3_000
  }).toBeLessThanOrEqual(70);
}

async function expand(page) {
  await page.locator('.sidebar').hover();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });
  await expect.poll(() => page.locator('.sidebar').evaluate(node => node.getBoundingClientRect().width), {
    timeout: 3_000
  }).toBeGreaterThan(260);
}

async function pin(page) {
  await expand(page);
  const pinButton = page.locator('.desktop-sidebar-pin-v158');
  await expect(pinButton).toBeVisible();
  await pinButton.click();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'pinned', { timeout: 3_000 });
  await expect.poll(() => page.locator('.sidebar').evaluate(node => node.getBoundingClientRect().width), {
    timeout: 3_000
  }).toBeGreaterThan(260);
  await page.waitForTimeout(240);
}

async function geometry(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const node = document.querySelector(selector);
      const box = node?.getBoundingClientRect();
      return box ? { left: box.left, right: box.right, width: box.width } : null;
    };
    return {
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      sidebar: rect('.sidebar'),
      shell: rect('.app-shell'),
      main: rect('.main'),
      state: document.body.dataset.desktopSidebarState || '',
      desktopClass: document.body.classList.contains('desktop-sidebar-v158'),
      pinDisplay: getComputedStyle(document.querySelector('.desktop-sidebar-pin-v158')).display
    };
  });
}

async function expectDesktopCollapsed(page) {
  const value = await geometry(page);
  expect(value.desktopClass).toBeTruthy();
  expect(value.state).toBe('collapsed');
  expect(value.sidebar.width).toBeGreaterThanOrEqual(66);
  expect(value.sidebar.width).toBeLessThanOrEqual(70);
  expect(value.shell.left).toBeGreaterThanOrEqual(66);
  expect(value.shell.left).toBeLessThanOrEqual(70);
  expect(value.pinDisplay).toBe('none');
  expect(value.scrollWidth).toBeLessThanOrEqual(value.viewport + 2);
  return value;
}

async function expectExpandedOverlay(page, collapsedShellLeft) {
  const value = await geometry(page);
  expect(value.state).toBe('expanded');
  expect(value.sidebar.width).toBeGreaterThan(260);
  expect(Math.abs(value.shell.left - collapsedShellLeft), 'hover expansion must remain an overlay').toBeLessThanOrEqual(3);
  expect(value.pinDisplay).toBe('flex');
  expect(value.scrollWidth).toBeLessThanOrEqual(value.viewport + 2);
  return value;
}

async function expectPinnedReservation(page) {
  const value = await geometry(page);
  expect(value.state).toBe('pinned');
  expect(value.sidebar.width).toBeGreaterThan(260);
  expect(value.shell.left).toBeGreaterThan(270);
  expect(value.shell.left).toBeLessThan(282);
  expect(value.pinDisplay).toBe('flex');
  expect(value.scrollWidth).toBeLessThanOrEqual(value.viewport + 2);
  return value;
}

const DESKTOP_CASES = [1366, 981, 980, 861];

for (const width of DESKTOP_CASES) {
  test(`sidebar geometry: ${width}px collapsed expanded pinned`, async ({ page }) => {
    test.slow();
    await boot(page, width);
    await settleCollapsed(page);
    const collapsed = await expectDesktopCollapsed(page);

    await expand(page);
    await expectExpandedOverlay(page, collapsed.shell.left);

    await pin(page);
    await expectPinnedReservation(page);
  });
}

test('sidebar boundary: 860px returns to non-desktop layout', async ({ page }) => {
  await boot(page, 860);
  const value = await geometry(page);
  expect(value.desktopClass).toBeFalsy();
  expect(value.state).toBe('');
  expect(value.pinDisplay).toBe('none');
  expect(value.scrollWidth).toBeLessThanOrEqual(value.viewport + 2);
});

for (const width of [1366, 980, 861]) {
  test(`sidebar geometry remains stable with detail-open at ${width}px`, async ({ page }) => {
    await boot(page, width);
    await settleCollapsed(page);
    const before = await geometry(page);
    await page.locator('.app-shell').evaluate(node => node.classList.add('detail-open'));
    await page.waitForTimeout(80);
    const after = await geometry(page);

    expect(after.state).toBe('collapsed');
    expect(after.sidebar.width).toBeGreaterThanOrEqual(66);
    expect(after.sidebar.width).toBeLessThanOrEqual(70);
    expect(Math.abs(after.shell.left - before.shell.left), 'detail-open must not move the collapsed sidebar reservation').toBeLessThanOrEqual(3);
    expect(after.scrollWidth).toBeLessThanOrEqual(after.viewport + 2);
  });
}

// The full-sidebar PNG baseline used to include the product brand. Brand changes are
// intentional and independent from sidebar geometry, so those screenshots became
// false positives. Navigation icon visuals are already covered by icon-visual.spec.mjs.
// Keep this suite focused on responsive sidebar state, spacing and brand visibility.
const PRESENTATION_CASES = [
  { width: 1366, state: 'collapsed' },
  { width: 1366, state: 'expanded' },
  { width: 1366, state: 'pinned' },
  { width: 980, state: 'collapsed' },
  { width: 980, state: 'expanded' },
  { width: 980, state: 'pinned' },
  { width: 861, state: 'collapsed' },
  { width: 861, state: 'expanded' }
];

for (const entry of PRESENTATION_CASES) {
  test(`sidebar presentation: ${entry.width}px ${entry.state}`, async ({ page }) => {
    await boot(page, entry.width);
    await settleCollapsed(page);

    const collapsed = await expectDesktopCollapsed(page);
    if (entry.state === 'expanded') {
      await expand(page);
      await expectExpandedOverlay(page, collapsed.shell.left);
    }
    if (entry.state === 'pinned') {
      await pin(page);
      await expectPinnedReservation(page);
    }

    const brand = page.locator('.sidebar .brand');
    if (entry.state === 'collapsed') {
      await expect(brand).toBeHidden();
    } else {
      await expect(brand).toBeVisible();
    }

    const nav = page.locator('.sidebar .nav');
    await expect(nav).toBeVisible();
    const metrics = await nav.evaluate(node => {
      const box = node.getBoundingClientRect();
      return {
        width: box.width,
        height: box.height,
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth
      };
    });
    expect(metrics.width).toBeGreaterThan(40);
    expect(metrics.height).toBeGreaterThan(200);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2);
  });
}

test('browser tab icon is refreshed to the current brand asset', async ({ page }) => {
  await boot(page, 1366);
  const icons = await page.locator('head link').evaluateAll(nodes =>
    nodes.map(node => ({
      rel: node.getAttribute('rel') || '',
      type: node.getAttribute('type') || '',
      href: node.getAttribute('href') || ''
    }))
  );

  expect(icons.some(icon =>
    icon.rel.split(/\s+/).includes('icon') &&
    icon.type === 'image/svg+xml' &&
    /assets\/brand-v184\.svg\?v=185$/.test(icon.href)
  )).toBeTruthy();

  expect(icons.some(icon =>
    icon.rel.split(/\s+/).includes('icon') &&
    icon.type === 'image/png' &&
    /assets\/brand-v184\.png\?v=185$/.test(icon.href)
  )).toBeTruthy();
});
