import { test, expect } from '@playwright/test';

const ROOM = 'test-date-keyboard-boundary-v230';
const CONTROLLER = 'date-segment-controls-v230.js';
const PRESENTATION = 'ui-date-segment-controls-v230.css';

async function installLocalState(page) {
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });
}

async function blockRemoteFirebase(page) {
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, { disableDateController = false } = {}) {
  await installLocalState(page);
  await blockRemoteFirebase(page);

  let controllerRequests = 0;
  page.on('request', request => {
    try {
      if (new URL(request.url()).pathname.endsWith(`/${CONTROLLER}`)) controllerRequests += 1;
    } catch (_) {}
  });

  if (disableDateController) {
    await page.route(`**/${CONTROLLER}*`, route => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '/* Ver.230 audit: semantic date controller intentionally disabled */'
    }));
  }

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => Number(window.WORK_BOARD_RELEASE?.version || 0) >= 230, undefined, { timeout: 8_000 });
  await page.waitForFunction(name => Array.from(document.styleSheets).some(sheet => {
    try { return new URL(sheet.href || '', location.href).pathname.endsWith(`/${name}`); }
    catch (_) { return false; }
  }), PRESENTATION, { timeout: 8_000 });
  return () => controllerRequests;
}

async function openTaskDialog(page) {
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await page.evaluate(() => document.getElementById('newTask')?.click());
  await expect(page.locator('#taskDialog')).toBeVisible();
}

test('Ver.230 product: app and work-features keep native date ownership when semantic date controller is disabled', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const getControllerRequests = await boot(page, { disableDateController: true });

  await expect(page.locator('#dateSegmentControlStyleV127')).toHaveCount(0);
  await expect(page.locator('.date-segment-control-v127')).toHaveCount(0);

  await openTaskDialog(page);

  const due = page.locator('#taskDueDate');
  const start = page.locator('#taskStartDateV167');
  await expect(due).toHaveAttribute('type', 'date');
  await expect(start).toHaveAttribute('type', 'date');
  await expect(due).not.toHaveAttribute('data-date-segment-v127', 'true');
  await expect(start).not.toHaveAttribute('data-date-segment-v127', 'true');

  // app.js owns reading the native due-date value during task save. Disabling
  // only the segmented controller must not alter the canonical native form path.
  await page.locator('#taskTitle').fill('Ver.230 native date audit');
  await due.fill('2026-09-30');
  await page.locator('#taskForm button[type="submit"]').click();
  await expect(page.locator('#taskDialog')).not.toBeVisible();

  await expect.poll(async () => page.evaluate(room => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    return tasks.find(task => task?.title === 'Ver.230 native date audit')?.dueDate || '';
  }, ROOM)).toBe('2026-09-30');

  expect(getControllerRequests()).toBeGreaterThan(0);
});

