// The Origin entry owns its modal lifecycle; canonical board and cloud data
// remain in their existing owners. No sign-in or subscriptions when disabled.
import {createOriginMessagingLauncher,connectFirebaseMessagingAuth,resolveMessagingLaunchConfig} from './origin-messaging-launcher.js';
const context=s=>JSON.stringify([s?.roomId,s?.currentUser,s?.connectionMode]);
export function installOriginMessagingEntry({root,anchor,readConfig,board,connect,mountCloud,cssUrl,isActive=()=>true}={}){
  if(typeof readConfig!=='function'||!resolveMessagingLaunchConfig(readConfig()))return null;
  if(!root||!anchor?.parentNode||['readSnapshot','readMemos','canReadRecord','openRecord','subscribe'].some(k=>typeof board?.[k]!=='function')||typeof connect!=='function'||typeof mountCloud!=='function'||typeof isActive!=='function')throw new TypeError('Origin host adapters required');
  const make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const trigger=make('button','icon-button origin-message-trigger');trigger.type='button';trigger.title='\u30e1\u30c3\u30bb\u30fc\u30b8\u3092\u958b\u304f';trigger.setAttribute('aria-label',trigger.title);trigger.setAttribute('aria-haspopup','dialog');trigger.innerHTML='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.6-4.5A8.5 8.5 0 1 1 21 11.5Z"/><path d="M9 11.5h7"/></svg>';
  const dialog=make('dialog','origin-message-host');dialog.setAttribute('aria-label','\u696d\u52d9\u30e1\u30c3\u30bb\u30fc\u30b8');
  const header=make('header','origin-message-host-head'),notice=make('p','origin-message-host-notice'),dismiss=make('button','origin-message-dismiss','\u9589\u3058\u308b');dismiss.type='button';dismiss.setAttribute('aria-label','\u30e1\u30c3\u30bb\u30fc\u30b8\u3092\u9589\u3058\u308b');notice.setAttribute('role','status');header.append(notice,dismiss);const target=make('div','origin-message-host-content');dialog.append(header,target);
  const style=make('style','');style.textContent='.origin-message-trigger[hidden]{display:none!important}.origin-message-host{box-sizing:border-box;position:fixed;inset:0;margin:auto;width:min(1480px,calc(100% - 32px));height:min(900px,calc(100dvh - 32px));max-width:none;max-height:none;border:1px solid var(--line,#ddd);border-radius:16px;background:var(--paper,#fff);color:var(--ink,#222);padding:0;overflow:hidden}.origin-message-host[open]{display:flex;flex-direction:column}.origin-message-host::backdrop{background:rgba(20,25,40,.42)}.origin-message-host-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 12px;min-height:48px;border-bottom:1px solid var(--line,#ddd)}.origin-message-host-notice{margin:0;font-size:12px;color:var(--muted,#666);overflow-wrap:anywhere}.origin-message-dismiss{min-height:44px;min-width:64px;border:1px solid var(--line,#ddd);border-radius:8px;background:var(--paper,#fff);color:inherit;font:inherit;cursor:pointer}.origin-message-dismiss:focus-visible{outline:2px solid var(--accent,#535fd0);outline-offset:2px}.origin-message-host-content{min-height:0;flex:1;overflow:hidden}.origin-message-host-content .om-shell{height:100%;min-height:0;max-width:none;border:0;border-radius:0}@media(max-width:760px){.origin-message-host{width:100%;height:100dvh;border:0;border-radius:0}.origin-message-host-head{padding:2px 8px}}';
  const link=make('link','');link.rel='stylesheet';link.href=cssUrl;
  anchor.after(trigger);root.append(link,style,dialog);
  let disposed=false,suspended=false,openingKey=null,sessionStop=null,epoch=0;
  const usable=()=>!disposed&&isActive()&&Boolean(resolveMessagingLaunchConfig(readConfig()));
  const current=()=>usable()&&openingKey!==null&&openingKey===context(board.readSnapshot());
  const safeStop=()=>{try{sessionStop?.();}catch(_){}sessionStop=null;};
  const show=()=>{if(!dialog.open)dialog.showModal();};
  function close(restoreFocus=true){epoch++;openingKey=null;suspended=false;safeStop();launcher.close();if(dialog.open)dialog.close();target.replaceChildren();if(restoreFocus&&trigger.isConnected&&!trigger.hidden&&isActive())trigger.focus({preventScroll:true});}
  const launcher=createOriginMessagingLauncher({readConfig,readBoard:board.readSnapshot,async connect(){const connection=await connect();const auth=await connectFirebaseMessagingAuth(connection);return {sdk:connection.sdk,auth};},mount(options){
    return mountCloud({...options,root:target,board:{...board,
      async openRecord(ref,scope){if(!current()||!dialog.open)return false;const token=epoch;suspended=true;dialog.close();try{if(await board.openRecord(ref,scope)===true&&token===epoch&&current())return true;}catch(_){}if(token===epoch&&current()){suspended=false;show();}return false;},
      restoreConversation(){if(!suspended||!current())return false;suspended=false;show();return true;}
    },onClose:()=>close()});
  }});
  async function open(){if(!usable())return false;if(dialog.open)return true;openingKey=context(board.readSnapshot());const token=++epoch;notice.textContent='\u63a5\u7d9a\u3092\u78ba\u8a8d\u3057\u3066\u3044\u307e\u3059\u2026';show();dismiss.focus({preventScroll:true});const result=await launcher.open();if(token!==epoch||!current()||!dialog.open)return false;
    if(result.status!=='opened'){notice.textContent='\u30e1\u30c3\u30bb\u30fc\u30b8\u306b\u63a5\u7d9a\u3067\u304d\u307e\u305b\u3093\u3002\u5171\u540c\u7de8\u96c6\u306e\u63a5\u7d9a\u3092\u78ba\u8a8d\u3057\u3001\u9589\u3058\u3066\u304b\u3089\u3082\u3046\u4e00\u5ea6\u958b\u3044\u3066\u304f\u3060\u3055\u3044\u3002';return false;}
    const handle=launcher.getHandle();const render=value=>{if(token===epoch&&current())notice.textContent=value?.status==='bound'?'\u63a5\u7d9a\u6e08\u307f':'\u672a\u627f\u8a8d\u307e\u305f\u306f\u30aa\u30d5\u30e9\u30a4\u30f3\u306e\u305f\u3081\u5229\u7528\u3067\u304d\u307e\u305b\u3093\u3002\u7ba1\u7406\u8005\u306b\u3054\u78ba\u8a8d\u304f\u3060\u3055\u3044\u3002';};render(handle.getSnapshot?.());if(typeof handle.subscribe==='function')sessionStop=handle.subscribe(render);return true;
  }
  async function resume(){if(!suspended||!current())return false;const token=epoch;try{if(await launcher.getHandle()?.restore?.()===true&&token===epoch&&current())return true;}catch(_){}if(token===epoch)close();return false;}
  function sync(){if(disposed)return;const enabled=usable();trigger.hidden=!enabled;if(!enabled||openingKey!==null&&openingKey!==context(board.readSnapshot()))close(false);}
  trigger.addEventListener('click',()=>void open());dismiss.addEventListener('click',()=>close());dialog.addEventListener('cancel',event=>{if(event.target===dialog){event.preventDefault();close();}});dialog.addEventListener('close',()=>{if(!dialog.open&&!suspended&&openingKey!==null)close();});
  const stop=board.subscribe(sync);sync();
  return Object.freeze({open,close,resume,sync,dispose(){if(disposed)return;close(false);disposed=true;stop?.();trigger.remove();dialog.remove();link.remove();style.remove();}});
}
