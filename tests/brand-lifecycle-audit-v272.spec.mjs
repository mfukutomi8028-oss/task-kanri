import { test, expect } from '@playwright/test';

const ROOM = 'test-brand-lifecycle-v273';

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

    const sourceOwned = stack => String(stack || '').includes('brand-v185.js');
    const isIconLink = node => {
      if (!node || String(node.tagName || '').toLowerCase() !== 'link') return false;
      const rel = String(node.getAttribute?.('rel') || '');
      return rel.split(/\s+/).includes('icon') || rel === 'shortcut icon' || rel === 'apple-touch-icon';
    };

    const audit = {
      iconAdds: [],
      iconRemoves: [],
      brandMarkWrites: [],
      pageshowRegistrations: 0,
      pageshowCallbacks: 0,
      reset() {
        this.iconAdds.length = 0;
        this.iconRemoves.length = 0;
        this.brandMarkWrites.length = 0;
        this.pageshowCallbacks = 0;
      }
    };
    window.__WB_BRAND_LIFECYCLE_V273__ = audit;

    const nativeAppendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function appendChildAuditV273(child) {
      const stack = new Error().stack;
      if (sourceOwned(stack) && isIconLink(child)) {
        audit.iconAdds.push({
          rel: child.getAttribute('rel') || '',
          href: child.getAttribute('href') || '',
          type: child.getAttribute('type') || '',
          sizes: child.getAttribute('sizes') || '',
          viaApply: String(stack || '').includes('apply')
        });
      }
      return nativeAppendChild.call(this, child);
    };

    const nativeRemove = Element.prototype.remove;
    Element.prototype.remove = function removeAuditV273() {
      const stack = new Error().stack;
      if (sourceOwned(stack) && isIconLink(this)) {
        audit.iconRemoves.push({
          rel: this.getAttribute('rel') || '',
          href: this.getAttribute('href') || '',
          viaApply: String(stack || '').includes('apply')
        });
      }
      return nativeRemove.call(this);
    };

    const nativeSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function setAttributeAuditV273(name, value) {
      const stack = new Error().stack;
      if (
        sourceOwned(stack)
        && String(name).toLowerCase() === 'src'
        && this.matches?.('.brand-mark img')
      ) {
        audit.brandMarkWrites.push({ value: String(value), viaApply: String(stack || '').includes('apply') });
      }
      return nativeSetAttribute.call(this, name, value);
    };

    const nativeAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function addEventListenerAuditV273(type, listener, options) {
      const stack = new Error().stack;
      if (this === window && type === 'pageshow' && sourceOwned(stack) && typeof listener === 'function') {
        audit.pageshowRegistrations += 1;
        const wrapped = function pageshowBrandAuditWrapper(...args) {
          audit.pageshowCallbacks += 1;
          return listener.apply(this, args);
        };
        return nativeAddEventListener.call(this, type, wrapped, options);
      }
      return nativeAddEventListener.call(this, type, listener, options);
    };
  }, ROOM);

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
}

async function boot(page) {
  await installAudit(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.brandVersion === '185', undefined, { timeout: 8_000 });
  await page.waitForTimeout(100);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const audit = window.__WB_BRAND_LIFECYCLE_V273__;
    const icons = [...document.head.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')]
      .map(link => ({
        rel: link.getAttribute('rel') || '',
        href: link.getAttribute('href') || '',
        type: link.getAttribute('type') || '',
        sizes: link.getAttribute('sizes') || ''
      }));
    return {
      iconAdds: audit.iconAdds.slice(),
      iconRemoves: audit.iconRemoves.slice(),
      brandMarkWrites: audit.brandMarkWrites.slice(),
      pageshowRegistrations: audit.pageshowRegistrations,
      pageshowCallbacks: audit.pageshowCallbacks,
      iconState: icons,
      brandMark: document.querySelector('.brand-mark img')?.getAttribute('src') || '',
      notificationBrand: window.Notification?.__workBoardBrandVersion || '',
      release: window.WORK_BOARD_RELEASE?.version || ''
    };
  });
}

function expectCurrentIcons(icons) {
  expect(icons).toHaveLength(4);
  expect(icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ rel: 'icon', href: expect.stringMatching(/assets\/brand-v184\.svg\?v=185$/), type: 'image/svg+xml' }),
    expect.objectContaining({ rel: 'icon', href: expect.stringMatching(/assets\/brand-v184\.png\?v=185$/), type: 'image/png', sizes: '512x512' }),
    expect.objectContaining({ rel: 'shortcut icon', href: expect.stringMatching(/assets\/brand-v184\.png\?v=185$/), type: 'image/png' }),
    expect.objectContaining({ rel: 'apple-touch-icon', href: expect.stringMatching(/assets\/brand-v184\.png\?v=185$/) })
  ]));
}

