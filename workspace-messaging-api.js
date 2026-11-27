// Browser-to-server transport. Bearer credentials stay in the request header.
// No server secrets, direct privileged writes or production endpoint defaults.
import {isMessagingRoomId,isPersonId,isConversationId,isMessageId,isMessagingAttachmentId} from './workspace-messaging-core.js';
const fail=status=>({status});
const bound=value=>value?.status==='bound'&&isMessagingRoomId(value.roomId)&&isPersonId(value.personId)?{roomId:value.roomId,personId:value.personId}:null;
const same=(a,b)=>a===null&&b===null||a!==null&&b!==null&&a.roomId===b.roomId&&a.personId===b.personId;
const MAX_FILE_BYTES=5000000;
const validFileSize=v=>Number.isSafeInteger(v)&&v>=1&&v<=MAX_FILE_BYTES;
const safeFilename=v=>typeof v==='string'&&v===v.trim()&&Array.from(v).length>=1&&Array.from(v).length<=200&&!/[\\/:\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(v);
const codes=Object.freeze({ok:200,sent:200,invalid:400,forbidden:403,conflict:409,stale:409,limit:429,expired:409,'storage-limit':429,'daily-limit':429,unavailable:503});
export function createMessagingApiTransport({endpoint,session,getToken,fetchImpl=globalThis.fetch}={}){
  let url;try{url=new URL(endpoint);}catch(_){throw new TypeError('HTTPS endpoint required');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||typeof session?.subscribe!=='function'||typeof session?.getSnapshot!=='function'||typeof getToken!=='function'||typeof fetchImpl!=='function')throw new TypeError('HTTPS endpoint and bound session required');
  let identity=null,generation=0,disposed=false;const active=new Set(),retryUntil=new Map();
  function invalidate(){generation++;for(const controller of active)controller.abort();active.clear();retryUntil.clear();}
  const stop=session.subscribe(value=>{const next=bound(value);if(!same(identity,next)){invalidate();identity=next;}});
  if(typeof stop!=='function')throw new TypeError('Disposable session required');
  async function invoke(action,payload,file=null){
    if(disposed||!identity||payload.roomId!==identity.roomId||!same(identity,bound(session.getSnapshot())))return fail('locked');
    const cooldown=retryUntil.get(action)??0;
    if(cooldown>Date.now())return {status:'limit',retryAfter:Math.ceil((cooldown-Date.now())/1000)};
    const tokenGeneration=generation,actor=identity,controller=new AbortController();active.add(controller);
    const current=()=>!disposed&&generation===tokenGeneration&&same(actor,bound(session.getSnapshot()));
    const timeout=setTimeout(()=>controller.abort(),file||action==='attachmentDownload'?60000:20000);
    try{
      const token=await getToken();if(!current())return fail('locked');
      if(typeof token!=='string'||!token||token.length>16384||/[\s,]/.test(token))return fail('locked');
      const headers={Authorization:'Bearer '+token,'Content-Type':file?'application/octet-stream':'application/json'};
      if(file)headers['X-Workboard-Upload']=encodeURIComponent(JSON.stringify({...payload,expectedPersonId:actor.personId}));
      const response=await fetchImpl(url.href,{method:'POST',headers,body:file??JSON.stringify({action,payload,expectedPersonId:actor.personId}),mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});
      if(!current())return fail('locked');if(controller.signal.aborted)return fail('unavailable');
      if(action==='attachmentDownload'&&response.status===200){
        const length=response.headers.get('Content-Length'),count=Number(length),mime=response.headers.get('X-Workboard-Mime');
        let filename;try{filename=decodeURIComponent(response.headers.get('X-Workboard-Filename')||'');}catch(_){return fail('unavailable');}
        if(response.headers.get('Content-Type')!=='application/octet-stream'||length===null||!/^\d+$/.test(length)||!validFileSize(count)||!safeFilename(filename)||typeof mime!=='string'||!mime||mime.length>150||!response.body)return fail('unavailable');
        const reader=response.body.getReader(),bytes=new Uint8Array(count);let offset=0;
        try{for(;;){const {done,value}=await reader.read();if(!current())return fail('locked');if(controller.signal.aborted)return fail('unavailable');if(done)break;if(!(value instanceof Uint8Array)||offset+value.byteLength>count)return fail('unavailable');bytes.set(value,offset);offset+=value.byteLength;}}
        finally{if(offset!==count)try{await reader.cancel();}catch(_){}reader.releaseLock();}
        if(!current())return fail('locked');if(offset!==count)return fail('unavailable');
        return {status:'ok',filename,mime,bytes};
      }
      const value=await response.json();if(!current())return fail('locked');if(controller.signal.aborted)return fail('unavailable');
      if(!value||typeof value!=='object'||!Object.hasOwn(codes,value.status))return fail('unavailable');
      if(value.status==='forbidden'&&response.status===401)return fail('forbidden');
      if(codes[value.status]!==response.status)return fail('unavailable');
      if(value.status==='limit'&&Number.isSafeInteger(value.retryAfter)&&value.retryAfter>=1&&value.retryAfter<=3600){
        retryUntil.set(action,Date.now()+value.retryAfter*1000);
      }
      if(value.status==='ok'&&['directory','people','unread'].includes(action)&&(value.roomId!==actor.roomId||value.personId!==actor.personId))return fail('locked');
      if(value.status==='ok'&&action==='unread'&&value.conversationId!==payload.conversationId)return fail('unavailable');
      if(action==='attachmentUpload'&&value.status==='ok'&&(!isMessagingAttachmentId(value.attachmentId)||value.filename!==payload.filename||value.mime!==payload.mime||value.bytes!==payload.declaredBytes))return fail('unavailable');
      if(action==='attachmentUsage'&&value.status==='ok'&&!['globalBytes','personBytes','conversationBytes','dailyBytes','limitBytes','warnBytes','cleanupBytes','dailyLimitBytes'].every(key=>Number.isSafeInteger(value[key])&&value[key]>=0))return fail('unavailable');
      return value;
    }catch(_){return fail(current()?'unavailable':'locked');}finally{clearTimeout(timeout);active.delete(controller);}
  }
  return Object.freeze({
    uploadAttachment:({roomId,conversationId,requestId,slot,filename,mime,file}={})=>{
      if(!(file instanceof Blob)||!validFileSize(file.size)||!safeFilename(filename)||typeof mime!=='string'||!mime||mime.length>150||!isConversationId(conversationId)||typeof requestId!=='string'||!/^q_[0-9a-f]{32}$/.test(requestId)||!Number.isInteger(slot)||slot<0||slot>4)return Promise.resolve(fail('invalid'));
      return invoke('attachmentUpload',{roomId,conversationId,requestId,slot,filename,mime,declaredBytes:file.size},file);
    },
    readAttachmentMetadata:({roomId,conversationId,items}={})=>isConversationId(conversationId)&&Array.isArray(items)&&items.length>=1&&items.length<=20?invoke('attachmentMetadata',{roomId,conversationId,items}):Promise.resolve(fail('invalid')),
    readAttachmentUsage:({roomId,conversationId}={})=>isConversationId(conversationId)?invoke('attachmentUsage',{roomId,conversationId}):Promise.resolve(fail('invalid')),
    downloadAttachment:({roomId,conversationId,messageId,attachmentId}={})=>isConversationId(conversationId)&&isMessageId(messageId)&&isMessagingAttachmentId(attachmentId)?invoke('attachmentDownload',{roomId,conversationId,messageId,attachmentId}):Promise.resolve(fail('invalid')),
    readHistory:({roomId,conversationId,before=null,limit=50}={})=>invoke('history',{roomId,conversationId,before,limit}),
    send:({roomId,conversationId,requestId,input}={})=>invoke('message',{roomId,conversationId,command:{type:'send',requestId,input}}),
    edit:({roomId,conversationId,messageId,expectedRevision,input}={})=>invoke('message',{roomId,conversationId,command:{type:'edit',messageId,expectedRevision,input}}),
    remove:({roomId,conversationId,messageId,expectedRevision}={})=>invoke('message',{roomId,conversationId,command:{type:'remove',messageId,expectedRevision}}),
    readDirectory:({roomId,after=null,limit=100}={})=>invoke('directory',{roomId,after,limit}),
    readUnread:({roomId,conversationId}={})=>invoke('unread',{roomId,conversationId}),
    readPeople:({roomId}={})=>invoke('people',{roomId}),
    executeConversation:({roomId,conversationId,command}={})=>invoke('conversation',{roomId,conversationId,command}),
    dispose(){if(disposed)return;disposed=true;invalidate();identity=null;stop();}
  });
}
