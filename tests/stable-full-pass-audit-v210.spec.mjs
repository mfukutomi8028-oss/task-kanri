import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const ROOM = 'test-stable-full-pass-audit-v210';
const stableSource = fs.readFileSync(new URL('../stable-fixes-v108.js', import.meta.url), 'utf8');

function auditStableSource() {
  let source = stableSource;

  const clickBefore = `if (event.target.closest?.('.nav-filter[data-filter="mine"], .nav-item[data-layout], .work-mobile-status-tab')) {`;
  const clickAfter = `if (event.target.closest?.('.nav-filter[data-filter="mine"], .nav-item[data-layout]')) {`;
  if (!source.includes(clickBefore)) throw new Error('stable status-tab full-pass trigger was not found');
  source = source.replace(clickBefore, clickAfter);

  const nonSemanticTriggers = `  window.addEventListener("resize", scheduleFixes);\n  window.addEventListener("orientationchange", () => setTimeout(scheduleFixes, 120));\n  window.addEventListener("pageshow", scheduleFixes);\n  setTimeout(scheduleFixes, 300);\n  setTimeout(scheduleFixes, 1200);`;
  if (!source.includes(nonSemanticTriggers)) throw new Error('stable non-semantic full-pass trigger block was not found');
  source = source.replace(nonSemanticTriggers, '  /* Ver.210 audit: non-semantic post-boot full-pass triggers disabled */');

  const applySignature = '  function applyFixes() {';
  if (!source.includes(applySignature)) throw new Error('stable applyFixes was not found');
  source = source.replace(applySignature, `${applySignature}\n    window.__WB_STABLE_FULL_PASS_AUDIT_V210__.fullPasses += 1;`);

  const todaySignature = '  function applyTodayFilters() {';
  if (!source.includes(todaySignature)) throw new Error('stable applyTodayFilters was not found');
  source = source.replace(todaySignature, `${todaySignature}\n    window.__WB_STABLE_FULL_PASS_AUDIT_V210__.todayPasses += 1;`);

  return source;
}

async function installAuditBoundary(page) {
  await page.addInitScript(({ room }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
    } catch {}

    window.__WB_STABLE_FULL_PASS_AUDIT_V210__ = {
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
    body: auditStableSource()
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
    return version === '209' && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await page.waitForFunction(() => document.getElementById('stableFixesV108Style'));
}

async function fullPassCount(page) {
  return page.evaluate(() => window.__WB_STABLE_FULL_PASS_AUDIT_V210__?.fullPasses ?? -1);
}

async function todayPassCount(page) {
  return page.evaluate(() => window.__WB_STABLE_FULL_PASS_AUDIT_V210__?.todayPasses ?? -1);
}

test('status-tab, resize, orientation, pageshow and delayed timers do not need a stable full pass', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 800 });
  await boot(page);

  // The production source currently schedules 300ms/1200ms retries. The audit variant removes them.
  await page.waitForTimeout(1_400);
  const settled = await fullPassCount(page);
  expect(settled).toBeGreaterThanOrEqual(1);

  await page.evaluate(() => {
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('orientationchange'));
    window.dispatchEvent(new PageTransitionEvent('pageshow'));
  });
  await page.waitForTimeout(250);
  expect(await fullPassCount(page)).toBe(settled);

  await expect(page.locator('#stableFixesV108Style')).toHaveCount(1);
  await expect(page.locator('.app-version').first()).toHaveText('Ver.209');

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await expect(page.locator('.work-mobile-status-tabs')).toBeVisible();
  await page.waitForTimeout(180);
  const afterTaskNavigation = await fullPassCount(page);
  expect(afterTaskNavigation).toBeGreaterThan(settled);

  const tabs = page.locator('.work-mobile-status-tab');
  const target = tabs.last();
  await expect(target).toBeVisible();
  await target.click();
  await page.waitForTimeout(180);

  expect(await fullPassCount(page)).toBe(afterTaskNavigation);
  await expect(target).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#stableFixesV108Style')).toHaveCount(1);
  await expect(page.locator('.app-version').first()).toHaveText('Ver.209');
});

test('Today final visibility remains owned by the scoped Today observer without non-semantic full passes', async ({ page }) => {
  await boot(page);
  const beforeToday = await todayPassCount(page);

  await page.evaluate(({ room }) => {
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
      { id: 'hold-v210', status: '保留', assignee: '福冨' },
      { id: 'other-v210', status: '未着手', assignee: '森井' },
      { id: 'group-v210', status: '対応中', assignee: 'システム課' },
      { id: 'waiting-v210', status: '確認待ち', assignee: '福冨' }
    ]));

    const user = document.getElementById('currentUserSelect');
    if (user) {
      if (![...user.options].some(option => option.value === '福冨')) user.add(new Option('福冨', '福冨'));
      user.value = '福冨';
    }

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
    fixture.id = 'stable-full-pass-fixture-v210';
    fixture.innerHTML = `
      <div class="today-panel"><h4>今日のタスク</h4><div>
        <article class="task-card" data-task-id="hold-v210"></article>
        <article class="task-card" data-task-id="other-v210"></article>
        <article class="task-card" data-task-id="group-v210"></article>
      </div></div>
      <div class="today-panel"><h4>空き時間</h4><div>
        <article class="task-card" data-task-id="waiting-v210"></article>
      </div></div>`;
    today.appendChild(fixture);
  }, { room: ROOM });

  await expect.poll(() => todayPassCount(page)).toBeGreaterThan(beforeToday);
  await expect(page.locator('[data-task-id="hold-v210"]')).toBeHidden();
  await expect(page.locator('[data-task-id="other-v210"]')).toBeHidden();
  await expect(page.locator('[data-task-id="group-v210"]')).toBeVisible();
  await expect(page.locator('[data-task-id="waiting-v210"]')).toBeHidden();

  const fullBeforeViewportEvents = await fullPassCount(page);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('orientationchange'));
    window.dispatchEvent(new PageTransitionEvent('pageshow'));
  });
  await page.waitForTimeout(250);
  expect(await fullPassCount(page)).toBe(fullBeforeViewportEvents);

  await expect(page.locator('[data-task-id="hold-v210"]')).toBeHidden();
  await expect(page.locator('[data-task-id="other-v210"]')).toBeHidden();
  await expect(page.locator('[data-task-id="group-v210"]')).toBeVisible();
  await expect(page.locator('[data-task-id="waiting-v210"]')).toBeHidden();
});
