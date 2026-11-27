// Daily reports use canonical task completion dates, not update dates or
// scheduled times. No external AI and no write or automatic send side effects.
import {isMessagingRoomId,isPersonId,isConversationId,projectMessagingMessage,validateRoomMessageInput} from './workspace-messaging-core.js';
const DAY=86400000;
const localDay=stamp=>new Date(stamp+9*3600000).toISOString().slice(0,10);
const validDate=day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day+'T00:00:00+09:00'))&&localDay(Date.parse(day+'T00:00:00+09:00'))===day;
const stamp=value=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:null;
const time=value=>typeof value==='string'&&/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
const titleOf=item=>typeof item?.title==='string'&&item.title.trim()?item.title.trim().replace(/[\r\n]+/g,' '):null;
const itemOf=item=>({id:item.id,title:titleOf(item)});
export function buildDailyReport({dayISO,personId,roomId,tasks,schedules,resolvePerson,selectedIds=null,supplement=''}={}){
  if(!validDate(dayISO)||!isPersonId(personId)||!isMessagingRoomId(roomId)||!Array.isArray(tasks)||!Array.isArray(schedules)||typeof resolvePerson!=='function'||typeof supplement!=='string'||selectedIds!==null&&!Array.isArray(selectedIds))throw new TypeError('Invalid report request');
  const user=resolvePerson(personId);if(typeof user!=='string'||!user.trim())throw new TypeError('Unbound report identity');
  const start=Date.parse(dayISO+'T00:00:00+09:00'),end=start+DAY;
  const completedTasks=[],plannedSchedules=[],inProgress=[],unknownCompletion=[];
  const selected=selectedIds===null?null:new Set(selectedIds);const chosen=item=>selected===null||selected.has(item.id);
  for(const t of tasks){
    if(t?.assignee!==user||!titleOf(t)||typeof t.id!=='string'||!chosen(t))continue;
    if(t.completed===true){const completedAt=stamp(t.completedAt);if(completedAt===null)unknownCompletion.push(itemOf(t));else if(completedAt>=start&&completedAt<end)completedTasks.push({...itemOf(t),completedAt});}
    else if(t.status==='進行中')inProgress.push(itemOf(t));
  }
  for(const s of schedules){
    if(s?.assignee!==user||!titleOf(s)||typeof s.id!=='string'||!chosen(s))continue;
    const a=time(s.startAt),b=time(s.endAt);if(a===null||b===null||b<=a||a>=end||b<=start)continue;
    plannedSchedules.push({...itemOf(s),startAt:s.startAt,endAt:s.endAt});
  }
  completedTasks.sort((a,b)=>a.completedAt-b.completedAt||a.id.localeCompare(b.id));
  plannedSchedules.sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt)||a.id.localeCompare(b.id));
  const sections=[['完了タスク',completedTasks],['本日の予定（実施未確認）',plannedSchedules],['進行中',inProgress]];
  const lines=['日次業務報告 '+dayISO];for(const [heading,items] of sections)lines.push('',heading,...(items.length?items.map(t=>'・'+t.title):['なし']));
  if(unknownCompletion.length)lines.push('','完了日時不明のため集計対象外：'+unknownCompletion.length+'件');
  if(supplement.trim())lines.push('','補足',supplement.trim());
  const body=lines.join('\n');
  const refs=[...completedTasks.map(t=>({roomId,type:'task',recordId:t.id})),...plannedSchedules.map(t=>({roomId,type:'schedule',recordId:t.id})),...inProgress.map(t=>({roomId,type:'task',recordId:t.id}))];
  // The caller must show excess items and ask the user to select a subset.
  // Never silently truncate a report or send it automatically.
  let withinMessageLimits=true;try{validateRoomMessageInput({body,refs},roomId);}catch(_){withinMessageLimits=false;}
  return {completedTasks,plannedSchedules,inProgress,unknownCompletion,body,refs,withinMessageLimits};
}
export function prepareBusinessDraftFromMessage(message,{kind,context,canRead}={}){
  if(!['task','schedule'].includes(kind)||canRead!==true||!context||!isConversationId(context.conversationId)||!isPersonId(context.personId))return null;
  try{
    const item=projectMessagingMessage(message,context);if(item.deletedAt!=null||!item.body.trim())return null;
    const title=Array.from(item.body.split(/\r?\n/).find(s=>s.trim()).trim()).slice(0,80).join('');
    const source={roomId:context.roomId,conversationId:context.conversationId,messageId:item.id};
    const excerpt=Array.from(item.body).slice(0,500).join('');
    return kind==='task'?{kind,title,description:excerpt,source}:{kind,title,memo:excerpt,source};
  }catch(_){return null;}
}
