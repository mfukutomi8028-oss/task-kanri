import { test, expect } from '@playwright/test';

const ROOM = 'test-comment-mention-escape-v326';
const CURRENT = `  document.addEventListener('keydown',event=>{\n    if(event.key==='Escape'&&shell&&!shell.hidden)closePicker();\n  });`;
const INSTRUMENTED = `  window.__WB_MENTION_ESCAPE_V326__.bindAdds += 1;\n  window.__WB_MENTION_ESCAPE_V326__.bound = true;\n  document.addEventListener('keydown',event=>{\n    window.__WB_MENTION_ESCAPE_V326__.callbacks += 1;\n    if(event.key==='Escape'&&shell&&!shell.hidden)closePicker();\n  });`;
const CANDIDATE = `  function handleMentionEscapeV326(event){\n    window.__WB_MENTION_ESCAPE_V326__.callbacks += 1;\n    if(event.key==='Escape'&&shell&&!shell.hidden)closePicker();\n  }\n  function bindMentionEscapeV326(){\n    if(window.__WB_MENTION_ESCAPE_V326__.bound)return;\n    window.__WB_MENTION_ESCAPE_V326__.bound=true;\n    window.__WB_MENTION_ESCAPE_V326__.bindAdds += 1;\n    document.addEventListener('keydown',handleMentionEscapeV326);\n  }\n  function unbindMentionEscapeV326(){\n    if(!window.__WB_MENTION_ESCAPE_V326__.bound)return;\n    window.__WB_MENTION_ESCAPE_V326__.bound=false;\n    window.__WB_MENTION_ESCAPE_V326__.bindRemoves += 1;\n    document.removeEventListener('keydown',handleMentionEscapeV326);\n  }`;
const OPEN_NEEDLE = `    shell.hidden=false;\n    document.body.classList.add('workflow-mention-open-v156');`;
const OPEN_CANDIDATE = `    shell.hidden=false;\n    bindMentionEscapeV326();\n    document.body.classList.add('workflow-mention-open-v156');`;
const CLOSE_NEEDLE = `    shell.hidden=true;\n    document.body.classList.remove('workflow-mention-open-v156');`;
const CLOSE_CANDIDATE = `    shell.hidden=true;\n    unbindMentionEscapeV326();\n    document.body.classList.remove('workflow-mention-open-v156');`;

