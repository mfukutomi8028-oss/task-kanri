import { test, expect } from '@playwright/test';

const ROOM = 'test-first-paint-version-handoff-v276';

async function installAudit(page, { suppressManifestVersionText = false } = {}) {
  await page.addInitScript(({ room, suppressManifestVersionText: suppress }) => {
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
        guardActive: Boolean(document.documentElement?.className?.includes('wb-first-paint-v260')),
        assetsReady: window.WORK_BOARD_ASSETS_READY === true
      };
    };

    const audit = {
      suppressManifestVersionText: Boolean(suppress),
      domContentLoadedRegistrations: [],
      domContentLoadedExecutions: [],
      versionTextWrites: [],
      suppressedManifestWrites: [],
      configSetVersionCalls: [],
      revealSnapshots: []
    };
    window.__WB_FIRST_PAINT_VERSION_V276__ = audit;

    const nativeAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function addEventListenerAuditV276(type, listener, options) {
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
          const source = sourceFrom(new Error().stack);
          const entry = { source, value: String(value), ...versionSnapshot() };
          if (source === 'manifest' && audit.suppressManifestVersionText) {
            audit.suppressedManifestWrites.push(entry);
            return;
          }
          audit.versionTextWrites.push(entry);
        }
        return textDescriptor.set.call(this, value);
      }
    });

    let releaseVersionValue;
    Object.defineProperty(window, 'WORK_BOARD_RELEASE_VERSION', {
      configurable: true,
      get() { return releaseVersionValue; },
      set(value) {
        const source = sourceFrom(new Error().stack);
        if (source === 'config') {
          audit.configSetVersionCalls.push({ value: String(value), ...versionSnapshot() });
        }
        releaseVersionValue = value;
      }
    });

    let boardVersionValue;
    Object.defineProperty(window, 'WORK_BOARD_VERSION', {
      configurable: true,
      get() { return boardVersionValue; },
      set(value) { boardVersionValue = value; }
    });

    const nativeClassRemove = DOMTokenList.prototype.remove;
    DOMTokenList.prototype.remove = function classRemoveAuditV276(...tokens) {
      const isFirstPaintReveal = tokens.some(token => String(token).startsWith('wb-first-paint-v'))
        && sourceFrom(new Error().stack) === 'manifest';
      const result = nativeClassRemove.apply(this, tokens);
      if (isFirstPaintReveal) {
        audit.revealSnapshots.push(versionSnapshot());
      }
      return result;
    };
  }, { room: ROOM, suppressManifestVersionText });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page, options = {}) {
  await installAudit(page, options);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => !document.documentElement.className.includes('wb-first-paint-v260'), undefined, { timeout: 8_000 });
  await page.waitForFunction(() => document.querySelector('.workboard-version-display')?.dataset.releaseVersion === '260', undefined, { timeout: 8_000 });
  await page.waitForTimeout(100);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const audit = window.__WB_FIRST_PAINT_VERSION_V276__;
    const display = document.querySelector('.workboard-version-display, .app-version');
    return {
      domContentLoadedRegistrations: audit.domContentLoadedRegistrations.slice(),
      domContentLoadedExecutions: audit.domContentLoadedExecutions.slice(),
      versionTextWrites: audit.versionTextWrites.slice(),
      suppressedManifestWrites: audit.suppressedManifestWrites.slice(),
      configSetVersionCalls: audit.configSetVersionCalls.slice(),
      revealSnapshots: audit.revealSnapshots.slice(),
      text: display?.textContent || '',
      className: display?.className || '',
      title: display?.getAttribute('title') || '',
      dataRelease: display?.dataset.releaseVersion || '',
      releaseGlobal: String(window.WORK_BOARD_RELEASE_VERSION || ''),
      boardGlobal: String(window.WORK_BOARD_VERSION || ''),
      release: String(window.WORK_BOARD_RELEASE?.version || ''),
      firstPaintVersion: document.documentElement.dataset.firstPaintVersion || '',
      guardActive: document.documentElement.className.includes('wb-first-paint-v260')
    };
  });
}

function expectCurrentVersion(state) {
  expect(state.text).toBe('Ver.260');
  expect(state.className.split(/\s+/)).toContain('workboard-version-display');
  expect(state.className.split(/\s+/)).not.toContain('app-version');
  expect(state.title).toBe('現在のバージョン Ver.260');
  expect(state.dataRelease).toBe('260');
  expect(state.releaseGlobal).toBe('260');
  expect(state.boardGlobal).toBe('260');
  expect(state.release).toBe('260');
  expect(state.firstPaintVersion).toBe('260');
  expect(state.guardActive).toBe(false);
}

