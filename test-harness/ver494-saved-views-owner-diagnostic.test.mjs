// Ver.494: transient read-only Git index audit; remove from final PR.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseGitIndex } from './root-markdown-reference-v426.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OLD = 'saved-views-polling-v334.test.mjs';
const TEXT_EXT = new Set(['.js','.mjs','.cjs','.md','.json','.yaml','.yml','.ts','.tsx','.css','.html','.txt','.ps1','.sh','.svg','.xml']);
test('Ver.494 read-only scan of tracked references to retired Ver.334 Protocol', () => {
  const index = execFileSync('git', ['ls-files', '--stage', '-z'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024
  });
  const sourceEntries = parseGitIndex(index).filter(x =>
    TEXT_EXT.has(path.extname(x.path).toLowerCase()) &&
    x.path !== 'test-harness/' + OLD &&
    x.path !== 'test-harness/ver494-saved-views-owner-diagnostic.test.mjs');
  const owners = [], errors = [];
  for (const entry of sourceEntries) {
    let content;
    try { content = fs.readFileSync(path.join(ROOT, entry.path), 'utf8'); }
    catch (error) { errors.push({source:entry.path,reason:String(error)}); continue; }
    if (content.includes(OLD)) {
      const hits = [];
      content.split(/\r?\n/).forEach((line,i) => {
        if (line.includes(OLD)) hits.push(i + 1);
      });
      owners.push({source:entry.path,lines:hits.slice(0,12)});
    }
  }
  console.log('VER494_SAVED_VIEWS_REF_SCAN', JSON.stringify({
    candidate: OLD, scannedFiles: sourceEntries.length,
    owners, errors
  }));
  assert.equal(errors.length, 0, 'unreadable tracked text requires review');
});
