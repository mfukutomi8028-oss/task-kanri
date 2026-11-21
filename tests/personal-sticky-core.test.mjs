import test from 'node:test';
import assert from 'node:assert/strict';
import { newSticky, updateSticky, canDeleteSticky, stickyList, isStickyNote, isStickyGroup, planStickyPlacement } from '../personal-sticky-core-v659.js';

const stamp = 1795230000000;
const build = (id='note_a', uid='user_a', room='room_a') => newSticky({id,ownerUid:uid,roomId:room,now:stamp}).note;
test('creates canonical blank note with separated content, appearance and layout revisions',()=>{
 const note=build();
 assert.equal(isStickyNote(note),true);
 assert.deepEqual([note.content.revision,note.appearance.revision,note.layout.revision,note.mobile.revision],[1,1,1,1]);
});
test('rejects invalid ID, owner and coordinates',()=>{
 for(const args of [{id:'bad.key'},{ownerUid:'user/a'},{x:-1},{y:901}])
  assert.equal(newSticky({id:'ok',ownerUid:'user',roomId:'room',now:stamp,...args}).ok,false);
});
test('separates text revisions from layout and appearance changes',()=>{
 const old=build();
 const color=updateSticky(old,{field:'appearance',expectedRevision:1,values:{color:'mint'},ownerUid:'user_a',roomId:'room_a',now:stamp+1});
 assert.equal(color.ok,true);
 assert.equal(color.note.content.revision,1);
 const text=updateSticky(color.note,{field:'content',expectedRevision:1,values:{text:'会議の準備'},ownerUid:'user_a',roomId:'room_a',now:stamp+2});
 assert.equal(text.ok,true);
 assert.equal(text.note.content.text,'会議の準備');
 assert.equal(text.note.layout.revision,1);
});
test('rejects stale content revisions without overwriting',()=>{
 const note=build();
 const cmd={field:'content',expectedRevision:1,values:{text:'変更'},ownerUid:note.ownerUid,roomId:note.roomId,now:stamp+1};
 const first=updateSticky(note,cmd);
 assert.equal(first.ok,true);
 const second=updateSticky(first.note,cmd);
 assert.equal(second.error,'conflict');
 assert.equal(first.note.content.text,'変更');
});
test('refuses updates from another user and invalid content',()=>{
 const note=build();
 const opts={field:'content',expectedRevision:1,values:{text:'x'},ownerUid:'user_b',roomId:'room_a',now:stamp+1};
 assert.equal(updateSticky(note,opts).error,'invalid-update');
 assert.equal(updateSticky(note,{...opts,ownerUid:'user_a',values:{text:'x'.repeat(2001)}}).ok,false);
 assert.equal(updateSticky(note,{...opts,ownerUid:'user_a',values:{text:'x',ownerUid:'user_b'}}).ok,false);
});
test('rejects out-of-range layout values and protects mobile ordering',()=>{
 const note=build();
 const base={field:'layout',expectedRevision:1,ownerUid:note.ownerUid,roomId:note.roomId,now:stamp+1};
 assert.equal(updateSticky(note,{...base,values:{x:1401}}).ok,false);
 assert.equal(updateSticky(note,{...base,values:{width:219}}).ok,false);
 assert.equal(updateSticky(note,{...base,values:{x:900}}).ok,true);
 assert.equal(updateSticky(note,{...base,field:'mobile',values:{order:5}}).note.layout.x,note.layout.x);
});
test('deletion requires matching all revisions',()=>{
 const note=build();
 const versions={content:1,appearance:1,layout:1,mobile:1};
 assert.equal(canDeleteSticky(note,{ownerUid:note.ownerUid,roomId:note.roomId,expectedRevisions:versions}),true);
 assert.equal(canDeleteSticky(note,{ownerUid:'user_b',roomId:note.roomId,expectedRevisions:versions}),false);
 assert.equal(canDeleteSticky(note,{ownerUid:note.ownerUid,roomId:note.roomId,expectedRevisions:{...versions,layout:0}}),false);
});
test('search normalizes Japanese text and filters paper colors',()=>{
 const a=build('n1'),b=build('n2');
 a.content.text='ＡＢＣ 担当者';b.content.text='別のメモ';b.appearance.color='sky';b.mobile.order=5;
 assert.deepEqual(stickyList({a,b},{query:'abc'}).map(n=>n.id),['n1']);
 assert.deepEqual(stickyList({a,b},{color:'sky'}).map(n=>n.id),['n2']);
});
test('rejects malformed groups including missing timestamp',()=>{
 assert.equal(isStickyGroup('content',{text:'hi',revision:1}),false);
 assert.equal(isStickyGroup('appearance',{color:'invalid',revision:1,updatedAt:stamp}),false);
});

test('new notes get distinct non-overlapping canvas positions and stacking order',()=>{
 let notes=[];
 for(let i=0;i<9;i++){
   const position=planStickyPlacement(notes);
   assert.ok(position.x>=0&&position.y>=0&&position.x+280<=1400&&position.y+220<=900);
   assert.ok(notes.every(note=>!(position.x<note.layout.x+note.layout.width &&
     position.x+280>note.layout.x && position.y<note.layout.y+note.layout.height &&
     position.y+220>note.layout.y)),'new card must not obscure existing cards where space is available');
   const created=newSticky({id:'note_'+i,ownerUid:'user_a',roomId:'room_a',
     now:stamp+i,x:position.x,y:position.y,zIndex:position.zIndex,order:position.order});
   assert.equal(created.ok,true);
   assert.equal(created.note.layout.zIndex,position.zIndex);
   assert.equal(created.note.mobile.order,position.order);
   notes.push(created.note);
 }
 for(let i=1;i<notes.length;i++){
   assert.ok(notes[i].layout.zIndex>notes[i-1].layout.zIndex);
   assert.ok(notes[i].mobile.order>notes[i-1].mobile.order);
 }
});
