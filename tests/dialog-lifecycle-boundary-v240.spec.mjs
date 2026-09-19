import { test, expect } from '@playwright/test';

const ROOM = 'test-dialog-lifecycle-v240';
const LIFECYCLE = 'dialog-lifecycle-v239.js';

async function installLocalState(page) {
  await page.addInitScript(({ room }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem(`system-task-tasks:${room}`, JSON.stringify([]));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, { disableLifecycle = false } = {}) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await installLocalState(page);
  if (disableLifecycle) {
    await page.route(`**/${LIFECYCLE}*`, route => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '/* Ver.240 boundary audit: lifecycle disabled */'
    }));
  }
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => Number(window.WORK_BOARD_RELEASE?.version || 0) >= 240, undefined, { timeout: 8_000 });
}

async function clickCurrent(page, selector) {
  const clicked = await page.evaluate(target => {
    const node = document.querySelector(target);
    if (!(node instanceof HTMLElement)) return false;
    node.click();
    return true;
  }, selector);
  expect(clicked, `expected clickable element: ${selector}`).toBeTruthy();
}

async function dispatchBackdrop(page, dialogId) {
  await page.evaluate(id => {
    const dialog = document.getElementById(id);
    if (!(dialog instanceof HTMLDialogElement)) throw new Error(`missing dialog: ${id}`);
    const rect = dialog.getBoundingClientRect();
    dialog.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left - 12,
      clientY: rect.top - 12
    }));
  }, dialogId);
}

async function forceClose(page, dialogId) {
  await page.evaluate(id => {
    const dialog = document.getElementById(id);
    if (dialog instanceof HTMLDialogElement && dialog.open) dialog.close();
  }, dialogId);
}

test('Ver.240 product: active lifecycle delegates every current closable dialog backdrop to its explicit control', async ({ page }) => {
  await boot(page);

  const cases = [
    ['userManageDialog', 'closeUserManage'],
    ['statusManageDialog', 'closeStatusManage'],
    ['categoryManageDialog', 'closeCategoryManage'],
    ['scheduleDialog', 'closeScheduleDialog'],
    ['scheduleCopyDialog', 'closeScheduleCopyDialog'],
    ['templateManageDialog', 'closeTemplateManage'],
    ['taskDialog', 'closeTaskDialog'],
    ['timelineMoveDialog', 'closeTimelineMoveDialog'],
    ['activityDialog', 'closeActivityDialog'],
    ['deleteConflictDialog', 'cancelDeleteConflict']
  ];

  for (const [dialogId, controlId] of cases) {
    await page.evaluate(({ dialogId: id, controlId: control }) => {
      const dialog = document.getElementById(id);
      const button = document.getElementById(control);
      if (!(dialog instanceof HTMLDialogElement) || !(button instanceof HTMLElement)) {
        throw new Error(`missing dialog/control: ${id}/${control}`);
      }
      window.__dialogLifecycleDelegatedV240 = '';
      button.addEventListener('click', () => {
        window.__dialogLifecycleDelegatedV240 = control;
      }, { once: true });
      dialog.showModal();
    }, { dialogId, controlId });

    await dispatchBackdrop(page, dialogId);
    await expect.poll(() => page.evaluate(() => window.__dialogLifecycleDelegatedV240 || '')).toBe(controlId);
    await forceClose(page, dialogId);
  }

  // Startup user selection is intentionally not dismissible through the backdrop.
  await page.evaluate(() => {
    const dialog = document.getElementById('userDialog');
    if (!(dialog instanceof HTMLDialogElement)) throw new Error('missing userDialog');
    dialog.showModal();
  });
  await dispatchBackdrop(page, 'userDialog');
  await expect(page.locator('#userDialog')).toBeVisible();
  await forceClose(page, 'userDialog');
});

test('Ver.240 product: task backdrop shares the unsaved-discard decision instead of bypassing app close', async ({ page }) => {
  await boot(page);

  await clickCurrent(page, '#newTask');
  const taskDialog = page.locator('#taskDialog');
  await expect(taskDialog).toBeVisible();
  await page.locator('#taskTitle').fill('未保存の変更');

  let dialogs = 0;
  page.once('dialog', async dialog => {
    dialogs += 1;
    await dialog.dismiss();
  });
  await dispatchBackdrop(page, 'taskDialog');
  await expect(taskDialog).toBeVisible();
  expect(dialogs).toBe(1);

  page.once('dialog', async dialog => {
    dialogs += 1;
    await dialog.accept();
  });
  await dispatchBackdrop(page, 'taskDialog');
  await expect(taskDialog).toBeHidden();
  expect(dialogs).toBe(2);
});

test('Ver.240 product: unknown future dialog is not generically closed by backdrop', async ({ page }) => {
  await boot(page);

  await page.evaluate(() => {
    const dialog = document.createElement('dialog');
    dialog.id = 'futureDialogV240';
    dialog.className = 'dialog';
    dialog.innerHTML = '<div class="dialog-head"><button class="icon-button" type="button">×</button></div><p>future dialog</p>';
    document.body.appendChild(dialog);
    dialog.showModal();
  });

  await dispatchBackdrop(page, 'futureDialogV240');
  await expect(page.locator('#futureDialogV240')).toBeVisible();
  await forceClose(page, 'futureDialogV240');
  await page.locator('#futureDialogV240').evaluate(node => node.remove());
});

test('Ver.240 product: without lifecycle app explicit close still works, but backdrop and discard guard disappear', async ({ page }) => {
  await boot(page, { disableLifecycle: true });

  await page.locator('#manageUsers').click();
  const userManage = page.locator('#userManageDialog');
  await expect(userManage).toBeVisible();
  await dispatchBackdrop(page, 'userManageDialog');
  await expect(userManage).toBeVisible();
  await page.locator('#closeUserManage').click();
  await expect(userManage).toBeHidden();

  await clickCurrent(page, '#newTask');
  const taskDialog = page.locator('#taskDialog');
  await expect(taskDialog).toBeVisible();
  await page.locator('#taskTitle').fill('guardなしの未保存変更');

  let confirmCount = 0;
  page.on('dialog', async dialog => {
    confirmCount += 1;
    await dialog.dismiss();
  });
  await page.locator('#closeTaskDialog').click();
  await expect(taskDialog).toBeHidden();
  expect(confirmCount).toBe(0);
});
