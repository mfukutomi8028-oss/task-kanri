import { test, expect } from '@playwright/test';

const ROOM_PREFIX = 'test-comment-reactions-observer-v353';
const TASK_ID = 'task-comment-reactions-v353';
const COMMENT_ID = 'comment-comment-reactions-v353';

function taskRecord() {
  const now = Date.now();
  return {
    id: TASK_ID,
    title: 'Ver.353 コメントObserver監査',
    description: '', requester: '', assignee: '福冨', status: '対応中', priority: '中', category: 'その他', tags: [],
    dueDate: '', dueTime: '', pinned: false, checklist: [],
    comments: [{ id: COMMENT_ID, author: '森井', type: '作業メモ', text: 'Observer semantic filterを監査します', createdAt: now - 1000 }],
    history: [], recurrence: 'none', recurrenceRule: {}, createdAt: now - 5000, createdBy: '福冨', updatedAt: now,
    updatedBy: '福冨', completedAt: 0, completedMemo: '', revision: 1
  };
}

async function boot(page, suffix, { candidate = false } = {}) {
  const room = `${ROOM_PREFIX}-${suffix}`;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ room, task }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([task]));
    window.__WB_V353__ = { schedules: 0, mode: '' };
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
  }, { room, task: taskRecord() });

  await page.route(/\/comment-reactions-v191\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let source = await response.text();
    const scheduleAnchor = '  function schedulePatch(delay = 40) {';
    if (!source.includes(scheduleAnchor)) throw new Error('Ver.353 schedulePatch anchor not found');
    source = source.replace(scheduleAnchor, `${scheduleAnchor}\n    window.__WB_V353__.schedules += 1;`);

    if (candidate) {
      const startAnchor = '  function start() {';
      const helper = `  const COMMENT_SURFACE_SELECTOR_V353 = ".task-comments-panel-v149, .activity-comments-panel, #commentForm, .comment-form, .activity-comment";\n  const COMMENT_OWNED_SELECTOR_V353 = ".comment-thread-v215, .comment-reactions-v165, .comment-thread-actions-v215, .comment-reply-compose-v215, .comment-reply-context-v215";\n\n  function mutationTouchesCommentSurfaceV353(mutation) {\n    return [...mutation.addedNodes].some(node => {\n      if (!(node instanceof Element)) return false;\n      if (node.matches(COMMENT_OWNED_SELECTOR_V353)) return false;\n      return node.matches(COMMENT_SURFACE_SELECTOR_V353) || Boolean(node.querySelector(COMMENT_SURFACE_SELECTOR_V353));\n    });\n  }\n\n`;
      if (!source.includes(startAnchor)) throw new Error('Ver.353 start anchor not found');
      source = source.replace(startAnchor, `${helper}${startAnchor}`);
      const broad = 'if (mutations.some(item => item.addedNodes.length || item.removedNodes.length)) schedulePatch();';
      if (!source.includes(broad)) throw new Error('Ver.353 broad observer candidate not found');
      source = source.replace(broad, 'if (mutations.some(mutationTouchesCommentSurfaceV353)) schedulePatch();');
    }
    source = `window.__WB_V353__.mode = ${JSON.stringify(candidate ? 'candidate' : 'product')};\n${source}`;
    await route.fulfill({ response, body: source });
  });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.goto(`/?room=${encodeURIComponent(room)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => window.__WB_V353__.mode, undefined, { timeout: 10_000 });

  await page.evaluate(({ taskId, commentId }) => {
    const detail = document.getElementById('detailBody');
    detail.classList.remove('empty');
    detail.innerHTML = `
      <button type="button" data-action="delete" data-operation-key="task-delete:${taskId}">削除</button>
      <section class="detail-section unrelated-v353"><h4>内容</h4><div class="description">本文</div></section>
      <section class="task-comments-panel-v149">
        <div class="history-list">
          <article class="activity-comment" data-comment-id="${commentId}"><div class="activity-text">Observer semantic filterを監査します</div></article>
        </div>
        <div class="task-comment-compose-v149"><form class="comment-form" id="commentForm"><textarea id="commentText"></textarea><button type="submit">追加</button></form></div>
      </section>`;
  }, { taskId: TASK_ID, commentId: COMMENT_ID });

  await expect(page.locator(`[data-comment-reactions-for="${COMMENT_ID}"]`)).toHaveCount(1, { timeout: 10_000 });
  await expect(page.locator(`[data-comment-reply-target="${COMMENT_ID}"]`)).toHaveCount(1);
  await page.waitForTimeout(120);
}

const scheduleCount = page => page.evaluate(() => window.__WB_V353__.schedules);

test('Ver.353 baseline wakes for unrelated detail childList churn', async ({ page }) => {
  await boot(page, 'baseline');
  const before = await scheduleCount(page);
  await page.evaluate(() => {
    document.querySelector('#detailBody .unrelated-v353')?.insertAdjacentHTML('beforeend', '<span data-v353-noise>noise</span>');
  });
  await page.waitForTimeout(100);
  expect(await scheduleCount(page)).toBeGreaterThan(before);
});

test('Ver.353 candidate ignores unrelated detail churn and sidecar-owned DOM churn', async ({ page }) => {
  await boot(page, 'candidate-noise', { candidate: true });
  const before = await scheduleCount(page);
  await page.evaluate(() => {
    document.querySelector('#detailBody .unrelated-v353')?.insertAdjacentHTML('beforeend', '<span data-v353-noise>noise</span>');
    const owned = document.createElement('div');
    owned.className = 'comment-reactions-v165';
    document.querySelector('#detailBody .activity-comment')?.append(owned);
  });
  await page.waitForTimeout(120);
  expect(await scheduleCount(page)).toBe(before);
});

test('Ver.353 candidate adopts a canonical activity-comment addition', async ({ page }) => {
  await boot(page, 'candidate-comment', { candidate: true });
  const secondId = 'comment-comment-reactions-v353-second';
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
  }, { room: `${ROOM_PREFIX}-candidate-comment`, taskId: TASK_ID, secondId });
  await expect(page.locator(`[data-comment-reactions-for="${secondId}"]`)).toHaveCount(1, { timeout: 10_000 });
  await expect(page.locator(`[data-comment-reply-target="${secondId}"]`)).toHaveCount(1);
});

test('Ver.353 candidate adopts whole comment-panel replacement and keeps picker/reply behavior', async ({ page }) => {
  await boot(page, 'candidate-panel', { candidate: true });
  await page.evaluate(({ commentId }) => {
    const old = document.querySelector('#detailBody .task-comments-panel-v149');
    const panel = document.createElement('section');
    panel.className = 'task-comments-panel-v149';
    panel.innerHTML = `
      <div class="history-list"><article class="activity-comment" data-comment-id="${commentId}"><div class="activity-text">Observer semantic filterを監査します</div></article></div>
      <div class="task-comment-compose-v149"><form class="comment-form" id="commentForm"><textarea id="commentText"></textarea><button type="submit">追加</button></form></div>`;
    old?.replaceWith(panel);
  }, { commentId: COMMENT_ID });
  await expect(page.locator(`[data-comment-reactions-for="${COMMENT_ID}"]`)).toHaveCount(1, { timeout: 10_000 });
  await page.locator(`[data-comment-reaction-picker="${COMMENT_ID}"]`).evaluate(button => button.click());
  await expect(page.locator('.comment-reaction-picker-v165:not([hidden])')).toHaveCount(1);
  await page.locator(`[data-comment-reply-target="${COMMENT_ID}"]`).evaluate(button => button.click());
  await expect(page.locator('.comment-reply-compose-v215')).toHaveCount(1);
});