test('Ver.230 product: semantic controller owns behavior while external CSS owns segmented presentation', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const getControllerRequests = await boot(page);

  // The old controller-injected style is gone; release CSS is loaded separately.
  await expect(page.locator('#dateSegmentControlStyleV127')).toHaveCount(0);
  await openTaskDialog(page);

  const due = page.locator('#taskDueDate');
  const dueWrapper = due.locator('xpath=..');
  const start = page.locator('#taskStartDateV167');
  const startWrapper = start.locator('xpath=..');

  await expect(due).toHaveAttribute('data-date-segment-v127', 'true');
  await expect(dueWrapper).toHaveClass(/date-segment-control-v127/);
  await expect(start).toHaveAttribute('data-date-segment-v127', 'true');
  await expect(startWrapper).toHaveClass(/date-segment-control-v127/);
  await expect(page.locator('#taskDialog .date-segment-control-v127')).toHaveCount(2);
  await expect(dueWrapper).toHaveCSS('display', 'flex');
  await expect(dueWrapper).toHaveCSS('min-height', '52px');

  await dueWrapper.getByLabel('期限日 年').fill('2026');
  await dueWrapper.getByLabel('期限日 月').fill('09');
  await dueWrapper.getByLabel('期限日 日').fill('30');
  await expect(due).toHaveValue('2026-09-30');

  // Native-source changes made by app code are synchronized back into the
  // segmented presentation through the controller's source change bridge.
  await due.evaluate(source => {
    source.value = '2027-01-15';
    source.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(dueWrapper.getByLabel('期限日 年')).toHaveValue('2027');
  await expect(dueWrapper.getByLabel('期限日 月')).toHaveValue('01');
  await expect(dueWrapper.getByLabel('期限日 日')).toHaveValue('15');

  // Bypass the product's separate unsaved-change confirmation so this test
  // isolates the dialog-open lifecycle owned by the date controller.
  await page.evaluate(() => document.getElementById('taskDialog')?.close());
  await expect(page.locator('#taskDialog')).not.toBeVisible();
  await openTaskDialog(page);
  await expect(page.locator('#taskDialog #taskStartDateV167')).toHaveCount(1);
  await expect(page.locator('#taskDialog .date-segment-control-v127')).toHaveCount(2);

  expect(getControllerRequests()).toBeGreaterThan(0);
});


test('Ver.444 date deferred selection never reclaims focus after moving to the task title', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await boot(page);
  await openTaskDialog(page);

  const result = await page.evaluate(async () => {
    const due = document.querySelector('#taskDueDate');
    const wrapper = due?.parentElement;
    const day = wrapper?.querySelectorAll('.date-segment-two-v127')[1];
    const title = document.querySelector('#taskTitle');
    if (!day || !title) throw new Error('Date focus fixture missing');

    // Keep both focus calls in one browser task so the pending requestAnimationFrame
    // runs only after title has become active. The old unconditional select()
    // re-focused the day input at the next frame.
    day.value = '30';
    day.focus();
    const initiallyOnDay = document.activeElement === day;
    title.focus();
    const initiallyOnTitle = document.activeElement === title;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const remainsOnTitle = document.activeElement === title;

    // Normal date-segment focus still selects its contents when it stays active.
    day.focus();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      initiallyOnDay,
      initiallyOnTitle,
      remainsOnTitle,
      selectedDay: document.activeElement === day &&
        day.selectionStart === 0 && day.selectionEnd === day.value.length
    };
  });

  expect(result).toEqual({
    initiallyOnDay: true,
    initiallyOnTitle: true,
    remainsOnTitle: true,
    selectedDay: true
  });
});


