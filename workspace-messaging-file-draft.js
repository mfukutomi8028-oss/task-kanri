// Local file selection is only a UX check; the server verifies all bytes.
import {isMessagingAttachmentId,isMessagingRoomId,isConversationId} from './workspace-messaging-core.js';
const types=Object.freeze({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',pdf:'application/pdf',txt:'text/plain',csv:'text/csv',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
const imageExtensions=Object.freeze({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'});
const MAX_FILE_BYTES=5000000,TARGET_IMAGE_BYTES=500000,MAX_IMAGE_EDGE=2048;
// Screenshots keep text readable: PNG is never shrunk below 1600px, photos not below 1280px. The byte target is a goal, not a limit.
const minEdge=mime=>mime==='image/png'?1600:1280;
export const messagingFileAccept=Object.keys(types).map(extension=>'.'+extension).join(',');
const fail=status=>({status});
function describe(file){
  if(!(file instanceof Blob)||typeof file.name!=='string'||file.name!==file.name.trim()||Array.from(file.name).length<1||Array.from(file.name).length>200||/[\\/:\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(file.name)||!Number.isSafeInteger(file.size)||file.size<1||file.size>MAX_FILE_BYTES)return null;
  const extension=file.name.split('.').at(-1).toLowerCase();if(!file.name.includes('.')||!Object.hasOwn(types,extension))return null;
  return Object.freeze({file,filename:file.name,mime:types[extension]});
}
export function selectMessagingFiles(existing,selected){
  const files=[...existing];let rejected=0;
  for(const file of selected){const item=describe(file);if(!item||files.length>=5){rejected++;continue;}files.push(item);}
  return {files,rejected};
}
async function encodeImage({file,filename,mime}){
  const image=await createImageBitmap(file,{imageOrientation:'from-image'});
  const canvas=document.createElement('canvas');
  try{
    if(!image.width||!image.height||image.width*image.height>40000000)throw new TypeError('Invalid image dimensions');
    const context=canvas.getContext('2d');
    if(!context)throw new Error('Image encoding unavailable');
    let edge=Math.min(MAX_IMAGE_EDGE,Math.max(image.width,image.height)),blob;
    const floor=Math.min(edge,minEdge(mime));
    for(;;){
      const scale=edge/Math.max(image.width,image.height);
      canvas.width=Math.max(1,Math.round(image.width*scale));
      canvas.height=Math.max(1,Math.round(image.height*scale));
      context.drawImage(image,0,0,canvas.width,canvas.height);
      blob=await new Promise(resolve=>canvas.toBlob(resolve,mime,0.88));
      if(!blob?.size||!Object.hasOwn(imageExtensions,blob.type))throw new Error('Image encoding unavailable');
      if(blob.size<=TARGET_IMAGE_BYTES||edge<=floor)break;
      edge=Math.max(floor,Math.floor(edge*0.75));
    }
    const stem=filename.slice(0,filename.lastIndexOf('.'));
    const name=blob.type===mime?filename:Array.from(stem).slice(0,196).join('')+'.'+imageExtensions[blob.type];
    const item=describe(new File([blob],name,{type:blob.type}));
    if(!item)throw new Error('Converted image exceeds attachment limit');
    return item;
  }finally{image.close();canvas.width=canvas.height=1;}
}
// Re-encodes (dropping EXIF) newly selected images once, at selection time. Never falls back to the original silently.
export async function prepareMessagingFiles(files,{keepOriginalImages=false,isCurrent=()=>true}={}){
  const prepared=[];
  try{
    for(const item of files){
      if(!isCurrent())return fail('locked');
      prepared.push(!keepOriginalImages&&Object.hasOwn(imageExtensions,item.mime)?await encodeImage(item):item);
    }
    return isCurrent()?{status:'ok',files:prepared}:fail('locked');
  }catch(_){return fail(isCurrent()?'image-preparation-failed':'locked');}
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
