// Ver.534: read-only public Pages fingerprint verification contracts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inspectPublishedAsset, normalizePagesBase, sha256 } from './pages-live-smoke-v534.mjs';

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
