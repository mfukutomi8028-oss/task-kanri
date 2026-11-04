import { test, expect } from '@playwright/test';

const THEMES = ['night-navy','night-charcoal','night-forest','night-plum','night-mocha'];

async function boot(page, name, width=1366) {
  await page.setViewportSize({width,height:900});
  const now=Date.now();
  const room='test-v338-'+name+'-'+width;
  const todos=[
    {id:'v338-todo-1',owner:'福冨',text:'確認を完了する',memo:'補足メモ',
     completed:false,order:2048,createdAt:now,updatedAt:now,revision:1},
    {id:'v338-todo-2',owner:'福冨',text:'資料を確認する',memo:'',
     completed:false,order:1024,createdAt:now-1000,updatedAt:now-1000,revision:1}
  ];
  const memos={
    memoA:{id:'memoA',title:'業務メモA',body:'実際のドラッグ対象',
      category:'定型情報',revision:1,updatedAt:now,pinned:false},
    memoB:{id:'memoB',title:'業務メモB',body:'保存方式は変更しない',
      category:'定型情報',revision:1,updatedAt:now-1000,pinned:false}
  };
  const tasks=[{id:'v338-task-1',title:'共有更新の見出し',status:'対応中',
    assignee:'福冨',priority:'中',category:'その他',createdBy:'森井',
    createdAt:now-2000,updatedAt:now-2000,revision:1,description:'通知の配色確認'}];
  await page.addInitScript(({room,todos,memos,tasks})=>{
    localStorage.clear();
    localStorage.setItem('systemTaskUser','福冨');
    localStorage.setItem('systemTaskRoomId',room);
    localStorage.setItem('system-task-users:'+room,JSON.stringify(['福冨','森井']));
    localStorage.setItem('system-task-todos:'+room,JSON.stringify(todos));
    localStorage.setItem('system-business-memos:'+room,JSON.stringify(memos));
    localStorage.setItem('system-task-tasks:'+room,JSON.stringify(tasks));
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null;},set(){}});
  },{room,todos,memos,tasks});
  await page.route('https://www.gstatic.com/firebasejs/**',route=>route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,route=>route.abort('blockedbyclient'));
  await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await expect(page.locator('#wbColorThemeButton')).toHaveCount(1);
  await expect(page.locator('#todayView .todo-preview-state-hint-v144').first()).toBeAttached({timeout:15000});
}
async function choose(page,id){
  await page.locator('#wbColorThemeButton').evaluate(el=>el.click());
  await expect(page.locator('#wbColorThemeDialog')).toBeVisible();
  await page.locator('#wbColorThemeDialog [data-theme="'+id+'"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme',id);
  await expect(page.locator('html')).toHaveAttribute('data-wb-color-mode','dark');
  await page.locator('.wb-color-theme-close').click();
}

for(const width of [1366,390]){
  test('Ver.338: dark notice and ToDo action surfaces match in all five palettes at '+width+'px',
    async({page},testInfo)=>{
      test.setTimeout(120000);
      await boot(page,'cohesion',width);
      await page.locator('#todayView [data-layout-jump="todos"]').first().evaluate(el=>el.click());
      await expect(page.locator('#todoView .todo-state-toggle-v144').first()).toBeAttached({timeout:15000});
      for(const theme of THEMES){
        await choose(page,theme);
        const s=await page.evaluate(()=>{
          const node=x=>document.querySelector(x);
          const css=x=>{
            const el=node(x);if(!el)return null;
            const a=getComputedStyle(el);
            return {bg:a.backgroundColor,image:a.backgroundImage,
              border:a.borderColor,color:a.color,shadow:a.boxShadow,
              radius:a.borderRadius,minHeight:a.minHeight,fontSize:a.fontSize};
          };
          const html=getComputedStyle(document.documentElement);
          const panel=node('#todayView .activity-panel');
          const head=node('#todayView .activity-panel .activity-head');
          const chips=['#todayView .activity-count',
            '#todayView .activity-panel .activity-kind',
            '#todayView .today-todo-preview .todo-section-chip',
            '#todayView .todo-preview-badge',
            '#todoView .todo-count',
            '#todoView .todo-memo-indicator.has-memo'];
          return {
            panel:css('#todayView .activity-panel'),
            head:css('#todayView .activity-panel .activity-head'),
            title:css('#todayView .activity-panel .activity-title'),
            icon:css('#todayView .activity-panel .activity-title-bell'),
            headBefore:getComputedStyle(head,'::before').display,
            beforeContent:getComputedStyle(head,'::before').content,
            preview:css('#todayView .todo-preview-state-hint-v144'),
            todo:css('#todoView .todo-state-toggle-v144'),
            chips:Object.fromEntries(chips.map(k=>[k,css(k)])),
            sample:css('#todoView .todo-summary-button'),
            theme:{
              surface:html.getPropertyValue('--wb-dark-surface').trim(),
              chip:html.getPropertyValue('--wb-dark-chip-fill').trim(),
              muted:html.getPropertyValue('--wb-dark-muted').trim()
            },
            panelColor:getComputedStyle(panel).backgroundColor
          };
        });
        expect(s.panel,theme+' notice').not.toBeNull();
        expect(s.head.bg,theme+' top background island').toBe('rgba(0, 0, 0, 0)');
        expect(s.head.image,theme+' stale gradient').toBe('none');
        expect(s.title.bg,theme+' title background island').toBe('rgba(0, 0, 0, 0)');
        expect(s.icon.bg,theme+' icon background').toBe('rgba(0, 0, 0, 0)');
        expect(s.headBefore).toBe('none');
        for(const key of ['bg','border','color','radius','minHeight','fontSize']){
          expect(s.preview[key],theme+' Today vs ToDo '+key).toBe(s.todo[key]);
        }
        expect(s.preview.bg,theme+' bright green ToDo button').not.toBe('rgb(237, 249, 241)');
        for(const [name,chip] of Object.entries(s.chips)){
          if(!chip) continue; // only some items are produced from sample data
          expect(chip.bg,theme+' too bright chip '+name).not.toBe('rgb(255, 240, 243)');
          expect(chip.bg,theme+' white chip '+name).not.toBe('rgb(255, 255, 255)');
        }
        if(theme==='night-charcoal'&&width===1366){
          await page.locator('.nav-item[data-layout="today"]').first().evaluate(el=>el.click());
          await testInfo.attach('v338-today-neutral-dark.png',{
            body:await page.screenshot({animations:'disabled'}),contentType:'image/png'
          });
          await page.locator('#todayView [data-layout-jump="todos"]').first().evaluate(el=>el.click());
          await testInfo.attach('v338-todo-neutral-dark.png',{
            body:await page.screenshot({animations:'disabled'}),contentType:'image/png'
          });
        }
      }
    });
}

