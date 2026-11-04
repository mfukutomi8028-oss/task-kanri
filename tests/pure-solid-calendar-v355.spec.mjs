import { test, expect } from '@playwright/test';

const ROOM = 'test-solid-theme-v355';
const PURE = [
  'pure-blue', 'pure-red', 'pure-green', 'pure-yellow',
  'pure-orange', 'pure-purple', 'pure-cyan', 'pure-pink'
];
const LIGHT = [
  'sky', 'lavender', 'mint', 'rose', 'peach', 'amber', 'slate',
  'pastel-blue', 'pastel-lilac', 'pastel-mint',
  'pastel-rose', 'pastel-peach', 'pastel-lemon', ...PURE
];

async function boot(page, width) {
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
    localStorage.setItem('systemTaskUser', 'SolidThemeTester');
    localStorage.setItem('systemTaskRoomId', room);
  }, { room: ROOM });
  await page.goto('/?room=' + ROOM, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30000 });
  await expect(page.locator('#wbColorThemeButton')).toHaveCount(1);
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'solid-v355-fixture';
    host.style.cssText = 'position:absolute;left:-16000px;top:0;width:1100px';
    host.innerHTML = `
      <section class="schedule-calendar">
        <div class="calendar-head"><h4>2026年11月</h4></div>
        <div class="calendar-weekdays">
          <span class="sunday">日</span><span>月</span><span>火</span>
          <span>水</span><span>木</span><span>金</span><span class="saturday">土</span>
        </div>
        <div class="calendar-grid">
          <div class="calendar-cell weekday"><div class="calendar-date">2</div></div>
          <div class="calendar-cell saturday"><div class="calendar-date saturday">7</div></div>
          <div class="calendar-cell holiday"><div class="calendar-date holiday">1</div></div>
          <div class="calendar-cell today"><div class="calendar-date">4</div></div>
          <div class="calendar-cell muted"></div>
        </div>
        <button class="calendar-schedule"><span>14:00</span>予定</button>
      </section>
      <section class="todo-workspace">
        <div class="todo-create-form"><input placeholder="追加内容" /></div>
        <div class="todo-list"><div class="todo-item"><span class="todo-text">備品の確認</span></div></div>
      </section>
      <div class="today-panel"><h3>今日</h3></div>
      <div class="board-column"><div class="column-head">対応中</div></div>
      <button class="primary-button">保存する</button>
    `;
    document.body.appendChild(host);
  });
}
async function readColors(page) {
  return page.evaluate(() => {
    const css = selector => getComputedStyle(document.querySelector(selector));
    const v = (selector, prop) => css(selector).getPropertyValue(prop).trim();
    const parse = value => {
      const input = String(value || '');
      const match = input.match(/rgba?\(([^)]+)\)/);
      if (match) return match[1].split(/[,\s/]+/).filter(Boolean).slice(0, 3).map(Number);
      const srgb = input.match(/^color\(srgb\s+([^)]*)\)$/);
      if (srgb) return srgb[1].split(/\s+/).slice(0, 3).map(n => Number(n) * 255);
      throw new Error('Color could not be parsed: ' + input);
    };
    const luminance = input => {
      const c = parse(input).map(n => {
        const n01 = n / 255;
        return n01 <= .04045 ? n01 / 12.92 : ((n01 + .055) / 1.055) ** 2.4;
      });
      return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
    };
    const contrast = (a, b) => {
      const la = luminance(a), lb = luminance(b);
      return (Math.max(la, lb) + .05) / (Math.min(la, lb) + .05);
    };
    const src = '#solid-v355-fixture ';
    const heroBg = v('.hero', 'background-color');
    const heroText = v('.hero h2', 'color');
    const buttonBg = v(src + '.primary-button', 'background-color');
    const buttonText = v(src + '.primary-button', 'color');
    const bodyBg = v('body', 'background-color');
    const cardBg = v(src + '.todo-workspace .todo-item', 'background-color');
    const inputBg = v(src + '.todo-workspace input', 'background-color');
    const label = v(src + '.todo-workspace .todo-text', 'color');
    return {
      theme: document.documentElement.dataset.wbColorTheme,
      mode: document.documentElement.dataset.wbColorMode,
      background: bodyBg,
      hero: heroBg,
      heroImage: v('.hero', 'background-image'),
      sidebar: v('.sidebar', 'background-color'),
      sidebarImage: v('.sidebar', 'background-image'),
      heroContrast: contrast(heroBg, heroText),
      buttonContrast: contrast(buttonBg, buttonText),
      cardLuminance: luminance(cardBg),
      inputLuminance: luminance(inputBg),
      pageLuminance: luminance(bodyBg),
      cardContrast: contrast(cardBg, label),
      weekday: v(src + '.calendar-cell.weekday', 'background-color'),
      saturday: v(src + '.calendar-cell.saturday', 'background-color'),
      holiday: v(src + '.calendar-cell.holiday', 'background-color'),
      today: v(src + '.calendar-cell.today', 'background-color'),
      muted: v(src + '.calendar-cell.muted', 'background-color'),
      saturdayInk: v(src + '.calendar-date.saturday', 'color'),
      holidayInk: v(src + '.calendar-date.holiday', 'color'),
      event: v(src + '.calendar-schedule', 'background-color')
    };
  });
}

