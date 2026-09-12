import { test, expect } from '@playwright/test';

const ROOM = 'test-foundation-js-safety-v194';

async function installLocalOnlyBoundary(page) {
  await page.addInitScript(({ room }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
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

async function boot(page) {
  await installLocalOnlyBoundary(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
}

async function openTasks(page) {
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await expect(page.locator('#newTask')).toBeVisible();
  await expect(page.locator('#sortSelect')).toBeVisible();
}

test('version-display-lock restores the visible manifest version after a legacy display overwrite', async ({ page }) => {
  await boot(page);

  const release = await page.evaluate(() => String(window.WORK_BOARD_RELEASE?.version || ''));
  expect(release).toMatch(/^\d+$/);

  await page.evaluate(() => {
    const node = document.querySelector('.workboard-version-display, .app-version');
    if (node) {
      node.textContent = 'Ver.122';
      node.classList.add('app-version');
      node.dataset.releaseVersion = '122';
    }
    window.WORK_BOARD_VERSION = '122';
    window.dispatchEvent(new Event('focus'));
  });

  const versionNode = page.locator('.workboard-version-display');
  await expect(versionNode).toHaveText(`Ver.${release}`);
  await expect(versionNode).not.toHaveClass(/app-version/);
  await expect(versionNode).toHaveAttribute('data-release-version', release);
  await expect.poll(() => page.evaluate(() => String(window.WORK_BOARD_VERSION || ''))).toBe(release);
});

test('foundation guards protect core statuses and schedule lock normalizes the seven-day label', async ({ page }) => {
  await boot(page);

  await page.evaluate(() => {
    const host = document.createElement('section');
    host.id = 'foundation-stable-fixture-v194';
    host.innerHTML = `
      <button id="protectedStatusV194" type="button" data-delete-status="未着手">削除</button>
      <button id="customStatusV194" type="button" data-delete-status="院内確認">削除</button>
    `;
    document.body.appendChild(host);

    const weekButton = document.createElement('button');
    weekButton.id = 'weekRangeV194';
    weekButton.type = 'button';
    weekButton.dataset.scheduleRange = 'week';
    weekButton.textContent = '週';
    document.getElementById('scheduleView')?.appendChild(weekButton);
  });

  const protectedButton = page.locator('#protectedStatusV194');
  await expect(protectedButton).toBeDisabled();
  await expect(protectedButton).toHaveAttribute('aria-disabled', 'true');
  await expect(protectedButton).toHaveAttribute('title', /基本状態/);
  await expect(page.locator('#customStatusV194')).toBeEnabled();
  await expect(page.locator('#weekRangeV194')).toHaveText('7日間');
  await expect(page.locator('#weekRangeV194')).toHaveAttribute('title', '今日から7日間を表示します');
});

test('date keyboard segments commit valid dates and reject impossible dates', async ({ page }) => {
  await boot(page);
  await openTasks(page);

  await page.locator('#newTask').click();
  await expect(page.locator('#taskDialog')).toBeVisible();

  const source = page.locator('#taskDueDate');
  const wrapper = source.locator('xpath=..');
  await expect(wrapper).toHaveClass(/date-segment-control-v127/);
  await expect(source).toHaveAttribute('min', '1900-01-01');
  await expect(source).toHaveAttribute('max', '9999-12-31');

  const year = wrapper.locator('.date-segment-year-v127');
  const twoDigit = wrapper.locator('.date-segment-two-v127');
  const month = twoDigit.nth(0);
  const day = twoDigit.nth(1);
  const taskTitle = page.locator('#taskTitle');

  await year.fill('2026');
  await month.fill('09');
  await day.fill('30');
  await expect(source).toHaveValue('2026-09-30');
  await expect(wrapper).not.toHaveClass(/is-invalid/);

  await day.fill('31');
  await taskTitle.focus();
  await expect(source).toHaveValue('');
  await expect(wrapper).toHaveClass(/is-invalid/);

  await day.fill('30');
  await taskTitle.focus();
  await expect(source).toHaveValue('2026-09-30');
  await expect(wrapper).not.toHaveClass(/is-invalid/);
});

test('schedule today lock blocks previous/next navigation while Today is selected', async ({ page }) => {
  await boot(page);

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="schedule"]')?.click());
  await expect(page.locator('#scheduleView')).toBeVisible();
  await expect(page.locator('#scheduleView [data-schedule-range="today"]')).toHaveClass(/active/);

  const localToday = await page.evaluate(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const label = page.locator('#scheduleView .schedule-range-label');
  await expect(label).toHaveText(localToday);

  await page.locator('#scheduleView [data-schedule-move="next"]').click();
  await expect(label).toHaveText(localToday);
  await expect(page.locator('#scheduleView [data-schedule-range="today"]')).toHaveClass(/active/);

  await page.locator('#scheduleView [data-schedule-move="prev"]').click();
  await expect(label).toHaveText(localToday);
  await expect(page.locator('#scheduleView [data-schedule-range="today"]')).toHaveClass(/active/);
});

test('list sort enhances headers, persists direction, sorts rows, and clears on base-sort change', async ({ page }) => {
  await boot(page);
  await openTasks(page);

  await page.evaluate(() => {
    const list = document.querySelector('#listView');
    list.hidden = false;
    list.innerHTML = `
      <table class="task-table">
        <thead><tr>
          <th></th><th>★</th><th>件名</th><th>担当</th><th>状態</th><th>優先度</th><th>分類</th><th>期限</th><th>更新</th>
        </tr></thead>
        <tbody>
          <tr data-task-id="task-b"><td></td><td></td><td><strong>Bravo</strong></td><td>福冨</td><td>未着手</td><td>中</td><td>PC</td><td>09/30</td><td>09/12</td></tr>
          <tr data-task-id="task-a"><td></td><td></td><td><strong>Alpha</strong></td><td>森井</td><td>対応中</td><td>高</td><td>Web/HP</td><td>09/29</td><td>09/11</td></tr>
        </tbody>
      </table>
    `;
  });

  const titleHeader = page.locator('#listView th[data-list-sort-key="title"]');
  await expect(titleHeader).toBeVisible();
  await expect(titleHeader).toHaveAttribute('role', 'button');

  await titleHeader.click();
  await expect.poll(() => page.evaluate(room => localStorage.getItem(`work-board-list-column-sort:${room}`), ROOM))
    .toBe(JSON.stringify({ key: 'title', direction: 'asc' }));
  await expect.poll(() => page.locator('#listView tbody tr').evaluateAll(rows => rows.map(row => row.dataset.taskId)))
    .toEqual(['task-a', 'task-b']);
  await expect(titleHeader).toHaveAttribute('aria-sort', 'ascending');

  await titleHeader.click();
  await expect.poll(() => page.evaluate(room => localStorage.getItem(`work-board-list-column-sort:${room}`), ROOM))
    .toBe(JSON.stringify({ key: 'title', direction: 'desc' }));
  await expect.poll(() => page.locator('#listView tbody tr').evaluateAll(rows => rows.map(row => row.dataset.taskId)))
    .toEqual(['task-b', 'task-a']);
  await expect(titleHeader).toHaveAttribute('aria-sort', 'descending');

  await page.locator('#sortSelect').selectOption('due');
  await expect.poll(() => page.evaluate(room => localStorage.getItem(`work-board-list-column-sort:${room}`), ROOM)).toBe(null);
});
