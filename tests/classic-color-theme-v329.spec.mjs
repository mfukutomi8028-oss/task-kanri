import { test, expect } from '@playwright/test';

const ROOM = 'test-classic-theme-v329';
async function boot(page, width) {
  await page.setViewportSize({width,height:900});
  await page.route('**/*', route => {
    const url=new URL(route.request().url());
    return url.origin==='http://127.0.0.1:4173' ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(({room}) => {
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null;},set(){}});
    if (!sessionStorage.getItem('color-theme-fixture')) {
      localStorage.clear();
      localStorage.setItem('systemTaskUser','ThemeTester');
      localStorage.setItem('systemTaskRoomId',room);
      sessionStorage.setItem('color-theme-fixture','1');
    }
  },{room:ROOM});
  await page.goto('/?room='+ROOM,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await expect(page.locator('#wbColorThemeButton')).toHaveCount(1);
}
for(const width of [1366,390]){
  test('Classic palette switches and survives reload at '+width+'px', async ({page}) => {
    await boot(page,width);
    const original=await page.locator('.hero').evaluate(el=>getComputedStyle(el).backgroundImage);
    await page.locator('#wbColorThemeButton').evaluate(el=>el.click());
    const dialog=page.locator('#wbColorThemeDialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-theme="lavender"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme','lavender');
    const changed=await page.locator('.hero').evaluate(el=>getComputedStyle(el).backgroundImage);
    expect(changed).not.toBe(original);
    await dialog.locator('.wb-color-theme-close').click();
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
    await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme','lavender');
    await page.locator('#wbColorThemeButton').evaluate(el=>el.click());
    await page.locator('#wbColorThemeDialog [data-theme="default"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme','default');
    const restored=await page.locator('.hero').evaluate(el=>getComputedStyle(el).backgroundImage);
    expect(restored).toBe(original);
    await expect(page.locator('.nav-item[data-layout="today"]')).toHaveCount(1);
  });
}

