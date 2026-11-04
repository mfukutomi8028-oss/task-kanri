import { test, expect } from '@playwright/test';

const ROOM = 'test-task-duplicate-v335';
const SOURCE_ID = 'existing-duplicate-v335';
const source = {
  id: SOURCE_ID, title: '電子カルテPC更新', status: '対応中',
  description: '台数確認と交換日程の調整', assignee: '福冨',
  priority: '中', category: 'その他', requester: '情報システム課',
  dueDate: '2026-11-25', dueTime: '15:00',
  recurrence: 'monthlyDay', recurrenceRule: { interval: 1, monthDay: 25 },
  nextRecurringTaskId: 'rec-existing-duplicate-v335-2026-12-25',
  recurringParentId: 'original-monthly-parent',
  operationId: 'prior-operation', knowledgeId: 'knowledge-source',
  pinned: true, revision: 7, comments: [], history: [],
  checklist: [{ id: 'check-1', text: '作業確認', done: true }],
  createdAt: 1793500000000, updatedAt: 1793500000000,
  createdBy: '福冨', updatedBy: '福冨'
};

test('Ver.335: duplicate creates a fresh task, not a revision-7 update', async ({page}) => {
  await page.setViewportSize({width:1366,height:900});
  await page.addInitScript(({room, source})=>{
    localStorage.clear();
    localStorage.setItem('systemTaskUser', '福冨');
    localStorage.setItem('systemTaskRoomId', room);
    localStorage.setItem('system-task-users:' + room, JSON.stringify(['福冨']));
    localStorage.setItem('system-task-tasks:' + room, JSON.stringify([source]));
    Object.defineProperty(window, 'firebaseConfig', {
      configurable:true, get(){return null;}, set(){}
    });
  }, {room:ROOM,source});
  await page.route('https://www.gstatic.com/firebasejs/**', route=>route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route=>route.abort('blockedbyclient'));
  await page.goto('/?room=' + ROOM,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('.nav-item[data-layout="tasks"]').first().evaluate(el=>el.click());
  await page.waitForFunction(id=>Boolean(document.querySelector('[data-task-id="'+id+'"]')),SOURCE_ID);
  await page.locator('[data-task-id="'+SOURCE_ID+'"]').first().evaluate(el=>el.click());
  await expect(page.locator('#detailBody [data-action="duplicate"]')).toBeVisible();
  await page.locator('#detailBody [data-action="duplicate"]').click();
  await expect(page.locator('#toast')).toContainText('タスクを複製しました');
  const rows=await page.evaluate(room=>JSON.parse(localStorage.getItem('system-task-tasks:'+room)||'[]'),ROOM);
  expect(rows).toHaveLength(2);
  const original=rows.find(x=>x.id===SOURCE_ID),copy=rows.find(x=>x.id!==SOURCE_ID);
  expect(original.revision).toBe(7);
  expect(copy).toMatchObject({
    title:'コピー：電子カルテPC更新',revision:1,status:'未着手',
    nextRecurringTaskId:'',recurringParentId:'',operationId:'',
    knowledgeId:'',pinned:false,completedAt:0,
    dueDate:'2026-11-25',description:source.description
  });
  expect(copy.id).not.toBe(original.id);
});
