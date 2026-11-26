// A trusted server publishes an opaque invalidation marker after a message
// commit. No body, sender, timestamp, count, or historical sequence is stored.
import {randomUUID} from 'node:crypto';
import {isMessagingRoomId,isConversationId} from '../test-harness/messaging-preview/workspace-messaging-core.js';
import {isMessagingActivityToken} from '../test-harness/messaging-preview/workspace-messaging-activity.js';
export function createFirebaseMessagingActivityPublisher({database,makeToken=randomUUID}={}){
  if(typeof database?.ref!=='function'||typeof makeToken!=='function')throw new TypeError('Trusted activity publisher required');
  return async function publish({roomId,conversationId}={}){
    if(!isMessagingRoomId(roomId)||!isConversationId(conversationId))return {status:'invalid'};
    try{
      const value=makeToken();if(!isMessagingActivityToken(value))return {status:'unavailable'};
      await database.ref('messagingV1/'+roomId+'/activity/'+conversationId).set(value);
      return {status:'ok'};
    }catch(_){return {status:'unavailable'};}
  };
}
