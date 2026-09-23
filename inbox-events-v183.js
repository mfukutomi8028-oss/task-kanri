// Ver.253 inbox event generation. Directed notifications keep deterministic ids and failed fallback deliveries survive reconnect/reload.
(function installInboxEventsV183(){
  const W=window.WorkBoardWorkflowV152;if(!W)return;
  let previous=null,pollTimer=0,flushPromise=null,remoteReady=false;
  const pendingStorageKey=`work-board-inbox-pending-v253:${W.ROOM_ID}`;
  const PENDING_LIMIT=200,PENDING_MAX_AGE=14*24*60*60*1000;
  const short=(v,n=90)=>{const s=String(v||'').replace(/\s+/g,' ').trim();return s.length>n?`${s.slice(0,n-1)}…`:s};
  const cleanId=v=>String(v||'').replace(/[.#$/\[\]]/g,'-').slice(0,180);
  function users(){return W.users?.()||[]}
  function mentions(text){const s=String(text||'');return users().filter(name=>name&&s.includes(`@${name}`))}
  function eventId(...parts){return cleanId(parts.filter(value=>value!==''&&value!==null&&value!==undefined).join('_'))}
  function normalizePendingEvent(event){
    const taskId=String(event?.taskId||'');if(!taskId)return null;
    return{taskId,type:String(event?.type||'update'),title:String(event?.title||'更新があります').slice(0,120),body:String(event?.body||'').slice(0,300),actor:String(event?.actor||''),createdAt:Number(event?.createdAt||Date.now())};
  }
  function pendingId(recipient,id){return JSON.stringify([String(recipient||''),cleanId(id)])}
  function readPending(){
    let raw={};try{raw=JSON.parse(localStorage.getItem(pendingStorageKey)||'{}')}catch(_){raw={}}
    const now=Date.now(),out={};
    for(const [key,value] of Object.entries(raw&&typeof raw==='object'?raw:{})){
      if(!value||typeof value!=='object')continue;
      const recipient=String(value.recipient||''),id=cleanId(value.id),event=normalizePendingEvent(value.event),queuedAt=Number(value.queuedAt||0);
      if(!recipient||!id||!event||!Number.isFinite(queuedAt)||queuedAt<=0||now-queuedAt>PENDING_MAX_AGE)continue;
      out[key]={recipient,id,event,queuedAt};
    }
    return out;
  }
  function writePending(map){
    const entries=Object.entries(map&&typeof map==='object'?map:{}).sort((a,b)=>Number(a[1]?.queuedAt||0)-Number(b[1]?.queuedAt||0)).slice(-PENDING_LIMIT);
    try{if(entries.length)localStorage.setItem(pendingStorageKey,JSON.stringify(Object.fromEntries(entries)));else localStorage.removeItem(pendingStorageKey)}catch(_){}
  }
  function queuePending(recipient,id,event){
    const normalized=normalizePendingEvent(event);if(!recipient||!id||!normalized)return;
    const map=readPending(),key=pendingId(recipient,id),existing=map[key];
    map[key]={recipient:String(recipient),id:cleanId(id),event:normalized,queuedAt:Number(existing?.queuedAt||Date.now())};writePending(map);
  }
  function clearPending(recipient,id){const map=readPending(),key=pendingId(recipient,id);if(!(key in map))return;delete map[key];writePending(map)}
  async function deliver(recipient,id,event){
    if(!recipient||recipient===event.actor)return{ok:true,skipped:true};
    queuePending(recipient,id,event);
    try{const result=await W.writeInboxEvent(recipient,id,event);if(result?.ok)clearPending(recipient,id);return result||{ok:false}}
    catch(error){console.warn('Ver.253 inbox fallback delivery failed',error);return{ok:false,error}}
  }
  async function flushPending(){
    if(!remoteReady)return{ok:false,offline:true};
    if(flushPromise)return flushPromise;
    const entries=Object.values(readPending());if(!entries.length)return{ok:true,count:0};
    const pending=(async()=>{let delivered=0;for(const entry of entries){try{const result=await W.writeInboxEvent(entry.recipient,entry.id,entry.event);if(result?.ok){clearPending(entry.recipient,entry.id);delivered+=1}}catch(error){console.warn('Ver.253 pending inbox retry failed',error)}}return{ok:true,count:delivered}})();
    flushPromise=pending;try{return await pending}finally{if(flushPromise===pending)flushPromise=null}
  }
  function replyInfo(comment){
    const text=String(comment?.text||'');
    const direct=String(comment?.replyTo||'').trim();
    if(direct)return{replyTo:direct,text};
    const match=text.match(/^\[\[wb-reply:([A-Za-z0-9_-]{1,120})\]\]\s*/);
    return match?{replyTo:match[1],text:text.slice(match[0].length)}:{replyTo:'',text};
  }
  function reactionUsers(comment,emoji){
    const raw=comment?.reactions&&typeof comment.reactions==='object'?comment.reactions[emoji]:null;
    const source=Array.isArray(raw)?raw:Object.values(raw&&typeof raw==='object'?raw:{}),out=[];
    source.forEach(value=>{const user=String(value||'').normalize('NFKC').replace(/\s+/g,'').slice(0,12);if(user&&!out.includes(user))out.push(user)});
    return out;
  }
  function queueReactionAdditions(jobs,taskId,before,next,nextRevision){
    const beforeComments=new Map((Array.isArray(before?.comments)?before.comments:[]).map(comment=>[String(comment?.id||''),comment]));
    for(const comment of Array.isArray(next?.comments)?next.comments:[]){
      const cid=String(comment?.id||''),old=beforeComments.get(cid);if(!cid||!old)continue;
      const recipient=String(comment?.author||'');if(!recipient)continue;
      const reactions=comment?.reactions&&typeof comment.reactions==='object'?comment.reactions:{};
      for(const emoji of Object.keys(reactions)){
        const oldUsers=new Set(reactionUsers(old,emoji));
        for(const reactor of reactionUsers(comment,emoji)){
          if(oldUsers.has(reactor)||reactor===recipient)continue;
          const bodyText=short(replyInfo(comment).text,72);
          jobs.push(deliver(recipient,eventId('reaction',taskId,cid,emoji,reactor,nextRevision),{
            taskId,type:'reaction',title:'コメントにリアクションがありました',
            body:`${reactor}：${emoji}${bodyText?`「${bodyText}」`:''}`,
            actor:reactor,createdAt:Date.now()
          }));
        }
      }
    }
  }
  async function processSnapshot(raw){
    if(remoteReady)void flushPending();
    const current=raw&&typeof raw==='object'?raw:{};
    if(previous===null){previous=current;return}
    const jobs=[];
    for(const [id,next] of Object.entries(current)){
      if(!next||typeof next!=='object')continue;
      const before=previous[id]||null,actor=String(next.updatedBy||next.createdBy||'');
      if(!before){
        const assignee=String(next.assignee||'');
        if(assignee&&assignee!==actor)jobs.push(deliver(assignee,eventId('assign',id,next.revision||next.createdAt),{taskId:id,type:'assign',title:'担当になりました',body:next.title||'',actor,createdAt:Number(next.updatedAt||next.createdAt||Date.now())}));
        continue;
      }
      if(String(before.assignee||'')!==String(next.assignee||'')){
        const assignee=String(next.assignee||'');
        if(assignee&&assignee!==actor)jobs.push(deliver(assignee,eventId('assign',id,next.revision),{taskId:id,type:'assign',title:'担当になりました',body:next.title||'',actor,createdAt:Number(next.updatedAt||Date.now())}));
      }
      if(String(before.status||'')!==String(next.status||'')){
        const assignee=String(next.assignee||'');
        if(assignee&&assignee!==actor)jobs.push(deliver(assignee,eventId('status',id,next.revision),{taskId:id,type:'status',title:'状態が変更されました',body:`${before.status||'--'} → ${next.status||'--'}｜${next.title||''}`,actor,createdAt:Number(next.updatedAt||Date.now())}));
      }
      const oldIds=new Set((Array.isArray(before.comments)?before.comments:[]).map(c=>String(c?.id||'')));
      const nextComments=Array.isArray(next.comments)?next.comments:[];
      const commentMap=new Map(nextComments.map(c=>[String(c?.id||''),c]));
      for(const comment of nextComments){
        const cid=String(comment?.id||'');if(!cid||oldIds.has(cid))continue;
        const author=String(comment.author||actor||''),reply=replyInfo(comment),mentioned=mentions(reply.text),recipients=new Set(mentioned),assignee=String(next.assignee||'');
        if(!reply.replyTo&&assignee)recipients.add(assignee);
        const parent=reply.replyTo?commentMap.get(reply.replyTo):null;
        const replyAuthor=String(parent?.author||'');
        if(replyAuthor)recipients.add(replyAuthor);
        for(const recipient of recipients){
          if(!recipient||recipient===author)continue;
          const isMention=mentioned.includes(recipient),isReply=Boolean(reply.replyTo&&recipient===replyAuthor);
          const kind=isReply?'reply':isMention?'mention':'comment';
          const title=isReply?'コメントに返信がありました':isMention?'@メンションされました':'コメントが追加されました';
          jobs.push(deliver(recipient,eventId(kind,id,cid,recipient),{taskId:id,type:kind,title,body:`${author||'ユーザー'}：${short(reply.text,100)}`,actor:author,createdAt:Number(comment.createdAt||next.updatedAt||Date.now())}));
        }
      }
      queueReactionAdditions(jobs,id,before,next,Number(next.revision||0));
    }
    previous=current;
    if(jobs.length)await Promise.allSettled(jobs);
  }
  async function bindRemote(){
    const r=await W.ensureRemote?.();
    if(r){remoteReady=true;await flushPending();const ref=r.ref(r.db,`rooms/${W.ROOM_ID}/tasks`);r.onValue(ref,s=>{remoteReady=true;processSnapshot(s.val()||{})},e=>{remoteReady=false;console.warn('Ver.183 inbox watcher failed',e)});return}
    remoteReady=false;let prevSig='';pollTimer=setInterval(()=>{const map=Object.fromEntries([...W.taskMap().entries()]),sig=JSON.stringify([...W.taskMap().values()].map(t=>[t.id,t.revision]));if(sig!==prevSig){prevSig=sig;processSnapshot(map)}},1500);
  }
  bindRemote();
})();