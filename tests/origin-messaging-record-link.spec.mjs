import {test,expect} from '@playwright/test';
// Product-screen flows for record links. Synthetic data only. The fake backend
// mirrors the reviewed server and Rules outcomes (checked separately with the
// real Firebase SDK in the emulator): browsers cannot write links; the server
// issues fresh record ids for one visible source message and links only those;
// links are readable only by an approved device whose person is a current
// member, after join, while the message exists.
const room='origin-messaging-display-test',endpoint='https://abcdefghijklmnopqrst.supabase.co/functions/v1/workboard-messaging';
const pA='p_'+'a'.repeat(32),pB='p_'+'b'.repeat(32),pC='p_'+'c'.repeat(32);
const group='group_g_'+'d'.repeat(32),sourceId='msg_'+pA+'_q_'+'b'.repeat(32);
const SERVER='__fakeMessagingServer',ORIGIN=process.env.WB_TEST_ORIGIN||'http://127.0.0.1:4173';
const TITLE='Synthetic task from a message';

async function boot(page,{user='Synthetic Startup',reload=false,width=1366,height=900}={}){
  await page.setViewportSize({width,height});
  if(!reload){
    await page.route('**/*',route=>new URL(route.request().url()).origin===ORIGIN?route.continue():route.abort('blockedbyclient'));
    await page.addInitScript(({room,user,endpoint})=>{
      Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null;},set(){}});
      Object.defineProperty(window,'WORK_BOARD_MESSAGING',{configurable:true,get(){return Object.freeze({enabled:true,endpoint,attachmentsEnabled:true});},set(){}});
      localStorage.setItem('system-task-users:'+room,JSON.stringify([user]));
      localStorage.setItem('systemTaskUser',user);
      localStorage.setItem('systemTaskRoomId',room);
      // Every tab starts in the default display, so the synthetic backend is
      // installed before Origin captures the board bridge.
      for(const k of Object.keys(localStorage))if(k.startsWith('workBoardDisplayV356:'))localStorage.removeItem(k);
    },{room,user,endpoint});
    await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  }else{
    // Start the reload in the default display so the synthetic backend is
    // installed before Origin captures the board bridge (normal launch order).
    await page.evaluate(()=>{const key=window.WorkBoardStartup?.storageKey?.();if(key)localStorage.removeItem(key);for(const k of Object.keys(localStorage))if(k.startsWith('workBoardDisplayV356:'))localStorage.removeItem(k);});
    await page.reload({waitUntil:'domcontentloaded'});
  }
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
}
// Installs the synthetic messaging backend for one person. Server state (links,
// reservations, deletion) lives in localStorage so it survives reloads and is
// shared by tabs, like a real database.
async function install(page,{personId=pA,member=true,approved=true,connected=true,unknownFirstCreate=false}={}){
  await page.evaluate(({personId,member,approved,connected,unknownFirstCreate,group,sourceId,SERVER,pA,pB,endpoint})=>{
    const base=window.WorkBoardPaletteBridge,roomId=base.readSnapshot().roomId,uid='synthetic-'+personId.slice(2,8);
    const name=base.readSnapshot().currentUser;
    const server=()=>JSON.parse(localStorage.getItem(SERVER)||'{"links":{},"origins":{},"deleted":false}');
    const save=value=>localStorage.setItem(SERVER,JSON.stringify(value));
    const message={id:sourceId,senderId:pA,createdAt:2000,revision:1,body:'Synthetic task from a message\nReview summary',refs:[],attachmentIds:[],confirmationRequested:false,replyTo:null};
    const newers=Array.from({length:120},(_,i)=>({...message,id:'msg_'+pA+'_q_'+i.toString(16).padStart(32,'c'),createdAt:3000+i,body:'Newer synthetic note '+i}));
    const all=()=>[server().deleted?{id:message.id,senderId:pA,createdAt:2000,revision:2,deletedAt:4000}:message,...newers];
    const denied=()=>Object.assign(Error('PERMISSION_DENIED: synthetic'),{code:'PERMISSION_DENIED'});
    let state={connected,approved,member,failReserve:false};
    const watchers=new Map();
    const notify=(path,value)=>{for(const fn of watchers.get(path)??[])fn({val:()=>value});};
    const binding=()=>({uid,roomId,personId,displayName:name,approved:state.approved,active:true});
    const t=window.__businessTest={base,personId,reads:[],reserves:[],clientWrites:[],history:[],connections:0,
      setConnected(v){state.connected=v;notify('.info/connected',v);},
      revoke(){state.approved=false;notify('messagingAccessV1/'+roomId+'/'+uid,binding());},
      leave(){state.member=false;},
      failReserve(v){state.failReserve=v;},
      deleteSource(){const s=server();s.deleted=true;save(s);},
      links:()=>server().links,origins:()=>server().origins};
    const linkReadable=()=>state.member&&!server().deleted;
    const firstCreate={pending:unknownFirstCreate};
    window.WorkBoardPaletteBridge={...base,readSnapshot:()=>({...base.readSnapshot(),connectionMode:'remote-online'}),subscribe:fn=>base.subscribe(s=>fn({...s,connectionMode:'remote-online'})),
      // Optionally lose the first create's response after the record was saved.
      async dispatch(command){const result=await base.dispatch(command);if(firstCreate.pending&&command.type==='task.create'&&result?.ok){firstCreate.pending=false;return {ok:false,error:'transaction-aborted-or-invariant-failure'};}return result;},
      async getMessagingConnection(){
        t.connections++;
        const read=path=>{
          t.reads.push(path);
          if(path==='.info/connected')return state.connected;
          if(path==='messagingControlV1/enabled')return true;
          if(path==='messagingAccessV1/'+roomId+'/'+uid)return binding();
          if(path.endsWith('/members/'+personId))return state.member?{active:true,joinedAt:1000,role:'member'}:null;
          if(path.includes('/recordLinks/')){const value=server().links[path]??null;if(value&&!linkReadable())throw denied();return value;}
          if(path.endsWith('/'+message.id))return all()[0];
          return null;
        };
        // Mirrors the Rules: no browser write to links or reservations is allowed.
        const refuse=path=>{t.clientWrites.push(path);if(path.includes('/recordLinks')||path.includes('/recordOrigins'))throw denied();throw Error('Unexpected write');};
        const sdk={db:{},ref:(_,path)=>path,
          get:async path=>{const value=read(path);return {val:()=>value};},
          onValue(path,fn){const set=watchers.get(path)??new Set();watchers.set(path,set);set.add(fn);queueMicrotask(()=>{if(set.has(fn))fn({val:()=>read(path)});});return ()=>set.delete(fn);},
          async set(path){refuse(path);},update(path){refuse(path);},
          runTransaction(_p,update){return Promise.resolve({committed:true,snapshot:{val:()=>update(null)}});},serverTimestamp:()=>({'.sv':'timestamp'})};
        const user={uid,getIdToken:async()=>'synthetic-id-token'};
        return {app:{},sdk,authSdk:{getAuth:()=>({currentUser:user,authStateReady:async()=>{}}),signInAnonymously(){throw Error('Unexpected sign-in');},onAuthStateChanged(_a,fn){queueMicrotask(fn);return ()=>{};}}};
      }};
    const realFetch=window.fetch;
    const cursorOf=m=>({id:m.id,createdAt:m.createdAt});
    const before=(m,c)=>!c||m.createdAt<c.createdAt||m.createdAt===c.createdAt&&m.id<c.id;
    const after=(m,c)=>m.createdAt>c.createdAt||m.createdAt===c.createdAt&&m.id>c.id;
    const chars='-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
    const issue=()=>'-'+Array.from(crypto.getRandomValues(new Uint8Array(19)),b=>chars[b%64]).join('');
    const reply=(value,status=200)=>Promise.resolve(Response.json(value,{status}));
    window.fetch=(url,options)=>{
      if(url!==endpoint)return realFetch.call(window,url,options);
      const {action,payload}=JSON.parse(options.body);const scope={status:'ok',roomId,personId};
      if(!state.connected||!state.approved)return reply({status:'forbidden'},403);
      if(action==='people')return reply({...scope,people:[{personId:pA,displayName:'Synthetic A'},{personId:pB,displayName:'Synthetic B'}].filter((p,i,list)=>list.findIndex(x=>x.personId===p.personId)===i)});
      if(action==='directory')return reply({...scope,conversations:state.member?[{id:group,kind:'group',title:'検証グループ',status:'active',role:'member',memberCount:2,joinedAt:1000,revision:1,controlUpdatedAt:1000}]:[],invites:[],hasMore:false,nextCursor:null});
      if(action==='unread')return reply({...scope,conversationId:payload.conversationId,joinedAt:1000,unread:0,complete:true,muted:false,latestIncoming:null});
      if(action==='recordReserve'){
        t.reserves.push(payload);
        if(state.failReserve)return reply({status:'unavailable'},503);
        const s=server(),source=all().find(m=>m.id===payload.messageId);
        if(!state.member||!source||source.deletedAt||payload.conversationId!==group||Object.keys(payload).some(k=>!['roomId','conversationId','messageId','requestId','recordType','count'].includes(k)))return reply({status:'forbidden'},403);
        const mine=s.origins[personId]??={};
        const known=mine[payload.requestId];
        if(known)return known.messageId===payload.messageId&&known.recordType===payload.recordType&&known.ids.length===payload.count?reply({status:'ok',requestId:payload.requestId,recordType:payload.recordType,ids:known.ids}):reply({status:'conflict'},409);
        const ids=Array.from({length:payload.count},issue);
        for(const id of ids)s.links['messagingV1/'+roomId+'/recordLinks/'+payload.recordType+'/'+id]={conversationId:group,messageId:payload.messageId,createdBy:personId,createdAt:5000};
        mine[payload.requestId]={messageId:payload.messageId,recordType:payload.recordType,ids};save(s);
        return reply({status:'ok',requestId:payload.requestId,recordType:payload.recordType,ids});
      }
      if(action==='history'){
        t.history.push(payload);
        if(!state.member)return reply({status:'forbidden'},403);
        const list=all();
        if(payload.around){
          const index=list.findIndex(m=>m.id===payload.around);
          if(index<0||list[index].deletedAt)return reply({status:'missing'},404);
          const older=list.slice(Math.max(0,index-25),index),newer=list.slice(index+1,index+27),messages=[...older.slice(-24),list[index],...newer.slice(0,25)];
          const hasMore=older.length>24,hasNewer=newer.length>25;
          return reply({status:'ok',joinedAt:1000,messages,hasMore,nextCursor:hasMore?cursorOf(messages[0]):null,hasNewer,newerCursor:hasNewer?cursorOf(messages.at(-1)):null});
        }
        if(payload.after){
          const next=list.filter(m=>after(m,payload.after)).slice(0,payload.limit+1),messages=next.slice(0,payload.limit),hasNewer=next.length>payload.limit;
          return reply({status:'ok',joinedAt:1000,messages,hasNewer,newerCursor:hasNewer?cursorOf(messages.at(-1)):null});
        }
        const page=list.filter(m=>before(m,payload.before)).slice(-50);
        return reply({status:'ok',joinedAt:1000,messages:page,hasMore:page.length===50,nextCursor:page.length===50?cursorOf(page[0]):null});
      }
      return Promise.reject(Error('Unexpected synthetic action '+action));
    };
  },{personId,member,approved,connected,unknownFirstCreate,group,sourceId,SERVER,pA,pB,endpoint});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
}
const ui=page=>{const root=page.locator('#modernOriginRoot');return {root,trigger:root.locator('.origin-message-trigger'),dialog:root.locator('dialog.origin-message-host')};};
async function openTask(page,title){
  const {root}=ui(page);
  await root.locator('#desktopNav [data-route=tasks]').click();
  await root.locator('.origin-task-collection .item-name',{hasText:title}).click();
  return root.locator('#sheet .origin-message-link');
}
async function openSource(page){
  const {root,trigger,dialog}=ui(page);
  // After a save from a message, the board returns to the open messaging dialog.
  if(!(await dialog.evaluate(el=>el.open))){await trigger.click();await expect(root.getByText('接続済み',{exact:true})).toBeVisible();}
  await dialog.getByRole('button',{name:'検証グループ',exact:true}).click();
  await expect(dialog.locator('.om-message').last()).toBeVisible();
  // The source is older than the latest page; load it through the screen.
  for(let i=0;i<4&&!(await dialog.locator('.om-message[data-message-id="'+sourceId+'"]').count());i++){
    await dialog.getByRole('button',{name:/以前のメッセージ/}).click();
  }
  return dialog.locator('.om-message[data-message-id="'+sourceId+'"]');
}
// Creates a task from the source message through the real messaging screen.
async function createTaskFromMessage(page,{prepare,submit=true}={}){
  const {root,dialog}=ui(page);
  const msg=await openSource(page);
  await msg.getByRole('button',{name:'その他',exact:true}).click();
  await dialog.getByRole('button',{name:'タスクを作成',exact:true}).click();
  const form=root.locator('#editForm[data-kind="tasks"]');
  await expect(form.locator('[name=title]')).toHaveValue(TITLE);
  await prepare?.(form);
  if(submit)await root.locator('#sheet button[form=editForm]').click();
  return form;
}
const taskIds=page=>page.evaluate(title=>window.__businessTest.base.readSnapshot().tasks.filter(t=>t.title===title).map(t=>t.id),TITLE);
const linkPath=(type,id)=>'messagingV1/'+room+'/recordLinks/'+type+'/'+id;
const linkKeys=page=>page.evaluate(()=>Object.keys(window.__businessTest.links()).sort());

