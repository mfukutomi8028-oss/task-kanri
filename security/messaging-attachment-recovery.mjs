// Read-only diagnosis. Operators still need a durable maintenance lease and
// a fresh canonical check before any deletion or capacity release.
import {createHash} from 'node:crypto';
import {isConversationId,isMessagingRoomId,isMessagingAttachmentId,isPersonId,isMessagingTimestamp,messageIdFor} from '../workspace-messaging-core.js';

export async function inspectMessagingAttachment({roomId,attachmentId},{readLedger,readMessage,readObject,readFence}={}){
  if(!isMessagingRoomId(roomId)||!isMessagingAttachmentId(attachmentId))return {status:'invalid'};
  try{
    const row=await readLedger(attachmentId);
    if(!row||row.attachmentId!==attachmentId||row.roomId!==roomId||!isConversationId(row.conversationId)||!isPersonId(row.uploaderId)||!isMessagingTimestamp(row.joinedAt))return {status:'unknown'};
    const messageId=messageIdFor(row.uploaderId,row.requestId);
    if(row.messageId!==null&&row.messageId!==messageId)return {status:'unknown'};
    const scope={roomId,conversationId:row.conversationId,messageId};
    const [message,fence]=await Promise.all([readMessage(scope),readFence(scope)]);
    if(fence!==null&&!['send','maintenance'].includes(fence?.kind))return {status:'unknown'};
    if(message!==null&&(message?.id!==messageId||message.senderId!==row.uploaderId||!isMessagingTimestamp(message.createdAt)||message.createdAt<=row.joinedAt))return {status:'unknown'};
    if(message?.deletedAt!=null)return {status:'retained'};
    const linked=message!==null&&message.attachmentIds?.includes(attachmentId)===true;
    if(message!==null&&!linked)return {status:'protected'};
    if(fence!==null)return {status:'pending'};
    if(row.state==='reserved'||row.state==='uploaded'||row.state==='ready')return {status:linked?'unknown':'pending'};
    if(!['attached','deleting'].includes(row.state)||row.messageId!==messageId)return {status:'unknown'};
    const bytes=await readObject(attachmentId);
    if(!(bytes instanceof Uint8Array)||bytes.byteLength!==row.actualBytes||row.actualBytes!==row.declaredBytes
      ||createHash('sha256').update(bytes).digest('hex')!==row.sha256)return {status:'unknown'};
    return {status:linked?'committed':'orphan-candidate'};
  }catch(_){return {status:'unknown'};}
}
