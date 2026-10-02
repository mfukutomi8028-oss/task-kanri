import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-comment-reactions-observer-v354';
const TASK_ID = 'task-comment-reactions-v354';
const COMMENT_ID = 'comment-comment-reactions-v354';

function taskRecord() {
  const now = Date.now();
  return {
    id: TASK_ID,
    title: 'Ver.354 コメントObserver製品回帰',
    description: '', requester: '', assignee: '福冨', status: '対応中', priority: '中', category: 'その他', tags: [],
    dueDate: '', dueTime: '', pinned: false, checklist: [],
    comments: [{ id: COMMENT_ID, author: '森井', type: '作業メモ', text: 'Observer semantic filter製品回帰', createdAt: now - 1000 }],
    history: [], recurrence: 'none', recurrenceRule: {}, createdAt: now - 5000, createdBy: '福冨', updatedAt: now,
    updatedBy: '福冨', completedAt: 0, completedMemo: '', revision: 1
  };
}

async function boot(page, suffix) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ room, task }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([task]));
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
  }, { room, task: taskRecord() });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.goto(`/?room=${encodeURIComponent(room)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });

  await page.evaluate(({ taskId, commentId }) => {
    const detail = document.getElementById('detailBody');
    detail.classList.remove('empty');
    detail.innerHTML = `
      <button type="button" data-action="delete" data-operation-key="task-delete:${taskId}">削除</button>
      <section class="detail-section unrelated-v354"><h4>内容</h4><div class="description">本文</div></section>
      <section class="task-comments-panel-v149">
        <div class="history-list">
          <article class="activity-comment" data-comment-id="${commentId}"><div class="activity-text">Observer semantic filter製品回帰</div></article>
        </div>
        <div class="task-comment-compose-v149"><form class="comment-form" id="commentForm"><textarea id="commentText"></textarea><button type="submit">追加</button></form></div>
      </section>`;
  }, { taskId: TASK_ID, commentId: COMMENT_ID });

  await expect(page.locator(`[data-comment-reactions-for="${COMMENT_ID}"]`)).toHaveCount(1, { timeout: 10_000 });
  await expect(page.locator(`[data-comment-reply-target="${COMMENT_ID}"]`)).toHaveCount(1);
  await page.waitForTimeout(120);
  return room;
}

test('Ver.354 product ignores unrelated detail and sidecar-owned childList churn', async ({ page }) => {
  await boot(page, 'noise');
  await page.evaluate(() => {
    document.querySelector('#detailBody [data-comment-reactions-for]')?.remove();
    document.querySelector('#detailBody .comment-thread-actions-v215')?.remove();
    document.querySelector('#detailBody .unrelated-v354')?.insertAdjacentHTML('beforeend', '<span data-v354-noise>noise</span>');
    const owned = document.createElement('div');
    owned.className = 'comment-reactions-v165';
    document.querySelector('#detailBody .activity-comment')?.append(owned);
  });
  await page.waitForTimeout(160);
  await expect(page.locator('#detailBody [data-comment-reactions-for]')).toHaveCount(0);
  await expect(page.locator('#detailBody .comment-thread-actions-v215')).toHaveCount(0);
});

test('Ver.354 product adopts a canonical activity-comment addition', async ({ page }) => {
  const room = await boot(page, 'comment');
  const secondId = 'comment-comment-reactions-v354-second';
  await page.evaluate(({ room, taskId, secondId }) => {
    const key = `system-task-tasks:${room}`;
    const tasks = JSON.parse(localStorage.getItem(key) || '[]');
    const task = tasks.find(item => item.id === taskId);
    task.comments.unshift({ id: secondId, author: '福冨', type: '作業メモ', text: '追加コメント', createdAt: Date.now() });
    localStorage.setItem(key, JSON.stringify(tasks));
    const article = document.createElement('article');
    article.className = 'activity-comment';
    article.dataset.commentId = secondId;
    article.innerHTML = '<div class="activity-text">追加コメント</div>';
    document.querySelector('#detailBody .history-list')?.prepend(article);
  }, { room, taskId: TASK_ID, secondId });
  await expect(page.locator(`[data-comment-reactions-for="${secondId}"]`)).toHaveCount(1, { timeout: 10_000 });
  await expect(page.locator(`[data-comment-reply-target="${secondId}"]`)).toHaveCount(1);
});

test('Ver.354 product adopts whole comment-panel replacement and keeps picker/reply behavior', async ({ page }) => {
  await boot(page, 'panel');
  await page.evaluate(({ commentId }) => {
    const old = document.querySelector('#detailBody .task-comments-panel-v149');
    const panel = document.createElement('section');
    panel.className = 'task-comments-panel-v149';
    panel.innerHTML = `
      <div class="history-list"><article class="activity-comment" data-comment-id="${commentId}"><div class="activity-text">Observer semantic filter製品回帰</div></article></div>
      <div class="task-comment-compose-v149"><form class="comment-form" id="commentForm"><textarea id="commentText"></textarea><button type="submit">追加</button></form></div>`;
    old?.replaceWith(panel);
  }, { commentId: COMMENT_ID });
  await expect(page.locator(`[data-comment-reactions-for="${COMMENT_ID}"]`)).toHaveCount(1, { timeout: 10_000 });
  await page.locator(`[data-comment-reaction-picker="${COMMENT_ID}"]`).evaluate(button => button.click());
  await expect(page.locator('.comment-reaction-picker-v165:not([hidden])')).toHaveCount(1);
  await page.locator(`[data-comment-reply-target="${COMMENT_ID}"]`).evaluate(button => button.click());
  await expect(page.locator('.comment-reply-compose-v215')).toHaveCount(1);
});

test('Ver.354 product keeps explicit local-reply reconciliation after semantic observer narrowing', async ({ page }) => {
  await boot(page, 'local-reply');
  await page.locator(`[data-comment-reply-target="${COMMENT_ID}"]`).evaluate(button => button.click());
  await expect(page.locator('.comment-reply-compose-v215')).toHaveCount(1);
  await page.evaluate(({ taskId, commentId }) => {
    document.dispatchEvent(new CustomEvent('workboard:local-reply-saved-v250', {
      detail: { taskId, replyTo: commentId }
    }));
  }, { taskId: TASK_ID, commentId: COMMENT_ID });
  await expect(page.locator('.comment-reply-compose-v215')).toHaveCount(0, { timeout: 10_000 });
});
