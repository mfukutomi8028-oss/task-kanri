import {test, expect} from '@playwright/test';

// Uses only the isolated fixture and the production-intended view/store modules.
for(const [width,height,theme] of [[1366,900,'light'],[390,844,'light'],[320,740,'dark']]){
  test('messaging preview '+width+' '+theme+' supports work-linked conversation',async({page})=>{
    await page.setViewportSize({width,height});
    await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort('blockedbyclient'));
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto('/test-harness/messaging-preview/index.html?theme='+theme);
    await expect(page.getByRole('heading',{name:'メッセージ',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'システム課',exact:true}).click();
    const timeline=page.getByLabel('メッセージ履歴');
    await expect(timeline.getByText('外来PC初期設定',{exact:true})).toBeVisible();
    const body=page.getByRole('textbox',{name:'メッセージ本文'});
    await body.fill('確認テスト');
    await body.dispatchEvent('keydown',{key:'Enter',ctrlKey:true,isComposing:true});
    await expect(timeline.getByText('確認テスト',{exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'送信',exact:true}).click();
    await expect(timeline.getByText('確認テスト',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'業務を添付',exact:true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('checkbox',{name:'PC初期設定手順書',exact:true}).check();
    await page.getByRole('button',{name:'添付する',exact:true}).click();
    await expect(page.getByLabel('会話',{exact:true}).getByText('PC初期設定手順書',{exact:true})).toBeVisible();
    await body.fill('手順書を共有します');
    await page.getByRole('button',{name:'送信',exact:true}).click();
    await expect(timeline.getByText('手順書を共有します',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'共有データ',exact:true}).click();
    await expect(page.getByRole('heading',{name:'共有データ',exact:true})).toBeVisible();
    await expect(page.locator('.om-shared').getByRole('button',{name:'PC初期設定手順書',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'共有データを閉じる'}).click();
    await page.getByRole('button',{name:'日次報告',exact:true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('外来PC初期設定',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'下書きに入れる',exact:true}).click();
    await expect(body).toHaveValue(/日次業務報告/);
    expect(await page.locator('html').evaluate(e=>e.scrollWidth<=innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
