import { test, expect } from '@playwright/test';

const ROOM='test-classic-dark-theme-v330';
const DARK=['night-navy','night-charcoal','night-forest','night-plum','night-mocha'];
async function boot(page,width){
  await page.setViewportSize({width,height:900});
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.origin==='http://127.0.0.1:4173' ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(({room})=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null;},set(){}});
    if(sessionStorage.getItem('v330-dark-fixture')!=='1'){
      localStorage.clear();
      localStorage.setItem('systemTaskUser','DarkQA');
      localStorage.setItem('systemTaskRoomId',room);
      sessionStorage.setItem('v330-dark-fixture','1');
    }
  },{room:ROOM});
  await page.goto('/?room='+ROOM,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await expect(page.locator('#wbColorThemeButton')).toHaveCount(1);
}
async function choose(page,id){
  await page.locator('#wbColorThemeButton').evaluate(el=>el.click());
  await expect(page.locator('#wbColorThemeDialog')).toBeVisible();
  await page.locator('#wbColorThemeDialog [data-theme="'+id+'"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme',id);
  await page.locator('.wb-color-theme-close').click();
}
for(const width of [1366,390]){
  test('dark palette color and persistence work on '+width+'px',async({page})=>{
    await boot(page,width);
    await page.locator('#wbColorThemeButton').evaluate(el=>el.click());
    await expect(page.locator('#wbColorThemeDialog .wb-color-theme-group')).toHaveCount(2);
    await expect(page.locator('#wbColorThemeDialog .wb-color-theme-option')).toHaveCount(13);
    await page.locator('.wb-color-theme-close').click();
    for(const id of DARK){
      await choose(page,id);
      await expect(page.locator('html')).toHaveAttribute('data-wb-color-mode','dark');
      const colors=await page.evaluate(()=>{
        const html=document.documentElement,card=document.querySelector('.summary-card');
        const b=getComputedStyle(document.body),a=getComputedStyle(card),meta=document.querySelector('meta[name="theme-color"]');
        const accent=getComputedStyle(html).getPropertyValue('--wb-theme-accent').trim();
        return {body:b.backgroundColor,card:a.backgroundColor,ink:a.color,accent,meta:meta?.content,scroll:document.documentElement.scrollWidth>innerWidth+2};
      });
      expect(colors.body).not.toBe('rgb(238, 247, 251)');
      expect(colors.card).not.toBe('rgb(255, 255, 255)');
      expect(colors.ink).not.toBe('rgb(16, 34, 54)');
      expect(colors.scroll).toBeFalsy();
    }
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
    await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme',DARK.at(-1));
    await choose(page,'default');
    await expect(page.locator('html')).toHaveAttribute('data-wb-color-mode','light');
    await expect(page.locator('.summary-card')).toHaveCSS('background-color','rgba(255, 255, 255, 0.92)');
  });
}

for(const width of [1366,390]){
  test('Ver.331 dark UI work surfaces are readable at '+width+'px',async({page})=>{
    await boot(page,width);
    await page.locator('#wbColorThemeButton').evaluate(el=>el.click());
    await page.locator('#wbColorThemeDialog [data-theme="night-navy"]').click();
    await page.locator('.wb-color-theme-close').click();

    const actual=await page.evaluate(()=>{
      const box=document.createElement('section');
      box.id='dark-readability-v331-fixture';
      box.innerHTML=[
        '<section class="today-todos todo-workspace"><div class="todo-create-form"><input placeholder="やること"></div>',
        '<section class="todo-list is-completed"><h5>完了</h5><ul class="todo-items">',
        '<li class="todo-item is-expanded"><div class="todo-content">',
        '<button class="todo-summary-button"><span class="todo-text">書類確認</span></button></div>',
        '<div class="todo-detail"><label>補足</label><textarea>メモ</textarea></div>',
        '<button class="todo-state-toggle-v144">完了する</button></li></ul></section></section>',
        '<section class="board-view"><div class="board-column"><div class="task-list">',
        '<article class="task-card due-today"><h4>期限が今日</h4></article></div></div></section>',
        '<section class="schedule-view"><div class="schedule-day"><h4>今日の予定</h4>',
        '<div class="schedule-card"><div class="schedule-main"><strong>会議</strong><p>詳細</p></div></div></div>',
        '<div class="schedule-calendar"><div class="calendar-head"><strong>月表示</strong></div>',
        '<div class="calendar-cell today"><span class="calendar-date">3</span></div></div></section>',
        '<section class="work-memo-view-v167"><div class="work-memo-tools-v167">',
        '<div class="work-memo-search-v167"><input placeholder="検索"></div></div>',
        '<article class="work-memo-card-v167"><div class="work-memo-card-head-v167"><h4>業務メモ</h4></div>',
        '<div class="work-memo-body-v167">メモの本文</div>',
        '<div class="work-memo-tags-v167"><span>ラベル</span></div></article></section>'
      ].join('');
      document.querySelector('.main').appendChild(box);
      const target=[
        '.todo-workspace .todo-list','.todo-workspace .todo-item',
        '.todo-workspace .todo-detail','.todo-state-toggle-v144',
        '.board-column','.schedule-day h4','.schedule-card',
        '.work-memo-card-v167','.work-memo-search-v167',
        '.work-memo-body-v167','.work-memo-tags-v167 span'
      ];
      const cs=getComputedStyle(document.documentElement);
      const toRgb=value=>{
        const probe=document.createElement('span');
        probe.style.color=value;
        box.appendChild(probe);
        const color=getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      const colors=[toRgb(cs.getPropertyValue('--wb-theme-surface')),toRgb(cs.getPropertyValue('--wb-theme-surface-soft'))];
      const ink=toRgb(cs.getPropertyValue('--wb-theme-ink'));
      return {colors,ink,items:target.map(sel=>{
        const el=box.querySelector(sel);
        return {sel,missing:!el,background:el?getComputedStyle(el).backgroundColor:'',
          backgroundImage:el?getComputedStyle(el).backgroundImage:'',
          color:el?getComputedStyle(el).color:''};
      }),todoText:getComputedStyle(box.querySelector('.todo-text')).color};
    });
    expect(actual.todoText).toBe(actual.ink);
    for(const x of actual.items){
      expect(x.missing,'missing '+x.sel).toBeFalsy();
      if(x.sel!=='.todo-state-toggle-v144'){
        expect(actual.colors,x.sel+' background '+x.background).toContain(x.background);
        expect(x.backgroundImage,x.sel).toBe('none');
      } else {
        expect(x.background,x.sel).not.toBe('rgb(255, 255, 255)');
      }
    }
  });
}
