// Runtime-neutral authenticated HTTP boundary. The injected services enforce
// authorization. CORS is a browser restriction, not a substitute for auth.
import {messagingBudgetDecision} from './messaging-budget.mjs';
import {isPersonId,isMessagingRoomId} from '../workspace-messaging-core.js';
import {createMessagingAttachmentHttp} from './messaging-attachment-http.mjs';
const MAX_BODY_BYTES=65536,MAX_TOKEN=16384;
const record=v=>v!==null&&typeof v==='object'&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const codes=Object.freeze({ok:200,sent:200,invalid:400,forbidden:403,conflict:409,stale:409,limit:429,unavailable:503});
async function readJson(request){
  const advertised=request.headers.get('Content-Length');if(advertised!==null&&Number(advertised)>MAX_BODY_BYTES)return {error:413};
  if(!request.body)return {error:400};
  const reader=request.body.getReader(),parts=[];let size=0;
  try{
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY_BYTES){await reader.cancel();return {error:413};}parts.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
    return {value:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))};
  }catch(_){return {error:400};}finally{reader.releaseLock();}
}
function workUnits(action,payload){
  const bounded=(value,max)=>Number.isInteger(value)&&value>=1&&value<=max?value:max;
  if(action==='directory')return 4+3*bounded(payload.limit,100);
  if(action==='history')return 8+bounded(payload.limit,50);
  if(action==='attachmentMetadata')return 10+3*bounded(payload.items?.length,20);
  if(action==='unread')return 130;
  if(action==='conversation')return 128;
  if(action==='attachmentUpload'||action==='attachmentDownload')return 64;
  return 24;
}
export function createMessagingApiHandler({allowedOrigins,history,mutation,directory,conversations,attachments=null,reserveRequest=null,checkAvailable=null,authorizeRequest=null}={}){
  if(!Array.isArray(allowedOrigins)||!allowedOrigins.length||allowedOrigins.some(origin=>{try{const url=new URL(origin);return url.protocol!=='https:'||url.origin!==origin;}catch(_){return true;}}))throw new TypeError('Explicit HTTPS origins required');
  if(checkAvailable!==null&&typeof checkAvailable!=='function')throw new TypeError('Invalid messaging stop control');
  if(authorizeRequest!==null&&typeof authorizeRequest!=='function')throw new TypeError('Invalid messaging request authorization');
  if(reserveRequest!==null&&(typeof reserveRequest!=='function'||!authorizeRequest))throw new TypeError('Invalid messaging request budget');
  const origins=new Set(allowedOrigins);
  const attachmentHttp=attachments===null?null:createMessagingAttachmentHttp({attachments});
  const operations={history:history?.readHistory,message:mutation?.mutate,directory:directory?.readDirectory,unread:directory?.readUnread,people:conversations?.readPeople,conversation:conversations?.execute,...(typeof attachments?.metadata==='function'?{attachmentMetadata:attachments.metadata}:{})};
  if(Object.values(operations).some(fn=>typeof fn!=='function'))throw new TypeError('Messaging services required');
  return async function handle(request){
    const origin=request.headers.get('Origin'),allowed=origins.has(origin);
    const headers=new Headers({'Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'});
    if(allowed)headers.set('Access-Control-Allow-Origin',origin);
    function json(status,value){const h=new Headers(headers);h.set('Content-Type','application/json; charset=utf-8');if(status===429&&Number.isSafeInteger(value.retryAfter))h.set('Retry-After',String(value.retryAfter));return new Response(JSON.stringify(value),{status,headers:h});}
    async function budget(action,payload,actor){
      if(!reserveRequest)return null;
      const result=messagingBudgetDecision(await reserveRequest(action,workUnits(action,payload),actor?.personId));
      return result.status==='ok'?null:json(codes[result.status],result);
    }
    const unavailable=()=>json(503,{status:'unavailable'});
    const enabled=async()=>!checkAvailable||await checkAvailable()===true;
    async function protect(action,payload,expectedPersonId,perform){
      let actor=null;
      if(authorizeRequest){
        if(!isMessagingRoomId(payload.roomId))return json(400,{status:'invalid'});
        actor=await authorizeRequest({token:bearer[1],roomId:payload.roomId});
        if(!actor||actor.personId!==expectedPersonId)return json(403,{status:'forbidden'});
      }
      if(!await enabled())return unavailable();
      const limited=await budget(action,payload,actor);
      if(limited)return limited;
      const response=await perform();
      return response.ok&&!await enabled()?unavailable():response;
    }
    if(!allowed)return json(403,{status:'forbidden'});
    if(request.method==='OPTIONS'){
      const requested=(request.headers.get('Access-Control-Request-Headers')||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
      if(request.headers.get('Access-Control-Request-Method')!=='POST'||requested.some(v=>!['authorization','content-type',...(attachmentHttp?['x-workboard-upload']:[])].includes(v)))return json(403,{status:'forbidden'});
      headers.set('Access-Control-Max-Age','600');headers.set('Access-Control-Allow-Methods','POST, OPTIONS');headers.set('Access-Control-Allow-Headers',attachmentHttp?'Authorization, Content-Type, X-Workboard-Upload':'Authorization, Content-Type');return new Response(null,{status:204,headers});
    }
    if(request.method!=='POST'){headers.set('Allow','POST, OPTIONS');return json(405,{status:'invalid'});}
    const bearer=/^Bearer ([^\s,]+)$/i.exec(request.headers.get('Authorization')||'');
    if(!bearer||bearer[1].length>MAX_TOKEN)return json(401,{status:'forbidden'});
    if(attachmentHttp&&request.headers.get('Content-Type')==='application/octet-stream'){
      try{return await attachmentHttp.upload(request,bearer[1],json,(metadata,perform)=>protect('attachmentUpload',metadata,metadata.expectedPersonId,perform));}
      catch(_){return json(503,{status:'unavailable'});}
    }
    if(!/^application\/json(?:\s*;\s*charset\s*=\s*utf-8)?$/i.test(request.headers.get('Content-Type')||''))return json(415,{status:'invalid'});
    const decoded=await readJson(request);if(decoded.error)return json(decoded.error,{status:'invalid'});
    const body=decoded.value;
    if(!record(body)||Object.keys(body).length!==3||typeof body.action!=='string'||(!Object.hasOwn(operations,body.action)&&!(attachmentHttp&&body.action==='attachmentDownload'))||!isPersonId(body.expectedPersonId)||!record(body.payload)||Object.hasOwn(body.payload,'token')||Object.hasOwn(body.payload,'expectedPersonId'))return json(400,{status:'invalid'});
    try{return await protect(body.action,body.payload,body.expectedPersonId,async()=>{
      if(body.action==='attachmentDownload')return attachmentHttp.download({...body.payload,token:bearer[1],expectedPersonId:body.expectedPersonId},headers,json);
      const result=await operations[body.action]({...body.payload,token:bearer[1],expectedPersonId:body.expectedPersonId});
      if(!record(result)||typeof result.status!=='string'||!Object.hasOwn(codes,result.status))return json(503,{status:'unavailable'});
      return json(codes[result.status],result);
    });}catch(_){return json(503,{status:'unavailable'});}
  };
}
