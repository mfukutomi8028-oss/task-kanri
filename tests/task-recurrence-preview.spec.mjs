import { test, expect } from '@playwright/test';

// The preview is display-only; no Firebase writes or task saves in this test.
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

async function setRecurrence(page, method, interval = '1') {
  await page.evaluate(({ method, interval }) => {
    const change = (id, value) => {
      const element = document.getElementById(id);
      element.value = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    change('taskRecurrence', method);
    change('taskRecurrenceAnchorDate', '2020-01-04');
    change('taskRecurrenceInterval', interval);
    change('taskRecurrenceMonthDay', '4');
  }, { method, interval });
}

for (const width of [1366, 390]) {
  test('task recurrence: preview 12 upcoming occurrences at ' + width + 'px', async ({ page }) => {
    test.setTimeout(90000);
    await boot(page, width);
    const preview = page.locator('#recurrencePreview');
    await setRecurrence(page, 'monthlyDay');
    await expect(preview.locator('.recurrence-preview-scope')).toHaveText('今後12回分のプレビュー');
    await expect(preview.locator('.recurrence-preview-first')).toContainText('次の繰り返し日');
    const details = preview.locator('details.recurrence-preview-more');
    await expect(details.locator('.recurrence-preview-show-label')).toHaveText('残り11件を見る');
    await expect(details).not.toHaveAttribute('open', '');
    await expect(details.locator('li')).toHaveCount(11);
    await details.locator('summary').click();
    await expect(details).toHaveAttribute('open', '');
    await expect(details.locator('.recurrence-preview-hide-label')).toHaveText('一覧を閉じる');
    const dates = await details.locator('li').allTextContents();
    expect(new Set(dates).size).toBe(11);
    const layout = await details.locator('ol').evaluate(el => ({
      maxHeight: getComputedStyle(el).maxHeight,
      overflowY: getComputedStyle(el).overflowY,
      columns: getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length
    }));
    expect(layout.maxHeight).toBe('240px');
    expect(layout.overflowY).toBe('auto');
    expect(layout.columns).toBe(width >= 760 ? 2 : 1);

    // Switching rule must recalculate, not restore stale dates or save a task.
    await setRecurrence(page, 'daily', '2');
    await expect(preview.locator('.recurrence-preview-scope')).toHaveText('今後12回分のプレビュー');
    await expect(preview.locator('li')).toHaveCount(11);
    await expect(details).toHaveAttribute('open', '');
    await setRecurrence(page, 'yearly');
    await expect(preview.locator('li')).toHaveCount(11);
    await page.evaluate(() => {
      const select = document.getElementById('taskRecurrence');
      select.value = 'none';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(preview).toHaveText('繰り返しなし');
    await expect(preview.locator('details')).toHaveCount(0);
  });
}
