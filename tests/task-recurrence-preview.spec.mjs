import { test, expect } from '@playwright/test';

// Display-only form regression: no task saves and no Firebase writes.
async function boot(page, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === 'http://127.0.0.1:4173' ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
    localStorage.setItem('systemTaskUser', 'RecurrencePreviewTester');
    localStorage.setItem('systemTaskRoomId', 'test-recurrence-preview');
  });
  await page.goto('/?room=test-recurrence-preview', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30000 });
  await page.locator('#newTask').evaluate(button => button.click());
  await expect(page.locator('#taskDialog')).toBeVisible();
}

async function choose(page, id, value) {
  await page.evaluate(({ id, value }) => {
    const element = document.getElementById(id);
    if (!element) throw new Error('Missing recurrence control: ' + id);
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, { id, value });
}

async function setRecurrence(page, method) {
  await choose(page, 'taskRecurrence', method);
  await choose(page, 'taskRecurrenceAnchorDate', '2020-01-04');
  await choose(page, 'taskRecurrenceMonthDay', '4');
}

for (const width of [1366, 390]) {
  test('task recurrence: bounded, date, unlimited and explicit days at ' + width + 'px', async ({ page }) => {
    test.setTimeout(90000);
    await boot(page, width);
    const preview = page.locator('#recurrencePreview');
    await setRecurrence(page, 'monthlyDay');
    await expect(page.locator('#taskRecurrenceEndMode')).toHaveValue('count');
    await expect(page.locator('#taskRecurrenceCount')).toHaveValue('4');
    await expect(preview.locator('.recurrence-preview-scope')).toContainText('自動作成上限4件');
    await expect(preview.locator('.recurrence-preview-first')).toContainText('次の繰り返し日：');
    let details = preview.locator('details.recurrence-preview-more');
    await expect(details.locator('li')).toHaveCount(3);
    await expect(details.locator('.recurrence-preview-show-label')).toHaveText('残り3件を見る');
    await details.locator('summary').click();
    await expect(details).toHaveAttribute('open', '');
    let layout = await details.locator('ol').evaluate(el => ({
      maxHeight: getComputedStyle(el).maxHeight,
      overflowY: getComputedStyle(el).overflowY,
      columns: getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length
    }));
    expect(layout).toMatchObject({ maxHeight: '240px', overflowY: 'auto', columns: width >= 760 ? 2 : 1 });

    const nextISO = (await preview.locator('.recurrence-preview-first').textContent()).match(/\d{4}-\d{2}-\d{2}/)[0];
    // Unlimited is opt-in for new series and inherited by legacy series.
    await choose(page, 'taskRecurrenceEndMode', 'unlimited');
    await expect(preview.locator('.recurrence-preview-scope')).toContainText('無期限');
    await expect(details.locator('li')).toHaveCount(11);
    await expect(details).toHaveAttribute('open', '');

    // Reducing a count must reduce the actual preview and remove disclosure.
    await choose(page, 'taskRecurrenceEndMode', 'count');
    await choose(page, 'taskRecurrenceCount', '1');
    await expect(preview.locator('.recurrence-preview-scope')).toContainText('自動作成上限1件');
    await expect(details).toHaveCount(0);

    // End date includes the matching occurrence, excludes all later ones.
    await choose(page, 'taskRecurrenceEndMode', 'date');
    await choose(page, 'taskRecurrenceEndDate', nextISO);
    await expect(preview.locator('.recurrence-preview-first')).toContainText(nextISO);
    await expect(details).toHaveCount(0);
    await expect(preview.locator('.recurrence-preview-scope')).toContainText('終了日 ' + nextISO);

    // Ending before the anchor is an error, not silent indefinite recurrence.
    await choose(page, 'taskRecurrenceEndDate', '2020-01-01');
    await expect(preview).toContainText('終了日は繰り返し開始日以降');
    await choose(page, 'taskRecurrenceEndDate', nextISO);

    // Multiple dates are finite by construction. They do not use end mode.
    await choose(page, 'taskRecurrence', 'dates');
    await expect(page.locator('#taskRecurrenceEndOptions')).toBeHidden();
    const day2 = await page.evaluate(date => {
      const next = new Date(date + 'T00:00:00');
      next.setMonth(next.getMonth() + 1);
      return next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-' +
        String(next.getDate()).padStart(2, '0');
    }, nextISO);
    for (const date of [nextISO, day2]) {
      await choose(page, 'taskRecurrenceDateInput', date);
      await page.locator('#taskRecurrenceAddDate').click();
    }
    await expect(page.locator('#taskRecurrenceDateList [data-task-recurrence-date]')).toHaveCount(2);
    await expect(preview.locator('.recurrence-preview-scope')).toContainText('今後2件を表示');
    await expect(details.locator('li')).toHaveCount(1);
    await page.locator('#taskRecurrenceDateList [data-task-recurrence-date]').first().click();
    await expect(preview.locator('.recurrence-preview-first')).toContainText(day2);
    await expect(details).toHaveCount(0);

    await choose(page, 'taskRecurrence', 'none');
    await expect(preview).toHaveText('繰り返しなし');
    await expect(preview.locator('details')).toHaveCount(0);
  });
}
