// Local operator only. Never expose credentials or this tool via Pages.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {adminDeadlineMs,withAdminDeadline,AdminDeadlineError} from './messaging-admin-deadline.mjs';
const production='task-kanri-2ad16',demo='demo-task-kanri-messaging';
const roomValid=v=>typeof v==='string'&&v.length>=1&&v.length<=60&&v===v.trim()&&!/[.#$/\[\]\u0000-\u001f\u007f]/.test(v);
const conversationValid=v=>typeof v==='string'&&/^(self_p_[0-9a-f]{32}|dm_p_[0-9a-f]{32}_p_[0-9a-f]{32}|group_g_[0-9a-f]{32})$/.test(v);
const usage='Usage: node security/messaging-directory-admin.mjs --project <project> --room <room> [--conversation <id> | --after <id> --limit <1-50>] [--apply] [--emulator]';
export function parseDirectoryAdminArgs(args){
  const options=new Map(),flags=new Set(['--apply','--emulator']),values=new Set(['--project','--room','--conversation','--after','--limit']);
  for(let i=0;i<args.length;i++){
    const key=args[i];if(options.has(key))throw Error(usage);
    if(flags.has(key)){options.set(key,true);continue;}
    if(!values.has(key)||typeof args[i+1]!=='string'||!args[i+1]||args[i+1].startsWith('--'))throw Error(usage);
    options.set(key,args[++i]);
  }
  const emulator=options.has('--emulator'),projectId=options.get('--project'),roomId=options.get('--room');
  if(projectId!==(emulator?demo:production)||!roomValid(roomId))throw Error(usage);
  const conversationId=options.get('--conversation'),after=options.get('--after')??null,rawLimit=options.get('--limit')??'50';
  if(conversationId!==undefined&&(!conversationValid(conversationId)||options.has('--after')||options.has('--limit'))||after!==null&&!conversationValid(after)||!/^([1-9]|[1-4][0-9]|50)$/.test(rawLimit))throw Error(usage);
  return {projectId,emulator,apply:options.has('--apply'),scope:conversationId===undefined?{roomId,after,limit:Number(rawLimit)}:{roomId,conversationId}};
}
export async function runDirectoryAdmin(options,{index,readPage,readOne}){
  const mode=options.apply?'apply':'dry-run',scope=options.scope;
  try{
    if(options.apply)return {...(scope.conversationId===undefined?await index.reconcilePage(scope):await index.reconcile(scope)),mode};
    if(scope.conversationId!==undefined){
      if(!await readOne(scope))return {status:'unavailable',mode};
      return {status:'ok',mode,processed:0,candidates:[scope.conversationId],hasMore:false,nextCursor:null};
    }
    const ids=await readPage({...scope,limit:scope.limit+1});
    if(!Array.isArray(ids)||ids.length>scope.limit+1||ids.some((id,i)=>!conversationValid(id)||(i>0?ids[i-1]:scope.after)!==null&&id<=(i>0?ids[i-1]:scope.after)))return {status:'unavailable',mode};
    const candidates=ids.slice(0,scope.limit),hasMore=ids.length>scope.limit;
    return {status:'ok',mode,processed:0,candidates,hasMore,nextCursor:hasMore?candidates.at(-1):null};
  }catch(_){return {status:'unavailable',mode};}
}
async function main(args){
  if(args.length===1&&args[0]==='--help'){console.log(usage);return;}
  const options=parseDirectoryAdminArgs(args);
  const [{deviceAdminProject},{createFirebaseMessagingDirectoryServices},{initializeApp,deleteApp,applicationDefault},{getAuth},{getDatabase}]=await Promise.all([import('./messaging-device-admin.mjs'),import('./messaging-directory-service.mjs'),import('firebase-admin/app'),import('firebase-admin/auth'),import('firebase-admin/database')]);
  const project=deviceAdminProject(options.projectId,options.emulator,process.env);
  const app=initializeApp({...project,...(options.emulator?{}:{credential:applicationDefault()})},'messaging-directory-admin');
  try{
    const database=getDatabase(app),{index}=createFirebaseMessagingDirectoryServices({auth:getAuth(app),database});
    const control=roomId=>database.ref('messagingV1/'+roomId+'/control');
    const result=await runDirectoryAdmin(options,{index,async readPage({roomId,after,limit}){
      let q=control(roomId).orderByKey();if(after!==null)q=q.startAfter(after);
      const snapshot=await q.limitToFirst(limit).get(),ids=[];snapshot.forEach(child=>{ids.push(child.key);return false;});return ids;
    },async readOne({roomId,conversationId}){return (await control(roomId).child(conversationId).get()).exists();}});
    console.log(JSON.stringify({projectId:options.projectId,roomId:options.scope.roomId,...result}));
    if(result.status!=='ok')process.exitCode=1;
  }finally{await deleteApp(app);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{await withAdminDeadline(()=>main(process.argv.slice(2)),adminDeadlineMs(process.env));}
  catch(error){
    // A stalled database keeps SDK sockets open, so a timeout ends the process explicitly.
    if(error instanceof AdminDeadlineError){console.error(error.message);process.exit(1);}
    console.error('Directory maintenance failed; verify target, arguments and local Admin credentials.');process.exitCode=1;
  }
}
