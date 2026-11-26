import test from 'node:test';
import assert from 'node:assert/strict';
import * as draft from './messaging-preview/workspace-messaging-file-draft.js';
const firstId='00000000-0000-4000-8000-000000000001',secondId='00000000-0000-4000-8000-000000000002';
const scope={roomId:'roomA',conversationId:'self_p_'+'a'.repeat(32),requestId:'q_'+'b'.repeat(32)};
const file=(name,text='report')=>new File([text],name);
const good=(name='report.txt')=>draft.selectMessagingFiles([], [file(name)]).files[0];
test('selection derives allowlisted MIME from name and does not trust browser MIME',()=>{
  const png=new File(['binary'],'image.png',{type:'application/octet-stream'}),csv=new File(['a,b'],'table.csv',{type:'application/vnd.ms-excel'});
  const result=draft.selectMessagingFiles([], [png,csv,file('bad.exe'),file('empty.txt',''),file('bad\\name.txt')]);
  assert.deepEqual(result.files.map(x=>[x.filename,x.mime]),[['image.png','image/png'],['table.csv','text/csv']]);assert.equal(result.rejected,3);
});
test('selection preserves previous files and rejects sixth or oversize attachment',()=>{
  const existing=[good('a.txt'),good('b.txt'),good('c.txt'),good('d.txt')],large=new File([new Uint8Array(5000001)],'large.pdf');
  const result=draft.selectMessagingFiles(existing,[large,file('e.txt'),file('f.txt')]);assert.equal(result.files.length,5);assert.equal(result.files[4].filename,'e.txt');assert.equal(result.rejected,2);assert.equal(existing.length,4);
});
test('retry resumes the same request and completed slots without reupload',async()=>{
  const files=[good('a.txt'),good('b.txt')],uploaded=[],calls=[];let failed=true;
  const transport={async uploadAttachment(input){calls.push(input);if(input.slot===1&&failed)return {status:'unavailable'};return {status:'ok',attachmentId:input.slot===0?firstId:secondId,filename:input.filename,mime:input.mime,bytes:input.file.size};}};
  const run=()=>draft.uploadMessagingFiles({files,uploaded,transport,scope,isCurrent:()=>true});
  assert.deepEqual(await run(),{status:'unavailable'});failed=false;assert.deepEqual(await run(),{status:'ok',attachmentIds:[firstId,secondId]});assert.deepEqual(calls.map(c=>[c.requestId,c.slot]),[[scope.requestId,0],[scope.requestId,1],[scope.requestId,1]]);
});
test('identity loss during upload discards the late ID and starts no additional file',async()=>{
  const files=[good('a.txt'),good('b.txt')],uploaded=[];let current=true,calls=0;
  const result=await draft.uploadMessagingFiles({files,uploaded,scope,isCurrent:()=>current,transport:{async uploadAttachment(input){calls++;current=false;return {status:'ok',attachmentId:firstId,filename:input.filename,mime:input.mime,bytes:input.file.size};}}});
  assert.equal(result.status,'locked');assert.equal(calls,1);assert.equal(uploaded.length,0);
});
test('a mismatched upload reply or stale slot cannot become a message reference',async()=>{
  const files=[good('a.txt')],uploaded=[];const input={files,uploaded,scope,isCurrent:()=>true,transport:{async uploadAttachment(req){return {status:'ok',attachmentId:firstId,filename:'different.txt',mime:req.mime,bytes:req.file.size};}}};
  assert.deepEqual(await draft.uploadMessagingFiles(input),{status:'unavailable'});assert.equal(uploaded.length,0);
  uploaded.push({file:good('different.txt').file,attachmentId:firstId});assert.deepEqual(await draft.uploadMessagingFiles(input),{status:'conflict'});
});
