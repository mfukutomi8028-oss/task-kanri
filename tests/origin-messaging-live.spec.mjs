import {test, expect} from '@playwright/test';

test('cloud composition clears the authorized directory on disconnect and disposes subscriptions',async({page})=>{
  await page.setViewportSize({width:1366,height:900});
  await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort('blockedbyclient'));
  await page.goto('/test-harness/messaging-preview/index.html');
  await expect(page.getByRole('heading',{name:'メッセージ',exact:true})).toBeVisible();
  await page.evaluate(async()=>{
    const {mountCloudOriginMessaging}=await import('/origin-messaging-live.js');
    const root=document.createElement('div');root.id='liveCloud';document.body.append(root);
    const roomId='live-room',personId='p_'+'1'.repeat(32),uid='synthetic-uid';
    const binding={uid,roomId,personId,displayName:'Synthetic',approved:true,active:true};
    const boardSnapshot={roomId,currentUser:'Synthetic',connectionMode:'remote-online',tasks:[],schedules:[]};
    const subscriptions=new Set(),calls=[];
    let online=true;
    const bindingKey='messagingAccessV1/'+roomId+'/'+uid;
    const value=path=>path==='.info/connected'?online:path===bindingKey?binding:null;
    const snapshot=path=>({val:()=>value(path)});
    const sdk={db:{},ref:(_,path)=>path,get:async path=>snapshot(path),
      onValue(path,fn){const row={path,fn};subscriptions.add(row);queueMicrotask(()=>{if(subscriptions.has(row))fn(snapshot(path));});return ()=>subscriptions.delete(row);},
      async set(){throw Error('Unexpected write');},async update(){throw Error('Unexpected write');},
      async runTransaction(){throw Error('Unexpected write');},serverTimestamp:()=>({'.sv':'timestamp'})};
    const auth={getUid:()=>uid,getToken:async()=> 'synthetic-token',observeAuth(fn){queueMicrotask(fn);return ()=>{};}};
    const board={readSnapshot:()=>boardSnapshot,readMemos:()=>[],canReadRecord:async()=>false,openRecord:()=>false,restoreConversation:()=>false,subscribe(fn){fn(boardSnapshot);return ()=>{};}};
    const fetchImpl=async(url,options)=>{
      if(url!=='https://example.invalid/messaging'||options.headers.Authorization!=='Bearer synthetic-token')throw Error('Unexpected authorization');
      const {action,payload,expectedPersonId}=JSON.parse(options.body);
      if(payload.roomId!==roomId||expectedPersonId!==personId)throw Error('Unexpected scope');
      calls.push(action);
      const scope={status:'ok',roomId,personId};
      if(action==='people')return Response.json({...scope,people:[{personId,displayName:'Synthetic'}]});
      if(action==='directory')return Response.json({...scope,conversations:[{id:'self_'+personId,kind:'self',status:'active',role:'member',memberCount:1,joinedAt:1000,revision:1,controlUpdatedAt:1000}],invites:[],hasMore:false,nextCursor:null});
      throw Error('Unexpected request '+action);
    };
    const handle=mountCloudOriginMessaging({root,endpoint:'https://example.invalid/messaging',sdk,auth,board,fetchImpl});
    window.__liveCloudTest={handle,calls,disconnect(){online=false;for(const row of [...subscriptions])if(row.path==='.info/connected')row.fn(snapshot(row.path));},subscriptionCount:()=>subscriptions.size};
  });
  const root=page.locator('#liveCloud');
  await expect(root.getByText('自分宛てメッセージ',{exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__liveCloudTest.handle.getSnapshot().status)).toBe('bound');
  expect(await page.evaluate(()=>window.__liveCloudTest.calls.includes('directory'))).toBe(true);
  await page.evaluate(()=>window.__liveCloudTest.disconnect());
  await expect.poll(()=>page.evaluate(()=>window.__liveCloudTest.handle.getSnapshot().status)).toBe('locked');
  await expect(root.getByText('自分宛てメッセージ',{exact:true})).toHaveCount(0);
  await page.evaluate(()=>window.__liveCloudTest.handle.dispose());
  expect(await page.evaluate(()=>window.__liveCloudTest.subscriptionCount())).toBe(0);
});
