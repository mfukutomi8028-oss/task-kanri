// Exercise the actual Admin SDK transactions only in isolated loopback emulators.
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getDatabase} from 'firebase-admin/database';
import {createFirebaseMessagingDeviceAdmin,deviceAdminProject} from '../security/messaging-device-admin.mjs';
const projectId='demo-task-kanri-messaging';
const app=initializeApp(deviceAdminProject(projectId,true,process.env),'messaging-device-admin-demo');
const roomId='syntheticDeviceApproval',personId='p_'+'1'.repeat(32),other='p_'+'2'.repeat(32),displayName='Synthetic operator';
const auth=getAuth(app),db=getDatabase(app),admin=createFirebaseMessagingDeviceAdmin({auth,database:db});
const roster=db.ref('messagingRosterV1/'+roomId),access=db.ref('messagingAccessV1/'+roomId);
let uid=null;
try{
  await roster.remove();await access.remove();
  const user=await auth.createUser({});uid=user.uid;
  const register={action:'register-person',roomId,personId,displayName};
  assert.equal((await admin.run(register)).changed,true);assert.equal((await roster.get()).exists(),false);
  assert.equal((await admin.run(register,{apply:true})).applied,true);
  assert.equal((await admin.run({...register,personId:other},{apply:true})).status,'conflict');
  const approve={action:'approve-device',roomId,personId,uid,displayName};
  assert.equal((await admin.run(approve)).changed,true);assert.equal((await access.get()).exists(),false);
  assert.equal((await admin.run(approve,{apply:true})).applied,true);
  assert.deepEqual((await access.child(uid).get()).val(),{uid,roomId,personId,displayName,approved:true,active:true});
  assert.equal((await admin.run({action:'revoke-device',roomId,personId,uid},{apply:true})).applied,true);
  assert.equal((await access.child(uid).get()).val().active,false);
  assert.equal((await admin.run(approve,{apply:true})).status,'conflict');
  assert.equal((await admin.run({...approve,reactivate:true},{apply:true})).applied,true);
  console.log('Messaging device approval: real isolated Auth and RTDB transaction checks passed.');
}finally{try{await roster.remove();await access.remove();if(uid)await auth.deleteUser(uid);}finally{await deleteApp(app);}}
