import { test, expect } from '@playwright/test';

const ROOM = 'test-workflow-inbox-archive-visual';

async function installProductionSafetyBoundary(page) {
  await page.addInitScript(({ room }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
      const now = Date.now();
      localStorage.setItem(`work-board-workflow-v152:${room}`, JSON.stringify({
        inbox: {
          '福冨': {
            'visual-inbox-event': {
              taskId: 'visual-task',
              type: 'mention',
              title: '@メンションされました',
              body: '森井：確認をお願いします',
              actor: '森井',
              createdAt: now,
              readAt: 0
            }
          }
        },
        archives: {
          'visual-archive-task': {
            archivedAt: now,
            archivedBy: '福冨',
            reason: 'manual'
          }
        },
        duplicates: {}
      }));
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

async function boot(page, width, height) {
  await page.setViewportSize({ width, height });
  await installProductionSafetyBoundary(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await expect(page.locator('[data-open-personal-inbox-v153]')).toBeVisible({ timeout: 5_000 });
  await page.addStyleTag({ content: `
    *, *::before, *::after {
      animation: none !important;
      transition: none !important;
      caret-color: transparent !important;
    }
  ` });
  await page.waitForTimeout(120);
}

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 2);
}

async function dispatchCurrentClick(page, selector) {
  return page.evaluate(target => {
    const node = document.querySelector(target);
    if (!(node instanceof HTMLElement)) return false;
    node.click();
    return true;
  }, selector);
}

async function captureInbox(page, label) {
  const entry = page.locator('[data-open-personal-inbox-v153]');
  await expect(entry).toBeVisible();
  await expect(entry.locator('.workflow-inbox-entry-badge-v153')).toHaveText('1');
  await expect(entry.locator('.workflow-inbox-entry-badge-v153')).toBeVisible();
  await expect(page.locator('.workflow-inbox-nav-v152')).toHaveCount(0);
  await expect(page.locator('.workflow-archive-nav-v152')).toHaveCount(0);
  await expect(entry).toHaveScreenshot(`workflow-${label}-inbox-entry.png`, { animations: 'disabled' });

  await entry.click();
  const shell = page.locator('.workflow-inbox-shell-v153');
  await expect(shell).toBeVisible();
  await expect(shell).toContainText('@メンションされました');
  await expect(shell).toContainText('森井：確認をお願いします');
  await expect(shell).toHaveScreenshot(`workflow-${label}-inbox-drawer.png`, { animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(shell).toBeHidden();
}

async function captureArchive(page, label) {
  expect(await dispatchCurrentClick(page, '.nav-item[data-layout="tasks"]')).toBeTruthy();
  expect(await dispatchCurrentClick(page, '.nav-filter[data-filter="done"]')).toBeTruthy();

  const context = page.locator('.workflow-archive-context-v153');
  await expect(context).toBeVisible();
  await expect(context.locator('.workflow-archive-access-badge-v153')).toHaveText('1');
  await expect(context).toHaveScreenshot(`workflow-${label}-archive-context.png`, { animations: 'disabled' });

  await context.locator('[data-open-archive-v153]').click();
  const modal = page.locator('.workflow-archive-modal-v153');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('アーカイブ済みタスク');
  await expect(modal).toContainText('アーカイブ 0件 ／ 表示 0件');
  await expect(modal).toHaveScreenshot(`workflow-${label}-archive-modal.png`, { animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
}

for (const view of [
  { label: 'desktop-1366', width: 1366, height: 900 },
  { label: 'mobile-boundary-860', width: 860, height: 900 },
  { label: 'mobile-430', width: 430, height: 900 },
  { label: 'mobile-390', width: 390, height: 844 }
]) {
  test(`workflow notification and archive visual baseline: ${view.label}`, async ({ page }) => {
    test.slow();
    await boot(page, view.width, view.height);
    await captureInbox(page, view.label);
    await captureArchive(page, view.label);
    await expectNoHorizontalOverflow(page);
  });
}
