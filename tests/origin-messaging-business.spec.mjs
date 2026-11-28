import {test,expect} from '@playwright/test';
test('Origin creates a canonical task and shares its reference from the detail', async ({page}) => {
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
      failSave(){finishSave?.({ok:false,error:'network'});}
    };
    window.WorkBoardPaletteBridge={...base,readSnapshot:()=>map(base.readSnapshot()),subscribe:fn=>base.subscribe(s=>fn(map(s))),
      dispatch(command){
        if(holdSave&&command.type==='task.create'){holdSave=false;return new Promise(resolve=>{finishSave=resolve;});}
        return base.dispatch(command);
      },
      async getMessagingConnection(){
        window.__startupConnections++;
        const getSnapshot=path=>({val:()=>path==='.info/connected'?connected:path==='messagingControlV1/enabled'?enabled:path==='messagingAccessV1/'+roomId+'/'+uid?binding():path.endsWith('/members/'+personId)?{active:true,joinedAt:1000,role:'member'}:path.endsWith('/'+message.id)?message:null});
        const sdk={db:{},ref:(_,path)=>path,get:async path=>getSnapshot(path),onValue(path,fn){const set=watchers.get(path)??new Set();watchers.set(path,set);set.add(fn);queueMicrotask(()=>{if(set.has(fn))fn(getSnapshot(path));});return ()=>set.delete(fn);},set(){throw Error('Unexpected write');},update(){throw Error('Unexpected write');},runTransaction(_path,update){return Promise.resolve({committed:true,snapshot:{val:()=>update(null)}});},serverTimestamp:()=>({})};
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
        if(action==='history')return Promise.resolve(Response.json({status:'ok',joinedAt:1000,messages:sentMessage?[message,sentMessage]:[message],nextCursor:null,hasMore:false}));
        // The server issues a fresh record id for a create from this message.
        if(action==='recordReserve'){
          const {payload}=JSON.parse(options.body);
          const chars='-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
          const ids=Array.from({length:payload.count},()=>'-'+Array.from(crypto.getRandomValues(new Uint8Array(19)),b=>chars[b%64]).join(''));
          return Promise.resolve(Response.json({status:'ok',requestId:payload.requestId,recordType:payload.recordType,ids}));
        }
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
  await expect(trigger).toBeVisible();
  expect(await page.evaluate(()=>window.__startupConnections)).toBe(0);
  await trigger.click();
  await expect(dialog).toHaveAttribute('open','');
  await expect(root.getByText('接続済み',{exact:true})).toBeVisible();

  await dialog.getByRole('button',{name:'自分宛てメッセージ',exact:true}).click();
  const msg=dialog.locator('.om-message', {hasText:'Review summary'});
  await msg.getByRole('button',{name:'その他',exact:true}).click();
  await dialog.getByRole('button',{name:'予定を作成',exact:true}).click();
  const schedule=root.locator('#editForm[data-kind="events"]');
  await expect(schedule.locator('[name=title]')).toHaveValue('Synthetic task from a message');
  await expect(schedule.locator('[name=memo]')).toHaveValue(/Review summary/);
  await page.evaluate(()=>window.__businessTest.setConnected(false));
  await root.locator('#sheet').getByRole('button',{name:'キャンセル',exact:true}).click();
  await expect(dialog).toBeVisible();
  await expect(msg).toHaveCount(0);
  await page.evaluate(()=>window.__businessTest.setConnected(true));
  await expect(msg).toBeVisible();
  expect(await page.evaluate(()=>window.__businessTest.base.readSnapshot().schedules.some(t=>t.title==='Synthetic task from a message'))).toBe(false);
  await msg.getByRole('button',{name:'その他',exact:true}).click();
  await dialog.getByRole('button',{name:'タスクを作成',exact:true}).click({timeout:2500});
  const form=root.locator('#editForm[data-kind="tasks"]');
  await expect(form.locator('[name=title]')).toHaveValue('Synthetic task from a message');
  await expect(form.locator('[name=desc]')).toHaveValue(/Review summary/);
  await form.locator('[name=desc]').fill('Synthetic unsaved business edit');
  for(const method of ['setConnected','setEnabled']){
    await page.evaluate(method=>window.__businessTest[method](false),method);
    await expect(dialog.locator('.origin-message-host-notice')).not.toHaveText('接続済み',{timeout:3000});
    await expect(form.locator('[name=desc]')).toHaveValue('Synthetic unsaved business edit',{timeout:3000});
    await page.evaluate(method=>window.__businessTest[method](true),method);
    await expect(dialog.locator('.origin-message-host-notice')).toHaveText('接続済み',{timeout:3000});
  }
  expect(await page.evaluate(()=>window.__businessTest.base.readSnapshot().tasks.some(t=>t.title==='Synthetic task from a message'))).toBe(false);
  await root.locator('#sheet button[form=editForm]').click();
  await expect(dialog).toBeVisible();
  await expect(msg).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__businessTest.base.readSnapshot().tasks.some(t=>t.title==='Synthetic task from a message'))).toBe(true);
  await dialog.locator('.origin-message-dismiss').click();
  await root.locator('#desktopNav [data-route=tasks]').click();
  await root.locator('.origin-task-collection .item-name',{hasText:'Synthetic task from a message'}).click();
  const sheet=root.locator('#sheet');
  await sheet.getByText('その他の操作',{exact:true}).click();
  await sheet.getByRole('button',{name:'メッセージに共有',exact:true}).click();
  await dialog.getByRole('dialog',{name:'共有先の会話'}).getByRole('button',{name:'自分宛てメッセージ',exact:true}).click();
  await expect(dialog.locator('.om-compose-context')).toContainText('Synthetic task from a message');
  expect(await page.evaluate(()=>window.__businessTest.requests.length)).toBe(0);
  await dialog.getByRole('button',{name:'送信',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__businessTest.requests.length)).toBe(1);
  expect(await page.evaluate(()=>{
    const t=window.__businessTest.base.readSnapshot().tasks.find(t=>t.title==='Synthetic task from a message');
    return window.__businessTest.requests[0].input.refs[0].recordId===t.id;
  })).toBe(true);
  await dialog.locator('.origin-message-dismiss').click();
  await sheet.locator('.sheet-close').click({timeout:5000});
  await trigger.click();
  await dialog.getByRole('button',{name:'自分宛てメッセージ',exact:true}).click();
  await dialog.getByRole('button',{name:'共有データ',exact:true}).click();
  await dialog.locator('#om-shared-filter').selectOption('task');
  await dialog.locator('.om-shared-list').getByRole('button',{name:'Synthetic task from a message',exact:true}).click({timeout:5000});
  await expect(dialog.locator('.om-message.om-highlight')).toBeFocused();
  await expect(dialog).toHaveAttribute('open','');
  await page.evaluate(()=>window.WorkBoardDisplayController.selectMode('journal'));
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','journal');
  await expect(dialog).not.toHaveAttribute('open','');
  await page.evaluate(()=>window.WorkBoardDisplayController.selectMode('classic'));
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
  await page.evaluate(()=>window.WorkBoardDisplayController.selectMode('modern'));
  await expect(trigger).toBeVisible();
  await expect(dialog).not.toHaveAttribute('open','');
  await trigger.click();
  await dialog.getByRole('button',{name:'自分宛てメッセージ',exact:true}).click();
  await msg.getByRole('button',{name:'その他',exact:true}).click();
  await dialog.getByRole('button',{name:'タスクを作成',exact:true}).click();
  await form.locator('[name=title]').fill('Synthetic form revoked while saving');
  await page.evaluate(()=>window.__businessTest.holdSave());
  await root.locator('#sheet button[form=editForm]').click();
  await expect.poll(()=>page.evaluate(()=>window.__businessTest.saving())).toBe(true);
  await page.evaluate(()=>window.__businessTest.revoke());
  await expect(form).toBeHidden({timeout:3000});
  await page.evaluate(()=>window.__businessTest.failSave());
  await expect(form).toHaveCount(0);
  expect(errors).toEqual([]);

});
