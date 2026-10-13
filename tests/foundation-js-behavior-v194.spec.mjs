import { test, expect } from '@playwright/test';

const ROOM = 'test-foundation-js-safety-v194';
const CORE_STATUSES = ['未着手', '対応中', '確認待ち', '保留', '完了'];

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

test('foundation guards protect all five core status deletions without locking non-completed names', async ({ page }) => {
  await boot(page);

  await page.evaluate(() => document.getElementById('manageStatuses')?.click());
  await expect(page.locator('#statusManageDialog')).toBeVisible();

  for (const status of CORE_STATUSES) {
    const deleteButton = page.locator(`#statusList [data-delete-status="${status}"]`);
    await expect(deleteButton).toBeDisabled();
    await expect(deleteButton).toHaveAttribute('aria-disabled', 'true');
    await expect(deleteButton).toHaveAttribute('title', `${status}は基本状態のため削除できません`);

    const nameInput = page.locator(`#statusList [data-status-old="${status}"]`);
    await expect(nameInput).toBeVisible();
    if (status === '完了') await expect(nameInput).toHaveAttribute('readonly', '');
    else await expect(nameInput).not.toHaveAttribute('readonly', '');
  }

  await page.evaluate(() => {
    const host = document.createElement('section');
    host.id = 'foundation-stable-fixture-v197';
    host.innerHTML = '<button id="customStatusV197" type="button" data-delete-status="院内確認">削除</button>';
    document.body.appendChild(host);
  });

  await expect(page.locator('#customStatusV197')).toBeEnabled();
});

test('date keyboard segments commit valid dates and reject impossible dates', async ({ page }) => {
  await boot(page);
  await openTasks(page);

  // This test validates the dialog/date behavior, not toolbar pointer hit-testing.
  // Trigger the same app click handler directly so a transient sidebar overlay cannot intercept it.
  await page.evaluate(() => document.getElementById('newTask')?.click());
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


test('Ver.441 date segments keep invalid feedback after focus exits in 20 repeated cycles', async ({ page }) => {
  // Issue #355: investigate a rare CI case where the native date was empty and
  // data-dirty stayed true, but is-invalid was absent after moving focus.
  // Do not relax the invalid-date contract or change production behavior.
  test.setTimeout(180_000);
  await boot(page);
  await openTasks(page);
  await page.evaluate(() => document.getElementById('newTask')?.click());
  await expect(page.locator('#taskDialog')).toBeVisible();

  const source = page.locator('#taskDueDate');
  const wrapper = source.locator('xpath=..');
  await expect(wrapper).toHaveClass(/date-segment-control-v127/);
  const year = wrapper.locator('.date-segment-year-v127');
  const twoDigit = wrapper.locator('.date-segment-two-v127');
  const month = twoDigit.nth(0);
  const day = twoDigit.nth(1);
  const taskTitle = page.locator('#taskTitle');

  await page.evaluate(() => {
    const group = document.querySelector('#taskDueDate')?.parentElement;
    const title = document.querySelector('#taskTitle');
    if (!group || !title) throw new Error('Diagnostic target missing');
    const events = [];
    window.__WB_V441_DATE_FOCUS_EVENTS__ = events;
    const name = node => node?.id || node?.getAttribute?.('aria-label')
      || String(node?.className || node?.tagName || '').slice(0, 70);
    const record = (type, event) => {
      events.push({
        type,
        target: name(event?.target),
        related: name(event?.relatedTarget),
        active: name(document.activeElement),
        within: group.contains(document.activeElement),
        dirty: group.dataset.dirty,
        invalid: group.classList.contains('is-invalid')
      });
      if (events.length > 100) events.shift();
    };
    for (const eventName of ['focusin', 'focusout']) {
      group.addEventListener(eventName, event => record(eventName, event));
    }
    title.addEventListener('focusin', event => record('title-focusin', event));
    new MutationObserver(() => record('state-change')).observe(group, {
      attributes: true,
      attributeFilter: ['class', 'data-dirty']
    });
  });

  for (let iteration = 1; iteration <= 20; iteration++) {
    try {
      await year.fill('2026');
      await month.fill('09');
      await day.fill('30');
      await expect(source).toHaveValue('2026-09-30');
      await expect(wrapper).not.toHaveClass(/is-invalid/);

      await day.fill('31');
      await expect(day).toBeFocused();
      await taskTitle.focus();
      await expect(taskTitle).toBeFocused();
      await expect(source).toHaveValue('');
      await expect(wrapper).toHaveClass(/is-invalid/);

      await day.fill('30');
      await taskTitle.focus();
      await expect(taskTitle).toBeFocused();
      await expect(source).toHaveValue('2026-09-30');
      await expect(wrapper).not.toHaveClass(/is-invalid/);
    } catch (error) {
      let diagnostic;
      try {
        diagnostic = await page.evaluate(() => {
          const input = document.querySelector('#taskDueDate');
          const group = input?.parentElement;
          const fields = group?.querySelectorAll('.date-segment-input-v127') || [];
          const active = document.activeElement;
          return {
            dialogOpen: document.querySelector('#taskDialog')?.open,
            activeElement: active?.id || active?.getAttribute?.('aria-label') || active?.tagName,
            activeWithinGroup: !!group?.contains(active),
            nativeValue: input?.value,
            groupClass: group?.className,
            dirty: group?.dataset.dirty,
            fieldValues: [...fields].map(field => field.value),
            events: (window.__WB_V441_DATE_FOCUS_EVENTS__ || []).slice(-60)
          };
        });
      } catch (diagnosticError) {
        diagnostic = { collectionError: String(diagnosticError) };
      }
      const report = { iteration, diagnostic };
      console.error('VER441_DATE_FOCUS_DIAGNOSTICS ' + JSON.stringify(report));
      await test.info().attach('ver441-date-focus-diagnostics.json', {
        body: JSON.stringify(report, null, 2),
        contentType: 'application/json'
      });
      throw error;
    }
  }
});

test('schedule today controls disable previous/next navigation while Today is selected', async ({ page }) => {
  await boot(page);

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="schedule"]')?.click());
  await expect(page.locator('#scheduleView')).toBeVisible();
  await expect(page.locator('#scheduleView [data-schedule-range="today"]')).toHaveClass(/active/);

  const localToday = await page.evaluate(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const label = page.locator('#scheduleView .schedule-range-label');
  const prev = page.locator('#scheduleView [data-schedule-move="prev"]');
  const next = page.locator('#scheduleView [data-schedule-move="next"]');
  await expect(label).toHaveText(localToday);
  await expect(prev).toBeDisabled();
  await expect(next).toBeDisabled();
  await expect(prev).toHaveAttribute('aria-disabled', 'true');
  await expect(next).toHaveAttribute('aria-disabled', 'true');
  await expect(prev).toHaveAttribute('title', '「今日」表示中は移動できません');
  await expect(next).toHaveAttribute('title', '「今日」表示中は移動できません');
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