for (const exitMode of ['mouse', 'tab']) {
  test('Ver.445 real ' + exitMode + ' focus exit preserves impossible-date feedback and valid correction', async ({ page }) => {
    // Issue #355: exercise Chromium pointer/keyboard input, not DOM .focus() or .blur().
    await page.setViewportSize({ width: 1366, height: 900 });
    await boot(page);
    await openTaskDialog(page);

    const source = page.locator('#taskDueDate');
    const wrapper = source.locator('xpath=..');
    const year = wrapper.getByLabel('期限日 年');
    const month = wrapper.getByLabel('期限日 月');
    const day = wrapper.getByLabel('期限日 日');
    const picker = wrapper.getByRole('button', { name: '期限日をカレンダーから選択' });
    const title = page.locator('#taskTitle');
    await expect(wrapper).toHaveClass(/date-segment-control-v127/);

    // Passive observation only; do not dispatch any events or modify product state.
    await page.evaluate(() => {
      const source = document.querySelector('#taskDueDate');
      const group = source?.parentElement;
      if (!source || !group) throw new Error('Ver.445 probe target missing');
      const probe = { phase: 'setup', outsideFocusExits: [], nativeInvalidEvents: 0 };
      window.__WB_V445_USER_FOCUSOUT_PROBE__ = probe;
      const name = node => node?.id || node?.getAttribute?.('aria-label') || node?.tagName || 'none';
      group.addEventListener('focusout', event => {
        if (group.contains(event.relatedTarget)) return;
        probe.outsideFocusExits.push({
          phase: probe.phase, from: name(event.target), to: name(event.relatedTarget)
        });
      });
      document.addEventListener('invalid', event => {
        if (event.target === source) probe.nativeInvalidEvents += 1;
      }, true);
    });

    const leaveDueDate = async () => {
      await expect(day).toBeFocused();
      if (exitMode === 'mouse') {
        await title.click();
        await expect(title).toBeFocused();
      } else {
        // Tab to the in-wrapper picker, then Tab outside the date wrapper.
        await page.keyboard.press('Tab');
        await expect(picker).toBeFocused();
        await page.keyboard.press('Tab');
      }
      await expect.poll(() => page.evaluate(() => {
        const group = document.querySelector('#taskDueDate')?.parentElement;
        return !!group && !group.contains(document.activeElement);
      })).toBe(true);
    };

    const report = async () => page.evaluate(() => {
      const source = document.querySelector('#taskDueDate');
      const group = source?.parentElement;
      const probe = window.__WB_V445_USER_FOCUSOUT_PROBE__;
      return {
        phase: probe?.phase,
        active: document.activeElement?.id
          || document.activeElement?.getAttribute?.('aria-label') || 'none',
        withinDate: !!group?.contains(document.activeElement),
        nativeValue: source?.value,
        dayValue: group?.querySelectorAll('.date-segment-two-v127')?.[1]?.value,
        dirty: group?.dataset.dirty,
        invalidClass: group?.classList.contains('is-invalid'),
        outsideFocusExits: probe?.outsideFocusExits || [],
        nativeInvalidEvents: probe?.nativeInvalidEvents || 0
      };
    });

    try {
      // Typing exercises the segmented controller's natural focus advances.
      await year.click();
      await page.keyboard.type('2026');
      await expect(month).toBeFocused();
      await page.keyboard.type('09');
      await expect(day).toBeFocused();
      await page.keyboard.type('30');
      await expect(source).toHaveValue('2026-09-30');
      await expect(wrapper).not.toHaveClass(/is-invalid/);

      await day.click();
      await page.evaluate(() => {
        window.__WB_V445_USER_FOCUSOUT_PROBE__.phase = 'impossible-date';
      });
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.type('31');
      await expect(day).toHaveValue('31');
      await expect(source).toHaveValue('');
      await expect(wrapper).toHaveAttribute('data-dirty', 'true');
      await expect(wrapper).not.toHaveClass(/is-invalid/);

      await leaveDueDate();
      await expect(source).toHaveValue('');
      await expect(wrapper).toHaveClass(/is-invalid/);
      const invalidExit = await report();
      expect(invalidExit.outsideFocusExits.some(event => event.phase === 'impossible-date')).toBe(true);
      expect(invalidExit.withinDate).toBe(false);

      // Correct the impossible day and exit via the same real user gesture.
      await day.click();
      await page.evaluate(() => {
        window.__WB_V445_USER_FOCUSOUT_PROBE__.phase = 'corrected-date';
      });
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.type('30');
      await expect(source).toHaveValue('2026-09-30');
      await leaveDueDate();
      await expect(source).toHaveValue('2026-09-30');
      await expect(wrapper).not.toHaveClass(/is-invalid/);
      const correctedExit = await report();
      expect(correctedExit.outsideFocusExits.some(event => event.phase === 'corrected-date')).toBe(true);
      expect(correctedExit.withinDate).toBe(false);

      console.log('VER445_REAL_USER_DATE_EXIT_METRICS ' + JSON.stringify({
        exitMode,
        impossibleDateOutsideFocusEvents: invalidExit.outsideFocusExits
          .filter(event => event.phase === 'impossible-date').length,
        correctedDateOutsideFocusEvents: correctedExit.outsideFocusExits
          .filter(event => event.phase === 'corrected-date').length,
        nativeInvalidEvents: correctedExit.nativeInvalidEvents,
        invalidFeedbackAfterExit: invalidExit.invalidClass,
        validFeedbackClearedAfterCorrection: !correctedExit.invalidClass
      }));
    } catch (error) {
      let diagnostic;
      try { diagnostic = await report(); }
      catch (captureError) { diagnostic = { captureError: String(captureError) }; }
      console.error('VER445_REAL_USER_DATE_EXIT_DIAGNOSTICS ' + JSON.stringify({ exitMode, diagnostic }));
      await test.info().attach('ver445-real-user-date-exit.json', {
        body: JSON.stringify({ exitMode, diagnostic }, null, 2),
        contentType: 'application/json'
      });
      throw error;
    }
  });
}


