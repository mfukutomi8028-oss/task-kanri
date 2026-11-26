import test from 'node:test';
import assert from 'node:assert/strict';
import * as boundary from '../security/messaging-attachment-http.mjs';
const p='p_'+'a'.repeat(32), roomId='roomA', conversationId='self_'+p, requestId='q_'+'b'.repeat(32), messageId='msg_'+p+'_'+requestId, attachmentId='00000000-0000-4000-8000-000000000001';
const origin='https://board.example.test',endpoint='https://api.example.test/messaging',token='synthetic-id-token',bytes=new TextEncoder().encode('report'),filename='\u5831\u544a.txt';
const meta={expectedPersonId:p,roomId,conversationId,requestId,slot:0,filename,mime:'text/plain',declaredBytes:bytes.length};
const payload={roomId,conversationId,messageId,attachmentId};
function fixture(){
  const calls=[];
  const attachments={async upload(input){const actual=new Uint8Array(await new Response(input.body).arrayBuffer());calls.push(['upload',{...input,body:undefined},actual]);return input.token===token?{status:'ok',attachmentId,filename,mime:'text/plain',bytes:actual.length}:{status:'forbidden'};},async download(input){calls.push(['download',input]);return input.token===token?{status:'ok',filename,mime:'text/plain',bytes}:{status:'forbidden'};}};
  const headers=new Headers({'Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'X-Content-Type-Options':'nosniff'});
  const json=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json',...Object.fromEntries(headers)}});
  const http=boundary.createMessagingAttachmentHttp({attachments});
  return {http,calls,headers,json,attachments};
}
const req=(metadata=meta,body=bytes,extra={})=>new Request(endpoint,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Workboard-Upload':encodeURIComponent(JSON.stringify(metadata)),...extra},body});
test('bounded upload metadata and binary stream are passed to the authenticated service',async()=>{
  const f=fixture(),response=await f.http.upload(req(),token,f.json);
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'ok',attachmentId,filename,mime:'text/plain',bytes:6});
  assert.deepEqual(f.calls,[['upload',{...meta,token,body:undefined},bytes]]);
});
test('malformed, forged or oversized upload metadata is rejected without service calls',async()=>{
  const f=fixture();for(const metadata of [{...meta,token:'forged'},{...meta,expectedPersonId:'staff'},{...meta,declaredBytes:5000001},{...meta,slot:5},{...meta,roomId:'a/b'},{...meta,filename:'x'.repeat(201)},{...meta,extra:1}])assert.ok((await f.http.upload(req(metadata),token,f.json)).status>=400);
  assert.equal((await f.http.upload(req(meta,bytes,{'Content-Length':'7'}),token,f.json)).status,400);
  assert.equal((await f.http.upload(req(meta,bytes,{'X-Workboard-Upload':'%xx'}),token,f.json)).status,400);
  assert.deepEqual(f.calls,[]);
});
test('authorized file response is binary, noncacheable, download-only, and has encoded Japanese filename',async()=>{
  const f=fixture(),response=await f.http.download({...payload,expectedPersonId:p,token},f.headers,f.json);
  assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'application/octet-stream');assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');assert.match(response.headers.get('Content-Disposition'),/^attachment;/);assert.equal(decodeURIComponent(response.headers.get('X-Workboard-Filename')),filename);assert.equal(response.headers.get('X-Workboard-Mime'),'text/plain');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);
});
test('denial and unexpected file result return JSON, not bytes or credentials',async()=>{
  const f=fixture();const denied=await f.http.download({...payload,expectedPersonId:p,token:'bad'},f.headers,f.json);assert.equal(denied.status,403);assert.deepEqual(await denied.json(),{status:'forbidden'});
  f.attachments.download=async()=>({status:'ok',filename:'x\r\ny',mime:'text/plain',bytes});const bad=await f.http.download({...payload,expectedPersonId:p,token},f.headers,f.json);assert.equal(bad.status,503);assert.deepEqual(await bad.json(),{status:'unavailable'});
});

