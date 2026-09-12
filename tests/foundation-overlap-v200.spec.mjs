import { test, expect } from '@playwright/test';

const ROOM = 'test-foundation-overlap-v200';

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

test('stable alone constrains native dates while startup segmented controls remain single and valid', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await boot(page);

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await page.evaluate(() => document.getElementById('newTask')?.click());
  await expect(page.locator('#taskDialog')).toBeVisible();

  const source = page.locator('#taskDueDate');
  const wrapper = source.locator('xpath=..');
  await expect(wrapper).toHaveClass(/date-segment-control-v127/);
  await expect(source).toHaveAttribute('data-date-segment-v127', 'true');
  await expect(source).toHaveAttribute('min', '1900-01-01');
  await expect(source).toHaveAttribute('max', '9999-12-31');
  await expect.poll(() => source.evaluate(node => Boolean(node.__stableDateV108))).toBe(true);
  await expect.poll(() => source.evaluate(node => Boolean(node.__workBoardDateBoundV101))).toBe(false);
  await expect(page.locator('#taskDialog .date-segment-control-v127')).toHaveCount(1);

  await page.evaluate(() => {
    const host = document.createElement('section');
    host.id = 'foundation-overlap-dynamic-v200';
    host.innerHTML = `
      <input id="dynamicDateV200" type="date">
      <input id="dynamicDateTimeV200" type="datetime-local">
    `;
    document.body.appendChild(host);
  });

  const dynamicDate = page.locator('#dynamicDateV200');
  const dynamicDateTime = page.locator('#dynamicDateTimeV200');
  await expect.poll(() => dynamicDate.evaluate(node => Boolean(node.__stableDateV108))).toBe(true);
  await expect.poll(() => dynamicDateTime.evaluate(node => Boolean(node.__stableDateV108))).toBe(true);
  await expect.poll(() => dynamicDate.evaluate(node => Boolean(node.__workBoardDateBoundV101))).toBe(false);
  await expect.poll(() => dynamicDateTime.evaluate(node => Boolean(node.__workBoardDateBoundV101))).toBe(false);
  await expect(dynamicDate).toHaveAttribute('min', '1900-01-01');
  await expect(dynamicDate).toHaveAttribute('max', '9999-12-31');
  await expect(dynamicDateTime).toHaveAttribute('min', '1900-01-01T00:00');
  await expect(dynamicDateTime).toHaveAttribute('max', '9999-12-31T23:59');

  await page.evaluate(() => {
    for (let index = 0; index < 3; index += 1) {
      const marker = document.createElement('span');
      marker.textContent = String(index);
      document.getElementById('foundation-overlap-dynamic-v200')?.appendChild(marker);
    }
  });
  await page.waitForTimeout(150);

  await expect(dynamicDate).not.toHaveAttribute('data-date-segment-v127', 'true');
  await expect(dynamicDate.locator('xpath=..')).not.toHaveClass(/date-segment-control-v127/);
  await expect(page.locator('#taskDialog .date-segment-control-v127')).toHaveCount(1);
});

test('Today visibility marker is owned only by stable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await boot(page);

  await page.evaluate(({ room }) => {
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
      { id: 'hold-v200', status: '保留', assignee: '福冨' },
      { id: 'waiting-spare-v200', status: '確認待ち', assignee: '福冨' },
      { id: 'other-v200', status: '未着手', assignee: '森井' },
      { id: 'group-v200', status: '対応中', assignee: 'システム課' }
    ]));

    const user = document.getElementById('currentUserSelect');
    if (user && [...user.options].some(option => option.value === '福冨')) user.value = '福冨';

    document.querySelectorAll('.nav-filter[data-filter="mine"]').forEach(node => node.classList.remove('active'));
    let mine = document.querySelector('.nav-filter[data-filter="mine"]');
    if (!mine) {
      mine = document.createElement('button');
      mine.className = 'nav-filter';
      mine.dataset.filter = 'mine';
      document.body.appendChild(mine);
    }
    mine.classList.add('active');

    const today = document.getElementById('todayView');
    today.hidden = false;
    const fixture = document.createElement('section');
    fixture.id = 'foundation-overlap-today-v200';
    fixture.innerHTML = `
      <div class="today-panel"><h4>今日のタスク</h4><div>
        <article class="task-card" data-task-id="hold-v200"></article>
        <article class="task-card" data-task-id="other-v200"></article>
        <article class="task-card" data-task-id="group-v200"></article>
      </div></div>
      <div class="today-panel"><h4>空き時間</h4><div>
        <article class="task-card" data-task-id="waiting-spare-v200"></article>
      </div></div>
    `;
    today.appendChild(fixture);
  }, { room: ROOM });

  const hold = page.locator('[data-task-id="hold-v200"]');
  const waiting = page.locator('[data-task-id="waiting-spare-v200"]');
  const other = page.locator('[data-task-id="other-v200"]');
  const group = page.locator('[data-task-id="group-v200"]');

  await expect(hold).toHaveAttribute('data-v108-hidden', '');
  await expect(hold).not.toHaveAttribute('data-workboard-auto-hidden', 'true');
  await expect(waiting).toHaveAttribute('data-v108-hidden', '');
  await expect(waiting).not.toHaveAttribute('data-workboard-auto-hidden', 'true');

  await expect(other).toHaveAttribute('data-v108-hidden', '');
  await expect(other).not.toHaveAttribute('data-workboard-auto-hidden', 'true');

  await expect(group).not.toHaveAttribute('data-v108-hidden', '');
  await expect(group).not.toHaveAttribute('data-workboard-auto-hidden', 'true');
});
