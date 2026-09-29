import { test, expect } from '@playwright/test';

const ROOM = 'test-task-dialog-followup-v322';

async function boot(page) {
  await page.addInitScript(room => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '土屋']));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, ROOM);
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => Number(document.documentElement.dataset.taskDialogUxVersion || 0) >= 321, undefined, { timeout: 10_000 });
}

async function installFixture(page) {
  await page.evaluate(() => {
    const detail = document.getElementById('detailBody');
    detail.classList.remove('empty');
    detail.innerHTML = `
      <h3 class="detail-title">眼科）明尾Drスケジュール</h3>
      <div class="task-meta"><span class="badge">未着手</span><span class="badge">中</span></div>
      <div class="detail-status-control-v146"><div class="detail-status-label-v146"><strong>状態を変更</strong><span>編集画面を開かずに更新</span></div><select class="detail-status-select-v146"><option>未着手</option></select></div>
      <div class="detail-actions detail-actions-v2">
        <div class="main-actions"><button type="button" data-action="edit">編集する</button><button type="button">✓ 完了にする</button></div>
        <div class="sub-actions">
          <button type="button" data-quick-pin-v154>固定</button>
          <button type="button" class="detail-favorite-button" data-action="favorite">お気に入り</button>
          <button type="button">予定を作成</button>
          <button type="button">複製</button>
          <button type="button" data-action="delete" data-operation-key="task-delete:v322-task">削除</button>
        </div>
      </div>
      <section class="detail-section description-fixture"><h4>内容・メモ</h4><div class="description">10月末退職予定のため有給消化\n現在別の医師を手配中です。</div></section>
      <section class="detail-section checklist-fixture"><h4>チェックリスト</h4><div class="checklist"><label class="check-item"><input type="checkbox"><span>確認項目</span></label></div></section>
      <section class="detail-section metadata-fixture"><div class="detail-grid"><div class="field-card"><small>担当者</small><strong>福冨</strong></div><div class="field-card"><small>依頼元</small><strong>総務課</strong></div><div class="field-card"><small>期限</small><strong>期限なし</strong></div><div class="field-card"><small>最終更新</small><strong>09/29 17:32</strong></div></div></section>
      <section class="detail-section activity-section">
        <h4>対応履歴・コメント</h4>
        <form class="comment-form" id="commentForm"><select><option>作業メモ</option></select><textarea id="commentText"></textarea><button type="submit">追加</button></form>
        <div class="activity-tabs">
          <input type="radio" name="activityTab-v322-task" id="activityComments-v322-task" checked>
          <input type="radio" name="activityTab-v322-task" id="activityHistory-v322-task">
          <div class="activity-tab-buttons"><label for="activityComments-v322-task">コメント <span>3</span></label><label for="activityHistory-v322-task">対応履歴 <span>2</span></label></div>
          <div class="activity-tab-panel activity-comments-panel"><div class="history-list compact-activity-list"><article class="history-item">コメント1</article><article class="history-item">コメント2</article><article class="history-item">コメント3</article></div></div>
          <div class="activity-tab-panel activity-history-panel"><div class="history-list compact-activity-list"><article class="history-item">履歴1</article><article class="history-item">履歴2</article></div></div>
        </div>
      </section>`;
    document.getElementById('taskId').value = 'v322-task';
    document.getElementById('taskDialog').showModal();
  });

  await expect(page.locator('#taskDialogDetailTabV319')).toBeVisible();
  await page.locator('#taskDialogDetailTabV319').click();
  await expect(page.locator('#taskDialogDetailPanelV319 #detailBody')).toBeVisible();
  await expect(page.locator('#taskDialogDetailPanelV319 .task-detail-tabs-v149')).toBeVisible();
}

test('Ver.322 expands content and checklist across the available detail width', async ({ page }) => {
  await boot(page);
  await installFixture(page);

  const widths = await page.evaluate(() => {
    const panel = document.querySelector('#taskDialogDetailPanelV319 .task-detail-panel-v149[data-tab-panel="details"]');
    const description = panel?.querySelector('.description-fixture');
    const checklist = panel?.querySelector('.checklist-fixture');
    return {
      panel: panel?.getBoundingClientRect().width || 0,
      description: description?.getBoundingClientRect().width || 0,
      checklist: checklist?.getBoundingClientRect().width || 0
    };
  });

  expect(widths.description).toBeGreaterThan(widths.panel * 0.9);
  expect(widths.checklist).toBeGreaterThan(widths.panel * 0.9);
});

test('Ver.322 keeps detail presentation stable when pin/favorite rerender resets detailBody classes', async ({ page }) => {
  await boot(page);
  await installFixture(page);

  await page.evaluate(() => {
    const detail = document.getElementById('detailBody');
    detail.className = 'detail-body';
    const pin = detail.querySelector('[data-quick-pin-v154]');
    const favorite = detail.querySelector('[data-action="favorite"]');
    if (pin) pin.textContent = '固定解除';
    if (favorite) favorite.textContent = 'お気に入り解除';
  });

  const buttons = page.locator('#taskDialogDetailPanelV319 #detailBody > .detail-actions > .sub-actions > button');
  await expect(buttons).toHaveCount(5);
  const ys = await buttons.evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().y)));
  expect(new Set(ys).size).toBe(1);

  const details = page.locator('#taskDialogDetailPanelV319 .task-detail-panel-v149[data-tab-panel="details"]');
  const comments = page.locator('#taskDialogDetailPanelV319 .task-comments-panel-v149');
  await expect(details).toBeVisible();
  await expect(comments).toBeHidden();

  const columns = await details.evaluate(node => getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length);
  expect(columns).toBe(1);
});

test('Ver.322 keeps the comment composer visible in a sticky right column without an extra click', async ({ page }) => {
  await boot(page);
  await installFixture(page);

  await page.locator('#taskDialogDetailPanelV319 .task-detail-tab-v149[data-tab="comments"]').click();
  const comments = page.locator('#taskDialogDetailPanelV319 .task-comments-panel-v149');
  const feed = comments.locator('.task-comment-feed-v149');
  const compose = comments.locator('.task-comment-compose-v149');
  const form = compose.locator('.comment-form');
  const toggle = compose.locator('.task-comment-compose-toggle-v320');

  await expect(comments).toBeVisible();
  await expect(form).toBeVisible();
  if (await toggle.count()) await expect(toggle).toBeHidden();

  const layout = await page.evaluate(() => {
    const panel = document.querySelector('#taskDialogDetailPanelV319 .task-comments-panel-v149');
    const feed = panel?.querySelector('.task-comment-feed-v149');
    const compose = panel?.querySelector('.task-comment-compose-v149');
    const feedBox = feed?.getBoundingClientRect();
    const composeBox = compose?.getBoundingClientRect();
    const style = compose ? getComputedStyle(compose) : null;
    return {
      feedX: feedBox?.x || 0,
      feedRight: feedBox?.right || 0,
      composeX: composeBox?.x || 0,
      position: style?.position || '',
      top: style?.top || ''
    };
  });

  expect(layout.composeX).toBeGreaterThan(layout.feedRight);
  expect(layout.position).toBe('sticky');
  expect(parseFloat(layout.top)).toBeGreaterThan(0);

  await page.evaluate(() => { document.getElementById('detailBody').className = 'detail-body'; });
  await expect(form).toBeVisible();
  await expect(comments).toBeVisible();
});
