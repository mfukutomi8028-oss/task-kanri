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
    // The desktop sidebar expands after a 70ms hover delay. Clicking a moving
    // collapsed icon can lose pointerup while the button changes position.
    await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded');
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
  await navigateContentV536(page, 1440, 'schedule');
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
  await navigateContentV536(page, 1440, 'todos');
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
    await page.screenshot({ path: `${screenshotDir}/classic-${width}x${height}.png`, animations: 'disabled' });
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
    await page.screenshot({ path: `${screenshotDir}/signal-bright-${width}x${height}.png`, animations: 'disabled' });
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
    // The headline is a nested span with a legacy !important color.
    await expect(page.locator('#todayView .activity-head .activity-title-text')).toHaveCSS('color', 'rgb(237, 243, 255)');
    await expect(page.locator('#todayView .activity-empty p')).toHaveCSS('color', 'rgb(194, 207, 226)');
    await expect(page.locator('#todayView .today-todo-preview-head h4')).toHaveCSS('color', 'rgb(237, 243, 255)');
    await expect(page.locator('#todayView .today-panel:not([data-today-panel-id="overdue"]) .today-panel-sort-head-v531 > h4').first()).toHaveCSS('color', 'rgb(237, 243, 255)');
    await expect(page.locator('#todayView .todo-preview-empty').first()).toHaveCSS('background-color', 'rgb(41, 56, 82)');
    await expect(page.locator('#todayView .today-empty').first()).toHaveCSS('background-color', 'rgb(41, 56, 82)');
    await page.screenshot({ path: `${screenshotDir}/signal-midnight-${width}x${height}.png`, animations: 'disabled' });
    expect(dark.overflow).toBeLessThanOrEqual(1);
    expect(dark.contrast).toBeGreaterThanOrEqual(4.5);
    expect(dark.canvas).toBe('#171f32');
    console.log('SIGNAL_RESPONSIVE_V536 ' + JSON.stringify({ width, height, bright, dark }));
  });
}

/* 5画面の実レンダリングを同一条件で撮影し、ダークテーマの局所的な色抜けを目視監査できるようにする。 */
for (const [width, height] of [[1920, 1080], [1366, 768], [390, 844], [320, 800]]) {
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
        else {
          await page.locator('.sidebar').hover();
          await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded');
        }
        const nav = layout === 'memo'
          ? page.locator('.nav-item[data-work-memo-layout]')
          : page.locator(`.nav-item[data-layout="${layout}"]`);
        // Reject screenshots of a stale view. Verify the navigation state first.
        await nav.click();
        if (width <= 860) {
          await expect(page.locator('body')).not.toHaveClass(/work-mobile-menu-open/);
          await expect(page.locator('.work-mobile-menu-button')).toHaveAttribute('aria-expanded', 'false');
        }
        if (layout === 'memo') {
          await expect(page.locator('body')).toHaveClass(/work-memo-mode-v167/);
          await expect(page.locator('#workMemoViewV167')).toBeVisible();
        }
        if (layout !== 'memo') {
          const classNames = { today: 'today-mode', todos: 'todo-mode', tasks: 'task-mode', schedule: 'schedule-mode' };
          try {
            await page.waitForFunction(expected => document.body.classList.contains(expected), classNames[layout], { timeout: 3500 });
          } catch (error) {
            const state = await page.evaluate(() => ({
              body: document.body.className,
              activeNavigation: [...document.querySelectorAll('.nav-item.active')].map(x => x.dataset.layout),
              content: document.getElementById('mainContent')?.innerText?.slice(0, 250),
              scheduleHidden: document.getElementById('scheduleView')?.hidden,
              scheduleControlCount: document.querySelectorAll('#scheduleView [data-schedule-mode]').length,
              activeUserDialog: [...document.querySelectorAll('dialog[open]')].map(x => x.id)
            }));
            console.log('SIGNAL_NAVIGATION_V536 ' + JSON.stringify({ layout, state }));
            throw error;
          }
        }
        if (layout === 'schedule') {
          await expect(page.locator('#scheduleView [data-schedule-mode="calendar"]')).toBeVisible();
          await page.locator('#scheduleView [data-schedule-mode="calendar"]').click();
          await expect(page.locator('#scheduleView .schedule-calendar')).toBeVisible();
          if (tone === 'midnight') {
            await expect(page.locator('#scheduleView .schedule-head')).toHaveCSS('background-color', 'rgb(35, 46, 70)');
            await expect(page.locator('#scheduleView .schedule-control-group > span').first()).toHaveCSS('color', 'rgb(194, 207, 226)');
            await expect(page.locator('#scheduleView .calendar-cell:not(.muted)').first()).toHaveCSS('background-color', 'rgb(35, 46, 70)');
          }
        }
        // Contrast gates are checked on the actual painted child and surface,
        // not just theme variables. These are scoped to SIGNAL Midnight.
        if (tone === 'midnight' && layout === 'todos') {
          await expect(page.locator('.todo-page-stat-card strong').first()).toHaveCSS('color', 'rgb(237, 243, 255)');
          await expect(page.locator('.todo-workspace .todo-create-form')).toHaveCSS('background-color', 'rgb(41, 56, 82)');
          await expect(page.locator('.todo-workspace .todo-list h5').first()).toHaveCSS('color', 'rgb(237, 243, 255)');
          await expect(page.locator('.todo-workspace .todo-empty').first()).toHaveCSS('color', 'rgb(194, 207, 226)');
        }
        if (tone === 'midnight' && layout === 'tasks') {
          await expect(page.locator('.main .search-box')).toHaveCSS('background-color', 'rgb(41, 56, 82)');
          await expect(page.locator('#quickAddInput')).toHaveCSS('background-color', 'rgb(41, 56, 82)');
          await expect(page.locator('#quickAddInput')).toHaveCSS('color', 'rgb(237, 243, 255)');
          await expect(page.locator('.main .task-view-button:not(.active)').first()).toHaveCSS('color', 'rgb(237, 243, 255)');
        }
        if (tone === 'midnight' && layout === 'memo') {
          await expect(page.locator('.work-memo-search-v167')).toHaveCSS('background-color', 'rgb(41, 56, 82)');
          await expect(page.locator('.work-memo-empty-v167')).toHaveCSS('background-color', 'rgb(41, 56, 82)');
          await expect(page.locator('.work-memo-empty-v167 strong')).toHaveCSS('color', 'rgb(237, 243, 255)');
        }
        await settleVisualSidebar(page, width, height);
        await page.screenshot({ path: `${dir}/signal-${tone}-${layout}-${width}x${height}.png`, animations: 'disabled' });
        const widthOverflow = await page.evaluate(() =>
          Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
        expect(widthOverflow).toBeLessThanOrEqual(1);
      }
    }
  });
}

