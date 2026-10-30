import { test, expect } from '@playwright/test';
import { MODERN_PALETTES } from '../modern/preferences.mjs';

const ROOM='test-modern-display-v565';
const frames='iframe[data-modern-today-v554],iframe[data-modern-todo-v552],iframe[data-modern-task-v551],iframe[data-modern-schedule-v553],iframe[data-modern-memo-v555]';
async function boot(page,{enabled=true,initial=null}={}) {
  await page.addInitScript(({room,enabled,initial})=>{
    if(!sessionStorage.getItem('v565-test-seeded')){
      localStorage.clear();
      sessionStorage.setItem('v565-test-seeded','1');
      localStorage.setItem('systemTaskRoomId',room);
      // The existing desktop sidebar collapses and hides the user-card.
      // Pin it in this test fixture instead of clicking hidden controls.
      localStorage.setItem('work-board-desktop-sidebar-pinned-v158','1');
      localStorage.setItem('system-task-users:'+room,JSON.stringify(['佐藤','福冨']));
      localStorage.setItem('systemTaskUser','佐藤');
      localStorage.setItem('system-task-tasks:'+room,'[]');
      localStorage.setItem('system-task-todos:'+room,'[]');
      localStorage.setItem('system-task-schedules:'+room,'[]');
      localStorage.setItem('system-business-memos:'+room,'{}');
      if(initial)localStorage.setItem('workboard-display-v1:'+encodeURIComponent(room)+':'+encodeURIComponent('佐藤'),JSON.stringify(initial));
    }
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null;},set(){}});
    window.WORK_BOARD_TEST=enabled?{
      modernDisplayV565:true,modernReadV551:true,modernReadV552:true,
      modernReadV553:true,modernReadV554:true,modernReadV555:true
    }:{};
  },{room:ROOM,enabled,initial});
  await page.route('https://www.gstatic.com/firebasejs/**',route=>route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,route=>route.abort('blockedbyclient'));
  await page.goto('/?room='+ROOM+'&modernDisplayV565=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  if(enabled)await page.waitForFunction(()=>Boolean(window.WorkBoardDisplayPreviewV565),undefined,{timeout:30000});
}

const current=page=>page.locator(frames);
const prefs=page=>page.evaluate(room=>{
  const user=localStorage.getItem('systemTaskUser');
  return JSON.parse(localStorage.getItem('workboard-display-v1:'+encodeURIComponent(room)+':'+encodeURIComponent(user))||'null');
},ROOM);

test('Ver.565 has no product-wide design controls without the two-sided test opt-in',async({page})=>{
  await boot(page,{enabled:false});
  await expect(page.locator('#displayPreferencesV565')).toHaveCount(0);
  await expect(current(page)).toHaveCount(0);
  expect(await page.evaluate(()=>window.WorkBoardDisplayPreviewV565)).toBeUndefined();
  expect(await prefs(page)).toBeNull();
});

test('Ver.565 switches Classic/Modern views and all twelve palettes without business-data writes',async({page})=>{
  await page.setViewportSize({width:1366,height:768});
  await boot(page);
  await expect(page.locator('#displayDesignV565')).toHaveValue('classic');
  const before=await page.evaluate(room=>['tasks','todos','schedules'].map(name=>
    localStorage.getItem('system-task-'+name+':'+room)),ROOM);
  await page.locator('#displayDesignV565').selectOption('modern');
  await expect(page.locator('iframe[data-modern-today-v554]')).toHaveCount(1);
  await expect(page.locator('#displayToolbarV565')).toBeVisible();
  for(const palette of MODERN_PALETTES){
    await page.locator('#displayToolbarPaletteV565').selectOption(palette);
    await expect(page.frameLocator(frames).locator('html')).toHaveAttribute('data-palette',palette);
    expect((await prefs(page))?.palette).toBe(palette);
  }
  const targets=[
    ['todos','data-modern-todo-v552'],
    ['tasks','data-modern-task-v551'],
    ['schedules','data-modern-schedule-v553'],
    ['memos','data-modern-memo-v555'],
    ['today','data-modern-today-v554']
  ];
  for(const [view,attribute] of targets){
    await page.locator('[data-display-view-v565="'+view+'"]').click();
    await expect(current(page)).toHaveCount(1);
    await expect(current(page)).toHaveAttribute(attribute,'true');
    await expect(page.frameLocator(frames).locator('html')).toHaveAttribute('data-palette','dusk');
  }
  const after=await page.evaluate(room=>['tasks','todos','schedules'].map(name=>
    localStorage.getItem('system-task-'+name+':'+room)),ROOM);
  expect(after).toEqual(before);
  await page.locator('#displayBackV565').click();
  await expect(current(page)).toHaveCount(0);
  await expect(page.locator('#displayDesignV565')).toHaveValue('classic');
  expect(await prefs(page)).toEqual({design:'classic',palette:'dusk'});
});

