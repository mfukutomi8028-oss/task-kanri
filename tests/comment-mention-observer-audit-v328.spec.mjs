import { test, expect } from '@playwright/test';

const ROOM = 'test-comment-mention-observer-v328';
const CURRENT = `  const detail=document.getElementById('detailBody');\n  if(detail)new MutationObserver(mutations=>{\n    if(mutations.some(mutation=>mutation.addedNodes.length||mutation.removedNodes.length))schedule();\n  }).observe(detail,{childList:true,subtree:true});`;
const CURRENT_INSTRUMENTED = `  const detail=document.getElementById('detailBody');\n  if(detail)new MutationObserver(mutations=>{\n    window.__WB_MENTION_OBSERVER_V328__.callbacks += 1;\n    window.__WB_MENTION_OBSERVER_V328__.mutations += mutations.length;\n    if(mutations.some(mutation=>mutation.addedNodes.length||mutation.removedNodes.length)){\n      window.__WB_MENTION_OBSERVER_V328__.schedules += 1;\n      schedule();\n    }\n  }).observe(detail,{childList:true,subtree:true});`;
const CANDIDATE = `  function mutationTouchesMentionSurfaceV328(mutation){\n    const selector='.task-comments-panel-v149, #commentForm, .comment-form, textarea#commentText';\n    return [...mutation.addedNodes,...mutation.removedNodes].some(node=>{\n      if(node?.nodeType!==1)return false;\n      return Boolean(node.matches?.(selector)||node.querySelector?.(selector));\n    });\n  }\n\n  const detail=document.getElementById('detailBody');\n  if(detail)new MutationObserver(mutations=>{\n    window.__WB_MENTION_OBSERVER_V328__.callbacks += 1;\n    window.__WB_MENTION_OBSERVER_V328__.mutations += mutations.length;\n    if(mutations.some(mutationTouchesMentionSurfaceV328)){\n      window.__WB_MENTION_OBSERVER_V328__.schedules += 1;\n      schedule();\n    }\n  }).observe(detail,{childList:true,subtree:true});`;
const PATCH_NEEDLE = `  function patch(){\n    patchMentionHelper();`;
const PATCH_INSTRUMENTED = `  function patch(){\n    window.__WB_MENTION_OBSERVER_V328__.patches += 1;\n    patchMentionHelper();`;

async function boot(page,{mode='current',width=1366}={}){
  await page.setViewportSize({width,height:900});
  await page.addInitScript(({room,mode})=>{
    localStorage.clear();
    localStorage.setItem('systemTaskUser','福冨');
    localStorage.setItem('systemTaskRoomId',room);
    localStorage.setItem(`system-task-users:${room}`,JSON.stringify(['福冨','土屋']));
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null;},set(){}});
    window.__WB_MENTION_OBSERVER_V328__={mode,callbacks:0,mutations:0,schedules:0,patches:0,scriptRequests:0};
  },{room:ROOM,mode});
  await page.route(/\/comment-mentions-v191\.js(?:\?.*)?$/,async route=>{
    const response=await route.fetch();
    let body=await response.text();
    if(!body.includes(CURRENT))throw new Error('Ver.328 target observer block not found');
    if(!body.includes(PATCH_NEEDLE))throw new Error('Ver.328 patch target not found');
    body=body.replace(CURRENT,mode==='current'?CURRENT_INSTRUMENTED:CANDIDATE)
      .replace(PATCH_NEEDLE,PATCH_INSTRUMENTED);
    body=`window.__WB_MENTION_OBSERVER_V328__.scriptRequests += 1;\n${body}`;
    await route.fulfill({response,body});
  });
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
    detail.innerHTML=`<section class="detail-section unrelated-v328"><h4>内容</h4><div class="description">本文</div></section><section class="task-comments-panel-v149"><form class="comment-form" id="commentForm"><textarea id="commentText"></textarea><button type="submit">追加</button></form></section>`;
  });
  await expect(page.locator('#detailBody [data-open-mention-picker-v156]')).toHaveCount(1);
}

