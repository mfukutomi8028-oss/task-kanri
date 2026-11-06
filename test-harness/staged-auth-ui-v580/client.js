// Ver.580: LOCAL EMULATOR UI only. Do not include in release-manifest.js.
// Auth tokens stay in an HttpOnly cookie server-side session; only approved
// display name and role are rendered. Never use this script on production.
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
const state = { session:null, offline:false, switching:false, busy:false, initialized:false };
const ROLE = Object.freeze({viewer:'閲覧者',editor:'編集者',admin:'管理者'});
function status(text, level = 'neutral') {
  ui.status.textContent = text;
  ui.status.dataset.level = level;
}
function render() {
  ui.offlinePanel.hidden = !state.offline;
  ui.privatePanel.hidden = state.offline || !state.session;
  ui.authPanel.hidden = state.offline
    || (!state.initialized) || (state.session && !state.switching);
  ui.cancelSwitch.hidden = !state.session || !state.switching;
  ui.authTitle.textContent = state.switching
    ? '別の職員として再認証' : 'デモ用アカウントでログイン';
  ui.signIn.textContent = state.switching ? '別アカウントとしてログイン' : 'ログインして確認';
  const account = state.session;
  // Never keep previous user's details visible while the server is unreachable.
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
}
function lock(message) {
  state.session = null;
  state.switching = false;
  state.offline = true;
  ui.draft.value = '';
  ui.password.value = '';
  state.initialized = true;
  render();
  status(message || '通信を確認できません。再接続が必要です。', 'error');
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
function acceptSession(body, announcement) {
  if (body.status !== 'signed-in' || typeof body.displayName !== 'string'
    || !Object.hasOwn(ROLE, body.role) || typeof body.canWriteShared !== 'boolean') {
    throw Error('invalid-session');
  }
  state.session = {
    displayName:body.displayName, role:body.role,
    canWriteShared:body.canWriteShared
  };
  state.offline = false;
  state.switching = false;
  state.initialized = true;
  ui.draft.value = '';
  ui.password.value = '';
  render();
  status(announcement || '本人確認が完了しました。', 'success');
}
async function refresh() {
  if (state.busy) return;
  busy(true);
  try {
    const {response,body} = await request('/api/session');
    if (response.ok && body.status === 'signed-in') {
      acceptSession(body,'認証状態を再確認しました。');
    } else if ((response.ok && body.status === 'signed-out')
      || (!response.ok && ['sign-in-required','session-expired'].includes(body.status))) {
      state.session = null;
      state.offline = false;
      state.switching = false;
      state.initialized = true;
      ui.draft.value = '';
      render();
      status('ログインしてください。');
    } else { throw Error('unknown-status'); }
  } catch {
    lock('認証サーバーと通信できません。古い利用者情報は非表示にしました。');
  } finally { busy(false); }
}
async function signIn(event) {
  event.preventDefault();
  if (state.busy) return;
  const email=ui.account.value, password=ui.password.value;
  ui.password.value = '';
  if (!password) { status('デモ用パスワードを入力してください。','error'); return; }
  busy(true);
  try {
    const {response,body}=await request('/api/login', {
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({email,password})
    });
    if (response.ok) {
      acceptSession(body,'ログインに成功しました。表示名は認証UIDから確認済みです。');
    } else if (['invalid-credentials','not-authorized','invalid-request'].includes(body.status)) {
      // A failed account switch must not silently change the previous identity.
      status(body.status === 'not-authorized'
        ? 'この職員の利用権限は確認できませんでした。'
        : '認証に失敗しました。アカウントとパスワードをご確認ください。','error');
    } else { throw Error('invalid-login'); }
  } catch {
    lock('通信障害が発生しました。認証済みの情報をロックしました。');
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
  busy(true);
  try {
    const {response,body}=await request('/api/logout',{method:'POST'});
    if (!response.ok || body.status !== 'signed-out') throw Error('invalid-logout');
    state.session=null;
    state.offline=false;
    state.switching=false;
    ui.draft.value='';
    ui.password.value='';
    render();
    status('ログアウトしました。','success');
  } catch {
    lock('通信障害のためサーバー側のログアウトは未確認です。再接続後に確認してください。');
  } finally { busy(false); }
}
ui.authForm.addEventListener('submit',signIn);
ui.switchAccount.addEventListener('click',beginSwitch);
ui.signOut.addEventListener('click',signOut);
ui.retry.addEventListener('click',refresh);
ui.cancelSwitch.addEventListener('click',()=>{
  if (state.busy) return;
  state.switching=false;
  ui.password.value='';
  render();
  status('アカウントの切替を中止しました。');
});
window.addEventListener('beforeunload',event=>{
  if (ui.draft.value.trim() && state.session && !state.offline) {
    event.preventDefault();
  }
});
refresh();