import {createMessagingApiHandler} from '../security/messaging-api-handler.mjs';
import {createMessagingApiTransport} from '../workspace-messaging-api.js';
function integration({enabled=true,fetchOverride}={}){
  const f=fixture(),fallback=async()=>({status:'ok'});
  const handler=createMessagingApiHandler({allowedOrigins:[origin],history:{readHistory:fallback},mutation:{mutate:fallback},directory:{readDirectory:fallback,readUnread:fallback},conversations:{readPeople:fallback,execute:fallback},...(enabled?{attachments:f.attachments}:{})});
  let identity={status:'bound',roomId,personId:p},listener;
  const session={getSnapshot:()=>identity,subscribe(fn){listener=fn;fn(identity);return ()=>{listener=null;};}};
  const fetchImpl=(url,init)=>{const headers=new Headers(init.headers);headers.set('Origin',origin);return handler(new Request(url,{...init,headers}));};
  const api=createMessagingApiTransport({endpoint,session,getToken:async()=>token,fetchImpl:fetchOverride?((url,init)=>fetchOverride(url,init,fetchImpl)):fetchImpl});
  return {...f,handler,api,lock(){identity={status:'locked'};listener?.(identity);}};
}
const uploadInput=()=>({roomId,conversationId,requestId,slot:0,filename,mime:'text/plain',file:new Blob([bytes])});
test('browser transport uploads and downloads through the existing authenticated HTTP boundary',async()=>{
  const f=integration();try{
    assert.deepEqual(await f.api.uploadAttachment(uploadInput()),{status:'ok',attachmentId,filename,mime:'text/plain',bytes:6});
    assert.deepEqual(await f.api.downloadAttachment(payload),{status:'ok',filename,mime:'text/plain',bytes});
    assert.equal(f.calls.length,2);assert.equal(f.calls[0][1].token,token);assert.equal(f.calls[1][1].expectedPersonId,p);
  }finally{f.api.dispose();}
});
test('CORS preflight permits the upload metadata only when attachment services are configured',async()=>{
  for(const enabled of [false,true]){const f=integration({enabled});try{const response=await f.handler(new Request(endpoint,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type,x-workboard-upload'}}));assert.equal(response.status,enabled?204:403);}finally{f.api.dispose();}}
});
test('invalid origin, missing bearer and forged JSON identity cannot reach attachments',async()=>{
  const f=integration();try{for(const request of [req(meta,bytes,{Origin:'https://other.test',Authorization:'Bearer '+token}),req(meta,bytes,{Origin:origin}),new Request(endpoint,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'attachmentDownload',expectedPersonId:p,payload:{...payload,token:'forged'}})})])assert.ok((await f.handler(request)).status>=400);assert.deepEqual(f.calls,[]);}finally{f.api.dispose();}
});
test('late attachment download cannot return bytes after switching user',async()=>{
  let release,start;const pending=new Promise(r=>release=r),started=new Promise(r=>start=r);const f=integration({fetchOverride:async(url,init,send)=>{start(init.signal);await pending;return send(url,init);}});
  try{const download=f.api.downloadAttachment(payload),signal=await started;f.lock();assert.equal(signal.aborted,true);release();assert.deepEqual(await download,{status:'locked'});}finally{f.api.dispose();}
});
test('oversized upload or malformed binary download is rejected by browser transport',async()=>{
  const f=integration({fetchOverride:async()=>new Response(bytes,{status:200,headers:{'Content-Type':'application/octet-stream','Content-Length':'5000001','X-Workboard-Filename':'report.txt','X-Workboard-Mime':'text/plain'}})});
  try{assert.deepEqual(await f.api.uploadAttachment({...uploadInput(),file:new Blob([new Uint8Array(5000001)])}),{status:'invalid'});assert.deepEqual(await f.api.downloadAttachment(payload),{status:'unavailable'});}finally{f.api.dispose();}
});
