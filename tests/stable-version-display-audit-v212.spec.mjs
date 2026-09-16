import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const ROOM = 'test-stable-version-display-audit-v212';
const stableSource = fs.readFileSync(new URL('../stable-fixes-v108.js', import.meta.url), 'utf8');

function stableWithoutVersionCall() {
  const before = `  function applyFixes() {\n    installStyle();\n    applyTodayFilters();\n    setVersion();\n  }`;
  const after = `  function applyFixes() {\n    installStyle();\n    applyTodayFilters();\n    /* Ver.212 audit: version display is owned by manifest + version-display-lock */\n  }`;
  if (!stableSource.includes(before)) throw new Error('stable applyFixes version call was not found');
  return stableSource.replace(before, after);
}

async function boot(page) {
  await page.addInitScript(({ room }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
      localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([
        { id: 'hold-v212', status: '保留', assignee: '福冨' },
        { id: 'group-v212', status: '対応中', assignee: 'システム課' }
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
    body: stableWithoutVersionCall()
  }));
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));

  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return version === '211' && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await page.waitForFunction(() => document.getElementById('stableFixesV108Style'));
  await page.waitForFunction(() => document.getElementById('workBoardVersionDisplayStyle'));
}

async function expectCanonicalVersion(page) {
  const display = page.locator('.workboard-version-display').first();
  await expect(display).toHaveText('Ver.211');
  await expect(display).toHaveAttribute('data-release-version', '211');
  await expect(display).toHaveAttribute('title', '現在のバージョン Ver.211');
  await expect(page.locator('.app-version')).toHaveCount(0);
  expect(await page.evaluate(() => window.WORK_BOARD_VERSION)).toBe('211');
}

test('manifest and version-display-lock own initial version display without stable setVersion', async ({ page }) => {
  await boot(page);

  await expectCanonicalVersion(page);
  await expect(page.locator('#stableFixesV108Style')).toHaveCount(1);

  await page.evaluate(() => {
    const today = document.getElementById('todayView');
    today.hidden = false;
    const fixture = document.createElement('section');
    fixture.id = 'stable-version-fixture-v212';
    fixture.innerHTML = `
      <div class="today-panel"><h4>今日のタスク</h4><div>
        <article class="task-card" data-task-id="hold-v212"></article>
        <article class="task-card" data-task-id="group-v212"></article>
      </div></div>`;
    today.appendChild(fixture);
  });

  await expect(page.locator('#stable-version-fixture-v212 [data-task-id="hold-v212"]')).toBeHidden();
  await expect(page.locator('#stable-version-fixture-v212 [data-task-id="group-v212"]')).toBeVisible();
  await expectCanonicalVersion(page);
});

test('version-display-lock restores a legacy overwrite without stable setVersion', async ({ page }) => {
  await boot(page);
  await expectCanonicalVersion(page);

  await page.evaluate(() => {
    const display = document.querySelector('.workboard-version-display');
    display.textContent = 'Ver.108';
    display.title = 'legacy version';
    display.dataset.releaseVersion = '108';
    window.WORK_BOARD_VERSION = '108';
    window.dispatchEvent(new Event('pageshow'));
  });

  await expectCanonicalVersion(page);

  await page.evaluate(() => {
    const display = document.querySelector('.workboard-version-display');
    display.textContent = 'Ver.143';
    window.dispatchEvent(new Event('focus'));
  });
  await expectCanonicalVersion(page);
});
