import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { LEGACY_BOOT_IMAGE_URLS_V433, EXTRA_LEGACY_PNG_URLS_V433, PINNED_LEGACY_PNG_BLOBS_V433 } from '../test-harness/legacy-png-contract-v433.mjs';
import { fileURLToPath } from 'node:url';
import { buildPages } from '../test-harness/build-pages-runtime-v382.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, '.pages-runtime');
const PREFIX = '/task-kanri/';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};
let server;
let port;

function serve(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  if (!pathname.startsWith(PREFIX)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const fileName = pathname.slice(PREFIX.length) || 'index.html';
  const full = path.resolve(OUTPUT, fileName);
  if (full !== OUTPUT && !full.startsWith(OUTPUT + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store'
  });
  fs.createReadStream(full).pipe(res);
}

test.beforeAll(async () => {
  buildPages(ROOT, OUTPUT);
  server = http.createServer(serve);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  port = server.address().port;
});

test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  fs.rmSync(OUTPUT, { recursive: true, force: true });
});

function host() {
  return 'http://127.0.0.1:' + port + PREFIX;
}

for (const width of [1366, 390]) {
  test('Ver.383 packaged Pages works under repo subpath (' + width + 'px)', async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.addInitScript(room => {
      localStorage.clear();
      localStorage.setItem('systemTaskRoomId', room);
      localStorage.setItem('systemTaskUser', 'QA');
      Object.defineProperty(window, 'firebaseConfig', {
        configurable: true, get() { return null; }, set() {}
      });
    }, 'packaged-pages-v383-' + width);

    const failures = [];
    const pageErrors = [];
    page.on('response', response => {
      if (response.url().startsWith(host()) && response.status() >= 400) {
        failures.push({ status: response.status(), url: response.url() });
      }
    });
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('**/*', route => {
      const target = new URL(route.request().url());
      if (target.hostname === '127.0.0.1' && Number(target.port) === port) {
        return route.continue();
      }
      return route.abort('blockedbyclient');
    });

    const response = await page.goto(host() + '?room=packaged-pages-v383-' + width,
      { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true,
      undefined, { timeout: 30_000 });
    await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion
      === window.WORK_BOARD_RELEASE?.version);

    const ready = await page.evaluate(() => ({
      version: window.WORK_BOARD_RELEASE?.version,
      brand: document.querySelector('.brand-mark img')?.getAttribute('src'),
      today: document.querySelector('.nav-item[data-layout="today"] .nav-icon img')?.getAttribute('src'),
      width: document.documentElement.scrollWidth
    }));
    expect(ready.version).toBe('304');
    expect(ready.brand).toContain('brand-v184.svg');
    expect(ready.today).toContain('nav-today-v169.svg');
    await expect(page.locator('#todayView')).toBeVisible();

    await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]')?.click());
    await expect(page.locator('#boardView')).toBeVisible();
    await page.evaluate(() => document.querySelector('.nav-item[data-layout="today"]')?.click());
    await expect(page.locator('#todayView')).toBeVisible();

    expect(failures).toEqual([]);
    expect(pageErrors).toEqual([]);
    if (width === 390) {
      expect(ready.width).toBeLessThanOrEqual(width + 2);
    }

    const oldImage = await page.request.get(host() + 'assets/nav-done.png');
    expect(oldImage.status()).toBe(200);
    // Old cached manifests still need their historical CSS URLs under /task-kanri/.
    for (const [legacy, current] of [
      ['activity-dialog-v130.css', 'ui-activity-dialog-v193.css'],
      ['ui-v151.css', 'ui-task-detail-responsive-v192.css']
    ]) {
      const oldCss = await page.request.get(host() + legacy);
      const currentCss = await page.request.get(host() + current);
      expect(oldCss.status()).toBe(200);
      expect(currentCss.status()).toBe(200);
      expect(await oldCss.body()).toEqual(await currentCss.body());
    }
    // Previously shipped script, CSS, and PNG URLs are still byte-for-byte available.
    for (const [legacy, current] of [
      ['user-add-fix-v155.js', 'user-registration-v191.js'],
      ['ui-v156.css', 'ui-comment-mentions-v191.css'],
      ['assets/summary-today.png', 'assets/nav-today-v87.png'],
      ['assets/brand-v184.png', 'assets/brand.png']
    ]) {
      const oldAsset = await page.request.get(host() + legacy);
      const newAsset = await page.request.get(host() + current);
      expect(oldAsset.status(), 'legacy asset missing: ' + legacy).toBe(200);
      expect(newAsset.status()).toBe(200);
      expect(await oldAsset.body()).toEqual(await newAsset.body());
    }
    const frozenMobile = JSON.parse(fs.readFileSync(path.join(ROOT, 'compat/frozen-mobile-scripts-v395.json'), 'utf8'));
    for (const [legacy, historicalSource] of Object.entries(frozenMobile)) {
      const response = await page.request.get(host() + legacy);
      expect(response.status(), 'legacy mobile URL must remain available: ' + legacy).toBe(200);
      expect(await response.body()).toEqual(Buffer.from(historicalSource, 'utf8'));
    }
    const frozenLegacy = JSON.parse(fs.readFileSync(path.join(ROOT, 'compat/frozen-legacy-runtime-v397.json'), 'utf8'));
    for (const [legacy, historicalSource] of Object.entries(frozenLegacy)) {
      const response = await page.request.get(host() + legacy);
      expect(response.status(), 'old JS/CSS URL must remain HTTP 200: ' + legacy).toBe(200);
      expect(await response.body()).toEqual(Buffer.from(historicalSource, 'utf8'));
    }
    const frozenIcons = JSON.parse(fs.readFileSync(path.join(ROOT, 'compat/frozen-icon-css-v400.json'), 'utf8'));
    for (const [legacy, historicalSource] of Object.entries(frozenIcons)) {
      const response = await page.request.get(host() + legacy);
      expect(response.status(), 'old icon CSS URL HTTP 200: ' + legacy).toBe(200);
      expect(await response.body()).toEqual(Buffer.from(historicalSource, 'utf8'));
    }
    const oldScript = await page.request.get(host() + 'date-keyboard-fix-v127.js');
    expect(oldScript.status()).toBe(200);
    for (const unwanted of ['README.md', 'package.json', 'firebase-rules.json',
      'REGRESSION_TESTS.md', 'test-harness/static-server.mjs',
      'compat/frozen-mobile-scripts-v395.json',
      'compat/frozen-legacy-runtime-v397.json',
      'compat/frozen-icon-css-v400.json']) {
      const excluded = await page.request.get(host() + unwanted);
      expect(excluded.status(), 'developer artifact should not be published: ' + unwanted).toBe(404);
    }
  });
}