async function boot(page,{mode='current',width=1366}={}){
  await page.setViewportSize({width,height:900});
  await page.addInitScript(({room,mode})=>{
    localStorage.clear();
    localStorage.setItem('systemTaskUser','福冨');
    localStorage.setItem('systemTaskRoomId',room);
    localStorage.setItem(`system-task-users:${room}`,JSON.stringify(['福冨','土屋']));
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null;},set(){}});
    window.__WB_MENTION_ESCAPE_V326__={mode,callbacks:0,bindAdds:0,bindRemoves:0,bound:false,scriptRequests:0};
  },{room:ROOM,mode});
  await page.route(/\/comment-mentions-v191\.js(?:\?.*)?$/,async route=>{
    const response=await route.fetch();
    let body=await response.text();
    if(!body.includes(CURRENT))throw new Error('Ver.326 target keydown block not found');
    if(mode==='current') body=body.replace(CURRENT,INSTRUMENTED);
    else {
      if(!body.includes(OPEN_NEEDLE)||!body.includes(CLOSE_NEEDLE))throw new Error('Ver.326 lifecycle needles not found');
      body=body.replace(CURRENT,CANDIDATE).replace(OPEN_NEEDLE,OPEN_CANDIDATE).replace(CLOSE_NEEDLE,CLOSE_CANDIDATE);
    }
    body=`window.__WB_MENTION_ESCAPE_V326__.scriptRequests += 1;\n${body}`;
    await route.fulfill({response,body});
  });
  await page.route('https://www.gstatic.com/firebasejs/**',route=>route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,route=>route.abort('blockedbyclient'));
  await page.goto(`/?room=${ROOM}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.waitForFunction(()=>document.documentElement.dataset.taskDialogUxVersion==='321',undefined,{timeout:10000});
}

async function fixture(page){
  await page.evaluate(()=>{
    const detail=document.getElementById('detailBody');
    detail.classList.remove('empty');
    detail.innerHTML=`
      <h3 class="detail-title">眼科）明尾Drスケジュール</h3>
      <div class="task-meta"><span class="badge">未着手</span><span class="badge">中</span></div>
      <div class="detail-status-control-v146"><div class="detail-status-label-v146"><strong>状態を変更</strong><span>編集画面を開かずに更新</span></div><select class="detail-status-select-v146"><option>未着手</option></select></div>
      <div class="detail-actions detail-actions-v2">
        <div class="main-actions"><button type="button" data-action="edit">編集する</button><button type="button">✓ 完了にする</button></div>
        <div class="sub-actions">
          <button type="button" data-quick-pin-v154>固定解除</button>
          <button type="button" class="detail-favorite-button starred" data-action="favorite">お気に入り解除</button>
          <button type="button">予定を作成</button>
          <button type="button">複製</button>
          <button type="button" data-action="delete" data-operation-key="task-delete:v326-task">削除</button>
        </div>
      </div>
      <section class="detail-section"><h4>内容・メモ</h4><div class="description">本文を広い領域で確認します。</div></section>
      <section class="detail-section"><h4>チェックリスト (1/2)</h4><div class="checklist"><label class="check-item done"><input type="checkbox" checked><span>確認済み</span></label><label class="check-item"><input type="checkbox"><span>未確認</span></label></div></section>
      <section class="detail-section metadata-fixture"><div class="detail-grid"><div class="field-card"><small>担当者</small><strong>福冨</strong></div><div class="field-card"><small>依頼元</small><strong>総務課</strong></div><div class="field-card"><small>期限</small><strong>期限なし</strong></div><div class="field-card"><small>最終更新</small><strong>09/29 17:32</strong></div></div></section>
      <section class="detail-section activity-section">
        <h4>対応履歴・コメント</h4>
        <form class="comment-form" id="commentForm"><select><option>作業メモ</option></select><textarea id="commentText"></textarea><button type="submit">追加</button></form>
        <div class="activity-tabs">
          <input type="radio" name="activityTab-v326-task" id="activityComments-v326-task" checked>
          <input type="radio" name="activityTab-v326-task" id="activityHistory-v326-task">
          <div class="activity-tab-buttons"><label for="activityComments-v326-task">コメント <span>2</span></label><label for="activityHistory-v326-task">対応履歴 <span>2</span></label></div>
          <div class="activity-tab-panel activity-comments-panel"><div class="history-list compact-activity-list"><article class="history-item">コメント1</article><article class="history-item">コメント2</article></div></div>
          <div class="activity-tab-panel activity-history-panel"><div class="history-list compact-activity-list"><article class="history-item">履歴1</article><article class="history-item">履歴2</article></div></div>
        </div>
      </section>`;
    document.getElementById('taskId').value='v326-task';
    document.getElementById('taskDialog').showModal();
  });
  await expect(page.locator('#taskDialogDetailTabV319')).toBeVisible();
  await page.locator('#taskDialogDetailTabV319').click();
  await expect(page.locator('#taskDialogDetailPanelV319 #detailBody')).toBeVisible();
  await expect(page.locator('#taskDialogDetailPanelV319 .task-detail-tabs-v149')).toBeVisible();
  await page.locator('#taskDialogDetailPanelV319 .task-detail-tab-v149[data-tab="comments"]').click();
  await expect(page.locator('#taskDialogDetailPanelV319 .task-comment-compose-v149 .comment-form')).toBeVisible();
  await expect(page.locator('#taskDialogDetailPanelV319 [data-open-mention-picker-v156]')).toBeVisible();
}
const stats=page=>page.evaluate(()=>({...window.__WB_MENTION_ESCAPE_V326__}));
const dispatchKey=(page,key)=>page.evaluate(value=>document.dispatchEvent(new KeyboardEvent('keydown',{key:value,bubbles:true})),key);

for(const width of [1366,390]){
  test(`Ver.326 current: closed mention picker still wakes permanent keydown at ${width}px`,async({page})=>{
    await boot(page,{mode:'current',width});
    await fixture(page);
    expect(await stats(page)).toMatchObject({bindAdds:1,bindRemoves:0,bound:true,scriptRequests:1});
    const before=(await stats(page)).callbacks;
    await dispatchKey(page,'AuditIdle');
    expect((await stats(page)).callbacks-before).toBe(1);
  });
}

test('Ver.326 candidate: Escape ownership exists only while picker is open and survives reopen cycles',async({page})=>{
  await boot(page,{mode:'candidate',width:1366});
  await fixture(page);
  expect(await stats(page)).toMatchObject({bindAdds:0,bindRemoves:0,bound:false});
  await dispatchKey(page,'AuditIdle');
  expect((await stats(page)).callbacks).toBe(0);
  const open=page.locator('#taskDialogDetailPanelV319 [data-open-mention-picker-v156]');
  const shell=page.locator('#taskDialog > .workflow-mention-shell-v156');

  await open.click();
  await expect(shell).toBeVisible();
  await expect(shell).toHaveAttribute('data-mention-layer-host-v321','task-dialog');
  expect(await stats(page)).toMatchObject({bindAdds:1,bindRemoves:0,bound:true});
  await shell.locator('[data-close-mention-v156]').last().click();
  await expect(shell).toBeHidden();
  expect(await stats(page)).toMatchObject({bindAdds:1,bindRemoves:1,bound:false});

  await open.click();
  await expect(shell).toBeVisible();
  expect(await stats(page)).toMatchObject({bindAdds:2,bindRemoves:1,bound:true});
  await page.keyboard.press('Escape');
  await expect(shell).toBeHidden();
  expect(await stats(page)).toMatchObject({callbacks:1,bindAdds:2,bindRemoves:2,bound:false});
  await dispatchKey(page,'Escape');
  expect((await stats(page)).callbacks).toBe(1);
});

test('Ver.326 candidate: backdrop and apply both release Escape ownership on mobile',async({page})=>{
  await boot(page,{mode:'candidate',width:390});
  await fixture(page);
  const open=page.locator('#taskDialogDetailPanelV319 [data-open-mention-picker-v156]');
  const shell=page.locator('#taskDialog > .workflow-mention-shell-v156');
  await open.click();
  await shell.locator('.workflow-mention-backdrop-v156').click({position:{x:2,y:2}});
  await expect(shell).toBeHidden();
  expect(await stats(page)).toMatchObject({bindAdds:1,bindRemoves:1,bound:false});
  await open.click();
  await shell.locator('[data-mention-user-v156]').first().click();
  await shell.locator('[data-apply-mentions-v156]').click();
  await expect(shell).toBeHidden();
  expect(await stats(page)).toMatchObject({bindAdds:2,bindRemoves:2,bound:false});
  await expect(page.locator('#commentText')).toHaveValue(/@土屋/);
});
