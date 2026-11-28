import test from 'node:test';
import assert from 'node:assert/strict';
import * as draft from '../workspace-messaging-file-draft.js';
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
function stubImages({sizes,type='image/png',width=4000,height=3000,failBitmap=false}={}){
  const calls={bitmap:0,encoded:[],closed:0};let n=0;
  globalThis.createImageBitmap=async()=>{calls.bitmap++;if(failBitmap)throw new Error('decode');return {width,height,close(){calls.closed++;}};};
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){}}),toBlob(cb,mime){const canvas=this;calls.encoded.push([canvas.width,canvas.height,mime]);const size=sizes[Math.min(n++,sizes.length-1)];cb(new Blob([new Uint8Array(size)],{type:mime===type?type:mime}));}})};
  return calls;
}
const pick=(name,bytes=1200000)=>draft.selectMessagingFiles([],[new File([new Uint8Array(bytes)],name)]).files;
test('image selection is re-encoded once at selection time and the result is stable for retries',async()=>{
  const calls=stubImages({sizes:[900000,400000]});
  const result=await draft.prepareMessagingFiles(pick('shot.png'),{isCurrent:()=>true});
  assert.equal(result.status,'ok');assert.equal(calls.bitmap,1);assert.equal(calls.closed,1);
  assert.deepEqual(calls.encoded.map(x=>x[0]),[2048,1600]);assert.ok(result.files[0].file.size<=500000);
  const uploaded=[],seen=[];const transport={async uploadAttachment(i){seen.push(i.file);return {status:'ok',attachmentId:firstId,filename:i.filename,mime:i.mime,bytes:i.file.size};}};
  await draft.uploadMessagingFiles({files:result.files,uploaded,transport,scope,isCurrent:()=>true});
  assert.equal(seen[0],result.files[0].file);assert.equal(calls.bitmap,1);
});
test('screenshots are never shrunk below 1600px and the byte target is not a hard limit',async()=>{
  const calls=stubImages({sizes:[3000000]});
  const result=await draft.prepareMessagingFiles(pick('shot.png'),{isCurrent:()=>true});
  assert.equal(result.status,'ok');assert.equal(calls.encoded.at(-1)[0],1600);assert.equal(result.files[0].file.size,3000000);
});
test('original images are kept only by explicit choice and other files are never touched',async()=>{
  const calls=stubImages({sizes:[1]});const files=[...pick('photo.jpg'),...pick('doc.pdf')];
  const result=await draft.prepareMessagingFiles(files,{keepOriginalImages:true,isCurrent:()=>true});
  assert.deepEqual(result.files,files);assert.equal(calls.bitmap,0);
  assert.deepEqual((await draft.prepareMessagingFiles(pick('doc.pdf'),{isCurrent:()=>true})).files.map(x=>x.filename),['doc.pdf']);
});
test('failed compression never falls back to the original',async()=>{
  stubImages({sizes:[1],failBitmap:true});
  assert.deepEqual(await draft.prepareMessagingFiles(pick('photo.jpg'),{isCurrent:()=>true}),{status:'image-preparation-failed'});
});
test('losing the context mid-compression yields locked and no files',async()=>{
  stubImages({sizes:[1]});let ok=true;globalThis.createImageBitmap=async()=>{ok=false;return {width:10,height:10,close(){}};};
  assert.deepEqual(await draft.prepareMessagingFiles(pick('photo.jpg'),{isCurrent:()=>ok}),{status:'locked'});
});
test('unsupported encoder output type is renamed to the real extension',async()=>{
  stubImages({sizes:[100]});globalThis.document.createElement=()=>({width:0,height:0,getContext:()=>({drawImage(){}}),toBlob(cb){cb(new Blob([new Uint8Array(100)],{type:'image/png'}));}});
  const r=await draft.prepareMessagingFiles(pick('photo.webp'),{isCurrent:()=>true});assert.equal(r.files[0].filename,'photo.png');assert.equal(r.files[0].mime,'image/png');
});
