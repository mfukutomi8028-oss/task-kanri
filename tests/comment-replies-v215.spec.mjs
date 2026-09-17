import { test, expect } from '@playwright/test';

const ROOM = 'test-comment-replies-v215';

function taskRecord(id) {
  const now = Date.now();
  return {
    id,
    title: 'コメント返信テスト',
    description: '',
    requester: '',
    assignee: '福冨',
    status: '対応中',
    priority: '中',
    category: 'その他',
    tags: [],
    dueDate: '',
    dueTime: '',
    pinned: false,
    checklist: [],
    comments: [
      { id: 'root-old-v215', author: '森井', type: '作業メモ', text: '先に確認した内容です', createdAt: now - 5000 },
      { id: 'reply-old-v215', author: '福冨', type: '確認依頼', text: '確認ありがとうございます', createdAt: now - 4000, replyTo: 'root-old-v215' },
      { id: 'reply-nested-v215', author: '森井', type: '作業メモ', text: '追加で確認しました', createdAt: now - 3000, replyTo: 'reply-old-v215' },
      { id: 'root-new-v215', author: '福冨', type: '申し送り', text: '別件の申し送りです', createdAt: now - 1000, reactions: { '👍': ['森井'] } }
    ],
    history: [],
    recurrence: 'none',
    recurrenceRule: {},
    createdAt: now - 10_000,
    createdBy: '福冨',
    updatedAt: now,
    updatedBy: '福冨',
    completedAt: 0,
    completedMemo: '',
    revision: 1
  };
}

async function boot(page) {
  await page.addInitScript(({ room, task }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([task]));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM, task: taskRecord('task-comments-v215') });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await page.waitForSelector('[data-task-id="task-comments-v215"]', { timeout: 15_000 });
  await page.evaluate(() => document.querySelector('[data-task-id="task-comments-v215"]')?.click());
  await expect(page.locator('.task-detail-tab-v149[data-tab="comments"]')).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => document.querySelector('.task-detail-tab-v149[data-tab="comments"]')?.click());
  await expect(page.locator('.task-detail-panel-v149[data-tab-panel="comments"]')).toBeVisible();
}

test('threads replies under the root comment and keeps reactions bound by comment id', async ({ page }) => {
  await boot(page);

  const oldThread = page.locator('.comment-thread-v215[data-thread-root="root-old-v215"]');
  await expect(oldThread).toBeVisible();
  await expect(oldThread.locator(':scope > .activity-comment[data-comment-id="root-old-v215"]')).toBeVisible();
  await expect(oldThread.locator('.comment-reply-list-v215 .activity-comment[data-comment-id="reply-old-v215"]')).toBeVisible();
  await expect(oldThread.locator('.comment-reply-list-v215 .activity-comment[data-comment-id="reply-nested-v215"]')).toBeVisible();
  await expect(oldThread.locator('.comment-reply-count-v215')).toHaveText('返信 2件');

  const nestedReply = oldThread.locator('[data-comment-id="reply-nested-v215"]');
  await expect(nestedReply.locator('.comment-reply-context-v215')).toContainText('福冨');
  await expect(nestedReply.locator('.comment-reply-context-v215')).toContainText('確認ありがとうございます');

  const newest = page.locator('.activity-comment[data-comment-id="root-new-v215"]');
  const reaction = newest.locator('.comment-reaction-chip-v165[data-comment-reaction-emoji="👍"]');
  await expect(reaction).toBeVisible();
  await expect(reaction).toContainText('1');
  await expect(page.locator('.activity-comment[data-comment-id="root-old-v215"] .comment-reaction-chip-v165[data-comment-reaction-emoji="👍"]')).toHaveCount(0);
});

test('shows reply context, supports cancel, and saves local-mode reply through the existing comment write path', async ({ page }) => {
  await boot(page);

  await page.locator('[data-comment-id="root-old-v215"] [data-comment-reply-target="root-old-v215"]').click();
  const banner = page.locator('.comment-reply-compose-v215');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('森井さんへ返信');
  await expect(banner).toContainText('先に確認した内容です');
  await expect(page.locator('#commentText')).toHaveAttribute('placeholder', '返信内容を入力');

  await page.locator('[data-cancel-comment-reply-v215]').click();
  await expect(banner).toHaveCount(0);
  await expect(page.locator('#commentText')).toHaveAttribute('placeholder', '対応状況や申し送りを入力');

  await page.locator('[data-comment-id="root-old-v215"] [data-comment-reply-target="root-old-v215"]').click();
  await page.locator('#commentText').fill('ローカル返信を保存します');
  await page.locator('#commentText').press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');

  await expect.poll(async () => page.evaluate(({ room }) => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    const task = tasks.find(item => item.id === 'task-comments-v215');
    return (task?.comments || []).some(comment => String(comment.text || '').includes('ローカル返信を保存します'));
  }, { room: ROOM }), { timeout: 15_000 }).toBe(true);

  const storedReply = await page.evaluate(({ room }) => {
    const tasks = JSON.parse(localStorage.getItem(`system-task-tasks:${room}`) || '[]');
    const task = tasks.find(item => item.id === 'task-comments-v215');
    return (task?.comments || []).find(comment => String(comment.text || '').includes('ローカル返信を保存します')) || null;
  }, { room: ROOM });
  expect(storedReply?.text).toContain('[[wb-reply:root-old-v215]]');

  await expect(page.getByText('ローカル返信を保存します', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('[[wb-reply:root-old-v215]]', { exact: false })).toHaveCount(0);
});
