// Ver.500 temporary read-only Protocol owner scan. Do not merge this diagnostic.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseGitIndex } from './root-markdown-reference-v426.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAMES = ['comment-reaction-offline-v253.test.mjs', 'reaction-reconnect-v254.test.mjs'];
const EXTS = new Set(['.js','.mjs','.cjs','.md','.json','.yaml','.yml','.ts','.tsx','.css','.html','.txt','.ps1','.sh','.svg','.xml']);
test('Ver.500 tracked references to reaction Protocol candidates are classified', () => {
  const entries=parseGitIndex(execFileSync('git',['ls-files','--stage','-z'],{cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024}));
  const sources=entries.filter(e=>EXTS.has(path.extname(e.path).toLowerCase()) &&
    !e.path.endsWith('ver500-reaction-owner-diagnostic.test.mjs') &&
    !NAMES.some(n=>e.path==='test-harness/'+n));
  const references=Object.fromEntries(NAMES.map(n=>[n,[]])),errors=[];
  for (const entry of sources) {
    let content;
    try {content=fs.readFileSync(path.join(ROOT,entry.path),'utf8');}
    catch(e){errors.push({path:entry.path,error:String(e)});continue;}
    for(const name of NAMES){
      if(content.includes(name))references[name].push({path:entry.path,lines:content.split(/\r?\n/).flatMap((line,i)=>line.includes(name)?[i+1]:[]).slice(0,12)});
    }
  }
  console.log('VER500_OWNER_SCAN',JSON.stringify({scanned:sources.length,references,errors}));
  assert.equal(errors.length,0);
});
