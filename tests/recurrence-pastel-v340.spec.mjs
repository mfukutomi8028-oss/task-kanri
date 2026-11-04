import { test, expect } from '@playwright/test';

const PASTELS=['pastel-blue','pastel-lilac','pastel-mint','pastel-rose','pastel-peach','pastel-lemon'];

async function boot(page,room,width=1366){
  await page.setViewportSize({width,height:900});
  await page.addInitScript(({room})=>{
    // Preserve the selected palette across a reload of the same test room.
    const fixture='v340-fixture-'+room;
    if (sessionStorage.getItem(fixture)!=='1') {
      localStorage.clear();
      localStorage.setItem('systemTaskUser','CycleQA');
      localStorage.setItem('systemTaskRoomId',room);
      localStorage.setItem('system-task-users:'+room,JSON.stringify(['CycleQA']));
      sessionStorage.setItem(fixture,'1');
    }
    Object.defineProperty(window,'firebaseConfig',{
      configurable:true,get(){return null;},set(){}
    });
  },{room});
  await page.route('https://www.gstatic.com/firebasejs/**',route=>route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,route=>route.abort('blockedbyclient'));
  await page.goto('/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await expect(page.locator('#wbColorThemeButton')).toHaveCount(1);
}

async function setNativeDate(page,selector,date) {
  await page.locator(selector).evaluate((source,value) => {
    source.value=value;
    source.closest('.date-segment-control-v127')?.__syncDateSegmentsV127?.();
    source.dispatchEvent(new Event('input',{bubbles:true}));
    source.dispatchEvent(new Event('change',{bubbles:true}));
  },date);
}

async function storedTasks(page,room) {
  return page.evaluate(room=>JSON.parse(localStorage.getItem('system-task-tasks:'+room)||'[]'),room);
}

test('Ver.340: completion creates a no-deadline task at the next independent monthly date',async({page})=>{
  test.setTimeout(90000);
  const room='test-v340-recurring-no-deadline';
  await boot(page,room);
  await page.locator('.nav-item[data-layout="tasks"]').first().evaluate(el=>el.click());
  await page.locator('#newTask').evaluate(el=>el.click());
  await expect(page.locator('#taskDialog')).toBeVisible();
  await page.locator('#taskTitle').fill('期限なしの繰り返し業務');
  await page.locator('#taskRecurrence').selectOption('monthlyDay');
  const year=new Date().getFullYear()+1;
  const anchor=year+'-01-01';
  const first=year+'-01-25';
  const second=year+'-03-25';
  await setNativeDate(page,'#taskRecurrenceAnchorDate',anchor);
  await page.locator('#taskRecurrenceInterval').fill('2');
  await page.locator('#taskRecurrenceMonthDay').fill('25');
  await expect(page.locator('#taskDueDate')).toHaveValue('');
  await expect(page.locator('#recurrencePreview')).toContainText('次の繰り返し日');
  await expect(page.locator('#recurrencePreview')).not.toContainText('期限日を指定すると');
  await page.locator('#taskForm [type="submit"]').first().click();
  await expect(page.locator('#taskDialog')).toBeHidden();
  await expect.poll(async()=>(await storedTasks(page,room)).length).toBe(1);
  let all=await storedTasks(page,room);
  const root=all[0];
  expect(root.dueDate).toBe('');
  expect(root.recurrenceRule).toMatchObject({anchorDate:anchor,monthDay:25,interval:2,seriesId:root.id,occurrenceDate:''});
  await page.locator('[data-task-id="'+root.id+'"]').first().evaluate(el=>el.click());
  await expect(page.locator('#detailBody [data-action="done"]')).toBeVisible();
  page.once('dialog',dialog=>dialog.accept(''));
  await page.locator('#detailBody [data-action="done"]').click();
  await expect.poll(async()=>(await storedTasks(page,room)).length).toBe(2);
  all=await storedTasks(page,room);
  const parent=all.find(item=>item.id===root.id);
  const child=all.find(item=>item.id!==root.id);
  expect(parent.nextRecurringTaskId).toBe(child.id);
  expect(child).toMatchObject({dueDate:'',dueTime:'',recurringParentId:root.id,status:'未着手'});
  expect(child.recurrenceRule).toMatchObject({anchorDate:anchor,occurrenceDate:first,seriesId:root.id,interval:2,monthDay:25});

  // A manually chosen deadline can aid reminders without changing the cycle.
  await page.locator('[data-task-id="'+child.id+'"]').first().evaluate(el=>el.click());
  await page.locator('#detailBody [data-action="edit"]').click();
  await expect(page.locator('#taskDialog')).toBeVisible();
  await expect(page.locator('#taskRecurrenceAnchorDate')).toHaveValue(anchor);
  await expect(page.locator('#taskDueDate')).toHaveValue('');
  await setNativeDate(page,'#taskDueDate',year+'-02-01');
  await page.locator('#taskForm [type="submit"]').first().click();
  await expect(page.locator('#taskDialog')).toBeHidden();
  await expect.poll(async()=>{
    const list=await storedTasks(page,room);
    return list.find(item=>item.id===child.id)?.dueDate;
  }).toBe(year+'-02-01');
  const edited=(await storedTasks(page,room)).find(item=>item.id===child.id);
  expect(edited.recurrenceRule.occurrenceDate).toBe(first);
  expect(edited.recurrenceRule.anchorDate).toBe(anchor);

  await page.locator('[data-task-id="'+child.id+'"]').first().evaluate(el=>el.click());
  await expect(page.locator('#detailBody [data-action="done"]')).toBeVisible();
  page.once('dialog',dialog=>dialog.accept(''));
  await page.locator('#detailBody [data-action="done"]').click();
  await expect.poll(async()=>(await storedTasks(page,room)).length).toBe(3);
  all=await storedTasks(page,room);
  const grandchild=all.find(item=>item.id!==root.id && item.id!==child.id);
  expect(grandchild.recurrenceRule).toMatchObject({anchorDate:anchor,occurrenceDate:second,seriesId:root.id});
  expect(grandchild.dueDate).toBe(year+'-04-01');
  expect(grandchild.id.length).toBe(child.id.length);
});

for(const width of [1366,390]){
  test('Ver.340: six pastel light modes remain readable and stored at '+width+'px',async({page})=>{
    test.setTimeout(90000);
    await boot(page,'test-v340-pastel-'+width,width);
    await page.locator('#wbColorThemeButton').evaluate(el=>el.click());
    const picker=page.locator('#wbColorThemeDialog');
    await expect(picker).toBeVisible();
    await expect(picker.locator('.wb-color-theme-group')).toHaveCount(3);
    await expect(picker.locator('.wb-color-theme-option')).toHaveCount(19);
    await expect(picker.locator('[data-theme^="pastel-"]')).toHaveCount(6);
    for(const id of PASTELS){
      await picker.locator('[data-theme="'+id+'"]').click();
      await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme',id);
      await expect(page.locator('html')).toHaveAttribute('data-wb-color-mode','light');
      const actual=await page.evaluate(()=>{
        const pick=selector=>{
          const el=document.querySelector(selector);
          return el?getComputedStyle(el).color:'';
        };
        const css=getComputedStyle(document.documentElement);
        const resolve=(value)=>{
          const temp=document.createElement('span');
          temp.style.color=value;document.body.appendChild(temp);
          const v=getComputedStyle(temp).color;temp.remove();return v;
        };
        return {
          hero:pick('.hero h2'),
          sidebar:pick('.sidebar .nav-item'),
          selector:pick('#wbColorThemeButton'),
          darkInk:resolve(css.getPropertyValue('--wb-theme-ink').trim()),
          mode:css.colorScheme,
          original:css.getPropertyValue('--wb-theme-sidebar-a').trim()
        };
      });
      expect(actual.hero,id+' hero text').toBe(actual.darkInk);
      expect(actual.sidebar,id+' navigation text').toBe(actual.darkInk);
      expect(actual.selector,id+' color switcher text').toBe(actual.darkInk);
      expect(actual.mode,id+' color scheme').not.toContain('dark');
    }
    await picker.locator('.wb-color-theme-close').click();
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
    await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme','pastel-lemon');
    await page.locator('#wbColorThemeButton').evaluate(el=>el.click());
    await page.locator('#wbColorThemeDialog [data-theme="default"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-wb-color-mode','light');
    await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme','default');
  });
}

/* Ver.342: verify live computed backgrounds for the actual Today header,
   Today column, personal ToDo and pastel hero; not only palette variables. */
for (const width of [1366,390]) {
  test('Ver.342: light-theme section caps and white-to-pastel gradients at '+width+'px',
    async({page},testInfo)=>{
      test.setTimeout(120000);
      await boot(page,'test-v342-themed-caps-'+width,width);
      await expect(page.locator('#todayView .activity-panel .activity-head')).toBeVisible();
      await expect(page.locator('#todayView .today-panel-sort-head-v531').first()).toBeVisible();
      await expect(page.locator('#todayView .today-todo-preview')).toBeVisible();
      await page.locator('#wbColorThemeButton').evaluate(el=>el.click());
      const choices=page.locator('#wbColorThemeDialog');
      await expect(choices).toBeVisible();
      const light=['sky','lavender','mint','rose','peach','amber','slate',...PASTELS];
      const seen=new Set();
      for (const id of light) {
        await choices.locator('[data-theme="'+id+'"]').click();
        await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme',id);
        const sample=await page.evaluate(()=>{
          const image=selector=>{
            const node=document.querySelector(selector);
            return node?getComputedStyle(node).backgroundImage:null;
          };
          return {
            notice:image('#todayView .activity-panel .activity-head'),
            column:image('#todayView .today-panel-sort-head-v531'),
            todo:image('#todayView .today-todo-preview'),
            hero:image('.hero'),
            sidebar:image('.sidebar')
          };
        });
        for (const key of ['notice','column','todo']) {
          expect(sample[key],id+' '+key+' has a themed gradient').toContain('gradient(');
          expect(sample[key],id+' '+key+' still uses Classic pale-blue gradient').not.toContain('240, 248, 252');
        }
        seen.add(sample.notice);
        if (id.startsWith('pastel-')) {
          expect(sample.hero,id+' hero starts with white').toMatch(/gradient\([^)]*rgb\(255, 255, 255\)/);
          expect(sample.sidebar,id+' sidebar starts with white').toMatch(/gradient\([^)]*rgb\(255, 255, 255\)/);
          expect(sample.hero,id+' no black hero background').not.toContain('rgb(0, 0, 0)');
          expect(sample.sidebar,id+' no black sidebar background').not.toContain('rgb(0, 0, 0)');
        }
        if(id==='pastel-rose'&&width===1366) {
          await choices.locator('.wb-color-theme-close').click();
          await testInfo.attach('v342-pastel-rose-today.png',{
            body:await page.screenshot({animations:'disabled'}),contentType:'image/png'
          });
          await page.locator('#wbColorThemeButton').evaluate(el=>el.click());
          await expect(choices).toBeVisible();
        }
      }
      expect(seen.size,'different light themes must give genuinely different section caps').toBe(light.length);
    });
}

test('Ver.343: a configured deadline and its time recur, without making them mandatory',async({page})=>{
  test.setTimeout(90000);
  const room='test-v343-deadline-inherits';
  await boot(page,room);
  await page.locator('.nav-item[data-layout="tasks"]').first().evaluate(el=>el.click());
  await page.locator('#newTask').evaluate(el=>el.click());
  await expect(page.locator('#taskDialog')).toBeVisible();
  const year=new Date().getFullYear()+1;
  const anchor=year+'-01-04', deadline=year+'-01-10';
  await page.locator('#taskTitle').fill('期限を引き継ぐ定期タスク');
  await page.locator('#taskRecurrence').selectOption('monthlyDay');
  await setNativeDate(page,'#taskRecurrenceAnchorDate',anchor);
  await page.locator('#taskRecurrenceMonthDay').fill('4');
  await setNativeDate(page,'#taskDueDate',deadline);
  await page.locator('#taskDueTime').fill('17:30');
  await page.locator('#taskForm [type="submit"]').first().click();
  await expect(page.locator('#taskDialog')).toBeHidden();
  await expect.poll(async()=>(await storedTasks(page,room)).length).toBe(1);
  const root=(await storedTasks(page,room))[0];
  expect(root.dueDate).toBe(deadline);
  await page.locator('[data-task-id="'+root.id+'"]').first().evaluate(el=>el.click());
  page.once('dialog',dialog=>dialog.accept(''));
  await page.locator('#detailBody [data-action="done"]').click();
  await expect.poll(async()=>(await storedTasks(page,room)).length).toBe(2);
  const child=(await storedTasks(page,room)).find(t=>t.id!==root.id);
  expect(child.recurrenceRule.occurrenceDate).toBe(anchor);
  expect(child.dueDate).toBe(deadline);
  expect(child.dueTime).toBe('17:30');
  await page.locator('[data-task-id="'+child.id+'"]').first().evaluate(el=>el.click());
  page.once('dialog',dialog=>dialog.accept(''));
  await page.locator('#detailBody [data-action="done"]').click();
  await expect.poll(async()=>(await storedTasks(page,room)).length).toBe(3);
  const grandchild=(await storedTasks(page,room)).find(t=>![root.id,child.id].includes(t.id));
  expect(grandchild.recurrenceRule.occurrenceDate).toBe(year+'-02-04');
  expect(grandchild.dueDate).toBe(year+'-02-10');
  expect(grandchild.dueTime).toBe('17:30');
});

for (const width of [1440,960,768,390,320]) {
  test('Ver.343: recurrence controls have no clipped picker or oversized interval at '+width+'px',async({page},testInfo)=>{
    test.setTimeout(90000);
    await boot(page,'test-v343-responsive-recurrence-'+width,width);
    await page.locator('#newTask').evaluate(el=>el.click());
    await expect(page.locator('#taskDialog')).toBeVisible();
    await page.locator('#taskRecurrence').selectOption('monthlyDay');
    await expect(page.locator('#recurrenceOptions')).toBeVisible();
    await expect(page.locator('#taskRecurrenceMonthDay')).toBeVisible();
    const inspect=()=>page.evaluate(()=>{
      const box=selector=>{
        const el=document.querySelector(selector);
        if(!el)return null;
        const rect=el.getBoundingClientRect();
        return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,
          width:rect.width,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};
      };
      return {options:box('#recurrenceOptions'),grid:box('.recurrence-grid'),
        date:box('.recurrence-anchor-field .date-segment-control-v127'),
        picker:box('.recurrence-anchor-field .date-segment-picker-v127'),
        anchor:box('.recurrence-anchor-field'),
        interval:box('#taskRecurrenceInterval'),day:box('#taskRecurrenceMonthDay')};
    });
    const values=await inspect();
    for(const key of ['options','grid','date','picker','anchor','interval','day']){
      expect(values[key],width+' missing '+key).toBeTruthy();
    }
    expect(values.date.scrollWidth,width+' clipped date segments').toBeLessThanOrEqual(values.date.clientWidth+1);
    expect(values.picker.right,width+' hidden calendar picker').toBeLessThanOrEqual(values.date.right+1);
    expect(values.picker.left,width+' calendar picker outside control').toBeGreaterThanOrEqual(values.date.left-1);
    expect(values.interval.width,width+' overly wide interval').toBeLessThanOrEqual(130);
    expect(values.day.width,width+' overly wide month day').toBeLessThanOrEqual(160);
    expect(values.grid.scrollWidth,width+' grid overflow').toBeLessThanOrEqual(values.grid.clientWidth+1);
    if(values.options.clientWidth>720){
      expect(Math.abs(values.anchor.top-values.interval.top),width+' first row interval').toBeLessThanOrEqual(2);
      expect(Math.abs(values.anchor.top-values.day.top),width+' month day unnecessary second row').toBeLessThanOrEqual(2);
    }
    for(const method of ['weekly','monthlyNth','monthEnd','lastWeekday','yearly','daily']){
      await page.locator('#taskRecurrence').selectOption(method);
      const item=await inspect();
      expect(item.grid.scrollWidth,width+' '+method+' horizontal overflow').toBeLessThanOrEqual(item.grid.clientWidth+1);
      expect(item.picker.right,width+' '+method+' hidden picker').toBeLessThanOrEqual(item.date.right+1);
    }
    await page.locator('#taskRecurrence').selectOption('monthlyDay');
    await testInfo.attach('recurrence-layout-'+width+'.png',{
      body:await page.locator('#recurrenceOptions').screenshot({animations:'disabled'}),
      contentType:'image/png'
    });
    await expect(page.locator('#recurrenceOptions .recurrence-help')).not.toContainText('期限日とは独立');
  });
}
