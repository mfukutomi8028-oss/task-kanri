// Ver.326: formal Modern navigation with the existing Classic view router.
// Classic owns all business data; this adapter only coordinates the five
// existing views through the injected canonical view-switch callbacks.
import {
  DESIGN_IDS, MODERN_PALETTES, displayPreferenceKey,
  readDisplayPreferences, writeDisplayPreferences
} from './preferences.mjs';

const VIEWS = Object.freeze([
  ['today','今日','assets/nav-today-v169.svg'],
  ['todos','ToDo','assets/nav-todo-v168.svg'],
  ['tasks','タスク','assets/nav-task-v169.svg'],
  ['schedules','予定','assets/nav-schedule-v169.svg'],
  ['memos','メモ','assets/nav-memo-v168.svg']
]);
const LABELS = Object.freeze({
  ink:'標準・インク',ocean:'オーシャン',forest:'フォレスト',
  plum:'プラム',mist:'ミスト',sage:'セージ',apricot:'アプリコット',
  lilac:'ライラック',night:'ナイト',slate:'スレート',
  charcoal:'チャコール',dusk:'ダスク'
});
function element(doc,tag,cls,label) {
  const node=doc.createElement(tag);
  if(cls)node.className=cls;
  if(label!==undefined)node.textContent=label;
  return node;
}

