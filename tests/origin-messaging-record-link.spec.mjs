import {test,expect} from '@playwright/test';
// Product-screen flows for shared record links. Synthetic data only. The fake
// backend mirrors the reviewed Rules outcomes (checked separately in the
// Firebase emulator): one link per record, readable only by an approved device
// whose person is a current member, after join, while the message exists.
const room='origin-messaging-display-test',endpoint='https://abcdefghijklmnopqrst.supabase.co/functions/v1/workboard-messaging';
const pA='p_'+'a'.repeat(32),pB='p_'+'b'.repeat(32),pC='p_'+'c'.repeat(32);
const group='group_g_'+'d'.repeat(32),sourceId='msg_'+pA+'_q_'+'b'.repeat(32);
const SERVER='__fakeMessagingServer',ORIGIN=process.env.WB_TEST_ORIGIN||'http://127.0.0.1:4173';

async function boot(page,{user='Synthetic Startup',reload=false}={}){
  await page.setViewportSize({width:1366,height:900});
  if(!reload){
    await page.route('**/*',route=>new URL(route.request().url()).origin===ORIGIN?route.continue():route.abort('blockedbyclient'));
    await page.addInitScript(({room,user,endpoint})=>{
      Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null;},set(){}});
      Object.defineProperty(window,'WORK_BOARD_MESSAGING',{configurable:true,get(){return Object.freeze({enabled:true,endpoint,attachmentsEnabled:true});},set(){}});
      localStorage.setItem('system-task-users:'+room,JSON.stringify([user]));
      localStorage.setItem('systemTaskUser',user);
      localStorage.setItem('systemTaskRoomId',room);
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
// deletion) lives in localStorage so it survives reloads like a real database.
async function install(page,{personId=pA,member=true,approved=true,connected=true}={}){
  await page.evaluate(({personId,member,approved,connected,group,sourceId,SERVER,pA,pB,endpoint})=>{
    const base=window.WorkBoardPaletteBridge,roomId=base.readSnapshot().roomId,uid='synthetic-'+personId.slice(2,8);
    const name=base.readSnapshot().currentUser;
    const server=()=>JSON.parse(localStorage.getItem(SERVER)||'{"links":{},"deleted":false}');
    const save=value=>localStorage.setItem(SERVER,JSON.stringify(value));
    const message={id:sourceId,senderId:pA,createdAt:2000,revision:1,body:'Synthetic task from a message\nReview summary',refs:[],attachmentIds:[],confirmationRequested:false,replyTo:null};
    const newers=Array.from({length:120},(_,i)=>({...message,id:'msg_'+pA+'_q_'+i.toString(16).padStart(32,'c'),createdAt:3000+i,body:'Newer synthetic note '+i}));
    const all=()=>[server().deleted?{id:message.id,senderId:pA,createdAt:2000,revision:2,deletedAt:4000}:message,...newers];
    const denied=()=>Object.assign(Error('PERMISSION_DENIED: synthetic'),{code:'PERMISSION_DENIED'});
    let state={connected,approved,member,failLinks:false};
    const watchers=new Map();
    const notify=(path,value)=>{for(const fn of watchers.get(path)??[])fn({val:()=>value});};
    const binding=()=>({uid,roomId,personId,displayName:name,approved:state.approved,active:true});
    const t=window.__businessTest={base,personId,reads:[],linkWrites:[],history:[],connections:0,
      setConnected(v){state.connected=v;notify('.info/connected',v);},
      revoke(){state.approved=false;notify('messagingAccessV1/'+roomId+'/'+uid,binding());},
      leave(){state.member=false;},
      failLinks(v){state.failLinks=v;},
      deleteSource(){const s=server();s.deleted=true;save(s);},
      links:()=>server().links};
    const linkReadable=()=>state.member&&!server().deleted;
    window.WorkBoardPaletteBridge={...base,readSnapshot:()=>({...base.readSnapshot(),connectionMode:'remote-online'}),subscribe:fn=>base.subscribe(s=>fn({...s,connectionMode:'remote-online'})),
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
        const sdk={db:{},ref:(_,path)=>path,
          get:async path=>{const value=read(path);return {val:()=>value};},
          onValue(path,fn){const set=watchers.get(path)??new Set();watchers.set(path,set);set.add(fn);queueMicrotask(()=>{if(set.has(fn))fn({val:()=>read(path)});});return ()=>set.delete(fn);},
          async set(path,value){
            if(!path.includes('/recordLinks/'))throw Error('Unexpected write');
            if(!state.connected||state.failLinks)throw Object.assign(Error('offline'),{code:'unavailable'});
            const s=server();
            if(s.links[path]||!state.member||value.createdBy!==personId)throw denied();
            t.linkWrites.push({path,value});s.links[path]={...value,createdAt:5000};save(s);
          },
          update(){throw Error('Unexpected write');},runTransaction(_p,update){return Promise.resolve({committed:true,snapshot:{val:()=>update(null)}});},serverTimestamp:()=>({'.sv':'timestamp'})};
        const user={uid,getIdToken:async()=>'synthetic-id-token'};
        return {app:{},sdk,authSdk:{getAuth:()=>({currentUser:user,authStateReady:async()=>{}}),signInAnonymously(){throw Error('Unexpected sign-in');},onAuthStateChanged(_a,fn){queueMicrotask(fn);return ()=>{};}}};
      }};
    const realFetch=window.fetch;
    const cursorOf=m=>({id:m.id,createdAt:m.createdAt});
    const before=(m,c)=>!c||m.createdAt<c.createdAt||m.createdAt===c.createdAt&&m.id<c.id;
    window.fetch=(url,options)=>{
      if(url!==endpoint)return realFetch.call(window,url,options);
      const {action,payload}=JSON.parse(options.body);const scope={status:'ok',roomId,personId};
      if(!state.connected||!state.approved)return Promise.resolve(Response.json({status:'forbidden'},{status:403}));
      if(action==='people')return Promise.resolve(Response.json({...scope,people:[{personId:pA,displayName:'Synthetic A'},{personId:pB,displayName:'Synthetic B'}].filter((p,i,list)=>list.findIndex(x=>x.personId===p.personId)===i)}));
      if(action==='directory')return Promise.resolve(Response.json({...scope,conversations:state.member?[{id:group,kind:'group',title:'検証グループ',status:'active',role:'member',memberCount:2,joinedAt:1000,revision:1,controlUpdatedAt:1000}]:[],invites:[],hasMore:false,nextCursor:null}));
      if(action==='unread')return Promise.resolve(Response.json({...scope,conversationId:payload.conversationId,joinedAt:1000,unread:0,complete:true,muted:false,latestIncoming:null}));
      if(action==='history'){
        t.history.push(payload);
        if(!state.member)return Promise.resolve(Response.json({status:'forbidden'},{status:403}));
        const list=all();
        if(payload.until){
          const index=list.findIndex(m=>m.id===payload.until);
          if(index<0||list[index].deletedAt)return Promise.resolve(Response.json({status:'missing'},{status:404}));
          const range=list.slice(index).filter(m=>before(m,payload.before));
          return Promise.resolve(Response.json({status:'ok',joinedAt:1000,messages:range,hasMore:index>0,nextCursor:index>0?cursorOf(range[0]):null}));
        }
        const page=list.filter(m=>before(m,payload.before)).slice(-50);
        return Promise.resolve(Response.json({status:'ok',joinedAt:1000,messages:page,hasMore:page.length===50,nextCursor:page.length===50?cursorOf(page[0]):null}));
      }
      return Promise.reject(Error('Unexpected synthetic action '+action));
    };
  },{personId,member,approved,connected,group,sourceId,SERVER,pA,pB,endpoint});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
}
const ui=page=>{const root=page.locator('#modernOriginRoot');return {root,trigger:root.locator('.origin-message-trigger'),dialog:root.locator('dialog.origin-message-host')};};
async function openTask(page,title){
  const {root}=ui(page);
  await root.locator('#desktopNav [data-route=tasks]').click();
  await root.locator('.origin-task-collection .item-name',{hasText:title}).click();
  return root.locator('#sheet .origin-message-link');
}
// Creates a task from the source message through the real messaging screen.
async function createTaskFromMessage(page,{prepare}={}){
  const {root,trigger,dialog}=ui(page);
  await trigger.click();
  await expect(root.getByText('接続済み',{exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'検証グループ',exact:true}).click();
  await expect(dialog.locator('.om-message').last()).toBeVisible();
  // The source is older than the latest page; load it through the screen.
  for(let i=0;i<4&&!(await dialog.locator('.om-message[data-message-id="'+sourceId+'"]').count());i++){
    await dialog.getByRole('button',{name:/以前のメッセージ/}).click();
  }
  const msg=dialog.locator('.om-message[data-message-id="'+sourceId+'"]');
  await msg.getByRole('button',{name:'その他',exact:true}).click();
  await dialog.getByRole('button',{name:'タスクを作成',exact:true}).click();
  const form=root.locator('#editForm[data-kind="tasks"]');
  await expect(form.locator('[name=title]')).toHaveValue('Synthetic task from a message');
  await prepare?.(form);
  await root.locator('#sheet button[form=editForm]').click();
}
const taskIds=page=>page.evaluate(()=>window.__businessTest.base.readSnapshot().tasks.filter(t=>t.title==='Synthetic task from a message').map(t=>t.id));
const linkPath=(type,id)=>'messagingV1/'+room+'/recordLinks/'+type+'/'+id;

test('normal launch: the detail offers an explicit check that connects only on request and opens an old message by id',async({page})=>{
  test.setTimeout(120000);
  await boot(page);await install(page);
  await createTaskFromMessage(page);
  await expect.poll(()=>taskIds(page)).toHaveLength(1);
  const [taskId]=await taskIds(page);
  await expect.poll(()=>page.evaluate(()=>window.__businessTest.linkWrites.length)).toBe(1);
  const write=await page.evaluate(()=>window.__businessTest.linkWrites[0]);
  expect(write.path).toBe(linkPath('task',taskId));
  expect(Object.keys(write.value).sort()).toEqual(['conversationId','createdAt','createdBy','messageId']);
  expect(JSON.stringify(write.value)).not.toContain('Review summary');
  // Normal launch after a reload: messaging is not connected until asked.
  await boot(page,{reload:true});await install(page);
  const {dialog}=ui(page);
  const check=await openTask(page,'Synthetic task from a message');
  await expect(check).toHaveText('元メッセージを確認');
  expect(await page.evaluate(()=>window.__businessTest.connections)).toBe(0);
  await check.click();
  await expect(dialog).toHaveAttribute('open','');
  await expect(dialog.locator('.om-message[data-message-id="'+sourceId+'"]')).toBeFocused();
  // Latest page(s) plus one bounded range read by id; no sequential older pages.
  const history=await page.evaluate(()=>window.__businessTest.history);
  expect(history.filter(h=>h.until===undefined&&h.before)).toHaveLength(0);
  expect(history.filter(h=>h.until==='msg_'+'p_'+'a'.repeat(32)+'_q_'+'b'.repeat(32))).toHaveLength(1);
  expect(await page.evaluate(()=>window.__businessTest.connections)).toBe(1);
});

test('another authorized member can use the shared link; a non-member learns nothing',async({page})=>{
  test.setTimeout(120000);
  await boot(page);await install(page);
  await createTaskFromMessage(page);
  await expect.poll(()=>page.evaluate(()=>window.__businessTest.linkWrites.length)).toBe(1);
  // Same record, another approved member of the source conversation.
  await boot(page,{reload:true});await install(page,{personId:pB});
  const {dialog,root}=ui(page);
  await (await openTask(page,'Synthetic task from a message')).click();
  await expect(dialog.locator('.om-message[data-message-id="'+sourceId+'"]')).toBeFocused();
  // A different approved person who is not a member of the conversation.
  await boot(page,{reload:true});await install(page,{personId:pC,member:false});
  await (await openTask(page,'Synthetic task from a message')).click();
  await expect(root.getByText('確認できる元メッセージはありません。リンクがないか、閲覧できない会話です。')).toBeVisible();
  await expect(dialog).not.toHaveAttribute('open','');
  expect(await page.evaluate(()=>window.__businessTest.history.filter(h=>h.until).length)).toBe(0);
});

test('unapproved, offline and revoked devices are told to connect and never read the link',async({page})=>{
  test.setTimeout(120000);
  await boot(page);await install(page);
  await createTaskFromMessage(page);
  await expect.poll(()=>page.evaluate(()=>window.__businessTest.linkWrites.length)).toBe(1);
  for(const options of [{approved:false},{connected:false}]){
    await boot(page,{reload:true});await install(page,options);
    const {root,dialog}=ui(page);
    await (await openTask(page,'Synthetic task from a message')).click();
    await expect(root.getByText('メッセージに接続できないため確認できません。端末の承認と接続を確認してください。')).toBeVisible({timeout:20000});
    await expect(dialog.getByText(/未承認またはオフライン|接続できません/)).toBeVisible();
    expect(await page.evaluate(()=>window.__businessTest.reads.filter(p=>p.includes('/recordLinks/')))).toEqual([]);
    await dialog.locator('.origin-message-dismiss').click();
  }
  // Revocation after the link was usable.
  await boot(page,{reload:true});await install(page);
  const {root,dialog}=ui(page);
  const check=await openTask(page,'Synthetic task from a message');
  await check.click();
  await expect(dialog.locator('.om-message[data-message-id="'+sourceId+'"]')).toBeFocused();
  await dialog.locator('.origin-message-dismiss').click();
  await page.evaluate(()=>window.__businessTest.revoke());
  const reads=await page.evaluate(()=>window.__businessTest.reads.filter(p=>p.includes('/recordLinks/')).length);
  await check.click();
  await expect(root.getByText('メッセージに接続できないため確認できません',{exact:false})).toBeVisible({timeout:20000});
  expect(await page.evaluate(()=>window.__businessTest.reads.filter(p=>p.includes('/recordLinks/')).length)).toBe(reads);
  // Leaving the conversation or deleting the source hides it; the task stays.
  await boot(page,{reload:true});await install(page,{member:false});
  await (await openTask(page,'Synthetic task from a message')).click();
  await expect(root.getByText('確認できる元メッセージはありません',{exact:false})).toBeVisible();
  await boot(page,{reload:true});await install(page);
  await page.evaluate(()=>window.__businessTest.deleteSource());
  await (await openTask(page,'Synthetic task from a message')).click();
  await expect(root.getByText('確認できる元メッセージはありません',{exact:false})).toBeVisible();
  expect(await taskIds(page)).toHaveLength(1);
});

test('a failed link write is kept per person, survives reload, and is saved once on the explicit check',async({page})=>{
  test.setTimeout(120000);
  await boot(page);await install(page);
  await page.evaluate(()=>window.__businessTest.failLinks(true));
  await createTaskFromMessage(page);
  const {root,dialog}=ui(page);
  await expect(root.getByText('元メッセージへのリンクは未保存です',{exact:false})).toBeVisible();
  await expect.poll(()=>taskIds(page)).toHaveLength(1);
  expect(await page.evaluate(()=>window.__businessTest.linkWrites.length)).toBe(0);
  const stored=await page.evaluate(p=>localStorage.getItem('wb-messaging-pending-links-v1|origin-messaging-display-test|'+p),pA);
  expect(stored).toContain('task/');expect(stored).not.toContain('Review summary');
  // Reload: the intent is still there and is written exactly once.
  await boot(page,{reload:true});await install(page);
  await (await openTask(page,'Synthetic task from a message')).click();
  await expect(dialog.locator('.om-message[data-message-id="'+sourceId+'"]')).toBeFocused();
  expect(await page.evaluate(()=>window.__businessTest.linkWrites.length)).toBe(1);
  expect(await page.evaluate(p=>localStorage.getItem('wb-messaging-pending-links-v1|origin-messaging-display-test|'+p),pA)).toBeNull();
  // Another person on this browser does not see or replay this person's intents.
  expect(await page.evaluate(p=>Object.keys(localStorage).filter(k=>k.includes(p)),pB)).toEqual([]);
  expect(await taskIds(page)).toHaveLength(1);
});

test('a start-date save failure after the task body keeps the link without duplicating the task',async({page})=>{
  test.setTimeout(120000);
  await boot(page);await install(page);
  await page.evaluate(()=>{const starts=window.WorkBoardOriginStartBridge;let failed=false;window.WorkBoardOriginStartBridge={...starts,async save(value){if(!failed){failed=true;return {ok:false,error:'network'};}return starts.save(value);}};});
  await createTaskFromMessage(page,{prepare:async form=>{await form.locator('[name=startDate]').fill('2026-12-01');}});
  const {root}=ui(page);
  await expect(root.getByText('開始日を保存できませんでした',{exact:false})).toBeVisible();
  await expect.poll(()=>taskIds(page)).toHaveLength(1);
  await expect.poll(()=>page.evaluate(()=>window.__businessTest.linkWrites.length)).toBe(1);
  // Retrying the start date updates the same task; no second task or link.
  await root.locator('#sheet button[form=editForm]').click();
  await expect.poll(()=>page.evaluate(()=>{const id=window.__businessTest.base.readSnapshot().tasks.find(t=>t.title==='Synthetic task from a message')?.id;return window.WorkBoardOriginStartBridge.readSnapshot()?.[id]?.date||'';})).toBe('2026-12-01');
  expect(await taskIds(page)).toHaveLength(1);
  expect(await page.evaluate(()=>window.__businessTest.linkWrites.length)).toBe(1);
  const [taskId]=await taskIds(page);
  expect(await page.evaluate(()=>window.__businessTest.linkWrites[0].path)).toBe(linkPath('task',taskId));
});

test('multi-day schedules created from a message each get a link to the source',async({page})=>{
  test.setTimeout(120000);
  await boot(page);await install(page);
  const {root,trigger,dialog}=ui(page);
  await trigger.click();
  await dialog.getByRole('button',{name:'検証グループ',exact:true}).click();
  for(let i=0;i<4&&!(await dialog.locator('.om-message[data-message-id="'+sourceId+'"]').count());i++)await dialog.getByRole('button',{name:/以前のメッセージ/}).click();
  await dialog.locator('.om-message[data-message-id="'+sourceId+'"]').getByRole('button',{name:'その他',exact:true}).click();
  await dialog.getByRole('button',{name:'予定を作成',exact:true}).click();
  const form=root.locator('#editForm[data-kind="events"]');
  await expect(form.locator('[name=title]')).toHaveValue('Synthetic task from a message');
  await form.locator('.origin-batch-options summary').click();
  await form.locator('[name=batchEnabled]').check();
  await form.locator('[name=batchCount]').fill('3');
  await form.getByRole('button',{name:'作成日を確認'}).click();
  await expect(form.locator('#originBatchReview')).toContainText('3件の作成日');
  await root.locator('#sheet button[form=editForm]').click();
  await expect.poll(()=>page.evaluate(()=>window.__businessTest.base.readSnapshot().schedules.filter(s=>s.title==='Synthetic task from a message').length)).toBe(3);
  await expect.poll(()=>page.evaluate(()=>window.__businessTest.linkWrites.length)).toBe(3);
  const ids=await page.evaluate(()=>window.__businessTest.base.readSnapshot().schedules.filter(s=>s.title==='Synthetic task from a message').map(s=>s.id).sort());
  const paths=await page.evaluate(()=>window.__businessTest.linkWrites.map(w=>w.path).sort());
  expect(paths).toEqual(ids.map(id=>linkPath('schedule',id)).sort());
});