async function attachVer446DateLifecycleFailure(page, scenario, error) {
  let snapshot;
  try {
    snapshot = await page.evaluate(() => {
      const source = document.querySelector('#taskDueDate');
      const wrapper = source?.parentElement;
      const dialog = document.querySelector('#taskDialog');
      const fields = wrapper?.querySelectorAll('.date-segment-input-v127') || [];
      return {
        dialogOpen: !!dialog?.open,
        active: document.activeElement?.id
          || document.activeElement?.getAttribute?.('aria-label') || 'none',
        withinDueDate: !!wrapper?.contains(document.activeElement),
        nativeValue: source?.value,
        dirty: wrapper?.dataset.dirty,
        invalid: wrapper?.classList.contains('is-invalid'),
        fields: [...fields].map(field => ({ label: field.getAttribute('aria-label'), value: field.value })),
        dialogDateWrappers: dialog?.querySelectorAll('.date-segment-control-v127').length
      };
    });
  } catch (captureError) {
    snapshot = { collectionError: String(captureError) };
  }
  const report = { scenario, error: String(error), snapshot };
  console.error('VER446_DATE_LIFECYCLE_DIAGNOSTICS ' + JSON.stringify(report));
  await test.info().attach('ver446-date-lifecycle-diagnostics.json', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json'
  });
}

test('Ver.446 responsive reflow retains pending impossible date until pointer focus exits', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await boot(page);
  await openTaskDialog(page);

  const source = page.locator('#taskDueDate');
  const wrapper = source.locator('xpath=..');
  const year = wrapper.getByLabel('期限日 年');
  const month = wrapper.getByLabel('期限日 月');
  const day = wrapper.getByLabel('期限日 日');
  const title = page.locator('#taskTitle');

  try {
    await year.fill('2026');
    await month.fill('09');
    await day.fill('31');
    await expect(day).toBeFocused();
    await expect(day).toHaveValue('31');
    await expect(source).toHaveValue('');
    await expect(wrapper).toHaveAttribute('data-dirty', 'true');
    await expect(wrapper).not.toHaveClass(/is-invalid/);

    // Real Chromium viewport change reflows CSS; it does not emulate an app
    // data rerender or call the segmented-date controller directly.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(day).toBeFocused();
    await expect(day).toHaveValue('31');
    await expect(wrapper).toHaveAttribute('data-dirty', 'true');
    await expect(wrapper).not.toHaveClass(/is-invalid/);

    await title.click();
    await expect(title).toBeFocused();
    await expect(source).toHaveValue('');
    await expect(wrapper).toHaveClass(/is-invalid/);

    await day.click();
    await day.fill('30');
    await expect(source).toHaveValue('2026-09-30');
    await expect(wrapper).not.toHaveClass(/is-invalid/);
    await page.setViewportSize({ width: 1366, height: 900 });
    await title.click();
    await expect(title).toBeFocused();
    await expect(source).toHaveValue('2026-09-30');
    await expect(wrapper).not.toHaveClass(/is-invalid/);
    await expect(page.locator('#taskDialog .date-segment-control-v127')).toHaveCount(2);

    console.log('VER446_DATE_REFLOW_METRICS ' + JSON.stringify({
      viewports: [1366, 390, 1366],
      pendingInvalidRetainedOnMobile: true,
      invalidFeedbackAfterPointerExit: true,
      correctedValueAfterDesktopReturn: '2026-09-30'
    }));
  } catch (error) {
    await attachVer446DateLifecycleFailure(page, 'viewport-reflow', error);
    throw error;
  }
});

