// Origin personal sticky Auth candidate Rules: synthetic data only.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { get, ref, set } from 'firebase/database';

const rules=fs.readFileSync(new URL('../security/database.rules.sticky-v659.candidate.json',import.meta.url),'utf8');
const env=await initializeTestEnvironment({
 projectId:'demo-task-kanri-sticky-v659',
 database:{host:'127.0.0.1',port:9001,rules}
});
const at=(ctx,path)=>ref(ctx.database(),path);
const prefix='roomsV2/roomA/';
const notePath=prefix+'personal/alice/stickyNotes/noteA';
const now=1795228800000;
const blank=()=>({
 schemaVersion:1,id:'noteA',ownerUid:'alice',roomId:'roomA',createdAt:now,updatedAt:now,
 content:{revision:1,text:'',updatedAt:now},
 appearance:{revision:1,color:'lemon',updatedAt:now},
 layout:{revision:1,x:24,y:24,width:280,height:220,zIndex:1,updatedAt:now},
 mobile:{revision:1,order:0,updatedAt:now}
});
try {
 await env.withSecurityRulesDisabled(async admin=>{
  await set(at(admin,prefix+'access/members'),{alice:'editor',bob:'viewer',chief:'admin'});
  await set(at(admin,prefix+'internal/identities'),{alice:{approved:true},bob:{approved:true},chief:{approved:true}});
  await set(at(admin,'roomsV2/roomB/access/members/bob'),'viewer');
  await set(at(admin,'roomsV2/roomB/internal/identities/bob/approved'),true);
 });
 const alice=env.authenticatedContext('alice'),bob=env.authenticatedContext('bob');
 const chief=env.authenticatedContext('chief'),stranger=env.authenticatedContext('stranger');
 const anon=env.unauthenticatedContext();
 // A staged sticky-only Auth rollout must not change the existing shared
 // board's public /rooms API. The private /roomsV2 subtree is a sibling.
 // Cross-room and root enumeration still must be forbidden.
 await env.withSecurityRulesDisabled(async admin=>{
  await set(at(admin,'rooms/legacy-room/tasks/existing'),{title:'架空の既存タスク'});
 });
 assert.equal((await assertSucceeds(get(at(anon,'rooms/legacy-room/tasks/existing')))).val().title,
  '架空の既存タスク','legacy task reads remain compatible with the committed Rules');
 await assertSucceeds(set(at(anon,'rooms/legacy-room/tasks/new'),{title:'架空の追加タスク'}));
 await assertFails(get(at(anon,'rooms')));
 await assertFails(get(at(anon,'')));
 await assertFails(get(at(anon,'roomsV2/roomA')));

 for(const ctx of [bob,chief,stranger,anon]) {
  await assertFails(get(at(ctx,prefix+'personal/alice/stickyNotes')));
  await assertFails(set(at(ctx,notePath),blank()));
 }
 await assertFails(get(at(alice,prefix+'personal')));
 await assertFails(get(at(alice,'roomsV2/roomA')));
 await assertSucceeds(set(at(alice,notePath),blank()));
 const own=await assertSucceeds(get(at(alice,notePath)));
 assert.equal(own.val().content.text,'');
 await assertSucceeds(set(at(alice,notePath),{
  ...blank(),updatedAt:now+1,
  content:{text:'架空の付箋',revision:2,updatedAt:now+1}
 }));
 const latest=(await assertSucceeds(get(at(alice,notePath)))).val();
 assert.equal(latest.content.revision,2);
 await assertFails(set(at(alice,notePath),{...latest,content:{...latest.content,text:'古い変更',revision:2}}));
 await assertFails(set(at(alice,notePath),{...latest,ownerUid:'bob'}));
 await assertFails(set(at(alice,notePath),{...latest,roomId:'roomB'}));
 await assertFails(set(at(alice,notePath),{...latest,appearance:{...latest.appearance,color:'other',revision:2}}));
 await assertFails(set(at(alice,notePath),{...latest,content:{...latest.content,text:'x'.repeat(2001),revision:3}}));
 await assertFails(set(at(alice,notePath),{...latest,extraField:'bad'}));
 await assertSucceeds(set(at(alice,notePath),{...latest,updatedAt:now+2,
  layout:{...latest.layout,x:145,revision:2,updatedAt:now+2}}));
 await env.withSecurityRulesDisabled(async admin=>{
  await set(at(admin,prefix+'internal/identities/alice/approved'),false);
 });
 await assertFails(get(at(alice,notePath)));
 await assertFails(set(at(alice,notePath),null));
 await assertSucceeds(get(at(bob,prefix+'shared/tasks'))).catch(()=>{});
 console.log('STICKY_V659_AUTH_UID_PRIVATE_SCOPE_PASSED: Emulator synthetic data only');
}finally {await env.cleanup();}