const stats=page=>page.evaluate(()=>({...window.__WB_MENTION_OBSERVER_V328__}));
const idle=page=>page.waitForTimeout(120);
const helper=page=>page.locator('#detailBody [data-open-mention-picker-v156]');
const shell=page=>page.locator('.workflow-mention-shell-v156');

for(const width of [1366,390]){
  test(`Ver.328 current: unrelated detail churn schedules mention rescans at ${width}px`,async({page})=>{
    await boot(page,{mode:'current',width});
    await installCommentSurface(page);
    await idle(page);
    const before=await stats(page);
    await page.evaluate(()=>{
      const unrelated=document.querySelector('#detailBody .unrelated-v328');
      unrelated.insertAdjacentHTML('beforeend','<span data-v328-unrelated>unrelated</span>');
    });
    await idle(page);
    const after=await stats(page);
    expect(after.callbacks-before.callbacks).toBeGreaterThanOrEqual(1);
    expect(after.schedules-before.schedules).toBeGreaterThanOrEqual(1);
    expect(after.patches-before.patches).toBeGreaterThanOrEqual(1);
  });
}

test('Ver.328 candidate: unrelated detail churn does not schedule a mention rescan',async({page})=>{
  await boot(page,{mode:'candidate',width:1366});
  await installCommentSurface(page);
  await idle(page);
  const before=await stats(page);
  await page.evaluate(()=>{
    const unrelated=document.querySelector('#detailBody .unrelated-v328');
    unrelated.insertAdjacentHTML('beforeend','<span data-v328-unrelated>unrelated</span>');
  });
  await idle(page);
  const after=await stats(page);
  expect(after.callbacks-before.callbacks).toBeGreaterThanOrEqual(1);
  expect(after.schedules-before.schedules).toBe(0);
  expect(after.patches-before.patches).toBe(0);
  await expect(helper(page)).toHaveCount(1);
});

test('Ver.328 candidate: canonical comment-form replacement is still adopted and mention picker remains usable',async({page})=>{
  await boot(page,{mode:'candidate',width:1366});
  await installCommentSurface(page);
  await idle(page);
  const before=await stats(page);
  await page.evaluate(()=>{
    const panel=document.querySelector('#detailBody .task-comments-panel-v149');
    panel.innerHTML='<form class="comment-form" id="commentForm"><textarea id="commentText"></textarea><button type="submit">追加</button></form>';
  });
  await expect(helper(page)).toHaveCount(1);
  await idle(page);
  const after=await stats(page);
  expect(after.schedules-before.schedules).toBeGreaterThanOrEqual(1);
  expect(after.patches-before.patches).toBeGreaterThanOrEqual(1);

  await helper(page).evaluate(button=>button.click());
  await expect(shell(page)).not.toHaveAttribute('hidden','');
  await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  await expect(shell(page)).toHaveAttribute('hidden','');
});

test('Ver.328 candidate: replacing the whole comment panel remains covered on mobile',async({page})=>{
  await boot(page,{mode:'candidate',width:390});
  await installCommentSurface(page);
  await idle(page);
  const before=await stats(page);
  await page.evaluate(()=>{
    const old=document.querySelector('#detailBody .task-comments-panel-v149');
    const next=document.createElement('section');
    next.className='task-comments-panel-v149';
    next.innerHTML='<form class="comment-form" id="commentForm"><textarea id="commentText"></textarea><button type="submit">追加</button></form>';
    old.replaceWith(next);
  });
  await expect(helper(page)).toHaveCount(1);
  await idle(page);
  const after=await stats(page);
  expect(after.schedules-before.schedules).toBeGreaterThanOrEqual(1);
  expect(after.patches-before.patches).toBeGreaterThanOrEqual(1);
});
