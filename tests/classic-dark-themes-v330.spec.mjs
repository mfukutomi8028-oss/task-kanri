import { test, expect } from '@playwright/test';

const ROOM='test-classic-dark-theme-v332';
const DARK=['night-navy','night-charcoal','night-forest','night-plum','night-mocha'];
async function boot(page,width){
  await page.setViewportSize({width,height:900});
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.origin==='http://127.0.0.1:4173' ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(({room})=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null;},set(){}});
    if(sessionStorage.getItem('v332-fixture')!=='1'){
      localStorage.clear();
      localStorage.setItem('systemTaskUser','DarkQA');
      localStorage.setItem('systemTaskRoomId',room);
      sessionStorage.setItem('v332-fixture','1');
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
async function audit(page){
  return page.evaluate(()=>{
    let box=document.getElementById('v332-dark-samples');
    if(box)box.remove();
    box=document.createElement('section');
    box.id='v332-dark-samples';
    box.innerHTML=[
      '<section class="dashboard-head">ダッシュボード</section>',
      '<article class="dashboard-kpi danger"><strong>3件</strong><span>期限超過</span></article>',
      '<article class="attention-item">未対応タスク</article>',
      '<section class="task-control-row"><div class="task-view-switcher"><span>表示形式</span>',
      '<div class="segmented-buttons task-view-buttons">',
      '<button class="task-view-button active">一覧</button><button class="task-view-button">ボード</button></div></div>',
      '<div class="task-color-legend"><div class="legend-head"><strong>色の意味</strong><span>左端＝優先度</span></div>',
      '<div class="legend-items"><span>緊急</span></div></div></section>',
      '<div class="bulk-bar"><strong>0件選択中</strong><select><option>操作を選択</option></select></div>',
      '<div class="list-column-sort-status">元の並び順を表示</div>',
      '<div class="user-badge" style="--user-color:#f8d9ef">',
      '<span class="tiny-avatar">山</span>山田</div>',
      '<div class="user-badge group-badge" style="--user-color:#32c6ee">',
      '<span class="tiny-avatar">共</span>共有担当</div>',
      '<div class="today-todos todo-workspace"><div class="todo-create-form">',
      '<input placeholder="新しいやること"></div><div class="todo-list"><h5>未完了</h5>',
      '<div class="todo-item"><button class="todo-summary-button"><span class="todo-text">ToDo本文</span></button>',
      '<div class="todo-detail"><label>メモ</label><textarea>内容</textarea></div>',
      '</div></div></div>',
      '<div class="board-column"><article class="task-card due-today"><h4>今日が期限</h4></article></div>',
      '<div class="schedule-day"><h4>今日の予定</h4>',
      '<article class="schedule-card"><div class="schedule-main"><strong>予約</strong></div></article></div>',
      '<div class="schedule-calendar"><div class="calendar-head"><strong>11月</strong></div>',
      '<div class="calendar-weekdays"><span>日</span><span>月</span></div>',
      '<div class="calendar-cell today"><span class="calendar-date">3</span></div></div>',
      '<div class="workflow-inbox-item-v152">通知</div>',
      '<div class="today-reminders-v152"><div class="today-reminders-head-v152"><h4>今日の通知</h4></div></div>',
      '<div class="workflow-archive-modal-v153"><header><h3>アーカイブ</h3></header></div>',
      '<div class="schedule-copy-preview">複製確認</div>',
      '<div class="work-memo-tools-v167"><div class="work-memo-search-v167"><input placeholder="メモを検索"></div></div>',
      '<div class="work-memo-card-v167"><div class="work-memo-body-v167">メモの本文</div></div>'
    ].join('');
    document.querySelector('.main').appendChild(box);
    const styles=getComputedStyle(document.documentElement);
    const f={
      ink:styles.getPropertyValue('--wb-dark-ink').trim(),
      canvas:styles.getPropertyValue('--wb-dark-canvas').trim(),
      surface:styles.getPropertyValue('--wb-dark-surface').trim(),
      raised:styles.getPropertyValue('--wb-dark-raised').trim()
    };
    const sample=(selector)=>{
      const el=box.querySelector(selector);
      if(!el)return {selector,missing:true};
      const cs=getComputedStyle(el);
      return {selector,background:cs.backgroundColor,image:cs.backgroundImage,
        color:cs.color,border:cs.borderColor};
    };
    return {tokens:f,items:[
      '.dashboard-head','.dashboard-kpi','.attention-item',
      '.task-control-row','.task-view-button.active','.bulk-bar',
      '.list-column-sort-status','.user-badge','.user-badge.group-badge',
      '.user-badge .tiny-avatar','.task-color-legend .legend-head strong',
      '.todo-workspace .todo-create-form','.todo-workspace .todo-list','.todo-workspace .todo-item',
      '.todo-workspace .todo-text','.todo-workspace input','.todo-workspace textarea',
      '.board-column','.task-card.due-today',
      '.schedule-day h4','.schedule-card','.calendar-head','.calendar-weekdays',
      '.work-memo-search-v167','.work-memo-body-v167',
      '.workflow-inbox-item-v152','.today-reminders-v152','.today-reminders-head-v152 h4',
      '.workflow-archive-modal-v153','.schedule-copy-preview'
    ].map(sample),bodyBg:getComputedStyle(document.body).backgroundColor};
  });
}
for(const width of [1366,390]){
  test('5 dark palettes keep their controls, labels, and surfaces readable at '+width+'px',async({page})=>{
    await boot(page,width);
    await page.locator('#wbColorThemeButton').evaluate(el=>el.click());
    await expect(page.locator('#wbColorThemeDialog .wb-color-theme-group')).toHaveCount(2);
    await expect(page.locator('#wbColorThemeDialog .wb-color-theme-option')).toHaveCount(13);
    await page.locator('.wb-color-theme-close').click();
    for(const id of DARK){
      await choose(page,id);
      await expect(page.locator('html')).toHaveAttribute('data-wb-color-mode','dark');
      const result=await audit(page);
      const map=Object.fromEntries(result.items.map(s=>[s.selector,s]));
      for(const s of result.items){
        expect(s.missing,id+' '+s.selector).toBeFalsy();
        if(['.user-badge .tiny-avatar','.task-view-button.active','.task-card.due-today','.calendar-cell.today'].includes(s.selector))continue;
        expect(s.image,id+' '+s.selector).toBe('none');
        expect(s.background,id+' '+s.selector).not.toBe('rgb(255, 255, 255)');
      }
      const ink=await page.evaluate(()=>{
        const val=getComputedStyle(document.documentElement).getPropertyValue('--wb-dark-ink').trim();
        const span=document.createElement('span');span.style.color=val;
        document.body.appendChild(span);const resolved=getComputedStyle(span).color;span.remove();return resolved;
      });
      expect(map['.user-badge'].color,id+' assignee name').toBe(ink);
      expect(map['.user-badge.group-badge'].color,id+' group assignee name').toBe(ink);
      expect(map['.task-color-legend .legend-head strong'].color,id+' legend text').toBe(ink);
      expect(map['.todo-workspace .todo-text'].color,id+' todo text').toBe(ink);
      expect(map['.schedule-day h4'].color,id+' calendar header text').toBe(ink);
      expect(map['.today-reminders-head-v152 h4'].color,id+' reminder heading').toBe(ink);
    }
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
    await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme',DARK.at(-1));
    await choose(page,'default');
    await expect(page.locator('html')).toHaveAttribute('data-wb-color-mode','light');
    const original=await page.evaluate(()=>getComputedStyle(document.querySelector('.user-badge')||document.body).color);
    expect(original).not.toBe('');
  });
}
