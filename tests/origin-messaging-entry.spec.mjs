import {test,expect} from '@playwright/test';

// Real entry and launcher modules; only Firebase and cloud boundaries are synthetic.
test('Origin entry is opt-in, restores the conversation, and closes on identity change',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort('blockedbyclient'));
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('/test-harness/messaging-preview/index.html');
  await page.evaluate(async()=>{
    const {installOriginMessagingEntry}=await import('/origin-messaging-entry.js');
    const host=document.createElement('div');host.id='entry-test';document.body.prepend(host);
    const root=host.attachShadow({mode:'open'}),anchor=document.createElement('button');anchor.textContent='Inbox';root.append(anchor);
    let snapshot={roomId:'roomA',currentUser:'Synthetic',connectionMode:'remote-online'},config={enabled:false,endpoint:'https://abcdefghijklmnopqrst.supabase.co/functions/v1/workboard-messaging'},listener,mounted;
    let authCalls=0,mounts=0,disposals=0,subscriptions=new Set(),approved=true;
    const auth={currentUser:{uid:'synthetic',getIdToken:async()=> 'synthetic-token'},authStateReady:async()=>{}};
    const board={readSnapshot:()=>snapshot,readMemos:()=>[],canReadRecord:async()=>true,openRecord:()=>true,subscribe(fn){listener=fn;fn(snapshot);return ()=>{listener=null;};}};
    const options={root,anchor,readConfig:()=>config,board,cssUrl:'/origin-messaging.css',connect:async()=>{authCalls++;return {app:{},sdk:{},authSdk:{getAuth:()=>auth,signInAnonymously:async()=>{throw Error('Unexpected sign in');},onAuthStateChanged:()=>()=>{}}};},mountCloud(o){mounts++;mounted=o;const node=document.createElement('div');node.textContent='Synthetic cloud view';o.root.append(node);return {getSnapshot:()=>({status:approved?'bound':'locked'}),getApprovalRequest:()=>approved?null:{roomId:'roomA',displayName:'Synthetic',uid:'synthetic'},subscribe(fn){subscriptions.add(fn);fn({status:approved?'bound':'locked'});return ()=>subscriptions.delete(fn);},restore:()=>o.board.restoreConversation({conversationId:'self_p_'+'a'.repeat(32),scrollTop:0,query:''},{roomId:'roomA'}),dispose(){disposals++;node.remove();}};}};
    const disabled=installOriginMessagingEntry(options);if(disabled!==null)throw Error('Disabled feature installed');
    config={...config,enabled:true};const entry=installOriginMessagingEntry(options);
    window.__originEntryTest={entry,stats:()=>({authCalls,mounts,disposals,subscriptions:subscriptions.size}),suspend:()=>mounted.board.openRecord({type:'task',recordId:'x'},{roomId:'roomA'}),lock(){approved=false;for(const fn of subscriptions)fn({status:'locked'});},switchUser(){snapshot={...snapshot,currentUser:'Other'};listener?.(snapshot);},disable(){config={...config,enabled:false};entry.sync();}};
  });
  const root=page.locator('#entry-test');
  expect(await page.evaluate(()=>window.__originEntryTest.stats().authCalls)).toBe(0);
  await root.getByRole('button',{name:'メッセージを開く'}).click();
  await expect(root.getByText('Synthetic cloud view')).toBeVisible();
  expect(await page.evaluate(()=>window.__originEntryTest.stats().mounts)).toBe(1);
  expect(await page.evaluate(()=>window.__originEntryTest.suspend())).toBe(true);
  await expect(root.getByRole('dialog')).toBeHidden();
  expect(await page.evaluate(()=>window.__originEntryTest.entry.resume())).toBe(true);
  await expect(root.getByRole('dialog')).toBeVisible();
  await root.getByRole('button',{name:'メッセージを閉じる'}).click();
  await expect(root.getByRole('dialog')).toBeHidden();
  expect(await page.evaluate(()=>window.__originEntryTest.stats().disposals)).toBe(1);
  await root.getByRole('button',{name:'メッセージを開く'}).click();
  await expect(root.getByText('Synthetic cloud view')).toBeVisible();
  await page.evaluate(()=>window.__originEntryTest.lock());
  await root.getByText('端末承認情報',{exact:true}).click();
  await expect(root.getByLabel('管理者へ伝える端末承認情報')).toHaveValue('ルーム: roomA\n利用者: Synthetic\n端末ID: synthetic');
  await page.evaluate(()=>window.__originEntryTest.switchUser());
  await expect(root.getByRole('dialog')).toBeHidden();
  await expect(root.getByLabel('管理者へ伝える端末承認情報')).toHaveValue('');
  await page.evaluate(()=>window.__originEntryTest.disable());
  await expect(root.getByRole('button',{name:'メッセージを開く'})).toBeHidden();
  expect(await page.evaluate(()=>window.__originEntryTest.stats())).toEqual({authCalls:2,mounts:2,disposals:2,subscriptions:0});
  expect(errors).toEqual([]);
});

