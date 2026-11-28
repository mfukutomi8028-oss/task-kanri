// Exercise the shipped CLI and actual Admin SDK against loopback emulators only.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getDatabase} from 'firebase-admin/database';
import {deviceAdminProject} from '../security/messaging-device-admin.mjs';
const projectId='demo-task-kanri-messaging';
const project=deviceAdminProject(projectId,true,process.env);
const app=initializeApp(project,'messaging-directory-maintenance-demo');
const db=getDatabase(app),roomId='syntheticDirectoryMaintenance',otherRoom='syntheticDirectoryMaintenanceOther';
const root=db.ref('messagingV1/'+roomId),otherRoot=db.ref('messagingV1/'+otherRoom);
const a='p_'+'1'.repeat(32),b='p_'+'2'.repeat(32),g1='group_g_'+'1'.repeat(32),g2='group_g_'+'2'.repeat(32),missing='group_g_'+'3'.repeat(32);
const controls={
  [g1]:{id:g1,roomId,kind:'group',status:'active',title:'Synthetic first',ownerId:a,revision:3,createdAt:1000,updatedAt:3000,members:{[a]:{active:true,role:'owner',joinedAt:1000},[b]:{active:false,role:'member',joinedAt:2000,leftAt:3000}}},
  [g2]:{id:g2,roomId,kind:'group',status:'active',title:'Synthetic second',ownerId:a,revision:1,createdAt:1000,updatedAt:1000,members:{[a]:{active:true,role:'owner',joinedAt:1000}},invites:{[b]:{state:'pending',invitedBy:a,invitedAt:1000}}}
};
const initial={control:controls,directoryIndex:{[b]:{[g1]:{revision:2,state:'member'}}}};
const sentinel={control:{[g1]:{...controls[g1],roomId:otherRoom}}};
const cli=fileURLToPath(new URL('../security/messaging-directory-admin.mjs',import.meta.url)),run=promisify(execFile);
// The CLI ends by itself within its own deadline (WORKBOARD_ADMIN_DEADLINE_MS,
// 20 s by default); the harness timeout is only a backstop. A failure names the
// call, its duration and stderr so a stalled emulator is distinguishable.
async function invoke(...args){
  const started=Date.now();
  try{
    const {stdout}=await run(process.execPath,[cli,'--project',projectId,'--room',roomId,'--emulator',...args],{encoding:'utf8',timeout:45000,maxBuffer:65536,windowsHide:true});
    return JSON.parse(stdout.trim());
  }catch(error){
    error.message='Directory CLI '+args.join(' ')+' failed after '+(Date.now()-started)+' ms (killed='+Boolean(error.killed)+', exit='+error.code+'): '+String(error.stderr||'').trim()+'\n'+error.message;
    throw error;
  }
}
const expected={projectId,roomId};
let ownsRoom=false,ownsOther=false;
try{
  assert.equal((await root.get()).exists(),false,'test room must be empty');
  assert.equal((await otherRoot.get()).exists(),false,'other test room must be empty');
  ownsRoom=true;await root.set(initial);
  ownsOther=true;await otherRoot.set(sentinel);
  assert.deepEqual(await invoke('--limit','1'),{...expected,status:'ok',mode:'dry-run',processed:0,candidates:[g1],hasMore:true,nextCursor:g1});
  assert.deepEqual((await root.get()).val(),initial,'dry-run changed data');
  assert.deepEqual(await invoke('--limit','1','--apply'),{...expected,status:'ok',mode:'apply',processed:1,failed:[],hasMore:true,nextCursor:g1});
  assert.deepEqual((await root.child('directoryIndex').get()).val(),{[a]:{[g1]:{revision:3,state:'member'}},[b]:{[g1]:{revision:3,state:'inactive'}}});
  assert.deepEqual(await invoke('--after',g1,'--limit','1','--apply'),{...expected,status:'ok',mode:'apply',processed:1,failed:[],hasMore:false,nextCursor:null});
  const indexes={[a]:{[g1]:{revision:3,state:'member'},[g2]:{revision:1,state:'member'}},[b]:{[g1]:{revision:3,state:'inactive'},[g2]:{revision:1,state:'pending'}}};
  assert.deepEqual((await root.child('directoryIndex').get()).val(),indexes);
  assert.deepEqual(await invoke('--conversation',g1,'--apply'),{...expected,status:'ok',mode:'apply',revision:3,rows:2});
  await assert.rejects(()=>invoke('--conversation',missing,'--apply'),error=>error.code===1&&JSON.parse(error.stdout.trim()).status==='unavailable');
  assert.deepEqual((await root.get()).val(),{control:controls,directoryIndex:indexes},'canonical data or repaired indexes changed');
  assert.deepEqual((await otherRoot.get()).val(),sentinel,'other room changed');
  console.log('Messaging directory maintenance: real isolated CLI, dry-run, pagination, repair, retry and room isolation checks passed.');
}finally{
  try{
    if(ownsRoom){await root.remove();assert.equal((await root.get()).exists(),false);}
    if(ownsOther){await otherRoot.remove();assert.equal((await otherRoot.get()).exists(),false);}
  }finally{await deleteApp(app);}
}
