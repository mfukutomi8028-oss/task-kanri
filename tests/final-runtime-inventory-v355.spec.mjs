import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-runtime-inventory-v355';

async function boot(page, suffix) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(roomId => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', roomId);
    localStorage.setItem(`system-task-users:${roomId}`, JSON.stringify(['福冨']));
    localStorage.setItem(`system-task-tasks:${roomId}`, '[]');
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });

    const state = window.__WB_V355_COMMENTS_TABS_OBSERVER__ = {
      observers: 0, callbacks: 0, records: 0, observes: []
    };
    const NativeMutationObserver = window.MutationObserver;
    window.MutationObserver = class extends NativeMutationObserver {
      constructor(callback) {
        const stack = String(new Error().stack || '');
        const owned = stack.includes('comments-tabs-v149.js');
        super((records, observer) => {
          if (owned) {
            state.callbacks += 1;
            state.records += records.length;
          }
          return callback(records, observer);
        });
        this.__wbV355Owned = owned;
        if (owned) state.observers += 1;
      }
      observe(target, options) {
        if (this.__wbV355Owned) {
          state.observes.push({
            target: target?.id ? `#${target.id}` : String(target?.nodeName || 'unknown'),
            childList: Boolean(options?.childList),
            subtree: Boolean(options?.subtree),
            attributes: Boolean(options?.attributes),
            characterData: Boolean(options?.characterData)
          });
        }
        return super.observe(target, options);
      }
    };
  }, room);

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.goto(`/?room=${encodeURIComponent(room)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  return room;
}

async function renderCanonicalDetail(page, marker) {
  await page.evaluate(value => {
    const detail = document.getElementById('detailBody');
    detail.classList.remove('empty');
    detail.innerHTML = `
      <button type="button" data-action="delete" data-operation-key="task-delete:v355-${value}">削除</button>
      <div class="detail-actions"><button type="button">action</button></div>
      <section class="detail-section"><h4>内容</h4><p>${value}</p></section>
      <section class="activity-section">
        <label for="activityComments-${value}">コメント <span>1</span></label>
        <label for="activityHistory-${value}">履歴 <span>1</span></label>
        <div class="comment-form"><textarea id="commentText"></textarea></div>
        <div class="activity-comments-panel"><div class="history-list"><article class="activity-comment"><div class="activity-text">comment</div></article></div></div>
        <div class="activity-history-panel"><div class="history-list"><article>history</article></div></div>
      </section>`;
  }, marker);
  await expect(page.locator('#detailBody > .task-detail-tabs-v149')).toHaveCount(1, { timeout: 10_000 });
}

async function metrics(page, reset = false) {
  return page.evaluate(shouldReset => {
    const state = window.__WB_V355_COMMENTS_TABS_OBSERVER__;
    const snapshot = {
      observers: state.observers,
      callbacks: state.callbacks,
      records: state.records,
      observes: state.observes.map(item => ({ ...item }))
    };
    if (shouldReset) {
      state.callbacks = 0;
      state.records = 0;
    }
    return snapshot;
  }, reset);
}

test('Ver.355 audit measures the active comments-tabs observer scope', async ({ page }) => {
  await boot(page, 'scope');
  await renderCanonicalDetail(page, 'scope');
  const state = await metrics(page);
  expect(state.observers).toBe(1);
  expect(state.observes).toEqual([{
    target: '#detailBody', childList: true, subtree: true, attributes: false, characterData: false
  }]);
});

test('Ver.355 audit proves unrelated descendant churn still wakes comments-tabs after tabs already exist', async ({ page }) => {
  await boot(page, 'descendant');
  await renderCanonicalDetail(page, 'descendant');
  await metrics(page, true);

  await page.evaluate(() => {
    const noise = document.createElement('span');
    noise.dataset.v355Noise = 'true';
    noise.textContent = 'unrelated descendant noise';
    document.querySelector('#detailBody .task-comment-feed-v149')?.append(noise);
  });
  await page.waitForTimeout(120);

  const state = await metrics(page);
  expect(state.callbacks).toBeGreaterThan(0);
  expect(state.records).toBeGreaterThan(0);
  await expect(page.locator('#detailBody > .task-detail-tabs-v149')).toHaveCount(1);
  await expect(page.locator('#detailBody .task-detail-tab-v149')).toHaveCount(3);
});

test('Ver.355 audit confirms outside-detail churn is ignored while canonical root redraw is still required', async ({ page }) => {
  await boot(page, 'redraw');
  await renderCanonicalDetail(page, 'first');
  await metrics(page, true);

  await page.evaluate(() => {
    const outside = document.createElement('div');
    outside.id = 'v355OutsideNoise';
    document.body.append(outside);
  });
  await page.waitForTimeout(80);
  expect((await metrics(page)).callbacks).toBe(0);

  await renderCanonicalDetail(page, 'second');
  const state = await metrics(page);
  expect(state.callbacks).toBeGreaterThan(0);
  await page.locator('#detailBody .task-detail-tab-v149[data-tab="comments"]').click();
  await expect(page.locator('#detailBody .task-detail-panel-v149[data-tab-panel="comments"]')).toBeVisible();
});
