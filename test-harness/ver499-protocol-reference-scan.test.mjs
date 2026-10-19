// Ver.499 temporary, read-only Git-index audit. Remove before merge.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseGitIndex } from './root-markdown-reference-v426.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const CANDIDATES=[
  'mobile-shell-resize-responsibility-v297.test.mjs',
  'comment-notification-fallback-v259.test.mjs',
  'task-dialog-ui-v320.test.mjs'
];
const EXT=new Set(['.js','.mjs','.cjs','.md','.json','.yaml','.yml','.ts','.tsx','.css','.html','.txt','.ps1','.sh','.svg','.xml']);
test('Ver.499 tracked source owner references to proposed retired suites',()=>{
 const raw=execFileSync('git',['ls-files','--stage','-z'],{cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024});
 const rows=parseGitIndex(raw).filter(x=>EXT.has(path.extname(x.path).toLowerCase()) &&
 x.path!=='test-harness/ver499-protocol-reference-scan.test.mjs' &&
 !CANDIDATES.some(name=>x.path==='test-harness/'+name));
 const refs=Object.fromEntries(CANDIDATES.map(x=>[x,[]])),errors=[];
 for(const row of rows){
  let text;
  try{text=fs.readFileSync(path.join(ROOT,row.path),'utf8');}
  catch(error){errors.push({path:row.path,reason:String(error)});continue;}
  for(const c of CANDIDATES){
   if(text.includes(c))refs[c].push({path:row.path,lines:text.split(/\r?\n/).flatMap((s,i)=>s.includes(c)?[i+1]:[])});
  }
 }
 console.log('VER499_REF_SCAN',JSON.stringify({scanned:rows.length,refs,errors}));
 assert.equal(errors.length,0,'read errors cannot be interpreted as no references');
});