// Called only after the Classic caller verifies local host, test room,
// explicit two-sided flags and a non-production data source.
export function installModernDisplayPreviewV565({
  host,roomId,readUser,openView,closeView,getFrame,getView,activeView,canSwitch,
  production=false
}) {
  const doc=host.document;
  if(doc.getElementById('displayPreferencesV565')) return host.WorkBoardDisplayPreviewV565;
  const card=doc.querySelector('.user-card');
  if(!card) return null;
  const control=element(doc,'section','display-preferences-v565');
  control.id='displayPreferencesV565';
  control.setAttribute('aria-label','表示設定');
  const heading=element(doc,'strong','','表示設定');
  const description=element(doc,'p','',
    '画面デザインとModernの配色を選べます。設定はこの端末・利用者・ルームごとに保存します。');
  const designLabel=element(doc,'label','','画面デザイン');
  const design=element(doc,'select','');
  design.id='displayDesignV565';
  for(const [value,text] of [['classic','Classic（従来）'],
    ['modern','Modern']]){
    const option=element(doc,'option','',text);option.value=value;design.appendChild(option);
  }
  designLabel.appendChild(design);
  const paletteLabel=element(doc,'label','','Modernの配色');
  const palette=element(doc,'select','');
  palette.id='displayPaletteV565';
  for(const value of MODERN_PALETTES){
    const option=element(doc,'option','',LABELS[value]);option.value=value;palette.appendChild(option);
  }
  paletteLabel.appendChild(palette);
  const status=element(doc,'p','display-status-v565','');
  status.id='displayStatusV565';status.setAttribute('role','status');
  control.append(heading,description,designLabel,paletteLabel,status);
  card.appendChild(control);

  // Exactly one global navigation, owned by Classic. The product iframe
  // hides its old one-item placeholder rail while this dock is active.
  const toolbar=element(doc,'aside','display-toolbar-v565');
  toolbar.id='displayToolbarV565';
  toolbar.hidden=true;
  toolbar.setAttribute('aria-label','Modernのメインメニュー');
  const logo=element(doc,'div','display-dock-brand-v326');
  const logoImage=element(doc,'img');
  logoImage.src='assets/brand-v184.svg';
  logoImage.alt='業務管理ボード';
  logo.appendChild(logoImage);
  const nav=element(doc,'nav','display-nav-v565');
  nav.setAttribute('aria-label','主要画面');
  const buttons=new Map();
  for(const [value,label,icon] of VIEWS){
    const button=element(doc,'button','display-nav-item-v326');
    button.type='button';
    button.dataset.displayViewV565=value;
    button.title=label;
    button.setAttribute('aria-label',label);
    const image=element(doc,'img','display-nav-icon-v326');
    image.src=icon;image.alt='';image.setAttribute('aria-hidden','true');
    const copy=element(doc,'span','display-nav-label-v326',label);
    button.append(image,copy);
    button.addEventListener('click',()=>changeView(value));
    nav.appendChild(button);buttons.set(value,button);
  }
  const toolbarBottom=element(doc,'div','display-toolbar-bottom-v565');
  const settingsButton=element(doc,'button','display-settings-toggle-v326');
  settingsButton.id='displaySettingsToggleV326';
  settingsButton.type='button';
  settingsButton.title='表示設定';
  settingsButton.setAttribute('aria-label','表示設定を開く');
  settingsButton.setAttribute('aria-expanded','false');
  settingsButton.setAttribute('aria-controls','displaySettingsPanelV326');
  settingsButton.append(
    element(doc,'span','display-settings-symbol-v326','⚙'),
    element(doc,'span','display-settings-copy-v326','設定')
  );
  toolbarBottom.appendChild(settingsButton);
  const toolbarNotice=element(doc,'p','display-toolbar-notice-v565','');
  toolbarNotice.id='displayToolbarNoticeV565';toolbarNotice.hidden=true;
  toolbarNotice.setAttribute('role','status');
  const settingsPanel=element(doc,'section','display-settings-panel-v326');
  settingsPanel.id='displaySettingsPanelV326';
  settingsPanel.hidden=true;
  settingsPanel.setAttribute('aria-label','画面と配色の設定');
  toolbar.append(logo,nav,toolbarBottom,toolbarNotice,settingsPanel);
  doc.body.appendChild(toolbar);

  const style=element(doc,'style');style.id='displayStylesV565';
  style.textContent="\n    .display-preferences-v565{display:grid;gap:12px;padding:8px 0;font:16px/1.55 system-ui,sans-serif}\n    .display-preferences-v565 strong{font-size:18px}\n    .display-preferences-v565 p{margin:0;line-height:1.55;color:#52647c}\n    .display-preferences-v565 label{display:grid;gap:5px;font-weight:600}\n    .display-preferences-v565 select{width:100%;min-height:44px;padding:7px 10px;border:1px solid #c2d3e5;border-radius:10px;background:#fff;color:#193553;font:inherit}\n    .display-status-v565:empty{display:none}\n    .display-toolbar-v565{position:fixed;z-index:2147483001;top:0;left:0;bottom:0;width:84px;\n      display:flex;flex-direction:column;gap:14px;padding:12px 7px 14px;border-right:1px solid var(--dock-line,#d1e1f4);\n      background:var(--dock-bg,#f5f9ff);color:var(--dock-text,#274263);font:14px/1.35 system-ui,sans-serif;box-shadow:4px 0 18px #203d6612}\n    .display-toolbar-v565[hidden],.display-settings-panel-v326[hidden],\n    .display-toolbar-notice-v565[hidden]{display:none!important}\n    .display-dock-brand-v326{display:grid;place-items:center;height:56px;border-bottom:1px solid var(--dock-line,#d4e2f2);padding-bottom:8px}\n    .display-dock-brand-v326 img{width:40px;height:40px}\n    .display-nav-v565{display:grid;gap:7px;min-width:0}\n    .display-nav-v565 button,.display-toolbar-bottom-v565 button{\n      display:grid;place-items:center;align-content:center;gap:3px;width:100%;min-height:65px;\n      border:1px solid transparent;border-radius:12px;background:transparent;color:var(--dock-muted,#47627d);\n      cursor:pointer;font:inherit;font-weight:700;transition:background .16s,border-color .16s}\n    .display-nav-v565 button:hover,.display-toolbar-bottom-v565 button:hover{background:var(--dock-hover,#e5effc)}\n    .display-nav-v565 button[aria-current=page]{background:var(--dock-active,#dceaff);border-color:var(--dock-line,#afccec);color:var(--dock-text,#1756a0);box-shadow:inset 3px 0 #3879cc}\n    .display-nav-v565 button:focus-visible,.display-toolbar-bottom-v565 button:focus-visible{outline:3px solid #3879cc;outline-offset:2px}\n    .display-nav-icon-v326{display:block;width:29px;height:29px;object-fit:contain}\n    .display-nav-label-v326,.display-settings-copy-v326{display:block;font-size:13px;line-height:1.4;white-space:nowrap}\n    .display-toolbar-bottom-v565{margin-top:auto}\n    .display-toolbar-bottom-v565 button{min-height:60px}\n    .display-settings-symbol-v326{font-size:26px;line-height:1}\n    .display-settings-panel-v326{position:fixed;z-index:2147483002;left:96px;bottom:14px;\n      width:min(320px,calc(100vw - 116px));max-height:calc(100dvh - 28px);\n      overflow-y:auto;padding:20px;border:1px solid #c4d5eb;border-radius:16px;\n      background:#fff;color:#203b59;box-shadow:0 16px 40px #193d683c}\n    .display-toolbar-notice-v565{position:fixed;left:96px;bottom:12px;width:min(360px,calc(100vw - 116px));\n      margin:0;padding:12px 14px;border:1px solid #eed6a2;border-radius:10px;\n      background:#fff5dc;color:#705017;font:600 15px/1.5 system-ui,sans-serif;box-shadow:0 7px 25px #233c5925}\n    @media(max-width:860px){\n      .display-toolbar-v565{top:auto;right:0;bottom:0;width:100%;height:auto;min-height:74px;\n        flex-direction:row;gap:3px;align-items:stretch;padding:5px 5px calc(5px + env(safe-area-inset-bottom));\n        border-right:0;border-top:1px solid #d1e1f4;box-shadow:0 -4px 22px #21395418}\n      .display-dock-brand-v326{display:none}\n      .display-nav-v565{flex:1;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:2px}\n      .display-nav-v565 button{min-height:58px;padding:3px 0;border-radius:10px;gap:1px}\n      .display-nav-icon-v326{width:25px;height:25px}\n      .display-nav-label-v326{font-size:13px}\n      .display-nav-v565 button[aria-current=page]{box-shadow:inset 0 3px #3879cc}\n      .display-toolbar-bottom-v565{margin:0;display:flex;align-items:stretch}\n      .display-toolbar-bottom-v565 button{width:44px;min-height:58px;padding:2px 0;gap:2px}\n      .display-settings-symbol-v326{font-size:23px}\n      .display-settings-copy-v326{font-size:11px}\n      .display-settings-panel-v326{left:auto;right:8px;bottom:calc(85px + env(safe-area-inset-bottom));\n        width:min(340px,calc(100vw - 16px));max-height:calc(100dvh - 105px)}\n      .display-toolbar-notice-v565{left:8px;right:8px;bottom:calc(85px + env(safe-area-inset-bottom));\n        width:auto}\n    }\n    @media(prefers-reduced-motion:reduce){\n      .display-nav-v565 button,.display-toolbar-bottom-v565 button{transition:none}\n    }\n";
  doc.head.appendChild(style);

  let lastFrame=null;
  let lastUser='';
  let transition=false;
  const frame=getFrame;
  const currentUser=()=>String(readUser()||'').trim();
  const read=()=>{
    const user=currentUser();
    if(!user)return null;
    const saved=readDisplayPreferences(host.localStorage,roomId,user);
    // Modern is the default for new production users only. Never override a
    // previously saved Classic choice; isolated test defaults remain Classic.
    if(production){
      try {
        if(host.localStorage.getItem(displayPreferenceKey(roomId,user))===null)
          return {...saved,design:'modern'};
      } catch { /* Keep the existing preference if storage is unavailable. */ }
    }
    return saved;
  };
  const note=text=>{status.textContent=text||'';};
  const warnSwitch=()=>{
    const warning='入力中のToDoやClassicの画面があります。保存するかキャンセルしてから切り替えてください。';
    note(warning);toolbarNotice.textContent=warning;toolbarNotice.hidden=false;
  };
  const clearSwitchWarning=()=>{
    toolbarNotice.textContent='';toolbarNotice.hidden=true;
  };
  const closeSettings=()=>{
    settingsPanel.hidden=true;
    settingsButton.setAttribute('aria-expanded','false');
  };
  settingsButton.addEventListener('click',()=>{
    const opening=settingsPanel.hidden;
    settingsPanel.hidden=!opening;
    settingsButton.setAttribute('aria-expanded',opening?'true':'false');
    if(opening)design.focus();
  });
  doc.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!settingsPanel.hidden){
      closeSettings();settingsButton.focus();
    }
  });
  doc.addEventListener('pointerdown',event=>{
    if(!settingsPanel.hidden&&!toolbar.contains(event.target))closeSettings();
  });
  // The fixed host toolbar lives outside the iframe. Keep the last Modern
  // control above it on narrow screens and browser zoom, without new state.
  function syncFrameClearanceV322() {
    const current=frame();
    if(!current)return;
    const apply=()=>{
      try {
        const root=current.contentDocument?.documentElement;
        if(!current.isConnected||!root)return;
        // The old static one-item iframe rail is not a second navigation.
        // Classic's single navigation dock remains the only switch owner.
        root.dataset.modernDockV326='true';
        const compact=host.matchMedia?.('(max-width: 860px)')?.matches
          ?? (host.innerWidth<=860);
        const clearance=compact&&!toolbar.hidden
          ? Math.ceil(host.innerHeight-toolbar.getBoundingClientRect().top+16):0;
        if(clearance>0)root.style.setProperty('--modern-toolbar-clearance',clearance+'px');
        else root.style.removeProperty('--modern-toolbar-clearance');
      } catch { /* Never let unavailable frame content block Classic. */ }
    };
    apply();
    if(current.dataset.displayClearanceBoundV322!=='1'){
      current.dataset.displayClearanceBoundV322='1';
      current.addEventListener('load',apply);
    }
  }
  if(typeof host.ResizeObserver==='function'){
    const toolbarResizeObserver=new host.ResizeObserver(syncFrameClearanceV322);
    toolbarResizeObserver.observe(toolbar);
  }
  host.addEventListener('resize',syncFrameClearanceV322);
  function applyPalette() {
    const f=frame();
    if(!read()||!f)return;
    const apply=()=>{
      try {
        const palette=read()?.palette;
        if(f.isConnected && palette && f.contentDocument?.documentElement){
          const root=f.contentDocument.documentElement;
          root.dataset.palette=palette;
          // Keep the global dock synchronized with the existing 12 Modern
          // palettes; Classic's stylesheet remains completely untouched.
          const colors=f.contentWindow?.getComputedStyle(root);
          if(colors){
            const pairs={
              '--dock-bg':'--rail','--dock-text':'--rail-text',
              '--dock-muted':'--rail-muted','--dock-active':'--rail-active',
              '--dock-hover':'--wash','--dock-line':'--rail-line'
            };
            for(const [target,source] of Object.entries(pairs)){
              const color=colors.getPropertyValue(source).trim();
              if(color)toolbar.style.setProperty(target,color);
            }
          }
        }
      } catch {/* Never cross an origin boundary to change theme. */}
    };
    apply();
    // Bind at most once per frame and read the newest palette at load time.
    if(!f.dataset.displayPaletteBoundV565){
      f.dataset.displayPaletteBoundV565='1';
      f.addEventListener('load',apply,{once:true});
    }
  }
  function update() {
    const user=currentUser();lastUser=user;
    const prefs=read();
    design.disabled=!prefs;palette.disabled=!prefs;
    design.value=prefs?.design||'classic';
    palette.value=prefs?.palette||'ink';
    const active=getView();
    toolbar.hidden=!active;
    if(active){
      if(control.parentNode!==settingsPanel)settingsPanel.appendChild(control);
    }else{
      closeSettings();
      if(control.parentNode!==card)card.appendChild(control);
    }
    for(const [key,button] of buttons){
      if(key===active)button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    }
    applyPalette();syncFrameClearanceV322();lastFrame=frame();
  }
  function write(next) {
    const user=currentUser();if(!user){note('利用者を選択してください。');return false;}
    const result=writeDisplayPreferences(host.localStorage,roomId,user,next);
    if(!result.persisted){note('この端末に表示設定を保存できませんでした。');return false;}
    note('');return true;
  }
  function open(target) {
    if(!currentUser()||!canSwitch()){warnSwitch();return false;}
    clearSwitchWarning();
    transition=true;
    try{return Boolean(openView(target));}
    finally{transition=false;}
  }
  function changeView(target) {
    if(!VIEWS.some(([key])=>key===target))return false;
    if(!open(target)){update();return false;}
    if(!write({design:'modern'})){closeView();update();return false;}
    closeSettings();update();
    return true;
  }
  function chooseDesign(next) {
    if(!DESIGN_IDS.includes(next)){update();return;}
    if(next==='classic' && getView() && !canSwitch()){
      warnSwitch();update();return;
    }
    clearSwitchWarning();
    if(next==='modern'){
      const target=getView()||activeView()||'today';
      if(!open(target)){update();return;}
      if(!write({design:'modern'})){closeView();update();return;}
    }else{
      if(!write({design:'classic'})){update();return;}
      transition=true;try{closeView();}finally{transition=false;}
    }
    update();
  }
  function choosePalette(value) {
    if(!MODERN_PALETTES.includes(value)){update();return;}
    if(!write({palette:value})){update();return;}
    update();
  }
  design.addEventListener('change',()=>chooseDesign(design.value));
  palette.addEventListener('change',()=>choosePalette(palette.value));
  // Settings live in one place. The same controls move between the Classic
  // user card and the Modern gear panel, never creating duplicate writers.

  // Existing Modern frame close buttons remove their own iframe. Treat this
  // explicitly as returning to Classic, unless we are switching test pages.
  const observer=new host.MutationObserver(()=>{
    if(transition)return;
    const before=lastFrame;
    const after=frame();
    if(before&&!after&&before!==after){
      // The built-in Modern "back" buttons remove their iframe directly.
      // Clear the test read flag as well, or a reload would reopen Modern
      // against a saved Classic preference.
      closeView();
      if(currentUser()&&read()?.design==='modern')write({design:'classic'});
    }
    if(before!==after)update();
  });
  observer.observe(doc.body,{childList:true});

  const api=Object.freeze({
    read:()=>read(),
    closeSettings,
    // V588: Today's deep links use the existing view switch. The target ID
    // is a one-shot focus hint; no second navigation state or writer exists.
    navigateFromToday(target,focusId=''){
      if(getView()!=='today'||read()?.design!=='modern')return false;
      if(!VIEWS.some(([value])=>value===target))return false;
      if(!changeView(target))return false;
      if(target==='todos'&&typeof focusId==='string'&&focusId.length<=150){
        const current=frame();
        // Check the injected current-view owner, not a product iframe selector.
        if(current&&getView()==='todos')
          current.dataset.modernFocusId=focusId;
      }
      return true;
    },
    refresh(){
      const before=lastUser;const after=currentUser();
      if(before!==after){
        const chosen=read();
        if(frame() && chosen?.design!=='modern'){
          transition=true;try{closeView();}finally{transition=false;}
        }else if(!frame() && chosen?.design==='modern' && canSwitch()){
          open(activeView()||'today');
        }
      }
      update();
    }
  });
  Object.defineProperty(host,'WorkBoardDisplayPreviewV565',{
    value:api,configurable:false,writable:false,enumerable:false
  });
  update();
  // Restore only in the explicit local test, never on the public product.
  if(read()?.design==='modern'&&!frame()&&canSwitch()){
    open(activeView()||'today');update();
  }
  return api;
}
