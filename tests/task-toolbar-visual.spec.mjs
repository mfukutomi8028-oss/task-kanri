import { test, expect } from '@playwright/test';

const ROOM = 'test-task-toolbar-visual';

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

async function bootTaskView(page, width, height = 900) {
  await page.setViewportSize({ width, height });
  await installProductionSafetyBoundary(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });

  await page.locator('.nav-item[data-layout="tasks"]').evaluate(button => button.click());
  await expect(page.locator('body')).toHaveClass(/task-mode/);
  await expect(page.locator('.toolbar')).toBeVisible();
  await settleDesktopSidebar(page);
}

async function settleDesktopSidebar(page) {
  const viewport = page.viewportSize();
  await page.mouse.move(Math.max(340, viewport.width - 30), 240);
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed');
  await expect.poll(async () => page.locator('.sidebar').evaluate(node => node.getBoundingClientRect().width))
    .toBeLessThanOrEqual(70);
}

async function expandDesktopSidebar(page) {
  await page.locator('.sidebar').hover();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded');
  await expect.poll(async () => page.locator('.sidebar').evaluate(node => node.getBoundingClientRect().width))
    .toBeGreaterThan(260);
}

async function pinDesktopSidebar(page) {
  await expandDesktopSidebar(page);
  const pin = page.locator('.desktop-sidebar-pin-v158');
  await expect(pin).toBeVisible();
  await pin.click();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'pinned');
  await expect.poll(async () => page.locator('.sidebar').evaluate(node => node.getBoundingClientRect().width))
    .toBeGreaterThan(260);
}

async function setDetailOpen(page, open) {
  await page.locator('.app-shell').evaluate((node, shouldOpen) => {
    node.classList.toggle('detail-open', shouldOpen);
  }, open);
  await expect(page.locator('.app-shell')).toHaveClass(open ? /detail-open/ : /^(?!.*detail-open)/);
}

async function freezeMotion(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `
  });
}

async function assertToolbarGeometry(page) {
  const geometry = await page.evaluate(() => {
    const toolbar = document.querySelector('.toolbar');
    const quick = document.querySelector('.quick-add');
    const quickInput = document.querySelector('.quick-add input');
    const quickButton = document.querySelector('#quickAddButton');
    const search = document.querySelector('.search-box');
    const sort = document.querySelector('#sortSelect');
    const rect = element => {
      const box = element?.getBoundingClientRect();
      return box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width } : null;
    };
    return {
      toolbar: rect(toolbar),
      quick: rect(quick),
      quickInput: rect(quickInput),
      quickButton: rect(quickButton),
      search: rect(search),
      sort: rect(sort),
      quickButtonClipped: quickButton ? quickButton.scrollWidth > quickButton.clientWidth + 1 : true
    };
  });

  expect(geometry.toolbar).not.toBeNull();
  expect(geometry.quick).not.toBeNull();
  expect(geometry.quickInput?.width || 0).toBeGreaterThan(40);
  expect(geometry.search?.width || 0).toBeGreaterThan(80);
  expect(geometry.quickButtonClipped).toBeFalsy();

  const ordered = [geometry.quick, geometry.search, geometry.sort].filter(Boolean);
  for (let index = 1; index < ordered.length; index += 1) {
    expect(ordered[index - 1].right).toBeLessThanOrEqual(ordered[index].left + 1);
  }
}

async function captureToolbar(page, name) {
  await freezeMotion(page);
  await assertToolbarGeometry(page);
  await expect(page.locator('.toolbar')).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.001
  });
}

const collapsedOpenCases = [
  { width: 1920, name: 'toolbar-1920-collapsed-detail-open.png' },
  { width: 1450, name: 'toolbar-1450-collapsed-detail-open.png' },
  { width: 1449, name: 'toolbar-1449-collapsed-detail-open.png' }
];

for (const entry of collapsedOpenCases) {
  test(`task toolbar visual baseline: ${entry.width}px collapsed detail-open`, async ({ page }) => {
    await bootTaskView(page, entry.width);
    await setDetailOpen(page, true);
    await captureToolbar(page, entry.name);
  });
}

test('task toolbar visual baseline: 1920px expanded detail-open', async ({ page }) => {
  await bootTaskView(page, 1920);
  await setDetailOpen(page, true);
  await expandDesktopSidebar(page);
  await captureToolbar(page, 'toolbar-1920-expanded-detail-open.png');
});

const pinnedOpenCases = [
  { width: 1920, name: 'toolbar-1920-pinned-detail-open.png' },
  { width: 1720, name: 'toolbar-1720-pinned-detail-open.png' },
  { width: 1719, name: 'toolbar-1719-pinned-detail-open.png' }
];

for (const entry of pinnedOpenCases) {
  test(`task toolbar visual baseline: ${entry.width}px pinned detail-open`, async ({ page }) => {
    await bootTaskView(page, entry.width);
    await setDetailOpen(page, true);
    await pinDesktopSidebar(page);
    await captureToolbar(page, entry.name);
  });
}

test('task toolbar visual baseline: 1366px collapsed detail-closed', async ({ page }) => {
  await bootTaskView(page, 1366);
  await setDetailOpen(page, false);
  await captureToolbar(page, 'toolbar-1366-collapsed-detail-closed.png');
});