test('Ver.345: all six pastels keep the hero/sidebar bright and the pin text legible',async({page})=>{
  test.setTimeout(120000);
  await boot(page,1440);
  await page.evaluate(()=>localStorage.setItem('work-board-desktop-sidebar-pinned-v158','1'));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await expect(page.locator('body')).toHaveClass(/desktop-sidebar-pinned/);
  const palettes=['pastel-blue','pastel-lilac','pastel-mint','pastel-rose','pastel-peach','pastel-lemon'];
  const read=()=>page.evaluate(()=>{
    const node=selector=>document.querySelector(selector);
    const style=selector=>getComputedStyle(node(selector));
    const parseColor=input=>{
      const s=String(input||'');
      const open=s.indexOf('('), close=s.indexOf(')',open+1);
      if(open<0 || close<open)throw new Error('Unknown computed color '+s);
      const values=s.slice(open+1,close).replaceAll(',', ' ').replaceAll('/', ' ')
        .split(' ').filter(Boolean);
      if(s.startsWith('rgb(')||s.startsWith('rgba('))return values.slice(0,3).map(Number);
      if(s.startsWith('color(srgb '))return values.slice(1,4).map(v=>Number(v)*255);
      throw new Error('Unknown computed color '+s);
    };
    const lightness=(value)=>{
      const v=parseColor(value).map(n=>{
        const x=n/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
      });
      return .2126*v[0]+.7152*v[1]+.0722*v[2];
    };
    const contrast=(a,b)=>{const x=lightness(a),y=lightness(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
    const button=style('.desktop-sidebar-pin-v158');
    const label=style('.desktop-sidebar-pin-label-v158');
    const hero=style('.hero');
    const room=style('.hero-room-badge');
    const sidebar=style('.sidebar');
    const themeInk=style('.sidebar .brand h1').color;
    const backdrop=button.backgroundColor;
    return {
      theme:document.documentElement.dataset.wbColorTheme,
      hero:hero.backgroundImage,
      sidebar:sidebar.backgroundImage,
      shadow:sidebar.boxShadow,
      roomShadow:room.boxShadow,
      roomColor:room.backgroundColor,
      pinColor:button.color,
      labelColor:label.color,
      themeInk,
      labelOpacity:label.opacity,
      pinBackground:backdrop,
      pinContrast:contrast(button.color,backdrop),
      pinTextContrast:contrast(label.color,backdrop)
    };
  });
  for(const palette of palettes){
    await page.locator('#wbColorThemeButton').evaluate(el=>el.click());
    const dlg=page.locator('#wbColorThemeDialog');
    await expect(dlg).toBeVisible();
    await dlg.locator('[data-theme="'+palette+'"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme',palette);
    const sample=await read();
    expect(sample.hero,palette+' gradient').toContain('linear-gradient');
    expect(sample.sidebar,palette+' sidebar gradient').toContain('linear-gradient');
    expect(sample.hero,palette+' white origin').toContain('rgb(255, 255, 255)');
    expect(sample.sidebar,palette+' white origin').toContain('rgb(255, 255, 255)');
    expect(sample.labelColor,palette+' pin label color').toBe(sample.themeInk);
    expect(sample.pinColor,palette+' pin button color').toBe(sample.themeInk);
    expect(sample.pinTextContrast,palette+' WCAG AA normal text').toBeGreaterThanOrEqual(4.5);
    expect(sample.pinContrast,palette+' WCAG AA button').toBeGreaterThanOrEqual(4.5);
    expect(Number(sample.labelOpacity),palette+' faded pin label').toBe(1);
    expect(sample.roomShadow,palette+' legacy black room badge shadow').not.toContain('rgba(7, 31, 45');
    expect(sample.roomShadow,palette+' legacy black room badge shadow').not.toContain('rgba(0, 0, 0');
    expect(sample.shadow,palette+' legacy navy sidebar shadow').not.toContain('rgba(8, 48, 75');
    if(palette==='pastel-rose'){
      await dlg.locator('.wb-color-theme-close').click();
      await expect(page.locator('.hero')).toBeVisible();
      await page.screenshot({animations:'disabled'});
    }else{
      await dlg.locator('.wb-color-theme-close').click();
    }
  }
});

test('Ver.347 real detail components change neutral colors across light themes',async({page})=>{
 test.setTimeout(90000);
 await boot(page,1366);
 const colors=[];
 for(const name of ['pastel-rose','pastel-mint','lavender']){
  await page.locator('#wbColorThemeButton').evaluate(el=>el.click());
  const picker=page.locator('#wbColorThemeDialog');
  await expect(picker).toBeVisible();
  await picker.locator('[data-theme="'+name+'"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme',name);
  const c=await page.evaluate(()=>{
   const detail=document.querySelector('#detailBody');
   if(!detail)throw new Error('No detail body');
   detail.querySelector('#v347-audit')?.remove();
   const host=document.createElement('div');host.id='v347-audit';
   host.innerHTML='<div class="field-card">card</div><label class="check-item">check</label><div class="task-detail-tabs-v149"><button class="task-detail-tab-v149"><span>3</span></button></div><div class="task-comment-compose-v149">comment</div>';
   detail.appendChild(host);
   const bg=selector=>getComputedStyle(host.querySelector(selector)).backgroundColor;
   return {card:bg('.field-card'),check:bg('.check-item'),tabs:bg('.task-detail-tabs-v149'),
    comment:bg('.task-comment-compose-v149'),count:bg('.task-detail-tab-v149 span')};
  });
  for(const [part,color] of Object.entries(c)){
   expect(color,name+' '+part+' must not use Classic blue').not.toBe('rgb(246, 251, 255)');
   expect(color,name+' '+part+' must not use Classic blue').not.toBe('rgb(232, 244, 251)');
  }
  colors.push(c.card);
  await picker.locator('.wb-color-theme-close').click();
 }
 expect(new Set(colors).size).toBe(3);
});


test('Ver.351: notices, board operations and ToDo reopen follow the selected light palette',async({page})=>{
  test.setTimeout(90000);
  await boot(page,1366);
  await page.evaluate(()=>{
    const host=document.createElement('div');
    host.id='palette-v351-fixture';
    host.style.cssText='position:absolute;left:-20000px;top:-20000px;width:1100px';
    host.innerHTML=
      '<section class="today-panel activity-panel"><header class="activity-head"><h4 class="activity-title-text">全体のお知らせ</h4><p>更新履歴</p></header>' +
        '<div class="activity-list"><button class="activity-item"><div class="activity-topline-v531"><span class="activity-kind">状態変更</span><time>11/04</time></div><strong>業務</strong><span class="activity-change">状態の更新</span><small class="activity-meta">担当者</small></button>' +
        '<button class="activity-item schedule"><span class="activity-kind">新規予定</span></button></div><div class="activity-more-row"><p>重要度が低い更新</p></div></section>' +
      '<div class="task-control-row"><button class="task-view-button">ボード</button><button class="stat-view-button">ダッシュボード</button></div>' +
      '<div class="board-view"><section class="board-column"><div class="column-head"><span class="column-drag-handle">☰</span>未着手</div><div class="board-drop-zone">ここへ移動</div></section>' +
        '<section class="board-column add-status-column"><button>＋ セクション追加</button></section></div>' +
      '<button class="todo-state-toggle-v144 is-completed">未完了に戻す</button>' +
      '<span class="todo-preview-state-hint-v144 is-completed">未完了に戻す</span>';
    document.body.appendChild(host);
  });
  const selected=['sky','pastel-rose','pastel-mint','pure-red','pure-green','pure-purple'];
  const samples=[];
  for(const theme of selected){
    const sample=await page.evaluate(theme=>{
      const root=document.documentElement;
      root.dataset.wbColorTheme=theme;
      root.dataset.wbColorMode='light';
      const pick=(selector,property)=>{
        const el=document.querySelector('#palette-v351-fixture '+selector);
        if(!el)throw new Error('Missing palette fixture '+selector);
        return getComputedStyle(el).getPropertyValue(property).trim();
      };
      return {
        announcementBorder:pick('.activity-panel .activity-item','border-top-color'),
        announcementText:pick('.activity-panel .activity-item > strong','color'),
        announcementTime:pick('.activity-panel .activity-item time','color'),
        notificationChip:pick('.activity-panel .activity-item:not(.schedule) .activity-kind','background-color'),
        scheduleChip:pick('.activity-panel .activity-item.schedule .activity-kind','background-color'),
        handleFill:pick('.column-drag-handle','background-color'),
        handleInk:pick('.column-drag-handle','color'),
        dashboardInk:pick('.stat-view-button:not(.active)','color'),
        sectionAddInk:pick('.add-status-column button','color'),
        sectionAddLine:pick('.add-status-column button','border-top-color'),
        todoReopenFill:pick('.todo-state-toggle-v144.is-completed','background-color'),
        todayReopenFill:pick('.todo-preview-state-hint-v144.is-completed','background-color')
      };
    },theme);
    expect(sample.announcementBorder,theme+' old announcement outline').not.toBe('rgb(216, 230, 239)');
    expect(sample.handleFill,theme+' old blue drag handle').not.toBe('rgb(238, 247, 255)');
    expect(sample.dashboardInk,theme+' old dashboard text').not.toBe('rgb(44, 85, 115)');
    expect(sample.sectionAddInk,theme+' old add section text').not.toBe('rgb(35, 88, 124)');
    expect(sample.todoReopenFill,theme+' old blue undo action').not.toBe('rgb(241, 246, 250)');
    expect(sample.todayReopenFill,theme+' same undo action in Today').toBe(sample.todoReopenFill);
    expect(sample.scheduleChip,theme+' scheduled-notice type is meaningful').toBe('rgb(255, 243, 223)');
    samples.push(sample);
  }
  for(const key of ['announcementBorder','announcementTime','notificationChip','handleFill','handleInk',
    'dashboardInk','sectionAddInk','sectionAddLine','todoReopenFill']){
    expect(new Set(samples.map(sample=>sample[key])).size,key+' must follow selected palette').toBeGreaterThanOrEqual(4);
  }
  await page.evaluate(()=>{
    const column=document.querySelector('#palette-v351-fixture .board-column');
    column.classList.add('task-drop-over');
    column.setAttribute('data-task-drop-status','未着手');
    document.body.classList.add('task-dragging');
    document.documentElement.dataset.wbColorTheme='pastel-rose';
  });
  const drag=await page.evaluate(()=>{
    const card=document.querySelector('#palette-v351-fixture .board-column.task-drop-over');
    const zone=card.querySelector('.board-drop-zone');
    return {
      outline:getComputedStyle(card).outlineColor,
      zoneBorder:getComputedStyle(zone).borderTopColor,
      overlayBorder:getComputedStyle(card,'::before').borderTopColor
    };
  });
  expect(drag.zoneBorder).not.toBe('rgba(64, 145, 223, 0.72)');
  expect(drag.overlayBorder).not.toBe('rgba(64, 145, 223, 0.55)');
  await page.evaluate(()=>document.body.classList.remove('task-dragging'));
});

test('Ver.350: all 26 selectable nondefault palettes theme the four reported work surfaces',async({page})=>{
  test.setTimeout(120000);
  await boot(page,1366);
  await page.evaluate(()=>{
    const detail=document.querySelector('#detailBody');
    if(!detail)throw new Error('Task detail container unavailable');
    const d=document.createElement('div');
    d.id='palette-v348-detail-fixture';
    d.innerHTML='<div class="field-card">担当者</div>' +
      '<div class="check-item done">完了チェック</div>' +
      '<div class="detail-status-control-v146"><select class="detail-status-select-v146"><option>対応中</option></select></div>' +
      '<div class="task-detail-tabs-v149"><button class="task-detail-tab-v149"><span>7</span></button></div>' +
      '<div class="task-comment-compose-v149">コメント</div>';
    detail.appendChild(d);
    const host=document.createElement('div');
    host.id='palette-v348-work-fixture';
    host.style.cssText='position:absolute;left:-20000px;top:-20000px;width:900px';
    host.innerHTML=
      '<div class="todo-workspace"><div class="todo-search-box-v145">検索</div>' +
      '<div class="todo-create-form"><input value="テスト" /></div>' +
      '<div class="todo-list"><div class="todo-item">タスク</div></div></div>' +
      '<div class="schedule-calendar"><div class="calendar-head">月表示</div>' +
      '<div class="calendar-weekdays"><span class="sunday">日</span><span class="saturday">土</span></div>' +
      '<div class="calendar-cell today"><div class="calendar-date">4</div></div>' +
      '<div class="calendar-cell"><div class="calendar-schedule">15:00</div></div></div>' +
      '<div class="task-card priority-card priority-高">優先度付き通常背景</div>' +
      '<div class="activity-dialog-summary">通知の集計</div>' +
      '<div class="work-memo-body-v167">メモ</div>';
    document.body.appendChild(host);
  });
  const themes=['sky','lavender','mint','rose','peach','amber','slate',
    'pure-blue','pure-red','pure-green','pure-yellow','pure-orange','pure-purple','pure-cyan','pure-pink',
    'pastel-blue','pastel-lilac','pastel-mint','pastel-rose','pastel-peach','pastel-lemon',
    'night-navy','night-charcoal','night-forest','night-plum','night-mocha'];
  const observations=[];
  for(const theme of themes){
    const mode=theme.startsWith('night-')?'dark':'light';
    const c=await page.evaluate(({theme,mode})=>{
      const root=document.documentElement;
      root.dataset.wbColorTheme=theme;
      root.dataset.wbColorMode=mode;
      const pick=selector=>{
        const el=document.querySelector(selector);
        if(!el)throw new Error('Missing audit component '+selector);
        return getComputedStyle(el).backgroundColor;
      };
      const rootStyle=getComputedStyle(root);
      return {
        role:rootStyle.getPropertyValue('--wb-ui-panel').trim(),
        checklist:pick('#palette-v348-detail-fixture .check-item.done'),
        detailStatus:pick('#palette-v348-detail-fixture .detail-status-control-v146'),
        comment:pick('#palette-v348-detail-fixture .task-comment-compose-v149'),
        todoSearch:pick('#palette-v348-work-fixture .todo-search-box-v145'),
        todoCreate:pick('#palette-v348-work-fixture .todo-create-form'),
        calendarHead:pick('#palette-v348-work-fixture .calendar-head'),
        calendarWeekdays:pick('#palette-v348-work-fixture .calendar-weekdays'),
        event:pick('#palette-v348-work-fixture .calendar-schedule'),
        priorityPaper:pick('#palette-v348-work-fixture .task-card.priority-card'),
        today:pick('#palette-v348-work-fixture .calendar-cell.today'),
        saturday:getComputedStyle(document.querySelector('#palette-v348-work-fixture .calendar-weekdays .saturday')).color,
        sunday:getComputedStyle(document.querySelector('#palette-v348-work-fixture .calendar-weekdays .sunday')).color,
        notice:pick('#palette-v348-work-fixture .activity-dialog-summary'),
        memo:pick('#palette-v348-work-fixture .work-memo-body-v167')
      };
    },{theme,mode});
    expect(c.role,theme+' role missing').not.toBe('');
    for(const component of ['checklist','detailStatus','comment','todoSearch','todoCreate',
      'calendarHead','calendarWeekdays','event','priorityPaper','notice','memo']){
      expect(c[component],theme+' leftover Classic sky-blue in '+component)
        .not.toBe('rgb(246, 251, 255)');
      expect(c[component],theme+' leftover Classic sky-blue in '+component)
        .not.toBe('rgb(242, 248, 252)');
    }
    if(mode==='light') {
      expect(c.today,theme+' today cell should keep warning yellow').toBe('rgb(255, 251, 232)');
      expect(c.saturday,theme+' Saturday remains blue').toBe('rgb(43, 120, 194)');
      expect(c.sunday,theme+' Sunday remains red').toBe('rgb(211, 68, 90)');
    }
    const channels=c.checklist.match(/rgba?\(([^)]*)\)/)?.[1]?.split(/[ ,/]+/).filter(Boolean).slice(0,3).map(Number);
    if(mode==='dark'&&channels)expect(Math.max(...channels),theme+' dark detail should stay dark').toBeLessThan(155);
    observations.push({theme,mode,c});
  }
  const byMode=observations.filter(x=>x.mode==='light');
  expect(new Set(byMode.map(x=>x.c.calendarWeekdays)).size).toBeGreaterThanOrEqual(9);
  expect(new Set(byMode.map(x=>x.c.todoSearch)).size).toBeGreaterThanOrEqual(9);
  const dark=observations.filter(x=>x.mode==='dark');
  expect(new Set(dark.map(x=>x.c.checklist)).size).toBe(5);
});
