// Read-only visual evidence from isolated synthetic rooms, never the live site.
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const [baseline, output='origin-visual-evidence'] = process.argv.slice(2);
if (!baseline) throw Error('usage: node tests/origin-visual-audit.mjs BASELINE_DIRECTORY [OUTPUT]');
const out=resolve(output), room='origin-visual-audit';
const sizes=[[320,760,'light'],[390,844,'light'],[390,844,'dark'],[1366,900,'light'],[1366,900,'dark'],[1920,1080,'light']];
const records=[];
const servers=[];
let browser;
async function server(root,port){
 const child=spawn(process.execPath,[join(resolve(root),'test-harness/static-server.mjs')],{env:{...process.env,PORT:String(port)},stdio:'inherit'});
 servers.push(child);
 const url='http://127.0.0.1:'+port;
 for(let n=0;n<80;n++){
  if(child.exitCode!==null)throw Error('Static server exited: '+root);
  try{if((await fetch(url)).ok)return url}catch{}
  await new Promise(r=>setTimeout(r,125));
 }
 throw Error('Static server did not start: '+root);
}
async function seed(page){
 await page.evaluate(async()=>{
  const b=window.WorkBoardPaletteBridge,s=b.readSnapshot(),m=window.WorkBoardPaletteMemoBridgeV369;
  const run=async cmd=>{const result=await cmd;if(!result?.ok)throw Error('Synthetic fixture: '+JSON.stringify(result))};
  const date=n=>{const d=new Date();d.setDate(d.getDate()+n);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const items=[['定期バックアップの動作確認','対応中','高',-1],['システムの更新手順を整理','未着手','高',0],['PC貸出の申請内容を確認','確認待ち','中',1],['次回のネットワーク点検に向けた準備','未着手','中',5],['長い件名でも表示や操作ボタンが崩れないことを確認するための業務','対応中','低',4],['マニュアルの更新','未着手','低',10]];
  for(const [title,status,priority,n] of items)await run(b.dispatch({type:'task.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,assignee:s.currentUser,status:s.statuses.includes(status)?status:s.statuses[0],category:s.categories[0],title,description:'テスト用の業務説明。実施手順と次の確認事項を記録します。',requester:'',tags:'',checklist:'',checklistDone:[],priority,dueDate:date(n),dueTime:n===0?'15:30':'',pinned:false}));
  for(const [title,hour,offset] of [['業務連絡ミーティング',10,0],['端末点検',13,0],['来週の作業調整',15,2]]){
   const start=new Date();start.setDate(start.getDate()+offset);start.setHours(hour,0,0,0);
   await run(b.dispatch({type:'schedule.create',ownerRoom:s.roomId,ownerUser:s.currentUser,revision:0,values:{title,startAt:start.toISOString(),endAt:new Date(start.getTime()+3600000).toISOString(),assignee:s.currentUser,category:s.categories[0],relatedTaskId:'',location:'テスト会議室',memo:'合成データ'}}));
  }
  for(const text of ['問い合わせへの返信','会議資料を確認する','端末一覧の更新','来週の作業を確認する'])await run(b.dispatch({type:'todo.create',text,memo:'テスト用補足'}));
  for(const [title,paperColor] of [['運用手順の確認','ivory'],['次回の点検項目','mint'],['打ち合わせのメモ','sky']])await run(m.dispatch({type:'memo.create',ownerRoom:s.roomId,ownerUser:s.currentUser,title,body:'テスト用のメモ。確認手順と次の対応をまとめる。',category:'手順',tags:[],pinned:false,paperColor}));
 });
}
async function capture(side,url,width,height,theme){
 const ctx=await browser.newContext({viewport:{width,height},locale:'ja-JP',timezoneId:'Asia/Tokyo',reducedMotion:'reduce',serviceWorkers:'block'});
 try{
  await ctx.route('**/*',r=>new URL(r.request().url()).origin===url?r.continue():r.abort('blockedbyclient'));
  const page=await ctx.newPage();const errors=[];
  // A common, safe morning makes both versions use identical fixtures and avoids a
  // real-time schedule reminder obscuring the resting-state comparison.
  await page.clock.setFixedTime(new Date('2026-11-24T08:00:00+09:00'));
  page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(id=>{
   Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null},set(){}});
   localStorage.setItem('systemTaskRoomId',id);
   localStorage.setItem('systemTaskUser','テスト担当');
   localStorage.setItem('system-task-users:'+id,JSON.stringify(['テスト担当','テスト同僚']));
  },room);
  await page.goto(url+'/?room='+room,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true,undefined,{timeout:30000});
  await page.locator('[data-wb-display-choice="modern"]').evaluate(el=>el.click());
  const root=page.locator('#modernOriginRoot');await expect(root).toBeVisible();
  if(await root.getAttribute('data-theme')!==theme){
   await root.locator('#originSettingsToggle').click();await root.locator('#themeBtn').click();await root.locator('#originSettingsPanel [data-action="settings-close"]').click();
  }
  await expect(root).toHaveAttribute('data-theme',theme);
  const nav=root.locator(width<=770?'#mobileNav':'#desktopNav');
  async function shot(route){
   await page.mouse.move(2,2);
   await page.evaluate(async()=>{window.scrollTo(0,0);await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
   const name=[side,width,theme,route].join('-')+'.png';
   await page.screenshot({path:join(out,name),animations:'disabled'});
   const metrics=await root.evaluate(el=>{
    const r=el.shadowRoot,w=r.querySelector('#workspace'),h=w.querySelector('.page-heading');
    const box=h?.getBoundingClientRect(),visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
    const position=(selector)=>{
      const el=r.querySelector(selector);
      if(!el||!visible(el))return null;
      const bounds=el.getBoundingClientRect();
      return {top:bounds.top,bottom:bounds.bottom};
    };
    const recordPositions={task:position('.origin-board-card .item-name'),memo:position('.memo-card'),mobileNav:position('#mobileNav')};
    return {recordPositions,release:el.dataset.releaseVersion,title:h?.querySelector('h1')?.textContent,headingHeight:box?.height,overflow:document.documentElement.scrollWidth-innerWidth,workspaceWidth:w.getBoundingClientRect().width,controls:[...r.querySelectorAll('button,input,select,textarea,[data-origin-note-editor],a[href]')].filter(visible).map(e=>({name:(e.getAttribute('aria-label')||e.innerText||e.title||e.placeholder||e.name||'').trim().slice(0,100),width:Math.round(e.getBoundingClientRect().width),height:Math.round(e.getBoundingClientRect().height)}))};
   });
   records.push({side,width,height,theme,route,name,...metrics,errors:[...errors]});
   await writeFile(join(out,'metrics.json'),JSON.stringify(records,null,2));
   console.log('Captured '+name+' overflow='+metrics.overflow+' heading='+metrics.headingHeight);
  }
  await shot('empty-today');await seed(page);
  for(const route of ['today','tasks','todos','calendar','notes','tools']){
   await nav.locator('[data-route="'+route+'"]').click();await shot(route);
   if(route==='tasks'){
    await root.locator('[data-action="task-layout"][data-value="board"]').click();await shot('task-board');
    await root.locator('[data-action="task-layout"][data-value="list"]').click();
    await root.locator('.origin-task-collection .item-name').first().click();await expect(root.locator('#sheet')).toBeVisible();await shot('task-detail');
    await page.keyboard.press('Escape');await expect(root.locator('#overlay')).toBeHidden();
   }
   if(route==='notes'){
    if(width<=770)await root.locator('[data-memo-header-mode="personal"]').click();
    else{await nav.locator('.origin-memo-nav').hover();await nav.locator('[data-memo-nav-mode="personal"]').click();}
    await expect(root.locator('.sticky-add')).toBeEnabled();await root.locator('.sticky-add').click();
    await root.locator('.sticky-origin-card [data-sticky-text]').first().fill('テスト用の個人付箋');
    await expect.poll(()=>page.evaluate(()=>window.WorkBoardPersonalStickyStoreV659.readSnapshot().notes[0]?.content.text)).toBe('テスト用の個人付箋');
    await shot('sticky');
   }
  }
 }finally{await ctx.close()}
}
await mkdir(out,{recursive:true});
try{
 const before=await server(baseline,4174),after=await server('.',4173);
 browser=await chromium.launch({headless:true});
 for(const [width,height,theme] of sizes){await capture('before',before,width,height,theme);await capture('after',after,width,height,theme);}
 const pairs=records.filter(r=>r.side==='before').map(a=>({a,b:records.find(b=>b.side==='after'&&b.width===a.width&&b.theme===a.theme&&b.route===a.route)}));
 await writeFile(join(out,'compare.html'),'<!doctype html><html lang="ja"><meta charset="utf-8"><title>Origin visual comparison</title><style>body{font:16px system-ui;margin:24px;color:#222}section{margin:24px 0;border-top:1px solid #ddd}div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}img{max-width:100%;height:auto;display:block}</style><h1>Origin visual comparison (synthetic records)</h1>'+pairs.map(({a,b})=>'<section><h2>'+a.route+' / '+a.width+'px / '+a.theme+'</h2><div><figure><figcaption>Before Ver.'+a.release+'</figcaption><a href="'+a.name+'"><img loading="lazy" src="'+a.name+'"></a></figure><figure><figcaption>After Ver.'+b.release+'</figcaption><a href="'+b.name+'"><img loading="lazy" src="'+b.name+'"></a></figure></div></section>').join('')+'</html>');
 console.log('Total captures: '+records.length);
 if(records.length!==sizes.length*2*10||pairs.some(({b})=>!b))throw Error('Incomplete before/after capture set');
 if(records.some(r=>r.errors.length))throw Error('Page errors found; inspect metrics.json');
 if(records.some(r=>r.overflow>3))throw Error('Unexpected horizontal document overflow; inspect metrics.json');
}finally{await browser?.close();for(const s of servers)s.kill();}
