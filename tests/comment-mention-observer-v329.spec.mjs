import { test, expect } from '@playwright/test';

const ROOM='test-comment-mention-observer-v329';

async function boot(page,{width=1366}={}){
  await page.setViewportSize({width,height:900});
  await page.addInitScript(room=>{
    localStorage.clear();
    localStorage.setItem('systemTaskUser','福冨');
    localStorage.setItem('systemTaskRoomId',room);
    localStorage.setItem(`system-task-users:${room}`,JSON.stringify(['福冨','土屋']));
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null;},set(){}});
  },ROOM);
  await page.route('https://www.gstatic.com/firebasejs/**',route=>route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,route=>route.abort('blockedbyclient'));
  await page.goto(`/?room=${ROOM}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.waitForFunction(()=>document.documentElement.dataset.taskDialogUxVersion==='321',undefined,{timeout:10000});
}

async function installCommentSurface(page){
  await page.evaluate(()=>{
    const detail=document.getElementById('detailBody');
    detail.classList.remove('empty');
    detail.innerHTML=`<section class="detail-section unrelated-v329"><h4>内容</h4><div class="description">本文</div></section><section class="task-comments-panel-v149"><form class="comment-form" id="commentForm"><textarea id="commentText"></textarea><button type="submit">追加</button></form></section>`;
  });
  await expect(page.locator('#detailBody [data-open-mention-picker-v156]')).toHaveCount(1);
}

const helper=page=>page.locator('#detailBody [data-open-mention-picker-v156]');
const shell=page=>page.locator('.workflow-mention-shell-v156');

for(const width of [1366,390]){
  test(`Ver.329 product: unrelated detail churn does not recreate the mention helper at ${width}px`,async({page})=>{
    await boot(page,{width});
    await installCommentSurface(page);
    await page.evaluate(()=>{
      document.querySelector('#detailBody .workflow-mention-helper-v156')?.remove();
      document.querySelector('#detailBody .unrelated-v329')?.insertAdjacentHTML('beforeend','<span data-v329-unrelated>unrelated</span>');
    });
    await page.waitForTimeout(160);
    await expect(helper(page)).toHaveCount(0);
  });
}

test('Ver.329 product: canonical comment-form replacement is adopted',async({page})=>{
  await boot(page,{width:1366});
  await installCommentSurface(page);
  await page.evaluate(()=>{
    const panel=document.querySelector('#detailBody .task-comments-panel-v149');
    panel.innerHTML='<form class="comment-form" id="commentForm"><textarea id="commentText"></textarea><button type="submit">追加</button></form>';
  });
  await expect(helper(page)).toHaveCount(1);
});

test('Ver.329 product: whole comment-panel replacement remains adopted on mobile',async({page})=>{
  await boot(page,{width:390});
  await installCommentSurface(page);
  await page.evaluate(()=>{
    const old=document.querySelector('#detailBody .task-comments-panel-v149');
    const next=document.createElement('section');
    next.className='task-comments-panel-v149';
    next.innerHTML='<form class="comment-form" id="commentForm"><textarea id="commentText"></textarea><button type="submit">追加</button></form>';
    old.replaceWith(next);
  });
  await expect(helper(page)).toHaveCount(1);
});

test('Ver.329 product: picker remains usable after semantic adoption',async({page})=>{
  await boot(page,{width:1366});
  await installCommentSurface(page);
  await page.evaluate(()=>{
    const panel=document.querySelector('#detailBody .task-comments-panel-v149');
    panel.innerHTML='<form class="comment-form" id="commentForm"><textarea id="commentText"></textarea><button type="submit">追加</button></form>';
  });
  await expect(helper(page)).toHaveCount(1);
  await helper(page).evaluate(button=>button.click());
  await expect(shell(page)).not.toHaveAttribute('hidden','');
  await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  await expect(shell(page)).toHaveAttribute('hidden','');
});
