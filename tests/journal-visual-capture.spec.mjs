import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

// Isolated visual capture: no live rooms, production Firebase or external requests.
test.use({ timezoneId: 'Asia/Tokyo' });
const ROOM='journal-visual-synthetic-v596';

test('JOURNAL page structure and interaction snapshots at four widths', async ({page})=>{
  test.setTimeout(180000);
  fs.mkdirSync('visual-audit',{recursive:true});
  const metrics=[];
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.origin==='http://127.0.0.1:4173'
      ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(({room})=>{
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null;},set(){}});
    localStorage.setItem('systemTaskRoomId',room);
    localStorage.setItem('systemTaskUser','VisualTestUser');
  },{room:ROOM});
  await page.goto('/?room='+ROOM,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WORK_BOARD_ASSETS_READY===true);
  await page.locator('[data-wb-display-choice="journal"]').evaluate(el=>el.click());
  await page.waitForFunction(()=>document.documentElement.dataset.wbDisplay==='journal' &&
    Boolean(document.querySelector('link[data-workboard-style="journal-display-v367.css"][data-loaded="true"]')) &&
    Boolean(document.querySelector('#todayView .j420-today')));
  for (const width of [1366,768,390,320]){
    await page.setViewportSize({width,height:900});
    const nav=width<=860?'#wbJournalDockV367':'.wb-journal-tabs-v367';
    for (const route of ['today','tasks','schedule']){
      const button=page.locator(nav+' [data-journal-route="'+route+'"]');
      await button.click();
      await expect(button).toHaveAttribute('aria-current','page');
      const root=route==='today'?'#todayView .j420-today':
        route==='tasks'?'#boardView .j420-atelier':'#scheduleView .j425-schedule';
      await expect(page.locator(root)).toBeVisible();
      await page.waitForTimeout(160);
      await page.screenshot({path:path.join('visual-audit','journal-'+width+'-'+route+'.png'),
        fullPage:true,animations:'disabled'});
      const measure=await page.evaluate(({width,route,nav})=>{
        const rect=sel=>{
          const el=document.querySelector(sel);
          if(!el)return null;const b=el.getBoundingClientRect(),s=getComputedStyle(el);
          return {x:+b.x.toFixed(1),y:+b.y.toFixed(1),w:+b.width.toFixed(1),h:+b.height.toFixed(1),font:s.fontSize,visible:s.display!=='none'};
        };
        const active=document.querySelector(nav+' [aria-current="page"]');
        return {width,route,documentWidth:document.documentElement.scrollWidth,
          innerWidth:window.innerWidth,bodyWidth:document.body.scrollWidth,
          pageHeight:document.documentElement.scrollHeight,
          activeLabel:active?.textContent?.trim()||null,
          nav:rect(nav),head:rect('.wb-journal-header-v367'),
          main:rect(route==='today'?'#todayView .j420-today':route==='tasks'?'#boardView .j420-atelier':'#scheduleView .j425-schedule'),
          primary:rect(route==='today'?'#todayView .j420-focus':route==='tasks'?'#boardView .j420-atelier-desk':'#scheduleView .j425-schedule-planner'),
          action:rect(route==='today'?'#todayView [data-j420-create-task]':route==='tasks'?'#boardView [data-j420-new-task]':'#scheduleView [data-j425-add-schedule]'),
          tabs:[...document.querySelectorAll(nav+' button[data-journal-route]')].map(el=>({
            label:el.textContent.trim(),height:+el.getBoundingClientRect().height.toFixed(1),
            width:+el.getBoundingClientRect().width.toFixed(1)}))
        };
      },{width,route,nav});
      metrics.push(measure);
      console.log('VISUAL_AUDIT '+JSON.stringify(measure));
      expect(measure.documentWidth-width).toBeLessThanOrEqual(2);
    }
  }
  await page.setViewportSize({width:1366,height:900});
  await page.locator('.wb-journal-tabs-v367 [data-journal-route="tasks"]').click();
  const control=page.locator('.wb-journal-tabs-v367 [data-journal-route="schedule"]');
  await control.hover();
  await page.screenshot({path:'visual-audit/journal-1366-tabs-hover.png',fullPage:false,animations:'disabled'});
  fs.writeFileSync('visual-audit/metrics.json',JSON.stringify(metrics,null,2)+'\n','utf8');
});
