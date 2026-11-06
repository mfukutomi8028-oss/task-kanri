import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectStagedIdentityV579, planStagedUserSwitchV579, planStagedAuthChangeV579 }
  from '../security/staged-identity-session-v579.mjs';

const token = 'T'.repeat(50); // synthetic credential, not a real Firebase token
const service = () => ({
  expectedProjectId: 'demo-task-kanri-v568',
  async verifyIdToken(value, checkRevoked) {
    assert.equal(checkRevoked, true);
    if (value !== token) throw Error('invalid');
    return {
      uid: 'alice', aud: 'demo-task-kanri-v568',
      iss: 'https://securetoken.google.com/demo-task-kanri-v568'
    };
  },
  async readIdentityBinding(roomId, uid) {
    if (roomId === 'room-a' && uid === 'alice')
      return { role: 'editor', displayName: '職員A', approved: true };
    return null;
  }
});
const auth = (overrides = {}) => ({
  authorizationHeader: 'Bearer ' + token, roomId: 'room-a', ...overrides
});

test('Ver.579 binds a verified UID to an approved server-side legacy display name', async () => {
  const s = await inspectStagedIdentityV579(auth(), service());
  assert.equal(s.status, 'bound');
  assert.deepEqual(s.session, {
    uid: 'alice', roomId: 'room-a', displayName: '職員A',
    role: 'editor', canWriteShared: true
  });
  assert.equal(s.productionReady, false);
  assert.equal(JSON.stringify(s).includes(token), false);
  assert.equal(Object.isFrozen(s.session), true);
});

test('Ver.579 cannot impersonate another person using a legacy user picker', async () => {
  const s = service();
  for (const targetDisplayName of ['職員B', '職員Ａ', '管理者']) {
    const r = await inspectStagedIdentityV579(auth({targetDisplayName}), s);
    assert.equal(r.status, 'reauthentication-required');
    assert.equal(r.session, undefined);
  }
  assert.equal((await inspectStagedIdentityV579(auth({targetDisplayName:'職員A'}),s)).status,
    'bound');
  for (const rejected of [
    {uid:'bob'}, {role:'admin'}, {authorized:true},
    {targetDisplayName:''}, {targetDisplayName:null},
    {targetDisplayName:'職員A\n'}, {roomId:'../room-b'}
  ]) assert.equal((await inspectStagedIdentityV579(auth(rejected),s)).status,
    'invalid-request');
});

test('Ver.579 fails closed for wrong-room, revoked, unapproved or unavailable identity', async () => {
  assert.deepEqual(await inspectStagedIdentityV579(auth({authorizationHeader:''}),service()),
    {status:'unauthenticated',clearPrivateState:true,productionReady:false});
  assert.equal((await inspectStagedIdentityV579(auth({roomId:'room-b'}),service())).status,
    'forbidden');
  const disabled=service();disabled.verifyIdToken=async()=>{throw Error('revoked');};
  assert.equal((await inspectStagedIdentityV579(auth(),disabled)).status,'unauthenticated');
  const unavailable=service();unavailable.readIdentityBinding=async()=>{throw Error('offline');};
  const r=await inspectStagedIdentityV579(auth(),unavailable);
  assert.equal(r.status,'unavailable');assert.equal(r.clearPrivateState,true);
  for(const membership of [
    null, {displayName:'職員A',role:'editor',approved:false},
    {displayName:'職員A',role:'admin'}, {displayName:'職員A',role:'owner',approved:true},
    {displayName:'',role:'editor',approved:true}
  ]){
    const sample=service();sample.readIdentityBinding=async()=>membership;
    assert.equal((await inspectStagedIdentityV579(auth(),sample)).status,'forbidden');
  }
});

test('Ver.579 UI switch preflight protects edits and enforces reauthentication', () => {
  const session={uid:'alice',roomId:'room-a',displayName:'職員A'};
  assert.equal(planStagedUserSwitchV579({session,targetDisplayName:'職員B',pendingWrites:true}).status,
    'wait-for-pending-writes');
  assert.equal(planStagedUserSwitchV579({session,targetDisplayName:'職員B',dirtyDraft:true}).status,
    'confirm-discard-before-reauthentication');
  assert.equal(planStagedUserSwitchV579({session,targetDisplayName:'職員B'}).status,
    'reauthentication-required');
  assert.equal(planStagedUserSwitchV579({session,targetDisplayName:'職員A'}).status,
    'same-account');
  assert.equal(planStagedUserSwitchV579({targetDisplayName:'職員A'}).status,
    'sign-in-required');
});

test('Ver.579 signout or UID/room changes clear private state; refresh revalidates', () => {
  const session={uid:'alice',roomId:'room-a'};
  for(const next of [
    {nextUid:'bob',nextRoomId:'room-a'},
    {nextUid:'alice',nextRoomId:'room-b'},
    {nextUid:null,nextRoomId:'room-a'},
    {nextUid:'alice',nextRoomId:null}
  ]){
    const r=planStagedAuthChangeV579({previousSession:session,dirtyDraft:true,...next});
    assert.equal(r.status,'lock-and-clear');
    assert.equal(r.clearPrivateState,true);
    assert.equal(r.warnAboutUnsavedDraft,true);
  }
  assert.equal(planStagedAuthChangeV579({
    previousSession:session,nextUid:'alice',nextRoomId:'room-a'
  }).status,'revalidate-same-identity');
});

test('Ver.579 is isolated from current Classic client and public database rules', () => {
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const rules=readFileSync(new URL('../firebase-rules.json',import.meta.url),'utf8');
  const doc=readFileSync(new URL('../docs/AUTH_ROLLOUT_GATE_20261106.md',import.meta.url),'utf8');
  assert.doesNotMatch(app,/staged-identity-session-v579/);
  assert.match(app,/function setCurrentUser\(value\)/);
  assert.match(rules,/"\.read": true/);
  assert.match(doc,/NO_GO/);
});