test('Ver.276 audit: manifest text handoff runs first but remains hidden until config completes semantic sync', async ({ page }) => {
  await boot(page);
  const state = await snapshot(page);
  console.log('V276_FIRST_PAINT_NORMAL_METRICS', JSON.stringify(state));

  expect(state.domContentLoadedRegistrations.slice(0, 2)).toEqual(['manifest', 'config']);
  expect(state.domContentLoadedExecutions.slice(0, 2).map(item => item.owner)).toEqual(['manifest', 'config']);

  const manifestExecution = state.domContentLoadedExecutions.find(item => item.owner === 'manifest');
  const configExecution = state.domContentLoadedExecutions.find(item => item.owner === 'config');
  expect(manifestExecution?.text).toBe('Ver.143');
  expect(manifestExecution?.className.split(/\s+/)).toContain('app-version');
  expect(manifestExecution?.guardActive).toBe(true);
  expect(manifestExecution?.assetsReady).toBe(false);
  expect(configExecution?.text).toBe('Ver.260');
  expect(configExecution?.guardActive).toBe(true);
  expect(configExecution?.assetsReady).toBe(false);

  const manifestWrites = state.versionTextWrites.filter(item => item.source === 'manifest' && item.value === 'Ver.260');
  const configWrites = state.versionTextWrites.filter(item => item.source === 'config' && item.value === 'Ver.260');
  expect(manifestWrites).toHaveLength(1);
  expect(manifestWrites[0].guardActive).toBe(true);
  expect(manifestWrites[0].assetsReady).toBe(false);
  expect(configWrites).toHaveLength(0);
  expect(state.configSetVersionCalls.length).toBeGreaterThanOrEqual(2);
  expect(state.configSetVersionCalls[0].guardActive).toBe(true);
  expect(state.configSetVersionCalls[0].assetsReady).toBe(false);

  expect(state.revealSnapshots).toHaveLength(1);
  expect(state.revealSnapshots[0].text).toBe('Ver.260');
  expect(state.revealSnapshots[0].className.split(/\s+/)).toContain('workboard-version-display');
  expect(state.revealSnapshots[0].dataRelease).toBe('260');
  expect(state.revealSnapshots[0].releaseGlobal).toBe('260');
  expect(state.revealSnapshots[0].boardGlobal).toBe('260');
  expectCurrentVersion(state);
});

test('Ver.276 audit: suppressing only manifest version text still converges fully before first-paint reveal', async ({ page }) => {
  await boot(page, { suppressManifestVersionText: true });
  const state = await snapshot(page);
  console.log('V276_FIRST_PAINT_SUPPRESSED_MANIFEST_METRICS', JSON.stringify(state));

  expect(state.suppressedManifestWrites.filter(item => item.value === 'Ver.260')).toHaveLength(1);
  expect(state.suppressedManifestWrites[0].guardActive).toBe(true);
  expect(state.suppressedManifestWrites[0].assetsReady).toBe(false);

  const configExecution = state.domContentLoadedExecutions.find(item => item.owner === 'config');
  expect(configExecution?.text).toBe('Ver.143');
  expect(configExecution?.className.split(/\s+/)).toContain('app-version');
  expect(configExecution?.guardActive).toBe(true);
  expect(configExecution?.assetsReady).toBe(false);

  const configWrites = state.versionTextWrites.filter(item => item.source === 'config' && item.value === 'Ver.260');
  expect(configWrites).toHaveLength(1);
  expect(configWrites[0].guardActive).toBe(true);
  expect(configWrites[0].assetsReady).toBe(false);

  expect(state.configSetVersionCalls.length).toBeGreaterThanOrEqual(2);
  expect(state.configSetVersionCalls[0].guardActive).toBe(true);
  expect(state.configSetVersionCalls[0].assetsReady).toBe(false);

  expect(state.revealSnapshots).toHaveLength(1);
  const reveal = state.revealSnapshots[0];
  expect(reveal.text).toBe('Ver.260');
  expect(reveal.className.split(/\s+/)).toContain('workboard-version-display');
  expect(reveal.className.split(/\s+/)).not.toContain('app-version');
  expect(reveal.title).toBe('現在のバージョン Ver.260');
  expect(reveal.dataRelease).toBe('260');
  expect(reveal.releaseGlobal).toBe('260');
  expect(reveal.boardGlobal).toBe('260');
  expect(reveal.assetsReady).toBe(true);
  expectCurrentVersion(state);
});
