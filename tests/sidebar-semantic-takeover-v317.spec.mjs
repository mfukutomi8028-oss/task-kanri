import { test, expect } from '@playwright/test';

const ROOM = 'test-sidebar-semantic-takeover-v317';

async function installSafetyBoundary(page) {
  await page.addInitScript(room => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([]));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, ROOM);

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function suppressSemanticTakeover(page) {
  await page.route(/desktop-sidebar-v242\.js(?:\?|$)/, async route => {
    const response = await route.fetch();
    let source = await response.text();
    const needle = '    labelNavigationButtons();\n    bindEvents();';
    expect(source.includes(needle)).toBe(true);
    source = source.replace(needle, '    bindEvents();');
    await route.fulfill({ response, body: source, contentType: 'application/javascript' });
  });
}

async function waitForBoot(page) {
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === window.WORK_BOARD_RELEASE?.version, undefined, { timeout: 8_000 });
  await expect(page.locator('[data-work-memo-layout]')).toBeAttached({ timeout: 20_000 });
  await page.waitForTimeout(120);
}

async function boot(page, { width = 1366, candidate = false } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await installSafetyBoundary(page);
  if (candidate) await suppressSemanticTakeover(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await waitForBoot(page);
}

async function moveAway(page) {
  const viewport = page.viewportSize();
  await page.mouse.move(Math.max(340, viewport.width - 24), 240);
}

async function expectNoGeneratedSemantics(locator) {
  await expect(locator).not.toHaveAttribute('data-desktop-sidebar-label', /\S+/);
  await expect(locator).not.toHaveAttribute('title', /\S+/);
  await expect(locator).not.toHaveAttribute('aria-label', /\S+/);
}

test('Ver.317 baseline proves semantic decoration is static-only while Work Memo already uses native text naming', async ({ page }) => {
  await boot(page);

  const today = page.getByRole('button', { name: '今日', exact: true });
  await expect(today).toHaveCount(1);
  await expect(today).toHaveAttribute('data-desktop-sidebar-label', '今日');
  await expect(today).toHaveAttribute('title', '今日');
  await expect(today).toHaveAttribute('aria-label', '今日');

  const workMemo = page.getByRole('button', { name: '業務メモ', exact: true });
  await expect(workMemo).toHaveCount(1);
  await expectNoGeneratedSemantics(workMemo);
});

test('Ver.317 candidate keeps accessible navigation and desktop interaction without V158 semantic decoration', async ({ page }) => {
  await boot(page, { candidate: true });
  await moveAway(page);
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });

  const today = page.getByRole('button', { name: '今日', exact: true });
  const tasks = page.getByRole('button', { name: 'タスク', exact: true });
  const workMemo = page.getByRole('button', { name: '業務メモ', exact: true });
  await expect(today).toHaveCount(1);
  await expect(tasks).toHaveCount(1);
  await expect(workMemo).toHaveCount(1);
  await expectNoGeneratedSemantics(today);
  await expectNoGeneratedSemantics(tasks);
  await expectNoGeneratedSemantics(workMemo);

  await page.locator('.sidebar').hover();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });

  await today.focus();
  await expect.poll(() => today.evaluate(node => document.activeElement === node)).toBeTruthy();
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded', { timeout: 3_000 });

  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  await expect.poll(() => today.evaluate(node => document.activeElement === node)).toBeTruthy();

  await workMemo.evaluate(button => button.click());
  await expect(page.locator('body')).toHaveClass(/work-memo-mode-v167/);
  await expect(page.locator('#workMemoViewV167')).toBeVisible();
});

test('Ver.317 candidate preserves the exact 861 -> 860 -> 861 desktop/mobile ownership boundary', async ({ page }) => {
  await boot(page, { width: 861, candidate: true });
  await moveAway(page);
  await expect(page.locator('body')).toHaveClass(/desktop-sidebar-v158/);
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  await expect(page.getByRole('button', { name: '今日', exact: true })).toHaveCount(1);

  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('body')).not.toHaveClass(/desktop-sidebar-v158/, { timeout: 3_000 });
  await expect(page.locator('body')).not.toHaveAttribute('data-desktop-sidebar-state', /.+/);
  await expect(page.locator('#workMobileHeader')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('button', { name: '業務メモ', exact: true })).toHaveCount(1);

  await page.setViewportSize({ width: 861, height: 900 });
  await moveAway(page);
  await expect(page.locator('body')).toHaveClass(/desktop-sidebar-v158/, { timeout: 3_000 });
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed', { timeout: 3_000 });
  await expect(page.getByRole('button', { name: 'タスク', exact: true })).toHaveCount(1);
});
