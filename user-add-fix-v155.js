// Ver.155 user registration hotfix: prevent duplicate meta saves and persist once.
(function installUserAddFixV155(){
  const W=window.WorkBoardWorkflowV152||window.WorkBoardWorkflowV150;
  const form=document.getElementById('userManageForm');
  if(!form||form.dataset.userAddFixV155==='true')return;
  form.dataset.userAddFixV155='true';

  let pending=false;
  const normalize=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
  const sanitize=v=>String(v||'').normalize('NFKC').replace(/\s+/g,'').slice(0,12);
  const roomId=()=>String(W?.ROOM_ID||new URLSearchParams(location.search).get('room')||localStorage.getItem('systemTaskRoomId')||'default').replace(/[.#$/\[\]]/g,'-').slice(0,60);
  const usersKey=()=>`system-task-users:${roomId()}`;
  const colorsKey=()=>`system-task-user-colors:${roomId()}`;
  const readJson=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'');return value??fallback}catch(_){return fallback}};
  const readUsers=()=>{const users=readJson(usersKey(),[]);return Array.isArray(users)?users.map(x=>String(x||'')).filter(Boolean):[]};
  const readColors=()=>{const colors=readJson(colorsKey(),{});return colors&&typeof colors==='object'&&!Array.isArray(colors)?colors:{}};
  const hasUser=(users,name)=>users.some(user=>normalize(user)===normalize(name));
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  function notify(message,error=false){
    const toast=document.getElementById('toast');
    if(!toast){W?.notify?.(message,error);return}
    const dialogs=[...document.querySelectorAll('dialog[open]')],top=dialogs[dialogs.length-1];
    if(top){top.appendChild(toast);toast.classList.add('in-dialog')}else{document.body.appendChild(toast);toast.classList.remove('in-dialog')}
    toast.textContent=message;toast.style.background=error?'#b91c2b':'#132b40';toast.hidden=false;
    clearTimeout(notify._timer);notify._timer=setTimeout(()=>toast.hidden=true,3200);
  }

  function setBusy(value){
    pending=value;
    const button=form.querySelector('button[type="submit"],input[type="submit"]');
    if(!button)return;
    if(value){button.dataset.userAddLabelV155=button.value||button.textContent||'';button.disabled=true;if(button.tagName==='INPUT')button.value='保存中…';else button.textContent='保存中…'}
    else{button.disabled=false;const label=button.dataset.userAddLabelV155;if(label!==undefined){if(button.tagName==='INPUT')button.value=label;else button.textContent=label;delete button.dataset.userAddLabelV155}}
  }

  async function waitForAppSync(name,timeout=2200){
    const started=Date.now();
    while(Date.now()-started<timeout){if(hasUser(readUsers(),name))return true;await pause(80)}
    return false;
  }

  function refreshManager(){
    const dialog=document.getElementById('userManageDialog'),manage=document.getElementById('manageUsers');
    if(dialog?.open&&typeof dialog.close==='function')dialog.close();
    requestAnimationFrame(()=>manage?.click());
  }

  async function addLocalOnly(name,color){
    const users=readUsers();if(hasUser(users,name))return{ok:false,duplicate:true};
    const colors=readColors();users.push(name);colors[name]=color;
    localStorage.setItem(usersKey(),JSON.stringify(users));localStorage.setItem(colorsKey(),JSON.stringify(colors));
    return{ok:true,localOnly:true};
  }

  async function addRemote(name,color){
    const r=await W?.ensureRemote?.();
    if(!r){
      if(W?.dependencyState?.()==='local-only')return addLocalOnly(name,color);
      throw new Error('共同データへ接続できないため、ユーザーを追加できませんでした。通信状態を確認してください。');
    }
    let duplicate=false;
    const metaRef=r.ref(r.db,`rooms/${roomId()}/meta`),now=Date.now();
    const tx=await r.runTransaction(metaRef,current=>{
      const meta=current&&typeof current==='object'?current:{};
      const users=Array.isArray(meta.users)?[...meta.users]:readUsers();
      if(hasUser(users,name)){duplicate=true;return}
      users.push(name);
      const userColors=meta.userColors&&typeof meta.userColors==='object'&&!Array.isArray(meta.userColors)?{...meta.userColors}:readColors();
      userColors[name]=color;
      const revisions=meta._revisions&&typeof meta._revisions==='object'?{...meta._revisions}:{};
      for(const field of ['users','userColors','usersUpdatedAt'])revisions[field]=Number(revisions[field]||0)+1;
      return{...meta,users,userColors,usersUpdatedAt:now,_revisions:revisions};
    },{applyLocally:false});
    if(!tx.committed){if(duplicate)return{ok:false,duplicate:true};throw new Error('ユーザー情報の保存処理を完了できませんでした。再試行してください。')}
    const verify=await r.get(metaRef),meta=verify.val()||{};
    if(!Array.isArray(meta.users)||!hasUser(meta.users,name)||String(meta.userColors?.[name]||'').toLowerCase()!==String(color).toLowerCase())throw new Error('保存結果を共同データで確認できませんでした。画面を更新して状態を確認してください。');
    return{ok:true};
  }

  form.addEventListener('submit',async event=>{
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    if(pending)return;
    const nameInput=document.getElementById('newUserName'),colorInput=document.getElementById('newUserColor');
    const name=sanitize(nameInput?.value),color=String(colorInput?.value||'#7c5cff');
    if(!name)return notify('ユーザー名を入力してください',true);
    if(hasUser(readUsers(),name))return notify('同じユーザーが既にあります',true);
    setBusy(true);
    try{
      const result=await addRemote(name,color);
      if(result?.duplicate)return notify('同じユーザーが既にあります',true);
      if(!result?.ok)throw new Error('ユーザーを追加できませんでした。');
      if(nameInput)nameInput.value='';
      if(result.localOnly){notify('ユーザーを追加しました。表示を更新します。');setTimeout(()=>location.reload(),350);return}
      const synced=await waitForAppSync(name);
      notify('ユーザーを追加しました。');
      if(synced)refreshManager();else setTimeout(()=>location.reload(),350);
    }catch(error){console.warn('Ver.155 user add failed',error);notify(String(error?.message||'ユーザーを追加できませんでした。'),true)}
    finally{setBusy(false)}
  },true);
})();