test('Ver.355: all 21 nondefault light palettes have white weekday calendar cells', async ({page}) => {
  test.setTimeout(120000);
  await boot(page, 1366);
  let expected;
  for (const theme of LIGHT) {
    await page.evaluate(name => {
      document.documentElement.dataset.wbColorTheme = name;
      document.documentElement.dataset.wbColorMode = 'light';
    }, theme);
    const c = await readColors(page);
    expect(c.weekday, theme + ' weekday is neutral').toBe('rgb(255, 255, 255)');
    expect(c.saturday, theme + ' weekend is pale blue').toBe('rgb(246, 250, 255)');
    expect(c.holiday, theme + ' Sunday/holiday is pale red').toBe('rgb(255, 248, 249)');
    expect(c.today, theme + ' today is yellow').toBe('rgb(255, 251, 232)');
    expect(c.muted, theme + ' outside-month is neutral').toBe('rgb(247, 248, 250)');
    if (expected) {
      expect(c.saturdayInk, theme + ' Saturday blue text').toBe(expected.saturdayInk);
      expect(c.holidayInk, theme + ' holiday red text').toBe(expected.holidayInk);
    } else expected = c;
  }
});

test('Ver.355: all eight pure palettes are flat, neutral on cards and WCAG AA readable', async ({page}) => {
  test.setTimeout(120000);
  await boot(page, 1366);
  const samples = [];
  for (const theme of PURE) {
    await page.locator('#wbColorThemeButton').evaluate(el => el.click());
    const picker = page.locator('#wbColorThemeDialog');
    await expect(picker).toBeVisible();
    await picker.locator('[data-theme="' + theme + '"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme', theme);
    await picker.locator('.wb-color-theme-close').click();
    const c = await readColors(page);
    expect(c.mode, theme).toBe('light');
    expect(c.heroImage, theme + ' flat hero').toBe('none');
    expect(c.sidebarImage, theme + ' flat sidebar').toBe('none');
    expect(c.hero, theme + ' sidebar/hero match').toBe(c.sidebar);
    expect(c.pageLuminance, theme + ' paper page, not saturated').toBeGreaterThanOrEqual(.90);
    expect(c.cardLuminance, theme + ' card stays light').toBeGreaterThanOrEqual(.92);
    expect(c.inputLuminance, theme + ' input stays light').toBeGreaterThanOrEqual(.92);
    expect(c.heroContrast, theme + ' WCAG AA banner').toBeGreaterThanOrEqual(4.5);
    expect(c.buttonContrast, theme + ' WCAG AA CTA').toBeGreaterThanOrEqual(4.5);
    expect(c.cardContrast, theme + ' readable task row').toBeGreaterThanOrEqual(7);
    expect(c.weekday).toBe('rgb(255, 255, 255)');
    samples.push(c.hero);
  }
  expect(new Set(samples).size).toBe(8);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, {timeout:30000});
  await expect(page.locator('html')).toHaveAttribute('data-wb-color-theme', 'pure-pink');
});

test('Ver.355: original and dark themes retain their existing calendar design', async ({page}) => {
  await boot(page, 1366);
  await page.evaluate(() => {
    document.documentElement.dataset.wbColorTheme = 'default';
    document.documentElement.dataset.wbColorMode = 'light';
  });
  const original = await readColors(page);
  expect(original.heroImage).toContain('linear-gradient');
  await page.evaluate(() => {
    document.documentElement.dataset.wbColorTheme = 'night-navy';
    document.documentElement.dataset.wbColorMode = 'dark';
  });
  const dark = await readColors(page);
  expect(dark.weekday).not.toBe('rgb(255, 255, 255)');
  expect(dark.mode).toBe('dark');
  await page.evaluate(() => {
    document.documentElement.dataset.wbColorTheme = 'default';
    document.documentElement.dataset.wbColorMode = 'light';
  });
  const restored = await readColors(page);
  expect(restored.heroImage).toBe(original.heroImage);
  expect(restored.weekday).toBe(original.weekday);
});
