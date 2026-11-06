// Ver.581: LOCAL EMULATOR UI only; never import into the public runtime.
// The server holds Auth tokens in HttpOnly cookie sessions, and revalidates
// identity + membership on every /api/session request.
const get = id => document.getElementById(id);
const ui = Object.freeze({
  status:get('status'), authPanel:get('authPanel'), privatePanel:get('privatePanel'),
  offlinePanel:get('offlinePanel'), authTitle:get('authTitle'),
  authForm:get('authForm'), account:get('account'), password:get('password'),
  signIn:get('signIn'), cancelSwitch:get('cancelSwitch'),
  displayName:get('displayName'), role:get('role'), writeAccess:get('writeAccess'),
  draft:get('draft'), switchAccount:get('switchAccount'),
  signOut:get('signOut'), retry:get('retry')
});
const CHECK_INTERVAL_MS = 5000;
const CHANNEL_NAME = 'wb-local-auth-preview-v581';
const state = {
  session:null, offline:false, switching:false, busy:false,
  initialized:false, pendingSync:false
};
const ROLE = Object.freeze({viewer:'閲覧者',editor:'編集者',admin:'管理者'});
let generation = 0;
const channel = typeof BroadcastChannel === 'function'
  ? new BroadcastChannel(CHANNEL_NAME) : null;

function status(text, level = 'neutral') {
  ui.status.textContent = text;
  ui.status.dataset.level = level;
}
function render() {
  ui.offlinePanel.hidden = !state.offline;
  ui.privatePanel.hidden = state.offline || !state.session;
  ui.authPanel.hidden = state.offline
    || !state.initialized || (state.session && !state.switching);
  ui.cancelSwitch.hidden = !state.session || !state.switching;
  ui.authTitle.textContent = state.switching
    ? '別の職員として再認証' : 'デモ用アカウントでログイン';
  ui.signIn.textContent = state.switching
    ? '別アカウントとしてログイン' : 'ログインして確認';
  const account = state.session;
  ui.displayName.textContent = state.offline || !account ? '-' : account.displayName;
  ui.role.textContent = state.offline || !account ? '-' : (ROLE[account.role] || '-');
  ui.writeAccess.textContent = state.offline || !account
    ? '-' : account.canWriteShared ? '可（エミュレータ）' : '不可（閲覧専用）';
  for (const control of [ui.account,ui.password,ui.signIn,ui.cancelSwitch,
    ui.switchAccount,ui.signOut,ui.retry]) control.disabled = state.busy;
}
function busy(value) {
  state.busy = Boolean(value);
  render();
  if (!state.busy && state.pendingSync) {
    state.pendingSync = false;
    queueMicrotask(() => { void refresh({quiet:true}); });
  }
}
function hidePrivate() {
  state.session = null;
  state.switching = false;
  ui.draft.value = '';
  ui.password.value = '';
  state.initialized = true;
}
function lock(message) {
  hidePrivate();
  state.offline = true;
  render();
  status(message || '通信を確認できません。再接続が必要です。', 'error');
}
function signedOut(message = 'ログインしてください。') {
  hidePrivate();
  state.offline = false;
  render();
  status(message);
}
function broadcastSessionChange() {
  // Broadcast only an invalidation signal; NEVER send UID, tokens or notes.
  if (channel) {
    channel.postMessage({type:'session-changed'});
  } else {
    // Older browsers: storage event is a same-origin signal, not a session.
    try {
      localStorage.setItem(CHANNEL_NAME, String(Date.now()) + ':' + crypto.randomUUID());
    } catch { /* visibility and periodic revalidation remain available */ }
  }
}
function remoteSessionChanged() {
  // Invalidate synchronously, BEFORE any cross-tab network round trip.
  generation++;
  lock('別のタブで認証状態が変わりました。再確認しています。');
  if (state.busy) state.pendingSync = true;
  else void refresh({quiet:true});
}
if (channel) {
  channel.addEventListener('message', event => {
    if (event.data?.type === 'session-changed') remoteSessionChanged();
  });
} else {
  window.addEventListener('storage', event => {
    if (event.key === CHANNEL_NAME && event.newValue) remoteSessionChanged();
  });
}
async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials:'same-origin', cache:'no-store', ...options
  });
  let body;
  try { body = await response.json(); } catch { throw Error('invalid-response'); }
  if (response.status >= 500 || !body || typeof body.status !== 'string') {
    throw Error('offline');
  }
  return {response,body};
}
function acceptSession(body, reason = 'refresh') {
  if (body.status !== 'signed-in' || typeof body.displayName !== 'string'
    || !Object.hasOwn(ROLE, body.role) || typeof body.canWriteShared !== 'boolean') {
    throw Error('invalid-session');
  }
  const old = state.session;
  const identityChanged = Boolean(old && old.displayName !== body.displayName);
  const permissionChanged = Boolean(old && (old.role !== body.role
    || old.canWriteShared !== body.canWriteShared));
  const keepSwitch = reason !== 'login' && state.switching
    && !identityChanged && !permissionChanged;
  state.session = {
    displayName:body.displayName, role:body.role,
    canWriteShared:body.canWriteShared
  };
  state.offline = false;
  state.switching = keepSwitch;
  state.initialized = true;
  // Same-person checks must not discard the user's unsaved draft.
  // Account changes and role revocation must clear locally held private state.
  if (reason === 'login' || identityChanged || permissionChanged) ui.draft.value = '';
  if (!keepSwitch) ui.password.value = '';
  render();
  if (permissionChanged) status('権限が変更されました。最新の権限で表示しています。','success');
  else if (identityChanged) status('認証済みアカウントを更新しました。','success');
  else if (reason !== 'quiet') {
    status(reason === 'login'
      ? 'ログインに成功しました。表示名は認証UIDから確認済みです。'
      : '認証状態を再確認しました。','success');
  }
  return {identityChanged,permissionChanged};
}

