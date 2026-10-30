// Ver.555: Modern business memos read the existing Classic sidecar owner.
// No new Firebase app, storage, subscriptions, timers, demo data or write APIs.
// The owner emits only a local readiness event; the UI reuses the current facade.
import { selectModernMemosV555 } from './memo-list-contract-v555.mjs';

const $ = id => document.getElementById(id);
let lastModelV563 = null;
function memoActionsV563() {
  const ctx = guard();
  if (!ctx) return null;
  try {
    const q = new URL(ctx.host.location.href).searchParams;
    if (q.get('modernWriteV563') !== '1'
      || ctx.host.WORK_BOARD_TEST?.modernWriteV563 !== true) return null;
    const actions = ctx.host.WorkBoardBusinessMemoActionsV563;
    return ['available','create','edit','remove','pin','copy','task','move']
      .every(name => typeof actions?.[name] === 'function') ? actions : null;
  } catch { return null; }
}

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
function memoCard(memo, model, index, writable, canMove) {
  const card=make('article','memo-card'+(memo.pinned?' readonly-pinned':''));
  card.dataset.memoId=memo.id;
  card.dataset.revision=String(memo.revision);
  if(writable){card.dataset.roomId=model.roomId;card.dataset.selectedUser=model.selectedUser;}
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
  if(writable){
    const tools=add(card,'div','memo-actions-v563');
    const createAction=(action,label)=>{
      const button=add(tools,'button','btn small',label);
      button.type='button';
      button.dataset.memoActionV563=action;
      button.setAttribute('aria-label',label+'：'+(memo.title||'業務メモ'));
      return button;
    };
    if(canMove){
      for(const [direction,label] of [[-1,'↑ 上へ'],[1,'↓ 下へ']]){
        const other=model.rows[index+direction];
        if(!other || Boolean(other.pinned)!==Boolean(memo.pinned)) continue;
        const button=createAction('move',label);
        button.dataset.targetId=other.id;
        button.dataset.targetRevision=String(other.revision);
        button.dataset.after=String(direction>0);
      }
    }
    createAction('pin',memo.pinned?'固定解除':'固定する');
    createAction('copy','本文コピー');
    createAction('task','タスク作成');
    createAction('edit','編集');
    createAction('remove','削除').classList.add('memo-remove-v563');
  }
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
  lastModelV563=null;
  document.body.dataset.memoWriteV563='readonly';
  $('memoNewV563').hidden=true;
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
  const actions=memoActionsV563();
  const writable=Boolean(actions?.available({
    roomId:model.roomId,selectedUser:model.selectedUser
  })?.ok);
  const canMove=writable&&!options().query.trim()&&!options().category;
  document.body.dataset.memoWriteV563=writable?'enabled':'readonly';
  $('memoNewV563').hidden=!writable;
  $('memoWriteNoteV563').textContent=writable
    ? 'Classicの正本を操作します。並び順はこの利用者の端末だけに保存されます。'
    : '閲覧専用：追加・編集・固定変更・並べ替え・削除はできません。';
  document.querySelector('.readonly-flag').textContent=writable?'メモ操作のテスト':'閲覧専用';
  document.querySelector('.readonly-rail-label').textContent=writable
    ? '作成・編集はClassicの入力画面で行います。コピーは本文をコピーします。'
    : '閲覧専用の検証画面です。保存・固定変更・並べ替え・削除はできません。';
  $('sourceV555').textContent=
    (model.source==='local-only'?'端末内保存（共同同期ではありません）':'共有ルーム同期済み')
    +' ／ ルーム：'+model.roomId
    +' ／ 利用者：'+model.selectedUser
    +' ／ 表示順は利用者ごとの端末設定';
  $('countV555').textContent='表示 '+model.visible+'件 / 全 '+model.total
    +'件（固定 '+model.pinnedCount+'件）';
  lastModelV563=model;
  $('memoGridV555').replaceChildren(...model.rows.map((row,i)=>memoCard(row,model,i,writable,canMove)));
  $('memoEmptyV555').hidden=model.visible!==0;
  $('memoV555').hidden=false;
}
function showMemoResultV563(result, action) {
  const label=$('memoActionStatusV563');
  label.hidden=false;
  label.dataset.error=(!result?.ok&&result?.error!=='cancelled')?'true':'false';
  label.textContent=result?.error==='cancelled'?'操作をキャンセルしました。'
    : result?.ok?(action==='remove'?'メモを削除しました。'
      :action==='pin'?'固定設定を更新しました。'
      :action==='move'?'この端末のメモの表示順を更新しました。'
      :action==='copy'?'本文をコピーしました。':'操作が完了しました。')
    :result?.error==='owner-mismatch'?'利用者またはルームが変更されました。'
    :'操作できませんでした。Classicの最新内容を確認して再読込してください。';
}
$('memoNewV563').addEventListener('click',()=>{
  const model=lastModelV563,actions=memoActionsV563();
  if(!model?.ready||!actions)return;
  const result=actions.create({roomId:model.roomId,selectedUser:model.selectedUser});
  if(result?.ok&&result?.pending){closeMemoFrameV555();return;}
  showMemoResultV563(result,'create');
});
$('memoGridV555').addEventListener('click',async event=>{
  const button=event.target?.closest?.('[data-memo-action-v563]');
  const card=button?.closest?.('[data-memo-id]');
  if(!button||!card||!$('memoGridV555').contains(card))return;
  const action=button.dataset.memoActionV563;
  const actions=memoActionsV563();
  if(!actions||typeof actions[action]!=='function')return;
  const request={
    roomId:card.dataset.roomId,selectedUser:card.dataset.selectedUser,
    id:card.dataset.memoId,expectedRevision:Number(card.dataset.revision)
  };
  if(action==='move'){
    request.targetId=button.dataset.targetId;
    request.expectedTargetRevision=Number(button.dataset.targetRevision);
    request.after=button.dataset.after==='true';
    request.expectedOrder=lastModelV563?.rows.map(row=>row.id)||[];
  }
  button.disabled=true;
  let result;
  try { result=await actions[action](request); }
  catch { result={ok:false,error:'owner-error'}; }
  if(result?.ok&&result?.pending){
    // The existing Classic modal must not be obscured by this fullscreen frame.
    closeMemoFrameV555();
    return;
  }
  render();
  showMemoResultV563(result,action);
});
$('refreshV555').addEventListener('click',render);
$('memoSearchV555').addEventListener('input',render);
$('memoCategoryV555').addEventListener('change',render);
window.addEventListener('storage',event=>{
  if(event.key==='systemTaskUser'||event.key?.startsWith('workBoardMemoOrderV531:')){
    $('memoActionStatusV563').hidden=true;
    render();
  }
});
const ctx=guard();
if(ctx)ctx.host.addEventListener('workboard-memo-state-v555',render);
function closeMemoFrameV555() {
  // All exit routes release the parent-sidecar listener, not just "Back".
  // Otherwise a detached Modern frame stays subscribed to later room events.
  if(ctx)ctx.host.removeEventListener('workboard-memo-state-v555',render);
  window.frameElement?.remove();
}
$('closeV555').addEventListener('click',closeMemoFrameV555);
render();
