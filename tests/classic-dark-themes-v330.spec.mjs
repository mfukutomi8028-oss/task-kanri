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

function colorParts(value){
  const c=String(value).trim();
  if(c.startsWith('color(srgb ')){
    const m=c.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if(!m)throw new Error('Unsupported CSS color '+c);
    return m.slice(1,4).map(n=>Number(n)*255);
  }
  if(c.startsWith('rgb(')||c.startsWith('rgba(')){
    return (c.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
  }
  throw new Error('Unsupported CSS color '+c);
}
function relativeLuminance(rgb){
  const v=rgb.map(c=>c/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
  return v[0]*.2126+v[1]*.7152+v[2]*.0722;
}
function contrastRatio(a,b){
  const x=relativeLuminance(colorParts(a)),y=relativeLuminance(colorParts(b));
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}

for(const width of [1366,390]){
  test('Ver.333 screenshot-reproduced Todo, Today, task table and memo styles at '+width+'px',async({page})=>{
    await boot(page,width);
    for(const id of DARK){
      await choose(page,id);
      const audit=await page.evaluate(()=>{
        let root=document.getElementById('v333-real-screen-fixture');
        root?.remove();
        root=document.createElement('section');
        root.id='v333-real-screen-fixture';
        root.style.cssText='padding:12px;display:grid;gap:12px;max-width:900px;';
        root.innerHTML=[
          '<section class="today-panel"><h4>空き時間にやるタスク</h4>',
          '<div class="today-panel-body"><article class="task-card priority-card priority-高 favorite-task">',
          '<h4 class="task-title">電カルPC：リプレイス</h4>',
          '<div class="progress"><span style="width:40%"></span></div></article>',
          '<article class="task-card priority-card priority-高 stale"><h4 class="task-title">HP更新</h4></article>',
          '<article class="task-card priority-card priority-中 due-today"><h4 class="task-title">本日締切</h4></article>',
          '<div class="today-empty"><strong>今日のタスクはありません。</strong></div></div></section>',
          '<section class="todo-workspace"><div class="todo-input-stack"><span>やること</span></div>',
          '<div class="todo-list"><div class="todo-item">',
          '<button class="todo-summary-button"><span class="todo-text">備品を確認する</span></button>',
          '</div><div class="todo-item is-expanded">',
          '<button class="todo-summary-button"><span class="todo-text">開いたToDo</span></button>',
          '</div></div></section>',
          '<section class="list-view"><table class="task-table"><thead><tr><th>件名</th></tr></thead>',
          '<tbody><tr class="priority-row priority-高"><td>通常タスク</td></tr>',
          '<tr class="priority-row priority-中"><td>2行目のタスク</td></tr></tbody></table></section>',
          '<div class="work-memo-card-v167"><h4>業務メモ</h4>',
          '<div class="work-memo-body-v167">本文</div>',
          '<div class="work-memo-meta-v167"><span>担当者</span></div></div>'
        ].join('');
        document.querySelector('.main').appendChild(root);
        const sample=selector=>{
          const el=root.querySelector(selector);
          if(!el) return {selector,missing:true};
          const s=getComputedStyle(el);
          return {selector,background:s.backgroundColor,backgroundImage:s.backgroundImage,
                  color:s.color,borderBottom:s.borderBottomColor,borderTop:s.borderTopColor};
        };
        return [
          '.today-panel .task-card.priority-card.priority-高:not(.stale)',
          '.today-panel .task-card.priority-card.stale',
          '.today-panel .task-card.priority-card.due-today',
          '.today-panel .task-card .task-title',
          '.today-panel .task-card .progress',
          '.todo-workspace .todo-summary-button',
          '.todo-workspace .todo-item.is-expanded .todo-summary-button',
          '.todo-workspace .todo-text',
          '.todo-workspace .todo-input-stack > span',
          '.task-table tbody tr td',
          '.work-memo-meta-v167',
          '.work-memo-body-v167'
        ].map(sample);
      });
      const map=Object.fromEntries(audit.map(x=>[x.selector,x]));
      const surfaces=[
        '.today-panel .task-card.priority-card.priority-高:not(.stale)',
        '.today-panel .task-card.priority-card.stale',
        '.today-panel .task-card.priority-card.due-today',
        '.today-panel .task-card .progress',
        '.todo-workspace .todo-summary-button',
        '.todo-workspace .todo-item.is-expanded .todo-summary-button'
      ];
      for(const sel of surfaces){
        const x=map[sel];
        expect(x?.missing,id+' '+sel).toBeFalsy();
        expect(relativeLuminance(colorParts(x.background)),id+' '+sel+' too bright').toBeLessThan(.22);
        expect(x.backgroundImage,id+' '+sel+' retained a bright gradient').toBe('none');
      }
      const cards=map['.today-panel .task-card.priority-card.priority-高:not(.stale)'];
      const taskText=map['.today-panel .task-card .task-title'];
      const todo=map['.todo-workspace .todo-summary-button'];
      const todoText=map['.todo-workspace .todo-text'];
      expect(contrastRatio(taskText.color,cards.background),id+' task contrast').toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(todoText.color,todo.background),id+' todo contrast').toBeGreaterThanOrEqual(4.5);
      for(const [sel,property] of [['.task-table tbody tr td','borderBottom'],['.work-memo-meta-v167','borderTop']]){
        const border=map[sel][property];
        expect(relativeLuminance(colorParts(border)),id+' '+sel+' bright divider').toBeLessThan(.22);
      }

      // Unlike the synthetic fixture, these nodes belong to the real Today
      // screen and exposed unreadable text in an actual screenshot review.
      const todayTexts=await page.evaluate(()=>{
        const groups=[
          ['.activity-head p','.activity-head'],
          ['.activity-empty strong','.activity-panel'],
          ['.activity-empty p','.activity-panel'],
          ['.today-todo-preview-head p','.today-todo-preview'],
          ['.todo-preview-empty strong','.todo-preview-empty'],
          ['.todo-preview-empty p','.todo-preview-empty']
        ];
        return groups.map(([textSel,bgSel])=>{
          const text=document.querySelector('#todayView '+textSel);
          const bg=document.querySelector('#todayView '+bgSel);
          return {textSel,missing:!text||!bg,color:text?getComputedStyle(text).color:'',
            background:bg?getComputedStyle(bg).backgroundColor:''};
        });
      });
      for(const e of todayTexts){
        expect(e.missing,id+' missing real Today '+e.textSel).toBeFalsy();
        expect(contrastRatio(e.color,e.background),
          id+' unreadable real Today '+e.textSel).toBeGreaterThanOrEqual(4.5);
      }

      if(id==='night-navy'){
        const fs=await import('node:fs');
        fs.mkdirSync('test-results/classic-dark-visual-v333',{recursive:true});
        await page.screenshot({path:'test-results/classic-dark-visual-v333/desktop-'+width+'-'+id+'.png',fullPage:true});
      }
      await page.evaluate(()=>document.getElementById('v333-real-screen-fixture')?.remove());
    }

    // Screenshot the actual Classic view shells after theme application,
    // not just the detached test fixture, on both desktop and mobile.
    await choose(page,'night-navy');
    const fs=await import('node:fs');
    fs.mkdirSync('test-results/classic-dark-visual-v333',{recursive:true});
    const clickNav=async(selector,visible)=>{
      await page.locator(selector).evaluate(el=>el.click());
      await expect(page.locator(visible)).toBeVisible();
    };
    await clickNav('.nav-item[data-layout="today"]','#todayView');
    await page.screenshot({path:'test-results/classic-dark-visual-v333/real-today-'+width+'.png',fullPage:true});
    await clickNav('.nav-item[data-layout="todos"]','#todoView');
    await page.screenshot({path:'test-results/classic-dark-visual-v333/real-todo-'+width+'.png',fullPage:true});
    await clickNav('.nav-item[data-layout="tasks"]','#boardView');
    await page.locator('.task-view-button[data-task-layout="list"]').evaluate(el=>el.click());
    await expect(page.locator('#listView')).toBeVisible();
    await page.screenshot({path:'test-results/classic-dark-visual-v333/real-tasks-'+width+'.png',fullPage:true});
    await clickNav('.nav-item[data-layout="schedule"]','#scheduleView');
    await page.screenshot({path:'test-results/classic-dark-visual-v333/real-schedule-'+width+'.png',fullPage:true});
    await clickNav('[data-work-memo-layout]','#workMemoViewV167');
    await page.screenshot({path:'test-results/classic-dark-visual-v333/real-memo-'+width+'.png',fullPage:true});

  });
}
