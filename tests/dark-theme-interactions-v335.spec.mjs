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
