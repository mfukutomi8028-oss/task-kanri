// Operator CLIs must end with a clear error when the database does not answer,
// instead of waiting forever (seen as a 30 s child-process kill in review 4).
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const listening=port=>new Promise(resolve=>{const s=net.connect({host:'127.0.0.1',port},()=>{s.destroy();resolve(true);});s.on('error',()=>resolve(false));});
const cli=name=>fileURLToPath(new URL('../security/'+name,import.meta.url));
function run(file,args,env){
  return new Promise(resolve=>{const started=Date.now();
    execFile(process.execPath,[file,...args],{encoding:'utf8',timeout:20000,windowsHide:true,env:{...process.env,...env}},(error,stdout,stderr)=>resolve({code:error?.code??0,killed:Boolean(error?.killed),stdout,stderr,ms:Date.now()-started}));});
}
// A loopback port with nothing behind it stands in for an unresponsive database.
const unreachable={FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9098',FIREBASE_DATABASE_EMULATOR_HOST:'127.0.0.1:9002',WORKBOARD_ADMIN_DEADLINE_MS:'3000'};
test('the directory maintenance CLI stops with a clear error when the database does not answer',async t=>{
  if(await listening(9002)||await listening(9098))return t.skip('a local emulator is running on the test ports');
  const result=await run(cli('messaging-directory-admin.mjs'),['--project','demo-task-kanri-messaging','--room','syntheticDeadline','--emulator','--conversation','group_g_'+'1'.repeat(32),'--apply'],unreachable);
  assert.equal(result.killed,false,'the CLI must end by itself');
  assert.equal(result.code,1);
  assert.match(result.stderr,/did not respond within 3 s/);
  assert.equal(result.stdout,'');
  assert.ok(result.ms<15000,'ended after '+result.ms+' ms');
});
test('the deadline accepts only a bounded value',async()=>{
  const {adminDeadlineMs}=await import('../security/messaging-admin-deadline.mjs');
  assert.equal(adminDeadlineMs({}),20000);
  assert.equal(adminDeadlineMs({WORKBOARD_ADMIN_DEADLINE_MS:'3000'}),3000);
  for(const bad of ['0','999','600001','abc','1e4'])assert.equal(adminDeadlineMs({WORKBOARD_ADMIN_DEADLINE_MS:bad}),20000);
});
