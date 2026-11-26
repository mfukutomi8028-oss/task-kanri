// Server-side domain transitions for the small conversation-control node.
// The caller must authenticate the actor, obtain the approved room directory,
// and apply the transition atomically at the trusted persistence boundary.
import {conversationIdFor,isConversationId,isMessagingRoomId,isMessagingTimestamp,isPersonId} from '../test-harness/messaging-preview/workspace-messaging-core.js';

const fields={openDirect:['personId'],openSelf:[],createGroup:['title','invitees'],invite:['personIds'],respondInvite:['accept'],rename:['title'],transferOwner:['personId'],removeMember:['personId'],leave:[],setArchived:['archived']};
const creates=new Set(['openDirect','openSelf','createGroup']);
const roles=new Set(['owner','admin','member']);
const inviteStates=new Set(['pending','accepted','declined']);
const record=v=>v!==null&&typeof v==='object'&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const fail=status=>({status});
const ok=(control,changed=true)=>({status:'ok',changed,control});
const titleOf=v=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=80&&!/[\u0000-\u001f\u007f]/.test(v)?v.trim():null;
const personList=v=>Array.isArray(v)&&v.length<=100&&Array.from(v).every(isPersonId)&&new Set(v).size===v.length;
const validMember=v=>record(v)&&typeof v.active==='boolean'&&roles.has(v.role)&&isMessagingTimestamp(v.joinedAt)&&
  (v.active?v.leftAt==null:isMessagingTimestamp(v.leftAt)&&v.leftAt>=v.joinedAt);
const validInvite=v=>record(v)&&inviteStates.has(v.state)&&isPersonId(v.invitedBy)&&isMessagingTimestamp(v.invitedAt);
const countParticipants=control=>new Set([...Object.keys(control.members).filter(id=>control.members[id].active),...Object.keys(control.invites??{}).filter(id=>control.invites[id].state==='pending')]).size;
const member=(now,role='member')=>({active:true,joinedAt:now,role});
const invite=(now,invitedBy)=>({state:'pending',invitedBy,invitedAt:now});
export function isValidConversationControl(control,conversationId,roomId){
  if(!record(control)||control.id!==conversationId||control.roomId!==roomId||!['direct','self','group'].includes(control.kind)
      ||!['active','archived'].includes(control.status)||!Number.isSafeInteger(control.revision)||control.revision<1||control.revision>=Number.MAX_SAFE_INTEGER
      ||!isMessagingTimestamp(control.updatedAt)||!record(control.members)||!record(control.invites??{})
      ||Object.entries(control.members).some(([id,value])=>!isPersonId(id)||!validMember(value)||value.joinedAt>control.updatedAt||value.leftAt>control.updatedAt)
      ||Object.entries(control.invites??{}).some(([id,value])=>!isPersonId(id)||!validInvite(value)||value.invitedAt>control.updatedAt))return false;
  const active=Object.entries(control.members).filter(([,value])=>value.active);
  if(control.kind==='group')return conversationId.startsWith('group_')&&titleOf(control.title)===control.title&&isPersonId(control.ownerId)
    &&active.filter(([,value])=>value.role==='owner').length===1&&control.members[control.ownerId]?.active===true&&control.members[control.ownerId]?.role==='owner'
    &&countParticipants(control)<=100;
  if(control.status!=='active'||control.ownerId!=null||Object.keys(control.invites??{}).length||active.length!==Object.keys(control.members).length||active.some(([,value])=>value.role!=='member'))return false;
  try{return conversationIdFor({roomId,kind:control.kind,personIds:active.map(([id])=>id)})===conversationId;}catch(_){return false;}
}

/** Returns the next control node, or a status without a mutation. This is not
 * a network endpoint and never grants access based on caller-supplied identity. */
