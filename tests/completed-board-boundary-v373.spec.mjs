import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { completedBoardCandidate, verifyCompletedBoardCandidate } from '../test-harness/completed-board-candidate-v373.mjs';

const ROOM = 'test-completed-board-v373';
const USER = 'QA373';
const DONE = '\u5b8c\u4e86';
const TODO = '\u672a\u7740\u624b';
const MINE = '.nav-item[data-filter="mine"]';
const COMPLETE = '.nav-item[data-filter="done"]';
const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

test('Ver.373 candidate changes only board rendering and matches all 12 source-level filter cases', () => {
  expect(verifyCompletedBoardCandidate(source)).toMatchObject({ matrixCases: 12, outsideBoardUnchanged: true });
});

async function sidebar(page, width) {
  if (width <= 860) {
    const button = page.locator('.work-mobile-menu-button');
    if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
  }
}

async function clickNav(page, width, selector) {
  await sidebar(page, width);
  await page.locator(selector).click();
}

async function setStatus(page, width, status) {
  await sidebar(page, width);
  await page.locator('#statusFilter').selectOption(status);
  if (width <= 860 && await page.locator('.work-mobile-menu-button').getAttribute('aria-expanded') === 'true') {
    await page.locator('.work-mobile-menu-button').click();
  }
}

