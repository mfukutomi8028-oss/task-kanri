import {test, expect} from '@playwright/test';

test('a compact mobile composer leaves room to read several recent messages', async ({page}) => {
  await page.setViewportSize({width:375,height:650});
  await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort('blockedbyclient'));
  await page.goto('/test-harness/messaging-preview/index.html');
  await page.getByRole('button',{name:'自分宛てメッセージ',exact:true}).click();
  const body=page.getByRole('textbox',{name:'メッセージ本文'}),timeline=page.getByRole('log');
  for(let index=1;index<=5;index++){
    const text='表示範囲を確認する架空のメッセージ '+index;
    await body.fill(text);
    await page.getByRole('button',{name:'送信',exact:true}).click();
    await expect(timeline.getByText(text,{exact:true})).toBeVisible();
  }
  await body.fill('まだ送信していない下書き');
  const measure=()=>timeline.evaluate(log=>{
    const frame=log.getBoundingClientRect();
    return {height:log.clientHeight,visible:[...log.querySelectorAll('.om-message-body')].filter(bubble=>{
      const box=bubble.getBoundingClientRect();return box.top>=frame.top-1&&box.bottom<=frame.bottom+1;
    }).length};
  });
  const space=await measure();
  console.log('MOBILE_TIMELINE_WITH_DRAFT',JSON.stringify(space));
  expect(space.height).toBeGreaterThanOrEqual(350);
  expect(space.visible).toBeGreaterThanOrEqual(3);
  const search=page.getByRole('searchbox',{name:'読み込んだ履歴を検索'});
  await expect(search).toBeHidden();
  await page.getByRole('button',{name:'検索',exact:true}).click();
  await expect(search).toBeVisible();
  await search.fill('メッセージ 3');
  await expect(timeline.locator('.om-message')).toHaveCount(1);
  await page.getByRole('button',{name:'検索を閉じる',exact:true}).click();
  await expect(timeline.locator('.om-message')).toHaveCount(6);
  await expect(body).toHaveValue('まだ送信していない下書き');
});