export function applyConversationCommand(current,command,context){
  if(!record(command)||!Object.hasOwn(fields,command.type)||!record(context))return fail('invalid');
  const {personId:actor,roomId,conversationId,now,approvedPersonIds}=context;
  if(!isPersonId(actor)||!isMessagingRoomId(roomId)||!isConversationId(conversationId)||!isMessagingTimestamp(now)||!Array.isArray(approvedPersonIds))return fail('invalid');
  const approved=new Set(approvedPersonIds);if(!approved.has(actor))return fail('forbidden');
  const type=command.type,isCreate=creates.has(type),allowed=new Set(['type',...fields[type],...(!isCreate?['expectedRevision']:[])]);
  if(Object.keys(command).some(k=>!allowed.has(k)))return fail('invalid');
  if(current!=null&&!isValidConversationControl(current,conversationId,roomId))return fail('unavailable');
  if(current!=null&&now<current.updatedAt)return fail('conflict');
  if(isCreate){
    let kind,people,groupId,title;
    if(type==='openSelf'){kind='self';people=[actor];}
    else if(type==='openDirect'){
      if(!isPersonId(command.personId)||command.personId===actor)return fail('invalid');
      kind='direct';people=[actor,command.personId];
    }else{
      kind='group';groupId=conversationId.slice('group_'.length);title=titleOf(command.title);
      if(!title||!personList(command.invitees)||command.invitees.includes(actor)||command.invitees.length>99)return fail('invalid');
      people=[actor,...command.invitees];
    }
    if(people.some(id=>!approved.has(id)))return fail('forbidden');
    try{if(conversationIdFor({roomId,kind,personIds:people,...(kind==='group'?{groupId}:{})})!==conversationId)return fail('invalid');}catch(_){return fail('invalid');}
    if(current!=null){
      if(current.kind!==kind||current.members[actor]?.active!==true)return fail('forbidden');
      // Direct/self are deterministic. A group ID must not be silently reused.
      return kind==='group'?fail('conflict'):ok(structuredClone(current),false);
    }
    const control={id:conversationId,roomId,kind,status:'active',revision:1,createdAt:now,updatedAt:now,members:{},invites:{}};
    if(kind==='group'){
      control.title=title;control.ownerId=actor;control.members[actor]=member(now,'owner');
      for(const id of command.invitees)control.invites[id]=invite(now,actor);
    }else for(const id of people)control.members[id]=member(now);
    return ok(control);
  }
  if(!current||current.kind!=='group')return fail('forbidden');
  const me=current.members[actor],pending=current.invites?.[actor];
  if(type==='respondInvite'){
    if(pending?.state!=='pending'||me?.active===true||current.status!=='active')return fail('forbidden');
  }else if(me?.active!==true)return fail('forbidden');
  if(!Number.isSafeInteger(command.expectedRevision)||command.expectedRevision<1)return fail('invalid');
  if(command.expectedRevision!==current.revision)return fail('conflict');
  const manager=me?.role==='owner'||me?.role==='admin';
  if(current.status==='archived'&&!['setArchived','leave'].includes(type))return fail('forbidden');
  const next=structuredClone(current);next.invites??={};
  const target=command.personId;
  switch(type){
    case 'invite':
      if(!manager)return fail('forbidden');
      if(!personList(command.personIds)||!command.personIds.length||command.personIds.includes(actor))return fail('invalid');
      if(command.personIds.some(id=>!approved.has(id)))return fail('forbidden');
      for(const id of command.personIds){if(next.members[id]?.active===true||next.invites[id]?.state==='pending')continue;next.invites[id]=invite(now,actor);}
      if(countParticipants(next)>100)return fail('limit');
      break;
    case 'respondInvite':
      if(typeof command.accept!=='boolean')return fail('invalid');
      if(now<pending.invitedAt||me&&now<=me.joinedAt)return fail('conflict');
      next.invites[actor]={...pending,state:command.accept?'accepted':'declined',respondedAt:now};
      if(command.accept)next.members[actor]=member(now);
      break;
    case 'rename': {
      if(!manager)return fail('forbidden');const title=titleOf(command.title);if(!title)return fail('invalid');next.title=title;break;
    }
    case 'transferOwner':
      if(me.role!=='owner'||!isPersonId(target)||target===actor||!approved.has(target)||next.members[target]?.active!==true)return fail('forbidden');
      next.ownerId=target;next.members[target].role='owner';next.members[actor].role='admin';break;
    case 'removeMember':
      if(!manager||!isPersonId(target)||target===actor||next.members[target]?.active!==true||next.members[target].role==='owner'||me.role==='admin'&&next.members[target].role==='admin')return fail('forbidden');
      next.members[target]={...next.members[target],active:false,leftAt:now};break;
    case 'leave':
      if(me.role==='owner')return fail('forbidden');next.members[actor]={...me,active:false,leftAt:now};break;
    case 'setArchived':
      if(!manager)return fail('forbidden');if(typeof command.archived!=='boolean')return fail('invalid');next.status=command.archived?'archived':'active';break;
    default:return fail('invalid');
  }
  next.revision=current.revision+1;next.updatedAt=now;
  if(!isValidConversationControl(next,conversationId,roomId))return fail('unavailable');
  return ok(next);
}
