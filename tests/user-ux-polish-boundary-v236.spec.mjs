import { test, expect } from '@playwright/test';

const ROOM = 'test-user-ux-polish-boundary-v236';
const POLISH = 'user-ux-polish-v208.js';

async function installLocalBoundary(page) {
  await page.addInitScript(({ room }) => {
    const now = Date.now();
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
      {
        id: 'ux-boundary-v236-task',
        title: 'Ver.236 UX境界確認',
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
          'ux-boundary-v236-inbox': {
            taskId: 'ux-boundary-v236-task',
            type: 'mention',
            title: '@メンションされました',
            body: '森井：sidecar境界監査です',
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

async function bootWithoutPolish(page) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await installLocalBoundary(page);
  let requests = 0;
  page.on('request', request => {
    try {
      if (new URL(request.url()).pathname.endsWith(`/${POLISH}`)) requests += 1;
    } catch (_) {}
  });
  await page.route(`**/${POLISH}*`, route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: '/* Ver.236 audit: user UX polish intentionally disabled */'
  }));
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => Number(window.WORK_BOARD_RELEASE?.version || 0) >= 235, undefined, { timeout: 8_000 });
  return () => requests;
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

test('Ver.236 audit: disabling user-ux-polish exposes its live favorite, removed-UI and discard responsibilities while independent features remain', async ({ page }) => {
  const polishRequests = await bootWithoutPolish(page);
  expect(polishRequests()).toBe(1);

  const favoriteNav = page.locator('.nav-item[data-filter="favorite"]');
  await expect(favoriteNav).toContainText('スター');
  await expect(favoriteNav).not.toContainText('お気に入り');

  const legacyUi = await page.evaluate(() => ({
    favoriteHidden: document.getElementById('favoriteOnly')?.hidden,
    favoriteRowHidden: document.getElementById('favoriteOnly')?.closest('.check-row')?.hidden,
    cacheHelpConnected: Boolean(document.getElementById('roomCacheHelp')?.isConnected),
    cacheButtonConnected: Boolean(document.getElementById('clearRoomCache')?.isConnected)
  }));
  expect(legacyUi).toEqual({
    favoriteHidden: false,
    favoriteRowHidden: false,
    cacheHelpConnected: true,
    cacheButtonConnected: true
  });

  await clickCurrent(page, '.nav-item[data-filter="favorite"]');
  await expect(page.locator('#favoriteOnly')).toBeChecked();
  await expect(favoriteNav).toHaveClass(/active/);

  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.waitForSelector('[data-task-id="ux-boundary-v236-task"]', { timeout: 10_000 });
  await clickCurrent(page, '[data-task-id="ux-boundary-v236-task"]');

  const quickPin = page.locator('.detail-quick-pin-v154');
  await expect(quickPin).toBeVisible({ timeout: 10_000 });
  await expect(quickPin).toHaveText('固定');
  await expect(quickPin).not.toContainText('📌');

  const detailFavorite = page.locator('.detail-favorite-button[data-action="favorite"]');
  await expect(detailFavorite).toContainText('スター');
  await expect(detailFavorite).not.toContainText('お気に入り');

  await clickCurrent(page, '#newTask');
  const dialog = page.locator('#taskDialog');
  await expect(dialog).toBeVisible();
  await page.locator('#taskTitle').click();
  await page.locator('#taskTitle').pressSequentially('未保存の監査入力');
  await page.locator('#closeTaskDialog').click();
  await expect(dialog).toBeHidden();

  await clickCurrent(page, '.nav-item[data-layout="today"]');
  const inboxEntry = page.locator('[data-open-personal-inbox-v153]');
  await expect(inboxEntry).toBeVisible({ timeout: 10_000 });
  await expect(inboxEntry.locator('.workflow-inbox-entry-badge-v153')).toHaveText('1');
  await inboxEntry.click();

  const readButton = page.locator('[data-inbox-read-v153="ux-boundary-v236-inbox"]');
  await expect(readButton).toBeVisible();
  await expect(readButton).toHaveText('既読');
  await readButton.click();
  await expect(page.locator('[data-inbox-list-v153]')).toContainText('未読の通知はありません');
  await expect(inboxEntry.locator('.workflow-inbox-entry-badge-v153')).toHaveText('0');
});