// 登録済みデータで確認する。試験データは外部通信を遮断した専用ルーム内に限定する。
async function navigateContentV536(page, width, layout) {
  if (width <= 860) {
    await page.locator('.work-mobile-menu-button').click();
  } else {
    await page.locator('.sidebar').hover();
    await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded');
  }
  const nav = layout === 'memo'
    ? page.locator('.nav-item[data-work-memo-layout]')
    : page.locator(`.nav-item[data-layout="${layout}"]`);
  await nav.click();
  if (width <= 860) {
    await expect(page.locator('body')).not.toHaveClass(/work-mobile-menu-open/);
    await expect(page.locator('.work-mobile-menu-button')).toHaveAttribute('aria-expanded', 'false');
  }
  const target = {
    todos: { view: '#todoView', mode: /todo-mode/ },
    memo: { view: '#workMemoViewV167', mode: /work-memo-mode-v167/ },
    schedule: { view: '#scheduleView', mode: /schedule-mode/ }
  }[layout];
  if (!target) throw new Error('Unsupported content layout: ' + layout);
  await expect(page.locator(target.view)).toBeVisible();
  await expect(page.locator('body')).toHaveClass(target.mode);
  // 展開中のサイドバーが本文の操作を遮らないよう、実操作と同じくマウスを本文へ移す。
  await settleVisualSidebar(page, width, page.viewportSize().height);
}

async function readableContentV536(locator, surfaceSelector) {
  await expect(locator).toBeVisible();
  const painted = await locator.evaluate((node, selector) => {
    const surface = node.closest(selector);
    if (!surface) throw new Error('Missing contrast surface: ' + selector);
    const rgba = value => {
      const channels = value.match(/[\d.]+/g)?.map(Number) || [];
      if (channels.length === 3) channels.push(1);
      return channels;
    };
    // 外側のカードではなく、文字から辿って最初の不透明背景を検査する。
    // 半透明や画像の背景は誤って合格にせず、別途検証を要求する。
    let background = null;
    let backgroundOwner = '';
    for (let current = node; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.backgroundImage !== 'none') throw new Error('Non-solid contrast background: ' + current.className);
      const candidate = rgba(style.backgroundColor);
      if (candidate.length !== 4 || (candidate[3] !== 0 && candidate[3] !== 1)) {
        throw new Error('Unsupported contrast background: ' + style.backgroundColor);
      }
      if (candidate[3] === 1) {
        background = candidate;
        backgroundOwner = current.className;
        break;
      }
      if (current === surface) break;
    }
    if (!background) throw new Error('No opaque contrast surface within ' + selector);
    return { foreground: rgba(getComputedStyle(node).color), background, backgroundOwner };
  }, surfaceSelector);
  for (const channels of [painted.foreground, painted.background]) {
    expect(channels).toHaveLength(4);
    expect(channels[3]).toBe(1);
  }
  const luminance = channels => channels.slice(0, 3)
    .map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const a = luminance(painted.foreground), b = luminance(painted.background);
  const contrast = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  expect(contrast, JSON.stringify(painted)).toBeGreaterThanOrEqual(4.5);
  return Number(contrast.toFixed(2));
}

