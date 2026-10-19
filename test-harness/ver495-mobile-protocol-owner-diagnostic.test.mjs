// Ver.495 temporary read-only owner scan; remove before PR merge.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseGitIndex } from './root-markdown-reference-v426.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = [
  'mobile-shell-nav-target-binding-v307.test.mjs',
  'mobile-shell-board-observer-v299.test.mjs'
];
const EXTS = new Set(['.js','.mjs','.cjs','.md','.json','.yaml','.yml','.ts','.tsx','.css','.html','.txt','.ps1','.sh','.svg','.xml']);
test('Ver.495 read-only external owner scan for proposed mobile shell Protocol retirements', () => {
  const index = execFileSync('git',['ls-files','--stage','-z'],{cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024});
  const rows = parseGitIndex(index);
  const sources = rows.filter(item => EXTS.has(path.extname(item.path).toLowerCase()) &&
    !item.path.endsWith('ver495-mobile-protocol-owner-diagnostic.test.mjs') &&
    !TARGETS.some(name => item.path === 'test-harness/' + name));
  const hits=Object.fromEntries(TARGETS.map(name=>[name,[]])),errors=[];
  for (const row of sources) {
    let source;
    try { source=fs.readFileSync(path.join(ROOT,row.path),'utf8'); }
    catch(e){errors.push({path:row.path,message:String(e)});continue}
    for(const name of TARGETS){
      if(source.includes(name)){
        hits[name].push({source:row.path,lines:source.split(/\r?\n/).flatMap((line,i)=>line.includes(name)?[i+1]:[]).slice(0,20)});
      }
    }
  }
  console.log('VER495_OWNER_SCAN',JSON.stringify({targets:TARGETS,scanned:sources.length,refs:hits,errors}));
  assert.equal(errors.length,0,'read errors must be reviewed');
});
