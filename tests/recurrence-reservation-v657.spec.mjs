import { test, expect } from '@playwright/test';

// The existing single-successor recurrence transaction remains unchanged.
// Its future occurrence must use the same reservation rules as a normal task.
test('Origin: a newly generated future recurring task is reserved until its start date', async ({ page }) => {
  test.setTimeout(100000);
  const room='origin-recurring-reservation-v657';
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(roomId => {
    localStorage.setItem('systemTaskUser', 'CycleQA');
    localStorage.setItem('systemTaskRoomId', roomId);
    localStorage.setItem('system-task-users:' + roomId, JSON.stringify(['CycleQA']));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
  }, room);
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.goto('/?room=' + room, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30000 });

  await page.locator('.nav-item[data-layout="tasks"]').first().evaluate(el => el.click());
  await page.locator('#newTask').evaluate(el => el.click());
  await page.locator('#taskTitle').fill('未来に始まる月次点検');
  await page.locator('#taskRecurrence').selectOption('monthlyDay');
  const year=new Date().getFullYear()+1, anchor=year+'-01-01', first=year+'-01-25';
  await page.locator('#taskRecurrenceAnchorDate').evaluate((input, date) => {
    input.value=date;
    input.closest('.date-segment-control-v127')?.__syncDateSegmentsV127?.();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, anchor);
  await page.locator('#taskRecurrenceMonthDay').fill('25');
  await page.locator('#taskForm [type="submit"]').first().click();
  await expect(page.locator('#taskDialog')).toBeHidden();

  const tasks=async()=>page.evaluate(roomId =>
    JSON.parse(localStorage.getItem('system-task-tasks:' + roomId) || '[]'), room);
  await expect.poll(async () => (await tasks()).length).toBe(1);
  const parent=(await tasks())[0];
  await page.locator('[data-task-id="' + parent.id + '"]').first().evaluate(el => el.click());
  page.once('dialog', dialog => dialog.accept(''));
  await page.locator('#detailBody [data-action="done"]').click();
  await expect.poll(async () => (await tasks()).length).toBe(2);
  const child=(await tasks()).find(t => t.id !== parent.id);
  expect(child.recurringParentId).toBe(parent.id);
  expect(child.recurrenceRule.occurrenceDate).toBe(first);
  expect(child.dueDate).toBe('');

  // Inferred reservation dates do not create a second persisted source of truth.
  expect(await page.evaluate(id => window.WorkBoardOriginStartBridge.readSnapshot()[id]?.date, child.id)).toBe(first);
  await expect(page.locator('[data-reserved-task-open]')).toContainText('1');
  await page.locator('[data-reserved-task-open]').click();
  await expect(page.locator('#reservedTaskDialogV167 [data-reserved-id="' + child.id + '"]')).toBeVisible();
  await page.locator('#reservedTaskDialogV167 [data-reserved-close]').click();

  await page.locator('[data-wb-display-choice="modern"]').evaluate(el => el.click());
  const origin=page.locator('#modernOriginRoot');
  await expect(origin).toBeVisible();
  await origin.locator('#desktopNav [data-route="tasks"]').click();
  await expect(origin.locator('.origin-task-collection .item-name[data-id="' + child.id + '"]')).toHaveCount(0);
  await origin.locator('[data-action="task-filter"][data-value="reserved"]').click();
  await expect(origin.locator('.origin-task-collection .item-name[data-id="' + child.id + '"]')).toBeVisible();

  const result=await page.evaluate(async id => {
    const s=window.WorkBoardPaletteBridge.readSnapshot();
    const d=new Date(), date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    return window.WorkBoardOriginStartBridge.save({
      ownerRoom:s.roomId, ownerUser:s.currentUser, id, date, revision:0
    });
  }, child.id);
  expect(result.ok).toBe(true);
  await expect(origin.locator('.origin-task-collection .item-name[data-id="' + child.id + '"]')).toHaveCount(0);
  await origin.locator('[data-action="task-filter"][data-value="active"]').click();
  await expect(origin.locator('.origin-task-collection .item-name[data-id="' + child.id + '"]')).toBeVisible();
  const still=(await tasks()).find(t => t.id === child.id);
  expect(still.recurrenceRule.occurrenceDate).toBe(first);
  expect(still.revision).toBe(child.revision);
});
