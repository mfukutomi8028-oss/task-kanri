import { test, expect } from '@playwright/test';

const ROOM = 'test-task-dialog-ui-v320';

async function boot(page) {
  await page.addInitScript(room => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
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
  await page.waitForFunction(() => document.documentElement.dataset.userReportedStabilityVersion === '319', undefined, { timeout: 10_000 });
}

async function installFixture(page) {
  await page.evaluate(() => {
    const detail = document.getElementById('detailBody');
    detail.classList.remove('empty');
    detail.innerHTML = `
      <h3 class="detail-title">施設予約運用決定・ショートカット作成</h3>
      <div class="task-meta"><span class="badge status-対応中">対応中</span><span class="badge priority-中">中</span></div>
      <div class="detail-status-control-v146"><div class="detail-status-label-v146"><strong>状態を変更</strong><span>編集画面を開かずに更新</span></div><select class="detail-status-select-v146"><option>対応中</option></select></div>
      <div class="detail-actions detail-actions-v2">
        <div class="main-actions"><button type="button" data-action="edit">編集する</button><button type="button">✓ 完了にする</button></div>
        <div class="sub-actions"><button type="button">固定</button><button type="button">お気に入り</button><button type="button">予定を作成</button><button type="button">複製</button><button type="button" data-action="delete" data-operation-key="task-delete:v320-task">削除</button></div>
      </div>
      <section class="detail-section"><div class="detail-grid">
        <div class="field-card"><small>担当者</small><strong>福冨</strong></div>
        <div class="field-card"><small>依頼元</small><strong>医事課</strong></div>
        <div class="field-card"><small>期限</small><strong>2026-10-01</strong></div>
        <div class="field-card"><small>最終更新</small><strong>2026-09-29</strong></div>
      </div></section>
      <section class="detail-section"><h4>内容・メモ</h4><div class="description">広い詳細画面では本文を読みやすく表示します。</div></section>
      <section class="detail-section"><h4>チェックリスト (2/4)</h4><div class="checklist">
        <label class="check-item done"><input type="checkbox" data-check-index="0" checked><span>ショートカット作成部署</span></label>
        <label class="check-item"><input type="checkbox" data-check-index="1"><span>管理部署の決定</span></label>
        <label class="check-item done"><input type="checkbox" data-check-index="2" checked><span>管理部署への説明</span></label>
        <label class="check-item"><input type="checkbox" data-check-index="3"><span>運用開始前の最終確認</span></label>
      </div></section>
      <section class="detail-section activity-section">
        <h4>対応履歴・コメント</h4>
        <form class="comment-form" id="commentForm"><select id="commentType"><option>作業メモ</option></select><textarea id="commentText" placeholder="対応状況や申し送りを入力"></textarea><button type="submit">追加</button></form>
        <div class="activity-tabs">
          <input type="radio" name="activityTab-v320-task" id="activityComments-v320-task" checked>
          <input type="radio" name="activityTab-v320-task" id="activityHistory-v320-task">
          <div class="activity-tab-buttons"><label for="activityComments-v320-task">コメント <span>3</span></label><label for="activityHistory-v320-task">対応履歴 <span>2</span></label></div>
          <div class="activity-tab-panel activity-comments-panel"><div class="history-list compact-activity-list"><article class="history-item">コメント1</article><article class="history-item">コメント2</article><article class="history-item">コメント3</article></div></div>
          <div class="activity-tab-panel activity-history-panel"><div class="history-list compact-activity-list"><article class="history-item">履歴1</article><article class="history-item">履歴2</article></div></div>
        </div>
      </section>`;
    document.getElementById('taskId').value = 'v320-task';
    document.getElementById('taskDialog').showModal();
  });

  await expect(page.locator('#taskDialogDetailTabV319')).toBeVisible();
  await page.locator('#taskDialogDetailTabV319').click();
  await expect(page.locator('#taskDialogDetailPanelV319 #detailBody')).toBeVisible();
  await expect(page.locator('#taskDialogDetailPanelV319 .task-detail-tabs-v149')).toBeVisible();
}

test('Ver.320 wide dialog uses the available desktop space without changing the compact right pane', async ({ page }) => {
  await boot(page);
  await installFixture(page);

  const dialogBox = await page.locator('#taskDialog').boundingBox();
  expect(dialogBox?.width || 0).toBeGreaterThan(1000);

  const detailGridColumns = await page.locator('#taskDialogDetailPanelV319 .detail-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns);
  expect(detailGridColumns.trim().split(/\s+/).length).toBe(4);

  await page.evaluate(() => document.getElementById('taskDialog').close());
  await expect(page.locator('.detail-panel > #detailBody')).toBeAttached();
  const rightPaneColumns = await page.locator('.detail-panel > #detailBody .checklist').evaluate(el => getComputedStyle(el).gridTemplateColumns);
  expect(rightPaneColumns.trim().split(/\s+/).length).toBe(1);
});

test('Ver.320 checklist checkboxes stay compact and labels use two readable columns in the dialog', async ({ page }) => {
  await boot(page);
  await installFixture(page);

  const checklistColumns = await page.locator('#taskDialogDetailPanelV319 .checklist').evaluate(el => getComputedStyle(el).gridTemplateColumns);
  expect(checklistColumns.trim().split(/\s+/).length).toBe(2);

  const checkboxBox = await page.locator('#taskDialogDetailPanelV319 .check-item input[type="checkbox"]').first().boundingBox();
  expect(checkboxBox?.width || 999).toBeLessThanOrEqual(20);
  expect(checkboxBox?.height || 999).toBeLessThanOrEqual(20);

  const done = page.locator('#taskDialogDetailPanelV319 .check-item.done').first();
  expect(await done.evaluate(el => getComputedStyle(el).textDecorationLine)).toBe('none');
  expect(await done.locator('span').evaluate(el => getComputedStyle(el).textDecorationLine)).toContain('line-through');
});

test('Ver.320 comments keep history primary and open the composer only on demand', async ({ page }) => {
  await boot(page);
  await installFixture(page);

  await page.locator('#taskDialogDetailPanelV319 .task-detail-tab-v149[data-tab="comments"]').click();
  const panel = page.locator('#taskDialogDetailPanelV319 .task-comments-panel-v149');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.history-item')).toHaveCount(3);

  const toggle = panel.locator('.task-comment-compose-toggle-v320');
  const form = panel.locator('.task-comment-compose-v149 .comment-form');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(form).toBeHidden();

  const feedBox = await panel.locator('.task-comment-feed-v149').boundingBox();
  const composeBox = await panel.locator('.task-comment-compose-v149').boundingBox();
  expect(feedBox?.y || 0).toBeLessThan(composeBox?.y || 999);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(form).toBeVisible();
  const textareaBox = await panel.locator('#commentText').boundingBox();
  expect(textareaBox?.height || 0).toBeGreaterThanOrEqual(80);
  expect(textareaBox?.height || 999).toBeLessThan(180);
});
