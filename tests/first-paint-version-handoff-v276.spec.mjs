import { test, expect } from '@playwright/test';

const ROOM = 'test-first-paint-version-handoff-v277';

async function installAudit(page) {
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
    const versionSnapshot = () => {
      const display = document.querySelector?.('.workboard-version-display, .app-version');
      return {
        text: display?.textContent || '',
        className: display?.className || '',
        title: display?.getAttribute?.('title') || '',
        dataRelease: display?.dataset?.releaseVersion || '',
        releaseGlobal: String(window.WORK_BOARD_RELEASE_VERSION || ''),
        boardGlobal: String(window.WORK_BOARD_VERSION || ''),
        release: String(window.WORK_BOARD_RELEASE?.version || ''),
        guardActive: guardActive(),
        assetsReady: window.WORK_BOARD_ASSETS_READY === true
      };
    };

    const audit = {
      domContentLoadedRegistrations: [],
      domContentLoadedExecutions: [],
      versionTextWrites: [],
      revealSnapshots: []
    };
    window.__WB_FIRST_PAINT_VERSION_V277__ = audit;

    const nativeAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function addEventListenerAuditV277(type, listener, options) {
      const owner = sourceFrom(new Error().stack);
      if (
        this === document
        && type === 'DOMContentLoaded'
        && (owner === 'manifest' || owner === 'config')
        && typeof listener === 'function'
      ) {
        audit.domContentLoadedRegistrations.push(owner);
        return nativeAddEventListener.call(this, type, function firstPaintDomReadyAudit(...args) {
          audit.domContentLoadedExecutions.push({ owner, ...versionSnapshot() });
          return listener.apply(this, args);
        }, options);
      }
      return nativeAddEventListener.call(this, type, listener, options);
    };

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
            ...versionSnapshot()
          });
        }
        return textDescriptor.set.call(this, value);
      }
    });

    const nativeClassRemove = DOMTokenList.prototype.remove;
    DOMTokenList.prototype.remove = function classRemoveAuditV277(...tokens) {
      const firstPaintReveal = tokens.some(token => String(token).startsWith('wb-first-paint-v'))
        && sourceFrom(new Error().stack) === 'manifest';
      const result = nativeClassRemove.apply(this, tokens);
      if (firstPaintReveal) audit.revealSnapshots.push(versionSnapshot());
      return result;
    };
  }, ROOM);

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installAudit(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(
    () => !Array.from(document.documentElement.classList).some(name => name.startsWith('wb-first-paint-v')),
    undefined,
    { timeout: 8_000 }
  );
  await page.waitForFunction(
    () => document.querySelector('.workboard-version-display')?.dataset.releaseVersion === '261',
    undefined,
    { timeout: 8_000 }
  );
  await page.waitForTimeout(100);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const audit = window.__WB_FIRST_PAINT_VERSION_V277__;
    const display = document.querySelector('.workboard-version-display, .app-version');
    return {
      domContentLoadedRegistrations: audit.domContentLoadedRegistrations.slice(),
      domContentLoadedExecutions: audit.domContentLoadedExecutions.slice(),
      versionTextWrites: audit.versionTextWrites.slice(),
      revealSnapshots: audit.revealSnapshots.slice(),
      text: display?.textContent || '',
      className: display?.className || '',
      title: display?.getAttribute('title') || '',
      dataRelease: display?.dataset.releaseVersion || '',
      releaseGlobal: String(window.WORK_BOARD_RELEASE_VERSION || ''),
      boardGlobal: String(window.WORK_BOARD_VERSION || ''),
      release: String(window.WORK_BOARD_RELEASE?.version || ''),
      firstPaintVersion: document.documentElement.dataset.firstPaintVersion || '',
      guardActive: Array.from(document.documentElement.classList).some(name => name.startsWith('wb-first-paint-v'))
    };
  });
}

function expectCurrentVersion(state) {
  expect(state.text).toBe('Ver.261');
  expect(state.className.split(/\s+/)).toContain('workboard-version-display');
  expect(state.className.split(/\s+/)).not.toContain('app-version');
  expect(state.title).toBe('現在のバージョン Ver.261');
  expect(state.dataRelease).toBe('261');
  expect(state.releaseGlobal).toBe('261');
  expect(state.boardGlobal).toBe('261');
  expect(state.release).toBe('261');
  expect(state.firstPaintVersion).toBe('261');
  expect(state.guardActive).toBe(false);
}

test('Ver.277 product: config alone upgrades legacy version before first-paint reveal', async ({ page }) => {
  await boot(page);
  const state = await snapshot(page);
  console.log('V277_FIRST_PAINT_VERSION_METRICS', JSON.stringify(state));

  expect(state.domContentLoadedRegistrations.slice(0, 2)).toEqual(['manifest', 'config']);
  expect(state.domContentLoadedExecutions.slice(0, 2).map(item => item.owner)).toEqual(['manifest', 'config']);

  const manifestExecution = state.domContentLoadedExecutions.find(item => item.owner === 'manifest');
  const configExecution = state.domContentLoadedExecutions.find(item => item.owner === 'config');
  expect(manifestExecution?.text).toBe('Ver.143');
  expect(manifestExecution?.guardActive).toBe(true);
  expect(manifestExecution?.assetsReady).toBe(false);
  expect(configExecution?.text).toBe('Ver.143');
  expect(configExecution?.className.split(/\s+/)).toContain('app-version');
  expect(configExecution?.guardActive).toBe(true);
  expect(configExecution?.assetsReady).toBe(false);

  const manifestWrites = state.versionTextWrites.filter(item => item.source === 'manifest');
  const configWrites = state.versionTextWrites.filter(item => item.source === 'config' && item.value === 'Ver.261');
  expect(manifestWrites).toHaveLength(0);
  expect(configWrites).toHaveLength(1);
  expect(configWrites[0].text).toBe('Ver.143');
  expect(configWrites[0].guardActive).toBe(true);
  expect(configWrites[0].assetsReady).toBe(false);

  expect(state.revealSnapshots).toHaveLength(1);
  const reveal = state.revealSnapshots[0];
  expect(reveal.text).toBe('Ver.261');
  expect(reveal.className.split(/\s+/)).toContain('workboard-version-display');
  expect(reveal.className.split(/\s+/)).not.toContain('app-version');
  expect(reveal.title).toBe('現在のバージョン Ver.261');
  expect(reveal.dataRelease).toBe('261');
  expect(reveal.releaseGlobal).toBe('261');
  expect(reveal.boardGlobal).toBe('261');
  expect(reveal.assetsReady).toBe(true);
  expectCurrentVersion(state);
});