import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const ROOM = 'test-stable-native-hidden-v214';
const stableSource = fs.readFileSync(new URL('../stable-fixes-v108.js', import.meta.url), 'utf8');

function stableWithoutNativeHiddenWrites() {
  const target = '      card.hidden = shouldHide;\n';
  const matches = stableSource.split(target).length - 1;
  if (matches !== 2) {
    throw new Error(`expected exactly two stable native hidden writes, found ${matches}`);
  }
  const source = stableSource.replaceAll(target, '');
  if (!source.includes('card.toggleAttribute("data-v108-hidden", shouldHide);')) {
    throw new Error('stable data-v108-hidden marker ownership was lost');
  }
  return source;
}

async function installAuditBoundary(page) {
  await page.addInitScript(({ room }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
      localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
        { id: 'hold-self-v214', status: '保留', assignee: '福冨' },
        { id: 'hold-other-v214', status: '保留', assignee: '森井' },
        { id: 'other-v214', status: '未着手', assignee: '森井' },
        { id: 'group-v214', status: '対応中', assignee: 'システム課' },
        { id: 'waiting-v214', status: '確認待ち', assignee: '福冨' }
      ]));
      localStorage.setItem(`system-task-schedules:${room}`, JSON.stringify([
        { id: 'schedule-self-v214', assignee: '福冨' },
        { id: 'schedule-other-v214', assignee: '森井' },
        { id: 'schedule-group-v214', assignee: 'システム課' }
      ]));
    } catch {}

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });

  await page.route(/\/stable-fixes-v108\.js(?:\?.*)?$/i, route => route.fulfill({
    status: 200,
    contentType: 'application/javascript; charset=utf-8',
    body: stableWithoutNativeHiddenWrites()
  }));
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installAuditBoundary(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return version === '213' && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await expect(page.locator('#stableFixesV108Style')).toHaveCount(0);
}

async function triggerTodayMutation(page) {
  await page.evaluate(() => {
    const marker = document.createElement('i');
    marker.hidden = true;
    marker.dataset.nativeHiddenAudit = String(Date.now());
    document.getElementById('stable-native-hidden-fixture-v214')?.appendChild(marker);
  });
}