test('Ver.446 reopening task dialog discards invalid draft and reuses segmented controls', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await boot(page);
  await openTaskDialog(page);

  const dialog = page.locator('#taskDialog');
  const source = page.locator('#taskDueDate');
  const wrapper = source.locator('xpath=..');
  const year = wrapper.getByLabel('期限日 年');
  const month = wrapper.getByLabel('期限日 月');
  const day = wrapper.getByLabel('期限日 日');
  const title = page.locator('#taskTitle');
  const prompts = [];
  page.on('dialog', async dialogEvent => {
    prompts.push({ type: dialogEvent.type(), message: dialogEvent.message() });
    await dialogEvent.accept();
  });

  await page.evaluate(() => {
    window.__WB_V446_ORIGINAL_DUE_WRAPPER__ = document.querySelector('#taskDueDate')?.parentElement;
  });

  try {
    for (let cycle = 1; cycle <= 3; cycle++) {
      // The app's showModal() observer must reset the native source and
      // previously-invalid segmented presentation without rebuilding wrappers.
      await expect(dialog).toBeVisible();
      await expect(source).toHaveValue('');
      await expect(wrapper).toHaveAttribute('data-dirty', 'false');
      await expect(wrapper).not.toHaveClass(/is-invalid/);
      await expect(year).toHaveValue('');
      await expect(month).toHaveValue('');
      await expect(day).toHaveValue('');
      await expect(page.locator('#taskDialog .date-segment-control-v127')).toHaveCount(2);
      await expect(page.locator('#taskDialog .date-segment-picker-v127')).toHaveCount(2);
      expect(await wrapper.evaluate(node => node === window.__WB_V446_ORIGINAL_DUE_WRAPPER__)).toBe(true);

      await year.fill('2026');
      await month.fill('09');
      await day.fill('30');
      await expect(source).toHaveValue('2026-09-30');
      await day.fill('31');
      await expect(source).toHaveValue('');
      await title.click();
      await expect(wrapper).toHaveClass(/is-invalid/);
      await expect(wrapper).toHaveAttribute('data-dirty', 'true');

      // Use the app's real close control and real unsaved-discard confirmation,
      // rather than force-closing the dialog and bypassing the lifecycle guard.
      await page.locator('#closeTaskDialog').click();
      await expect(dialog).toBeHidden();
      await expect.poll(() => prompts.length).toBe(cycle);
      expect(prompts[cycle - 1].type).toBe('confirm');

      // Invoke the app-owned new-task action, not dialog.showModal() directly.
      await page.evaluate(() => document.querySelector('#newTask')?.click());
      await expect(dialog).toBeVisible();
    }
    await expect(source).toHaveValue('');
    await expect(wrapper).toHaveAttribute('data-dirty', 'false');
    await expect(wrapper).not.toHaveClass(/is-invalid/);
    await expect(day).toHaveValue('');
    console.log('VER446_DATE_REOPEN_METRICS ' + JSON.stringify({
      discardedCycles: 3,
      confirmDialogs: prompts.length,
      stableWrapperIdentity: true,
      dueDateWrappers: 2,
      restoredNativeValue: '',
      restoredInvalidClass: false
    }));
  } catch (error) {
    await attachVer446DateLifecycleFailure(page, 'dialog-reopen', error);
    throw error;
  }
});
