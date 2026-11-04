import { test, expect } from '@playwright/test';

const DARK_THEMES = ['night-navy', 'night-charcoal', 'night-forest', 'night-plum', 'night-mocha'];

async function boot(page, width) {
  const room = 'test-theme-forms-detail-v335-' + width;
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('system-task-users:' + room, JSON.stringify(['福冨']));
    localStorage.setItem('system-task-tasks:' + room, JSON.stringify([{
      id: 'v335-theme-task', title: 'ダークテーマ確認タスク',
      description: '内容・メモを明るい文字色で読めることを確認する',
      status: '対応中', assignee: '福冨', priority: '高',
      category: 'その他', requester: '医事課',
      revision: 3, createdAt: Date.now(), updatedAt: Date.now(),
      checklist: [{ id: 'v335-check', text: 'メモの読みやすさを確認', done: false }]
    }]));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
  }, { room });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.goto('/?room=' + room, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30000 });
  await expect(page.locator('#wbColorThemeButton')).toHaveCount(1);
}

async function selectTheme(page, id) {
  await page.locator('#wbColorThemeButton').evaluate(el => el.click());
  await expect(page.locator('#wbColorThemeDialog')).toBeVisible();
  await page.locator('#wbColorThemeDialog [data-theme="' + id + '"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme', id);
  await page.locator('.wb-color-theme-close').click();
}

async function inspect(page, selectors) {
  return page.evaluate(selectors => {
    const probe = document.createElement('span');
    probe.style.cssText = 'background:var(--wb-dark-inset);color:var(--wb-dark-ink);';
    document.body.appendChild(probe);
    const expected = { bg: getComputedStyle(probe).backgroundColor, text:getComputedStyle(probe).color };
    probe.remove();
    const items = Object.fromEntries(Object.entries(selectors).map(([name,selector]) => {
      const node = document.querySelector(selector);
      if (!node) return [name,{missing:true}];
      const cs=getComputedStyle(node);
      return [name,{bg:cs.backgroundColor, color:cs.color, shadow:cs.boxShadow, border:cs.borderColor}];
    }));
    return {expected,items};
  }, selectors);
}