test('Today task visibility remains correct when stable native hidden writes are removed', async ({ page }) => {
  await boot(page);

  await page.evaluate(() => {
    const user = document.getElementById('currentUserSelect');
    if (user) {
      if (![...user.options].some(option => option.value === '福冨')) user.add(new Option('福冨', '福冨'));
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
    fixture.id = 'stable-native-hidden-fixture-v214';
    fixture.innerHTML = `
      <div class="today-panel"><h4>今日のタスク</h4><div>
        <article class="task-card" data-task-id="hold-self-v214">hold self</article>
        <article class="task-card" data-task-id="hold-other-v214">hold other</article>
        <article class="task-card" data-task-id="other-v214">other</article>
        <article class="task-card" data-task-id="group-v214">group</article>
      </div></div>
      <div class="today-panel"><h4>空き時間</h4><div>
        <article class="task-card" data-task-id="waiting-v214">waiting</article>
      </div></div>`;
    fixture.querySelectorAll('.task-card').forEach(card => { card.hidden = false; });
    today.appendChild(fixture);
  });

  const fixture = page.locator('#stable-native-hidden-fixture-v214');
  const holdSelf = fixture.locator('[data-task-id="hold-self-v214"]');
  const holdOther = fixture.locator('[data-task-id="hold-other-v214"]');
  const other = fixture.locator('[data-task-id="other-v214"]');
  const group = fixture.locator('[data-task-id="group-v214"]');
  const waiting = fixture.locator('[data-task-id="waiting-v214"]');

  await expect(holdSelf).toHaveAttribute('data-v108-hidden', '');
  await expect(holdOther).toHaveAttribute('data-v108-hidden', '');
  await expect(other).toHaveAttribute('data-v108-hidden', '');
  await expect(waiting).toHaveAttribute('data-v108-hidden', '');
  await expect(group).not.toHaveAttribute('data-v108-hidden', '');

  await expect(holdSelf).toBeHidden();
  await expect(holdOther).toBeHidden();
  await expect(other).toBeHidden();
  await expect(waiting).toBeHidden();
  await expect(group).toBeVisible();

  for (const locator of [holdSelf, holdOther, other, group, waiting]) {
    expect(await locator.evaluate(node => node.hidden)).toBe(false);
  }

  await page.evaluate(({ room }) => {
    const key = `system-task-tasks:${room}`;
    const tasks = JSON.parse(localStorage.getItem(key) || '[]');
    tasks.find(item => item.id === 'hold-other-v214').status = '未着手';
    localStorage.setItem(key, JSON.stringify(tasks));
  }, { room: ROOM });
  await triggerTodayMutation(page);

  await expect(holdOther).toHaveAttribute('data-v108-hidden', '');
  await expect(holdOther).toBeHidden();
  expect(await holdOther.evaluate(node => node.hidden)).toBe(false);

  await page.evaluate(({ room }) => {
    const key = `system-task-tasks:${room}`;
    const tasks = JSON.parse(localStorage.getItem(key) || '[]');
    tasks.find(item => item.id === 'hold-self-v214').status = '未着手';
    localStorage.setItem(key, JSON.stringify(tasks));
  }, { room: ROOM });
  await triggerTodayMutation(page);

  await expect(holdSelf).not.toHaveAttribute('data-v108-hidden', '');
  await expect(holdSelf).toBeVisible();
  expect(await holdSelf.evaluate(node => node.hidden)).toBe(false);

  await page.evaluate(() => {
    document.querySelector('.nav-filter[data-filter="mine"]')?.classList.remove('active');
  });
  await triggerTodayMutation(page);

  await expect(other).not.toHaveAttribute('data-v108-hidden', '');
  await expect(other).toBeVisible();
  await expect(group).toBeVisible();
  await expect(waiting).toHaveAttribute('data-v108-hidden', '');
  await expect(waiting).toBeHidden();
  expect(await other.evaluate(node => node.hidden)).toBe(false);
  expect(await waiting.evaluate(node => node.hidden)).toBe(false);
});

test('Today schedule mine and group visibility remains correct without stable native hidden writes', async ({ page }) => {
  await boot(page);

  await page.evaluate(() => {
    const user = document.getElementById('currentUserSelect');
    if (user) {
      if (![...user.options].some(option => option.value === '福冨')) user.add(new Option('福冨', '福冨'));
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
    fixture.id = 'stable-native-hidden-fixture-v214';
    fixture.innerHTML = `
      <div class="today-panel"><h4>今日の予定</h4><div>
        <article class="schedule-card" data-schedule-id="schedule-self-v214">self</article>
        <article class="schedule-card" data-schedule-id="schedule-other-v214">other</article>
        <article class="schedule-card" data-schedule-id="schedule-group-v214">group</article>
      </div></div>`;
    fixture.querySelectorAll('.schedule-card').forEach(card => { card.hidden = false; });
    today.appendChild(fixture);
  });

  const fixture = page.locator('#stable-native-hidden-fixture-v214');
  const self = fixture.locator('[data-schedule-id="schedule-self-v214"]');
  const other = fixture.locator('[data-schedule-id="schedule-other-v214"]');
  const group = fixture.locator('[data-schedule-id="schedule-group-v214"]');

  await expect(self).toBeVisible();
  await expect(group).toBeVisible();
  await expect(other).toHaveAttribute('data-v108-hidden', '');
  await expect(other).toBeHidden();
  expect(await self.evaluate(node => node.hidden)).toBe(false);
  expect(await other.evaluate(node => node.hidden)).toBe(false);
  expect(await group.evaluate(node => node.hidden)).toBe(false);

  await page.evaluate(() => {
    document.querySelector('.nav-filter[data-filter="mine"]')?.classList.remove('active');
  });
  await triggerTodayMutation(page);

  await expect(other).not.toHaveAttribute('data-v108-hidden', '');
  await expect(other).toBeVisible();
  expect(await other.evaluate(node => node.hidden)).toBe(false);
});
