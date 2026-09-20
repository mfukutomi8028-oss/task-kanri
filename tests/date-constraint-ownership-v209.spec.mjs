import { test, expect } from '@playwright/test';

const STATIC_FIELDS = [
  ['taskDueDate', '1900-01-01', '9999-12-31'],
  ['taskRecurrenceEnd', '1900-01-01', '9999-12-31'],
  ['scheduleStart', '1900-01-01T00:00', '9999-12-31T23:59'],
  ['scheduleEnd', '1900-01-01T00:00', '9999-12-31T23:59'],
  ['timelineMoveDueDate', '1900-01-01', '9999-12-31']
];

async function bootWithoutStableDateFixes(page) {
  await page.route(/stable-fixes-v108\.js(?:\?|$)/, route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'document.documentElement.dataset.stableDateAuditDisabled="true";'
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
}

function segmentedControl(page, sourceId) {
  return page.locator(`#${sourceId}`).locator('..');
}

async function fillDateSegments(wrapper, { year, month, day, hour, minute }) {
  const fields = wrapper.locator('.date-segment-input-v127');
  await fields.nth(0).fill(year ?? '');
  await fields.nth(1).fill(month ?? '');
  await fields.nth(2).fill(day ?? '');
  if (hour !== undefined) await fields.nth(3).fill(hour);
  if (minute !== undefined) await fields.nth(4).fill(minute);
  await fields.last().press('Tab');
}

async function openDialog(page, id) {
  await page.evaluate(dialogId => document.getElementById(dialogId)?.showModal(), id);
  await expect(page.locator(`#${id}`)).toHaveAttribute('open', '');
}

async function openNewTaskDialog(page) {
  await page.locator('#newTask').click();
  await expect(page.locator('#taskDialog')).toHaveAttribute('open', '');
}

test('date-keyboard alone owns static date and datetime source bounds and four-digit visible years', async ({ page }) => {
  await bootWithoutStableDateFixes(page);

  expect(await page.evaluate(() => document.documentElement.dataset.stableDateAuditDisabled)).toBe('true');
  for (const [id, min, max] of STATIC_FIELDS) {
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
  // The product intentionally selects a focused segment on the next animation frame.
  // Let that focus-selection lifecycle settle before testing maxlength keyboard input,
  // otherwise the delayed select can replace the first typed digit and make this
  // maxlength assertion timing-dependent rather than behavior-dependent.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve())));
  await expect(year).toHaveValue('');
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

  await fillDateSegments(wrapper, { year: '9999', month: '12', day: '31', hour: '23', minute: '59' });
  await expect(source).toHaveValue('9999-12-31T23:59');

  await fillDateSegments(wrapper, { year: '9999', month: '12', day: '31', hour: '24', minute: '00' });
  await expect(source).toHaveValue('');

  await fillDateSegments(wrapper, { year: '9999', month: '12', day: '31', hour: '23', minute: '60' });
  await expect(source).toHaveValue('');
});

test('timeline due date keeps date-keyboard constraints when its dialog becomes visible', async ({ page }) => {
  await bootWithoutStableDateFixes(page);
  await openDialog(page, 'timelineMoveDialog');

  const source = page.locator('#timelineMoveDueDate');
  const wrapper = segmentedControl(page, 'timelineMoveDueDate');
  await expect(wrapper).toBeVisible();
  await expect(source).toHaveAttribute('min', '1900-01-01');
  await expect(source).toHaveAttribute('max', '9999-12-31');
  await expect(wrapper.locator('.date-segment-year-v127')).toHaveAttribute('maxlength', '4');
});

test('dynamic task start date is adopted on task-dialog open and remains constrained on reopen', async ({ page }) => {
  await bootWithoutStableDateFixes(page);
  await openNewTaskDialog(page);

  const source = page.locator('#taskStartDateV167');
  const wrapper = segmentedControl(page, 'taskStartDateV167');
  await expect(wrapper).toBeVisible();
  await expect(source).toHaveAttribute('data-date-segment-v127', 'true');
  await expect(source).toHaveAttribute('min', '1900-01-01');
  await expect(source).toHaveAttribute('max', '9999-12-31');
  await expect(wrapper.locator('.date-segment-year-v127')).toHaveAttribute('maxlength', '4');

  await page.locator('#closeTaskDialog').click();
  await openNewTaskDialog(page);
  await expect(segmentedControl(page, 'taskStartDateV167')).toBeVisible();
  await expect(page.locator('#taskStartDateV167')).toHaveAttribute('data-date-segment-v127', 'true');
});
