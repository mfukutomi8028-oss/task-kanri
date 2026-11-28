// Called only after the existing HTTP boundary validates origin and bearer.
// The attachment service remains responsible for Firebase authorization.
import {isMessagingRoomId,isConversationId,isPersonId,isMessagingAttachmentId} from '../workspace-messaging-core.js';
const MAX=5000000;
const mimeTypes=new Set(['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','text/csv']);
const safeName=v=>typeof v==='string'&&v===v.trim()&&Array.from(v).length>=1&&Array.from(v).length<=200&&!/[\\/:\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(v);
const fields=['expectedPersonId','roomId','conversationId','requestId','slot','filename','mime','declaredBytes'];
const codes=Object.freeze({ok:200,invalid:400,forbidden:403,conflict:409,expired:409,'storage-limit':429,'daily-limit':429,limit:429,unavailable:503});
const validSize=v=>Number.isSafeInteger(v)&&v>=1&&v<=MAX;
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const encodeName=v=>encodeURIComponent(v).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
export function createMessagingAttachmentHttp({attachments}={}){
  if(typeof attachments?.upload!=='function'||typeof attachments?.download!=='function')throw new TypeError('Attachment services required');
  function error(result,json){const status=Object.hasOwn(codes,result?.status)&&result.status!=='ok'?result.status:'unavailable';return json(codes[status],{status});}
  async function upload(request,token,json,protect=(_metadata,perform)=>perform()){
    try{
      const header=request.headers.get('X-Workboard-Upload');
      if(!header||header.length>4096||!request.body)return json(400,{status:'invalid'});
      let metadata;try{metadata=JSON.parse(decodeURIComponent(header));}catch(_){return json(400,{status:'invalid'});}
      if(!record(metadata)||Object.keys(metadata).length!==fields.length||Object.keys(metadata).some(k=>!fields.includes(k))||!isPersonId(metadata.expectedPersonId)||!isMessagingRoomId(metadata.roomId)||!isConversationId(metadata.conversationId)||typeof metadata.requestId!=='string'||!/^q_[0-9a-f]{32}$/.test(metadata.requestId)||!Number.isInteger(metadata.slot)||metadata.slot<0||metadata.slot>4||!safeName(metadata.filename)||!mimeTypes.has(metadata.mime)||!validSize(metadata.declaredBytes))return json(400,{status:'invalid'});
      const length=request.headers.get('Content-Length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)!==metadata.declaredBytes))return json(400,{status:'invalid'});
      return await protect(metadata,async()=>{
        const result=await attachments.upload({...metadata,token,body:request.body});
        if(result?.status!=='ok')return error(result,json);
        if(!isMessagingAttachmentId(result.attachmentId)||result.filename!==metadata.filename||result.mime!==metadata.mime||result.bytes!==metadata.declaredBytes)return json(503,{status:'unavailable'});
        return json(200,{status:'ok',attachmentId:result.attachmentId,filename:result.filename,mime:result.mime,bytes:result.bytes});
      });
    }catch(_){return json(503,{status:'unavailable'});}
  }
  async function download(input,headers,json){
    try{
      const result=await attachments.download(input);if(result?.status!=='ok')return error(result,json);
      if(!safeName(result.filename)||!mimeTypes.has(result.mime)||!(result.bytes instanceof Uint8Array)||!validSize(result.bytes.byteLength))return json(503,{status:'unavailable'});
      const encoded=encodeName(result.filename),h=new Headers(headers);
      h.set('Content-Type','application/octet-stream');h.set('Content-Disposition',"attachment; filename=download; filename*=UTF-8''"+encoded);
      h.set('Content-Length',String(result.bytes.byteLength));h.set('X-Workboard-Filename',encoded);h.set('X-Workboard-Mime',result.mime);
      h.set('Access-Control-Expose-Headers','X-Workboard-Filename, X-Workboard-Mime, Content-Length');
      return new Response(result.bytes,{status:200,headers:h});
    }catch(_){return json(503,{status:'unavailable'});}
  }
  return Object.freeze({upload,download});
}