test('normal launch: a created task carries a server-issued link; the detail checks it only on request and opens the message in a window',async({page})=>{
  test.setTimeout(120000);
  await boot(page);await install(page);
  await createTaskFromMessage(page);
  await expect.poll(()=>taskIds(page)).toHaveLength(1);
  const [taskId]=await taskIds(page);
  // The record was saved under the id the server issued, which already carries the link.
  const reserves=await page.evaluate(()=>window.__businessTest.reserves);
  expect(reserves).toHaveLength(1);
  expect(Object.keys(reserves[0]).sort()).toEqual(['conversationId','count','messageId','recordType','requestId','roomId']);
  expect(reserves[0]).toMatchObject({recordType:'task',count:1,messageId:sourceId});
  expect(await linkKeys(page)).toEqual([linkPath('task',taskId)]);
  expect(JSON.stringify(await page.evaluate(()=>window.__businessTest.links()))).not.toContain('Review summary');
  expect(await page.evaluate(()=>window.__businessTest.clientWrites)).toEqual([]);
  // Nothing about the message is kept in this browser.
  expect(await page.evaluate(id=>Object.entries(localStorage).filter(([k,v])=>k!=='__fakeMessagingServer'&&(v.includes(id)||k.includes('pending-links'))).length,sourceId)).toBe(0);
  // Normal launch after a reload: messaging is not connected until asked.
  await boot(page,{reload:true});await install(page);
  const {dialog}=ui(page);
  const check=await openTask(page,TITLE);
  await expect(check).toHaveText('元メッセージを確認');
  expect(await page.evaluate(()=>window.__businessTest.connections)).toBe(0);
  await check.click();
  await expect(dialog).toHaveAttribute('open','');
  await expect(dialog.locator('.om-message[data-message-id="'+sourceId+'"]')).toBeFocused();
  // One bounded window by id; no sequential older pages; the gap is explicit.
  const history=await page.evaluate(()=>window.__businessTest.history);
  expect(history.filter(h=>h.before)).toHaveLength(0);
  expect(history.filter(h=>h.around===sourceId)).toHaveLength(1);
  await expect(dialog.getByText('ここから最新までのメッセージは未取得です。')).toBeVisible();
  expect(await dialog.locator('.om-message').count()).toBeLessThanOrEqual(50);
  await dialog.getByRole('button',{name:'新しいメッセージを読み込む'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__businessTest.history.filter(h=>h.after).length)).toBe(1);
  await expect(dialog.locator('.om-message[data-message-id="'+sourceId+'"]')).toBeVisible();
  await dialog.getByRole('button',{name:'最新に戻る'}).click();
  await expect(dialog.getByText('ここから最新までのメッセージは未取得です。')).toHaveCount(0);
  await expect(dialog.locator('.om-message').last()).toContainText('Newer synthetic note 119');
  expect(await page.evaluate(()=>window.__businessTest.connections)).toBe(1);
});

