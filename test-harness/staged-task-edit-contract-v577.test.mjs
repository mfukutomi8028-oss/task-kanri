import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectTaskEditContractV577 as inspect } from '../security/staged-task-edit-contract-v577.mjs';

const fixture=()=>({
  id:'legacyTask',title:'旧タスク',revision:0,assignee:'職員A',
  createdAt:1761800000000,createdBy:'職員B',
  history:[{id:'h1',body:'履歴A'}],
  comments:[{id:'c1',body:'コメント'}],
  checklist:[{id:'ch1',done:false}],
  recurrenceRule:{weeks:1},unmappedExtension:{futureField:'必ず残す'}
});
const ctx={taskKey:'legacyTask',expectedRevision:0};
test('Ver.577 draft contract preserves unknown fields, old rev 0 and append-only history',()=>{
  const before=fixture(),original=structuredClone(before);
  const after={...structuredClone(before),revision:1,title:'新版',
    comments:[...before.comments,{id:'c2',body:'追加コメント'}],
    history:[...before.history,{id:'h2',body:'追記'}]};
  const report=inspect(before,after,ctx);
  assert.equal(report.result,'NO_GO');
  assert.equal(report.candidateCompatible,true);
  assert.equal(report.clientWriteAllowed,false);
  assert.equal(report.databaseWritePerformed,false);
  assert.equal(report.reason,'awaiting-trusted-writer-and-approval');
  assert.deepEqual(before,original);
  assert.equal(JSON.stringify(report).includes('職員A'),false);
  assert.equal(JSON.stringify(report).includes('履歴A'),false);
});
test('Ver.577 stale, skipped revision and invalid legacy key reject before save',()=>{
  const before=fixture();
  assert.equal(inspect(before,{...before,revision:2},ctx).reason,'non-sequential-revision');
  assert.equal(inspect(before,{...before,revision:1},{...ctx,expectedRevision:1})
    .reason,'stale-or-invalid-revision');
  assert.equal(inspect(before,{...before,revision:1},{...ctx,taskKey:'../bad'})
    .reason,'invalid-task-key');
  assert.equal(inspect(before,{...before,revision:1},{...ctx,taskKey:'あ'.repeat(300)})
    .reason,'invalid-task-key');
  const extended='task'+('a'.repeat(300));
  const old={...before,id:extended};
  const output=inspect(old,{...old,revision:1},{taskKey:extended,expectedRevision:0});
  assert.equal(output.candidateCompatible,true,'long permitted Firebase key remains intact');
});
test('Ver.577 rejects silent dropping or altering unknown, historical, immutable fields',()=>{
  const before=fixture();
  const next={...structuredClone(before),revision:1,title:'変更'};
  for(const changed of [
    (()=>{const x={...next};delete x.unmappedExtension;return x})(),
    {...next,unmappedExtension:{futureField:'改変'}},
    {...next,createdBy:'別人'},
    {...next,id:'other'},
    {...next,history:[{id:'h1',body:'書換'}]},
    {...next,history:[]},
    {...next,comments:[]},
    {...next,history:'not-an-array'},
    {...next,clientSaysAdmin:true}
  ])assert.equal(inspect(before,changed,ctx).candidateCompatible,false);
  assert.equal(inspect(before,{...next,history:[]},ctx).reason,
    'history-or-comment-rewrite');
  assert.equal(inspect(before,{...next,unmappedExtension:{futureField:'改変'}},ctx).reason,
    'immutable-or-unknown-field-changed');
});
test('Ver.577 rejects non-JSON data and never claims a production writer exists',()=>{
  const before=fixture();
  const changed=[
    {...before,revision:1,unsafe:undefined},
    {...before,revision:1,unsafe:Infinity},
    {...before,revision:1,unsafe:()=>42},
    {...before,revision:1,unsafe:BigInt(1)},
    {...before,revision:1,unsafe:new Date()}
  ];
  for(const after of changed){
    const report=inspect(before,after,ctx);
    assert.equal(report.candidateCompatible,false);
    assert.equal(report.databaseWritePerformed,false);
    assert.equal(report.result,'NO_GO');
  }
});
