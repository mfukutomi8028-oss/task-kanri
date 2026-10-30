import { test, expect } from '@playwright/test';

const PROJECT = 'demo-task-kanri';
const ROOM = 'test-firebase-emulator-work-features-e2e';
const HOST = '127.0.0.1';
const PORT = 9000;
const PROD_DATABASE_RE = /https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i;

test.skip(process.env.WORK_BOARD_FIREBASE_E2E !== '1', 'requires the isolated RTDB emulator');
test.describe.configure({ mode: 'serial' });

function emulatorUrl(path = '') {
  const encoded = String(path || '')
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return `http://${HOST}:${PORT}/${encoded ? `${encoded}.json` : '.json'}?ns=${encodeURIComponent(PROJECT)}`;
}

async function emulatorRequest(path, { method = 'GET', value } = {}) {
  const response = await fetch(emulatorUrl(path), {
    method,
    headers: value === undefined ? undefined : { 'content-type': 'application/json' },
    body: value === undefined ? undefined : JSON.stringify(value)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path || '/'} failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const readDb = path => emulatorRequest(path);
const putDb = (path, value) => emulatorRequest(path, { method: 'PUT', value });
const deleteDb = path => emulatorRequest(path, { method: 'DELETE' });

function memoRecord(id, overrides = {}) {
  const now = Date.now();
  return {
    id,
    title: 'Emulator 業務メモ',
    body: '共有メモ本文',
    category: '手順',
    tags: ['Emulator', '共有'],
    pinned: false,
    revision: 1,
    createdAt: now - 10_000,
    updatedAt: now,
    createdBy: '福冨',
    updatedBy: '福冨',
    ...overrides
  };
}

function futureIso(days = 5) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function installEmulatorBoundary(page, { modern = false } = {}) {
  const productionRequests = [];

  await page.addInitScript(({ project, room, host, port, modern }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
    } catch {}

    const demoConfig = Object.freeze({
      apiKey: 'demo-api-key',
      authDomain: `${project}.firebaseapp.com`,
      databaseURL: `http://${host}:${port}/?ns=${project}`,
      projectId: project,
      appId: '1:000000000000:web:firebase-emulator-only'
    });

    window.WORK_BOARD_TEST = Object.freeze({ emulator: true, host, port,
      ...(modern ? { modernReadV555:true, modernWriteV563:true } : {}) });
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return demoConfig; },
      set() {}
    });
  }, { project: PROJECT, room: ROOM, host: HOST, port: PORT, modern });

  await page.route(PROD_DATABASE_RE, route => {
    productionRequests.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  page.on('request', request => {
    if (PROD_DATABASE_RE.test(request.url())) productionRequests.push(request.url());
  });

  return productionRequests;
}

async function clickCurrent(page, selector) {
  const clicked = await page.evaluate(sel => {
    const node = document.querySelector(sel);
    if (!(node instanceof HTMLElement)) return false;
    node.click();
    return true;
  }, selector);
  expect(clicked, `expected clickable element: ${selector}`).toBeTruthy();
}

async function bootBoard(page) {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const productionRequests = await installEmulatorBoundary(page);

  await page.goto(`/?room=${encodeURIComponent(ROOM)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('connectionPill')?.textContent?.includes('共同編集ON'), undefined, { timeout: 30_000 });
  await expect(page.locator('[data-work-memo-layout]')).toBeAttached({ timeout: 30_000 });
  await expect(page.locator('#taskStartDateV167')).toBeAttached({ timeout: 30_000 });

  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);
  return { productionRequests, pageErrors };
}

async function openMemoMode(page) {
  await clickCurrent(page, '[data-work-memo-layout]');
  await expect(page.locator('#workMemoViewV167')).toBeVisible();
}

async function readMemo(id) {
  return readDb(`rooms/${ROOM}/businessMemos/${id}`);
}

test.beforeEach(async () => {
  await deleteDb(`rooms/${ROOM}`);
});

test('adds a shared business memo through the real dialog and persists revision metadata', async ({ page }) => {
  const { productionRequests } = await bootBoard(page);
  await openMemoMode(page);
  await clickCurrent(page, '#workMemoViewV167 [data-memo-new]');

  await expect(page.locator('#workMemoDialogV167')).toBeVisible();
  await page.locator('#workMemoTitleV167').fill('Emulator メモ追加確認');
  await page.locator('#workMemoCategoryV167').selectOption({ label: '手順' });
  await page.locator('#workMemoTagsV167').fill('Emulator, 手順');
  await page.locator('#workMemoBodyV167').fill('業務メモの追加をRTDBへ保存する');
  await page.locator('#workMemoPinnedV167').check();
  await clickCurrent(page, '#workMemoFormV167 button[type="submit"]');

  await expect.poll(async () => {
    const all = await readDb(`rooms/${ROOM}/businessMemos`) || {};
    return Object.values(all).some(memo => memo?.title === 'Emulator メモ追加確認');
  }, { timeout: 20_000 }).toBe(true);

  const all = await readDb(`rooms/${ROOM}/businessMemos`) || {};
  const [id, stored] = Object.entries(all).find(([, memo]) => memo?.title === 'Emulator メモ追加確認');
  expect(stored).toMatchObject({
    id,
    title: 'Emulator メモ追加確認',
    body: '業務メモの追加をRTDBへ保存する',
    category: '手順',
    tags: ['Emulator', '手順'],
    pinned: true,
    revision: 1,
    createdBy: '福冨',
    updatedBy: '福冨'
  });
  expect(Number(stored.createdAt)).toBeGreaterThan(0);
  expect(Number(stored.updatedAt)).toBeGreaterThan(0);
  await expect(page.locator('#workMemoViewV167 .work-memo-card-v167').filter({ hasText: 'Emulator メモ追加確認' })).toBeVisible();
  expect(productionRequests).toEqual([]);
});

test('edits a shared business memo through the real dialog and increments revision', async ({ page }) => {
  const id = 'memo-edit-e2e';
  await putDb(`rooms/${ROOM}/businessMemos/${id}`, memoRecord(id, { title: '編集前メモ', body: '編集前本文' }));

  const { productionRequests } = await bootBoard(page);
  await openMemoMode(page);
  await expect(page.locator(`[data-memo-edit="${id}"]`)).toBeVisible({ timeout: 30_000 });
  await clickCurrent(page, `[data-memo-edit="${id}"]`);

  await page.locator('#workMemoTitleV167').fill('編集後メモ');
  await page.locator('#workMemoBodyV167').fill('編集後本文');
  await page.locator('#workMemoCategoryV167').selectOption({ label: 'URL・リンク' });
  await clickCurrent(page, '#workMemoFormV167 button[type="submit"]');

  await expect.poll(() => readMemo(id), { timeout: 20_000 }).toMatchObject({
    id,
    title: '編集後メモ',
    body: '編集後本文',
    category: 'URL・リンク',
    revision: 2,
    updatedBy: '福冨'
  });
  await expect(page.locator('#workMemoViewV167 .work-memo-card-v167').filter({ hasText: '編集後メモ' })).toBeVisible();
  expect(productionRequests).toEqual([]);
});

test('deletes a shared business memo through the real confirmation flow', async ({ page }) => {
  const id = 'memo-delete-e2e';
  await putDb(`rooms/${ROOM}/businessMemos/${id}`, memoRecord(id, { title: '削除対象メモ' }));

  const { productionRequests } = await bootBoard(page);
  await openMemoMode(page);
  await expect(page.locator(`[data-memo-edit="${id}"]`)).toBeVisible({ timeout: 30_000 });
  await clickCurrent(page, `[data-memo-edit="${id}"]`);
  await expect(page.locator('#workMemoDeleteV167')).toBeVisible();

  page.once('dialog', dialog => dialog.accept());
  await clickCurrent(page, '#workMemoDeleteV167');
  await expect.poll(() => readMemo(id), { timeout: 20_000 }).toBeNull();
  await expect(page.locator(`[data-memo-edit="${id}"]`)).toHaveCount(0);
  expect(productionRequests).toEqual([]);
});

test('saves a future task start date and exposes the task only through the reserved-task UI', async ({ page }) => {
  const { productionRequests } = await bootBoard(page);
  const title = 'Emulator 予約タスク確認';
  const startDate = futureIso(5);

  await clickCurrent(page, '#newTask');
  await expect(page.locator('#taskDialog')).toBeVisible();
  await expect(page.locator('#taskStartDateV167')).toBeVisible();
  await page.locator('#taskTitle').fill(title);
  await page.locator('#taskStartDateV167').fill(startDate);
  await page.locator('#taskForm button[type="submit"]').click();

  await expect.poll(async () => {
    const tasks = await readDb(`rooms/${ROOM}/tasks`) || {};
    const entry = Object.entries(tasks).find(([, value]) => value?.title === title);
    return entry ? { id: entry[0], ...entry[1] } : null;
  }, { timeout: 25_000 }).toMatchObject({ title, createdBy: '福冨' });

  const tasks = await readDb(`rooms/${ROOM}/tasks`) || {};
  const [taskId] = Object.entries(tasks).find(([, value]) => value?.title === title);
  await expect.poll(() => readDb(`rooms/${ROOM}/taskStarts/${taskId}`), { timeout: 25_000 }).toMatchObject({
    date: startDate,
    revision: 1,
    updatedBy: '福冨'
  });

  await expect(page.locator(`[data-task-id="${taskId}"]:not(.future-task-v167-hidden)`)).toHaveCount(0, { timeout: 30_000 });
  await clickCurrent(page, '.nav-item[data-layout="tasks"]');
  await expect(page.locator('#searchInput')).toBeVisible();

  const reservedButton = page.locator('[data-reserved-task-open]');
  await expect(reservedButton).toBeVisible({ timeout: 30_000 });
  await expect(reservedButton).toContainText('1');
  await clickCurrent(page, '[data-reserved-task-open]');
  await expect(page.locator('#reservedTaskDialogV167')).toBeVisible();
  const reservedCard = page.locator('#reservedTaskListV167').filter({ hasText: title });
  await expect(reservedCard).toContainText(title);
  await expect(page.locator(`#reservedTaskListV167 [data-reserved-date="${taskId}"]`)).toHaveValue(startDate);

  expect(productionRequests).toEqual([]);
});


// Ver.563: the Modern frame remains presentation-only; Classic owns every
// memo RTDB transaction, device-personal order and task form.
const memoPathV563 = id => 'rooms/' + ROOM + '/businessMemos/' + id;
async function seedMemoV563() {
  await putDb('rooms/' + ROOM + '/meta', {
    users:['福冨','森井'], userColors:{'福冨':'#3c92df','森井':'#4ebd69'},
    _revisions:{users:1,userColors:1}
  });
  // Deterministic latest-first order; millisecond ties must not change
  // which Modern arrow is available in a slow CI runner.
  const orderBase = Date.now();
  await putDb('rooms/' + ROOM + '/businessMemos', {
    source:memoRecord('source',{title:'共有の業務手順',body:'共有された手順の本文',tags:['院内','手順'],revision:4,updatedAt:orderBase+3000}),
    second:memoRecord('second',{title:'別メモ',body:'別内容',revision:2,updatedAt:orderBase+2000}),
    third:memoRecord('third',{title:'連絡先メモ',body:'電話番号の共有',revision:1,updatedAt:orderBase+1000})
  });
}
async function bootModernMemoV563(page) {
  const errors=[],unsafe=[];
  page.on('pageerror',e=>errors.push(e.message));
  const requests=await installEmulatorBoundary(page,{modern:true});
  await page.goto('/?room='+encodeURIComponent(ROOM)+'&modernReadV555=1&modernWriteV563=1',
    {waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>{
    const classic=window.WorkBoardReadV550?.read?.();
    const memos=window.WorkBoardBusinessMemoReadV555?.read?.();
    return window.WORK_BOARD_ASSETS_READY === true && classic?.ready && memos?.ready
      && classic.source==='remote-online' && memos.source==='remote-online'
      && memos.rows.some(x=>x.id==='source');
  },undefined,{timeout:30000});
  const frame=page.frameLocator('iframe[data-modern-memo-v555]');
  await frame.locator('#refreshV555').click();
  await expect(frame.locator('body')).toHaveAttribute('data-memo-write-v563','enabled');
  await expect(frame.locator('[data-memo-id=source]')).toBeVisible();
  expect(errors).toEqual([]);expect(unsafe).toEqual([]);
  expect(requests).toEqual([]);
  return {frame,unsafe:requests,errors};
}

test('Ver.563 Modern memo create/edit persists via Classic RTDB and retains unrelated records',async({page})=>{
  await seedMemoV563();
  const previous=await readDb(memoPathV563('second'));
  const safe=await bootModernMemoV563(page);
  await safe.frame.locator('#memoNewV563').click();
  await expect(page.locator('iframe[data-modern-memo-v555]')).toHaveCount(0);
  await expect(page.locator('#workMemoDialogV167')).toBeVisible();
  await page.locator('#workMemoTitleV167').fill('共同で追加したメモ');
  await page.locator('#workMemoBodyV167').fill('ModernからClassic経由で保存');
  await page.locator('#workMemoPinnedV167').check();
  await page.locator('#workMemoFormV167 button[type=submit]').click();
  await expect.poll(async()=>Object.values(await readDb('rooms/'+ROOM+'/businessMemos')||{})
    .some(m=>m.title==='共同で追加したメモ')).toBe(true);
  const record=Object.values(await readDb('rooms/'+ROOM+'/businessMemos')||{})
    .find(m=>m.title==='共同で追加したメモ');
  expect(record).toMatchObject({revision:1,pinned:true,createdBy:'福冨'});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WorkBoardBusinessMemoReadV555?.read?.()?.rows?.some(x=>x.id==='source'));
  const frame=page.frameLocator('iframe[data-modern-memo-v555]');
  await frame.locator('#refreshV555').click();
  await frame.locator('[data-memo-id=source] [data-memo-action-v563=edit]').click();
  await expect(page.locator('#workMemoDialogV167')).toBeVisible();
  await page.locator('#workMemoBodyV167').fill('更新された正本メモ');
  await page.locator('#workMemoFormV167 button[type=submit]').click();
  await expect.poll(()=>readDb(memoPathV563('source'))).toMatchObject({
    body:'更新された正本メモ',revision:5,createdBy:'福冨'
  });
  expect(await readDb(memoPathV563('second'))).toEqual(previous);
  expect(safe.unsafe).toEqual([]);expect(safe.errors).toEqual([]);
});

test('Ver.563 peer pin update blocks stale Modern memo editor and preserves its input',async({browser})=>{
  await seedMemoV563();
  const a=await browser.newPage(),b=await browser.newPage();
  try {
    const first=await bootModernMemoV563(a);
    const second=await bootModernMemoV563(b);
    await second.frame.locator('[data-memo-id=source] [data-memo-action-v563=edit]').click();
    await expect(b.locator('#workMemoDialogV167')).toBeVisible();
    await b.locator('#workMemoBodyV167').fill('Bの未保存メモ');
    await first.frame.locator('[data-memo-id=source] [data-memo-action-v563=pin]').click();
    await expect.poll(()=>readDb(memoPathV563('source')))
      .toMatchObject({pinned:true,revision:5});
    await b.waitForFunction(()=>window.WorkBoardBusinessMemoReadV555?.read?.()?.rows
      .some(x=>x.id==='source'&&x.revision===5),undefined,{timeout:30000});
    await b.locator('#workMemoFormV167 button[type=submit]').click();
    await expect(b.locator('#workMemoDialogV167')).toBeVisible();
    await expect(b.locator('#workMemoBodyV167')).toHaveValue('Bの未保存メモ');
    expect(await readDb(memoPathV563('source'))).toMatchObject({
      revision:5,pinned:true,body:'共有された手順の本文'
    });
    expect(first.unsafe).toEqual([]);expect(second.unsafe).toEqual([]);
    expect(first.errors).toEqual([]);expect(second.errors).toEqual([]);
  } finally { await a.close();await b.close(); }
});

test('Ver.563 delete cancel and stale delete never erase the peer winner',async({page})=>{
  await seedMemoV563();
  const previous=await readDb(memoPathV563('second'));
  const safe=await bootModernMemoV563(page);
  page.once('dialog',d=>d.dismiss());
  await safe.frame.locator('[data-memo-id=source] [data-memo-action-v563=remove]').click();
  await expect(safe.frame.locator('#memoActionStatusV563')).toContainText('キャンセル');
  expect(await readDb(memoPathV563('source'))).toMatchObject({revision:4});
  // Change the remote source during the confirmation. The Classic owner must
  // not adopt the new revision after the user accepts.
  page.once('dialog',async dialog=>{
    const source=await readDb(memoPathV563('source'));
    await putDb(memoPathV563('source'),{...source,revision:5,title:'別端末の更新'});
    await dialog.accept();
  });
  await safe.frame.locator('[data-memo-id=source] [data-memo-action-v563=remove]').click();
  await expect(safe.frame.locator('#memoActionStatusV563'))
    .toContainText('操作できませんでした');
  expect(await readDb(memoPathV563('source'))).toMatchObject({revision:5,title:'別端末の更新'});
  await page.waitForFunction(()=>window.WorkBoardBusinessMemoReadV555?.read?.()?.rows
    .some(x=>x.id==='source'&&x.revision===5),undefined,{timeout:30000});
  await safe.frame.locator('#refreshV555').click();
  page.once('dialog',d=>d.accept());
  await safe.frame.locator('[data-memo-id=source] [data-memo-action-v563=remove]').click();
  await expect.poll(()=>readDb(memoPathV563('source'))).toBeNull();
  expect(await readDb(memoPathV563('second'))).toEqual(previous);
  expect(safe.unsafe).toEqual([]);expect(safe.errors).toEqual([]);
});

test('Ver.563 delete while an old Classic memo editor is open never resurrects the record',async({browser})=>{
  await seedMemoV563();
  const a=await browser.newPage(),b=await browser.newPage();
  try{
    const first=await bootModernMemoV563(a),second=await bootModernMemoV563(b);
    await second.frame.locator('[data-memo-id=source] [data-memo-action-v563=edit]').click();
    await expect(b.locator('#workMemoDialogV167')).toBeVisible();
    await b.locator('#workMemoBodyV167').fill('削除後の古い入力');
    a.once('dialog',d=>d.accept());
    await first.frame.locator('[data-memo-id=source] [data-memo-action-v563=remove]').click();
    await expect.poll(()=>readDb(memoPathV563('source'))).toBeNull();
    await b.waitForFunction(()=>window.WorkBoardBusinessMemoReadV555?.read?.()?.rows
      .every(x=>x.id!=='source'),undefined,{timeout:30000});
    await b.locator('#workMemoFormV167 button[type=submit]').click();
    await expect(b.locator('#workMemoDialogV167')).toBeVisible();
    await expect(b.locator('#workMemoBodyV167')).toHaveValue('削除後の古い入力');
    expect(await readDb(memoPathV563('source'))).toBeNull();
    expect(first.unsafe).toEqual([]);expect(second.unsafe).toEqual([]);
    expect(first.errors).toEqual([]);expect(second.errors).toEqual([]);
  }finally{await a.close();await b.close();}
});

test('Ver.563 personal memo reorder changes only local order and not RTDB',async({page})=>{
  await seedMemoV563();
  const source=await readDb('rooms/'+ROOM+'/businessMemos');
  const safe=await bootModernMemoV563(page);
  const row=safe.frame.locator('[data-memo-id=source]');
  const move=row.locator('[data-memo-action-v563=move]');
  await expect(move).toHaveCount(1);
  await move.click();
  await expect(safe.frame.locator('#memoActionStatusV563')).toContainText('表示順');
  expect(await readDb('rooms/'+ROOM+'/businessMemos')).toEqual(source);
  const local=await page.evaluate(room=>localStorage.getItem('workBoardMemoOrderV531:'+room+':福冨'),ROOM);
  expect(JSON.parse(local)).toContain('source');
  expect(safe.unsafe).toEqual([]);expect(safe.errors).toEqual([]);
});
