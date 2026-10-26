import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

async function boot(page, width, room, height = width < 500 ? 844 : 900) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(roomId => {
    if (!sessionStorage.getItem('appearance-v536-bootstrapped')) {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', roomId);
      localStorage.setItem('system-task-users:' + roomId, JSON.stringify(['福冨', '佐藤']));
      sessionStorage.setItem('appearance-v536-bootstrapped', '1');
    }
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
  }, room);
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
  await page.goto('/?room=' + room, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true && window.WORK_BOARD_APPEARANCE_VERSION === '536', undefined, {timeout: 30_000});
}

async function settings(page, width) {
  if (width <= 860) {
    await page.locator('.work-mobile-menu-button').click();
  } else {
    await page.locator('.sidebar').hover();
  }
  await page.locator('#wbOpenSettings').click();
  await expect(page.locator('#wbSettingsDialog')).toBeVisible();
  if (width <= 860) {
    await expect(page.locator('body')).not.toHaveClass(/work-mobile-menu-open/);
    await expect(page.locator('.work-mobile-menu-button')).toHaveAttribute('aria-expanded', 'false');
  }
}

test('Ver.536 Classic remains the default and SIGNAL is opt-in', async ({ page }) => {
  await boot(page, 1366, 'test-v536-default');
  await expect(page.locator('body')).toHaveAttribute('data-wb-design', 'classic');
  await settings(page, 1366);
  await expect(page.locator('#wbToneSettings')).toHaveAttribute('disabled', '');
  await expect(page.locator('#wbToneSettings input[name="wbPreferenceTone"][value="midnight"]')).toBeDisabled();
  await page.locator('input[name="wbPreferenceDesign"][value="signal"]').check();
  await expect(page.locator('body')).toHaveAttribute('data-wb-design', 'signal');
  await expect(page.locator('#wbToneSettings')).not.toHaveAttribute('disabled');
  await expect(page.locator('#wbToneSettings input[name="wbPreferenceTone"][value="midnight"]')).toBeEnabled();
  const tone = await page.locator('body').evaluate(el => getComputedStyle(el).getPropertyValue('--signal-sidebar').trim());
  expect(tone).toBe('#eef2ff');
  await page.locator('input[name="wbPreferenceTone"][value="midnight"]').check();
  await expect(page.locator('body')).toHaveAttribute('data-wb-tone', 'midnight');
  // 新デザインの暗色設定でも、ダイアログ内の文字が明色用の低コントラスト色に戻らない。
  await expect(page.locator('#wbSettingsDialog')).toHaveCSS('background-color', 'rgb(35, 46, 70)');
  await expect(page.locator('#wbSettingsDialog .wb-settings-subtitle')).toHaveCSS('color', 'rgb(194, 207, 226)');
  await expect(page.locator('#wbSettingsDialog .wb-settings-group legend').first()).toHaveCSS('color', 'rgb(237, 243, 255)');
  await expect(page.locator('#wbSettingsDialog .wb-setting-option').first()).toHaveCSS('background-color', 'rgb(41, 56, 82)');
  const dark = await page.locator('body').evaluate(el => getComputedStyle(el).getPropertyValue('--signal-sidebar').trim());
  expect(dark).toBe('#1c2942');
  await page.locator('#wbCloseSettings').click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_APPEARANCE_VERSION === '536');
  await expect(page.locator('body')).toHaveAttribute('data-wb-design', 'signal');
  await expect(page.locator('body')).toHaveAttribute('data-wb-tone', 'midnight');
});

test('Ver.536 reuses existing settings and scopes preference to the selected user', async ({ page }) => {
  await boot(page, 1366, 'test-v536-users');
  await settings(page, 1366);
  await page.locator('input[name="wbPreferenceDesign"][value="signal"]').check();
  await page.locator('[data-wb-existing-setting="manageUsers"]').click();
  await expect(page.locator('#userManageDialog')).toBeVisible();
  await page.locator('#closeUserManage').click();
  // サイドバーはダイアログ表示後に折りたたまれるため、実操作と同じく再展開する。
  await page.locator('.sidebar').hover();
  await expect(page.locator('#currentUserSelect')).toBeVisible();
  await page.locator('#currentUserSelect').selectOption('佐藤');
  await expect(page.locator('body')).toHaveAttribute('data-wb-design', 'classic');
  await page.locator('#currentUserSelect').selectOption('福冨');
  await expect(page.locator('body')).toHaveAttribute('data-wb-design', 'signal');
});

