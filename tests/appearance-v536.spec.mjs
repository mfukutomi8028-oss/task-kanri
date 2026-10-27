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
    await expect(page.locator('#todayView .today-panel-sort-head-v531 > h4').first()).toHaveCSS('color', 'rgb(237, 243, 255)');
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
    return {
      foreground: rgba(getComputedStyle(node).color),
      background: rgba(getComputedStyle(surface).backgroundColor)
    };
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
      await settleVisualSidebar(page, width, height);
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
      await page.screenshot({ path: `${dir}/signal-${tone}-content-memo-${width}x${height}.png`, animations: 'disabled', fullPage: true });
      console.log('SIGNAL_CONTENT_V536 ' + JSON.stringify({ width, height, tone, todoContrast, memoContrast, overflow }));
    });
  }
}
