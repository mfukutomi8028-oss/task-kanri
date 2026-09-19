import { test, expect } from '@playwright/test';

const ROOM = 'test-user-ux-polish-boundary-v237';
const LEGACY_POLISH = 'user-ux-polish-v208.js';
const FAVORITE_UI = 'favorite-ui-v237.js';
const DISCARD_MESSAGE = '入力内容が変更されています。保存せずに閉じますか？';

async function installLocalBoundary(page) {
  await page.addInitScript(({ room }) => {
    const now = Date.now();
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
      {
        id: 'ux-boundary-v237-task',
        title: 'Ver.237 UX境界確認',
        description: '', requester: '', assignee: '福冨',
        status: '未着手', priority: '中', category: 'その他', tags: [],
        dueDate: '', dueTime: '', pinned: false, checklist: [], comments: [], history: [],
        recurrence: 'none', recurrenceRule: {},
        createdAt: now - 10_000, createdBy: '福冨', updatedAt: now, updatedBy: '福冨',
        completedAt: 0, completedMemo: '', revision: 1
      }
    ]));
    localStorage.setItem(`work-board-workflow-v152:${room}`, JSON.stringify({
      inbox: {
        '福冨': {
          'ux-boundary-v237-inbox': {
            taskId: 'ux-boundary-v237-task',
            type: 'mention',
            title: '@メンションされました',
            body: '森井：Ver.237責務境界確認です',
            actor: '森井',
            createdAt: now,
            readAt: 0
          }
        }
      },
      archives: {},
      duplicates: {}
    }));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function bootProduct(page) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await installLocalBoundary(page);
  let legacyRequests = 0;
  let favoriteRequests = 0;
  page.on('request', request => {
    try {
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith(`/${LEGACY_POLISH}`)) legacyRequests += 1;
      if (pathname.endsWith(`/${FAVORITE_UI}`)) favoriteRequests += 1;
    } catch (_) {}
  });

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => Number(window.WORK_BOARD_RELEASE?.version || 0) >= 237, undefined, { timeout: 8_000 });
  return {
    getLegacyRequests: () => legacyRequests,
    getFavoriteRequests: () => favoriteRequests
  };
}

async function clickCurrent(page, selector) {
  const clicked = await page.evaluate(target => {
    const node = document.querySelector(target);
    if (!(node instanceof HTMLElement)) return false;
    node.click();
    return true;
  }, selector);
  expect(clicked, `expected clickable element: ${selector}`).toBeTruthy();
}

function prepareConfirm(page, action) {
  return new Promise(resolve => {
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toBe(DISCARD_MESSAGE);
      if (action === 'accept') await dialog.accept();
      else await dialog.dismiss();
      resolve();
    });
  });
}

test('Ver.237 product: generic UX sidecar is retired while semantic favorite UI preserves terminology and hidden legacy controls', async ({ page }) => {
  const requests = await bootProduct(page);

  expect(requests.getLegacyRequests()).toBe(0);
  expect(requests.getFavoriteRequests()).toBe(1);

  const favoriteNav = page.locator('.nav-item[data-filter="favorite"]');
  await expect(favoriteNav).toContainText('お気に入り');
  await expect(favoriteNav).not.toContainText('スター');

  const legacyUi = await page.evaluate(() => ({
    favoriteHidden: document.getElementById('favoriteOnly')?.hidden,
    favoriteDisplay: document.getElementById('favoriteOnly')?.style.display,
    favoriteRowHidden: document.getElementById('favoriteOnly')?.closest('.check-row')?.hidden,
    cacheHelpConnected: Boolean(document.getElementById('roomCacheHelp')?.isConnected),
    cacheButtonConnected: Boolean(document.getElementById('clearRoomCache')?.isConnected)
  }));
  expect(legacyUi).toEqual({
    favoriteHidden: true,
    favoriteDisplay: 'none',
    favoriteRowHidden: true,
    cacheHelpConnected: false,
    cacheButtonConnected: false
  });

  await clickCurrent(page, '.nav-item[data-filter="favorite"]');
  await expect(page.locator('#favoriteOnly')).toBeChecked();
  await expect(favoriteNav).toHaveClass(/active/);
  await clickCurrent(page, '.nav-item[data-filter="favorite"]');
  await expect(page.locator('#favoriteOnly')).not.toBeChecked();

  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.waitForSelector('[data-task-id="ux-boundary-v237-task"]', { timeout: 10_000 });
  await clickCurrent(page, '[data-task-id="ux-boundary-v237-task"]');

  const quickPin = page.locator('.detail-quick-pin-v154');
  await expect(quickPin).toBeVisible({ timeout: 10_000 });
  await expect(quickPin).toHaveText('固定');

  const detailFavorite = page.locator('.detail-favorite-button[data-action="favorite"]');
  await expect(detailFavorite).toContainText('お気に入り');
  await expect(detailFavorite).not.toContainText('スター');
  await expect(detailFavorite).toHaveAttribute('aria-label', 'お気に入りに追加');
});

test('Ver.237 product: task UX owns one discard guard for close, backdrop and Escape while accepted routes still close', async ({ page }) => {
  await bootProduct(page);
  await clickCurrent(page, '.nav-item[data-layout="tasks"]');

  await clickCurrent(page, '#newTask');
  const dialog = page.locator('#taskDialog');
  await expect(dialog).toBeVisible();
  await page.locator('#taskTitle').click();
  await page.locator('#taskTitle').pressSequentially('未保存の監査入力');

  let confirmation = prepareConfirm(page, 'dismiss');
  await page.locator('#closeTaskDialog').click();
  await confirmation;
  await expect(dialog).toBeVisible();

  confirmation = prepareConfirm(page, 'accept');
  await page.evaluate(() => {
    const target = document.getElementById('taskDialog');
    target?.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 0,
      clientY: 0
    }));
  });
  await confirmation;
  await expect(dialog).toBeHidden();

  await clickCurrent(page, '#newTask');
  await expect(dialog).toBeVisible();
  await page.locator('#taskTitle').click();
  await page.locator('#taskTitle').pressSequentially('Escape確認');

  confirmation = prepareConfirm(page, 'dismiss');
  await page.keyboard.press('Escape');
  await confirmation;
  await expect(dialog).toBeVisible();

  confirmation = prepareConfirm(page, 'accept');
  await page.keyboard.press('Escape');
  await confirmation;
  await expect(dialog).toBeHidden();
});

test('Ver.237 product: inbox read state remains independent from favorite and task-dialog UX owners', async ({ page }) => {
  await bootProduct(page);
  await clickCurrent(page, '.nav-item[data-layout="today"]');

  const inboxEntry = page.locator('[data-open-personal-inbox-v153]');
  await expect(inboxEntry).toBeVisible({ timeout: 10_000 });
  await expect(inboxEntry.locator('.workflow-inbox-entry-badge-v153')).toHaveText('1');
  await inboxEntry.click();

  const readButton = page.locator('[data-inbox-read-v153="ux-boundary-v237-inbox"]');
  await expect(readButton).toBeVisible();
  await expect(readButton).toHaveText('既読');
  await readButton.click();
  await expect(page.locator('[data-inbox-list-v153]')).toContainText('未読の通知はありません');
  await expect(inboxEntry.locator('.workflow-inbox-entry-badge-v153')).toHaveText('0');
});
