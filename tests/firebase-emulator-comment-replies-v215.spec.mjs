import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-comment-replies-v215';
const HOST = '127.0.0.1';
const PORT = 9000;
const PROD_DATABASE_RE = /https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i;

test.skip(process.env.WORK_BOARD_FIREBASE_E2E !== '1', 'requires the isolated RTDB emulator');
test.describe.configure({ mode: 'serial' });

function emulatorUrl(path = '') {
  const encoded = String(path || '').split('/').filter(Boolean).map(segment => encodeURIComponent(segment)).join('/');
  return `http://${HOST}:${PORT}/${encoded ? `${encoded}.json` : '.json'}?ns=${encodeURIComponent(PROJECT)}`;
}

async function emulatorRequest(path, { method = 'GET', value } = {}) {
  const response = await fetch(emulatorUrl(path), {
    method,
    headers: value === undefined ? undefined : { 'content-type': 'application/json' },
    body: value === undefined ? undefined : JSON.stringify(value)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path || '/'} failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const readDb = path => emulatorRequest(path);
const putDb = (path, value) => emulatorRequest(path, { method: 'PUT', value });
const deleteDb = path => emulatorRequest(path, { method: 'DELETE' });

function taskRecord(id) {
  const now = Date.now();
  return {
    id,
    title: '返信保存テスト',
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
    comments: [{
      id: 'parent-v215',
      author: '森井',
      type: '作業メモ',
      text: '親コメントです',
      createdAt: now - 2000,
      reactions: { '👍': ['森井'] }
    }],
    history: [],
    recurrence: 'none',
    recurrenceRule: {},
    createdAt: now - 10_000,
    createdBy: '森井',
    updatedAt: now - 2000,
    updatedBy: '森井',
    completedAt: 0,
    completedMemo: '',
    revision: 7
  };
}

async function boot(page) {
  const productionRequests = [];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.addInitScript(({ project, room, host, port }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    const demoConfig = Object.freeze({
      apiKey: 'demo-api-key',
      authDomain: `${project}.firebaseapp.com`,
      databaseURL: `http://${host}:${port}/?ns=${project}`,
      projectId: project,
      appId: '1:000000000000:web:firebase-emulator-only'
    });
    window.WORK_BOARD_TEST = Object.freeze({ emulator: true, host, port });
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return demoConfig; },
      set() {}
    });
  }, { project: PROJECT, room: ROOM, host: HOST, port: PORT });

  await page.route(PROD_DATABASE_RE, route => {
    productionRequests.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  page.on('request', request => {
    if (PROD_DATABASE_RE.test(request.url())) productionRequests.push(request.url());
  });

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('connectionPill')?.textContent?.includes('共同編集ON'), undefined, { timeout: 30_000 });

  // The workflow taskMap is a localStorage-backed convenience API, not the
  // authoritative Firebase subscription boundary. Wait for the canonical app
  // renderer instead so this test proves the seeded remote task is usable.
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await page.waitForSelector('[data-task-id="task-reply-v215"]', { timeout: 30_000 });
  await page.evaluate(() => document.querySelector('[data-task-id="task-reply-v215"]')?.click());
  await expect(page.locator('.task-detail-tab-v149[data-tab="comments"]')).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => document.querySelector('.task-detail-tab-v149[data-tab="comments"]')?.click());
  await expect(page.locator('.task-detail-panel-v149[data-tab-panel="comments"]')).toBeVisible();

  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);
  return { productionRequests, pageErrors };
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
  await putDb(`rooms/${ROOM}/meta`, {
    users: ['福冨', '森井'],
    userColors: { '福冨': '#3c92df', '森井': '#4ebd69' },
    _revisions: { users: 1, userColors: 1 }
  });
  await putDb(`rooms/${ROOM}/tasks/task-reply-v215`, taskRecord('task-reply-v215'));
});

test('saves a structured reply, appends one history record, increments revision once, and keeps parent reaction ownership', async ({ page }) => {
  const { productionRequests, pageErrors } = await boot(page);

  const parent = page.locator('.activity-comment[data-comment-id="parent-v215"]');
  await expect(parent).toBeVisible({ timeout: 15_000 });
  await expect(parent.locator('.comment-reaction-chip-v165[data-comment-reaction-emoji="👍"]')).toContainText('1');

  await parent.locator('[data-comment-reply-target="parent-v215"]').click();
  await expect(page.locator('.comment-reply-compose-v215')).toContainText('森井さんへ返信');
  await page.locator('#commentText').fill('Firebaseへ返信を保存します');
  await page.locator('#commentType').selectOption({ label: '確認依頼' });
  await page.locator('#commentForm button[type="submit"]').click();

  await expect.poll(async () => {
    const task = await readDb(`rooms/${ROOM}/tasks/task-reply-v215`);
    return {
      revision: Number(task?.revision || 0),
      reply: (task?.comments || []).find(comment => comment?.replyTo === 'parent-v215') || null,
      history: (task?.history || []).at(-1) || null
    };
  }, { timeout: 20_000 }).toMatchObject({
    revision: 8,
    reply: {
      author: '福冨',
      type: '確認依頼',
      text: 'Firebaseへ返信を保存します',
      replyTo: 'parent-v215'
    },
    history: {
      author: '福冨',
      text: '確認依頼を追加しました。'
    }
  });

  const stored = await readDb(`rooms/${ROOM}/tasks/task-reply-v215`);
  const reply = stored.comments.find(comment => comment?.replyTo === 'parent-v215');
  expect(reply?.id).toMatch(/^reply-/);
  expect(String(reply?.text || '')).not.toContain('[[wb-reply:');
  expect(stored.comments.find(comment => comment.id === 'parent-v215')?.reactions).toEqual({ '👍': ['森井'] });
  expect(stored.history).toHaveLength(1);
  expect(stored.history[0]?.id).toMatch(/^history-/);
  expect(stored.history[0]?.createdAt).toBe(reply.createdAt);

  const thread = page.locator('.comment-thread-v215[data-thread-root="parent-v215"]');
  await expect(thread.locator(`.comment-reply-list-v215 [data-comment-id="${reply.id}"]`)).toBeVisible({ timeout: 20_000 });
  await expect(thread.locator('.comment-reply-count-v215')).toHaveText('返信 1件');
  await expect(thread.locator(`.activity-comment[data-comment-id="${reply.id}"] .comment-reply-context-v215`)).toContainText('親コメントです');
  await expect(parent.locator('.comment-reaction-chip-v165[data-comment-reaction-emoji="👍"]')).toContainText('1');

  await page.locator('.task-detail-tab-v149[data-tab="history"]').click();
  await expect(page.locator('.task-detail-panel-v149[data-tab-panel="history"]')).toBeVisible();
  await expect(page.getByText('確認依頼を追加しました。', { exact: true })).toBeVisible({ timeout: 20_000 });

  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);
});
