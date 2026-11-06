// Real Firebase Auth/RTDB Emulator integration; never contacts production.
import assert from 'node:assert/strict';
import { request as rawHttpRequest } from 'node:http';
import { startStagedAuthPreviewV580 } from './server.mjs';

const preview = await startStagedAuthPreviewV580();
const origin = preview.url;
let cookie = '';
async function request(path,{post,withCookie=true,wrongOrigin=false}={}) {
  const options={cache:'no-store',headers:{}};
  if (withCookie && cookie) options.headers.cookie = cookie;
  if (post !== undefined) {
    options.method = 'POST';
    options.headers.origin = wrongOrigin ? 'https://attacker.example.invalid' : origin;
    options.headers['content-type']='application/json';
    options.body=JSON.stringify(post);
  }
  const response=await fetch(origin+path,options);
  const setCookie=response.headers.get('set-cookie');
  if (setCookie) cookie=setCookie.split(';')[0];
  return {code:response.status,headers:response.headers,body:await response.json()};
}
try {
  const home=await fetch(origin+'/');
  assert.equal(home.status,200);
  assert.match(home.headers.get('content-security-policy')||'',/frame-ancestors 'none'/);
  assert.equal(home.headers.get('cache-control'),'no-store');
  const html=await home.text();
  assert.match(html,/LOCAL EMULATOR ONLY/);
  const js=await fetch(origin+'/client.js');
  assert.equal(js.status,200);
  assert.match(await js.text(),/reauthentication|再認証/);

  assert.equal((await request('/api/session')).body.status,'signed-out');
  assert.equal((await request('/api/login',{
    post:{email:'alice@example.invalid',password:'Demo-Only-A!580'},
    wrongOrigin:true
  })).code,403);
  assert.equal((await request('/api/login',{
    post:{email:'alice@example.invalid',password:'wrong'}
  })).body.status,'invalid-credentials');
  assert.equal((await request('/api/login',{
    post:{email:'alice@example.invalid',password:'Demo-Only-A!580'}
  })).body.displayName,'職員A');
  const aliceCookie=cookie;
  const alice=await request('/api/session');
  assert.equal(alice.code,200);
  assert.equal(alice.body.role,'editor');
  assert.equal(alice.body.canWriteShared,true);
  assert.equal(JSON.stringify(alice.body).includes('idToken'),false);
  assert.equal(JSON.stringify(alice.body).includes('password'),false);

  // The same HttpOnly session remains valid across page reloads / new tabs
  // until expiry; each request still rechecks the server-owned membership.
  const persistedCookie = cookie;
  const afterReload = await request('/api/session');
  assert.equal(afterReload.body.displayName,'職員A');
  assert.equal(cookie,persistedCookie);

  await preview.setDemoRoleForTest('alice','viewer');
  const downgraded = await request('/api/session');
  assert.equal(downgraded.body.status,'signed-in');
  assert.equal(downgraded.body.role,'viewer');
  assert.equal(downgraded.body.canWriteShared,false,
    'downgrade is effective on the next authorized server request');
  await preview.setDemoRoleForTest('alice','editor');
  assert.equal((await request('/api/session')).body.role,'editor');

  preview.setOfflineForTest(true);
  assert.equal((await request('/api/session')).code,503);
  assert.equal((await request('/api/login',{
    post:{email:'bob@example.invalid',password:'Demo-Only-B!580'}
  })).body.status,'offline');
  preview.setOfflineForTest(false);
  assert.equal((await request('/api/session')).body.displayName,'職員A');

  const bob=await request('/api/login',{
    post:{email:'bob@example.invalid',password:'Demo-Only-B!580'}
  });
  assert.equal(bob.code,200);
  assert.equal(bob.body.displayName,'職員B');
  assert.equal(bob.body.role,'viewer');
  assert.equal(bob.body.canWriteShared,false);
  assert.notEqual(aliceCookie,cookie,'account switch rotates the session cookie');
  const bobCookie=cookie;

  cookie=aliceCookie;
  assert.equal((await request('/api/session')).body.status,'signed-out',
    'the old cookie cannot impersonate the switched account');
  cookie=bobCookie;
  assert.equal((await request('/api/session')).body.displayName,'職員B');
  const logout=await request('/api/logout',{post:{}});
  assert.equal(logout.body.status,'signed-out');
  cookie=bobCookie;
  assert.equal((await request('/api/session')).body.status,'signed-out');

  // Revocation removes server access and invalidates the old browser cookie.
  const restoredAlice = await request('/api/login',{
    post:{email:'alice@example.invalid',password:'Demo-Only-A!580'}
  });
  assert.equal(restoredAlice.body.status,'signed-in');
  const approvedCookie = cookie;
  await preview.setDemoApprovalForTest('alice',false);
  const revoked = await request('/api/session');
  assert.equal(revoked.code,401);
  assert.equal(revoked.body.status,'sign-in-required');
  await preview.setDemoApprovalForTest('alice',true);
  cookie = approvedCookie;
  assert.equal((await request('/api/session')).body.status,'signed-out',
    'restoring approval never resurrects a revoked server session');

  const forExpiry = await request('/api/login',{
    post:{email:'alice@example.invalid',password:'Demo-Only-A!580'}
  });
  assert.equal(forExpiry.body.status,'signed-in');
  const expiringCookie = cookie;
  preview.expireSessionForTest(expiringCookie);
  const expired = await request('/api/session');
  assert.equal(expired.code,401);
  assert.equal(expired.body.status,'session-expired');
  cookie = expiringCookie;
  assert.equal((await request('/api/session')).body.status,'signed-out');

  // Removed membership must deny all future session checks, not just UI controls.
  const permittedBob = await request('/api/login',{
    post:{email:'bob@example.invalid',password:'Demo-Only-B!580'}
  });
  assert.equal(permittedBob.body.status,'signed-in');
  await preview.setDemoRoleForTest('bob',null);
  const forbiddenBob = await request('/api/session');
  assert.equal(forbiddenBob.code,401);
  assert.equal(forbiddenBob.body.status,'sign-in-required');
  await preview.setDemoRoleForTest('bob','viewer');

  // Fetch may rewrite the Host header. Use raw Node HTTP to test host rejection.
  const target=new URL(origin);
  const denied=await new Promise((resolve,reject)=>{
    const req=rawHttpRequest({
      hostname:'127.0.0.1',port:Number(target.port),path:'/does-not-exist',
      headers:{host:'attacker.example.invalid'}
    },res=>{
      res.resume();
      res.once('end',()=>resolve(res.statusCode));
    });
    req.once('error',reject);
    req.end();
  });
  assert.equal(denied,400);
  console.log('VER581_AUTH_SESSION_ROLE_REVOKE_PASSED: demo emulator only');
} finally {
  await preview.close();
}
