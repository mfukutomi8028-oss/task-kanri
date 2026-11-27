// The Origin entry owns its modal lifecycle; canonical board and cloud data
// remain in their existing owners. No sign-in or subscriptions when disabled.
import {createOriginMessagingLauncher,connectFirebaseMessagingAuth,resolveMessagingLaunchConfig} from './origin-messaging-launcher.js';
import {createMessagingDraftOwner} from './workspace-messaging-store.js';
const context=s=>JSON.stringify([s?.roomId,s?.currentUser]);
export function installOriginMessagingEntry({root,anchor,readConfig,board,connect,mountCloud,cssUrl,isActive=()=>true,onNotification=()=>{}}={}){
  if(typeof readConfig!=='function'||!resolveMessagingLaunchConfig(readConfig()))return null;
  if(!root||!anchor?.parentNode||['readSnapshot','readMemos','canReadRecord','openRecord','subscribe'].some(k=>typeof board?.[k]!=='function')||typeof connect!=='function'||typeof mountCloud!=='function'||typeof isActive!=='function'||typeof onNotification!=='function')throw new TypeError('Origin host adapters required');
  const make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const trigger=make('button','icon-button origin-message-trigger');trigger.type='button';trigger.title='\u30e1\u30c3\u30bb\u30fc\u30b8\u3092\u958b\u304f';trigger.setAttribute('aria-label',trigger.title);trigger.setAttribute('aria-haspopup','dialog');trigger.innerHTML='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.6-4.5A8.5 8.5 0 1 1 21 11.5Z"/><path d="M9 11.5h7"/></svg>';
  const badge=make('span','origin-message-badge');badge.hidden=true;badge.setAttribute('aria-hidden','true');trigger.append(badge);
  const triggerLabel=trigger.title;
  function renderBadge(summary){
    const valid=summary?.status==='ok'&&Number.isSafeInteger(summary.unread)&&summary.unread>=0&&summary.unread<=100&&Number.isSafeInteger(summary.invites)&&summary.invites>=0&&typeof summary.complete==='boolean';
    const count=valid?summary.unread+summary.invites:0;
    badge.hidden=!valid||summary.complete&&count===0;
    badge.textContent=badge.hidden?'':count>=100?'99+':!summary.complete?(count?count+'+':'…'):String(count);
    const description=valid?'（未読 '+(summary.unread>=100?'99+':summary.unread)+'件、招待 '+summary.invites+'件'+(summary.complete?'':'、一部未取得')+'）':'';
    trigger.title=triggerLabel+description;trigger.setAttribute('aria-label',trigger.title);
  }
  const dialog=make('dialog','origin-message-host');dialog.setAttribute('aria-label','\u696d\u52d9\u30e1\u30c3\u30bb\u30fc\u30b8');
  const header=make('header','origin-message-host-head'),notice=make('p','origin-message-host-notice'),dismiss=make('button','origin-message-dismiss','\u9589\u3058\u308b');dismiss.type='button';dismiss.setAttribute('aria-label','\u30e1\u30c3\u30bb\u30fc\u30b8\u3092\u9589\u3058\u308b');notice.setAttribute('role','status');const statusBox=make('div','origin-message-host-status'),approval=make('details','origin-message-approval'),approvalTitle=make('summary','','端末承認情報'),approvalText=make('textarea','');approvalText.readOnly=true;approvalText.rows=3;approvalText.setAttribute('aria-label','管理者へ伝える端末承認情報');approval.append(approvalTitle,make('p','','本人確認のため、管理者だけに以下を伝えてください。'),approvalText);approval.hidden=true;statusBox.append(notice,approval);header.append(statusBox,dismiss);const target=make('div','origin-message-host-content');dialog.append(header,target);
  const style=make('style','');style.textContent='.origin-message-trigger{position:relative}.origin-message-trigger[hidden],.origin-message-badge[hidden]{display:none!important}.origin-message-badge{position:absolute;inset-block-start:-4px;inset-inline-end:-5px;min-inline-size:17px;block-size:17px;box-sizing:border-box;padding:0 4px;border:1px solid var(--paper,#fff);border-radius:999px;background:#b52b43;color:white;font:700 10px/15px system-ui,sans-serif;text-align:center;white-space:nowrap;pointer-events:none}.origin-message-host{box-sizing:border-box;position:fixed;inset:0;margin:auto;width:min(1480px,calc(100% - 32px));height:min(900px,calc(100dvh - 32px));max-width:none;max-height:none;border:1px solid var(--line,#ddd);border-radius:16px;background:var(--paper,#fff);color:var(--ink,#222);padding:0;overflow:hidden}.origin-message-host[open]{display:flex;flex-direction:column}.origin-message-host::backdrop{background:rgba(20,25,40,.42)}.origin-message-host-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 12px;min-height:48px;border-bottom:1px solid var(--line,#ddd)}.origin-message-host-status{flex:1;min-width:0}.origin-message-approval{font-size:12px;max-width:480px}.origin-message-approval[hidden]{display:none!important}.origin-message-approval textarea{box-sizing:border-box;width:100%;max-width:100%;font:inherit;color:inherit;background:var(--bg,#f5f5f5);border:1px solid var(--line,#ccc);border-radius:6px;padding:6px}.origin-message-host-notice{margin:0;font-size:12px;color:var(--muted,#666);overflow-wrap:anywhere}.origin-message-dismiss{min-height:44px;min-width:64px;border:1px solid var(--line,#ddd);border-radius:8px;background:var(--paper,#fff);color:inherit;font:inherit;cursor:pointer}.origin-message-dismiss:focus-visible{outline:2px solid var(--accent,#535fd0);outline-offset:2px}.origin-message-host-content{min-height:0;flex:1;overflow:hidden}.origin-message-host-content .om-shell{height:100%;min-height:0;max-width:none;border:0;border-radius:0}@media(max-width:760px){.origin-message-host{width:100%;height:100dvh;border:0;border-radius:0}.origin-message-host-head{padding:2px 8px}}';
  const link=make('link','');link.rel='stylesheet';link.href=cssUrl;
  anchor.after(trigger);root.append(link,style,dialog);
  let disposed=false,suspended=false,returnRequested=false,restoring=false,workspaceOpen=false,openingKey=null,sessionStop=null,epoch=0,connectionEpoch=0;
  const usable=()=>!disposed&&isActive()&&Boolean(resolveMessagingLaunchConfig(readConfig()));
  const draftOwner=createMessagingDraftOwner();
  let draftKey=null;
  const beforeUnload=event=>{if(draftOwner.hasDrafts()){event.preventDefault();event.returnValue=true;}};
  window.addEventListener('beforeunload',beforeUnload);
  const scopeKey=()=>JSON.stringify([context(board.readSnapshot()),resolveMessagingLaunchConfig(readConfig())]);
  const current=()=>usable()&&openingKey!==null&&openingKey===scopeKey();
  const safeStop=()=>{try{sessionStop?.();}catch(_){}sessionStop=null;};
  const show=()=>{if(!dialog.open)dialog.showModal();};
  function close(restoreFocus=true,terminate=false){
    epoch++;workspaceOpen=false;suspended=false;returnRequested=false;restoring=false;safeStop();const handle=launcher.getHandle();let retained=false;
    if(!terminate&&current()&&handle?.getSnapshot()?.status==='bound')try{retained=handle.hideWorkspace?.()===true;}catch(_){}
    if(!retained){connectionEpoch++;openingKey=null;launcher.close();renderBadge(null);}
    if(dialog.open)dialog.close();target.replaceChildren();approval.hidden=true;approval.open=false;approvalText.value='';
    if(restoreFocus&&trigger.isConnected&&!trigger.hidden&&isActive())trigger.focus({preventScroll:true});
  }
  async function suspend(action){
    if(!current()||!dialog.open)return false;
    const token=epoch;suspended=true;returnRequested=false;dialog.close();
    try{if(await action()===true&&token===epoch&&current())return true;}catch(_){/* Restore the current workspace. */}
    if(token===epoch&&current()){suspended=false;show();}
    return false;
  }
  const launcher=createOriginMessagingLauncher({readConfig,readBoard:board.readSnapshot,async connect(){const connection=await connect();const authSdk=connection.authSdk??await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");const auth=await connectFirebaseMessagingAuth({...connection,authSdk});return {sdk:connection.sdk,auth};},mount(options){
    const generation=++connectionEpoch;
    return mountCloud({...options,draftOwner,root:target,keepNotificationSession:true,onIdentityInvalidated(){if(generation===connectionEpoch&&current()&&suspended)board.closeMessagingDraft?.();},onSummary(value){if(generation===connectionEpoch&&current())renderBadge(value);},onAvailability(value){if(generation===connectionEpoch&&current()&&value===false){notice.textContent='メッセージ機能を停止中です。';approval.hidden=true;approvalText.value='';}},onNotification(kind){if(generation===connectionEpoch&&current())onNotification(kind);},board:{...board,
      openRecord:(ref,scope)=>suspend(()=>board.openRecord(ref,scope)),
      ...(typeof board.openBusinessDraft==='function'?{openBusinessDraft:(draft,scope)=>suspend(()=>board.openBusinessDraft(draft,scope))}:{}),
      restoreConversation(){if(!suspended||!current())return false;suspended=false;returnRequested=false;show();return true;}
    },onClose:()=>close()});
  }});
  async function open(){if(!usable())return false;if(openingKey!==null&&openingKey!==scopeKey())close(false,true);if(dialog.open)return true;if(suspended)return resume();openingKey=scopeKey();draftKey=openingKey;workspaceOpen=true;const token=++epoch;notice.textContent='\u63a5\u7d9a\u3092\u78ba\u8a8d\u3057\u3066\u3044\u307e\u3059\u2026';show();dismiss.focus({preventScroll:true});const result=await launcher.open();if(token!==epoch||!current()||!dialog.open)return false;
    if(result.status!=='opened'){notice.textContent='\u30e1\u30c3\u30bb\u30fc\u30b8\u306b\u63a5\u7d9a\u3067\u304d\u307e\u305b\u3093\u3002\u5171\u540c\u7de8\u96c6\u306e\u63a5\u7d9a\u3092\u78ba\u8a8d\u3057\u3001\u9589\u3058\u3066\u304b\u3089\u3082\u3046\u4e00\u5ea6\u958b\u3044\u3066\u304f\u3060\u3055\u3044\u3002';return false;}
    const handle=launcher.getHandle();try{if(handle?.showWorkspace?.()===false)throw Error('Workspace unavailable');}catch(_){close(false,true);return false;}
    const render=value=>{
      if(token!==epoch||!current())return;
      const connected=value?.status==='bound';
      notice.textContent=connected?'接続済み':handle.getAvailability?.()===false?'メッセージ機能を停止中です。':'未承認またはオフラインのため利用できません。管理者にご確認ください。';
      const request=connected?null:handle.getApprovalRequest?.();
      approval.hidden=!request;approvalText.value=request?['ルーム: '+request.roomId,'利用者: '+request.displayName,'端末ID: '+request.uid].join('\n'):'';
      if(!request)approval.open=false;
      if(connected&&returnRequested)void resume();
    };render(handle.getSnapshot?.());if(typeof handle.subscribe==='function')sessionStop=handle.subscribe(render);return true;
  }
  async function resume(){
    if(!suspended||!current()||restoring)return false;
    returnRequested=true;
    const handle=launcher.getHandle(),token=epoch;
    if(handle?.getSnapshot()?.status!=='bound'){show();dismiss.focus({preventScroll:true});return true;}
    restoring=true;
    try{if(await handle.restore?.()===true&&token===epoch&&current())return true;}
    catch(_){/* A new authorization is required on reconnection. */}
    finally{if(token===epoch)restoring=false;}
    if(token===epoch&&current()){
      if(handle.getSnapshot()?.status!=='bound'){show();dismiss.focus({preventScroll:true});return true;}
      close();
    }
    return false;
  }
  function sync(){if(disposed)return;const enabled=usable(),key=scopeKey();if(draftKey!==null&&draftKey!==key){draftKey=null;draftOwner.clear();}trigger.hidden=!enabled;if(!enabled||openingKey!==null&&openingKey!==scopeKey()){if(suspended)board.closeMessagingDraft?.();close(false,true);}}
  trigger.addEventListener('click',()=>void open());dismiss.addEventListener('click',()=>close());dialog.addEventListener('cancel',event=>{if(event.target===dialog){event.preventDefault();close();}});dialog.addEventListener('close',()=>{if(!dialog.open&&!suspended&&workspaceOpen)close();});
  const stop=board.subscribe(sync);sync();
  return Object.freeze({open,close,resume,sync,
    linkRecords:refs=>launcher.getHandle()?.linkRecords?.(refs)??Promise.resolve(false),
    // Opens messaging only on this explicit request. The dialog itself shows
    // approval or offline state; nothing about the link is read before binding.
    async openRecordLink(ref){
      if(!usable()||await board.canReadRecord(ref,{roomId:ref.roomId})!==true)return 'unavailable';
      if(await open()!==true||!current()||!dialog.open)return 'locked';
      const status=await (launcher.getHandle()?.openRecordLink?.(ref)??'unavailable');
      if(['unavailable','pending','retry'].includes(status)&&current()&&dialog.open&&!suspended)close(false);
      return status;
    },
    async share(ref){
      if(!usable()||await board.canReadRecord(ref,{roomId:ref.roomId})!==true)return false;
      if(await open()!==true||!current()||!dialog.open)return false;
      return launcher.getHandle()?.share?.(ref)??false;
    },
    dispose(){if(disposed)return;close(false,true);draftOwner.clear();disposed=true;window.removeEventListener('beforeunload',beforeUnload);stop?.();trigger.remove();dialog.remove();link.remove();style.remove();}});
}
