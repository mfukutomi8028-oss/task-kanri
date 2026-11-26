import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessagingApiHandler} from '../security/messaging-api-handler.mjs';
import {createMessagingApiTransport} from './messaging-preview/workspace-messaging-api.js';
const origin='https://board.example.test',endpoint='https://api.example.test/messaging',roomId='roomA',p='p_'+'a'.repeat(32),conversationId='self_'+p,token='synthetic-id-token';
function fixture(){
  const calls=[];
  const handler=createMessagingApiHandler({allowedOrigins:[origin],history:{async readHistory(input){calls.push(['history',input]);return input.token===token?{status:'ok',joinedAt:1000,messages:[],nextCursor:null,hasMore:false}:{status:'forbidden'};}},mutation:{async mutate(input){calls.push(['message',input]);return {status:'conflict'};}},directory:{async readDirectory(input){calls.push(['directory',input]);return {status:'ok',roomId,personId:p,conversations:[],invites:[],hasMore:false,nextCursor:null};},async readUnread(input){calls.push(['unread',input]);return {status:'ok',roomId,personId:p,conversationId,joinedAt:1000,unread:0,latestIncoming:null,muted:false,complete:true};}},conversations:{async readPeople(input){calls.push(['people',input]);return {status:'ok',roomId,personId:p,people:[]};},async execute(input){calls.push(['conversation',input]);return {status:'ok',conversationId,revision:1,indexPending:false};}}});
  let identity={status:'bound',roomId,personId:p},listener;const session={getSnapshot:()=>identity,subscribe(fn){listener=fn;fn(identity);return ()=>{listener=null;};}};
  const fetchImpl=(url,init)=>{const headers=new Headers(init.headers);headers.set('Origin',origin);return handler(new Request(url,{...init,headers}));};
  return {handler,calls,session,fetchImpl,setIdentity(next){identity=next;listener?.(next);}};
}
const post=(body,headers={})=>new Request(endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+token,...headers},body:typeof body==='string'?body:JSON.stringify(body)});
const envelope=(action,payload={roomId})=>({action,payload,expectedPersonId:p});
test('actual HTTP handler dispatches only named operations with bearer identity outside JSON',async()=>{
  const f=fixture(),response=await f.handler(post(envelope('history',{roomId,conversationId,limit:50})));assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
  assert.equal((await response.json()).status,'ok');assert.deepEqual(f.calls,[['history',{roomId,conversationId,limit:50,token,expectedPersonId:p}]]);
  const result=await f.handler(post(envelope('message',{roomId,conversationId,command:{type:'remove'}})));assert.equal(result.status,409);assert.deepEqual(await result.json(),{status:'conflict'});
});
test('handler denies cross-origin, invalid bearer, wrong method and unknown action without reaching a service',async()=>{
  const f=fixture();for(const request of [post(envelope('history'),{Origin:'https://elsewhere.test'}),post(envelope('history'),{Authorization:'not-bearer'}),new Request(endpoint,{headers:{Origin:origin}}),post(envelope('reconcile')),post(envelope('history',{roomId,token:'forged'})),post({action:'people',payload:{roomId}}),post({...envelope('people'),action:{toString:'people'}}),post(envelope('people',{roomId,expectedPersonId:p}))])assert.ok((await f.handler(request)).status>=400);assert.deepEqual(f.calls,[]);
  const response=await f.handler(new Request(endpoint,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}}));assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
});
test('oversized or malformed body is rejected before dispatch',async()=>{
  const f=fixture();assert.equal((await f.handler(post('x'.repeat(65537)))).status,413);assert.equal((await f.handler(post('{broken'))).status,400);assert.equal((await f.handler(post(envelope('people'),{'Content-Type':'text/plain'}))).status,415);assert.deepEqual(f.calls,[]);
});
test('browser transport calls the real handler, forwards tokens only by header, and projects the store commands',async()=>{
  const f=fixture(),api=createMessagingApiTransport({endpoint,session:f.session,getToken:async()=>token,fetchImpl:(url,init)=>{assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert.equal(JSON.stringify(init.body).includes(token),false);return f.fetchImpl(url,init);}});
  assert.equal((await api.readHistory({roomId,conversationId,limit:50,before:null})).status,'ok');assert.equal((await api.send({roomId,conversationId,requestId:'q_'+'b'.repeat(32),input:{body:'Report'}})).status,'conflict');
  assert.equal((await api.readDirectory({roomId})).personId,p);assert.equal((await api.readPeople({roomId})).status,'ok');assert.equal((await api.executeConversation({roomId,conversationId,command:{type:'openSelf'}})).status,'ok');
  assert.deepEqual(f.calls[1],['message',{roomId,conversationId,command:{type:'send',requestId:'q_'+'b'.repeat(32),input:{body:'Report'}},token,expectedPersonId:p}]);api.dispose();
});
test('identity change cancels pending requests and discards late authorized results',async()=>{
  const f=fixture();let resolve,started;const gate=new Promise(r=>resolve=r),entered=new Promise(r=>started=r);let signal;
  const api=createMessagingApiTransport({endpoint,session:f.session,getToken:async()=>token,fetchImpl:async(url,init)=>{signal=init.signal;started();await gate;return f.fetchImpl(url,init);}});
  const pending=api.readHistory({roomId,conversationId});await entered;f.setIdentity({status:'locked'});assert.equal(signal.aborted,true);resolve();assert.deepEqual(await pending,{status:'locked'});assert.deepEqual(await api.readHistory({roomId,conversationId}),{status:'locked'});api.dispose();
});
test('browser transport rejects an unbound room and mismatched returned identity',async()=>{
  const f=fixture(),api=createMessagingApiTransport({endpoint,session:f.session,getToken:async()=>token,fetchImpl:async()=>new Response(JSON.stringify({status:'ok',roomId,personId:'p_'+'b'.repeat(32),conversations:[]}),{status:200,headers:{'Content-Type':'application/json'}})});
  assert.deepEqual(await api.readHistory({roomId:'other',conversationId}),{status:'locked'});assert.deepEqual(await api.readDirectory({roomId}),{status:'locked'});api.dispose();
});

test('browser and HTTP unread route carry only the selected conversation and authenticated actor',async()=>{
  const f=fixture(),api=createMessagingApiTransport({endpoint,session:f.session,getToken:async()=>token,fetchImpl:f.fetchImpl});
  assert.deepEqual(await api.readUnread({roomId,conversationId}),{status:'ok',roomId,personId:p,conversationId,joinedAt:1000,unread:0,latestIncoming:null,muted:false,complete:true});
  assert.deepEqual(f.calls,[['unread',{roomId,conversationId,token,expectedPersonId:p}]]);api.dispose();
});
test('unread transport rejects a summary for another conversation or person',async()=>{
  for(const patch of [{conversationId:'self_p_'+'b'.repeat(32)},{personId:'p_'+'b'.repeat(32)}]){
    const f=fixture(),api=createMessagingApiTransport({endpoint,session:f.session,getToken:async()=>token,fetchImpl:async()=>new Response(JSON.stringify({status:'ok',roomId,personId:p,conversationId,joinedAt:1000,unread:0,latestIncoming:null,muted:false,complete:true,...patch}),{status:200})});
    assert.ok(['locked','unavailable'].includes((await api.readUnread({roomId,conversationId})).status));api.dispose();
  }
});
