import {test, expect} from '@playwright/test';
// Review 5: rows shown from added older pages reflect another member's deletion
// and edit in place; the on-screen position, the search term, the gap and the
// read suppression are kept; one activity costs a bounded number of reads.
// Synthetic data on a synthetic backend only.
async function mount(page){
  await page.setViewportSize({width:1366,height:900});
  await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort('blockedbyclient'));
  await page.goto('/test-harness/messaging-preview/index.html');
  await page.evaluate(async()=>{
    const {mountCloudOriginMessaging}=await import('/origin-messaging-live.js');
    const root=document.createElement('div');root.id='liveCloud';document.body.append(root);
    const roomId='live-room',personId='p_'+'1'.repeat(32),uid='synthetic-uid',peerId='p_'+'2'.repeat(32);
    const directId='dm_'+personId+'_'+peerId;
    const binding={uid,roomId,personId,displayName:'Synthetic',approved:true,active:true};
    const boardSnapshot={roomId,currentUser:'Synthetic',connectionMode:'remote-online',tasks:[],schedules:[]};
    const make=i=>({id:'msg_'+(i%2?personId:peerId)+'_q_'+i.toString(16).padStart(32,'0'),senderId:i%2?personId:peerId,createdAt:2000+i,body:'History note '+i+(i%7===0?'\nwith a second line to vary heights':''),refs:[],replyTo:null,revision:1,attachmentIds:[],confirmationRequested:false});
    const records=Array.from({length:300},(_,i)=>make(i+1));
    const subscriptions=new Set(),history=[],writes=[];let ticks=1,marker='00000000-0000-4000-8000-000000000001';
    const bindingKey='messagingAccessV1/'+roomId+'/'+uid;
    const value=path=>path==='.info/connected'?true:path==='messagingControlV1/enabled'?true:path===bindingKey?binding:
      path==='messagingV1/'+roomId+'/control/'+directId+'/members/'+personId?{active:true,joinedAt:1000,role:'member'}:
      path==='messagingV1/'+roomId+'/activity/'+directId?marker:null;
    const snapshot=path=>({val:()=>value(path)});
    const sdk={db:{},ref:(_,path)=>path,get:async path=>snapshot(path),
      onValue(path,fn){const row={path,fn};subscriptions.add(row);queueMicrotask(()=>{if(subscriptions.has(row))fn(snapshot(path));});return ()=>subscriptions.delete(row);},
      // Read-cursor writes are recorded (never sent anywhere).
      async set(path){writes.push(String(path));},async update(path){writes.push(String(path));},
      async runTransaction(path){writes.push(String(path));return {committed:false,snapshot:{val:()=>null}};},serverTimestamp:()=>({'.sv':'timestamp'})};
    const auth={getUid:()=>uid,getToken:async()=>'synthetic-token',observeAuth(fn){queueMicrotask(fn);return ()=>{};}};
    const board={readSnapshot:()=>boardSnapshot,readMemos:()=>[],canReadRecord:async()=>false,openRecord:()=>false,restoreConversation:()=>false,subscribe(fn){fn(boardSnapshot);return ()=>{};}};
    const cmp=(m,c)=>m.createdAt-c.createdAt||(m.id<c.id?-1:m.id>c.id?1:0);
    const cursorOf=m=>({id:m.id,createdAt:m.createdAt});
    const fetchImpl=async(url,options)=>{
      const {action,payload}=JSON.parse(options.body);const scope={status:'ok',roomId,personId};
      if(action==='people')return Response.json({...scope,people:[{personId,displayName:'Synthetic'},{personId:peerId,displayName:'Peer'}]});
      if(action==='directory')return Response.json({...scope,conversations:[{id:directId,kind:'direct',peerId,status:'active',role:'member',memberCount:2,joinedAt:1000,revision:1,controlUpdatedAt:1000}],invites:[],hasMore:false,nextCursor:null});
      if(action==='unread')return Response.json({...scope,conversationId:payload.conversationId,joinedAt:1000,unread:0,complete:true,muted:false,latestIncoming:null});
      if(action==='history'){
        history.push(payload);
        if(payload.from){const next=records.filter(m=>cmp(m,payload.from)>=0).slice(0,payload.limit+1),list=next.slice(0,payload.limit);
          return Response.json({status:'ok',joinedAt:1000,messages:list,hasNewer:next.length>payload.limit,newerCursor:next.length>payload.limit?cursorOf(list.at(-1)):null});}
        const list=records.filter(m=>!payload.before||cmp(m,payload.before)<0).slice(-payload.limit);
        return Response.json({status:'ok',joinedAt:1000,messages:list,hasMore:list.length===payload.limit,nextCursor:list.length===payload.limit?cursorOf(list[0]):null});
      }
      throw Error('Unexpected request '+action);
    };
    const handle=mountCloudOriginMessaging({root,endpoint:'https://example.invalid/messaging',sdk,auth,board,fetchImpl,keepNotificationSession:true});
    window.__history={handle,history,writes,records,
      remove(i){records[i-1]={id:records[i-1].id,senderId:records[i-1].senderId,createdAt:records[i-1].createdAt,revision:2,deletedAt:9000};},
      edit(i,body){records[i-1]={...records[i-1],revision:2,body,editedAt:9000};},
      activity(){marker='00000000-0000-4000-8000-'+String(++ticks).padStart(12,'0');for(const row of [...subscriptions])if(row.path==='messagingV1/'+roomId+'/activity/'+directId)row.fn(snapshot(row.path));},
      idOf:i=>records[i-1].id};
  });
  const root=page.locator('#liveCloud');
  await expect.poll(()=>page.evaluate(()=>window.__history.handle.getSnapshot().status)).toBe('bound');
  await root.getByRole('button',{name:/Peer/}).first().click();
  await expect(root.locator('.om-message').last()).toContainText('History note 300');
  return root;
}
const idFor=i=>'msg_p_'+(i%2?'1':'2').repeat(32)+'_q_'+i.toString(16).padStart(32,'0');
const row=(root,i)=>root.locator('.om-message[data-message-id="'+idFor(i)+'"]');
const offset=async(root,i)=>root.evaluate((el,id)=>{const t=el.querySelector('.om-timeline'),m=t.querySelector('[data-message-id="'+id+'"]');return m.getBoundingClientRect().top-t.getBoundingClientRect().top;},idFor(i));

