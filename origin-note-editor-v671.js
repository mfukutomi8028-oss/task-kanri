/* Native Origin note textarea controls plus a live, inert formatting preview. */
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
  .origin-note-format-tools{display:flex;flex:0 0 auto;align-items:center;flex-wrap:wrap;gap:4px;min-width:0;
    padding:4px 0;color:var(--ink,#252b37);font-size:12px}
  .origin-note-format-tools button,.origin-note-format-tools select{
    display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;width:auto;max-width:100%;
    padding:4px 7px;border:1px solid var(--line,#c8ced8);border-radius:7px;
    background:var(--paper,#fff);color:var(--ink,#252b37);font:inherit;line-height:1
  }
  .origin-note-format-tools button:focus-visible,.origin-note-format-tools select:focus-visible{
    outline:2px solid var(--origin-focus-ring,#4659cc);outline-offset:1px}
  .origin-note-format-tools button[aria-pressed=true]{background:var(--accent-bg,#eef0fc);color:var(--accent-dark,#3948b8);border-color:var(--accent,#4659cc)}
  .origin-note-format-tools .origin-note-format-hint{flex:1 0 100%;margin:0 0 2px;color:var(--ink-soft,#526071);line-height:1.5}
  .origin-note-format-preview{display:block;flex:0 0 auto;min-width:0;max-height:110px;margin:0;
    overflow:auto;padding:7px 9px;border:1px solid var(--line,#c8ced8);border-radius:8px;
    background:var(--paper,#fff);color:var(--ink,#252b37);scrollbar-width:thin;font-size:14px;line-height:1.6}
  .origin-note-format-preview[hidden]{display:none!important}
  .origin-note-format-preview>small{display:block;font-weight:650;color:var(--ink-soft,#526071);font-size:11px}
  .origin-note-format-sample{white-space:pre-wrap;overflow-wrap:anywhere}
  `;
  const FORMAT_BUTTONS=[
    [1,'太字','B','strong','b'],[2,'斜体','I','em','i'],
    [4,'下線','U','u','u'],[8,'取り消し線','S','s','']
  ];
  const COLOR_LABELS={red:'赤',blue:'青',green:'緑',purple:'紫',amber:'茶'};
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
  function attach(textarea,{format=null,onChange=()=>{}}={}){
    installStyles(textarea);
    const doc=documentFor(textarea),element=(name,value)=>{const e=doc.createElement(name);if(value)e.textContent=value;return e;};
    const holder=element('div'), hint=element('p','本文の文字を選択してから書式を変更できます。');
    holder.className='origin-note-format-tools';
    holder.setAttribute('role','group');holder.setAttribute('aria-label','文字の書式');
    hint.className='origin-note-format-hint';hint.setAttribute('aria-live','polite');holder.append(hint);
    const preview=element('div'),caption=element('small','書式プレビュー'),sample=element('div');
    preview.className='origin-note-format-preview';sample.className='origin-note-format-sample';
    preview.setAttribute('role','region');preview.setAttribute('aria-label','書式プレビュー');
    preview.append(caption,sample);
    let text=textarea.value, value=model.envelope(text,model.read(text,format));
    let composing=false,edit=null;
    const controller=new AbortController();
    const listen=(target,name,f)=>target.addEventListener(name,f,{signal:controller.signal});
    const buttons=[];
    function show(){
      preview.hidden=!value;
      if(value)renderInto(sample,text,value);
      else sample.replaceChildren();
      updatePressed();
    }
    function updatePressed(){
      for(const [button,flag] of buttons){
        button.setAttribute('aria-pressed',String(model.hasFlag(text,value,textarea.selectionStart,textarea.selectionEnd,flag)));
      }
    }
    function report(){
      show();onChange({text,format:value});
    }
    function commit(next,range=edit){
      const current=textarea.value;
      if(current!==text)value=model.retarget(text,current,value,range);
      text=current;edit=null;
      if(next!==undefined)value=next;
      report();
    }
    function formatSelection(change){
      if(composing)return;
      const a=textarea.selectionStart,b=textarea.selectionEnd,direction=textarea.selectionDirection||'none';
      if(a===b){
        hint.textContent='先に本文で書式を変更したい文字を選択してください。';
        textarea.focus({preventScroll:true});return;
      }
      const active=textarea.value;
      if(active!==text)commit(undefined);
      const patch=typeof change==='function'?change(a,b):change;
      const next=model.apply(text,value,a,b,patch);
      if(JSON.stringify(next)!==JSON.stringify(value)){
        value=next;report();
      }
      hint.textContent='本文の文字を選択してから書式を変更できます。';
      textarea.focus({preventScroll:true});textarea.setSelectionRange(a,b,direction);updatePressed();
    }
    const toggler=flag=>(a,b)=>model.hasFlag(text,value,a,b,flag)?{removeFlag:flag}:{flags:flag};
    for(const [flag,label,glyph,tag] of FORMAT_BUTTONS){
      const button=element('button'),icon=element(tag,glyph);
      button.type='button';button.setAttribute('aria-label',label);button.title=label;
      icon.setAttribute('aria-hidden','true');button.append(icon);
      listen(button,'click',()=>formatSelection(toggler(flag)));
      buttons.push([button,flag]);holder.append(button);
    }
    function choices(label,key,entries){
      const control=element('select');
      control.setAttribute('aria-label',label);
      const placeholder=element('option',label);placeholder.value='';placeholder.disabled=true;control.append(placeholder);
      for(const [id,name] of entries){
        const option=element('option',name);option.value=id;control.append(option);
      }
      control.value='';
      listen(control,'change',()=>{
        const pick=control.value;
        if(pick)formatSelection({[key]:pick==='default'?null:pick});
        control.value='';
      });
      return control;
    }
    holder.append(choices('文字色','color',[['default','標準色'],...model.COLORS.map(c=>[c,COLOR_LABELS[c]])]));
    holder.append(choices('文字サイズ','size',[['small','小'],['default','標準'],['large','大']]));
    const clear=element('button','書式解除');clear.type='button';clear.setAttribute('aria-label','書式を解除する');
    listen(clear,'click',()=>formatSelection({clear:true}));holder.append(clear);
    textarea.before(holder);textarea.after(preview);
    listen(textarea,'compositionstart',()=>{
      composing=true;edit={start:textarea.selectionStart,end:textarea.selectionEnd};
    });
    listen(textarea,'compositionend',()=>{
      composing=false;if(textarea.value!==text)commit(undefined);
    });
    listen(textarea,'beforeinput',ev=>{
      if(!composing&&!ev.isComposing)edit={start:textarea.selectionStart,end:textarea.selectionEnd,type:ev.inputType};
    });
    listen(textarea,'input',ev=>{
      if(composing||ev.isComposing||textarea.value===text)return;
      if(edit?.start===edit?.end&&edit){
        const removed=text.length-textarea.value.length;
        if(removed>0){
          if(/Backward$/.test(edit.type))edit.start-=removed;
          else if(/Forward$/.test(edit.type))edit.end+=removed;
        }
      }
      commit(undefined);
    });
    for(const name of ['select','keyup','pointerup','focus'])listen(textarea,name,updatePressed);
    listen(textarea,'keydown',ev=>{
      if(ev.isComposing||composing||ev.altKey||ev.shiftKey||(!ev.ctrlKey&&!ev.metaKey))return;
      const command=FORMAT_BUTTONS.find((entry)=>entry[4]===ev.key.toLowerCase());
      if(command&&textarea.selectionStart!==textarea.selectionEnd){
        ev.preventDefault();formatSelection(toggler(command[0]));
      }
    });
    show();
    return {getText:()=>textarea.value,getFormat:()=>value,destroy(){controller.abort();holder.remove();preview.remove();}};
  }
  root.WorkBoardOriginNoteEditorV671=Object.freeze({attach,renderInto,markup,installStyles});
})(window);
