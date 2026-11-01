import { test, expect } from '@playwright/test';
import { MODERN_PALETTES } from '../modern/preferences.mjs';

const ROOM='test-modern-display-v565';
const frames='iframe[data-modern-today-v554],iframe[data-modern-todo-v552],iframe[data-modern-task-v551],iframe[data-modern-schedule-v553],iframe[data-modern-memo-v555]';
async function boot(page,{enabled=true,initial=null,source='local-only'}={}) {
  await page.addInitScript(({room,enabled,initial,source})=>{
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
    const config=source==='unsafe-remote-emulator'?Object.freeze({
      apiKey:'synthetic-key',projectId:'demo-synthetic',
      databaseURL:'https://synthetic-default-rtdb.firebaseio.com',
      appId:'1:000000000000:web:synthetic'
    }):null;
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return config;},set(){}});
    window.WORK_BOARD_TEST=enabled?{
      modernDisplayV565:true,modernReadV551:true,modernReadV552:true,
      modernReadV553:true,modernReadV554:true,modernReadV555:true,
      ...(source==='unsafe-remote-emulator'?{emulator:true,host:'127.0.0.1',port:9000}:{})
    }:{};
  },{room:ROOM,enabled,initial,source});
  await page.route('https://www.gstatic.com/firebasejs/**',route=>route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,route=>route.abort('blockedbyclient'));
  await page.goto('/?room='+ROOM+'&modernDisplayV565=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  if(enabled&&source==='local-only')await page.waitForFunction(()=>Boolean(window.WorkBoardDisplayPreviewV565),undefined,{timeout:30000});
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
  await page.locator('#displaySettingsToggleV326').click();
  for(const palette of MODERN_PALETTES){
    await page.locator('#displayPaletteV565').selectOption(palette);
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
  await page.locator('#displaySettingsToggleV326').click();
  await page.locator('#displayDesignV565').selectOption('classic');
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
  await page.locator('#displaySettingsToggleV326').click();
  await page.locator('#displayDesignV565').selectOption('classic');
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
  await page.locator('#displaySettingsToggleV326').click();
  await page.locator('#displayPaletteV565').selectOption('mist');
  await expect(page.frameLocator(frames).locator('html')).toHaveAttribute('data-palette','mist');
  const size=await page.locator('#displayToolbarV565').evaluate(el=>({
    width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right,
    viewport:el.ownerDocument.defaultView.innerWidth
  }));
  expect(size.right).toBeLessThanOrEqual(size.viewport);
  expect(size.width).toBeLessThanOrEqual(size.viewport);
  await page.locator('#displaySettingsToggleV326').click();
  await page.locator('#displayDesignV565').selectOption('classic');
  await expect(current(page)).toHaveCount(0);
});


test('Ver.566 original five direct test URLs still resolve to exactly one Classic-owned Modern frame',async({page})=>{
  await boot(page);
  const views=[
    ['551','data-modern-task-v551','task-list-read-v551.html'],
    ['552','data-modern-todo-v552','todo-list-read-v552.html'],
    ['553','data-modern-schedule-v553','schedule-list-read-v553.html'],
    ['554','data-modern-today-v554','today-read-v554.html'],
    ['555','data-modern-memo-v555','memo-list-read-v555.html']
  ];
  for(const [ver,attribute,file] of views){
    await page.goto('/?room='+ROOM+'&modernReadV'+ver+'=1',{waitUntil:'domcontentloaded'});
    await expect(current(page)).toHaveCount(1);
    await expect(current(page)).toHaveAttribute(attribute,'true');
    await expect(current(page)).toHaveAttribute('src',new RegExp(file.replace('.','\\.')));
    await expect(page.locator('#displayPreferencesV565')).toHaveCount(0);
  }
  expect(await prefs(page)).toBeNull();
});

test('Ver.566 refuses ambiguous, unknown, invalid and unflagged Modern test entry',async({page})=>{
  await boot(page);
  for(const query of [
    'modernReadV551=1&modernReadV552=1',
    'modernReadV551=1&modernReadV999=1',
    'modernReadV999=1',
    'modernReadV551=0',
    'modernReadV551=1&modernReadV551=1'
  ]){
    await page.goto('/?room='+ROOM+'&'+query,{waitUntil:'domcontentloaded'});
    await expect(current(page)).toHaveCount(0);
  }
});

test('Ver.566 valid direct URLs remain closed without the original explicit test flag',async({page})=>{
  await boot(page,{enabled:false});
  await page.goto('/?room='+ROOM+'&modernReadV551=1',{waitUntil:'domcontentloaded'});
  await expect(current(page)).toHaveCount(0);
});

