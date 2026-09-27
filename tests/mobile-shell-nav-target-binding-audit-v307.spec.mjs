import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-shell-nav-target-binding-v307';

async function installAuditHarness(page, { width = 430, candidate = true } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
      {
        id: 'v307-task-1',
        title: 'V307 seeded task',
        status: '未着手',
        assignee: '福冨',
        priority: '中',
        category: 'PC',
        description: '',
        dueDate: '',
        tags: []
      }
    ]));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });

  const metrics = { mobileLoads: 0 };
  await page.route(/\/mobile-shell-v234\.js(?:\?.*)?$/, async route => {
    metrics.mobileLoads += 1;
    if (!candidate) {
      await route.continue();
      return;
    }

    const response = await route.fetch();
    let body = await response.text();
    const current = `  function bindGlobalClicks() {\n    if (window.__workBoardMobileFixClicksV101) return;\n    window.__workBoardMobileFixClicksV101 = true;\n    document.addEventListener("click", event => {\n      if (event.target?.closest?.(".nav-item")) {\n        closeMobileMenu();\n        syncMobileHeaderTitle();\n        patchMobileBoardTabs();\n      }\n    });\n  }`;
    const replacement = `  function bindGlobalClicks() {\n    if (window.__workBoardMobileFixClicksV101) return;\n    window.__workBoardMobileFixClicksV101 = true;\n    document.querySelectorAll(".nav-item").forEach(button => {\n      button.addEventListener("click", () => {\n        closeMobileMenu();\n        syncMobileHeaderTitle();\n        patchMobileBoardTabs();\n      });\n    });\n  }`;
    if (!body.includes(current)) throw new Error('Ver.307 nav target-binding candidate injection point not found');
    body = body.replace(current, replacement);
    await route.fulfill({ response, body });
  });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
  return metrics;
}

async function waitForRelease(page) {
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === '274', undefined, { timeout: 8_000 });
}

async function boot(page, options = {}) {
  const metrics = await installAuditHarness(page, options);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await waitForRelease(page);
  if ((options.width ?? 430) <= 860) await expect(page.locator('#workMobileHeader')).toBeVisible();
  return metrics;
}

async function immediateNavigate(page, selector, { openDrawer = true } = {}) {
  return page.evaluate(({ targetSelector, shouldOpenDrawer }) => {
    if (shouldOpenDrawer) document.querySelector('.work-mobile-menu-button')?.click();
    const nav = document.querySelector(targetSelector);
    if (!nav) throw new Error(`missing nav for ${targetSelector}`);
    nav.click();
    const active = document.querySelector('.nav-item.active');
    return {
      title: document.querySelector('.work-mobile-title-text')?.textContent?.trim() || '',
      expectedTitle: active?.textContent?.trim() || '',
      drawerOpen: document.body.classList.contains('work-mobile-menu-open'),
      statusTabs: document.querySelectorAll('.work-mobile-status-tabs').length,
      activeColumns: document.querySelectorAll('#boardView .work-mobile-active-column').length,
      boardVisible: Boolean(document.getElementById('boardView')?.offsetParent),
      todayVisible: Boolean(document.getElementById('todayView')?.offsetParent),
      guard: Boolean(window.__workBoardMobileFixClicksV101),
      navCount: document.querySelectorAll('.nav-item').length
    };
  }, { targetSelector: selector, shouldOpenDrawer: openDrawer });
}

test('Ver.307 candidate: explicit Tasks target preserves same-task drawer title and board reconciliation', async ({ page }) => {
  await boot(page);

  const immediate = await immediateNavigate(page, '.nav-item[data-layout="tasks"]');
  expect(immediate.guard).toBe(true);
  expect(immediate.navCount).toBe(7);
  expect(immediate.drawerOpen).toBe(false);
  expect(immediate.boardVisible).toBe(true);
  expect(immediate.title).toBe(immediate.expectedTitle);
  expect(immediate.statusTabs).toBe(1);
  expect(immediate.activeColumns).toBe(1);
  expect(await page.locator('.work-mobile-status-tabs').textContent()).toMatch(/未着手\s*1/);
});

test('Ver.307 candidate: Tasks to Today removes board tabs synchronously', async ({ page }) => {
  await boot(page);
  let snapshot = await immediateNavigate(page, '.nav-item[data-layout="tasks"]');
  expect(snapshot.statusTabs).toBe(1);

  snapshot = await immediateNavigate(page, '.nav-item[data-layout="today"]');
  expect(snapshot.drawerOpen).toBe(false);
  expect(snapshot.todayVisible).toBe(true);
  expect(snapshot.title).toBe(snapshot.expectedTitle);
  expect(snapshot.statusTabs).toBe(0);
  expect(snapshot.activeColumns).toBe(0);
});

test('Ver.307 candidate: static filter nav target still reconciles without disturbing Tasks layout', async ({ page }) => {
  await boot(page);
  await immediateNavigate(page, '.nav-item[data-layout="tasks"]', { openDrawer: false });

  const snapshot = await immediateNavigate(page, '.nav-item[data-filter="mine"]');
  expect(snapshot.drawerOpen).toBe(false);
  expect(snapshot.boardVisible).toBe(true);
  expect(snapshot.title).toBe(snapshot.expectedTitle);
  expect(snapshot.statusTabs).toBe(1);
  expect(snapshot.activeColumns).toBe(1);
});

test('Ver.307 candidate: 861 to 860 late load binds existing static nav targets once', async ({ page }) => {
  const metrics = await boot(page, { width: 861 });
  await expect(page.locator('#workMobileHeader')).toHaveCount(0);
  expect(metrics.mobileLoads).toBe(0);

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('#workMobileHeader')).toBeVisible();
  await expect.poll(() => metrics.mobileLoads).toBe(1);

  const immediate = await immediateNavigate(page, '.nav-item[data-layout="tasks"]');
  expect(immediate.guard).toBe(true);
  expect(immediate.navCount).toBe(7);
  expect(immediate.drawerOpen).toBe(false);
  expect(immediate.title).toBe(immediate.expectedTitle);
  expect(immediate.statusTabs).toBe(1);
  expect(immediate.activeColumns).toBe(1);
  expect(metrics.mobileLoads).toBe(1);
});

test('Ver.307 candidate: Ver.304 Schedule create synchronous handoff remains intact', async ({ page }) => {
  await boot(page);
  await immediateNavigate(page, '.nav-item[data-layout="tasks"]', { openDrawer: false });

  await page.locator('.work-mobile-action-button').click();
  await page.locator("[data-mobile-create='schedule']").click();

  await expect(page.locator('#scheduleDialog')).toHaveAttribute('open', '');
  await expect(page.locator('.nav-item[data-layout="schedule"]').first()).toHaveClass(/active/);
  await expect(page.locator('.work-mobile-title-text')).toContainText('スケジュール');
});
