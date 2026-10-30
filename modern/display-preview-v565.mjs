// Ver.565: local test-room-only display preference controls.
// The Classic window remains the sole business-data owner. This adapter owns
// only presentation state and reuses the existing five Modern read-only frames.
import {
  DESIGN_IDS, MODERN_PALETTES, readDisplayPreferences, writeDisplayPreferences
} from './preferences.mjs';

const VIEWS = Object.freeze([
  ['today','今日'],['todos','ToDo'],['tasks','タスク'],
  ['schedules','スケジュール'],['memos','業務メモ']
]);
const LABELS = Object.freeze({
  ink:'標準・インク',ocean:'オーシャン',forest:'フォレスト',
  plum:'プラム',mist:'ミスト',sage:'セージ',apricot:'アプリコット',
  lilac:'ライラック',night:'ナイト',slate:'スレート',
  charcoal:'チャコール',dusk:'ダスク'
});
const FRAME_SELECTOR = [
  'iframe[data-modern-today-v554]','iframe[data-modern-todo-v552]',
  'iframe[data-modern-task-v551]','iframe[data-modern-schedule-v553]',
  'iframe[data-modern-memo-v555]'
].join(',');

function element(doc,tag,cls,label) {
  const node=doc.createElement(tag);
  if(cls)node.className=cls;
  if(label!==undefined)node.textContent=label;
  return node;
}

