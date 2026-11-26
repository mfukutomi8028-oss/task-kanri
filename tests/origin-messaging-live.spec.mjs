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
    const peerId='p_'+'2'.repeat(32),selfId='self_'+personId,directId='dm_'+personId+'_'+peerId;
    const binding={uid,roomId,personId,displayName:'Synthetic',approved:true,active:true};
    const boardSnapshot={roomId,currentUser:'Synthetic',connectionMode:'remote-online',tasks:[],schedules:[]};
    const subscriptions=new Set(),calls=[],summaries=[],notices=[];
    let online=true,unread=2,marker='00000000-0000-4000-8000-000000000001';const unreadCalls=[];
    const bindingKey='messagingAccessV1/'+roomId+'/'+uid;
    const value=path=>path==='.info/connected'?online:path===bindingKey?binding:
      [selfId,directId].some(id=>path==='messagingV1/'+roomId+'/control/'+id+'/members/'+personId)?{active:true,joinedAt:1000,role:'member'}:
      path==='messagingV1/'+roomId+'/activity/'+directId?marker:null;
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
      if(action==='people')return Response.json({...scope,people:[{personId,displayName:'Synthetic'},{personId:peerId,displayName:'Peer'}]});
      if(action==='directory')return Response.json({...scope,conversations:[{id:selfId,kind:'self',status:'active',role:'member',memberCount:1,joinedAt:1000,revision:1,controlUpdatedAt:1000},{id:directId,kind:'direct',peerId,status:'active',role:'member',memberCount:2,joinedAt:1000,revision:1,controlUpdatedAt:1000}],invites:[],hasMore:false,nextCursor:null});
      if(action==='unread'){
        const conversationId=payload.conversationId;if(![selfId,directId].includes(conversationId))throw Error('Unexpected conversation');
        unreadCalls.push(conversationId);
        return Response.json({...scope,conversationId,joinedAt:1000,unread:conversationId===selfId?0:unread,complete:true,muted:false,latestIncoming:conversationId===selfId?null:{id:'msg_'+peerId+'_q_'+String(unread).padStart(32,'0'),createdAt:2000+unread}});
      }
      throw Error('Unexpected request '+action);
    };
    const handle=mountCloudOriginMessaging({root,endpoint:'https://example.invalid/messaging',sdk,auth,board,fetchImpl,keepNotificationSession:true,onSummary:s=>summaries.push(s),onNotification:kind=>notices.push(kind)});
    window.__liveCloudTest={handle,calls,unreadCalls,selfId,directId,summaries,notices,incoming(){unread++;marker='00000000-0000-4000-8000-'+String(unread).padStart(12,'0');for(const row of [...subscriptions])if(row.path==='messagingV1/'+roomId+'/activity/'+directId)row.fn(snapshot(row.path));},disconnect(){online=false;for(const row of [...subscriptions])if(row.path==='.info/connected')row.fn(snapshot(row.path));},subscriptionCount:()=>subscriptions.size};
  });
  const root=page.locator('#liveCloud');
  await expect(root.getByText('自分宛てメッセージ',{exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__liveCloudTest.handle.getSnapshot().status)).toBe('bound');
  expect(await page.evaluate(()=>window.__liveCloudTest.calls.includes('directory'))).toBe(true);
  await expect(root.getByLabel('メッセージの未読件数')).toHaveText('未読 2件');
  const before=await page.evaluate(()=>({directory:window.__liveCloudTest.calls.filter(a=>a==='directory').length,people:window.__liveCloudTest.calls.filter(a=>a==='people').length,unread:window.__liveCloudTest.unreadCalls.length}));
  await page.evaluate(()=>window.__liveCloudTest.incoming());
  await expect(root.getByLabel('メッセージの未読件数')).toHaveText('未読 3件');
  const after=await page.evaluate(()=>({directory:window.__liveCloudTest.calls.filter(a=>a==='directory').length,people:window.__liveCloudTest.calls.filter(a=>a==='people').length,unread:window.__liveCloudTest.unreadCalls.length,last:window.__liveCloudTest.unreadCalls.at(-1),directId:window.__liveCloudTest.directId}));
  expect(after.directory).toBe(before.directory);expect(after.people).toBe(before.people);expect(after.unread).toBe(before.unread+1);expect(after.last).toBe(after.directId);
  const watched=await page.evaluate(()=>window.__liveCloudTest.subscriptionCount());
  expect(await page.evaluate(()=>window.__liveCloudTest.handle.hideWorkspace())).toBe(true);
  await expect(root.getByRole('heading',{name:'メッセージ',exact:true})).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>window.__liveCloudTest.summaries.at(-1)?.unread)).toBe(3);
  expect(await page.evaluate(()=>window.__liveCloudTest.subscriptionCount())).toBe(watched);
  await page.evaluate(()=>window.__liveCloudTest.incoming());
  await expect.poll(()=>page.evaluate(()=>window.__liveCloudTest.summaries.at(-1)?.unread)).toBe(4);
  expect(await page.evaluate(()=>window.__liveCloudTest.notices)).toEqual(['message']);
  expect(await page.evaluate(()=>window.__liveCloudTest.calls.every(action=>['directory','people','unread'].includes(action)))).toBe(true);
  expect(await page.evaluate(()=>window.__liveCloudTest.handle.showWorkspace())).toBe(true);
  await expect(root.getByLabel('メッセージの未読件数')).toHaveText('未読 4件');
  expect(await page.evaluate(()=>window.__liveCloudTest.notices)).toEqual(['message']);
  expect(await page.evaluate(()=>window.__liveCloudTest.subscriptionCount())).toBe(watched);
  expect(await page.evaluate(()=>window.__liveCloudTest.handle.hideWorkspace())).toBe(true);
  await page.evaluate(()=>window.__liveCloudTest.disconnect());
  await expect.poll(()=>page.evaluate(()=>window.__liveCloudTest.handle.getSnapshot().status)).toBe('locked');
  await expect(root.getByText('自分宛てメッセージ',{exact:true})).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>window.__liveCloudTest.summaries.at(-1))).toBeNull();
  await page.evaluate(()=>window.__liveCloudTest.handle.dispose());
  expect(await page.evaluate(()=>window.__liveCloudTest.subscriptionCount())).toBe(0);
});
