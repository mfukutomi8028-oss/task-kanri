import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const product = readFileSync(new URL('../favorite-ui-v237.js', import.meta.url), 'utf8');

function instrument() {
  const boundary = '  function runPatch() {\n    patchScheduled = false;';
  if (product.split(boundary).length !== 2) throw Error('favorite runtime instrumentation drift');
  return product.replace(boundary,
    '  function runPatch() {\n    window.__v370FavoriteRuns = (window.__v370FavoriteRuns || 0) + 1;\n    patchScheduled = false;');
}

async function boot(page, width) {
  const room = 'test-v370-favorite-target-' + width;
  const now = Date.now();
  await page.setViewportSize({ width, height: width <= 860 ? 844 : 900 });
  await page.addInitScript(({ room, now }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('system-task-users:' + room, JSON.stringify(['福冨', '土屋']));
    localStorage.setItem('system-task-tasks:' + room, JSON.stringify([{
      id: 'v370-task', title: 'Ver.370 favorite audit', status: '未着手',
      assignee: '福冨', requester: '', category: 'その他', priority: '中',
      tags: [], description: '', checklist: [], recurrence: 'none',
      dueDate: '', dueTime: '', pinned: false, completedAt: 0, completedMemo: '',
      comments: [], history: [], revision: 1, createdBy: '福冨',
      updatedBy: '福冨', createdAt: now - 1000, updatedAt: now
    }]));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
  }, { room, now });
  let loaded = 0;
  await page.route(/\/favorite-ui-v237\.js(?:\?.*)?$/, async route => {
    const original = await route.fetch();
    loaded++;
    await route.fulfill({ response: original, body: instrument() });
  });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
  await page.goto('/?room=' + encodeURIComponent(room), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await expect(page.locator('.nav-item[data-filter="favorite"]')).toContainText('お気に入り');
  expect(loaded).toBe(1);
}

async function mutationDelta(page, kind) {
  return page.evaluate(async kind => {
    const frame = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    await frame();
    window.__v370FavoriteRuns = 0;
    const sidebar = document.querySelector('.sidebar');
    const nav = sidebar.querySelector('.nav-item[data-filter="favorite"]');
    const unrelated = document.createElement('label');
    unrelated.className = 'check-row';
    unrelated.innerHTML = '<input type="checkbox">Unrelated filter';
    if (kind === 'unrelated-row') sidebar.append(unrelated);
    else if (kind === 'favorite-nav') {
      const n = document.createElement('span');
      n.textContent = 'unrelated decorative child';
      nav.append(n);
    } else if (kind === 'unrelated-inside-sidebar') {
      const wrapper = document.createElement('div');
      wrapper.className = 'v370-unrelated';
      sidebar.append(wrapper);
      wrapper.append(document.createElement('span'));
    }
    await frame();
    return window.__v370FavoriteRuns;
  }, kind);
}

for (const width of [1366, 390]) {
  test('Ver.370 product observer target boundary at ' + width + 'px', async ({ page }) => {
    await boot(page, width);
    expect(await mutationDelta(page, 'unrelated-row')).toBe(0);
    expect(await mutationDelta(page, 'unrelated-inside-sidebar')).toBe(0);
    expect(await mutationDelta(page, 'favorite-nav')).toBeGreaterThan(0);
    await expect(page.locator('.nav-item[data-filter="favorite"]')).toContainText('お気に入り');
  });
}

test('Ver.370 favorite checkbox detached/replaced row still restores hidden UI', async ({ page }) => {
  await boot(page, 1366);
  await page.evaluate(() => {
    const old = document.getElementById('favoriteOnly').closest('label.check-row');
    old.remove();
    const next = document.createElement('label');
    next.className = 'check-row';
    next.id = 'v370-favorite-row';
    next.innerHTML = '<input id="favoriteOnly" type="checkbox">スターのみ';
    document.querySelector('.sidebar').append(next);
  });
  await expect(page.locator('#v370-favorite-row')).toBeHidden();
  await expect(page.locator('#favoriteOnly')).toHaveAttribute('aria-hidden', 'true');
});
