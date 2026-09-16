import { test, expect } from '@playwright/test';

const ROOM = 'test-user-ux-polish-v208';

async function installLocalBoundary(page) {
  await page.addInitScript(({ room }) => {
    try {
      const now = Date.now();
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
      localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
        {
          id: 'ux-v208-task',
          title: 'Ver.208 UX確認タスク',
          description: '',
          requester: '',
          assignee: '福冨',
          status: '未着手',
          priority: '中',
          category: 'その他',
          tags: [],
          dueDate: '',
          dueTime: '',
          pinned: false,
          checklist: [],
          comments: [],
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
        }
      ]));
      localStorage.setItem(`work-board-workflow-v152:${room}`, JSON.stringify({
        inbox: {
          '福冨': {
            'ux-v208-inbox-event': {
              taskId: 'ux-v208-task',
              type: 'mention',
              title: '@メンションされました',
              body: '森井：単品既読の確認です',
              actor: '森井',
              createdAt: now,
              readAt: 0
            }
          }
        },
        archives: {},
        duplicates: {}
      }));
    } catch {}

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, width = 1366, height = 900) {
  await page.setViewportSize({ width, height });
  await installLocalBoundary(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return version === '208' && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
}

async function clickCurrent(page, selector) {
  const clicked = await page.evaluate(target => {
    const node = document.querySelector(target);
    if (!(node instanceof HTMLElement)) return false;
    node.click();
    return true;
  }, selector);
  expect(clicked, `expected clickable element: ${selector}`).toBeTruthy();
}

test('removes only the requested sidebar UI while preserving the Star filter state hook', async ({ page }) => {
  await boot(page);

  const favorite = page.locator('#favoriteOnly');
  await expect(favorite).toBeAttached();
  await expect(favorite).toBeHidden();
  await expect(page.locator('label.check-row', { hasText: 'スターのみ' })).toBeHidden();
  await expect(page.locator('#roomCacheHelp')).toHaveCount(0);
  await expect(page.locator('#clearRoomCache')).toHaveCount(0);

  await clickCurrent(page, '.nav-item[data-filter="favorite"]');
  await expect(favorite).toBeChecked();
  await expect(page.locator('.nav-item[data-filter="favorite"]')).toHaveClass(/active/);
});

test('keeps the quick-pin feature but removes the pin emoji from task detail', async ({ page }) => {
  await boot(page);
  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await page.waitForFunction(() => Boolean(document.querySelector('[data-task-id="ux-v208-task"]')), undefined, { timeout: 10_000 });
  await clickCurrent(page, '[data-task-id="ux-v208-task"]');

  const pin = page.locator('.detail-quick-pin-v154');
  await expect(pin).toBeVisible({ timeout: 10_000 });
  await expect(pin).toHaveText('固定');
  await expect(pin).not.toContainText('📌');
  await expect(pin).toHaveAttribute('data-quick-pin-v154', 'ux-v208-task');
});

test('warns before discarding changed task input from backdrop, Escape, and close button', async ({ page }) => {
  await boot(page);
  await clickCurrent(page, '#newTask');
  const dialog = page.locator('#taskDialog');
  await expect(dialog).toBeVisible();
  const title = page.locator('#taskTitle');
  await title.click();
  await title.pressSequentially('未保存の変更');

  let message = '';
  page.once('dialog', async prompt => {
    message = prompt.message();
    await prompt.dismiss();
  });
  await page.evaluate(() => {
    const node = document.getElementById('taskDialog');
    const rect = node.getBoundingClientRect();
    node.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: Math.max(0, rect.left - 12),
      clientY: Math.max(0, rect.top - 12)
    }));
  });
  expect(message).toContain('入力内容が変更されています');
  await expect(dialog).toBeVisible();

  message = '';
  page.once('dialog', async prompt => {
    message = prompt.message();
    await prompt.dismiss();
  });
  await page.keyboard.press('Escape');
  expect(message).toContain('入力内容が変更されています');
  await expect(dialog).toBeVisible();

  message = '';
  page.once('dialog', async prompt => {
    message = prompt.message();
    await prompt.accept();
  });
  await page.locator('#closeTaskDialog').click();
  expect(message).toContain('入力内容が変更されています');
  await expect(dialog).toBeHidden();
});

test('single notification read button toggles read state and remains reversible', async ({ page }) => {
  await boot(page, 430, 900);

  const entry = page.locator('[data-open-personal-inbox-v153]');
  await expect(entry).toBeVisible({ timeout: 10_000 });
  await expect(entry.locator('.workflow-inbox-entry-badge-v153')).toHaveText('1');
  await entry.click();

  const shell = page.locator('.workflow-inbox-shell-v153');
  await expect(shell).toBeVisible();
  const readButton = shell.locator('[data-inbox-read-v153="ux-v208-inbox-event"]');
  await expect(readButton).toBeVisible();
  await expect(readButton).toHaveText('既読');
  await readButton.click();

  await expect(shell.locator('[data-inbox-list-v153]')).toContainText('未読の通知はありません');
  await expect(entry.locator('.workflow-inbox-entry-badge-v153')).toBeHidden();

  await shell.locator('[data-inbox-filter-v153="all"]').click();
  const unreadAgain = shell.locator('[data-inbox-read-v153="ux-v208-inbox-event"]');
  await expect(unreadAgain).toBeVisible();
  await expect(unreadAgain).toHaveText('未読に戻す');
  await unreadAgain.click();

  await expect(entry.locator('.workflow-inbox-entry-badge-v153')).toHaveText('1');
  await expect(entry.locator('.workflow-inbox-entry-badge-v153')).toBeVisible();
  await expect(shell.locator('[data-inbox-read-v153="ux-v208-inbox-event"]')).toHaveText('既読');
});
