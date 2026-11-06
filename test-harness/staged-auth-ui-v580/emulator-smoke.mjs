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
  console.log('VER580_AUTH_UI_EMULATOR_SMOKE_PASSED: synthetic users, loopback only');
} finally {
  await preview.close();
}
