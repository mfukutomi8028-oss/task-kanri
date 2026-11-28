// Local operator CLI. Never expose this script or its credentials through Pages.
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createMessagingDeviceAdmin} from './messaging-device-admin-service.mjs';
import {adminDeadlineMs,withAdminDeadline,AdminDeadlineError} from './messaging-admin-deadline.mjs';
const production='task-kanri-2ad16',demo='demo-task-kanri-messaging';
const commands=new Set(['register-person','approve-device','revoke-device']);
const usage='Usage: node security/messaging-device-admin.mjs new-person-id | <register-person|approve-device|revoke-device> --project <project> --room <room> --person <p_id> [--name <display name>] [--uid <Firebase UID>] [--reactivate] [--apply] [--emulator]';
export function parseDeviceAdminArgs(args){
  const [action,...rest]=args;if(!commands.has(action))throw new Error(usage);
  const options=new Map(),allowedValues=new Set(['--project','--room','--person',...(action!=='revoke-device'?['--name']:[]),...(action!=='register-person'?['--uid']:[])]),flags=new Set(['--apply','--emulator',...(action==='approve-device'?['--reactivate']:[])]);
  for(let i=0;i<rest.length;i++){
    const key=rest[i];if(options.has(key))throw new Error('Duplicate option');
    if(flags.has(key)){options.set(key,true);continue;}
    if(!allowedValues.has(key)||typeof rest[i+1]!=='string'||!rest[i+1]||rest[i+1].startsWith('--'))throw new Error(usage);
    options.set(key,rest[++i]);
  }
  if([...allowedValues].some(key=>!options.has(key)))throw new Error(usage);
  const emulator=options.has('--emulator'),projectId=options.get('--project');
  if(projectId!==(emulator?demo:production))throw new Error('Explicit project does not match target');
  return {projectId,emulator,apply:options.has('--apply'),command:{action,roomId:options.get('--room'),personId:options.get('--person'),...(options.has('--uid')?{uid:options.get('--uid')} : {}),...(options.has('--name')?{displayName:options.get('--name')} : {}),...(options.has('--reactivate')?{reactivate:true} : {})}};
}
export function deviceAdminProject(projectId,emulator,env){
  if(emulator===true){if(projectId!==demo||env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9098'||env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9002')throw new Error('Both isolated loopback emulators are required');return {projectId,databaseURL:'https://'+demo+'.firebaseio.com'};}
  if(emulator!==false||projectId!==production||env.FIREBASE_AUTH_EMULATOR_HOST||env.FIREBASE_DATABASE_EMULATOR_HOST)throw new Error('Production target rejected');
  return {projectId,databaseURL:'https://'+production+'-default-rtdb.firebaseio.com'};
}
export function createFirebaseMessagingDeviceAdmin({auth,database}={}){
  if(typeof auth?.getUser!=='function'||typeof database?.ref!=='function')throw new TypeError('Trusted Firebase Admin SDK required');
  const roster=({roomId})=>database.ref('messagingRosterV1/'+roomId),binding=({roomId,uid})=>database.ref('messagingAccessV1/'+roomId+'/'+uid);
  async function transact(ref,decide){
    const observer=()=>{};let decision;
    ref.on('value',observer,()=>{});
    try{await ref.once('value');const tx=await ref.transaction(current=>{decision=decide(current);return decision.changed===true?decision.value:undefined;},undefined,false);return {decision,committed:tx.committed};}
    finally{ref.off('value',observer);}
  }
  return createMessagingDeviceAdmin({async lookupUid(uid){try{return await auth.getUser(uid);}catch(error){if(error?.code==='auth/user-not-found')return null;throw error;}},readRoster:async scope=>(await roster(scope).get()).val(),readBinding:async scope=>(await binding(scope).get()).val(),transactRoster:(scope,decide)=>transact(roster(scope),decide),transactBinding:(scope,decide)=>transact(binding(scope),decide)});
}
async function main(args){
  if(args.length===1&&args[0]==='new-person-id'){console.log('p_'+randomUUID().replaceAll('-',''));return;}
  if(args.length===1&&args[0]==='--help'){console.log(usage);return;}
  const options=parseDeviceAdminArgs(args),project=deviceAdminProject(options.projectId,options.emulator,process.env);
  const [{initializeApp,deleteApp,applicationDefault},{getAuth},{getDatabase}]=await Promise.all([import('firebase-admin/app'),import('firebase-admin/auth'),import('firebase-admin/database')]);
  const app=initializeApp({...project,...(options.emulator?{}:{credential:applicationDefault()})},'messaging-device-admin');
  try{
    const admin=createFirebaseMessagingDeviceAdmin({auth:getAuth(app),database:getDatabase(app)});
    const result=await admin.run(options.command,{apply:options.apply});
    console.log(JSON.stringify({projectId:options.projectId,mode:options.apply?'apply':'dry-run',action:options.command.action,...result}));
    if(result.status!=='ok')process.exitCode=1;
  }finally{await deleteApp(app);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{await withAdminDeadline(()=>main(process.argv.slice(2)),adminDeadlineMs(process.env));}
  catch(error){
    // A stalled database keeps SDK sockets open, so a timeout ends the process explicitly.
    if(error instanceof AdminDeadlineError){console.error(error.message);process.exit(1);}
    console.error('Device administration failed; verify arguments, project and local Admin credentials.');process.exitCode=1;
  }
}