test('an unrelated existing record never gets a link; another authorized member can use a real one; a non-member learns nothing',async({page})=>{
  test.setTimeout(120000);
  await boot(page);
  // An existing task created normally on the board, before any messaging use.
  await page.evaluate(async()=>{const b=window.WorkBoardPaletteBridge,s=b.readSnapshot();await b.dispatch({type:'task.create',title:'Existing unrelated task',revision:0,ownerRoom:s.roomId,ownerUser:s.currentUser});});
  await install(page);
  await createTaskFromMessage(page);
  await expect.poll(()=>taskIds(page)).toHaveLength(1);
  const [taskId]=await taskIds(page);
  const existingId=await page.evaluate(()=>window.__businessTest.base.readSnapshot().tasks.find(t=>t.title==='Existing unrelated task').id);
  expect(await linkKeys(page)).toEqual([linkPath('task',taskId)]);
  // The browser cannot write a link for the existing record (Rules deny).
  const direct=await page.evaluate(async path=>{const c=await window.WorkBoardPaletteBridge.getMessagingConnection();try{await c.sdk.set(path,{});return 'written';}catch(e){return e.code;}},linkPath('task',existingId));
  expect(direct).toBe('PERMISSION_DENIED');
  expect(await linkKeys(page)).toEqual([linkPath('task',taskId)]);
  const {root,dialog}=ui(page);
  await page.keyboard.press('Escape');
  await (await openTask(page,'Existing unrelated task')).click();
  await expect(root.getByText('確認できる元メッセージはありません。リンクがないか、閲覧できない会話です。')).toBeVisible();
  // Same record, another approved member of the source conversation.
  await boot(page,{reload:true});await install(page,{personId:pB});
  await (await openTask(page,TITLE)).click();
  await expect(dialog.locator('.om-message[data-message-id="'+sourceId+'"]')).toBeFocused();
  // A different approved person who is not a member of the conversation.
  await boot(page,{reload:true});await install(page,{personId:pC,member:false});
  await (await openTask(page,TITLE)).click();
  await expect(root.getByText('確認できる元メッセージはありません。リンクがないか、閲覧できない会話です。')).toBeVisible();
  await expect(dialog).not.toHaveAttribute('open','');
  expect(await page.evaluate(()=>window.__businessTest.history.filter(h=>h.around).length)).toBe(0);
});

