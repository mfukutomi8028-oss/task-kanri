// Runtime-neutral authenticated HTTP boundary. The injected services enforce
// authorization. CORS is a browser restriction, not a substitute for auth.
import {isPersonId} from '../test-harness/messaging-preview/workspace-messaging-core.js';
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
export function createMessagingApiHandler({allowedOrigins,history,mutation,directory,conversations}={}){
  if(!Array.isArray(allowedOrigins)||!allowedOrigins.length||allowedOrigins.some(origin=>{try{const url=new URL(origin);return url.protocol!=='https:'||url.origin!==origin;}catch(_){return true;}}))throw new TypeError('Explicit HTTPS origins required');
  const origins=new Set(allowedOrigins);
  const operations={history:history?.readHistory,message:mutation?.mutate,directory:directory?.readDirectory,people:conversations?.readPeople,conversation:conversations?.execute};
  if(Object.values(operations).some(fn=>typeof fn!=='function'))throw new TypeError('Messaging services required');
  return async function handle(request){
    const origin=request.headers.get('Origin'),allowed=origins.has(origin);
    const headers=new Headers({'Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'});
    if(allowed)headers.set('Access-Control-Allow-Origin',origin);
    function json(status,value){const h=new Headers(headers);h.set('Content-Type','application/json; charset=utf-8');return new Response(JSON.stringify(value),{status,headers:h});}
    if(!allowed)return json(403,{status:'forbidden'});
    if(request.method==='OPTIONS'){
      const requested=(request.headers.get('Access-Control-Request-Headers')||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
      if(request.headers.get('Access-Control-Request-Method')!=='POST'||requested.some(v=>!['authorization','content-type'].includes(v)))return json(403,{status:'forbidden'});
      headers.set('Access-Control-Allow-Methods','POST, OPTIONS');headers.set('Access-Control-Allow-Headers','Authorization, Content-Type');return new Response(null,{status:204,headers});
    }
    if(request.method!=='POST'){headers.set('Allow','POST, OPTIONS');return json(405,{status:'invalid'});}
    const bearer=/^Bearer ([^\s,]+)$/i.exec(request.headers.get('Authorization')||'');
    if(!bearer||bearer[1].length>MAX_TOKEN)return json(401,{status:'forbidden'});
    if(!/^application\/json(?:\s*;\s*charset\s*=\s*utf-8)?$/i.test(request.headers.get('Content-Type')||''))return json(415,{status:'invalid'});
    const decoded=await readJson(request);if(decoded.error)return json(decoded.error,{status:'invalid'});
    const body=decoded.value;
    if(!record(body)||Object.keys(body).length!==3||typeof body.action!=='string'||!Object.hasOwn(operations,body.action)||!isPersonId(body.expectedPersonId)||!record(body.payload)||Object.hasOwn(body.payload,'token')||Object.hasOwn(body.payload,'expectedPersonId'))return json(400,{status:'invalid'});
    try{
      const result=await operations[body.action]({...body.payload,token:bearer[1],expectedPersonId:body.expectedPersonId});
      if(!record(result)||typeof result.status!=='string'||!Object.hasOwn(codes,result.status))return json(503,{status:'unavailable'});
      return json(codes[result.status],result);
    }catch(_){return json(503,{status:'unavailable'});}
  };
}
