import { test, expect } from '@playwright/test';

// Isolated browser/local storage; no production Firebase requests or writes.
const ROOM = 'test-palette-display-v358';
async function boot(page, width = 1366) {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === 'http://127.0.0.1:4173'
      ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(({room}) => {
    Object.defineProperty(window, 'firebaseConfig', {
      configurable:true, get(){return null;}, set(){}
    });
    localStorage.setItem('systemTaskUser', 'PaletteTester');
    localStorage.setItem('systemTaskRoomId', room);
  }, {room:ROOM});
  await page.goto('/?room=' + ROOM, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, {timeout:30000});
  await expect(page.locator('#wbDisplayChoiceV356 [data-wb-display-choice]')).toHaveCount(3);
}
async function choose(page, id) {
  const button = page.locator('[data-wb-display-choice="' + id + '"]');
  await button.evaluate(el => el.click());
  await expect(page.locator('html')).toHaveAttribute('data-wb-display', id);
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

test('Palette is a per-user opt-in design using canonical Today/ToDo/actions', async ({page}) => {
  test.setTimeout(90000);
  await boot(page);
  await expect(page.locator('html')).toHaveAttribute('data-wb-display', 'classic');
  const task = page.locator('#newTask');
  await choose(page, 'palette');
  await expect(page.locator('.wb-palette-wordmark-v358')).toBeVisible();
  // Palette must remain fully readable even when the old auto-collapse sidebar
  // considers itself collapsed. Its 52px icon-only CSS must not leak through.
  const sidebar = await page.locator('.sidebar').evaluate(el => ({
    width: Math.round(el.getBoundingClientRect().width),
    navFont: Number.parseFloat(getComputedStyle(el.querySelector('.nav-item[data-layout="today"]')).fontSize),
    userDisplay: getComputedStyle(el.querySelector('.user-card')).display
  }));
  expect(sidebar.width).toBeGreaterThanOrEqual(216);
  expect(sidebar.navFont).toBeGreaterThanOrEqual(14);
  expect(sidebar.userDisplay).not.toBe('none');

  await expect(page.locator('#todayView')).toBeVisible();
  await expect(page.locator('#todayView > .today-grid')).toHaveCount(1);
  await expect(page.locator('#todayView > .today-todo-preview')).toHaveCount(1);
  await expect(page.locator('#todayView > .activity-panel')).toHaveCount(1);
  await expect(page.locator('#todayView .activity-panel [data-mark-activity-read]')).toHaveCount(1);
  const presentation = await page.locator('#todayView').evaluate(el => ({
    display: getComputedStyle(el).display,
    areas: getComputedStyle(el).gridTemplateAreas,
    columns: getComputedStyle(el).gridTemplateColumns
  }));
  expect(presentation.display).toBe('grid');
  expect(presentation.areas).toContain('todos');
  expect(presentation.areas).toContain('tasks');
  await task.evaluate(el => el.click());
  await expect(page.locator('#taskDialog')).toBeVisible();
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el => el.click());
  await expect(page.locator('html')).toHaveAttribute('data-wb-display', 'palette');
  await page.locator('#closeTaskDialog').evaluate(el => el.click());
  await choose(page, 'modern');
  await expect(page.locator('.wb-palette-wordmark-v358')).toBeHidden();
  await choose(page, 'palette');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true,undefined,{timeout:30000});
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','palette');
  await page.evaluate(() => {
    localStorage.setItem('systemTaskUser','OtherPaletteTester');
    dispatchEvent(new StorageEvent('storage',{key:'systemTaskUser',newValue:'OtherPaletteTester'}));
  });
  await expect(page.locator('html')).toHaveAttribute('data-wb-display','classic');
});

