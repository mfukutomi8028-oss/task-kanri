import test from 'node:test';
import assert from 'node:assert/strict';
import * as storage from '../security/messaging-attachment-storage.mjs';
const roomId='roomA',personId='p_'+'a'.repeat(32),peerId='p_'+'b'.repeat(32),conversationId='dm_'+personId+'_'+peerId,requestId='q_'+'c'.repeat(32),attachmentId='00000000-0000-4000-8000-000000000001';
const data=new TextEncoder().encode('text'),bucket='workboard-attachments-v1',table='workboard_attachments_v1';
const body=()=>new ReadableStream({start(c){c.enqueue(data);c.close();}});
function fixture(){
  const calls=[];let row=null,object=null,active=true;
  const auth={verifyIdToken:async(token,revoke)=>{calls.push(['verify',token,revoke]);return {uid:'uidA'};}};
  const database={ref:path=>({get:async()=>{calls.push(['readFirebase',path]);return {val:()=>path==='messagingAccessV1/'+roomId+'/uidA'?{uid:'uidA',roomId,personId,active,approved:true}:path==='messagingV1/'+roomId+'/control/'+conversationId?{id:conversationId,roomId,status:'active',members:{[personId]:{active:true,joinedAt:1000}}}:null};}})};
  const supabase={rpc:async(name,args)=>{calls.push(['rpc',name,args]);if(name==='workboard_reserve_attachment_v1'){
    row??={attachment_id:attachmentId,room_id:args.p_room_id,conversation_id:args.p_conversation_id,uploader_id:args.p_uploader_id,membership_joined_at:args.p_joined_at,request_id:args.p_request_id,request_slot:args.p_slot,filename:args.p_filename,mime:args.p_mime,declared_bytes:args.p_bytes,state:'reserved',expires_at:new Date(3000).toISOString(),actual_bytes:null,sha256:null};return {data:{status:'ok',attachmentId},error:null};}
    if(name==='workboard_finalize_attachment_v1'){row={...row,state:'ready',actual_bytes:args.p_actual_bytes,sha256:args.p_sha256};return {data:{status:'ok'},error:null};}throw Error('Unexpected RPC');},
    from(name){assert.equal(name,table);return {select(fields){assert.ok(fields.includes('membership_joined_at'));return {eq(field,id){assert.equal(field,'attachment_id');assert.equal(id,attachmentId);return {maybeSingle:async()=>({data:row,error:null})};}};}};},
    storage:{from(name){assert.equal(name,bucket);return {async upload(path,bytes,options){calls.push(['upload',path,options]);assert.equal(path,attachmentId);if(object)return {data:null,error:{statusCode:'409'}};object=bytes.slice();return {data:{path},error:null};},async download(path){calls.push(['download',path]);return {data:new Blob([object]),error:null};}};}}
  };
  const service=storage.createFirebaseSupabaseAttachmentUploadService({auth,database,supabase,clock:()=>2000});
  return {service,calls,get row(){return row;},get object(){return object;},revoke(){active=false;},request:()=>({token:'token',roomId,conversationId,expectedPersonId:personId,requestId,slot:0,filename:'report.txt',mime:'text/plain',declaredBytes:4,body:body()})};
}
test('actual upload orchestration uses current Firebase token and epoch with private immutable Supabase object and atomic RPC',async()=>{
  const f=fixture();assert.deepEqual(await f.service.upload(f.request()),{status:'ok',attachmentId,filename:'report.txt',mime:'text/plain',bytes:4});
  assert.ok(f.calls.filter(x=>x[0]==='verify').every(x=>x[1]==='token'&&x[2]===true));
  const [reserve,finalize]=f.calls.filter(x=>x[0]==='rpc');assert.deepEqual(reserve,['rpc','workboard_reserve_attachment_v1',{p_room_id:roomId,p_conversation_id:conversationId,p_uploader_id:personId,p_joined_at:1000,p_request_id:requestId,p_slot:0,p_filename:'report.txt',p_mime:'text/plain',p_bytes:4}]);
  assert.equal(finalize[1],'workboard_finalize_attachment_v1');assert.equal(finalize[2].p_joined_at,1000);assert.equal(finalize[2].p_attachment_id,attachmentId);assert.equal(finalize[2].p_actual_bytes,4);assert.match(finalize[2].p_sha256,/^[0-9a-f]{64}$/);
  assert.deepEqual(f.calls.find(x=>x[0]==='upload'),['upload',attachmentId,{upsert:false,contentType:'text/plain',cacheControl:'0'}]);assert.deepEqual(f.object,data);assert.equal(f.row.state,'ready');
});
test('revoked Firebase identity cannot reach Supabase storage or ledger',async()=>{
  const f=fixture();f.revoke();assert.deepEqual(await f.service.upload(f.request()),{status:'forbidden'});assert.equal(f.calls.filter(x=>['rpc','upload','download'].includes(x[0])).length,0);
});
