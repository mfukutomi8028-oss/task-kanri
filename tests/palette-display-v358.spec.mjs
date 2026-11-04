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
