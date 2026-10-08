import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const productSource = readFileSync(new URL('../test-harness/fixtures/favorite-ui-v237-pre-v369.js', import.meta.url), 'utf8');
const auditSource = readFileSync(new URL('../test-harness/favorite-observer-semantic-v366.test.mjs', import.meta.url), 'utf8');
const injectionPoint = '  function installObservers() {';
const broadPredicate = 'if (records.some(record => record.addedNodes.length || record.removedNodes.length)) schedulePatch();';

function v366Predicate() {
  const prefix = 'const predicate = String.raw' + String.fromCharCode(96);
  const start = auditSource.indexOf(prefix);
  if (start < 0) throw Error('Ver.366 candidate definition missing');
  const begin = auditSource.indexOf('\n', start) + 1;
  const end = auditSource.indexOf(String.fromCharCode(96) + ';', begin);
  if (begin < 1 || end < begin) throw Error('Ver.366 candidate boundary missing');
  const result = auditSource.slice(begin, end);
  if (!result.includes('function favoriteMutationV366(records)')) throw Error('Ver.366 semantic filter missing');
  return result;
}

function browserSource(variant) {
  if (productSource.split(broadPredicate).length !== 2 ||
      productSource.split(injectionPoint).length !== 2) {
    throw Error('Ver.367 injection boundary drifted from active product');
  }
  let candidate = productSource;
  if (variant === 'candidate') {
    candidate = candidate.replace(injectionPoint, v366Predicate() + '\n' + injectionPoint)
      .replace(broadPredicate, 'if (favoriteMutationV366(records)) schedulePatch();');
  }
  const marker = "  'use strict';";
  const runMarker = '  function runPatch() {\n    patchScheduled = false;';
  if (candidate.split(marker).length !== 2 || candidate.split(runMarker).length !== 2) {
    throw Error('Ver.367 instrumentation boundary drifted');
  }
  candidate = candidate.replace(marker, marker + '\n  window.__v367FavoriteVariant = ' + JSON.stringify(variant) + ';');
  candidate = candidate.replace(runMarker, '  function runPatch() {\n    window.__v367FavoritePatchRuns = (window.__v367FavoritePatchRuns || 0) + 1;\n    patchScheduled = false;');
  return candidate;
}

function seedTask() {
  const now = Date.now();
  return {
    id: 'v367-favorite-task', title: 'Ver.367 お気に入り監査', status: '未着手',
    assignee: '福冨', requester: '', category: 'その他', priority: '中',
    tags: [], description: '', checklist: [], recurrence: 'none',
    dueDate: '', dueTime: '', pinned: false, completedAt: 0, completedMemo: '',
    comments: [], history: [], revision: 1, createdBy: '福冨',
    updatedBy: '福冨', createdAt: now - 2000, updatedAt: now
  };
}

