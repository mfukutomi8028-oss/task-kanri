import { test, expect } from '@playwright/test';

const ROOM_PREFIX='test-personal-reminder-v363';

function makeTask(now) {
  return {
    id:'reminder-task-v363',title:'Ver.363 private reminder',status:'未着手',
    assignee:'福冨',requester:'',category:'その他',priority:'中',tags:[],
    description:'',checklist:[],recurrence:'none',dueDate:'',dueTime:'',
    pinned:false,completedAt:0,completedMemo:'',comments:[],history:[],
    revision:1,createdBy:'福冨',createdAt:now-600000,updatedBy:'福冨',updatedAt:now-120000
  };
}

async function boot(page,suffix,{midnight=false}={}){
  const room=ROOM_PREFIX+'-'+suffix;
  await page.setViewportSize({width:1366,height:900});
  await page.addInitScript(({room,midnight})=>{
    localStorage.clear();
    localStorage.setItem('systemTaskUser','福冨');
    localStorage.setItem('systemTaskRoomId',room);
    localStorage.setItem('system-task-users:'+room,JSON.stringify(['福冨','土屋']));
    const NativeDate=Date;
    let now=new NativeDate(2026,9,8,midnight?23:10,midnight?59:0,midnight?30:0).getTime();
    const task={
      id:'reminder-task-v363',title:'Ver.363 private reminder',status:'未着手',
      assignee:'福冨',requester:'',category:'その他',priority:'中',tags:[],
      description:'',checklist:[],recurrence:'none',dueDate:'',dueTime:'',
      pinned:false,completedAt:0,completedMemo:'',comments:[],history:[],
      revision:1,createdBy:'福冨',createdAt:now-600000,updatedBy:'福冨',updatedAt:now-120000
    };
    const at=midnight?now+9*3600000+30000:now+60000;
    localStorage.setItem('system-task-tasks:'+room,JSON.stringify([task]));
    localStorage.setItem('work-board-workflow-v148:'+room,JSON.stringify({
      dependencies:{},savedViews:{},relations:{},
      reminders:{'福冨':{'reminder-task-v363':{at,note:'明日の確認',updatedAt:now}}}
    }));
    class AuditDate extends NativeDate{
      constructor(...args){if(args.length)super(...args);else super(now)}
      static now(){return now}
    }
    window.Date=AuditDate;
    window.__v363Advance=ms=>{now+=Number(ms||0)};
    let hidden=false;
    try{Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden})}
    catch{Object.defineProperty(Document.prototype,'hidden',{configurable:true,get:()=>hidden})}
    const nativeInterval=window.setInterval.bind(window);
    const nativeTimeout=window.setTimeout.bind(window);
    const nativeClear=window.clearTimeout.bind(window);
    const owned=new Map();
    let timerId=363000;
    window.__v363Intervals=[];
    window.__v363Toasts=[];
    window.setInterval=(callback,delay,...args)=>{
      if(Number(delay)===30000&&String(new Error().stack||'').includes('reminders-v152.js'))
        window.__v363Intervals.push(Number(delay));
      return nativeInterval(callback,delay,...args);
    };
    window.setTimeout=(callback,delay,...args)=>{
      if(String(callback).includes('fireReminderWakeV363')&&String(new Error().stack||'').includes('reminders-v152.js')){
        const id=++timerId;
        owned.set(id,{callback,delay:Number(delay),active:true});
        return id;
      }
      return nativeTimeout(callback,delay,...args);
    };
    window.clearTimeout=id=>{
      const item=owned.get(Number(id));
      if(item){item.active=false;return}
      return nativeClear(id);
    };
    window.__v363State=()=>({
      intervals:window.__v363Intervals.length,
      active:[...owned.values()].filter(item=>item.active).map(item=>item.delay)
    });
    window.__v363Fire=()=>{
      const entry=[...owned.values()].find(item=>item.active);
      if(!entry)return false;
      entry.active=false;
      entry.callback();
      return true;
    };
    window.__v363SetHidden=value=>{
      hidden=Boolean(value);
      document.dispatchEvent(new Event('visibilitychange'));
    };
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
  },{room,midnight});
  await page.route('https://www.gstatic.com/firebasejs/**',route=>route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,route=>route.abort('blockedbyclient'));
  await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.waitForFunction(()=>{
    const W=window.WorkBoardWorkflowV152||window.WorkBoardWorkflowV150;
    return !!W?.remindersFor?.()['reminder-task-v363'];
  });
  await page.evaluate(()=>{
    const W=window.WorkBoardWorkflowV152||window.WorkBoardWorkflowV150;
    const original=W.notify;
    W.notify=(...args)=>{window.__v363Toasts.push(String(args[0]));return original(...args)};
  });
}
const state=page=>page.evaluate(()=>window.__v363State());

