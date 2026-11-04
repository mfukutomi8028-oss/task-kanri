import { test, expect } from '@playwright/test';

const ROOM = 'test-modern-live-v356';

async function boot(page, width = 1366) {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === 'http://127.0.0.1:4173'
      ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(({ room }) => {
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
    localStorage.setItem('systemTaskUser', 'ModernTester');
    localStorage.setItem('systemTaskRoomId', room);
  }, { room: ROOM });
  await page.goto('/?room=' + ROOM, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, {
    timeout: 30000
  });
  await expect(page.locator('#wbDisplayChoiceV356')).toHaveCount(1);
  await expect(page.locator('#wbColorThemeButton')).toHaveCount(1);
}

async function setMode(page, name) {
  const choice = page.locator('[data-wb-display-choice="' + name + '"]');
  await choice.evaluate(el => el.click());
  await expect(page.locator('html')).toHaveAttribute('data-wb-display', name);
  await expect(choice).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-wb-display-choice="' +
    (name === 'classic' ? 'modern' : 'classic') + '"]')).toHaveAttribute('aria-pressed', 'false');
}

test('Modern is opt-in, persists per room/user and uses the same live views and dialogs', async ({page}) => {
  test.setTimeout(90000);
  await boot(page);
  await expect(page.locator('html')).toHaveAttribute('data-wb-display', 'classic');
  const initialTaskId = await page.locator('#newTask').evaluate(el => el.id);
  await setMode(page, 'modern');
  expect(await page.locator('#newTask').evaluate(el => el.id)).toBe(initialTaskId);
  const layout = await page.evaluate(() => ({
    hero: getComputedStyle(document.querySelector('.hero')).backgroundColor,
    sidebar: getComputedStyle(document.querySelector('.sidebar')).backgroundColor,
    panel: getComputedStyle(document.querySelector('.summary-card')).backgroundColor
  }));
  expect(layout.hero).not.toBe('rgba(0, 0, 0, 0)');
  expect(layout.sidebar).not.toBe('rgba(0, 0, 0, 0)');
  expect(layout.panel).not.toBe('rgba(0, 0, 0, 0)');

  // Classic remains the single navigation/data owner in Modern mode.
  await page.locator('.nav-item[data-layout="tasks"]').evaluate(el => el.click());
  await expect(page.locator('body')).toHaveClass(/task-mode/);
  await page.locator('#newTask').evaluate(el => el.click());
  await expect(page.locator('#taskDialog')).toBeVisible();
  await page.locator('[data-wb-display-choice="classic"]').evaluate(el => el.click());
  await expect(page.locator('html')).toHaveAttribute('data-wb-display', 'modern');
  await page.locator('#closeTaskDialog').evaluate(el => el.click());
  await expect(page.locator('#taskDialog')).toBeHidden();
  await setMode(page, 'classic');
  await expect(page.locator('body')).toHaveClass(/task-mode/);
  await setMode(page, 'modern');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, {
    timeout: 30000
  });
  await expect(page.locator('html')).toHaveAttribute('data-wb-display', 'modern');

  // A different local user in the same room is Classic by default.
  await page.evaluate(() => {
    localStorage.setItem('systemTaskUser', 'AnotherModernUser');
    window.dispatchEvent(new StorageEvent('storage', { key:'systemTaskUser', newValue:'AnotherModernUser' }));
  });
  await expect(page.locator('html')).toHaveAttribute('data-wb-display', 'classic');
  await page.evaluate(() => {
    localStorage.setItem('systemTaskUser', 'ModernTester');
    window.dispatchEvent(new StorageEvent('storage', { key:'systemTaskUser', newValue:'ModernTester' }));
  });
  await expect(page.locator('html')).toHaveAttribute('data-wb-display', 'modern');
});

for (const width of [390, 768]) {
  test('Modern responsive navigation and accessible filters at ' + width + 'px', async ({page}) => {
    await boot(page, width);
    await setMode(page, 'modern');
    const toggle = page.locator('#wbModernFiltersToggleV356');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.sidebar .side-card.filters')).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.sidebar .side-card.filters')).toBeVisible();
    await page.locator('.nav-item[data-layout="schedule"]').evaluate(el => el.click());
    await expect(page.locator('body')).toHaveClass(/schedule-mode/);
    await expect(page.locator('#scheduleView')).toBeVisible();
    await setMode(page, 'classic');
    await expect(page.locator('.sidebar .side-card.filters')).toBeVisible();
  });
}

test('Modern reuses all 8 pure, 6 pastel and 5 dark themes with readable surfaces', async ({page}) => {
  test.setTimeout(120000);
  await boot(page);
  await setMode(page, 'modern');
  const palettes = [
    'pure-blue','pure-red','pure-green','pure-yellow',
    'pure-orange','pure-purple','pure-cyan','pure-pink',
    'pastel-blue','pastel-lilac','pastel-mint','pastel-rose','pastel-peach','pastel-lemon',
    'night-navy','night-charcoal','night-forest','night-plum','night-mocha'
  ];
  const read = await page.evaluate(names => names.map(name => {
    const root = document.documentElement;
    root.dataset.wbColorTheme = name;
    root.dataset.wbColorMode = name.startsWith('night-') ? 'dark' : 'light';
    const pick = selector => {
      const element = document.querySelector(selector);
      const css = getComputedStyle(element);
      return { bg: css.backgroundColor, color: css.color };
    };
    return {
      name,
      body: pick('body'),
      hero: pick('.hero'),
      sidebar: pick('.sidebar'),
      card: pick('.summary-card'),
      button: pick('#newTask'),
      mode: root.dataset.wbDisplay
    };
  }), palettes);
  for (const item of read) {
    expect(item.mode).toBe('modern');
    expect(item.body.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(item.hero.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(item.card.bg).not.toBe('rgba(0, 0, 0, 0)');
  }
  await expect(page.locator('html')).toHaveAttribute('data-wb-display', 'modern');
});
