import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
const name='test-harness/staged-auth-ui-v580/';
const server=read(name+'server.mjs');
const html=read(name+'index.html');
const client=read(name+'client.js');
const smoke=read(name+'emulator-smoke.mjs');
const workflow=read('.github/workflows/regression-checks.yml');
const packageJson=JSON.parse(read('package.json'));

test('Ver.580 local sign-in preview cannot enter GitHub Pages payload',()=>{
  const manifest=read('release-manifest.js');
  const build=read('test-harness/build-pages-runtime-v382.mjs');
  const currentHtml=read('index.html');
  assert.doesNotMatch(manifest,/staged-auth-ui-v580/);
  assert.doesNotMatch(currentHtml,/staged-auth-ui-v580/);
  assert.match(build,/Stage C Ver.450: publish only explicitly declared root web assets/);
  assert.match(build,/item\.name/);
  assert.match(html,/LOCAL EMULATOR ONLY/);
  assert.match(html,/noindex,nofollow/);
  assert.doesNotMatch(html,/firebaseConfig|apiKey/);
});

test('Ver.580 local server is loopback and emulator only with non-exportable sessions',()=>{
  assert.match(server,/FIREBASE_AUTH_EMULATOR_HOST !== AUTH_HOST/);
  assert.match(server,/FIREBASE_DATABASE_EMULATOR_HOST !== DATABASE_HOST/);
  assert.match(server,/server\.listen\(0,HOST,resolve\)/);
  assert.match(server,/const HOST = '127\.0\.0\.1'/);
  assert.match(server,/HttpOnly; SameSite=Strict/);
  assert.match(server,/sessions\.delete\(previous\)/);
  assert.match(server,/x-frame-options':'DENY'/);
  assert.match(server,/content-security-policy/);
  assert.match(server,/req\.headers\.origin !== origin/);
  assert.match(server,/inspectStagedIdentityV579/);
  assert.match(server,/status:'invalid-origin'/);
  assert.match(server,/readIdentityBinding/);
  assert.doesNotMatch(server,/firebase deploy|setRules|rules:deploy/);
});

test('Ver.580 auth UX locks private details on failure and preserves unverified logout',()=>{
  assert.match(client,/state\.session = null/);
  assert.match(client,/state\.offline = true/);
  assert.match(client,/ui\.privatePanel\.hidden = state\.offline/);
  assert.match(client,/window\.confirm/);
  assert.match(client,/credential|認証に失敗/);
  assert.match(client,/ログアウトは未確認/);
  assert.match(client,/ui\.password\.value = ''/);
  assert.match(client,/credentials:'same-origin'/);
});

test('Ver.580 CI runs real Emulator API tests separately from browser transport mocks',()=>{
  assert.match(packageJson.scripts['test:auth:ui:v580'],/firebase emulators:exec --only auth,database/);
  assert.match(packageJson.scripts['demo:auth:ui:v580'],/staged-auth-ui-v580\/server.mjs/);
  assert.match(workflow,/run: npm run test:auth:ui:v580/);
  assert.match(workflow,/authorization:[\s\S]*?run: npm run test:auth:ui:v580[\s\S]*?firebase:/);
  assert.match(smoke,/startStagedAuthPreviewV580/);
  assert.match(smoke,/setOfflineForTest\(true\)/);
  assert.match(smoke,/account switch rotates the session cookie/);
});