test('Ver.273+ product: normal startup performs one apply-owned favicon reconstruction', async ({ page }) => {
  await boot(page);
  const state = await snapshot(page);
  console.log('V273_BRAND_STARTUP_METRICS', JSON.stringify(state));

  expect(Number(state.release)).toBeGreaterThanOrEqual(259);
  expect(state.pageshowRegistrations).toBe(1);
  expect(state.iconAdds).toHaveLength(4);
  expect(state.iconAdds.every(item => item.viaApply === true)).toBe(true);
  expect(state.iconRemoves.length).toBeGreaterThan(0);
  expectCurrentIcons(state.iconState);
  expect(state.brandMark).toContain('assets/brand-v184.svg?v=185');
  expect(state.notificationBrand).toBe('185');
});

test('Ver.273 product: no-drift pageshow keeps the current favicon set without DOM churn', async ({ page }) => {
  await boot(page);
  const state = await page.evaluate(async () => {
    const audit = window.__WB_BRAND_LIFECYCLE_V273__;
    const beforeNotification = window.Notification;
    audit.reset();
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    await new Promise(resolve => setTimeout(resolve, 80));
    return {
      iconAdds: audit.iconAdds.length,
      iconRemoves: audit.iconRemoves.length,
      brandMarkWrites: audit.brandMarkWrites.length,
      pageshowCallbacks: audit.pageshowCallbacks,
      notificationSame: window.Notification === beforeNotification,
      notificationBrand: window.Notification?.__workBoardBrandVersion || ''
    };
  });
  console.log('V273_BRAND_PAGESHOW_NODRIFT_METRICS', JSON.stringify(state));

  expect(state.pageshowCallbacks).toBe(1);
  expect(state.iconAdds).toBe(0);
  expect(state.iconRemoves).toBe(0);
  expect(state.brandMarkWrites).toBe(0);
  expect(state.notificationSame).toBe(true);
  expect(state.notificationBrand).toBe('185');
});

test('Ver.273 product: pageshow repairs synthetic brand, favicon and Notification drift', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const audit = window.__WB_BRAND_LIFECYCLE_V273__;
    const brand = document.querySelector('.brand-mark img');
    brand?.setAttribute('src', 'assets/brand.png?v=synthetic-v273');
    const firstIcon = document.head.querySelector('link[rel~="icon"]');
    if (firstIcon) firstIcon.setAttribute('href', 'assets/brand.png?v=synthetic-v273');

    function SyntheticNotification() {}
    SyntheticNotification.requestPermission = async () => 'default';
    Object.defineProperty(SyntheticNotification, 'permission', { configurable: true, get: () => 'default' });
    window.Notification = SyntheticNotification;

    audit.reset();
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    await new Promise(resolve => setTimeout(resolve, 80));

    return {
      iconAdds: audit.iconAdds.length,
      iconRemoves: audit.iconRemoves.length,
      brandMarkWrites: audit.brandMarkWrites.length,
      pageshowCallbacks: audit.pageshowCallbacks,
      brandMark: brand?.getAttribute('src') || '',
      icons: [...document.head.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')]
        .map(link => ({
          rel: link.getAttribute('rel') || '',
          href: link.getAttribute('href') || '',
          type: link.getAttribute('type') || '',
          sizes: link.getAttribute('sizes') || ''
        })),
      notificationBrand: window.Notification?.__workBoardBrandVersion || '',
      notificationRewrapped: window.Notification !== SyntheticNotification
    };
  });
  console.log('V273_BRAND_PAGESHOW_DRIFT_METRICS', JSON.stringify(result));

  expect(result.pageshowCallbacks).toBe(1);
  expect(result.iconAdds).toBe(4);
  expect(result.iconRemoves).toBe(4);
  expect(result.brandMarkWrites).toBe(1);
  expect(result.brandMark).toContain('assets/brand-v184.svg?v=185');
  expectCurrentIcons(result.icons);
  expect(result.notificationBrand).toBe('185');
  expect(result.notificationRewrapped).toBe(true);
});

test('Ver.273 product: normal navigation keeps brand ownership stable without recovery work', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__WB_BRAND_LIFECYCLE_V273__.reset());

  await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
  await expect(page.locator('#boardView')).toBeVisible();
  await page.evaluate(() => document.querySelector('.nav-item[data-layout="today"]')?.click());
  await expect(page.locator('#todayView')).toBeVisible();
  await page.waitForTimeout(80);

  const state = await snapshot(page);
  console.log('V273_BRAND_NAVIGATION_METRICS', JSON.stringify(state));
  expect(state.iconAdds).toHaveLength(0);
  expect(state.iconRemoves).toHaveLength(0);
  expect(state.brandMarkWrites).toHaveLength(0);
  expect(state.pageshowCallbacks).toBe(0);
  expectCurrentIcons(state.iconState);
  expect(state.brandMark).toContain('assets/brand-v184.svg?v=185');
  expect(state.notificationBrand).toBe('185');
});
