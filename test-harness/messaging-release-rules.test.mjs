import test from 'node:test';
import assert from 'node:assert/strict';
import * as compose from '../security/compose-messaging-rules.mjs';
const legacy={rules:{rooms:{'$roomId':{'.read':true,'.write':true,tasks:{'.indexOn':['status']}}},other:{'.read':'auth != null','.write':false}}};
const isolated={rules:{'.read':false,'.write':false,messagingAccessV1:{'$roomId':{'$uid':{'.read':'auth.uid === $uid','.write':false}}},messagingV1:{'$roomId':{'.read':false,'.write':false}},messagingRosterV1:{'$roomId':{'.read':false,'.write':false}}}};
test('compose preserves all legacy room and other rules while adding only messaging nodes',()=>{const original=structuredClone(legacy);const result=compose.composeMessagingRules(legacy,isolated);assert.deepEqual(result.rules.rooms,original.rules.rooms);assert.deepEqual(result.rules.other,original.rules.other);for(const key of ['messagingAccessV1','messagingV1','messagingRosterV1'])assert.deepEqual(result.rules[key],isolated.rules[key]);assert.deepEqual(legacy,original);assert.equal(result.rules['.read'],false);assert.equal(result.rules['.write'],false);});
test('permissive or unreviewed root grants and wildcard paths are rejected rather than weakened',()=>{for(const patch of [{'.read':true},{'.write':'auth != null'},{'$any':{'.read':true}},{'.validate':'newData.exists()'}])assert.throws(()=>compose.composeMessagingRules({rules:{...legacy.rules,...patch}},isolated));});
test('missing legacy room rules or invalid isolated rules are rejected',()=>{assert.throws(()=>compose.composeMessagingRules({rules:{}},isolated));for(const patch of [{'.read':true},{rooms:{}},{messagingV1:null}])assert.throws(()=>compose.composeMessagingRules(legacy,{rules:{...isolated.rules,...patch}}));});
test('existing messaging nodes must match exactly to allow idempotent composition',()=>{const result=compose.composeMessagingRules(legacy,isolated);assert.deepEqual(compose.composeMessagingRules(result,isolated),result);assert.throws(()=>compose.composeMessagingRules({rules:{...legacy.rules,messagingV1:{'.read':true}}},isolated));});

test('an explicitly reviewed Rules upgrade adds stop control while preserving legacy paths',()=>{
  const production=compose.composeMessagingRules(legacy,isolated);
  const next=structuredClone(isolated);
  next.rules.messagingControlV1={'.read':false,'.write':false,enabled:{'.read':'auth != null','.write':false}};
  next.rules.messagingAccessV1.$roomId.$uid['.read']="root.child('messagingControlV1/enabled').val() === true && auth.uid === $uid";
  assert.throws(()=>compose.composeMessagingRules(production,next));
  const merged=compose.composeMessagingRules(production,next,isolated);
  assert.deepEqual(merged.rules.rooms,legacy.rules.rooms);
  assert.deepEqual(merged.rules.other,legacy.rules.other);
  assert.deepEqual(merged.rules.messagingControlV1,next.rules.messagingControlV1);
  assert.throws(()=>compose.composeMessagingRules(merged,isolated));
  production.rules.messagingV1={'.read':true};
  assert.throws(()=>compose.composeMessagingRules(production,next,isolated));
});