test('unapproved, offline and revoked devices are told to connect and never read the link; leaving or deleting hides it',async({page})=>{
  test.setTimeout(120000);
  await boot(page);await install(page);
  await createTaskFromMessage(page);
  await expect.poll(()=>taskIds(page)).toHaveLength(1);
  for(const options of [{approved:false},{connected:false}]){
    await boot(page,{reload:true});await install(page,options);
    const {root,dialog}=ui(page);
    await (await openTask(page,TITLE)).click();
    await expect(root.getByText('メッセージに接続できないため確認できません。端末の承認と接続を確認してください。')).toBeVisible({timeout:20000});
    await expect(dialog.getByText(/未承認またはオフライン|接続できません/)).toBeVisible();
    expect(await page.evaluate(()=>window.__businessTest.reads.filter(p=>p.includes('/recordLinks/')))).toEqual([]);
    await dialog.locator('.origin-message-dismiss').click();
  }
  // Revocation after the link was usable, then a reload while revoked.
  await boot(page,{reload:true});await install(page);
  const {root,dialog}=ui(page);
  const check=await openTask(page,TITLE);
  await check.click();
  await expect(dialog.locator('.om-message[data-message-id="'+sourceId+'"]')).toBeFocused();
  await dialog.locator('.origin-message-dismiss').click();
  await page.evaluate(()=>window.__businessTest.revoke());
  const reads=await page.evaluate(()=>window.__businessTest.reads.filter(p=>p.includes('/recordLinks/')).length);
  await check.click();
  await expect(root.getByText('メッセージに接続できないため確認できません',{exact:false})).toBeVisible({timeout:20000});
  expect(await page.evaluate(()=>window.__businessTest.reads.filter(p=>p.includes('/recordLinks/')).length)).toBe(reads);
  await dialog.locator('.origin-message-dismiss').click();
  await boot(page,{reload:true});await install(page,{approved:false});
  await (await openTask(page,TITLE)).click();
  await expect(root.getByText('メッセージに接続できないため確認できません',{exact:false})).toBeVisible({timeout:20000});
  expect(await page.evaluate(()=>window.__businessTest.reads.filter(p=>p.includes('/recordLinks/')))).toEqual([]);
  await dialog.locator('.origin-message-dismiss').click();
  // Leaving the conversation or deleting the source hides it; the task stays.
  await boot(page,{reload:true});await install(page,{member:false});
  await (await openTask(page,TITLE)).click();
  await expect(root.getByText('確認できる元メッセージはありません',{exact:false})).toBeVisible();
  // Rejoining (a fresh membership on this device) restores access to the same link.
  await boot(page,{reload:true});await install(page);
  await (await openTask(page,TITLE)).click();
  await expect(dialog.locator('.om-message[data-message-id="'+sourceId+'"]')).toBeFocused();
  await dialog.locator('.origin-message-dismiss').click();
  await page.evaluate(()=>window.__businessTest.deleteSource());
  // The task detail is still open: check again from the same detail.
  await root.locator('#sheet .origin-message-link').click();
  await expect(root.getByText('確認できる元メッセージはありません',{exact:false})).toBeVisible();
  expect(await taskIds(page)).toHaveLength(1);
});

