import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-status-delete-v199';
const CORE_STATUSES = ['未着手', '対応中', '確認待ち', '保留', '完了'];

async function bootMobile(page) {
  await page.setViewportSize({ width: 430, height: 800 });
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

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
}

test('mobile keeps five core status deletions protected after the mobile duplicate guard is retired', async ({ page }) => {
  await bootMobile(page);

  await expect(page.locator('#mobileUsabilityFixV101')).toHaveCount(1);

  await page.evaluate(() => document.getElementById('manageStatuses')?.click());
  await expect(page.locator('#statusManageDialog')).toBeVisible();

  for (const status of CORE_STATUSES) {
    const deleteButton = page.locator(`#statusList [data-delete-status="${status}"]`);
    await expect(deleteButton).toBeDisabled();
    await expect(deleteButton).toHaveAttribute('aria-disabled', 'true');
    await expect(deleteButton).toHaveAttribute('title', `${status}は基本状態のため削除できません`);

    const nameInput = page.locator(`#statusList [data-status-old="${status}"]`);
    if (status === '完了') await expect(nameInput).toHaveAttribute('readonly', '');
    else await expect(nameInput).not.toHaveAttribute('readonly', '');
  }

  await page.evaluate(() => {
    const fixture = document.createElement('button');
    fixture.id = 'customStatusV199';
    fixture.type = 'button';
    fixture.dataset.deleteStatus = '院内確認';
    fixture.textContent = '削除';
    document.body.appendChild(fixture);
  });

  await expect(page.locator('#customStatusV199')).toBeEnabled();
});
