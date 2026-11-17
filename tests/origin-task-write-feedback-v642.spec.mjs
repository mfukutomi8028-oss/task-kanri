import {test,expect} from '@playwright/test';

// Intercept only the external write boundary. The UI, canonical data and
// application dispatch all remain real; we control latency/failure per test.
async function openOrigin(page,width,slug){
 await page.setViewportSize({width,height:width<800?844:900});
 await page.route('**/*',route=>
  new URL(route.request().url()).origin==='http://127.0.0.1:4173'
   ?route.continue():route.abort('blockedbyclient'));
 const room='origin-write-feedback-v642-'+width+'-'+slug;
 await page.addInitScript(roomId=>{
  Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  localStorage.setItem('systemTaskRoomId',roomId);
  localStorage.setItem('systemTaskUser','OriginWriteFeedbackQA');
  let wrapped;
  Object.defineProperty(window,'WorkBoardPaletteBridge',{
   configurable:true,
   get(){return wrapped;},
   set(real){
    wrapped=Object.freeze({...real,
     async dispatch(command){
      const gate=window.__originWriteGate;
      if(gate?.enabled && gate.types?.includes(command.type)){
       gate.attempts=(gate.attempts||0)+1;
       gate.started=true;
       await new Promise(resolve=>{gate.release=resolve;});
       if(gate.fail)throw new Error('simulated connection interruption');
      }
      return real.dispatch(command);
     }
    });
   }
  });
 },room);
 await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
 await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
 const root=page.locator('#modernOriginRoot');
 await expect(root).toBeVisible();
 await root.locator((width<768?'#mobileNav':'#desktopNav')+' [data-route="tasks"]').click();
 return root;
}
async function makeTasks(page,count=3){
 return page.evaluate(async count=>{
  const bridge=window.WorkBoardPaletteBridge,s=bridge.readSnapshot();
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+7);
  const due=[tomorrow.getFullYear(),String(tomorrow.getMonth()+1).padStart(2,'0'),String(tomorrow.getDate()).padStart(2,'0')].join('-');
  const ids=[];
  for(let i=0;i<count;i++){
   const out=await bridge.dispatch({
    type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,
    title:'書き込み状態を確認 '+String(i+1).padStart(2,'0'),description:'',
    status:s.statuses[0],priority:'中',assignee:s.users[0],category:s.categories[0],
    requester:'',tags:'',checklist:'',checklistDone:[],dueDate:due,dueTime:'13:00',pinned:false
   });
   if(!out?.ok)throw Error('Seed failed: '+JSON.stringify(out));
   ids.push(out.id);
  }
  const target=s.statuses.find(v=>v!==s.statuses[0]&&v!=='完了');
  if(!target)throw Error('No alternate non-complete status');
  return {ids,target,initial:s.statuses[0]};
 },count);
}
async function selectTwo(root,ids){
 for(const id of ids.slice(0,2)){
  const check=root.locator('.origin-task-collection [data-action="bulk-toggle"][data-id="'+id+'"]');
  await check.evaluate(el=>{
   el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect(check).toBeChecked();
 }
}
async function armGate(page,type,fail=false){
 await page.evaluate(({type,fail})=>{
  window.__originWriteGate={enabled:true,types:[type],fail,started:false,attempts:0,release:null};
 },{type,fail});
}
async function waitForGate(page){
 await page.waitForFunction(()=>window.__originWriteGate?.started&&typeof window.__originWriteGate.release==='function',{timeout:12000});
}
async function releaseGate(page,disable=false){
 await page.evaluate(disable=>{
  const gate=window.__originWriteGate;
  if(disable)gate.enabled=false;
  gate.release?.();
 },disable);
}
for(const width of [320,1366]){
 test('Origin '+width+'px shows persistent pending state and locks batch controls until commit',async({page})=>{
  test.setTimeout(120000);
  const root=await openOrigin(page,width,'batch-pending');
  const data=await makeTasks(page);
  await root.locator('#originTaskQuery').fill('書き込み状態を確認');
  await selectTwo(root,data.ids);
  await root.locator('#originBulkStatus').selectOption(data.target);
  await armGate(page,'task.bulk.update');
  await root.locator('[data-action="bulk-status-apply"]').click();
  await waitForGate(page);
  const region=root.locator('#originTaskWriteFeedback');
  await expect(region).toBeVisible();
  await expect(region).toHaveAttribute('data-state','saving');
  await expect(region).toContainText('保存中');
  await expect(root.locator('.origin-task-collection')).toHaveAttribute('aria-busy','true');
  await expect(root.locator('[data-action="bulk-status-apply"]')).toBeDisabled();
  await expect(root.locator('[data-action="bulk-done"]')).toBeDisabled();
  await expect(root.locator('[data-action="bulk-clear"]')).toBeDisabled();
  await expect(root.locator('.origin-task-collection [data-action="bulk-toggle"]').first()).toBeDisabled();
  await expect(root.locator('.origin-task-collection [data-action="task-done"]').first()).toBeDisabled();
  await releaseGate(page);
  await expect(region).toBeHidden();
  await expect(root.locator('.bulkbar')).toHaveCount(0);
  await expect(root.locator('#originToast')).toContainText('2件');
  const result=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks);
  expect(result.filter(t=>data.ids.slice(0,2).includes(t.id)).every(t=>t.status===data.target)).toBe(true);
  expect(result.find(t=>t.id===data.ids[2]).status).toBe(data.initial);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 });
}
test('Origin retains selected tasks, target and an actionable error after a failed batch write',async({page})=>{
 test.setTimeout(120000);
 const root=await openOrigin(page,390,'batch-failure');
 const data=await makeTasks(page);
 await root.locator('#originTaskQuery').fill('書き込み状態を確認');
 await selectTwo(root,data.ids);
 await root.locator('#originBulkStatus').selectOption(data.target);
 await armGate(page,'task.bulk.update',true);
 await root.locator('[data-action="bulk-status-apply"]').click();
 await waitForGate(page);
 await releaseGate(page);
 const error=root.locator('#originTaskWriteFeedback');
 await expect(error).toHaveAttribute('data-state','error');
 await expect(error).toContainText('保存できませんでした');
 await expect(error).toBeVisible();
 await expect(root.locator('#originBulkStatus')).toHaveValue(data.target);
 await expect(root.locator('.bulkbar')).toContainText('2件選択中');
 await expect(root.locator('[data-action="bulk-status-apply"]')).toBeEnabled();
 for(const id of data.ids.slice(0,2))
  await expect(root.locator('.origin-task-collection [data-action="bulk-toggle"][data-id="'+id+'"]')).toBeChecked();
 // Keep this feedback even when the transient toast disappears.
 await expect(root.locator('#originToast')).toBeHidden({timeout:9000});
 await expect(error).toBeVisible();
 expect((await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks)).find(t=>t.id===data.ids[0]).status).toBe(data.initial);
 // User can retry deliberately: never auto-retry an ambiguous write.
 await page.evaluate(()=>{window.__originWriteGate.enabled=false;});
 await root.locator('[data-action="bulk-status-apply"]').click();
 await expect(error).toBeHidden();
 await expect(root.locator('.bulkbar')).toHaveCount(0);
 const saved=await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks);
 expect(saved.find(t=>t.id===data.ids[0]).status).toBe(data.target);
 expect(saved.find(t=>t.id===data.ids[1]).status).toBe(data.target);
});
test('Origin inline status change has pending feedback and restores keyboard operation',async({page})=>{
 test.setTimeout(120000);
 const root=await openOrigin(page,390,'inline');
 const data=await makeTasks(page,2);
 await root.locator('#originTaskQuery').fill('書き込み状態を確認');
 const select=root.locator('.origin-task-collection [data-action="task-inline-status"][data-id="'+data.ids[0]+'"]');
 await armGate(page,'task.status');
 await select.selectOption(data.target);
 await waitForGate(page);
 await expect(root.locator('#originTaskWriteFeedback')).toContainText('保存中');
 await expect(root.locator('.origin-task-collection [data-action="task-done"]').first()).toBeDisabled();
 await releaseGate(page);
 await expect(root.locator('#originTaskWriteFeedback')).toBeHidden();
 await expect(select).toHaveValue(data.target);
 await expect(select).toBeEnabled();
 await expect(root.locator('#originTaskQuery')).toHaveValue('書き込み状態を確認');
 expect((await page.evaluate(()=>window.WorkBoardPaletteBridge.readSnapshot().tasks)).find(t=>t.id===data.ids[0]).status).toBe(data.target);
});