// Called only after the Classic caller verifies local host, test room,
// explicit two-sided flags and a non-production data source.
export function installModernDisplayPreviewV565({
  host,roomId,readUser,openView,closeView,activeView,canSwitch
}) {
  const doc=host.document;
  if(doc.getElementById('displayPreferencesV565')) return host.WorkBoardDisplayPreviewV565;
  const card=doc.querySelector('.user-card');
  if(!card) return null;
  const control=element(doc,'section','display-preferences-v565');
  control.id='displayPreferencesV565';
  control.setAttribute('aria-label','表示設定（検証用）');
  const heading=element(doc,'strong','','表示設定（検証用）');
  const description=element(doc,'p','','この端末・利用者だけの設定です。Modernは検証用表示です。');
  const designLabel=element(doc,'label','','画面デザイン');
  const design=element(doc,'select','');
  design.id='displayDesignV565';
  for(const [value,text] of [['classic','Classic（従来）'],['modern','Modern v2（検証）']]){
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

  const toolbar=element(doc,'aside','display-toolbar-v565');
  toolbar.id='displayToolbarV565';
  toolbar.hidden=true;
  toolbar.setAttribute('aria-label','Modern検証の画面切替');
  const barHeading=element(doc,'span','display-toolbar-title-v565','Modern v2 / 検証用');
  const nav=element(doc,'nav','display-nav-v565');
  const buttons=new Map();
  for(const [value,text] of VIEWS){
    const button=element(doc,'button','',text);
    button.type='button';button.dataset.displayViewV565=value;
    button.addEventListener('click',()=>changeView(value));
    nav.appendChild(button);buttons.set(value,button);
  }
  const toolbarBottom=element(doc,'div','display-toolbar-bottom-v565');
  const themeLabel=element(doc,'label','','配色');
  const toolbarPalette=palette.cloneNode(true);
  toolbarPalette.id='displayToolbarPaletteV565';
  themeLabel.appendChild(toolbarPalette);
  const back=element(doc,'button','','Classicに戻る');
  back.type='button';back.id='displayBackV565';
  toolbarBottom.append(themeLabel,back);
  toolbar.append(barHeading,nav,toolbarBottom);
  doc.body.appendChild(toolbar);

  const style=element(doc,'style');style.id='displayStylesV565';
  style.textContent=`
    .display-preferences-v565{display:grid;gap:8px;padding:12px 0 2px;
      border-top:1px solid rgba(80,110,145,.2);margin-top:12px;font-size:12px}
    .display-preferences-v565 strong{font-size:13px}
    .display-preferences-v565 p{margin:0;line-height:1.5;color:#536579}
    .display-preferences-v565 label{display:grid;gap:4px}
    .display-preferences-v565 select{width:100%;min-height:36px}
    .display-toolbar-v565{position:fixed;z-index:2147483001;right:12px;
      bottom:12px;width:min(430px,calc(100vw - 24px));padding:12px;border:1px solid #cad6e1;
      border-radius:12px;background:#fff;color:#1c3449;box-shadow:0 12px 34px #1c344933;
      font:12px/1.5 system-ui,sans-serif}
    .display-toolbar-v565[hidden]{display:none!important}
    .display-toolbar-title-v565{display:block;font-weight:750;margin-bottom:7px}
    .display-nav-v565{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:9px}
    .display-nav-v565 button,.display-toolbar-bottom-v565 button{
      border:1px solid #bfd0df;border-radius:7px;background:#f4f7fc;color:#24445d;
      min-height:33px;padding:5px 9px;cursor:pointer}
    .display-nav-v565 button[aria-current=page]{border-color:#2466a4;
      background:#dfeefb;font-weight:750}
    .display-toolbar-bottom-v565{display:flex;justify-content:space-between;
      gap:12px;align-items:end}
    .display-toolbar-bottom-v565 label{display:grid;gap:2px;min-width:0}
    .display-toolbar-bottom-v565 select{min-height:33px;max-width:190px}
    .display-status-v565:empty{display:none}
    @media(max-width:460px){.display-toolbar-v565{padding:9px;bottom:8px;right:8px;
      width:calc(100vw - 16px)}.display-nav-v565{gap:4px}}
  `;
  doc.head.appendChild(style);

  let lastFrame=null;
  let lastUser='';
  let transition=false;
  const frame=()=>doc.querySelector(FRAME_SELECTOR);
  const currentUser=()=>String(readUser()||'').trim();
  const read=()=>currentUser()?readDisplayPreferences(host.localStorage,roomId,currentUser()):null;
  const note=text=>{status.textContent=text||'';};
  function activeViewName() {
    const current=frame();
    if(current?.hasAttribute('data-modern-today-v554'))return 'today';
    if(current?.hasAttribute('data-modern-todo-v552'))return 'todos';
    if(current?.hasAttribute('data-modern-task-v551'))return 'tasks';
    if(current?.hasAttribute('data-modern-schedule-v553'))return 'schedules';
    if(current?.hasAttribute('data-modern-memo-v555'))return 'memos';
    return '';
  }
  function applyPalette() {
    const f=frame();
    if(!read()||!f)return;
    const apply=()=>{
      try {
        const palette=read()?.palette;
        if(f.isConnected && palette && f.contentDocument?.documentElement)
          f.contentDocument.documentElement.dataset.palette=palette;
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
    design.disabled=!prefs;palette.disabled=!prefs;toolbarPalette.disabled=!prefs;
    design.value=prefs?.design||'classic';
    palette.value=prefs?.palette||'ink';
    toolbarPalette.value=prefs?.palette||'ink';
    const active=activeViewName();
    toolbar.hidden=!active;
    for(const [key,button] of buttons){
      if(key===active)button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    }
    applyPalette();lastFrame=frame();
  }
  function write(next) {
    const user=currentUser();if(!user){note('利用者を選択してください。');return false;}
    const result=writeDisplayPreferences(host.localStorage,roomId,user,next);
    if(!result.persisted){note('この端末に表示設定を保存できませんでした。');return false;}
    note('');return true;
  }
  function open(target) {
    if(!currentUser()||!canSwitch()){
      note('入力中の画面があります。保存するか閉じてから切り替えてください。');
      return false;
    }
    transition=true;
    try{return Boolean(openView(target));}
    finally{transition=false;}
  }
  function changeView(target) {
    if(!VIEWS.some(([key])=>key===target))return;
    if(!open(target)){update();return;}
    if(!write({design:'modern'})){closeView();update();return;}
    update();
  }
  function chooseDesign(next) {
    if(!DESIGN_IDS.includes(next)){update();return;}
    if(next==='modern'){
      const target=activeViewName()||activeView()||'today';
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
  toolbarPalette.addEventListener('change',()=>choosePalette(toolbarPalette.value));
  back.addEventListener('click',()=>chooseDesign('classic'));

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