test('Ver.566 shared preview does not duplicate iframe or accumulate read flags on repeated switch',async({page})=>{
  await boot(page);
  await page.locator('#displayDesignV565').selectOption('modern');
  await expect(current(page)).toHaveCount(1);
  await current(page).evaluate(element=>{element.dataset.routerIdentityV566='original';});
  await page.locator('[data-display-view-v565="today"]').click();
  await expect(current(page)).toHaveAttribute('data-router-identity-v566','original');
  for(const view of ['todos','tasks','schedules','today','memos','today']){
    await page.locator('[data-display-view-v565="'+view+'"]').click();
    await expect(current(page)).toHaveCount(1);
    const active=await page.evaluate(()=>
      [...new URLSearchParams(location.search).keys()].filter(key=>/^modernReadV\d+$/.test(key)));
    expect(active).toHaveLength(1);
  }
  await page.locator('#displaySettingsToggleV326').click();
  await page.locator('#displayDesignV565').selectOption('classic');
  await expect(current(page)).toHaveCount(0);
  const remaining=await page.evaluate(()=>
    [...new URLSearchParams(location.search).keys()].filter(key=>/^modernReadV\d+$/.test(key)));
  expect(remaining).toEqual([]);
});


test('Ver.567 rejects synthetic production URL even when a local test claims Emulator mode',async({page})=>{
  const forbiddenRequests=[];
  page.on('request',request=>{
    if(/synthetic-default-rtdb\.firebaseio\.com/.test(request.url()))forbiddenRequests.push(request.url());
  });
  await boot(page,{source:'unsafe-remote-emulator'});
  await expect(page.locator('#displayPreferencesV565')).toHaveCount(0);
  await expect(current(page)).toHaveCount(0);
  await page.goto('/?room='+ROOM+'&modernReadV551=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await expect(current(page)).toHaveCount(0);
  await page.goto('/?room='+ROOM+'&modernReadV555=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await expect(current(page)).toHaveCount(0);
  expect(forbiddenRequests).toEqual([]);
});

test('Ver.583 readable type and touch controls remain usable on all five Modern views',async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width:390,height:844});
  await boot(page);
  await page.locator('#displayDesignV565').selectOption('modern');
  for(const view of ['today','todos','tasks','schedules','memos']){
    await page.locator('[data-display-view-v565="'+view+'"]').click();
    const body=page.frameLocator(frames).locator('body');
    await expect(body).toBeVisible();
    const metrics=await body.evaluate(node=>{
      const doc=node.ownerDocument, win=doc.defaultView;
      const size=element=>Number.parseFloat(win.getComputedStyle(element).fontSize);
      const header=doc.querySelector('.heading h1');
      const action=doc.querySelector('.topbar .btn');
      return {
        base:size(doc.documentElement),body:size(doc.body),heading:header?size(header):0,
        button:action?size(action):0,
        buttonHeight:action?.getBoundingClientRect().height||0,
        overflow:doc.documentElement.scrollWidth-win.innerWidth
      };
    });
    expect(metrics.base,view+' base').toBe(16);
    expect(metrics.body,view+' body text').toBeGreaterThanOrEqual(17);
    expect(metrics.heading,view+' heading').toBeGreaterThanOrEqual(32);
    expect(metrics.button,view+' action text').toBeGreaterThanOrEqual(16);
    expect(metrics.buttonHeight,view+' touch height').toBeGreaterThanOrEqual(40);
    expect(metrics.overflow,view+' horizontal overflow').toBeLessThanOrEqual(2);
  }
  const toolbar=await page.locator('#displayToolbarV565').evaluate(el=>({
    font:Number.parseFloat(getComputedStyle(el).fontSize),
    right:el.getBoundingClientRect().right,
    viewport:innerWidth
  }));
  expect(toolbar.font).toBeGreaterThanOrEqual(14);
  expect(toolbar.right).toBeLessThanOrEqual(toolbar.viewport);
});

test('Ver.585 does not discard an unsaved Modern ToDo draft through either switch path',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await boot(page);
  await page.locator('#displayDesignV565').selectOption('modern');
  await page.locator('[data-display-view-v565="todos"]').click();
  const iframe=page.frameLocator('iframe[data-modern-todo-v552]');
  await expect(iframe.locator('body')).toBeVisible();
  await iframe.locator('body').evaluate(node=>{
    const form=node.ownerDocument.createElement('form');
    form.id='todoFormV558';form.dataset.unsaved='1';
    node.appendChild(form);
  });
  await page.locator('[data-display-view-v565="tasks"]').click();
  await expect(page.locator('iframe[data-modern-todo-v552]')).toHaveCount(1);
  await expect(page.locator('#displayToolbarNoticeV565')).toContainText('入力中のToDo');
  await page.locator('#displaySettingsToggleV326').click();
  await page.locator('#displayDesignV565').selectOption('classic');
  await expect(page.locator('iframe[data-modern-todo-v552]')).toHaveCount(1);
  await expect(page.locator('#displayDesignV565')).toHaveValue('modern');
  await iframe.locator('#todoFormV558').evaluate(node=>node.remove());
  await page.locator('[data-display-view-v565="tasks"]').click();
  await expect(page.locator('iframe[data-modern-task-v551]')).toHaveCount(1);
  await expect(page.locator('#displayToolbarNoticeV565')).toBeHidden();
});

