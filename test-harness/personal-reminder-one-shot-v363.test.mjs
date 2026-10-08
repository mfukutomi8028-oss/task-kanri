import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const [source, manifest, responsibilities] = await Promise.all([
  read('reminders-v152.js'), read('release-manifest.js'), read('patch-responsibilities.json')
]);

test('Ver.363 removes 30-second polling while preserving reminder write and update contracts', () => {
  assert.doesNotMatch(source, /setInterval\s*\(\s*schedule\s*,\s*30000\s*\)/);
  for (const contract of [
    'function nextReminderWakeV363', 'function armReminderWakeV363',
    'function fireReminderWakeV363', 'clearTimeout(reminderWakeTimerV363)',
    'Math.min(2147483647', 'window.addEventListener(\'focus\',patch)',
    'window.addEventListener(\'pageshow\',patch)',
    "document.addEventListener('visibilitychange'",
    "'workflow-v152-update'", "'workflow-v150-update'",
    'function notifyDue()', 'W.writeReminder(', 'new Notification(',
    'new MutationObserver(', 'requestAnimationFrame(()=>{scheduled=false;patch()})'
  ]) assert.ok(source.includes(contract), 'missing contract: ' + contract);
  assert.match(source, /if\(document\.hidden\)armReminderWakeV363\(\);else patch\(\)/);
  assert.match(source, /if\(state\.className!==name\)state\.className=name/);
  assert.match(source, /if\(state\.textContent!==label\)state\.textContent=label/);
  assert.match(source, /node\.classList\.toggle\('is-due'/);
  assert.match(source, /stamp\.textContent=label/);
  assert.match(source, /clearCompleted\(\);patchDetail\(\);patchToday\(\);notifyDue\(\);armReminderWakeV363\(\)/);
});

test('Ver.363 advances release and baseline to 296', () => {
  assert.equal(manifest.match(/version:\s*"(\d+)"/)?.[1], '296');
  assert.equal(String(JSON.parse(responsibilities).baselineRelease), '296');
});

function boot({ atOffset=60000, hour=10, minute=0, second=0 }={}) {
  const NativeDate=Date;
  let now=new NativeDate(2026,9,8,hour,minute,second).getTime();
  const task={status:'未着手',title:'Ver.363 reminder'};
  const reminders={'task-363':{at:now+atOffset,note:'要確認'}};
  const events=new Map(),timers=new Map(),intervals=[],toasts=[],notifications=[];
  const documentEvents=new Map();
  const document={
    hidden:false,
    getElementById:()=>null,
    addEventListener:(name,cb)=>documentEvents.set(name,cb)
  };
  let user='福冨',id=0;
  const W={
    currentUser:()=>user,
    taskMap:()=>new Map([['task-363',task]]),
    remindersFor:()=>reminders,
    reminderFor:key=>reminders[key]||null,
    isCompleted:item=>item.status==='完了',
    notify:message=>toasts.push(message),
    writeReminder:async()=>({ok:true})
  };
  class MockDate extends NativeDate{
    constructor(...args){if(args.length)super(...args);else super(now)}
    static now(){return now}
  }
  class MockNotification{
    static permission='granted';
    constructor(title,options){notifications.push({title,body:options.body})}
  }
  const window={
    WorkBoardWorkflowV152:W,Notification:MockNotification,
    addEventListener:(name,cb)=>{const list=events.get(name)||[];list.push(cb);events.set(name,list)}
  };
  const sandbox=vm.createContext({
    window,document,Notification:MockNotification,Date:MockDate,
    requestAnimationFrame:callback=>callback(),
    setTimeout:(callback,delay)=>{const key=++id;timers.set(key,{callback,delay});return key},
    clearTimeout:key=>timers.delete(key),
    setInterval:(callback,delay)=>{intervals.push(delay);return ++id},
    MutationObserver:class{observe(){}}
  });
  vm.runInContext(source,sandbox,{filename:'reminders-v152.js'});
  const active=()=>[...timers.values()];
  return {
    task,reminders,document,toasts,notifications,intervals,active,
    advance:ms=>{now+=ms},
    changeUser:value=>{user=value},
    event:name=>(events.get(name)||[]).forEach(callback=>callback()),
    visibility:hidden=>{document.hidden=hidden;documentEvents.get('visibilitychange')?.()},
    fire:()=>{const [key,entry]=timers.entries().next().value||[];assert.ok(entry,'expected armed timeout');timers.delete(key);entry.callback()},
    today:()=>new NativeDate(now)
  };
}

test('Ver.363 clock deadline triggers exactly once without frame or update event',()=>{
  const runtime=boot();
  assert.equal(runtime.intervals.length,0);
  assert.equal(runtime.active().length,1);
  assert.equal(runtime.active()[0].delay,60000);
  runtime.advance(60000);
  runtime.fire();
  assert.equal(runtime.toasts.length,1);
  assert.equal(runtime.notifications.length,1);
  runtime.event('workflow-v152-update');
  runtime.event('workflow-v150-update');
  assert.equal(runtime.toasts.length,1);
  assert.equal(runtime.active().length,1,'visible UI should retain local-midnight timer');
});

test('Ver.363 hidden tab retains notification timer and resumes without duplicate',()=>{
  const runtime=boot();
  runtime.visibility(true);
  assert.equal(runtime.active().length,1);
  assert.equal(runtime.active()[0].delay,60000);
  runtime.advance(60000);
  runtime.fire();
  assert.equal(runtime.toasts.length,1,'background callback must not await requestAnimationFrame');
  assert.equal(runtime.active().length,0,'no unnecessary UI timer in hidden tab');
  runtime.visibility(false);
  assert.equal(runtime.active().length,1);
  runtime.event('focus');
  runtime.event('pageshow');
  assert.equal(runtime.active().length,1);
  assert.equal(runtime.toasts.length,1);
});

test('Ver.363 earlier/later edits re-arm one timer; completion removes due ownership',()=>{
  const runtime=boot();
  const original=runtime.reminders['task-363'];
  runtime.reminders['task-363']={...original,at:original.at+60000};
  runtime.event('workflow-v152-update');
  assert.equal(runtime.active().length,1);
  assert.equal(runtime.active()[0].delay,120000);
  runtime.reminders['task-363']={...original,at:original.at-30000};
  runtime.event('workflow-v150-update');
  assert.equal(runtime.active().length,1);
  assert.equal(runtime.active()[0].delay,30000);
  runtime.task.status='完了';
  runtime.event('workflow-v152-update');
  assert.equal(runtime.active().length,0);
  runtime.advance(60000);
  runtime.event('workflow-v150-update');
  assert.equal(runtime.toasts.length,0);
});

test('Ver.363 user changes reset only per-user seen notifications',()=>{
  const runtime=boot();
  runtime.advance(60000);
  runtime.fire();
  runtime.event('workflow-v152-update');
  assert.equal(runtime.toasts.length,1);
  runtime.changeUser('土屋');
  runtime.event('workflow-v152-update');
  assert.equal(runtime.toasts.length,2);
  runtime.event('workflow-v152-update');
  assert.equal(runtime.toasts.length,2);
});

test('Ver.363 visible UI wakes at local midnight to include next-day reminders',()=>{
  const runtime=boot({hour:23,minute:59,second:30,atOffset:9*3600000+30000});
  assert.equal(runtime.active().length,1);
  assert.equal(runtime.active()[0].delay,30000);
  runtime.advance(30000);
  runtime.fire();
  assert.equal(runtime.toasts.length,0);
  assert.equal(runtime.active().length,1);
  assert.equal(runtime.active()[0].delay,9*3600000);
});

test('Ver.363 display wake catches 24-hour threshold',()=>{
  const runtime=boot({atOffset:53*3600000});
  assert.equal(runtime.active().length,1);
  // The next local midnight precedes the 24-hour threshold for this fixture.
  const midnight=new Date(2026,9,9,0,0,0).getTime();
  const start=new Date(2026,9,8,10,0,0).getTime();
  assert.equal(runtime.active()[0].delay,midnight-start);
  runtime.advance(midnight-start);
  runtime.fire();
  assert.equal(runtime.active()[0].delay,15*3600000,'24-hour threshold must be next');
});
