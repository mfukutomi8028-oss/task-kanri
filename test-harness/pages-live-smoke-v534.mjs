// Ver.534: read-only public Pages smoke check after deployment.
// Verifies static bytes only; never accesses the user's room or Firebase.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRED = Object.freeze(['index.html', 'release-manifest.js', 'ui-motion-v533.css']);

export function normalizePagesBase(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname) {
    throw new Error('Public Pages verification requires an HTTPS URL.');
  }
  url.search = '';
  url.hash = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function inspectPublishedAsset(baseUrl, relativePath, expected, fetcher = fetch, revision = 'read-only') {
  if (!REQUIRED.includes(relativePath)) throw new Error('Asset not approved for smoke check: ' + relativePath);
  const url = new URL(relativePath, normalizePagesBase(baseUrl));
  url.searchParams.set('deploy_verify', revision);
  const response = await fetcher(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
  });
  const expectedHash = sha256(expected);
  if (!response.ok) {
    return { file: relativePath, ok: false, status: response.status, expectedHash, actualHash: null };
  }
  const actual = Buffer.from(await response.arrayBuffer());
  const actualHash = sha256(actual);
  return { file: relativePath, ok: actualHash === expectedHash, status: response.status, expectedHash, actualHash };
}

export async function verifyPublishedAssets(baseUrl, { attempts = 12, delayMs = 5000, fetcher = fetch, revision = 'read-only' } = {}) {
  normalizePagesBase(baseUrl);
  const expected = await Promise.all(REQUIRED.map(async file => ({
    file, bytes: await fs.readFile(path.join(ROOT, file))
  })));
  let lastResults = [];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    lastResults = await Promise.all(expected.map(async ({ file, bytes }) => {
      try { return await inspectPublishedAsset(baseUrl, file, bytes, fetcher, revision + '-' + attempt); }
      catch (error) { return { file, ok: false, error: String(error.message || error) }; }
    }));
    if (lastResults.every(result => result.ok)) {
      for (const result of lastResults) {
        console.log('PAGES_LIVE_ASSET_OK ' + JSON.stringify({ file: result.file, sha256: result.actualHash }));
      }
      return lastResults;
    }
    console.log('PAGES_LIVE_RETRY ' + JSON.stringify({
      attempt, maxAttempts: attempts, files: lastResults.filter(r => !r.ok).map(r => r.file)
    }));
    if (attempt < attempts) await sleep(delayMs);
  }
  throw new Error('Public Pages files do not match deployed source: ' + JSON.stringify(lastResults));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const baseUrl = process.env.PAGES_BASE_URL;
  if (!baseUrl) {
    console.error('PAGES_BASE_URL must come from the successful GitHub Pages deployment.');
    process.exitCode = 1;
  } else {
    verifyPublishedAssets(baseUrl, { revision: process.env.GITHUB_SHA || 'read-only' })
      .catch(error => { console.error(error); process.exitCode = 1; });
  }
}
