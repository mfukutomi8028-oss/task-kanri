import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDirectoryAdminArgs,runDirectoryAdmin} from '../security/messaging-directory-admin.mjs';
const project='task-kanri-2ad16',roomId='roomA',a='group_g_'+'a'.repeat(32),b='group_g_'+'b'.repeat(32);
const args=['--project',project,'--room',roomId];
test('explicit project, room and bounded mutually exclusive scope are mandatory',()=>{
  assert.deepEqual(parseDirectoryAdminArgs(args),{projectId:project,emulator:false,apply:false,scope:{roomId,after:null,limit:50}});
  assert.deepEqual(parseDirectoryAdminArgs([...args,'--conversation',a,'--apply']).scope,{roomId,conversationId:a});
  for(const bad of [[],['--project','other','--room',roomId],[...args,'--room','other'],[...args,'--limit','51'],[...args,'--limit','1e1'],[...args,'--after','bad'],[...args,'--conversation',a,'--limit','1'],['--project',project,'--room','a/b'],[...args,'--emulator']])assert.throws(()=>parseDirectoryAdminArgs(bad));
});
test('dry-run returns bounded canonical IDs without calling a repair method',async()=>{
  const options=parseDirectoryAdminArgs([...args,'--limit','1']);
  const result=await runDirectoryAdmin(options,{readPage:async scope=>{assert.deepEqual(scope,{roomId,after:null,limit:2});return [a,b];},readOne:async()=>{throw Error('unexpected');},index:{reconcile(){throw Error('unexpected write');},reconcilePage(){throw Error('unexpected write');}}});
  assert.deepEqual(result,{status:'ok',mode:'dry-run',processed:0,candidates:[a],hasMore:true,nextCursor:a});
});
test('dry-run refuses malformed or unsorted discovery and missing canonical records',async()=>{
  const index={reconcile(){throw Error('unexpected write');},reconcilePage(){throw Error('unexpected write');}};
  for(const ids of [[b,a],['bad'],[a,a]])assert.deepEqual(await runDirectoryAdmin(parseDirectoryAdminArgs(args),{index,readPage:async()=>ids,readOne:async()=>false}),{status:'unavailable',mode:'dry-run'});
  assert.deepEqual(await runDirectoryAdmin(parseDirectoryAdminArgs([...args,'--conversation',a]),{index,readPage:async()=>[],readOne:async()=>false}),{status:'unavailable',mode:'dry-run'});
});
test('apply uses existing reconciler, retaining failure IDs and cursor for retry',async()=>{
  const index={async reconcilePage(scope){assert.deepEqual(scope,{roomId,after:null,limit:1});return {status:'partial',processed:1,failed:[a],hasMore:true,nextCursor:a};},async reconcile(scope){assert.deepEqual(scope,{roomId,conversationId:a});return {status:'ok',revision:2,rows:2};}};
  const unavailable=async()=>{throw Error('unexpected preview');};
  assert.deepEqual(await runDirectoryAdmin(parseDirectoryAdminArgs([...args,'--apply','--limit','1']),{index,readPage:unavailable,readOne:unavailable}),{status:'partial',processed:1,failed:[a],hasMore:true,nextCursor:a,mode:'apply'});
  assert.deepEqual(await runDirectoryAdmin(parseDirectoryAdminArgs([...args,'--apply','--conversation',a]),{index,readPage:unavailable,readOne:unavailable}),{status:'ok',revision:2,rows:2,mode:'apply'});
});
