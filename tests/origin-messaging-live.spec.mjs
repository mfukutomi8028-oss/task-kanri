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
    const peerId='p_'+'2'.repeat(32),selfId='self_'+personId,directId='dm_'+personId+'_'+peerId,groupId='group_g_'+'a'.repeat(32);
    const imageId='00000000-0000-4000-8000-000000000001';
    const imageBytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0foAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
    const group={id:groupId,roomId,status:'active',kind:'group',title:'Synthetic group',revision:1,members:{[personId]:{active:true,joinedAt:1000,role:'owner'},[peerId]:{active:true,joinedAt:1000,role:'member'}}};
    const binding={uid,roomId,personId,displayName:'Synthetic',approved:true,active:true};
    const boardSnapshot={roomId,currentUser:'Synthetic',connectionMode:'remote-online',tasks:[],schedules:[]};
    const subscriptions=new Set(),calls=[],summaries=[],notices=[],sentRequests=[],sentRecords=new Map();
    let online=true,serviceEnabled=true,seedHistory=false,unread=2,marker='00000000-0000-4000-8000-000000000001';const unreadCalls=[];
    const bindingKey='messagingAccessV1/'+roomId+'/'+uid;
    let groupVisible=false;
    const value=path=>path==='.info/connected'?online:path==='messagingControlV1/enabled'?serviceEnabled:path===bindingKey?binding:path==='messagingV1/'+roomId+'/control/'+groupId?group:
      [selfId,directId,groupId].some(id=>path==='messagingV1/'+roomId+'/control/'+id+'/members/'+personId)?{active:true,joinedAt:1000,role:'member'}:
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
      if(action==='directory')return Response.json({...scope,conversations:[{id:selfId,kind:'self',status:'active',role:'member',memberCount:1,joinedAt:1000,revision:1,controlUpdatedAt:1000},{id:directId,kind:'direct',peerId,status:'active',role:'member',memberCount:2,joinedAt:1000,revision:1,controlUpdatedAt:1000},...(groupVisible?[{id:groupId,kind:'group',status:group.status,role:'owner',memberCount:2,joinedAt:1000,revision:group.revision,controlUpdatedAt:1000,title:group.title,participantIds:[personId,peerId]}]:[])],invites:[],hasMore:false,nextCursor:null});
      if(action==='conversation'){
        const {command}=payload;
        if(payload.conversationId!==groupId||command.expectedRevision!==group.revision)return Response.json({status:'conflict'},{status:409});
        if(command.type==='rename')group.title=command.title;
        else if(command.type==='setArchived')group.status=command.archived?'archived':'active';
        else throw Error('Unexpected command');
        group.revision++;
        return Response.json({status:'ok',conversationId:groupId,revision:group.revision,indexPending:false});
      }
      if(action==='message'){
        const {requestId,input}=payload.command;
        const id='msg_'+personId+'_'+requestId;
        sentRequests.push({requestId,input});
        sentRecords.set(id,input);
        return sentRequests.length===1?Response.json({status:'unavailable'},{status:503}):Response.json({status:'sent',id});
      }
      if(action==='attachmentMetadata'){
        return Response.json({status:'ok',items:payload.items.filter(item=>item.attachmentId===imageId).map(item=>({...item,filename:'synthetic.png',mime:'image/png',bytes:imageBytes.length}))});
      }
      if(action==='attachmentDownload'&&payload.attachmentId===imageId){
        return new Response(imageBytes,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(imageBytes.length),'X-Workboard-Filename':'synthetic.png','X-Workboard-Mime':'image/png'}});
      }
      if(action==='history'){
        const make=(index,body)=>({id:'msg_'+personId+'_q_'+index.toString(16).padStart(32,'0'),senderId:personId,createdAt:2000+index,body,refs:[],replyTo:null,revision:1,attachmentIds:index===0?[imageId]:[],confirmationRequested:false});
        const messages=!seedHistory?[]:payload.before?[make(0,'Older searchable text')]:Array.from({length:50},(_,index)=>make(index+1,'Recent note '+index));
        return Response.json({status:'ok',joinedAt:1000,messages,nextCursor:messages.length===50?{id:messages[0].id,createdAt:messages[0].createdAt}:null,hasMore:messages.length===50});
      }
      if(action==='unread'){
        const conversationId=payload.conversationId;if(![selfId,directId,groupId].includes(conversationId))throw Error('Unexpected conversation');
        unreadCalls.push(conversationId);
        return Response.json({...scope,conversationId,joinedAt:1000,unread:conversationId!==directId?0:unread,complete:true,muted:false,latestIncoming:conversationId!==directId?null:{id:'msg_'+peerId+'_q_'+String(unread).padStart(32,'0'),createdAt:2000+unread}});
      }
      throw Error('Unexpected request '+action);
    };
    const handle=mountCloudOriginMessaging({root,endpoint:'https://example.invalid/messaging',sdk,auth,board,fetchImpl,attachmentsEnabled:true,keepNotificationSession:true,onSummary:s=>summaries.push(s),onNotification:kind=>notices.push(kind)});
    window.__liveCloudTest={handle,calls,sentRequests,sentRecords,showGroup(){groupVisible=true;},seedHistory(){seedHistory=true;},setService(value){serviceEnabled=value;for(const row of [...subscriptions])if(row.path==='messagingControlV1/enabled')row.fn(snapshot(row.path));},unreadCalls,selfId,directId,summaries,notices,incoming(){unread++;marker='00000000-0000-4000-8000-'+String(unread).padStart(12,'0');for(const row of [...subscriptions])if(row.path==='messagingV1/'+roomId+'/activity/'+directId)row.fn(snapshot(row.path));},disconnect(){online=false;for(const row of [...subscriptions])if(row.path==='.info/connected')row.fn(snapshot(row.path));},subscriptionCount:()=>subscriptions.size};
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
  await root.getByRole('button',{name:'自分宛てメッセージ',exact:true}).click();
  const draft=root.locator('#om-body');
  await draft.fill('Synthetic unsent draft');
  expect(await page.evaluate(()=>window.__liveCloudTest.handle.hideWorkspace())).toBe(true);
  expect(await page.evaluate(()=>window.__liveCloudTest.handle.showWorkspace())).toBe(true);
  await root.getByRole('button',{name:'自分宛てメッセージ',exact:true}).click();
  await expect(draft).toHaveValue('Synthetic unsent draft',{timeout:2500});
  expect(await page.evaluate(()=>window.__liveCloudTest.sentRequests.length)).toBe(0);
  await root.getByRole('button',{name:'送信',exact:true}).click();
  await expect(root.getByText('送信結果を確認できません。入力内容を保持しています。')).toBeVisible();
  await page.evaluate(()=>{window.__liveCloudTest.handle.hideWorkspace();window.__liveCloudTest.handle.showWorkspace();});
  await root.getByRole('button',{name:'自分宛てメッセージ',exact:true}).click();
  await expect(draft).toHaveValue('Synthetic unsent draft');
  await draft.fill('Synthetic newer draft');
  await root.getByRole('button',{name:'前回の送信を確認・再試行'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__liveCloudTest.sentRequests.length)).toBe(2);
  expect(await page.evaluate(()=>{
    const {sentRequests,sentRecords}=window.__liveCloudTest;
    return {samePayload:JSON.stringify(sentRequests[0])===JSON.stringify(sentRequests[1]),records:sentRecords.size};
  })).toEqual({samePayload:true,records:1});
  await expect(draft).toHaveValue('Synthetic newer draft');
  await page.evaluate(()=>{window.__liveCloudTest.handle.hideWorkspace();window.__liveCloudTest.handle.showWorkspace();});
  const watched=await page.evaluate(()=>window.__liveCloudTest.subscriptionCount());
  expect(await page.evaluate(()=>window.__liveCloudTest.handle.hideWorkspace())).toBe(true);
  await expect(root.getByRole('heading',{name:'メッセージ',exact:true})).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>window.__liveCloudTest.summaries.at(-1)?.unread)).toBe(3);
  expect(await page.evaluate(()=>window.__liveCloudTest.subscriptionCount())).toBe(watched);
  await page.evaluate(()=>window.__liveCloudTest.incoming());
  await expect.poll(()=>page.evaluate(()=>window.__liveCloudTest.summaries.at(-1)?.unread)).toBe(4);
  expect(await page.evaluate(()=>window.__liveCloudTest.notices)).toEqual(['message']);
  expect(await page.evaluate(()=>window.__liveCloudTest.calls.every(action=>['directory','people','unread','history','message'].includes(action)))).toBe(true);
  expect(await page.evaluate(()=>window.__liveCloudTest.handle.showWorkspace())).toBe(true);
  await expect(root.getByLabel('メッセージの未読件数')).toHaveText('未読 4件');
  expect(await page.evaluate(()=>window.__liveCloudTest.notices)).toEqual(['message']);
  expect(await page.evaluate(()=>window.__liveCloudTest.subscriptionCount())).toBe(watched);
  await page.evaluate(()=>window.__liveCloudTest.seedHistory());
  await root.getByRole('button',{name:'自分宛てメッセージ',exact:true}).click();
  await root.locator('#om-message-search').fill('Older searchable');
  await expect(root.locator('.om-timeline')).toContainText('一致するメッセージがありません');
  await root.getByRole('button',{name:'以前の履歴を追加して検索'}).click();
  await expect(root.locator('.om-timeline')).toContainText('Older searchable text');
  await expect(root.locator('#om-message-search')).toHaveValue('Older searchable');
  await expect(root.locator('.om-search-bar .om-coverage')).toContainText('取得済み 51件');
  await root.getByRole('button',{name:'共有データ',exact:true}).click();
  await root.locator('#om-shared-filter').selectOption('image');
  const showImage=root.getByRole('button',{name:'synthetic.png を表示'});
  await expect(showImage).toBeVisible();
  expect(await page.evaluate(()=>window.__liveCloudTest.calls.includes('attachmentDownload'))).toBe(false);
  await showImage.click();
  const image=root.getByRole('img',{name:'synthetic.png'});
  await expect(image).toBeVisible();
  await expect.poll(()=>image.evaluate(el=>el.naturalWidth)).toBe(1);
  await root.getByRole('dialog',{name:'画像プレビュー'}).getByRole('button',{name:'閉じる'}).click();
  await expect(image).toHaveCount(0);
  await page.evaluate(()=>window.__liveCloudTest.setService(false));
  await expect.poll(()=>page.evaluate(()=>window.__liveCloudTest.handle.getSnapshot().status)).toBe('locked');
  await expect(root.locator('.om-message')).toHaveCount(0);
  await expect(root.locator('#om-body')).toBeHidden();
  await page.evaluate(()=>window.__liveCloudTest.setService(true));
  await expect.poll(()=>page.evaluate(()=>window.__liveCloudTest.handle.getSnapshot().status)).toBe('bound');
  await page.evaluate(()=>window.__liveCloudTest.showGroup());
  await root.getByRole('button',{name:'更新',exact:true}).click();
  await root.getByRole('button',{name:'Synthetic group',exact:true}).click();
  await root.getByRole('button',{name:'会話設定',exact:true}).click();
  await root.getByRole('button',{name:'グループ管理',exact:true}).click();
  const groupDialog=root.getByRole('dialog',{name:'グループ管理'});
  await expect(groupDialog.getByText('Peer（参加者）')).toBeVisible();
  await groupDialog.getByRole('textbox',{name:'グループ名'}).fill('Renamed synthetic group');
  await groupDialog.getByRole('button',{name:'名前を変更'}).click();
  await expect(groupDialog.getByRole('textbox',{name:'グループ名'})).toHaveValue('Renamed synthetic group');
  await groupDialog.getByRole('button',{name:'グループをアーカイブ'}).click();
  await expect(groupDialog.getByRole('button',{name:'会話を再開'})).toBeVisible();
  await expect(root.locator('.om-composer')).toBeHidden();
  await groupDialog.getByRole('button',{name:'会話を再開'}).click();
  await expect(groupDialog.getByRole('button',{name:'グループをアーカイブ'})).toBeVisible();
  await groupDialog.getByRole('button',{name:'閉じる',exact:true}).click();
  await expect(root.locator('.om-composer')).toBeVisible();
  expect(await page.evaluate(()=>window.__liveCloudTest.handle.hideWorkspace())).toBe(true);
  await page.evaluate(()=>window.__liveCloudTest.disconnect());
  await expect.poll(()=>page.evaluate(()=>window.__liveCloudTest.handle.getSnapshot().status)).toBe('locked');
  await expect(root.getByText('自分宛てメッセージ',{exact:true})).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>window.__liveCloudTest.summaries.at(-1))).toBeNull();
  await page.evaluate(()=>window.__liveCloudTest.handle.dispose());
  expect(await page.evaluate(()=>window.__liveCloudTest.subscriptionCount())).toBe(0);
});
