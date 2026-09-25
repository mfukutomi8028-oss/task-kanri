import { test, expect } from '@playwright/test';

const ROOM = 'test-version-lifecycle-v275';

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

    const sourceOwned = stack => String(stack || '').includes('config.js');
    const audit = {
      currentTrigger: 'direct',
      setVersionCalls: [],
      versionMutations: [],
      timerRegistrations: [],
      timerCallbacks: [],
      eventRegistrations: [],
      eventCallbacks: [],
      resetRuntime() {
        this.setVersionCalls.length = 0;
        this.versionMutations.length = 0;
        this.timerCallbacks.length = 0;
        this.eventCallbacks.length = 0;
        this.currentTrigger = 'direct';
      }
    };
    window.__WB_VERSION_LIFECYCLE_V275__ = audit;

    const nativeQuerySelectorAll = Document.prototype.querySelectorAll;
    Document.prototype.querySelectorAll = function querySelectorAllAuditV275(selector) {
      const stack = new Error().stack;
      if (
        selector === '.app-version, .workboard-version-display'
        && sourceOwned(stack)
      ) {
        audit.setVersionCalls.push({ trigger: audit.currentTrigger });
      }
      return nativeQuerySelectorAll.call(this, selector);
    };

    let releaseVersionValue;
    Object.defineProperty(window, 'WORK_BOARD_RELEASE_VERSION', {
      configurable: true,
      get() { return releaseVersionValue; },
      set(value) { releaseVersionValue = value; }
    });

    let boardVersionValue;
    Object.defineProperty(window, 'WORK_BOARD_VERSION', {
      configurable: true,
      get() { return boardVersionValue; },
      set(value) { boardVersionValue = value; }
    });

    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = function setTimeoutAuditV275(callback, delay, ...args) {
      const stack = new Error().stack;
      if (sourceOwned(stack) && typeof callback === 'function' && (delay === 300 || delay === 1200)) {
        const label = `timer:${delay}`;
        audit.timerRegistrations.push(delay);
        return nativeSetTimeout(function versionTimerAuditWrapper(...callbackArgs) {
          const previous = audit.currentTrigger;
          audit.currentTrigger = label;
          audit.timerCallbacks.push(delay);
          try {
            return callback(...callbackArgs);
          } finally {
            nativeSetTimeout(() => {
              if (audit.currentTrigger === label) audit.currentTrigger = previous;
            }, 0);
          }
        }, delay, ...args);
      }
      return nativeSetTimeout(callback, delay, ...args);
    };

    const nativeAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function addEventListenerAuditV275(type, listener, options) {
      const stack = new Error().stack;
      if (
        this === window
        && (type === 'focus' || type === 'pageshow')
        && sourceOwned(stack)
        && typeof listener === 'function'
      ) {
        audit.eventRegistrations.push(type);
        return nativeAddEventListener.call(this, type, function versionEventAuditWrapper(...eventArgs) {
          const previous = audit.currentTrigger;
          audit.currentTrigger = `event:${type}`;
          audit.eventCallbacks.push(type);
          try {
            return listener.apply(this, eventArgs);
          } finally {
            nativeSetTimeout(() => {
              if (audit.currentTrigger === `event:${type}`) audit.currentTrigger = previous;
            }, 0);
          }
        }, options);
      }
      return nativeAddEventListener.call(this, type, listener, options);
    };

    const versionElementFor = node => {
      if (!node) return null;
      const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
      if (!element) return null;
      if (element.matches?.('.app-version, .workboard-version-display')) return element;
      return element.closest?.('.app-version, .workboard-version-display') || null;
    };

    const observer = new MutationObserver(records => {
      for (const record of records) {
        const element = versionElementFor(record.target);
        if (!element) continue;
        audit.versionMutations.push({
          trigger: audit.currentTrigger,
          type: record.type,
          attributeName: record.attributeName || '',
          oldValue: record.oldValue ?? '',
          className: element.className,
          text: element.textContent || ''
        });
      }
    });
    observer.observe(document, {
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      childList: true,
      characterData: true,
      characterDataOldValue: true
    });
  }, ROOM);

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installAudit(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.querySelector('.workboard-version-display')?.dataset.releaseVersion === '260', undefined, { timeout: 8_000 });
  await page.waitForTimeout(1400);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const audit = window.__WB_VERSION_LIFECYCLE_V275__;
    const display = document.querySelector('.workboard-version-display, .app-version');
    const callsByTrigger = audit.setVersionCalls.reduce((result, item) => {
      result[item.trigger] = (result[item.trigger] || 0) + 1;
      return result;
    }, {});
    const mutationsByTrigger = audit.versionMutations.reduce((result, item) => {
      result[item.trigger] = (result[item.trigger] || 0) + 1;
      return result;
    }, {});
    return {
      calls: audit.setVersionCalls.slice(),
      callsByTrigger,
      mutations: audit.versionMutations.slice(),
      mutationsByTrigger,
      timerRegistrations: audit.timerRegistrations.slice(),
      timerCallbacks: audit.timerCallbacks.slice(),
      eventRegistrations: audit.eventRegistrations.slice(),
      eventCallbacks: audit.eventCallbacks.slice(),
      text: display?.textContent || '',
      className: display?.className || '',
      title: display?.getAttribute('title') || '',
      dataRelease: display?.dataset.releaseVersion || '',
      releaseGlobal: String(window.WORK_BOARD_RELEASE_VERSION || ''),
      boardGlobal: String(window.WORK_BOARD_VERSION || ''),
      release: String(window.WORK_BOARD_RELEASE?.version || '')
    };
  });
}

