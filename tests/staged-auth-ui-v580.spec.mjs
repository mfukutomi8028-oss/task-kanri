import { test, expect } from '@playwright/test';

// The browser smoke mocks only the transport. Actual token / membership is
// independently tested against the real Auth + RTDB Emulators by authorization CI.
const path = '/test-harness/staged-auth-ui-v580/index.html';
const json = (route,status,payload) =>
  route.fulfill({status,contentType:'application/json',body:JSON.stringify(payload)});
test('Ver.580: sign in, confirm dirty draft, reject wrong password, reauthenticate and sign out',async ({page})=>{
  await page.route('**/api/session',r=>json(r,200,{status:'signed-out'}));
  await page.route('**/api/login',async r=>{
    const body=r.request().postDataJSON();
    if(body.email==='alice@example.invalid'&&body.password==='Demo-Only-A!580')
      return json(r,200,{status:'signed-in',displayName:'職員A',role:'editor',canWriteShared:true});
    if(body.email==='bob@example.invalid'&&body.password==='Demo-Only-B!580')
      return json(r,200,{status:'signed-in',displayName:'職員B',role:'viewer',canWriteShared:false});
    return json(r,401,{status:'invalid-credentials'});
  });
  await page.route('**/api/logout',r=>json(r,200,{status:'signed-out'}));
  await page.goto(path);
  await expect(page.locator('#authPanel')).toBeVisible();
  await page.locator('#password').fill('Demo-Only-A!580');
  await page.locator('#signIn').click();
  await expect(page.locator('#privatePanel')).toBeVisible();
  await expect(page.locator('#displayName')).toHaveText('職員A');
  await expect(page.locator('#writeAccess')).toContainText('可');
  await expect(page.locator('#password')).toHaveValue('');
  await page.locator('#draft').fill('まだ保存していない検証メモ');

  page.once('dialog',d=>d.dismiss());
  await page.locator('#switchAccount').click();
  await expect(page.locator('#authPanel')).toBeHidden();
  await expect(page.locator('#displayName')).toHaveText('職員A');

  page.once('dialog',d=>d.accept());
  await page.locator('#switchAccount').click();
  await expect(page.locator('#authPanel')).toBeVisible();
  await expect(page.locator('#account')).toHaveValue('bob@example.invalid');

  await page.locator('#password').fill('incorrect');
  await page.locator('#signIn').click();
  await expect(page.locator('#status')).toContainText('認証に失敗');
  await expect(page.locator('#displayName')).toHaveText('職員A');
  await expect(page.locator('#draft')).toHaveValue('まだ保存していない検証メモ');

  await page.locator('#password').fill('Demo-Only-B!580');
  await page.locator('#signIn').click();
  await expect(page.locator('#displayName')).toHaveText('職員B');
  await expect(page.locator('#role')).toHaveText('閲覧者');
  await expect(page.locator('#writeAccess')).toContainText('不可');
  await expect(page.locator('#draft')).toHaveValue('');
  await page.locator('#signOut').click();
  await expect(page.locator('#privatePanel')).toBeHidden();
  await expect(page.locator('#authPanel')).toBeVisible();
  await expect(page.locator('#status')).toContainText('ログアウトしました');
});

test('Ver.580: offline session or failed sign-out locks private UI and allows recovery',async ({page})=>{
  let offline=true;
  await page.route('**/api/session',route=>offline
    ? json(route,503,{status:'offline'})
    : json(route,200,{status:'signed-out'}));
  await page.route('**/api/login',route=>json(route,200,{
    status:'signed-in',displayName:'職員A',role:'editor',canWriteShared:true
  }));
  await page.route('**/api/logout',route=>route.abort('failed'));
  await page.goto(path);
  await expect(page.locator('#offlinePanel')).toBeVisible();
  await expect(page.locator('#privatePanel')).toBeHidden();
  offline=false;
  await page.locator('#retry').click();
  await expect(page.locator('#authPanel')).toBeVisible();
  await page.locator('#password').fill('Demo-Only-A!580');
  await page.locator('#signIn').click();
  await expect(page.locator('#privatePanel')).toBeVisible();

  await page.locator('#signOut').click();
  await expect(page.locator('#offlinePanel')).toBeVisible();
  await expect(page.locator('#privatePanel')).toBeHidden();
  await expect(page.locator('#displayName')).toHaveText('-');
  await expect(page.locator('#status')).toContainText('ログアウトは未確認');
  await page.locator('#retry').click();
  await expect(page.locator('#authPanel')).toBeVisible();
});