test('Palette mobile tabs and creation menu forward to existing handlers', async ({page}) => {
  test.setTimeout(90000);
  await boot(page,390);
  await page.locator('.work-mobile-menu-button').waitFor();
  await choose(page,'palette');
  const dock = page.locator('#wbPaletteMobileDockV358');
  await expect(dock).toBeVisible();
  await expect(dock.locator('[data-palette-route]')).toHaveCount(5);
  await expect(dock.locator('[data-palette-route="today"]')).toHaveAttribute('aria-current','page');
  await dock.locator('[data-palette-route="todos"]').click();
  await expect(page.locator('body')).toHaveClass(/todo-mode/);
  await dock.locator('[data-palette-route="schedule"]').click();
  await expect(page.locator('body')).toHaveClass(/schedule-mode/);
  await dock.locator('[data-palette-route="today"]').click();
  const fab = page.locator('.wb-palette-fab-v358');
  await expect(fab).toBeVisible();
  await fab.click();
  await expect(fab).toHaveAttribute('aria-expanded','true');
  await page.locator('[data-palette-create="task"]').click();
  await expect(page.locator('#taskDialog')).toBeVisible();
  await page.locator('#closeTaskDialog').evaluate(el=>el.click());
  await fab.click();
  await page.locator('[data-palette-create="schedule"]').click();
  await expect(page.locator('#scheduleDialog')).toBeVisible();
  await page.locator('#closeScheduleDialog').evaluate(el=>el.click());
  // Palette quick add routes to the canonical ToDo form and memo dialog.
  await fab.click();
  await expect(page.locator('[data-palette-create="todo"]')).toBeVisible();
  await page.locator('[data-palette-create="todo"]').click();
  await expect(page.locator('body')).toHaveClass(/todo-mode/);
  await expect(page.locator('#todayTodoInput')).toBeFocused();
  await fab.click();
  await expect(page.locator('[data-palette-create="memo"]')).toBeEnabled();
  await page.locator('[data-palette-create="memo"]').click();
  await expect(page.locator('#workMemoDialogV167')).toBeVisible();
  await page.locator('#workMemoDialogV167 [data-memo-close]').first().click();
  await dock.locator('[data-palette-route="more"]').click();
  await expect(page.locator('body')).toHaveClass(/work-mobile-menu-open/);
  await page.locator('.work-mobile-menu-button').click();
  await choose(page,'classic');
  await expect(dock).toBeHidden();
  await expect(fab).toBeHidden();
});

test('Palette responds to dark and pastel palettes without changing semantic values',async({page})=>{
  await boot(page);
  await choose(page,'palette');
  const values=await page.evaluate(()=>{
    const root=document.documentElement;
    const result=[];
    for(const [theme,mode] of [['pastel-mint','light'],['night-plum','dark']]){
      root.dataset.wbColorTheme=theme;
      root.dataset.wbColorMode=mode;
      const style=selector=>getComputedStyle(document.querySelector(selector));
      result.push({
        theme,mode,body:style('body').backgroundColor,
        sidebar:style('.sidebar').backgroundColor,
        todo:style('.today-todo-preview').backgroundColor,
        ink:style('.today-todo-preview').color,
        rootMode:root.dataset.wbDisplay
      });
    }
    return result;
  });
  for(const item of values){
    expect(item.rootMode).toBe('palette');
    expect(item.body).not.toBe('rgba(0, 0, 0, 0)');
    expect(item.todo).not.toBe(item.ink);
    expect(item.sidebar).not.toBe('rgba(0, 0, 0, 0)');
  }
  expect(values[0].body).not.toBe(values[1].body);
});

for (const width of [1366, 390]) {
  test('Palette workspaces use compact responsive layouts at ' + width + 'px', async ({page}) => {
    await boot(page, width);
    await choose(page, 'palette');

    await page.locator('.nav-item[data-layout="todos"]').evaluate(el => el.click());
    await expect(page.locator('#todoView')).toBeVisible();
    const todo = await page.evaluate(() => {
      const stats = document.querySelector('.todo-page-stat-card');
      const lists = document.querySelector('.todo-lists');
      return {
        statsHeight: stats?.getBoundingClientRect().height,
        columns: getComputedStyle(lists).gridTemplateColumns.split(' ').length,
        hasCanonicalInput: Boolean(document.querySelector('#todayTodoInput'))
      };
    });
    expect(todo.hasCanonicalInput).toBe(true);
    expect(todo.statsHeight).toBeLessThan(106);
    expect(todo.columns).toBe(width > 860 ? 2 : 1);

    await page.locator('.nav-item[data-layout="tasks"]').evaluate(el => el.click());
    await page.locator('[data-task-layout="board"]').first().evaluate(el => el.click());
    await expect(page.locator('#boardView')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/task-mode/);
    const task = await page.evaluate(() => ({
      display: getComputedStyle(document.querySelector('#boardView')).display,
      columns: getComputedStyle(document.querySelector('#boardView')).gridTemplateColumns.split(' ').length
    }));
    expect(task.display).toBe('grid');
    expect(task.columns).toBeGreaterThanOrEqual(1);

    await page.locator('.nav-item[data-layout="schedule"]').evaluate(el => el.click());
    await expect(page.locator('#scheduleView')).toBeVisible();
    const schedule = await page.locator('.schedule-toolbar-v176').evaluate(el => ({
      display: getComputedStyle(el).display,
      color: getComputedStyle(el).backgroundColor
    }));
    expect(schedule.display).toBe('grid');
    expect(schedule.color).not.toBe('rgba(0, 0, 0, 0)');

    await page.locator('[data-work-memo-layout]').evaluate(el => el.click());
    await expect(page.locator('#workMemoViewV167')).toBeVisible();
    await expect(page.locator('#workMemoViewV167 [data-memo-search]')).toHaveCount(1);
    const memo = await page.locator('#workMemoViewV167 .work-memo-tools-v167').evaluate(el => ({
      columns: getComputedStyle(el).gridTemplateColumns.split(' ').length,
      color: getComputedStyle(el).backgroundColor
    }));
    expect(memo.columns).toBe(width > 860 ? 3 : 1);
    expect(memo.color).not.toBe('rgba(0, 0, 0, 0)');
  });
}