test('Ver.565 respects user-scoped themes and restores selected Modern on reload',async({page})=>{
  await boot(page);
  await page.locator('#displayPaletteV565').selectOption('night');
  await page.locator('#displayDesignV565').selectOption('modern');
  await expect(current(page)).toHaveCount(1);
  await expect(page.frameLocator(frames).locator('html')).toHaveAttribute('data-palette','night');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true&&!!window.WorkBoardDisplayPreviewV565);
  await expect(current(page)).toHaveCount(1);
  await expect(page.frameLocator(frames).locator('html')).toHaveAttribute('data-palette','night');
  await page.locator('#displayBackV565').click();
  await page.locator('#currentUserSelect').selectOption('福冨');
  await expect(page.locator('#displayPaletteV565')).toHaveValue('ink');
  await expect(page.locator('#displayDesignV565')).toHaveValue('classic');
  await page.locator('#displayPaletteV565').selectOption('lilac');
  expect(await prefs(page)).toEqual({design:'classic',palette:'lilac'});
  await page.locator('#currentUserSelect').selectOption('佐藤');
  await expect(page.locator('#displayPaletteV565')).toHaveValue('night');
  await expect(page.locator('#displayDesignV565')).toHaveValue('classic');
});

test('Ver.565 refuses to discard an open Classic modal or a nonempty quick-add draft',async({page})=>{
  await boot(page);
  // Classic hides quick-add on the Today layout. Use the existing Tasks
  // navigation first so this test types into a genuinely visible input.
  await page.locator('button[data-layout="tasks"]').click();
  await expect(page.locator('#quickAddInput')).toBeVisible();
  await page.locator('#quickAddInput').fill('未保存のタスク下書き');
  await page.locator('#displayDesignV565').selectOption('modern');
  await expect(current(page)).toHaveCount(0);
  await expect(page.locator('#quickAddInput')).toHaveValue('未保存のタスク下書き');
  await expect(page.locator('#displayDesignV565')).toHaveValue('classic');
  expect(await prefs(page)).toBeNull();
  await page.locator('#quickAddInput').fill('');
  await page.evaluate(()=>{
    const modal=document.getElementById('taskDialog');
    modal.showModal();
    document.getElementById('taskTitle').value='未保存のフォーム入力';
    const select=document.getElementById('displayDesignV565');
    select.value='modern';
    select.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect(current(page)).toHaveCount(0);
  await expect(page.locator('#taskTitle')).toHaveValue('未保存のフォーム入力');
  await expect(page.locator('#taskDialog')).toBeVisible();
  expect(await prefs(page)).toBeNull();
});

test('Ver.565 the built-in Modern back button clears saved mode and URL flag',async({page})=>{
  await boot(page);
  await page.locator('#displayDesignV565').selectOption('modern');
  await expect(page.locator('iframe[data-modern-today-v554]')).toHaveCount(1);
  await page.frameLocator('iframe[data-modern-today-v554]').locator('#closeV554').click();
  await expect(current(page)).toHaveCount(0);
  await expect(page.locator('#displayDesignV565')).toHaveValue('classic');
  expect(await prefs(page)).toEqual({design:'classic',palette:'ink'});
  await expect.poll(()=>page.evaluate(()=>location.search)).not.toContain('modernReadV554');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true&&!!window.WorkBoardDisplayPreviewV565);
  await expect(current(page)).toHaveCount(0);
  await expect(page.locator('#displayDesignV565')).toHaveValue('classic');
});

test('Ver.565 narrow screens keep the preview switch accessible without horizontal overflow',async({page})=>{
  await boot(page);
  await page.locator('#displayDesignV565').selectOption('modern');
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('#displayToolbarV565')).toBeVisible();
  await page.locator('#displayToolbarPaletteV565').selectOption('mist');
  await expect(page.frameLocator(frames).locator('html')).toHaveAttribute('data-palette','mist');
  const size=await page.locator('#displayToolbarV565').evaluate(el=>({
    width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right,
    viewport:el.ownerDocument.defaultView.innerWidth
  }));
  expect(size.right).toBeLessThanOrEqual(size.viewport);
  expect(size.width).toBeLessThanOrEqual(size.viewport);
  await page.locator('#displayBackV565').click();
  await expect(current(page)).toHaveCount(0);
});
