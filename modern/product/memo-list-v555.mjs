// Ver.555: Modern business memos read the existing Classic sidecar owner.
// No new Firebase app, storage, subscriptions, timers, demo data or write APIs.
// The owner emits only a local readiness event; the UI reuses the current facade.
import { selectModernMemosV555 } from './memo-list-contract-v555.mjs';

const $ = id => document.getElementById(id);
const warnings = {
  'identity-not-selected':'クラシックで利用者を選択してください。',
  'classic-unavailable':'クラシックの業務データを確認できません。',
  loading:'共有業務メモの読込を待っています。読込完了後に再読込してください。',
  degraded:'業務メモの同期が失敗しました。古いキャッシュは表示しません。',
  'invalid-owner-state':'業務メモの正本データを確認できません。',
  'invalid-snapshot':'業務メモの内容を検証できません。表示を中止しました。',
  'invalid-order':'固定メモの並び順を検証できません。表示を中止しました。',
  'inconsistent-owner':'ルーム・利用者・通信状態が一致しません。表示を中止しました。',
  'not-test-context':'localhostの明示的テストルームからのみ表示できます。'
};
function guard() {
  if(window.parent===window||!['localhost','127.0.0.1'].includes(location.hostname))
    return null;
  try {
    const host=window.parent;
    const params=new URL(host.location.href).searchParams;
    const room=params.get('room')||'';
    const flag=host.WORK_BOARD_TEST;
    const local=!host.firebaseConfig?.apiKey||!host.firebaseConfig?.databaseURL;
    if(host.location.origin!==location.origin
      ||params.get('modernReadV555')!=='1'
      ||['modernReadV551','modernReadV552','modernReadV553','modernReadV554'].some(key=>params.has(key))
      ||!room.startsWith('test-')||flag?.modernReadV555!==true
      ||!(local||flag?.emulator===true))return null;
    return {host,room};
  } catch { return null; }
}
function readOwners() {
  const ctx=guard();
  if(!ctx)return {classic:null,memos:{ready:false,reason:'not-test-context'}};
  try {
    const main=ctx.host.WorkBoardReadV550;
    if(!main||typeof main.read!=='function')
      return {classic:null,memos:{ready:false,reason:'loading'}};
    const classic=main.read();
    if(!classic||typeof classic!=='object'||(classic.ready&&classic.roomId!==ctx.room))
      return {classic:null,memos:{ready:false,reason:'invalid-snapshot'}};
    const facade=ctx.host.WorkBoardBusinessMemoReadV555;
    if(!facade||typeof facade.read!=='function')
      return {classic,memos:{ready:false,reason:'loading'}};
    return {classic,memos:facade.read()};
  } catch {
    return {classic:null,memos:{ready:false,reason:'not-test-context'}};
  }
}
function make(tag,style,text) {
  const n=document.createElement(tag);
  if(style)n.className=style;
  if(text!==undefined)n.textContent=String(text);
  return n;
}
function add(root,tag,style,value) {
  const n=make(tag,style,value);
  root.appendChild(n);
  return n;
}
const formatDate = millis => {
  const value=Number(millis);
  const date=new Date(value);
  if(!value||!Number.isFinite(date.getTime()))return '日時不明';
  const pad=n=>String(n).padStart(2,'0');
  return date.getFullYear()+'/'+pad(date.getMonth()+1)+'/'+pad(date.getDate())
    +' '+pad(date.getHours())+':'+pad(date.getMinutes());
};
function memoCard(memo) {
  const card=make('article','memo-card'+(memo.pinned?' readonly-pinned':''));
  card.dataset.memoId=memo.id;
  card.dataset.revision=String(memo.revision);
  const top=add(card,'div','memo-top');
  const header=add(top,'div','readonly-memo-head');
  add(header,'span','memo-category readonly-category',memo.category);
  add(top,'span',memo.pinned?'readonly-pin-label':'readonly-no-pin',
    memo.pinned?'固定中':'');
  add(card,'h2','',memo.title||'無題');
  const body=add(card,'pre','memo-copy readonly-copy',memo.body);
  body.tabIndex=0;
  body.setAttribute('aria-label',(memo.title||'無題')+'の本文（スクロール可能）');
  if(memo.tags.length){
    const tags=add(card,'div','readonly-tags');
    for(const tag of memo.tags)add(tags,'span','readonly-tag',tag);
  }
  const meta=add(card,'div','readonly-bottom');
  const by=memo.updatedBy||memo.createdBy||'更新者不明';
  add(meta,'span','',by+' ／ '+formatDate(memo.updatedAt||memo.createdAt));
  return card;
}
function updateCategory(categories) {
  const select=$('memoCategoryV555');
  const selected=select.value;
  select.replaceChildren(new Option('すべての分類',''));
  for(const category of categories)select.add(new Option(category,category));
  select.value=categories.includes(selected)?selected:'';
  return selected!==select.value;
}
function clear() {
  $('memoGridV555').replaceChildren();
  $('memoV555').hidden=true;
  $('countV555').textContent='';
  updateCategory([]);
}
function render() {
  const {classic,memos}=readOwners();
  const options=()=>({query:$('memoSearchV555').value,category:$('memoCategoryV555').value});
  let model=selectModernMemosV555(memos,classic,options());
  if(!model.ready){
    document.body.dataset.readState='unavailable';
    const reason=(!classic||classic.ready!==true)?(classic?.reason||memos?.reason):model.reason;
    const message=warnings[reason]||'業務メモを表示できません。';
    clear();
    $('sourceV555').textContent=message;
    $('failureV555').textContent=message;
    $('failureV555').hidden=false;
    return;
  }
  document.body.dataset.readState='ready';
  $('failureV555').hidden=true;
  if(updateCategory(model.categories))model=selectModernMemosV555(memos,classic,options());
  $('sourceV555').textContent=
    (model.source==='local-only'?'端末内保存（共同同期ではありません）':'共有ルーム同期済み')
    +' ／ ルーム：'+model.roomId
    +' ／ 利用者：'+model.selectedUser
    +' ／ 表示順は利用者ごとの端末設定';
  $('countV555').textContent='表示 '+model.visible+'件 / 全 '+model.total
    +'件（固定 '+model.pinnedCount+'件）';
  $('memoGridV555').replaceChildren(...model.rows.map(memoCard));
  $('memoEmptyV555').hidden=model.visible!==0;
  $('memoV555').hidden=false;
}
$('refreshV555').addEventListener('click',render);
$('memoSearchV555').addEventListener('input',render);
$('memoCategoryV555').addEventListener('change',render);
window.addEventListener('storage',event=>{
  if(event.key==='systemTaskUser'||event.key?.startsWith('workBoardMemoOrderV531:'))render();
});
const ctx=guard();
if(ctx)ctx.host.addEventListener('workboard-memo-state-v555',render);
$('closeV555').addEventListener('click',()=>{
  if(ctx)ctx.host.removeEventListener('workboard-memo-state-v555',render);
  if(window.frameElement)window.frameElement.remove();
});
render();
