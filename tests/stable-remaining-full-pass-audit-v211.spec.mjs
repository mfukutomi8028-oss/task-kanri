import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const ROOM = 'test-stable-remaining-full-pass-audit-v211';
const stableSource = fs.readFileSync(new URL('../stable-fixes-v108.js', import.meta.url), 'utf8');

function instrumentStableSource() {
  let source = stableSource;

  if (/function scheduleFixes\s*\(/.test(source) || /setTimeout\(scheduleFixes/.test(source)) {
    throw new Error('retired stable full-pass scheduler returned');
  }
  if (/function applyFixes\s*\(/.test(source)) {
    throw new Error('retired stable applyFixes returned');
  }
  if (/function installStyle\s*\(/.test(source) || source.includes('stableFixesV108Style')) {
    throw new Error('retired stable style injection returned');
  }

  const clickContract = `  document.addEventListener("click", event => {\n    if (event.target.closest?.('.nav-filter[data-filter="mine"], .nav-item[data-layout]')) {\n      setTimeout(scheduleTodayFilters, 0);\n      setTimeout(scheduleTodayFilters, 120);\n    }\n  }, true);`;
  if (!source.includes(clickContract)) throw new Error('Ver.211 Today-only nav/filter trigger was not found');

  const changeContract = `  document.addEventListener("change", event => {\n    if (event.target.matches?.("#currentUserSelect, #startupUser")) setTimeout(scheduleTodayFilters, 0);\n  }, true);`;
  if (!source.includes(changeContract)) throw new Error('Ver.211 Today-only user-change trigger was not found');

  const todaySignature = '  function applyTodayFilters() {';
  if (!source.includes(todaySignature)) throw new Error('stable applyTodayFilters was not found');
  source = source.replace(todaySignature, `${todaySignature}\n    window.__WB_STABLE_REMAINING_AUDIT_V211__.todayPasses += 1;`);

  return source;
}

async function installAuditBoundary(page) {
  await page.addInitScript(({ room }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
      localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
        { id: 'user-v211', status: '未着手', assignee: '福冨' },
        { id: 'other-v211', status: '未着手', assignee: '森井' },
        { id: 'group-v211', status: '対応中', assignee: 'システム課' }
      ]));
    } catch {}

    window.__WB_STABLE_REMAINING_AUDIT_V211__ = {
      fullPasses: 0,
      todayPasses: 0
    };

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });

  await page.route(/\/stable-fixes-v108\.js(?:\?.*)?$/i, route => route.fulfill({
    status: 200,
    contentType: 'application/javascript; charset=utf-8',
    body: instrumentStableSource()
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
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await expect(page.locator('#stableFixesV108Style')).toHaveCount(0);
}

async function counts(page) {
  return page.evaluate(() => ({
    full: window.__WB_STABLE_REMAINING_AUDIT_V211__?.fullPasses ?? -1,
    today: window.__WB_STABLE_REMAINING_AUDIT_V211__?.todayPasses ?? -1
  }));
}

async function expectVersionAndRetiredStyle(page) {
  await expect(page.locator('#stableFixesV108Style')).toHaveCount(0);
  const version = await page.evaluate(() => String(window.WORK_BOARD_RELEASE?.version || ''));
  expect(version).not.toBe('');
  const display = page.locator('.workboard-version-display').first();
  await expect(display).toHaveText(`Ver.${version}`);
  await expect(display).toHaveAttribute('data-release-version', version);
}

function fixtureTask(page, id) {
  return page.locator(`#stable-remaining-fixture-v211 [data-task-id="${id}"]`);
}

test('product mine filter and current-user changes run only the scoped Today pass', async ({ page }) => {
  await boot(page);

  await page.evaluate(() => {
    document.querySelectorAll('.nav-filter[data-filter="mine"]').forEach(node => node.classList.remove('active'));
    const today = document.getElementById('todayView');
    today.hidden = false;
    const fixture = document.createElement('section');
    fixture.id = 'stable-remaining-fixture-v211';
    fixture.innerHTML = `
      <div class="today-panel"><h4>今日のタスク</h4><div>
        <article class="task-card" data-task-id="user-v211"></article>
        <article class="task-card" data-task-id="other-v211"></article>
        <article class="task-card" data-task-id="group-v211"></article>
      </div></div>`;
    today.appendChild(fixture);
  });

  await expect(fixtureTask(page, 'user-v211')).toBeVisible();
  await expect(fixtureTask(page, 'other-v211')).toBeVisible();
  await expect(fixtureTask(page, 'group-v211')).toBeVisible();

  const beforeMine = await counts(page);
  expect(beforeMine.full).toBe(0);

  await page.evaluate(() => {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'nav-item nav-filter active';
    trigger.dataset.filter = 'mine';
    trigger.id = 'stable-audit-mine-v211';
    document.body.appendChild(trigger);
    trigger.click();
  });

  await expect(fixtureTask(page, 'user-v211')).toBeVisible();
  await expect(fixtureTask(page, 'other-v211')).toBeHidden();
  await expect(fixtureTask(page, 'group-v211')).toBeVisible();
  await expect.poll(async () => (await counts(page)).today).toBeGreaterThan(beforeMine.today);
  expect((await counts(page)).full).toBe(0);
  await expectVersionAndRetiredStyle(page);

  const beforeUser = await counts(page);
  await page.evaluate(() => {
    const original = document.getElementById('currentUserSelect');
    const clone = original.cloneNode(true);
    if (![...clone.options].some(option => option.value === '森井')) clone.add(new Option('森井', '森井'));
    clone.value = '森井';
    original.replaceWith(clone);
    clone.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await expect(fixtureTask(page, 'user-v211')).toBeHidden();
  await expect(fixtureTask(page, 'other-v211')).toBeVisible();
  await expect(fixtureTask(page, 'group-v211')).toBeVisible();
  await expect.poll(async () => (await counts(page)).today).toBeGreaterThan(beforeUser.today);
  expect((await counts(page)).full).toBe(0);
  await expectVersionAndRetiredStyle(page);
});

test('product navigation remains usable while stable nav clicks schedule only Today filtering', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await boot(page);

  const initial = await counts(page);
  expect(initial.full).toBe(0);

  await page.locator('.nav-item[data-layout="tasks"]').evaluate(button => button.click());
  await expect(page.locator('#boardView')).toBeVisible();
  await page.waitForTimeout(180);
  expect((await counts(page)).full).toBe(0);
  await expectVersionAndRetiredStyle(page);

  await page.locator('.nav-item[data-layout="today"]').evaluate(button => button.click());
  await expect(page.locator('#todayView')).toBeVisible();
  await page.waitForTimeout(180);
  expect((await counts(page)).full).toBe(0);
  await expectVersionAndRetiredStyle(page);
});
