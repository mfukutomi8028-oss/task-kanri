// Only an explicit, configured launch may start messaging authentication.
// The legacy board remains the owner of its existing Firebase app and database.
import {isMessagingRoomId} from './workspace-messaging-core.js';
const status=value=>({status:value});
const safeDispose=handle=>{try{handle?.dispose();}catch(_){/* Closing must invalidate pending work. */}};
export function resolveMessagingLaunchConfig(value){
  if(value?.enabled!==true||typeof value.endpoint!=='string')return null;
  let url;try{url=new URL(value.endpoint);}catch(_){return null;}
  if(!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/functions\/v1\/workboard-messaging$/.test(value.endpoint)||url.href!==value.endpoint)return null;
  return Object.freeze({endpoint:url.href,attachmentsEnabled:value.attachmentsEnabled===true});
}
function context(snapshot){
  const user=snapshot?.currentUser;
  return snapshot?.connectionMode==='remote-online'&&isMessagingRoomId(snapshot.roomId)&&typeof user==='string'&&user.length>=1&&user.length<=64&&user.trim()===user&&!/[\u0000-\u001f\u007f]/.test(user)?JSON.stringify([snapshot.roomId,user]):null;
}
export function createOriginMessagingLauncher({readConfig,readBoard,connect,mount}={}){
  if([readConfig,readBoard,connect,mount].some(fn=>typeof fn!=='function'))throw new TypeError('Messaging launch adapters required');
  let generation=0,pending=null,handle=null,activeKey=null;
  const key=()=>context(readBoard());
  function close(){generation++;pending=null;const previous=handle;handle=null;activeKey=null;safeDispose(previous);}
  function open(){
    const config=resolveMessagingLaunchConfig(readConfig());
    if(!config){close();return Promise.resolve(status('disabled'));}
    const start=key();if(!start){close();return Promise.resolve(status('unavailable'));}
    if(activeKey!==null&&activeKey!==start)close();
    if(handle)return Promise.resolve(status('opened'));
    if(pending)return pending;
    const token=++generation;activeKey=start;
    const stillCurrent=()=>{const current=resolveMessagingLaunchConfig(readConfig());return generation===token&&key()===start&&current?.endpoint===config.endpoint&&current.attachmentsEnabled===config.attachmentsEnabled;};
    const job=Promise.resolve().then(async()=>{
      try{
        if(!stillCurrent())return status('cancelled');
        const connection=await connect();
        if(!stillCurrent())return status('cancelled');
        const next=mount({...connection,...config});
        if(typeof next?.dispose!=='function')throw new TypeError('Disposable messaging view required');
        if(!stillCurrent()){safeDispose(next);return status('cancelled');}
        handle=next;return status('opened');
      }catch(_){return status(stillCurrent()?'unavailable':'cancelled');}
      finally{if(generation===token){pending=null;if(!handle)activeKey=null;}}
    });pending=job;return job;
  }
  return Object.freeze({open,close,getHandle:()=>handle});
}
export async function connectFirebaseMessagingAuth({app,authSdk}={}){
  if(!app||['getAuth','signInAnonymously','onAuthStateChanged'].some(k=>typeof authSdk?.[k]!=='function'))throw new TypeError('Firebase Auth adapters required');
  const auth=authSdk.getAuth(app);
  if(typeof auth?.authStateReady!=='function')throw new TypeError('Auth restoration required');
  await auth.authStateReady();
  if(!auth.currentUser)await authSdk.signInAnonymously(auth);
  if(!auth.currentUser?.uid)throw new Error('Authentication unavailable');
  return Object.freeze({getUid:()=>auth.currentUser?.uid??null,async getToken(){const user=auth.currentUser;if(!user)return null;const token=await user.getIdToken();return auth.currentUser===user?token:null;},observeAuth:changed=>authSdk.onAuthStateChanged(auth,changed)});
}