async function refresh({quiet = false} = {}) {
  if (state.busy) { state.pendingSync = true; return; }
  const ticket = generation;
  busy(true);
  try {
    const {response,body} = await request('/api/session');
    if (ticket !== generation) { state.pendingSync = true; return; }
    if (response.ok && body.status === 'signed-in') {
      acceptSession(body, quiet ? 'quiet' : 'refresh');
    } else if ((response.ok && body.status === 'signed-out')
      || (!response.ok && ['sign-in-required','session-expired'].includes(body.status))) {
      signedOut(body.status === 'session-expired'
        ? 'セッションの有効期限が切れました。再度ログインしてください。'
        : body.status === 'sign-in-required'
          ? '権限の変更または認証の失効を検出しました。再度ログインしてください。'
          : 'ログインしてください。');
    } else { throw Error('unknown-status'); }
  } catch {
    if (ticket === generation) {
      lock('認証サーバーと通信できません。古い利用者情報は非表示にしました。');
    }
  } finally { busy(false); }
}

async function signIn(event) {
  event.preventDefault();
  if (state.busy) return;
  const email = ui.account.value, password = ui.password.value;
  ui.password.value = '';
  if (!password) { status('デモ用パスワードを入力してください。','error'); return; }
  const ticket = generation;
  busy(true);
  try {
    const {response,body} = await request('/api/login', {
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({email,password})
    });
    if (ticket !== generation) { state.pendingSync = true; return; }
    if (response.ok) {
      acceptSession(body,'login');
      generation++;
      broadcastSessionChange();
    } else if (['invalid-credentials','not-authorized','invalid-request'].includes(body.status)) {
      // A failed switch must not silently discard a prior verified session.
      status(body.status === 'not-authorized'
        ? 'この職員の利用権限は確認できませんでした。'
        : '認証に失敗しました。アカウントとパスワードをご確認ください。','error');
    } else { throw Error('invalid-login'); }
  } catch {
    if (ticket === generation) {
      lock('通信障害が発生しました。認証済みの情報をロックしました。');
    }
  } finally { busy(false); }
}
function askDiscard() {
  return !ui.draft.value.trim()
    || window.confirm('入力中のメモは保存されていません。破棄して操作を続けますか？');
}
function beginSwitch() {
  if (state.busy || !state.session || !askDiscard()) return;
  state.switching = true;
  ui.account.value = state.session.displayName === '職員A'
    ? 'bob@example.invalid' : 'alice@example.invalid';
  ui.password.value = '';
  render();
  status('別の本人としてログインするには、再認証が必要です。');
  ui.password.focus();
}
async function signOut() {
  if (state.busy || !state.session || !askDiscard()) return;
  const ticket = generation;
  busy(true);
  try {
    const {response,body} = await request('/api/logout',{method:'POST'});
    if (ticket !== generation) { state.pendingSync = true; return; }
    if (!response.ok || body.status !== 'signed-out') throw Error('invalid-logout');
    signedOut('ログアウトしました。');
    generation++;
    broadcastSessionChange();
    status('ログアウトしました。','success');
  } catch {
    if (ticket === generation) {
      lock('通信障害のためサーバー側のログアウトは未確認です。再接続後に確認してください。');
    }
  } finally { busy(false); }
}
ui.authForm.addEventListener('submit',signIn);
ui.switchAccount.addEventListener('click',beginSwitch);
ui.signOut.addEventListener('click',signOut);
ui.retry.addEventListener('click',() => { void refresh(); });
ui.cancelSwitch.addEventListener('click',()=>{
  if (state.busy) return;
  state.switching = false;
  ui.password.value = '';
  render();
  status('アカウントの切替を中止しました。');
});
// Revalidate server authority periodically while visible; on return from
// background, validate immediately. No database permissions are granted here.
window.setInterval(() => {
  if (!document.hidden && state.session) void refresh({quiet:true});
},CHECK_INTERVAL_MS);
window.addEventListener('focus',() => {
  if (state.initialized) void refresh({quiet:true});
});
document.addEventListener('visibilitychange',() => {
  if (!document.hidden && state.initialized) void refresh({quiet:true});
});
window.addEventListener('pageshow',event => {
  if (event.persisted && state.initialized) void refresh({quiet:true});
});
window.addEventListener('beforeunload',event=>{
  if (ui.draft.value.trim() && state.session && !state.offline) {
    event.preventDefault();
  }
});
void refresh();
