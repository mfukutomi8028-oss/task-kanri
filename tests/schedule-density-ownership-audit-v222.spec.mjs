import { test, expect } from '@playwright/test';

const ROOM = 'test-schedule-density-ownership-audit-v222';

async function installLocalState(page) {
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-room-name:${room}`, '情報システム共有');
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const pad = value => String(value).padStart(2, '0');
    const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const at = (hour, minute = 0) => new Date(
      today.getFullYear(), today.getMonth(), today.getDate(), hour, minute, 0, 0
    ).toISOString();
    const schedule = (id, title, startAt, endAt) => ({
      id,
      title,
      startAt,
      endAt,
      assignee: '福冨',
      location: id === 'audit-beta' ? '会議室B' : '会議室A',
      category: 'その他',
      memo: id === 'audit-beta' ? '検索対象メモ' : '通常予定',
      relatedTaskId: '',
      revision: 1,
      createdAt: Date.now() - 1000,
      createdBy: '福冨',
      updatedAt: Date.now(),
      updatedBy: '福冨'
    });

    localStorage.setItem(`system-task-schedule-anchor:${room}`, todayIso);
    localStorage.setItem(`system-task-schedule-range:${room}`, 'today');
    localStorage.setItem(`system-task-schedule-display-mode:${room}`, 'list');
    localStorage.setItem(`system-task-schedules:${room}`, JSON.stringify([
      schedule('audit-alpha', 'Alpha定例', at(9), at(10)),
      schedule('audit-beta', 'Beta打合せ', at(11), at(12))
    ]));

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });
}

async function blockRemoteFirebase(page) {
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, { disableCoreDensity = false } = {}) {
  await installLocalState(page);

  if (disableCoreDensity) {
    await page.route('**/core-view-density-v188.js*', route => route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: `(() => {
        window.__WB_CORE_VIEW_DENSITY_V188__ = Object.freeze({
          version: 'audit-disabled',
          patchAll() {},
          observers: Object.freeze({ today: null, schedule: null })
        });
      })();`
    }));
  }

  await blockRemoteFirebase(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await page.locator('.nav-item[data-layout="schedule"]').click();
  await expect(page.locator('#scheduleView')).toBeVisible();
}

async function expectOnlyBetaSchedule(page) {
  await expect(page.locator('#scheduleView [data-schedule-id="audit-alpha"]')).toHaveCount(0);
  await expect(page.locator('#scheduleView [data-schedule-id="audit-beta"]')).toBeVisible();
}

test('audit baseline: app.js owns Schedule data filtering and control handlers before density post-processing', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await boot(page, { disableCoreDensity: true });

  await expect(page.locator('#scheduleView .schedule-head')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-actions')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-title-block .schedule-range-label')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-toolbar-v176')).toHaveCount(0);
  await expect(page.locator('#scheduleView .schedule-search-v176')).toHaveCount(0);

  await page.locator('#searchInput').evaluate(input => {
    input.value = 'Beta';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expectOnlyBetaSchedule(page);

  await page.locator('#searchInput').evaluate(input => {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#scheduleView [data-schedule-id="audit-alpha"]')).toBeVisible();
  await expect(page.locator('#scheduleView [data-schedule-id="audit-beta"]')).toBeVisible();

  await page.locator('#scheduleView [data-schedule-range="week"]').click();
  await expect(page.locator('#scheduleView [data-schedule-range="week"]')).toHaveClass(/active/);

  await page.locator('#scheduleView [data-new-schedule]').click();
  await expect(page.locator('#scheduleDialog')).toBeVisible();
});

test('audit baseline: active density layer owns integrated Schedule toolbar, search proxy, focus restore and rerender adoption', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await boot(page);

  const observers = await page.evaluate(() => {
    const api = window.__WB_CORE_VIEW_DENSITY_V188__;
    return {
      today: api?.observers?.today ?? null,
      schedule: Boolean(api?.observers?.schedule)
    };
  });
  expect(observers).toEqual({ today: null, schedule: true });

  await expect(page.locator('#scheduleView .schedule-toolbar-v176')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-toolbar-controls-v176')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-toolbar-utility-v176')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-date-v176')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-search-v176')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-actions')).toHaveCount(0);

  const search = page.locator('#scheduleView .schedule-search-v176 input');
  await search.fill('Beta');
  await expectOnlyBetaSchedule(page);
  await expect(page.locator('#searchInput')).toHaveValue('Beta');
  await expect(page.locator('#scheduleView .schedule-search-v176 input')).toHaveValue('Beta');

  const focusState = await page.evaluate(() => {
    const input = document.querySelector('#scheduleView .schedule-search-v176 input');
    return {
      focused: document.activeElement === input,
      start: input?.selectionStart ?? -1,
      end: input?.selectionEnd ?? -1
    };
  });
  expect(focusState).toEqual({ focused: true, start: 4, end: 4 });

  await page.locator('#scheduleView [data-schedule-range="week"]').click();
  await expect(page.locator('#scheduleView .schedule-toolbar-v176')).toBeVisible();
  await expect(page.locator('#scheduleView .schedule-search-v176 input')).toHaveValue('Beta');
  await expect(page.locator('#scheduleView [data-schedule-range="week"]')).toHaveClass(/active/);
  await expectOnlyBetaSchedule(page);

  await page.locator('#scheduleView [data-new-schedule]').click();
  await expect(page.locator('#scheduleDialog')).toBeVisible();
});
