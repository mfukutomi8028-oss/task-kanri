import test from 'node:test';
import assert from 'node:assert/strict';
import { isPersonId, conversationIdFor } from './messaging-preview/workspace-messaging-core.js';

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