test('added older pages reflect a deletion and an edit in place; position, gap and read suppression are kept',async({page})=>{
  const root=await mount(page);
  // Three older pages: the view keeps 150 rows and becomes a window with a gap.
  for(let n=0;n<3;n++){await root.getByRole('button',{name:'以前のメッセージを表示'}).click();await page.waitForTimeout(150);}
  await expect(root.getByText('ここから最新までのメッセージは未取得です。')).toBeVisible();
  await expect(root.locator('.om-message')).toHaveCount(150);
  // The newest rows were trimmed: 101-250 are shown. Read a row in the oldest page.
  await expect(row(root,101)).toBeAttached();await expect(row(root,250)).toBeAttached();await expect(row(root,251)).toHaveCount(0);
  await row(root,125).scrollIntoViewIfNeeded();
  await root.evaluate(el=>{const t=el.querySelector('.om-timeline');t.scrollTop-=10;});
  const before=await offset(root,125);
  const writesBefore=await page.evaluate(()=>window.__history.writes.length);
  const requestsBefore=await page.evaluate(()=>window.__history.history.length);
  // Another member deletes a row above the reading position and edits one below.
  await page.evaluate(()=>{window.__history.remove(110);window.__history.edit(140,'Edited by the peer');window.__history.activity();});
  await expect(row(root,110)).toContainText('メッセージは削除されました');
  await expect(row(root,140)).toContainText('Edited by the peer');
  expect(Math.abs(await offset(root,125)-before)).toBeLessThanOrEqual(2);
  expect(await page.evaluate(n=>window.__history.history.length-n,requestsBefore)).toBeLessThanOrEqual(3);
  expect(await page.evaluate(n=>window.__history.writes.slice(n).filter(p=>p.includes('readCursor')),writesBefore)).toEqual([]);
  await expect(root.getByText('ここから最新までのメッセージは未取得です。')).toBeVisible();
});

test('a search over added pages keeps its term and shows the edit after activity',async({page})=>{
  const root=await mount(page);
  await root.getByRole('button',{name:'以前のメッセージを表示'}).click();
  await expect(root.locator('.om-message')).toHaveCount(100);
  await root.locator('#om-message-search').fill('History note 210');
  await expect(row(root,210)).toBeVisible();
  await page.evaluate(()=>{window.__history.edit(210,'History note 210 edited');window.__history.activity();});
  await expect(row(root,210)).toContainText('History note 210 edited');
  await expect(root.locator('#om-message-search')).toHaveValue('History note 210');
  await expect(root.locator('.om-search-bar .om-coverage')).toContainText('表示中の範囲（最大150件）');
});
