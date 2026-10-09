import { test, expect } from '@playwright/test';

const ROOM = 'test-inbox-keyboard-focus-v372';
const USER = 'QA372';
const ID = 'focus-event';
const READ = `[data-inbox-read-v153="${ID}"]`;

const ENTRY = '[data-open-personal-inbox-v153]';
const CLOSE = 'button[data-close-inbox-v153]';
const PANEL = '.workflow-drawer-v152';
const SHELL = '.workflow-inbox-shell-v153';

async function ready(page) {
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true);
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === window.WORK_BOARD_RELEASE.version);

}

async function boot(page, width) {
  await page.setViewportSize({ width, height: width > 860 ? 900 : 844 });
  // No production network access, including Firebase SDK and database endpoints.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === 'http://127.0.0.1:4173' ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(({ room, user, id }) => {
    Object.defineProperty(window, 'firebaseConfig', { configurable: true, get() { return null; }, set() {} });
    const seeded = 'test-inbox-v372-seeded';
    if (localStorage.getItem(seeded)) return;
    localStorage.clear();
    const now = Date.now();
    localStorage.setItem('systemTaskUser', user);
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-users:${room}`, JSON.stringify([user, 'Peer372']));
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([{
      id: 'task-372', title: 'Inbox feedback test task', status: '\u672a\u7740\u624b',
      assignee: user, requester: '', category: '\u305d\u306e\u4ed6', priority: '\u4e2d',
      tags: [], description: '', checklist: [], recurrence: 'none', dueDate: '', dueTime: '',
      pinned: false, completedAt: 0, completedMemo: '', comments: [], history: [], revision: 1,
      createdBy: user, updatedBy: user, createdAt: now - 1000, updatedAt: now
    }]));
    localStorage.setItem(`work-board-workflow-v152:${room}`, JSON.stringify({
      inbox: { [user]: { [id]: { taskId: 'task-372', type: 'mention', title: 'Inbox test notification',
        body: 'Please check the task', actor: 'Peer372', createdAt: now, readAt: 0 } } },
      archives: {}, duplicates: {}
    }));
    localStorage.setItem(seeded, '1');
  }, { room: ROOM, user: USER, id: ID });
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await ready(page);
  await expect(page.locator(ENTRY)).toBeVisible();
}


async function openKeyboard(page) {
  await page.locator(ENTRY).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(CLOSE)).toBeFocused();
}

async function expectInside(page) {
  await expect.poll(() => page.locator(PANEL).evaluate(node => node.contains(document.activeElement))).toBe(true);
}

for (const width of [1366, 390]) {
  test(`Ver.372 keyboard modal boundary and listener lifecycle (${width}px)`, async ({ page }) => {
    await page.addInitScript(() => {
      const active = new Set();
      const add = EventTarget.prototype.addEventListener;
      const remove = EventTarget.prototype.removeEventListener;
      const owned = (target, type, listener) => target === document &&
        ((type === 'keydown' && listener?.name === 'handleInboxKeydown') ||
         (type === 'focusin' && listener?.name === 'handleInboxFocus'));
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (owned(this, type, listener)) active.add(listener);
        return add.call(this, type, listener, options);
      };
      EventTarget.prototype.removeEventListener = function(type, listener, options) {
        if (owned(this, type, listener)) active.delete(listener);
        return remove.call(this, type, listener, options);
      };
      window.__inboxBindings372 = active;
    });
    await boot(page, width);
    expect(await page.evaluate(() => window.__inboxBindings372.size)).toBe(0);
    for (let cycle = 0; cycle < 2; cycle++) {
      await openKeyboard(page);
      await expect(page.locator('.app-shell')).toHaveAttribute('inert', '');
      if (width <= 860) await expect(page.locator('#workMobileHeader')).toHaveAttribute('inert', '');
      expect(await page.evaluate(() => window.__inboxBindings372.size)).toBe(2);
      await page.locator(ENTRY).dispatchEvent('click'); // repeated open must not duplicate ownership
      expect(await page.evaluate(() => window.__inboxBindings372.size)).toBe(2);
      await page.keyboard.press('Shift+Tab');
      await expect(page.locator(READ)).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.locator(CLOSE)).toBeFocused();
      for (let n = 0; n < 12; n++) { await page.keyboard.press('Tab'); await expectInside(page); }
      // A programmatic attempt to focus the inert background cannot escape the modal.
      await page.locator(ENTRY).evaluate(node => node.focus());
      await expectInside(page);
      await page.keyboard.press('Escape');
      await expect(page.locator(SHELL)).toBeHidden();
      await expect(page.locator(ENTRY)).toBeFocused();
      await expect(page.locator('.app-shell')).not.toHaveAttribute('inert', '');
      if (width <= 860) await expect(page.locator('#workMobileHeader')).not.toHaveAttribute('inert', '');
      expect(await page.evaluate(() => window.__inboxBindings372.size)).toBe(0);
    }
  });

  test(`Ver.372 live redraw and read removal preserve a usable focus (${width}px)`, async ({ page }) => {
    await boot(page, width);
    await openKeyboard(page);
    await page.locator(READ).focus();
    await page.evaluate(({ user, id }) => {
      window.WorkBoardWorkflowV152.v152.inbox[user][id].body = 'Live focus update';
      window.dispatchEvent(new CustomEvent('workflow-v152-update'));
    }, { user: USER, id: ID });
    await expect(page.locator('[data-inbox-list-v153]')).toContainText('Live focus update');
    await expect(page.locator(READ)).toBeFocused();
    await page.keyboard.press('Enter'); // canonical read API, no persistence stub
    await expect(page.locator(READ)).toHaveCount(0);
    await expect(page.locator('[data-inbox-filter-v153="unread"]')).toBeFocused();
    await page.locator(CLOSE).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('[data-mark-all-v153]')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator(CLOSE)).toBeFocused();
    await page.locator('[data-inbox-filter-v153="all"]').click();
    await expect(page.locator(READ)).toBeEnabled();
    await page.locator(READ).focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(id => window.WorkBoardWorkflowV152.inboxFor()[id].readAt, ID)).toBe(0);
    await expectInside(page);
    await page.keyboard.press('Escape');
    await expect(page.locator(ENTRY)).toBeFocused();
  });

  test(`Ver.372 close preserves pre-existing inert state and finds rebuilt opener (${width}px)`, async ({ page }) => {
    await boot(page, width);
    // This is a known mobile background root; preserve inert ownership from another UI.
    await page.evaluate(() => {
      let overlay = document.querySelector('.work-mobile-overlay');
      if (!overlay) { overlay = document.createElement('div'); overlay.className = 'work-mobile-overlay'; overlay.hidden = true; document.body.append(overlay); }
      overlay.inert = true;
    });
    await openKeyboard(page);
    await page.locator(ENTRY).evaluate(node => node.remove());
    await expect(page.locator(ENTRY)).toHaveCount(1); // real Today observer rebuilds the entry
    await page.locator(CLOSE).click();
    await expect(page.locator(ENTRY)).toBeFocused();
    await expect(page.locator('.work-mobile-overlay')).toHaveAttribute('inert', '');
    await openKeyboard(page);
    if (width > 860) await page.locator('.workflow-drawer-backdrop-v152').click({ position: { x: 8, y: 8 } });
    else await page.locator(CLOSE).click(); // mobile panel fills the screen; do not force a covered backdrop click
    await expect(page.locator(SHELL)).toBeHidden();
    await expect(page.locator(ENTRY)).toBeFocused();
    await expect(page.locator('.app-shell')).not.toHaveAttribute('inert', '');
  });

  test(`Ver.372 native dialog and status layer are not trapped behind inbox (${width}px)`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await boot(page, width);
    await openKeyboard(page);
    await page.evaluate(() => {
      const status = document.createElement('div'); status.id = 'inbox-status-372'; status.role = 'status';
      status.textContent = 'Test-only save feedback'; document.body.append(status);
      const dialog = document.createElement('dialog'); dialog.id = 'nested-native-372';
      dialog.innerHTML = '<button autofocus>Native dialog action</button>';
      document.body.append(dialog); dialog.showModal();
    });
    await expect(page.locator('#nested-native-372 button')).toBeFocused();
    expect(await page.locator('#inbox-status-372').evaluate(node => Boolean(node.closest('[inert]')))).toBe(false);
    await page.keyboard.press('Escape');
    await expect(page.locator('#nested-native-372')).not.toHaveAttribute('open', '');
    await expect(page.locator(SHELL)).toBeVisible();
    await page.locator(CLOSE).focus();
    await page.keyboard.press('Escape');
    await expect(page.locator(ENTRY)).toBeFocused();
    expect(errors).toEqual([]);
  });

  test(`Ver.372 notification still opens the task and releases background (${width}px)`, async ({ page }) => {
    await boot(page, width);
    await openKeyboard(page);
    await page.locator(`[data-inbox-open-v153="${ID}"]`).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator(SHELL)).toBeHidden();
    await expect(page.locator('.app-shell')).not.toHaveAttribute('inert', '');
    await expect(page.locator('#detailBody')).toContainText('Inbox feedback test task');
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 2);
  });
}
