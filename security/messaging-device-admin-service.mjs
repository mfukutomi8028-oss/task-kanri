// Operator-only provisioning. No browser route and no implicit display-name
// approval. Device bindings are immutable as to person and room; revoke rather
// than deleting them, so an old UID cannot be silently assigned to another person.
import {isMessagingRoomId,isPersonId} from '../workspace-messaging-core.js';
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const reserved=new Set(['__proto__','constructor','prototype']);
const safeRoom=v=>isMessagingRoomId(v)&&!reserved.has(v);
const safeUid=v=>typeof v==='string'&&v.length>=1&&v.length<=128&&!/[.#$/\[\]\u0000-\u001f\u007f]/.test(v)&&!reserved.has(v);
const safeName=v=>typeof v==='string'&&v.length>=1&&v.length<=64&&v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v);
const fail=status=>({status});
const decision=(value,changed)=>({status:'ok',value,changed});
const fields={
  'register-person':['action','roomId','personId','displayName'],
  'approve-device':['action','roomId','personId','uid','displayName','reactivate'],
  'revoke-device':['action','roomId','personId','uid']
};
function validCommand(command){
  if(!record(command)||!Object.hasOwn(fields,command.action)||Object.keys(command).some(key=>!fields[command.action].includes(key))||!safeRoom(command.roomId)||!isPersonId(command.personId))return false;
  if(command.action==='register-person')return safeName(command.displayName);
  if(!safeUid(command.uid))return false;
  return command.action==='revoke-device'||safeName(command.displayName)&&(command.reactivate===undefined||typeof command.reactivate==='boolean');
}
function rosterValid(roster){return record(roster)&&Number.isSafeInteger(roster.revision)&&roster.revision>=1&&record(roster.people)&&Object.keys(roster.people).length<=1000&&Object.entries(roster.people).every(([id,person])=>isPersonId(id)&&record(person)&&safeName(person.displayName))&&new Set(Object.values(roster.people).map(p=>p.displayName)).size===Object.keys(roster.people).length;}
function registerRoster(current,{personId,displayName}){
  if(current===null)return decision({revision:1,people:{[personId]:{displayName}}},true);
  if(!rosterValid(current))return fail('unavailable');
  if(Object.hasOwn(current.people,personId))return current.people[personId].displayName===displayName?decision(current,false):fail('conflict');
  if(Object.values(current.people).some(person=>person.displayName===displayName))return fail('conflict');
  if(Object.keys(current.people).length>=1000||current.revision>=Number.MAX_SAFE_INTEGER)return fail('limit');
  return decision({...current,revision:current.revision+1,people:{...current.people,[personId]:{displayName}}},true);
}
function bindingMatches(value,{uid,roomId,personId}){return record(value)&&value.uid===uid&&value.roomId===roomId&&value.personId===personId&&safeName(value.displayName)&&typeof value.approved==='boolean'&&typeof value.active==='boolean';}
function approveBinding(current,{uid,roomId,personId,displayName,reactivate}){
  if(current===null)return reactivate===true?fail('conflict'):decision({uid,roomId,personId,displayName,approved:true,active:true},true);
  if(!bindingMatches(current,{uid,roomId,personId})||current.displayName!==displayName)return fail('conflict');
  if(current.approved===true&&current.active===true)return decision(current,false);
  if(reactivate!==true||current.approved!==false||current.active!==false)return fail('conflict');
  return decision({...current,approved:true,active:true},true);
}
function revokeBinding(current,command){
  if(current===null)return fail('not-found');
  if(!bindingMatches(current,command))return fail('conflict');
  if(current.approved===false&&current.active===false)return decision(current,false);
  return decision({...current,approved:false,active:false},true);
}
export function createMessagingDeviceAdmin({lookupUid,readRoster,readBinding,transactRoster,transactBinding}={}){
  if([lookupUid,readRoster,readBinding,transactRoster,transactBinding].some(fn=>typeof fn!=='function'))throw new TypeError('Trusted device administration adapters required');
  async function run(command,{apply=false}={}){
    if(typeof apply!=='boolean'||!validCommand(command))return fail('invalid');
    try{
      const {action,roomId,personId,uid,displayName}=command;
      const scope=Object.freeze(uid===undefined?{roomId}:{roomId,uid});
      if(action==='approve-device'){
        const roster=await readRoster({roomId});
        if(roster===null)return fail('forbidden');
        if(!rosterValid(roster))return fail('unavailable');
        if(roster.people[personId]?.displayName!==displayName)return fail('forbidden');
        const user=await lookupUid(uid);
        if(user?.uid!==uid||user.disabled!==false)return fail('forbidden');
      }
      const isRoster=action==='register-person';
      const plan=current=>isRoster?registerRoster(current,command):action==='approve-device'?approveBinding(current,command):revokeBinding(current,command);
      if(!apply){const result=plan(await (isRoster?readRoster(scope):readBinding(scope)));return result.status==='ok'?{status:'ok',changed:result.changed,applied:false}:fail(result.status);}
      const tx=await (isRoster?transactRoster(scope,plan):transactBinding(scope,plan));
      const result=tx?.decision;
      if(!result||typeof tx.committed!=='boolean'||result.status==='ok'&&(typeof result.changed!=='boolean'||tx.committed!==result.changed)||result.status!=='ok'&&tx.committed)return fail('unavailable');
      return result.status==='ok'?{status:'ok',changed:result.changed,applied:tx.committed}:fail(result.status);
    }catch(_){return fail('unavailable');}
  }
  return Object.freeze({run});
}
