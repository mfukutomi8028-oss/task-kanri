import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessagingRuntime} from '../security/messaging-runtime.mjs';
const config={WORKBOARD_MESSAGING_ENABLED:'true',WORKBOARD_MESSAGING_ATTACHMENTS_ENABLED:'true',WORKBOARD_FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',project_id:'synthetic-project',client_email:'synthetic@synthetic-project.iam.gserviceaccount.com',private_key:'-----BEGIN PRIVATE KEY-----\nSYNTHETIC\n-----END PRIVATE KEY-----\n'}),WORKBOARD_FIREBASE_DATABASE_URL:'https://synthetic-project-default-rtdb.firebaseio.com',WORKBOARD_MESSAGING_ALLOWED_ORIGINS:'https://board.example.test',WORKBOARD_MESSAGING_DIGEST_KEY_HEX:'a'.repeat(64),SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-server-key'};
function fixture(env=config,mode='normal'){
 const calls=[];const auth={},database={},supabase={},attachments={upload(){},download(){},claim(){}};
 const deps={getEnv:key=>env[key],cert:()=>({}),initializeApp:()=>({}),getAuth:()=>auth,getDatabase:()=>database,deleteApp:async()=>{calls.push('delete');},createHistory:()=>({}),createDirectory:()=>({directory:{}}),createConversations:()=>({}),createMutation:input=>{calls.push(['mutation',input]);return {};},createApiHandler:input=>{calls.push(['handler',input]);return async()=>Response.json({status:'ok'});},createSupabase:(url,key)=>{calls.push(['supabase',url,key]);return supabase;},createAttachments:input=>{calls.push(['attachments',input]);if(mode==='throw')throw Error('secret config');return attachments;},makeId:()=> 'test'};
 const run=()=>createMessagingRuntime(deps)(new Request('https://api.example.test/messaging'));
 return {run,deps,calls,auth,database,supabase,attachments};
}
test('enabled attachment runtime constructs one trusted service and wires its claim into mutations and HTTP',async()=>{
 const f=fixture(),response=await f.run();assert.equal(response.status,200);
 assert.deepEqual(f.calls.find(x=>x[0]==='supabase'),['supabase',config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY]);assert.deepEqual(f.calls.find(x=>x[0]==='attachments'),['attachments',{auth:f.auth,database:f.database,supabase:f.supabase}]);assert.equal(f.calls.find(x=>x[0]==='mutation')[1].claimAttachments,f.attachments.claim);assert.equal(f.calls.find(x=>x[0]==='handler')[1].attachments,f.attachments);
});
test('disabled attachment feature does not initialize Supabase, while disabled messaging cannot initialize anything',async()=>{
 const f=fixture({...config,WORKBOARD_MESSAGING_ATTACHMENTS_ENABLED:'false'});assert.equal((await f.run()).status,200);assert.equal(f.calls.some(x=>x[0]==='supabase'),false);assert.equal(f.calls.find(x=>x[0]==='handler')[1].attachments,null);
 const g=fixture({...config,WORKBOARD_MESSAGING_ENABLED:'false'});assert.equal((await g.run()).status,503);assert.deepEqual(g.calls,[]);
});
test('enabled feature fails closed on missing credentials, unrelated URL or initialization failure',async()=>{
 for(const [env,mode] of [[{...config,SUPABASE_SERVICE_ROLE_KEY:''},'normal'],[{...config,SUPABASE_URL:'https://other.example.test'},'normal'],[config,'throw']]){const f=fixture(env,mode);const result=await f.run();assert.equal(result.status,503);assert.deepEqual(await result.json(),{status:'unavailable'});assert.equal(f.calls.some(x=>x[0]==='handler'),false);}
});
