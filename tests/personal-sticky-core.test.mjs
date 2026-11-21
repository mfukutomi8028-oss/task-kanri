import test from 'node:test';
import assert from 'node:assert/strict';
import { newSticky, updateSticky, canDeleteSticky, stickyList, isStickyNote, isStickyGroup, planStickyPlacement, planMobileMove, stickyPage, planStickyArrangement, STICKY_SIZE } from '../personal-sticky-core-v659.js';

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

test('mobile reorder computes a new safe rank without altering desktop placement',()=>{
 const a=build('rank_a'),b=build('rank_b'),c=build('rank_c');
 a.mobile.order=1024;b.mobile.order=2048;c.mobile.order=3072;
 const before=c.layout;
 const move=planMobileMove([a,b,c],c.id,'up');
 assert.deepEqual(move,{id:c.id,order:2047,expectedRevision:1});
 assert.equal(c.layout,before);
 assert.equal(planMobileMove([a,b,c],a.id,'up'),null);
 assert.equal(planMobileMove([a,b,c],'missing','up'),null);
});

test('existing Firebase-safe Japanese room identifiers remain supported',()=>{
 const japanese=newSticky({id:'note_jp',ownerUid:'user_a',roomId:'病院業務 2026',now:stamp});
 assert.equal(japanese.ok,true);
 assert.equal(isStickyNote(japanese.note),true);
 assert.equal(newSticky({id:'note_slash',ownerUid:'user_a',roomId:'院内/業務',now:stamp}).ok,false);
});


test('five sticky pages retain legacy records on page one',()=>{
 const old=build('legacy_one'); delete old.layout.page;
 assert.equal(isStickyNote(old),true);
 assert.equal(stickyPage(old),1);
 const second=newSticky({id:'page_two',ownerUid:'user_a',roomId:'room_a',now:stamp,page:2});
 assert.equal(second.ok,true);
 assert.equal(second.note.layout.page,2);
 assert.equal(stickyPage(second.note),2);
 assert.equal(newSticky({id:'outside',ownerUid:'user_a',roomId:'room_a',now:stamp,page:6}).ok,false);
 assert.equal(updateSticky(old,{field:'layout',expectedRevision:1,values:{page:5},ownerUid:'user_a',roomId:'room_a',now:stamp+1}).note.layout.page,5);
});
test('page placement does not collide with or shift notes on another page',()=>{
 const first=build('legacy_note');
 const second=newSticky({id:'page_2',ownerUid:'user_a',roomId:'room_a',now:stamp,page:2}).note;
 assert.deepEqual(
   {x:planStickyPlacement([first],2).x,y:planStickyPlacement([first],2).y},
   {x:24,y:24}
 );
 assert.notDeepEqual(
   {x:planStickyPlacement([first,second],2).x,y:planStickyPlacement([first,second],2).y},
   {x:24,y:24}
 );
});

test('large notes allow 760 x 720 pixels without loosening their original minimum size',()=>{
 const note=build('large_note');
 const base={field:'layout',expectedRevision:1,ownerUid:note.ownerUid,roomId:note.roomId,now:stamp+1};
 const resized=updateSticky(note,{...base,values:{width:760,height:720}});
 assert.equal(resized.ok,true);
 assert.deepEqual([resized.note.layout.width,resized.note.layout.height],[760,720]);
 for(const dims of [{width:761},{height:721},{width:219},{height:159}]){
  assert.equal(updateSticky(note,{...base,values:dims}).ok,false);
 }
 assert.deepEqual([STICKY_SIZE.width,STICKY_SIZE.height],[280,220]);
});
test('arrangement gives deterministic non-overlapping placements on selected page only',()=>{
 const a=build('arrange_a'),b=build('arrange_b'),c=build('arrange_c');
 a.layout={...a.layout,width:760,height:500,x:500,y:100};
 b.layout={...b.layout,width:300,height:250,x:20,y:30};
 c.layout={...c.layout,page:2,x:700,y:100};
 const planned=planStickyArrangement([a,b,c],1);
 assert.equal(planned.ok,true);
 assert.deepEqual(planned.placements.map(p=>p.id),['arrange_b','arrange_a']);
 for(const item of planned.placements){
  const n=[a,b,c].find(note=>note.id===item.id);
  assert.ok(item.x>=0&&item.y>=0);
  assert.ok(item.x+n.layout.width<=1400&&item.y+n.layout.height<=900);
  assert.equal(item.expectedRevision,1);
 }
 const [p,q]=planned.placements;
 assert.equal(p.x+p.width+16<=q.x||q.x+q.width+16<=p.x||p.y+p.height+16<=q.y||q.y+q.height+16<=p.y,true);
 assert.equal(planStickyArrangement([a,b,c],1).placements.length,2);
 assert.equal(planStickyArrangement([a,b,c],2).placements[0].id,c.id);
});
test('arrangement refuses oversubscribed boards without providing partial placements',()=>{
 const a=build('too_big_a'),b=build('too_big_b');
 a.layout={...a.layout,width:760,height:720};
 b.layout={...b.layout,width:760,height:720};
 const result=planStickyArrangement([a,b],1);
 assert.equal(result.ok,false);
 assert.equal(result.error,'no-space');
 assert.deepEqual(result.placements,[]);
 assert.equal(planStickyArrangement([a],6).ok,false);
});
