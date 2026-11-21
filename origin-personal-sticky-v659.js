/* Origin-only personal sticky canvas. Presentation-only; no Firebase ownership. */
(function installOriginStickyPanelV659(root) {
  'use strict';
  if (root.WorkBoardOriginStickyPanelV659) return;

  const COLORS = [
    ['ivory','白','#f4f0e5'], ['lemon','レモン','#fff1ad'],
    ['peach','ピーチ','#ffdfd1'], ['mint','ミント','#d8f1d9'],
    ['sky','スカイ','#daecfb'], ['lavender','ラベンダー','#ebe2fa']
  ];
  const colorHex = Object.fromEntries(COLORS.map(([k,,c]) => [k,c]));
  const STYLES = `
    .sticky-origin-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 14px}
    .sticky-origin-toolbar input{max-width:290px;width:100%;min-height:44px;border:1px solid var(--line);border-radius:10px;padding:8px 12px;background:var(--paper);color:var(--ink)}
    .sticky-origin-toolbar button,.sticky-origin-card button{font:inherit;min-width:44px;min-height:44px}
    .sticky-origin-toolbar .sticky-add{background:var(--accent);color:var(--on-accent);border:0;border-radius:10px;padding:9px 15px;font-weight:750}
    .sticky-origin-state{font-size:12px;color:var(--ink-soft);line-height:1.6}
    .sticky-origin-stage{background:color-mix(in srgb,var(--bg) 92%,#d0d6e3);border:1px solid var(--line);border-radius:16px;overflow:auto;max-height:min(72dvh,980px);min-height:440px;overscroll-behavior:contain}
    .sticky-origin-canvas{position:relative;width:1400px;height:900px;min-width:1400px;min-height:900px;background-image:linear-gradient(to right,rgba(104,113,140,.08) 1px,transparent 1px),linear-gradient(to bottom,rgba(104,113,140,.08) 1px,transparent 1px);background-size:28px 28px}
    .sticky-origin-card{position:absolute;display:flex;flex-direction:column;overflow:hidden;border-radius:12px;border:1px solid rgba(25,40,60,.16);box-shadow:0 8px 22px rgba(28,38,65,.10);color:#273040;background:var(--sticky-paper,#fff1ad);min-height:160px;min-width:220px}
    .sticky-origin-card:focus-within{outline:2px solid #4659cc;outline-offset:2px}
    .sticky-origin-card-head{display:flex;align-items:center;gap:3px;min-height:45px;padding:2px 4px 2px 7px;border-bottom:1px solid rgba(25,40,60,.10)}
    .sticky-origin-grip{flex:1;display:flex;align-items:center;min-width:0;text-align:left;touch-action:none;border:0;color:#293244;background:transparent;font-weight:730;font-size:12px;cursor:grab;user-select:none}
    .sticky-origin-grip:active{cursor:grabbing}
    .sticky-origin-grip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .sticky-origin-card-head button:not(.sticky-origin-grip){background:transparent;border:0;border-radius:8px;color:#293244;font-size:14px}
    .sticky-origin-card-head button:hover{background:rgba(255,255,255,.6)}
    .sticky-origin-card textarea{display:block;flex:1;resize:none;min-height:68px;width:100%;padding:12px 14px;border:0;outline:0;background:transparent;color:#273040;font-size:14px;line-height:1.65;overflow:auto}
    .sticky-origin-card textarea:focus-visible{outline:2px solid #4659cc;outline-offset:-2px}
    .sticky-origin-foot{padding:3px 10px 8px;font-size:11px;min-height:27px;display:flex;justify-content:space-between;align-items:center;color:#4f596c}
    .sticky-origin-resize{position:absolute;right:0;bottom:0;width:28px;height:28px;border:0;background:transparent;color:#455067;cursor:nwse-resize;touch-action:none}
    .sticky-origin-palette{display:flex;align-items:center;flex-wrap:wrap;gap:4px;padding:4px 10px}
    .sticky-origin-palette button{width:44px;min-width:44px;height:44px;min-height:44px;border-radius:10px;border:2px solid transparent;background:var(--swatch);color:#253046;font-size:0}
    .sticky-origin-palette button[aria-pressed="true"]{border-color:#3d4ab5;box-shadow:inset 0 0 0 3px white}
    .sticky-origin-empty{padding:30px;font-size:14px;color:var(--muted)}
    .sticky-origin-error{padding:18px;border:1px solid var(--line);border-radius:12px;color:var(--ink-soft);background:var(--paper)}
    .sticky-origin-error strong{display:block;margin-bottom:6px;color:var(--ink)}
    @media(max-width:767px){
      .sticky-origin-toolbar input{max-width:none;flex:1 1 100%}
      .sticky-origin-stage{max-height:none;min-height:0;overflow:visible;background:transparent;border:0}
      .sticky-origin-canvas{display:grid;gap:12px;width:100%;height:auto;min-width:0;min-height:0;background:none}
      .sticky-origin-card{position:relative!important;left:auto!important;top:auto!important;width:100%!important;height:260px!important;box-shadow:none}
      .sticky-origin-grip{cursor:default;touch-action:auto}
      .sticky-origin-resize{display:none}
    }
    @media(prefers-reduced-motion:no-preference){.sticky-origin-card{transition:box-shadow .16s ease}.sticky-origin-card:hover{box-shadow:0 10px 28px rgba(28,38,65,.14)}}
  `;

  function createPanel({ container, shadowRoot, service, onStatus } = {}) {
    if (!container || !shadowRoot || typeof shadowRoot.querySelector !== 'function') throw new TypeError('Sticky panel requires Origin ShadowRoot');
    if (!shadowRoot.querySelector('#originStickyStylesV659')) {
      const style = document.createElement('style');
      style.id = 'originStickyStylesV659';
      style.textContent = STYLES;
      shadowRoot.appendChild(style);
    }
    let disposed = false;
    let data = [];
    let ownerUid = '', ownerRoom = '', state = 'locked';
    let query = '', composing = false, saving = new Map(), timers = new Map(), drafts = new Map(), activeMovement = null;
    const panel = document.createElement('section');
    panel.className = 'sticky-origin-panel';
    panel.setAttribute('aria-label', '個人付箋ボード');
    container.replaceChildren(panel);
    const badge = msg => { if (typeof onStatus === 'function') onStatus(msg); };
    const isReady = () => state === 'ready' && ownerUid && ownerRoom && service && !disposed;

    function createElement(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }
    function button(label, className) {
      const node = createElement('button', className, label);
      node.type = 'button';
      return node;
    }
    function noteFromId(id) { return data.find(note => note.id === id); }
    function statusMessage(id, message) {
      saving.set(id, message);
      const element = panel.querySelector('[data-sticky-status="'+id+'"]');
      if (element) element.textContent = message;
      badge(message);
    }
    async function commit(id, field, values) {
      const note = noteFromId(id);
      if (!note || !isReady()) return {ok:false,error:'auth-required'};
      statusMessage(id, '保存中…');
      const result = await service.dispatch({
        type:'sticky.'+field, id, values,
        expectedRevision:note[field].revision,
        ownerUid, ownerRoom
      });
      if (disposed) return result;
      statusMessage(id, result.ok ? '保存済み' : (result.error === 'conflict' ? '競合：最新を確認してください' : '保存できませんでした'));
      if (!result.ok && result.error === 'conflict') {
        const draft=drafts.get(id);
        if (draft && field==='content') drafts.set(id,draft);
      }
      return result;
    }
    function buildCard(note) {
      const card=createElement('article','sticky-origin-card');
      card.dataset.id=note.id;
      card.style.setProperty('--sticky-paper',colorHex[note.appearance.color]||colorHex.lemon);
      card.style.left=note.layout.x+'px';
      card.style.top=note.layout.y+'px';
      card.style.width=note.layout.width+'px';
      card.style.height=note.layout.height+'px';
      card.style.zIndex=String(note.layout.zIndex);
      const top=createElement('div','sticky-origin-card-head');
      const grip=button('','sticky-origin-grip');
      grip.dataset.stickyMove=note.id;
      grip.title='ドラッグで移動。方向キーでも位置を調整できます';
      grip.setAttribute('aria-label','付箋を移動。方向キーでも移動できます');
      const symbol=createElement('span','',note.content.text.split('\n')[0].slice(0,24)||'新しい付箋');
      grip.append(symbol);
      const remove=button('削除');
      remove.dataset.stickyDelete=note.id;
      remove.setAttribute('aria-label','この付箋を削除');
      top.append(grip,remove);
      const textarea=createElement('textarea');
      textarea.dataset.stickyText=note.id;
      textarea.setAttribute('aria-label','付箋本文');
      textarea.maxLength=2000;
      textarea.value=drafts.get(note.id)??note.content.text;
      textarea.spellcheck=false;
      const colors=createElement('div','sticky-origin-palette');
      colors.setAttribute('role','group');colors.setAttribute('aria-label','付箋の色');
      COLORS.forEach(([key,label,hex])=>{
        const b=button(label);
        b.dataset.stickyColor=key;
        b.dataset.id=note.id;
        b.style.setProperty('--swatch',hex);
        b.setAttribute('aria-label',label);
        b.setAttribute('aria-pressed',String(note.appearance.color===key));
        colors.append(b);
      });
      const foot=createElement('div','sticky-origin-foot');
      const status=createElement('span','',saving.get(note.id)||'保存済み');
      status.dataset.stickyStatus=note.id;
      foot.append(status,createElement('span','',textarea.value.length+'/2000'));
      const resize=button('↘','sticky-origin-resize');
      resize.dataset.stickyResize=note.id;
      resize.setAttribute('aria-label','ドラッグで付箋の大きさを変更');
      card.append(top,textarea,colors,foot,resize);
      return card;
    }
    function draw() {
      if (disposed) return;
      if (panel.querySelector('textarea:focus') || composing || activeMovement) return;
      panel.replaceChildren();
      const toolbar=createElement('div','sticky-origin-toolbar');
      const search=createElement('input');
      search.type='search';search.setAttribute('aria-label','個人付箋を検索');
      search.placeholder='付箋の本文を検索';search.value=query;
      search.addEventListener('input',()=>{
        // Keep the search field and Japanese IME composition node mounted.
        query=search.value;
        const canvas=panel.querySelector('.sticky-origin-canvas');
        if(!canvas)return;
        const term=query.normalize('NFKC').toLocaleLowerCase('ja');
        const shown=data.filter(note=>!term||note.content.text.normalize('NFKC').toLocaleLowerCase('ja').includes(term))
          .sort((x,y)=>x.mobile.order-y.mobile.order||x.createdAt-y.createdAt);
        canvas.replaceChildren();
        if(!shown.length)canvas.append(createElement('p','sticky-origin-empty','一致する付箋はありません'));
        else shown.forEach(note=>canvas.append(buildCard(note)));
      });
      const add=button('＋ 付箋を追加','sticky-add');
      add.disabled=!isReady();
      add.addEventListener('click',async()=>{
        if (!isReady()) return;
        const result=await service.dispatch({type:'sticky.create',ownerUid,ownerRoom});
        if (!result.ok) {badge('付箋を作成できませんでした');return;}
        const newId=result.id;
        requestAnimationFrame(()=>panel.querySelector('[data-sticky-text="'+newId+'"]')?.focus());
      });
      const label=createElement('span','sticky-origin-state',state==='ready' ? data.length+'枚' :
        state==='loading' ? '読み込み中…' : '本人確認が完了していないため利用できません');
      toolbar.append(search,add,label);panel.append(toolbar);
      if (!isReady()) {
        const error=createElement('div','sticky-origin-error');
        error.append(createElement('strong','','個人付箋は本人確認後に利用できます'),
          createElement('span','','現在の利用者名選択だけでは、他の職員から付箋を保護できません。認証済みアカウントに接続されるまで作成・閲覧は無効です。'));
        panel.append(error);return;
      }
      const stage=createElement('div','sticky-origin-stage');
      const canvas=createElement('div','sticky-origin-canvas');
      const shown=data.filter(note=>{
        const text=note.content.text.normalize('NFKC').toLocaleLowerCase('ja');
        return !query||text.includes(query.normalize('NFKC').toLocaleLowerCase('ja'));
      }).sort((a,b)=>a.mobile.order-b.mobile.order||a.createdAt-b.createdAt);
      if(!shown.length) canvas.append(createElement('p','sticky-origin-empty',query?'一致する付箋はありません':'まだ付箋はありません。「＋ 付箋を追加」で作成できます。'));
      else shown.forEach(note=>canvas.append(buildCard(note)));
      stage.append(canvas);panel.append(stage);
    }
    let unsubscribe = () => {};
    if (service && typeof service.subscribe === 'function') {
      unsubscribe = service.subscribe(next => {
        if (disposed) return;
        const changedIdentity=next.ownerUid!==ownerUid||next.ownerRoom!==ownerRoom;
        ownerUid=next.ownerUid;ownerRoom=next.ownerRoom;state=next.status;data=next.notes||[];
        if(changedIdentity||state!=='ready'){
          for(const timer of timers.values())clearTimeout(timer);
          timers.clear();drafts.clear();saving.clear();activeMovement=null;
          // Clear immediately, even if an input was focused during signout.
          panel.replaceChildren();
        }
        draw();
      });
    }
    panel.addEventListener('compositionstart',e=>{if(e.target.matches('textarea'))composing=true});
    panel.addEventListener('compositionend',e=>{
      if(!e.target.matches('textarea'))return;
      composing=false;
      schedule(e.target.dataset.stickyText,e.target.value);
    });
    function schedule(id, value) {
      drafts.set(id,value);
      clearTimeout(timers.get(id));
      timers.set(id,setTimeout(async()=>{
        timers.delete(id);
        const draft=drafts.get(id);
        if(draft===undefined||!isReady())return;
        const result=await commit(id,'content',{text:draft});
        if(result.ok)drafts.delete(id);
      },700));
      statusMessage(id,'未保存');
    }
    panel.addEventListener('input',e=>{
      if(e.target.matches('[data-sticky-text]')){
        const id=e.target.dataset.stickyText;
        const len=e.target.closest('.sticky-origin-card')?.querySelector('.sticky-origin-foot span:last-child');
        if(len)len.textContent=e.target.value.length+'/2000';
        if(!composing&&!e.isComposing)schedule(id,e.target.value);
      }
    });
    panel.addEventListener('focusout',e=>{
      if(!e.target.matches('[data-sticky-text]'))return;
      const id=e.target.dataset.stickyText;
      if(timers.has(id)){clearTimeout(timers.get(id));timers.delete(id);
        const text=drafts.get(id);
        if(text!==undefined)void commit(id,'content',{text}).then(r=>{if(r.ok)drafts.delete(id)});
      }
      // Once writing has stopped, subsequent snapshots may safely repaint.
    });
    panel.addEventListener('click',async e=>{
      const color=e.target.closest('[data-sticky-color]');
      if(color){
        const id=color.dataset.id;
        if(await commit(id,'appearance',{color:color.dataset.stickyColor}).then(r=>r.ok)){
          panel.querySelectorAll('[data-sticky-color][data-id="'+id+'"]').forEach(b=>{
            b.setAttribute('aria-pressed',String(b===color));
          });
          color.closest('.sticky-origin-card')?.style.setProperty('--sticky-paper',colorHex[color.dataset.stickyColor]);
        }
        return;
      }
      const remove=e.target.closest('[data-sticky-delete]');
      if(remove) {
        const note=noteFromId(remove.dataset.stickyDelete);
        if(!note||!confirm('この付箋を削除しますか？'))return;
        const expectedRevisions=Object.fromEntries(['content','appearance','layout','mobile'].map(key=>[key,note[key].revision]));
        const result=await service.dispatch({type:'sticky.delete',id:note.id,ownerUid,ownerRoom,expectedRevisions});
        if(!result.ok)badge('削除できませんでした。最新の内容を確認してください。');
      }
    });
    panel.addEventListener('pointerdown',e=>{
      const target=e.target.closest('[data-sticky-move],[data-sticky-resize]');
      if(!target||!isReady()||matchMedia('(max-width:767px)').matches)return;
      const id=target.dataset.stickyMove||target.dataset.stickyResize,note=noteFromId(id);
      if(!note)return;
      const card=target.closest('.sticky-origin-card');
      const isSize=Boolean(target.dataset.stickyResize);
      activeMovement={id,card,target,isSize,x:e.clientX,y:e.clientY,
        initial:{...note.layout},pointerId:e.pointerId, moved:false};
      target.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    panel.addEventListener('pointermove',e=>{
      const d=activeMovement;
      if(!d||d.pointerId!==e.pointerId)return;
      const dx=e.clientX-d.x,dy=e.clientY-d.y;
      if(Math.abs(dx)+Math.abs(dy)<3&&!d.moved)return;
      d.moved=true;
      if(d.isSize){
        d.card.style.width=Math.max(220,Math.min(480,d.initial.width+Math.round(dx)))+'px';
        d.card.style.height=Math.max(160,Math.min(500,d.initial.height+Math.round(dy)))+'px';
      } else {
        d.card.style.left=Math.max(0,Math.min(1400,d.initial.x+Math.round(dx)))+'px';
        d.card.style.top=Math.max(0,Math.min(900,d.initial.y+Math.round(dy)))+'px';
      }
    });
    panel.addEventListener('pointerup',async e=>{
      const d=activeMovement;
      if(!d||d.pointerId!==e.pointerId)return;
      activeMovement=null;
      if(!d.moved)return;
      const values=d.isSize?
        {width:parseInt(d.card.style.width,10),height:parseInt(d.card.style.height,10)}:
        {x:parseInt(d.card.style.left,10),y:parseInt(d.card.style.top,10)};
      const result=await commit(d.id,'layout',values);
      if(!result.ok)draw();
    });
    panel.addEventListener('pointercancel',()=>{activeMovement=null;draw();});
    panel.addEventListener('keydown',async e=>{
      const grip=e.target.closest('[data-sticky-move]');
      if(!grip||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
      const note=noteFromId(grip.dataset.stickyMove);
      if(!note||!isReady())return;
      e.preventDefault();
      const amount=e.shiftKey?20:10;
      const values={x:Math.max(0,Math.min(1400,note.layout.x+(e.key==='ArrowLeft'?-amount:e.key==='ArrowRight'?amount:0))),
        y:Math.max(0,Math.min(900,note.layout.y+(e.key==='ArrowUp'?-amount:e.key==='ArrowDown'?amount:0)))};
      const res=await commit(note.id,'layout',values);
      if(res.ok){grip.closest('.sticky-origin-card').style.left=values.x+'px';grip.closest('.sticky-origin-card').style.top=values.y+'px';}
    });
    draw();
    return {
      destroy(){
        if(disposed)return;
        disposed=true;
        unsubscribe();
        for(const timer of timers.values())clearTimeout(timer);
        timers.clear();drafts.clear();saving.clear();data=[];panel.replaceChildren();
      }
    };
  }
  root.WorkBoardOriginStickyPanelV659=Object.freeze({createPanel});
})(window);
