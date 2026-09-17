import { test, expect } from '@playwright/test';

const ROOM = 'test-stable-style-ownership-v213';

async function boot(page) {
  await page.addInitScript(({ room }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
      localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
        { id: 'hold-v213', status: '保留', assignee: '福冨' },
        { id: 'mine-v213', status: '未着手', assignee: '福冨' },
        { id: 'group-v213', status: '対応中', assignee: 'システム課' },
        { id: 'other-v213', status: '未着手', assignee: '森井' }
      ]));
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

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return version === '214' && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await expect(page.locator('#stableFixesV108Style')).toHaveCount(0);
}

test('Today final visibility works through the stable marker and static base CSS without stable style injection', async ({ page }) => {
  await boot(page);

  await page.evaluate(() => {
    document.querySelectorAll('.nav-filter[data-filter="mine"]').forEach(node => node.classList.remove('active'));
    const today = document.getElementById('todayView');
    today.hidden = false;
    const fixture = document.createElement('section');
    fixture.id = 'stable-style-today-v213';
    fixture.innerHTML = `
      <div class="today-panel"><h4>今日のタスク</h4><div>
        <article class="task-card" data-task-id="hold-v213">hold</article>
        <article class="task-card" data-task-id="mine-v213">mine</article>
        <article class="task-card" data-task-id="group-v213">group</article>
      </div></div>`;
    today.appendChild(fixture);
  });

  const hold = page.locator('#stable-style-today-v213 [data-task-id="hold-v213"]');
  const mine = page.locator('#stable-style-today-v213 [data-task-id="mine-v213"]');
  const group = page.locator('#stable-style-today-v213 [data-task-id="group-v213"]');

  await expect(hold).toHaveAttribute('data-v108-hidden', '');
  await expect(hold).toBeHidden();
  expect(await hold.evaluate(node => getComputedStyle(node).display)).toBe('none');
  await expect(mine).toBeVisible();
  await expect(group).toBeVisible();
});

test('mobile owns status protection and board layout without stable board CSS', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await boot(page);

  await page.locator('.nav-item[data-layout="tasks"]').evaluate(button => button.click());
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await expect(page.locator('.work-mobile-status-tab').last()).toBeVisible();

  const result = await page.evaluate(() => {
    const row = document.querySelector('.work-mobile-status-tabs');
    const buttons = [...(row?.querySelectorAll('.work-mobile-status-tab') || [])];
    const board = document.querySelector('.board-view');
    const columns = [...(board?.querySelectorAll('.board-column') || [])];
    const button = buttons.at(-1);
    const firstColumn = columns[0];
    const firstList = firstColumn?.querySelector('.task-list');
    const firstHead = firstColumn?.querySelector('.column-head');
    if (!row || !board || !button || !columns.length || !firstColumn || !firstList || !firstHead || buttons.length !== columns.length) return null;

    const tall = document.createElement('div');
    tall.id = 'stable-style-tall-v213';
    tall.style.height = '900px';
    tall.style.width = '1px';
    firstList.appendChild(tall);

    const rowStyle = getComputedStyle(row);
    const buttonStyle = getComputedStyle(button);
    const listStyle = getComputedStyle(firstList);
    const headStyle = getComputedStyle(firstHead);
    const layoutBeforeTabSwitch = {
      headPosition: headStyle.position,
      listMaxHeight: listStyle.maxHeight,
      listOverflowY: listStyle.overflowY,
      listExpands: firstList.scrollHeight <= firstList.clientHeight + 1,
      columnContainsList: firstColumn.getBoundingClientRect().height >= firstList.getBoundingClientRect().height
    };

    const spacer = document.createElement('div');
    spacer.style.height = '1800px';
    document.body.appendChild(spacer);
    window.scrollTo(0, 260);

    let assignedScrollLeft = 0;
    Object.defineProperty(row, 'clientWidth', { configurable: true, value: 200 });
    Object.defineProperty(row, 'scrollLeft', {
      configurable: true,
      get() { return assignedScrollLeft; },
      set(value) { assignedScrollLeft = Number(value); }
    });
    Object.defineProperty(button, 'offsetLeft', { configurable: true, value: 420 });
    Object.defineProperty(button, 'offsetWidth', { configurable: true, value: 60 });

    const beforeY = window.scrollY;
    button.click();
    const selectedIndex = buttons.length - 1;

    return {
      rowDisplay: rowStyle.display,
      overflowX: rowStyle.overflowX,
      overflowY: rowStyle.overflowY,
      flexWrap: rowStyle.flexWrap,
      snap: rowStyle.scrollSnapType,
      touchAction: rowStyle.touchAction,
      userSelect: buttonStyle.userSelect,
      tabSnap: buttonStyle.scrollSnapAlign,
      ...layoutBeforeTabSwitch,
      rowScrollLeft: assignedScrollLeft,
      beforeY,
      afterY: window.scrollY,
      activePressed: button.getAttribute('aria-pressed'),
      activeButton: button.classList.contains('active'),
      activeColumn: columns[selectedIndex]?.classList.contains('work-mobile-active-column') || false
    };
  });

  expect(result).not.toBeNull();
  expect(result.rowDisplay).toBe('flex');
  expect(result.overflowX).toBe('auto');
  expect(result.overflowY).toBe('hidden');
  expect(result.flexWrap).toBe('nowrap');
  expect(result.snap).toBe('none');
  expect(result.touchAction).toBe('auto');
  expect(result.userSelect).toBe('none');
  expect(result.tabSnap).toBe('none');
  expect(result.headPosition).toBe('static');
  expect(result.listMaxHeight).toBe('none');
  expect(result.listOverflowY).toBe('visible');
  expect(result.listExpands).toBe(true);
  expect(result.columnContainsList).toBe(true);
  expect(result.rowScrollLeft).toBe(350);
  expect(result.beforeY).toBe(260);
  expect(result.afterY).toBe(260);
  expect(result.activePressed).toBe('true');
  expect(result.activeButton).toBe(true);
  expect(result.activeColumn).toBe(true);
});
