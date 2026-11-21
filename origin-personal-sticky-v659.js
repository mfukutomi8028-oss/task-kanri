/* Origin-only personal sticky canvas. Presentation-only; no Firebase ownership. */
(function installOriginStickyPanelV659(root) {
  'use strict';
  if (root.WorkBoardOriginStickyPanelV659) return;

  // Keep canonical color keys stable: only their Origin presentation changes.
  const COLORS = [
    ['ivory','白','#f6f2eb'], ['lemon','レモン','#faf3c9'],
    ['peach','ピーチ','#fae3db'], ['mint','ミント','#dff0e6'],
    ['sky','スカイ','#e1edf8'], ['lavender','ラベンダー','#eee6f8']
  ];
  const colorHex = Object.fromEntries(COLORS.map(([k,,c]) => [k,c]));
  const STYLES = `
    .sticky-origin-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 14px}
    .sticky-origin-toolbar input{max-width:290px;width:100%;min-height:44px;border:1px solid var(--line);border-radius:10px;padding:8px 12px;background:var(--paper);color:var(--ink)}
    .sticky-origin-toolbar select,.sticky-origin-toolbar .sticky-fit{min-height:44px;border:1px solid var(--line);border-radius:10px;padding:8px 12px;background:var(--paper);color:var(--ink)}
    .sticky-origin-toolbar :is(button,select,input):focus-visible{outline:2px solid var(--focus,#4659cc);outline-offset:2px}
    .sticky-origin-toolbar button,.sticky-origin-card button{font:inherit;min-width:44px;min-height:44px}
    .sticky-origin-toolbar .sticky-add{background:var(--accent);color:var(--on-accent);border:0;border-radius:10px;padding:9px 15px;font-weight:750}
    .sticky-origin-index-toggle{background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:8px 13px}
    .sticky-origin-index{margin:0 0 12px;padding:12px;border:1px solid var(--line);border-radius:13px;background:var(--paper);max-height:260px;overflow:auto}
    .sticky-origin-index-label{margin:0 0 10px;color:var(--ink-soft);font-size:13px;font-weight:700}
    .sticky-origin-index-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,210px),1fr));gap:8px}
    .sticky-origin-index-entry{display:flex;align-items:center;gap:9px;min-height:52px;width:100%;padding:8px 10px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:10px;text-align:left;font:inherit}
    .sticky-origin-index-entry:hover{border-color:var(--accent)}
    .sticky-origin-index-entry:focus-visible{outline:2px solid var(--focus,#4659cc);outline-offset:2px}
    .sticky-origin-index-swatch{display:block;width:18px;height:18px;min-width:18px;min-height:18px;border:1px solid rgba(30,40,60,.16);border-radius:5px}
    .sticky-origin-index-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:650}
    .sticky-origin-index-empty{color:var(--ink-soft);font-size:13px}
    .sticky-origin-state{font-size:12px;color:var(--ink-soft);line-height:1.6}
    .sticky-origin-stage{background:color-mix(in srgb,var(--bg) 92%,#d0d6e3);border:1px solid var(--line);border-radius:16px;overflow-x:hidden;overflow-y:auto;max-height:min(72dvh,980px);min-height:440px;overscroll-behavior:contain}
    .sticky-origin-canvas{position:relative;width:1400px;height:900px;min-width:1400px;min-height:900px;background-image:linear-gradient(to right,rgba(104,113,140,.08) 1px,transparent 1px),linear-gradient(to bottom,rgba(104,113,140,.08) 1px,transparent 1px);background-size:28px 28px;isolation:isolate}
    .sticky-origin-card{position:absolute;display:flex;flex-direction:column;overflow:hidden;border-radius:12px;border:1px solid rgba(25,40,60,.16);box-shadow:0 8px 22px rgba(28,38,65,.10);color:#273040;background:var(--sticky-paper,#faf3c9);min-height:160px;min-width:220px}
    .sticky-origin-card:focus-within{outline:2px solid #4659cc;outline-offset:2px}
    .sticky-origin-card-head{display:flex;align-items:center;gap:3px;min-height:45px;padding:2px 4px 2px 7px;border-bottom:1px solid rgba(25,40,60,.10)}
    .sticky-origin-grip{flex:1;display:flex;align-items:center;min-width:0;text-align:left;touch-action:none;border:0;color:#293244;background:transparent;font-weight:730;font-size:12px;cursor:grab;user-select:none}
    .sticky-origin-grip:active{cursor:grabbing}
    .sticky-origin-front,.sticky-origin-back{border:0;background:transparent;border-radius:8px;color:#293244;font-size:12px;padding:0 6px;white-space:nowrap}
    .sticky-origin-order{display:none;gap:3px}
    .sticky-origin-order button{padding:0 6px;font-size:12px;background:transparent;border:0;border-radius:8px;color:#293244}
    .sticky-origin-order button:disabled{opacity:.32}
    .sticky-origin-grip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .sticky-origin-card-head button:not(.sticky-origin-grip){background:transparent;border:0;border-radius:8px;color:#293244;font-size:14px}
    .sticky-origin-card-head button:hover{background:rgba(255,255,255,.6)}
    .sticky-origin-card-head button:focus-visible,.sticky-origin-page-move:focus-visible{outline:2px solid #4659cc;outline-offset:2px}
    @media(min-width:768px){.sticky-origin-card-head button:not(.sticky-origin-grip){min-width:36px;width:36px;min-height:44px;padding:0 2px;font-size:11px}}
    .sticky-origin-card textarea{display:block;flex:1;resize:none;min-height:68px;width:100%;padding:12px 14px;border:0;outline:0;background:transparent;color:#273040;font-size:14px;line-height:1.65;overflow:auto}
    .sticky-origin-card textarea:focus-visible{outline:2px solid #4659cc;outline-offset:-2px}
    .sticky-origin-foot{padding:4px 6px 6px;font-size:11px;min-height:38px;display:grid;grid-template-columns:32px 32px minmax(0,1fr) 42px auto 32px;gap:3px;align-items:center;color:#4f596c}
    .sticky-origin-foot-spacer{min-width:0;pointer-events:none}
    .sticky-origin-save-feedback{position:absolute;left:8px;bottom:46px;z-index:2;max-width:calc(100% - 16px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 6px;border:1px solid rgba(70,85,120,.16);border-radius:6px;background:rgba(255,255,255,.9);color:#4a5872;font-size:10px;line-height:1.5;pointer-events:none}
    .sticky-origin-char-count{white-space:nowrap;font-size:10px;letter-spacing:-.15px;font-variant-numeric:tabular-nums;justify-self:end}
    .sticky-origin-card button.sticky-origin-resize{position:static;min-width:32px;min-height:32px;width:32px;height:32px;border:0;background:transparent;color:#455067;cursor:nwse-resize;touch-action:none;padding:0;display:grid;place-items:center;justify-self:end}
    /* A soft, round swatch and an unobtrusive trash icon stay at the note's lower left. */
    .sticky-origin-card button.sticky-origin-color-toggle{position:relative;justify-self:start;box-sizing:border-box;display:grid;place-items:center;width:32px;height:32px;min-width:32px;min-height:32px;padding:0;border:1px solid #9ba6b9;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(30,42,64,.12);cursor:pointer}
    .sticky-origin-card button.sticky-origin-color-toggle:hover{background:#f8f9ff;border-color:#65769b;box-shadow:0 2px 7px rgba(30,42,64,.16)}
    .sticky-origin-card button.sticky-origin-color-toggle[aria-expanded="true"]{background:#f8f9ff;border-color:#4659b9;box-shadow:0 0 0 2px rgba(70,89,185,.14)}
    .sticky-origin-color-preview{display:block;width:19px;height:19px;border:2px solid rgba(66,78,107,.50);border-radius:50%;background:var(--sticky-paper);box-shadow:0 0 0 1px rgba(255,255,255,.85)}
    .sticky-origin-card button.sticky-origin-delete{justify-self:start;box-sizing:border-box;display:grid;place-items:center;width:32px;height:32px;min-width:32px;min-height:32px;padding:0;border:1px solid rgba(74,90,115,.22);border-radius:50%;background:rgba(255,255,255,.45);color:#53617b;cursor:pointer}
    .sticky-origin-card button.sticky-origin-delete:hover{background:#fff0f0;border-color:#c88e96;color:#a14250}
    .sticky-origin-delete svg{display:block;width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
    .sticky-origin-card button.sticky-origin-color-toggle:focus-visible,.sticky-origin-card button.sticky-origin-delete:focus-visible{outline:2px solid #4659cc;outline-offset:2px}
    .sticky-origin-palette{position:absolute;left:8px;bottom:44px;right:auto;top:auto;z-index:30;display:grid;grid-template-columns:repeat(3,44px);gap:5px;padding:8px;background:#fff;border:1px solid rgba(25,40,60,.2);border-radius:11px;box-shadow:0 8px 20px rgba(20,30,50,.18)}
    .sticky-origin-palette[hidden]{display:none}
    .sticky-origin-page-move{width:42px;min-width:42px;max-width:42px;min-height:30px;padding:0 1px;font-size:10px;border:1px solid rgba(30,40,60,.18);border-radius:6px;background:rgba(255,255,255,.4);color:#273040}
    .sticky-origin-pages{display:flex;align-items:center;gap:3px;margin-left:auto;white-space:nowrap}
    .sticky-origin-pages button{min-width:44px;min-height:44px;padding:6px;border:1px solid transparent;border-radius:9px;background:transparent;color:var(--ink-soft);font-size:12px;font-weight:800}
    .sticky-origin-pages button[aria-pressed="true"]{background:var(--accent-bg);color:var(--accent-dark);border-color:var(--accent)}
    .sticky-origin-pages button:hover{background:var(--hover)}
    .sticky-origin-palette button{width:44px;min-width:44px;height:44px;min-height:44px;border-radius:10px;border:2px solid transparent;background:var(--swatch);color:#253046;font-size:0}
    .sticky-origin-palette button[aria-pressed="true"]{border-color:#3d4ab5;box-shadow:inset 0 0 0 3px white}
    .sticky-origin-empty{padding:30px;font-size:14px;color:var(--muted)}
    .sticky-origin-error{padding:18px;border:1px solid var(--line);border-radius:12px;color:var(--ink-soft);background:var(--paper)}
    .sticky-origin-error strong{display:block;margin-bottom:6px;color:var(--ink)}
    /* Collapsing changes only the presentation height; saved dimensions stay intact. */
    .sticky-origin-card.sticky-origin-card-collapsed{height:48px!important;min-height:48px!important}
    .sticky-origin-card-collapsed .sticky-origin-card-head{flex:1;border-bottom:0}
    .sticky-origin-card-collapsed textarea,.sticky-origin-card-collapsed .sticky-origin-palette,
    .sticky-origin-card-collapsed .sticky-origin-foot,.sticky-origin-card-collapsed .sticky-origin-save-feedback,
    .sticky-origin-card-collapsed .sticky-origin-order,.sticky-origin-card-collapsed .sticky-origin-front,
    .sticky-origin-card-collapsed .sticky-origin-back,.sticky-origin-card-collapsed .sticky-origin-expand{display:none!important}
    .sticky-origin-expand,.sticky-origin-collapse{padding:0 4px;white-space:nowrap}
    .sticky-origin-expand svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
    .sticky-origin-editor:not([open]){display:none}
    .sticky-origin-editor[open]{position:fixed;inset:0;display:flex;flex-direction:column;gap:0;box-sizing:border-box;
      width:min(960px,calc(100vw - 36px));height:min(780px,calc(100dvh - 36px));
      min-width:0;max-width:none;max-height:none;margin:auto;padding:0;border:1px solid rgba(34,45,72,.24);
      border-radius:17px;box-shadow:0 24px 76px rgba(20,31,52,.22);color:#273040;background:var(--sticky-paper,#faf3c9)}
    .sticky-origin-editor::backdrop{background:rgba(25,32,52,.5)}
    .sticky-origin-editor-header,.sticky-origin-editor-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 17px;min-height:55px}
    .sticky-origin-editor-header{border-bottom:1px solid rgba(25,40,60,.15)}
    .sticky-origin-editor-header strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:15px}
    .sticky-origin-editor-header button{min-width:44px;min-height:44px;border:1px solid rgba(27,37,61,.2);
      border-radius:10px;background:rgba(255,255,255,.55);color:#273040;cursor:pointer}
    .sticky-origin-editor textarea{flex:1;min-height:0;resize:none;border:0;outline:0;padding:22px 25px;
      background:transparent;color:#273040;font-size:16px;line-height:1.85;overflow:auto}
    .sticky-origin-editor textarea:focus-visible{outline:2px solid #4659cc;outline-offset:-3px}
    .sticky-origin-editor-footer{border-top:1px solid rgba(25,40,60,.12);font-size:12px}
    .sticky-origin-editor-footer [data-sticky-status][hidden]{display:none}
    @media(max-width:767px){
      .sticky-origin-toolbar input{max-width:none;flex:1 1 100%}
      .sticky-origin-stage{max-height:none;min-height:0;overflow:visible;background:transparent;border:0}
      .sticky-origin-canvas{display:grid;gap:12px;width:100%;height:auto;min-width:0;min-height:0;background:none}
      .sticky-origin-card{position:relative!important;left:auto!important;top:auto!important;width:100%!important;height:260px!important;box-shadow:none}
      .sticky-origin-card.sticky-origin-card-collapsed{height:48px!important;min-height:48px!important}
      .sticky-origin-grip{cursor:default;touch-action:auto}
      .sticky-origin-order{display:flex}
      .sticky-origin-foot{padding:4px 10px 7px;grid-template-columns:44px 44px minmax(0,1fr) 44px auto;gap:5px}
      .sticky-origin-card button.sticky-origin-color-toggle,.sticky-origin-card button.sticky-origin-delete{width:44px;height:44px;min-width:44px;min-height:44px}
      .sticky-origin-page-move{width:44px;min-width:44px;max-width:44px}
      .sticky-origin-save-feedback{bottom:62px}
      .sticky-origin-card button.sticky-origin-resize{display:none}
      .sticky-origin-front,.sticky-origin-back,.sticky-origin-toolbar .sticky-fit{display:none}
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
    let query = '', colorFilter = 'all', indexOpen = false, allView = false, boardScale = 1, activePage = 1, composing = false, collapsedIds = new Set(), saving = new Map(), timers = new Map(), drafts = new Map(), activeMovement = null;
    const pendingWrites=new Set();
    const contentSaves=new Map();
    const panel = document.createElement('section');
    panel.className = 'sticky-origin-panel';
    panel.setAttribute('aria-label', '個人付箋ボード');
    container.replaceChildren(panel);
    const notePage = note => Number.isInteger(note?.layout?.page) && note.layout.page>=1 && note.layout.page<=5 ? note.layout.page : 1;
    const pageNotes = () => data.filter(note=>notePage(note)===activePage);
    // The visible canvas grid is 28px. Only Shift opts into snapping.
    function snapGrid(value,max){
      return Math.max(0,Math.min(Math.floor(max/28)*28,Math.round(value/28)*28));
    }
    const pageKey = () => 'originStickyPageV660:'+encodeURIComponent(ownerRoom)+':'+encodeURIComponent(ownerUid);
    function readPage(){try{const value=Number(localStorage.getItem(pageKey()));return Number.isInteger(value)&&value>=1&&value<=5?value:1;}catch{return 1;}}
    function savePage(){try{localStorage.setItem(pageKey(),String(activePage));}catch{}}
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
      // Preserve pending/error feedback without displaying a permanent "saved" label.
      const show = message !== '保存済み';
      if (show) saving.set(id,message);
      else saving.delete(id);
      for(const feedback of panel.querySelectorAll('[data-sticky-status="'+id+'"]')){
        feedback.textContent=show?message:'';
        feedback.hidden=!show;
      }
      if (message.includes('できません') || message.includes('競合'))
        badge(message.includes('競合') ? '保存できませんでした。最新の状態を確認してください' : message);
    }
    async function commit(id, field, values) {
      const note = noteFromId(id);
      if (!note || !isReady()) return {ok:false,error:'unavailable'};
      const committingUid=ownerUid;
      statusMessage(id, '保存中…');
      const token=Symbol('sticky-write');
      pendingWrites.add(token);
      let result;
      try {
        result=await service.dispatch({
          type:'sticky.'+field, id, values,
          expectedRevision:note[field].revision,
          ownerUid, ownerRoom
        });
      } catch {
        result={ok:false,error:'write-failed'};
      } finally {
        pendingWrites.delete(token);
      }
      if (disposed || !isReady() || ownerUid!==committingUid) return result;
      if(result.ok&&result.note&&result.note.ownerUid===ownerUid&&result.note.roomId===ownerRoom){
        const current=noteFromId(id);
        if(current&&result.note[field]?.revision>current[field]?.revision)
          data=data.map(item=>item.id===id?result.note:item);
      }
      statusMessage(id, result.ok ? '保存済み' : (result.error === 'conflict' ? '競合：最新を確認してください' : '保存できませんでした'));
      if (!result.ok && result.error === 'conflict') {
        const draft=drafts.get(id);
        if (draft && field==='content') drafts.set(id,draft);
      }
      return result;
    }
    function saveContent(id,text) {
      // One in-flight text transaction per note: later edits wait for a fresh
      // content revision, so a slow first write cannot erase a newer draft.
      const earlier=contentSaves.get(id) || Promise.resolve({ok:true});
      const next=earlier.then(()=>commit(id,'content',{text}),()=>commit(id,'content',{text}))
        .then(result=>{
          if(result.ok && drafts.get(id)===text)drafts.delete(id);
          return result;
        });
      contentSaves.set(id,next);
      void next.finally(()=>{if(contentSaves.get(id)===next)contentSaves.delete(id);});
      return next;
    }
    function buildCard(note) {
      const card=createElement('article','sticky-origin-card');
      card.dataset.id=note.id;
      card.classList.toggle('sticky-origin-card-collapsed',collapsedIds.has(note.id));
      card.style.setProperty('--sticky-paper',colorHex[note.appearance.color]||colorHex.lemon);
      card.style.left=note.layout.x+'px';
      card.style.top=note.layout.y+'px';
      card.style.width=note.layout.width+'px';
      card.style.height=note.layout.height+'px';
      card.style.zIndex=String(note.layout.zIndex);
      const top=createElement('div','sticky-origin-card-head');
      const grip=button('','sticky-origin-grip');
      grip.dataset.stickyMove=note.id;
      grip.title='ドラッグで自由に移動／Shift＋ドラッグで28pxのマス目に吸着。方向キーでも移動できます';
      grip.setAttribute('aria-label','付箋を移動。Shiftキーを押しながらドラッグするとマス目に吸着します');
      const symbol=createElement('span','',note.content.text.split('\n')[0].slice(0,24)||'新しい付箋');
      grip.append(symbol);
      const remove=button('','sticky-origin-delete');
      remove.dataset.stickyDelete=note.id;
      remove.setAttribute('aria-label','この付箋を削除');
      remove.title='この付箋を削除';
      const trashIcon=document.createElementNS('http://www.w3.org/2000/svg','svg');
      trashIcon.setAttribute('viewBox','0 0 24 24');
      trashIcon.setAttribute('aria-hidden','true');
      trashIcon.setAttribute('focusable','false');
      const trashPath=document.createElementNS('http://www.w3.org/2000/svg','path');
      trashPath.setAttribute('d','M4 7h16 M9 7V5h6v2 M7 7l1 12h8l1-12 M10 10v6 M14 10v6');
      trashIcon.append(trashPath);
      remove.append(trashIcon);
      const mobileActions=createElement('div','sticky-origin-order');
      const byOrder=pageNotes().slice().sort((a,b)=>a.mobile.order-b.mobile.order
        || a.createdAt-b.createdAt || a.id.localeCompare(b.id));
      const mobileIndex=byOrder.findIndex(item=>item.id===note.id);
      for(const [direction,label] of [['up','上へ'],['down','下へ']]){
        const control=button(label);
        control.dataset.stickyOrder=direction;
        control.dataset.id=note.id;
        control.setAttribute('aria-label','付箋を'+label+'移動');
        control.disabled=direction==='up'?mobileIndex===0:mobileIndex===byOrder.length-1;
        mobileActions.append(control);
      }
      const front=button('前面','sticky-origin-front');
      front.dataset.stickyFront=note.id;
      front.setAttribute('aria-label','この付箋を最前面へ');
      const back=button('背面','sticky-origin-back');
      back.dataset.stickyBack=note.id;
      back.setAttribute('aria-label','この付箋を最背面へ');
      const focus=button('','sticky-origin-expand');
      focus.dataset.stickyExpand=note.id;
      focus.setAttribute('aria-label','付箋を大きく編集');
      focus.title='大きく編集（元のサイズは保持します）';
      const maximize=document.createElementNS('http://www.w3.org/2000/svg','svg');
      maximize.setAttribute('viewBox','0 0 24 24');
      maximize.setAttribute('aria-hidden','true');
      const maxPath=document.createElementNS('http://www.w3.org/2000/svg','path');
      maxPath.setAttribute('d','M4 10V4h6 M14 4h6v6 M20 14v6h-6 M10 20H4v-6');
      maximize.append(maxPath);focus.append(maximize);
      const folded=collapsedIds.has(note.id);
      const fold=button(folded?'＋':'－','sticky-origin-collapse');
      fold.dataset.stickyCollapse=note.id;
      fold.setAttribute('aria-label',folded?'付箋を展開':'付箋を折りたたむ');
      fold.setAttribute('aria-pressed',String(folded));
      fold.title=folded?'展開':'折りたたむ';
      const colorToggle=button('','sticky-origin-color-toggle');
      colorToggle.dataset.stickyColorToggle=note.id;
      colorToggle.setAttribute('aria-label','付箋の色を変更');
      colorToggle.setAttribute('aria-haspopup','true');
      colorToggle.title='付箋の色を変更';
      colorToggle.setAttribute('aria-expanded','false');
      colorToggle.setAttribute('aria-controls','stickyPalette-'+note.id);
      colorToggle.append(createElement('span','sticky-origin-color-preview'));
      top.append(grip,mobileActions,front,back,focus,fold);
      const textarea=createElement('textarea');
      textarea.dataset.stickyText=note.id;
      textarea.setAttribute('aria-label','付箋本文');
      textarea.maxLength=2000;
      textarea.value=drafts.get(note.id)??note.content.text;
      textarea.spellcheck=false;
      const colors=createElement('div','sticky-origin-palette');
      colors.hidden=true;colors.id='stickyPalette-'+note.id;
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
      const initialFeedback=saving.get(note.id)||'';
      const feedback=createElement('span','sticky-origin-save-feedback',initialFeedback);
      feedback.dataset.stickyStatus=note.id;
      feedback.setAttribute('role','status');
      feedback.setAttribute('aria-live','polite');
      feedback.hidden=!initialFeedback;
      const foot=createElement('div','sticky-origin-foot');
      const spacer=createElement('span','sticky-origin-foot-spacer');
      spacer.setAttribute('aria-hidden','true');
      const pageMove=createElement('select','sticky-origin-page-move');
      pageMove.dataset.stickyPageMove=note.id;
      pageMove.setAttribute('aria-label','付箋の移動先ページ');
      for(let index=1;index<=5;index++){
        const option=createElement('option','','P'+index);
        option.value=String(index);pageMove.append(option);
      }
      pageMove.value=String(notePage(note));
      const resize=button('↘','sticky-origin-resize');
      resize.dataset.stickyResize=note.id;
      resize.setAttribute('aria-label','ドラッグで付箋の大きさを変更');
      // Resize handle occupies its own footer grid cell; never overlays the counter.
      foot.append(colorToggle,remove,spacer,pageMove,createElement('span','sticky-origin-char-count',textarea.value.length+'/2000'),resize);
      card.append(top,colors,textarea,feedback,foot);
      return card;
    }
    function openExpandedEditor(note) {
      if(!note||!isReady())return;
      const previous=panel.querySelector('dialog.sticky-origin-editor[open]');
      if(previous)previous.close();
      const dialog=createElement('dialog','sticky-origin-editor');
      dialog.style.setProperty('--sticky-paper',colorHex[note.appearance.color]||colorHex.lemon);
      dialog.setAttribute('aria-label','付箋の拡大編集');
      dialog.dataset.stickyEditor=note.id;
      const header=createElement('div','sticky-origin-editor-header');
      const title=createElement('strong','',note.content.text.split('\n')[0].slice(0,70)||'新しい付箋');
      const close=button('閉じる');
      close.dataset.stickyExpandClose='';
      close.setAttribute('aria-label','拡大編集を閉じる');
      header.append(title,close);
      const text=createElement('textarea');
      text.dataset.stickyText=note.id;
      text.setAttribute('aria-label','付箋本文を大きく編集');
      text.maxLength=2000;
      text.value=drafts.get(note.id)??note.content.text;
      text.spellcheck=false;
      const footer=createElement('div','sticky-origin-editor-footer');
      const message=saving.get(note.id)||'';
      const status=createElement('span','',message);
      status.dataset.stickyStatus=note.id;
      status.setAttribute('role','status');
      status.setAttribute('aria-live','polite');
      status.hidden=!message;
      const count=createElement('span','sticky-origin-char-count',text.value.length+'/2000');
      footer.append(status,count);
      dialog.append(header,text,footer);
      dialog.addEventListener('cancel',event=>{
        if(composing)event.preventDefault();
      });
      dialog.addEventListener('close',()=>{
        dialog.remove();
        if(disposed)return;
        // Preserve an unfinished autosave draft while returning to the board.
        refreshStickyCards(panel.querySelector('.sticky-origin-canvas'));
        panel.querySelector('[data-sticky-expand="'+note.id+'"]')?.focus({preventScroll:true});
      },{once:true});
      panel.append(dialog);
      dialog.showModal();
      text.focus();
    }
    function refreshStickyCards(canvas) {
      if(!canvas)return;
      const term=query.normalize('NFKC').toLocaleLowerCase('ja');
      const shown=pageNotes().filter(note=>(colorFilter==='all'||note.appearance.color===colorFilter)
        && (!term || note.content.text.normalize('NFKC').toLocaleLowerCase('ja').includes(term)))
        .sort((a,b)=>a.mobile.order-b.mobile.order||a.createdAt-b.createdAt||a.id.localeCompare(b.id));
      canvas.replaceChildren();
      if(!shown.length) {
        canvas.append(createElement('p','sticky-origin-empty',
          term||colorFilter!=='all'?'条件に合う付箋はありません':'このページにはまだ付箋がありません。「＋ 付箋を追加」で作成できます。'));
      } else shown.forEach(note=>canvas.append(buildCard(note)));
    }
    // This index is independent of canvas overlap and active filters.
    // Labels come from plain text; never render personal note content as HTML.
    function populateStickyIndex(index) {
      if(!index)return;
      index.replaceChildren();
      index.append(createElement('p','sticky-origin-index-label','全ページの付箋一覧 · '+data.length+'枚'));
      const grid=createElement('div','sticky-origin-index-grid');
      const ordered=data.slice().sort((a,b)=>a.mobile.order-b.mobile.order
        || a.createdAt-b.createdAt || a.id.localeCompare(b.id));
      for(const note of ordered){
        const entry=button('', 'sticky-origin-index-entry');
        entry.dataset.stickyIndexSelect=note.id;
        const title=note.content.text.split('\n').find(line=>line.trim())?.trim().slice(0,42) || '新しい付箋';
        entry.setAttribute('aria-label',title+'を表示');
        const swatch=createElement('span','sticky-origin-index-swatch');
        swatch.style.backgroundColor=colorHex[note.appearance.color]||colorHex.lemon;
        swatch.setAttribute('aria-hidden','true');
        entry.append(swatch,createElement('span','sticky-origin-index-title','P'+notePage(note)+' · '+title));
        grid.append(entry);
      }
      if(!ordered.length)grid.append(createElement('p','sticky-origin-index-empty','付箋はまだありません'));
      index.append(grid);
    }
    function makeStickyIndex() {
      const index=createElement('aside','sticky-origin-index');
      index.dataset.stickyIndex='';
      index.setAttribute('aria-label','すべての個人付箋');
      populateStickyIndex(index);
      return index;
    }
    let stageObserver=null;
    function applyBoardScale() {
      const stage=panel.querySelector('.sticky-origin-stage');
      const canvas=stage?.querySelector('.sticky-origin-canvas');
      if(!stage||!canvas)return;
      if(window.matchMedia('(max-width:767px)').matches){
        boardScale=1;canvas.style.zoom='1';return;
      }
      // Keep the 1400px logical board; fit it to the actual visible width.
      // Drag/pointer calculations continue to use boardScale.
      const widthScale=Math.max(.1,(stage.clientWidth-12)/1400);
      const heightScale=allView?Math.max(.1,(Math.max(440,stage.clientHeight)-18)/900):1;
      boardScale=Math.max(.1,Math.min(1,widthScale,heightScale));
      canvas.style.zoom=String(boardScale);
    }
    function draw() {
      if (disposed) return;
      if (panel.querySelector('textarea:focus') || composing || activeMovement) return;
      // Synchronization while searching must not replace the focused input:
      // doing so interrupts Japanese IME and loses the keyboard cursor.
      const focusedToolbar=panel.querySelector('.sticky-origin-toolbar input[type="search"]:focus, .sticky-origin-toolbar select:focus');
      const focusedIndex=panel.querySelector('.sticky-origin-index-entry:focus');
      if((focusedToolbar||focusedIndex)&&isReady()){
        refreshStickyCards(panel.querySelector('.sticky-origin-canvas'));
        if(focusedToolbar)populateStickyIndex(panel.querySelector('[data-sticky-index]'));
        const label=panel.querySelector('.sticky-origin-state');
        if(label)label.textContent='P'+activePage+' · '+pageNotes().length+'枚 / 全'+data.length+'枚';
        return;
      }
      if(stageObserver){stageObserver.disconnect();stageObserver=null;}
      panel.replaceChildren();
      const toolbar=createElement('div','sticky-origin-toolbar');
      const search=createElement('input');
      search.type='search';search.setAttribute('aria-label','個人付箋を検索');
      search.placeholder='付箋の本文を検索';search.value=query;
      search.addEventListener('input',()=>{
        // Leave the search input mounted while filtering and composing Japanese.
        query=search.value;
        refreshStickyCards(panel.querySelector('.sticky-origin-canvas'));
      });
      const colorSelect=createElement('select');
      colorSelect.dataset.stickyColorFilter='';
      colorSelect.setAttribute('aria-label','付箋の色で絞り込む');
      for(const [key,label] of [['all','すべての色'],...COLORS]){
        const option=createElement('option','',label);
        option.value=key;colorSelect.append(option);
      }
      colorSelect.value=colorFilter;
      colorSelect.addEventListener('change',()=>{
        colorFilter=colorSelect.value;
        refreshStickyCards(panel.querySelector('.sticky-origin-canvas'));
      });
      const fit=button(allView?'原寸表示':'全体表示','sticky-fit');
      fit.dataset.stickyAllView='';
      fit.setAttribute('aria-pressed',String(allView));
      fit.addEventListener('click',()=>{
        allView=!allView;
        fit.textContent=allView?'原寸表示':'全体表示';
        fit.setAttribute('aria-pressed',String(allView));
        applyBoardScale();
      });
      const indexToggle=button('付箋一覧','sticky-origin-index-toggle');
      indexToggle.dataset.stickyIndexToggle='';
      indexToggle.setAttribute('aria-expanded',String(indexOpen));
      indexToggle.setAttribute('aria-controls','originStickyIndexV659');
      indexToggle.addEventListener('click',()=>{
        indexOpen=!indexOpen;
        indexToggle.setAttribute('aria-expanded',String(indexOpen));
        const old=panel.querySelector('[data-sticky-index]');
        if(old)old.remove();
        if(indexOpen&&isReady()){
          const index=makeStickyIndex();
          index.id='originStickyIndexV659';
          panel.insertBefore(index,panel.querySelector('.sticky-origin-stage'));
        }
      });
      const add=button('＋ 付箋を追加','sticky-add');
      add.disabled=!isReady();
      add.addEventListener('click',async()=>{
        if (!isReady()) return;
        const result=await service.dispatch({type:'sticky.create',ownerUid,ownerRoom,page:activePage});
        if (!result.ok) {badge('付箋を作成できませんでした');return;}
        const newId=result.id;
        requestAnimationFrame(()=>panel.querySelector('[data-sticky-text="'+newId+'"]')?.focus());
      });
      const label=createElement('span','sticky-origin-state',state==='ready' ? 'P'+activePage+' · '+pageNotes().length+'枚 / 全'+data.length+'枚' :
        state==='loading' ? '読み込み中…' : '付箋データを利用できません');
      const pages=createElement('div','sticky-origin-pages');
      pages.setAttribute('role','group');pages.setAttribute('aria-label','付箋ページ');
      for(let number=1;number<=5;number++){
        const control=button(String(number));
        control.dataset.stickyPage=String(number);
        control.setAttribute('aria-label','付箋の'+number+'ページ目');
        control.setAttribute('aria-pressed',String(activePage===number));
        control.addEventListener('click',()=>{
          if(activePage===number)return;
          if((composing||drafts.size||timers.size||pendingWrites.size||contentSaves.size)
             &&!confirm('この付箋には未保存の変更があります。ページを切り替えますか？'))return;
          activePage=number;savePage();
          draw();
        });
        pages.append(control);
      }
      toolbar.append(search,colorSelect,indexToggle,fit,add,pages,label);panel.append(toolbar);
      if (!isReady()) {
        const error=createElement('div','sticky-origin-error');
        error.append(createElement('strong','','付箋の保存先に接続できません'),
          createElement('span','','ネットワークの接続状態を確認してください。データが読み込めない間は保存操作を停止しています。'));
        panel.append(error);return;
      }
      const stage=createElement('div','sticky-origin-stage');
      const canvas=createElement('div','sticky-origin-canvas');
      refreshStickyCards(canvas);
      stage.append(canvas);
      if(indexOpen){
        const index=makeStickyIndex();
        index.id='originStickyIndexV659';
        panel.append(index);
      }
      panel.append(stage);
      if(stageObserver)stageObserver.disconnect();
      if(typeof ResizeObserver!=='undefined'){
        stageObserver=new ResizeObserver(applyBoardScale);
        stageObserver.observe(stage);
      }
      applyBoardScale();
    }
    let unsubscribe = () => {};
    if (service && typeof service.subscribe === 'function') {
      unsubscribe = service.subscribe(next => {
        if (disposed) return;
        const changedIdentity=next.ownerUid!==ownerUid||next.ownerRoom!==ownerRoom;
        ownerUid=next.ownerUid;ownerRoom=next.ownerRoom;state=next.status;data=next.notes||[];
        if(changedIdentity){activePage=readPage();collapsedIds=new Set(service.readCollapsedNotes?.()||[]);}
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
        await saveContent(id,draft);
      },700));
      statusMessage(id,'未保存');
    }
    panel.addEventListener('input',e=>{
      if(e.target.matches('[data-sticky-text]')){
        const id=e.target.dataset.stickyText;
        const len=e.target.closest('.sticky-origin-card,.sticky-origin-editor')?.querySelector('.sticky-origin-char-count');
        if(len)len.textContent=e.target.value.length+'/2000';
        if(!composing&&!e.isComposing)schedule(id,e.target.value);
      }
    });
    panel.addEventListener('focusout',e=>{
      if(!e.target.matches('[data-sticky-text]'))return;
      const id=e.target.dataset.stickyText;
      if(timers.has(id)){clearTimeout(timers.get(id));timers.delete(id);
        const text=drafts.get(id);
        if(text!==undefined)void saveContent(id,text);
      }
      // Once writing has stopped, subsequent snapshots may safely repaint.
    });
    panel.addEventListener('click',async e=>{
      if(!e.target.closest('[data-sticky-color-toggle],.sticky-origin-palette')){
        panel.querySelectorAll('.sticky-origin-palette').forEach(menu=>{menu.hidden=true;});
        panel.querySelectorAll('[data-sticky-color-toggle]').forEach(toggle=>toggle.setAttribute('aria-expanded','false'));
      }
      const closeEditor=e.target.closest('[data-sticky-expand-close]');
      if(closeEditor){closeEditor.closest('dialog')?.close();return;}
      const expand=e.target.closest('[data-sticky-expand]');
      if(expand){openExpandedEditor(noteFromId(expand.dataset.stickyExpand));return;}
      const collapse=e.target.closest('[data-sticky-collapse]');
      if(collapse){
        const id=collapse.dataset.stickyCollapse;
        if(!isReady()||!noteFromId(id))return;
        if(drafts.has(id)||timers.has(id)||contentSaves.has(id)){
          badge('保存完了後に折りたたんでください');return;
        }
        if(collapsedIds.has(id))collapsedIds.delete(id);else collapsedIds.add(id);
        service.saveCollapsedNotes?.([...collapsedIds]);
        refreshStickyCards(panel.querySelector('.sticky-origin-canvas'));
        panel.querySelector('[data-sticky-collapse="'+id+'"]')?.focus({preventScroll:true});
        return;
      }
      const pick=e.target.closest('[data-sticky-index-select]');
      if(pick){
        if(!isReady())return;
        const note=noteFromId(pick.dataset.stickyIndexSelect);
        if(!note)return;
        // The index always includes hidden notes. Show the selected note
        // without changing any other card or the user's stored filter choices.
        query='';
        colorFilter='all';
        if(notePage(note)!==activePage){
          activePage=notePage(note);savePage();
          panel.querySelectorAll('[data-sticky-page]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.stickyPage)===activePage)));
        }
        const search=panel.querySelector('.sticky-origin-toolbar input[type="search"]');
        const filter=panel.querySelector('[data-sticky-color-filter]');
        if(search)search.value='';
        if(filter)filter.value='all';
        refreshStickyCards(panel.querySelector('.sticky-origin-canvas'));
        let zIndex=note.layout.zIndex;
        if(!window.matchMedia('(max-width:767px)').matches){
          const maxZ=Math.max(0,...pageNotes().map(item=>item.layout.zIndex));
          if(zIndex<maxZ&&maxZ<1000000000){
            const moved=await commit(note.id,'layout',{zIndex:maxZ+1});
            if(moved.ok)zIndex=maxZ+1;
            else badge('付箋を前面に出せませんでした。最新の状態を確認してください。');
          }
        }
        const card=panel.querySelector('.sticky-origin-card[data-id="'+note.id+'"]');
        if(card){
          card.style.zIndex=String(zIndex);
          card.scrollIntoView({block:'nearest',inline:'nearest'});
          card.querySelector('.sticky-origin-grip')?.focus({preventScroll:true});
        }
        return;
      }
      const front=e.target.closest('[data-sticky-front]');
      if(front){
        if(!isReady())return;
        const note=noteFromId(front.dataset.stickyFront);
        if(!note)return;
        const top=Math.max(0,...pageNotes().map(item=>item.layout.zIndex));
        if(top>=1000000000){badge('これ以上前面に移動できません');return;}
        const result=await commit(note.id,'layout',{zIndex:top+1});
        if(result.ok){
          const card=panel.querySelector('.sticky-origin-card[data-id="'+note.id+'"]');
          if(card)card.style.zIndex=String(top+1);
        }
        return;
      }
      const back=e.target.closest('[data-sticky-back]');
      if(back){
        if(!isReady())return;
        const note=noteFromId(back.dataset.stickyBack);
        if(!note)return;
        const bottom=Math.min(0,...pageNotes().map(item=>item.layout.zIndex));
        if(bottom<=-1000000000){badge('これ以上背面に移動できません');return;}
        const result=await commit(note.id,'layout',{zIndex:bottom-1});
        if(result.ok){
          const card=panel.querySelector('.sticky-origin-card[data-id="'+note.id+'"]');
          if(card)card.style.zIndex=String(bottom-1);
        }
        return;
      }
      const colorToggle=e.target.closest('[data-sticky-color-toggle]');
      if(colorToggle){
        const card=colorToggle.closest('.sticky-origin-card');
        const menu=card?.querySelector('.sticky-origin-palette');
        if(!menu)return;
        const opening=menu.hidden;
        panel.querySelectorAll('.sticky-origin-palette').forEach(other=>{other.hidden=true;});
        panel.querySelectorAll('[data-sticky-color-toggle]').forEach(button=>button.setAttribute('aria-expanded','false'));
        menu.hidden=!opening;colorToggle.setAttribute('aria-expanded',String(opening));
        return;
      }
      const orderControl=e.target.closest('[data-sticky-order]');
      if(orderControl){
        if(!isReady())return;
        const result=await service.dispatch({
          type:'sticky.mobileMove',id:orderControl.dataset.id,
          direction:orderControl.dataset.stickyOrder,ownerUid,ownerRoom
        });
        if(!result.ok)badge('並び順を変更できませんでした。再読み込みしてお試しください。');
        return;
      }
      const color=e.target.closest('[data-sticky-color]');
      if(color){
        const id=color.dataset.id;
        if(await commit(id,'appearance',{color:color.dataset.stickyColor}).then(r=>r.ok)){
          panel.querySelectorAll('[data-sticky-color][data-id="'+id+'"]').forEach(b=>{
            b.setAttribute('aria-pressed',String(b.dataset.stickyColor===color.dataset.stickyColor));
          });
          color.closest('.sticky-origin-card')?.style.setProperty('--sticky-paper',colorHex[color.dataset.stickyColor]);
          const menu=color.closest('.sticky-origin-palette');if(menu)menu.hidden=true;
          const toggle=color.closest('.sticky-origin-card')?.querySelector('[data-sticky-color-toggle]');
          if(toggle)toggle.setAttribute('aria-expanded','false');
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
    panel.addEventListener('change',async e=>{
      const select=e.target.closest('[data-sticky-page-move]');
      if(!select||!isReady())return;
      const note=noteFromId(select.dataset.stickyPageMove);
      if(!note)return;
      const page=Number(select.value);
      if(page===notePage(note))return;
      const result=await commit(note.id,'layout',{page});
      if(!result.ok){select.value=String(notePage(note));badge('付箋のページを移動できませんでした');}
      else draw();
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
      const dx=(e.clientX-d.x)/boardScale,dy=(e.clientY-d.y)/boardScale;
      if(Math.abs(dx)+Math.abs(dy)<3&&!d.moved)return;
      d.moved=true;
      if(d.isSize){
        d.card.style.width=Math.max(220,Math.min(760,1400-d.initial.x,d.initial.width+Math.round(dx)))+'px';
        d.card.style.height=Math.max(160,Math.min(720,900-d.initial.y,d.initial.height+Math.round(dy)))+'px';
      } else {
        const x=Math.max(0,Math.min(1400-d.initial.width,d.initial.x+Math.round(dx)));
        const y=Math.max(0,Math.min(900-d.initial.height,d.initial.y+Math.round(dy)));
        d.card.style.left=(e.shiftKey?snapGrid(x,1400-d.initial.width):x)+'px';
        d.card.style.top=(e.shiftKey?snapGrid(y,900-d.initial.height):y)+'px';
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
      if(e.key==='Escape'){
        const menu=panel.querySelector('.sticky-origin-palette:not([hidden])');
        if(menu){
          e.preventDefault();
          menu.hidden=true;
          const trigger=menu.closest('.sticky-origin-card')?.querySelector('[data-sticky-color-toggle]');
          trigger?.setAttribute('aria-expanded','false');trigger?.focus();
          return;
        }
      }
      const grip=e.target.closest('[data-sticky-move]');
      if(!grip||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
      const note=noteFromId(grip.dataset.stickyMove);
      if(!note||!isReady())return;
      e.preventDefault();
      const amount=e.shiftKey?28:10;
      const maxX=1400-note.layout.width,maxY=900-note.layout.height;
      const x=Math.max(0,Math.min(maxX,note.layout.x+(e.key==='ArrowLeft'?-amount:e.key==='ArrowRight'?amount:0)));
      const y=Math.max(0,Math.min(maxY,note.layout.y+(e.key==='ArrowUp'?-amount:e.key==='ArrowDown'?amount:0)));
      const values={x:e.shiftKey?snapGrid(x,maxX):x,y:e.shiftKey?snapGrid(y,maxY):y};
      const res=await commit(note.id,'layout',values);
      if(res.ok){grip.closest('.sticky-origin-card').style.left=values.x+'px';grip.closest('.sticky-origin-card').style.top=values.y+'px';}
    });
    window.addEventListener('resize',applyBoardScale);
    draw();
    return {
      // Origin checks before changing route or memo type, so editing cannot
      // silently discard delayed or rejected writes.
      hasPending(){return !disposed && (composing || drafts.size>0 || timers.size>0 || pendingWrites.size>0 || contentSaves.size>0);},
      destroy(){
        if(disposed)return;
        disposed=true;
        window.removeEventListener('resize',applyBoardScale);
        unsubscribe();
        if(stageObserver)stageObserver.disconnect();
        panel.querySelector('dialog.sticky-origin-editor[open]')?.close();
        for(const timer of timers.values())clearTimeout(timer);
        timers.clear();drafts.clear();saving.clear();data=[];panel.replaceChildren();
      }
    };
  }
  root.WorkBoardOriginStickyPanelV659=Object.freeze({createPanel});
})(window);
