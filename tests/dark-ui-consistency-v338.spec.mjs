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

for (const width of [1366,390]) {
  test('Ver.338: dark notice and ToDo action surfaces match in all five palettes at '+width+'px',
    async ({page},testInfo) => {
      test.setTimeout(120000);
      await boot(page,'cohesion',width);
      for (const theme of THEMES) {
        await choose(page,theme);
        // The app unmounts inactive view content, so inspect Today *before*
        // entering ToDo. Never sample the previous view after navigation.
        await expect(page.locator('#todayView .activity-panel .activity-head')).toBeVisible();
        await expect(page.locator('#todayView .todo-preview-state-hint-v144').first()).toBeVisible();
        const today=await page.evaluate(() => {
          const css=selector => {
            const el=document.querySelector(selector);
            if(!el)return null;
            const s=getComputedStyle(el);
            return {bg:s.backgroundColor,image:s.backgroundImage,border:s.borderColor,
              color:s.color,shadow:s.boxShadow,radius:s.borderRadius,
              minHeight:s.minHeight,fontSize:s.fontSize};
          };
          const head=document.querySelector('#todayView .activity-panel .activity-head');
          return {
            panel:css('#todayView .activity-panel'),
            head:css('#todayView .activity-panel .activity-head'),
            title:css('#todayView .activity-panel .activity-title'),
            icon:css('#todayView .activity-panel .activity-title-bell'),
            connection:css('#connectionPill'),
            beforeDisplay:head?getComputedStyle(head,'::before').display:null,
            preview:css('#todayView .todo-preview-state-hint-v144'),
            chips:Object.fromEntries([
              '#todayView .activity-count','#todayView .activity-panel .activity-kind',
              '#todayView .today-todo-preview .todo-section-chip','#todayView .todo-preview-badge'
            ].map(key=>[key,css(key)]))
          };
        });
        expect(today.panel,theme+' announcement section').not.toBeNull();
        expect(today.head.bg,theme+' header background island').toBe('rgba(0, 0, 0, 0)');
        expect(today.head.image,theme+' old header gradient').toBe('none');
        expect(today.title.bg,theme+' title background island').toBe('rgba(0, 0, 0, 0)');
        expect(today.icon.bg,theme+' icon background island').toBe('rgba(0, 0, 0, 0)');
        expect(today.beforeDisplay,theme+' obsolete pseudoelement').toBe('none');
        expect(today.connection,theme+' connection status').not.toBeNull();
        expect(today.connection.bg,theme+' saturated connection status').not.toBe('rgba(255, 255, 255, 0.12)');
        for(const [name,chip] of Object.entries(today.chips)){
          if (!chip) continue;
          expect(chip.bg,theme+' bright alert '+name).not.toBe('rgb(255, 240, 243)');
          expect(chip.bg,theme+' white chip '+name).not.toBe('rgb(255, 255, 255)');
        }
        if (theme==='night-charcoal'&&width===1366) {
          await testInfo.attach('v338-today-neutral-dark.png',{
            body:await page.screenshot({animations:'disabled'}),contentType:'image/png'
          });
        }
        await page.locator('#todayView [data-layout-jump="todos"]').first().evaluate(el=>el.click());
        await expect(page.locator('#todoView .todo-state-toggle-v144').first()).toBeVisible();
        const todo=await page.evaluate(() => {
          const el=document.querySelector('#todoView .todo-state-toggle-v144');
          const s=getComputedStyle(el);
          return {bg:s.backgroundColor,image:s.backgroundImage,border:s.borderColor,
            color:s.color,shadow:s.boxShadow,radius:s.borderRadius,
            minHeight:s.minHeight,fontSize:s.fontSize};
        });
        for(const key of ['bg','border','color','radius','minHeight','fontSize']){
          expect(today.preview[key],theme+' Today vs ToDo '+key).toBe(todo[key]);
        }
        expect(today.preview.bg,theme+' bright green button').not.toBe('rgb(237, 249, 241)');
        if(theme==='night-charcoal'&&width===1366){
          await testInfo.attach('v338-todo-neutral-dark.png',{
            body:await page.screenshot({animations:'disabled'}),contentType:'image/png'
          });
        }
        await page.locator('.nav-item[data-layout="today"]').first().evaluate(el=>el.click());
        await expect(page.locator('#todayView .activity-panel .activity-head')).toBeVisible();
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

  // The local-only fixture has no V550/V555 remote read owners. Navigation
  // and a visible card are the actual prerequisites for this snapshot check.
  await page.locator('[data-work-memo-layout]').first().evaluate(el=>el.click());
  await expect(page.locator('#workMemoViewV167 .work-memo-card-v167').first())
    .toBeVisible({timeout:30000});
  const memo=await probe('#workMemoViewV167 .work-memo-drag-v531','[data-memo-sort-id]');
  expect(memo?.whole,'memo card snapshot').toBe(true);
  expect(memo.hasContent).toBe(true);
});

/* Ver.341: inspect actual task-card badges and detail subcontrols with computed
   browser styles. Regression tests must inspect children, not just dark parents. */
for (const width of [1366, 390]) {
  test('Ver.341: subdued readable chips, stars and detail counts in all dark palettes at '+width+'px',
    async ({page}) => {
      test.setTimeout(120000);
      await boot(page, 'semantic-v341', width);
      for (const theme of THEMES) {
        await choose(page, theme);
        const samples = await page.evaluate(() => {
          const cardMeta = document.querySelector('#todayView .task-card .task-meta');
          const detail = document.querySelector('#detailBody');
          if (!cardMeta || !detail) return {missing: 'Today task card or canonical detail panel'};
          const chips = document.createElement('div');
          chips.innerHTML = [
            'category-badge status-未着手', 'priority-緊急', 'priority-高',
            'priority-中', 'priority-低', 'status-対応中', 'status-確認待ち',
            'status-保留', 'status-完了', 'due-today-badge',
            'stale-badge', 'recurrence-badge'
          ].map((classes, i) => '<span class="badge '+classes+'" data-v341-chip="'+i+'">テスト</span>').join('');
          chips.id = 'dark-semantic-chip-fixture-v341';
          cardMeta.append(chips);
          const detailFixture = document.createElement('div');
          detailFixture.innerHTML = `
            <div class="detail-status-control-v146">
              <div class="detail-status-label-v146"><strong>状態を変更</strong><span>編集せずに更新</span></div>
              <select class="detail-status-select-v146"><option>対応中</option></select>
            </div>
            <div class="task-detail-tabs-v149">
              <button class="task-detail-tab-v149">コメント <span>7</span></button>
              <button class="task-detail-tab-v149 active">履歴 <span>28</span></button>
            </div>`;
          detail.append(detailFixture);
          const star = document.createElement('button');
          star.className = 'favorite-button starred';
          star.textContent = '★';
          cardMeta.append(star);
          const read = el => {
            const cs = getComputedStyle(el);
            return {color: cs.color, background: cs.backgroundColor, image: cs.backgroundImage,
              border: cs.borderColor};
          };
          const chipsResult = [...chips.querySelectorAll('.badge')].map(read);
          const counts = [...detailFixture.querySelectorAll('.task-detail-tab-v149 > span')].map(read);
          const control = read(detailFixture.querySelector('.detail-status-control-v146'));
          const title = read(detailFixture.querySelector('.detail-status-label-v146 strong'));
          const select = read(detailFixture.querySelector('select'));
          const starValue = read(star);
          chips.remove(); detailFixture.remove(); star.remove();
          return {chips: chipsResult, counts, control, title, select, star: starValue};
        });
        expect(samples.missing,theme+' required real UI anchors').toBeUndefined();
        const rgb = css => {
          const match = css.match(/rgba?\(([^)]+)\)/);
          if (!match) throw new Error('Expected resolved RGB, got '+css);
          return match[1].split(/[ ,/]+/).slice(0,3).map(Number);
        };
        const luminance = css => {
          const channels = rgb(css).map(v => {
            const x = v / 255;
            return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4;
          });
          return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
        };
        const contrast = (a,b) => {
          const light = Math.max(luminance(a),luminance(b));
          const dark = Math.min(luminance(a),luminance(b));
          return (light+.05)/(dark+.05);
        };
        for (const [label,item] of [
          ...samples.chips.map((sample,index)=>['badge '+index,sample]),
          ...samples.counts.map((sample,index)=>['count '+index,sample]),
          ['quick status select',samples.select], ['favourite',samples.star]
        ]) {
          expect(Math.max(...rgb(item.background)),theme+' bright '+label).toBeLessThan(150);
          expect(item.image,theme+' gradient '+label).toBe('none');
          expect(contrast(item.color,item.background),theme+' low contrast '+label).toBeGreaterThanOrEqual(4.5);
        }
        expect(Math.max(...rgb(samples.control.background)),theme+' bright status editor').toBeLessThan(150);
        expect(samples.control.image,theme+' white status gradient').toBe('none');
        expect(contrast(samples.title.color,samples.control.background),theme+' quick-status label').toBeGreaterThanOrEqual(4.5);
      }
    });
}
