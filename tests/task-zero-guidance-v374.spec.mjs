import { test, expect } from '@playwright/test';

const ROOM = 'test-task-zero-v374';
const USER = 'QA374';
const MINE = '.nav-item[data-filter="mine"]';
const DONE = '.nav-item[data-filter="done"]';

async function menuIfMobile(page, width) {
  if (width <= 860) {
    const menu = page.locator('.work-mobile-menu-button');
    if (await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  }
}

async function clickNav(page, width, selector) {
  await menuIfMobile(page, width);
  await page.locator(selector).click();
}

async function start(page, width, seed) {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === 'http://127.0.0.1:4173' ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(({ room, user, seed }) => {
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
    if (localStorage.getItem('v374-initialized')) return;
    localStorage.clear();
    const now = Date.now();
    const items = seed === 'empty' ? [] : [
      { id: 'v374-mine-open', assignee: user, status: '未着手', title: 'V374 申し送り' },
      { id: 'v374-peer-done', assignee: 'Peer374', status: '完了', title: 'V374 完了済み' }
    ];
    localStorage.setItem('systemTaskUser', user);
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('work-board-desktop-sidebar-pinned-v158', '1');
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify([user, 'Peer374']));
    localStorage.setItem(`system-task-layout:${room}`, 'board');
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify(items.map(t => ({
      ...t, category: 'その他', priority: '中', description: '', tags: [], checklist: [],
      requester: '', dueDate: '', dueTime: '', pinned: false, recurrence: 'none',
      comments: [], history: [], revision: 1, completedMemo: '',
      completedAt: t.status === '完了' ? now : 0, createdBy:user, updatedBy:user,
      createdAt: now, updatedAt: now
    }))));
    localStorage.setItem('v374-initialized', '1');
  }, { room: ROOM, user: USER, seed });
  await page.goto(`/?room=${ROOM}`, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true);
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === window.WORK_BOARD_RELEASE.version);
  await clickNav(page, width, '.nav-item[data-layout="tasks"]');
  await expect(page.locator('#boardView')).toBeVisible();
}

for (const width of [1366, 390]) {
  test(`Ver.374 fresh room shows new-task action but no misleading clear (${width}px)`, async ({ page }) => {
    await start(page, width, 'empty');
    const board = page.locator('#boardView [data-task-zero-guide-v374]');
    await expect(board).toBeVisible();
    await expect(board).toContainText('まだタスクがありません');
    await expect(board.locator('[data-new-task-empty]')).toBeVisible();
    await expect(board.locator('[data-task-zero-clear-v374]')).toHaveCount(0);
    await page.locator('[data-task-layout="list"]').click();
    const list = page.locator('#listView [data-task-zero-guide-v374]');
    await expect(list).toBeVisible();
    await expect(list.locator('[data-new-task-empty]')).toBeVisible();
    await expect(page.locator('.task-zero-row-v374')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  });

  test(`Ver.374 board/list show active search and reuse reset without saving (${width}px)`, async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await start(page, width, 'sample');
    const before = await page.evaluate(room => localStorage.getItem(`system-task-tasks:${room}`), ROOM);
    await expect(page.locator('#boardView [data-task-id="v374-mine-open"]')).toBeVisible();
    await page.locator('#searchInput').fill('no-match-v374');
    const guide = page.locator('#boardView [data-task-zero-guide-v374]');
    await expect(guide).toContainText('この条件に一致するタスクはありません');
    await expect(guide).toContainText('検索「no-match-v374」');
    await expect(page.locator('#boardView [data-add-status]')).toHaveCount(1);
    await page.locator('[data-task-layout="list"]').click();
    const list = page.locator('#listView [data-task-zero-guide-v374]');
    await expect(list).toBeVisible();
    await list.locator('[data-task-zero-clear-v374]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#listView tr[data-task-id="v374-mine-open"]')).toBeVisible();
    await expect(page.locator('#searchInput')).toHaveValue('');
    await page.locator('[data-task-layout="board"]').click();
    await expect(page.locator('#boardView [data-task-zero-guide-v374]')).toHaveCount(0);
    expect(await page.evaluate(room => localStorage.getItem(`system-task-tasks:${room}`), ROOM)).toBe(before);
    expect(errors).toEqual([]);
  });

  test(`Ver.374 mine+done empty scope explains conditions and resets (${width}px)`, async ({ page }) => {
    await start(page, width, 'sample');
    await clickNav(page, width, MINE);
    await clickNav(page, width, DONE);
    const guide = page.locator('#boardView [data-task-zero-guide-v374]');
    await expect(guide).toBeVisible();
    await expect(guide).toContainText('自分の担当');
    await expect(guide).toContainText('完了');
    await guide.locator('[data-task-zero-clear-v374]').click();
    await expect(page.locator('#boardView [data-task-id="v374-mine-open"]')).toBeVisible();
    await expect(page.locator(MINE)).toHaveAttribute('aria-pressed','false');
    await expect(page.locator(DONE)).toHaveAttribute('aria-pressed','false');
  });

  test(`Ver.374 HTML-escapes the filter and re-evaluates after reload (${width}px)`, async ({ page }) => {
    await start(page, width, 'sample');
    const search = '<img src=x onerror=alert(1)>';
    await page.locator('#searchInput').fill(search);
    const guide = page.locator('#boardView [data-task-zero-guide-v374]');
    await expect(guide).toContainText(search);
    await expect(guide.locator('img')).toHaveCount(0);
    await page.reload({ waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true);
    await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === window.WORK_BOARD_RELEASE.version);
    await clickNav(page, width, '.nav-item[data-layout="tasks"]');
    // Chromium may restore search form state across reload; the guidance must reflect the actual input.
    if (await page.locator('#searchInput').inputValue()) {
      await expect(page.locator('#boardView [data-task-zero-guide-v374]')).toBeVisible();
      await page.locator('#boardView [data-task-zero-clear-v374]').click();
    }
    await expect(page.locator('#boardView [data-task-id="v374-mine-open"]')).toBeVisible();
    await expect(page.locator('#boardView [data-task-zero-guide-v374]')).toHaveCount(0);
  });
}