for (const width of [1366, 390]) {
  test('Ver.335: five dark palettes have no yellow glow, inverted dates, or unreadable task details at ' + width + 'px', async ({page}, testInfo) => {
    test.setTimeout(120000);
    await boot(page,width);
    await page.locator('.nav-item[data-layout="tasks"]').first().evaluate(el=>el.click());
    await expect(page.locator('#newTask')).toHaveCount(1);

    for (const theme of DARK_THEMES) {
      await selectTheme(page,theme);
      const navigation=await inspect(page,{
        selected:'.sidebar .nav-item[data-layout="tasks"].active',
        add:'#newTask'
      });
      // Palette changes can animate a zero-opacity legacy shadow for a
      // fraction of a frame. Audit the final computed style, not the
      // intermediate transition tick.
      await expect.poll(async () => (await inspect(page, {
        selected:'.sidebar .nav-item[data-layout="tasks"].active'
      })).items.selected.shadow, {timeout: 3000}).toBe('none');
      await expect.poll(async () => (await inspect(page, {
        add:'#newTask'
      })).items.add.shadow, {timeout: 3000}).toBe('none');

      await page.locator('#newTask').evaluate(el=>el.click());
      await expect(page.locator('#taskDialog')).toBeVisible();
      await expect(page.locator('#taskStartDateV167')).toHaveCount(1);
      await expect(page.locator('#taskDueDate')).toHaveCount(1);
      await expect.poll(() => page.locator('#taskDueDate').evaluate(el=>Boolean(el.closest('.date-segment-control-v127')))).toBe(true);
      const forms=await inspect(page,{
        start:'#taskStartDateV167',due:'#taskDueDate',
        startWrapper:'#taskStartDateV167',dueWrapper:'#taskDueDate',
        category:'#taskCategory'
      });
      // Both date source inputs are hidden by v230. Assert the visible wrapper instead.
      const inputs=await page.evaluate(()=>{
        const ids=['taskStartDateV167','taskDueDate'];
        return ids.map(id=>{
          const source=document.getElementById(id);
          const wrapper=source?.closest('.date-segment-control-v127');
          const year=wrapper?.querySelector('.date-segment-year-v127');
          const picker=wrapper?.querySelector('.date-segment-picker-v127');
          return {
            id,hasWrapper:Boolean(wrapper),
            background:wrapper?getComputedStyle(wrapper).backgroundColor:'',
            text:year?getComputedStyle(year).color:'',
            picker:picker?getComputedStyle(picker).color:'',
            shadow:wrapper?getComputedStyle(wrapper).boxShadow:''
          };
        });
      });
      for (const input of inputs) {
        expect(input.hasWrapper,theme+' '+input.id).toBe(true);
        expect(input.background,theme+' '+input.id+' white date wrapper').toBe(forms.expected.bg);
        expect(input.text,theme+' '+input.id+' date text').toBe(forms.expected.text);
        expect(input.picker,theme+' '+input.id+' calendar icon').toBe(forms.expected.text);
        expect(input.shadow,theme+' '+input.id+' unused focus glow').toBe('none');
      }
      await page.locator('#closeTaskDialog').evaluate(el=>el.click());
      await expect(page.locator('#taskDialog')).toBeHidden();

      await page.waitForFunction(() => Boolean(document.querySelector('[data-task-id="v335-theme-task"]')), undefined, {timeout:10000});
      await page.locator('[data-task-id="v335-theme-task"]').first().evaluate(el=>el.click());
      await expect(page.locator('#detailBody [data-action="favorite"]')).toBeVisible();
      await expect(page.locator('#detailBody .field-card').first()).toBeVisible();
      await expect(page.locator('#detailBody .description').first()).toBeVisible();
      const detail=await inspect(page,{
        card:'#detailBody .field-card',
        description:'#detailBody .detail-section > .description',
        checklist:'#detailBody .check-item',
        metaLabel:'#detailBody .field-card small',
        tabs:'#detailBody .task-detail-tabs-v149',
        done:'#detailBody [data-action="done"]',
        favorite:'#detailBody [data-action="favorite"]',
        delete:'#detailBody [data-action="delete"]'
      });
      for (const key of ['card','checklist','tabs','done','favorite','delete']) {
        expect(detail.items[key]?.missing,theme+' '+key).toBeFalsy();
        const background = ['card','checklist'].includes(key)
          ? 'rgba(0, 0, 0, 0)' : detail.expected.bg;
        expect(detail.items[key].bg,theme+' '+key+' background').toBe(background);
      }
      expect(detail.items.description.color,theme+' unreadable memo').toBe(detail.expected.text);
      expect(detail.items.done.color,theme+' green completion').toBe('rgb(112, 225, 170)');
      expect(detail.items.favorite.color,theme+' yellow favorite').toBe('rgb(246, 210, 120)');
      expect(detail.items.delete.color,theme+' red deletion').toBe('rgb(255, 158, 169)');
      for (const key of ['done','favorite','delete']) expect(detail.items[key].shadow,theme+' '+key+' glow').toBe('none');

      // Capture a real rendered screenshot, not a generated illustration.
      if (theme === 'night-navy') await testInfo.attach('dark-detail-'+width+'.png', {
        body: await page.screenshot({animations:'disabled'}), contentType:'image/png'
      });
      await page.locator('#closeDetail').evaluate(el=>el.click());
    }
  });
}


