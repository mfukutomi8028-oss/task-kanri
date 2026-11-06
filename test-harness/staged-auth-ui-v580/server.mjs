// Ver.580 local-only Auth UI: NEVER expose this process beyond loopback.
// All records, credentials and authorization checks use Firebase Emulators.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import {
  createDemoAdminServiceV573, DEMO_PROJECT_V573, DEMO_DB_URL_V573
} from '../../security/firebase-admin-staging-v573.mjs';
import { inspectStagedIdentityV579 } from '../../security/staged-identity-session-v579.mjs';

const AUTH_HOST = '127.0.0.1:9099';
const DATABASE_HOST = '127.0.0.1:9001';
const HOST = '127.0.0.1';
const ROOM = 'room-a';
const COOKIE = 'wb_v580_demo';
const SESSION_LIFETIME_MS = 15 * 60 * 1000;
const USERS = Object.freeze([
  { uid:'alice', email:'alice@example.invalid', password:'Demo-Only-A!580',
    displayName:'職員A', role:'editor' },
  { uid:'bob', email:'bob@example.invalid', password:'Demo-Only-B!580',
    displayName:'職員B', role:'viewer' }
]);
const STATIC = Object.freeze({
  '/': ['index.html','text/html; charset=utf-8'],
  '/index.html': ['index.html','text/html; charset=utf-8'],
  '/client.js': ['client.js','text/javascript; charset=utf-8'],
  '/style.css': ['style.css','text/css; charset=utf-8']
});
let instanceNumber = 0;

function requireDemoEmulators() {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== AUTH_HOST
    || process.env.FIREBASE_DATABASE_EMULATOR_HOST !== DATABASE_HOST
    || !DEMO_PROJECT_V573.startsWith('demo-')) {
    throw new Error('Ver.580 requires LOCAL demo Auth and RTDB Emulators; no live endpoints');
  }
}
const makeCookie = (value, maxAge = 900) =>
  COOKIE + '=' + value + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + maxAge;
