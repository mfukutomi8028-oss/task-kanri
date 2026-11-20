import { test, expect } from '@playwright/test';

// Exercise the exact canonical Origin series.preview-delete -> series.delete
// path against an isolated Firebase RTDB emulator, not a local-only simulation.
const PROJECT='demo-task-kanri';
const ROOM='test-firebase-emulator-recurring-delete-v658';
const HOST='127.0.0.1', PORT=9000;
const PROD_DATABASE_RE=/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i;
test.skip(process.env.WORK_BOARD_FIREBASE_E2E!=='1','requires the isolated RTDB emulator');
test.describe.configure({mode:'serial'});

function dbUrl(path){
 return 'http://'+HOST+':'+PORT+'/'+path.split('/').filter(Boolean).map(encodeURIComponent).join('/')+'.json?ns='+PROJECT;
}
async function db(path,method='GET',value){
 const response=await fetch(dbUrl(path),{method,headers:value===undefined?undefined:{'content-type':'application/json'},
   body:value===undefined?undefined:JSON.stringify(value)});
 if(!response.ok)throw Error('emulator '+method+' '+path+': '+response.status+' '+await response.text());
 const text=await response.text();return text?JSON.parse(text):null;
}
function task(id,overrides={}){
 const now=Date.now();
 return {
  id,title:'コピー・テスト繰り返し',description:'テスト繰り返しです。',
  requester:'',assignee:'福冨',status:'未着手',priority:'中',
  category:'その他',tags:[],dueDate:'',dueTime:'',pinned:false,
  checklist:[],comments:[],history:[],
  recurrence:'monthlyDay',recurrenceRule:{
   seriesId:'monthly-parent-v658',anchorDate:'2026-11-01',
   occurrenceDate:'2026-11-25',monthDay:25,interval:1,
   generatedCount:0,endMode:'never'
  },
  recurringParentId:'',nextRecurringTaskId:'',knowledgeId:'',
  createdAt:now-10000,createdBy:'福冨',
  updatedAt:now,updatedBy:'福冨',completedAt:0,completedMemo:'',
  revision:1,...overrides
 };
}
const PARENT='monthly-parent-v658', CHILD='monthly-child-v658', KEEP='unrelated-v658';
function seeds(){
 const parent=task(PARENT,{status:'完了',revision:2,nextRecurringTaskId:CHILD});
 const child=task(CHILD,{
  status:'未着手',recurringParentId:PARENT,
  recurrenceRule:{...parent.recurrenceRule,occurrenceDate:'2026-12-25',generatedCount:1}
 });
 const unrelated=task(KEEP,{title:'無関係なタスク',recurrence:'none',recurrenceRule:{}});
 return {[PARENT]:parent,[CHILD]:child,[KEEP]:unrelated};
}
async function boot(page){
 const productionRequests=[];
 await page.addInitScript(({project,room,host,port})=>{
  localStorage.clear();
  localStorage.setItem('systemTaskUser','福冨');
  localStorage.setItem('systemTaskRoomId',room);
  const config=Object.freeze({
   apiKey:'demo-api-key',authDomain:project+'.firebaseapp.com',
   databaseURL:'http://'+host+':'+port+'/?ns='+project,
   projectId:project,appId:'1:000000000000:web:firebase-emulator-only'
  });
  window.WORK_BOARD_TEST=Object.freeze({emulator:true,host,port});
  Object.defineProperty(window,'firebaseConfig',{
   configurable:true,get(){return config},set(){}
  });
 },{project:PROJECT,room:ROOM,host:HOST,port:PORT});
 await page.route(PROD_DATABASE_RE,route=>{
  productionRequests.push(route.request().url());return route.abort('blockedbyclient');
 });
 await page.goto('/?room='+ROOM,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.waitForFunction(()=>
  document.getElementById('connectionPill')?.classList.contains('remote-online')
  &&window.WorkBoardPaletteBridge?.readSnapshot().tasks.some(t=>t.id==='monthly-parent-v658'),
  undefined,{timeout:30000});
 expect(productionRequests).toEqual([]);
}
async function previewAndDelete(page,scope){
 return page.evaluate(async({scope,parent})=>{
  const bridge=window.WorkBoardPaletteBridge,snapshot=bridge.readSnapshot();
  const owner={ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser};
  const item=snapshot.tasks.find(t=>t.id===parent);
  const preview=await bridge.dispatch({type:'series.preview-delete',kind:'tasks',id:parent,
    revision:item.revision,...owner});
  if(!preview?.ok)return {preview};
  const deletion=await bridge.dispatch({type:'series.delete',
    token:preview.token,scope,...owner});
  return {preview,deletion};
 },{scope,parent:PARENT});
}
for(const scope of ['one','following','all']){
 test('Origin recurring delete '+scope+' succeeds remotely without any concurrent change',async({page})=>{
  test.setTimeout(100000);
  await db('rooms/'+ROOM,'DELETE');
  const original=seeds();
  await db('rooms/'+ROOM,'PUT',{tasks:original,meta:{v658Marker:'keep'}});
  await boot(page);
  const {preview,deletion}=await previewAndDelete(page,scope);
  expect(preview.ok).toBe(true);
  expect(preview.counts).toEqual({one:1,following:2,all:2});
  expect(deletion?.ok,'deletion: '+JSON.stringify(deletion)).toBe(true);
  const latest=await db('rooms/'+ROOM);
  expect(latest.meta.v658Marker).toBe('keep');
  expect(latest.tasks[KEEP]).toEqual(original[KEEP]);
  expect(Boolean(latest.tasks[PARENT])).toBe(false);
  expect(Boolean(latest.tasks[CHILD])).toBe(scope==='one');
 });
}
test('Origin recurring delete refuses a real concurrent change to a series member',async({page})=>{
 test.setTimeout(100000);
 await db('rooms/'+ROOM,'DELETE');
 const original=seeds();
 await db('rooms/'+ROOM,'PUT',{tasks:original,meta:{v658Marker:'keep'}});
 await boot(page);
 const result=await page.evaluate(async()=>{
  const b=window.WorkBoardPaletteBridge,s=b.readSnapshot(),item=s.tasks.find(t=>t.id==='monthly-parent-v658');
  return b.dispatch({type:'series.preview-delete',kind:'tasks',id:item.id,
    revision:item.revision,ownerRoom:s.roomId,ownerUser:s.currentUser});
 });
 expect(result.ok).toBe(true);
 await db('rooms/'+ROOM+'/tasks/'+CHILD,'PUT',{...original[CHILD],title:'実際に変更された次回タスク',revision:2});
 const attempted=await page.evaluate(async token=>{
  const b=window.WorkBoardPaletteBridge,s=b.readSnapshot();
  return b.dispatch({type:'series.delete',token,scope:'all',ownerRoom:s.roomId,ownerUser:s.currentUser});
 },result.token);
 expect(attempted.ok).toBe(false);
 const latest=await db('rooms/'+ROOM+'/tasks');
 expect(latest[PARENT]).toBeDefined();
 expect(latest[CHILD].title).toBe('実際に変更された次回タスク');
 expect(latest[KEEP]).toEqual(original[KEEP]);
});
