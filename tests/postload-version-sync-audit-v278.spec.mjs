import { test, expect } from '@playwright/test';

const ROOM = 'test-postload-version-sync-v278';
const VERSION = '261';

function rewriteConfigForAudit(source, suppressPostloadSync) {
  const needle = `      setVersion();\n    } catch (error) {`;
  if (!source.includes(needle)) {
    throw new Error('Ver.278 audit could not locate the post-load setVersion boundary.');
  }

  const boundaryProbe = `      {\n        const display = document.querySelector('.workboard-version-display, .app-version');\n        window.__WB_V278_POSTLOAD_BOUNDARY__ = {\n          text: display?.textContent || '',\n          className: display?.className || '',\n          title: display?.getAttribute('title') || '',\n          dataRelease: display?.dataset?.releaseVersion || '',\n          releaseGlobal: String(window.WORK_BOARD_RELEASE_VERSION || ''),\n          boardGlobal: String(window.WORK_BOARD_VERSION || ''),\n          release: String(window.WORK_BOARD_RELEASE?.version || ''),\n          assetsReady: window.WORK_BOARD_ASSETS_READY === true,\n          guardActive: Array.from(document.documentElement.classList).some(name => name.startsWith('wb-first-paint-v'))\n        };\n      }\n`;
  const postloadCall = suppressPostloadSync ? '' : '      setVersion();\n';
  return source.replace(needle, `${boundaryProbe}${postloadCall}    } catch (error) {`);
}

async function installAudit(page, { suppressPostloadSync }) {
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
    window.__WB_POSTLOAD_VERSION_AUDIT_V278__ = audit;

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
            postloadBoundaryReached: Boolean(window.__WB_V278_POSTLOAD_BOUNDARY__),
            assetsReady: window.WORK_BOARD_ASSETS_READY === true,
            guardActive: guardActive()
          });
        }
        return textDescriptor.set.call(this, value);
      }
    });
  }, ROOM);

  await page.route(/\/config\.js\?v=143$/, async route => {
    const response = await route.fetch();
    const source = await response.text();
    const body = rewriteConfigForAudit(source, suppressPostloadSync);
    await route.fulfill({ response, body, contentType: 'application/javascript; charset=utf-8' });
  });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page, options) {
  await installAudit(page, options);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__WB_V278_POSTLOAD_BOUNDARY__), undefined, { timeout: 30_000 });
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
      boundary: { ...window.__WB_V278_POSTLOAD_BOUNDARY__ },
      versionTextWrites: window.__WB_POSTLOAD_VERSION_AUDIT_V278__.versionTextWrites.slice(),
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

function expectSemanticVersion(state, { boundary = false } = {}) {
  expect(state.text).toBe(`Ver.${VERSION}`);
  expect(state.className.split(/\s+/)).toContain('workboard-version-display');
  expect(state.className.split(/\s+/)).not.toContain('app-version');
  expect(state.title).toBe(`現在のバージョン Ver.${VERSION}`);
  expect(state.dataRelease).toBe(VERSION);
  expect(state.releaseGlobal).toBe(VERSION);
  expect(state.boardGlobal).toBe(VERSION);
  expect(state.release).toBe(VERSION);
  if (boundary) {
    expect(state.assetsReady).toBe(false);
    expect(state.guardActive).toBe(true);
  } else {
    expect(state.firstPaintVersion).toBe(VERSION);
    expect(state.assetsReady).toBe(true);
    expect(state.guardActive).toBe(false);
  }
}

test('Ver.278 audit: all assets finish with current semantic version before the post-load setVersion call', async ({ page }) => {
  await boot(page, { suppressPostloadSync: false });
  const state = await snapshot(page);
  console.log('V278_POSTLOAD_BASELINE_METRICS', JSON.stringify(state));

  expectSemanticVersion(state.boundary, { boundary: true });
  expectSemanticVersion(state.current);

  const configWrites = state.versionTextWrites.filter(item => item.source === 'config' && item.value === `Ver.${VERSION}`);
  expect(configWrites).toHaveLength(1);
  expect(configWrites[0].postloadBoundaryReached).toBe(false);
  expect(configWrites[0].assetsReady).toBe(false);
  expect(configWrites[0].guardActive).toBe(true);
  expect(state.versionTextWrites.filter(item => item.postloadBoundaryReached)).toHaveLength(0);
});

test('Ver.278 audit counterfactual: suppressing only post-load setVersion preserves reveal state', async ({ page }) => {
  await boot(page, { suppressPostloadSync: true });
  const state = await snapshot(page);
  console.log('V278_POSTLOAD_SUPPRESSED_METRICS', JSON.stringify(state));

  expectSemanticVersion(state.boundary, { boundary: true });
  expectSemanticVersion(state.current);

  const configWrites = state.versionTextWrites.filter(item => item.source === 'config' && item.value === `Ver.${VERSION}`);
  expect(configWrites).toHaveLength(1);
  expect(configWrites[0].postloadBoundaryReached).toBe(false);
  expect(state.versionTextWrites.filter(item => item.postloadBoundaryReached)).toHaveLength(0);
});

test('Ver.278 audit counterfactual: focus and pageshow still repair drift without post-load setVersion', async ({ page }) => {
  await boot(page, { suppressPostloadSync: true });

  const repair = async eventName => page.evaluate(name => {
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

  const focus = await repair('focus');
  const pageshow = await repair('pageshow');
  console.log('V278_POSTLOAD_RECOVERY_METRICS', JSON.stringify({ focus, pageshow }));

  for (const state of [focus, pageshow]) {
    expect(state.text).toBe(`Ver.${VERSION}`);
    expect(state.className.split(/\s+/)).toContain('workboard-version-display');
    expect(state.className.split(/\s+/)).not.toContain('app-version');
    expect(state.title).toBe(`現在のバージョン Ver.${VERSION}`);
    expect(state.dataRelease).toBe(VERSION);
    expect(state.releaseGlobal).toBe(VERSION);
    expect(state.boardGlobal).toBe(VERSION);
    expect(state.release).toBe(VERSION);
  }
});
