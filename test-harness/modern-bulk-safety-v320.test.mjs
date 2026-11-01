import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {captureDeleteBaseFromRoot,planDeleteMutation} from '../task-delete-v134.js';

const read = name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const clone = value=>structuredClone(value);
const root = ()=>({
  tasks:{
    a:{id:'a',title:'A',revision:2,status:'未着手',knowledgeId:'ka'},
    b:{id:'b',title:'B',revision:4,status:'未着手'},
    other:{id:'other',revision:3,title:'keep'}
  },
  schedules:{
    sa:{id:'sa',title:'A会議',relatedTaskId:'a',revision:2},
    sb:{id:'sb',title:'B会議',relatedTaskId:'b',revision:1},
    keep:{id:'keep',relatedTaskId:'other',revision:9}
  },
  knowledge:{
    ka:{id:'ka',title:'A手順',taskId:'a',revision:3},
    keep:{id:'keep',title:'別手順',taskId:'other',revision:8}
  }
});
function batch(bases,current){
  let draft=current;
  for(const base of bases){
    const planned=planDeleteMutation(base,draft);
    if(planned.action!=='commit')return {ok:false,kind:planned.kind};
    draft=planned.nextRoot;
  }
  return {ok:true,draft};
}
test('Ver.320 canonical bulk plan unlinks both schedules, deletes linked knowledge and preserves other records',()=>{
  const original=root(),bases=['a','b'].map(id=>captureDeleteBaseFromRoot(id,original));
  const outcome=batch(bases,clone(original));
  assert.equal(outcome.ok,true);
  assert.equal(outcome.draft.tasks.a,undefined);
  assert.equal(outcome.draft.tasks.b,undefined);
  assert.equal(outcome.draft.schedules.sa.relatedTaskId,'');
  assert.equal(outcome.draft.schedules.sb.relatedTaskId,'');
  assert.equal(outcome.draft.schedules.sa.revision,3);
  assert.equal(outcome.draft.schedules.sb.revision,2);
  assert.equal(outcome.draft.knowledge.ka,undefined);
  assert.deepEqual(outcome.draft.tasks.other,original.tasks.other);
  assert.deepEqual(outcome.draft.schedules.keep,original.schedules.keep);
  assert.deepEqual(outcome.draft.knowledge.keep,original.knowledge.keep);
});
test('Ver.320 peer-added schedules or knowledge abort the entire bulk delete',()=>{
  const original=root(),bases=['a','b'].map(id=>captureDeleteBaseFromRoot(id,original));
  for(const collection of ['schedules','knowledge']){
    const remote=clone(original);
    remote[collection].newRelated=collection==='schedules'
      ? {relatedTaskId:'a',revision:1,title:'直前追加'}
      : {taskId:'a',revision:1,title:'直前追加'};
    const before=clone(remote),outcome=batch(bases,remote);
    assert.equal(outcome.ok,false);
    assert.equal(outcome.kind,'remote-content-changed');
    assert.deepEqual(remote,before);
  }
});
test('Ver.320 peer updates, semantic changes and stale revisions cannot silently delete',()=>{
  const original=root(),bases=['a','b'].map(id=>captureDeleteBaseFromRoot(id,original));
  const changes=[
    current=>{current.tasks.b.revision++;},
    current=>{current.tasks.b.description='新しい内容';},
    current=>{current.schedules.sb.revision++;},
    current=>{current.knowledge.ka.title='別手順に更新';}
  ];
  for(const change of changes){
    const remote=clone(original);change(remote);
    const before=clone(remote),outcome=batch(bases,remote);
    assert.equal(outcome.ok,false);
    assert.deepEqual(remote,before);
  }
});
test('Ver.320 local bulk delete only calls canonical relation planner, not the old screen snapshot algorithm',()=>{
  const app=read('app.js');
  assert.match(app,/const deleteBases=action==='delete'/);
  assert.match(app,/planDeleteMutation\(deleteBases\.get\(original\.id\),/);
  assert.match(app,/if\(plan\.action!=='commit'\)throw new Error\('conflict'\)/);
  assert.match(app,/runTransaction\(state\.roomRef, current =>/);
  assert.doesNotMatch(app,/const relatedSchedules = state\.schedules\.filter\(item => item\.relatedTaskId === original\.id\)/);
});

function adapterFixture(){
  let tasks={
    a:{id:'a',title:'A',revision:2,status:'未着手',assignee:'佐藤',category:'PC',history:[],recurrence:'none'},
    b:{id:'b',title:'B',revision:4,status:'未着手',assignee:'佐藤',category:'PC',history:[],recurrence:'none'},
    other:{id:'other',title:'keep',revision:9,status:'未着手',history:[]}
  };
  let user='佐藤', count=0,transactions=0;
  const hooks={get:null,transaction:null,ensure:null};
  const db={};
  const api={
    db,roomId:'test-modern-bulk',
    ref(value,path){assert.equal(value,db);assert.equal(path,'rooms/test-modern-bulk/tasks');return {path};},
    async get(ref){assert.equal(ref.path,'rooms/test-modern-bulk/tasks');hooks.get?.();return {val:()=>clone(tasks)};},
    push(){return {key:'history-'+(++count)};},
    async runTransaction(ref,apply,options){
      assert.equal(ref.path,'rooms/test-modern-bulk/tasks');
      assert.equal(options.applyLocally,false);
      transactions++;
      hooks.transaction?.();
      const result=apply(clone(tasks));
      if(result===undefined)return {committed:false,snapshot:{val:()=>clone(tasks)}};
      tasks=clone(result);
      return {committed:true,snapshot:{val:()=>clone(tasks)}};
    }
  };
  const Base={
    ROOM_ID:'test-modern-bulk',
    taskMap:()=>new Map(Object.entries(tasks)),
    async ensureRemote(){hooks.ensure?.();return api;}
  };
  const document={
    addEventListener(){},
    getElementById(id){return id==='connectionPill'
      ? {classList:{contains:status=>status==='remote-online'}}:null;}
  };
  const localStorage={getItem:key=>key==='systemTaskUser'?user:null};
  const window={WorkBoardWorkflowV152:Base,firebaseConfig:{apiKey:'demo',databaseURL:'https://example.invalid'}};
  const context={window,document,localStorage,console,setTimeout,clearTimeout};
  vm.runInNewContext(read('workspace-bulk-update-v547.js'),context);
  vm.runInNewContext(read('bulk-actions-v243.js'),context);
  return {
    controller:window.WorkBoardBulkV243,hooks,
    get records(){return clone(tasks);},
    get transactions(){return transactions;},
    setUser(value){user=value;},
    peerEdit(id){tasks[id]={...tasks[id],revision:tasks[id].revision+1,description:'peer'};}
  };
}
const request=()=>({
  roomId:'test-modern-bulk',selectedUser:'佐藤',action:'status',target:'対応中',
  items:[{id:'a',expectedRevision:2},{id:'b',expectedRevision:4}]
});
test('Ver.320 Modern remote update commits once via Classic shared writer and preserves other task',async()=>{
  const f=adapterFixture(),before=f.records;
  const result=await f.controller.commitModern(request());
  assert.equal(result.ok,true);
  assert.equal(result.count,2);
  assert.equal(result.pendingSync,false);
  assert.equal(f.transactions,1);
  assert.equal(f.records.a.revision,3);
  assert.equal(f.records.b.revision,5);
  assert.equal(f.records.a.status,'対応中');
  assert.equal(f.records.a.updatedBy,'佐藤');
  assert.equal(f.records.a.history.length,1);
  assert.deepEqual(f.records.other,before.other);
  const repeat=await f.controller.commitModern(request());
  assert.equal(repeat.ok,false);
  assert.equal(f.transactions,1);
});
test('Ver.320 guards owner switch during remote warm-read and within Firebase callback',async()=>{
  const first=adapterFixture(),before=first.records;
  first.hooks.get=()=>first.setUser('福冨');
  const afterGet=await first.controller.commitModern(request());
  assert.equal(afterGet.ok,false);
  assert.equal(afterGet.error,'owner-mismatch');
  assert.equal(first.transactions,0);
  assert.deepEqual(first.records,before);
  const second=adapterFixture(),base=second.records;
  second.hooks.transaction=()=>second.setUser('福冨');
  const inside=await second.controller.commitModern(request());
  assert.equal(inside.ok,false);
  assert.equal(inside.error,'owner-mismatch');
  assert.equal(second.transactions,1);
  assert.deepEqual(second.records,base);
});
test('Ver.320 concurrent remote revision rejects entire selection and prevents partial commit',async()=>{
  const f=adapterFixture(),before=f.records;
  f.hooks.transaction=()=>f.peerEdit('b');
  const result=await f.controller.commitModern(request());
  assert.equal(result.ok,false);
  assert.equal(result.error,'revision-or-relation-mismatch');
  assert.equal(f.transactions,1);
  assert.deepEqual(f.records.a,before.a);
  assert.equal(f.records.b.status,before.b.status);
  assert.equal(f.records.b.revision,5);
});
test('Ver.320 invalid, foreign and oversized Modern requests never start a transaction',async()=>{
  const f=adapterFixture(),before=f.records,base=request();
  for(const invalid of [
    {...base,items:[base.items[0],base.items[0]]},
    {...base,items:Array.from({length:51},(_,i)=>({id:'x'+i,expectedRevision:1}))},
    {...base,roomId:'test-other'},
    {...base,selectedUser:'福冨'},
    {...base,action:'delete'},
    {...base,items:[{id:'a',expectedRevision:1}]}
  ]){
    const result=await f.controller.commitModern(invalid);
    assert.equal(result.ok,false);
  }
  assert.equal(f.transactions,0);
  assert.deepEqual(f.records,before);
});