test('an unknown save result is retried with the same issued id: one task, one link',async({page})=>{
  test.setTimeout(120000);
  await boot(page);await install(page,{unknownFirstCreate:true});
  const {root}=ui(page);
  await createTaskFromMessage(page);
  await expect(root.getByText('保存できませんでした。入力内容は保持されています。').first()).toBeVisible();
  await expect.poll(()=>taskIds(page)).toHaveLength(1);
  // The person saves again from the kept input.
  await root.locator('#sheet button[form=editForm]').click();
  await expect(root.locator('#editForm')).toHaveCount(0);
  expect(await taskIds(page)).toHaveLength(1);
  const reserves=await page.evaluate(()=>window.__businessTest.reserves);
  expect(reserves).toHaveLength(2);expect(reserves[1].requestId).toBe(reserves[0].requestId);
  const [taskId]=await taskIds(page);
  expect(await linkKeys(page)).toEqual([linkPath('task',taskId)]);
});

test('when no link can be reserved the person keeps the input or saves without a link; a later save links normally',async({page})=>{
  test.setTimeout(120000);
  await boot(page);await install(page);
  const {root}=ui(page);
  await page.evaluate(()=>window.__businessTest.failReserve(true));
  const answers=['dismiss','accept'],seen=[];
  page.on('dialog',dialog=>{seen.push(dialog.message());void (answers.shift()==='accept'?dialog.accept():dialog.dismiss());});
  await createTaskFromMessage(page);
  await expect(root.getByText('元メッセージへのリンクを付けられないため、保存を中止しました。',{exact:false}).first()).toBeVisible();
  expect(await taskIds(page)).toHaveLength(0);
  expect(seen[0]).toContain('リンクなしで保存しますか');
  // Connection restored: saving again from the kept input attaches the link.
  await page.evaluate(()=>window.__businessTest.failReserve(false));
  await root.locator('#sheet button[form=editForm]').click();
  await expect.poll(()=>taskIds(page)).toHaveLength(1);
  const [taskId]=await taskIds(page);
  expect(await linkKeys(page)).toEqual([linkPath('task',taskId)]);
  // Choosing to save without a link stores the record and says so.
  await page.evaluate(()=>window.__businessTest.failReserve(true));
  await createTaskFromMessage(page);
  await expect(root.getByText('元メッセージへのリンクは付けずに保存しました。',{exact:false}).first()).toBeVisible();
  await expect.poll(()=>taskIds(page)).toHaveLength(2);
  expect(await linkKeys(page)).toEqual([linkPath('task',taskId)]);
});

