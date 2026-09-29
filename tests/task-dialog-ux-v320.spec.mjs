import { test, expect } from '@playwright/test';

const ROOM = 'test-task-dialog-ux-v320';

async function boot(page) {
  await page.addInitScript(room => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
  }, ROOM);
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.taskDialogUxVersion === '320');
}

test('Ver.320 dialog detail uses wide layout and correct checklist controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await boot(page);
  await page.evaluate(() => {
    const detail = document.getElementById('detailBody');
    detail.classList.remove('empty');
    detail.innerHTML = `
      <h3 class="detail-title">Ver.320 task</h3>
      <div class="detail-actions"><div class="sub-actions"><button data-action="edit">編集する</button><button>固定</button><button>お気に入り</button><button>予定を作成</button><button data-action="delete" data-operation-key="task-delete:v320-task">削除</button></div></div>
      <div class="task-detail-tabs-v149" role="tablist"><button class="task-detail-tab-v149 active" data-tab="details">詳細</button><button class="task-detail-tab-v149" data-tab="comments">コメント</button><button class="task-detail-tab-v149" data-tab="history">履歴</button></div>
      <div class="task-detail-panel-v149" data-tab-panel="details"><section class="detail-section"><h4>チェックリスト (1/2)</h4><div class="checklist"><label class="check-item done"><input type="checkbox" checked><span>完了項目</span></label><label class="check-item"><input type="checkbox"><span>未完了項目</span></label></div></section><section class="detail-section"><div class="detail-grid"><div class="field-card">担当</div></div></section></div>
      <div class="task-detail-panel-v149 task-comments-panel-v149" data-tab-panel="comments" hidden><div class="task-comment-compose-v149"><div><strong>コメントを追加</strong></div><form class="comment-form"><textarea id="commentText"></textarea><button>追加</button></form></div><section class="task-comment-feed-v149"><div class="history-list"><article class="history-item">既存コメント1</article><article class="history-item">既存コメント2</article></div></section></div>
      <div class="task-detail-panel-v149" data-tab-panel="history" hidden></div>`;
    document.getElementById('taskId').value = 'v320-task';
    document.getElementById('taskDialog').showModal();
  });
  await page.locator('#taskDialogDetailTabV319').click();
  const detail = page.locator('#taskDialogDetailPanelV319 #detailBody');
  await expect(detail).toHaveClass(/task-dialog-detail-active-v320/);
  const checklist = page.locator('#taskDialogDetailPanelV319 .checklist');
  const columns = await checklist.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(2);
  const box = await page.locator('#taskDialogDetailPanelV319 .check-item input').first().evaluate(node => ({width:getComputedStyle(node).width,height:getComputedStyle(node).height}));
  expect(box.width).toBe('18px');
  expect(box.height).toBe('18px');
});

test('Ver.320 comments prioritize history and expand composer only on demand', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await boot(page);
  await page.evaluate(() => {
    const detail = document.getElementById('detailBody');
    detail.classList.remove('empty');
    detail.innerHTML = `
      <div class="detail-actions"><div class="sub-actions"><button data-action="edit">編集する</button><button data-action="delete" data-operation-key="task-delete:v320-comments">削除</button></div></div>
      <div class="task-detail-tabs-v149" role="tablist"><button class="task-detail-tab-v149" data-tab="details">詳細</button><button class="task-detail-tab-v149 active" data-tab="comments">コメント</button><button class="task-detail-tab-v149" data-tab="history">履歴</button></div>
      <div class="task-detail-panel-v149" data-tab-panel="details" hidden></div>
      <div class="task-detail-panel-v149 task-comments-panel-v149" data-tab-panel="comments"><div class="task-comment-compose-v149"><div><strong>コメントを追加</strong></div><form class="comment-form"><textarea id="commentText"></textarea><button>追加</button></form></div><section class="task-comment-feed-v149"><div class="history-list"><article class="history-item">コメントA</article><article class="history-item">コメントB</article><article class="history-item">コメントC</article></div></section></div>
      <div class="task-detail-panel-v149" data-tab-panel="history" hidden></div>`;
    document.getElementById('taskId').value = 'v320-comments';
    document.getElementById('taskDialog').showModal();
  });
  await page.locator('#taskDialogDetailTabV319').click();
  const toggle = page.locator('.task-comment-compose-toggle-v320');
  await expect(toggle).toBeVisible();
  await expect(page.locator('.task-comment-compose-v149 .comment-form')).toBeHidden();
  const order = await page.evaluate(() => ({feed:getComputedStyle(document.querySelector('.task-comment-feed-v149')).order,compose:getComputedStyle(document.querySelector('.task-comment-compose-v149')).order}));
  expect(order.feed).toBe('1');
  expect(order.compose).toBe('2');
  await toggle.click();
  await expect(page.locator('.task-comment-compose-v149 .comment-form')).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded','true');
});
