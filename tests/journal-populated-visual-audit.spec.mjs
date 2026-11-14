import {test, expect} from '@playwright/test';
import fs from 'node:fs';
test.use({timezoneId:'Asia/Tokyo'});
const ROOM='journal-populated-v598-synthetic';
const todayISO=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

test('JOURNAL populated workspace visual and interaction audit',async({page})=>{
  test.setTimeout(240000);
  fs.mkdirSync('journal-audit-populated',{recursive:true});
  const measurements=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1366,height:900});
  await page.route('**/*',route=>
    new URL(route.request().url()).origin==='http://127.0.0.1:4173'
      ?route.continue():route.abort('blockedbyclient'));
  await page.addInitScript(room=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
    localStorage.setItem('systemTaskRoomId',room);
    localStorage.setItem('systemTaskUser','UIAudit');
  },ROOM);
  await page.goto('/?room='+ROOM,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
  await page.locator('[data-wb-display-choice="journal"]').evaluate(el=>el.click());
  await page.waitForFunction(()=>document.querySelector('link[data-workboard-style="journal-display-v367.css"][data-loaded="true"]')
    && document.querySelector('#todayView .j420-today'));
  const currentDay=todayISO();
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  const tasks=[
    ['ネットワーク機器の構成図更新と来月の切替手順確認','未着手','高','手順・担当・切替時間帯の確認が必要です。関連部署に共有する前に作業の順番を整理します。'],
    ['各部署の端末台帳を照合し、未更新の記録を整理','対応中','中','作業記録の照合と端末識別子の確認を進めています。'],
    ['定例のシステム改善会議に向けた報告資料を作成','未着手','中','進行中の案件と優先順位を洗い出します。'],
    ['バックアップ復元テストの結果を確認して報告','確認待ち','高','合成データを使った検査結果をレビューしてから記録します。'],
    ['運用マニュアルの検索導線と説明文を改訂する','対応中','低','画面説明の重複を除いて読みやすく整理する。'],
    ['予備端末の利用準備を完了する','未着手','低','セットアップ後に利用開始チェックを行う。']
  ];
  for(let i=0;i<tasks.length;i++){
    const [title,status,priority,description]=tasks[i];
    await page.locator('#boardView [data-j420-new-task]').click();
    const editor=page.locator('#taskDialog');
    await expect(editor).toBeVisible();
    await editor.locator('#taskTitle').fill(title);
    await editor.locator('#taskDescription').fill(description);
    if(await editor.locator('#taskStatus option[value="'+status+'"]').count())
      await editor.locator('#taskStatus').selectOption(status);
    if(await editor.locator('#taskPriority option[value="'+priority+'"]').count())
      await editor.locator('#taskPriority').selectOption(priority);
    if(i<3)await editor.locator('#taskDueDate').fill(currentDay);
    await editor.locator('#taskForm button[type="submit"]').click();
    await expect(editor).toBeHidden();
    if(await page.locator('.detail-panel.open').count())
      await page.locator('#closeDetail').evaluate(button=>button.click());
    await expect.poll(()=>page.locator('#boardView [data-j420-task-id]').count()).toBeGreaterThanOrEqual(i+1);
  }
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="schedule"]').click();
  await page.locator('#scheduleView [data-j425-mode="day"]').click();
  const date=await page.locator('#scheduleView [data-j443-add-schedule-date]').first().getAttribute('data-j443-add-schedule-date');
  for(const [i,title,start,end] of [[0,'ネットワーク切替の確認会議','09:00','10:00'],[1,'運用手順のレビュー','14:00','14:30']]){
    await page.locator('#scheduleView [data-j443-add-schedule-date]').first().click();
    const dialog=page.locator('#scheduleDialog');
    await dialog.locator('#scheduleTitle').fill(title);
    await dialog.locator('#scheduleStart').fill(date+'T'+start);
    await dialog.locator('#scheduleEnd').fill(date+'T'+end);
    await dialog.locator('#scheduleForm button[type="submit"]').click();
    await expect(dialog).toBeHidden();
  }
  await page.locator('#scheduleView [data-j459-return-week]').click();

  async function capture(route,width){
    await page.setViewportSize({width,height:900});
    const nav=width<=860?'#wbJournalDockV367':'.wb-journal-tabs-v367';
    await page.locator(nav+' [data-journal-route="'+route+'"]').click();
    const root=route==='today'?'#todayView .j420-today':route==='tasks'?'#boardView .j420-atelier':'#scheduleView .j425-schedule';
    await expect(page.locator(root)).toBeVisible();
    await page.waitForTimeout(140);
    await page.screenshot({path:'journal-audit-populated/'+width+'-'+route+'.png',animations:'disabled',fullPage:true});
    const data=await page.evaluate(({route,width,root})=>{
      const rect=selector=>{const el=document.querySelector(selector);if(!el)return null;const b=el.getBoundingClientRect();return {y:Math.round(b.y),height:Math.round(b.height),width:Math.round(b.width),x:Math.round(b.x)}};
      const tasks=[...document.querySelectorAll('#boardView [data-j420-task-id]')];
      return {route,width,pageHeight:document.documentElement.scrollHeight,horizontalOverflow:document.documentElement.scrollWidth-innerWidth,
        nav:rect(width<=860?'#wbJournalDockV367':'.wb-journal-tabs-v367'),main:rect(route==='tasks'?'#boardView .j420-atelier-desk':root),
        itemCount:tasks.length,firstItem:rect('#boardView [data-j420-task-id]'),
        search:rect('#boardView [data-j420-search]'),index:rect('#boardView .j420-atelier-index'),log:rect('#boardView .j420-atelier-log'),
        activeRoute:document.querySelector((width<=860?'#wbJournalDockV367':'.wb-journal-tabs-v367')+' [aria-current="page"]')?.textContent.trim().slice(0,40),
        touchTargets:[...document.querySelectorAll((route==='tasks'?'#boardView':route==='schedule'?'#scheduleView':'#todayView')+' button')].filter(x=>x.getClientRects().length).map(x=>({label:x.textContent.trim().slice(0,24),w:Math.round(x.getBoundingClientRect().width),h:Math.round(x.getBoundingClientRect().height)})).filter(x=>x.h<40 || x.w<32).slice(0,12)};
    },{route,width,root});
    measurements.push(data);
    console.log('JOURNAL_DENSE '+JSON.stringify(data));
    expect(data.horizontalOverflow).toBeLessThanOrEqual(2);
  }
  for(const width of [1366,768,390,320]){
    for(const route of ['today','tasks','schedule'])await capture(route,width);
  }
  await page.setViewportSize({width:390,height:900});
  await page.locator('#wbJournalDockV367 [data-journal-route="tasks"]').click();
  const first=page.locator('#boardView [data-j420-task-id]').first();
  await first.click();
  await expect(page.locator('#j494AtelierNote')).toBeVisible();
  await page.screenshot({path:'journal-audit-populated/390-task-note.png',animations:'disabled',fullPage:true});
  fs.writeFileSync('journal-audit-populated/metrics.json',JSON.stringify({measurements,errors},null,2));
  expect(errors).toEqual([]);
});
