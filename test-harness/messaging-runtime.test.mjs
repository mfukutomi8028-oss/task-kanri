import test from 'node:test';
import assert from 'node:assert/strict';
import * as runtime from '../security/messaging-runtime.mjs';
const {createMessagingRuntime}=runtime;
const base={SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-server-key',WORKBOARD_MESSAGING_ENABLED:'true',WORKBOARD_FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',project_id:'synthetic-project',client_email:'synthetic@synthetic-project.iam.gserviceaccount.com',private_key:'-----BEGIN PRIVATE KEY-----\nSYNTHETIC\n-----END PRIVATE KEY-----\n'}),WORKBOARD_FIREBASE_DATABASE_URL:'https://synthetic-project-default-rtdb.firebaseio.com',WORKBOARD_MESSAGING_ALLOWED_ORIGINS:'https://board.example.test',WORKBOARD_MESSAGING_DIGEST_KEY_HEX:'a'.repeat(64)};
const request=()=>new Request('https://api.example.test/messaging',{method:'POST',headers:{Origin:'https://board.example.test'}});
function fixture(env=base){
  const apps=[],deleted=[],services=[],requests=[];
  let failInit=false,failHandler=false;
  const deps={
    getEnv:key=>env[key],
    createSupabase:()=>({rpc:async()=>({data:{status:'ok'},error:null})}),
    cert:value=>({syntheticCredential:value}),
    initializeApp(options,name){if(failInit)throw Error('private credential content');const app={options,name};apps.push(app);return app;},
    getAuth:app=>({app}),getDatabase:app=>({app}),deleteApp:async app=>{deleted.push(app);},
    createHistory:options=>{services.push(['history',options]);return {kind:'history'};},
    createMutation:options=>{services.push(['mutation',options]);return {kind:'mutation'};},
    createDirectory:options=>{services.push(['directory',options]);return {directory:{kind:'directory'}};},
    createConversations:options=>{services.push(['conversations',options]);return {kind:'conversations'};},
    createApiHandler:options=>{services.push(['handler',options]);if(failHandler)throw Error('secret details');return async req=>{requests.push(req);return Response.json({status:'ok'});};},
    makeId:(()=>{let id=0;return ()=>String(++id);})()
  };
  return {deps,apps,deleted,services,requests,failInit:()=>{failInit=true;},failHandler:()=>{failHandler=true;}};
}
const closed=async response=>{assert.equal(response.status,503);assert.deepEqual(await response.json(),{status:'unavailable'});assert.equal(response.headers.get('Cache-Control'),'no-store');};
test('missing or disabled environment fails closed without initializing Firebase',async()=>{
  for(const patch of [{WORKBOARD_MESSAGING_ENABLED:'false'},{WORKBOARD_MESSAGING_ENABLED:undefined},{WORKBOARD_FIREBASE_SERVICE_ACCOUNT_JSON:undefined},{WORKBOARD_MESSAGING_DIGEST_KEY_HEX:'short'},{WORKBOARD_FIREBASE_DATABASE_URL:'https://example.test/db'},{WORKBOARD_MESSAGING_ALLOWED_ORIGINS:'https://board.example.test/path'},{WORKBOARD_FIREBASE_SERVICE_ACCOUNT_JSON:'{}'}]){
    const f=fixture({...base,...patch});const server=createMessagingRuntime(f.deps);await closed(await server(request()));assert.equal(f.apps.length,0);assert.equal(f.services.length,0);
  }
});
test('complete configuration initializes a single trusted API and reuses it across requests',async()=>{
  const f=fixture(),server=createMessagingRuntime(f.deps);const results=await Promise.all([server(request()),server(request())]);
  assert.deepEqual(await Promise.all(results.map(x=>x.json())),[{status:'ok'},{status:'ok'}]);assert.equal(f.apps.length,1);assert.equal(f.requests.length,2);
  assert.equal(f.apps[0].options.projectId,'synthetic-project');assert.equal(f.apps[0].options.databaseURL,base.WORKBOARD_FIREBASE_DATABASE_URL);
  const handler=f.services.find(([kind])=>kind==='handler')[1];assert.deepEqual(handler.allowedOrigins,['https://board.example.test']);assert.equal(handler.history.kind,'history');assert.equal(handler.directory.kind,'directory');assert.equal(handler.mutation.kind,'mutation');assert.equal(handler.conversations.kind,'conversations');
  const mutation=f.services.find(([kind])=>kind==='mutation')[1];assert.equal(mutation.digestKey.length,32);assert.equal(mutation.digestKey[0],170);
});
test('actor databases are scoped, isolated and deleted even if an operation fails',async()=>{
  const f=fixture(),server=createMessagingRuntime(f.deps);await server(request());const {withActorDatabase}=f.services.find(([kind])=>kind==='mutation')[1];
  const override={uid:'synthetic',token:{workboardMessageMutationV1:true,roomId:'synthetic',conversationId:'self_p_'+'a'.repeat(32),personId:'p_'+'a'.repeat(32),joinedAt:1000,messageId:'msg_p_'+'a'.repeat(32)+'_q_'+'b'.repeat(32)}};
  const result=await withActorDatabase(override,async db=>{assert.deepEqual(db.app.options.databaseAuthVariableOverride,override);return 'success';});assert.equal(result,'success');
  await assert.rejects(withActorDatabase(override,async()=>{throw Error('failure');}),/failure/);
  assert.equal(f.apps.length,3);assert.notEqual(f.apps[1].name,f.apps[2].name);assert.deepEqual(f.deleted,f.apps.slice(1));assert.equal(f.apps[0].options.databaseAuthVariableOverride,undefined);
});
test('runtime construction errors do not return private configuration and clean up the base app',async()=>{
  const f=fixture();f.failHandler();const server=createMessagingRuntime(f.deps);await closed(await server(request()));assert.equal(f.apps.length,1);assert.deepEqual(f.deleted,f.apps);await closed(await server(request()));assert.equal(f.apps.length,1);
});
test('the runtime refuses a database URL belonging to another Firebase project',async()=>{
  const f=fixture({...base,WORKBOARD_FIREBASE_DATABASE_URL:'https://different-project-default-rtdb.firebaseio.com'});await closed(await createMessagingRuntime(f.deps)(request()));assert.equal(f.apps.length,0);
});

