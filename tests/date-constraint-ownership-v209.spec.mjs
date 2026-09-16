import { test, expect } from '@playwright/test';

const ROOM = 'test-date-constraint-ownership-v209';

async function bootWithoutStableDateFixes(page) {
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

  await page.route(/\/stable-fixes-v108\.js(?:\?.*)?$/i, route => route.fulfill({
    status: 200,
    contentType: 'application/javascript; charset=utf-8',
    body: '/* Ver.209 audit contract: stable-fixes-v108.js intentionally disabled */'
  }));
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await page.waitForFunction(() => document.getElementById('dateSegmentControlStyleV127'));
}

function segmentedControl(page, sourceId) {
  return page.locator(`#${sourceId}`).locator('xpath=..');
}

async function openDialog(page, id) {
  await page.evaluate(dialogId => {
    const dialog = document.getElementById(dialogId);
    if (dialog instanceof HTMLDialogElement && !dialog.open) dialog.showModal();
  }, id);
  await expect(page.locator(`#${id}`)).toBeVisible();
}

async function openNewTaskDialog(page) {
  await page.locator('.nav-item[data-layout="tasks"]').evaluate(button => button.click());
  await expect(page.locator('#newTask')).toBeVisible();
  await page.locator('#newTask').evaluate(button => button.click());
  await expect(page.locator('#taskDialog')).toBeVisible();
}

async function fillDateSegments(wrapper, { year, month, day, hour, minute }) {
  await wrapper.locator('.date-segment-year-v127').fill(year);
  await wrapper.locator('.date-segment-two-v127').nth(0).fill(month);
  await wrapper.locator('.date-segment-two-v127').nth(1).fill(day);
  if (hour !== undefined) await wrapper.locator('.date-segment-two-v127').nth(2).fill(hour);
  if (minute !== undefined) await wrapper.locator('.date-segment-two-v127').nth(3).fill(minute);
}

test('date-keyboard alone owns static date and datetime source bounds and four-digit visible years', async ({ page }) => {
  await bootWithoutStableDateFixes(page);

  await expect(page.locator('#stableFixesV108Style')).toHaveCount(0);

  const controls = [
    ['taskDueDate', '1900-01-01', '9999-12-31'],
    ['timelineMoveDueDate', '1900-01-01', '9999-12-31'],
    ['scheduleStart', '1900-01-01T00:00', '9999-12-31T23:59'],
    ['scheduleEnd', '1900-01-01T00:00', '9999-12-31T23:59']
  ];

  for (const [id, min, max] of controls) {
    const source = page.locator(`#${id}`);
    await expect(source).toHaveAttribute('data-date-segment-v127', 'true');
    await expect(source).toHaveAttribute('min', min);
    await expect(source).toHaveAttribute('max', max);
    await expect(source).not.toHaveJSProperty('__stableDateV108', true);

    const wrapper = segmentedControl(page, id);
    await expect(wrapper).toHaveClass(/date-segment-control-v127/);
    await expect(wrapper.locator('.date-segment-year-v127')).toHaveAttribute('maxlength', '4');
  }
});

test('visible task date entry rejects out-of-range and impossible dates without stable fixes', async ({ page }) => {
  await bootWithoutStableDateFixes(page);
  await openNewTaskDialog(page);

  const source = page.locator('#taskDueDate');
  const wrapper = segmentedControl(page, 'taskDueDate');
  await expect(wrapper).toBeVisible();

  await fillDateSegments(wrapper, { year: '1899', month: '12', day: '31' });
  await expect(source).toHaveValue('');

  await fillDateSegments(wrapper, { year: '9999', month: '12', day: '31' });
  await expect(source).toHaveValue('9999-12-31');

  const year = wrapper.locator('.date-segment-year-v127');
  await year.fill('');
  await year.pressSequentially('10000');
  await expect(year).toHaveValue(/^\d{4}$/);
  await expect(year).not.toHaveValue('10000');
  await expect(source).toHaveValue('');

  await fillDateSegments(wrapper, { year: '2026', month: '02', day: '30' });
  await expect(source).toHaveValue('');
});

test('visible schedule datetime entry enforces upper date and time bounds without stable fixes', async ({ page }) => {
  await bootWithoutStableDateFixes(page);
  await openDialog(page, 'scheduleDialog');

  const source = page.locator('#scheduleStart');
  const wrapper = segmentedControl(page, 'scheduleStart');
  await expect(wrapper).toBeVisible();
  await expect(wrapper.locator('.date-segment-year-v127')).toHaveAttribute('maxlength', '4');

  await fillDateSegments(wrapper, {
    year: '9999', month: '12', day: '31', hour: '23', minute: '59'
  });
  await expect(source).toHaveValue('9999-12-31T23:59');

  await fillDateSegments(wrapper, {
    year: '2026', month: '09', day: '16', hour: '24', minute: '00'
  });
  await expect(source).toHaveValue('');
});

test('timeline due date keeps date-keyboard constraints when its dialog becomes visible', async ({ page }) => {
  await bootWithoutStableDateFixes(page);
  await openDialog(page, 'timelineMoveDialog');

  const source = page.locator('#timelineMoveDueDate');
  const wrapper = segmentedControl(page, 'timelineMoveDueDate');
  await expect(wrapper).toBeVisible();
  await fillDateSegments(wrapper, { year: '2026', month: '09', day: '30' });
  await expect(source).toHaveValue('2026-09-30');
});

test('dynamic task start date is adopted on task-dialog open and remains constrained on reopen', async ({ page }) => {
  await bootWithoutStableDateFixes(page);

  await expect(page.locator('#taskStartDateV167')).toHaveCount(1);
  await openNewTaskDialog(page);

  const source = page.locator('#taskStartDateV167');
  await expect(source).toHaveAttribute('data-date-segment-v127', 'true');
  await expect(source).toHaveAttribute('min', '1900-01-01');
  await expect(source).toHaveAttribute('max', '9999-12-31');
  await expect(source).not.toHaveJSProperty('__stableDateV108', true);

  const wrapper = segmentedControl(page, 'taskStartDateV167');
  await expect(wrapper).toBeVisible();
  await expect(wrapper.locator('.date-segment-year-v127')).toHaveAttribute('maxlength', '4');
  await fillDateSegments(wrapper, { year: '2026', month: '09', day: '30' });
  await expect(source).toHaveValue('2026-09-30');

  await page.evaluate(() => document.getElementById('taskDialog')?.close());
  await expect(page.locator('#taskDialog')).toBeHidden();
  await openNewTaskDialog(page);
  await expect(source).toHaveAttribute('data-date-segment-v127', 'true');
  await expect(source).toHaveAttribute('min', '1900-01-01');
  await expect(source).toHaveAttribute('max', '9999-12-31');
  await expect(page.locator('#taskDialog .date-segment-control-v127').filter({ has: source })).toHaveCount(1);
});