test('Ver.363 owns one earliest-boundary timer without 30-second polling',async({page})=>{
  await boot(page,'owner');
  await expect.poll(()=>state(page)).toMatchObject({intervals:0,active:[60000]});
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  expect((await state(page)).active).toEqual([60000]);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  expect((await state(page)).active).toEqual([60000]);
});

test('Ver.363 fires personal notification while hidden and resumes without duplicate',async({page})=>{
  await boot(page,'background');
  await page.evaluate(()=>window.__v363SetHidden(true));
  expect((await state(page)).active).toEqual([60000]);
  await page.evaluate(()=>{window.__v363Advance(60000);if(!window.__v363Fire())throw Error('missing boundary timer')});
  await expect.poll(()=>page.evaluate(()=>window.__v363Toasts.filter(x=>x.includes('Ver.363 private reminder')).length)).toBe(1);
  expect((await state(page)).active).toHaveLength(0);
  await page.evaluate(()=>window.__v363SetHidden(false));
  expect((await state(page)).active).toHaveLength(1);
  await page.evaluate(()=>{
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
  });
  expect((await state(page)).active).toHaveLength(1);
  expect(await page.evaluate(()=>window.__v363Toasts.filter(x=>x.includes('Ver.363 private reminder')).length)).toBe(1);
});

test('Ver.363 updates Today due styling without remounting the reminder list',async({page})=>{
  await boot(page,'today');
  await page.locator('.nav-item[data-layout="today"]').click();
  const section=page.locator('#todayView .today-reminders-v152');
  await expect(section).toBeVisible();
  await expect(section.locator('.today-reminder-item-v152')).not.toHaveClass(/is-due/);
  await section.evaluate(node=>window.__v363TodayNode=node);
  await page.evaluate(()=>{window.__v363Advance(60000);if(!window.__v363Fire())throw Error('missing boundary timer')});
  await expect(section.locator('.today-reminder-item-v152')).toHaveClass(/is-due/);
  expect(await section.evaluate(node=>node===window.__v363TodayNode)).toBe(true);
});

test('Ver.363 detail label refresh preserves unsaved reminder input',async({page})=>{
  await boot(page,'detail');
  await page.locator('.nav-item[data-layout="tasks"]').click();
  await page.locator('.task-card[data-task-id="reminder-task-v363"]').first().click();
  const note=page.locator('#detailBody [data-reminder-note-v152]');
  await expect(note).toBeVisible();
  await note.fill('保存前のメモを維持');
  await page.evaluate(()=>{window.__v363Advance(60000);if(!window.__v363Fire())throw Error('missing boundary timer')});
  await expect(note).toHaveValue('保存前のメモを維持');
  await expect(page.locator('#detailBody .workflow-reminder-state-v152')).toHaveClass(/is-due/);
});

test('Ver.363 local-midnight boundary makes tomorrow reminder appear in Today',async({page})=>{
  await boot(page,'midnight',{midnight:true});
  await page.locator('.nav-item[data-layout="today"]').click();
  await expect(page.locator('#todayView .today-reminders-v152')).toHaveCount(0);
  await expect.poll(()=>state(page)).toMatchObject({intervals:0,active:[30000]});
  await page.evaluate(()=>{window.__v363Advance(30000);if(!window.__v363Fire())throw Error('missing midnight timer')});
  await expect(page.locator('#todayView .today-reminders-v152')).toBeVisible();
  expect((await state(page)).active).toEqual([9*3600000]);
});