test('Ver.580 demo UI remains readable on a 390px phone',async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/session',r=>json(r,200,{status:'signed-out'}));
  await page.goto(path);
  await expect(page.getByRole('heading',{name:'本人を確認してから、利用者を切り替える。'})).toBeVisible();
  await expect(page.locator('#authPanel')).toBeVisible();
  const horizontalOverflow=await page.evaluate(
    ()=>document.documentElement.scrollWidth>window.innerWidth
  );
  expect(horizontalOverflow).toBe(false);
});


test('Ver.581: two tabs share login/logout changes without reusing private notes',async ({context,page})=>{
  let account={status:'signed-out'};
  await context.route('**/api/session',route=>json(route,200,account));
  await context.route('**/api/login',route=>{
    const login=route.request().postDataJSON();
    account={
      status:'signed-in',
      displayName:login.email==='alice@example.invalid'?'職員A':'職員B',
      role:login.email==='alice@example.invalid'?'editor':'viewer',
      canWriteShared:login.email==='alice@example.invalid'
    };
    return json(route,200,account);
  });
  await context.route('**/api/logout',route=>{
    account={status:'signed-out'};
    return json(route,200,account);
  });
  await page.goto(path);
  const other=await context.newPage();
  await other.goto(path);
  await expect(other.locator('#authPanel')).toBeVisible();

  await page.locator('#password').fill('Demo-Only-A!580');
  await page.locator('#signIn').click();
  await expect(page.locator('#privatePanel')).toBeVisible();
  // BroadcastChannel synchronizes a tab that never logged in directly.
  await expect(other.locator('#privatePanel')).toBeVisible();
  await expect(other.locator('#displayName')).toHaveText('職員A');
  // Server-backed cookie/session survives a reload, without re-login prompts.
  await page.reload();
  await expect(page.locator('#displayName')).toHaveText('職員A');

  await other.locator('#draft').fill('他タブだけの未保存メモ');
  await page.locator('#signOut').click();
  await expect(page.locator('#authPanel')).toBeVisible();
  await expect(other.locator('#privatePanel')).toBeHidden();
  await expect(other.locator('#displayName')).toHaveText('-');
  await expect(other.locator('#draft')).toHaveValue('');
  await expect(other.locator('#authPanel')).toBeVisible();
});

test('Ver.581: same-user validation preserves drafts; role change and revocation do not',async ({page})=>{
  let account={status:'signed-out'};
  await page.route('**/api/session',route=>
    json(route,account.status==='sign-in-required'?401:200,account));
  await page.route('**/api/login',route=>{
    account={status:'signed-in',displayName:'職員A',role:'editor',canWriteShared:true};
    return json(route,200,account);
  });
  await page.goto(path);
  await page.locator('#password').fill('Demo-Only-A!580');
  await page.locator('#signIn').click();
  await expect(page.locator('#privatePanel')).toBeVisible();
  await page.locator('#draft').fill('確認中でも残す未保存メモ');
  await expect(page.locator('#signOut')).toBeEnabled();

  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.locator('#status')).toContainText('再確認');
  await expect(page.locator('#draft')).toHaveValue('確認中でも残す未保存メモ');

  account={status:'signed-in',displayName:'職員A',role:'viewer',canWriteShared:false};
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.locator('#role')).toHaveText('閲覧者');
  await expect(page.locator('#writeAccess')).toContainText('不可');
  await expect(page.locator('#draft')).toHaveValue('');
  await expect(page.locator('#status')).toContainText('権限が変更');

  account={status:'sign-in-required'};
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.locator('#privatePanel')).toBeHidden();
  await expect(page.locator('#displayName')).toHaveText('-');
  await expect(page.locator('#authPanel')).toBeVisible();
  await expect(page.locator('#status')).toContainText('権限の変更または認証の失効');
});