test('a start-date save failure after the task body keeps the link without duplicating the task',async({page})=>{
  test.setTimeout(120000);
  await boot(page);await install(page);
  await page.evaluate(()=>{const starts=window.WorkBoardOriginStartBridge;let failed=false;window.WorkBoardOriginStartBridge={...starts,async save(value){if(!failed){failed=true;return {ok:false,error:'network'};}return starts.save(value);}};});
  await createTaskFromMessage(page,{prepare:async form=>{await form.locator('[name=startDate]').fill('2026-12-01');}});
  const {root}=ui(page);
  await expect(root.getByText('開始日を保存できませんでした',{exact:false})).toBeVisible();
  await expect.poll(()=>taskIds(page)).toHaveLength(1);
  const [taskId]=await taskIds(page);
  expect(await linkKeys(page)).toEqual([linkPath('task',taskId)]);
  // Retrying the start date updates the same task; no second task, reservation or link.
  await root.locator('#sheet button[form=editForm]').click();
  await expect.poll(()=>page.evaluate(()=>{const id=window.__businessTest.base.readSnapshot().tasks.find(t=>t.title==='Synthetic task from a message')?.id;return window.WorkBoardOriginStartBridge.readSnapshot()?.[id]?.date||'';})).toBe('2026-12-01');
  expect(await taskIds(page)).toHaveLength(1);
  expect(await page.evaluate(()=>window.__businessTest.reserves.length)).toBe(1);
  expect(await linkKeys(page)).toEqual([linkPath('task',taskId)]);
});

