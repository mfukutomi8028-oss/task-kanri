// Server runtime wiring. Configuration stays in secret storage; a disabled or
// incomplete deployment cannot initialize an Admin client or read any records.
import {isConversationId,isMessageId,isMessagingRoomId,isMessagingTimestamp,isPersonId} from '../test-harness/messaging-preview/workspace-messaging-core.js';
const unavailable=()=>new Response(JSON.stringify({status:'unavailable'}),{status:503,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function configuration(getEnv){
  if(getEnv('WORKBOARD_MESSAGING_ENABLED')!=='true')return null;
  const account=JSON.parse(getEnv('WORKBOARD_FIREBASE_SERVICE_ACCOUNT_JSON')||'null');
  if(account?.type!=='service_account'||typeof account.project_id!=='string'||!/^[a-z][a-z0-9-]{4,62}$/.test(account.project_id)||typeof account.client_email!=='string'||!account.client_email.endsWith('.iam.gserviceaccount.com')||typeof account.private_key!=='string'||!account.private_key.startsWith('-----BEGIN PRIVATE KEY-----\n')||!account.private_key.includes('-----END PRIVATE KEY-----'))return null;
  const projectId=account.project_id,rawUrl=getEnv('WORKBOARD_FIREBASE_DATABASE_URL'),dbUrl=new URL(rawUrl);
  const instance=dbUrl.hostname.split('.')[0];
  if(dbUrl.protocol!=='https:'||dbUrl.username||dbUrl.password||dbUrl.port||dbUrl.pathname!=='/'||dbUrl.search||dbUrl.hash||!(/^[a-z0-9-]+\.firebaseio\.com$/.test(dbUrl.hostname)||/^[a-z0-9-]+\.[a-z0-9-]+\.firebasedatabase\.app$/.test(dbUrl.hostname))||!(instance===projectId||instance===projectId+'-default-rtdb'))return null;
  const allowedOrigins=(getEnv('WORKBOARD_MESSAGING_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim());
  if(allowedOrigins.length<1||allowedOrigins.length>8||new Set(allowedOrigins).size!==allowedOrigins.length||allowedOrigins.some(origin=>{const url=new URL(origin);return url.protocol!=='https:'||url.origin!==origin||url.username||url.password;}))return null;
  const hex=getEnv('WORKBOARD_MESSAGING_DIGEST_KEY_HEX');if(typeof hex!=='string'||!/^[a-f0-9]{64}$/i.test(hex))return null;
  const digestKey=Uint8Array.from(hex.match(/../g),pair=>parseInt(pair,16));
  return {projectId,databaseURL:rawUrl,account:{projectId,clientEmail:account.client_email,privateKey:account.private_key},allowedOrigins,digestKey};
}
function validActorOverride(override){
  if(!override||typeof override!=='object'||Array.isArray(override)||Object.keys(override).some(k=>!['uid','token'].includes(k))||typeof override.uid!=='string'||override.uid.length<1||override.uid.length>128||/[.#$\/\[\]\u0000-\u001f\u007f]/.test(override.uid))return false;
  const t=override.token;
  if(!t||typeof t!=='object'||Array.isArray(t)||!isMessagingRoomId(t.roomId)||!isPersonId(t.personId)||!isConversationId(t.conversationId))return false;
  if(t.workboardMessageMutationV1===true){
    return Object.keys(t).every(k=>['workboardMessageMutationV1','roomId','conversationId','personId','joinedAt','messageId','controlRevision'].includes(k))&&isMessagingTimestamp(t.joinedAt)&&isMessageId(t.messageId)&&t.messageId.startsWith('msg_'+t.personId+'_')&&(t.controlRevision===undefined||Number.isSafeInteger(t.controlRevision)&&t.controlRevision>=1);
  }
  if(t.workboardConversationMutationV1===true){
    return Object.keys(t).every(k=>['workboardConversationMutationV1','roomId','conversationId','personId','rosterRevision'].includes(k))&&Number.isSafeInteger(t.rosterRevision)&&t.rosterRevision>=1;
  }
  return false;
}
export function createMessagingRuntime({getEnv,cert,initializeApp,getAuth,getDatabase,deleteApp,createHistory,createMutation,createDirectory,createConversations,createApiHandler,createSupabase,createAttachments,makeId=()=>crypto.randomUUID()}={}){
  if([getEnv,cert,initializeApp,getAuth,getDatabase,deleteApp,createHistory,createMutation,createDirectory,createConversations,createApiHandler,makeId].some(fn=>typeof fn!=='function'))throw new TypeError('Messaging runtime adapters required');
  let startup;
  async function boot(){
    let app;
    try{
      const config=configuration(getEnv);if(!config)return null;
      const options={projectId:config.projectId,databaseURL:config.databaseURL,credential:cert(config.account)};
      app=initializeApp(options,'workboard-messaging-api-'+makeId());
      const auth=getAuth(app),database=getDatabase(app);
      // Each mutation has an isolated Rules-scoped database instance. Limit
      // simultaneous instances to avoid exhausting the shared Firebase quota.
      let activeActors=0;
      async function withActorDatabase(override,operation){
        if(!validActorOverride(override)||typeof operation!=='function')throw new TypeError('Invalid scoped database actor');
        if(activeActors>=8)throw new Error('Scoped database capacity reached');
        let actor;
        activeActors++;
        try{
          actor=initializeApp({...options,databaseAuthVariableOverride:override},'workboard-messaging-actor-'+makeId());
          return await operation(getDatabase(actor));
        }finally{
          try{if(actor)await deleteApp(actor);}finally{activeActors--;}
        }
      }
      const shared={auth,database};
      // Attachments are separately gated until the private bucket, RPCs and
      // Firebase authorization have passed deployment verification.
      let attachments=null;
      if(getEnv('WORKBOARD_MESSAGING_ATTACHMENTS_ENABLED')==='true'){
        const url=getEnv('SUPABASE_URL'),key=getEnv('SUPABASE_SERVICE_ROLE_KEY');
        if(typeof url!=='string'||!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url)||typeof key!=='string'||!key.trim()||typeof createSupabase!=='function'||typeof createAttachments!=='function')throw new TypeError('Trusted attachment configuration required');
        const supabase=createSupabase(url,key);
        attachments=createAttachments({...shared,supabase});
        if([attachments?.upload,attachments?.download,attachments?.claim].some(fn=>typeof fn!=='function'))throw new TypeError('Attachment services required');
      }
      const handler=createApiHandler({allowedOrigins:config.allowedOrigins,history:createHistory(shared),mutation:createMutation({...shared,withActorDatabase,digestKey:config.digestKey,...(attachments?{claimAttachments:attachments.claim}:{})}),directory:createDirectory(shared).directory,conversations:createConversations({...shared,withActorDatabase}),attachments});
      if(typeof handler!=='function')throw new TypeError('Invalid API handler');
      return handler;
    }catch(_){if(app)try{await deleteApp(app);}catch(_){/* Do not expose startup errors or secrets. */}return null;}
  }
  return async function handle(request){
    try{startup??=boot();const handler=await startup;return handler?await handler(request):unavailable();}catch(_){return unavailable();}
  };
}
