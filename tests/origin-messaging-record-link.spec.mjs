import {test,expect} from '@playwright/test';
test('a task created from an older message keeps a permanent, authorized link back to it', async ({page}) => {
  test.setTimeout(90000);
  await page.setViewportSize({width:1366,height:900});
  await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4173'
    ? route.continue() : route.abort('blockedbyclient'));
  const errors=[];
  page.on('pageerror',error=>{if(error.message.includes('originMessagingEntry'))errors.push(error.message);});
  await page.addInitScript(()=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null;},set(){}});
    Object.defineProperty(window,'WORK_BOARD_MESSAGING',{configurable:true,get(){return Object.freeze({enabled:true,endpoint:'https://abcdefghijklmnopqrst.supabase.co/functions/v1/workboard-messaging',attachmentsEnabled:true});},set(){}});
    localStorage.setItem('system-task-users:origin-messaging-display-test',JSON.stringify(['Synthetic Startup']));
    localStorage.setItem('systemTaskUser','Synthetic Startup');
    localStorage.setItem('systemTaskRoomId','origin-messaging-display-test');
  });
  await page.goto('/?room=origin-messaging-display-test',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});

  await page.evaluate(()=>{
    const base=window.WorkBoardPaletteBridge, roomId=base.readSnapshot().roomId, personId='p_'+'a'.repeat(32), uid='synthetic-startup';
    const name=base.readSnapshot().currentUser;
    const map=s=>({...s,connectionMode:'remote-online'});
    const conversationId='self_'+personId;
    const message={id:'msg_'+personId+'_q_'+'b'.repeat(32),senderId:personId,createdAt:2000,revision:1,body:'Synthetic task from a message\nReview summary',refs:[],attachmentIds:[],confirmationRequested:false,replyTo:null};
    const newers=Array.from({length:50},(_,i)=>({...message,id:'msg_'+personId+'_q_'+i.toString(16).padStart(32,'c'),createdAt:3000+i,body:'Newer synthetic note '+i}));
    const links=new Map();let paged=false,failLinks=false;
    window.__startupConnections=0;
    let connected=true,enabled=true,approved=true,holdSave=false,finishSave;
    const watchers=new Map();
    const update=(path,value)=>{for(const fn of watchers.get(path)??[])fn({val:()=>value});};
    const binding=()=>({uid,roomId,personId,displayName:name,approved,active:true});
    window.__businessTest={conversationId,base,requests:[],
      setConnected(value){connected=value;update('.info/connected',value);},
      setEnabled(value){enabled=value;update('messagingControlV1/enabled',value);},
      revoke(){approved=false;update('messagingAccessV1/'+roomId+'/'+uid,binding());},
      holdSave(){holdSave=true;},
      saving:()=>typeof finishSave==='function',
      failSave(){finishSave?.({ok:false,error:'network'});},
      linkWrites:[],links,page(v){paged=v;},deleteSource(){message.deletedAt=4000;},failLinks(v){failLinks=v;}
    };
    window.WorkBoardPaletteBridge={...base,readSnapshot:()=>map(base.readSnapshot()),subscribe:fn=>base.subscribe(s=>fn(map(s))),
      dispatch(command){
        if(holdSave&&command.type==='task.create'){holdSave=false;return new Promise(resolve=>{finishSave=resolve;});}
        return base.dispatch(command);
      },
      async getMessagingConnection(){
        window.__startupConnections++;
        const getSnapshot=path=>({val:()=>path==='.info/connected'?connected:path==='messagingControlV1/enabled'?enabled:path==='messagingAccessV1/'+roomId+'/'+uid?binding():path.endsWith('/members/'+personId)?{active:true,joinedAt:1000,role:'member'}:path.includes('/recordLinks/')?links.get(path)??null:path.endsWith('/'+message.id)?message:null});
        const sdk={db:{},ref:(_,path)=>path,get:async path=>getSnapshot(path),onValue(path,fn){const set=watchers.get(path)??new Set();watchers.set(path,set);set.add(fn);queueMicrotask(()=>{if(set.has(fn))fn(getSnapshot(path));});return ()=>set.delete(fn);},set(path,value){if(!path.includes('/recordLinks/'))throw Error('Unexpected write');if(failLinks)return Promise.reject(Object.assign(Error('offline'),{code:'unavailable'}));window.__businessTest.linkWrites.push({path,value});links.set(path,{...value,createdAt:5000});return Promise.resolve();},update(){throw Error('Unexpected write');},runTransaction(_path,update){return Promise.resolve({committed:true,snapshot:{val:()=>update(null)}});},serverTimestamp:()=>({})};
        const user={uid,getIdToken:async()=> 'synthetic-id-token'};
        return {app:{},sdk,authSdk:{getAuth:()=>({currentUser:user,authStateReady:async()=>{}}),signInAnonymously(){throw Error('Unexpected sign-in');},onAuthStateChanged(_auth,fn){queueMicrotask(fn);return ()=>{};}}};
      }};
    const realFetch=window.fetch;
    let sentMessage=null;
    window.fetch=(url,options)=>{
      if(url==='https://abcdefghijklmnopqrst.supabase.co/functions/v1/workboard-messaging'){
        const {action}=JSON.parse(options.body);
        const scope={status:'ok',roomId,personId};
        if(action==='people')return Promise.resolve(Response.json({...scope,people:[{personId,displayName:name}]}));
        if(action==='directory')return Promise.resolve(Response.json({...scope,conversations:[{id:conversationId,kind:'self',status:'active',role:'member',memberCount:1,joinedAt:1000,revision:1,controlUpdatedAt:1000}],invites:[],hasMore:false,nextCursor:null}));
        if(action==='unread')return Promise.resolve(Response.json({...scope,conversationId,joinedAt:1000,unread:0,complete:true,muted:false,latestIncoming:null}));
        if(action==='history'){const {payload}=JSON.parse(options.body);if(paged&&!payload.before)return Promise.resolve(Response.json({status:'ok',joinedAt:1000,messages:newers,nextCursor:{id:newers[0].id,createdAt:newers[0].createdAt},hasMore:true}));return Promise.resolve(Response.json({status:'ok',joinedAt:1000,messages:paged?[message]:[message,...newers.slice(0,5)],nextCursor:null,hasMore:false}));}
        if(action==='message'){
          const {payload}=JSON.parse(options.body);
          window.__businessTest.requests.push(payload.command);
          sentMessage={...message,...payload.command.input,id:'msg_'+personId+'_'+payload.command.requestId,createdAt:2001};
          return Promise.resolve(Response.json({status:'sent',id:sentMessage.id}));
        }
        throw Error('Unexpected synthetic action');

      }
      return realFetch.call(window,url,options);
    };
  });
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  const root=page.locator('#modernOriginRoot'),trigger=root.locator('.origin-message-trigger'),dialog=root.locator('dialog.origin-message-host');
  await trigger.click();
  await expect(root.getByText('接続済み',{exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'自分宛てメッセージ',exact:true}).click();
  const msg=dialog.locator('.om-message',{hasText:'Review summary'});
  await msg.getByRole('button',{name:'その他',exact:true}).click();
  await dialog.getByRole('button',{name:'タスクを作成',exact:true}).click();
  const form=root.locator('#editForm[data-kind="tasks"]');
  await expect(form.locator('[name=title]')).toHaveValue('Synthetic task from a message');
  // First save: the link write fails, the task must still be saved.
  await page.evaluate(()=>window.__businessTest.failLinks(true));
  await root.locator('#sheet button[form=editForm]').click();
  await expect.poll(()=>page.evaluate(()=>window.__businessTest.base.readSnapshot().tasks.filter(t=>t.title==='Synthetic task from a message').length)).toBe(1);
  await expect(root.getByText('元メッセージへのリンクは接続回復後に再保存します',{exact:false})).toBeVisible();
  expect(await page.evaluate(()=>window.__businessTest.linkWrites.length)).toBe(0);
  // Reconnection retries once, without duplicating the record or the link.
  await page.evaluate(()=>{window.__businessTest.failLinks(false);window.__businessTest.setConnected(false);window.__businessTest.setConnected(true);});
  await expect.poll(()=>page.evaluate(()=>window.__businessTest.linkWrites.length)).toBe(1);
  const write=await page.evaluate(()=>window.__businessTest.linkWrites[0]);
  const taskId=await page.evaluate(()=>window.__businessTest.base.readSnapshot().tasks.find(t=>t.title==='Synthetic task from a message').id);
  expect(write.path).toBe('messagingV1/origin-messaging-display-test/recordLinks/p_'+'a'.repeat(32)+'/task/'+taskId);
  expect(Object.keys(write.value).sort()).toEqual(['conversationId','createdAt','messageId']);
  expect(JSON.stringify(write.value)).not.toContain('Review summary');
  expect(await page.evaluate(()=>window.__businessTest.base.readSnapshot().tasks.filter(t=>t.title==='Synthetic task from a message').length)).toBe(1);
  // The source message is now only in an older page; opening the link must load it and focus it.
  await dialog.locator('.origin-message-dismiss').click();
  await page.evaluate(()=>window.__businessTest.page(true));
  await root.locator('#desktopNav [data-route=tasks]').click();
  await root.locator('.origin-task-collection .item-name',{hasText:'Synthetic task from a message'}).click();
  const open=root.locator('#sheet .origin-message-link');
  await expect(open).toBeVisible();
  await open.click();
  await expect(dialog).toHaveAttribute('open','');
  await expect(dialog.locator('.om-message[data-message-id="msg_p_'+'a'.repeat(32)+'_q_'+'b'.repeat(32)+'"]')).toBeFocused();
  // A deleted source message is never reported as success, and the task stays usable.
  await dialog.locator('.origin-message-dismiss').click();
  await page.evaluate(()=>window.__businessTest.deleteSource());
  await root.locator('#sheet .origin-message-link').click();
  await expect(root.getByText('元メッセージを表示できません',{exact:false})).toBeVisible();
  expect(await page.evaluate(()=>window.__businessTest.base.readSnapshot().tasks.some(t=>t.title==='Synthetic task from a message'))).toBe(true);
  expect(errors).toEqual([]);
});