test('Ver.338: ToDo, memo and Today panel use their whole item as drag image',async({page})=>{
  test.setTimeout(120000);
  await boot(page,'drag',1366);
  await page.waitForFunction(()=>typeof window.WORK_BOARD_SET_SORT_DRAG_PREVIEW_V338==='function');
  async function probe(selector,expectedSelector){
    return await page.evaluate(({selector,expectedSelector})=>{
      const handle=document.querySelector(selector);
      const target=handle?.closest(expectedSelector);
      if(!handle||!target)return {missing:true,selector,expectedSelector};
      const rect=target.getBoundingClientRect();
      const snapshot=DataTransfer.prototype.setDragImage;
      let result=null;
      try{
        DataTransfer.prototype.setDragImage=function(element,x,y){
          result={whole:element===target,hasContent:(element.textContent||'').trim().length>4,
            x,y,width:rect.width,height:rect.height};
        };
        const transfer=new DataTransfer();
        handle.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,
          dataTransfer:transfer,clientX:rect.left+Math.min(35,rect.width/2),
          clientY:rect.top+Math.min(15,rect.height/2)}));
        handle.dispatchEvent(new DragEvent('dragend',{bubbles:true}));
      }finally{
        DataTransfer.prototype.setDragImage=snapshot;
      }
      return result;
    },{selector,expectedSelector});
  }
  const today=await probe('#todayView .today-panel-drag-v531','[data-today-panel-id]');
  expect(today?.whole,'Today panel snapshot').toBe(true);
  expect(today.hasContent).toBe(true);

  await page.locator('#todayView [data-layout-jump="todos"]').first().evaluate(el=>el.click());
  await expect(page.locator('#todoView .todo-list:not(.is-completed) .todo-drag-handle-v531').first()).toBeAttached();
  const todo=await probe('#todoView .todo-list:not(.is-completed) .todo-drag-handle-v531','[data-todo-id]');
  expect(todo?.whole,'ToDo row snapshot').toBe(true);
  expect(todo.hasContent).toBe(true);
  expect(todo.x).toBeGreaterThanOrEqual(0);
  expect(todo.x).toBeLessThan(todo.width);

  await page.waitForFunction(()=>
    window.WorkBoardReadV550?.read?.()?.ready===true &&
    window.WorkBoardBusinessMemoReadV555?.read?.()?.ready===true,
    undefined,{timeout:30000});
  await page.locator('[data-work-memo-layout]').first().evaluate(el=>el.click());
  await expect(page.locator('#workMemoViewV167 .work-memo-card-v167').first()).toBeVisible();
  const memo=await probe('#workMemoViewV167 .work-memo-drag-v531','[data-memo-sort-id]');
  expect(memo?.whole,'memo card snapshot').toBe(true);
  expect(memo.hasContent).toBe(true);
});
