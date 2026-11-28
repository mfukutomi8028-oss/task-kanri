import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectMessagingAttachment} from '../security/messaging-attachment-recovery.mjs';

const roomId='roomA',attachmentId='00000000-0000-4000-8000-000000000001',uploaderId='p_'+'a'.repeat(32),requestId='q_'+'c'.repeat(32),messageId='msg_'+uploaderId+'_'+requestId;
const body=new TextEncoder().encode('synthetic attachment');
const ledger={roomId,attachmentId,conversationId:'self_'+uploaderId,uploaderId,requestId,messageId,joinedAt:1000,state:'attached',actualBytes:body.length,declaredBytes:body.length,sha256:createHash('sha256').update(body).digest('hex')};
const canonical={id:messageId,senderId:uploaderId,createdAt:2000,attachmentIds:[attachmentId]};
const check=(patch={})=>inspectMessagingAttachment({roomId,attachmentId},{readLedger:async()=>ledger,readMessage:async()=>null,readFence:async()=>null,readObject:async()=>body,...patch});

test('recovery inspection distinguishes durable canonical references, lost writes and cases requiring investigation',async()=>{
  assert.deepEqual(await check(),{status:'orphan-candidate'});
  assert.deepEqual(await check({readMessage:async()=>canonical}),{status:'committed'});
  assert.deepEqual(await check({readMessage:async()=>({...canonical,deletedAt:3000})}),{status:'retained'});
  assert.deepEqual(await check({readMessage:async()=>({...canonical,attachmentIds:[]})}),{status:'protected'});
  assert.deepEqual(await check({readFence:async()=>({kind:'send'})}),{status:'pending'});
  assert.deepEqual(await check({readFence:async()=>({kind:'maintenance'})}),{status:'pending'});
  assert.deepEqual(await check({readLedger:async()=>({...ledger,roomId:'anotherRoom'})}),{status:'unknown'});
  assert.deepEqual(await check({readObject:async()=>body.map(value=>value+1)}),{status:'unknown'});
  assert.deepEqual(await check({readMessage:async()=>{throw Error('unavailable');}}),{status:'unknown'});
});
