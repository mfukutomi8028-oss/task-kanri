// Starts the real Edge entry (security/supabase/workboard-messaging/index.ts)
// with Deno on loopback and checks that it boots and fails closed: disabled or
// incomplete configuration answers 503 {status:'unavailable'} without any
// Firebase/Supabase credential. Synthetic environment only; no network target.
// Usage: node test-harness/edge-boot-smoke.mjs [deno executable] [--cached-only]
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const deno=process.argv[2]&&!process.argv[2].startsWith('--')?process.argv[2]:(process.env.DENO_BIN||'deno');
const cachedOnly=process.argv.includes('--cached-only');
const entry=fileURLToPath(new URL('../security/supabase/workboard-messaging/index.ts',import.meta.url));
const port=18000+Math.floor(Math.random()*1000);
const scenarios=[
  {name:'disabled',env:{}},
  {name:'enabled with incomplete configuration',env:{WORKBOARD_MESSAGING_ENABLED:'true',WORKBOARD_FIREBASE_SERVICE_ACCOUNT_JSON:'{"type":"not-a-service-account"}'}},
  {name:'record links requested without configuration',env:{WORKBOARD_MESSAGING_ENABLED:'true',WORKBOARD_MESSAGING_RECORD_LINKS_ENABLED:'true'}}
];
const clean=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^(WORKBOARD_|SUPABASE_|FIREBASE_|GOOGLE_)/.test(k)));
async function scenario({name,env}){
  const child=spawn(deno,['run',...(cachedOnly?['--cached-only']:[]),'--no-lock','--node-modules-dir=none','--no-prompt','--allow-env',`--allow-net=127.0.0.1:${port}`,'--allow-read',entry],
    {env:{...clean,...env,DENO_SERVE_ADDRESS:'tcp:127.0.0.1:'+port},stdio:['ignore','pipe','pipe'],windowsHide:true});
  let output='';child.stdout.on('data',d=>{output+=d;});child.stderr.on('data',d=>{output+=d;});
  try{
    const started=Date.now();let response=null;
    while(Date.now()-started<120000){
      if(child.exitCode!==null)throw new Error(name+': Deno exited '+child.exitCode+'\n'+output.slice(-2000));
      try{response=await fetch('http://127.0.0.1:'+port+'/',{method:'POST',headers:{Origin:'https://board.example.test','Content-Type':'application/json'},body:'{}'});break;}
      catch(_){await new Promise(r=>setTimeout(r,500));}
    }
    assert.ok(response,name+': the entry did not start listening\n'+output.slice(-2000));
    assert.equal(response.status,503,name);
    assert.deepEqual(await response.json(),{status:'unavailable'},name);
    assert.equal(response.headers.get('Cache-Control'),'no-store',name);
    assert.equal(/BEGIN PRIVATE KEY|service_account/.test(output),false,name+': configuration leaked to logs');
    console.log('EDGE_BOOT_SMOKE_OK '+name);
  }finally{child.kill();}
}
for(const item of scenarios)await scenario(item);