test('single and multi-day schedules created from a message each get their own link',async({page})=>{
  test.setTimeout(120000);
  await boot(page);await install(page);
  // The batch overlaps the single schedule; the person confirms the overlap.
  const confirmations=[];page.on('dialog',dialog=>{confirmations.push(dialog.message());void dialog.accept();});
  const {root,dialog}=ui(page);
  const createSchedule=async batch=>{
    const msg=await openSource(page);
    await msg.getByRole('button',{name:'その他',exact:true}).click();
    await dialog.getByRole('button',{name:'予定を作成',exact:true}).click();
    const form=root.locator('#editForm[data-kind="events"]');
    await expect(form.locator('[name=title]')).toHaveValue(TITLE);
    if(batch){
      await form.locator('.origin-batch-options summary').click();
      await form.locator('[name=batchEnabled]').check();
      await form.locator('[name=batchCount]').fill(String(batch));
      await form.getByRole('button',{name:'作成日を確認'}).click();
      await expect(form.locator('#originBatchReview')).toContainText(batch+'件の作成日');
    }
    await root.locator('#sheet button[form=editForm]').click();
  };
  const scheduleIds=()=>page.evaluate(title=>window.__businessTest.base.readSnapshot().schedules.filter(s=>s.title===title).map(s=>s.id).sort(),TITLE);
  await createSchedule(0);
  await expect.poll(scheduleIds).toHaveLength(1);
  await createSchedule(3);
  await expect.poll(scheduleIds).toHaveLength(4);
  const ids=await scheduleIds();
  expect(await linkKeys(page)).toEqual(ids.map(id=>linkPath('schedule',id)).sort());
  expect((await page.evaluate(()=>window.__businessTest.reserves)).map(r=>[r.recordType,r.count])).toEqual([['schedule',1],['schedule',3]]);
});

test('two tabs create from the same message at the same time without sharing or losing anything; old browser pending entries are removed',async({page,context})=>{
  test.setTimeout(150000);
  await boot(page);
  await page.evaluate(p=>localStorage.setItem('wb-messaging-pending-links-v1|origin-messaging-display-test|'+p,'{"task/t1":{"conversationId":"x","messageId":"y"}}'),pA);
  await install(page);
  await expect.poll(()=>page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('wb-messaging-pending-links-v1|')).length)).toBe(0);
  const second=await context.newPage();
  await boot(second);await install(second);
  // Each tab opens its own editor from the same message, then both save at once.
  for(const tab of [page,second]){await tab.bringToFront();await createTaskFromMessage(tab,{submit:false});}
  await Promise.all([page,second].map(tab=>ui(tab).root.locator('#sheet button[form=editForm]').click()));
  await expect.poll(async()=>(await page.evaluate(title=>window.__businessTest.base.readSnapshot().tasks.filter(t=>t.title===title).length,TITLE))+(await second.evaluate(title=>window.__businessTest.base.readSnapshot().tasks.filter(t=>t.title===title).length,TITLE))).toBe(2);
  const reserves=[...await page.evaluate(()=>window.__businessTest.reserves),...await second.evaluate(()=>window.__businessTest.reserves)];
  expect(new Set(reserves.map(r=>r.requestId)).size).toBe(2);
  const links=await linkKeys(page);
  expect(links).toHaveLength(2);
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('wb-messaging-pending-links-v1|')))).toEqual([]);
});

for(const width of [320,390]){
  test('phone width '+width+'px: the source opens in a window with the gap and no horizontal scroll',async({page})=>{
    test.setTimeout(120000);
    await boot(page);await install(page);
    await createTaskFromMessage(page);
    await expect.poll(()=>taskIds(page)).toHaveLength(1);
    await boot(page,{reload:true,width,height:780});await install(page);
    const {root,dialog}=ui(page);
    await root.locator('.origin-mobile-nav [data-route=tasks], #desktopNav [data-route=tasks]').first().evaluate(el=>el.click());
    await root.locator('.origin-task-collection .item-name',{hasText:TITLE}).first().click();
    await root.locator('#sheet .origin-message-link').click();
    await expect(dialog.locator('.om-message[data-message-id="'+sourceId+'"]')).toBeFocused();
    const gap=dialog.locator('.om-gap');
    await expect(gap).toBeVisible();
    await gap.scrollIntoViewIfNeeded();
    for(const name of ['新しいメッセージを読み込む','最新に戻る']){
      const box=await gap.getByRole('button',{name}).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  });
}
