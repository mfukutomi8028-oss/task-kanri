import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
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
    const oldScript = await page.request.get(host() + 'date-keyboard-fix-v127.js');
    expect(oldScript.status()).toBe(200);
    for (const unwanted of ['README.md', 'package.json', 'firebase-rules.json',
      'REGRESSION_TESTS.md', 'test-harness/static-server.mjs']) {
      const excluded = await page.request.get(host() + unwanted);
      expect(excluded.status(), 'developer artifact should not be published: ' + unwanted).toBe(404);
    }
  });
}
