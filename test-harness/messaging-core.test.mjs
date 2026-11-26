import test from 'node:test';
import assert from 'node:assert/strict';
import { isPersonId, conversationIdFor, validateMessageInput, compareCursor, advanceReadCursor, messageIdFor } from '../workspace-messaging-core.js';

const a = 'p_' + 'a'.repeat(32), b = 'p_' + 'b'.repeat(32);
const g = 'g_' + 'c'.repeat(32);
test('person identifiers are canonical opaque keys, not names or paths', () => {
  assert.equal(isPersonId(a), true);
  for (const value of [undefined, null, 123, '', 'staff-A', a + '\n', 'p_' + 'A'.repeat(32), a.slice(1), a + '/x']) {
    assert.equal(isPersonId(value), false);
  }
});
test('direct conversations use the same ID in either participant order', () => {
  const expected = 'dm_' + a + '_' + b;
  assert.equal(conversationIdFor({roomId:'r',kind:'direct',personIds:[a,b]}), expected);
  assert.equal(conversationIdFor({roomId:'r',kind:'direct',personIds:[b,a]}), expected);
});
test('self and group IDs are stable and independent of display names', () => {
  assert.equal(conversationIdFor({roomId:'r',kind:'self',personIds:[a],title:'A'}), 'self_' + a);
  assert.equal(conversationIdFor({roomId:'r',kind:'group',personIds:[a,b],groupId:g,title:'A'}), 'group_' + g);
  assert.equal(conversationIdFor({roomId:'r',kind:'group',personIds:[a],groupId:g,title:'B'}), 'group_' + g);
});
test('invalid room, participant sets, kinds and group keys cannot create IDs', () => {
  const valid = {roomId:'r',kind:'direct',personIds:[a,b]};
  for (const patch of [{roomId:'r/other'},{roomId:''},{roomId:'r\n'},{kind:'unknown'},{personIds:[a,a]},{personIds:[a]},{personIds:[a,b,a]},{personIds:['staff',b]},{kind:'self'},{kind:'group',groupId:'group/name'},{kind:'group',groupId:g,personIds:[]}]) {
    assert.throws(() => conversationIdFor({...valid,...patch}), TypeError);
  }
  assert.throws(() => conversationIdFor({roomId:'r',kind:'group',groupId:g,personIds:Array.from({length:101},(_,i)=>'p_'+i.toString(16).padStart(32,'0'))}), TypeError);
});

test('message payload preserves literal Japanese and markup as plain text', () => {
  const body='\u5831\u544a\n<b>test</b>';
  assert.deepEqual(validateMessageInput({body}),{body,replyTo:null,refs:[],attachmentIds:[],confirmationRequested:false});
});
test('references contain IDs only, without copying business content', () => {
  const refs=[{roomId:'r',type:'task',recordId:'task1'},{roomId:'r',type:'schedule',recordId:'schedule1'},{roomId:'r',type:'memo',recordId:'memo1'}];
  assert.deepEqual(validateMessageInput({body:'',refs,confirmationRequested:true}),{body:'',replyTo:null,refs,attachmentIds:[],confirmationRequested:true});
  assert.throws(()=>validateMessageInput({body:'',refs:[{...refs[0],title:'not authorized'}]}),TypeError);
  assert.throws(()=>validateMessageInput({body:'',refs:[{roomId:'r',type:'task',recordId:'x/y'}]}),TypeError);
  assert.throws(()=>validateMessageInput({body:'',refs:[{roomId:'r',type:'file',recordId:'x'}]}),TypeError);
  assert.throws(()=>validateMessageInput({body:'',refs:Array.from({length:21},(_,i)=>({roomId:'r',type:'task',recordId:'task'+i}))}),TypeError);
});
test('message length, empty content and unfinished upload checks are enforced', () => {
  assert.equal(validateMessageInput({body:'a'.repeat(6000)}).body.length,6000);
  for(const input of [null,{body:'a'.repeat(6001)},{body:' \n\t'},{body:123},{body:'ok',confirmationRequested:1},{body:'ok',attachmentIds:['pending']},{body:'ok',replyTo:'a/b'},{body:'ok',senderId:a}]) assert.throws(()=>validateMessageInput(input),TypeError);
});
test('read cursors break timestamp ties by message ID and never regress',()=>{
  assert.equal(compareCursor({createdAt:10,id:'a'},{createdAt:10,id:'b'}),-1);
  assert.equal(compareCursor({createdAt:9,id:'z'},{createdAt:10,id:'a'}),-1);
  assert.equal(compareCursor({createdAt:10,id:'a'},{createdAt:10,id:'a'}),0);
  assert.equal(compareCursor({createdAt:11,id:'a'},{createdAt:10,id:'z'}),1);
  assert.deepEqual(advanceReadCursor({createdAt:10,id:'b'},{createdAt:10,id:'a'}),{createdAt:10,id:'b'});
  assert.deepEqual(advanceReadCursor(null,{createdAt:10,id:'a'}),{createdAt:10,id:'a'});
  assert.throws(()=>advanceReadCursor(null,{createdAt:NaN,id:'a'}),TypeError);
});
test('message ID is deterministic for the sender and the retry request',()=>{
  const requestId='q_'+'c'.repeat(32);
  assert.equal(messageIdFor(a,requestId),'msg_'+a+'_'+requestId);
  assert.notEqual(messageIdFor(a,requestId),messageIdFor(b,requestId));
  assert.throws(()=>messageIdFor(a,'arbitrary'),TypeError);
});