for (const [width, height] of [[1920, 1080], [1366, 768], [390, 844], [320, 800]]) {
  for (const tone of ['bright', 'midnight']) {
    test(`Ver.536 populated ToDo and memo preserve interactions in ${tone} at ${width}x${height}`, async ({ page }) => {
      test.setTimeout(90_000);
      // 操作不能な要素で試験全体を待ち切らず、該当操作のログを残して失敗させる。
      page.setDefaultTimeout(10_000);
      const mark = phase => console.log('SIGNAL_CONTENT_STEP_V536 ' + JSON.stringify({ width, height, tone, phase }));
      const room = `test-v536-content-${tone}-${width}`;
      const dir = 'test-results/signal-visual-v536';
      await mkdir(dir, { recursive: true });
      mark('起動');
      await boot(page, width, room, height);
      await settings(page, width);
      await page.locator('input[name="wbPreferenceDesign"][value="signal"]').check();
      await page.locator(`input[name="wbPreferenceTone"][value="${tone}"]`).check();
      await page.locator('#wbCloseSettings').click();
      await navigateContentV536(page, width, 'todos');

      const title = '表示確認：' + '備品と設定を確認する'.repeat(3);
      const memo = '表示確認用の補足メモです。実際の業務情報は含みません。';
      const secondTitle = '並べ替え確認用ToDo';
      mark('ToDo入力とメモ展開');
      await page.locator('#todayTodoInput').fill(title);
      await page.locator('.todo-compose-details summary').click();
      await page.locator('#todayTodoMemo').fill(memo);
      await page.locator('#todoView .todo-add-button').click();
      const openRows = page.locator('#todoView .todo-list:not(.is-completed) .todo-item');
      await expect(openRows).toHaveCount(1);
      mark('2件目のToDo追加');
      await page.locator('#todayTodoInput').fill(secondTitle);
      await page.locator('#todoView .todo-add-button').click();
      await expect(openRows).toHaveCount(2);
      const beforeOrder = await openRows.locator('.todo-text').allTextContents();
      mark('ToDo並べ替え');
      await openRows.nth(1).locator('.todo-move-button').first().click();
      await expect(openRows.locator('.todo-text')).toHaveText([...beforeOrder].reverse());

      const longRow = openRows.filter({ hasText: title });
      await expect(longRow.locator('.todo-state-toggle-v144')).toBeVisible();
      const overlaps = await longRow.evaluate(row => {
        const text = row.querySelector('.todo-text').getBoundingClientRect();
        const control = row.querySelector('.todo-state-toggle-v144').getBoundingClientRect();
        return Math.min(text.right, control.right) - Math.max(text.left, control.left) > 1 &&
          Math.min(text.bottom, control.bottom) - Math.max(text.top, control.top) > 1;
      });
      expect(overlaps).toBe(false);
      const todoContrast = await readableContentV536(longRow.locator('.todo-text'), '.todo-item');
      mark('ToDo詳細と撮影');
      await longRow.locator('.todo-summary-button').click();
      await expect(longRow.locator('.todo-detail textarea')).toHaveValue(memo);
      const expandedTodoContrast = await readableContentV536(longRow.locator('.todo-text'), '.todo-item');
      await settleVisualSidebar(page, width, height);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${dir}/signal-${tone}-content-todos-${width}x${height}.png`, animations: 'disabled', fullPage: true });
      mark('ToDo完了とデザイン切替');
      await longRow.locator('.todo-state-toggle-v144').click();
      const completedRows = page.locator('#todoView .todo-list.is-completed .todo-item');
      await expect(openRows).toHaveCount(1);
      await expect(completedRows).toHaveCount(1);
      await expect(completedRows.locator('.todo-text')).toHaveText(title);
      const todoState = () => page.locator('#todoView .todo-item').evaluateAll(rows => rows.map(row => ({
        id: row.dataset.todoId, completed: Boolean(row.querySelector('.todo-check')?.checked)
      })));
      const savedTodos = await todoState();
      await settings(page, width);
      await page.locator('input[name="wbPreferenceDesign"][value="classic"]').check();
      await page.locator('#wbCloseSettings').click();
      await expect(page.locator('body')).toHaveAttribute('data-wb-design', 'classic');
      expect(await todoState()).toEqual(savedTodos);
      await settings(page, width);
      await page.locator('input[name="wbPreferenceDesign"][value="signal"]').check();
      await page.locator('#wbCloseSettings').click();
      expect(await todoState()).toEqual(savedTodos);

      mark('業務メモ試験データと再読込');
      const bodyText = Array.from({ length: 36 }, (_, index) => `${index + 1}. 表示確認用の長い手順です。編集画面を開かずに本文をスクロールします。`).join('\n');
      const now = Date.now();
      const memos = {
        'signal-long': { id: 'signal-long', title: '表示確認用：長文の業務メモ', body: bodyText, category: '手順', tags: ['表示確認'], pinned: false, createdAt: now, updatedAt: now },
        'signal-short': { id: 'signal-short', title: '並べ替え確認用メモ', body: memo, category: '手順', tags: [], pinned: false, createdAt: now - 1, updatedAt: now - 1 }
      };
      await page.evaluate(({ roomId, records }) => {
        if (!roomId.startsWith('test-v536-content-') || new URLSearchParams(location.search).get('room') !== roomId) {
          throw new Error('Fixture room mismatch');
        }
        localStorage.setItem('system-business-memos:' + roomId, JSON.stringify(records));
      }, { roomId: room, records: memos });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true && window.WORK_BOARD_APPEARANCE_VERSION === '536');
      await expect(page.locator('body')).toHaveAttribute('data-wb-design', 'signal');
      await expect(page.locator('body')).toHaveAttribute('data-wb-tone', tone);
      await navigateContentV536(page, width, 'todos');
      expect(await todoState()).toEqual(savedTodos);
      await navigateContentV536(page, width, 'memo');
      mark('業務メモ並べ替え');
      const cards = page.locator('#workMemoViewV167 .work-memo-card-v167');
      await expect(cards).toHaveCount(2);
      const memoOrder = await cards.evaluateAll(nodes => nodes.map(node => node.dataset.memoSortId));
      await cards.nth(1).locator('.work-memo-move-v531').first().click();
      await expect.poll(() => cards.evaluateAll(nodes => nodes.map(node => node.dataset.memoSortId))).toEqual([...memoOrder].reverse());
      const longCard = page.locator('[data-memo-sort-id="signal-long"]');
      const memoContrast = await readableContentV536(longCard.locator('h4'), '.work-memo-card-v167');
      const body = longCard.locator('.work-memo-body-v167');
      await expect(body).toHaveText(bodyText);
      expect(await body.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
      mark('長文メモスクロール');
      await body.hover();
      await page.mouse.wheel(0, 420);
      await expect.poll(() => body.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
      await expect(page.locator('#workMemoDialogV167')).not.toBeVisible();
      const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await settleVisualSidebar(page, width, height);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${dir}/signal-${tone}-content-memo-${width}x${height}.png`, animations: 'disabled', fullPage: true });
      console.log('SIGNAL_CONTENT_V536 ' + JSON.stringify({ width, height, tone, todoContrast, expandedTodoContrast, memoContrast, overflow }));
    });
  }
}