test('a missing or ambiguous actor scope can never create an unrestricted Admin database',async()=>{
  const f=fixture(),server=createMessagingRuntime(f.deps);await server(request());const {withActorDatabase}=f.services.find(([kind])=>kind==='mutation')[1];
  for(const scope of [null,{}, {uid:'u',token:{}},{uid:'u',token:{workboardMessageMutationV1:true,workboardConversationMutationV1:true}}])await assert.rejects(withActorDatabase(scope,async()=>assert.fail('unscoped access')));
  assert.equal(f.apps.length,1);
});

test('the warm runtime checks the process kill switch on every request',async()=>{
  const env={...base},f=fixture(env),server=createMessagingRuntime(f.deps);
  assert.equal((await server(request())).status,200);
  env.WORKBOARD_MESSAGING_ENABLED='false';
  await closed(await server(request()));
  assert.equal(f.requests.length,1);
  env.WORKBOARD_MESSAGING_ENABLED='true';
  assert.equal((await server(request())).status,200);
});

test('the central stop always reads the uncached HTTPS control and fails closed on errors or invalid values',async()=>{
  const f=fixture(),requests=[];
  let value=true;
  f.deps.cert=()=>({getAccessToken:async()=>({access_token:'fixture-token'})});
  f.deps.fetchControl=async (url,options)=>{
    requests.push({url,cache:options.cache,redirect:options.redirect});
    if(value instanceof Error)throw value;
    return Response.json(value);
  };
  await createMessagingRuntime(f.deps)(request());
  const {checkAvailable}=f.services.find(([kind])=>kind==='handler')[1];
  assert.equal(await checkAvailable(),true);
  for(const state of [false,'true',null,new Error('synthetic network error')]){
    value=state;
    assert.equal(await checkAvailable(),false);
  }
  assert.equal(requests.length,5);
  assert.ok(requests.every(row=>row.url===base.WORKBOARD_FIREBASE_DATABASE_URL+'/messagingControlV1/enabled.json'&&row.cache==='no-store'&&row.redirect==='error'));
});
