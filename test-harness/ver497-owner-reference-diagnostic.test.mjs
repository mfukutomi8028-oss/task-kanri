// Ver.497 temporary read-only Git-index ownership scan; remove before final PR.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseGitIndex } from './root-markdown-reference-v426.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANDIDATES = Object.freeze([
  'completion-unpin-polling-v330.test.mjs',
  'mobile-shell-navigation-handoff-v305.test.mjs',
  'mobile-shell-resize-scope-v295.test.mjs',
  'task-dialog-ui-v320.test.mjs'
]);
const EXT = new Set(['.js','.mjs','.cjs','.md','.json','.yaml','.yml','.ts','.tsx','.css','.html','.txt','.ps1','.sh','.svg','.xml']);
test('Ver.497 read-only literal reference owners for candidate Protocol suites', () => {
  const gitIndex = execFileSync('git', ['ls-files','--stage','-z'], {cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024});
  const source = parseGitIndex(gitIndex).filter(row=>EXT.has(path.extname(row.path).toLowerCase()) &&
    row.path !== 'test-harness/ver497-owner-reference-diagnostic.test.mjs' &&
    !CANDIDATES.some(name => row.path === 'test-harness/' + name));
  const hits = Object.fromEntries(CANDIDATES.map(name=>[name,[]]));
  const errors = [];
  for (const row of source) {
    let contents;
    try { contents=fs.readFileSync(path.join(ROOT,row.path),'utf8'); }
    catch (error) { errors.push({source:row.path,error:String(error)}); continue; }
    for (const name of CANDIDATES) {
      if (contents.includes(name)) {
        const numbers = contents.split(/\r?\n/).flatMap((line,i)=>line.includes(name)?[i+1]:[]);
        hits[name].push({source:row.path,lines:numbers.slice(0,12)});
      }
    }
  }
  console.log('VER497_OWNER_SCAN', JSON.stringify({scanned:source.length, hits, readErrors:errors}));
  assert.equal(errors.length,0,'unreadable tracked text cannot be interpreted as no references');
});