test('Ver.433 cached-image URLs stay reachable and original under /task-kanri/', async ({ request }) => {
  // Simulates the historical resource URLs, including the old ?v=143 query.
  // This deliberately does not assume that legacy PNGs remain in the Git root.
  const urls = [...LEGACY_BOOT_IMAGE_URLS_V433, ...EXTRA_LEGACY_PNG_URLS_V433];
  const seen = new Set();
  for (const relative of urls) {
    expect(seen.has(relative), 'duplicate historical image contract: ' + relative).toBe(false);
    seen.add(relative);
    const response = await request.get(host() + relative + '?v=143');
    expect(response.status(), 'old image URL failed: ' + relative).toBe(200);
    expect(response.headers()['content-type'], 'wrong MIME at ' + relative).toContain(
      relative.endsWith('.png') ? 'image/png' : 'image/svg+xml'
    );
    const bytes = await response.body();
    expect(bytes.length, 'empty old image: ' + relative).toBeGreaterThan(0);
    if (relative.endsWith('.png')) {
      expect(bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
        'invalid PNG signature: ' + relative).toBe(true);
      const originalSha = PINNED_LEGACY_PNG_BLOBS_V433[relative];
      expect(originalSha, 'missing immutable PNG blob contract: ' + relative).toMatch(/^[0-9a-f]{40}$/);
      const sha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
      expect(sha, 'old image URL does not contain the original bytes: ' + relative).toBe(originalSha);
    }
  }
});

const LEGACY_FIRST_PAINT_PAIRS_V434 = Object.freeze([
  ['assets/brand.png', 'assets/brand-v184.svg'],
  ['assets/nav-today-v87.png', 'assets/nav-today-v169.svg'],
  ['assets/nav-todo-v142.svg', 'assets/nav-todo-v168.svg'],
  ['assets/nav-task-v87.png', 'assets/nav-task-v169.svg'],
  ['assets/nav-schedule-v87.png', 'assets/nav-schedule-v169.svg'],
  ['assets/nav-memo-v167.svg', 'assets/nav-memo-v168.svg'],
  ['assets/summary-mine.png', 'assets/nav-mine-v169.svg'],
  ['assets/nav-star-menu.png', 'assets/nav-star-v169.svg'],
  ['assets/nav-done.png', 'assets/nav-done-v169.svg'],
  ['assets/summary-open.png', 'assets/summary-open-v169.svg'],
  ['assets/summary-overdue.png', 'assets/summary-overdue-v169.svg'],
  ['assets/summary-today.png', 'assets/nav-today-v169.svg']
]);

for (const width of [1366, 390]) {
  test('Ver.434 cached image markup receives current SVG before first-paint release (' + width + 'px)', async ({ page }) => {
    expect(LEGACY_FIRST_PAINT_PAIRS_V434.map(pair => pair[0])).toEqual(LEGACY_BOOT_IMAGE_URLS_V433);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const documentURL = host() + '__legacy-image-boot-v434.html';
    const images = LEGACY_FIRST_PAINT_PAIRS_V434.map(([legacy], index) =>
      '<img data-original="' + legacy + '" alt="legacy-' + index + '" src="' + legacy + '?v=143">').join('');
    const oldMarkup = '<!doctype html><html lang="ja"><head><meta charset="utf-8">' +
      '<script src="release-manifest.js?v=143"></script></head><body>' + images + '</body></html>';
    await page.route(documentURL, route => route.fulfill({
      status: 200, contentType: 'text/html; charset=utf-8', body: oldMarkup
    }));
    const httpFailures = [];
    const errors = [];
    page.on('response', response => {
      if (response.url().startsWith(host()) && response.status() >= 400) {
        httpFailures.push({ status: response.status(), url: response.url() });
      }
    });
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(documentURL, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    await expect(page.locator('img[data-original]')).toHaveCount(12);
    await page.evaluate(() => {
      window.WORK_BOARD_ASSETS_READY = true;
      window.dispatchEvent(new Event('workboard:assets-ready'));
    });
    await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion
      === window.WORK_BOARD_RELEASE?.version, undefined, { timeout: 10_000 });
    expect(await page.evaluate(() => window.WORK_BOARD_RELEASE?.version)).toBe('304');
    const actual = await page.locator('img[data-original]').evaluateAll(nodes =>
      nodes.map(img => ({ legacy: img.getAttribute('data-original'), src: img.getAttribute('src') })));
    expect(actual).toEqual(LEGACY_FIRST_PAINT_PAIRS_V434.map(([legacy, canonical]) =>
      ({ legacy, src: canonical + '?v=304' })));
    expect(httpFailures).toEqual([]);
    expect(errors).toEqual([]);
  });
}
