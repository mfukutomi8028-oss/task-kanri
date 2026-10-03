import { test, expect } from '@playwright/test';

test('Ver.355 browser confirms cleaned global wakeup owners stay narrowed', async ({ page }) => {
  await page.addInitScript(() => {
    const records = window.__WB_V355_WAKEUPS__ = { listeners: [], intervals: [] };
    const nativeAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      const stack = String(new Error().stack || '');
      const match = stack.match(/([A-Za-z0-9_-]+\.js)(?::\d+:\d+)?/);
      const asset = match?.[1] || '';
      if (asset) {
        records.listeners.push({
          asset,
          type,
          target: this === document ? 'document' : this === window ? 'window' : this?.id || this?.tagName || 'other',
          capture: options === true || Boolean(options && typeof options === 'object' && options.capture)
        });
      }
      return nativeAdd.call(this, type, listener, options);
    };
    const nativeInterval = window.setInterval.bind(window);
    window.setInterval = function(handler, timeout, ...args) {
      const stack = String(new Error().stack || '');
      const match = stack.match(/([A-Za-z0-9_-]+\.js)(?::\d+:\d+)?/);
      records.intervals.push({ asset: match?.[1] || '', timeout: Number(timeout || 0) });
      return nativeInterval(handler, timeout, ...args);
    };
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => Number(window.WORK_BOARD_RELEASE_VERSION) >= 292, undefined, { timeout: 10_000 });

  const snapshot = await page.evaluate(() => ({
    release: window.WORK_BOARD_RELEASE_VERSION,
    listeners: window.__WB_V355_WAKEUPS__.listeners,
    intervals: window.__WB_V355_WAKEUPS__.intervals,
    pickerOpen: Boolean(document.querySelector('.comment-reaction-picker-v165:not([hidden])'))
  }));
  expect(Number(snapshot.release)).toBeGreaterThanOrEqual(292);

  const from = asset => snapshot.listeners.filter(item => item.asset === asset);
  const listSortGlobal = from('list-column-sort-v229.js').filter(item => item.target === 'document' && ['input','change','click','keydown'].includes(item.type));
  expect(listSortGlobal).toEqual([]);

  const savedGlobal = from('saved-views-v148.js').filter(item => item.target === 'document' && ['input','change'].includes(item.type));
  expect(savedGlobal).toEqual([]);

  expect(snapshot.pickerOpen).toBe(false);
  const reactionClosedDocumentClick = from('comment-reactions-v191.js').filter(item => item.target === 'document' && item.type === 'click');
  expect(reactionClosedDocumentClick).toEqual([]);
  const reactionRoot = from('comment-reactions-v191.js').filter(item => item.target === 'detailBody');
  expect(reactionRoot.some(item => item.type === 'click')).toBe(true);
  expect(reactionRoot.some(item => item.type === 'submit')).toBe(true);
  expect(reactionRoot.some(item => item.type === 'keydown')).toBe(true);

  for (const asset of ['dependencies-v149.js','saved-views-v148.js','work-features-v167.js','mobile-shell-v234.js']) {
    expect(snapshot.intervals.filter(item => item.asset === asset), `${asset} must not register an interval`).toEqual([]);
  }
});