// D3配置・件数・保存順の回帰。外部通信は既存bootで遮断する。
for (const [width,height] of [[1920,1080],[1366,768],[390,844],[320,800]]) {
  test(`Ver.536 D3 Today canonical composition at ${width}x${height}`,async({page})=>{
    test.setTimeout(90000);
    page.setDefaultTimeout(10000);
    const room=`test-v536-d3-today-${width}`;
    await boot(page,width,room,height);
    await page.evaluate(roomId=>{
      if(!roomId.startsWith('test-v536-d3-today-'))throw new Error('Fixture room mismatch');
      const owner=localStorage.getItem('systemTaskUser');
      const other=JSON.parse(localStorage.getItem(`system-task-users:${roomId}`)).find(x=>x!==owner);
      const now=Date.now();
      const date=offset=>{const d=new Date();d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
      const task=(id,assignee,status,dueDate)=>({id,title:'表示確認 '+id,assignee,status,dueDate,category:'PC',priority:'中',description:'',tags:[],history:[],comments:[],checklist:[],revision:1,createdBy:owner,updatedBy:owner,createdAt:now-10000,updatedAt:now-10000});
      const tasks=[task('overdue',owner,'未着手',date(-1)),task('due',other,'未着手',date(0)),task('wait-mine',owner,'確認待ち',date(1)),task('wait-other',other,'確認待ち',date(1)),task('spare',owner,'未着手','')];
      tasks[0].createdBy=other;
      tasks[0].updatedBy=other;
      localStorage.setItem(`system-task-activity-read-at:${roomId}:${owner}`,String(now-20000));
      const schedules=[owner,other].map((assignee,i)=>({id:`schedule-${i}`,title:'予定の表示確認 '+i,assignee,category:'PC',startAt:date(0)+`T${i?14:10}:00:00`,endAt:date(0)+`T${i?15:11}:00:00`,location:'会議室',memo:'',revision:1,createdBy:owner,updatedBy:owner,createdAt:now-10000,updatedAt:now-10000}));
      const todos=[owner,owner,other].map((user,i)=>({id:`todo-${i}`,text:'個人作業 '+i,memo:'保存済みの補足',owner:user,completed:false,completedAt:0,order:i*1024,revision:1,createdAt:now,updatedAt:now}));
      for(const[k,v]of Object.entries({tasks,schedules,todos}))localStorage.setItem(`system-task-${k}:${roomId}`,JSON.stringify(v));
    },room);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true&&window.WORK_BOARD_APPEARANCE_VERSION==='536');
    const data=()=>page.evaluate(r=>['tasks','schedules','todos'].map(k=>localStorage.getItem(`system-task-${k}:${r}`)),room);
    const originalData=await data();
    const order=()=>page.locator('#todayView .today-grid [data-today-panel-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.todayPanelId));
    const savedOrder=()=>page.evaluate(r=>localStorage.getItem(`workBoardTodayPanelOrderV531:${r}:${localStorage.getItem('systemTaskUser')}`),room);
    expect(await order()).toEqual(['schedule','overdue','due-today','unsorted','spare']);
    await expect(page.locator('.signal-today-overview')).toHaveCount(0);
    for(const tone of ['bright','midnight']){
      await settings(page,width);
      await page.locator('input[name="wbPreferenceDesign"][value="signal"]').check();
      await page.locator(`input[name="wbPreferenceTone"][value="${tone}"]`).check();
      await page.locator('#wbCloseSettings').click();
      await settleVisualSidebar(page,width,height);
      await expect(page.locator('#todayView')).toHaveAttribute('data-signal-today-composition','d3');
      await expect(page.locator('.signal-today-overview strong')).toHaveText(['1','2','2','2']);
      expect(await order()).toEqual(['overdue','schedule','due-today','unsorted','spare']);
      expect(await savedOrder()).toBeNull();
      await expect(page.locator('.signal-today-primary > [data-today-panel-id="overdue"]')).toHaveCount(1);
      await expect(page.locator('.signal-today-context > [data-today-panel-id="schedule"]')).toHaveCount(1);
      await expect(page.locator('#todayView .activity-panel')).toHaveCount(1);
      await expect(page.locator('#todayView .today-todo-preview')).toHaveCount(1);
      const geometry=await page.evaluate(()=>{
        const box=s=>document.querySelector(s).getBoundingClientRect();
        const p=box('.signal-today-primary > [data-today-panel-id]'),t=box('.today-todo-preview'),o=box('.signal-today-overview'),s=box('.signal-today-context > [data-today-panel-id]'),a=box('#todayView .activity-panel');
        return {left:p.x,right:o.x,pb:p.bottom,tt:t.top,tb:t.bottom,ot:o.top,ob:o.bottom,st:s.top,sb:s.bottom,at:a.top,overflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth};
      });
      expect(geometry.overflow).toBe(0);
      expect(geometry.sb).toBeLessThanOrEqual(geometry.at+1);
      if(width>860){expect(geometry.left).toBeLessThan(geometry.right);expect(geometry.pb).toBeLessThanOrEqual(geometry.tt+1);expect(geometry.ob).toBeLessThanOrEqual(geometry.st+1);}
      else {expect(geometry.pb).toBeLessThanOrEqual(geometry.ot+1);expect(geometry.ob).toBeLessThanOrEqual(geometry.tt+1);expect(geometry.tb).toBeLessThanOrEqual(geometry.st+1);}
      await readableContentV536(page.locator('[data-signal-metric="overdue"] strong'),'.signal-today-overview');

    const notice=page.locator('#todayView .activity-item[data-activity-task="overdue"]');
    await expect(notice).toBeVisible();
    if(tone==='midnight'){
      await readableContentV536(notice.locator('strong'),'.activity-item');
      await readableContentV536(notice.locator('time'),'.activity-item');
      await readableContentV536(notice.locator('.activity-meta'),'.activity-item');
    }


    // 外側カードの色だけでなく、データが入った要素の実際の文字と背景を検査する。
    const actionBounds = await page.locator('#todayView .activity-actions button').evaluateAll(buttons => buttons.map(button => {
      const b=button.getBoundingClientRect(), parent=button.closest('.activity-panel').getBoundingClientRect();
      return {text:button.textContent, fits:b.width>0&&b.left>=parent.left-1&&b.right<=parent.right+1&&button.scrollWidth<=button.clientWidth+1};
    }));
    expect(actionBounds.filter(button=>!button.fits)).toEqual([]);
    if(tone==='midnight') {
      for(const title of await page.locator('#todayView .task-card .task-title > span:not(.pin)').all())
        await readableContentV536(title,'.task-card');
      for(const label of await page.locator('#todayView .schedule-time span').all())
        await readableContentV536(label,'.schedule-card');
      for(const badge of await page.locator('#todayView .user-badge').all())
        await readableContentV536(badge,'.user-badge');
      const priorityColors=await page.locator('#todayView .task-card').evaluateAll(cards=>cards.map(card=>getComputedStyle(card).borderLeftColor));
      expect(priorityColors.every(color=>color==='rgb(75, 145, 226)')).toBe(true);
    }

      const dir='test-results/signal-visual-v536';await mkdir(dir,{recursive:true});
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({path:`${dir}/signal-${tone}-d3-today-${width}x${height}.png`,animations:'disabled',fullPage:true});
    }
    expect(await data()).toEqual(originalData);
    if(width<=860)await page.locator('.work-mobile-menu-button').click();
    else {await page.locator('.sidebar').hover();await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state','expanded');}
    const owner=await page.evaluate(()=>localStorage.getItem('systemTaskUser'));
    await page.locator('#assigneeFilter').selectOption(owner);
    if(width<=860)await page.locator('.work-mobile-menu-button').click();
    await settleVisualSidebar(page,width,height);
    await expect(page.locator('.signal-today-overview strong')).toHaveText(['1','2','1','1']);
    await page.locator('[data-today-filter-clear-v375]').click();
    await expect(page.locator('.signal-today-overview strong')).toHaveText(['1','2','2','2']);
    await page.locator('#todayView [data-schedule-id="schedule-0"]').click();
    await expect(page.locator('#scheduleDialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#scheduleDialog')).not.toBeVisible();

  // 元のパネルを左右列をまたいでドラッグでき、再描画後も保存順が一致する。
  if(width>860){
    await page.evaluate(()=>window.scrollTo(0,0));
    await settleVisualSidebar(page,width,height);
    await page.locator('[data-today-panel-id="overdue"] .today-panel-drag-v531')
      .dragTo(page.locator('[data-today-panel-id="schedule"]'));
    await expect.poll(order).toEqual(['schedule','overdue','due-today','unsorted','spare']);
    expect(JSON.parse(await savedOrder())).toEqual(['schedule','overdue','due-today','unsorted','spare']);
  }

  const custom=['spare','overdue','schedule','due-today','unsorted'];
    await page.evaluate(({r,o})=>localStorage.setItem(`workBoardTodayPanelOrderV531:${r}:${localStorage.getItem('systemTaskUser')}`,JSON.stringify(o)),{r:room,o:custom});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true&&window.WORK_BOARD_APPEARANCE_VERSION==='536');
    expect(await order()).toEqual(custom);
    await page.locator('[data-today-panel-id="overdue"] .today-panel-shift-v531').first().click();
    const moved=['overdue','spare','schedule','due-today','unsorted'];expect(await order()).toEqual(moved);
    const saved=await savedOrder();
    await settings(page,width);await page.locator('input[name="wbPreferenceDesign"][value="classic"]').check();await page.locator('#wbCloseSettings').click();
    await expect(page.locator('.signal-today-overview')).toHaveCount(0);expect(await order()).toEqual(moved);expect(await savedOrder()).toBe(saved);
    await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true&&window.WORK_BOARD_APPEARANCE_VERSION==='536');
    expect(await order()).toEqual(moved);expect(await data()).toEqual(originalData);
    console.log('SIGNAL_D3_TODAY_V536 '+JSON.stringify({width,height,defaultCounts:[1,2,2,2],filteredCounts:[1,2,1,1],savedOrder:moved}));
  });
}