test('header badge continues while the workspace is closed and is cleared on a board identity change',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort('blockedbyclient'));
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('/test-harness/messaging-preview/index.html');
  await page.evaluate(async()=>{
    const {installOriginMessagingEntry}=await import('/origin-messaging-entry.js');
    const host=document.createElement('div');host.id='background-entry';document.body.prepend(host);
    const root=host.attachShadow({mode:'open'}),anchor=document.createElement('button');anchor.textContent='Inbox';root.append(anchor);
    let snapshot={roomId:'roomA',currentUser:'Synthetic',connectionMode:'remote-online'},config={enabled:true,endpoint:'https://abcdefghijklmnopqrst.supabase.co/functions/v1/workboard-messaging'},listener,mounted;
    let authCalls=0,mounts=0,disposals=0,shows=0,hides=0,notifications=[];
    const auth={currentUser:{uid:'synthetic',getIdToken:async()=> 'synthetic-token'},authStateReady:async()=>{}};
    const board={readSnapshot:()=>snapshot,readMemos:()=>[],canReadRecord:async()=>true,openRecord:()=>true,subscribe(fn){listener=fn;fn(snapshot);return ()=>{listener=null;};}};
    const entry=installOriginMessagingEntry({root,anchor,readConfig:()=>config,board,cssUrl:'/origin-messaging.css',onNotification:kind=>notifications.push(kind),
      connect:async()=>{authCalls++;return {app:{},sdk:{},authSdk:{getAuth:()=>auth,signInAnonymously:async()=>{throw Error('Unexpected sign in');},onAuthStateChanged:()=>()=>{}}};},
      mountCloud(o){mounts++;mounted=o;let node;
        function show(){if(node?.isConnected)return true;shows++;node=document.createElement('div');node.textContent='Synthetic notification view';o.root.append(node);return true;}
        show();
        return {getSnapshot:()=>({status:'bound'}),subscribe(fn){fn({status:'bound'});return ()=>{};},showWorkspace:show,hideWorkspace(){hides++;node.remove();return true;},dispose(){disposals++;node.remove();}};
      }});
    window.__backgroundEntry={entry,stats:()=>({authCalls,mounts,disposals,shows,hides,notifications}),summary:(unread,invites,complete)=>mounted.onSummary({status:'ok',unread,invites,complete}),notify:kind=>mounted.onNotification(kind),switchUser(){snapshot={...snapshot,currentUser:'Other'};listener?.(snapshot);}};
  });
  const root=page.locator('#background-entry'),trigger=root.getByRole('button',{name:/メッセージを開く/}),badge=root.locator('.origin-message-badge');
  expect(await page.evaluate(()=>window.__backgroundEntry.stats().authCalls)).toBe(0);
  await trigger.click();await expect(root.getByText('Synthetic notification view')).toBeVisible();
  await page.evaluate(()=>window.__backgroundEntry.summary(0,0,false));
  await expect(badge).toHaveText('…');
  await page.evaluate(()=>window.__backgroundEntry.summary(2,1,true));
  await expect(badge).toHaveText('3');
  await root.getByRole('button',{name:'メッセージを閉じる'}).click();await expect(root.getByRole('dialog')).toBeHidden();
  await page.evaluate(()=>{window.__backgroundEntry.summary(4,1,true);window.__backgroundEntry.notify('message');});
  await expect(badge).toBeVisible();await expect(badge).toHaveText('5');
  expect(await page.evaluate(()=>window.__backgroundEntry.stats())).toEqual({authCalls:1,mounts:1,disposals:0,shows:1,hides:1,notifications:['message']});
  await trigger.click();await expect(root.getByText('Synthetic notification view')).toBeVisible();
  await root.getByRole('button',{name:'メッセージを閉じる'}).click();
  await page.evaluate(()=>window.__backgroundEntry.switchUser());
  await expect(badge).toBeHidden();
  await page.evaluate(()=>{window.__backgroundEntry.summary(99,1,true);window.__backgroundEntry.notify('invite');});
  await expect(badge).toBeHidden();
  expect(await page.evaluate(()=>window.__backgroundEntry.stats())).toEqual({authCalls:1,mounts:1,disposals:1,shows:2,hides:2,notifications:['message']});
  expect(errors).toEqual([]);
});