async function boot(page, variant, width, suffix) {
  const room = 'test-v367-favorite-' + variant + '-' + width + '-' + suffix;
  await page.setViewportSize({ width, height: width <= 860 ? 844 : 900 });
  await page.addInitScript(({ room, task }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('system-task-users:' + room, JSON.stringify(['福冨', '森井']));
    localStorage.setItem('system-task-tasks:' + room, JSON.stringify([task]));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
  }, { room, task: seedTask() });

  const browserScript = browserSource(variant);
  let routeLoads = 0;
  await page.route(/\/favorite-ui-v237\.js(?:\?.*)?$/, async route => {
    const original = await route.fetch();
    routeLoads++;
    await route.fulfill({ response: original, body: browserScript });
  });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));

  await page.goto('/?room=' + encodeURIComponent(room), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(v => window.__v367FavoriteVariant === v, variant, { timeout: 12_000 });
  expect(routeLoads).toBe(1);
  await page.locator('.nav-item[data-layout="tasks"]').first().evaluate(button => button.click());
  await expect(page.locator('#boardView [data-star-task="v367-favorite-task"]').first()).toHaveCount(1);
  await page.evaluate(async () => {
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
  return room;
}

async function patchDelta(page, inject) {
  return page.evaluate(async html => {
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    window.__v367FavoritePatchRuns = 0;
    const wrapper = document.createElement('section');
    wrapper.dataset.v367Noise = 'true';
    wrapper.innerHTML = html;
    document.getElementById('mainContent').append(wrapper);
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    const count = window.__v367FavoritePatchRuns;
    wrapper.remove();
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    return count;
  }, inject);
}

for (const variant of ['product', 'candidate']) {
  test('Ver.367 desktop ' + variant + ': unrelated childList mutation wakeup', async ({ page }) => {
    await boot(page, variant, 1366, 'noise');
    const delta = await patchDelta(page, '<span>Unrelated DOM change</span>');
    if (variant === 'product') expect(delta).toBeGreaterThan(0);
    else expect(delta).toBe(0);
    await expect(page.locator('.nav-item[data-filter="favorite"]')).toContainText('お気に入り');
  });
}

for (const size of [1366, 430, 390]) {
  test('Ver.367 candidate favorite toggle, filter, redraw and notifications at ' + size + 'px', async ({ page }) => {
    await boot(page, 'candidate', size, 'toggle');
    const selector = '#boardView [data-star-task="v367-favorite-task"]';
    const star = page.locator(selector).first();
    await expect(star).toHaveAttribute('aria-label', 'お気に入りに追加');
    await star.evaluate(button => button.click());
    await expect(page.locator(selector).first()).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(selector).first()).toHaveAttribute('aria-label', 'お気に入りを解除');
    await expect(page.locator('#toast')).toContainText('お気に入りに追加しました');
    await page.locator('.nav-item[data-filter="favorite"]').first().evaluate(button => button.click());
    await expect(page.locator('#boardView .task-card').filter({ hasText: 'Ver.367 お気に入り監査' })).toHaveCount(1);
    await expect(page.locator('.nav-item[data-filter="favorite"]')).toContainText('お気に入り');
    await page.locator(selector).first().evaluate(button => button.click());
    await expect(page.locator('#toast')).toContainText('お気に入りから外しました');
    await expect(page.locator('#boardView .task-card')).toHaveCount(0);
  });
}

test('Ver.367 candidate adopts nested detail replacement, sidebar cleanup, and ARIA corrections', async ({ page }) => {
  await boot(page, 'candidate', 1366, 'replacement');
  const detail = page.locator('#detailBody');
  await detail.evaluate(node => {
    node.classList.remove('empty');
    node.innerHTML = '<section class="v367-panel"><div class="nested"><button class="detail-favorite-button" data-action="favorite">☆ スター</button></div></section>';
  });
  await expect(detail.locator('.detail-favorite-button')).toHaveText('お気に入り');
  await expect(detail.locator('.detail-favorite-button')).toHaveAttribute('aria-label', 'お気に入りに追加');
  await detail.locator('.v367-panel').evaluate(panel => {
    panel.innerHTML = '<div><button class="detail-favorite-button starred" data-action="favorite">★ スター解除</button></div>';
  });
  await expect(detail.locator('.detail-favorite-button')).toHaveText('お気に入り解除');
  await expect(detail.locator('.detail-favorite-button')).toHaveAttribute('title', 'お気に入りを解除');
  await page.evaluate(() => {
    // Replace the canonical control rather than introducing duplicate IDs.
    document.getElementById('favoriteOnly')?.closest('label.check-row')?.remove();
    const row = document.createElement('label');
    row.className = 'check-row';
    row.id = 'v367-reinserted';
    row.innerHTML = '<input id="favoriteOnly" type="checkbox"/>スターのみ';
    document.querySelector('.sidebar').append(row);
    const clear = document.createElement('button');
    clear.id = 'clearRoomCache';
    document.querySelector('.sidebar').append(clear);
  });
  await expect(page.locator('#clearRoomCache')).toHaveCount(0);
  await expect(page.locator('#v367-reinserted')).toBeHidden();
  await expect(page.locator('#favoriteOnly')).toHaveAttribute('aria-hidden', 'true');
});

test('Ver.367 candidate still wakes for unrelated check-row insertion: known scope limitation', async ({ page }) => {
  await boot(page, 'candidate', 1366, 'limitation');
  const delta = await patchDelta(page, '<label class="check-row"><input type="checkbox"/>Unrelated filter</label>');
  expect(delta).toBeGreaterThan(0);
});
