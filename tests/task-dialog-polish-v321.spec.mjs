import { test, expect } from '@playwright/test';

const ROOM = 'test-task-dialog-polish-v321';

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
  await page.waitForFunction(() => document.documentElement.dataset.taskDialogUxVersion === '321', undefined, { timeout: 10_000 });
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
          <button type="button" data-quick-pin-v154>固定解除</button>
          <button type="button" class="detail-favorite-button starred" data-action="favorite">お気に入り解除</button>
          <button type="button">予定を作成</button>
          <button type="button">複製</button>
          <button type="button" data-action="delete" data-operation-key="task-delete:v321-task">削除</button>
        </div>
      </div>
      <section class="detail-section"><h4>内容・メモ</h4><div class="description">本文を広い領域で確認します。</div></section>
      <section class="detail-section"><h4>チェックリスト (1/2)</h4><div class="checklist"><label class="check-item done"><input type="checkbox" checked><span>確認済み</span></label><label class="check-item"><input type="checkbox"><span>未確認</span></label></div></section>
      <section class="detail-section metadata-fixture"><div class="detail-grid"><div class="field-card"><small>担当者</small><strong>福冨</strong></div><div class="field-card"><small>依頼元</small><strong>総務課</strong></div><div class="field-card"><small>期限</small><strong>期限なし</strong></div><div class="field-card"><small>最終更新</small><strong>09/29 17:32</strong></div></div></section>
      <section class="detail-section activity-section">
        <h4>対応履歴・コメント</h4>
        <form class="comment-form" id="commentForm"><select><option>作業メモ</option></select><textarea id="commentText"></textarea><button type="submit">追加</button></form>
        <div class="activity-tabs">
          <input type="radio" name="activityTab-v321-task" id="activityComments-v321-task" checked>
          <input type="radio" name="activityTab-v321-task" id="activityHistory-v321-task">
          <div class="activity-tab-buttons"><label for="activityComments-v321-task">コメント <span>2</span></label><label for="activityHistory-v321-task">対応履歴 <span>2</span></label></div>
          <div class="activity-tab-panel activity-comments-panel"><div class="history-list compact-activity-list"><article class="history-item">コメント1</article><article class="history-item">コメント2</article></div></div>
          <div class="activity-tab-panel activity-history-panel"><div class="history-list compact-activity-list"><article class="history-item">履歴1</article><article class="history-item">履歴2</article></div></div>
        </div>
      </section>`;
    document.getElementById('taskId').value = 'v321-task';
    document.getElementById('taskDialog').showModal();
  });
  await expect(page.locator('#taskDialogDetailTabV319')).toBeVisible();
  await page.locator('#taskDialogDetailTabV319').click();
  await expect(page.locator('#taskDialogTitle')).toHaveText('タスク詳細');
  await expect(page.locator('#taskDialogDetailPanelV319 #detailBody')).toBeVisible();
  await expect(page.locator('#taskDialogDetailPanelV319 .task-detail-tabs-v149')).toBeVisible();
}

test('Ver.321 keeps each inner detail tab isolated so comments appear only on Comments', async ({ page }) => {
  await boot(page);
  await installFixture(page);

  const comments = page.locator('#taskDialogDetailPanelV319 .task-comments-panel-v149');
  const history = page.locator('#taskDialogDetailPanelV319 .task-history-panel-v149');
  const tools = page.locator('#taskDialogDetailPanelV319 .task-tools-panel-v154');
  const details = page.locator('#taskDialogDetailPanelV319 .task-detail-panel-v149[data-tab-panel="details"]');

  await expect(details).toBeVisible();
  await expect(comments).toBeHidden();
  await expect(history).toBeHidden();
  await expect(tools).toBeHidden();

  await page.locator('#taskDialogDetailPanelV319 .task-detail-tab-v149[data-tab="comments"]').click();
  await expect(comments).toBeVisible();
  await expect(history).toBeHidden();
  await expect(details).toBeHidden();
  await expect(tools).toBeHidden();

  await page.locator('#taskDialogDetailPanelV319 .task-detail-tab-v149[data-tab="history"]').click();
  await expect(history).toBeVisible();
  await expect(comments).toBeHidden();
  await expect(details).toBeHidden();

  await page.locator('#taskDialogDetailPanelV319 .task-detail-tab-v149[data-tab="tools"]').click();
  await expect(tools).toBeVisible();
  await expect(comments).toBeHidden();
  await expect(history).toBeHidden();
});

test('Ver.321 places task information after checklist at full review width and preserves the good checklist UI', async ({ page }) => {
  await boot(page);
  await installFixture(page);

  const result = await page.evaluate(() => {
    const panel = document.querySelector('#taskDialogDetailPanelV319 .task-detail-panel-v149[data-tab-panel="details"]');
    const checklist = panel?.querySelector('.detail-section:has(.checklist)');
    const metadata = panel?.querySelector('.task-metadata-section-v154');
    const box = metadata?.getBoundingClientRect();
    return {
      afterChecklist: Boolean(checklist && metadata && (checklist.compareDocumentPosition(metadata) & Node.DOCUMENT_POSITION_FOLLOWING)),
      metadataWidth: box?.width || 0,
      panelWidth: panel?.getBoundingClientRect().width || 0,
      columns: metadata ? getComputedStyle(metadata.querySelector('.detail-grid')).gridTemplateColumns : ''
    };
  });
  expect(result.afterChecklist).toBeTruthy();
  expect(result.metadataWidth).toBeGreaterThan(result.panelWidth * 0.85);
  expect(result.columns.trim().split(/\s+/).length).toBe(4);

  const checkbox = page.locator('#taskDialogDetailPanelV319 .check-item input[type="checkbox"]').first();
  const box = await checkbox.boundingBox();
  expect(box?.width || 999).toBeLessThanOrEqual(20);
});

test('Ver.321 switches the large heading between task detail and task edit', async ({ page }) => {
  await boot(page);
  await installFixture(page);
  await expect(page.locator('#taskDialogTitle')).toHaveText('タスク詳細');
  await page.locator('#taskDialogEditTabV319').click();
  await expect(page.locator('#taskDialogTitle')).toHaveText('タスク編集');
  await page.locator('#taskDialogDetailTabV319').click();
  await expect(page.locator('#taskDialogTitle')).toHaveText('タスク詳細');
});

test('Ver.321 mention picker is mounted inside the open task dialog and remains operable', async ({ page }) => {
  await boot(page);
  await installFixture(page);
  await page.locator('#taskDialogDetailPanelV319 .task-detail-tab-v149[data-tab="comments"]').click();
  await page.locator('#taskDialogDetailPanelV319 .task-comment-compose-toggle-v320').click();
  const mentionButton = page.locator('#taskDialogDetailPanelV319 [data-open-mention-picker-v156]');
  await expect(mentionButton).toBeVisible();
  await mentionButton.click();
  const shell = page.locator('#taskDialog > .workflow-mention-shell-v156');
  await expect(shell).toBeVisible();
  await expect(shell).toHaveAttribute('data-mention-layer-host-v321', 'task-dialog');
  await expect(shell.locator('#workflowMentionSearchV156')).toBeFocused();
  await expect(shell.locator('[data-close-mention-v156]').last()).toBeVisible();
});

test('Ver.321 keeps fixed and favorite state labels on the same desktop action row', async ({ page }) => {
  await boot(page);
  await installFixture(page);
  const buttons = page.locator('#taskDialogDetailPanelV319 .detail-actions-v2 .sub-actions > button');
  await expect(buttons).toHaveCount(5);
  await expect(buttons.nth(0)).toHaveText('固定解除');
  await expect(buttons.nth(1)).toHaveText('お気に入り解除');
  const ys = await buttons.evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().y)));
  expect(new Set(ys).size).toBe(1);
});
