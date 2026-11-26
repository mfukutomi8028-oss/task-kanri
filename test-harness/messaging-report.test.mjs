import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDailyReport,prepareBusinessDraftFromMessage} from './messaging-preview/workspace-messaging-report.js';
const roomId='roomA',personId='p_'+'a'.repeat(32),dayISO='2026-11-26';
const ts=s=>Date.parse(s);const user='Staff A';
const tasks=[{id:'t1',title:'PC setup',assignee:user,completed:true,completedAt:ts('2026-11-25T15:00:00Z')},{id:'t2',title:'Old',assignee:user,completed:true,completedAt:ts('2026-11-25T14:59:59Z')},{id:'t3',title:'Unknown',assignee:user,completed:true,updatedAt:ts('2026-11-26T02:00:00Z')},{id:'t4',title:'Active',assignee:user,completed:false,status:'進行中'},{id:'t5',title:'Other staff',assignee:'Staff B',completed:true,completedAt:ts('2026-11-26T03:00:00Z')},{id:'t6',title:'Tomorrow',assignee:user,completed:true,completedAt:ts('2026-11-26T15:00:00Z')}];
const schedules=[{id:'s1',title:'Install PC',assignee:user,startAt:'2026-11-26T00:00:00Z',endAt:'2026-11-26T01:00:00Z'},{id:'s2',title:'Spans midnight',assignee:user,startAt:'2026-11-25T14:30:00Z',endAt:'2026-11-25T15:30:00Z'},{id:'s3',title:'Other staff',assignee:'Staff B',startAt:'2026-11-26T00:00:00Z',endAt:'2026-11-26T01:00:00Z'},{id:'s4',title:'Previous day',assignee:user,startAt:'2026-11-25T13:00:00Z',endAt:'2026-11-25T15:00:00Z'}];
const args={dayISO,personId,roomId,tasks,schedules,resolvePerson:id=>id===personId?user:null};
test('report uses actual completion timestamps and Tokyo day boundaries',()=>{
  const r=buildDailyReport(args);assert.deepEqual(r.completedTasks.map(t=>t.id),['t1']);assert.deepEqual(r.unknownCompletion.map(t=>t.id),['t3']);assert.deepEqual(r.inProgress.map(t=>t.id),['t4']);
  assert.equal(r.body.includes('Old'),false);assert.equal(r.body.includes('Other staff'),false);assert.equal(r.body.includes('Tomorrow'),false);
});
test('schedule overlap is listed as planned, not treated as an actual completion',()=>{
  const r=buildDailyReport(args);assert.deepEqual(r.plannedSchedules.map(s=>s.id),['s2','s1']);
  assert.ok(r.body.includes('予定'));assert.equal(r.body.includes('Previous day'),false);
  assert.deepEqual(r.refs.map(r=>r.recordId),['t1','s2','s1','t4']);
});
test('unknown identity and impossible date do not generate someone else\'s report',()=>{
  assert.throws(()=>buildDailyReport({...args,personId:'p_'+'b'.repeat(32)}),TypeError);
  assert.throws(()=>buildDailyReport({...args,dayISO:'2026-02-30'}),TypeError);
});
test('selected items and supplementary text produce an editable draft without writing',()=>{
  const r=buildDailyReport({...args,selectedIds:['t1','s1'],supplement:'Follow-up tomorrow'});
  assert.deepEqual(r.refs.map(r=>r.recordId),['t1','s1']);assert.ok(r.body.includes('Follow-up tomorrow'));assert.equal(r.body.includes('Active'),false);
});
test('message-to-business draft is read-only and retains the original conversation reference',()=>{
  const message={id:'msg_'+personId+'_q_'+'c'.repeat(32),senderId:personId,createdAt:2000,revision:1,body:'PC check\nFollow-up'};
  const context={roomId,conversationId:'self_'+personId,personId,joinedAt:1000};
  const draft=prepareBusinessDraftFromMessage(message,{kind:'task',context,canRead:true});
  assert.equal(draft.title,'PC check');assert.equal(draft.description,'PC check\nFollow-up');assert.deepEqual(draft.source,{roomId,conversationId:context.conversationId,messageId:message.id});
  assert.equal(prepareBusinessDraftFromMessage({...message,deletedAt:3000},{kind:'task',context,canRead:true}),null);
  assert.equal(prepareBusinessDraftFromMessage(message,{kind:'schedule',context,canRead:false}),null);
});
