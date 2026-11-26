// Browser-to-server transport. Bearer credentials stay in the request header.
// No server secrets, direct privileged writes or production endpoint defaults.
import {isMessagingRoomId,isPersonId} from './workspace-messaging-core.js';
const fail=status=>({status});
const bound=value=>value?.status==='bound'&&isMessagingRoomId(value.roomId)&&isPersonId(value.personId)?{roomId:value.roomId,personId:value.personId}:null;
const same=(a,b)=>a===null&&b===null||a!==null&&b!==null&&a.roomId===b.roomId&&a.personId===b.personId;
const codes=Object.freeze({ok:200,sent:200,invalid:400,forbidden:403,conflict:409,stale:409,limit:429,unavailable:503});
export function createMessagingApiTransport({endpoint,session,getToken,fetchImpl=globalThis.fetch}={}){
  let url;try{url=new URL(endpoint);}catch(_){throw new TypeError('HTTPS endpoint required');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||typeof session?.subscribe!=='function'||typeof session?.getSnapshot!=='function'||typeof getToken!=='function'||typeof fetchImpl!=='function')throw new TypeError('HTTPS endpoint and bound session required');
  let identity=null,generation=0,disposed=false;const active=new Set();
  function invalidate(){generation++;for(const controller of active)controller.abort();active.clear();}
  const stop=session.subscribe(value=>{const next=bound(value);if(!same(identity,next)){invalidate();identity=next;}});
  if(typeof stop!=='function')throw new TypeError('Disposable session required');
  async function invoke(action,payload){
    if(disposed||!identity||payload.roomId!==identity.roomId||!same(identity,bound(session.getSnapshot())))return fail('locked');
    const tokenGeneration=generation,actor=identity,controller=new AbortController();active.add(controller);
    const current=()=>!disposed&&generation===tokenGeneration&&same(actor,bound(session.getSnapshot()));
    const timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const token=await getToken();if(!current())return fail('locked');
      if(typeof token!=='string'||!token||token.length>16384||/[\s,]/.test(token))return fail('locked');
      const response=await fetchImpl(url.href,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,payload,expectedPersonId:actor.personId}),mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});
      if(!current())return fail('locked');if(controller.signal.aborted)return fail('unavailable');
      const value=await response.json();if(!current())return fail('locked');if(controller.signal.aborted)return fail('unavailable');
      if(!value||typeof value!=='object'||!Object.hasOwn(codes,value.status))return fail('unavailable');
      if(value.status==='forbidden'&&response.status===401)return fail('forbidden');
      if(codes[value.status]!==response.status)return fail('unavailable');
      if(value.status==='ok'&&['directory','people'].includes(action)&&(value.roomId!==actor.roomId||value.personId!==actor.personId))return fail('locked');
      return value;
    }catch(_){return fail(current()?'unavailable':'locked');}finally{clearTimeout(timeout);active.delete(controller);}
  }
  return Object.freeze({
    readHistory:({roomId,conversationId,before=null,limit=50}={})=>invoke('history',{roomId,conversationId,before,limit}),
    send:({roomId,conversationId,requestId,input}={})=>invoke('message',{roomId,conversationId,command:{type:'send',requestId,input}}),
    edit:({roomId,conversationId,messageId,expectedRevision,input}={})=>invoke('message',{roomId,conversationId,command:{type:'edit',messageId,expectedRevision,input}}),
    remove:({roomId,conversationId,messageId,expectedRevision}={})=>invoke('message',{roomId,conversationId,command:{type:'remove',messageId,expectedRevision}}),
    readDirectory:({roomId,after=null,limit=100}={})=>invoke('directory',{roomId,after,limit}),
    readPeople:({roomId}={})=>invoke('people',{roomId}),
    executeConversation:({roomId,conversationId,command}={})=>invoke('conversation',{roomId,conversationId,command}),
    dispose(){if(disposed)return;disposed=true;invalidate();identity=null;stop();}
  });
}
