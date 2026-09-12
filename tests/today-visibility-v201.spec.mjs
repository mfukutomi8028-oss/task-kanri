import { test, expect } from '@playwright/test';

const ROOM = 'test-today-visibility-v201';

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
  // stable/mobile双方の起動時遅延補正が完了してから競合遷移を検証する。
  await page.waitForTimeout(1_400);
}

async function triggerChildMutation(page) {
  await page.evaluate(() => {
    const marker = document.createElement('i');
    marker.hidden = true;
    marker.dataset.todayVisibilityAudit = String(Date.now());
    document.getElementById('foundation-today-visibility-v201')?.appendChild(marker);
  });
  await page.waitForTimeout(120);
}

test('Today final visibility remains correct when status and mine filters overlap and transition', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await boot(page);

  await page.evaluate(({ room }) => {
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
      { id: 'hold-user-v201', status: '保留', assignee: '福冨' },
      { id: 'dual-other-v201', status: '保留', assignee: '森井' },
      { id: 'other-v201', status: '未着手', assignee: '森井' },
      { id: 'group-v201', status: '対応中', assignee: 'システム課' },
      { id: 'waiting-v201', status: '確認待ち', assignee: '福冨' }
    ]));

    const user = document.getElementById('currentUserSelect');
    if (user) {
      if (![...user.options].some(option => option.value === '福冨')) {
        user.add(new Option('福冨', '福冨'));
      }
      user.value = '福冨';
    }

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
    fixture.id = 'foundation-today-visibility-v201';
    fixture.innerHTML = `
      <div class="today-panel"><h4>今日のタスク</h4><div>
        <article class="task-card" data-task-id="hold-user-v201"></article>
        <article class="task-card" data-task-id="dual-other-v201"></article>
        <article class="task-card" data-task-id="other-v201"></article>
        <article class="task-card" data-task-id="group-v201"></article>
      </div></div>
      <div class="today-panel"><h4>空き時間</h4><div>
        <article class="task-card" data-task-id="waiting-v201"></article>
      </div></div>
    `;
    today.appendChild(fixture);
  }, { room: ROOM });

  await page.waitForTimeout(120);

  const holdUser = page.locator('[data-task-id="hold-user-v201"]');
  const dualOther = page.locator('[data-task-id="dual-other-v201"]');
  const other = page.locator('[data-task-id="other-v201"]');
  const group = page.locator('[data-task-id="group-v201"]');
  const waiting = page.locator('[data-task-id="waiting-v201"]');

  // 初期状態: 状態除外とmine/group判定を合成した最終表示を固定する。
  await expect(holdUser).toBeHidden();
  await expect(dualOther).toBeHidden();
  await expect(other).toBeHidden();
  await expect(group).toBeVisible();
  await expect(waiting).toBeHidden();

  await expect(dualOther).toHaveAttribute('data-v108-hidden', '');
  await expect(dualOther).toHaveAttribute('data-workboard-auto-hidden', 'true');
  await expect(other).toHaveAttribute('data-v108-hidden', '');
  await expect(other).not.toHaveAttribute('data-workboard-auto-hidden', 'true');

  // 2理由(保留 + 他担当) -> 1理由(他担当)へ変わってもmine非表示を失ってはいけない。
  await page.evaluate(({ room }) => {
    const key = `system-task-tasks:${room}`;
    const tasks = JSON.parse(localStorage.getItem(key) || '[]');
    const task = tasks.find(item => item.id === 'dual-other-v201');
    task.status = '未着手';
    localStorage.setItem(key, JSON.stringify(tasks));
  }, { room: ROOM });
  await triggerChildMutation(page);

  await expect(dualOther).toBeHidden();
  await expect(dualOther).toHaveAttribute('data-v108-hidden', '');
  await expect(dualOther).not.toHaveAttribute('data-workboard-auto-hidden', 'true');

  // 状態除外だけが解除された自分担当は表示へ戻る。
  await page.evaluate(({ room }) => {
    const key = `system-task-tasks:${room}`;
    const tasks = JSON.parse(localStorage.getItem(key) || '[]');
    const task = tasks.find(item => item.id === 'hold-user-v201');
    task.status = '未着手';
    localStorage.setItem(key, JSON.stringify(tasks));
  }, { room: ROOM });
  await triggerChildMutation(page);

  await expect(holdUser).toBeVisible();
  await expect(holdUser).not.toHaveAttribute('data-v108-hidden', '');
  await expect(holdUser).not.toHaveAttribute('data-workboard-auto-hidden', 'true');

  // mine解除後も状態除外が残るカードは非表示を維持する。
  await page.evaluate(() => {
    document.querySelector('.nav-filter[data-filter="mine"]')?.classList.remove('active');
  });
  await triggerChildMutation(page);

  await expect(waiting).toBeHidden();
  await expect(other).toBeVisible();
  await expect(group).toBeVisible();
});
