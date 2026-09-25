import { test, expect } from '@playwright/test';

const ROOM = 'test-postload-version-sync-v279';
const VERSION = '262';

async function installRegression(page) {
  await page.addInitScript(room => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('systemTaskUser', '福冨');

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });

    const sourceFrom = stack => {
      const text = String(stack || '');
      if (text.includes('release-manifest.js')) return 'manifest';
      if (text.includes('config.js')) return 'config';
      return 'other';
    };
    const guardActive = () => Array.from(document.documentElement?.classList || [])
      .some(name => name.startsWith('wb-first-paint-v'));

    const audit = { versionTextWrites: [] };
    window.__WB_POSTLOAD_VERSION_PRODUCT_V279__ = audit;

    const textDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
    Object.defineProperty(Node.prototype, 'textContent', {
      configurable: textDescriptor.configurable,
      enumerable: textDescriptor.enumerable,
      get: textDescriptor.get,
      set(value) {
        const isVersionElement = this?.nodeType === Node.ELEMENT_NODE
          && this.matches?.('.app-version, .workboard-version-display');
        if (isVersionElement) {
          audit.versionTextWrites.push({
            source: sourceFrom(new Error().stack),
            value: String(value),
            assetsReady: window.WORK_BOARD_ASSETS_READY === true,
            guardActive: guardActive()
          });
        }
        return textDescriptor.set.call(this, value);
      }
    });
  }, ROOM);

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installRegression(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(
    () => !Array.from(document.documentElement.classList).some(name => name.startsWith('wb-first-paint-v')),
    undefined,
    { timeout: 8_000 }
  );
  await page.waitForFunction(
    version => document.querySelector('.workboard-version-display')?.dataset.releaseVersion === version,
    VERSION,
    { timeout: 8_000 }
  );
  await page.waitForTimeout(100);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const display = document.querySelector('.workboard-version-display, .app-version');
    return {
      versionTextWrites: window.__WB_POSTLOAD_VERSION_PRODUCT_V279__.versionTextWrites.slice(),
      current: {
        text: display?.textContent || '',
        className: display?.className || '',
        title: display?.getAttribute('title') || '',
        dataRelease: display?.dataset?.releaseVersion || '',
        releaseGlobal: String(window.WORK_BOARD_RELEASE_VERSION || ''),
        boardGlobal: String(window.WORK_BOARD_VERSION || ''),
        release: String(window.WORK_BOARD_RELEASE?.version || ''),
        firstPaintVersion: document.documentElement.dataset.firstPaintVersion || '',
        assetsReady: window.WORK_BOARD_ASSETS_READY === true,
        guardActive: Array.from(document.documentElement.classList).some(name => name.startsWith('wb-first-paint-v'))
      }
    };
  });
}

function expectSemanticVersion(state) {
  expect(state.text).toBe(`Ver.${VERSION}`);
  expect(state.className.split(/\s+/)).toContain('workboard-version-display');
  expect(state.className.split(/\s+/)).not.toContain('app-version');
  expect(state.title).toBe(`現在のバージョン Ver.${VERSION}`);
  expect(state.dataRelease).toBe(VERSION);
  expect(state.releaseGlobal).toBe(VERSION);
  expect(state.boardGlobal).toBe(VERSION);
  expect(state.release).toBe(VERSION);
}

async function repair(page, eventName) {
  return page.evaluate(name => {
    const display = document.querySelector('.workboard-version-display');
    display.classList.remove('workboard-version-display');
    display.classList.add('app-version');
    display.textContent = 'Ver.143';
    display.title = '現在のバージョン Ver.143';
    display.dataset.releaseVersion = '143';
    window.WORK_BOARD_RELEASE_VERSION = '143';
    window.WORK_BOARD_VERSION = '143';
    window.dispatchEvent(new Event(name));
    return {
      text: display.textContent,
      className: display.className,
      title: display.title,
      dataRelease: display.dataset.releaseVersion,
      releaseGlobal: String(window.WORK_BOARD_RELEASE_VERSION || ''),
      boardGlobal: String(window.WORK_BOARD_VERSION || ''),
      release: String(window.WORK_BOARD_RELEASE?.version || '')
    };
  }, eventName);
}

test('Ver.279 product: startup reaches release 262 with one config-owned version text upgrade', async ({ page }) => {
  await boot(page);
  const state = await snapshot(page);
  console.log('V279_POSTLOAD_PRODUCT_METRICS', JSON.stringify(state));

  expectSemanticVersion(state.current);
  expect(state.current.firstPaintVersion).toBe(VERSION);
  expect(state.current.assetsReady).toBe(true);
  expect(state.current.guardActive).toBe(false);

  const configWrites = state.versionTextWrites.filter(item => item.source === 'config' && item.value === `Ver.${VERSION}`);
  expect(configWrites).toHaveLength(1);
  expect(configWrites[0].assetsReady).toBe(false);
  expect(configWrites[0].guardActive).toBe(true);
  expect(state.versionTextWrites.filter(item => item.source === 'manifest')).toHaveLength(0);
});

test('Ver.279 product: focus still repairs synthetic version drift after post-load sync retirement', async ({ page }) => {
  await boot(page);
  const state = await repair(page, 'focus');
  console.log('V279_POSTLOAD_FOCUS_RECOVERY_METRICS', JSON.stringify(state));
  expectSemanticVersion(state);
});

test('Ver.279 product: pageshow still repairs synthetic version drift after post-load sync retirement', async ({ page }) => {
  await boot(page);
  const state = await repair(page, 'pageshow');
  console.log('V279_POSTLOAD_PAGESHOW_RECOVERY_METRICS', JSON.stringify(state));
  expectSemanticVersion(state);
});