// 実データ構造で主要画面と詳細・編集を検証する。外部通信と本番ルームを遮断する。
async function secondaryRouteV536(page,width,layout){
  if(width<=860)await page.locator('.work-mobile-menu-button').click();
  else{await page.locator('.sidebar').hover();await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state','expanded');}
  await page.locator(layout==='memo'?'.nav-item[data-work-memo-layout]':`.nav-item[data-layout="${layout}"]`).click();
  if(width<=860)await expect(page.locator('body')).not.toHaveClass(/work-mobile-menu-open/);
  await settleVisualSidebar(page,width,page.viewportSize().height);
}
for(const[width,height]of[[1920,1080],[1366,768],[390,844],[320,800]])for(const tone of['bright','midnight']){
  test(`Ver.536 secondary screens and real dialogs in ${tone} at ${width}x${height}`,async({page})=>{
    test.setTimeout(150000);page.setDefaultTimeout(10000);
    const room=`test-v536-secondary-${tone}-${width}`,errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort('blockedbyclient'));
    await boot(page,width,room,height);
    await page.evaluate(roomId=>{
      if(!roomId.startsWith('test-v536-secondary-')||new URLSearchParams(location.search).get('room')!==roomId)throw new Error('Fixture room mismatch');
      const owner=localStorage.getItem('systemTaskUser'),now=Date.now();
      const date=offset=>{const d=new Date();d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
      const tasks=[{id:'secondary-task',title:'画面確認用タスク',assignee:owner,status:'未着手',category:'PC',priority:'中',dueDate:date(-1),dueTime:'',description:'確認用の手順と補足メモです。',requester:'表示検証',tags:[],checklist:[{text:'未完了の確認項目',done:false},{text:'確認済みの項目',done:true}],comments:[{id:'comment-1',text:'受入検査のコメント',type:'作業メモ',author:owner,createdAt:now}],history:[],revision:1,createdBy:owner,updatedBy:owner,createdAt:now,updatedAt:now}];
      const schedules=[{id:'secondary-schedule',title:'表示確認用の予定',assignee:owner,category:'PC',startAt:date(0)+'T10:00:00',endAt:date(0)+'T11:00:00',location:'会議室',memo:'確認用の補足',relatedTaskId:'secondary-task',revision:1,createdBy:owner,updatedBy:owner,createdAt:now,updatedAt:now}];
      const memos={'secondary-memo':{id:'secondary-memo',title:'表示確認用の業務メモ',body:Array.from({length:30},(_,i)=>`${i+1}. 画面確認用の手順です。`).join(String.fromCharCode(10)),category:'手順',tags:['表示確認'],pinned:true,revision:1,createdBy:owner,updatedBy:owner,createdAt:now,updatedAt:now}};
      localStorage.setItem(`system-task-timeline-start:${roomId}`,date(-2));
      localStorage.setItem(`system-task-tasks:${roomId}`,JSON.stringify(tasks));
      localStorage.setItem(`system-task-schedules:${roomId}`,JSON.stringify(schedules));
      localStorage.setItem(`system-business-memos:${roomId}`,JSON.stringify(memos));
    },room);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true&&window.WORK_BOARD_APPEARANCE_VERSION==='536');
    const snapshot=()=>page.evaluate(r=>['system-task-tasks:','system-task-schedules:','system-business-memos:'].map(k=>localStorage.getItem(k+r)),room);
    const records=await snapshot();
    await settings(page,width);await page.locator('input[name="wbPreferenceDesign"][value="signal"]').check();
    await page.locator(`input[name="wbPreferenceTone"][value="${tone}"]`).check();await page.locator('#wbCloseSettings').click();
    const dir='test-results/signal-visual-v536';await mkdir(dir,{recursive:true});
    const capture=async name=>{
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({path:`${dir}/signal-${tone}-secondary-${name}-${width}x${height}.png`,animations:'disabled'});
      const overflow=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);
      expect(overflow,name).toBeLessThanOrEqual(1);
    };
    const dialogCheck=async selector=>{
      const dialog=page.locator(selector);await expect(dialog).toBeVisible();
      const bounds=await dialog.evaluate(node=>{const b=node.getBoundingClientRect();return{left:b.left,right:b.right,width:innerWidth,overflow:node.scrollWidth-node.clientWidth};});
      expect(bounds.left).toBeGreaterThanOrEqual(-1);expect(bounds.right).toBeLessThanOrEqual(bounds.width+1);expect(bounds.overflow).toBeLessThanOrEqual(1);
      if(tone==='midnight'){
        await expect(dialog).toHaveCSS('background-color','rgb(35, 46, 70)');
        await readableContentV536(dialog.locator('h2').first(),selector);
                for(const control of await dialog.locator('.date-segment-control-v127').all())if(await control.isVisible()){
                  await expect(control).toHaveCSS('background-color','rgb(41, 56, 82)');
                  await readableContentV536(control.locator('.date-segment-picker-v127'),selector);
                }

        for(const input of await dialog.locator('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=color]),select,textarea').all())if(await input.isVisible())await readableContentV536(input,selector);
      }
    };
    await secondaryRouteV536(page,width,'tasks');await expect(page.locator('#boardView')).toBeVisible();
    if(tone==='midnight')await readableContentV536(page.locator('#boardView .task-title > span:not(.pin)').first(),'.task-card');
    await expect(page.locator('#roomNameBadge')).toBeHidden();
              const summaryFits=await page.locator('.main > .summary-grid .summary-card').evaluateAll(cards=>cards.map(card=>{
                const image=card.querySelector('img').getBoundingClientRect(),text=card.querySelector('div').getBoundingClientRect();
                return {fits:image.right<=text.left+1,imageWidth:image.width};
              }));
              expect(summaryFits).toHaveLength(4);
              for(const item of summaryFits){expect(item.fits).toBe(true);expect(item.imageWidth).toBe(40);}
              await capture('board');
    await page.locator('#boardView [data-task-id="secondary-task"]').click();
    await page.locator('.detail-panel [data-action="edit"]').click();
    await dialogCheck('#taskDialog');await capture('task-edit');
    await page.locator('#taskDialogDetailTabV319').click();await expect(page.locator('#taskDialogDetailPanelV319')).toBeVisible();
    if(tone==='midnight'){
      await readableContentV536(page.locator('#taskDialog .detail-title'),'#taskDialog');
      await readableContentV536(page.locator('#taskDialog .description').first(),'#taskDialog');
      await readableContentV536(page.locator('#taskDialog .check-item:not(.done) > span').first(),'#taskDialog');
    }
    await capture('task-detail');
    await page.locator('#taskDialog .task-detail-tab-v149[data-tab="comments"]').click();await expect(page.locator('#taskDialog #commentText')).toBeVisible();
    if(tone==='midnight'){
      await readableContentV536(page.locator('#taskDialog #commentText'),'#taskDialog');
      await readableContentV536(page.locator('#taskDialog .activity-text').first(),'#taskDialog');
    }
    await capture('comments');await page.locator('#taskDialogEditTabV319').click();
    await expect(page.locator('#taskTitle')).toHaveValue('画面確認用タスク');
    await page.locator('#closeTaskDialog').click();await expect(page.locator('#taskDialog')).not.toBeVisible();
    if(await page.locator('.detail-panel.open').count())await page.locator('#closeDetail').click();
    for(const[layout,view,text]of[['list','#listView','#listView tbody tr[data-task-id] td:nth-child(3) strong'],['timeline','#timelineView','#timelineView .timeline-task strong']]){
      await page.locator(`[data-task-layout="${layout}"]`).click();await expect(page.locator(view)).toBeVisible();
      if(tone==='midnight')await readableContentV536(page.locator(text).first(),layout==='list'?'td':'.timeline-task');
      if(layout==='list'){
                await expect(page.locator('#listView .bulk-bar')).toBeHidden();
                await page.locator('#listView [data-bulk-id="secondary-task"]').check();
                await expect(page.locator('#listView .bulk-bar')).toBeVisible();
                await page.locator('#listView [data-bulk-id="secondary-task"]').uncheck();
                await expect(page.locator('#listView .bulk-bar')).toBeHidden();
                if(tone==='midnight')await expect(page.locator('#listView th').nth(2)).toHaveCSS('background-color','rgb(41, 56, 82)');
              }
              await capture(layout);
    }
    await page.locator('[data-stat-layout="dashboard"]').click();await expect(page.locator('#dashboardView')).toBeVisible();
    if(tone==='midnight')await readableContentV536(page.locator('#dashboardView .dashboard-kpi strong').first(),'.dashboard-kpi');
    await capture('dashboard');await secondaryRouteV536(page,width,'schedule');
    await page.locator('#scheduleView [data-schedule-mode="list"]').click();await expect(page.locator('#scheduleView .schedule-list')).toBeVisible();
    await capture('schedule-list');await page.locator('#scheduleView [data-schedule-id="secondary-schedule"]').click();
    await dialogCheck('#scheduleDialog');await capture('schedule-edit');await page.locator('#closeScheduleDialog').click();
    await page.locator('#scheduleView [data-schedule-mode="calendar"]').click();await expect(page.locator('#scheduleView .calendar-schedule').first()).toBeVisible();
    if(tone==='midnight'){
      await readableContentV536(page.locator('#scheduleView .calendar-schedule').first(),'.calendar-schedule');
      await readableContentV536(page.locator('#scheduleView .calendar-cell.saturday .calendar-date').first(),'.calendar-cell');
    }
    await capture('calendar');await secondaryRouteV536(page,width,'memo');
    const card=page.locator('[data-memo-sort-id="secondary-memo"]');await expect(card).toBeVisible();
    if(tone==='midnight')await readableContentV536(card.locator('h4'),'.work-memo-card-v167');
    if(width<=860){
              const widths=await card.evaluate(n=>({card:n.getBoundingClientRect().width,grid:n.parentElement.getBoundingClientRect().width}));
              expect(Math.abs(widths.card-widths.grid)).toBeLessThanOrEqual(1);
              const headerFit=await card.evaluate(n=>{
                const heading=n.querySelector('.work-memo-card-head-v167 > div').getBoundingClientRect();
                const controls=n.querySelector('.work-memo-sort-controls-v531').getBoundingClientRect();
                return heading.bottom<=controls.top+1;
              });
              expect(headerFit).toBe(true);

            }
            await capture('memo');await card.locator('[data-memo-edit]').click();
    await dialogCheck('#workMemoDialogV167');await capture('memo-edit');await page.locator('#workMemoDialogV167 [data-memo-close]').first().click();
    await settings(page,width);await capture('settings');
              for(const [button,id,close] of [
                ['manageUsers','#userManageDialog','#closeUserManage'],
                ['manageStatuses','#statusManageDialog','#closeStatusManage'],
                ['manageCategories','#categoryManageDialog','#closeCategoryManage']
              ]){
                await page.locator(`[data-wb-existing-setting="${button}"]`).click();
                await expect(page.locator('#wbSettingsDialog')).not.toBeVisible();
                await dialogCheck(id);await capture(button);
                if(tone==='midnight'&&button==='manageUsers')await readableContentV536(page.locator(id+' .user-badge').first(),'.user-badge');
                await page.locator(close).click();await expect(page.locator(id)).not.toBeVisible();
                await settings(page,width);
              }
              await page.locator('input[name="wbPreferenceDesign"][value="classic"]').check();await page.locator('#wbCloseSettings').click();
    expect(await snapshot()).toEqual(records);expect(errors).toEqual([]);
    console.log('SIGNAL_SECONDARY_V536 '+JSON.stringify({width,height,tone,recordsUnchanged:true}));
  });
}