test('Ver.588 Today list navigation reuses Modern router and preserves display preference',async({page})=>{
  await boot(page);
  await page.locator('#displayDesignV565').selectOption('modern');
  await expect(page.locator('iframe[data-modern-today-v554]')).toHaveCount(1);
  const before=await page.evaluate(room=>['tasks','todos','schedules'].map(name=>
    localStorage.getItem('system-task-'+name+':'+room)),ROOM);
  expect(await page.evaluate(()=>window.WorkBoardDisplayPreviewV565.navigateFromToday('memos'))).toBe(true);
  await expect(page.locator('iframe[data-modern-memo-v555]')).toHaveCount(1);
  await expect(page.locator('iframe[data-modern-today-v554]')).toHaveCount(0);
  await expect(page.locator('[data-display-view-v565="memos"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#displayDesignV565')).toHaveValue('modern');
  expect(await page.evaluate(()=>window.WorkBoardDisplayPreviewV565.navigateFromToday('tasks'))).toBe(false);
  const after=await page.evaluate(room=>['tasks','todos','schedules'].map(name=>
    localStorage.getItem('system-task-'+name+':'+room)),ROOM);
  expect(after).toEqual(before);
  await page.locator('[data-display-view-v565="today"]').click();
  expect(await page.evaluate(()=>window.WorkBoardDisplayPreviewV565.navigateFromToday('todos'))).toBe(true);
  await expect(page.locator('iframe[data-modern-todo-v552]')).toHaveCount(1);
  await expect(page.locator('#displayDesignV565')).toHaveValue('modern');
});

test('Ver.590 narrow mobile layout at 320px and 390px covers all Modern views',async({page})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:320,height:780});
  await boot(page);
  await page.locator('#displayDesignV565').selectOption('modern');
  for(const width of [320,390]){
    // A 320px CSS viewport checks the effective width of a 640px window
    // zoomed to 200%; native browser zoom still requires manual review.
    await page.setViewportSize({width,height:780});
    for(const view of ['today','todos','tasks','schedules','memos']){
      await page.locator('[data-display-view-v565="'+view+'"]').click();
      const body=page.frameLocator(frames).locator('body');
      await expect(body).toBeVisible();
      const metrics=await body.evaluate(node=>{
        const doc=node.ownerDocument,win=doc.defaultView;
        const h1=doc.querySelector('.heading h1');
        const button=doc.querySelector('.topbar .btn');
        const px=el=>el?Number.parseFloat(win.getComputedStyle(el).fontSize):0;
        return {viewport:win.innerWidth,overflow:doc.documentElement.scrollWidth-win.innerWidth,
          base:px(doc.documentElement),body:px(doc.body),heading:px(h1),
          buttonFont:px(button),buttonHeight:button?.getBoundingClientRect().height||0};
      });
      expect(metrics.viewport).toBe(width);
      expect(metrics.overflow,view+' at '+width+'px').toBeLessThanOrEqual(2);
      expect(metrics.base).toBe(16);
      expect(metrics.body).toBeGreaterThanOrEqual(17);
      expect(metrics.heading).toBeGreaterThanOrEqual(32);
      expect(metrics.buttonFont).toBeGreaterThanOrEqual(16);
      expect(metrics.buttonHeight).toBeGreaterThanOrEqual(40);
    }
    const nav=await page.locator('#displayToolbarV565').evaluate(el=>({
      right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width,viewport:innerWidth
    }));
    expect(nav.right).toBeLessThanOrEqual(nav.viewport+1);
    expect(nav.width).toBeLessThanOrEqual(nav.viewport);
  }
});

