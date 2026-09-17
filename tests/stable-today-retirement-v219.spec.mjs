import { test, expect } from '@playwright/test';

const ROOM = 'audit-stable-today-retirement-v219';
const ROOM_NAME = '情報システム共有';

const OPEN_TASKS_BEFORE = 'const openTasks = state.tasks.filter(t => !isCompletedStatus(t.status));';
const OPEN_TASKS_AFTER = 'const openTasks = state.tasks.filter(t => !isCompletedStatus(t.status) && normalizeText(t.status) !== normalizeText("保留") && (!scopeHasMine() || isCurrentUserOrGroupAssignee(t.assignee)));';
const SCHEDULE_BEFORE = '.filter(s => !scopeHasMine() || s.assignee === getCurrentUser())';
const SCHEDULE_AFTER = '.filter(s => !scopeHasMine() || isCurrentUserOrGroupAssignee(s.assignee))';
const SPARE_BEFORE = 'const spare = openTasks.filter(t => !t.dueDate && !isUnsortedTask(t)).sort(compareSmartTasks).slice(0, 10);';
const SPARE_AFTER = 'const spare = openTasks.filter(t => !t.dueDate && !isUnsortedTask(t) && normalizeText(t.status) !== normalizeText("確認待ち")).sort(compareSmartTasks).slice(0, 10);';

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one replacement target, got ${count}`);
  return source.replace(before, after);
}

async function boot(page) {
  await page.route(/\/app\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    let source = await response.text();
    source = replaceOnce(source, OPEN_TASKS_BEFORE, OPEN_TASKS_AFTER, 'openTasks');
    source = replaceOnce(source, SCHEDULE_BEFORE, SCHEDULE_AFTER, 'schedule mine');
    source = replaceOnce(source, SPARE_BEFORE, SPARE_AFTER, 'spare');
    await route.fulfill({ response, body: source, headers: { ...response.headers(), 'content-type': 'text/javascript; charset=utf-8' } });
  });

  // Candidate product state: Today semantics are rendered canonically by app.js,
  // so the legacy stable post-filter is deliberately disabled for this audit.
  await page.route(/\/stable-fixes-v108\.js(?:\?.*)?$/, async route => {
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* Ver.219 audit: stable Today post-filter disabled */' });
  });

  await page.addInitScript(({ room, roomName }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-room-name:${room}`, roomName);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify(['福冨', '森井']));

    const now = new Date();
    const pad = value => String(value).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const task = (id, title, assignee, status = '未着手', dueDate = today) => ({
      id, title, description: '', requester: '', assignee, status,
      priority: '中', category: 'その他', tags: [], dueDate, dueTime: '', pinned: false,
      checklist: [], comments: [], history: [], recurrence: 'none', recurrenceRule: {},
      createdAt: Date.now() - 1000, createdBy: '福冨', updatedAt: Date.now(), updatedBy: '福冨',
      completedAt: 0, completedMemo: '', revision: 1
    });
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
      task('retire-mine-v219', '自分担当', '福冨'),
      task('retire-room-group-v219', '共有ルーム担当', roomName),
      task('retire-legacy-group-v219', '旧固定名担当', 'システム課'),
      task('retire-other-v219', '他担当', '森井'),
      task('retire-hold-v219', '保留担当', '福冨', '保留'),
      task('retire-waiting-v219', '空き時間確認待ち', '福冨', '確認待ち', '')
    ]));

    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0, 0, 0);
    const schedule = (id, title, assignee) => ({
      id, title, memo: '', location: '', assignee, category: 'その他',
      startAt: start.toISOString(), endAt: end.toISOString(), relatedTaskId: '',
      createdAt: Date.now() - 1000, updatedAt: Date.now(), revision: 1
    });
    localStorage.setItem(`system-task-schedules:${room}`, JSON.stringify([
      schedule('retire-schedule-mine-v219', '自分の予定', '福冨'),
      schedule('retire-schedule-room-group-v219', '共有ルームの予定', roomName),
      schedule('retire-schedule-other-v219', '他担当の予定', '森井')
    ]));

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM, roomName: ROOM_NAME });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await expect(page.locator('#todayView')).toBeVisible();
}

test('candidate canonical Today renderer preserves task semantics with stable disabled', async ({ page }) => {
  await boot(page);

  // Non-mine view: ordinary tasks from all assignees remain, but Today-specific
  // hold/waiting exclusions are already resolved before DOM creation.
  await expect(page.locator('[data-task-id="retire-mine-v219"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-room-group-v219"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-legacy-group-v219"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-other-v219"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-hold-v219"]')).toHaveCount(0);
  await expect(page.locator('[data-task-id="retire-waiting-v219"]')).toHaveCount(0);

  const mineFilter = page.locator('.nav-filter[data-filter="mine"]').first();
  await expect(mineFilter).toBeVisible();
  await mineFilter.click();

  // Canonical semantics: current user + current room-name group only.
  await expect(page.locator('[data-task-id="retire-mine-v219"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-room-group-v219"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-legacy-group-v219"]')).toHaveCount(0);
  await expect(page.locator('[data-task-id="retire-other-v219"]')).toHaveCount(0);
  await expect(page.locator('[data-task-id="retire-hold-v219"]')).toHaveCount(0);
  await expect(page.locator('[data-task-id="retire-waiting-v219"]')).toHaveCount(0);

  expect(await page.locator('#todayView [data-v108-hidden]').count()).toBe(0);

  await mineFilter.click();
  await expect(page.locator('[data-task-id="retire-other-v219"]')).toBeVisible();
  await expect(page.locator('[data-task-id="retire-legacy-group-v219"]')).toBeVisible();
});

test('candidate canonical Today renderer keeps room-group schedules in mine scope with stable disabled', async ({ page }) => {
  await boot(page);

  const mineFilter = page.locator('.nav-filter[data-filter="mine"]').first();
  await mineFilter.click();

  await expect(page.locator('[data-schedule-id="retire-schedule-mine-v219"]')).toBeVisible();
  await expect(page.locator('[data-schedule-id="retire-schedule-room-group-v219"]')).toBeVisible();
  await expect(page.locator('[data-schedule-id="retire-schedule-other-v219"]')).toHaveCount(0);
  expect(await page.locator('#todayView [data-v108-hidden]').count()).toBe(0);

  await mineFilter.click();
  await expect(page.locator('[data-schedule-id="retire-schedule-other-v219"]')).toBeVisible();
});