async function resetRuntime(page) {
  await page.evaluate(() => window.__WB_VERSION_LIFECYCLE_V275__.resetRuntime());
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
}

test('Ver.275 product: startup keeps direct synchronization and registers no delayed version timers', async ({ page }) => {
  await boot(page);
  const state = await snapshot(page);
  console.log('V275_VERSION_STARTUP_METRICS', JSON.stringify(state));

  expect(state.timerRegistrations).toEqual([]);
  expect(state.timerCallbacks).toEqual([]);
  expect(state.eventRegistrations.filter(type => type === 'focus')).toHaveLength(1);
  expect(state.eventRegistrations.filter(type => type === 'pageshow')).toHaveLength(1);
  expect(state.callsByTrigger['timer:300'] || 0).toBe(0);
  expect(state.callsByTrigger['timer:1200'] || 0).toBe(0);
  expect(state.callsByTrigger.direct || 0).toBeGreaterThanOrEqual(2);
  expectCurrentVersion(state);
});

test('Ver.275 product: no-drift focus and pageshow invoke recovery checks without DOM mutation', async ({ page }) => {
  await boot(page);

  await resetRuntime(page);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(40);
  const focusState = await snapshot(page);
  console.log('V275_VERSION_FOCUS_NODRIFT_METRICS', JSON.stringify(focusState));
  expect(focusState.calls).toHaveLength(1);
  expect(focusState.calls[0].trigger).toBe('event:focus');
  expect(focusState.mutations).toHaveLength(0);
  expectCurrentVersion(focusState);

  await resetRuntime(page);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await page.waitForTimeout(40);
  const pageshowState = await snapshot(page);
  console.log('V275_VERSION_PAGESHOW_NODRIFT_METRICS', JSON.stringify(pageshowState));
  expect(pageshowState.calls).toHaveLength(1);
  expect(pageshowState.calls[0].trigger).toBe('event:pageshow');
  expect(pageshowState.mutations).toHaveLength(0);
  expectCurrentVersion(pageshowState);
});

test('Ver.275 product: pageshow alone repairs synthetic version DOM and global drift', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const audit = window.__WB_VERSION_LIFECYCLE_V275__;
    audit.currentTrigger = 'test:drift';
    const display = document.querySelector('.workboard-version-display');
    if (display) {
      display.classList.remove('workboard-version-display');
      display.classList.add('app-version');
      display.textContent = 'Ver.143';
      display.title = '現在のバージョン Ver.143';
      display.dataset.releaseVersion = '143';
    }
    window.WORK_BOARD_RELEASE_VERSION = '143';
    window.WORK_BOARD_VERSION = '143';
    audit.resetRuntime();
  });

  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await page.waitForTimeout(40);
  const state = await snapshot(page);
  console.log('V275_VERSION_PAGESHOW_DRIFT_METRICS', JSON.stringify(state));

  expect(state.calls).toHaveLength(1);
  expect(state.calls[0].trigger).toBe('event:pageshow');
  expect(state.mutations.length).toBeGreaterThan(0);
  expectCurrentVersion(state);
});

test('Ver.275 product: focus alone repairs synthetic version DOM and global drift', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const audit = window.__WB_VERSION_LIFECYCLE_V275__;
    audit.currentTrigger = 'test:drift';
    const display = document.querySelector('.workboard-version-display');
    if (display) {
      display.classList.remove('workboard-version-display');
      display.classList.add('app-version');
      display.textContent = 'Ver.143';
      display.title = '現在のバージョン Ver.143';
      display.dataset.releaseVersion = '143';
    }
    window.WORK_BOARD_RELEASE_VERSION = '143';
    window.WORK_BOARD_VERSION = '143';
    audit.resetRuntime();
  });

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(40);
  const state = await snapshot(page);
  console.log('V275_VERSION_FOCUS_DRIFT_METRICS', JSON.stringify(state));

  expect(state.calls).toHaveLength(1);
  expect(state.calls[0].trigger).toBe('event:focus');
  expect(state.mutations.length).toBeGreaterThan(0);
  expectCurrentVersion(state);
});

test('Ver.275 product: normal navigation does not require version lifecycle recovery', async ({ page }) => {
  await boot(page);
  await resetRuntime(page);

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await expect(page.locator('#boardView')).toBeVisible();
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="today"]')?.click());
  await expect(page.locator('#todayView')).toBeVisible();
  await page.waitForTimeout(80);

  const state = await snapshot(page);
  console.log('V275_VERSION_NAVIGATION_METRICS', JSON.stringify(state));
  expect(state.calls).toHaveLength(0);
  expect(state.mutations).toHaveLength(0);
  expectCurrentVersion(state);
});
