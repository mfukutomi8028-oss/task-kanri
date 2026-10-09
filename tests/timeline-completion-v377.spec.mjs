import { test, expect } from '@playwright/test';

const ROOM = 'test-timeline-completion-v377';
const USER = 'QA377';
const PEER = 'Peer377';
const MINE = '.nav-item[data-filter="mine"]';
const DONE = '.nav-item[data-filter="done"]';
const TIMELINE = '#timelineView';

async function openMenu(page, width) {
  if (width > 860) return;
  const menu = page.locator('.work-mobile-menu-button');
  if (await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
}
async function closeMenu(page, width) {
  if (width > 860) return;
  const menu = page.locator('.work-mobile-menu-button');
  if (await menu.getAttribute('aria-expanded') === 'true') await menu.click();
}
async function clickNav(page, width, selector) {
  await openMenu(page, width);
  await page.locator(selector).click();
  await closeMenu(page, width);
}
async function statusFilter(page, width, value) {
  await openMenu(page, width);
  await page.locator('#statusFilter').selectOption(value);
  await closeMenu(page, width);
}
async function boot(page, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/*', route => {
    const origin = new URL(route.request().url()).origin;
    return origin === 'http://127.0.0.1:4173'
      ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(({ room, user, peer }) => {
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
    if (localStorage.getItem('timeline-v377-fixture-ready') === '1') return;
    localStorage.clear();
    const now = new Date();
    const fmt = day => [day.getFullYear(), String(day.getMonth() + 1).padStart(2, '0'), String(day.getDate()).padStart(2, '0')].join('-');
    const today = fmt(now);
    const future = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    const task = (id, assignee, status, dueDate) => ({
      id, title: 'V377 ' + id, assignee, status, dueDate, dueTime: '',
      category: 'その他', priority: '中', description: '', requester: '',
      tags: [], checklist: [], comments: [], history: [], recurrence: 'none',
      pinned: false, completedAt: status === '完了' ? Date.now() : 0,
      completedMemo: '', revision: 1, createdAt: Date.now(), updatedAt: Date.now(),
      createdBy: user, updatedBy: user
    });
    localStorage.setItem('systemTaskUser', user);
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('work-board-desktop-sidebar-pinned-v158', '1');
    localStorage.setItem('system-task-users:' + room, JSON.stringify([user, peer]));
    localStorage.setItem('system-task-layout:' + room, 'timeline');
    localStorage.setItem('system-task-tasks:' + room, JSON.stringify([
      task('mine-done', user, '完了', today),
      task('peer-done', peer, '完了', today),
      task('mine-open', user, '未着手', today),
      task('peer-open', peer, '未着手', today),
      task('mine-undated-done', user, '完了', ''),
      task('mine-outside-done', user, '完了', fmt(future))
    ]));
    localStorage.setItem('timeline-v377-fixture-ready', '1');
  }, { room: ROOM, user: USER, peer: PEER });
  await page.goto('/?room=' + ROOM, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true);
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === window.WORK_BOARD_RELEASE.version);
  await clickNav(page, width, '.nav-item[data-layout="tasks"]');
  await page.locator('[data-task-layout="timeline"]').click();
  await expect(page.locator(TIMELINE)).toBeVisible();
}
async function expectStatusRows(page, status) {
  await expect(page.locator(TIMELINE + ' .timeline-row-label')).toHaveCount(1);
  await expect(page.locator(TIMELINE + ' .timeline-row-label')).toContainText(status);
}
async function expectMineDone(page) {
  await expectStatusRows(page, '完了');
  await expect(page.locator(TIMELINE + ' .timeline-cell [data-task-id="mine-done"]')).toBeVisible();
  await expect(page.locator(TIMELINE + ' .timeline-cell [data-task-id="peer-done"]')).toHaveCount(0);
  await expect(page.locator(TIMELINE + ' .timeline-cell [data-task-id="mine-open"]')).toHaveCount(0);
  await expect(page.locator(TIMELINE + ' .timeline-undated [data-task-id="mine-undated-done"]')).toBeVisible();
  await expect(page.locator(TIMELINE + ' [data-task-id="mine-outside-done"]')).toHaveCount(0);
}
for (const width of [1366, 390]) {
  for (const order of [[MINE, DONE], [DONE, MINE]]) {
    test('Ver.377 timeline mine+done rows (' + width + 'px ' + order.join(' / ') + ')', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await boot(page, width);
      const before = await page.evaluate(room => localStorage.getItem('system-task-tasks:' + room), ROOM);
      await expectStatusRows(page, '未着手');
      for (const nav of order) await clickNav(page, width, nav);
      await expectMineDone(page);
      await page.locator(TIMELINE + ' [data-timeline-range]').selectOption('month');
      await expectMineDone(page);
      await page.locator(TIMELINE + ' [data-timeline-range]').selectOption('14');
      await expectMineDone(page);
      await page.locator('[data-task-layout="board"]').click();
      await expect(page.locator('#boardView [data-task-id="mine-done"]')).toBeVisible();
      await page.locator('[data-task-layout="list"]').click();
      await expect(page.locator('#listView tr[data-task-id="mine-done"]')).toBeVisible();
      await expect(page.locator('#listView tr[data-task-id="peer-done"]')).toHaveCount(0);
      expect(await page.evaluate(room => localStorage.getItem('system-task-tasks:' + room), ROOM)).toBe(before);
      expect(errors).toEqual([]);
    });
  }
  test('Ver.377 detailed completion status and reset remain coherent (' + width + 'px)', async ({ page }) => {
    await boot(page, width);
    await statusFilter(page, width, '完了');
    await expectStatusRows(page, '完了');
    await expect(page.locator(TIMELINE + ' .timeline-cell [data-task-id="mine-done"]')).toBeVisible();
    await expect(page.locator(TIMELINE + ' .timeline-cell [data-task-id="peer-done"]')).toBeVisible();
    await page.locator('#searchInput').fill('V377 mine-done');
    await expect(page.locator(TIMELINE + ' .timeline-cell [data-task-id="mine-done"]')).toBeVisible();
    await expect(page.locator(TIMELINE + ' .timeline-cell [data-task-id="peer-done"]')).toHaveCount(0);
    await page.locator('#searchInput').fill('');
    await statusFilter(page, width, '未着手');
    await expectStatusRows(page, '未着手');
    await expect(page.locator(TIMELINE + ' .timeline-cell [data-task-id="mine-open"]')).toBeVisible();
    await expect(page.locator(TIMELINE + ' .timeline-cell [data-task-id="mine-done"]')).toHaveCount(0);
    await openMenu(page, width);
    await page.locator('#resetFilters').click();
    await closeMenu(page, width);
    await expectStatusRows(page, '未着手');
    await expect(page.locator(TIMELINE + ' .timeline-cell [data-task-id="peer-open"]')).toBeVisible();
    if (width <= 860) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
    }
  });
}
