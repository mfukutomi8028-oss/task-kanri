// Local file selection is only a UX check; the server verifies all bytes.
import {isMessagingAttachmentId,isMessagingRoomId,isConversationId} from './workspace-messaging-core.js';
const types=Object.freeze({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',pdf:'application/pdf',txt:'text/plain',csv:'text/csv',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
export const messagingFileAccept=Object.keys(types).map(extension=>'.'+extension).join(',');
const fail=status=>({status});
function describe(file){
  if(!(file instanceof Blob)||typeof file.name!=='string'||file.name!==file.name.trim()||Array.from(file.name).length<1||Array.from(file.name).length>200||/[\\/:\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(file.name)||!Number.isSafeInteger(file.size)||file.size<1||file.size>5000000)return null;
  const extension=file.name.split('.').at(-1).toLowerCase();if(!file.name.includes('.')||!Object.hasOwn(types,extension))return null;
  return Object.freeze({file,filename:file.name,mime:types[extension]});
}
export function selectMessagingFiles(existing,selected){
  const files=[...existing];let rejected=0;
  for(const file of selected){const item=describe(file);if(!item||files.length>=5){rejected++;continue;}files.push(item);}
  return {files,rejected};
}
export async function uploadMessagingFiles({files,uploaded,transport,scope,isCurrent}={}){
  if(!Array.isArray(files)||files.length>5||!Array.isArray(uploaded)||uploaded.length>files.length||typeof isCurrent!=='function'||typeof transport?.uploadAttachment!=='function'||!isMessagingRoomId(scope?.roomId)||!isConversationId(scope?.conversationId)||typeof scope.requestId!=='string'||!/^q_[0-9a-f]{32}$/.test(scope.requestId))return fail('invalid');
  const attachmentIds=[];
  try{
    for(let slot=0;slot<files.length;slot++){
      if(!isCurrent())return fail('locked');const item=files[slot],description=describe(item?.file);if(!description||description.filename!==item.filename||description.mime!==item.mime)return fail('invalid');
      if(slot<uploaded.length){const prior=uploaded[slot];if(prior?.file!==item.file||!isMessagingAttachmentId(prior.attachmentId)||attachmentIds.includes(prior.attachmentId))return fail('conflict');attachmentIds.push(prior.attachmentId);continue;}
      const result=await transport.uploadAttachment({...scope,slot,...description});if(!isCurrent())return fail('locked');
      if(result?.status!=='ok')return fail(['invalid','conflict','expired','storage-limit','daily-limit','forbidden','locked'].includes(result?.status)?result.status:'unavailable');
      if(!isMessagingAttachmentId(result.attachmentId)||attachmentIds.includes(result.attachmentId)||result.filename!==item.filename||result.mime!==item.mime||result.bytes!==item.file.size)return fail('unavailable');
      uploaded.push({file:item.file,attachmentId:result.attachmentId});attachmentIds.push(result.attachmentId);
    }
    return isCurrent()?{status:'ok',attachmentIds}:fail('locked');
  }catch(_){return fail(isCurrent()?'unavailable':'locked');}
}
