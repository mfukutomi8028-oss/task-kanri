import test from 'node:test';
import assert from 'node:assert/strict';
import {isStickyNote,newSticky,stickyList,updateSticky} from '../personal-sticky-core-v659.js';

const stamp=1795230000000;
const build=()=>newSticky({id:'note_a',ownerUid:'user_a',roomId:'room_a',now:stamp}).note;
function edit(note,values,expectedRevision=note.content.revision){
 return updateSticky(note,{field:'content',expectedRevision,values,ownerUid:'user_a',roomId:'room_a',now:stamp+1});
}

test('sticky format is an optional normalized field of the same revision transaction',()=>{
 const note=build(),text='重要📌';
 assert.equal('format' in note.content,false);
 const raw={text,runs:[{start:0,end:1,flags:1,foreign:'ignored'},{start:1,end:2,flags:1}]};
 const first=edit(note,{text,format:raw});
 assert.equal(first.ok,true);
 assert.deepEqual(first.note.content,{text,revision:2,updatedAt:stamp+1,format:{revision:2,runs:[{start:0,end:2,flags:1}]}});
 assert.equal(first.note.layout,note.layout);
 assert.equal(edit(first.note,{text:'変更',format:null},1).error,'conflict');
 assert.deepEqual(edit(first.note,{text}).note.content.format,{...first.note.content.format,revision:3});
 assert.equal('format' in edit(first.note,{text,format:null}).note.content,false);
 assert.equal('format' in edit(first.note,{text:'別の本文'}).note.content,false);
});

test('bad or stale sticky format cannot hide canonical text or leak into a new content write',()=>{
 const note=build(),text='本文😀';
 const bad=[{text:'旧本文',runs:[{start:0,end:1,flags:1}]},
  {text,runs:[{start:2,end:3,flags:1}]},null,{text,runs:[{start:0,end:1,color:'invalid'}]}];
 for(const format of bad){
  const legacy={...note,content:{...note.content,text,format}};
  assert.equal(isStickyNote(legacy),true);
  assert.deepEqual(stickyList({note:legacy},{query:'本文'}).map(n=>n.id),['note_a']);
  for(const updated of [edit(legacy,{text}),edit(legacy,{text,format})]){
   assert.equal(updated.ok,true);
   assert.equal(updated.note.content.text,text);
   assert.equal('format' in updated.note.content,false);
  }
 }
});


test('older client A → B → A cannot revive stale sticky marks or retain another copy of the old text',()=>{
 const text='旧本文';
 const first=edit(build(),{text,format:{text,runs:[{start:0,end:1,flags:1}]}}).note;
 assert.deepEqual(Object.keys(first.content.format).sort(),['revision','runs']);
 // Ver.670 merged fields with an object spread and did not stamp the envelope.
 const oldWrite=(note,text)=>({...note,content:{...note.content,text,revision:note.content.revision+1}});
 const replayed=oldWrite(oldWrite(first,'修正後'),text);
 assert.equal(isStickyNote(replayed),true);
 assert.equal('format' in edit(replayed,{text}).note.content,false);
});