test('Ver.536 keeps calendar/list display and the canonical ToDo create form', async ({ page }) => {
  await boot(page, 1440, 'test-v536-functionality');
  await settings(page, 1440);
  await page.locator('input[name="wbPreferenceDesign"][value="signal"]').check();
  await page.locator('#wbCloseSettings').click();
  await page.locator('.nav-item[data-layout="schedule"]').click();
  // Diagnose the actual route/render state before asserting calendar availability.
  // Never bypass this assertion or remove the schedule regression contract.
  const scheduleControl = page.locator('#scheduleView [data-schedule-mode="calendar"]');
  if (await scheduleControl.count() === 0) {
    const state = await page.evaluate(() => ({
      scheduleHidden: document.getElementById('scheduleView')?.hidden,
      scheduleText: document.getElementById('scheduleView')?.innerText?.slice(0, 350),
      activeNavigation: [...document.querySelectorAll('.nav-item.active')].map(e => e.dataset.layout),
      currentUser: document.getElementById('currentUserSelect')?.value,
      visibleDialog: [...document.querySelectorAll('dialog[open]')].map(e => e.id),
      mainText: document.getElementById('mainContent')?.innerText?.slice(0, 350)
    }));
    console.log('Ver.536 schedule navigation diagnostic:', JSON.stringify(state));
  }
  await expect(scheduleControl).toBeVisible();
  await page.locator('#scheduleView [data-schedule-mode="calendar"]').click();
  await expect(page.locator('#scheduleView .schedule-calendar')).toBeVisible();
  await page.locator('#scheduleView [data-schedule-mode="list"]').click();
  await expect(page.locator('#scheduleView .schedule-list')).toBeVisible();
  await page.locator('.nav-item[data-layout="todos"]').click();
  const correctOrder = await page.locator('#todoView').evaluate(view => {
    const form = view.querySelector('.todo-create-form');
    const list = view.querySelector('[data-todo-lists]');
    return Boolean(form && list && (form.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(correctOrder).toBe(true);
  await expect(page.locator('#todoView [data-todo-form]')).toBeVisible();
});

test('Ver.536 mobile settings are reachable without a second sidebar or horizontal overflow', async ({ page }) => {
  await boot(page, 390, 'test-v536-mobile');
  await settings(page, 390);
  await page.locator('input[name="wbPreferenceDesign"][value="signal"]').check();
  await page.locator('input[name="wbPreferenceTone"][value="midnight"]').check();
  await page.locator('#wbCloseSettings').click();
  const metrics = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    sidebarCount: document.querySelectorAll('aside.sidebar').length,
    design: document.body.dataset.wbDesign,
    tone: document.body.dataset.wbTone
  }));
  expect(metrics.sidebarCount).toBe(1);
  expect(metrics.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(metrics.design).toBe('signal');
  expect(metrics.tone).toBe('midnight');
});

async function settleVisualSidebar(page, width, height) {
  if (width <= 860) return;
  // 設定ボタンに残ったフォーカスとポインターを外し、同じ折りたたみ状態で撮影する。
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(width - 8, height - 8);
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'collapsed');
}

/* 実表示の寸法と配色コントラストを幅ごとに検証する。業務データやFirebaseには触れない。 */
for (const [width, height] of [[1920, 1080], [1366, 768], [390, 844], [320, 800]]) {
  test(`Ver.536 SIGNAL Bright/Midnight remains readable at ${width}x${height}`, async ({ page }) => {
    await boot(page, width, `test-v536-responsive-${width}`, height);
    const screenshotDir = 'test-results/signal-visual-v536';
    await mkdir(screenshotDir, { recursive: true });
    await page.screenshot({ path: `${screenshotDir}/classic-${width}x${height}.png` });
    await settings(page, width);
    await page.locator('input[name="wbPreferenceDesign"][value="signal"]').check();
    await page.locator('#wbCloseSettings').click();
    await expect(page.locator('body')).toHaveAttribute('data-wb-design', 'signal');
    const measure = () => page.evaluate(() => {
      const style = getComputedStyle(document.body);
      const hexToLuminance = raw => {
        const rgb = [1, 3, 5].map(i => parseInt(raw.slice(i, i + 2), 16) / 255);
        const linear = rgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
        return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
      };
      const ink = hexToLuminance(style.getPropertyValue('--signal-text').trim());
      const card = hexToLuminance(style.getPropertyValue('--signal-card').trim());
      const contrast = (Math.max(ink, card) + .05) / (Math.min(ink, card) + .05);
      return {
        width: innerWidth,
        overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
        sidebarCount: document.querySelectorAll('aside.sidebar').length,
        contrast: Number(contrast.toFixed(2)),
        canvas: style.getPropertyValue('--signal-canvas').trim()
      };
    });
    await settleVisualSidebar(page, width, height);
    const bright = await measure();
    await page.screenshot({ path: `${screenshotDir}/signal-bright-${width}x${height}.png` });
    expect(bright.sidebarCount).toBe(1);
    expect(bright.overflow).toBeLessThanOrEqual(1);
    expect(bright.contrast).toBeGreaterThanOrEqual(4.5);
    expect(bright.canvas).toBe('#f7f9fe');
    await settings(page, width);
    await page.locator('input[name="wbPreferenceTone"][value="midnight"]').check();
    await page.locator('#wbCloseSettings').click();
    await settleVisualSidebar(page, width, height);
    const dark = await measure();
    // 本文とカードだけでなく、旧CSS由来のToday小要素も暗色で判読可能にする。
    await expect(page.locator('#todayView .activity-head h4')).toHaveCSS('color', 'rgb(237, 243, 255)');
    await expect(page.locator('#todayView .today-todo-preview-head h4')).toHaveCSS('color', 'rgb(237, 243, 255)');
    await expect(page.locator('#todayView .today-panel-sort-head-v531 > h4').first()).toHaveCSS('color', 'rgb(237, 243, 255)');
    await expect(page.locator('#todayView .todo-preview-empty').first()).toHaveCSS('background-color', 'rgb(41, 56, 82)');
    await expect(page.locator('#todayView .today-empty').first()).toHaveCSS('background-color', 'rgb(41, 56, 82)');
    await page.screenshot({ path: `${screenshotDir}/signal-midnight-${width}x${height}.png` });
    expect(dark.overflow).toBeLessThanOrEqual(1);
    expect(dark.contrast).toBeGreaterThanOrEqual(4.5);
    expect(dark.canvas).toBe('#171f32');
    console.log('SIGNAL_RESPONSIVE_V536 ' + JSON.stringify({ width, height, bright, dark }));
  });
}

/* 5画面の実レンダリングを同一条件で撮影し、ダークテーマの局所的な色抜けを目視監査できるようにする。 */
for (const [width, height] of [[1366, 768], [390, 844]]) {
  test(`Ver.536 five-view visual review in Bright and Midnight at ${width}x${height}`, async ({ page }) => {
    await boot(page, width, `test-v536-fiveviews-${width}`, height);
    const dir = 'test-results/signal-visual-v536';
    await mkdir(dir, { recursive: true });
    for (const tone of ['bright', 'midnight']) {
      await settings(page, width);
      await page.locator('input[name="wbPreferenceDesign"][value="signal"]').check();
      await page.locator(`input[name="wbPreferenceTone"][value="${tone}"]`).check();
      await page.locator('#wbCloseSettings').click();
      for (const layout of ['today', 'todos', 'tasks', 'schedule', 'memo']) {
        if (width <= 860) await page.locator('.work-mobile-menu-button').click();
        else await page.locator('.sidebar').hover();
        const nav = layout === 'memo'
          ? page.locator('.nav-item[data-work-memo-layout]')
          : page.locator(`.nav-item[data-layout="${layout}"]`);
        await nav.click();
        if (layout === 'schedule') {
          await page.locator('#scheduleView [data-schedule-mode="calendar"]').click();
          await expect(page.locator('#scheduleView .schedule-calendar')).toBeVisible();
        }
        await settleVisualSidebar(page, width, height);
        await page.screenshot({ path: `${dir}/signal-${tone}-${layout}-${width}x${height}.png` });
        const widthOverflow = await page.evaluate(() =>
          Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
        expect(widthOverflow).toBeLessThanOrEqual(1);
      }
    }
  });
}