async function boot(page, width, { candidate = false, exclusions = false } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/*', route => {
    return new URL(route.request().url()).origin === 'http://127.0.0.1:4173'
      ? route.continue() : route.abort('blockedbyclient');
  });
  if (candidate) {
    await page.route(/\/app\.js(?:\?.*)?$/, async route => {
      if (new URL(route.request().url()).origin !== 'http://127.0.0.1:4173') return route.abort('blockedbyclient');
      const response = await route.fetch();
      await route.fulfill({ response, body: completedBoardCandidate(await response.text()) });
    });
  }
  await page.addInitScript(({ room, user, done, todo, exclusions }) => {
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
    if (localStorage.getItem('v373-seeded')) return;
    localStorage.clear();
    const now = Date.now();
    const records = [
      { id: 'mine-done', assignee: user, status: done },
      { id: 'peer-done', assignee: 'Peer373', status: done },
      { id: 'mine-open', assignee: user, status: todo },
      { id: 'peer-open', assignee: 'Peer373', status: todo }
    ];
    if (exclusions) records.push(
      { id: 'archived-done', assignee: user, status: done },
      { id: 'reserved-done', assignee: user, status: done }
    );
    localStorage.setItem('systemTaskUser', user);
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('work-board-desktop-sidebar-pinned-v158', '1');
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify([user, 'Peer373']));
    localStorage.setItem(`system-task-layout:${room}`, 'board');
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify(records.map(record => ({
      ...record, title: `V373 ${record.id}`, priority: '\u4e2d', category: '\u305d\u306e\u4ed6',
      tags: [], description: '', checklist: [], recurrence: 'none', dueDate: '', dueTime: '',
      pinned: false, completedAt: record.status === done ? now : 0, completedMemo: '',
      comments: [], history: [], revision: 1, createdBy: user, updatedBy: user, createdAt: now, updatedAt: now
    }))));
    const future = new Date(); future.setDate(future.getDate() + 7);
    const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    localStorage.setItem(`system-task-start-dates:${room}`, JSON.stringify(exclusions
      ? { 'reserved-done': { date, revision: 1, updatedAt: now, updatedBy: user } } : {}));
    localStorage.setItem(`work-board-workflow-v152:${room}`, JSON.stringify({ inbox: {}, duplicates: {},
      archives: exclusions ? { 'archived-done': { archivedAt: now, archivedBy: user, reason: 'manual' } } : {} }));
    localStorage.setItem('v373-seeded', '1');
  }, { room: ROOM, user: USER, done: DONE, todo: TODO, exclusions });
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true);
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === window.WORK_BOARD_RELEASE.version);
  await clickNav(page, width, '.nav-item[data-layout="tasks"]');
  await expect(page.locator('#boardView')).toBeVisible();
  await expect(page.locator('#boardView .task-card')).toHaveCount(2);
}

async function combine(page, width, order) {
  for (const filter of order) await clickNav(page, width, filter === 'mine' ? MINE : COMPLETE);
  await expect(page.locator(MINE)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(COMPLETE)).toHaveAttribute('aria-pressed', 'true');
}

async function completedBoard(page, width, count = 1) {
  await expect(page.locator('#boardView .board-column[data-status]')).toHaveCount(1);
  await expect(page.locator('#boardView .board-column[data-status]')).toHaveAttribute('data-status', DONE);
  await expect(page.locator('#boardView .task-card:visible')).toHaveCount(count);
  await expect(page.locator('#boardView [data-task-id="mine-done"]')).toBeVisible();
  await expect(page.locator('#boardView [data-add-status]')).toHaveCount(0);
  if (width <= 860) {
    await expect(page.locator('.work-mobile-status-tabs button')).toHaveCount(1);
    await expect(page.locator('.work-mobile-status-tabs button')).toContainText(DONE);
    await expect(page.locator('#boardView .work-mobile-active-column')).toHaveCount(1);
  }
}

for (const width of [1366, 390]) {
  for (const order of [['mine', 'done'], ['done', 'mine']]) {
    test(`Ver.373 legacy reproduces missing completed board, not missing data (${width}px ${order.join('-')})`, async ({ page }) => {
      await boot(page, width);
      await combine(page, width, order);
      await expect(page.locator('#boardView .task-card')).toHaveCount(0);
      await expect(page.locator('#boardView .board-column[data-status="' + DONE + '"]')).toHaveCount(0);
      await expect(page.locator('#boardView [data-add-status]')).toHaveCount(1);
      await page.locator('[data-task-layout="list"]').click();
      await expect(page.locator('#listView tr[data-task-id="mine-done"]')).toBeVisible();
      await expect(page.locator('#listView tr[data-task-id="peer-done"]')).toHaveCount(0);
      console.log('V373_LEGACY_REPRODUCED', JSON.stringify({ width, order, boardCards: 0, listMineDone: 1 }));
    });

    test(`Ver.373 candidate keeps scope transitions and board/list agreement (${width}px ${order.join('-')})`, async ({ page }) => {
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await boot(page, width, { candidate: true });
      const before = await page.evaluate(room => localStorage.getItem(`system-task-tasks:${room}`), ROOM);
      await combine(page, width, order);
      await completedBoard(page, width);
      await page.locator('[data-task-layout="list"]').click();
      await expect(page.locator('#listView tr[data-task-id="mine-done"]')).toBeVisible();
      await expect(page.locator('#listView tr[data-task-id="peer-done"]')).toHaveCount(0);
      await page.locator('[data-task-layout="board"]').click();
      await completedBoard(page, width);
      await clickNav(page, width, MINE); // done only
      await completedBoard(page, width, 2);
      await clickNav(page, width, COMPLETE); // all unfinished
      await expect(page.locator('#boardView .task-card')).toHaveCount(2);
      await expect(page.locator('#boardView [data-task-id="mine-open"]')).toBeVisible();
      await expect(page.locator('#boardView [data-add-status]')).toHaveCount(1);
      await clickNav(page, width, MINE); // mine unfinished
      await expect(page.locator('#boardView .task-card')).toHaveCount(1);
      await expect(page.locator('#boardView [data-task-id="mine-open"]')).toBeVisible();
      expect(await page.evaluate(room => localStorage.getItem(`system-task-tasks:${room}`), ROOM)).toBe(before);
      expect(errors).toEqual([]);
    });
  }

  test(`Ver.373 candidate keeps detailed status, search, reset and reload semantics (${width}px)`, async ({ page }) => {
    await boot(page, width, { candidate: true });
    await clickNav(page, width, MINE);
    await setStatus(page, width, DONE);
    await completedBoard(page, width);
    await page.locator('#searchInput').fill('no-matching-task-v373');
    await expect(page.locator('#boardView .task-card')).toHaveCount(0);
    await page.locator('#searchInput').fill('');
    await completedBoard(page, width);
    await clickNav(page, width, COMPLETE); // detail status still selects completed tasks
    await expect(page.locator(COMPLETE)).toHaveAttribute('aria-pressed', 'false');
    await completedBoard(page, width);
    await setStatus(page, width, TODO);
    await expect(page.locator('#boardView [data-task-id="mine-open"]')).toBeVisible();
    await expect(page.locator('#boardView .task-card')).toHaveCount(1);
    await sidebar(page, width);
    await page.locator('#resetFilters').click();
    if (width <= 860 && await page.locator('.work-mobile-menu-button').getAttribute('aria-expanded') === 'true') await page.locator('.work-mobile-menu-button').click();
    await expect(page.locator('#boardView .task-card')).toHaveCount(2);
    await expect(page.locator(MINE)).toHaveAttribute('aria-pressed', 'false');
    await combine(page, width, ['mine','done']);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true);
    await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === window.WORK_BOARD_RELEASE.version);
    await clickNav(page, width, '.nav-item[data-layout="tasks"]');
    // Scope persistence is not introduced: reapply the actual current filters after reload.
    if (await page.locator(MINE).getAttribute('aria-pressed') !== 'true') await clickNav(page, width, MINE);
    if (await page.locator(COMPLETE).getAttribute('aria-pressed') !== 'true') await clickNav(page, width, COMPLETE);
    await completedBoard(page, width);
  });

  test(`Ver.373 candidate preserves archive/reserved exclusions without data writes (${width}px)`, async ({ page }) => {
    await boot(page, width, { candidate: true, exclusions: true });
    await expect(page.locator('[data-reserved-task-open]')).toBeVisible();
    const before = await page.evaluate(room => [localStorage.getItem(`system-task-tasks:${room}`), localStorage.getItem(`system-task-start-dates:${room}`)], ROOM);
    await combine(page, width, ['mine','done']);
    await completedBoard(page, width);
    await expect(page.locator('#boardView [data-task-id="archived-done"]')).toBeHidden();
    await expect(page.locator('#boardView [data-task-id="reserved-done"]')).toBeHidden();
    await expect(page.locator('[data-open-archive-v153]')).toBeVisible();
    await page.locator('[data-task-layout="list"]').click();
    await expect(page.locator('#listView tr[data-task-id="mine-done"]')).toBeVisible();
    await expect(page.locator('#listView tr[data-task-id="archived-done"]')).toBeHidden();
    await expect(page.locator('#listView tr[data-task-id="reserved-done"]')).toBeHidden();
    expect(await page.evaluate(room => [localStorage.getItem(`system-task-tasks:${room}`), localStorage.getItem(`system-task-start-dates:${room}`)], ROOM)).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  });
}