function cookieId(req) {
  const header = String(req.headers.cookie || '');
  const match = new RegExp('(?:^|;\\s*)' + COOKIE + '=([a-f0-9]{64})(?:;|$)').exec(header);
  return match ? match[1] : null;
}
function headers(extra = {}) {
  return {
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'x-frame-options':'DENY',
    'referrer-policy':'no-referrer',
    'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'",
    ...extra
  };
}
function json(res, code, value, extra = {}) {
  res.writeHead(code, headers({'content-type':'application/json; charset=utf-8',...extra}));
  res.end(JSON.stringify(value));
}
async function readBody(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return null;
  let bytes = 0, value = '';
  for await (const chunk of req) {
    bytes += chunk.byteLength;
    if (bytes > 4096) return null;
    value += chunk.toString('utf8');
  }
  try {
    const data = JSON.parse(value);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch { return null; }
}
const publicAccount = session => ({
  status:'signed-in',
  displayName:session.displayName, role:session.role,
  canWriteShared:session.canWriteShared, mode:'emulator-only'
});

async function seedDemo(app) {
  const auth = getAuth(app), db = getDatabase(app);
  for (const user of USERS) {
    try { await auth.createUser({uid:user.uid,email:user.email,password:user.password}); }
    catch (error) {
      if (error?.code !== 'auth/uid-already-exists'
        && error?.code !== 'auth/email-already-exists') throw error;
      await auth.updateUser(user.uid,{email:user.email,password:user.password,disabled:false});
    }
  }
  const members = {}, identities = {};
  for (const user of USERS) {
    members[user.uid] = user.role;
    identities[user.uid] = {displayName:user.displayName,approved:true};
  }
  // Synthetic data on a demo project only; never touches /rooms or real data.
  await db.ref('roomsV2/' + ROOM).set({
    access:{members},internal:{identities},
    shared:{tasks:{sample:{title:'架空の業務タスク',revision:1}}}
  });
}

/**
 * Start the demo server on a random 127.0.0.1 port. Session IDs and Firebase
 * tokens remain server-side; the browser only receives a SameSite HttpOnly
 * cookie and the approved display name / role.
 */
export async function startStagedAuthPreviewV580() {
  requireDemoEmulators();
  const app = initializeApp({
    projectId:DEMO_PROJECT_V573,databaseURL:DEMO_DB_URL_V573
  }, 'v580-auth-preview-' + (++instanceNumber));
  let server;
  try {
    const service = createDemoAdminServiceV573(app);
    await seedDemo(app);
    const sessions = new Map();
    let simulateOffline = false;

    async function inspectSession(req, res) {
      const id = cookieId(req), stored = id && sessions.get(id);
      if (!stored) {
        json(res, 200, {status:'signed-out'}, {'set-cookie':makeCookie('',0)});
        return;
      }
      if (stored.expiresAt <= Date.now()) {
        sessions.delete(id);
        json(res,401,{status:'session-expired'}, {'set-cookie':makeCookie('',0)});
        return;
      }
      if (simulateOffline) {
        json(res,503,{status:'offline'});
        return;
      }
      const verified = await inspectStagedIdentityV579({
        authorizationHeader:'Bearer ' + stored.idToken, roomId:ROOM
      },service);
      if (verified.status === 'unavailable') {
        json(res,503,{status:'offline'});
        return;
      }
      if (verified.status !== 'bound' || verified.session.uid !== stored.uid) {
        sessions.delete(id);
        json(res,401,{status:'sign-in-required'}, {'set-cookie':makeCookie('',0)});
        return;
      }
      json(res,200,publicAccount(verified.session));
    }

    async function login(req,res) {
      const body = await readBody(req);
      if (!body || Object.keys(body).sort().join(',') !== 'email,password'
        || typeof body.email !== 'string' || body.email.length > 150
        || typeof body.password !== 'string' || body.password.length > 128
        || !body.password) {
        json(res,400,{status:'invalid-request'});
        return;
      }
      if (simulateOffline) {
        json(res,503,{status:'offline'});
        return;
      }
      let response;
      try {
        response = await fetch('http://' + AUTH_HOST
          + '/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo', {
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({email:body.email,password:body.password,returnSecureToken:true}),
          signal:AbortSignal.timeout(4500)
        });
      } catch {
        json(res,503,{status:'offline'});
        return;
      }
      if (!response.ok) {
        json(res,response.status >= 500 ? 503 : 401,{
          status:response.status >= 500 ? 'offline' : 'invalid-credentials'
        });
        return;
      }
      let payload;
      try { payload = await response.json(); }
      catch { json(res,503,{status:'offline'}); return; }
      if (!payload || typeof payload.idToken !== 'string') {
        json(res,503,{status:'offline'});
        return;
      }
      const verified = await inspectStagedIdentityV579({
        authorizationHeader:'Bearer ' + payload.idToken, roomId:ROOM
      },service);
      if (verified.status !== 'bound') {
        json(res,verified.status === 'unavailable' ? 503 : 403,
          {status:verified.status === 'unavailable' ? 'offline' : 'not-authorized'});
        return;
      }
      const previous = cookieId(req);
      if (previous) sessions.delete(previous);
      const id = randomBytes(32).toString('hex');
      sessions.set(id,{
        idToken:payload.idToken, uid:verified.session.uid, expiresAt:Date.now()+SESSION_LIFETIME_MS
      });
      json(res,200,publicAccount(verified.session), {'set-cookie':makeCookie(id)});
    }

    server = http.createServer(async (req,res) => {
      const port = server.address()?.port;
      const origin = 'http://' + HOST + ':' + port;
      if (req.headers.host !== HOST + ':' + port) {
        json(res,400,{status:'invalid-host'});
        return;
      }
      let pathname;
      try { pathname = new URL(req.url || '/',origin).pathname; }
      catch { json(res,400,{status:'invalid-request'}); return; }
      if (req.method === 'GET' && STATIC[pathname]) {
        const [file,type] = STATIC[pathname];
        res.writeHead(200,headers({'content-type':type}));
        res.end(readFileSync(new URL(file,import.meta.url)));
        return;
      }
      if (req.method === 'GET' && pathname === '/api/session') {
        try { await inspectSession(req,res); }
        catch { json(res,503,{status:'offline'}); }
        return;
      }
      if (req.method !== 'POST' ||
        !['/api/login','/api/logout'].includes(pathname)) {
        json(res,404,{status:'not-found'});
        return;
      }
      if (req.headers.origin !== origin) {
        json(res,403,{status:'invalid-origin'});
        return;
      }
      if (pathname === '/api/logout') {
        const id = cookieId(req);
        if (id) sessions.delete(id);
        json(res,200,{status:'signed-out'},{'set-cookie':makeCookie('',0)});
        return;
      }
      try { await login(req,res); }
      catch { json(res,503,{status:'offline'}); }
    });
    await new Promise((resolve,reject) => {
      server.once('error',reject);
      server.listen(0,HOST,resolve);
    });
    return Object.freeze({
      url:'http://' + HOST + ':' + server.address().port,
      setOfflineForTest(value) { simulateOffline = value === true; },
      async close() {
        sessions.clear();
        await new Promise(resolve => server.close(resolve));
        await deleteApp(app);
      }
    });
  } catch(error) {
    if(server?.listening)await new Promise(resolve=>server.close(resolve));
    await deleteApp(app);
    throw error;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startStagedAuthPreviewV580().then(preview => {
    // Never print credentials, cookies, tokens or Firebase real project IDs.
    process.stdout.write('Auth Emulator preview: ' + preview.url + '\n');
    for (const signal of ['SIGINT','SIGTERM'])
      process.once(signal,() => preview.close().then(() => process.exit(0)));
  }).catch(() => {
    console.error('Local Auth/RTDB Emulators are required; server was not started.');
    process.exitCode = 1;
  });
}