test('Palette follows every selected light/dark accent with readable primary controls', async ({page}) => {
  await boot(page, 390);
  await choose(page, 'palette');

  const themes = [
    'default','sky','lavender','mint','rose','peach','amber','slate',
    'pastel-blue','pastel-lilac','pastel-mint','pastel-rose','pastel-peach','pastel-lemon',
    'pure-blue','pure-red','pure-green','pure-yellow','pure-orange','pure-purple','pure-cyan','pure-pink',
    'night-navy','night-charcoal','night-forest','night-plum','night-mocha'
  ];
  const results = await page.evaluate(themes => {
    const root = document.documentElement;
    const fab = document.querySelector('.wb-palette-fab-v358');
    const sample = [];
    for (const theme of themes) {
      const dark = theme.startsWith('night-');
      root.dataset.wbColorTheme = theme;
      root.dataset.wbColorMode = dark ? 'dark' : 'light';
      const roles = getComputedStyle(root);
      const buttonStyle = getComputedStyle(fab);
      sample.push({
        theme, dark,
        accent: roles.getPropertyValue('--palette-accent').trim(),
        selectedAccent: roles.getPropertyValue('--wb-theme-accent').trim(),
        onAccent: roles.getPropertyValue('--palette-on-accent').trim(),
        darkCanvas: roles.getPropertyValue('--wb-dark-canvas').trim(),
        pageColor: getComputedStyle(document.body).backgroundColor,
        paperColor: getComputedStyle(document.querySelector('.sidebar')).backgroundColor,
        fabColor: buttonStyle.backgroundColor,
        fabInk: buttonStyle.color,
        colorScheme: roles.colorScheme
      });
    }
    return sample;
  }, themes);

  const luminance = hex => {
    let text = hex.trim().replace(/^#/, '');
    if (text.length === 3) text = text.split('').map(c => c+c).join('');
    expect(text).toMatch(/^[\da-f]{6}$/i);
    const rgb = [0,2,4].map(i => parseInt(text.slice(i,i+2),16)/255);
    const linear = rgb.map(c => c <= 0.04045 ? c/12.92 : ((c+0.055)/1.055)**2.4);
    return linear[0]*0.2126 + linear[1]*0.7152 + linear[2]*0.0722;
  };
  const contrast = (one,two) => {
    const a = luminance(one), b = luminance(two);
    return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
  };

  for (const item of results) {
    if (item.theme !== 'default') expect(item.accent, item.theme+' accent').toBe(item.selectedAccent);
    expect(item.colorScheme, item.theme+' color-scheme').toBe(item.dark ? 'dark' : 'light');
    expect(contrast(item.accent,item.onAccent), item.theme+' accent control contrast').toBeGreaterThanOrEqual(4.5);
    expect(item.pageColor).not.toBe(item.paperColor);
    expect(item.fabInk).not.toBe(item.fabColor);
    if (item.dark) expect(item.onAccent, item.theme+' dark label').toBe(item.darkCanvas);
  }
  const darkSamples = results.filter(x => x.dark);
  expect(new Set(darkSamples.map(x => x.pageColor)).size).toBe(5);
  expect(new Set(darkSamples.map(x => x.paperColor)).size).toBe(5);
  expect(new Set(darkSamples.map(x => x.fabColor)).size).toBe(5);
  const lightSamples = results.filter(x => !x.dark && x.theme !== 'default');
  expect(new Set(lightSamples.map(x => x.pageColor)).size).toBeGreaterThanOrEqual(14);
});
