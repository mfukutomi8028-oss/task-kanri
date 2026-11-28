// Origin messaging view. Storage and authorization belong to injected services.
import {isConversationId,isMessageId,summarizeMessageConfirmation,validateRoomMessageInput} from './workspace-messaging-core.js';
import {searchLoadedMessages,selectSharedData} from './workspace-messaging-refs.js';
import {buildDailyReport} from './workspace-messaging-report.js';
import {messagingReactionTypes} from './workspace-messaging-shared.js';
import {createMessagingNotificationAdapter} from './workspace-messaging-notifications.js';
import {messagingFileAccept,prepareMessagingFiles,selectMessagingFiles,uploadMessagingFiles} from './workspace-messaging-file-draft.js';
const labels={task:'タスク',schedule:'予定',memo:'業務メモ',url:'リンク',image:'画像',file:'ファイル'};
const el=(tag,cls='',text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const button=(text,fn,cls='')=>{const b=el('button',cls,text);b.type='button';if(fn)b.addEventListener('click',fn);return b;};
const dateText=ms=>new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',weekday:'short'}).format(ms);
const timeText=ms=>new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(ms);
const key=ref=>JSON.stringify([ref.type,ref.recordId]);
const newRequest=()=> 'q_'+Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
export function mountOriginMessaging({root,store,session,commands,resolver,readBusinessData,resolvePerson,confirmations=null,personal=null,decorations=null,attachments=null,canShareRecord=null,readGroup=null,summaryOwner=null,onClose=()=>{}}){
  if(!root||!store||!session||!commands||!resolver||typeof readBusinessData!=='function'||typeof resolvePerson!=='function')throw new TypeError('Messaging view adapters required');
  const shell=el('section','om-shell');shell.setAttribute('aria-label','メッセージワークスペース');
  shell.innerHTML=`<aside class="om-list" aria-label="会話一覧"><div class="om-list-head"><h1>メッセージ</h1><button type="button" class="om-primary" data-om="new">新規</button></div><p class="om-unread-total" aria-label="メッセージの未読件数" aria-live="polite"></p><p class="om-list-notice" role="status" hidden></p><label class="om-label" for="om-list-search">会話を検索</label><input id="om-list-search" type="search" autocomplete="off" placeholder="名前・グループ名"><div class="om-filters" aria-label="会話の絞り込み"></div><div class="om-conversations" aria-live="polite"></div></aside><main class="om-chat" aria-label="会話"><header class="om-chat-head"><button type="button" data-om="back" class="om-back">一覧</button><div class="om-chat-title"><h2>会話を選択</h2><p></p></div><button type="button" data-om="search-toggle" class="om-mobile-only om-outline" aria-expanded="false" aria-controls="om-history-search">検索</button><button type="button" data-om="shared" class="om-outline">共有データ</button><button type="button" data-om="close" class="om-close" aria-label="メッセージを閉じる">閉じる</button></header><div class="om-search-bar" id="om-history-search" hidden><label for="om-message-search" class="om-label">読み込んだ履歴を検索</label><input id="om-message-search" type="search" autocomplete="off" placeholder="本文・件名"><button type="button" class="om-outline om-settings" data-om="settings" hidden>会話設定</button></div><div class="om-timeline" role="log" aria-label="メッセージ履歴" tabindex="0"></div><div class="om-newer" hidden><button type="button">新着メッセージへ</button></div><footer class="om-composer" hidden><div class="om-compose-context"></div><button type="button" data-om="compose-toggle" class="om-mobile-only om-outline" aria-label="入力オプション" aria-expanded="false" aria-controls="om-compose-tools">＋</button><label for="om-body" class="om-label">メッセージ本文</label><textarea id="om-body" rows="3" maxlength="6000" placeholder="メッセージを入力"></textarea><div class="om-compose-actions"><div id="om-compose-tools" class="om-compose-tools"><button type="button" data-om="refs" class="om-outline">業務を添付</button><button type="button" data-om="report" class="om-outline">日次報告</button><label class="om-confirm"><input type="checkbox" data-om="confirm">確認依頼</label></div><span class="om-spacer"></span><button type="button" class="om-primary" data-om="send">送信</button></div><p class="om-feedback" role="status"></p></footer></main><aside class="om-shared" aria-label="共有データ" hidden><div class="om-shared-head"><h2>共有データ</h2><button type="button" class="om-outline" data-om="hide-shared" aria-label="共有データを閉じる">閉じる</button></div><label for="om-shared-filter" class="om-label">種類</label><select id="om-shared-filter"><option value="">すべて</option><option value="task">タスク</option><option value="schedule">予定</option><option value="memo">業務メモ</option><option value="url">リンク</option></select><div class="om-shared-list"></div></aside><dialog class="om-dialog" aria-labelledby="om-dialog-title"><div class="om-dialog-content"></div></dialog>`;
  root.append(shell);
  const fileEnabled=typeof attachments?.uploadAttachment==='function'&&typeof attachments?.downloadAttachment==='function';
  const $=s=>shell.querySelector(s),timeline=$('.om-timeline'),composer=$('.om-composer'),body=$('#om-body'),dialog=$('.om-dialog'),dialogContent=$('.om-dialog-content');
  function dateFields(prefix){
    const box=el('div','om-date-fields');
    const fields=['開始日','終了日'].map(label=>{
      const field=el('label','',label),input=el('input');input.type='date';input.setAttribute('aria-label',prefix+label);field.append(input);box.append(field);return input;
    });
    return {box,fields,read(){
      const parse=input=>input.value?Date.parse(input.value+'T00:00:00+09:00'):null;
      const from=parse(fields[0]),end=parse(fields[1]);
      return {from,to:end===null?null:end+86400000};
    }};
  }
  const historyDates=dateFields('検索の'),sharedDates=dateFields('共有の'),searchCoverage=el('small','om-coverage'),sharedCoverage=el('p','om-coverage');
  const filters=el('details','om-search-options');filters.append(el('summary','','検索期間'),historyDates.box);
  const historyBar=$('.om-search-bar');
  historyBar.append(filters,searchCoverage);
  const sharedFilter=$('#om-shared-filter');
  for(const type of ['image','file']){const option=el('option','',labels[type]);option.value=type;sharedFilter.append(option);}
  sharedFilter.after(sharedDates.box,sharedCoverage);
  const list=$('.om-conversations'),feedback=$('.om-feedback'),sendButton=$('[data-om=send]'),shared=$('.om-shared'),search=$('#om-message-search');
  const searchToggle=$('[data-om=search-toggle]'),composeToggle=$('[data-om=compose-toggle]');
  const composeTools=$('.om-compose-tools');
  function disclosure(toggle,name,open){shell.dataset[name]=String(open);toggle.setAttribute('aria-expanded',String(open));}
  function expandHistory(open){disclosure(searchToggle,'historyOpen',open);searchToggle.textContent=open?'検索を閉じる':'検索';}
  const expandTools=open=>disclosure(composeToggle,'toolsOpen',open);
  expandHistory(false);expandTools(false);
  let conversations=[],invites=[],filter='all',disposed=false,listGeneration=0,renderGeneration=0,state=store.getSnapshot(),lastMessages=null,lastId=null,sendPending=false,query='',focusBeforeDialog=null,sharedGeneration=0,sharedAttachmentOffset=0,listScope=null,pendingShare=null;
  const inviteArea=el('section','om-invites');inviteArea.setAttribute('aria-label','グループ招待');inviteArea.hidden=true;list.before(inviteArea);
  const refreshButton=button('更新',()=>void reloadList({retryUnread:true}),'om-outline');refreshButton.hidden=typeof commands.respondInvite!=='function';$('.om-list-head').append(refreshButton);
  const fileInput=el('input','om-file-input');fileInput.type='file';fileInput.multiple=true;fileInput.accept=messagingFileAccept;fileInput.hidden=true;composer.append(fileInput);
  const fileButton=button('ファイルを添付',()=>{if(!sendPending&&!compose()?.editing){void warnAboutCapacity();fileInput.click();}},'om-outline');fileButton.hidden=!fileEnabled;composeTools.prepend(fileButton);
  const originalLabel=el('label','om-original'),keepOriginal=el('input','');keepOriginal.type='checkbox';const originalNote=el('small','om-original-note','原本には位置情報などのメタデータが残る場合があります。');originalNote.hidden=true;originalLabel.append(keepOriginal,el('span','','原本のまま送る'),originalNote);originalLabel.hidden=!fileEnabled;fileButton.after(originalLabel);keepOriginal.addEventListener('change',()=>{originalNote.hidden=!keepOriginal.checked;});
  // The original choice covers one attach action only; it never carries over.
  const resetOriginal=()=>{keepOriginal.checked=false;originalNote.hidden=true;};
  const context=()=>{const identity=session.getSnapshot();return state.status==='ready'&&identity?.status==='bound'&&state.conversationId&&Number.isSafeInteger(state.joinedAt)?{...identity,conversationId:state.conversationId,joinedAt:state.joinedAt}:null;};
  const selected=()=>conversations.find(c=>c.id===state.conversationId);
  const archivedGroup=()=>selected()?.status==='archived';
  const compose=()=>store.getComposer();
  const discard=button('下書きを破棄',()=>{
    const draft=compose();
    if(!draft||!window.confirm('編集中の下書きを破棄しますか？'))return;
    clearComposer(draft,{retainAttempt:Boolean(draft.attempt?.payload)});
    store.setDraft('');
    expandTools(false);
  },'om-outline');
  discard.hidden=true;
  composeTools.append(discard);
  const messageContextValid=(c)=>{const now=context();return !disposed&&now&&c.roomId===now.roomId&&c.personId===now.personId&&c.conversationId===now.conversationId&&c.joinedAt===now.joinedAt;};
  const notice=text=>{feedback.textContent=text||'';};
  let previewUrl=null;
  function clearPreview(){
    if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
  }
  const closeDialog=()=>{clearPreview();if(dialog.open)dialog.close();};
  function attachmentStillVisible(c,messageId,attachmentId){
    return messageContextValid(c)&&state.messages.some(row=>row.id===messageId&&row.deletedAt==null&&row.attachmentIds?.includes(attachmentId));
  }
  async function previewImage(row,c){
    if(!fileEnabled||!attachmentStillVisible(c,row.messageId,row.attachmentId))return;
    const panel=openDialog('画像プレビュー'),status=el('p','om-feedback','読み込み中…');
    panel.append(status);
    try{
      const result=await attachments.downloadAttachment({roomId:c.roomId,conversationId:c.conversationId,messageId:row.messageId,attachmentId:row.attachmentId});
      if(!dialog.open||!status.isConnected||!attachmentStillVisible(c,row.messageId,row.attachmentId))return;
      if(result.status!=='ok'||!(result.bytes instanceof Uint8Array)||!['image/png','image/jpeg','image/webp'].includes(result.mime)){status.textContent='画像を取得できません。';return;}
      const image=el('img','om-image-preview');image.alt=row.title;
      previewUrl=URL.createObjectURL(new Blob([result.bytes],{type:result.mime}));
      image.src=previewUrl;status.replaceWith(image);
    }catch(_){if(status.isConnected)status.textContent='画像を取得できません。';}
  }
  dialog.addEventListener('close',()=>{clearPreview();if(focusBeforeDialog?.isConnected)focusBeforeDialog.focus({preventScroll:true});focusBeforeDialog=null;});
  function openDialog(title){clearPreview();const alreadyOpen=dialog.open;if(!alreadyOpen)focusBeforeDialog=shell.getRootNode().activeElement||document.activeElement;dialogContent.replaceChildren();const head=el('div','om-dialog-head'),h=el('h2','',title);h.id='om-dialog-title';head.append(h,button('閉じる',closeDialog,'om-outline'));dialogContent.append(head);if(alreadyOpen)head.querySelector('button').focus();else dialog.showModal();return dialogContent;}
  const listIdentity=()=>{const value=session.getSnapshot();return value?.status==='bound'?{roomId:value.roomId,personId:value.personId}:null;};
  const sameScope=(a,b)=>a===null&&b===null||a&&b&&a.roomId===b.roomId&&a.personId===b.personId;
  function announce(event){if(disposed)return;const node=$('.om-list-notice');node.hidden=false;node.textContent=event.kind==='invite'?'新しいグループ招待があります。':'新着メッセージがあります。';}
  const notifications=summaryOwner??createMessagingNotificationAdapter({notify:announce});
  function syncListIdentity(){const current=listIdentity();if(sameScope(current,listScope))return false;listScope=current;listGeneration++;resetOriginal();conversations=[];invites=[];inviteArea.replaceChildren();inviteArea.hidden=true;fileInput.value='';expandTools(false);expandHistory(false);if(!summaryOwner)notifications.bind(current);$('.om-unread-total').textContent='';$('.om-list-notice').hidden=true;$('.om-list-notice').textContent='';closeDialog();shared.hidden=true;shell.dataset.shared='false';shell.dataset.mobileView='list';renderList();return true;}
  const filterNames=[['all','すべて'],['unread','未読'],['favorite','お気に入り'],['archived','アーカイブ']];
  function renderList(){
    const needle=$('#om-list-search').value.trim().toLocaleLowerCase();
    $('.om-filters').replaceChildren(...filterNames.map(([v,name])=>{const b=button(name,()=>{filter=v;renderList();});b.setAttribute('aria-pressed',String(filter===v));return b;}));
    const visible=conversations.filter(c=>(filter==='archived'?c.archived:!c.archived)&&(filter!=='unread'||c.unread>0)&&(filter!=='favorite'||c.favorite)&&(!needle||c.title.toLocaleLowerCase().includes(needle)||c.participantIds?.some(id=>resolvePerson(id)?.toLocaleLowerCase().includes(needle))));
    const groups=[['self','自分宛て'],['direct','個人'],['group','グループ']];list.replaceChildren();
    if(!visible.length){list.append(el('p','om-empty-small','一致する会話がありません。'));return;}
    for(const [kind,title] of groups){const rows=visible.filter(c=>c.kind===kind).sort((a,b)=>Number(Boolean(b.pinned))-Number(Boolean(a.pinned))||(b.updatedAt||0)-(a.updatedAt||0));if(!rows.length)continue;list.append(el('h3','om-group-label',title));for(const c of rows){const b=button('',()=>void openConversation(c.id),'om-conversation');b.setAttribute('aria-label',c.title);b.setAttribute('aria-current',String(c.id===state.conversationId));const avatar=el('span','om-avatar',Array.from(c.title).slice(0,2).join(''));avatar.setAttribute('aria-hidden','true');const info=el('span','om-conv-copy');info.append(el('strong','',c.title),el('span','om-conv-preview',c.preview||'会話を開始する'));b.append(avatar,info);const meta=el('span','om-conv-meta');if(c.pinned)meta.append(el('span','om-list-state','固定'));if(c.muted)meta.append(el('span','om-list-state','ミュート'));if(c.preferencesUnavailable)meta.append(el('span','om-list-state','会話設定を未取得'));if(c.updatedAt)meta.append(el('span','',timeText(c.updatedAt)));if(c.unread>0)meta.append(el('span','om-unread',c.unread>99?'99+':String(c.unread)));b.append(meta);list.append(b);}}
  }
  function renderInvites(){
    inviteArea.replaceChildren();inviteArea.hidden=!invites.length||typeof commands.respondInvite!=='function';if(inviteArea.hidden)return;
    inviteArea.append(el('h3','om-group-label','グループ招待'));
    const scope=listScope;
    for(const invite of invites){
      const row=el('div','om-invite-row'),copy=el('div','om-invite-copy'),actions=el('div','om-invite-actions'),status=el('small','om-feedback');status.setAttribute('role','status');
      copy.append(el('strong','',invite.title),el('small','',(resolvePerson(invite.invitedBy)||'利用者')+' からの招待'));
      let pending=false;
      async function respond(accept){if(pending||disposed||!sameScope(scope,listIdentity())||!row.isConnected)return;pending=true;yes.disabled=no.disabled=true;
        try{const result=await commands.respondInvite(invite.conversationId,accept);if(disposed||!sameScope(scope,listIdentity())||!row.isConnected)return;if(result?.status!=='ok'){status.textContent='招待を更新できません。再取得してください。';yes.disabled=no.disabled=false;}else void reloadList();}catch(_){if(row.isConnected&&sameScope(scope,listIdentity())){status.textContent='通信に失敗しました。';yes.disabled=no.disabled=false;}}finally{pending=false;}}
      const yes=button('承諾',()=>void respond(true),'om-primary'),no=button('辞退',()=>void respond(false),'om-outline');actions.append(yes,no);row.append(copy,actions,status);inviteArea.append(row);
    }
  }
  async function reloadList(options){syncListIdentity();const scope=listScope;if(!scope||disposed)return;const token=++listGeneration;try{const result=await commands.list(options);if(disposed||token!==listGeneration||!sameScope(scope,listIdentity()))return;if(!Array.isArray(result?.conversations)||result.conversations.some(c=>typeof c?.title!=='string'))throw Error('Unavailable');const known=result.conversations.filter(row=>Number.isSafeInteger(row.unread));const summary=notifications.sync({...result,conversations:known,complete:result.complete===true&&known.length===result.conversations.length},{activeConversationId:state.conversationId,foreground:state.status==='ready'&&document.visibilityState==='visible'&&timeline.clientHeight>0&&!query});if(summary.status!=='ok')throw Error('Unavailable');conversations=result.conversations;invites=Array.isArray(result.invites)?result.invites:[];const badge=$('.om-unread-total');badge.textContent=(!summary.complete&&!known.length?'未読件数は未取得':(summary.complete?'未読 ':'取得済みの未読 ')+summary.unreadLabel+(summary.unread<100?'件':''))+(summary.invites?' / 招待 '+summary.invites+'件':'');if(result.directoryComplete!==undefined&&!summary.complete)badge.textContent+='（一部の未読件数は取得中または取得できません）';renderInvites();renderList();renderHeader();void showPendingShare();}catch(_){if(token===listGeneration){summaryOwner?.unavailable();conversations=[];invites=[];renderInvites();$('.om-unread-total').textContent='未読件数を取得できません';$('.om-list-notice').hidden=true;list.replaceChildren(el('p','om-empty-small','会話を取得できません。再読み込みしてください。'));}}}
  function clearHistoryQuery(){query='';search.value='';for(const field of historyDates.fields)field.value='';filters.open=false;}
  async function openConversation(id){closeDialog();clearHistoryQuery();expandHistory(false);expandTools(false);shell.dataset.mobileView='chat';shared.hidden=true;shell.dataset.shared='false';notice('');await store.setActiveConversation(id);if(typeof commands.respondInvite==='function'&&!disposed)void reloadList();}
  async function showPendingShare(){
    const ref=pendingShare,scope=listScope;
    if(!ref||!scope||disposed)return;
    pendingShare=null;
    if(ref.roomId!==scope.roomId||await canShareRecord(ref,scope)!==true||disposed||!sameScope(listIdentity(),scope))return;
    const panel=openDialog('共有先の会話');
    const rows=conversations.filter(row=>row.status==='active');
    if(!rows.length)panel.append(el('p','','共有できる会話がありません。'));
    for(const row of rows){
      panel.append(button(row.title,async()=>{
        if(!dialog.open||!sameScope(listIdentity(),scope))return;
        await openConversation(row.id);
        const c=context(),draft=compose();
        if(!c||c.conversationId!==row.id||!draft)return;
        const validated=await resolver.shareRecord(ref,c);
        if(!validated||!messageContextValid(c)||compose()!==draft){notice('業務データを参照できません。');return;}
        if(draft.refs.some(item=>key(item)===key(validated)))return;
        if(draft.refs.length>=20){notice('業務データは20件まで添付できます。');return;}
        draft.refs=[...draft.refs,validated];renderComposeContext();body.focus();
      },'om-outline'));
    }
  }
  function share(ref){
    if(disposed||typeof canShareRecord!=='function')return false;
    pendingShare=ref;
    if(listScope)void reloadList();
    return true;
  }
  function renderHeader(){const c=selected();$('.om-chat-title h2').textContent=c?.title||'会話を選択';$('.om-chat-title p').textContent=c?.kind==='group'?(c.memberCount||0)+'人のグループ':c?.kind==='self'?'自分だけのメッセージ':c?'個人メッセージ':'';$('[data-om=shared]').disabled=!c;searchToggle.disabled=!c;historyBar.hidden=!c;const settings=$('[data-om=settings]');settings.hidden=!personal;settings.disabled=!c||state.status!=='ready';composer.hidden=!context()||archivedGroup();}
  function refButton(ref,c,location){const b=button(labels[ref.type]||'業務データ',()=>void resolver.open(ref,c,{...location,scrollTop:timeline.scrollTop,query}),'om-reference');b.disabled=true;const stamp=renderGeneration;void resolver.resolve(ref,c).then(result=>{if(!b.isConnected||stamp!==renderGeneration||!messageContextValid(c))return;if(result.status==='available'){b.replaceChildren(el('span','om-reference-type',labels[ref.type]),el('strong','',result.title),el('small','',result.currentState||''));b.disabled=false;}else b.textContent='参照できない業務データ';});return b;}
  function renderComposeContext(){
    const c=context(),node=$('.om-compose-context');node.replaceChildren();
    if(!c)return;
    const draft=compose();
    for(const action of composer.querySelectorAll('button,input,textarea'))action.disabled=!draft||sendPending;
    if(!draft){notice('下書きの保持上限に達しました。別の下書きを送信または削除してください。');return;}
    if(draft.attempt?.payload){
      const retry=button('前回の送信を確認・再試行',()=>void submit(true),'om-outline');
      retry.disabled=sendPending;
      node.append(retry);
    }
    discard.hidden=!Boolean(state.draft||draft.replyTo||draft.refs.length||draft.files.length||draft.editing||draft.confirmationRequested);
    if(draft.replyTo){const tag=el('div','om-draft-ref');tag.append(el('span','','返信を作成中'),button('解除',()=>{draft.replyTo=null;renderComposeContext();}));node.append(tag);}if(draft.editing){const tag=el('div','om-draft-ref');tag.append(el('span','','メッセージを編集中'),button('取消',()=>{draft.editing=null;draft.attachmentIds=[];store.setDraft('');renderComposeContext();}));node.append(tag);}
    fileButton.disabled=sendPending||Boolean(draft.editing);if(fileEnabled){for(const [i,item] of draft.files.entries()){const tag=el('div','om-draft-ref');const remove=button('解除',()=>{if(sendPending)return;draft.files.splice(i,1);draft.fileVersion++;renderComposeContext();});remove.disabled=sendPending;tag.append(el('span','',item.filename),remove);node.append(tag);}}if(draft.editing&&draft.attachmentIds.length)node.append(el('div','om-draft-ref','添付ファイル '+draft.attachmentIds.length+'件を維持'));
    for(const ref of draft.refs){const tag=el('div','om-draft-ref');const name=el('span','',labels[ref.type]);tag.append(name,button('解除',()=>{draft.refs=draft.refs.filter(r=>key(r)!==key(ref));renderComposeContext();}));node.append(tag);void resolver.resolve(ref,c).then(value=>{if(tag.isConnected&&messageContextValid(c)&&value.status==='available')name.textContent=value.title;});}const confirm=$('[data-om=confirm]');confirm.disabled=!confirmations||selected()?.kind==='self';if(confirm.disabled)draft.confirmationRequested=false;confirm.checked=draft.confirmationRequested;sendButton.textContent=draft.editing?'更新':'送信';}
  function renderConfirmation(m,c,content){
    const row=el('div','om-confirm-action');row.append(el('span','om-confirm-request','確認依頼'));content.append(row);
    if(!confirmations||!m.confirmation)return;
    const scope={roomId:c.roomId,conversationId:c.conversationId,messageId:m.id,round:m.confirmation.round,personId:c.personId};
    const current=()=>messageContextValid(c)&&state.messages.some(x=>x.id===m.id&&x.revision===m.revision&&x.deletedAt==null);
    if(m.senderId===c.personId){row.append(button('確認状況',async()=>{
      const panel=openDialog('確認状況'),progress=el('div','om-confirm-progress');panel.append(progress);progress.append(el('p','om-empty-small','読み込み中…'));
      try{
        const [response,members]=await Promise.all([confirmations.readReceipts(scope),confirmations.readMembers(scope)]);
        if(!dialog.open||!progress.isConnected||!current())return;
        if(response?.status!=='ok'||members?.status!=='ok')throw Error('Unavailable');
        const rows=summarizeMessageConfirmation(m,members.members,response.receipts);
        progress.replaceChildren(...rows.map(r=>{const item=el('div','om-confirm-person');item.append(el('strong','',resolvePerson(r.personId)||'利用者'),el('span','',r.status==='left'?'退会':r.status==='confirmed'?'確認済み':'未確認'));if(r.confirmedAt!==null)item.append(el('time','',dateText(r.confirmedAt)+' '+timeText(r.confirmedAt)));return item;}));
      }catch(_){if(dialog.open&&progress.isConnected&&current())progress.replaceChildren(el('p','om-empty-small','確認状況を取得できません。閉じて再度お試しください。'));}
    },'om-outline'));return;}
    if(m.confirmation.targets[c.personId]!==c.joinedAt)return;
    const status=el('span','om-confirmed');status.setAttribute('role','status');
    const action=button('確認しました',async()=>{
      if(!current()||!row.isConnected)return;action.disabled=true;
      try{const response=await confirmations.confirm(scope);if(!current()||!row.isConnected)return;if(response?.status!=='ok'||!Number.isSafeInteger(response.confirmedAt))throw Error('Unavailable');showReceipt(response.confirmedAt);}
      catch(_){if(current()&&row.isConnected){status.textContent='確認を保存できません。再試行してください。';action.disabled=false;}}
    },'om-outline');action.disabled=true;row.append(action,status);
    function showReceipt(stamp){action.hidden=true;status.textContent='確認済み '+dateText(stamp)+' '+timeText(stamp);}
    async function load(){
      try{const result=await confirmations.readOwnConfirmation(scope);if(!current()||!row.isConnected)return;if(result?.status!=='ok')throw Error('Unavailable');if(result.confirmedAt!==null){if(!Number.isSafeInteger(result.confirmedAt))throw Error('Invalid');showReceipt(result.confirmedAt);}else action.disabled=false;}
      catch(_){if(current()&&row.isConnected){status.textContent='確認状態を取得できません。';action.disabled=true;const retry=button('再試行',()=>{retry.remove();status.textContent='';void load();},'om-outline');row.append(retry);}}
    }
    void load();
  }
  const preferenceLabels=[['favorite','お気に入り','お気に入りの会話一覧に表示'],['muted','通知をミュート','新着通知の対象から除外する設定'],['pinned','会話を固定','会話の種類ごとの先頭に表示'],['archived','アーカイブ','通常の一覧から移動']];
  function conversationSettings(){
    const c=context();if(!personal||!c||state.status!=='ready')return;
    const panel=openDialog('会話設定'),content=el('div','om-settings-content'),status=el('p','om-feedback','読み込み中…');status.setAttribute('role','status');panel.append(content,status);
    const current=()=>dialog.open&&content.isConnected&&state.status==='ready'&&messageContextValid(c);
    async function load(){
      try{
        const result=await personal.readPersonalState(c);if(!current())return;
        if(result?.status!=='ok'||!result.preferences||preferenceLabels.some(([key])=>typeof result.preferences[key]!=='boolean'))throw Error('Unavailable');
        const prefs={...result.preferences};status.textContent='';content.replaceChildren();
        if(selected()?.kind==='group'&&readGroup&&commands.manageGroup)content.append(button('グループ管理',groupSettings,'om-outline'));
        const controls=[];
        for(const [key,name,description] of preferenceLabels){
          const label=el('label','om-setting-row'),text=el('span','om-setting-copy'),input=el('input');input.type='checkbox';input.checked=prefs[key];input.setAttribute('aria-label',name);controls.push(input);text.append(el('strong','',name),el('small','',description));label.append(text,input);content.append(label);
          input.addEventListener('change',async()=>{
            if(!current())return;const desired=input.checked;controls.forEach(x=>x.disabled=true);status.textContent='保存しています…';
            try{const saved=await personal.setPersonalState({...c,patch:{[key]:desired}});if(saved?.status!=='ok')throw Error('Unavailable');prefs[key]=desired;if(!disposed)void reloadList();if(current())status.textContent='保存しました。';}
            catch(_){if(current()){input.checked=prefs[key];status.textContent='保存できませんでした。再試行してください。';}}
            finally{if(current())controls.forEach(x=>x.disabled=false);}
          });
        }
      }catch(_){if(current()){status.textContent='設定を取得できません。';content.replaceChildren(button('再試行',()=>{content.replaceChildren();status.textContent='読み込み中…';void load();},'om-outline'));}}
    }
    void load();
  }
  function groupSettings(){
    const c=context();if(!c)return;
    const panel=openDialog('グループ管理'),content=el('div','om-settings-content'),status=el('p','om-feedback','読み込み中…');
    status.setAttribute('role','status');panel.append(content,status);
    const current=()=>dialog.open&&content.isConnected&&messageContextValid(c);
    async function load(){
      try{
        const group=await readGroup(c);if(!current())return;
        if(group.status!=='ok')throw Error('Group unavailable');
        const roster=group.archived||group.role==='member'?[]:await commands.users();
        if(!current())return;
        status.textContent='';content.replaceChildren();
        content.append(el('h3','','参加者'));
        const roleLabels={owner:'所有者',admin:'管理者',member:'参加者'},names=el('ul');
        for(const row of group.members)names.append(el('li','',(resolvePerson(row.id)||'利用者')+'（'+roleLabels[row.role]+'）'));
        content.append(names);
        if(group.invitations.length)content.append(el('p','','招待中 '+group.invitations.length+'人'));
        let pending=false;
        async function save(change){
          if(!current()||pending)return;
          pending=true;status.textContent='保存しています…';
          try{
            const result=await commands.manageGroup(c.conversationId,{...change,expectedRevision:group.revision});
            if(!current())return;
            if(result.status==='ok'){
              if(change.type==='leave'){closeDialog();await store.setActiveConversation(null);shell.dataset.mobileView='list';return;}
              await load();
            }else if(result.status==='conflict'){
              await load();if(current())status.textContent='ほかの端末で更新されました。内容を確認してください。';
            }else status.textContent='グループ設定を保存できません。';
          }finally{pending=false;}
        }
        function picker(label,people,onSelect){
          const select=el('select');select.setAttribute('aria-label',label+'の対象');
          for(const person of people){const option=el('option','',person.displayName);option.value=person.personId;select.append(option);}
          const row=el('div','om-group-operation');row.append(select,button(label,()=>{if(select.value)onSelect(select.value);},'om-outline'));content.append(row);
        }
        if(group.role!=='member'){
          if(!group.archived){
            const title=el('input');title.type='text';title.maxLength=80;title.value=group.title;title.setAttribute('aria-label','グループ名');
            const rename=el('div','om-group-operation');rename.append(title,button('名前を変更',()=>void save({type:'rename',title:title.value}),'om-outline'));content.append(rename);
            const invites=roster.filter(person=>!group.members.some(member=>member.id===person.personId)&&!group.invitations.includes(person.personId));
            if(invites.length)picker('招待',invites,personId=>void save({type:'invite',personIds:[personId]}));
            const others=group.members.filter(member=>member.id!==c.personId&&member.role!=='owner').map(member=>({personId:member.id,displayName:resolvePerson(member.id)||'利用者',role:member.role}));
            const removable=others.filter(member=>group.role==='owner'||member.role!=='admin');
            if(removable.length)picker('グループから除外',removable,personId=>{if(window.confirm('選んだ参加者をグループから除外しますか？'))void save({type:'removeMember',personId});});
            if(group.role==='owner'&&others.length)picker('所有者を移譲',others,personId=>{if(window.confirm('選んだ参加者に所有者を移譲しますか？'))void save({type:'transferOwner',personId});});
          }
          content.append(button(group.archived?'会話を再開':'グループをアーカイブ',()=>void save({type:'setArchived',archived:!group.archived}),'om-outline'));
        }
        if(group.role!=='owner')content.append(button('グループから退出',()=>{if(window.confirm('退出するとこの会話を閲覧できなくなります。退出しますか？'))void save({type:'leave'});},'om-outline'));
      }catch(_){if(current())status.textContent='グループ情報を取得できません。';}
    }
    void load();
  }
  const reactionLabels={like:'いいね',thanks:'ありがとう',agree:'賛成',checking:'確認中',question:'質問'};
  function messageQuickActions(m,c,style,onEdit=()=>{}){
    const choices=[button('返信',()=>{
      const draft=compose();if(!draft||!messageContextValid(c))return;
      onEdit();draft.replyTo=m.id;draft.editing=null;draft.attachmentIds=[];
      renderComposeContext();body.focus();
    },style)];
    if(m.senderId===c.personId&&!archivedGroup()){
      choices.push(button('編集',()=>{
        const draft=compose();if(!draft||!messageContextValid(c))return;
        onEdit();draft.editing={messageId:m.id,expectedRevision:m.revision};
        draft.attachmentIds=[...(m.attachmentIds??[])];draft.files=[];draft.fileVersion++;
        draft.refs=[...(m.refs??[])];draft.replyTo=m.replyTo;draft.confirmationRequested=Boolean(m.confirmationRequested);
        store.setDraft(m.body);renderComposeContext();body.focus();
      },style),button('削除',()=>{
        if(!messageContextValid(c))return;
        const panel=openDialog('メッセージを削除');
        panel.append(el('p','','削除すると本文と参照は表示されなくなります。'),
          button('削除する',async()=>{
            const result=await store.remove({conversationId:c.conversationId,messageId:m.id,expectedRevision:m.revision});
            if(result.status==='ok')closeDialog();else notice('削除できませんでした。再読み込みしてください。');
          },'om-danger'));
      },style));
    }
    return choices;
  }
  function messageActions(m,c){
    const panel=openDialog('メッセージの操作'),content=el('div','om-message-options');panel.append(el('p','om-option-excerpt',Array.from(m.body||'業務データを共有').slice(0,120).join('')),content);
    const scope={...c,messageId:m.id};
    const current=()=>dialog.open&&content.isConnected&&state.status==='ready'&&messageContextValid(c)&&state.messages.some(x=>x.id===m.id&&x.revision===m.revision&&x.deletedAt==null);
    function section(title){const node=el('section','om-option-section'),status=el('p','om-feedback');status.setAttribute('role','status');node.append(el('h3','',title));content.append(node);return {node,status};}
    const quick=el('div','om-mobile-only om-mobile-message-actions');
    quick.append(...messageQuickActions(m,c,'om-outline',()=>{focusBeforeDialog=null;closeDialog();}));
    content.append(quick);
    if(resolver.openDraft&&m.body?.trim()){
      const {node,status}=section('業務を作成');
      for(const [kind,label] of [['task','タスクを作成'],['schedule','予定を作成']]){
        const action=button(label,async()=>{
          if(!current())return;
          action.disabled=true;
          const location={conversationId:c.conversationId,messageId:m.id,scrollTop:timeline.scrollTop,query,dates:historyDates.fields.map(field=>field.value)};
          if(await resolver.openDraft(kind,m.revision,c,location)){closeDialog();return;}
          if(current()){action.disabled=false;status.textContent='元のメッセージを確認できません。';}
        },'om-outline');
        node.append(action);
      }
    }
    function actionSection(title,read,write,field,labels,canWrite=true){
      const {node,status}=section(title),holder=el('div','om-option-controls');node.append(holder,status);
      async function load(){
        if(!current())return;holder.replaceChildren();status.textContent='読み込み中…';
        try{const response=await read(scope);if(!current())return;if(response?.status!=='ok'||typeof response[field]!=='boolean')throw Error('Unavailable');const value=response[field];status.textContent='';
          if(!canWrite){holder.append(el('span','',value?'固定済み':'固定されていません'));status.textContent='共有固定は管理者が変更できます。';return;}
          const action=button(labels[Number(value)],async()=>{if(!current())return;action.disabled=true;status.textContent='保存しています…';try{const saved=await write({...scope,[field]:!value});if(!current())return;if(saved?.status!=='ok')throw Error('Unavailable');await load();}catch(_){if(current()){status.textContent='保存できませんでした。再試行してください。';action.disabled=false;}}},'om-outline');action.setAttribute('aria-pressed',String(value));holder.append(action);
        }catch(_){if(current()){status.textContent='状態を取得できません。';holder.append(button('再試行',()=>void load(),'om-outline'));}}
      }
      void load();
    }
    if(decorations){
      const {node,status}=section('リアクション'),holder=el('div','om-reaction-options');node.append(holder,status);
      async function load(){
        if(!current())return;holder.replaceChildren();status.textContent='読み込み中…';
        try{const response=await decorations.readReactions(scope);if(!current())return;if(response?.status!=='ok'||!response.reactions)throw Error('Unavailable');const reactions=response.reactions;status.textContent='';
          for(const type of messagingReactionTypes){const active=reactions[c.personId]===type,count=Object.values(reactions).filter(v=>v===type).length;
            const choice=button(reactionLabels[type]+(count?' '+count:''),async()=>{if(!current())return;const controls=[...holder.querySelectorAll('button')];controls.forEach(x=>x.disabled=true);status.textContent='保存しています…';try{const saved=await decorations.setReaction({...scope,reaction:active?null:type});if(!current())return;if(saved?.status!=='ok')throw Error('Unavailable');await load();}catch(_){if(current()){status.textContent='保存できませんでした。再試行してください。';controls.forEach(x=>x.disabled=false);}}},'om-outline');choice.setAttribute('aria-label',reactionLabels[type]);choice.setAttribute('aria-pressed',String(active));holder.append(choice);}
        }catch(_){if(current()){status.textContent='リアクションを取得できません。';holder.append(button('再試行',()=>void load(),'om-outline'));}}
      }
      void load();
    }
    if(personal)actionSection('自分だけの保存',scope=>personal.readBookmark(scope),scope=>personal.setBookmark(scope),'bookmarked',['ブックマークに追加','ブックマークを解除']);
    if(decorations&&selected()?.kind==='group')actionSection('グループで共有',scope=>decorations.readSharedPin(scope),scope=>decorations.setSharedPin(scope),'pinned',['会話に固定','固定を解除'],['owner','admin'].includes(selected()?.role));
  }
  function attachmentButton(label,messageId,attachmentId,c){
    const download=button(label,async()=>{
      if(!fileEnabled||!messageContextValid(c))return;
      download.disabled=true;
      try{
        const result=await attachments.downloadAttachment({roomId:c.roomId,conversationId:c.conversationId,messageId,attachmentId});
        if(!attachmentStillVisible(c,messageId,attachmentId))return;
        if(result?.status!=='ok'||!(result.bytes instanceof Uint8Array)){
          notice(result?.status==='limit'?'ダウンロード上限に達しました。時間をおいて再試行してください。':'添付ファイルを取得できません。');return;
        }
        const url=URL.createObjectURL(new Blob([result.bytes],{type:'application/octet-stream'})),anchor=el('a');
        anchor.href=url;anchor.download=result.filename;document.body.append(anchor);
        try{anchor.click();}finally{anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
      }catch(_){if(messageContextValid(c))notice('添付ファイルを取得できません。');}
      finally{if(download.isConnected)download.disabled=!fileEnabled;}
    },'om-outline');
    download.disabled=!fileEnabled;return download;
  }
  function renderMessage(m,c){const own=m.senderId===c.personId,article=el('article','om-message'+(own?' om-own':''));article.dataset.messageId=m.id;
    const header=el('div','om-message-meta');header.append(el('strong','',resolvePerson(m.senderId)||'利用者'),el('time','',timeText(m.createdAt)));if(m.editedAt)header.append(el('span','','編集済み'));article.append(header);
    const content=el('div','om-message-body');if(m.deletedAt!=null){content.append(el('p','om-deleted','メッセージは削除されました'));article.append(content);return article;}
    if(m.replyTo){const quote=el('div','om-quote','返信');content.append(quote);void resolver.resolveQuote(m.replyTo,c).then(r=>{if(quote.isConnected&&messageContextValid(c))quote.textContent=r.status==='available'?r.excerpt:'元のメッセージを参照できません';});}
    if(m.body)content.append(el('p','om-message-text',m.body));for(const ref of m.refs??[])content.append(refButton(ref,c,{conversationId:c.conversationId,messageId:m.id,scrollTop:timeline.scrollTop,query}));
    for(const [i,attachmentId] of (m.attachmentIds??[]).entries())content.append(attachmentButton('添付ファイル '+(i+1)+' をダウンロード',m.id,attachmentId,c));
    if(m.confirmationRequested)renderConfirmation(m,c,content);article.append(content);
    const actions=el('div','om-message-actions');
    actions.append(...messageQuickActions(m,c,'om-message-quick'));
    const more=button('その他',()=>messageActions(m,c),'om-message-more');
    more.setAttribute('aria-label','その他');
    const mark=el('span','om-mobile-only','⋯');mark.setAttribute('aria-hidden','true');
    more.replaceChildren(el('span','om-more-label','その他'),mark);
    if(!personal&&!decorations&&!resolver.openDraft)more.classList.add('om-mobile-only');
    actions.append(more);article.append(actions);return article;
  }
  async function renderTimeline({older=false}={}){
    const generation=++renderGeneration,c=context(),beforeHeight=timeline.scrollHeight,beforeTop=timeline.scrollTop,nearBottom=beforeHeight-beforeTop-timeline.clientHeight<90;
    if(!c){timeline.replaceChildren(el('div','om-empty',state.status==='loading'?'会話を読み込み中…':state.status==='forbidden'||state.status==='locked'?'この会話は利用できません。':'会話を選ぶか、新規メッセージを作成してください。'));return;}
    const dates=historyDates.read(),searching=Boolean(query||dates.from!==null||dates.to!==null);
    const matches=searching?(await searchLoadedMessages(state.messages,{query,context:c,resolver,resolvePerson,...dates})).matches.slice().reverse():state.messages;
    if(disposed||generation!==renderGeneration||!messageContextValid(c))return;timeline.replaceChildren();
    searchCoverage.textContent=searching?'取得済み '+state.messages.length+'件から表示 '+matches.length+'件。'+(state.hasMore?'以前の履歴を追加できます。':'取得可能な履歴の先頭です。')+(state.hasNewer?'表示中の範囲より新しいメッセージは未取得のため、検索対象外です。':''):'';
    if(state.hasMore)timeline.append(button(searching?'以前の履歴を追加して検索':'以前のメッセージを表示',async()=>{await store.loadOlder();},'om-load-more'));
    if(!matches.length)timeline.append(el('div','om-empty',searching?'読み込んだ履歴に一致するメッセージがありません。':'まだメッセージがありません。最初のメッセージを送信しましょう。'));
    let lastDay='';for(const m of matches){const day=dateText(m.createdAt);if(day!==lastDay){timeline.append(el('div','om-date',day));lastDay=day;}timeline.append(renderMessage(m,c));}
    // An older window shown after a jump: the unloaded span up to the latest
    // message is explicit, and is filled only when the person asks.
    if(state.hasNewer){
      const gap=el('div','om-gap');gap.setAttribute('role','note');
      gap.append(el('p','','ここから最新までのメッセージは未取得です。'),button('新しいメッセージを読み込む',async()=>{await store.loadNewer();},'om-outline'),button('最新に戻る',async()=>{await store.refreshLatest();timeline.scrollTop=timeline.scrollHeight;},'om-outline'));
      timeline.append(gap);
    }
    if(older)timeline.scrollTop=beforeTop+timeline.scrollHeight-beforeHeight;else if(state.hasNewer)timeline.scrollTop=beforeTop;else if(nearBottom||lastId!==state.conversationId)timeline.scrollTop=timeline.scrollHeight;else{timeline.scrollTop=beforeTop;$('.om-newer').hidden=false;}
    scheduleVisibleRead();
  }
  // Capacity is fetched on demand (shared panel open / attach click) and cached for 60s.
  const usageNode=el('p','om-usage');usageNode.hidden=true;usageNode.setAttribute('role','status');$('.om-shared-list').before(usageNode);
  // Keyed by room, person, conversation and join epoch so a rejoin or revocation never reuses old totals.
  let usage=null;const usageKey=c=>[c.roomId,c.personId,c.conversationId,c.joinedAt].join('|');
  const mb=v=>(v/1e6).toFixed(v>=1e8?0:1)+'MB';
  const usageLevel=u=>u.globalBytes>=u.cleanupBytes?'cleanup':u.globalBytes>=u.warnBytes?'warn':'ok';
  function renderUsage(){
    const c=context(),u=usage&&c&&state.status==='ready'&&usage.id===usageKey(c)?usage.value:null;if(!u)usage=null;
    usageNode.hidden=!u;if(!u)return;
    const level=usageLevel(u);usageNode.dataset.level=level;
    usageNode.textContent='保存容量 全体 '+mb(u.globalBytes)+'/'+mb(u.limitBytes)+'（本人 '+mb(u.personBytes)+'・この会話 '+mb(u.conversationBytes)+'・本日 '+mb(u.dailyBytes)+'/'+mb(u.dailyLimitBytes)+'）'+(level==='cleanup'?'。整理が必要です。不要な添付の削除を検討してください。':level==='warn'?'。残りが少なくなっています。':'');
  }
  async function refreshUsage(){
    const c=context();if(!c||typeof attachments?.readAttachmentUsage!=='function')return null;
    if(!(usage&&usage.id===usageKey(c)&&Date.now()-usage.at<60000)){
      const result=await attachments.readAttachmentUsage({roomId:c.roomId,conversationId:c.conversationId});
      if(!messageContextValid(c))return null;
      usage=result.status==='ok'?{id:usageKey(c),at:Date.now(),value:result}:null;
    }
    renderUsage();return usage?.value??null;
  }
  async function warnAboutCapacity(){
    const u=await refreshUsage().catch(()=>null);if(!u||sendPending)return;
    if(u.dailyBytes>=u.dailyLimitBytes)notice('本日のアップロード上限（'+mb(u.dailyLimitBytes)+'）に達しています。');
    else if(usageLevel(u)==='cleanup')notice('保存容量の整理が必要です。新しい添付は上限に達すると保存できません。');
    else if(usageLevel(u)==='warn')notice('保存容量が少なくなっています。不要な添付の整理をご検討ください。');
  }
  async function renderShared(){
    void refreshUsage().catch(()=>{});
    const c=context(),generation=++sharedGeneration,node=$('.om-shared-list');
    node.replaceChildren(el('p','om-empty-small','読み込み中…'));
    if(!c)return;
    const current=()=>!disposed&&!shared.hidden&&generation===sharedGeneration&&messageContextValid(c);
    const type=sharedFilter.value||null,dates=sharedDates.read();
    sharedCoverage.textContent='取得済み履歴が対象です。共有項目は1ページ最大50件です。';
    try{
      const readAttachmentMetadata=typeof attachments?.readAttachmentMetadata==='function'
        ?items=>attachments.readAttachmentMetadata({...c,items}):null;
      const {rows,attachments:page}=await selectSharedData(state.messages,{context:c,resolver,type,...dates,readAttachmentMetadata,attachmentOffset:sharedAttachmentOffset});
      if(!current())return;
      node.replaceChildren();
      sharedAttachmentOffset=page.offset;
      if(page.total){
        sharedCoverage.textContent+=' 添付候補 '+(page.offset+1)+'〜'+(page.offset+page.checked)+' / '+page.total+'件を確認しました。';
        const pages=el('div','om-shared-pages');
        const openPage=offset=>{sharedAttachmentOffset=offset;void renderShared();};
        if(page.offset>0)pages.append(button('前の添付候補',()=>openPage(page.offset-1),'om-outline'));
        if(page.offset+page.checked<page.total)pages.append(button('次の添付候補',()=>openPage(page.offset+page.checked),'om-outline'));
        if(pages.childElementCount)node.append(pages);
      }
      if(state.hasMore)node.append(button('以前の履歴を追加',async()=>{await store.loadOlder();},'om-load-more'));
      if(!rows.length)node.append(el('p','om-empty-small','このページに一致する共有データはありません。'));
      for(const row of rows){
        const b=button(row.title||row.url,async()=>{
          if(!current())return;
          if(query||historyDates.fields.some(field=>field.value)){
            clearHistoryQuery();expandHistory(false);
            await renderTimeline();
          }
          if(!current())return;
          const message=timeline.querySelector('[data-message-id="'+row.messageId+'"]');
          if(message){shared.hidden=true;shell.dataset.shared='false';message.scrollIntoView({block:'center'});message.classList.add('om-highlight');message.tabIndex=-1;message.focus({preventScroll:true});}
        },'om-shared-row');
        b.prepend(el('small','',labels[row.type]));
        b.setAttribute('aria-label',row.title||row.url);
        node.append(b);
        if(row.type==='image')node.append(button(row.title+' を表示',()=>void previewImage(row,c),'om-outline'));
        if(row.attachmentId)node.append(attachmentButton(row.title+' をダウンロード',row.messageId,row.attachmentId,c));
      }
    }catch(_){if(current())node.replaceChildren(el('p','om-empty-small','共有データを取得できません。もう一度開いてください。'));}
  }
  let readFrame=0;
  function scheduleVisibleRead(){cancelAnimationFrame(readFrame);readFrame=requestAnimationFrame(()=>{const c=context();if(!c||state.status!=='ready'||state.hasNewer||document.visibilityState!=='visible'||timeline.clientHeight===0||query||historyDates.fields.some(field=>field.value))return;const rect=timeline.getBoundingClientRect(),nodes=[...timeline.querySelectorAll('[data-message-id]')];const visible=nodes.filter(n=>{const r=n.getBoundingClientRect();return r.bottom>rect.top&&r.top<rect.bottom;}).at(-1);const m=state.messages.find(x=>x.id===visible?.dataset.messageId);if(m)void store.markRead({conversationId:c.conversationId,cursor:{id:m.id,createdAt:m.createdAt},visible:true});});}
  function renderState(next){const previous=state;state=next;renderUsage();if(previewUrl&&previous.messages!==next.messages)closeDialog();const identityChanged=syncListIdentity();if(previous.conversationId!==state.conversationId||previous.joinedAt!==state.joinedAt&&previous.joinedAt!==null)closeDialog();renderHeader();const ready=state.status==='ready'&&Boolean(context());composer.hidden=!ready||archivedGroup();body.disabled=!ready||sendPending;sendButton.disabled=!ready||sendPending;if(!context()&&(state.status==='locked'||state.status==='forbidden')){closeDialog();dialogContent.replaceChildren();if(state.status==='locked'){conversations=[];listGeneration++;renderList();}shared.hidden=true;shell.dataset.shared='false';}
    if(state.conversationId!==lastId){body.value=state.draft||'';renderList();}else if(body.value!==state.draft)body.value=state.draft;
    if(ready)renderComposeContext();
    if(identityChanged&&listScope)void reloadList();
    if(state.conversationId!==lastId)resetOriginal();
    if(state.messages!==lastMessages||state.conversationId!==lastId||state.status!==previous.status){const older=state.messages.length>previous.messages.length&&previous.messages[0]&&state.messages[0]?.id!==previous.messages[0].id&&state.messages.at(-1)?.id===previous.messages.at(-1)?.id;void renderTimeline({older:Boolean(older)});lastMessages=state.messages;lastId=state.conversationId;if(!shared.hidden)void renderShared();}
  }
  const rejectedNotice='添付できないファイルがあります。対応形式・1件5MB・最大5件を確認してください。';
  // Images are re-encoded once here (EXIF dropped); the stored File objects are reused by every retry.
  async function addFiles(files){
    if(!fileEnabled||!context()||sendPending)return;
    const c=context(),draft=compose();if(!draft||draft.editing)return;
    const picked=selectMessagingFiles(draft.files,files),fresh=picked.files.slice(draft.files.length),version=draft.fileVersion,keep=keepOriginal.checked;resetOriginal();
    if(!fresh.length){notice(picked.rejected?rejectedNotice:'');return;}
    const valid=()=>messageContextValid(c)&&compose()===draft&&draft.fileVersion===version&&!draft.editing;
    const hasImage=!keep&&fresh.some(item=>item.mime.startsWith('image/'));
    let prepared;
    if(hasImage){sendPending=true;renderComposeContext();notice('画像を準備しています…');}
    try{prepared=await prepareMessagingFiles(fresh,{keepOriginalImages:keep,isCurrent:valid});}
    finally{if(hasImage){sendPending=false;renderComposeContext();}}
    if(!valid())return;
    if(prepared.status!=='ok'){notice('画像を準備できませんでした。もう一度お試しいただくか、「原本のまま送る」を選んでください。');return;}
    const next=[...draft.files,...prepared.files];
    if(!store.canRetainFiles(draft,next)){notice('下書き内の添付ファイルは合計25MBまでです。');return;}
    draft.files=next;draft.fileVersion++;renderComposeContext();notice(picked.rejected?rejectedNotice:'');
  }
  fileInput.addEventListener('change',()=>{addFiles(Array.from(fileInput.files||[]));fileInput.value='';});
  composer.addEventListener('dragover',event=>{if(fileEnabled&&!sendPending&&Array.from(event.dataTransfer?.types||[]).includes('Files'))event.preventDefault();});
  composer.addEventListener('drop',event=>{if(!fileEnabled||!event.dataTransfer?.files?.length)return;event.preventDefault();addFiles(Array.from(event.dataTransfer.files));});
  body.addEventListener('paste',event=>{if(!fileEnabled||!event.clipboardData?.files?.length)return;event.preventDefault();addFiles(Array.from(event.clipboardData.files));});
  function clearComposer(draft,{retainAttempt=false}={}){
    Object.assign(draft,{refs:[],replyTo:null,editing:null,confirmationRequested:false,files:[],attachmentIds:[],fileVersion:draft.fileVersion+1,attempt:retainAttempt?draft.attempt:null});
  }
  async function submit(retry=false){
    const c=context(),d=compose();
    if(!c||!d||sendPending||archivedGroup())return;
    const editing=retry?null:d.editing,files=[...d.files];
    let input={body:body.value,replyTo:d.replyTo,refs:d.refs,confirmationRequested:d.confirmationRequested,attachmentIds:editing?[...d.attachmentIds]:[]};
    const fingerprint=JSON.stringify([input,d.fileVersion]);
    let attempt=d.attempt;
    if(retry&&!attempt?.payload)return;
    if(!retry&&attempt?.payload&&attempt.fingerprint!==fingerprint){
      notice('ひとつ前の送信結果を確認してから、新しい下書きを送信してください。');return;
    }
    if(!editing&&(!attempt||!retry&&attempt.fingerprint!==fingerprint)){
      attempt={id:newRequest(),fingerprint,uploaded:[],payload:null};
      d.attempt=attempt;
    }
    const preserveDraft=retry&&attempt.fingerprint!==fingerprint;
    sendPending=true;renderComposeContext();notice(files.length&&!attempt?.payload?'ファイルを保存しています…':'保存しています…');
    try{
      const current=()=>messageContextValid(c)&&compose()===d&&(editing||d.attempt===attempt);
      if(!editing&&attempt.payload)input=attempt.payload;
      else if(!editing&&files.length){
        const saved=await uploadMessagingFiles({files,uploaded:attempt.uploaded,transport:attachments,scope:{roomId:c.roomId,conversationId:c.conversationId,requestId:attempt.id},isCurrent:current});
        if(!current())return;
        if(saved.status!=='ok'){
          notice(saved.status==='storage-limit'||saved.status==='daily-limit'?'添付の保存上限に達しました。':saved.status==='invalid'?'ファイルの内容・形式を確認してください。':'添付を保存できません。再試行してください。');
          return;
        }
        input.attachmentIds=saved.attachmentIds;
      }
      if(!current())return;
      if(!editing&&!attempt.payload){
        try{attempt.payload=validateRoomMessageInput(input,c.roomId);}
        catch(_){notice('本文または添付の内容を確認してください。');return;}
        input=attempt.payload;
      }
      const result=editing?await store.edit({conversationId:c.conversationId,...editing,input}):await store.send({conversationId:c.conversationId,requestId:attempt.id,input,preserveDraft});
      // Sending from an older window returns to the latest messages, where the new one appears.
      if(result?.status==='sent'&&store.getSnapshot().hasNewer)void store.refreshLatest();
      if(!current()){
        if(result.status==='locked'&&state.status==='forbidden')notice('利用権限を確認できません。会話を開き直してください。');
        return;
      }
      if(result.status==='sent'||result.status==='ok'){
        if(preserveDraft)d.attempt=null;
        else{clearComposer(d);if(editing)store.setDraft('');}
        expandTools(false);notice('');
      }else if(result.status==='limit'){
        notice('送信回数の上限に達しました。時間をおいて再試行してください。下書きは保持しています。');
      }else if(result.status==='conflict'||result.status==='invalid'){
        if(!editing)d.attempt=null;
        notice('送信内容または更新の競合を確認してください。');
      }else notice(editing?'保存できませんでした。入力内容は保持されています。':'送信結果を確認できません。入力内容を保持しています。'+(retry?' 解消しない場合は管理者へご連絡ください。':''));
    }finally{sendPending=false;renderComposeContext();}
  }
  async function chooseReferences(){const c=context();if(!c||!compose())return;const snapshot=readBusinessData();if(snapshot?.roomId!==c.roomId)return;const panel=openDialog('業務データを添付'),q=el('input');q.type='search';q.placeholder='件名で検索';q.setAttribute('aria-label','業務データを検索');panel.append(q);const choices=el('div','om-choice-list'),chosen=new Map(compose().refs.map(r=>[key(r),r]));panel.append(choices);const candidates=[['task',snapshot.tasks],['schedule',snapshot.schedules],['memo',snapshot.memos]].flatMap(([type,items])=>(items||[]).map(item=>({roomId:c.roomId,type,recordId:item.id})));const rows=[];for(const ref of candidates){const resolved=await resolver.resolve(ref,c);if(resolved.status==='available')rows.push({title:resolved.title,ref});}if(!dialog.open||!messageContextValid(c)||!choices.isConnected)return;
    function render(){const needle=q.value.trim().toLocaleLowerCase();choices.replaceChildren();for(const {title,ref} of rows.filter(r=>String(r.title).toLocaleLowerCase().includes(needle))){const label=el('label','om-choice');const checkbox=el('input');checkbox.type='checkbox';checkbox.checked=chosen.has(key(ref));checkbox.setAttribute('aria-label',title);checkbox.addEventListener('change',()=>{if(checkbox.checked)chosen.set(key(ref),ref);else chosen.delete(key(ref));});label.append(checkbox,el('span','',title),el('small','',labels[ref.type]));choices.append(label);}}q.addEventListener('input',render);render();const error=el('p','om-feedback');error.setAttribute('role','status');panel.append(error,button('添付する',async()=>{if(!messageContextValid(c))return;if(chosen.size>20){error.textContent='業務データは20件まで添付できます。選択を減らしてください。';return;}const refs=[];for(const ref of chosen.values()){const value=await resolver.shareRecord(ref,c);if(value)refs.push(value);}if(!messageContextValid(c))return;compose().refs=refs;renderComposeContext();closeDialog();},'om-primary'));}
  function reportDialog(){const c=context();if(!c||!compose())return;const panel=openDialog('日次業務報告'),date=el('input');date.type='date';date.value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());date.setAttribute('aria-label','報告日');panel.append(date);const list=el('div','om-choice-list');panel.append(list);const supplement=el('textarea');supplement.rows=2;supplement.setAttribute('aria-label','補足');supplement.placeholder='補足事項';panel.append(supplement);let report,selectedIds=new Set();
    function build(){const s=readBusinessData();if(s?.roomId!==c.roomId)return;report=buildDailyReport({dayISO:date.value,personId:c.personId,roomId:c.roomId,tasks:s.tasks||[],schedules:s.schedules||[],resolvePerson});list.replaceChildren();selectedIds=new Set();for(const [title,items] of [['完了タスク',report.completedTasks],['本日の予定（実施未確認）',report.plannedSchedules],['進行中',report.inProgress]]){list.append(el('h3','om-group-label',title));for(const item of items){selectedIds.add(item.id);const label=el('label','om-choice'),input=el('input');input.type='checkbox';input.checked=true;input.addEventListener('change',()=>{if(input.checked)selectedIds.add(item.id);else selectedIds.delete(item.id);});label.append(input,el('span','',item.title));list.append(label);}}if(report.unknownCompletion.length)list.append(el('p','om-empty-small','完了日時不明：'+report.unknownCompletion.length+'件（集計対象外）'));}
    date.addEventListener('change',()=>{try{build();}catch(_){list.replaceChildren(el('p','','日付を確認してください。'));}});build();panel.append(button('下書きに入れる',()=>{if(!messageContextValid(c))return;const s=readBusinessData(),r=buildDailyReport({dayISO:date.value,personId:c.personId,roomId:c.roomId,tasks:s.tasks||[],schedules:s.schedules||[],resolvePerson,selectedIds:[...selectedIds],supplement:supplement.value});if(!r.withinMessageLimits){notice('報告内容が長すぎます。対象を減らしてください。');return;}compose().refs=r.refs;compose().replyTo=null;compose().editing=null;compose().attachmentIds=[];store.setDraft(r.body);renderComposeContext();closeDialog();},'om-primary'));}
  async function newConversation(){const scope=listIdentity();if(!scope)return;const panel=openDialog('新規メッセージ'),form=el('form','om-new-form'),kind=el('select'),title=el('input'),people=el('div','om-choice-list');kind.setAttribute('aria-label','会話の種類');for(const [value,text] of [['direct','1対1'],['group','グループ'],['self','自分宛て']]){const o=el('option','',text);o.value=value;kind.append(o);}title.placeholder='グループ名';title.setAttribute('aria-label','グループ名');title.maxLength=80;title.hidden=true;form.append(kind,title,people);const openingHead=panel.firstChild,users=await commands.users();if(disposed||!dialog.open||panel.firstChild!==openingHead||!sameScope(scope,listIdentity()))return;function renderPeople(){title.hidden=kind.value!=='group';people.hidden=kind.value==='self';people.replaceChildren();for(const user of users){const label=el('label','om-choice'),input=el('input');input.type=kind.value==='direct'?'radio':'checkbox';input.name='participants';input.value=user.personId;label.append(input,el('span','',user.displayName));people.append(label);}}kind.addEventListener('change',renderPeople);renderPeople();const submit=el('button','om-primary','作成する');submit.type='submit';form.append(submit);const error=el('p','om-feedback');form.append(error);form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;try{const ids=[...people.querySelectorAll('input:checked')].map(x=>x.value);const result=kind.value==='self'?await commands.openSelf():kind.value==='direct'&&ids.length===1?await commands.openDirect(ids[0]):kind.value==='group'&&title.value.trim()?await commands.createGroup({title:title.value.trim(),invitees:ids}):{status:'invalid'};if(disposed||!sameScope(scope,listIdentity())||!form.isConnected)return;if(result?.status==='ok'){closeDialog();await reloadList();if(sameScope(scope,listIdentity()))await openConversation(result.conversationId);}else error.textContent='会話の種類と参加者を確認してください。';}finally{submit.disabled=false;}});panel.append(form);}
  timeline.addEventListener('scroll',scheduleVisibleRead,{passive:true});$('#om-list-search').addEventListener('input',renderList);search.addEventListener('input',()=>{query=search.value;if(query)expandHistory(true);void renderTimeline();});body.addEventListener('input',()=>{store.setDraft(body.value);});body.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.ctrlKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();void submit();}});$('[data-om=confirm]').addEventListener('change',e=>{compose().confirmationRequested=e.target.checked;});sendButton.addEventListener('click',()=>void submit());$('[data-om=refs]').addEventListener('click',chooseReferences);$('[data-om=report]').addEventListener('click',reportDialog);$('[data-om=new]').addEventListener('click',()=>void newConversation());$('[data-om=back]').addEventListener('click',()=>{shell.dataset.mobileView='list';});$('[data-om=close]').addEventListener('click',onClose);$('[data-om=settings]').addEventListener('click',conversationSettings);$('[data-om=shared]').addEventListener('click',()=>{sharedAttachmentOffset=0;shared.hidden=false;shell.dataset.shared='true';void renderShared();});$('[data-om=hide-shared]').addEventListener('click',()=>{shared.hidden=true;shell.dataset.shared='false';});$('#om-shared-filter').addEventListener('change',()=>{sharedAttachmentOffset=0;void renderShared();});$('.om-newer button').addEventListener('click',()=>{timeline.scrollTop=timeline.scrollHeight;$('.om-newer').hidden=true;});
  searchToggle.addEventListener('click',()=>{
    const open=shell.dataset.historyOpen!=='true';expandHistory(open);
    if(open)search.focus();else{clearHistoryQuery();void renderTimeline();}
  });
  composeToggle.addEventListener('click',()=>expandTools(shell.dataset.toolsOpen!=='true'));
  for(const field of historyDates.fields)field.addEventListener('change',()=>{expandHistory(true);void renderTimeline();});
  for(const field of sharedDates.fields)field.addEventListener('change',()=>{sharedAttachmentOffset=0;void renderShared();});
  const stopStore=store.subscribe(renderState),stopList=commands.subscribe?.(options=>void reloadList(options));
  // Loads one bounded window centred on the target (however old it is). An
  // unloaded, deleted or forbidden target is never reported as success.
  async function loadWindow(c,messageId){
    let requested=false,waits=0;
    for(;;){
      const snap=store.getSnapshot();
      if(!messageContextValid(c)||snap.status!=='ready'||snap.conversationId!==c.conversationId)return {status:'unavailable'};
      const found=snap.messages.find(m=>m.id===messageId);
      if(found)return found.deletedAt==null?{status:'ok',loaded:requested}:{status:'missing'};
      if(requested)return {status:'unavailable'};
      const loaded=await store.loadAround(messageId);
      if(loaded?.status==='busy'){if(++waits>100)return {status:'unavailable'};await new Promise(resolve=>setTimeout(resolve,50));continue;}
      if(loaded?.status==='missing')return {status:'missing'};
      if(loaded?.status!=='ok')return {status:'unavailable'};
      requested=true;
    }
  }
  let lastJump='unavailable';
  const jumpNotice={missing:'対象のメッセージは削除されたか、閲覧できません。',
    unavailable:'対象のメッセージを読み込めませんでした。最新のメッセージを表示しています。'};
  function focusMessage(messageId){const target=timeline.querySelector('[data-message-id="'+messageId+'"]');if(!target)return false;target.scrollIntoView({block:'center'});target.tabIndex=-1;target.focus({preventScroll:true});return true;}
  async function openMessage(conversationId,messageId){
    if(disposed||!isMessageId(messageId))return false;
    await openConversation(conversationId);
    // History arrives asynchronously; wait (bounded) for this exact conversation to be ready.
    const ready=()=>{const now=context();return now&&now.conversationId===conversationId?now:null;};
    if(!ready())await new Promise(resolve=>{let stop=null;const finish=()=>{clearTimeout(timer);stop?.();resolve();};const timer=setTimeout(finish,10000);stop=store.subscribe(()=>queueMicrotask(()=>{if(ready()||['forbidden','locked'].includes(store.getSnapshot().status)||disposed)finish();}));});
    const c=ready();if(!c){lastJump='unavailable';return false;}
    const jump=await loadWindow(c,messageId);lastJump=jump.status;
    if(jump.status!=='ok'||!messageContextValid(c)){if(messageContextValid(c))notice(jumpNotice[jump.status]||jumpNotice.unavailable);return false;}
    await renderTimeline();return messageContextValid(c)&&focusMessage(messageId);
  }
  return {open:openConversation,openMessage,share,announce,lastJump:()=>lastJump,async restoreLocation(location){if(disposed||!context()||state.conversationId!==location?.conversationId||!isMessageId(location.messageId)||typeof location.query!=='string'||!Number.isFinite(location.scrollTop)||location.scrollTop<0)return false;const c=context();const jump=await loadWindow(c,location.messageId);if(jump.status!=='ok'){if(messageContextValid(c))notice(jumpNotice[jump.status]||jumpNotice.unavailable);return false;}query=location.query;search.value=query;const dates=Array.isArray(location.dates)&&location.dates.length===historyDates.fields.length?location.dates:null;historyDates.fields.forEach((field,i)=>{field.value=dates?.[i]??'';});expandHistory(Boolean(query||dates?.some(Boolean)));shell.dataset.mobileView='chat';await renderTimeline();if(!messageContextValid(c))return false;if(!jump.loaded){timeline.scrollTop=location.scrollTop;const target=timeline.querySelector('[data-message-id="'+location.messageId+'"]');if(!target)return false;target.tabIndex=-1;target.focus({preventScroll:true});return true;}return focusMessage(location.messageId);},dispose(){disposed=true;cancelAnimationFrame(readFrame);listGeneration++;renderGeneration++;sharedGeneration++;stopStore?.();stopList?.();if(!summaryOwner)notifications.dispose();resolver.clear?.();closeDialog();shell.remove();}};
}
