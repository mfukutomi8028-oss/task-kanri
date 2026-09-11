// Ver.183 inbox event generation extracted from inbox-v153.js without changing notification behavior.
(function installInboxEventsV183(){
  const W=window.WorkBoardWorkflowV152;if(!W)return;
  let previous=null,pollTimer=0;
  const short=(v,n=90)=>{const s=String(v||'').replace(/\s+/g,' ').trim();return s.length>n?`${s.slice(0,n-1)}…`:s};
  const cleanId=v=>String(v||'').replace(/[.#$/\[\]]/g,'-').slice(0,180);
  function users(){return W.users?.()||[]}
  function mentions(text){const s=String(text||'');return users().filter(name=>name&&s.includes(`@${name}`))}
  function eventId(...parts){return cleanId(parts.filter(Boolean).join('_'))}
  async function deliver(recipient,id,event){if(!recipient||recipient===event.actor)return;await W.writeInboxEvent(recipient,id,event)}
  async function processSnapshot(raw){
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
      for(const comment of (Array.isArray(next.comments)?next.comments:[])){
        const cid=String(comment?.id||'');if(!cid||oldIds.has(cid))continue;
        const author=String(comment.author||actor||''),mentioned=mentions(comment.text),recipients=new Set(mentioned),assignee=String(next.assignee||'');
        if(assignee)recipients.add(assignee);
        for(const recipient of recipients){
          if(!recipient||recipient===author)continue;
          const isMention=mentioned.includes(recipient);
          jobs.push(deliver(recipient,eventId(isMention?'mention':'comment',id,cid,recipient),{taskId:id,type:isMention?'mention':'comment',title:isMention?'@メンションされました':'コメントが追加されました',body:`${author||'ユーザー'}：${short(comment.text,100)}`,actor:author,createdAt:Number(comment.createdAt||next.updatedAt||Date.now())}));
        }
      }
    }
    previous=current;
    if(jobs.length)await Promise.allSettled(jobs);
  }
  async function bindRemote(){
    const r=await W.ensureRemote?.();
    if(r){const ref=r.ref(r.db,`rooms/${W.ROOM_ID}/tasks`);r.onValue(ref,s=>processSnapshot(s.val()||{}),e=>console.warn('Ver.183 inbox watcher failed',e));return}
    let prevSig='';pollTimer=setInterval(()=>{const map=Object.fromEntries([...W.taskMap().entries()]),sig=JSON.stringify([...W.taskMap().values()].map(t=>[t.id,t.revision]));if(sig!==prevSig){prevSig=sig;processSnapshot(map)}},1500);
  }
  bindRemote();
})();
