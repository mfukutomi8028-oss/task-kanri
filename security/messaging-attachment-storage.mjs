// Trusted cloud adapters. The supplied Supabase client must be a server-only
// service-role client; never construct this adapter in a browser.
import {createMessagingAttachmentUploadService} from './messaging-attachment-upload.mjs';
import {MESSAGING_ATTACHMENT_MAX_BYTES} from './messaging-attachment-content.mjs';
const bucket='workboard-attachments-v1',table='workboard_attachments_v1';
const columns='attachment_id,room_id,conversation_id,uploader_id,membership_joined_at,request_id,request_slot,filename,mime,declared_bytes,state,expires_at,actual_bytes,sha256';
const unavailable=()=>({status:'unavailable'});
export function createFirebaseSupabaseAttachmentUploadService({auth,database,supabase,clock}={}){
  if(typeof auth?.verifyIdToken!=='function'||typeof database?.ref!=='function'||typeof supabase?.rpc!=='function'||typeof supabase?.from!=='function'||typeof supabase?.storage?.from!=='function')throw new TypeError('Trusted cloud attachment adapters required');
  const read=async path=>(await database.ref(path).get()).val();
  const scope=target=>({p_room_id:target.roomId,p_conversation_id:target.conversationId,p_uploader_id:target.uploaderId,p_joined_at:target.joinedAt,p_request_id:target.requestId,p_slot:target.slot});
  async function rpc(name,args){const {data,error}=await supabase.rpc(name,args);return error||!data||typeof data.status!=='string'?unavailable():data;}
  return createMessagingAttachmentUploadService({clock,
    verifyToken:token=>auth.verifyIdToken(token,true),
    readBinding:({roomId,uid})=>read('messagingAccessV1/'+roomId+'/'+uid),
    readControl:({roomId,conversationId})=>read('messagingV1/'+roomId+'/control/'+conversationId),
    reserve:target=>rpc('workboard_reserve_attachment_v1',{...scope(target),p_filename:target.filename,p_mime:target.mime,p_bytes:target.declaredBytes}),
    async readLedger(attachmentId){
      const {data,error}=await supabase.from(table).select(columns).eq('attachment_id',attachmentId).maybeSingle();
      if(error)throw new Error('Attachment ledger unavailable');if(!data)return null;
      return {attachmentId:data.attachment_id,roomId:data.room_id,conversationId:data.conversation_id,uploaderId:data.uploader_id,joinedAt:data.membership_joined_at,requestId:data.request_id,slot:data.request_slot,filename:data.filename,mime:data.mime,declaredBytes:data.declared_bytes,state:data.state,expiresAt:Date.parse(data.expires_at),actualBytes:data.actual_bytes,sha256:data.sha256};
    },
    async putObject(attachmentId,bytes,mime){
      const {data,error}=await supabase.storage.from(bucket).upload(attachmentId,bytes,{upsert:false,contentType:mime,cacheControl:'0'});
      return !error&&data?.path===attachmentId?{status:'stored'}:unavailable();
    },
    async readObject(attachmentId){
      const {data,error}=await supabase.storage.from(bucket).download(attachmentId);
      if(error||!Number.isSafeInteger(data?.size)||data.size<1||data.size>MESSAGING_ATTACHMENT_MAX_BYTES||typeof data.arrayBuffer!=='function')return null;
      const bytes=new Uint8Array(await data.arrayBuffer());return bytes.byteLength===data.size?bytes:null;
    },
    finalize:target=>rpc('workboard_finalize_attachment_v1',{p_attachment_id:target.attachmentId,...scope(target),p_actual_bytes:target.actualBytes,p_sha256:target.sha256})
  });
}