async function exposeMobileControl(page,name){
  const disclosure=page.getByRole('button',{name,exact:true});
  if(await disclosure.isVisible()&&await disclosure.getAttribute('aria-expanded')==='false')await disclosure.click();
}

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
    const incoming=timeline.locator('.om-message').filter({hasText:'作業内容を確認しました。追加があれば共有します。'});
    const confirm=incoming.getByRole('button',{name:'確認しました',exact:true});
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(incoming.getByText(/確認済み/)).toBeVisible();
    const outgoing=timeline.locator('.om-message').filter({hasText:'ありがとうございます。明日の設置作業も確認をお願いします。'});
    await outgoing.getByRole('button',{name:'確認状況',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await expect(dialog.getByText('担当者B',{exact:true})).toBeVisible();
    await expect(dialog.getByText('担当者C',{exact:true})).toBeVisible();
    await expect(dialog.getByText('未確認',{exact:true})).toHaveCount(2);
    await dialog.getByRole('button',{name:'閉じる',exact:true}).click();
    const body=page.getByRole('textbox',{name:'メッセージ本文'});
    await body.fill('新しい確認依頼です');
    await exposeMobileControl(page,'入力オプション');
    await page.getByRole('checkbox',{name:'確認依頼',exact:true}).check();
    await page.getByRole('button',{name:'送信',exact:true}).click();
    const fresh=timeline.locator('.om-message').filter({hasText:'新しい確認依頼です'});
    await expect(fresh.getByRole('button',{name:'確認状況',exact:true})).toBeVisible();
    if(width<=760){
      await fresh.getByRole('button',{name:'その他',exact:true}).click();
      await dialog.getByRole('button',{name:'編集',exact:true}).click();
    }else await fresh.getByRole('button',{name:'編集',exact:true}).click();
    await body.fill('更新した確認依頼です');
    await page.getByRole('button',{name:'更新',exact:true}).click();
    const edited=timeline.locator('.om-message').filter({hasText:'更新した確認依頼です'});
    await edited.getByRole('button',{name:'確認状況',exact:true}).click();
    await expect(dialog.getByText('未確認',{exact:true})).toHaveCount(2);
    await dialog.getByRole('button',{name:'閉じる',exact:true}).click();
    await body.fill('確認テスト');
    await body.dispatchEvent('keydown',{key:'Enter',ctrlKey:true,isComposing:true});
    await expect(timeline.getByText('確認テスト',{exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'送信',exact:true}).click();
    await expect(timeline.getByText('確認テスト',{exact:true})).toBeVisible();
    await exposeMobileControl(page,'入力オプション');
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
    await exposeMobileControl(page,'入力オプション');
    await page.getByRole('button',{name:'日次報告',exact:true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('外来PC初期設定',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'下書きに入れる',exact:true}).click();
    await expect(body).toHaveValue(/日次業務報告/);
    if(width<680)await page.getByRole('button',{name:'一覧',exact:true}).click();
    await page.getByRole('button',{name:'自分宛てメッセージ',exact:true}).click();
    await exposeMobileControl(page,'入力オプション');
    await expect(page.getByRole('checkbox',{name:'確認依頼',exact:true})).toBeDisabled();
    expect(await page.locator('html').evaluate(e=>e.scrollWidth<=innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

for(const [width,height,theme] of [[1366,900,'light'],[390,844,'light'],[320,740,'dark']]){
  test('messaging preferences and shared message actions '+width+' '+theme,async({page})=>{
    await page.setViewportSize({width,height});
    await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort('blockedbyclient'));
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto('/test-harness/messaging-preview/index.html?theme='+theme);
    await expect(page.getByLabel('メッセージの未読件数')).toHaveText('未読 2件');
    const group=page.getByRole('button',{name:'システム課',exact:true});await group.click();
    const incoming=page.locator('.om-message').filter({hasText:'外来PCの設定が完了しました。'});
    const menu=page.getByRole('dialog',{name:'メッセージの操作'});
    await incoming.getByRole('button',{name:'その他',exact:true}).click();
    const like=menu.getByRole('button',{name:'いいね',exact:true});
    await expect(like).toBeEnabled();await like.click();await expect(like).toHaveAttribute('aria-pressed','true');
    await menu.getByRole('button',{name:'ブックマークに追加',exact:true}).click();
    await expect(menu.getByRole('button',{name:'ブックマークを解除',exact:true})).toBeEnabled();
    await menu.getByRole('button',{name:'会話に固定',exact:true}).click();
    await expect(menu.getByRole('button',{name:'固定を解除',exact:true})).toBeEnabled();
    await menu.getByRole('button',{name:'閉じる',exact:true}).click();
    await incoming.getByRole('button',{name:'その他',exact:true}).click();
    await expect(like).toHaveAttribute('aria-pressed','true');
    await expect(menu.getByRole('button',{name:'固定を解除',exact:true})).toBeEnabled();
    await like.click();await expect(like).toHaveAttribute('aria-pressed','false');
    await menu.getByRole('button',{name:'ブックマークを解除',exact:true}).click();
    await expect(menu.getByRole('button',{name:'ブックマークに追加',exact:true})).toBeEnabled();
    await menu.getByRole('button',{name:'固定を解除',exact:true}).click();
    await expect(menu.getByRole('button',{name:'会話に固定',exact:true})).toBeEnabled();
    await menu.getByRole('button',{name:'閉じる',exact:true}).click();
    const settings=page.getByRole('dialog',{name:'会話設定'});
    const openSettings=async()=>{await exposeMobileControl(page,'検索');await page.getByRole('button',{name:'会話設定',exact:true}).click();};
    const closeSettings=()=>settings.getByRole('button',{name:'閉じる',exact:true}).click();
    const back=async()=>{if(width<=760)await page.getByRole('button',{name:'一覧',exact:true}).click();};
    await openSettings();
    for(const label of ['お気に入り','通知をミュート','会話を固定']){
      const control=settings.getByRole('checkbox',{name:label,exact:true});
      await expect(control).toBeEnabled();await control.check();await expect(control).toBeEnabled();await expect(control).toBeChecked();
    }
    await closeSettings();await back();
    await page.getByRole('button',{name:'お気に入り',exact:true}).click();await expect(group).toBeVisible();
    await group.click();await openSettings();
    await expect(settings.getByRole('checkbox',{name:'通知をミュート',exact:true})).toBeChecked();
    const archive=settings.getByRole('checkbox',{name:'アーカイブ',exact:true});
    await archive.check();await expect(archive).toBeEnabled();await closeSettings();await back();
    await expect(group).toHaveCount(0);await page.getByRole('button',{name:'アーカイブ',exact:true}).click();await expect(group).toBeVisible();
    await group.click();await openSettings();await expect(archive).toBeChecked();
    await archive.uncheck();await expect(archive).toBeEnabled();await closeSettings();await back();
    await page.getByRole('button',{name:'すべて',exact:true}).click();await expect(group).toBeVisible();
    await page.getByRole('button',{name:'院内PC更新プロジェクト',exact:true}).click();
    await page.locator('.om-message').filter({hasText:'更新計画を確認してください。'}).getByRole('button',{name:'その他',exact:true}).click();
    await expect(menu.getByRole('button',{name:'会話に固定',exact:true})).toHaveCount(0);
    await expect(menu.getByText('共有固定は管理者が変更できます。',{exact:true})).toBeVisible();
    await menu.getByRole('button',{name:'閉じる',exact:true}).click();
    expect(await page.locator('html').evaluate(e=>e.scrollWidth<=innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('messaging invitation and file controls keep unknown unread totals and attachment retries explicit',async({page})=>{
  await page.setViewportSize({width:1366,height:900});
  await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort('blockedbyclient'));
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('/test-harness/messaging-preview/index.html?liveControls=1');
  await expect(page.getByLabel('メッセージの未読件数')).toContainText('取得済みの未読');
  const invite=page.getByRole('region',{name:'グループ招待'});
  await expect(invite.getByText('新規プロジェクト',{exact:true})).toBeVisible();
  await invite.getByRole('button',{name:'承諾',exact:true}).click();
  await expect(invite).toBeHidden();
  await expect(page.getByRole('button',{name:'新規プロジェクト',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'システム課',exact:true}).click();
  const composer=page.getByLabel('会話',{exact:true});
  await expect(composer.getByRole('button',{name:'ファイルを添付',exact:true})).toBeEnabled();
  await page.locator('.om-file-input').setInputFiles({name:'報告.txt',mimeType:'text/plain',buffer:Buffer.from('synthetic report')});
  await expect(composer.getByText('報告.txt',{exact:true})).toBeVisible();
  await composer.getByRole('button',{name:'送信',exact:true}).click();
  const message=page.getByLabel('メッセージ履歴').locator('.om-message').filter({hasText:'添付ファイル 1 をダウンロード'});
  await expect(message).toHaveCount(1);
  await message.getByRole('button',{name:'編集',exact:true}).click();
  await expect(composer.getByText('添付ファイル 1件を維持',{exact:true})).toBeVisible();
  await composer.getByRole('textbox',{name:'メッセージ本文'}).fill('添付の説明');
  await composer.getByRole('button',{name:'更新',exact:true}).click();
  await expect(message.getByText('添付の説明',{exact:true})).toBeVisible();
  const download=page.waitForEvent('download');
  await message.getByRole('button',{name:'添付ファイル 1 をダウンロード'}).click();
  expect((await download).suggestedFilename()).toBe('報告.txt');
  expect(errors).toEqual([]);
});

test('selected images are prepared once, failures never send the original, and originals need an explicit choice',async({page})=>{
  await page.setViewportSize({width:1366,height:900});
  await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort('blockedbyclient'));
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('/test-harness/messaging-preview/index.html?liveControls=1');
  await page.getByRole('button',{name:'システム課',exact:true}).click();
  const composer=page.getByLabel('会話',{exact:true}),input=page.locator('.om-file-input');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC','base64');
  await input.setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png});
  await expect(composer.getByText('photo.png',{exact:true})).toBeVisible();
  await composer.getByRole('button',{name:'解除',exact:true}).click();
  await input.setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
  await expect(page.getByText('画像を準備できませんでした',{exact:false})).toBeVisible();
  await expect(composer.getByText('broken.png',{exact:true})).toHaveCount(0);
  const original=composer.getByLabel('原本のまま送る');
  await expect(page.getByText('位置情報などのメタデータが残る場合があります')).toBeHidden();
  await original.check();
  await expect(page.getByText('位置情報などのメタデータが残る場合があります')).toBeVisible();
  await input.setInputFiles({name:'raw.png',mimeType:'image/png',buffer:png});
  await expect(composer.getByText('raw.png',{exact:true})).toBeVisible();
  await composer.getByRole('button',{name:'送信',exact:true}).click();
  await expect(page.getByLabel('メッセージ履歴').locator('.om-message').filter({hasText:'添付ファイル 1 をダウンロード'})).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('capacity is fetched only on demand, cached, compact, and warns before attaching',async({page})=>{
  await page.setViewportSize({width:1366,height:900});
  await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort('blockedbyclient'));
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('/test-harness/messaging-preview/index.html?liveControls=1');
  await page.getByRole('button',{name:'システム課',exact:true}).click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(()=>globalThis.__usageReads)).toBe(0);
  await page.getByLabel('会話',{exact:true}).getByRole('button',{name:'ファイルを添付',exact:true}).click();
  await expect(page.getByText('保存容量が少なくなっています',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'共有データ',exact:true}).click();
  const usage=page.locator('.om-usage');
  await expect(usage).toContainText('全体 650MB/800MB');
  await expect(usage).toContainText('本人 3.0MB');
  await expect(usage).toContainText('本日 1.0MB/20.0MB');
  await expect(usage).toContainText('残りが少なくなっています');
  expect(await page.evaluate(()=>globalThis.__usageReads)).toBe(1);
  expect(errors).toEqual([]);
});

test('image preparation stays consistent across conversation switches, draft return, upload failure retry and revoked sessions',async({page})=>{
  await page.setViewportSize({width:1366,height:900});
  await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort('blockedbyclient'));
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{const original=globalThis.createImageBitmap.bind(globalThis);globalThis.__holdImages=false;globalThis.createImageBitmap=async(...args)=>{if(globalThis.__holdImages)await new Promise(resolve=>{globalThis.__releaseImages=resolve;});return original(...args);};});
  await page.goto('/test-harness/messaging-preview/index.html?liveControls=1');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC','base64');
  const composer=page.getByLabel('会話',{exact:true}),input=page.locator('.om-file-input');
  const team=()=>page.getByRole('button',{name:'システム課',exact:true}).click();
  const self=()=>page.getByRole('button',{name:'自分宛てメッセージ',exact:true}).click();
  // 1) Switching conversation while an image is being prepared never attaches it anywhere.
  await team();await page.evaluate(()=>{globalThis.__holdImages=true;});
  await input.setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png});
  await expect(page.getByText('画像を準備しています…',{exact:true})).toBeVisible();
  await expect(composer.getByRole('button',{name:'送信',exact:true})).toBeDisabled();
  await page.waitForFunction(()=>typeof globalThis.__releaseImages==='function');
  await self();await page.evaluate(()=>{globalThis.__holdImages=false;globalThis.__releaseImages();globalThis.__releaseImages=null;});
  await expect(composer.getByText('photo.png',{exact:true})).toHaveCount(0);
  await team();await expect(composer.getByText('photo.png',{exact:true})).toHaveCount(0);
  // 2) A prepared image stays in the draft when leaving and returning.
  await input.setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png});
  await expect(composer.getByText('photo.png',{exact:true})).toBeVisible();
  await self();await team();
  await expect(composer.getByText('photo.png',{exact:true})).toBeVisible();
  // 3) An upload failure is retried with the identical prepared bytes and one message.
  await page.evaluate(()=>{globalThis.__failUploads=1;globalThis.__uploads=[];});
  await composer.getByRole('button',{name:'送信',exact:true}).click();
  await expect(page.getByText('添付を保存できません',{exact:false})).toBeVisible();
  await composer.getByRole('button',{name:'送信',exact:true}).click();
  await expect(page.getByLabel('メッセージ履歴').locator('.om-message').filter({hasText:'添付ファイル 1 をダウンロード'})).toHaveCount(1);
  const uploads=await page.evaluate(()=>globalThis.__uploads);
  expect(uploads).toHaveLength(2);
  expect(uploads[1].requestId).toBe(uploads[0].requestId);
  expect(uploads[1].bytes).toEqual(uploads[0].bytes);
  expect(Buffer.from(uploads[0].bytes).equals(png)).toBe(false);
  // 4) Losing authorization during preparation discards the result.
  await page.evaluate(()=>{globalThis.__holdImages=true;});
  await input.setInputFiles({name:'late.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(()=>typeof globalThis.__releaseImages==='function');
  await page.evaluate(async()=>{await globalThis.__previewSession.setContext(null);globalThis.__holdImages=false;globalThis.__releaseImages();});
  await page.evaluate(()=>globalThis.__previewSession.setContext(globalThis.__previewContext));
  await team();
  await expect(composer.getByText('late.png',{exact:true})).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the original choice covers one attach action only and never carries to the next attachment or conversation',async({page})=>{
  await page.setViewportSize({width:1366,height:900});
  await page.route('**/*',r=>new URL(r.request().url()).origin===(process.env.WB_TEST_ORIGIN||'http://127.0.0.1:4173')?r.continue():r.abort('blockedbyclient'));
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('/test-harness/messaging-preview/index.html?liveControls=1');
  // A PNG carrying a text metadata chunk: kept only when sent as the original.
  const base=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC','base64');
  const {crc32}=await import('node:zlib');
  const data=Buffer.from('Comment\0synthetic-metadata','latin1'),type=Buffer.from('tEXt');
  const chunk=Buffer.concat([Buffer.alloc(4),type,data,Buffer.alloc(4)]);chunk.writeUInt32BE(data.length,0);chunk.writeUInt32BE(crc32(Buffer.concat([type,data]))>>>0,8+data.length);
  const png=Buffer.concat([base.subarray(0,33),chunk,base.subarray(33)]);
  const composer=page.getByLabel('会話',{exact:true}),input=page.locator('.om-file-input'),original=composer.getByLabel('原本のまま送る');
  const has=bytes=>Buffer.from(bytes).includes('synthetic-metadata');
  await page.getByRole('button',{name:'システム課',exact:true}).click();
  await page.evaluate(()=>{globalThis.__uploads=[];});
  await original.check();
  await input.setInputFiles({name:'raw.png',mimeType:'image/png',buffer:png});
  await expect(composer.getByText('raw.png',{exact:true})).toBeVisible();
  // The choice is consumed by that attach action.
  await expect(original).not.toBeChecked();
  await expect(page.getByText('位置情報などのメタデータが残る場合があります')).toBeHidden();
  await input.setInputFiles({name:'next.png',mimeType:'image/png',buffer:png});
  await expect(composer.getByText('next.png',{exact:true})).toBeVisible();
  await composer.getByRole('button',{name:'送信',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(globalThis.__uploads||[]).length)).toBe(2);
  const uploads=await page.evaluate(()=>globalThis.__uploads);
  expect(has(uploads.find(u=>u.filename==='raw.png').bytes)).toBe(true);
  expect(has(uploads.find(u=>u.filename==='next.png').bytes)).toBe(false);
  // Checking it and switching conversation clears it too.
  await original.check();
  await page.getByRole('button',{name:'自分宛てメッセージ',exact:true}).click();
  await expect(original).not.toBeChecked();
  expect(errors).toEqual([]);
});