test('Ver.321 desktop uses readable body, labels and action text in all five Modern views',async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width:1366,height:900});
  await boot(page);
  await page.locator('#displayDesignV565').selectOption('modern');
  for(const view of ['today','todos','tasks','schedules','memos']){
    await page.locator('[data-display-view-v565="'+view+'"]').click();
    const body=page.frameLocator(frames).locator('body');
    await expect(body).toBeVisible();
    const sizes=await body.evaluate(node=>{
      const doc=node.ownerDocument,win=doc.defaultView;
      const px=el=>el?Number.parseFloat(win.getComputedStyle(el).fontSize):0;
      return {
        root:px(doc.documentElement),body:px(doc.body),
        heading:px(doc.querySelector('.heading h1')),
        button:px(doc.querySelector('.topbar .btn')),
        overflow:doc.documentElement.scrollWidth-win.innerWidth
      };
    });
    expect(sizes.root,view+' CSS root').toBe(16);
    expect(sizes.body,view+' body').toBeGreaterThanOrEqual(17);
    expect(sizes.heading,view+' heading').toBeGreaterThanOrEqual(36);
    expect(sizes.button,view+' action').toBeGreaterThanOrEqual(16);
    expect(sizes.overflow,view+' overflow').toBeLessThanOrEqual(2);
  }
});

test('Ver.322 toolbar never covers the final Modern content at 320px, 390px or 200% zoom-equivalent width',async({page})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:320,height:780});
  await boot(page);
  await page.locator('#displayDesignV565').selectOption('modern');
  for(const width of [320,390,640]){
    await page.setViewportSize({width,height:780});
    for(const view of ['today','todos','tasks','schedules','memos']){
      await page.locator('[data-display-view-v565="'+view+'"]').click();
      const body=page.frameLocator(frames).locator('body');
      await expect(body).toBeVisible();
      await expect.poll(()=>body.evaluate(node=>
        Number.parseFloat(node.ownerDocument.documentElement.style.getPropertyValue('--modern-toolbar-clearance'))||0
      )).toBeGreaterThan(0);
      const metrics=await body.evaluate(node=>{
        const doc=node.ownerDocument,win=doc.defaultView,main=doc.querySelector('main.content');
        win.scrollTo(0,doc.documentElement.scrollHeight);
        return {
          bottom:main.lastElementChild.getBoundingClientRect().bottom,
          padding:Number.parseFloat(win.getComputedStyle(main).paddingBottom),
          horizontalOverflow:doc.documentElement.scrollWidth-win.innerWidth
        };
      });
      const dock=await page.locator('#displayToolbarV565').boundingBox();
      expect(metrics.padding,view+' clearance at '+width+'px').toBeGreaterThanOrEqual(dock.height+16);
      expect(metrics.bottom,view+' last content at '+width+'px').toBeLessThanOrEqual(dock.y-8);
      expect(metrics.horizontalOverflow,view+' horizontal overflow at '+width+'px').toBeLessThanOrEqual(2);
    }
  }
});


test('Ver.326 formal Modern navigation uses a left icon dock on PC and a compact bottom nav on mobile',async({page})=>{
  await page.setViewportSize({width:1366,height:850});
  await boot(page);
  await page.locator('#displayDesignV565').selectOption('modern');
  const dock=page.locator('#displayToolbarV565');
  await expect(dock).toBeVisible();
  await expect(page.locator('[data-display-view-v565]')).toHaveCount(5);
  const pc=await dock.evaluate(node=>{
    const rect=node.getBoundingClientRect();
    return {left:rect.left,top:rect.top,width:rect.width,height:rect.height};
  });
  expect(pc.left).toBe(0);
  expect(pc.top).toBe(0);
  expect(pc.width).toBeGreaterThanOrEqual(80);
  expect(pc.height).toBeGreaterThan(600);
  const inside=page.frameLocator(frames).locator('html');
  await expect(inside).toHaveAttribute('data-modern-dock-v326','true');
  await page.locator('[data-display-view-v565="tasks"]').click();
  await expect(page.locator('iframe[data-modern-task-v551]')).toHaveCount(1);
  await expect(page.locator('[data-display-view-v565="tasks"]')).toHaveAttribute('aria-current','page');
  await page.setViewportSize({width:390,height:844});
  const mobile=await dock.evaluate(node=>{
    const r=node.getBoundingClientRect();
    return {left:r.left,bottom:r.bottom,width:r.width,height:r.height,viewport:innerHeight};
  });
  expect(mobile.left).toBe(0);
  expect(mobile.bottom).toBe(mobile.viewport);
  expect(mobile.width).toBe(390);
  expect(mobile.height).toBeLessThan(115);
  await page.locator('#displaySettingsToggleV326').click();
  await expect(page.locator('#displaySettingsPanelV326')).toBeVisible();
  await page.locator('#displayPaletteV565').selectOption('night');
  await expect(page.frameLocator(frames).locator('html')).toHaveAttribute('data-palette','night');
  await page.locator('#displayDesignV565').selectOption('classic');
  await expect(page.locator('#displayToolbarV565')).toBeHidden();
});
