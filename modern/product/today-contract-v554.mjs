// Ver.554: a single, owner-consistent, read-only "Today" projection.
// Consume only ONE Classic Ver.550 snapshot and the already-reviewed Modern
// task / personal-ToDo / schedule selectors. Do not create any new source
// of truth, network connection, clock, storage, subscription, or write path.
import { selectModernTaskListV551 } from './task-list-contract-v551.mjs';
import { selectModernTodosV552 } from './todo-list-contract-v552.mjs';
import { selectModernSchedulesV553 } from './schedule-list-contract-v553.mjs';

const EMPTY = Object.freeze([]);
const MAX_TASKS = 6;
const MAX_TODOS = 4;
const MAX_SCHEDULES = 6;
const PRIORITY = Object.freeze({'緊急':0,'高':1,'中':2,'低':3});
const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
const day = value => new Date(String(value)+'T00:00:00').getTime();
const fail = reason => Object.freeze({
  ready:false, reason, source:null, roomId:'', selectedUser:'', todayISO:'',
  stats:null, counts:null, overdue:EMPTY, dueToday:EMPTY,
  openTodos:EMPTY, completedTodayTodos:EMPTY, schedules:EMPTY
});
const safeCount = n => Number.isSafeInteger(n) && n >= 0;
const dueRank = (task, today) => {
  if(!task.dueDate)return 3;
  const ms=day(task.dueDate);
  return !Number.isFinite(ms) ? 3 : ms<today ? 0 : ms===today ? 1 : 2;
};
const dueTime = task => {
  if(!task.dueDate)return Number.MAX_SAFE_INTEGER;
  const value=new Date(task.dueDate+'T'+(task.dueTime||'23:59')).getTime();
  return Number.isFinite(value)?value:Number.MAX_SAFE_INTEGER;
};
function compareClassicSmart(a,b,rawById,today) {
  const ta=rawById.get(a.id),tb=rawById.get(b.id);
  const ar=[
    ta.pinned?0:1,dueRank(ta,today),PRIORITY[ta.priority]??9,
    dueTime(ta),-Number(ta.updatedAt||0)
  ];
  const br=[
    tb.pinned?0:1,dueRank(tb,today),PRIORITY[tb.priority]??9,
    dueTime(tb),-Number(tb.updatedAt||0)
  ];
  for(let i=0;i<ar.length;i++)if(ar[i]!==br[i])return ar[i]-br[i];
  return a.title.localeCompare(b.title,'ja')||a.id.localeCompare(b.id,'ja');
}

export function selectModernTodayV554(snapshot) {
  if(!snapshot||snapshot.ready!==true||snapshot.version!=='550'
    || !['remote-online','local-only'].includes(snapshot.source)
    || typeof snapshot.roomId!=='string'||!snapshot.roomId
    || typeof snapshot.selectedUser!=='string'||!snapshot.selectedUser
    || typeof snapshot.todayISO!=='string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.todayISO)
    || !snapshot.summary||!Array.isArray(snapshot.tasks)) {
    return fail(snapshot?.reason||'invalid-snapshot');
  }
  const today=day(snapshot.todayISO);
  if(!Number.isFinite(today))return fail('invalid-snapshot');
  const tasks=selectModernTaskListV551(snapshot);
  const todos=selectModernTodosV552(snapshot);
  const schedules=selectModernSchedulesV553(snapshot);
  if(!tasks.ready||!todos.ready||!schedules.ready)
    return fail([tasks,todos,schedules].find(part=>!part.ready)?.reason||'invalid-snapshot');
  for(const segment of [tasks,todos,schedules]){
    if(segment.roomId!==snapshot.roomId||segment.selectedUser!==snapshot.selectedUser
      ||segment.source!==snapshot.source)return fail('inconsistent-owner');
  }
  if(todos.todayISO!==snapshot.todayISO||schedules.todayISO!==snapshot.todayISO
    ||schedules.anchorISO!==snapshot.todayISO||schedules.range!=='today')
    return fail('inconsistent-date');
  const summary=snapshot.summary;
  if(['open','overdue','today','mine'].some(key=>!safeCount(summary[key]))
    ||summary.mine>summary.open||summary.overdue>summary.open||summary.today>summary.open)
    return fail('invalid-summary');

  const rawById=new Map(snapshot.tasks.map(task=>[task.id,task]));
  if(rawById.size!==tasks.rows.length)return fail('invalid-snapshot');
  const openTasks=tasks.rows.filter(task=>!task.completed);
  // The four KPI counters include "保留" by Classic's original domain rule.
  const allOverdue=openTasks.filter(task=>Number.isFinite(day(task.dueDate))&&task.dueDate&&day(task.dueDate)<today);
  const allToday=openTasks.filter(task=>task.dueDate&&day(task.dueDate)===today);
  if(summary.open!==openTasks.length||summary.overdue!==allOverdue.length||summary.today!==allToday.length)
    return fail('inconsistent-summary');

  // Classic Today panels explicitly exclude "保留". Do not use the KPI
  // counters as panel counts: they have different, documented scopes.
  const actionable=task=>normalize(task.status)!==normalize('保留');
  const overdue=allOverdue.filter(actionable);
  const dueToday=allToday.filter(actionable);
  overdue.sort((a,b)=>compareClassicSmart(a,b,rawById,today));
  dueToday.sort((a,b)=>compareClassicSmart(a,b,rawById,today));
  const stats=Object.freeze({
    openTasks:summary.open,
    overdueTasks:summary.overdue,
    todayTasks:summary.today,
    mineTasks:summary.mine
  });
  const counts=Object.freeze({
    actionableOverdue:overdue.length,
    actionableToday:dueToday.length,
    openTodos:todos.open.length,
    completedTodayTodos:todos.completedToday.length,
    todaySchedules:schedules.rows.length
  });
  return Object.freeze({
    ready:true,reason:null,source:snapshot.source,
    roomId:snapshot.roomId,selectedUser:snapshot.selectedUser,
    todayISO:snapshot.todayISO,stats,counts,
    overdue:Object.freeze(overdue.slice(0,MAX_TASKS)),
    dueToday:Object.freeze(dueToday.slice(0,MAX_TASKS)),
    openTodos:Object.freeze(todos.open.slice(0,MAX_TODOS)),
    completedTodayTodos:Object.freeze(todos.completedToday.slice(0,MAX_TODOS)),
    schedules:Object.freeze(schedules.rows.slice(0,MAX_SCHEDULES))
  });
}
