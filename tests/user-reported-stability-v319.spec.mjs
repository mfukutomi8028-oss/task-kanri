import { test, expect } from '@playwright/test';

const ROOM = 'test-user-reported-stability-v319';
const FUTURE_IDS = ['future-1', 'future-2', 'future-3', 'future-4'];

async function installSafetyBoundary(page) {
  await page.addInitScript(({ room, futureIds }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify(futureIds.map((id, index) => ({
      id,
      title: `予約タスク${index + 1}`,
      status: '未着手',
      assignee: '福冨',
      priority: '中',
      category: '',
      createdAt: Date.now() - 1000,
      updatedAt: Date.now() - 1000,
      revision: 1,
      checklist: []
    }))));
    localStorage.setItem(`system-task-start-dates:${room}`, JSON.stringify(Object.fromEntries(
      futureIds.map(id => [id, { date: '2099-01-01', revision: 1 }])
    )));

    class FakeNotification {
      constructor(title, options) {
        window.__v319NotificationCapture = { title, options: { ...(options || {}) } };
      }
      static requestPermission() { return Promise.resolve('granted'); }
    }
    Object.defineProperty(FakeNotification, 'permission', { configurable: true, get: () => 'granted' });
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      writable: true,
      value: FakeNotification
    });

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM, futureIds: FUTURE_IDS });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await installSafetyBoundary(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.userReportedStabilityVersion === '319', undefined, { timeout: 10_000 });
  await page.waitForTimeout(180);
}

function boardMarkup({ includeHidden }) {
  const cards = Array.from({ length: 21 }, (_, index) => {
    const id = index < 4 ? `future-${index + 1}` : `visible-${index + 1}`;
    const hidden = includeHidden && index < 4 ? ' future-task-v167-hidden' : '';
    return `<article class="task-card${hidden}" data-task-id="${id}">Task ${index + 1}</article>`;
  }).join('');
  return `<section class="board-column" data-status="未着手"><div class="column-head"><span class="column-title"><span>未着手</span></span><em>21</em></div><div class="task-list">${cards}</div></section>`;
}

test('Ver.319 notification wrapper uses the safe-area notification icon', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => new Notification('テスト通知', { body: 'body', icon: 'legacy.png' }));
  const capture = await page.evaluate(() => window.__v319NotificationCapture);
  expect(capture?.options?.icon).toContain('assets/notification-brand-v319.svg?v=319');
  expect(await page.evaluate(() => window.Notification.__workBoardBrandVersion)).toBe('185');
});

test('Ver.319 board count stays at the visible 17 across a canonical 21-card redraw', async ({ page }) => {
  await boot(page);

  await page.evaluate(({ firstMarkup }) => {
    const board = document.getElementById('boardView');
    board.innerHTML = firstMarkup;
  }, { firstMarkup: boardMarkup({ includeHidden: true }) });

  const count = page.locator('.board-column[data-status="未着手"] .column-head em');
  await expect(count).toHaveText('17');

  await page.evaluate(({ redrawMarkup }) => {
    const board = document.getElementById('boardView');
    window.__v319CountTrace = [];
    window.__v319CountTraceObserver = new MutationObserver(() => {
      const value = document.querySelector('.board-column[data-status="未着手"] .column-head em')?.textContent;
      if (value) window.__v319CountTrace.push(value);
    });
    window.__v319CountTraceObserver.observe(board, { childList: true, subtree: true, characterData: true, attributes: true });
    board.innerHTML = redrawMarkup;
  }, { redrawMarkup: boardMarkup({ includeHidden: false }) });

  await expect(count).toHaveText('17');
  await page.waitForTimeout(120);
  const trace = await page.evaluate(() => window.__v319CountTrace || []);
  expect(trace).not.toContain('21');
  await expect(page.locator('.board-column[data-status="未着手"] .future-task-v167-hidden')).toHaveCount(4);
});

test('Ver.319 existing-task dialog switches between canonical Detail and Edit and restores the side detail', async ({ page }) => {
  await boot(page);

  await page.evaluate(() => {
    const detail = document.getElementById('detailBody');
    detail.classList.remove('empty');
    detail.innerHTML = `
      <div class="detail-actions"><button type="button" data-action="edit">編集する</button><button type="button" data-action="delete" data-operation-key="task-delete:v319-task">削除</button></div>
      <section class="detail-section"><h3>Ver.319 タスク詳細</h3><p>詳細本文</p></section>`;
    document.getElementById('taskId').value = 'v319-task';
    document.getElementById('taskDialog').showModal();
  });

  const dialog = page.locator('#taskDialog');
  const detailTab = page.locator('#taskDialogDetailTabV319');
  const editTab = page.locator('#taskDialogEditTabV319');
  await expect(dialog).toBeVisible();
  await expect(detailTab).toBeVisible();
  await expect(editTab).toHaveClass(/active/);
  await expect(page.locator('#taskForm')).toBeVisible();

  await detailTab.click();
  await expect(detailTab).toHaveClass(/active/);
  await expect(page.locator('#taskDialogDetailPanelV319 #detailBody')).toContainText('Ver.319 タスク詳細');
  await expect(page.locator('#taskForm')).toBeHidden();

  await page.locator('#taskDialogDetailPanelV319 [data-action="edit"]').click();
  await expect(dialog).toBeVisible();
  await expect(editTab).toHaveClass(/active/);
  await expect(page.locator('#taskForm')).toBeVisible();

  await page.evaluate(() => document.getElementById('taskDialog').close());
  await expect(page.locator('.detail-panel > #detailBody')).toContainText('Ver.319 タスク詳細');
});

test('Ver.319 Auto Assist controls inherit the dashboard font family', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const dashboard = document.getElementById('dashboardView');
    dashboard.hidden = false;
    dashboard.innerHTML = '<section class="dashboard-panel"><div class="workflow-assist-list-v148"><button type="button"><strong>確認対象</strong><span>期限超過 1日</span></button></div></section>';
  });

  const families = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    button: getComputedStyle(document.querySelector('.workflow-assist-list-v148 button')).fontFamily,
    strong: getComputedStyle(document.querySelector('.workflow-assist-list-v148 button strong')).fontFamily
  }));
  expect(families.button).toBe(families.body);
  expect(families.strong).toBe(families.body);
});
