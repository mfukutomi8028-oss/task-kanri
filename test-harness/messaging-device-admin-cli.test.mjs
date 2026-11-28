import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDeviceAdminArgs,deviceAdminProject} from '../security/messaging-device-admin.mjs';
const person='p_'+'a'.repeat(32),base=['--project','task-kanri-2ad16','--room','roomA','--person',person];
test('operator commands require an exact project and are dry-run unless explicitly applied',()=>{
 const config=parseDeviceAdminArgs(['approve-device',...base,'--name','Alice','--uid','deviceA']);
 assert.deepEqual(config,{projectId:'task-kanri-2ad16',emulator:false,apply:false,command:{action:'approve-device',roomId:'roomA',personId:person,uid:'deviceA',displayName:'Alice'}});
 assert.equal(parseDeviceAdminArgs(['revoke-device',...base,'--uid','deviceA','--apply']).apply,true);
 assert.throws(()=>parseDeviceAdminArgs(['approve-device',...base.slice(2),'--name','Alice','--uid','deviceA']));
 assert.throws(()=>parseDeviceAdminArgs(['register-person',...base,'--name','Alice','--project','another']));
 assert.throws(()=>parseDeviceAdminArgs(['revoke-device',...base,'--uid','deviceA','--reactivate']));
 assert.throws(()=>parseDeviceAdminArgs(['approve-device',...base,'--name','Alice','--uid','deviceA','--apply','--apply']));
 assert.throws(()=>parseDeviceAdminArgs(['register-person',...base,'--name','--apply']));
});
test('real and demo Firebase targets cannot be mixed, and emulator mode needs both loopback endpoints',()=>{
 assert.deepEqual(deviceAdminProject('task-kanri-2ad16',false,{}),{projectId:'task-kanri-2ad16',databaseURL:'https://task-kanri-2ad16-default-rtdb.firebaseio.com'});
 assert.throws(()=>deviceAdminProject('task-kanri-2ad16',false,{FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9098'}));
 assert.throws(()=>deviceAdminProject('demo-task-kanri-messaging',false,{}));
 assert.throws(()=>deviceAdminProject('task-kanri-2ad16',true,{FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9098',FIREBASE_DATABASE_EMULATOR_HOST:'127.0.0.1:9002'}));
 assert.throws(()=>deviceAdminProject('demo-task-kanri-messaging',true,{FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9098'}));
 assert.deepEqual(deviceAdminProject('demo-task-kanri-messaging',true,{FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9098',FIREBASE_DATABASE_EMULATOR_HOST:'127.0.0.1:9002'}),{projectId:'demo-task-kanri-messaging',databaseURL:'https://demo-task-kanri-messaging.firebaseio.com'});
});
