import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function asyncBlock(source, name, nextName) {
  const start = source.indexOf(`async function ${name}`);
  const normalEnd = source.indexOf(`\n  function ${nextName}`, start);
  const asyncEnd = source.indexOf(`\n  async function ${nextName}`, start);
  const ends = [normalEnd, asyncEnd].filter(index => index > start);
  const end = ends.length ? Math.min(...ends) : -1;
  assert.ok(start >= 0 && end > start, `${name} block must exist`);
  return source.slice(start, end);
}

test('Ver.257 audit remains valid in Ver.252 or later product releases', () => {
  const match = read('release-manifest.js').match(/const VERSION = '(\d+)'/);
  assert.ok(match && Number(match[1]) >= 252);
});

test('retry generation advances only when module import itself fails', () => {
  const block = asyncBlock(read('comment-reactions-v191.js'), 'firebase', 'showMessage');
  const importCatch = block.indexOf('} catch (error) {\n        if (firebaseImportRetry === importRetry) firebaseImportRetry += 1');
  const initializeApp = block.indexOf('appModule.initializeApp(window.firebaseConfig)');
  const getDatabase = block.indexOf('databaseModule.getDatabase(app)');
  assert.ok(importCatch >= 0 && initializeApp > importCatch && getDatabase > initializeApp,
    'initializeApp/getDatabase must stay outside the import-failure generation catch');
  const afterInitialize = block.slice(initializeApp);
  assert.doesNotMatch(afterInitialize, /firebaseImportRetry\s*\+=\s*1/);
});

test('initialization failure releases only the shared pending promise for same-module retry', () => {
  const block = asyncBlock(read('comment-reactions-v191.js'), 'firebase', 'showMessage');
  assert.match(block, /if \(firebasePromise === pending\) firebasePromise = null/);
  assert.match(block, /const retrySuffix = importRetry > 0 \? `\?wb-retry=\$\{importRetry\}` : ""/);
});