// Ver.337: regression against the five user-provided screenshots. Audits
// computed styles on real UI, not synthetic cards or generated imagery.
for (const width of [1366, 390]) {
  test('Ver.337: flat details, unified chrome, outline bell and recurrence contrast at '+width+'px', async ({page}, testInfo) => {
    test.setTimeout(120000);
    await boot(page, width);
    const sample = async selectors => page.evaluate(selectors => {
      const probe = document.createElement('span');
      probe.style.cssText='background:var(--wb-dark-surface);color:var(--wb-dark-ink)';
      document.body.append(probe);
      const surface=getComputedStyle(probe).backgroundColor;
      const ink=getComputedStyle(probe).color;
      probe.remove();
      const styles={};
      for(const [key, selector] of Object.entries(selectors)){
        const el=document.querySelector(selector);
        if(!el){styles[key]={missing:true};continue;}
        const cs=getComputedStyle(el);
        styles[key]={
          background:cs.backgroundColor,color:cs.color,image:cs.backgroundImage,
          borderLeft:cs.borderLeftStyle,borderTop:cs.borderTopStyle,
          borderBottom:cs.borderBottomStyle,shadow:cs.boxShadow,
          text:el.textContent?.trim().slice(0,100)
        };
      }
      return {surface, ink,styles};
    }, selectors);
    for(const theme of DARK_THEMES) {
      await selectTheme(page,theme);
      await page.locator('.nav-item[data-layout="tasks"]').first().evaluate(el=>el.click());
      const chrome=await sample({
        toolbar:'.task-control-row',
        switcher:'.task-control-row .task-view-switcher',
        segments:'.task-control-row .task-view-buttons',
        stats:'.task-control-row .stat-switcher',
        active:'.task-control-row .task-view-button.active'
      });
      expect(chrome.styles.toolbar.background,theme+' toolbar').toBe(chrome.surface);
      for(const key of ['switcher','segments','stats']) {
        expect(chrome.styles[key]?.missing,theme+' '+key).toBeFalsy();
        expect(chrome.styles[key].background,theme+' old background island: '+key).toBe('rgba(0, 0, 0, 0)');
      }

      await page.locator('#newTask').evaluate(el=>el.click());
      await expect(page.locator('#taskDialog')).toBeVisible();
      await page.locator('#taskRecurrence').selectOption('monthlyDay');
      await expect(page.locator('#recurrenceOptions')).toBeVisible();
      await expect(page.locator('#recurrencePreview')).toContainText('期限日を指定すると');
      const repeat=await sample({
        group:'#taskDialog .recurrence-options',
        heading:'#taskDialog .recurrence-help strong',
        helper:'#taskDialog .recurrence-help span',
        preview:'#taskDialog .recurrence-preview',
        interval:'#taskDialog .recurrence-grid > label',
        monthLabel:'#taskDialog #monthlyDayOptions label'
      });
      expect(repeat.styles.group.background,theme+' recurrence slab').toBe(repeat.surface);
      expect(repeat.styles.preview.background,theme+' white recurrence preview').toBe(repeat.surface);
      expect(repeat.styles.heading.color,theme+' recurrence heading').toBe(repeat.ink);
      for(const key of ['heading','helper','preview','interval','monthLabel']) {
        const item=repeat.styles[key];
        expect(item?.missing,theme+' '+key).toBeFalsy();
        const bg=repeat.surface;
        const contrast=await page.evaluate(({fg,bg})=>{
          const numbers=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(x=>Number(x)/255);
          const lum=s=>numbers(s).map(v=>v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4))
            .reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
          const a=lum(fg),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
        },{fg:item.color,bg});
        expect(contrast,theme+' insufficient contrast '+key).toBeGreaterThanOrEqual(4.5);
      }
      if(theme==='night-navy') {
        await testInfo.attach('recurrence-contrast-'+width+'.png',{
          body:await page.screenshot({animations:'disabled'}),contentType:'image/png'
        });
      }
      await page.locator('#closeTaskDialog').evaluate(el=>el.click());
      await expect(page.locator('#taskDialog')).toBeHidden();

      await page.waitForFunction(()=>Boolean(document.querySelector('[data-task-id="v335-theme-task"]')),undefined,{timeout:10000});
      await page.locator('[data-task-id="v335-theme-task"]').first().evaluate(el=>el.click());
      const detail=await sample({
        section:'#detailBody .task-detail-panel-v149[data-tab-panel="details"] > .detail-section',
        field:'#detailBody .field-card',
        check:'#detailBody .check-item',
        description:'#detailBody .description'
      });
      for(const key of ['section','field','check']) {
        expect(detail.styles[key]?.missing,theme+' '+key).toBeFalsy();
        expect(detail.styles[key].background,theme+' '+key+' should be flat').toBe('rgba(0, 0, 0, 0)');
      }
      expect(detail.styles.section.borderTop).toBe('solid');
      expect(detail.styles.field.borderLeft).toBe('solid');
      expect(detail.styles.check.borderBottom).toBe('solid');
      expect(detail.styles.description.color,theme+' detail ink').toBe(detail.ink);
      if(theme==='night-navy') {
        await testInfo.attach('flat-detail-'+width+'.png',{
          body:await page.screenshot({animations:'disabled'}),contentType:'image/png'
        });
      }
      await page.locator('#closeDetail').evaluate(el=>el.click());

      await page.locator('.nav-item[data-layout="today"]').first().evaluate(el=>el.click());
      const notice=await sample({
        notice:'#todayView .activity-panel',
        head:'#todayView .activity-head',
        helper:'#todayView .activity-head p',
        icon:'#todayView .activity-title-bell'
      });
      expect(notice.styles.notice.background,theme+' notice base').toBe(notice.surface);
      expect(notice.styles.head.background,theme+' notice header island').toBe('rgba(0, 0, 0, 0)');
      expect(notice.styles.icon.background,theme+' icon must be transparent').toBe('rgba(0, 0, 0, 0)');
      await expect(page.locator('#todayView .activity-title-bell svg.activity-bell-outline-v337')).toHaveCount(1);
      expect(notice.styles.icon.text).toBe('');
      expect(notice.styles.helper.color,theme+' announcement small text').not.toBe('rgb(95, 120, 144)');
      if(theme==='night-navy') {
        await testInfo.attach('notice-outline-'+width+'.png',{
          body:await page.screenshot({animations:'disabled'}),contentType:'image/png'
        });
      }
    }
  });
}
