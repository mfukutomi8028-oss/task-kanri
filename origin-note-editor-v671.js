/* Origin direct rich-text editing over canonical plain text and validated marks. */
(function installOriginNoteEditorV671(root){
  'use strict';
  if(root.WorkBoardOriginNoteEditorV671)return;
  const model=root.WorkBoardNoteTextFormatV671;
  if(!model)return;
  const STYLES=`
  :host,[data-origin-note-surface="light"]{
    --origin-note-red:#8f2034;--origin-note-blue:#214b95;--origin-note-green:#175c40;
    --origin-note-purple:#623982;--origin-note-amber:#714411
  }
  :host([data-theme="dark"]),[data-theme="dark"]{
    --origin-note-red:#ffacb2;--origin-note-blue:#a6c8ff;--origin-note-green:#94dbb5;
    --origin-note-purple:#d9baff;--origin-note-amber:#ffca91
  }
  [data-origin-note-surface="light"]{
    --origin-note-red:#8f2034;--origin-note-blue:#214b95;--origin-note-green:#175c40;
    --origin-note-purple:#623982;--origin-note-amber:#714411
  }
  [data-note-format-color=red]{color:var(--origin-note-red,#8f2034)}
  [data-note-format-color=blue]{color:var(--origin-note-blue,#214b95)}
  [data-note-format-color=green]{color:var(--origin-note-green,#175c40)}
  [data-note-format-color=purple]{color:var(--origin-note-purple,#623982)}
  [data-note-format-color=amber]{color:var(--origin-note-amber,#714411)}
  [data-note-format-size=small]{font-size:.875em}
  [data-note-format-size=large]{font-size:1.25em}
  [data-note-format-size=xlarge]{font-size:1.5em}
  [data-note-format-size=xxlarge]{font-size:1.75em}
  [data-note-format-size=huge]{font-size:2em}
  [data-note-format-size=display]{font-size:2.5em}
  /* Origin disables synthetic font faces globally. Explicit note marks need
     a local exception for Japanese fonts without native italic faces. */
  :is(.origin-note-editable,.memo-document,.memo-card>p,.origin-note-format-tools) em{font-style:italic;font-synthesis:weight style}
  :is(.origin-note-editable,.memo-document,.memo-card>p,.origin-note-format-tools) u{text-decoration-line:underline}
  :is(.origin-note-editable,.memo-document,.memo-card>p,.origin-note-format-tools) s{text-decoration-line:line-through}
  .origin-note-format-tools{display:flex;flex:0 0 auto;align-items:center;flex-wrap:wrap;gap:6px 12px;min-width:0;
    padding:8px 0;border-bottom:1px solid var(--note-tools-line,var(--line,#c8ced8));
    color:var(--note-tools-ink,var(--ink,#252b37));font-size:13px}
  .origin-note-format-group,.origin-note-format-choices{display:flex;align-items:center;flex-wrap:wrap;min-width:0;max-width:100%}
  .origin-note-format-group{gap:0}
  .origin-note-format-choices{gap:4px 10px}
  .origin-note-format-field{display:flex;align-items:center;gap:6px;min-width:0;max-width:100%;margin:0;white-space:nowrap;font:inherit}
  .origin-note-format-label{font-weight:650;color:var(--note-tools-muted,var(--ink-soft,#526071))}
  .origin-note-format-mixed{font-size:11px;color:var(--note-tools-muted,var(--ink-soft,#526071))}
  .origin-note-format-mixed[hidden]{display:none!important}
  .origin-note-format-tools :is(button,select){
    box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;width:auto;max-width:100%;
    padding:4px 8px;border-radius:7px;color:var(--note-tools-ink,var(--ink,#252b37));font:inherit;line-height:1;cursor:pointer
  }
  .origin-note-format-tools button{border:1px solid transparent;background:transparent}
  .origin-note-format-tools button>:is(strong,em,u,s){font-size:15px}
  .origin-note-format-tools button:hover{background:var(--note-tools-hover,var(--hover,#eef0f6))}
  .origin-note-format-tools select{min-width:76px;border:1px solid var(--note-tools-line,var(--line,#c8ced8));
    background:var(--note-tools-control,var(--paper,#fff));color-scheme:var(--note-tools-color-scheme,normal)}
  .origin-note-format-tools :is(button,select):focus-visible{outline:2px solid var(--note-tools-focus,var(--origin-focus-ring,#4659cc));outline-offset:1px}
  .origin-note-format-tools button[aria-pressed=true]{background:var(--note-tools-active,var(--accent-bg,#eef0fc));
    color:var(--note-tools-active-ink,var(--accent-dark,#3948b8));border-color:var(--note-tools-active-border,var(--accent,#4659cc))}
  .origin-note-format-tools .origin-note-format-clear{white-space:nowrap;color:var(--note-tools-muted,var(--ink-soft,#526071))}
  .origin-note-format-tools .origin-note-format-hint{flex:1 0 100%;margin:0;color:var(--note-tools-muted,var(--ink-soft,#526071));line-height:1.5}
  /* Keep the empty live region out of layout until feedback is needed. */
  .origin-note-format-tools .origin-note-format-hint:empty{position:absolute;width:0;height:0;overflow:hidden;pointer-events:none}
  @media(max-width:480px){
    .origin-note-format-choices{flex:1 1 100%;align-items:start;gap:8px}
    .origin-note-format-field{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"label mixed" "select select";
      flex:1 1 92px;gap:3px 4px;white-space:normal}
    .origin-note-format-label{grid-area:label}
    .origin-note-format-mixed{grid-area:mixed}
    .origin-note-format-field select{grid-area:select;width:100%;min-width:0}
  }
  [data-origin-note-backing]{display:none!important}
  .origin-note-editable{box-sizing:border-box;display:block;min-width:0;width:100%;min-height:100px;max-width:100%;
    background:var(--bg,#fff);color:var(--ink,#252b37);border:1px solid var(--line,#c8ced8);
    border-radius:9px;padding:11px;font-size:14px;font-weight:580;line-height:1.65;white-space:pre-wrap;
    overflow:auto;overflow-wrap:anywhere;cursor:text;user-select:text;scrollbar-width:thin}
  .origin-note-editable:focus-visible{outline:2px solid var(--origin-focus-ring,#4659cc);outline-offset:1px}
  .origin-note-editable:empty:before{content:attr(data-placeholder);color:var(--muted,#667185);pointer-events:none}
  .origin-note-editable[aria-invalid=true]{border-color:var(--red,#8f2034)}
  `;
  const FORMAT_BUTTONS=[
    [1,'太字','B','strong','b'],[2,'斜体','I','em','i'],
    [4,'下線','U','u','u'],[8,'取り消し線','S','s','']
  ];
  const COLOR_LABELS={red:'赤',blue:'青',green:'緑',purple:'紫',amber:'茶'};
  const SIZE_LABELS={small:'87.5%',large:'125%',xlarge:'150%',xxlarge:'175%',huge:'200%',display:'250%'};
  const documentFor=node=>node.ownerDocument||node;
  const styled=new WeakSet();
  function installStyles(node){
    const context=node.nodeType===9||node.nodeType===11?node:node.getRootNode();
    if(![9,11].includes(context.nodeType)||styled.has(context))return;
    const sheet=documentFor(node).createElement('style');
    sheet.textContent=STYLES;
    (context.head||context).appendChild(sheet);
    styled.add(context);
  }
  const escape=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function segments(text,format){
    const result=[];
    let offset=0;
    for(const run of model.read(text,format)){
      if(run.start>offset)result.push({text:text.slice(offset,run.start)});
      result.push({...run,text:text.slice(run.start,run.end)});
      offset=run.end;
    }
    if(offset<text.length)result.push({text:text.slice(offset)});
    return result;
  }
  function markup(text,format){
    return segments(String(text??''),format).map(seg=>{
      let part=escape(seg.text);
      for(const [flag,,,tag] of FORMAT_BUTTONS)if(seg.flags&flag)part='<'+tag+'>'+part+'</'+tag+'>';
      if(seg.color||seg.size)part='<span'+(seg.color?' data-note-format-color="'+seg.color+'"':'')
        +(seg.size?' data-note-format-size="'+seg.size+'"':'')+'>'+part+'</span>';
      return part;
    }).join('');
  }
  function renderInto(target,text,format){
    installStyles(target);
    const doc=documentFor(target),fragment=doc.createDocumentFragment();
    for(const seg of segments(String(text??''),format)){
      let rendered=doc.createTextNode(seg.text);
      for(const [flag,,,tag] of FORMAT_BUTTONS)if(seg.flags&flag){
        const mark=doc.createElement(tag);mark.append(rendered);rendered=mark;
      }
      if(seg.color||seg.size){
        const span=doc.createElement('span');
        if(seg.color)span.dataset.noteFormatColor=seg.color;
        if(seg.size)span.dataset.noteFormatSize=seg.size;
        span.append(rendered);rendered=span;
      }
      fragment.append(rendered);
    }
    target.replaceChildren(fragment);
  }
  // The editable DOM is a projection of canonical plain text and validated runs.
  // The original textarea remains the form value/constraint owner, not a second UI.
  function attach(textarea,{format=null,onChange=()=>{},toolbar=true,showInstruction=true}={}){
    installStyles(textarea);
    const doc=documentFor(textarea),element=(name,value)=>{const e=doc.createElement(name);if(value)e.textContent=value;return e;};
    const instructionText=showInstruction?'本文の文字を選択してから書式を変更できます。':'';
    const holder=element('div'),hint=element('p',instructionText);
    holder.className='origin-note-format-tools';holder.setAttribute('role','group');holder.setAttribute('aria-label','文字の書式');
    hint.className='origin-note-format-hint';hint.setAttribute('aria-live','polite');holder.append(hint);
    const surface=element('div');surface.className='origin-note-editable '+textarea.className;
    surface.dataset.originNoteEditor='';surface.contentEditable='plaintext-only';surface.tabIndex=0;
    surface.setAttribute('role','textbox');surface.setAttribute('aria-multiline','true');
    surface.setAttribute('aria-label',textarea.getAttribute('aria-label')||textarea.labels?.[0]?.textContent.trim()||'内容');
    if(textarea.required)surface.setAttribute('aria-required','true');
    surface.dataset.placeholder=textarea.placeholder||'';surface.spellcheck=textarea.spellcheck;
    const labels=Array.from(textarea.labels||[]),originalId=textarea.id;
    if(originalId){textarea.id=originalId+'Backing';surface.id=originalId;}
    const stickyId=textarea.dataset.stickyText;
    if(stickyId){surface.dataset.stickyText=stickyId;delete textarea.dataset.stickyText;surface.dataset.originNoteSurface='light';}
    textarea.dataset.originNoteBacking='';textarea.hidden=true;
    let text=textarea.value,value=model.envelope(text,model.read(text,format));
    let composing=false,edit=null,syncing=false,selected={start:0,end:0,backward:false},toolbarRange=null;
    const undo=[],redo=[],buttons=[],choiceControls=[],limit=textarea.maxLength<0?6000:textarea.maxLength;
    const controller=new AbortController();
    const listen=(target,name,f)=>target.addEventListener(name,f,{signal:controller.signal});
    const selection=()=>surface.getRootNode().getSelection?.()||doc.getSelection();
    function readSelection(){
      const s=selection();
      if(!s?.anchorNode||!s.focusNode||!surface.contains(s.anchorNode)||!surface.contains(s.focusNode))return null;
      const offset=(node,pos)=>{const r=doc.createRange();r.selectNodeContents(surface);r.setEnd(node,pos);return r.toString().length;};
      const a=offset(s.anchorNode,s.anchorOffset),b=offset(s.focusNode,s.focusOffset);
      return {start:Math.min(a,b),end:Math.max(a,b),backward:a>b};
    }
    function remember(){
      // A native select/button may leave behind a collapsed range after it
      // takes focus. Only the active text surface owns a new selection.
      if(surface.getRootNode().activeElement===surface){const r=readSelection();if(r)selected=r;}
      return selected;
    }
    function focusSelection(r=selected){
      const normalize=n=>Math.max(0,Math.min(text.length,n));
      const restored={start:normalize(r.start),end:normalize(r.end),backward:Boolean(r.backward)};
      const point=n=>{const walker=doc.createTreeWalker(surface,4);let node;while((node=walker.nextNode())){if(n<=node.length)return [node,n];n-=node.length;}return [surface,surface.childNodes.length];};
      const a=point(restored.backward?restored.end:restored.start),b=point(restored.backward?restored.start:restored.end);
      surface.focus({preventScroll:true});const s=selection();
      if(s?.setBaseAndExtent)s.setBaseAndExtent(...a,...b);
      else if(s){const range=doc.createRange();range.setStart(...point(restored.start));range.setEnd(...point(restored.end));s.removeAllRanges();s.addRange(range);}
      // focus() fires synchronously and may temporarily replace the cached
      // selection. Publish the restored range only after setting it in the DOM.
      selected=restored;
      // Replacing styled text nodes must not leave the caret outside the editor.
      const caret=doc.createRange();caret.setStart(...b);caret.collapse(true);
      const rect=caret.getBoundingClientRect(),frame=surface.getBoundingClientRect();
      const scale=frame.height/(surface.offsetHeight||1)||1;
      if(rect.height){
        if(rect.bottom>frame.bottom-6)surface.scrollTop+=(rect.bottom-frame.bottom+6)/scale;
        else if(rect.top<frame.top+6)surface.scrollTop-=(frame.top+6-rect.top)/scale;
      }
      updateToolbar();
    }
    function selectedStyle(key,runs){
      const {start,end}=selected;
      if(start===end)return 'default';
      let cursor=start,style;
      const accept=next=>{if(style===undefined)style=next;return style===next;};
      for(const run of runs){
        if(run.end<=start)continue;
        if(run.start>=end)break;
        if(run.start>cursor&&!accept('default'))return '';
        if(!accept(run[key]??'default'))return '';
        cursor=Math.min(end,run.end);
      }
      if(cursor<end&&!accept('default'))return '';
      return style??'default';
    }
    function updateToolbar(){
      for(const [button,flag] of buttons)button.setAttribute('aria-pressed',String(model.hasFlag(text,value,selected.start,selected.end,flag)));
      if(!choiceControls.length)return;
      const runs=model.read(text,value);
      for(const {key,control,mixed} of choiceControls){
        const choice=selectedStyle(key,runs);
        if(control.value!==choice)control.value=choice;
        mixed.hidden=choice!=='';
        if(choice==='')control.setAttribute('aria-description','選択範囲に異なる書式が混在しています');
        else control.removeAttribute('aria-description');
      }
    }
    function render(r=null){
      const scroll=surface.scrollTop;
      renderInto(surface,text,value);
      if(text.endsWith('\n'))surface.append(element('br'));
      surface.scrollTop=scroll;
      if(r)focusSelection(r);else updateToolbar();
    }
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const state=()=>({text,format:value,range:{...selected}});
    function publish(){
      const changed=textarea.value!==text;
      textarea.value=text;
      if(changed){syncing=true;try{textarea.dispatchEvent(new Event('input',{bubbles:true}));}finally{syncing=false;}}
      onChange({text,format:value});
    }
    function setState(next,nextFormat,r,{record=true,focus=true}={}){
      const changed=next!==text||!same(nextFormat,value);
      if(changed&&record){undo.push(state());if(undo.length>100)undo.shift();redo.length=0;}
      text=next;value=nextFormat;selected=r;
      render(focus?r:null);
      if(changed)publish();
    }
    function clipped(s,n){let v=s.slice(0,Math.max(0,n));if(/[\uD800-\uDBFF]$/.test(v))v=v.slice(0,-1);return v;}
    function replaceSelection(insertion,r=remember()){
      const a=Math.min(r.start,text.length),b=Math.min(r.end,text.length);
      const insert=clipped(String(insertion).replace(/\r\n?/g,'\n'),limit-(text.length-(b-a)));
      const next=text.slice(0,a)+insert+text.slice(b),at=a+insert.length;
      setState(next,model.retarget(text,next,value,{start:a,end:b}),{start:at,end:at,backward:false});
    }
    function readNative(){return surface.querySelector('div,p')?surface.innerText:surface.textContent;}
    function commitNative(){
      let next=clipped(readNative().replace(/\r\n?/g,'\n'),limit);
      let range=readSelection()||selected;
      if(edit&&edit.start===edit.end){const removed=text.length-next.length;if(removed>0){if(/Backward$/.test(edit.type))edit.start=Math.max(0,edit.start-removed);else if(/Forward$/.test(edit.type))edit.end=Math.min(text.length,edit.end+removed);}}
      const prior=edit;edit=null;
      const at=Math.min(range.end,next.length);range={start:Math.min(range.start,at),end:at,backward:range.backward};
      setState(next,model.retarget(text,next,value,prior),range);
    }
    function history(back){
      const from=back?undo:redo,to=back?redo:undo;
      if(!from.length)return;
      remember();to.push(state());const next=from.pop();setState(next.text,next.format,next.range,{record:false});
    }
    function formatSelection(change,r=remember()){
      if(composing)return;
      const a=r.start,b=r.end;
      if(a===b){hint.textContent='先に本文で書式を変更したい文字を選択してください。';focusSelection(r);return;}
      const patch=typeof change==='function'?change(a,b):change;
      setState(text,model.apply(text,value,a,b,patch),r);
      hint.textContent=instructionText;
    }
    const toggler=flag=>(a,b)=>model.hasFlag(text,value,a,b,flag)?{removeFlag:flag}:{flags:flag};
    function applyToolbar(change){
      const range=toolbarRange||{...remember()};
      toolbarRange=null;
      formatSelection(change,range);
    }
    if(toolbar){
      const commands=element('div');commands.className='origin-note-format-group';
      for(const [flag,label,glyph,tag] of FORMAT_BUTTONS){
        const button=element('button'),icon=element(tag,glyph);
        button.type='button';button.setAttribute('aria-label',label);button.title=label;
        icon.setAttribute('aria-hidden','true');button.append(icon);
        listen(button,'click',()=>applyToolbar(toggler(flag)));buttons.push([button,flag]);commands.append(button);
      }
      function choices(label,key,entries){
        const field=element('label');field.className='origin-note-format-field';
        const title=element('span',label);title.className='origin-note-format-label';
        const mixed=element('span','混在');mixed.className='origin-note-format-mixed';mixed.hidden=true;mixed.setAttribute('aria-hidden','true');
        const control=element('select');control.setAttribute('aria-label',label);
        for(const [id,name] of entries){const option=element('option',name);option.value=id;control.append(option);}
        control.value='default';choiceControls.push({key,control,mixed});
        listen(control,'change',()=>{const pick=control.value;if(pick)applyToolbar({[key]:pick==='default'?null:pick});updateToolbar();});
        field.append(title,control,mixed);return field;
      }
      const pickers=element('div');pickers.className='origin-note-format-choices';
      pickers.append(choices('文字色','color',[['default','標準色'],...model.COLORS.map(c=>[c,COLOR_LABELS[c]])]));
      pickers.append(choices('文字サイズ','size',[['small',SIZE_LABELS.small],['default','100%（標準）'],...model.SIZES.filter(id=>id!=='small').map(id=>[id,SIZE_LABELS[id]])]));
      const clear=element('button','書式解除');clear.className='origin-note-format-clear';clear.type='button';clear.setAttribute('aria-label','書式を解除する');listen(clear,'click',()=>applyToolbar({clear:true}));
      commands.append(clear);holder.append(commands,pickers);
      // Capture before the browser changes focus, including native color and
      // size pickers. Preserve mouse selection when pressing a toolbar button;
      // keyboard/touch controls and native selects retain their default focus.
      listen(holder,'pointerdown',event=>{
        const control=event.target.closest('button,select');if(!control)return;
        toolbarRange={...remember()};
        if(event.button===0&&event.pointerType==='mouse'&&control.matches('button'))event.preventDefault();
      });
      listen(holder,'focusin',event=>{
        if(!holder.contains(event.relatedTarget)&&!toolbarRange)toolbarRange={...selected};
      });
      textarea.before(holder);
    }
    textarea.before(surface);
    for(const label of labels)listen(label,'click',()=>surface.focus());
    listen(surface,'compositionstart',()=>{composing=true;edit={...remember()};});
    listen(surface,'compositionend',()=>{composing=false;commitNative();});
    listen(surface,'beforeinput',ev=>{
      if(composing||ev.isComposing)return;
      const r=remember();edit={...r,type:ev.inputType};
      if(!ev.cancelable)return;
      if(ev.inputType==='historyUndo'||ev.inputType==='historyRedo'){ev.preventDefault();history(ev.inputType==='historyUndo');return;}
      if(ev.inputType==='insertParagraph'||ev.inputType==='insertLineBreak'){ev.preventDefault();edit=null;replaceSelection('\n',r);return;}
      if(ev.inputType==='insertText'&&typeof ev.data==='string'){ev.preventDefault();edit=null;replaceSelection(ev.data,r);return;}
      if(ev.inputType.startsWith('format'))ev.preventDefault();
    });
    listen(surface,'paste',ev=>{if(composing||!ev.clipboardData)return;ev.preventDefault();replaceSelection(ev.clipboardData.getData('text/plain'));});
    for(const name of ['copy','cut'])listen(surface,name,ev=>{
      const r=remember();if(composing||!ev.clipboardData||r.start===r.end)return;
      ev.preventDefault();ev.clipboardData.setData('text/plain',text.slice(r.start,r.end));
      if(name==='cut')replaceSelection('',r);
    });
    listen(surface,'drop',ev=>ev.preventDefault());
    listen(surface,'input',ev=>{if(!composing&&!ev.isComposing)commitNative();});
    listen(textarea,'input',()=>{if(syncing||composing||textarea.value===text)return;const next=clipped(textarea.value,limit);setState(next,model.retarget(text,next,value),{start:next.length,end:next.length,backward:false},{focus:false});});
    for(const name of ['keyup','pointerup','focus'])listen(surface,name,()=>{remember();updateToolbar();});
    // Track real selection changes, including touch handles and a new range
    // while the editor is already focused. Do not overwrite a toolbar snapshot.
    if(toolbar)listen(doc,'selectionchange',()=>{
      if(surface.getRootNode().activeElement!==surface||toolbarRange)return;
      const next=readSelection();
      if(next&&(next.start!==selected.start||next.end!==selected.end||next.backward!==selected.backward)){
        selected=next;updateToolbar();
      }
    });
    listen(surface,'focusout',()=>{
      const range=readSelection();
      if(range&&(range.start!==range.end||selected.start===selected.end))selected=range;
      updateToolbar();
    });
    listen(surface,'pointerdown',()=>{toolbarRange=null;});
    listen(surface,'keydown',ev=>{
      toolbarRange=null;
      if(ev.isComposing||composing||ev.altKey||(!ev.ctrlKey&&!ev.metaKey))return;
      const key=ev.key.toLowerCase();
      if(key==='z'||key==='y'){ev.preventDefault();history(key==='z'&&!ev.shiftKey);return;}
      if(ev.shiftKey)return;
      const command=FORMAT_BUTTONS.find(entry=>entry[4]===key);
      if(command){ev.preventDefault();formatSelection(toggler(command[0]));}
    });
    render();
    return {surface,getText:()=>text,getFormat:()=>value,getSelection:()=>({...remember()}),focusSelection,
      destroy(){controller.abort();holder.remove();surface.remove();textarea.hidden=false;delete textarea.dataset.originNoteBacking;if(originalId)textarea.id=originalId;if(stickyId)textarea.dataset.stickyText=stickyId;}};
  }
  root.WorkBoardOriginNoteEditorV671=Object.freeze({attach,renderInto,markup,installStyles});
})(window);
