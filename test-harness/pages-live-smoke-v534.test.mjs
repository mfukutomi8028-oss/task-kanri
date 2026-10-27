// Ver.534: read-only public Pages fingerprint verification contracts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inspectPublishedAsset, normalizePagesBase, sha256, verifyPublishedAssets } from './pages-live-smoke-v534.mjs';

test('Ver.534 checks only the public Pages project path and strips query/fragment', () => {
  const base = normalizePagesBase('https://example.github.io/task-kanri?token=ignored#frag');
  assert.equal(base.href, 'https://example.github.io/task-kanri/');
  assert.throws(() => normalizePagesBase('http://example.github.io/task-kanri/'), /HTTPS/);
  assert.throws(() => normalizePagesBase('file:///tmp/'), /HTTPS/);
});

test('Ver.534 checks SHA256 of the fetched public asset without Firebase access', async () => {
  const contents = Buffer.from('verified-public-css');
  let checkedUrl;
  const result = await inspectPublishedAsset(
    'https://example.github.io/task-kanri/',
    'ui-motion-v533.css', contents,
    async url => { checkedUrl = url.toString(); return new Response(contents, { status: 200 }); },
    'test-commit'
  );
  assert.equal(result.ok, true);
  assert.equal(result.actualHash, sha256(contents));
  assert.equal(checkedUrl, 'https://example.github.io/task-kanri/ui-motion-v533.css?deploy_verify=test-commit');
  assert.doesNotMatch(checkedUrl, /room=|firebase|auth/i);
});

test('Ver.534 fails closed on stale or missing public assets', async () => {
  const wanted = Buffer.from('latest');
  const old = await inspectPublishedAsset(
    'https://example.github.io/task-kanri/', 'index.html', wanted,
    async () => new Response('stale', { status: 200 })
  );
  assert.equal(old.ok, false);
  const missing = await inspectPublishedAsset(
    'https://example.github.io/task-kanri/', 'release-manifest.js', wanted,
    async () => new Response('not found', { status: 404 })
  );
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 404);
  await assert.rejects(() => inspectPublishedAsset(
    'https://example.github.io/task-kanri/', 'private-room.json', wanted
  ), /not approved/);
});

test('Ver.534 keeps live check after Pages deploy and reads deployment URL', () => {
  const yaml = fs.readFileSync(fileURLToPath(new URL('../.github/workflows/pages.yml', import.meta.url)), 'utf8');
  assert.match(yaml, /verify-live:\s*\n[\s\S]*?needs:\s*deploy/);
  assert.match(yaml, /PAGES_BASE_URL:\s*\$\{\{\s*needs\.deploy\.outputs\.page_url\s*\}\}/);
  assert.match(yaml, /run: node test-harness\/pages-live-smoke-v534\.mjs/);
});

test('Ver.534 retry changes the request URL so a CDN cannot reuse stale response', async () => {
  const attemptsSeen = [];
  const fakeFetch = async url => {
    const attempt = url.searchParams.get('deploy_verify');
    attemptsSeen.push(attempt);
    const relativeFile = url.pathname.split('/').at(-1);
    const bytes = attempt.endsWith('-1')
      ? 'stale CDN object'
      : fs.readFileSync(fileURLToPath(new URL('../' + relativeFile, import.meta.url)));
    return new Response(bytes, { status: 200 });
  };
  const passed = await verifyPublishedAssets('https://example.github.io/task-kanri/', {
    attempts: 2, delayMs: 0, fetcher: fakeFetch, revision: 'fixed-sha'
  });
  assert.equal(passed.length, 6);
  assert.ok(passed.every(result => result.ok));
  assert.equal(attemptsSeen.filter(s => s === 'fixed-sha-1').length, 6);
  assert.equal(attemptsSeen.filter(s => s === 'fixed-sha-2').length, 6);
});

test('Ver.536 verifies deployed SIGNAL CSS, preferences and app.js without accessing room data', async () => {
  const files = ['app.js', 'ui-design-d3l-v535.css', 'ui-preferences-v536.js'];
  const seen = [];
  for (const file of files) {
    const bytes = fs.readFileSync(fileURLToPath(new URL('../' + file, import.meta.url)));
    const checked = await inspectPublishedAsset(
      'https://example.github.io/task-kanri/', file, bytes,
      async url => { seen.push(url.toString()); return new Response(bytes, { status: 200 }); },
      'main-verified'
    );
    assert.equal(checked.ok, true, file);
    assert.equal(checked.actualHash, sha256(bytes));
    const stale = await inspectPublishedAsset(
      'https://example.github.io/task-kanri/', file, bytes,
      async () => new Response('outdated', { status: 200 })
    );
    assert.equal(stale.ok, false, 'outdated public file must fail: ' + file);
  }
  assert.deepEqual(
    seen,
    files.map(file => 'https://example.github.io/task-kanri/' + file + '?deploy_verify=main-verified')
  );
  assert.ok(seen.every(url => !/room=|firebase|auth/i.test(url)));
});
