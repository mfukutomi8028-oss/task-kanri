import { test, expect } from '@playwright/test';

// Isolated local-only fixtures. No production Firebase, shared-room write or Modern mock.
async function boot(page, { chosen = true } = {}) {
  const room = 'test-workspace-read-v550';
  await page.addInitScript(({ room, chosen }) => {
    localStorage.clear();
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('system-task-users:' + room, JSON.stringify(['佐藤','福冨']));
    if (chosen) localStorage.setItem('systemTaskUser', '佐藤');
    localStorage.setItem('system-task-tasks:' + room, JSON.stringify([
      {id:'t1',title:'読取契約の確認',status:'未着手',assignee:'佐藤',dueDate:'2026-10-29',revision:2},
      {id:'t2',title:'完了済み',status:'完了',assignee:'福冨',dueDate:'2026-10-28',revision:1}
    ]));
    localStorage.setItem('system-task-schedules:' + room, JSON.stringify([
      {id:'s1',title:'予定の確認',startAt:'2026-10-29T01:00:00.000Z',
        endAt:'2026-10-29T01:30:00.000Z',assignee:'佐藤',revision:1}
    ]));
    localStorage.setItem('system-task-todos:' + room, JSON.stringify([
      {id:'a',owner:'佐藤',text:'自分の作業',completed:false,order:0,revision:1},
      {id:'b',owner:'福冨',text:'別の人の作業',completed:false,order:0,revision:1}
    ]));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get(){ return null; }, set(){}
    });
  }, {room,chosen});
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i, route => route.abort('blockedbyclient'));
  await page.goto('/?room=' + room, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, {timeout:30000});
  await page.waitForFunction(() => Boolean(window.WorkBoardReadV550), undefined, {timeout:10000});
}

test('Ver.550 Classic exposes local-only owner read API without showing another user ToDos', async ({ page }) => {
  await boot(page);
  await expect.poll(async () => page.evaluate(() => window.WorkBoardReadV550.read().ready)).toBe(true);
  const model = await page.evaluate(() => {
    const read = window.WorkBoardReadV550.read();
    return {
      read, frozen: Object.isFrozen(read) && Object.isFrozen(read.tasks)
        && Object.isFrozen(read.tasks[0]) && Object.isFrozen(read.todos[0]),
      descriptor: Object.getOwnPropertyDescriptor(window, 'WorkBoardReadV550'),
      hasDemo: Boolean(window.Demo)
    };
  });
  expect(model.read.source).toBe('local-only');
  expect(model.read.roomId).toBe('test-workspace-read-v550');
  expect(model.read.selectedUser).toBe('佐藤');
  expect(model.read.tasks.map(t => t.id)).toEqual(['t1','t2']);
  expect(model.read.todos.map(t => t.id)).toEqual(['a']);
  expect(model.read.schedules.map(s => s.id)).toEqual(['s1']);
  expect(model.frozen).toBe(true);
  expect(model.descriptor.writable).toBe(false);
  expect(model.hasDemo).toBe(false);
});

test('Ver.550 switching the canonical selected user immediately changes the ToDo read scope', async ({ page }) => {
  await boot(page);
  await expect.poll(async () => page.evaluate(() => window.WorkBoardReadV550.read().ready)).toBe(true);
  await page.evaluate(() => {
    const user = document.getElementById('currentUserSelect');
    user.value='福冨';
    user.dispatchEvent(new Event('change', {bubbles:true}));
  });
  await expect.poll(async () => page.evaluate(() => window.WorkBoardReadV550.read().selectedUser)).toBe('福冨');
  const model=await page.evaluate(() => window.WorkBoardReadV550.read());
  expect(model.todos.map(t => t.text)).toEqual(['別の人の作業']);
  expect(model.tasks.length).toBe(2);
});

test('Ver.550 no selected user does not expose local cached task or ToDo records', async ({ page }) => {
  await boot(page, {chosen:false});
  const model = await page.evaluate(() => window.WorkBoardReadV550.read());
  expect(model.ready).toBe(false);
  expect(model.reason).toBe('identity-not-selected');
  expect(model.tasks).toEqual([]);
  expect(model.todos).toEqual([]);
  expect(model.schedules).toEqual([]);
});
