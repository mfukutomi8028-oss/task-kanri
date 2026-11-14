/* origin. Modern workspace: separate Shadow DOM presentation over canonical data. */
(function(){
  'use strict';
  const bridgeReady=()=>Boolean(window.WorkBoardPaletteBridge?.readSnapshot && window.WorkBoardPaletteMemoBridgeV369?.readSnapshot);
  const activate=()=>{
    if(document.getElementById('modernOriginRoot')||!bridgeReady())return;
    const host=document.createElement('div');host.id='modernOriginRoot';
    const mount=host.attachShadow({mode:'open'});
    mount.innerHTML='<style>'+"\n:host{font-family:Inter,\"Noto Sans JP\",\"Yu Gothic\",Meiryo,system-ui,-apple-system,sans-serif;font-size:15px;font-synthesis:none;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;--bg:#f5f5f3;--paper:#fff;--sidebar:#fff;--ink:#252b37;--ink-soft:#526071;--muted:#626e80;--line:#e6e9ed;--line-soft:#eff1f4;--accent:#535fd0;--accent-dark:#3948b8;--accent-bg:#eff0fc;--on-accent:#fff;--hover:#f7f8fc;--shadow:0 12px 42px rgba(33,43,70,.035);--success:#23786e;--success-bg:#eaf5f1;--warn:#b3663b;--warn-bg:#fff3eb;--red:#b94c58;--red-bg:#fff0f1;--blue:#477dba;--blue-bg:#eaf2fa}\n:host([data-theme=\"dark\"]){color-scheme:dark;--bg:#151920;--paper:#1d222b;--sidebar:#1b2028;--ink:#ebedf4;--ink-soft:#bdc4d2;--muted:#8f99ac;--line:#333b48;--line-soft:#29313d;--accent:#a3abff;--accent-dark:#bac0ff;--accent-bg:#2e3559;--on-accent:#151920;--hover:#272e3a;--shadow:0 16px 46px rgba(0,0,0,.12);--success:#79bfae;--success-bg:#223d39;--warn:#e8a578;--warn-bg:#423125;--red:#e695a0;--red-bg:#402a31;--blue:#93b6ee;--blue-bg:#25364e}\n*{box-sizing:border-box}:host,.app{margin:0;min-height:100%;background:var(--bg);color:var(--ink)}:host{overflow-x:clip}button,input,select,textarea{font:inherit}button{cursor:pointer}button:disabled{cursor:not-allowed;opacity:.5}input,select,textarea{color:var(--ink)}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,a:focus-visible{outline:3px solid #8c99ed;outline-offset:3px}\nbutton{ -webkit-tap-highlight-color:transparent}a{color:inherit;text-decoration:none}svg{display:block;flex:none}.app{min-height:100vh}.header{position:sticky;top:0;background:color-mix(in srgb,var(--paper) 96%,transparent);backdrop-filter:blur(18px);border-bottom:1px solid var(--line);z-index:30}.header-inner{max-width:1560px;margin:auto;min-height:73px;padding:0 32px;display:flex;align-items:center;gap:32px}.brand{display:flex;align-items:center;gap:11px;flex:none}.brand-emblem{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:#303951;color:white;box-shadow:0 8px 18px #22263b19}.brand-name{font-size:21px;letter-spacing:-1.4px;font-weight:850;line-height:1}.brand-name span{color:var(--accent)}.brand-small{margin-left:8px;font-size:10px;letter-spacing:.1em;color:var(--muted);font-weight:850}.header-nav{display:flex;align-items:center;gap:5px;height:100%;flex:1;min-width:0}.header-nav .nav-button{display:flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:10px;background:transparent;padding:10px 13px;font-weight:740;color:var(--muted);white-space:nowrap}.header-nav .nav-button:hover{background:var(--hover);color:var(--ink)}.header-nav .nav-button.active{background:var(--accent-bg);color:var(--accent-dark)}.header-nav .nav-button svg{width:17px;height:17px;stroke-width:1.9}.header-tools{display:flex;align-items:center;gap:9px}.searchbox{height:41px;display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--bg);border-radius:11px;padding:0 11px;width:218px;color:var(--muted);position:relative}.searchbox input{border:0;outline:0;background:transparent;width:100%;min-width:0;font-size:13px;color:var(--ink)}.searchbox:focus-within{border-color:var(--accent);outline:2px solid var(--accent);outline-offset:2px}.searchbox input::placeholder{color:var(--muted)}.kbd{font-size:10px;padding:2px 5px;border:1px solid var(--line);border-radius:4px;white-space:nowrap}.icon-button{width:40px;height:40px;display:grid;place-items:center;color:var(--ink-soft);border:1px solid transparent;border-radius:11px;background:transparent}.icon-button:hover{background:var(--hover);color:var(--ink)}.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;border:1px solid var(--accent);background:var(--accent);border-radius:10px;color:var(--on-accent);padding:9px 17px;font-weight:820;font-size:13px;white-space:nowrap}.primary-button:hover{background:var(--accent-dark)}.primary-button svg{width:17px;height:17px}.header-avatar{width:34px;height:34px;border-radius:50%;background:var(--accent-bg);color:var(--accent-dark);display:grid;place-items:center;font-weight:850;font-size:11px;border:2px solid var(--paper);margin-left:5px}.workspace{max-width:1490px;margin:0 auto;padding:35px 38px 80px}.page-heading{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:25px}.eyebrow{font-size:11px;font-weight:880;letter-spacing:.13em;text-transform:uppercase;color:var(--accent-dark);margin:0 0 10px}.page-heading h1{font-size:clamp(27px,2.65vw,38px);letter-spacing:-1.4px;line-height:1.25;margin:0 0 5px;font-weight:850}.page-heading p.page-desc{font-size:13px;color:var(--muted);margin:4px 0 0;line-height:1.7}.heading-meta{display:flex;align-items:center;gap:11px;color:var(--muted);font-size:12px}.secondary-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--line);border-radius:10px;min-height:44px;background:var(--paper);color:var(--ink-soft);padding:8px 12px;font-weight:720;font-size:12px}.secondary-button:hover{background:var(--hover);border-color:var(--accent)}.secondary-button svg{width:15px;height:15px}.text-button{display:inline-flex;align-items:center;gap:4px;border:0;background:transparent;color:var(--accent-dark);min-height:40px;font-size:12px;font-weight:820;padding:7px 3px}.text-button:hover{text-decoration:underline}.quiet-small{color:var(--muted);font-size:11px}.strip{display:flex;align-items:center;gap:10px;overflow-x:auto;scrollbar-width:thin;padding:4px 1px 12px;margin-bottom:17px}.origin-today-shortcuts{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin:-4px 0 15px;min-height:38px}.origin-today-shortcuts>span{color:var(--muted);font-size:11px;font-weight:760;margin-right:3px}.origin-today-shortcuts button{display:inline-flex;align-items:center;gap:5px;min-height:36px;padding:7px 11px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink);font-size:12px;font-weight:730}.origin-today-shortcuts button:hover{border-color:var(--accent);background:var(--accent-bg)}.origin-today-more{display:inline-flex;align-items:center;gap:5px;margin-top:10px;padding:9px 0;border:0;background:transparent;color:var(--accent-dark);font-size:12px;font-weight:730}.origin-today-due{font-size:11px;font-weight:760;color:var(--ink-soft);white-space:nowrap}.origin-today-due.urgent{color:var(--red)}.mini-todo button.todo-title{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;text-align:left;min-width:0;flex:1;padding:0;border:0;background:transparent;color:var(--ink);font-size:13px;font-weight:670;line-height:1.55;overflow-wrap:anywhere}.mini-todo button.todo-title:hover{color:var(--accent-dark)}.origin-today-todo-add{border-top:0;margin:0 0 10px;padding:0}.strip-title{min-width:82px;color:var(--muted);font-size:12px;font-weight:820}.day-chip{flex:1 0 78px;min-width:0;min-height:73px;border-radius:12px;border:1px solid var(--line);background:var(--paper);color:var(--ink);padding:10px 8px;text-align:center;display:grid;justify-items:center;gap:3px;position:relative}.day-chip:hover{border-color:var(--accent)}.day-chip.active{background:var(--accent);border-color:var(--accent);color:var(--on-accent);box-shadow:var(--shadow)}.day-chip .dow{font-size:10px;color:var(--muted);font-weight:800}.day-chip.active .dow{color:var(--on-accent);opacity:.86}.day-chip .number{font-size:19px;font-weight:820;line-height:1}.day-chip .dots{display:flex;gap:3px;height:4px;align-items:center}.tiny-dot{width:4px;height:4px;border-radius:50%;background:#8e98d8}.day-chip.active .tiny-dot{background:#d4d9ff}.day-chip.weekend{color:var(--ink-soft)}.day-chip.weekend.active{color:white}\n.day-grid{display:grid;grid-template-columns:minmax(0,1.48fr) minmax(320px,.82fr);gap:19px;align-items:start}.surface{background:var(--paper);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);min-width:0}.surface-section{padding:24px 26px}.surface-section+.surface-section{border-top:1px solid var(--line)}.section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 16px}.section-head h2{display:flex;align-items:center;gap:10px;font-size:16px;letter-spacing:-.35px;margin:0;font-weight:830}.section-head h2 .count{font-size:11px;color:var(--muted);background:var(--bg);border-radius:7px;padding:4px 7px;letter-spacing:0}.section-meta{font-size:12px;color:var(--muted)}.soft-icon{width:24px;height:24px;display:grid;place-items:center;border-radius:8px;background:var(--accent-bg);color:var(--accent-dark)}.soft-icon svg{width:14px;height:14px}.status-summary{display:flex;gap:17px;margin-bottom:16px;padding:10px 0;border-bottom:1px solid var(--line-soft);flex-wrap:wrap}.status-summary span{font-size:12px;color:var(--muted);display:inline-flex;align-items:center;gap:6px}.status-summary strong{font-size:14px;color:var(--ink)}.status-summary .bullet{width:6px;height:6px;border-radius:50%;background:var(--accent)}.focus-item{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:13px;align-items:start;padding:17px 0;border-bottom:1px solid var(--line-soft)}.focus-item:last-child{border-bottom:0}.focus-order{width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;color:var(--muted);font-size:11px;font-weight:780}.focus-item:first-child .focus-order{background:var(--accent-bg);border-color:var(--accent-bg);color:var(--accent-dark)}.focus-main{min-width:0}.focus-name{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;background:none;border:none;color:var(--ink);text-align:left;font-weight:780;font-size:15px;line-height:1.5;overflow-wrap:anywhere;padding:0}.focus-name:hover{color:var(--accent-dark)}.focus-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;min-width:0;font-size:11px;color:var(--muted)}\n.focus-meta>span{min-width:0;overflow-wrap:anywhere}.focus-actions{display:flex;align-items:center;gap:7px}.row-action{font-size:11px;font-weight:820;color:var(--accent-dark);background:var(--accent-bg);border:0;border-radius:8px;padding:9px 10px;white-space:nowrap}.row-action:hover{filter:brightness(.97)}.tag{display:inline-flex;align-items:center;gap:4px;border-radius:5px;background:var(--bg);padding:3px 7px;font-size:11px;color:var(--ink-soft);font-weight:720}.tag.overdue{background:var(--red-bg);color:var(--red)}.tag.today{background:var(--warn-bg);color:var(--warn)}.tag.waiting{background:var(--blue-bg);color:var(--blue)}.tag.done{background:var(--success-bg);color:var(--success)}.tag.high{background:var(--red-bg);color:var(--red)}.tag.med{background:var(--accent-bg);color:var(--accent-dark)}.tag.low{background:var(--success-bg);color:var(--success)}.right-stack{display:grid;gap:18px}.agenda-line{position:relative;margin:0 0 0 3px;border-left:1px solid var(--line);padding:4px 0 1px 16px}.agenda-entry{position:relative;display:grid;grid-template-columns:49px minmax(0,1fr);gap:8px;align-items:start;width:100%;padding:9px 0 16px;background:transparent;border:0;text-align:left;color:var(--ink)}.agenda-entry:before{content:'';position:absolute;left:-20px;top:15px;width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 4px var(--paper)}.agenda-entry:hover .agenda-name{color:var(--accent-dark)}.agenda-time{color:var(--muted);font-size:11px;font-weight:820;margin-top:3px;font-variant-numeric:tabular-nums}.agenda-name{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere;font-weight:780;font-size:13px;line-height:1.5}.agenda-location{display:block;min-width:0;color:var(--muted);font-size:11px;line-height:1.5;margin-top:4px;overflow-wrap:anywhere}.mini-todo{display:flex;align-items:start;gap:9px;padding:9px 0;border-bottom:1px solid var(--line-soft)}.mini-todo:last-of-type{border:0}.todo-check{appearance:none;display:grid;place-items:center;width:20px;height:20px;flex:0 0 20px;border-radius:6px;border:1.8px solid var(--muted);background:var(--paper);cursor:pointer;position:relative;margin:0;vertical-align:middle}.todo-check:checked{background:var(--success);border-color:var(--success)}.todo-check:checked:after{content:'';display:block;width:5px;height:9px;border-right:2px solid #fff;border-bottom:2px solid #fff;transform:translateY(-2px) rotate(45deg)}.todo-check:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.todo-check.task-select-check:checked{background:var(--accent);border-color:var(--accent)}.mini-todo .todo-title{font-size:13px;font-weight:670;line-height:1.55;flex:1;min-width:0}.mini-todo .todo-title.done{text-decoration:line-through;color:var(--muted)}.small-add{display:flex;align-items:center;gap:9px;border-top:1px solid var(--line-soft);padding-top:14px;margin-top:9px}.small-add input{min-width:0;flex:1;padding:9px 10px;background:var(--bg);border:1px solid var(--line);border-radius:8px;font-size:13px}.small-add button{height:38px;min-width:42px;border:0;border-radius:8px;background:var(--accent-bg);color:var(--accent-dark);font-weight:900;font-size:18px}\n/* Work area list */\n.work-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin-bottom:15px}.tab-pills{display:inline-flex;gap:3px;padding:4px;background:var(--paper);border:1px solid var(--line);border-radius:11px}.tab-pills button{font-size:12px;font-weight:760;min-height:40px;padding:8px 12px;border:0;background:transparent;color:var(--muted);border-radius:8px;white-space:nowrap}.tab-pills button.active{background:var(--accent-bg);color:var(--accent-dark)}.work-toolbar .spacer{flex:1}.select-small{min-height:44px;padding:8px 11px;background:var(--paper);border:1px solid var(--line);border-radius:9px;font-size:12px;font-weight:720;max-width:210px}.work-collection{overflow:hidden}.group-title{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--hover);border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:13px 22px}.group-title:first-child{border-top:0}.group-title strong{font-size:12px;letter-spacing:.01em}.group-title span{font-size:11px;color:var(--muted)}.item-row{display:grid;grid-template-columns:24px minmax(0,1.6fr) minmax(100px,.65fr) minmax(90px,.6fr) 104px;align-items:center;gap:14px;padding:13px 21px;border-bottom:1px solid var(--line-soft);min-height:68px}.item-row:last-child{border-bottom:0}.item-row:hover{background:var(--hover)}.item-row .item-name{display:block;font-weight:780;line-height:1.4;font-size:14px;text-align:left;border:0;background:none;color:var(--ink);padding:0;overflow-wrap:anywhere}.item-row .item-name:hover{color:var(--accent-dark)}.row-under{font-size:11px;margin-top:5px;color:var(--muted)}.item-row .item-assignee,.item-row .item-date{font-size:12px;color:var(--ink-soft)}.item-row .item-date.urgent{color:var(--red);font-weight:830}.row-last{display:flex;align-items:center;justify-content:end;gap:6px}.row-last button{border:1px solid var(--line);background:var(--paper);color:var(--ink-soft);border-radius:7px;padding:8px;font-size:11px;font-weight:770;white-space:nowrap}.row-last button:hover{border-color:var(--accent);color:var(--accent-dark)}.row-last button.primary-mini{background:var(--accent-bg);color:var(--accent-dark);border-color:transparent}.bulkbar{display:flex;align-items:center;gap:10px;background:var(--accent-bg);color:var(--accent-dark);padding:11px 15px;border-radius:11px;margin-bottom:11px;font-size:12px;font-weight:780}.bulkbar button{background:var(--paper);border:1px solid var(--line);padding:7px 11px;border-radius:7px;color:var(--ink);font-size:12px;font-weight:760}.bulkbar .spacer{flex:1}.status-rail{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-bottom:14px}.status-marker{border:1px solid var(--line);background:var(--paper);border-radius:11px;text-align:left;padding:9px 12px;min-width:0;min-height:61px}.status-marker.active{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}.status-marker .label{font-size:11px;color:var(--muted);display:flex;align-items:center;gap:7px}.status-marker .label:before{content:'';width:7px;height:7px;border-radius:50%;background:var(--accent)}.status-marker:nth-child(2) .label:before{background:var(--blue)}.status-marker:nth-child(3) .label:before{background:var(--warn)}.status-marker:nth-child(4) .label:before{background:var(--muted)}.status-marker:nth-child(5) .label:before{background:var(--success)}.status-marker strong{font-size:19px;display:block;margin-top:3px;font-variant-numeric:tabular-nums}\n/* ToDo */\n.todo-columns{display:grid;grid-template-columns:minmax(0,1.32fr) minmax(280px,.68fr);gap:18px}.todo-entry{display:flex;gap:11px;align-items:center;padding:15px 0;border-bottom:1px solid var(--line-soft)}.todo-entry:last-child{border:0}.todo-entry .todo-text{border:0;background:none;text-align:left;font-size:15px;line-height:1.4;font-weight:720;color:var(--ink);flex:1;min-width:0;overflow-wrap:anywhere}.todo-entry .todo-text.done{color:var(--muted);text-decoration:line-through}.todo-entry .todo-date{color:var(--muted);font-size:11px}.todo-entry .todo-edit{width:32px;height:32px;border:0;background:none;color:var(--muted);border-radius:8px}.todo-entry .todo-edit:hover{background:var(--hover);color:var(--ink)}.progress-track{height:6px;border-radius:20px;background:var(--line);overflow:hidden;margin:14px 0 6px}.progress-fill{height:100%;background:var(--success);transition:width .2s}.note-preview{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:16px;margin-top:13px;font-size:12px;color:var(--ink-soft);line-height:1.8}\n/* Schedule */\n.calendar-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.calendar-tools button{width:44px;height:44px;border-radius:9px;border:1px solid var(--line);background:var(--paper);display:grid;place-items:center;color:var(--ink)}.calendar-tools .period{font-weight:780;min-width:140px;text-align:center}.week-board{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:9px;padding:15px}.weekday-col{min-width:0;background:var(--bg);border:1px solid var(--line-soft);border-radius:12px;min-height:270px;overflow:hidden}.weekday-col.current{background:var(--accent-bg);border-color:color-mix(in srgb,var(--accent) 28%,var(--line))}.weekday-head{display:flex;flex-direction:column;align-items:center;gap:3px;border-bottom:1px solid var(--line);padding:15px 5px 12px}.weekday-head span{color:var(--muted);font-size:11px}.weekday-head strong{font-size:21px}.weekday-body{padding:8px}.schedule-event{width:100%;text-align:left;border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:7px;background:var(--paper);color:var(--ink);padding:9px 7px;margin-bottom:7px;overflow-wrap:anywhere}.schedule-event:hover{border-color:var(--accent)}.schedule-event .time{font-size:10px;color:var(--muted);font-weight:780;margin-bottom:4px}.schedule-event .title{font-size:11px;line-height:1.4;font-weight:750;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere}.schedule-event.blue{border-left-color:var(--blue)}.schedule-event.warn{border-left-color:var(--warn)}.weekday-add{width:100%;border:1px dashed var(--line);border-radius:7px;color:var(--muted);background:transparent;padding:9px 2px;font-size:12px;margin-top:3px}.weekday-add:hover{color:var(--accent-dark);border-color:var(--accent)}.mobile-agenda{display:none}.calendar-footer{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 22px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}\n/* Memo library */\n.memo-toolbar{display:flex;align-items:center;gap:9px;margin-bottom:17px;flex-wrap:wrap}.memo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.memo-card{text-align:left;border:1px solid var(--line);background:var(--paper);border-radius:14px;padding:22px;min-height:210px;display:flex;flex-direction:column;align-items:start;transition:transform .12s,border-color .12s;min-width:0;color:var(--ink)}.memo-card:hover{transform:translateY(-2px);border-color:var(--accent)}.memo-icon{display:grid;place-items:center;background:var(--accent-bg);color:var(--accent-dark);border-radius:11px;width:38px;height:38px;margin-bottom:20px}.memo-card h3{font-size:16px;line-height:1.45;margin:0 0 9px;letter-spacing:-.25px;overflow-wrap:anywhere}.memo-card p{margin:0;color:var(--ink-soft);font-size:12px;line-height:1.7;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;overflow-wrap:anywhere}.memo-card .memo-bottom{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;margin-top:auto;padding-top:18px;font-size:11px;color:var(--muted)}\n/* Popovers, drawer, toast */\n.popover{position:fixed;z-index:55;background:var(--paper);border:1px solid var(--line);border-radius:13px;box-shadow:0 24px 64px #131b3030;padding:8px;min-width:225px}.create-popover{top:65px;right:max(32px,calc((100vw - 1550px)/2 + 36px))}.pop-row{width:100%;display:flex;align-items:center;gap:12px;border:0;border-radius:9px;background:none;color:var(--ink);text-align:left;padding:12px 11px;font-weight:760;font-size:13px}.pop-row:hover{background:var(--hover)}.pop-row svg{color:var(--accent-dark)}.search-results{position:absolute;left:0;top:49px;width:330px;max-width:calc(100vw - 20px);padding:10px;background:var(--paper);box-shadow:0 20px 45px #14223b25;border:1px solid var(--line);border-radius:12px;z-index:80}.search-hit{display:block;text-align:left;width:100%;padding:11px 9px;border:0;border-radius:8px;color:var(--ink);background:transparent}.search-hit:hover{background:var(--hover)}.search-hit strong{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere;font-size:13px;line-height:1.5}.search-hit span{display:block;min-width:0;overflow-wrap:anywhere;font-size:11px;line-height:1.5;color:var(--muted);margin-top:4px}.search-results{max-height:min(68dvh,560px);overflow-y:auto;overscroll-behavior:contain}\n.origin-search-filters{display:flex;gap:6px;overflow-x:auto;scrollbar-width:thin;overscroll-behavior-x:contain;padding:2px 1px 9px;margin-bottom:9px;border-bottom:1px solid var(--line)}\n.origin-search-filters button{flex:none;display:inline-flex;align-items:center;gap:5px;min-height:40px;border:1px solid var(--line);border-radius:8px;padding:7px 9px;background:var(--paper);color:var(--ink-soft);font-size:12px;font-weight:730}\n.origin-search-filters button[aria-pressed=\"true\"]{background:var(--accent-bg);border-color:var(--accent);color:var(--accent-dark)}\n.origin-search-count{font-size:10px;font-variant-numeric:tabular-nums;opacity:.8}\n.origin-search-summary{color:var(--muted);font-size:11px;margin:0 7px 6px}\n.origin-search-all{display:flex;align-items:center;justify-content:center;width:100%;min-height:44px;margin-top:8px;padding:9px;border:1px solid var(--line);border-radius:9px;background:var(--accent-bg);color:var(--accent-dark);font-size:12px;font-weight:800;cursor:pointer}\n.origin-search-all:hover{border-color:var(--accent)}\n.origin-full-search{max-width:1120px;margin:0 auto}\n.origin-full-search-back{display:inline-flex;align-items:center;gap:7px;min-height:44px;margin:0 0 12px;padding:8px 12px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--accent-dark);font-size:12px;font-weight:770}\n.origin-full-search-shell{padding:22px;min-width:0}\n.origin-full-search-controls{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px}\n.origin-full-search-field{display:flex;align-items:center;gap:10px;min-width:0;min-height:48px;padding:0 13px;border:1px solid var(--line);border-radius:11px;background:var(--paper);color:var(--muted)}\n.origin-full-search-field:focus-within{border-color:var(--accent);outline:2px solid var(--accent);outline-offset:2px}\n.origin-full-search-field input{flex:1;min-width:0;width:100%;border:0;outline:none;background:transparent;color:var(--ink);font-size:15px}\n.origin-full-search-order{display:flex;align-items:center;gap:8px;color:var(--ink-soft);font-size:12px}\n.origin-full-search-order select{min-height:46px;padding:8px 10px;border:1px solid var(--line);border-radius:9px;color:var(--ink);background:var(--paper);font-size:12px}\n.origin-full-search-facets{display:flex;gap:7px;margin:15px 0 9px;padding-bottom:8px;overflow-x:auto;scrollbar-width:thin}\n.origin-full-search-facets button{flex:none;display:flex;align-items:center;gap:8px;min-height:42px;padding:8px 12px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink-soft);font-size:12px;font-weight:750}\n.origin-full-search-facets button[aria-pressed=true]{background:var(--accent-bg);border-color:var(--accent);color:var(--accent-dark)}\n.origin-full-search-facets small{font-size:11px;font-variant-numeric:tabular-nums}\n.origin-full-search-summary{margin:7px 0 13px;color:var(--muted);font-size:12px}\n.origin-full-search-list{border-top:1px solid var(--line-soft)}\n.origin-full-search-hit{display:grid;grid-template-columns:80px minmax(0,1fr) 24px;align-items:center;gap:14px;width:100%;min-height:72px;padding:14px 10px;text-align:left;background:transparent;border:0;border-bottom:1px solid var(--line-soft);color:var(--ink)}\n.origin-full-search-hit:hover,.origin-full-search-hit:focus-visible{background:var(--hover)}\n.origin-full-search-kind{font-size:11px;font-weight:780;color:var(--accent-dark);align-self:start;margin-top:5px}\n.origin-full-search-hit-body{display:grid;min-width:0;gap:5px}\n.origin-full-search-hit-body strong{font-size:14px;font-weight:780;line-height:1.5;overflow-wrap:anywhere}\n.origin-full-search-hit-body small{font-size:12px;color:var(--muted);line-height:1.55;overflow-wrap:anywhere}\n.origin-full-search-chevron{color:var(--muted);display:grid;place-items:center}\n.origin-full-search-more{display:flex;align-items:center;justify-content:flex-end;gap:9px;flex-wrap:wrap;padding:16px 0;color:var(--muted);font-size:12px}\n.origin-full-search-more button{min-height:40px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--accent-dark);font-size:12px;font-weight:750}\n.origin-full-search-empty{color:var(--muted);font-size:13px;line-height:1.7;padding:30px 12px}\n.origin-full-search-back:focus-visible,.origin-full-search-facets button:focus-visible,.origin-search-all:focus-visible,.origin-full-search-more button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}\n@media(max-width:620px){.origin-full-search-shell{padding:14px}.origin-full-search-controls{grid-template-columns:1fr}.origin-full-search-order{justify-content:space-between}.origin-full-search-hit{grid-template-columns:53px minmax(0,1fr) 18px;gap:9px;padding:12px 3px}.origin-full-search-hit-body strong{font-size:13px}.origin-full-search-kind{font-size:10px}.origin-full-search-more{justify-content:flex-start}}\n.origin-search-empty{font-size:12px;line-height:1.8;color:var(--muted);margin:0;padding:12px 8px}\n.search-results .search-hit{min-height:48px}\n.search-results .search-hit:focus-visible{outline:2px solid var(--accent);outline-offset:-2px;background:var(--accent-bg)}\n@media(max-width:770px){.search-results{width:100%;max-width:100%;max-height:min(66dvh,520px)}.origin-search-filters button{min-height:44px}.origin-full-search-field input{font-size:16px}}.overlay{position:fixed;inset:0;z-index:100;background:rgba(17,24,38,.49);display:flex;justify-content:flex-end;align-items:stretch;backdrop-filter:blur(3px)}[hidden]{display:none!important}.sheet{width:min(520px,100%);height:100dvh;background:var(--paper);box-shadow:-20px 0 60px #0b102034;display:flex;flex-direction:column;animation:sheetin .17s ease-out;overflow:hidden}@keyframes sheetin{from{transform:translateX(12px);opacity:.7}to{transform:translateX(0);opacity:1}}.sheet-head{display:flex;align-items:start;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line);padding:24px 26px 19px}.sheet-head>div{min-width:0;flex:1 1 auto}.sheet-head small{font-size:11px;color:var(--accent-dark);font-weight:850;letter-spacing:.09em}.sheet-head h2{margin:7px 0 0;font-size:22px;letter-spacing:-.5px;line-height:1.4;overflow-wrap:anywhere}.sheet-body{padding:24px 26px;overflow:auto;flex:1;min-height:0}.sheet-foot{border-top:1px solid var(--line);padding:15px 26px;display:block}.origin-sheet-actions{display:grid;gap:10px}.origin-sheet-primary{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(105px,.8fr);gap:9px}.origin-sheet-primary button{width:100%;min-width:0;min-height:44px}.origin-sheet-secondary{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.origin-sheet-secondary button{min-height:44px}.origin-sheet-danger{border-top:1px solid var(--line);padding-top:10px;display:flex;justify-content:flex-end}.origin-sheet-danger button{min-height:44px}.sheet-close{width:44px;height:44px;border:1px solid var(--line);background:var(--paper);border-radius:10px;color:var(--ink)}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}.form-field{min-width:0;display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:800;color:var(--ink-soft);margin-bottom:17px}.form-field.full{grid-column:1/-1}.form-field input,.form-field select,.form-field textarea{width:100%;min-height:43px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:11px;font-weight:580;font-size:14px}.form-field textarea{resize:vertical;min-height:125px;line-height:1.7}.origin-schedule-intro{padding:15px 17px;border-radius:12px;border:1px solid var(--line-soft);background:var(--accent-bg);margin-bottom:22px}.origin-schedule-intro strong{display:block;font-size:14px;color:var(--ink)}.origin-schedule-intro p{margin:5px 0 0;color:var(--ink-soft);font-size:12px;line-height:1.6}.origin-schedule-duration{display:flex;flex-direction:row;align-items:center;flex-wrap:wrap;gap:6px;margin-top:-7px}.origin-schedule-duration span{color:var(--muted);font-size:12px;margin-right:5px}.origin-schedule-duration button{padding:7px 11px;border-radius:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink-soft);font-size:12px;font-weight:750}.origin-schedule-duration button:hover{background:var(--accent-bg);border-color:var(--accent);color:var(--accent-dark)}.origin-schedule-note{color:var(--muted);font-size:12px;line-height:1.8;margin:9px 0 15px}.origin-schedule-note button{color:var(--accent-dark);font-size:12px;font-weight:800;text-decoration:underline;background:none;border:0;padding:0}.origin-schedule-error{font-size:12px;color:var(--red);background:var(--red-bg);border-radius:8px;padding:12px;font-weight:750}.form-field .help{color:var(--muted);font-size:11px;font-weight:450}.danger-button{color:var(--red);background:var(--red-bg);border:1px solid transparent;border-radius:9px;padding:10px 12px;font-size:12px;font-weight:800;margin-right:auto}.toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:200;display:flex;align-items:center;gap:12px;padding:12px 18px;background:#2c3445;color:white;border-radius:11px;font-size:12px;box-shadow:0 16px 38px #14213836;max-width:calc(100vw - 28px)}.toast button{border:0;background:none;color:#cbd6ff;font-weight:850;font-size:12px}.empty{display:flex;align-items:center;justify-content:center;text-align:center;flex-direction:column;padding:43px 16px;color:var(--muted);gap:9px}.empty svg{color:var(--accent)}.empty strong{color:var(--ink);font-size:14px}.empty p{margin:0;max-width:300px;font-size:12px;line-height:1.8}.mobile-nav{display:none}.touch-only{display:none}\n@media(max-width:1280px){.header-inner{gap:19px;padding:0 23px}.searchbox{width:170px}.header-nav .nav-button{padding:10px}.workspace{padding:30px 25px 70px}.day-grid{grid-template-columns:minmax(0,1.3fr) minmax(285px,.8fr)}.surface-section{padding:21px 22px}.memo-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}\n@media(max-width:1050px){.brand-small{display:none}.header-inner{gap:14px}.header-nav .nav-button{font-size:12px;padding:9px 7px}.searchbox{width:140px}.kbd{display:none}.day-grid{grid-template-columns:minmax(0,1fr) minmax(250px,.8fr)}.focus-item{grid-template-columns:31px minmax(0,1fr);gap:9px}.focus-actions{grid-column:2}.item-row{grid-template-columns:22px minmax(0,1.5fr) minmax(60px,.5fr) 102px}.item-row .item-assignee{display:none}.week-board{gap:5px}.weekday-body{padding:5px}.weekday-col{min-height:240px}.weekday-head{padding:11px 2px}}\n@media(max-width:770px){.status-rail{display:flex;gap:8px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scrollbar-width:thin;padding-bottom:5px;margin-bottom:14px}.status-marker{flex:0 0 116px;scroll-snap-align:start}.header{top:0}.header-inner{min-height:62px;padding:0 16px;gap:10px}.brand-name{font-size:21px}.header-nav{display:none}.header-tools{margin-left:auto;gap:2px}.searchbox{width:44px;height:44px;padding:0;justify-content:center;background:none;border-color:transparent}.searchbox input{position:absolute;left:0;top:0;opacity:0;width:44px;height:44px;z-index:2;font-size:16px}.searchbox:focus-within{position:absolute;left:12px;right:12px;top:10px;width:auto;z-index:40;justify-content:flex-start;padding:0 12px;background:var(--paper);border-color:var(--accent)}.searchbox:focus-within input{position:static;opacity:1;width:100%;height:100%;background:none}.search-results{top:48px;left:0;width:100%}.header-avatar{display:none}.header-tools>.primary-button{width:44px;height:44px;padding:0;font-size:0;min-height:44px}.header-tools>.primary-button svg{width:21px;height:21px}.workspace{padding:26px 15px calc(100px + env(safe-area-inset-bottom,0px))}.page-heading{align-items:start;margin-bottom:14px}.page-heading h1{font-size:29px;letter-spacing:-1px}.page-heading p.page-desc{display:none}.heading-meta{display:none}.todo-check{width:28px;height:28px;flex-basis:28px;border-radius:8px}.tab-pills button,.origin-today-shortcuts button{min-height:44px}.strip-title{display:none}.strip{margin-left:-3px;margin-right:-3px;gap:7px}.day-chip{flex:0 0 61px;min-height:70px}.day-grid{grid-template-columns:1fr;gap:13px}.right-stack{grid-template-columns:1fr}.surface-section{padding:19px}.status-summary{gap:12px}.focus-item{grid-template-columns:30px minmax(0,1fr) auto}.focus-actions{grid-column:auto}.focus-order{width:28px;height:28px}.focus-name{font-size:14px}.todo-columns{grid-template-columns:1fr}.status-rail{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.status-marker{padding:10px}.status-marker strong{font-size:18px}.status-marker .label{font-size:10px}.item-row{grid-template-columns:28px minmax(0,1fr) auto;gap:9px;padding:13px 12px}.item-row .item-date{display:none}.item-row .row-last button:not(.primary-mini):not(.origin-list-quick-edit){display:none}.item-row .item-name{font-size:13px}.item-row .row-under{font-size:10px}.tab-pills{max-width:100%;overflow-x:auto}.tab-pills button{padding:8px 10px}.work-toolbar{gap:7px}.work-toolbar .spacer{display:none}.select-small{margin-left:auto}.memo-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.memo-card{padding:15px;min-height:200px}.memo-icon{margin-bottom:15px}.memo-card h3{font-size:14px}.week-board{display:none}.mobile-agenda{display:block;padding:14px}.mobile-agenda .agenda-day{padding:12px 3px;border-bottom:1px solid var(--line)}.mobile-agenda .agenda-day:last-child{border-bottom:0}.mobile-agenda .agenda-day-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.mobile-agenda .agenda-day-head strong{font-size:13px}.mobile-agenda .agenda-day-head button{border:1px solid var(--line);background:var(--paper);border-radius:8px;font-size:12px;padding:8px 10px;color:var(--accent-dark)}.mobile-agenda .agenda-entry{border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:10px;padding:12px;margin-bottom:7px;grid-template-columns:50px 1fr}.mobile-agenda .agenda-entry:before{display:none}.calendar-footer{padding:13px}.mobile-nav{position:fixed;bottom:0;left:0;right:0;z-index:29;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));column-gap:8px;background:color-mix(in srgb,var(--paper) 98%,transparent);backdrop-filter:blur(15px);border-top:1px solid var(--line);padding:9px 6px calc(8px + env(safe-area-inset-bottom,0px))}.mobile-nav button{display:grid;justify-items:center;gap:4px;align-content:center;min-width:0;min-height:56px;border:0;background:none;color:var(--muted);font-size:11px;font-weight:760;padding:4px 2px}.mobile-nav button.active{color:var(--accent-dark);background:var(--accent-bg);border-radius:10px}.mobile-nav button svg{width:21px;height:21px}.create-popover{right:9px;top:60px}.sheet-head{padding:18px 19px 15px}.sheet-body{padding:19px}.sheet-foot{padding:12px 19px}.toast{bottom:calc(80px + env(safe-area-inset-bottom,0px))}.touch-only{display:inline}}\n@media(max-width:420px){.workspace{padding:22px 12px calc(100px + env(safe-area-inset-bottom,0px))}.page-heading h1{font-size:27px}.surface-section{padding:16px}.section-head h2{font-size:16px}.focus-item{grid-template-columns:26px minmax(0,1fr);gap:10px}.focus-actions{grid-column:2;justify-content:flex-start}.focus-name{font-size:14px}.focus-meta{gap:5px}.focus-order{width:26px;height:26px}.strip{gap:5px}.day-chip{flex-basis:56px}.memo-grid{grid-template-columns:1fr}.memo-card{min-height:165px}.form-grid{grid-template-columns:1fr}.form-field.full{grid-column:auto}.heading-meta{display:none}.section-head{align-items:start}.primary-button{padding-inline:11px}.status-marker{padding:9px 6px}.status-marker .label{font-size:11px}.work-toolbar .select-small{max-width:138px}}\n@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}\n\n\n.record-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 20px}.detail-list{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:19px 0;margin:0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.origin-schedule-facts .origin-event-times{grid-column:1/-1}.origin-event-times dd{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.origin-event-times time{font-variant-numeric:tabular-nums}.origin-schedule-facts{gap:12px;padding:14px 0}.detail-list>div{min-width:0}.detail-list dt{font-size:11px;font-weight:800;color:var(--muted);margin-bottom:7px}.detail-list dd{font-size:14px;font-weight:750;color:var(--ink);margin:0;overflow-wrap:anywhere}.detail-subheading{font-size:13px;margin:22px 0 10px;color:var(--ink);font-weight:840}.record-description{white-space:pre-wrap;color:var(--ink-soft);font-size:14px;line-height:1.85;margin:0;overflow-wrap:anywhere}.memo-document{padding:19px 4px 12px;font-size:14px;color:var(--ink);line-height:2.05;white-space:pre-wrap;overflow-wrap:anywhere}.origin-memo-paper{padding:16px 18px;border-radius:12px;border:1px solid var(--line);background:var(--memo-paper,var(--paper));min-height:96px}.origin-memo-updated{margin:12px 0 0;color:var(--muted)}.origin-memo-paper[data-paper-color='ivory']{--memo-paper:#ffffff}.origin-memo-paper[data-paper-color='lemon']{--memo-paper:#fff4d5}.origin-memo-paper[data-paper-color='peach']{--memo-paper:#ffebe4}.origin-memo-paper[data-paper-color='mint']{--memo-paper:#e2f5ea}.origin-memo-paper[data-paper-color='sky']{--memo-paper:#e5f0ff}.origin-memo-paper[data-paper-color='lavender']{--memo-paper:#efe8ff}:host([data-theme='dark']) .origin-memo-paper[data-paper-color='ivory']{--memo-paper:#29313d}:host([data-theme='dark']) .origin-memo-paper[data-paper-color='lemon']{--memo-paper:#433b2b}:host([data-theme='dark']) .origin-memo-paper[data-paper-color='peach']{--memo-paper:#43312f}:host([data-theme='dark']) .origin-memo-paper[data-paper-color='mint']{--memo-paper:#293e36}:host([data-theme='dark']) .origin-memo-paper[data-paper-color='sky']{--memo-paper:#29394b}:host([data-theme='dark']) .origin-memo-paper[data-paper-color='lavender']{--memo-paper:#383047}\n@media(max-width:480px){.detail-list{grid-template-columns:1fr;gap:14px}.origin-sheet-primary{grid-template-columns:minmax(0,1fr) minmax(92px,.68fr)}.origin-sheet-secondary button{flex:1}.origin-sheet-danger button{width:100%}}\n\n:host {display:block;isolation:isolate;min-height:100vh;font-family:Inter,\"Noto Sans JP\",system-ui,sans-serif}\n#originDisplaySelect {width:72px;border:1px solid var(--line);border-radius:9px;padding:8px 2px;color:var(--ink);background:var(--paper);font-size:11px;cursor:pointer}\n@media(max-width:770px){#originDisplaySelect{width:52px;max-width:52px;font-size:10px;padding:6px 0;min-height:44px}.header-tools{gap:4px}}\n"+"\n.origin-task-overview{border:1px solid var(--line);border-radius:12px;padding:17px;background:var(--bg)}\n.origin-progress-head{display:flex;justify-content:space-between;align-items:center;color:var(--ink);font-size:13px}\n.origin-progress{height:8px;border-radius:10px;background:var(--line);overflow:hidden;margin:12px 0 7px}.origin-progress i{display:block;height:100%;background:var(--success)}\n.origin-task-overview>small{color:var(--muted);font-size:11px}.origin-task-overview .detail-list{margin-top:0}.origin-task-facts{border:0!important;padding:0!important;margin:0!important}.origin-task-check-progress{padding-top:12px;margin-top:12px;border-top:1px solid var(--line)}.origin-task-check-progress>small{font-size:11px;color:var(--muted)}.origin-task-last-updated{margin:12px 0 0;font-size:11px;color:var(--muted)}.origin-task-section h3 small{font-size:11px;color:var(--muted);font-weight:600;margin-left:5px}.origin-task-related{display:flex;gap:8px;flex-wrap:wrap}.origin-task-related button{max-width:100%;overflow-wrap:anywhere}.origin-task-history-more{margin:9px 0}.origin-task-history-more summary{cursor:pointer;padding:10px 0;color:var(--accent-dark);font-size:12px;font-weight:740}.origin-task-history-more[open] summary{margin-bottom:8px}\n.origin-task-section{border-top:1px solid var(--line);padding:19px 0}.origin-task-section h3{font-size:14px;margin:0 0 13px}.origin-task-section>p{font-size:13px;color:var(--ink-soft)}\n.origin-task-check{display:flex;align-items:center;gap:10px;min-height:44px;font-size:13px;cursor:pointer;padding:8px 3px}\n.origin-task-check input{width:19px;height:19px;accent-color:var(--success)}.origin-task-check .is-done{text-decoration:line-through;color:var(--muted)}\n.origin-task-history{padding-left:19px;font-size:12px;line-height:1.8}.origin-task-history li{margin-bottom:10px}.origin-task-history small{display:block;color:var(--muted);font-size:10px}\n.origin-checkrow{display:flex;align-items:center;gap:9px;margin:8px 0}.origin-checkrow input[type=checkbox]{width:19px;height:19px;accent-color:var(--success)}\n.origin-checkrow input[type=text]{flex:1;min-width:0;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:8px;min-height:42px;padding:9px}\n"+"\n/* Origin task mobile editor touch and readability */\n.origin-checkrow{display:grid;grid-template-columns:22px minmax(0,1fr) 42px;align-items:center;gap:9px;margin:9px 0}\n.origin-checkrow input[name=\"checkDone\"]{width:21px;height:21px;accent-color:var(--success);cursor:pointer}\n.origin-checkrow input[name=\"checkText\"]{min-width:0;min-height:44px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:10px;font-size:14px}\n.origin-checkrow button{border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink-soft);width:42px;height:44px;display:grid;place-items:center}\n.origin-checkrow button:hover{border-color:var(--red);color:var(--red)}\n.origin-task-error{font-size:12px;color:var(--red);background:var(--red-bg);border-radius:9px;padding:11px 13px;line-height:1.6;font-weight:760}\n.origin-task-error[hidden]{display:none}\n.origin-task-check{min-height:46px;padding:10px 7px;border-radius:9px}\n.origin-task-check:hover{background:var(--hover)}\n.origin-task-check input{width:22px;height:22px;accent-color:var(--success)}\n.origin-task-section .secondary-button{margin:4px 5px 6px 0;max-width:100%;min-height:44px;white-space:normal}\n.origin-task-overview .detail-list{gap:12px}\n.origin-task-history{margin-top:10px}\n.sheet-foot{padding-bottom:max(15px,env(safe-area-inset-bottom,0px))}\n@media(max-width:520px){.sheet-head{padding:16px 18px 12px}.sheet-head h2{font-size:20px;max-height:min(26dvh,144px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}.sheet-body{padding:16px 18px;scroll-padding-bottom:16px}.sheet-foot{padding:12px 18px max(15px,env(safe-area-inset-bottom,0px));max-height:min(38dvh,300px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;flex:0 1 auto}.sheet-foot button{min-height:44px}.origin-task-overview{padding:14px}}\n"+"#originUserSelect{width:121px;max-width:16vw;height:38px;background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:9px;font-size:12px;padding:0 7px}@media(max-width:770px){#originUserSelect{width:77px;max-width:77px;height:44px;font-size:11px}}"+".origin-memo-palette{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.origin-memo-palette input[type='radio']{width:18px!important;min-height:18px!important;height:18px!important;flex:0 0 18px;margin:0;accent-color:var(--accent)}@media(max-width:480px){.origin-memo-palette{grid-template-columns:repeat(2,minmax(0,1fr))}}.origin-memo-palette label{display:flex;flex:1 1 125px;align-items:center;gap:7px;min-height:44px;border:1px solid var(--line);padding:7px 10px;border-radius:9px;cursor:pointer;color:var(--ink)}.origin-memo-palette label:has(:checked){background:var(--accent-bg);border-color:var(--accent)}.origin-memo-swatch{display:inline-block;flex:0 0 19px;width:19px;height:19px;border:1px solid #52617955;border-radius:50%;background:var(--swatch)}.origin-memo-palette label[data-paper-color='ivory']{--swatch:#ffffff}.origin-memo-palette label[data-paper-color='lemon']{--swatch:#fff4d5}.origin-memo-palette label[data-paper-color='peach']{--swatch:#ffebe4}.origin-memo-palette label[data-paper-color='mint']{--swatch:#e2f5ea}.origin-memo-palette label[data-paper-color='sky']{--swatch:#e5f0ff}.origin-memo-palette label[data-paper-color='lavender']{--swatch:#efe8ff}"+".origin-memo-filters{display:flex;gap:7px;overflow-x:auto;margin-bottom:14px}.origin-memo-filters button{min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:99px;background:var(--paper);color:var(--ink);white-space:nowrap;font-size:12px}.origin-memo-filters button.active{background:var(--accent-bg);border-color:var(--accent)}.origin-memo-shell{border:1px solid var(--line);border-radius:14px;background:var(--memo-paper,var(--paper));overflow:hidden}.origin-memo-shell .memo-card{border:0;border-radius:0;background:transparent;width:100%;min-height:155px;color:#283347}.origin-memo-shell .memo-card p,.origin-memo-shell .memo-bottom{color:#546378}.origin-memo-shell[data-paper-color=\"lemon\"]{--memo-paper:#fff4d5}.origin-memo-shell[data-paper-color=\"peach\"]{--memo-paper:#ffebe4}.origin-memo-shell[data-paper-color=\"mint\"]{--memo-paper:#e2f5ea}.origin-memo-shell[data-paper-color=\"sky\"]{--memo-paper:#e5f0ff}.origin-memo-shell[data-paper-color=\"lavender\"]{--memo-paper:#efe8ff}.origin-memo-colors{display:flex;align-items:center;flex-wrap:wrap;gap:7px;padding:5px 12px 13px}.origin-memo-colors span{font-size:11px;color:var(--ink-soft);margin-right:auto}.origin-color-dot{width:27px;height:27px;border-radius:50%;border:2px solid #fff9;box-shadow:0 0 0 1px #52617950;cursor:pointer}.origin-color-dot[data-paper-color=\"ivory\"]{background:#fff}.origin-color-dot[data-paper-color=\"lemon\"]{background:#ffe29e}.origin-color-dot[data-paper-color=\"peach\"]{background:#ffc6b5}.origin-color-dot[data-paper-color=\"mint\"]{background:#bce6ca}.origin-color-dot[data-paper-color=\"sky\"]{background:#bedfff}.origin-color-dot[data-paper-color=\"lavender\"]{background:#d5c6ff}.origin-color-dot[aria-pressed=\"true\"]{outline:2px solid #40567c;outline-offset:2px}:host([data-theme=\"dark\"]) .origin-memo-shell[data-paper-color=\"ivory\"]{--memo-paper:#29313d}:host([data-theme=\"dark\"]) .origin-memo-shell[data-paper-color=\"lemon\"]{--memo-paper:#433b2b}:host([data-theme=\"dark\"]) .origin-memo-shell[data-paper-color=\"peach\"]{--memo-paper:#43312f}:host([data-theme=\"dark\"]) .origin-memo-shell[data-paper-color=\"mint\"]{--memo-paper:#293e36}:host([data-theme=\"dark\"]) .origin-memo-shell[data-paper-color=\"sky\"]{--memo-paper:#29394b}:host([data-theme=\"dark\"]) .origin-memo-shell[data-paper-color=\"lavender\"]{--memo-paper:#383047}:host([data-theme=\"dark\"]) .origin-memo-shell .memo-card{color:var(--ink)}:host([data-theme=\"dark\"]) .origin-memo-shell .memo-card p,:host([data-theme=\"dark\"]) .origin-memo-shell .memo-bottom{color:var(--ink-soft)}"+".origin-calendar-controls{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.origin-calendar-search{min-width:135px;max-width:200px;flex:1;height:39px;border:1px solid var(--line);border-radius:9px;padding:8px 10px;background:var(--paper);color:var(--ink);font-size:12px}.weekday-col.origin-selected,.agenda-day.origin-selected{outline:2px solid var(--accent);outline-offset:-2px}.origin-calendar-controls input{height:39px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);padding:5px}.origin-agenda-group{padding:15px;border-bottom:1px solid var(--line)}.origin-agenda-group>strong{display:block;font-size:14px;margin-bottom:10px}.origin-agenda-entry{width:100%;display:grid;grid-template-columns:110px minmax(0,1fr) auto;gap:10px;align-items:center;text-align:left;background:var(--paper);border:1px solid var(--line);border-radius:10px;color:var(--ink);padding:13px;margin:7px 0}.origin-agenda-entry:hover{background:var(--hover);border-color:var(--accent)}.origin-agenda-entry time{font-size:12px;font-weight:800;color:var(--accent-dark)}.origin-agenda-entry strong{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:14px;overflow-wrap:anywhere}.origin-agenda-entry small{min-width:0;font-size:11px;line-height:1.5;color:var(--muted);overflow-wrap:anywhere}@media(max-width:770px){.origin-calendar-controls{width:100%;justify-content:flex-start}.origin-calendar-search{max-width:none;flex-basis:100%}.origin-agenda-entry{grid-template-columns:90px minmax(0,1fr)}.origin-agenda-entry small{grid-column:2}}@media(max-width:770px){.header-inner{flex-wrap:wrap;column-gap:6px;row-gap:2px;min-height:96px;padding:7px 12px}.brand{height:36px;gap:7px}.brand-emblem{width:32px;height:32px;border-radius:10px}.brand-name{font-size:20px}.header-tools{flex:1 0 100%;width:100%;justify-content:flex-end;gap:7px;margin-left:0}.create-popover{top:107px;right:12px}.searchbox:focus-within{top:48px;left:12px;right:12px}}@media(max-width:370px){.header-tools{gap:5px}.header-inner{padding:7px 10px}.create-popover{right:10px}}"+"/* Origin next: a real two-row header at desktop widths that previously caused pointer overlap */\n@media (min-width:771px) and (max-width:1500px) {\n .header-inner{flex-wrap:wrap;column-gap:16px;row-gap:0;padding:8px 24px 0}\n .brand{order:0;min-width:0}\n .header-tools{order:1;margin-left:auto;flex:0 0 auto;min-width:0}\n .header-nav{order:2;flex:0 0 100%;width:100%;min-width:0;max-width:100%;height:42px;justify-content:space-between;gap:5px;border-top:1px solid var(--line-soft)}\n .header-nav .nav-button{flex:1 1 0;min-width:0;max-width:none;position:relative}\n .searchbox{width:170px}\n}\n@media (min-width:771px) and (max-width:1050px) {\n .header-inner{padding:8px 15px 0;column-gap:8px}\n .searchbox{width:135px}\n #originUserSelect{max-width:105px}\n .header-nav .nav-button{padding:8px 6px}\n}"+"/* Search and sorting are view-only and never update memo timestamps. */\n.origin-memo-utility{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:2px 0 12px}\n.origin-memo-utility>input{flex:1 1 240px;min-width:0;max-width:380px;min-height:42px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);padding:9px 13px;font-size:13px}\n.origin-memo-utility>label{display:inline-flex;align-items:center;gap:8px;color:var(--muted);font-size:12px;font-weight:700;white-space:nowrap}\n.origin-memo-utility select{height:42px;min-width:145px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink);padding:0 10px;font-size:12px}\n.origin-memo-result{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:-4px 0 13px;color:var(--muted);font-size:12px}\n.origin-memo-result button{border:0;background:transparent;color:var(--accent-dark);font-size:12px;font-weight:760;text-decoration:underline;padding:8px}\n@media(max-width:770px){.origin-memo-utility>input{flex-basis:100%;max-width:none;font-size:16px}.origin-memo-utility>label{width:100%;justify-content:space-between}.origin-memo-utility select{min-width:160px}.memo-toolbar .tab-pills{overflow-x:auto;min-width:0}}\n"+"\n.origin-detail-pager{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0 15px;margin:-5px 0 18px;border-bottom:1px solid var(--line)}\n.origin-detail-position{display:inline-flex;align-items:center;font-size:12px;font-weight:780;color:var(--muted);font-variant-numeric:tabular-nums}\n.origin-detail-controls{display:flex;align-items:center;gap:8px}\n.origin-detail-controls button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-width:86px;min-height:44px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink);font-size:12px;font-weight:750}\n.origin-detail-controls button:not([disabled]):hover{background:var(--accent-bg);border-color:var(--accent)}\n.origin-detail-controls button[disabled]{opacity:.36;cursor:default}\n@media(max-width:770px){.sheet-body{overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.origin-detail-pager{position:sticky;top:-1px;z-index:2;background:var(--paper);padding:10px 0 12px;margin:0 0 13px}}@media(max-width:420px){.origin-detail-pager{gap:6px}.origin-detail-controls{gap:5px}.origin-detail-controls button{min-width:66px;padding:6px 8px}}\n"+"\n/* ToDo is an undated personal checklist; do not imply a deadline. */\n.origin-todo-summary{display:flex;align-items:center;gap:17px;flex-wrap:wrap;border:1px solid var(--line);background:var(--paper);padding:12px 17px;border-radius:13px;margin-bottom:13px}\n.origin-todo-metrics{display:flex;align-items:center;gap:20px;flex-wrap:wrap;color:var(--muted);font-size:13px}\n.origin-todo-metrics strong{font-size:17px;color:var(--ink);font-variant-numeric:tabular-nums}\n.origin-todo-summary .progress-track{flex:1 1 130px;min-width:80px;max-width:290px;margin:0;height:7px}\n.origin-todo-main .surface-section{padding:17px 21px}\n.origin-todo-add{display:flex;align-items:stretch;gap:9px;margin:8px 0 8px!important;padding:0!important;border:0!important}\n.origin-todo-add input{min-width:0;min-height:44px;flex:1;border-radius:10px;font-size:15px}\n.origin-todo-add button{min-width:44px;min-height:44px;flex:0 0 44px;display:grid;place-items:center;padding:0;line-height:0}\n.small-add button[type=submit]{display:grid;place-items:center;padding:0;line-height:0}\n.small-add button[type=submit] svg{display:block;margin:0;flex:none}\n.origin-todo-main .todo-entry{padding:8px 0;min-height:56px;gap:10px}\n.origin-todo-main .todo-entry .todo-text{font-size:15px;line-height:1.5;font-weight:690;padding:5px 0;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere}\n.origin-todo-main .todo-entry .todo-edit{flex:0 0 44px;width:44px;height:44px;min-width:44px;min-height:44px}\n.origin-todo-archive{margin-top:11px;padding-top:10px;border-top:1px solid var(--line)}\n.origin-todo-archive-toggle{width:100%;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);min-height:44px;padding:9px 12px;display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:13px;font-weight:740}\n.origin-todo-archive-toggle>span{display:inline-flex;align-items:center;gap:8px}\n.origin-todo-archive-toggle>span:last-child{color:var(--muted);font-weight:600}\n.origin-todo-archive-toggle:hover{border-color:var(--accent)}\n#originCompletedTodos{padding-top:7px}\n#originCompletedTodos[hidden]{display:none}\n@media(max-width:770px){.origin-todo-main .surface-section{padding:13px 14px}.origin-todo-summary{padding:12px 14px;gap:11px}.origin-todo-metrics{gap:13px}.origin-todo-summary .progress-track{max-width:none}.origin-todo-add input{font-size:16px}}\n"+"\n/* Compact, consistent task list: useful metadata stays visible on mobile. */\n.origin-task-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 9px}\n.origin-task-tools>input{min-height:40px;min-width:190px;flex:1 1 220px;max-width:400px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);padding:9px 12px;font-size:13px}\n.origin-task-tools>label{display:inline-flex;align-items:center;gap:7px;color:var(--muted);font-size:12px;font-weight:730}\n.origin-task-tools select{min-height:40px;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:9px;padding:6px 9px;font-size:12px}\n.origin-density-button{min-height:40px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink-soft);font-size:12px;font-weight:720;padding:8px 12px}\n.origin-density-button:hover{border-color:var(--accent);color:var(--accent-dark)}\n.origin-task-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--muted);font-size:12px;padding:0 2px 9px}\n.origin-task-summary button{border:0;background:transparent;color:var(--accent-dark);text-decoration:underline;font-size:12px;font-weight:740;padding:7px}\n.origin-task-tip{margin:10px 0 0}\n.origin-task-mobile-due{display:none}\n.origin-task-main{min-width:0}\n.origin-task-insight{display:grid;gap:7px;margin-top:12px;max-width:720px;padding:11px 13px;border:1px solid var(--line-soft);border-radius:10px;background:var(--bg)}\n.origin-task-insight-description{font-size:13px;line-height:1.7;color:var(--ink-soft);white-space:pre-wrap;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:0}\n.origin-task-insight-meta{display:flex;gap:6px;flex-wrap:wrap;align-items:center}\n.origin-task-insight-meta span{display:inline-flex;min-height:24px;align-items:center;padding:3px 8px;border-radius:7px;background:var(--paper);border:1px solid var(--line);font-size:11px;color:var(--ink-soft);overflow-wrap:anywhere}\n.origin-task-collection.origin-tasks-compact .origin-task-insight{display:none}\n@media(max-width:770px){.origin-task-insight{margin-top:9px;padding:9px 10px}.origin-task-insight-description{font-size:12px}}\n.origin-task-collection.origin-tasks-compact .item-row{min-height:53px;padding:9px 16px;gap:11px}\n.origin-task-collection.origin-tasks-compact .group-title{padding:9px 16px}\n.origin-task-collection.origin-tasks-compact .row-under{margin-top:3px;display:flex;align-items:center;gap:7px;flex-wrap:wrap}\n.origin-task-collection .item-assignee,.origin-task-collection .item-date{min-width:0}\n.origin-task-collection .row-last button{min-height:36px;min-width:48px}\n@media(max-width:770px){\n .origin-task-tools>input{flex-basis:100%;min-width:0;max-width:none;min-height:44px;font-size:16px}\n .origin-task-tools{gap:8px}.origin-task-tools select,.origin-density-button{min-height:44px}\n .origin-task-tools>label{flex:1}\n .origin-task-collection .row-under .origin-task-mobile-due{display:inline-flex;align-items:center;white-space:nowrap;color:var(--muted);font-size:11px;font-weight:750}\n .origin-task-collection .row-under .origin-task-mobile-due.urgent{color:var(--red)}\n .origin-task-collection.origin-tasks-compact .item-row{padding:10px 12px;gap:9px;min-height:52px}\n .origin-task-collection.origin-tasks-compact .item-name{font-size:13px}\n .origin-task-collection .row-last button{min-height:40px;min-width:44px}\n}\n"+"\n/* Calendar modes share a single filtered event set. */\n.origin-schedule-view{display:inline-flex;gap:3px;padding:3px;border:1px solid var(--line);border-radius:10px;background:var(--paper)}\n.origin-schedule-view button{min-height:44px;padding:7px 11px;border:0;border-radius:8px;font-size:13px;font-weight:760;color:var(--muted);background:transparent}\n.origin-schedule-view button.active{background:var(--accent-bg);color:var(--accent-dark)}\n.origin-weekday-focus{display:flex;flex-direction:column;align-items:center;gap:3px;width:100%;background:transparent;color:var(--ink);border:0;padding:0;min-height:55px}\n.origin-weekday-focus span{font-size:11px;color:var(--muted)}\n.origin-weekday-focus strong{font-size:18px}\n.origin-weekday-focus small{font-size:10px;color:var(--muted);font-weight:650}\n.origin-weekday-focus:hover strong,.origin-weekday-focus:focus-visible strong{color:var(--accent-dark)}\n.origin-agenda-day-label{border:0;background:transparent;text-align:left;color:var(--ink);font-size:13px;font-weight:760;padding:5px 0}\n.origin-agenda-day-label span{font-size:11px;color:var(--muted)}\n.origin-day-focus{padding:18px 20px}\n.origin-day-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px;border-bottom:1px solid var(--line);padding-bottom:13px}\n.origin-day-heading small{font-size:10px;letter-spacing:.1em;font-weight:800;color:var(--muted)}\n.origin-day-heading h2{margin:5px 0 0;font-size:19px;color:var(--ink)}\n.origin-day-heading h2 span{font-size:12px;font-weight:650;color:var(--muted);margin-left:8px}\n.origin-day-controls{display:flex;align-items:center;gap:7px}\n.origin-day-controls button{display:grid;place-items:center;width:44px;height:44px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink)}\n.origin-day-items{display:grid;gap:7px}\n.origin-day-entry{display:grid;grid-template-columns:100px minmax(0,1fr) 22px;align-items:center;gap:12px;width:100%;min-height:51px;border:1px solid var(--line);border-radius:11px;padding:11px 13px;background:var(--paper);color:var(--ink);text-align:left}\n.origin-day-entry:hover{border-color:var(--accent);background:var(--hover)}\n.origin-day-entry time{font-size:12px;color:var(--accent-dark);font-weight:760;font-variant-numeric:tabular-nums}\n.origin-day-entry strong{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:14px;line-height:1.4;overflow-wrap:anywhere}\n.origin-day-entry small{display:block;min-width:0;font-size:11px;line-height:1.5;color:var(--muted);margin-top:3px;overflow-wrap:anywhere}\n.origin-day-open{color:var(--muted)}\n.origin-day-add{margin-top:13px}\n.origin-schedule-toolbar{align-items:center}\n.origin-todo-archive-toggle svg{transition:transform .15s}\n.origin-todo-archive-toggle[aria-expanded=\"true\"]>span:last-child svg{transform:rotate(180deg)}\n@media(max-width:770px){.origin-schedule-view{flex:1 1 100%;justify-content:space-between}.origin-schedule-view button{flex:1;min-height:44px}.origin-calendar-controls input,.origin-calendar-search,.calendar-tools button{min-height:44px}.origin-calendar-search{font-size:16px}.mobile-agenda .agenda-day-head button{min-height:44px}.origin-day-focus{padding:13px 12px}.origin-day-heading h2{font-size:18px}.origin-day-entry{grid-template-columns:84px minmax(0,1fr) 16px;gap:8px;padding:10px}.origin-day-entry strong{font-size:14px}.origin-day-entry time{font-size:12px}}\n"+".origin-todo-main .todo-text{word-break:break-word}.origin-todo-main .todo-check{width:28px;height:28px;flex:0 0 28px}.origin-todo-archive-toggle[aria-expanded=\"false\"]{margin-bottom:0}"+"/* Origin list polish: readable type, compact rows, theme-aware surfaces. */\n.origin-task-collection .group-title{padding:0 10px}\n.origin-task-collection.origin-tasks-compact .group-title{padding:0 8px}\n.origin-task-group-toggle{display:flex;align-items:center;gap:9px;width:100%;min-height:44px;padding:8px 10px;border:0;background:transparent;color:var(--ink);text-align:left;font-size:13px;font-weight:760}\n.origin-task-group-toggle:hover{color:var(--accent-dark)}\n.origin-task-group-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:-2px;border-radius:8px}\n.origin-task-group-toggle .origin-group-count{margin-left:auto;font-size:12px;color:var(--ink-soft);white-space:nowrap}\n.origin-task-group-toggle svg{transition:transform .15s}\n.origin-task-group-toggle[aria-expanded=\"false\"] svg{transform:rotate(-90deg)}\n.origin-task-group-rows[hidden]{display:none!important}\n.origin-task-collection .item-name{font-size:14px;line-height:1.45;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere;text-align:left}\n.origin-task-collection .row-under{min-width:0;font-size:11.5px;line-height:1.45;overflow-wrap:anywhere}\n.origin-task-collection .origin-task-meta{min-width:0;overflow-wrap:anywhere}\n.origin-task-collection .item-row:focus-within{background:var(--hover)}\n.origin-task-collection.origin-tasks-compact .item-row{min-height:56px;padding:9px 15px;gap:12px}\n.origin-task-collection.origin-tasks-compact .item-name{font-size:14px;line-height:1.45}\n.origin-task-collection.origin-tasks-compact .row-under{margin-top:4px;display:flex;align-items:center;gap:7px;flex-wrap:wrap}\n.origin-task-collection .row-last button{min-height:40px;min-width:48px}\n.origin-filter-current{color:var(--ink-soft);margin-left:7px}\n.origin-memo-result{flex-wrap:wrap;row-gap:7px}\n.origin-memo-result-actions{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin-left:auto}\n.origin-memo-layout{display:inline-flex;gap:3px;flex:0 0 auto;padding:3px;border:1px solid var(--line);background:var(--paper);border-radius:10px}\n.origin-memo-layout button{min-height:40px;padding:6px 12px;border:0;border-radius:8px;background:transparent;color:var(--ink-soft);font-size:12px;font-weight:750}\n.origin-memo-layout button[aria-pressed=\"true\"]{background:var(--accent-bg);color:var(--accent-dark)}\n.origin-memo-shell:focus-within{outline:2px solid var(--accent);outline-offset:2px}\n.origin-memo-shell .memo-card{min-height:148px;padding:16px 17px 12px}\n.origin-memo-shell .memo-icon{width:34px;height:34px;margin-bottom:11px}\n.origin-memo-shell .memo-card h3{font-size:15px;line-height:1.45;margin-bottom:7px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere}\n.origin-memo-shell .memo-card p{font-size:13px;line-height:1.55}\n.origin-memo-shell .memo-bottom{font-size:11.5px;padding-top:10px}\n.origin-memo-colors{flex-wrap:nowrap;gap:6px;padding:7px 12px 10px;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin}\n.origin-memo-colors>span{flex:none;font-size:11px}\n.origin-memo-colors .origin-color-dot{flex:0 0 44px;width:44px;height:44px}\n.origin-memo-colors .origin-color-dot:focus-visible{outline:2px solid var(--accent);outline-offset:2px}\n.origin-memo-list{grid-template-columns:minmax(0,1fr);gap:8px}\n.origin-memo-list .origin-memo-shell{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center}\n.origin-memo-list .memo-card{display:grid;grid-template-columns:32px minmax(0,1fr);grid-template-rows:auto auto auto;column-gap:10px;row-gap:2px;min-height:0;padding:11px 15px;align-content:center}\n.origin-memo-list .memo-icon{grid-column:1;grid-row:1/4;align-self:start;width:32px;height:32px;margin:0}\n.origin-memo-list .memo-icon svg{width:16px;height:16px}\n.origin-memo-list .memo-card h3{grid-column:2;min-width:0;margin:0;font-size:15px;line-height:1.45}\n.origin-memo-list .memo-card p{grid-column:2;min-width:0;max-width:100%;margin:0;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12.5px}\n.origin-memo-list .memo-bottom{grid-column:2;min-width:0;margin:0;padding:0;line-height:1.45}\n.origin-memo-list .origin-memo-colors{width:auto;min-width:0;max-width:340px;justify-content:flex-end;flex-wrap:nowrap;gap:6px;padding:7px 11px;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin}\n.origin-memo-list .origin-memo-colors>span{display:none}\n.origin-memo-list .origin-color-dot{flex:0 0 44px;width:44px;height:44px}\n@media(max-width:950px){\n .origin-memo-list .origin-memo-shell{grid-template-columns:minmax(0,1fr)}\n .origin-memo-list .origin-memo-colors{width:100%;max-width:100%;justify-content:flex-start;gap:6px;padding:7px 11px}\n}\n@media(max-width:770px){\n .origin-task-collection .item-name{font-size:14px;line-height:1.5}\n .origin-task-collection .row-under{font-size:11.5px;line-height:1.5}\n .origin-task-collection .row-last button{min-height:44px;min-width:44px}\n .origin-task-collection.origin-tasks-compact .item-row{min-height:58px;padding:10px 12px;gap:9px}\n .origin-memo-shell .memo-card{min-height:142px;padding:14px 15px 10px}\n .origin-memo-shell .memo-card h3{font-size:15px}\n .origin-memo-shell .memo-card p{font-size:13px}\n .origin-memo-list .memo-card{min-height:0;padding:11px 12px}\n .origin-memo-layout button{min-height:44px}\n}\n@media(max-width:420px){\n .origin-filter-current{display:block;margin-left:0;margin-top:4px}\n .origin-memo-colors>span{display:none}\n .origin-memo-shell .memo-card{min-height:130px}\n .origin-memo-list .memo-card{min-height:0}\n}"+"@media(max-width:390px){\n .origin-task-summary,.origin-memo-result{align-items:flex-start;gap:7px}\n .origin-task-summary>span,.origin-memo-result>span{min-width:0;overflow-wrap:anywhere}\n .origin-memo-result-actions{margin-left:0;width:100%;justify-content:space-between}\n .origin-memo-utility>input{width:100%;min-width:0;flex:1 1 100%;min-height:44px}\n .origin-memo-utility>label{display:flex;align-items:center;gap:7px;min-width:0;flex:1 1 100%;font-size:12px}\n .origin-memo-utility select{min-width:0;max-width:100%;flex:1;min-height:44px}\n .memo-toolbar .tab-pills{flex:1 1 auto;max-width:100%}\n .origin-schedule-toolbar .calendar-tools{width:100%;justify-content:space-between;gap:6px}\n .origin-schedule-toolbar .calendar-tools .period{min-width:0;flex:1 1 auto;font-size:13px}\n .origin-calendar-controls select,.origin-calendar-controls input[type=\"date\"]{max-width:100%;min-width:0}\n .origin-agenda-entry{grid-template-columns:78px minmax(0,1fr);gap:7px}\n .origin-day-entry{grid-template-columns:76px minmax(0,1fr) 16px}\n}"+'</style>'+"<div class=\"app\" id=\"app\">\n  <header class=\"header\">\n    <div class=\"header-inner\">\n      <div class=\"brand\" aria-label=\"origin. 業務管理\">\n        <div class=\"brand-emblem\" aria-hidden=\"true\"><svg width=\"25\" height=\"25\" viewBox=\"0 0 28 28\" fill=\"none\"><path d=\"M5 14a9 9 0 1 1 18 0\" stroke=\"#a9b5ff\" stroke-width=\"2.8\" stroke-linecap=\"round\"/><path d=\"M5 14a9 9 0 0 0 18 0\" stroke=\"#f7f8fd\" stroke-width=\"2.8\" stroke-linecap=\"round\"/><circle cx=\"14\" cy=\"14\" r=\"3.3\" fill=\"#f7f8fd\"/></svg></div>\n        <div class=\"brand-name\">origin<span>.</span></div><div class=\"brand-small\">WORKSPACE</div>\n      </div>\n      <nav class=\"header-nav\" aria-label=\"メインナビゲーション\" id=\"desktopNav\"></nav>\n      <div class=\"header-tools\">\n        <div class=\"searchbox\" id=\"searchbox\"><span data-icon=\"search\" aria-hidden=\"true\"></span><input id=\"originSearchInput\" type=\"search\" aria-label=\"タスク・ToDo・予定・メモを横断検索\" aria-controls=\"searchResults\" aria-expanded=\"false\" placeholder=\"仕事を検索\" autocomplete=\"off\"/><span class=\"kbd\">Ctrl K</span><div class=\"search-results\" id=\"searchResults\" role=\"region\" aria-label=\"横断検索の結果\" hidden></div></div>\n        <button type=\"button\" id=\"originInboxButton\" class=\"icon-button origin-inbox-shortcut\" data-action=\"inbox-shortcut\" title=\"受信箱を開く\" aria-label=\"受信箱を開く\" aria-haspopup=\"dialog\"><span data-icon=\"mail\"></span><span id=\"originInboxBadge\" class=\"origin-inbox-badge\" hidden></span></button>\n        <button type=\"button\" id=\"createBtn\" data-action=\"create-menu\" class=\"primary-button\"><span data-icon=\"plus\"></span><span>新規作成</span></button>\n        <div class=\"origin-header-settings\">\n          <button type=\"button\" id=\"originSettingsToggle\" data-action=\"settings-toggle\" class=\"origin-settings-toggle\" aria-haspopup=\"true\" aria-controls=\"originSettingsPanel\" aria-expanded=\"false\" title=\"表示と利用者の設定\"><span data-icon=\"settings\"></span><span>設定</span></button>\n          <section id=\"originSettingsPanel\" class=\"origin-settings-panel\" role=\"region\" aria-labelledby=\"originSettingsTitle\" hidden>\n            <div class=\"origin-settings-heading\">\n              <strong id=\"originSettingsTitle\">表示・利用者設定</strong>\n              <button type=\"button\" class=\"origin-settings-close\" data-action=\"settings-close\" aria-label=\"設定を閉じる\"><span data-icon=\"close\"></span></button>\n            </div>\n            <div class=\"origin-settings-fields\">\n              <div class=\"origin-settings-field\">\n                <span class=\"origin-settings-label\">ライト／ダーク</span>\n                <button type=\"button\" id=\"themeBtn\" data-action=\"theme\" class=\"origin-settings-mode-button\" title=\"ライト／ダーク切替\" aria-label=\"ライト／ダーク切替\"><span data-icon=\"moon\"></span></button>\n              </div>\n              <label class=\"origin-settings-field\">\n                <span class=\"origin-settings-label\">画面のカラー</span>\n                <select id=\"originColorSelect\" aria-label=\"画面の色を変更\"><option value=\"default\">オリジナル</option><option value=\"sky\">スカイブルー</option><option value=\"lavender\">ラベンダー</option><option value=\"mint\">ミントグリーン</option><option value=\"rose\">ローズピンク</option><option value=\"peach\">ピーチ</option><option value=\"amber\">アンバー</option><option value=\"slate\">スレート</option><option value=\"pure-blue\">ピュアブルー</option><option value=\"pure-red\">ピュアレッド</option><option value=\"pure-green\">ピュアグリーン</option><option value=\"pure-yellow\">ピュアイエロー</option><option value=\"pure-orange\">ピュアオレンジ</option><option value=\"pure-purple\">ピュアパープル</option><option value=\"pure-cyan\">ピュアシアン</option><option value=\"pure-pink\">ピュアピンク</option><option value=\"pastel-blue\">パステルブルー</option><option value=\"pastel-lilac\">パステルライラック</option><option value=\"pastel-mint\">パステルミント</option><option value=\"pastel-rose\">パステルローズ</option><option value=\"pastel-peach\">パステルピーチ</option><option value=\"pastel-lemon\">パステルレモン</option><option value=\"night-navy\">ミッドナイト</option><option value=\"night-charcoal\">チャコール</option><option value=\"night-forest\">ディープフォレスト</option><option value=\"night-plum\">ナイトプラム</option><option value=\"night-mocha\">モカブラウン</option></select>\n              </label>\n              <label class=\"origin-settings-field\">\n                <span class=\"origin-settings-label\">画面スタイル</span>\n                <select id=\"originDisplaySelect\" aria-label=\"画面デザインを切り替える\"><option value=\"modern\">Origin</option><option value=\"classic\">Classic</option><option value=\"journal\">Journal</option></select>\n              </label>\n              <label class=\"origin-settings-field\">\n                <span class=\"origin-settings-label\">利用者の切り替え</span>\n                <select id=\"originUserSelect\" aria-label=\"利用者を切り替える\"></select>\n              </label>\n            </div>\n            <p class=\"origin-settings-note\">カラーの選択はこの端末の利用者・ルームごとに保存されます。</p>\n          </section>\n        </div>\n      </div>\n    </div>\n  </header>\n  <main class=\"workspace\" id=\"workspace\" aria-live=\"polite\"></main>\n  <nav class=\"mobile-nav\" id=\"mobileNav\" aria-label=\"モバイルナビゲーション\"></nav>\n  <div class=\"popover create-popover\" id=\"createMenu\" hidden></div>\n  <div class=\"overlay\" id=\"overlay\" hidden><section class=\"sheet\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"panelHeading\" id=\"sheet\" tabindex=\"-1\"></section></div>\n\n<dialog id=\"originInboxDialog\" class=\"origin-inbox-dialog\" aria-labelledby=\"originInboxTitle\" aria-describedby=\"originInboxDescription\">\n  <header class=\"origin-inbox-head\"><div><p class=\"origin-inbox-eyebrow\">ORIGIN · NOTIFICATIONS</p><h2 id=\"originInboxTitle\">受信箱</h2><p id=\"originInboxDescription\">大切な連絡と、日々の更新を分けて確認できます。</p></div><button type=\"button\" data-action=\"origin-inbox-close\" class=\"origin-inbox-close\" aria-label=\"受信箱を閉じる\" autofocus><span data-icon=\"close\"></span></button></header>\n  <section class=\"origin-inbox-filterbar\" aria-label=\"受信内容の絞り込み\">\n    <div class=\"origin-inbox-main-tabs\" role=\"tablist\" aria-label=\"重要度別の受信内容\"><button type=\"button\" role=\"tab\" data-action=\"origin-inbox-section\" data-value=\"important\" aria-selected=\"true\" aria-controls=\"originInboxList\">重要 <small id=\"originInboxImportantCount\"></small></button><button type=\"button\" role=\"tab\" data-action=\"origin-inbox-section\" data-value=\"activity\" aria-selected=\"false\" aria-controls=\"originInboxList\">アクティビティ <small id=\"originInboxActivityCount\"></small></button></div>\n    <div class=\"origin-inbox-filters\"><label class=\"origin-inbox-search\"><span data-icon=\"search\"></span><input id=\"originInboxSearch\" type=\"search\" placeholder=\"受信内容を検索\" aria-label=\"受信内容を検索\" autocomplete=\"off\"></label><label id=\"originInboxReadLabel\" class=\"origin-inbox-read-filter\">表示 <select id=\"originInboxReadFilter\"><option value=\"all\">すべて</option><option value=\"unread\">未読のみ</option><option value=\"read\">既読のみ</option></select></label></div>\n    <nav id=\"originInboxGenres\" class=\"origin-inbox-genres\" aria-label=\"受信内容のジャンル\"></nav><div class=\"origin-inbox-summary-row\"><p id=\"originInboxSummary\" class=\"origin-inbox-summary\" aria-live=\"polite\"></p><button type=\"button\" id=\"originInboxUnreadQuick\" class=\"origin-inbox-unread-quick\" data-action=\"origin-inbox-unread-quick\" hidden>未読のみ表示</button></div>\n  </section>\n  <div id=\"originInboxList\" class=\"origin-inbox-list\" role=\"region\" aria-label=\"受信内容の一覧\" tabindex=\"-1\"></div>\n  <footer class=\"origin-inbox-footer\"><p id=\"originInboxFootNote\">既読状態は利用者ごとに保存されます。</p><button type=\"button\" data-action=\"origin-inbox-read-all\" class=\"origin-inbox-all-read\">通知をすべて既読にする</button></footer>\n</dialog>\n  <div class=\"toast\" id=\"originToast\" role=\"status\" aria-live=\"polite\" hidden></div>\n</div>";
    mount.querySelector('style').appendChild(document.createTextNode("@media(max-width:770px){\n.overlay{align-items:flex-start}\n.sheet{height:var(--origin-visible-height,100dvh);max-height:var(--origin-visible-height,100dvh)}\n.sheet-body{scroll-padding-block:16px 26px;overscroll-behavior:contain}\n.sheet-foot{flex-shrink:0}\n.sheet[data-origin-keyboard=\"true\"] .sheet-head{padding-block:8px}\n.sheet[data-origin-keyboard=\"true\"] .sheet-head h2{max-height:38px;font-size:16px}\n.sheet[data-origin-keyboard=\"true\"] .sheet-foot{padding-block:7px;max-height:min(42%,132px)}\n}\n.origin-draft-state{font-size:11px;line-height:1.4;margin:0 0 7px;color:var(--muted)}\n.origin-draft-state[data-unsaved=\"true\"],.origin-draft-state[data-saving=\"true\"]{color:var(--accent-dark);font-weight:750}\n.origin-editor-error{margin:0 0 14px;padding:10px 12px;border-radius:9px;background:var(--red-bg);color:var(--red);font-size:12px;line-height:1.6}\n.origin-editor-error[hidden]{display:none}\n#editForm[aria-busy=\"true\"]{opacity:.78}\n"));
    mount.querySelector('style').appendChild(document.createTextNode(".status-summary>.origin-summary-filter{display:inline-flex;align-items:center;justify-content:flex-start;gap:6px;border:1px solid transparent;border-radius:10px;background:transparent;padding:6px 9px;min-height:40px;margin:-4px 0;color:var(--muted);font-size:12px;cursor:pointer;text-align:left}.status-summary>.origin-summary-filter:hover{color:var(--ink);background:var(--accent-bg);border-color:var(--line)}.status-summary>.origin-summary-filter:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.status-summary>.origin-summary-filter strong{font-size:14px;color:var(--ink)}.status-summary>.origin-summary-filter .bullet{flex:none}@media(max-width:420px){.status-summary{gap:6px}.status-summary>.origin-summary-filter{min-height:44px;padding:6px 9px}}.origin-schedule-empty{padding:14px}\n/* Origin search-first controls are owned by this view only. */\n.origin-jump-result{display:inline-flex;align-items:center;justify-content:center;gap:5px;flex:none;min-height:44px;min-width:44px;padding:7px 12px;border:1px solid var(--line);background:var(--paper);border-radius:10px;color:var(--ink-soft);font-size:12px;font-weight:760;white-space:nowrap;cursor:pointer}\n.origin-jump-result:hover:not(:disabled){background:var(--accent-bg);border-color:var(--accent);color:var(--accent-dark)}\n.origin-jump-result:disabled{opacity:.45;cursor:default}\n.origin-jump-result:focus-visible,.origin-todo-search-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:2px}\n.origin-todo-section-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}\n.origin-todo-search-toggle{display:inline-flex;gap:5px;align-items:center;justify-content:center;color:var(--ink-soft);background:transparent;border:1px solid var(--line);padding:6px 10px;border-radius:9px;min-height:44px;white-space:nowrap;font-size:12px;font-weight:740}\n.origin-todo-search-toggle[aria-expanded=\"true\"]{background:var(--accent-bg);color:var(--accent-dark);border-color:var(--accent)}\n.origin-todo-search-row{display:flex;align-items:center;gap:8px;margin:0 0 10px;min-width:0}\n.origin-todo-search-row input{min-height:44px;min-width:0;flex:1 1 auto;width:100%;padding:8px 12px;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:10px;font-size:14px}\n.origin-todo-search-result{font-size:12px;color:var(--muted);margin:0 0 9px}\n.origin-todo-search-history-wrap{display:flex;justify-content:flex-start;flex-wrap:wrap;gap:8px;margin:-2px 0 9px}\n.origin-todo-search-history-wrap[hidden]{display:none}\n.origin-todo-search-history{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:7px 12px;color:var(--ink-soft);background:var(--paper);border:1px solid var(--line);border-radius:10px;font-weight:740;font-size:12px;white-space:nowrap}\n.origin-todo-search-history[aria-pressed=\"true\"]{background:var(--accent-bg);border-color:var(--accent);color:var(--accent-dark)}\n.origin-todo-search-history:hover{border-color:var(--accent)}\n@media(max-width:770px){\n.origin-task-tools>input{flex:1 1 155px;min-width:0;max-width:none}\n.origin-memo-utility>input{flex:1 1 145px;min-width:0;max-width:none;width:auto}\n.origin-calendar-search{flex:1 1 145px;min-width:0;max-width:none}\n.origin-todo-main .section-head{align-items:flex-start;gap:8px}\n.origin-todo-main .section-head h2{min-width:0}\n.origin-todo-section-actions{flex:0 1 auto}\n}\n@media(max-width:390px){\n.origin-jump-result{padding:7px 9px}\n.origin-jump-result span{display:none}\n\n.origin-todo-main .section-head{flex-wrap:nowrap;align-items:center}\n.origin-todo-main .section-head h2{flex-shrink:0}\n.origin-todo-section-actions{width:auto;flex-wrap:nowrap;justify-content:flex-end;margin-left:auto}\n.origin-todo-search-toggle{width:44px;min-width:44px;font-size:0;padding:0}\n.origin-todo-search-toggle svg{width:18px;height:18px}\n.origin-todo-section-actions .text-button{min-width:0;white-space:nowrap;padding-inline:2px;font-size:11px}\n}\n\n/* Origin: secondary controls collapse only on mobile. Search, tabs and new record remain accessible. */\n.origin-mobile-advanced-switch{display:none}\n@media(max-width:770px){\n .origin-mobile-advanced-switch{display:flex;align-items:center;justify-content:flex-end;margin:0 0 7px}\n .origin-mobile-advanced-switch button{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:7px 12px;\n    border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink-soft);font-size:12px;font-weight:750}\n .origin-mobile-advanced-switch button[aria-expanded=\"true\"]{background:var(--accent-bg);border-color:var(--accent);color:var(--accent-dark)}\n .origin-mobile-advanced-switch button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}\n .origin-mobile-advanced-switch .origin-advanced-count{font-size:11px;border-radius:7px;padding:3px 6px;\n   background:var(--accent-bg);color:var(--accent-dark);font-variant-numeric:tabular-nums}\n .origin-task-tools[data-mobile-advanced=\"false\"]>label,\n .origin-task-tools[data-mobile-advanced=\"false\"]>.origin-density-button,\n .status-rail[data-mobile-advanced=\"false\"],\n .origin-task-toolbar[data-mobile-advanced=\"false\"]>.origin-advanced-only,\n .origin-memo-utility[data-mobile-advanced=\"false\"]>label,\n .origin-memo-filters[data-mobile-advanced=\"false\"]{display:none}\n .origin-task-tools{margin-bottom:0}\n .origin-task-toolbar{margin-bottom:8px}\n .origin-memo-utility{margin-bottom:3px}\n}\n"));
    mount.querySelector('style').appendChild(document.createTextNode("/* Origin: only mount initial task rows in each group; touch-sized deliberate paging. */\n.origin-task-more{display:flex;align-items:center;flex-wrap:wrap;justify-content:center;gap:8px;padding:13px 15px;border-top:1px solid var(--line-soft);background:var(--paper)}\n.origin-task-more>span{color:var(--muted);font-size:12px;flex:1 1 125px}\n.origin-task-more button{min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:8px 12px;border-radius:10px;background:var(--paper);color:var(--accent-dark);font-weight:760;font-size:12px;border:1px solid var(--line)}\n.origin-task-more button:hover{background:var(--accent-bg);border-color:var(--accent)}\n.origin-task-more button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}\n.origin-task-mobile-assignee{display:none}\n@media(max-width:770px){.origin-task-mobile-assignee{display:inline;color:var(--ink-soft);font-weight:670}}\n@media(max-width:420px){.origin-task-more{gap:6px;padding:10px 11px}.origin-task-more>span{flex-basis:100%;text-align:center}.origin-task-more button{flex:1 1 118px}}\n/* Origin memo library: progressive rendering without shrinking color controls. */\n.origin-memo-more{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:13px 0 0;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--paper)}\n.origin-memo-more>span{color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums}\n.origin-memo-more-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}\n.origin-memo-more-actions button{min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--accent-dark);font-size:12px;font-weight:760;cursor:pointer}\n.origin-memo-more-actions button:hover{border-color:var(--accent);background:var(--accent-bg)}\n.origin-memo-more-actions button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}\n@media(max-width:420px){.origin-memo-more{padding:10px 12px;gap:8px}.origin-memo-more>span{width:100%;text-align:center}.origin-memo-more-actions{width:100%}.origin-memo-more-actions button{flex:1 1 100px}}\n\n/* Memo card hierarchy: title and excerpt first, category/date secondary, pin explicit. */\n.origin-memo-shell .memo-card:focus-visible{outline:3px solid var(--accent);outline-offset:-2px}\n.origin-memo-metadata{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}\n.origin-memo-category{display:inline-flex;align-items:center;min-height:20px;max-width:100%;\n padding:1px 7px;border:1px solid var(--line);border-radius:999px;font-size:11px;font-weight:740;\n color:inherit;overflow-wrap:anywhere}\n.origin-memo-date{white-space:nowrap;font-variant-numeric:tabular-nums}\n.origin-memo-pinned,.origin-memo-next{display:inline-flex;align-items:center;gap:4px;flex:none}\n.origin-memo-pinned{font-weight:760;color:var(--accent-dark)}\n@media(max-width:420px){.origin-memo-list .memo-card h3{display:-webkit-box;-webkit-box-orient:vertical;\n -webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere}\n .origin-memo-list .memo-bottom{gap:6px}.origin-memo-list .origin-memo-metadata{gap:5px}\n .origin-memo-list .origin-memo-category{font-size:10px}}\n\n/* Origin detail reader: shared reading hierarchy, editor controls untouched. */\n.origin-detail-reading{min-width:0;overflow-wrap:anywhere}\n.origin-detail-reading .origin-detail-summary,.origin-detail-reading .origin-task-overview{\n padding:20px;margin:0 0 20px;border:1px solid var(--line);border-radius:14px;\n background:color-mix(in srgb,var(--paper) 88%,var(--accent-bg))}\n.origin-detail-reading .record-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:0 0 13px}\n.origin-detail-reading .origin-task-detail>.record-meta{margin-bottom:12px}\n.origin-detail-reading .origin-detail-main-fact{grid-column:1/-1;background:var(--accent-bg);\n padding:12px 14px;border-radius:10px;border:1px solid var(--line-soft)}\n.origin-detail-reading .origin-detail-main-fact dt{font-size:11px;margin-bottom:5px}\n.origin-detail-reading .origin-detail-main-fact dd{font-size:17px;font-weight:820;line-height:1.55}\n.origin-detail-reading .origin-detail-main-fact.is-overdue{background:var(--red-bg)}\n.origin-detail-reading .origin-detail-main-fact.is-overdue dt{color:var(--red)}\n.origin-detail-reading .origin-detail-main-fact.is-undated{background:var(--paper)}\n.origin-detail-reading .origin-task-facts{gap:12px}\n.origin-detail-reading .origin-schedule-facts{gap:13px;border:0;padding:0}\n.origin-detail-reading .origin-event-times dd{font-variant-numeric:tabular-nums;gap:7px}\n.origin-detail-reading .origin-detail-section{margin:16px 0 0;padding:15px 0 0;border-top:1px solid var(--line)}\n.origin-detail-reading .origin-detail-section .detail-subheading{margin:0 0 10px;font-size:13px;font-weight:800}\n.origin-detail-reading .record-description{white-space:pre-wrap;line-height:1.9;font-size:15px;overflow-wrap:anywhere;word-break:normal}\n.origin-detail-reading .origin-detail-empty{font-size:13px;color:var(--muted);line-height:1.6;margin:0}\n.origin-detail-reading .origin-task-section .record-description{font-size:15px;line-height:1.9}\n.origin-detail-reading .origin-memo-document-section{border:0;margin-top:0;padding-top:0}\n.origin-detail-reading .origin-memo-paper{padding:20px 22px;line-height:2.05;font-size:15px;white-space:pre-wrap;overflow-wrap:anywhere;min-width:0}\n.origin-detail-reading .origin-memo-updated{padding-top:4px;font-variant-numeric:tabular-nums}\n@media(max-width:520px){\n.origin-detail-reading .origin-detail-summary,.origin-detail-reading .origin-task-overview{padding:13px 14px;margin-bottom:13px}\n.origin-detail-reading .origin-detail-main-fact{padding:11px 12px}\n.origin-detail-reading .origin-detail-main-fact dd{font-size:16px}\n.origin-detail-reading .origin-detail-section{margin-top:13px;padding-top:13px}\n.origin-detail-reading .origin-memo-paper{padding:15px 16px;font-size:14px}\n}\n.origin-detail-reading .origin-todo-overview .record-meta,.origin-detail-reading .origin-memo-summary .record-meta{margin-bottom:0}\n\n/* Origin linked records: clear in-panel navigation, no route or storage changes. */\n.origin-related-link{width:100%;min-height:48px;display:flex;align-items:center;gap:10px;\n padding:10px 12px;border:1px solid var(--line);border-radius:11px;background:var(--paper);\n color:var(--ink);text-align:left;font-size:13px;cursor:pointer}\n.origin-related-link:hover{border-color:var(--accent);background:var(--accent-bg)}\n.origin-related-link:focus-visible,.origin-related-back button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}\n.origin-related-link>span{display:grid;gap:4px;flex:1;min-width:0}\n.origin-related-link strong{font-size:13px;font-weight:780;line-height:1.4;overflow-wrap:anywhere}\n.origin-related-link small{font-size:11px;color:var(--muted);line-height:1.4}\n.origin-related-missing{font-size:12px;color:var(--muted);line-height:1.6}\n.origin-detail-reading .origin-task-related{display:grid;gap:8px}\n.origin-related-more{margin-top:10px}\n.origin-related-more summary{cursor:pointer;padding:9px 4px;color:var(--accent-dark);font-size:12px;font-weight:750}\n.origin-related-more .origin-task-related{margin-top:6px}\n.origin-related-back{display:flex;align-items:center;gap:8px;padding:0 0 12px;margin:0 0 14px;border-bottom:1px solid var(--line)}\n.origin-related-back button{display:inline-flex;align-items:center;gap:8px;min-height:44px;\n min-width:0;max-width:100%;padding:7px 10px;border:1px solid var(--line);border-radius:10px;\n color:var(--accent-dark);background:var(--paper);font-size:12px;font-weight:740}\n.origin-related-back button:hover{background:var(--accent-bg);border-color:var(--accent)}\n.origin-related-back button span{max-width:22rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n@media(max-width:420px){.origin-related-back button span{max-width:210px}.origin-related-link{padding:10px 9px}}\n"));
    mount.querySelector('style').appendChild(document.createTextNode(".origin-related-picker{display:grid;gap:8px}.origin-related-picker-search{display:flex;align-items:center;gap:8px}.origin-related-picker-search input{min-width:0;flex:1}.origin-related-picker-search button{min-height:43px;padding:0 13px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink);font-weight:750}.origin-related-picker-hint{color:var(--muted);font-size:12px;line-height:1.5}.origin-related-picker select:focus-visible,.origin-related-picker-search input:focus-visible{outline:3px solid var(--accent);outline-offset:2px}"));
    mount.querySelector('style').appendChild(document.createTextNode(".origin-task-related-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}.origin-task-related-head h3{margin:0}.origin-task-schedule-add{min-height:40px;display:inline-flex;gap:6px;align-items:center;white-space:nowrap;font-size:13px}.origin-task-schedule-add:focus-visible{outline:3px solid var(--accent);outline-offset:2px}"));
    mount.querySelector('style').appendChild(document.createTextNode(`
/* Origin-only grouped timeline for schedules related to a task. */
.origin-related-group-label{display:flex;align-items:center;gap:9px;margin:12px 0 8px;color:var(--ink-soft)}
.origin-related-group-label strong{font-size:13px;font-weight:800}
.origin-related-group-label small{color:var(--muted);font-size:12px}
.origin-related-past{margin-top:10px;border:1px solid var(--line);border-radius:11px;overflow:hidden;background:var(--paper)}
.origin-related-past summary{display:flex;align-items:center;min-height:44px;cursor:pointer;padding:10px 12px;color:var(--ink-soft);font-size:13px;font-weight:760}
.origin-related-past summary:before{content:'+';display:inline-flex;justify-content:center;align-items:center;width:19px;height:19px;border-radius:6px;background:var(--accent-bg);color:var(--accent-dark);margin-right:9px}
.origin-related-past[open] summary:before{content:'−'}
.origin-related-past summary:focus-visible{outline:3px solid var(--accent);outline-offset:-3px}
.origin-related-past .origin-task-related{padding:0 9px 9px}
`));
    mount.querySelector('style').appendChild(document.createTextNode(`
/* Origin related appointment rows: detail and edit are independent actions. */
.origin-related-entry{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:stretch}
.origin-related-entry>.origin-related-link{min-width:0}
.origin-related-entry>.origin-related-edit{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-width:68px;min-height:48px;padding:9px;border:1px solid var(--line);border-radius:11px;background:var(--paper);color:var(--ink-soft);font-size:12px;font-weight:760;cursor:pointer}
.origin-related-entry>.origin-related-edit:hover{background:var(--accent-bg);border-color:var(--accent);color:var(--accent-dark)}
.origin-related-entry>.origin-related-edit:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.origin-linked-task-due.is-late{color:var(--red);font-weight:790}
`));
    mount.querySelector('style').appendChild(document.createTextNode(`
/* Origin task inspector: context actions expand beneath a linked appointment row. */
.origin-related-entry-actions{grid-column:1/-1;display:flex;gap:7px;flex-wrap:wrap;padding:9px;border:1px solid var(--line-soft);border-radius:10px;background:var(--accent-bg)}
.origin-related-entry-actions[hidden]{display:none}
.origin-related-entry-actions button{flex:1 1 124px;min-height:42px;padding:9px 11px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink-soft);font-size:12px;font-weight:750;line-height:1.4;text-align:center;cursor:pointer}
.origin-related-entry-actions button:hover{border-color:var(--accent);color:var(--accent-dark)}
.origin-related-entry-actions button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.origin-related-entry>[data-action="related-event-menu"][aria-expanded="true"]{background:var(--accent-bg);border-color:var(--accent);color:var(--accent-dark)}
`));
    mount.querySelector('style').appendChild(document.createTextNode(`
/* Origin calendar: accessible mobile week navigation and compact schedule metadata. */
.origin-event-meta{display:flex;align-items:center;flex-wrap:wrap;gap:4px;min-width:0;margin-top:5px}
.origin-event-meta>span{display:inline-block;max-width:100%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:6px;padding:2px 6px;border:1px solid var(--line-soft);background:var(--bg);color:var(--ink-soft);font-size:10px;font-weight:670;line-height:1.35}
.schedule-event .origin-event-meta{margin-top:5px}
.weekday-col .origin-event-meta>span{font-size:10px;padding:2px 4px}
.origin-agenda-entry>.origin-event-meta{grid-column:2/-1;margin-top:0}
.origin-week-jump,.origin-mobile-week-actions{display:none}
@media(max-width:770px){
 .origin-week-jump{display:flex;gap:6px;overflow-x:auto;scrollbar-width:thin;scroll-snap-type:x proximity;padding:12px 13px 6px;overscroll-behavior-x:contain}
 .origin-week-jump button{flex:1 0 47px;min-width:47px;min-height:62px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:1px solid var(--line);border-radius:11px;background:var(--paper);color:var(--ink-soft);font-size:11px;scroll-snap-align:start;cursor:pointer}
 .origin-week-jump button strong{font-size:14px;color:var(--ink);line-height:1.2}
 .origin-week-jump button small{font-size:10px;color:var(--muted)}
 .origin-week-jump button.origin-week-today{border-color:var(--accent);color:var(--accent-dark)}
 .origin-week-jump button[aria-pressed="true"]{background:var(--accent-bg);border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
 .origin-week-jump button:focus-visible,.origin-mobile-week-actions button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
 .mobile-agenda .agenda-day{scroll-margin-top:118px}
 .origin-mobile-week-actions{display:flex;justify-content:space-between;gap:10px;padding:0 14px 14px}
 .origin-mobile-week-actions button{flex:1;min-height:44px;display:inline-flex;justify-content:center;align-items:center;gap:6px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);font-size:13px;font-weight:750;cursor:pointer}
 .mobile-agenda .agenda-entry>.origin-event-meta{grid-column:2}
}
`));
    mount.querySelector('style').appendChild(document.createTextNode(`
/* Origin calendar: desktop fields stay visible; mobile disclosure reduces toolbar height. */
.origin-schedule-filter-panel{display:contents}
.origin-schedule-filter-toggle,.origin-schedule-filter-summary{display:none}
.origin-schedule-filter-reset{min-height:40px;padding:7px 11px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink-soft);font-size:12px;font-weight:750;white-space:nowrap;cursor:pointer}
.origin-schedule-filter-reset:hover{border-color:var(--accent);color:var(--accent-dark)}
.origin-schedule-filter-reset:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
@media(max-width:770px){
 .origin-schedule-toolbar .origin-calendar-controls{width:100%;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
 .origin-calendar-controls #originDateJump{order:0;flex:1 1 130px;min-width:0;min-height:44px}
 .origin-calendar-controls .origin-schedule-view{order:1;flex:1 1 100%;min-width:0}
 .origin-schedule-filter-toggle{order:2;display:inline-flex;align-items:center;justify-content:center;gap:6px;flex:0 1 auto;min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);font-size:12px;font-weight:780;cursor:pointer}
 .origin-schedule-filter-toggle[aria-expanded="true"]{border-color:var(--accent);background:var(--accent-bg)}
 .origin-schedule-filter-toggle:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
 .origin-schedule-filter-count{font-size:11px;color:var(--accent-dark)}
 .origin-schedule-filter-summary{order:3;display:inline-flex;align-items:center;flex:1 1 85px;color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums}
 .origin-schedule-filter-reset{order:4;min-height:44px;padding:8px 10px;flex:none}
 .origin-schedule-filter-panel{order:5;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;flex:1 1 100%;width:100%;min-width:0;padding:11px;border:1px solid var(--line);border-radius:11px;background:var(--bg)}
 .origin-schedule-filter-panel[data-open="false"]{display:none}
 .origin-schedule-filter-panel #originScheduleSearch{grid-column:1/-1;min-width:0;max-width:none;width:100%;min-height:44px;margin:0}
 .origin-schedule-filter-panel #originScheduleAssignee{grid-column:1;min-width:0;max-width:none;width:100%;min-height:44px;margin:0}
 .origin-schedule-filter-panel .origin-jump-result{grid-column:2;min-height:44px}
}
`));
    mount.querySelector('style').appendChild(document.createTextNode(`
/* Origin calendar: separate cross-week results from the current week board. */
.origin-schedule-scope{display:inline-flex;align-items:center;gap:3px;padding:3px;border:1px solid var(--line);border-radius:9px;background:var(--paper)}
.origin-schedule-scope button{min-height:36px;padding:6px 11px;border:0;border-radius:7px;background:transparent;color:var(--ink-soft);font-size:12px;font-weight:740;white-space:nowrap;cursor:pointer}
.origin-schedule-scope button[aria-pressed="true"]{background:var(--accent-bg);color:var(--accent-dark)}
.origin-schedule-scope button:focus-visible,.origin-schedule-global-results button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.origin-schedule-global-results{margin:0 0 14px;padding:15px;border:1px solid var(--line);border-radius:13px;background:var(--paper)}
.origin-schedule-global-head{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:7px;margin-bottom:10px}
.origin-schedule-global-head strong{font-size:15px;color:var(--ink)}
.origin-schedule-global-head small,.origin-schedule-global-empty{font-size:12px;color:var(--muted);line-height:1.65}
.origin-schedule-global-list{display:grid;gap:6px}
.origin-schedule-global-item{display:grid;grid-template-columns:112px minmax(0,1fr) auto;align-items:center;gap:9px;border:1px solid var(--line-soft);border-radius:10px;padding:8px 10px;background:var(--bg)}
.origin-schedule-global-when{display:flex;flex-direction:column;gap:4px;min-width:0}
.origin-schedule-global-when time{display:grid;gap:4px}
.origin-schedule-global-when strong{font-size:13px;font-weight:780;color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap}
.origin-schedule-global-when strong span{font-size:11px;font-weight:620;color:var(--muted)}
.origin-schedule-global-when small{color:var(--muted);font-size:11px;font-variant-numeric:tabular-nums}
.origin-schedule-global-info{display:grid;gap:3px;min-width:0}
.origin-schedule-global-info>strong{color:var(--ink);font-size:13px;font-weight:750;overflow-wrap:anywhere}
.origin-schedule-global-info>small{color:var(--muted);font-size:11px;overflow-wrap:anywhere}
.origin-schedule-global-info .origin-event-meta{margin-top:3px}
.origin-schedule-global-actions{display:flex;gap:6px}
.origin-schedule-global-actions button,.origin-schedule-global-more{min-height:40px;padding:8px 11px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink);font-size:12px;font-weight:750;white-space:nowrap;cursor:pointer}
.origin-schedule-global-actions button:hover,.origin-schedule-global-more:hover{border-color:var(--accent);color:var(--accent-dark)}
.origin-schedule-global-more{display:block;margin:12px auto 0;min-width:145px}
@media(max-width:770px){
 .origin-schedule-filter-panel .origin-schedule-scope{grid-column:1/-1;justify-content:flex-start;min-width:0}
 .origin-schedule-filter-panel .origin-schedule-scope button{flex:1;min-width:0;min-height:42px}
 .origin-schedule-global-results{margin:0 0 12px;padding:11px}
 .origin-schedule-global-item{grid-template-columns:88px minmax(0,1fr);gap:8px;align-items:start;padding:9px}
 .origin-schedule-global-actions{grid-column:1/-1;justify-content:flex-end}
 .origin-schedule-global-actions button{min-height:44px;flex:1}
}
`));
    mount.querySelector('style').appendChild(document.createTextNode(`
/* Origin global search: filters stay inside the expandable controls, including at 320px. */
.origin-schedule-advanced{display:flex;gap:8px;flex:1 1 100%;min-width:0;flex-wrap:wrap;align-items:end;padding:9px;border:1px solid var(--line-soft);border-radius:10px;background:var(--bg)}
.origin-schedule-advanced label{display:flex;flex:1 1 130px;min-width:0;flex-direction:column;gap:4px;color:var(--muted);font-size:11px;font-weight:700}
.origin-schedule-advanced select,.origin-schedule-advanced input{display:block;width:100%;max-width:100%;min-width:0;min-height:39px;border:1px solid var(--line);border-radius:8px;padding:6px 8px;background:var(--paper);color:var(--ink);font-size:13px;font-weight:570}
.origin-schedule-advanced :is(select,input):focus-visible{outline:3px solid var(--accent);outline-offset:2px}
@media(max-width:770px){
 .origin-schedule-filter-panel .origin-schedule-advanced{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%;padding:9px;gap:9px}
 .origin-schedule-advanced label{min-width:0;min-height:0}
 .origin-schedule-advanced label:first-child,.origin-schedule-advanced label:last-child{grid-column:1/-1}
 .origin-schedule-advanced select,.origin-schedule-advanced input{min-height:44px}
}
`));
    mount.querySelector('style').appendChild(document.createTextNode(`
/* Origin weekly agenda: busy dates show a compact preview with a reversible reveal. */
.mobile-agenda .agenda-day.origin-agenda-empty{padding-top:8px;padding-bottom:8px;opacity:.88}
.mobile-agenda .agenda-day.origin-agenda-busy .agenda-day-head{margin-bottom:8px}
.mobile-agenda .origin-agenda-more{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;min-height:44px;padding:8px 12px;margin:5px 0 3px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--accent-dark);font-size:12px;font-weight:750;cursor:pointer}
.mobile-agenda .origin-agenda-more:hover{border-color:var(--accent);background:var(--accent-bg)}
.mobile-agenda .origin-agenda-more:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
@media(max-width:390px){
 .mobile-agenda .agenda-day-head{flex-wrap:wrap;gap:6px}
 .mobile-agenda .agenda-day-head .origin-agenda-day-label{min-width:0;white-space:normal;text-align:left}
 .mobile-agenda .agenda-entry{min-width:0}
 .mobile-agenda .agenda-entry .agenda-name{overflow-wrap:anywhere}
}
`));
    mount.querySelector('style').appendChild(document.createTextNode(`
/* ToDo large lists: reuse Origin's progressive list treatment and theme tokens. */
.origin-todo-more{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:12px 10px;border-top:1px solid var(--line-soft);background:var(--paper)}
.origin-todo-more>span{color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums}
.origin-todo-more-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.origin-todo-more-actions button{min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--accent-dark);font-size:12px;font-weight:760;cursor:pointer}
.origin-todo-more-actions button:hover{background:var(--accent-bg);border-color:var(--accent)}
.origin-todo-more-actions button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
@media(max-width:420px){.origin-todo-more>span{width:100%;text-align:center}.origin-todo-more-actions{width:100%}.origin-todo-more-actions button{flex:1 1 112px}}
`));
    mount.querySelector('style').appendChild(document.createTextNode(`
/* Origin list edit shortcuts: keep each title/card as the original detail target. */
.origin-list-quick-edit{display:inline-flex;align-items:center;justify-content:center;flex:none;width:36px;height:36px;min-width:36px;padding:0!important;border:1px solid var(--line)!important;border-radius:9px;background:var(--paper)!important;color:var(--ink-soft)!important;cursor:pointer}
.origin-list-quick-edit:hover{border-color:var(--accent)!important;color:var(--accent-dark)!important;background:var(--accent-bg)!important}
.origin-list-quick-edit:focus-visible{outline:3px solid var(--accent);outline-offset:2px}

.origin-task-collection .row-last{min-width:0}
@media(max-width:420px){
 .origin-task-collection .row-last{gap:5px}


}
`));
    mount.querySelector('style').appendChild(document.createTextNode(`
/* Origin lists: visible, predictable detail/edit/completion actions on every viewport. */
.origin-task-collection .item-row .item-name{display:flex;align-items:center;justify-content:flex-start;gap:5px;max-width:100%;min-width:0;text-align:left;max-height:3.1em;overflow:hidden}
.origin-task-collection .item-row .origin-task-title-text{min-width:0;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.origin-task-collection .item-row .origin-task-detail-arrow{display:inline-flex;align-items:center;flex:none;color:var(--muted)}
.origin-task-collection .item-row .row-last{display:flex;align-items:center;gap:6px;min-width:0}
.origin-task-collection .item-row .row-last .origin-list-quick-edit{display:inline-flex;min-width:44px;min-height:44px;width:44px;height:44px;flex:0 0 44px}
.origin-task-collection .item-row .row-last .primary-mini{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px}
.origin-todo-main .todo-entry{gap:6px;min-width:0}
.origin-todo-main .todo-entry>.origin-list-quick-edit{display:inline-flex;width:44px;min-width:44px;height:44px;min-height:44px;flex:0 0 44px}
.origin-todo-main .todo-entry .todo-text{min-width:0}
.origin-memo-shell .origin-memo-action-row{display:flex;align-items:center;gap:6px;width:100%;min-width:0;max-width:100%;padding:0 8px 5px;overflow:hidden}
.origin-memo-shell .origin-memo-action-row .origin-memo-colors{display:flex;flex:1 1 auto;min-width:0;width:auto;max-width:none;margin:0;padding:7px 4px;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin;flex-wrap:nowrap}
.origin-memo-shell .origin-memo-action-row>.origin-list-quick-edit{display:inline-flex;align-items:center;justify-content:center;gap:5px;flex:0 0 auto;width:auto;min-width:54px;min-height:44px;height:44px;padding:0 8px!important;white-space:nowrap}
.origin-memo-list .origin-memo-action-row{width:min(100%,408px);max-width:100%;justify-self:end}
@media(max-width:950px){
 .origin-memo-list .origin-memo-action-row{width:100%;justify-self:stretch}
}
@media(max-width:390px){
 .origin-memo-action-row>.origin-list-quick-edit .origin-edit-label{display:none}
 .origin-memo-shell .origin-memo-action-row>.origin-list-quick-edit{width:44px;min-width:44px;padding:0!important}
 .origin-task-collection .item-row .row-last{gap:5px}
}
`));
    mount.querySelector('style').appendChild(document.createTextNode(`
/* Origin edit form: essential details first; nonessential data stays in the same form. */
#editForm[data-kind="tasks"] .origin-task-optional{grid-column:1/-1;border:1px solid var(--line);border-radius:11px;background:var(--bg);min-width:0;overflow:hidden}
#editForm[data-kind="tasks"] .origin-task-optional summary{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:12px 13px;min-height:44px;cursor:pointer;font-size:13px;font-weight:770;color:var(--ink)}
#editForm[data-kind="tasks"] .origin-task-optional summary small{color:var(--muted);font-size:11px;font-weight:580}
#editForm[data-kind="tasks"] .origin-task-optional summary:focus-visible{outline:3px solid var(--accent);outline-offset:-3px}
#editForm[data-kind="tasks"] .origin-task-optional summary .origin-task-expand-cue{display:inline-flex;align-items:center;margin-left:auto;transition:transform .15s ease}
#editForm[data-kind="tasks"] .origin-task-optional[open] summary .origin-task-expand-cue{transform:rotate(180deg)}
#editForm[data-kind="tasks"] .origin-task-extra-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;padding:10px 13px 4px;border-top:1px solid var(--line-soft)}
#editForm[data-kind="tasks"] .origin-task-extra-grid>.full{grid-column:1/-1}
#editForm[data-kind="tasks"] .origin-task-extra-grid>.form-field{min-width:0}
#editForm[data-kind="todos"] .origin-todo-edit-fields,#editForm[data-kind="memos"] .origin-memo-edit-fields{display:grid;gap:11px;min-width:0}
#editForm[data-kind="todos"] .origin-todo-edit-fields>.form-field,#editForm[data-kind="memos"] .origin-memo-edit-fields>.form-field{margin:0}
#editForm[data-kind="todos"] .origin-todo-status-field{display:grid;grid-template-columns:55px minmax(0,1fr);align-items:center;gap:8px}
#editForm[data-kind="todos"] .origin-todo-status-field select{min-width:0;max-width:220px}
#editForm[data-kind="memos"] .origin-memo-body-input{resize:vertical;min-height:260px}
#editForm[data-kind="memos"] .origin-memo-edit-fields>fieldset{margin:0;min-width:0}
@media(max-width:770px){
 #editForm[data-kind="tasks"] .form-grid{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:9px;row-gap:3px}
 #editForm[data-kind="tasks"] .form-grid>.full,#editForm[data-kind="tasks"] .form-grid>.origin-task-optional{grid-column:1/-1}
 #editForm[data-kind="tasks"] .form-grid>.form-field{min-width:0;margin-bottom:11px}
 #editForm[data-kind="tasks"] .form-grid>.form-field input,#editForm[data-kind="tasks"] .form-grid>.form-field select{min-width:0;max-width:100%;padding:8px 6px;font-size:13px;min-height:44px}
 #editForm[data-kind="tasks"] .origin-task-extra-grid{grid-template-columns:minmax(0,1fr);gap:1px}
 #editForm[data-kind="tasks"] .origin-task-extra-grid>.form-field{margin-bottom:12px}
 #editForm[data-kind="todos"] .origin-todo-edit-fields{gap:11px}
 #editForm[data-kind="todos"] [name="memo"]{min-height:108px}
 #editForm[data-kind="memos"] .origin-memo-palette{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
 #editForm[data-kind="memos"] .origin-memo-palette label{min-width:0;min-height:44px;padding:6px 4px;justify-content:center;gap:5px;font-size:11px}
 #editForm[data-kind="memos"] .origin-memo-palette input[type="radio"]{width:16px!important;min-width:16px;min-height:16px!important;height:16px!important}
 #editForm[data-kind="memos"] .origin-memo-swatch{width:17px;height:17px;flex-basis:17px}
 #editForm[data-kind="memos"] .origin-memo-body-input{min-height:clamp(165px,32dvh,260px)}
}
`));
    mount.querySelector('style').appendChild(document.createTextNode(`
/* Origin mobile editor: keep save and cancel reachable while a keyboard is open. */
.sheet[data-origin-keyboard="true"] .sheet-foot{flex:0 0 auto;max-height:none;overflow:visible;padding:6px 12px max(7px,env(safe-area-inset-bottom,0px))}
.sheet[data-origin-keyboard="true"] .origin-draft-state{margin:0 0 5px;font-size:10px}
.sheet[data-origin-keyboard="true"] .origin-sheet-actions{gap:0}
.sheet[data-origin-keyboard="true"] .origin-sheet-primary{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(95px,.85fr);gap:6px}
.sheet[data-origin-keyboard="true"] .origin-sheet-primary button{min-height:44px;padding-inline:8px}
.sheet[data-origin-keyboard="true"] .origin-sheet-danger{display:none}
#editForm[data-kind="tasks"] .origin-task-description-input{min-height:180px}\n@media(max-width:770px){#editForm[data-kind="tasks"] .origin-task-description-input{min-height:150px}}\n#editForm .origin-field-error{margin:5px 0 0;padding:7px 9px;border:1px solid var(--red);border-radius:8px;color:var(--red);font-size:12px;font-weight:650;line-height:1.5;background:var(--red-bg);overflow-wrap:anywhere}
#editForm [data-origin-field-invalid="true"]{border-color:var(--red)!important;outline:2px solid var(--red);outline-offset:1px}
#editForm .origin-checkrow>.origin-field-error{grid-column:1/-1}
#editForm .origin-save-recovery{margin:0 0 14px;padding:11px 12px;border-radius:11px;border:1px solid color-mix(in srgb,var(--warn) 34%,var(--line));background:var(--warn-bg);color:var(--ink);font-size:12px;line-height:1.6}
#editForm .origin-save-recovery[hidden],#editForm #originDraftCopyFallback[hidden]{display:none}
#editForm .origin-save-recovery p{margin:0 0 8px;overflow-wrap:anywhere}
#editForm .origin-save-recovery-actions{display:flex;gap:7px;flex-wrap:wrap}
#editForm .origin-save-recovery-actions button{min-height:44px;color:var(--ink);border-color:var(--line);background:var(--paper)}
#editForm .origin-save-recovery-actions button[hidden]{display:none}
#editForm #originDraftCopyFallback{display:block;width:100%;min-height:104px;margin-top:8px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);resize:vertical;white-space:pre-wrap}
`));
    mount.querySelector('style').appendChild(document.createTextNode(`
.origin-batch-options{margin-top:18px}
#originBatchFields{grid-column:1/-1;min-width:0}
#originBatchFields[hidden],#originBatchFields [hidden]{display:none!important}
#originRecurrenceFields{grid-column:1/-1;min-width:0}
#originRecurrenceFields[hidden],#originRecurrenceFields [hidden]{display:none!important}
.origin-recurrence{grid-column:1/-1}
.origin-recurrence input[type="checkbox"]{width:18px;min-height:18px}
.origin-template-picker{display:flex;align-items:end;gap:8px;flex-direction:row}
.origin-template-picker>label{flex:1;min-width:0;display:grid;gap:6px}
.origin-tool-list{display:grid;gap:8px}
.origin-tool-row{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:14px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);text-align:left}
.origin-tool-row span{min-width:0;overflow-wrap:anywhere}.origin-tool-row small{display:block;color:var(--muted);margin-top:6px}
.origin-tool-search{margin-bottom:16px}.origin-layout-controls{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:14px}
.origin-stats-scroll{overflow:auto}.origin-stats{width:100%;border-collapse:collapse;font-size:13px}.origin-stats th,.origin-stats td{text-align:left;padding:12px;border-bottom:1px solid var(--line)}
.origin-task-layout-board{display:flex;overflow-x:auto;gap:14px;padding:14px;background:var(--bg)}
.origin-task-layout-board>.origin-task-group{flex:0 0 292px;max-width:100%;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--paper)}
.origin-task-layout-board .item-row{grid-template-columns:22px minmax(0,1fr);gap:9px;padding:13px}
.origin-task-layout-board .item-assignee,.origin-task-layout-board .item-date{display:none}
.origin-task-layout-board .row-last{grid-column:2;justify-content:flex-start}.origin-task-layout-board .group-title{padding:12px}
.origin-task-layout-timeline>.origin-task-group{margin:0 14px 16px;border-left:3px solid var(--accent-bg);padding-left:10px}
.origin-task-layout-timeline .group-title{background:var(--accent-bg);border-radius:8px;border:0}
.origin-management{margin-bottom:28px}.origin-management input{max-width:100%;min-width:0;min-height:42px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink)}
.origin-series-delete{margin-top:20px;border-color:var(--red)}.origin-series-delete input[type="radio"]{width:18px;min-height:18px}.origin-series-delete label{display:flex;align-items:center;gap:8px;min-height:44px}
.origin-batch-weekdays{display:flex;flex-wrap:wrap;gap:8px}
.origin-batch-weekdays label{display:flex;align-items:center;gap:5px;min-height:44px;padding:5px}
.origin-batch-options input[type="checkbox"]{width:18px;min-height:18px}
.origin-batch-dates{display:flex;flex-wrap:wrap;gap:6px;max-height:220px;overflow:auto;margin-top:10px}
.origin-batch-review{padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--hover);overflow-wrap:anywhere}
.origin-batch-review p{line-height:1.7;margin-bottom:0}
.sheet[data-reader-kind="tasks"],.sheet[data-reader-kind="events"],.sheet[data-reader-kind="knowledge"]{width:min(680px,100%)}
.sheet[data-reader-kind="tasks"] .origin-detail-pager{position:static}
.origin-task-detail{color:var(--ink);min-width:0}
.origin-task-detail>.origin-task-section{margin:18px 0 0;padding:20px;border:1px solid var(--line);border-radius:14px;background:var(--paper);min-width:0;scroll-margin-top:76px}
.origin-task-detail>.origin-task-section h3{font-size:15px;line-height:1.5;margin:0 0 16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.origin-task-detail h3 small{font-size:11px;font-weight:650;color:var(--ink-soft);padding:2px 7px;border-radius:6px;background:var(--bg)}
.origin-task-detail>.origin-task-section>p{font-size:15px;color:var(--ink);line-height:1.9}
.origin-task-detail .origin-task-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.origin-task-facts .origin-recurrence-fact{grid-column:1/-1;padding-top:12px;border-top:1px solid var(--line-soft)}
.origin-task-facts dt{font-size:12px;color:var(--ink-soft);margin-bottom:5px;font-weight:650}
.origin-task-facts dd{font-size:15px;font-weight:740;line-height:1.65;overflow-wrap:anywhere}
.origin-task-facts .origin-detail-main-fact{border-left:3px solid var(--accent);background:var(--accent-bg)}
.origin-task-facts .origin-detail-main-fact.is-overdue{border-color:var(--red);background:var(--red-bg)}
.origin-reader-nav{position:sticky;top:-1px;z-index:3;display:flex;gap:5px;padding:10px 0;margin:0 0 16px;background:var(--paper);border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:thin}
.origin-reader-nav button{min-height:44px;flex:1 0 auto;padding:8px 11px;border:0;border-radius:9px;background:var(--bg);color:var(--ink-soft);font-size:12px;font-weight:750;white-space:nowrap}
.origin-reader-nav button:hover,.origin-reader-nav button[aria-current="location"]{background:var(--accent-bg);color:var(--accent-dark)}
.origin-reader-nav button small{margin-left:5px;font-variant-numeric:tabular-nums}
.origin-reader-nav~.origin-task-overview{scroll-margin-top:76px}
.origin-comment-list{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.origin-comment-list li{padding:16px;border:1px solid var(--line-soft);border-radius:12px;background:var(--bg);min-width:0}
.origin-comment-list .record-meta{gap:7px;margin-bottom:12px}
.origin-comment-avatar{display:grid;place-items:center;width:30px;height:30px;flex:none;border-radius:10px;background:var(--accent-bg);color:var(--accent-dark);font-size:12px;font-weight:800}
.origin-comment-list strong{font-size:13px;color:var(--ink)}
.origin-comment-list time{font-size:11px;color:var(--ink-soft);margin-left:auto;font-variant-numeric:tabular-nums}
.origin-comment-list .record-description{margin:0;font-size:15px;line-height:1.9;color:var(--ink)}
.origin-comment-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.origin-comment-actions .secondary-button{padding:6px 10px;min-height:44px}
.origin-comment-actions [data-action="comment-reaction"]{min-width:44px;gap:5px;border-radius:99px;background:var(--paper);font-size:17px}
.origin-comment-actions [data-action="comment-reaction"] small{font-size:12px;font-weight:750}
.origin-comment-actions [aria-pressed="true"]{color:var(--accent-dark);background:var(--accent-bg);border-color:var(--accent)}
.origin-comment-list blockquote{margin:0 0 12px;padding:9px 11px;border-left:3px solid var(--accent);background:var(--paper);border-radius:0 7px 7px 0;font-size:12px;color:var(--ink-soft);line-height:1.7}
.origin-comment-connect{margin:0 0 14px;padding:10px 12px;border-radius:9px;background:var(--hover);font-size:12px;color:var(--ink-soft);line-height:1.7}
.origin-workflow>summary{cursor:pointer;font-size:15px;font-weight:780;min-height:44px;padding:0;line-height:1.6}.origin-workflow>summary:focus-visible{outline:3px solid var(--accent);outline-offset:3px;border-radius:6px}
.origin-workflow>summary small{display:block;font-weight:600;font-size:12px;color:var(--ink-soft);margin:5px 0 0;line-height:1.6}
.origin-workflow section{padding:18px 0;border-top:1px solid var(--line-soft);margin-top:16px}
.origin-workflow h4{margin:0 0 12px;font-size:14px}
.origin-workflow-list{padding:0;list-style:none}
.origin-workflow-list li,.origin-workflow-add{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.origin-workflow-list li>.text-button,.origin-workflow-add>select,.origin-workflow-add>label{flex:1;min-width:0;overflow-wrap:anywhere}
.origin-workflow-add>select{width:100%;min-height:44px;background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:8px}
.origin-workflow-list li>.text-button{text-align:left}
#originCommentForm{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px;padding:16px;background:var(--paper);border:1px solid var(--line);border-radius:12px}
#originCommentForm>.form-field:has(textarea),#originReplyContext,#originCommentForm>[role="alert"],#originCommentForm>button{grid-column:1/-1}
#originCommentForm textarea{min-height:116px;resize:vertical;font-size:15px;line-height:1.8}
#originCommentForm button{justify-self:start}
#originReplyContext{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0;padding:9px 11px;background:var(--accent-bg);border-radius:8px;color:var(--accent-dark);font-size:12px}
#originReplyContext[hidden]{display:none}
.origin-comment-more{margin:14px 0 0}.origin-comment-more>summary{padding:12px 0;font-size:12px;color:var(--accent-dark);cursor:pointer}
.origin-tool-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 24px}
.origin-tool-nav button{display:flex;align-items:center;gap:11px;text-align:left;min-width:0;min-height:76px;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--paper);color:var(--ink-soft)}
.origin-tool-nav button span{display:grid;gap:5px;min-width:0}.origin-tool-nav button strong{font-size:13px;color:var(--ink)}
.origin-tool-nav button small{font-size:11px;line-height:1.5;overflow-wrap:anywhere}.origin-tool-nav button.active,.origin-tool-nav button:hover{background:var(--accent-bg);border-color:var(--accent);color:var(--accent-dark)}
/* Task detail footer: two frequent actions stay visible, infrequent ones are disclosed. */
.sheet[data-reader-kind="tasks"] .origin-sheet-primary{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)}
.sheet[data-reader-kind="tasks"] .origin-task-primary-done{font-weight:780}
.sheet[data-reader-kind="tasks"] .origin-task-more-actions{min-width:0;border-top:1px solid var(--line-soft);padding-top:5px}
.sheet[data-reader-kind="tasks"] .origin-task-more-actions>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:8px 12px;border-radius:9px;cursor:pointer;color:var(--ink-soft);font-size:12px;font-weight:760}
.sheet[data-reader-kind="tasks"] .origin-task-more-actions>summary::-webkit-details-marker{display:none}
.sheet[data-reader-kind="tasks"] .origin-task-more-actions>summary:hover{background:var(--hover);color:var(--ink)}
.sheet[data-reader-kind="tasks"] .origin-task-more-actions>summary:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.sheet[data-reader-kind="tasks"] .origin-task-more-actions>summary:after{content:'';width:8px;height:8px;flex:none;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);transition:transform .15s ease;margin-right:4px}
.sheet[data-reader-kind="tasks"] .origin-task-more-actions[open]>summary:after{transform:rotate(225deg)}
.sheet[data-reader-kind="tasks"] .origin-task-more-actions:not([open])>.origin-sheet-secondary{display:none}
.sheet[data-reader-kind="tasks"] .origin-task-more-actions[open] .origin-sheet-secondary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:6px;padding:0;overflow:visible}
.sheet[data-reader-kind="tasks"] .origin-task-more-actions .origin-sheet-secondary button{width:100%;min-width:0;min-height:44px;padding:9px 10px;white-space:normal;line-height:1.4;overflow-wrap:anywhere;justify-content:center;text-align:center}
@media(prefers-reduced-motion:reduce){.sheet[data-reader-kind="tasks"] .origin-task-more-actions>summary:after{transition:none}}
@media(max-width:520px){.origin-task-detail>.origin-task-section{padding:15px 13px;margin-top:14px}.origin-comment-list li{padding:13px 11px}.origin-comment-list time{margin-left:0;width:100%;padding-left:37px}.origin-reader-nav{gap:4px}.origin-reader-nav button{padding:8px;font-size:11px}#originCommentForm{padding:12px;gap:10px}.origin-tool-nav{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.origin-tool-nav button{padding:11px;gap:8px;min-height:74px}.origin-tool-nav button small{font-size:10px}}
@media(max-width:420px){.origin-workflow-add{flex-wrap:wrap}.origin-workflow-add>label{flex-basis:100%}.origin-batch-options .origin-task-extra-grid{padding:12px}.origin-task-facts dd{font-size:14px}}

`));
    mount.querySelector('style').appendChild(document.createTextNode("\n/* Origin UI refinements: preserve canonical task data and existing actions. */\n.origin-schedule-toolbar{align-items:flex-start}\n.origin-schedule-advanced{flex:0 1 100%;padding:8px;gap:7px}\n.origin-schedule-advanced label{flex:1 1 130px}\n.origin-schedule-global-results{margin-bottom:12px}\n.origin-task-collection.origin-tasks-compact .item-row{min-height:42px;padding:6px 12px;gap:7px}\n.origin-task-collection.origin-tasks-compact .row-under{display:none}\n.origin-task-collection.origin-tasks-compact .item-name{font-size:12px}\n.origin-task-collection:not(.origin-tasks-compact) .item-row{min-height:94px;padding:17px 18px;gap:14px}\n.origin-task-collection:not(.origin-tasks-compact) .item-name{font-size:15px}\n.origin-task-layout-timeline{position:relative;padding:18px 20px;background:var(--bg)}\n.origin-task-layout-timeline>.origin-task-group{position:relative;margin:0 0 0 9px;padding:0 0 25px 27px;border-left:2px solid var(--line);background:transparent}\n.origin-task-layout-timeline>.origin-task-group:before{content:\"\";position:absolute;top:12px;left:-7px;width:12px;height:12px;border-radius:50%;background:var(--accent);border:3px solid var(--paper);box-shadow:0 0 0 2px var(--accent)}\n.origin-task-layout-timeline .group-title{background:transparent;border:0;padding:0 0 13px}\n.origin-task-layout-timeline .origin-task-group-rows{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px}\n.origin-task-layout-timeline .item-row{position:relative;display:flex;flex-direction:column;align-items:stretch;gap:8px;min-width:0;border:1px solid var(--line);border-radius:12px;background:var(--paper);padding:14px!important;box-shadow:var(--shadow)}\n.origin-task-layout-timeline .task-select-check{position:absolute;top:13px;right:13px}\n.origin-task-layout-timeline .origin-task-main{padding-right:24px}\n.origin-task-layout-timeline .item-assignee,.origin-task-layout-timeline .item-date{display:inline-flex;font-size:11px}\n.origin-task-layout-timeline .row-last{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:6px}\n.origin-task-layout-timeline .origin-task-more{grid-column:1/-1}\n.origin-task-detail>.origin-reader-nav{top:0;padding-top:0;margin-top:0}\n.sheet[data-reader-kind=\"tasks\"] .sheet-body{padding-top:0}\n#editForm[data-kind=\"tasks\"] input[type=\"checkbox\"]{appearance:auto!important;width:18px!important;height:18px!important;min-width:18px!important;min-height:18px!important;max-width:18px!important;max-height:18px!important;flex:0 0 18px!important;padding:0!important}\n.origin-sheet-danger .danger-button{display:inline-flex!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important;justify-content:center!important;gap:7px!important;white-space:nowrap!important;width:auto!important}\n.origin-sheet-danger .danger-button svg{flex:0 0 15px}\n@media(max-width:770px){.origin-task-layout-timeline{padding:10px}.origin-task-layout-timeline .origin-task-group-rows{grid-template-columns:1fr}}\n"));
    mount.querySelector('style').appendChild(document.createTextNode("\n.origin-schedule-advanced-trigger{display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:8px 12px;background:var(--paper);border:1px solid var(--line);border-radius:9px;color:var(--ink-soft);font-size:12px;font-weight:740}\n.origin-schedule-advanced-trigger[aria-expanded=\"true\"]{color:var(--accent-dark);background:var(--accent-bg)}\n.origin-schedule-advanced[hidden]{display:none!important}\n.origin-task-order-pair{display:flex;align-items:center;gap:9px;flex-wrap:wrap}\n.origin-task-order-pair label{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted)}\n.origin-task-order-pair select{height:40px;min-width:105px;border:1px solid var(--line);border-radius:9px;padding:6px;background:var(--paper);color:var(--ink)}\n.origin-task-inline-status{min-width:82px;max-width:112px;min-height:35px;border:1px solid var(--line);border-radius:8px;padding:5px 6px;background:var(--paper);color:var(--ink);font-size:11px;font-weight:740}\n@media(max-width:770px){.origin-task-order-pair{flex:1 1 100%}.origin-task-order-pair label{flex:1 1 130px}}\n"));
    mount.querySelector('style').appendChild(document.createTextNode(".origin-inbox-shortcut{display:inline-flex;align-items:center;justify-content:center}.origin-inbox-shortcut:hover{background:var(--accent-bg);color:var(--accent-dark)}"));
    mount.querySelector('style').appendChild(document.createTextNode("\n/* Origin header: primary navigation is for pages, while preferences live in one menu. */\n.header-inner{gap:clamp(12px,1.2vw,23px)}\n.header-tools{flex:0 0 auto;gap:8px;position:relative}\n.header-nav{flex:1 1 auto;min-width:0;gap:2px}\n.header-nav .nav-button{padding:10px 9px}\n.origin-header-settings{position:relative;flex:0 0 auto}\n.origin-settings-toggle{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:42px;min-width:85px;padding:8px 11px;border:1px solid var(--line);border-radius:10px;color:var(--ink-soft);background:var(--paper);font-size:12px;font-weight:760;white-space:nowrap}\n.origin-settings-toggle:hover,.origin-settings-toggle[aria-expanded=\"true\"]{color:var(--accent-dark);background:var(--accent-bg);border-color:var(--accent)}\n.origin-settings-toggle svg{width:17px;height:17px}\n.origin-settings-panel{position:absolute;z-index:50;right:0;top:calc(100% + 10px);width:min(322px,calc(100vw - 22px));max-height:min(575px,calc(100dvh - 90px));overflow-y:auto;overscroll-behavior:contain;padding:18px;background:var(--paper);border:1px solid var(--line);border-radius:16px;box-shadow:0 16px 45px rgba(22,32,55,.18);color:var(--ink)}\n.origin-settings-panel[hidden]{display:none!important}\n.origin-settings-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:12px;margin-bottom:11px;border-bottom:1px solid var(--line)}\n.origin-settings-heading strong{font-size:15px;font-weight:800}\n.origin-settings-close{display:grid;place-items:center;width:34px;height:34px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink-soft)}\n.origin-settings-close svg{width:16px;height:16px}\n.origin-settings-fields{display:grid;gap:13px}\n.origin-settings-field{display:flex;flex-direction:column;gap:6px;min-width:0}\n.origin-settings-label{font-size:12px;font-weight:740;color:var(--ink-soft)}\n.origin-settings-field>select,#originSettingsPanel #originColorSelect,#originSettingsPanel #originDisplaySelect,#originSettingsPanel #originUserSelect{display:block;box-sizing:border-box;width:100%;max-width:100%;height:44px;min-height:44px;margin:0;padding:8px 11px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);font-size:13px;font-weight:650;cursor:pointer}\n.origin-settings-mode-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);font-size:13px;font-weight:740}\n.origin-settings-mode-button:hover{border-color:var(--accent);background:var(--accent-bg)}\n.origin-settings-mode-button svg{width:17px;height:17px}\n.origin-settings-note{font-size:11px;line-height:1.6;color:var(--muted);margin:13px 0 0}\n@media(max-width:770px){\n .header-tools{width:100%;gap:5px;justify-content:flex-end}\n .origin-settings-toggle{min-width:82px;min-height:44px;padding:8px 9px}\n .origin-settings-panel{right:0;max-height:min(575px,calc(100dvh - 125px))}\n}\n@media(min-width:771px) and (max-width:1500px){.header-nav .nav-button{min-width:0}}\n"));
    mount.querySelector('style').appendChild(document.createTextNode("\n/* Retain critical task dates and assignees in compact mobile layouts. */\n.origin-task-collection.origin-tasks-compact .item-name{font-size:14px;line-height:1.5}\n.origin-task-collection.origin-tasks-compact .origin-task-group-toggle{min-height:44px}\n@media(max-width:770px){\n .origin-task-collection.origin-tasks-compact .row-under{display:flex;flex-wrap:wrap;gap:5px;margin-top:3px}\n .origin-task-collection.origin-tasks-compact .origin-task-mobile-due,\n .origin-task-collection.origin-tasks-compact .origin-task-mobile-assignee{display:inline-flex}\n .origin-task-tools[data-mobile-advanced=\"false\"] .origin-task-order-pair{display:none}\n .origin-task-tools[data-mobile-advanced=\"true\"] .origin-task-order-pair{display:flex}\n}\n"));
    mount.querySelector('style').appendChild(document.createTextNode("\n/* Origin inbox: accessible centered native modal, independent from the \"Other\" tools. */\n.origin-inbox-shortcut{position:relative;display:inline-flex;align-items:center;justify-content:center}\n.origin-inbox-shortcut:hover{background:var(--accent-bg);color:var(--accent-dark)}\n.origin-inbox-badge{position:absolute;right:-3px;top:-4px;min-width:17px;height:17px;padding:0 4px;display:flex;align-items:center;justify-content:center;border-radius:999px;border:2px solid var(--paper);background:#b94056;color:#fff;font-size:10px;font-weight:850;font-variant-numeric:tabular-nums}\n.origin-inbox-badge[hidden]{display:none!important}\n.origin-inbox-dialog{box-sizing:border-box;position:fixed;inset:0;margin:auto;width:min(870px,calc(100vw - 32px));max-width:none;height:min(740px,calc(100dvh - 40px));max-height:none;min-height:0;border:1px solid var(--line);border-radius:18px;padding:0;overflow:hidden;background:var(--paper);color:var(--ink);box-shadow:0 25px 85px #101a3350}\n.origin-inbox-dialog:not([open]){display:none!important}\n.origin-inbox-dialog[open]{display:flex;flex-direction:column}\n.origin-inbox-dialog::backdrop{background:rgba(14,22,39,.56);backdrop-filter:blur(3px)}\n.origin-inbox-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex:0 0 auto;padding:22px 26px 17px;border-bottom:1px solid var(--line);background:linear-gradient(130deg,var(--paper),var(--accent-bg))}\n.origin-inbox-eyebrow{margin:0 0 6px;color:var(--accent-dark);font-size:10px;font-weight:900;letter-spacing:.12em}\n.origin-inbox-head h2{font-size:26px;line-height:1.3;letter-spacing:-.04em;margin:0;color:var(--ink)}\n.origin-inbox-head p:last-child{font-size:12px;line-height:1.6;color:var(--ink-soft);margin:6px 0 0}\n.origin-inbox-close{display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;border:1px solid var(--line);border-radius:11px;background:var(--paper);color:var(--ink)}\n.origin-inbox-close:hover{border-color:var(--accent);color:var(--accent-dark)}\n.origin-inbox-filterbar{padding:13px 26px 11px;flex:0 0 auto;border-bottom:1px solid var(--line-soft)}\n.origin-inbox-main-tabs{display:flex;gap:5px;padding:4px;border-radius:12px;background:var(--bg)}\n.origin-inbox-main-tabs button{display:inline-flex;align-items:center;justify-content:center;gap:8px;flex:1;min-height:44px;border:0;border-radius:9px;background:transparent;color:var(--muted);font-size:14px;font-weight:780}\n.origin-inbox-main-tabs button[aria-selected=\"true\"]{background:var(--paper);box-shadow:0 2px 7px #11111118;color:var(--accent-dark)}\n.origin-inbox-main-tabs small{font-size:11px;font-weight:650}\n.origin-inbox-filters{display:flex;align-items:center;gap:10px;margin:12px 0 0}\n.origin-inbox-search{display:flex;align-items:center;gap:8px;flex:1;min-width:0;min-height:43px;padding:0 11px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--muted)}\n.origin-inbox-search svg{width:16px;height:16px;flex:none}\n.origin-inbox-search input{min-width:0;width:100%;background:transparent;color:var(--ink);border:0;outline:0;font-size:13px}\n.origin-inbox-read-filter{display:flex;align-items:center;gap:8px;white-space:nowrap;color:var(--muted);font-size:12px}\n.origin-inbox-read-filter select{min-height:43px;max-width:120px;padding:7px 9px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);font-size:12px}\n.origin-inbox-genres{display:flex;gap:6px;overflow-x:auto;scrollbar-width:thin;padding:10px 0 5px}\n.origin-inbox-genres button{display:inline-flex;align-items:center;gap:6px;flex:none;min-height:35px;padding:6px 10px;border:1px solid var(--line);border-radius:999px;background:var(--paper);color:var(--ink-soft);font-size:11px;font-weight:750;white-space:nowrap}\n.origin-inbox-genres button[aria-pressed=\"true\"]{background:var(--accent-bg);border-color:var(--accent);color:var(--accent-dark)}\n.origin-inbox-genres small{font-size:10px;opacity:.75}\n.origin-inbox-genres .origin-inbox-unread-count{display:inline-flex;align-items:center;justify-content:center;min-height:19px;padding:2px 6px;border-radius:999px;background:#ad3851;color:#fff;font-size:10px;font-weight:850;line-height:1.15;font-variant-numeric:tabular-nums}\n.origin-inbox-summary{margin:0;color:var(--muted);font-size:11px;font-variant-numeric:tabular-nums}\n.origin-inbox-summary-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0 0;min-height:28px}\n.origin-inbox-unread-quick{flex:none;min-height:28px;padding:3px 10px;border:1px solid var(--accent);border-radius:999px;background:var(--accent-bg);color:var(--accent-dark);font-size:11px;font-weight:800}\n.origin-inbox-unread-quick[hidden]{display:none!important}\n.origin-inbox-list{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:6px 26px 17px;scrollbar-width:thin}\n.origin-inbox-item{display:flex;align-items:flex-start;gap:13px;padding:16px 2px;border-bottom:1px solid var(--line-soft)}\n.origin-inbox-item.is-read{opacity:.78}\n.origin-inbox-item.is-unread{border-left:3px solid #ad3851;border-radius:10px;background:var(--accent-bg);padding-left:12px;padding-right:10px;margin:6px 0}\n.origin-inbox-item.is-unread .origin-inbox-item-body>strong{font-weight:850}\n.origin-inbox-item.is-unread .origin-inbox-avatar{background:var(--paper)}\n.origin-inbox-avatar{display:grid;place-items:center;flex:0 0 38px;width:38px;height:38px;border-radius:12px;background:var(--accent-bg);color:var(--accent-dark)}\n.origin-inbox-item-body{flex:1;min-width:0}\n.origin-inbox-item-meta{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:6px}\n.origin-inbox-label{font-size:11px;font-weight:800;color:var(--accent-dark)}\n.origin-inbox-unread{font-size:10px;font-weight:850;padding:2px 7px;border-radius:5px;background:#ad3851;color:#fff}\n.origin-inbox-item-meta time{font-size:11px;color:var(--muted);margin-left:auto}\n.origin-inbox-item-body>strong{display:block;font-size:16px;line-height:1.45;font-weight:800;overflow-wrap:anywhere;margin:0 0 7px}\n.origin-inbox-item-body>p{white-space:pre-wrap;font-size:12.5px;line-height:1.65;overflow-wrap:anywhere;color:var(--ink-soft);margin:0 0 9px}\n.origin-inbox-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}\n.origin-inbox-actions button{display:inline-flex;align-items:center;gap:5px;min-height:34px;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink-soft);font-size:11px;font-weight:760}\n.origin-inbox-actions .origin-inbox-open{background:var(--accent-bg);border-color:var(--accent);color:var(--accent-dark)}\n.origin-inbox-actions button:disabled{opacity:.5;cursor:wait}\n.origin-inbox-more{display:block;width:100%;min-height:43px;margin:13px 0;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--accent-dark);font-size:12px;font-weight:750}\n.origin-inbox-empty{display:grid;justify-items:center;gap:10px;padding:55px 15px;text-align:center;color:var(--muted)}\n.origin-inbox-empty strong{font-size:14px;color:var(--ink)}\n.origin-inbox-empty p{font-size:12px;line-height:1.6;margin:0}\n.origin-inbox-footer{display:flex;align-items:center;justify-content:space-between;gap:15px;flex:0 0 auto;padding:12px 26px;border-top:1px solid var(--line);background:var(--bg)}\n.origin-inbox-footer p{font-size:10px;line-height:1.5;color:var(--muted);margin:0}\n.origin-inbox-all-read{flex:none;min-height:38px;padding:8px 12px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--accent-dark);font-size:11px;font-weight:770}\n.origin-inbox-all-read:disabled{color:var(--muted);opacity:.6}\n@media(max-width:620px){\n .origin-inbox-dialog{width:calc(100vw - 14px);height:calc(100dvh - 14px);border-radius:14px}\n .origin-inbox-head{padding:16px 14px 13px;gap:9px}.origin-inbox-head h2{font-size:22px}\n .origin-inbox-head p:last-child{font-size:11px}\n .origin-inbox-filterbar{padding:10px 13px 8px}.origin-inbox-main-tabs button{font-size:12px;gap:5px}.origin-inbox-main-tabs small{font-size:10px}\n .origin-inbox-filters{gap:5px}.origin-inbox-read-filter{gap:4px}.origin-inbox-read-filter select{max-width:98px;padding:5px;font-size:11px}\n .origin-inbox-list{padding:5px 13px 10px}.origin-inbox-item{padding:13px 0;gap:10px}.origin-inbox-item.is-unread{padding-left:9px;padding-right:7px}\n .origin-inbox-avatar{flex-basis:31px;width:31px;height:31px}.origin-inbox-item-meta time{width:100%;margin-left:0}\n .origin-inbox-item-body>strong{font-size:15px}\n .origin-inbox-footer{flex-direction:column;align-items:stretch;gap:6px;padding:10px 13px}\n .origin-inbox-all-read{width:100%}\n}\n@media(prefers-reduced-motion:reduce){.origin-inbox-dialog *{transition:none!important;scroll-behavior:auto!important}}\n"));
    document.body.appendChild(host);
    // Show the published release inside origin itself. The label is derived
    // from the shared manifest, never from a hardcoded Modern-only version.
    const release=String(window.WORK_BOARD_RELEASE_VERSION || window.WORK_BOARD_RELEASE?.version || '');
    if (/^\d+$/.test(release)) {
      host.dataset.releaseVersion=release;
      const label=mount.querySelector('.brand-small');
      if(label) {
        label.textContent='WORKSPACE · Ver.'+release;
        label.title='現在の公開バージョン Ver.'+release;
      }
    }
    const controller=window.WorkBoardDisplayController;
    new MutationObserver(()=>{if(document.documentElement.dataset.wbDisplay!=='modern')document.body.style.overflow='';}).observe(document.documentElement,{attributes:true,attributeFilter:['data-wb-display']});
    
'use strict';
(function(){
if(!window.WorkBoardPaletteBridge?.readSnapshot)return;

const SVG={
 file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l-1.8 1.8a1.7 1.7 0 0 0-1.9-.3l-.9.5V21h-2.6v-2.1l-.9-.5a1.7 1.7 0 0 0-1.9.3l-1.8-1.8a1.7 1.7 0 0 0 .3-1.9l-.5-.9H5v-2.6h2.1l.5-.9a1.7 1.7 0 0 0-.3-1.9l1.8-1.8a1.7 1.7 0 0 0 1.9.3l.9-.5V4h2.6v2.1l.9.5a1.7 1.7 0 0 0 1.9-.3l1.8 1.8a1.7 1.7 0 0 0-.3 1.9l.5.9H21v2.6h-2.1z"/>',
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10z"/><path d="M9 21v-8h6v8"/>',
 tasks:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h9M8 14h7"/><circle cx="6" cy="9" r=".5" fill="currentColor"/>',
 todo:'<rect x="3.5" y="4" width="17" height="17" rx="3"/><path d="m8 12 2.5 2.5L16 9"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
 notes:'<path d="M5 3h11l4 4v14H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM16 3v5h4M7 12h9M7 16h9"/>',
 search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
 moon:'<path d="M20.3 14.8A8.6 8.6 0 0 1 9.2 3.7 8.6 8.6 0 1 0 20.3 14.8z"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 left:'<path d="m14.5 6-6 6 6 6"/>',
 right:'<path d="m9.5 6 6 6-6 6"/>',
 chevron:'<path d="m7 10 5 5 5-5"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 filter:'<path d="M4 7h16M7 12h10m-7 5h4"/>',
 edit:'<path d="m5 19 4-.7 10-10.2-3.3-3.3L5.5 15zM14.5 6l3.3 3.3"/>',
 trash:'<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6m4-6v6"/>',
 close:'<path d="M5 5l14 14M19 5 5 19"/>',
 pin:'<path d="m8 3 8 8m-1-7 5 5-4 1-4 4-1 5-2-5-5-2 4-4 1-4z"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 arrowUp:'<path d="m5 15 7-7 7 7"/>',
 spark:'<path d="m12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3z"/>',
 layers:'<path d="m12 2 9 5-9 5-9-5 9-5zm-9 10 9 5 9-5M3 17l9 5 9-5"/>',
 external:'<path d="M14 4h6v6M20 4l-9 9M20 14v6H4V4h6"/>'
};
function icon(name,size=18){return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[name]||SVG.more}</svg>`}
function setIconPlaceholders(root){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon)})}
const $=s=>mount.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dayMillis=86400000;function dayStart(d){const a=new Date(d);a.setHours(0,0,0,0);return a}function addDay(d,n){const a=dayStart(d);a.setDate(a.getDate()+n);return a}function key(d){const a=dayStart(d);return `${a.getFullYear()}-${String(a.getMonth()+1).padStart(2,'0')}-${String(a.getDate()).padStart(2,'0')}`}
function parseDay(s){const [y,m,d]=String(s||'').split('-').map(Number);return new Date(y||2026,(m||1)-1,d||1)}function shift(s,n){return key(addDay(parseDay(s),n))}const base=key(new Date());
const days=['日','月','火','水','木','金','土'];function dateLabel(k){if(!k)return '未設定';const d=parseDay(k);return `${d.getMonth()+1}月${d.getDate()}日（${days[d.getDay()]}）`}function rangeLabel(d){const a=monday(parseDay(d)),b=addDay(a,6);return `${a.getMonth()+1}月${a.getDate()}日 〜 ${b.getMonth()+1}月${b.getDate()}日`}
function monday(d){const x=dayStart(d);x.setDate(x.getDate()-((x.getDay()+6)%7));return x}
function newId(){return (crypto?.randomUUID?.()||`${Date.now()}${Math.random()}`)}
const bridge=window.WorkBoardPaletteBridge;
const memoBridge=window.WorkBoardPaletteMemoBridgeV369;
let snapshot=bridge.readSnapshot();
let memoItems=memoBridge?.readSnapshot?.()||[];
let data={tasks:[],todos:[],events:[],memos:[],templates:[],knowledge:[]};
const clock=(v)=>{const d=new Date(v||0);return Number.isNaN(d.getTime())?'':String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
function scheduleLocalInput(v){const d=new Date(v);return Number.isFinite(d.getTime())?key(d)+'T'+clock(d):''}
function syncSnapshot(){
 snapshot=bridge.readSnapshot();
 data.templates=snapshot.templates||[];data.knowledge=snapshot.knowledge||[];
 restoreOriginTaskView();
 const user=snapshot.currentUser;
 const starts=window.WorkBoardOriginStartBridge?.readSnapshot()||{};
 const picker=$('#originUserSelect');if(picker){const users=[...new Set([user,...(snapshot.users||[])].filter(Boolean))];const signature=users.join('|');if(picker.dataset.signature!==signature){picker.innerHTML=users.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');picker.dataset.signature=signature}picker.value=user||'';}
 data.tasks=snapshot.tasks.map(t=>({id:t.id,title:t.title,status:t.status,priority:t.priority,
   due:t.dueDate||'',dueTime:t.dueTime||'',startDate:starts[t.id]?.date||'',startRevision:starts[t.id]?.revision||0,completed:Boolean(t.completed),assignee:t.assignee===user?'自分':t.assignee,
   category:t.category,desc:t.description||'',revision:t.revision,updatedAt:t.updatedAt||0,
   pinned:t.pinned,favorite:Boolean(t.favorite),recurrence:t.recurrence||'none',recurrenceRule:t.recurrenceRule||{},hasSeries:t.hasSeries,knowledgeId:t.knowledgeId||'',requester:t.requester||'',tags:t.tags||[],checklist:t.checklist||[],history:t.history||[]}));
 data.todos=snapshot.todos.map(t=>({id:t.id,title:t.text,due:'',done:t.completed,
   memo:t.memo||'',revision:t.revision}));
 data.events=snapshot.schedules.map(t=>({id:t.id,title:t.title,date:key(new Date(t.startAt)),
   time:clock(t.startAt),end:clock(t.endAt),startAt:t.startAt,endAt:t.endAt,
   assignee:t.assignee||'',category:t.category||'',relatedTaskId:t.relatedTaskId||'',
   recurrenceSeriesId:t.recurrenceSeriesId||'',location:t.location||'',desc:t.memo||'',revision:t.revision}));
 data.memos=memoItems.map(t=>({id:t.id,title:t.title,category:t.category,body:t.body||'',
   pinned:t.pinned,updated:t.updatedAt,revision:t.revision,tags:t.tags||[],paperColor:t.paperColor||'ivory'}));
}
let busy=false;
function showEditorSaveError(message,reason='retry'){
  // Only the canonical bridge writes data; keep the draft intact.
  if(panelMode!=='edit')return;
  const region=panelKind==='events' ? $('#originScheduleError') :
    panelKind==='tasks' ? $('#originTaskError') : null;
  if(region){region.hidden=false;region.textContent=message}
  else{const error=$('#originEditorError');if(error){error.hidden=false;error.textContent=message}}
  if(reason!=='validation')showOriginSaveRecovery(reason);
}
function showOriginSaveRecovery(reason){
 const form=$('#editForm'),panel=form?.querySelector('#originSaveRecovery');
 if(!panel)return;
 panel.hidden=false;panel.dataset.reason=reason;
 const retry=panel.querySelector('[data-action="origin-save-again"]');
 // Only updates with edit-start revision checks can be retried; creates may duplicate.
 const canRetry=reason==='retry'&&Boolean(form.dataset.id)
   &&['tasks','events','memos','todos'].includes(form.dataset.kind);
 if(retry)retry.hidden=!canRetry;
 const hint=panel.querySelector('#originSaveRecoveryText');
 if(hint)hint.textContent=reason==='conflict'
   ? '別の端末の変更を自動で上書きしません。編集中の内容をコピーし、閉じてから新しい内容を確認してください。'
   : form.dataset.id
     ? '入力内容はこの画面に残っています。接続状況を確認し、再保存するか内容をコピーしてください。'
     : '登録結果が不明な場合は二重登録を防ぐため、一覧を確認してから再登録してください。編集中の内容はコピーできます。';
 requestAnimationFrame(()=>{if(panel.isConnected&&!panel.hidden)panel.scrollIntoView({block:'nearest',behavior:'instant'})});
}
function hideOriginSaveRecovery(){
 const panel=$('#editForm #originSaveRecovery');if(!panel)return;
 panel.hidden=true;delete panel.dataset.reason;
 const backup=panel.querySelector('#originDraftCopyFallback');
 if(backup){backup.hidden=true;backup.value=''}
}
function originDraftCopyText(form){
 const kindNames={tasks:'タスク',todos:'ToDo',events:'予定',memos:'業務メモ'};
 const fields={title:'件名・タイトル',status:'状態',priority:'優先度',due:'期限日',dueTime:'期限時刻',
  assignee:'担当者',category:'分類',desc:'説明',requester:'依頼者',tags:'タグ',
  done:'完了状態',memo:'補足・メモ',startAt:'開始日時',endAt:'終了日時',
  location:'場所・方法',relatedTaskId:'関連タスクID',body:'本文',paperColor:'カードの色'};
 const fd=new FormData(form);
 const lines=['Origin '+(kindNames[form.dataset.kind]||'項目')+'（編集中・未保存）'];
 for(const [name,label] of Object.entries(fields)){
   const value=fd.get(name);
   if(value!==null&&String(value).trim())lines.push(label+'：'+String(value));
 }
 if(form.dataset.kind==='tasks'){
   const checks=[...form.querySelectorAll('.origin-checkrow')].map(row=>{
     const value=row.querySelector('[name="checkText"]')?.value||'';
     if(!value.trim())return '';
     return (row.querySelector('[name="checkDone"]')?.checked?'[済] ':'[未] ')+value;
   }).filter(Boolean);
   if(checks.length)lines.push('チェックリスト：\n'+checks.join('\n'));
 }
 if(form.querySelector('[name="pinned"]'))lines.push('固定：'+(fd.has('pinned')?'はい':'いいえ'));
 return lines.join('\n');
}
async function copyOriginDraft(form){
 const backup=form.querySelector('#originDraftCopyFallback'),draft=originDraftCopyText(form);
 try{
   if(!navigator.clipboard?.writeText)throw new Error('clipboard unavailable');
   await navigator.clipboard.writeText(draft);
   notify('編集中の内容をコピーしました。貼り付け先にご注意ください。');
 }catch(error){
   // Keep the text selectable if clipboard permission is denied.
   if(!backup||!form.isConnected)return;
   backup.hidden=false;backup.value=draft;backup.focus({preventScroll:true});backup.select();
   notify('自動コピーできませんでした。表示した内容を選択してコピーしてください。');
 }
}
async function send(command,label,{close=false,returnToTask=false}={}){
 if(busy)return false;
 const completing=command.type==='task.complete'||command.type==='task.bulk.complete'
   ||(command.type==='task.update'&&command.status==='完了')
   ||(command.type==='task.bulk.update'&&command.action==='status'&&command.target==='完了');
 if(completing){
   const ids=command.items?.map(item=>item.id)||[command.id];
   const guard=window.WorkBoardCompletionGuardV149;
   if(!guard||ids.some(id=>guard.guardCompletion(id,{silent:true}))){
     notify('未完了の前提タスク、または前提情報の通信状態を確認してください。');return false;
   }
 }
 busy=true;
 const savingPanel=Boolean((close||returnToTask)&&panelOpen&&panelMode==='edit');
 const todoReturn=close&&savingPanel&&['todo.update','todo.delete'].includes(command.type)&&!panelReturnSearch
   ?captureOriginTodoListReturn(command.id):null;
 const beforeTodo=todoReturn?data.todos.find(item=>item.id===command.id):null;
 if(savingPanel)markOriginEditorSaving(true,command);
 try{
   const result=command.type.startsWith('comment.')
     ?await window.WorkBoardOriginCommentBridge?.dispatch(command):command.type.startsWith('memo.')
     ? await memoBridge?.dispatch?.(command) : await bridge.dispatch(command);
   if(result?.ok){
     if(command.type.startsWith('task.')&&command.startDate!==undefined){
       const latest=bridge.readSnapshot().tasks.find(x=>x.id===result.id);
       const starts=window.WorkBoardOriginStartBridge;
       const previous=starts?.readSnapshot()?.[result.id];
       if((previous?.date||'')!==command.startDate){
         const saved=await starts?.save({id:result.id,date:command.startDate,revision:command.startRevision,ownerRoom:command.ownerRoom,ownerUser:command.ownerUser});
         if(!saved?.ok){
           const form=$('#editForm');if(form){form.dataset.id=result.id;form.dataset.revision=String(latest?.revision||0);panelId=result.id;}
           showEditorSaveError('タスク本体は保存しましたが、開始日を保存できませんでした。入力内容を保持しています。開始日を確認して再保存してください。','retry');
           notify('タスク本体は保存済みです。開始日の保存を確認してください。');return false;
         }
       }
     }
     if(returnToTask&&originTaskScheduleSource){
       syncSnapshot();render();
       const returned=restoreOriginTaskFromSchedule(true);
       notify(label+(returned?'。元のタスク詳細に戻りました。':'。元のタスクは参照できません。'));
       return true;
     }
     // Restore focus after the canonical repaint: rendering replaces the old row.
     const returning=close&&panelOpen?{kind:panelKind,id:panelId}:null;
     if(close)closePanel(true,false);
     syncSnapshot();render();
     if(returning){
       // Search matches and history position may change even when the status
       // stays the same (for example, changing a title removes a query result).
       const sameBucket=beforeTodo&&beforeTodo.done===command.completed;
       const restoredTodo=todoReturn&&(command.type==='todo.delete'
         ?restoreOriginTodoListReturn(todoReturn,{action:'list-quick-edit'})
         :restoreOriginTodoListReturn(todoReturn,{
           sameItem:Boolean(sameBucket),action:sameBucket?'list-quick-edit':'todo-check'
         }));
       if(restoredTodo){
         panelReturnAnchor=null;panelReturnSearch=null;scheduleGlobalReturn=null;
       }else restorePanelReturnPosition(returning.kind,returning.id);
     }
     notify(label);return true;
   }
   if(result?.error==='cancelled'||result?.pending)return false;
   const conflict=['revision-or-state-mismatch','revision-or-relation-mismatch','conflict','owner-mismatch','not-found','remote-content-changed'].includes(result?.error);
   const todoInvalid=command.type.startsWith('todo.')&&result?.error==='invalid-input';
   const scheduleInvalid=command.type.startsWith('schedule.')&&result?.error==='invalid-input';
   const msg=conflict
     ? '他端末で変更されました。入力内容を保持しています。最新の内容を確認してください。'
     : todoInvalid
       ? result.field==='memo'
         ? `ToDoの補足メモは${snapshot.todoMemoMaxLength}文字以内で入力してください。`
         : result.reason==='required'
           ? 'ToDoの内容を入力してください。'
           : `ToDoは${snapshot.todoTitleMaxLength}文字以内で入力してください。`
       : scheduleInvalid
         ? '予定を保存できませんでした。担当者・分類・関連タスクなどの入力を確認してください。入力内容は保持されています。'
         : '保存できませんでした。入力内容は保持されています。';
   const validation=todoInvalid||scheduleInvalid||['invalid-input','invalid-category','invalid-tags'].includes(result?.error);
   const editableWrite=/\.(create|update)$/.test(command.type);
   showEditorSaveError(msg,conflict?'conflict':!editableWrite||validation?'validation':'retry');
   if(todoInvalid&&panelMode==='edit'){
     const form=$('#editForm'),field=result.field==='memo'?'memo':'title';
     requestAnimationFrame(()=>{if(form?.isConnected&&panelMode==='edit')markOriginInvalidField(form,field,msg)});
   }
   notify(msg);
   return false;
 }catch(error){
   console.error('origin command failed',error);
   const message='通信・保存に失敗しました。入力内容を保持しています。接続状態を確認してください。';
   showEditorSaveError(message);notify(message);return false;
 }
 finally{busy=false;if(savingPanel)markOriginEditorSaving(false)}
}
let memoColorFilter='all',memoQuery='',memoSort='updated',memoLayout=window.innerWidth<=420?'list':'cards',memoVisibleLimit=24,memoComposing=false,scheduleView='week',scheduleAssignee='all',scheduleQuery='',scheduleComposing=false,scheduleFiltersOpen=false,scheduleSearchScope='week',scheduleAdvancedOpen=false,scheduleSearchLimit=30,scheduleCategory='all',scheduleDateFrom='',scheduleDateTo='',scheduleSearchSort='upcoming',quickTodoDraft='',todoCompletedOpen=false,todoSearchOpen=false,todoSearchHistory=false,todoQuery='',todoComposing=false,taskQuery='',taskSortMode='due',taskDensity='compact',taskComposing=false,taskAdvancedOpen=false,memoAdvancedOpen=false;
let view='today',selectedDay=base,taskFilter='active',taskGrouping='deadline',taskCollapsedGroups=new Set(),taskVisibleLimits=new Map(),taskStatusChoice='',memoFilter='all',selectedBulk=new Set(),toastTimer=0,previousSnapshot=null,panelOpen=false,panelDirty=false,searchQuery='',searchKind='all',searchComposing=false;
// Detailed search is an Origin-only route that preserves the six main tabs.
let originFullSearchQuery='',originFullSearchReturn='today',originFullSearchLimit=30,originFullSearchSort='relevance',originFullSearchComposing=false;
let theme='light',relatedTaskComposing=false;
const viewDefs=[['today','今日','home'],['tasks','タスク','tasks'],['todos','ToDo','todo'],['calendar','予定','calendar'],['notes','メモ','notes'],['tools','その他','more']];
function nav(){
 const desktop=$('#desktopNav'),mobile=$('#mobileNav');
 // Navigation depends on view only, not every synced task/memo record.
 // Avoid replacing focused menu buttons on every canonical snapshot refresh.
 if(desktop?.dataset.activeRoute===view&&mobile?.dataset.activeRoute===view)return;
 const markup=(small)=>viewDefs.map(([id,label,ic])=>`<button type="button" data-route="${id}" class="${small?'':'nav-button '}${view===id?'active':''}" ${view===id?'aria-current="page"':''}>${icon(ic,small?21:17)}<span>${label}</span></button>`).join('');
 if(desktop){desktop.innerHTML=markup(false);desktop.dataset.activeRoute=view}
 if(mobile){mobile.innerHTML=markup(true);mobile.dataset.activeRoute=view}
}
// Origin uses Classic's saved per-room and per-user colors without replacing Origin UI.
function syncOriginColorTheme(){
 const root=document.documentElement;
 const selected=root.dataset.wbColorTheme||'default';
 const mode=root.dataset.wbColorMode||'light';
 const field=$('#originColorSelect');
 if(field&&Array.from(field.options).some(option=>option.value===selected))field.value=selected;
 const surfaceVars=[['--bg','--wb-theme-page'],['--paper','--wb-theme-surface'],
  ['--sidebar','--wb-theme-surface'],['--ink','--wb-theme-ink'],
  ['--muted','--wb-theme-muted'],['--line','--wb-theme-line']];
 const names=['--accent','--accent-dark','--accent-bg','--on-accent',...surfaceVars.map(pair=>pair[0])];
 if(selected==='default'){for(const name of names)host.style.removeProperty(name);return}
 const css=getComputedStyle(root),shade=css.getPropertyValue('--wb-theme-accent').trim();
 if(!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(shade))return;
 host.style.setProperty('--accent',shade);
 host.style.setProperty('--accent-dark',shade);
 host.style.setProperty('--accent-bg','color-mix(in srgb, '+shade+' 10%, var(--paper))');
 const hex=shade.slice(1);
 const parts=hex.length===3?hex.split('').map(ch=>ch+ch):[hex.slice(0,2),hex.slice(2,4),hex.slice(4,6)];
 const channels=parts.map(ch=>parseInt(ch,16)/255)
   .map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);
 const luminance=.2126*channels[0]+.7152*channels[1]+.0722*channels[2];
 host.style.setProperty('--on-accent',luminance>=.179?'#000000':'#ffffff');
 for(const [local,classic] of surfaceVars){
  const value=css.getPropertyValue(classic).trim();
  if(mode===theme&&/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value))host.style.setProperty(local,value);
  else host.style.removeProperty(local);
 }
}
function selectOriginColorMode(){
 const mode=document.documentElement.dataset.wbColorMode;
 if(mode==='dark'||mode==='light'){theme=mode;initTheme()}
 syncOriginColorTheme();
}
function initTheme(){host.dataset.theme=theme;const toggle=$('#themeBtn');toggle.innerHTML=icon(theme==='dark'?'sun':'moon',17)+'<span>'+(theme==='dark'?'ライトに切り替え':'ダークに切り替え')+'</span>';toggle.title=theme==='dark'?'ライトテーマへ':'ダークテーマへ';toggle.setAttribute('aria-pressed',String(theme==='dark'))}
function empty(text,desc='新規作成から登録できます。'){return `<div class="empty">${icon('layers',28)}<strong>${esc(text)}</strong><p>${esc(desc)}</p></div>`}
const activeTasks=()=>data.tasks.filter(x=>!x.completed&&(!x.startDate||x.startDate<=base));function dueState(d){return !d?'':d<base?'overdue':d===base?'today':''}
function taskSort(a,b){const rank={'緊急':-1,'高':0,'中':1,'低':2};return (a.due||'9999').localeCompare(b.due||'9999')||(rank[a.priority]??9)-(rank[b.priority]??9)}
function humanDue(k){if(!k)return '期限なし';if(k===base)return '今日';if(k===shift(base,1))return '明日';if(k===shift(base,-1))return '昨日';return dateLabel(k).replace(/（.*）/,'')}
function taskTag(t){if(!t.completed&&t.startDate>base)return `<span class="tag med">予約 · ${esc(t.startDate)}</span>`;if(t.completed)return `<span class="tag done">完了</span>`;if(t.due&&t.due<base)return `<span class="tag overdue">期限超過</span>`;if(t.due===base)return `<span class="tag today">今日まで</span>`;if(t.status==='確認待ち')return `<span class="tag waiting">確認待ち</span>`;return `<span class="tag">${esc(t.status)}</span>`}
function head(kicker,title,desc,right=''){return `<div class="page-heading"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p class="page-desc">${desc}</p></div>${right?`<div class="heading-meta">${right}</div>`:''}</div>`}
// Keep transient UI positions in memory only; never use localStorage or
// encode Origin presentation state into shared records.
const viewScrollPositions=Object.create(null);
function captureOriginFocus(){
 const active=mount.activeElement;
 if(!active)return null;
 const scope=active.closest('#workspace')?'workspace':
   active.closest('#desktopNav')?'desktopNav':
   active.closest('#mobileNav')?'mobileNav':'';
 if(!scope||active.matches('[data-form="quick-todo"] [name="title"]'))return null;
 const metadata={scope,id:active.id||'',name:active.getAttribute('name')||'',
   action:active.dataset.action||'',itemId:active.dataset.id||'',
   kind:active.dataset.kind||'',value:active.dataset.value||'',
   status:active.dataset.status||'',route:active.dataset.route||''};
 if(typeof active.selectionStart==='number')metadata.selection=[active.selectionStart,active.selectionEnd];
 return metadata;
}
function restoreOriginFocus(metadata){
 if(!metadata)return;
 const container=$('#'+metadata.scope);
 if(!container)return;
 const all=Array.from(container.querySelectorAll('button,input,select,textarea'));
 let target=null;
 if(metadata.id)target=all.find(el=>el.id===metadata.id);
 if(!target&&metadata.route)target=all.find(el=>el.dataset.route===metadata.route);
 if(!target&&metadata.action)target=all.find(el=>
   el.dataset.action===metadata.action
   &&(el.dataset.id||'')===metadata.itemId
   &&(el.dataset.kind||'')===metadata.kind
   &&(el.dataset.value||'')===metadata.value
   &&(el.dataset.status||'')===metadata.status);
 if(!target&&metadata.scope==='workspace'&&metadata.action==='todo-check'){
   target=container.querySelector('.origin-todo-list [data-action="todo-check"]')
     ||container.querySelector('.origin-todo-archive-toggle');
 }
 if(!target&&metadata.scope==='workspace'&&metadata.action==='bulk-toggle'){
   // A changed task may leave the active filter after a remote completion.
   target=container.querySelector('.origin-task-collection [data-action="bulk-toggle"]')
     ||container.querySelector('#originTaskQuery');
 }
 if(!target&&metadata.scope==='workspace'&&metadata.action==='memo-color'){
   // Keep keyboard operation possible when a memo leaves the color filter.
   target=container.querySelector('.origin-memo-shell .memo-card[data-id]')
     ||container.querySelector('.origin-memo-filters [aria-pressed="true"]');
 }
 if(!target||target.disabled||!target.getClientRects().length)return;
 target.focus({preventScroll:true});
 if(metadata.selection&&typeof target.setSelectionRange==='function'){
   try{target.setSelectionRange(...metadata.selection)}catch{}
 }
}
function render(){
 const focus= captureOriginFocus();
 // Preserve a typed quick ToDo across canonical subscription updates.
 const previous=$('#workspace [data-form="quick-todo"] [name="title"]');
 const active=previous&&mount.activeElement===previous;
 const selection=active?[previous.selectionStart,previous.selectionEnd]:null;
 if(previous)quickTodoDraft=previous.value;
 const previousScroll=window.scrollY;
 // Keep horizontal filter rails in place after a data refresh or view-only action.
 const horizontalScroll=new Map(Array.from($('#workspace').querySelectorAll('[data-origin-scroll-key]'))
   .map(el=>[el.dataset.originScrollKey,el.scrollLeft]));
 nav();
 originInboxUpdateBadge();
 if($('#originInboxDialog')?.open)renderOriginInbox();
 const m={today:renderToday,tasks:renderTasks,todos:renderTodos,calendar:renderCalendar,notes:renderNotes,tools:renderOriginTools,search:renderOriginFullSearch};
 $('#workspace').innerHTML=m[view]();
 for(const el of $('#workspace').querySelectorAll('[data-origin-scroll-key]')){
   if(horizontalScroll.has(el.dataset.originScrollKey))
     el.scrollLeft=horizontalScroll.get(el.dataset.originScrollKey);
 }
 const next=$('#workspace [data-form="quick-todo"] [name="title"]');
 if(next){next.value=quickTodoDraft;if(active){next.focus({preventScroll:true});if(selection[0]!==null)next.setSelectionRange(...selection)}}
 restoreOriginFocus(focus);
 mount.querySelectorAll('#workspace [data-autofocus]')?.forEach(x=>x.focus());
 // Content may change height; browser safely clamps when the old position is gone.
 if(window.scrollY!==previousScroll)window.scrollTo({top:previousScroll,behavior:'instant'});
}
function originTodayReminders(){
 const workflow=window.WorkBoardWorkflowV152;
 if(!workflow)return '';
 const end=addDay(parseDay(selectedDay),1).getTime();
 const rows=Object.entries(workflow.remindersFor()).map(([id,item])=>({task:findItem('tasks',id),item})).filter(x=>x.task&&!x.task.completed&&x.item.at<end).sort((a,b)=>a.item.at-b.item.at);
 if(!rows.length)return '';
 return `<section class="surface"><div class="surface-section"><div class="section-head"><h2>確認リマインダー <span class="count">${rows.length}</span></h2></div>${rows.map(({task,item})=>`<button type="button" class="agenda-entry" data-action="open" data-kind="tasks" data-id="${esc(task.id)}"><span class="agenda-time">${esc(clock(item.at))}</span><span><span class="agenda-name">${esc(task.title)}</span><span class="agenda-location">${esc(dateLabel(key(item.at)))}${item.note?' · '+esc(item.note):''}</span></span></button>`).join('')}</div></section>`;
}
function renderToday(){
 const d=parseDay(selectedDay), start=monday(d);const weekdays=[0,1,2,3,4,5,6].map(i=>{const x=addDay(start,i),k=key(x),evt=data.events.filter(e=>e.date===k).length;
 return `<button type="button" class="day-chip ${k===selectedDay?'active':''} ${(i===5||i===6)?'weekend':''}" data-action="pick-day" data-date="${k}" aria-pressed="${k===selectedDay}"><span class="dow">${days[x.getDay()]}曜日</span><span class="number">${x.getDate()}</span><span class="dots">${evt?'<i class="tiny-dot"></i>'.repeat(Math.min(evt,3)):''}</span></button>`}).join('');
 const active=activeTasks();
 const priorityPool=active.filter(t=>(t.due&&t.due<=selectedDay)||t.status==='対応中').sort(taskSort);
 const priority=priorityPool.slice(0,5);
 const todayEvents=data.events.filter(e=>e.date===selectedDay).sort((a,b)=>a.time.localeCompare(b.time));
 const pendingTodos=data.todos.filter(t=>!t.done);
 const todos=pendingTodos.slice(0,4);
 const chosenToday=selectedDay===base;
 return `${head('YOUR DAY · DAILY PLAN',`${dateLabel(selectedDay)}の仕事`,'予定と次の行動を、ひとつの視線で確認できます。',`<button class="secondary-button" data-action="pick-today">${icon('clock')} 今日に戻る</button>`)}
 <div class="strip"><span class="strip-title">今週</span>${weekdays}</div>
 <div class="origin-today-shortcuts" role="group" aria-label="新しい業務を追加"><span>すぐ追加</span><button type="button" data-action="new" data-kind="tasks">${icon('plus',15)} タスク</button><button type="button" data-action="new" data-kind="todos">${icon('plus',15)} ToDo</button><button type="button" data-action="new" data-kind="events" data-date="${selectedDay}">${icon('plus',15)} この日の予定</button></div>
 <div class="day-grid">
 <section class="surface"><div class="surface-section"><div class="section-head"><h2>${icon('spark',18)} 先に進めたいこと <span class="count">${priorityPool.length}</span></h2><button class="text-button" data-route="tasks">タスクをすべて見る ${icon('right',13)}</button></div>
 <div class="status-summary" role="group" aria-label="タスクの状態別一覧へ移動">
<button type="button" class="origin-summary-filter" data-action="today-task-filter" data-value="active" aria-label="未完了のタスク ${active.length}件を表示"><i class="bullet" aria-hidden="true"></i>未完了 <strong>${active.length}</strong>件</button>
<button type="button" class="origin-summary-filter" data-action="today-task-filter" data-value="late" aria-label="期限超過のタスク ${active.filter(t=>t.due&&t.due<base).length}件を表示"><i class="bullet" style="background:var(--red)" aria-hidden="true"></i>期限超過 <strong>${active.filter(t=>t.due&&t.due<base).length}</strong>件</button>
<button type="button" class="origin-summary-filter" data-action="today-task-filter" data-value="waiting" aria-label="確認待ちのタスク ${active.filter(t=>t.status==='確認待ち').length}件を表示"><i class="bullet" style="background:var(--blue)" aria-hidden="true"></i>確認待ち <strong>${active.filter(t=>t.status==='確認待ち').length}</strong>件</button>
</div>
 ${priority.length?priority.map((t,i)=>`<div class="focus-item"><div class="focus-order">${String(i+1).padStart(2,'0')}</div><div class="focus-main"><button type="button" class="focus-name" data-action="open" data-kind="tasks" data-id="${esc(t.id)}" title="${esc(t.title)}">${esc(t.title)}</button><div class="focus-meta">${taskTag(t)}<span>${esc(t.assignee||'担当未設定')}</span><span>${esc(t.category||'分類なし')}</span>${t.due?`<span class="origin-today-due ${t.due<base?'urgent':''}">${esc(humanDue(t.due))}${t.dueTime?' '+esc(t.dueTime):''}</span>`:''} </div></div><div class="focus-actions"><button type="button" class="row-action" data-action="task-done" data-id="${esc(t.id)}" aria-label="${esc(t.title)}を完了にする">完了</button></div></div>`).join(''):empty('対応待ちのタスクはありません','優先確認が必要なタスクはありません。')}
 ${priorityPool.length>priority.length?`<button type="button" class="origin-today-more" data-route="tasks">残り${priorityPool.length-priority.length}件をタスク一覧で確認 ${icon('right',13)}</button>`:''}
 </div></section>
 <div class="right-stack">${originTodayReminders()}<section class="surface"><div class="surface-section"><div class="section-head"><h2>${chosenToday?'今日':'選択日'}の予定 <span class="count">${todayEvents.length}</span></h2><button type="button" class="text-button" data-action="today-calendar-day" aria-label="${esc(dateLabel(selectedDay))}の予定を日別で開く">この日の予定を開く ${icon('right',13)}</button></div>
 ${todayEvents.length?`<div class="agenda-line">${todayEvents.map(e=>`<button class="agenda-entry" data-action="open" data-kind="events" data-id="${esc(e.id)}" title="${esc(e.title)}"><span class="agenda-time">${esc(e.time)}</span><span><span class="agenda-name">${esc(e.title)}</span><span class="agenda-location">${e.end?esc(e.end)+'まで':''}${e.location?' · '+esc(e.location):e.assignee?' · '+esc(e.assignee):''}</span></span></button>`).join('')}</div>`:empty('予定はありません','追加から今日の予定を登録できます。')}
 <button class="text-button" data-action="new" data-kind="events" data-date="${selectedDay}">${icon('plus',14)} 予定を追加</button></div></section>
 <section class="surface"><div class="surface-section"><div class="section-head"><h2>個人ToDo <span class="count">${pendingTodos.length}</span></h2><button class="text-button" data-route="todos">一覧へ ${icon('right',13)}</button></div>
 <form class="small-add origin-today-todo-add" data-form="quick-todo"><input name="title" placeholder="やることを入力してEnter" aria-label="ToDoの追加" required maxlength="${snapshot.todoTitleMaxLength}" autocomplete="off"/><button type="submit" aria-label="ToDoを登録">${icon('plus',16)}</button></form>
 ${todos.length?todos.map(t=>`<div class="mini-todo"><input class="todo-check" type="checkbox" data-action="todo-check" data-id="${esc(t.id)}" aria-label="${esc(t.title)}を完了にする"/><button type="button" class="todo-title" data-action="open" data-kind="todos" data-id="${esc(t.id)}" title="${esc(t.title)}">${esc(t.title)}</button></div>`).join(''):empty('未完了のToDoはありません','上の欄から追加できます。')}
 ${pendingTodos.length>todos.length?`<button class="origin-today-more" data-route="todos">残り${pendingTodos.length-todos.length}件をToDo一覧で確認 ${icon('right',13)}</button>`:''}</div></section></div></div>`;
}
function taskDisplaySort(a,b){
 const priority={'緊急':0,'高':1,'中':2,'低':3};
 const byPriority=(priority[a.priority]??9)-(priority[b.priority]??9);
 const byDue=taskSort(a,b);
 const byUpdated=Number(b.updatedAt||0)-Number(a.updatedAt||0);
 const tie=String(a.id).localeCompare(String(b.id));
 if(taskSortMode==='priority')return byPriority||byDue||tie;
 if(taskSortMode==='updated')return byUpdated||byDue||tie;
 return byDue||tie;
}
function taskVisible(){
 const q=taskQuery.trim().toLocaleLowerCase();
 return data.tasks.filter(t=>
   (!taskStatusChoice||t.status===taskStatusChoice)
   &&!window.WorkBoardWorkflowV152?.isArchived(t.id)
   &&(taskFilter==='all'||taskFilter==='reserved'||!t.startDate||t.startDate<=base)
   &&(taskFilter==='all'||(taskFilter==='active'&&!t.completed)
     ||(taskFilter==='mine'&&t.assignee==='自分')
     ||(taskFilter==='late'&&!t.completed&&t.due&&t.due<base)
     ||(taskFilter==='done'&&t.completed)||(taskFilter==='starred'&&t.favorite)||(taskFilter==='reserved'&&t.startDate>base))
   &&(!q||[t.title,t.status,t.priority,t.category,t.assignee,t.requester,t.desc,...(t.tags||[])]
      .join(' ').toLocaleLowerCase().includes(q))
 ).sort(taskDisplaySort);
}
function originTaskGroupName(task){
 if(taskGrouping==='status')return task.status||'状態未設定';
 if(taskGrouping==='assignee')return task.assignee||'担当者未設定';
 if(task.completed)return '完了した仕事';
 if(task.due&&task.due<base)return '期限超過';
 if(task.due===base)return '今日まで';
 if(task.due&&task.due<=shift(base,7))return '今週・近日';
 if(!task.due)return '期限なし';
 return '今後の予定';
}
// Keep page state in memory only; no storage or changes to the canonical task model.
let taskLayoutMode='list',originPrefsUser='';
const TASK_RENDER_BATCH=24;
function restoreOriginTaskView(){
 const w=window.WorkBoardWorkflowV152;if(!w?.dependencyStateReady()||originPrefsUser===snapshot.currentUser)return;
 originPrefsUser=snapshot.currentUser;
 const prefs=w.workflow.savedViews?.['origin-'+w.userKey()];
 taskLayoutMode=['list','board','timeline'].includes(prefs?.taskLayout)?prefs.taskLayout:'list';
 if(['due','priority','updated'].includes(prefs?.columnSort?.key))taskSortMode=prefs.columnSort.key;
 if(taskLayoutMode==='board')taskGrouping='status';else if(taskLayoutMode==='timeline')taskGrouping='deadline';
}
async function saveOriginTaskView(){
 if(busy)return;const w=window.WorkBoardWorkflowV152;if(!w)return;
 busy=true;
 try{const id='origin-'+w.userKey(),result=await w.writeSavedView(id,{taskLayout:taskLayoutMode,columnSort:{key:taskSortMode,direction:'asc'},updatedAt:Date.now()},w.workflow.savedViews?.[id]||null);notify(result?.ok?'表示方法と並び順を保存しました。':'保存できませんでした。接続状態を確認してください。');}
 finally{busy=false}
}
function renderTasks(){
 const filterOptions=[['active','進行中'],['all','すべて'],['mine','自分の担当'],['late','期限超過'],['done','完了'],['starred','お気に入り'],['reserved','予約']];
 const statusMarkers=snapshot.statuses.map(name=>`<button type="button" class="status-marker ${taskStatusChoice===name?'active':''}" data-action="filter-status" data-status="${esc(name)}" aria-pressed="${taskStatusChoice===name}"><span class="label">${esc(name)}</span><strong>${data.tasks.filter(t=>t.status===name).length}</strong></button>`).join('');
 const visible=taskVisible(),groups={};
 for(const task of visible){
  const name=originTaskGroupName(task);
  (groups[name]??=[]).push(task);
 }
 // Group counts refer to all filtered tasks; only mounted rows are selectable.
 const groupEntries=Object.entries(groups).map(([name,rows],index)=>{
  const groupKey=taskGrouping+'|'+name,collapsed=taskCollapsedGroups.has(groupKey);
  const savedLimit=taskVisibleLimits.get(groupKey);
  const limit=Math.min(rows.length,savedLimit===Infinity?rows.length:
    Math.max(TASK_RENDER_BATCH,Number.isFinite(savedLimit)?savedLimit:TASK_RENDER_BATCH));
  return {name,rows,index,groupKey,collapsed,limit};
 });
 const selectable=new Set(groupEntries.flatMap(group=>
   group.collapsed?[]:group.rows.slice(0,group.limit).map(task=>task.id)));
 for(const id of selectedBulk)if(!selectable.has(id))selectedBulk.delete(id);
 const renderedCount=groupEntries.reduce((n,group)=>n+(group.collapsed?0:group.limit),0);
 const groupList=groupEntries.map(({name,rows,index,groupKey,collapsed,limit})=>{
  const remaining=rows.length-limit,shown=rows.slice(0,limit);
  return `<section class="origin-task-group"><div class="group-title"><button type="button" class="origin-task-group-toggle"
   data-action="task-group-toggle" data-value="${esc(groupKey)}" aria-expanded="${!collapsed}"
   aria-controls="originTaskGroup${index}"><span aria-hidden="true">${icon('chevron',16)}</span>
   <strong>${esc(name)}</strong><span class="origin-group-count">${rows.length}件</span></button></div>
   <div class="origin-task-group-rows" id="originTaskGroup${index}"
     data-group-key="${esc(groupKey)}" ${collapsed?'hidden':''}>
   ${shown.map(taskRow).join('')}
   ${!collapsed&&remaining>0?`<div class="origin-task-more"><span>${limit} / ${rows.length}件を表示</span>
    <button type="button" data-action="task-load-more" data-value="${esc(groupKey)}"
      aria-label="${esc(name)}をさらに${Math.min(TASK_RENDER_BATCH,remaining)}件表示">${icon('plus',15)} あと${Math.min(TASK_RENDER_BATCH,remaining)}件</button>
    <button type="button" data-action="task-show-all" data-value="${esc(groupKey)}"
      aria-label="${esc(name)}の残り${remaining}件をすべて表示">残りすべて</button>
    </div>`:''}</div></section>`;
 }).join('');
 const filtered=taskQuery.trim()||taskStatusChoice||taskFilter!=='active';
 const taskConditionCount=Number(taskFilter!=='active'&&taskFilter!=='all')+Number(Boolean(taskStatusChoice))+Number(Boolean(taskQuery.trim()));
 const taskFilterSummary=[
   taskFilter!=='active'?filterOptions.find(([id])=>id===taskFilter)?.[1]||'':'',
   taskStatusChoice?'状態：'+taskStatusChoice:'',
   taskQuery.trim()?'検索：'+taskQuery.trim():''
 ].filter(Boolean).map(value=>esc(value)).join(' / ');
 return `${head('WORK · TASKS','チームのタスク','期限・担当・状態から仕事を整理し、一覧で処理できます。',`<span>登録 ${data.tasks.length}件</span>`)}
 <div class="origin-layout-controls"><div class="tab-pills" role="group" aria-label="タスクの表示方法">${[['list','一覧'],['board','ボード'],['timeline','タイムライン']].map(([id,label])=>`<button type="button" data-action="task-layout" data-value="${id}" class="${taskLayoutMode===id?'active':''}" aria-pressed="${taskLayoutMode===id}">${label}</button>`).join('')}</div><button type="button" class="secondary-button" data-action="task-view-save">表示方法と並び順を保存</button></div><div class="origin-task-tools" data-mobile-advanced="${taskAdvancedOpen}"><input id="originTaskQuery" type="search" placeholder="件名・担当・分類・説明を検索" aria-label="タスクを検索" autocomplete="off" value="${esc(taskQuery)}"/><button type="button" class="origin-jump-result" data-action="jump-result" data-kind="tasks" aria-label="表示中のタスクの先頭へ移動" ${visible.length?'':'disabled'}>${icon('arrow',16)} <span>結果へ</span></button>
 <div class="origin-task-order-pair"><label for="originTaskSort">並び順 <select id="originTaskSort"><option value="due" ${taskSortMode==='due'?'selected':''}>期限順</option><option value="priority" ${taskSortMode==='priority'?'selected':''}>優先度順</option><option value="updated" ${taskSortMode==='updated'?'selected':''}>更新順</option></select></label>
<label class="origin-task-group-near" for="groupSelect">まとめ方 <select id="groupSelect" aria-label="タスクをまとめる方法"><option value="deadline" ${taskGrouping==='deadline'?'selected':''}>期限別</option><option value="status" ${taskGrouping==='status'?'selected':''}>状態別</option><option value="assignee" ${taskGrouping==='assignee'?'selected':''}>担当者別</option></select></label></div>
 <button type="button" class="origin-density-button" data-action="task-density" aria-label="タスク一覧の情報量を切り替える" title="詳細表示では説明・依頼者・タグ・チェックリストも確認できます">${taskDensity==='compact'?'詳細表示':'コンパクト表示'}</button>
 </div>
 <div class="origin-mobile-advanced-switch"><button type="button" data-action="task-advanced-toggle"
  aria-controls="originTaskStatusRail originTaskSort groupSelect" aria-expanded="${taskAdvancedOpen}">
   ${icon('filter',15)} 詳細条件 ${taskConditionCount?'<span class="origin-advanced-count">適用中 '+taskConditionCount+'</span>':''}${icon('chevron',14)}
  </button></div>
 <div class="status-rail" id="originTaskStatusRail" data-mobile-advanced="${taskAdvancedOpen}" data-origin-scroll-key="task-status" aria-label="タスクの状態別件数">${statusMarkers}</div>
 <div class="work-toolbar origin-task-toolbar" data-mobile-advanced="${taskAdvancedOpen}"><div class="tab-pills" data-origin-scroll-key="task-tabs" role="group" aria-label="タスクの表示条件">${filterOptions.map(([id,label])=>`<button type="button" class="${taskFilter===id?'active':''}" data-action="task-filter" data-value="${id}" aria-pressed="${taskFilter===id}">${label}</button>`).join('')}</div><div class="spacer"></div>
 
 <button type="button" class="secondary-button" data-action="new" data-kind="tasks">${icon('plus')} タスクを追加</button></div>
 <div class="origin-task-summary"><span>表示 ${visible.length}件 ／ 全体 ${data.tasks.length}件${renderedCount<visible.length?' · 画面に'+renderedCount+'件':''}${selectedBulk.size?' · '+selectedBulk.size+'件選択中':''}${taskFilterSummary?`<span class="origin-filter-current">${taskFilterSummary}</span>`:''}</span>${filtered?'<button type="button" data-action="task-reset">絞り込みを解除</button>':''}</div>
 ${selectedBulk.size?`<div class="bulkbar">${icon('check',16)} ${selectedBulk.size}件選択中 <div class="spacer"></div><button data-action="bulk-done">まとめて完了</button><button data-action="bulk-clear">選択解除</button></div>`:''}
 <section class="surface work-collection origin-task-collection origin-task-layout-${taskLayoutMode} ${taskDensity==='compact'?'origin-tasks-compact':''}">${groupList||empty('表示するタスクがありません','絞り込みを解除するか、新しくタスクを登録してください。')}</section>
 <p class="quiet-small origin-task-tip">件名から詳細を確認できます。チェックは一括選択用です。</p>`;
}
function taskRow(t){
 const urgent=!t.completed&&t.due&&t.due<base;
 const dateText=t.due?humanDue(t.due)+(t.dueTime?' '+t.dueTime:''):'期限なし';
  const statusSelect=`<select class="origin-task-inline-status" data-action="task-inline-status" data-id="${esc(t.id)}" aria-label="${esc(t.title)}の状態を変更">${snapshot.statuses.map(name=>`<option value="${esc(name)}" ${t.status===name?'selected':''}>${esc(name)}</option>`).join('')}</select>`;
 const due=t.due?`<span class="origin-task-mobile-due ${urgent?'urgent':''}">${esc(dateText)}</span>`:'';
 const notes=String(t.desc||'').trim();
 const checklist=Array.isArray(t.checklist)?t.checklist.filter(item=>item&&String(item.text||'').trim()):[];
 const doneChecks=checklist.filter(item=>item.done).length;
 const tags=Array.isArray(t.tags)?t.tags.filter(Boolean).slice(0,4):[];
 const facts=[
  t.requester?`<span>依頼者：${esc(t.requester)}</span>`:'',
  checklist.length?`<span>チェックリスト ${doneChecks} / ${checklist.length}</span>`:'',
  ...tags.map(tag=>`<span>#${esc(tag)}</span>`)
 ].filter(Boolean);
 const insight=notes||facts.length
  ?`<div class="origin-task-insight">${notes?`<p class="origin-task-insight-description">${esc(notes)}</p>`:''}${facts.length?`<div class="origin-task-insight-meta">${facts.join('')}</div>`:''}</div>`:'';
 return `<div class="item-row"><input type="checkbox" class="todo-check task-select-check" data-action="bulk-toggle" data-id="${esc(t.id)}" aria-label="一括選択：${esc(t.title)}" ${selectedBulk.has(t.id)?'checked':''}/><div class="origin-task-main"><button type="button" class="item-name" data-action="open" data-kind="tasks" data-id="${esc(t.id)}" title="${esc(t.title)}" aria-label="${esc(t.title)}の詳細を開く"><span class="origin-task-title-text">${esc(t.title)}</span><span class="origin-task-detail-arrow" aria-hidden="true">${icon('right',14)}</span></button><div class="row-under">${taskTag(t)} <span class="origin-task-meta">${esc(t.category||'分類なし')} · ${esc(t.priority||'中')}優先</span>${due}<span class="origin-task-mobile-assignee">${esc(t.assignee||'担当未設定')}</span></div>${insight}</div><span class="item-assignee">${esc(t.assignee||'未設定')}</span><span class="item-date ${urgent?'urgent':''}">${esc(dateText)}</span><div class="row-last">${statusSelect}<button type="button" class="origin-list-quick-edit" data-action="list-quick-edit" data-kind="tasks" data-id="${esc(t.id)}" aria-label="${esc(t.title)}を編集" title="タスクを編集">${icon('edit',15)}</button><button type="button" class="primary-mini" data-action="task-done" data-id="${esc(t.id)}" aria-label="${esc(t.title)}を${t.completed?'未完了に戻す':'完了にする'}">${t.completed?'戻す':'完了'}</button></div></div>`;
}
// Pending and completed ToDos use bounded initial rendering, like tasks and notes.
const TODO_RENDER_BATCH=24;
let todoPendingLimit=TODO_RENDER_BATCH,todoCompletedLimit=TODO_RENDER_BATCH;
function originVisiblePendingTodos(){
 const query=todoQuery.trim().toLocaleLowerCase();
 return data.todos.filter(t=>!t.done&&(!query||[t.title,t.memo].join(' ').toLocaleLowerCase().includes(query)));
}
function originVisibleCompletedTodos(){
 const query=todoSearchHistory?todoQuery.trim().toLocaleLowerCase():'';
 return data.todos.filter(t=>t.done&&(!query||[t.title,t.memo].join(' ').toLocaleLowerCase().includes(query)))
   .slice().reverse();
}
function originTodoMore(bucket,mounted,total){
 if(mounted>=total)return '';
 const name=bucket==='pending'?'未完了':'完了履歴',remaining=total-mounted;
 return `<div class="origin-todo-more" role="group" aria-label="${name}の追加表示"><span>${mounted} / ${total}件を表示</span>
 <div class="origin-todo-more-actions"><button type="button" data-action="todo-load-more" data-value="${bucket}" aria-label="${name}のToDoをさらに${Math.min(TODO_RENDER_BATCH,remaining)}件表示">${icon('plus',15)} あと${Math.min(TODO_RENDER_BATCH,remaining)}件</button>
 <button type="button" data-action="todo-show-all" data-value="${bucket}" aria-label="${name}の残り${remaining}件をすべて表示">残りすべて</button></div></div>`;
}
function renderTodos(){
 const done=originVisibleCompletedTodos(),pending=data.todos.filter(t=>!t.done);
 const totalDone=data.todos.length-pending.length;
 const q=todoQuery.trim().toLocaleLowerCase();
 const shown=originVisiblePendingTodos();
 const mountedPending=shown.slice(0,todoPendingLimit),mountedDone=done.slice(0,todoCompletedLimit);
 const pct=data.todos.length?Math.round(totalDone/data.todos.length*100):0;
 return `${head('MY LIST · PERSONAL','自分のToDo','今すぐ取りかかることを、すばやく追加・確認できます。',`<span>未完了 ${pending.length}件</span>`)}
 <div class="origin-todo-summary" aria-label="ToDoの進捗">
   <div class="origin-todo-metrics"><span>未完了 <strong>${pending.length}</strong>件</span><span>完了 <strong>${totalDone}</strong>件</span><span>進捗 <strong>${pct}%</strong></span></div>
   <div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="ToDoの完了率"><div class="progress-fill" style="width:${pct}%"></div></div>
 </div>
 <section class="surface origin-todo-main"><div class="surface-section">
   <div class="section-head"><h2>${icon('todo',18)} やること <span class="count">${pending.length}</span></h2><div class="origin-todo-section-actions"><button type="button" class="origin-todo-search-toggle" data-action="todo-search-toggle" aria-label="${todoSearchOpen?'ToDo検索を閉じる':'ToDoを検索'}" aria-expanded="${todoSearchOpen}" aria-controls="originTodoSearchPanel">${icon('search',15)} ${todoSearchOpen?'検索を閉じる':'検索'}</button><button type="button" class="text-button" data-action="new" data-kind="todos">詳しく追加 ${icon('plus',13)}</button></div></div>
   <form class="small-add origin-todo-add" data-form="quick-todo"><input name="title" placeholder="やることを入力してEnter" maxlength="${snapshot.todoTitleMaxLength}" required autocomplete="off" aria-label="新しいToDo"/><button type="submit" aria-label="ToDoを追加">${icon('plus',16)}</button></form>
   <div class="origin-todo-search-row" id="originTodoSearchPanel" ${todoSearchOpen?'':'hidden'}><input id="originTodoQuery" type="search" aria-label="ToDoの件名・補足メモを検索" placeholder="ToDoの件名・メモを検索" autocomplete="off" value="${esc(todoQuery)}"/><button type="button" class="origin-jump-result" data-action="jump-result" data-kind="todos" aria-label="表示中のToDoの先頭へ移動" ${shown.length||(todoSearchHistory&&done.length)?'':'disabled'}>${icon('arrow',16)} <span>結果へ</span></button></div>
  <div class="origin-todo-search-history-wrap" ${todoSearchOpen?'':'hidden'}><button type="button" class="origin-todo-search-history" data-action="todo-search-history" aria-pressed="${todoSearchHistory}" aria-controls="originCompletedTodos">${icon('check',14)} 完了履歴も検索</button>${q?'<button type="button" class="origin-todo-search-history" data-action="todo-clear-query">検索語を解除</button>':''}</div>
 ${q?'<div class="origin-todo-search-result" role="status">表示 '+shown.length+'件 ／ 未完了 '+pending.length+'件'+(todoSearchHistory?' ・ 完了履歴 '+done.length+'件':'')+'</div>':''}
 <div class="origin-todo-list">${shown.length?mountedPending.map(todoRow).join('')+originTodoMore('pending',mountedPending.length,shown.length):empty(q?'一致するToDoはありません':'未完了のToDoはありません',q?'キーワードを変えるか検索を閉じてください。':'上の入力欄からすぐ追加できます。')}</div>
   <div class="origin-todo-archive">
     <button type="button" class="origin-todo-archive-toggle" data-action="todo-completed-toggle" aria-expanded="${todoCompletedOpen}" aria-controls="originCompletedTodos"><span>${icon('check',16)} 完了したToDo <strong>${totalDone}件</strong></span><span>${todoCompletedOpen?'閉じる':'履歴を見る'} ${icon('chevron',15)}</span></button>
     <div id="originCompletedTodos" ${todoCompletedOpen?'':'hidden'}>${todoCompletedOpen?(done.length?mountedDone.map(todoRow).join('')+originTodoMore('completed',mountedDone.length,done.length):(todoSearchHistory&&q?'<p class="quiet-small">一致する完了ToDoはありません。</p>':'<p class="quiet-small">まだ完了履歴はありません。</p>')):''}</div>
   </div>
 </div></section>`;
}
function todoRow(t){
 return `<div class="todo-entry"><input type="checkbox" class="todo-check" data-action="todo-check" data-id="${esc(t.id)}" ${t.done?'checked':''} aria-label="${esc(t.title)}を${t.done?'未完了へ戻す':'完了にする'}"/><button type="button" class="todo-text ${t.done?'done':''}" data-action="open" data-kind="todos" data-id="${esc(t.id)}" title="${esc(t.title)}">${esc(t.title)}</button><button type="button" class="origin-list-quick-edit" data-action="list-quick-edit" data-kind="todos" data-id="${esc(t.id)}" aria-label="${esc(t.title)}を編集" title="ToDoを編集">${icon('edit',15)}</button><button type="button" class="todo-edit" data-action="open" data-kind="todos" data-id="${esc(t.id)}" aria-label="${esc(t.title)}の詳細を開く">${icon('right',15)}</button></div>`;
}
// A canonical write may remove a ToDo from its list. Keep the next available
// action at the same reading position, including when the next row was paged out.
function captureOriginTodoListReturn(id){
 if(view!=='todos'&&view!=='today')return null;
 const root=$('#workspace');
 const selector=view==='todos'?'.origin-todo-main .todo-entry':'.mini-todo';
 const rows=[...root.querySelectorAll(selector)].filter(row=>row.getClientRects().length);
 const source=rows.find(row=>row.querySelector('[data-action="todo-check"]')?.dataset.id===id);
 if(!source)return null;
 const bucket=view==='today'?'today':source.closest('#originCompletedTodos')?'completed':'pending';
 const inBucket=rows.filter(row=>(view==='today'?'today':row.closest('#originCompletedTodos')?'completed':'pending')===bucket);
 const sourceIndex=inBucket.indexOf(source);
 const visibleOrder=bucket==='pending'?originVisiblePendingTodos():
   bucket==='completed'?originVisibleCompletedTodos():null;
 const order=visibleOrder?visibleOrder.map(item=>item.id):
   inBucket.map(row=>row.querySelector('[data-action="todo-check"]')?.dataset.id).filter(Boolean);
 const index=order.indexOf(id);
 const previous=inBucket[sourceIndex-1];
 return {view,room:snapshot.roomId,user:snapshot.currentUser,bucket,id,
   rowTop:source.getBoundingClientRect().top,
   nextId:index>=0?order[index+1]||'':'',
   previousId:index>=0?order[index-1]||'':'',
   previousTop:previous?.getBoundingClientRect().top??source.getBoundingClientRect().top};
}
function restoreOriginTodoListReturn(context,{sameItem=false,action='todo-check'}={}){
 if(!context||context.view!==view||context.room!==snapshot.roomId||
   context.user!==snapshot.currentUser||panelOpen)return false;
 const root=$('#workspace');
 const selector=context.bucket==='today'?'.mini-todo':
   context.bucket==='completed'?'#originCompletedTodos .todo-entry':'.origin-todo-list .todo-entry';
 const rows=[...root.querySelectorAll(selector)].filter(row=>row.getClientRects().length);
 const lookup=id=>rows.find(row=>row.querySelector('[data-action="todo-check"]')?.dataset.id===id);
 let target=null,top=context.rowTop;
 if(sameItem)target=lookup(context.id);
 if(!target&&context.nextId)target=lookup(context.nextId);
 if(!target&&context.previousId){
   target=lookup(context.previousId);
   if(target)top=context.previousTop;
 }
 // Search editing returns to the query after the last match disappears.
 // Without a query, an empty pending list should offer "add", not archive.
 const queryInput=todoSearchOpen&&todoQuery.trim()?root.querySelector('#originTodoQuery'):null;
 const fallback=context.bucket==='today'
   ?root.querySelector('[data-form="quick-todo"] [name="title"]')||root.querySelector('[data-route="todos"]')
   :queryInput?.getClientRects().length
     ?queryInput
     :context.bucket==='completed'
       ?root.querySelector('.origin-todo-archive-toggle')||root.querySelector('.origin-todo-add [name="title"]')
       :root.querySelector('.origin-todo-add [name="title"]')||root.querySelector('.origin-todo-archive-toggle');
 const control=target?.querySelector('[data-action="'+action+'"]')||
   target?.querySelector('[data-action="todo-check"]')||fallback;
 if(!control||!control.getClientRects().length)return false;
 control.focus({preventScroll:true});
 if(!target){
   // After the final matching item is removed, reveal search or archive controls.
   control.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
   return true;
 }
 const rect=target.getBoundingClientRect();
 const maximum=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
 const destination=window.scrollY+rect.top-top;
 window.scrollTo({top:Math.max(0,Math.min(maximum,destination)),behavior:'instant'});
 return true;
}
function originScheduleMeta(e){
 const items=[];
 if(e.assignee)items.push('<span title="担当者：'+esc(e.assignee)+'">担当 '+esc(e.assignee)+'</span>');
 if(e.category)items.push('<span title="分類：'+esc(e.category)+'">分類 '+esc(e.category)+'</span>');
 return items.length?'<span class="origin-event-meta">'+items.join('')+'</span>':'';
}
function renderCalendar(){
 const start=monday(parseDay(selectedDay)),end=addDay(start,6),query=scheduleQuery.trim().toLocaleLowerCase();
 const filterCount=Number(Boolean(query))+Number(scheduleAssignee!=='all')+
   (scheduleSearchScope==='all'?Number(scheduleCategory!=='all')+Number(Boolean(scheduleDateFrom))+Number(Boolean(scheduleDateTo)):0);
 const weekAll=data.events.filter(e=>e.date>=key(start)&&e.date<=key(end));
 // A cross-week query does not erase the visible calendar week.
 const matchesConditions=e=>(scheduleAssignee==='all'||e.assignee===scheduleAssignee)
   &&(!query||[e.title,e.location,e.assignee,e.category,e.desc].join(' ').toLocaleLowerCase().includes(query));
 const shown=weekAll.filter(e=>scheduleSearchScope==='all'||matchesConditions(e));
 const hasGlobalCriteria=Boolean(query||scheduleAssignee!=='all'||scheduleCategory!=='all'||scheduleDateFrom||scheduleDateTo);
 const invalidSchedulePeriod=Boolean(scheduleDateFrom&&scheduleDateTo&&scheduleDateFrom>scheduleDateTo);
 const now=Date.now();
 const eventTime=e=>{
  const parsed=Date.parse(e.startAt);
  return Number.isFinite(parsed)?parsed:Date.parse(e.date+'T00:00:00')||0;
 };
 const compareGlobal=(a,b)=>{
  const at=eventTime(a),bt=eventTime(b);
  if(scheduleSearchSort==='newest')return bt-at||String(a.id).localeCompare(String(b.id));
  if(scheduleSearchSort==='oldest')return at-bt||String(a.id).localeCompare(String(b.id));
  const ae=Date.parse(a.endAt),be=Date.parse(b.endAt);
  const af=(Number.isFinite(ae)?ae:at)>=now,bf=(Number.isFinite(be)?be:bt)>=now;
  if(af!==bf)return af?-1:1;
  return (af?at-bt:bt-at)||String(a.id).localeCompare(String(b.id));
 };
 const globalResults=scheduleSearchScope==='all'&&hasGlobalCriteria&&!invalidSchedulePeriod
  ?data.events.filter(e=>matchesConditions(e)
    &&(scheduleCategory==='all'||e.category===scheduleCategory)
    &&(!scheduleDateFrom||e.date>=scheduleDateFrom)
    &&(!scheduleDateTo||e.date<=scheduleDateTo)).sort(compareGlobal):[];
 const globalVisible=globalResults.slice(0,scheduleSearchLimit);
 const jumpCandidates=scheduleSearchScope==='all'?globalVisible:shown;
 // Use every sorted match as the inspector sequence, not only 30 rendered rows.
 scheduleGlobalResultIds=globalResults.map(event=>event.id);
 // Group the displayed week once instead of re-filtering all events for every day.
 const eventsByDay=new Map();
 for(const event of shown){
   if(!eventsByDay.has(event.date))eventsByDay.set(event.date,[]);
   eventsByDay.get(event.date).push(event);
 }
 for(const events of eventsByDay.values())
   events.sort((a,b)=>a.time.localeCompare(b.time)||String(a.id).localeCompare(String(b.id)));
 const daysInWeek=[0,1,2,3,4,5,6].map(i=>{
   const date=addDay(start,i),dateKey=key(date);
   return {date,dateKey,events:eventsByDay.get(dateKey)||[]};
 });
 scheduleWeekResultIds=daysInWeek.flatMap(day=>day.events.map(event=>event.id));
 calendarRenderedMobile=window.innerWidth<=770;
 const wide=scheduleView==='week'&&!calendarRenderedMobile?daysInWeek.map(({date,dateKey,events})=>`
 <section class="weekday-col ${dateKey===base?'current':''} ${dateKey===selectedDay?'origin-selected':''}">
   <div class="weekday-head"><button type="button" class="origin-weekday-focus" data-action="calendar-day" data-date="${dateKey}" aria-label="${dateLabel(dateKey)}の予定を日別表示"><span>${days[date.getDay()]}曜日</span><strong>${date.getDate()}</strong><small>${events.length}件</small></button></div>
   <div class="weekday-body">${events.map(e=>`<button class="schedule-event ${e.time<'12:00'?'':'blue'}" data-action="open" data-kind="events" data-id="${esc(e.id)}" title="${esc(e.title)}"><div class="time">${esc(e.time)}–${esc(e.end)}</div><div class="title">${esc(e.title)}</div>${originScheduleMeta(e)}</button>`).join('')}<button class="weekday-add" data-action="new" data-kind="events" data-date="${dateKey}" aria-label="${dateLabel(dateKey)}に予定追加">＋</button></div>
 </section>`).join(''):'';
 const mobile=scheduleView==='week'&&calendarRenderedMobile?daysInWeek.map(({date,dateKey,events})=>{
    const expanded=scheduleExpandedDays.has(dateKey),visible=expanded?events:events.slice(0,ORIGIN_MOBILE_DAY_PREVIEW);
    return `<div class="agenda-day ${dateKey===selectedDay?'origin-selected':''} ${events.length?'':'origin-agenda-empty'} ${events.length>ORIGIN_MOBILE_DAY_PREVIEW?'origin-agenda-busy':''}" data-date="${dateKey}">
   <div class="agenda-day-head"><button type="button" class="origin-agenda-day-label" data-action="calendar-day" data-date="${dateKey}" aria-label="${dateLabel(dateKey)}の日別表示">${date.getMonth()+1}/${date.getDate()}（${days[date.getDay()]}） ${dateKey===base?'・今日':''} <span>${events.length}件</span></button><button data-action="new" data-kind="events" data-date="${dateKey}">＋ 予定</button></div>
   ${events.length?visible.map(e=>`<button class="agenda-entry" data-action="open" data-kind="events" data-id="${esc(e.id)}" title="${esc(e.title)}"><span class="agenda-time">${esc(e.time)}–${esc(e.end)}</span><span><span class="agenda-name">${esc(e.title)}</span>${e.location?`<span class="agenda-location">${esc(e.location)}</span>`:''}${originScheduleMeta(e)}</span></button>`).join(''):'<span class="quiet-small">予定なし</span>'}
    ${events.length>ORIGIN_MOBILE_DAY_PREVIEW?`<button type="button" class="origin-agenda-more" data-action="schedule-day-expand" data-date="${dateKey}" aria-expanded="${expanded}" aria-label="${dateLabel(dateKey)}の予定を${expanded?'折りたたむ':'すべて表示'}">${expanded?'折りたたむ':'残り'+(events.length-ORIGIN_MOBILE_DAY_PREVIEW)+'件を見る'} ${icon(expanded?'arrowUp':'chevron',14)}</button>`:''}</div>`;
 }).join(''):'';
 // Agenda scans scheduled days only; weekly view still shows all seven days.
 const agendaDays=scheduleView==='agenda'?daysInWeek.filter(({events})=>events.length>0):[];
 const agenda=scheduleView!=='agenda'?'':agendaDays.length
  ?agendaDays.map(({dateKey,events})=>`<section class="origin-agenda-group"><strong>${dateLabel(dateKey)} · ${events.length}件</strong>${events.map(e=>`<button class="origin-agenda-entry" data-action="open" data-kind="events" data-id="${esc(e.id)}" title="${esc(e.title)}"><time>${esc(e.time)}–${esc(e.end)}</time><strong>${esc(e.title)}</strong><small>${esc(e.location||'')}</small>${originScheduleMeta(e)}</button>`).join('')}</section>`).join('')
  :`<div class="origin-schedule-empty">${empty('この週に該当する予定はありません',query||scheduleAssignee!=='all'?'検索や担当者の条件を変更してください。':'上の「予定を追加」から登録できます。')}</div>`;
 const focused=scheduleView==='day'?eventsByDay.get(selectedDay)||[]:[];
 const dayView=scheduleView==='day'?`<div class="origin-day-focus"><div class="origin-day-heading"><div><small>SELECTED DAY</small><h2>${dateLabel(selectedDay)} <span>${focused.length}件</span></h2></div><div class="origin-day-controls"><button type="button" data-action="day-prev" aria-label="前の日へ">${icon('left',17)}</button><button type="button" data-action="day-next" aria-label="次の日へ">${icon('right',17)}</button></div></div><div class="origin-day-items">${focused.length?focused.map(e=>`<button type="button" class="origin-day-entry" data-action="open" data-kind="events" data-id="${esc(e.id)}" title="${esc(e.title)}"><time>${esc(e.time)}–${esc(e.end)}</time><span><strong>${esc(e.title)}</strong>${e.location?`<small>${esc(e.location)}</small>`:''}${originScheduleMeta(e)}</span><span class="origin-day-open">${icon('right',17)}</span></button>`).join(''):empty('この日の予定はありません','ほかの日付を選ぶか、この日に新しい予定を登録してください。')}</div><button class="text-button origin-day-add" data-action="new" data-kind="events" data-date="${selectedDay}">${icon('plus',15)} この日に予定を追加</button></div>`:'';
 const weekJump=scheduleView==='week'&&calendarRenderedMobile?`<div class="origin-week-jump" role="group" aria-label="週間の日付へ移動">${daysInWeek.map(({date,dateKey,events})=>
   `<button type="button" data-action="schedule-week-focus" data-date="${dateKey}" aria-pressed="${dateKey===selectedDay}" aria-label="${dateLabel(dateKey)}の予定${events.length}件へ移動" class="${dateKey===base?'origin-week-today':''}"><span>${days[date.getDay()]}曜日</span><strong>${date.getMonth()+1}/${date.getDate()}</strong><small>${events.length}件</small></button>`).join('')}</div>`:'';
 const weekFooter=scheduleView==='week'&&calendarRenderedMobile?`<div class="origin-mobile-week-actions" role="group" aria-label="週を移動"><button type="button" data-action="week-prev">${icon('left',16)} 前の週</button><button type="button" data-action="week-next">次の週 ${icon('right',16)}</button></div>`:'';
 const calendarBody=scheduleView==='day'?dayView:scheduleView==='agenda'?agenda:`${weekJump}${calendarRenderedMobile?'<div class="mobile-agenda">'+mobile+'</div>':'<div class="week-board">'+wide+'</div>'}${weekFooter}`;
 const globalPanel=scheduleSearchScope==='all'? `<section class="origin-schedule-global-results" aria-label="全期間の予定検索結果">
   <div class="origin-schedule-global-head"><strong>全期間の検索結果</strong><small role="status">${invalidSchedulePeriod?'期間を確認してください':hasGlobalCriteria?globalResults.length+'件一致'+(globalResults.length>globalVisible.length?' · '+globalVisible.length+'件表示':''):'条件を指定して検索してください'}</small></div>
   ${invalidSchedulePeriod?'<p class="origin-schedule-global-empty" role="alert">開始日が終了日より後です。期間を修正してください。</p>':
     !hasGlobalCriteria?'<p class="origin-schedule-global-empty">検索語・担当者・分類・期間のいずれかを指定すると、全期間から探せます。</p>':
     globalResults.length?`<div class="origin-schedule-global-list">${globalVisible.map(e=>`
       <article class="origin-schedule-global-item" data-id="${esc(e.id)}">
        <div class="origin-schedule-global-when"><time datetime="${esc(e.startAt||e.date)}"><strong>${esc(e.date.slice(5).replace('-','/'))}<span>（${esc(days[parseDay(e.date).getDay()])}）</span></strong><small>${esc(e.date.slice(0,4))}年 · ${esc(e.time)}–${esc(e.end)}</small></time></div>
        <div class="origin-schedule-global-info"><strong>${esc(e.title)}</strong>${e.location?'<small>'+esc(e.location)+'</small>':''}${originScheduleMeta(e)}</div>
        <div class="origin-schedule-global-actions"><button type="button" data-action="schedule-global-week" data-id="${esc(e.id)}" aria-label="${esc(e.title)}の週へ移動">該当週へ</button><button type="button" data-action="open" data-kind="events" data-id="${esc(e.id)}" aria-label="${esc(e.title)}の詳細を開く">詳細</button></div>
       </article>`).join('')}</div>${globalResults.length>globalVisible.length?`<button type="button" class="origin-schedule-global-more" data-action="schedule-global-more">さらに${Math.min(30,globalResults.length-globalVisible.length)}件表示</button>`:''}`:
      '<p class="origin-schedule-global-empty">一致する予定はありません。検索語や担当者を変更してください。</p>'}
  </section>`:'';
 return `${head('TIME · CALENDAR','予定を見渡す','週全体と選択日の予定を、用途に合わせて切り替えられます。')}
 <div class="work-toolbar origin-schedule-toolbar"><div class="calendar-tools"><button data-action="week-prev" aria-label="前の週">${icon('left')}</button><span class="period">${rangeLabel(selectedDay)}</span><button data-action="week-next" aria-label="次の週">${icon('right')}</button></div><div class="origin-calendar-controls">
  <button type="button" class="origin-schedule-filter-toggle" data-action="schedule-filter-toggle" aria-controls="originScheduleFilterPanel" aria-expanded="${scheduleFiltersOpen}" aria-label="予定の検索と絞り込みを${scheduleFiltersOpen?'閉じる':'開く'}">${icon('search',16)} 検索・絞り込み ${filterCount?'<span class="origin-schedule-filter-count">'+filterCount+'件</span>':''}</button>
  <span class="origin-schedule-filter-summary" role="status" aria-live="polite">${scheduleSearchScope==='all'?'全期間 '+globalResults.length+'件':'表示 '+shown.length+' / '+weekAll.length+'件'}</span>
  <div id="originScheduleFilterPanel" class="origin-schedule-filter-panel" data-open="${scheduleFiltersOpen}" role="group" aria-label="予定の検索条件">
   <input type="search" id="originScheduleSearch" class="origin-calendar-search" value="${esc(scheduleQuery)}" placeholder="${scheduleSearchScope==='all'?'全期間の予定を検索':'この週の予定を検索'}" aria-label="予定を検索"/>
    <div class="origin-schedule-scope" role="group" aria-label="予定の検索範囲">
      <button type="button" data-action="schedule-search-scope" data-value="week" aria-pressed="${scheduleSearchScope==='week'}">この週</button>
      <button type="button" data-action="schedule-search-scope" data-value="all" aria-pressed="${scheduleSearchScope==='all'}">全期間</button>
    </div>
   ${scheduleSearchScope==='all'?`<button type="button" class="origin-schedule-advanced-trigger" data-action="schedule-advanced-toggle" aria-expanded="${scheduleAdvancedOpen}" aria-controls="originScheduleAdvanced">詳細条件 ${scheduleCategory!=='all'||scheduleDateFrom||scheduleDateTo||scheduleSearchSort!=='upcoming'?'・指定中':''} ${icon('chevron',14)}</button><div id="originScheduleAdvanced" class="origin-schedule-advanced" role="group" aria-label="全期間の詳細条件" ${scheduleAdvancedOpen?'':'hidden'}>
    <label>分類<select id="originScheduleCategory" aria-label="予定の分類で絞り込む"><option value="all">すべての分類</option>${[...new Set(data.events.map(e=>e.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja')).map(c=>`<option value="${esc(c)}" ${scheduleCategory===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
    <label>開始日<input type="date" id="originScheduleFrom" aria-label="検索期間の開始日" value="${esc(scheduleDateFrom)}"/></label>
    <label>終了日<input type="date" id="originScheduleTo" aria-label="検索期間の終了日" value="${esc(scheduleDateTo)}"/></label>
    <label>並び順<select id="originScheduleSort" aria-label="全期間の検索結果の並び順">${[['upcoming','近日優先'],['newest','新しい順'],['oldest','古い順']].map(([v,l])=>`<option value="${v}" ${scheduleSearchSort===v?'selected':''}>${l}</option>`).join('')}</select></label>
   </div>`:''}
   <button type="button" class="origin-jump-result" data-action="jump-result" data-kind="events" aria-label="${scheduleSearchScope==='all'?'全期間の検索結果':'この週の予定'}の先頭へ移動" ${jumpCandidates.length?'':'disabled'}>${icon('arrow',16)} <span>結果へ</span></button>
   <select class="select-small" id="originScheduleAssignee" aria-label="予定担当者で絞り込む"><option value="all">全担当者</option>${[...new Set(data.events.map(e=>e.assignee).filter(Boolean))].map(a=>`<option value="${esc(a)}" ${scheduleAssignee===a?'selected':''}>${esc(a)}</option>`).join('')}</select>
  </div>
  ${filterCount?'<button type="button" class="origin-schedule-filter-reset" data-action="schedule-filter-reset" aria-label="予定の検索語・担当者・分類・期間などの条件を解除">条件を解除</button>':''}
  <input type="date" id="originDateJump" aria-label="表示する日付を選ぶ" value="${selectedDay}"/>
  <div class="origin-schedule-view" role="group" aria-label="予定の表示形式">${[['week','週間'],['agenda','一覧'],['day','日別']].map(([mode,label])=>`<button type="button" data-action="calendar-view" data-value="${mode}" class="${scheduleView===mode?'active':''}" aria-pressed="${scheduleView===mode}">${label}</button>`).join('')}</div>
 </div><div class="spacer"></div><button class="secondary-button" data-action="pick-today">今日に戻る</button><button class="secondary-button" data-action="new" data-kind="events">${icon('plus')} 予定を追加</button></div>
 <section class="surface">${calendarBody}<div class="calendar-footer"><span>予定を押すと詳細を確認できます</span><span>表示 ${shown.length}件 ／ この週 ${weekAll.length}件</span></div></section>${globalPanel}`;
}
const MEMO_RENDER_BATCH=24;
const memoColors=[['ivory','白'],['lemon','レモン'],['peach','ピーチ'],['mint','ミント'],['sky','スカイ'],['lavender','ラベンダー']];function memoColor(v){return memoColors.some(x=>x[0]===v)?v:'ivory'}
function originVisibleMemos(){
 const query=memoQuery.trim().toLocaleLowerCase();
 return data.memos.filter(m=>{
   if(memoColorFilter!=='all'&&memoColor(m.paperColor)!==memoColorFilter)return false;
   if(memoFilter==='pinned'&&!m.pinned)return false;
   if(memoFilter!=='all'&&memoFilter!=='pinned'&&m.category!==memoFilter)return false;
   return !query||[m.title,m.body,m.category,...(m.tags||[])].join(' ').toLocaleLowerCase().includes(query);
 }).sort((a,b)=>{
   const pin=Number(Boolean(b.pinned))-Number(Boolean(a.pinned));
   if(pin)return pin;
   const fallback=Number(b.updated||0)-Number(a.updated||0)||String(a.id).localeCompare(String(b.id));
   if(memoSort==='title')return String(a.title||'').localeCompare(String(b.title||''),'ja')||fallback;
   if(memoSort==='category')return String(a.category||'').localeCompare(String(b.category||''),'ja')||fallback;
   return fallback;
 });
}
function renderNotes(){
 const query=memoQuery.trim().toLocaleLowerCase();
 const items=originVisibleMemos();
 const mountedMemos=items.slice(0,memoVisibleLimit);
 const memoRemaining=items.length-mountedMemos.length;
 const categories=Array.from(new Set([...(memoBridge?.categories||[]),...data.memos.map(m=>m.category)].filter(Boolean)));
 const filtered=memoFilter!=='all'||memoColorFilter!=='all'||Boolean(query);
 const memoConditionCount=Number(memoFilter!=='all')+Number(memoColorFilter!=='all')+Number(Boolean(query));
 const memoFilterSummary=[
   memoFilter==='pinned'?'固定のみ':memoFilter!=='all'?'分類：'+memoFilter:'',
   memoColorFilter!=='all'?'色：'+(memoColors.find(([id])=>id===memoColorFilter)?.[1]||memoColorFilter):'',
   query?'検索：'+memoQuery.trim():''
 ].filter(Boolean).map(value=>esc(value)).join(' / ');
 return `${head('LIBRARY · NOTES','業務メモ','分類や色、キーワードからメモを探せます。',`<span>保存 ${data.memos.length}件</span>`)}
 <div class="origin-memo-utility" data-mobile-advanced="${memoAdvancedOpen}"><input type="search" id="originMemoQuery" placeholder="タイトル・本文・タグを検索" aria-label="メモを検索" autocomplete="off" value="${esc(memoQuery)}"/><button type="button" class="origin-jump-result" data-action="jump-result" data-kind="memos" aria-label="表示中のメモの先頭へ移動" ${items.length?'':'disabled'}>${icon('arrow',16)} <span>結果へ</span></button><label for="originMemoSort">並び順 <select id="originMemoSort" aria-label="メモの並び順"><option value="updated" ${memoSort==='updated'?'selected':''}>最近の内容更新</option><option value="title" ${memoSort==='title'?'selected':''}>タイトル順</option><option value="category" ${memoSort==='category'?'selected':''}>分類順</option></select></label></div>
 <div class="origin-mobile-advanced-switch"><button type="button" data-action="memo-advanced-toggle"
  aria-controls="originMemoColorFilters originMemoSort" aria-expanded="${memoAdvancedOpen}">
  ${icon('filter',15)} 詳細条件 ${memoConditionCount?'<span class="origin-advanced-count">適用中 '+memoConditionCount+'</span>':''}${icon('chevron',14)}
  </button></div>
 <div class="memo-toolbar"><div class="tab-pills" data-origin-scroll-key="memo-categories" role="group" aria-label="メモの分類で絞り込む">${[['all','すべて'],['pinned','固定'],...categories.map(x=>[x,x])].map(([id,label])=>`<button type="button" data-action="memo-filter" data-value="${esc(id)}" class="${memoFilter===id?'active':''}" aria-pressed="${memoFilter===id}">${esc(label)}</button>`).join('')}</div><button class="secondary-button" data-action="new" data-kind="memos">${icon('plus')} メモを書く</button></div>
 <div class="origin-memo-filters" id="originMemoColorFilters" data-mobile-advanced="${memoAdvancedOpen}" data-origin-scroll-key="memo-colors" role="group" aria-label="メモの色で絞り込む">${[['all','全色'],...memoColors].map(([id,label])=>`<button type="button" data-action="memo-color-filter" data-value="${id}" class="${memoColorFilter===id?'active':''}" aria-pressed="${memoColorFilter===id}">${label}</button>`).join('')}</div>
 <div class="origin-memo-result"><span role="status">表示 ${items.length}件 ／ 全体 ${data.memos.length}件${memoRemaining>0?' · 画面に'+mountedMemos.length+'件':''}${memoFilterSummary?`<span class="origin-filter-current">${memoFilterSummary}</span>`:''}</span>
    <div class="origin-memo-result-actions"><div class="origin-memo-layout" role="group" aria-label="メモの表示形式">
    <button type="button" data-action="memo-layout" data-value="cards" aria-pressed="${memoLayout==='cards'}">カード</button>
    <button type="button" data-action="memo-layout" data-value="list" aria-pressed="${memoLayout==='list'}">一覧</button></div>
    ${filtered?'<button type="button" data-action="memo-reset">絞り込みを解除</button>':''}</div></div>
 <div class="memo-grid ${memoLayout==='list'?'origin-memo-list':''}">${items.length?mountedMemos.map(m=>`<div class="origin-memo-shell" data-paper-color="${memoColor(m.paperColor)}"><button class="memo-card" data-action="open" data-kind="memos" data-id="${esc(m.id)}" title="${esc(m.title)}"><span class="memo-icon">${icon('notes',19)}</span><h3>${esc(m.title)}</h3><p>${esc(m.body)}</p><span class="memo-bottom"><span class="origin-memo-metadata"><span class="origin-memo-category">${esc(m.category||'分類なし')}</span><time class="origin-memo-date">${Number.isFinite(m.updated)&&m.updated>0?new Date(m.updated).toLocaleDateString('ja-JP'):'更新日未設定'}</time></span><span class="${m.pinned?'origin-memo-pinned':'origin-memo-next'}">${m.pinned?'固定 '+icon('pin',15):icon('right',15)}</span></span></button><div class="origin-memo-action-row"><div class="origin-memo-colors"><span>色変更</span>${memoColors.map(([value,label])=>`<button type="button" class="origin-color-dot" data-paper-color="${value}" data-action="memo-color" data-id="${esc(m.id)}" data-value="${value}" aria-label="${esc(m.title)}を${label}に変更" title="${label}" aria-pressed="${memoColor(m.paperColor)===value}"></button>`).join('')}</div><button type="button" class="origin-list-quick-edit" data-action="list-quick-edit" data-kind="memos" data-id="${esc(m.id)}" aria-label="${esc(m.title)}を編集" title="メモを編集">${icon('edit',14)} <span class="origin-edit-label">編集</span></button></div></div>`).join(''):empty('該当するメモがありません','絞り込みを解除するか、新しいメモを作成してください。')}</div>
 ${memoRemaining>0?`<div class="origin-memo-more" role="group" aria-label="メモの追加表示"><span>${mountedMemos.length} / ${items.length}件を表示</span><div class="origin-memo-more-actions"><button type="button" data-action="memo-load-more" aria-label="メモをさらに${Math.min(MEMO_RENDER_BATCH,memoRemaining)}件表示">${icon('plus',15)} あと${Math.min(MEMO_RENDER_BATCH,memoRemaining)}件</button><button type="button" data-action="memo-show-all" aria-label="残りのメモ${memoRemaining}件をすべて表示">残りすべて</button></div></div>`:''}`;
}
const singular={tasks:'タスク',todos:'ToDo',events:'予定',memos:'メモ',templates:'テンプレート',knowledge:'ナレッジ'};
function findItem(kind,id){return data[kind]?.find(x=>x.id===id)}
// Native schedule editor over the canonical (single-owner) schedule writer.
// Recurrence dates and overlaps are calculated by the canonical adapter.
// The Origin editor keeps one draft and requires a fresh review after edits.
function originScheduleBatchFields(v){
 const date=v.date||selectedDay;
 const methods=[['daily','毎日'],['weekdays','平日のみ'],['weekly','毎週・曜日指定'],['monthlyDay','毎月の指定日'],['monthlyNth','毎月の第N曜日'],['monthEnd','毎月末'],['lastWeekday','毎月の最終平日'],['yearly','毎年'],['dates','日付を個別指定']];
 return `<details class="origin-task-optional origin-batch-options"><summary>繰り返し・複数日登録</summary><div class="origin-task-extra-grid">
 <label class="form-field full"><span><input type="checkbox" name="batchEnabled"/>複数の予定をまとめて作成する</span></label>
 <div id="originBatchFields" class="form-grid" hidden>
 <label class="form-field">登録方法<select name="batchMethod">${methods.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label>
 <label class="form-field" data-batch-field="interval">間隔（1〜36）<input name="batchInterval" type="number" min="1" max="36" value="1"/></label>
 <fieldset class="form-field full" data-batch-field="weekdays"><legend>対象曜日</legend><div class="origin-batch-weekdays">${days.map((d,i)=>`<label><input name="batchWeekdays" type="checkbox" value="${i}" ${i===parseDay(date).getDay()?'checked':''}/>${d}</label>`).join('')}</div></fieldset>
 <label class="form-field" data-batch-field="monthDay">毎月の何日<input name="batchMonthDay" type="number" min="1" max="31" value="${parseDay(date).getDate()}"/></label>
 <label class="form-field" data-batch-field="nth">第何週<select name="batchNth">${[['1','第1'],['2','第2'],['3','第3'],['4','第4'],['5','第5'],['last','最終']].map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label>
 <label class="form-field" data-batch-field="nthWeekday">何曜日<select name="batchNthWeekday">${days.map((d,i)=>`<option value="${i}" ${i===parseDay(date).getDay()?'selected':''}>${d}曜日</option>`).join('')}</select></label>
 <label class="form-field full" data-batch-field="dates">登録する日付<textarea name="batchDates" placeholder="YYYY-MM-DD（改行またはカンマ区切り）">${esc(date)}</textarea></label>
 <label class="form-field" data-batch-field="endMode">終了条件<select name="batchEndMode"><option value="count">件数で指定</option><option value="date">終了日まで</option></select></label>
 <label class="form-field" data-batch-field="count">作成件数（最大200）<input name="batchCount" type="number" min="1" max="200" value="4"/></label>
 <label class="form-field" data-batch-field="endDate">終了日<input name="batchEndDate" type="date" value="${esc(date)}"/></label>
 <button class="secondary-button" type="button" data-action="schedule-preview">作成日を確認</button>
 <div id="originBatchReview" class="form-field full origin-batch-review" role="status" aria-live="polite">条件を指定し、作成日を確認してください。</div>
 </div></div></details>`;
}
function syncOriginBatchFields(form){
 const fields=form.querySelector('#originBatchFields');if(!fields)return;
 const enabled=form.elements.batchEnabled.checked,method=form.elements.batchMethod.value;
 fields.hidden=!enabled;
 const visible={interval:!['dates','weekdays'].includes(method),weekdays:method==='weekly',monthDay:method==='monthlyDay',nth:method==='monthlyNth',nthWeekday:method==='monthlyNth',dates:method==='dates',endMode:method!=='dates',count:method!=='dates'&&form.elements.batchEndMode.value==='count',endDate:method!=='dates'&&form.elements.batchEndMode.value==='date'};
 fields.querySelectorAll('[data-batch-field]').forEach(group=>{group.hidden=!visible[group.dataset.batchField]});
 fields.querySelectorAll('input,select,textarea').forEach(control=>{control.disabled=!enabled||Boolean(control.closest('[data-batch-field]')?.hidden)});
}
function originBatchCommand(form){
 const fd=new FormData(form);
 return {type:'schedule.preview-batch',revision:0,ownerRoom:form.dataset.ownerRoom,ownerUser:form.dataset.ownerUser,
 values:{title:String(fd.get('title')||'').trim(),startAt:String(fd.get('startAt')||''),endAt:String(fd.get('endAt')||''),assignee:String(fd.get('assignee')||''),category:String(fd.get('category')||''),relatedTaskId:String(fd.get('relatedTaskId')||''),location:String(fd.get('location')||''),memo:String(fd.get('memo')||'')},
 copyConfig:{method:String(fd.get('batchMethod')||'daily'),startDate:String(fd.get('startAt')||'').slice(0,10),interval:Number(fd.get('batchInterval')||1),count:Number(fd.get('batchCount')||4),endMode:String(fd.get('batchEndMode')||'count'),endDate:String(fd.get('batchEndDate')||''),selectedDates:String(fd.get('batchDates')||''),weekdays:fd.getAll('batchWeekdays').map(Number),monthDay:Number(fd.get('batchMonthDay')||1),nth:String(fd.get('batchNth')||'1'),nthWeekday:Number(fd.get('batchNthWeekday')||0)}};
}
function invalidateOriginBatchReview(form){
 if(!form?.querySelector('#originBatchReview'))return;
 delete form.dataset.batchReviewed;
 form.querySelector('#originBatchReview').textContent='条件を指定し、作成日を確認してください。';
}
async function previewOriginBatch(form){
 if(busy||!form?.elements.batchEnabled?.checked||!form.reportValidity())return;
 const command=originBatchCommand(form),signature=JSON.stringify(command);
 busy=true;markOriginEditorSaving(true,command);
 try{
  const result=await bridge.dispatch(command);
  if(!form.isConnected)return;
  if(!result?.ok){invalidateOriginBatchReview(form);notify('作成日を計算できませんでした。日時と繰り返し条件を確認してください。');return}
  if(JSON.stringify(originBatchCommand(form))!==signature)return;
  form.dataset.batchReviewed=signature;
  const clashes=new Set((result.conflicts||[]).map(x=>x.date));
  form.querySelector('#originBatchReview').innerHTML=`<strong>${result.count}件の作成日</strong><div class="origin-batch-dates">${result.dates.map(date=>`<span class="tag ${clashes.has(date)?'overdue':''}">${esc(date)}${clashes.has(date)?' · 時間重複':''}</span>`).join('')}</div><p>${clashes.size?'既存予定との時間重複があります。登録時に再確認します。':'この日程で登録します。'}条件や予定内容を変更すると再確認が必要です。</p>`;
 }catch(error){invalidateOriginBatchReview(form);notify('作成日の確認に失敗しました。入力内容は保持しています。');}
 finally{busy=false;markOriginEditorSaving(false)}
}
function originScheduleEditor(v,id){
 const date=/^\d{4}-\d{2}-\d{2}$/.test(v.date||'')?v.date:selectedDay;
 const start=scheduleLocalInput(v.startAt)||date+'T09:00';
 const end=scheduleLocalInput(v.endAt)||date+'T10:00';
 const assignee=v.assignee||snapshot.currentUser;
 const category=v.category||snapshot.categories[0]||'その他';
 const options=(items,current)=>[...new Set([current,...(items||[])].filter(Boolean))]
   .map(x=>`<option value="${esc(x)}" ${x===current?'selected':''}>${esc(x)}</option>`).join('');
 const related='<option value="">関連付けなし</option>'+
   snapshot.tasks.map(x=>`<option value="${esc(x.id)}" ${x.id===v.relatedTaskId?'selected':''}>${esc(x.title)}</option>`).join('')+
   (v.relatedTaskId&&!snapshot.tasks.some(x=>x.id===v.relatedTaskId)
     ?`<option value="${esc(v.relatedTaskId)}" selected>以前の関連タスク</option>`:'');
 return `<div class="origin-schedule-intro"><strong>${v.originTaskDraft?'タスクから関連予定を作成':'予定を登録・編集'}</strong><p>${v.originTaskDraft?'タスク名と関連付けを引き継ぎました。日時は仮入力です。確認してから登録してください。':'日時と担当者を選び、この画面でそのまま保存できます。'}</p></div>
 <div class="form-grid">
 <label class="form-field full">予定名<input name="title" value="${esc(v.title||'')}" maxlength="80" required placeholder="例：部署ミーティング"/></label>
 <label class="form-field">開始日時<input name="startAt" type="datetime-local" value="${esc(start)}" required/></label>
 <label class="form-field">終了日時<input name="endAt" type="datetime-local" value="${esc(end)}" required/></label>
 <div class="form-field full origin-schedule-duration" role="group" aria-label="所要時間"><span>所要時間</span><button type="button" data-action="schedule-duration" data-minutes="30">30分</button><button type="button" data-action="schedule-duration" data-minutes="60">1時間</button><button type="button" data-action="schedule-duration" data-minutes="120">2時間</button></div>
 <label class="form-field">担当者<select name="assignee" required>${options(snapshot.assignees,assignee)}</select></label>
 <label class="form-field">分類<select name="category" required>${options(snapshot.categories,category)}</select></label>
 <div class="form-field full origin-related-picker" role="group" aria-label="関連するタスクを検索して選択"><label for="originRelatedTaskSearch">関連するタスク（任意）</label><div class="origin-related-picker-search"><input id="originRelatedTaskSearch" type="search" autocomplete="off" placeholder="タスク名・担当者・分類で検索" aria-controls="originRelatedTaskSelect" aria-describedby="originRelatedTaskHint"/><button type="button" data-action="related-task-clear" aria-label="関連タスクの紐付けを解除">解除</button></div><select id="originRelatedTaskSelect" name="relatedTaskId" aria-label="関連タスク候補を選択">${related}</select><span id="originRelatedTaskHint" class="origin-related-picker-hint" role="status" aria-live="polite">検索して候補を絞り込めます。</span></div>
 <label class="form-field full">場所・方法<input name="location" maxlength="60" value="${esc(v.location||'')}" placeholder="会議室・オンラインなど"/></label>
 <label class="form-field full">メモ<textarea name="memo" maxlength="1000" placeholder="議題や補足">${esc(v.desc||'')}</textarea></label>
 </div><p id="originScheduleError" class="origin-schedule-error" role="alert" hidden></p>
 ${v.recurrenceSeriesId?'<p class="origin-schedule-note">繰り返し予定のこの1件のみ編集し、系列の設定は維持します。</p>':''}
 ${!id?originScheduleBatchFields(v):''}
`;
}

function filterOriginRelatedTasks(){
 const form=$('#editForm'),search=form?.querySelector('#originRelatedTaskSearch'),select=form?.querySelector('#originRelatedTaskSelect');
 if(!search||!select)return;
 const chosen=select.value,tokens=search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 const hits=snapshot.tasks.filter(t=>tokens.every(k=>[t.title,t.assignee,t.category,t.status].join(' ').toLocaleLowerCase().includes(k)))
  .sort((a,b)=>a.title.localeCompare(b.title,'ja')||String(a.id).localeCompare(String(b.id)));
 const active=snapshot.tasks.find(t=>t.id===chosen),options=[new Option('関連付けなし','')];
 if(chosen&&!hits.slice(0,40).some(t=>t.id===chosen))
  options.push(new Option(active?'選択中: '+active.title:'以前の関連タスク（現在は参照できません）',chosen));
 for(const t of hits.slice(0,40))options.push(new Option(t.title+' · '+(t.assignee||'担当未設定')+' · '+(t.category||'分類なし'),t.id));
 select.replaceChildren(...options);select.value=chosen;
 const hint=form.querySelector('#originRelatedTaskHint');if(hint)hint.textContent=hits.length+'件一致'+(hits.length>40?'（先頭40件）':'')+'。選択中の関連付けは検索しても維持されます。';
}
function taskCheckRow(x={}){return '<div class="origin-checkrow"><input type="checkbox" name="checkDone" aria-label="この項目を完了にする" '+(x.done?'checked':'')+'/><input type="text" name="checkText" maxlength="180" value="'+esc(x.text||'')+'" aria-label="チェック項目の内容" placeholder="作業項目を入力"/><button type="button" data-action="task-check-remove" aria-label="このチェック項目を削除" title="削除">'+icon('trash',14)+'</button></div>'}
function taskCheckboxRows(v){return (v.checklist||[]).map(taskCheckRow).join('')}
let originInboxSection='important',originInboxGenre='all',originInboxReadFilter='all',originInboxQuery='',originInboxLimit=40;
let originInboxBusy=false,originInboxUser='',originInboxPreviousOverflow='';
// Temporary return target for an inspector opened from the inbox; never persisted.
let originInboxReturn=null;
function originInboxStamp(value){
 const n=Number(value);
 if(Number.isFinite(n)&&n>0)return n<1e11?n*1000:n;
 const date=Date.parse(String(value||''));
 return Number.isFinite(date)?date:0;
}
// In Origin, the subject is the work item, not the generic event verb.
// Keep the original title/body on each row for backwards-compatible searching.
function originInboxDisplay(row){
 const title=String(row.title||'').trim(),body=String(row.body||'').trim();
 const generic=new Set(['予定を作成','予定を更新','タスクを作成','タスクを更新',
  'コメントが追加されました','コメントに返信がありました',
  'コメントにリアクションがありました','@メンションされました',
  '担当になりました','状態が変更されました','更新があります','お知らせ']);
 const templated=generic.has(title);
 const removeActor=text=>{
  const actor=String(row.actor||'').trim();
  return actor&&(text.startsWith(actor+'：')||text.startsWith(actor+':'))
   ?text.slice(actor.length+1).trim():text;
 };
 let subject=String(row.targetTitle||'').trim(),detail=body;
 if(row.type==='status'&&body.includes('｜')){
  const [change,...rest]=body.split('｜');
  if(!subject)subject=rest.join('｜').trim();
  detail=change.trim();
 }
 if(!subject&&body){
  // A deleted or inaccessible target has no available title. Prefer useful
  // content to repeating a generic event phrase.
  subject=['mention','reply','comment','reaction'].includes(row.type)?removeActor(body)||body:body;
  detail='';
 }
 if(!subject&&!templated)subject=title;
 if(!subject)subject=row.notification?'対象のタスクを確認できません':'対象名がありません';
 if(!row.notification||detail===subject)detail='';
 // The actor is already shown in the metadata next to the timestamp.
 detail=removeActor(detail);
 if(title&&!templated&&title!==subject)
  detail=[title,detail].filter(Boolean).join(' · ');
 return {subject,detail};
}
function originInboxData(){
 const inbox=window.WorkBoardWorkflowV152?.inboxFor?.()||{};
 const priority=new Set(['mention','reply','comment','reaction','assign']);
 // Task references in the canonical inbox are ID-only. Resolve accessible
 // names from the current shared snapshot without persisting derived fields.
 const taskNames=new Map((snapshot?.tasks||[]).filter(t=>t?.id)
  .map(t=>[String(t.id),String(t.title||'').trim()]));
 const important=[],activity=[];
 const labels={mention:'メンション',reply:'返信',comment:'コメント',reaction:'リアクション',assign:'担当依頼',status:'状態変更',update:'通知',create:'新規作成'};
 for(const [id,x] of Object.entries(inbox)){
  if(!x||typeof x!=='object')continue;
  const type=String(x.type||'update'),isImportant=priority.has(type);
  const row={id:String(id),type,createdAt:originInboxStamp(x.createdAt),readAt:Number(x.readAt)||0,notification:true,
   title:String(x.title||'お知らせ'),body:String(x.body||''),actor:String(x.actor||''),label:labels[type]||'通知',
   targetTitle:taskNames.get(String(x.taskId||''))||'',
   category:isImportant?(type==='reaction'||type==='comment'?'conversation':type):(type==='status'?'status':'notice'),
   kind:'tasks',targetId:String(x.taskId||'')};
  (isImportant?important:activity).push(row);
 }
 // The presentation bridge intentionally omits creation metadata. Use the
 // canonical room-scoped collection caches for timestamps, while the current
 // bridge snapshot remains the authority for visible IDs and latest revisions.
 // This is a current-state summary, not an append-only audit history.
 const room=String(snapshot?.roomId||'');
 const cachedRecords=collection=>{
  if(!room)return new Map();
  let raw=[];
  try{
   const key='system-task-'+(collection==='tasks'?'tasks':'schedules')+':'+room;
   const parsed=JSON.parse(localStorage.getItem(key)||'[]');
   if(Array.isArray(parsed))raw=parsed;
  }catch(error){/* Cache unavailable; the bridge still supplies visible records. */}
  return new Map(raw.filter(item=>item&&item.id).map(item=>[String(item.id),item]));
 };
 for(const [kind,items,label] of [['tasks',snapshot?.tasks||[],'タスク'],['events',snapshot?.schedules||[],'予定']]){
  const cache=cachedRecords(kind);
  for(const current of items){
   if(!current?.id)continue;
   const saved=cache.get(String(current.id))||{};
   const created=originInboxStamp(saved.createdAt||current.createdAt);
   const updated=originInboxStamp(current.updatedAt||saved.updatedAt);
   const revision=Math.max(Number(saved.revision)||0,Number(current.revision)||0);
   const base={notification:false,readAt:0,category:kind==='tasks'?'task':'schedule',
    kind,targetId:String(current.id),body:String(current.title||label),
    targetTitle:String(current.title||'').trim()};
   if(created)activity.push({...base,id:kind+':created:'+current.id,createdAt:created,
    title:label+'を作成',label:label+'・作成',actor:String(saved.createdBy||'')});
   if(created&&updated>created&&revision>1)
    activity.push({...base,id:kind+':updated:'+current.id,createdAt:updated,
     title:label+'を更新',label:label+'・更新',actor:String(saved.updatedBy||'')});
  }
 }
 const sorter=(a,b)=>b.createdAt-a.createdAt||a.id.localeCompare(b.id);
 return {important:important.sort(sorter),activity:activity.sort(sorter),unread:Object.values(inbox).filter(x=>x&&!Number(x.readAt)).length};
}
function originInboxUpdateBadge(){
 const count=Number(window.WorkBoardWorkflowV152?.unreadCount?.()||0);
 const badge=$('#originInboxBadge'),trigger=$('#originInboxButton');
 if(badge){badge.hidden=count===0;badge.textContent=count>99?'99+':String(count)}
 if(trigger)trigger.setAttribute('aria-label',count?'受信箱を開く・未読'+count+'件':'受信箱を開く');
}
function renderOriginInbox(){
 const dialog=$('#originInboxDialog');
 if(!dialog?.open)return;
 if(originInboxUser!==snapshot.currentUser){closeOriginInbox(false);return}
 const all=originInboxData(),important=originInboxSection==='important',rows=important?all.important:all.activity;
 const options=important?[['all','すべて'],['mention','メンション'],['reply','返信'],['assign','担当依頼'],['conversation','コメント・反応']]
  :[['all','すべて'],['task','タスク'],['schedule','予定'],['status','状態変更'],['notice','その他']];
 const query=originInboxQuery.trim().toLocaleLowerCase();
 const found=rows.filter(row=>(originInboxGenre==='all'||row.category===originInboxGenre)
  &&(!important||originInboxReadFilter==='all'||(originInboxReadFilter==='unread'?!row.readAt:!!row.readAt))
  &&(!query||[row.title,row.body,row.targetTitle,row.label,row.actor].join(' ').toLocaleLowerCase().includes(query)))
  // Unread notification records come first; activity projections are not treated as unread.
  // Keep the original newest-first order inside both groups.
  .sort((a,b)=>Number(Boolean(b.notification&&!b.readAt))-Number(Boolean(a.notification&&!a.readAt))
   ||b.createdAt-a.createdAt||a.id.localeCompare(b.id));
 const list=$('#originInboxList'),genre=$('#originInboxGenres'),active=mount.activeElement,scroll=list.scrollTop;
 const fromList=Boolean(active&&list.contains(active)),fromGenre=Boolean(active&&genre.contains(active));
 const focusId=active?.dataset?.id,focusAction=active?.dataset?.action,focusValue=active?.dataset?.value;
 $('#originInboxImportantCount').textContent=all.important.filter(row=>!row.readAt).length+'件未読';
 $('#originInboxActivityCount').textContent=all.activity.length+'件';
 dialog.querySelectorAll('[data-action="origin-inbox-section"]').forEach(button=>{
  const isSelected=button.dataset.value===originInboxSection;
  button.setAttribute('aria-selected',String(isSelected));button.tabIndex=isSelected?0:-1;
 });
 $('#originInboxReadLabel').hidden=!important;
 $('#originInboxReadFilter').value=originInboxReadFilter;
 genre.innerHTML=options.map(([id,label])=>{
  const categoryRows=rows.filter(row=>id==='all'||row.category===id);
  const unread=categoryRows.filter(row=>row.notification&&!row.readAt).length;
  const aria=label+' '+categoryRows.length+'件'+(unread?'、未読'+unread+'件':'');
  return `<button type="button" data-action="origin-inbox-genre" data-value="${id}" aria-label="${esc(aria)}" aria-pressed="${originInboxGenre===id}">${esc(label)} <small>${categoryRows.length}</small>${unread?` <span class="origin-inbox-unread-count" aria-hidden="true">未読${unread}</span>`:''}</button>`;
 }).join('');
 const unreadVisible=found.filter(row=>row.notification&&!row.readAt).length;
 $('#originInboxSummary').textContent=found.length+'件の'+(important?'重要な通知':'アクティビティ')
  +(unreadVisible&&originInboxReadFilter==='all'?' · 未読'+unreadVisible+'件を先に表示':'')
  +(found.length>originInboxLimit?'（先頭'+originInboxLimit+'件を表示）':'');
 const quick=$('#originInboxUnreadQuick');
 quick.hidden=!important||originInboxReadFilter==='read'||(originInboxReadFilter==='all'&&!unreadVisible);
 quick.textContent=originInboxReadFilter==='unread'?'すべて表示':'未読'+unreadVisible+'件だけ表示';
 $('#originInboxFootNote').textContent=important?'通知の既読状態は利用者別に保存されます。':
  '保存済みの作成・最新更新を表示しています。すべての変更を記録した監査ログではありません。';
 const bulk=dialog.querySelector('[data-action="origin-inbox-read-all"]');
 bulk.disabled=originInboxBusy||all.unread===0;
 bulk.textContent=originInboxBusy?'保存中…':all.unread?'通知をすべて既読（'+all.unread+'件）':'未読通知はありません';
 const html=found.slice(0,originInboxLimit).map(x=>{
  const target=x.targetId&&findItem(x.kind,x.targetId);
  const display=originInboxDisplay(x);
  const read=x.notification&&Boolean(x.readAt);
  const unread=x.notification&&!read;
  const date=x.createdAt?new Date(x.createdAt).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'日時不明';
  const meta=[x.actor,date].filter(Boolean).join(' · ');
  const glyph=x.category==='schedule'?'calendar':x.category==='mention'?'mail':x.category==='reply'?'notes':x.category==='status'?'check':x.category==='conversation'?'spark':'tasks';
  return `<article class="origin-inbox-item${read?' is-read':''}${unread?' is-unread':''}" data-inbox-id="${esc(x.id)}">
   <div class="origin-inbox-avatar">${icon(glyph,20)}</div><div class="origin-inbox-item-body">
     <div class="origin-inbox-item-meta"><span class="origin-inbox-label">${esc(x.label)}</span>${x.notification&&!read?'<span class="origin-inbox-unread">未読</span>':''}<time>${esc(meta)}</time></div>
     <strong class="origin-inbox-subject">${esc(display.subject)}</strong>${display.detail?`<p class="origin-inbox-detail">${esc(display.detail)}</p>`:''}
     <div class="origin-inbox-actions">${target?`<button type="button" class="origin-inbox-open" data-action="origin-inbox-open" data-kind="${x.kind}" data-id="${esc(x.targetId)}">${icon('right',14)} ${x.kind==='tasks'?'タスク':'予定'}を開く</button>`:''}
     ${x.notification?`<button type="button" data-action="origin-inbox-read" data-id="${esc(x.id)}" ${originInboxBusy?'disabled':''}>${read?'未読に戻す':'既読にする'}</button>`:''}</div>
    </div></article>`;
 }).join('');
 list.innerHTML=html?(html+(found.length>originInboxLimit?`<button type="button" class="origin-inbox-more" data-action="origin-inbox-more">さらに表示（${originInboxLimit} / ${found.length}件）</button>`:''))
 :`<div class="origin-inbox-empty">${icon(important?'mail':'layers',28)}<strong>${important?'該当する重要通知はありません':'アクティビティがありません'}</strong><p>${query?'検索・分類を変更してください。':important?'メンションや返信、担当依頼をここで確認できます。':'保存済みの作成・更新がここに並びます。'}</p></div>`;
 list.scrollTop=scroll;originInboxUpdateBadge();
 if(fromList){
  const same=Array.from(list.querySelectorAll('button')).find(el=>el.dataset.action===focusAction&&el.dataset.id===focusId);
  (same||(important?$('#originInboxReadFilter'):null)||genre.querySelector('button'))?.focus({preventScroll:true});
 }else if(fromGenre){
  const same=Array.from(genre.querySelectorAll('button')).find(el=>el.dataset.action===focusAction&&el.dataset.value===focusValue);
  (same||genre.querySelector('button'))?.focus({preventScroll:true});
 }
}
function openOriginInbox(preserve=false){
 const dialog=$('#originInboxDialog');if(!dialog||dialog.open)return;
 closeOriginSettings();$('#createMenu').hidden=true;closeSearch();
 if(!preserve){
  originInboxReturn=null;
  originInboxSection='important';originInboxGenre='all';originInboxReadFilter='all';originInboxQuery='';originInboxLimit=40;
 }
 originInboxUser=snapshot.currentUser;
 $('#originInboxSearch').value=originInboxQuery;
 originInboxPreviousOverflow=document.body.style.overflow;
 dialog.showModal();document.body.style.overflow='hidden';
 renderOriginInbox();
 if(preserve&&originInboxReturn){
  const list=$('#originInboxList'),saved=originInboxReturn;
  list.scrollTop=saved.scrollTop;
  const target=Array.from(list.querySelectorAll('[data-inbox-id]'))
   .find(item=>item.dataset.inboxId===saved.notificationId);
  (target?.querySelector('.origin-inbox-open')||target?.querySelector('[data-action="origin-inbox-read"]')
   ||dialog.querySelector('[data-action="origin-inbox-close"]'))?.focus({preventScroll:true});
 }else dialog.querySelector('[data-action="origin-inbox-close"]')?.focus({preventScroll:true});
}
function closeOriginInbox(restoreFocus=true){
 const dialog=$('#originInboxDialog');if(!dialog?.open)return;
 dialog.close();document.body.style.overflow=originInboxPreviousOverflow;
 if(restoreFocus)$('#originInboxButton')?.focus({preventScroll:true});
}
// Keep a stable reading cursor while a notification moves between the read and unread groups.
function originInboxReadCursor(id){
 const items=Array.from($('#originInboxList')?.querySelectorAll('.origin-inbox-item')||[]);
 const index=items.findIndex(item=>item.dataset.inboxId===id);
 return {user:snapshot.currentUser,section:originInboxSection,genre:originInboxGenre,
  readFilter:originInboxReadFilter,query:originInboxQuery,id,
  nextId:index>=0?items[index+1]?.dataset.inboxId||'':'',
  previousId:index>0?items[index-1].dataset.inboxId:''};
}
function restoreOriginInboxReadCursor(cursor,saved){
 const dialog=$('#originInboxDialog');
 if(!cursor||!dialog?.open||snapshot.currentUser!==cursor.user
   ||originInboxSection!==cursor.section||originInboxGenre!==cursor.genre
   ||originInboxReadFilter!==cursor.readFilter||originInboxQuery!==cursor.query)return;
 const rows=Array.from($('#originInboxList')?.querySelectorAll('.origin-inbox-item')||[]);
 const candidates=saved?[cursor.nextId,cursor.previousId,cursor.id]
  :[cursor.id,cursor.nextId,cursor.previousId];
 for(const id of candidates){
  if(!id)continue;
  const row=rows.find(item=>item.dataset.inboxId===id);
  // Read actions take precedence over the detail button in the same notification row.
  const action=row?.querySelector('[data-action="origin-inbox-read"]:not(:disabled)')
   ||row?.querySelector('[data-action="origin-inbox-open"]');
  if(action){action.focus({preventScroll:true});action.scrollIntoView({block:'nearest',behavior:'instant'});return;}
 }
 // When the last matching notification disappears, keep keyboard focus in the inbox.
 const quick=$('#originInboxUnreadQuick');
 const fallback=originInboxSection==='important'
  ?(!quick.hidden?quick:$('#originInboxReadFilter'))
  :$('#originInboxGenres [data-action="origin-inbox-genre"][aria-pressed="true"]');
 fallback?.focus({preventScroll:true});
}
async function originInboxRead(id){
 const flow=window.WorkBoardWorkflowV152,record=flow?.inboxFor?.()?.[id];
 if(!record||originInboxBusy)return;
 const cursor=originInboxReadCursor(id);
 let saved=false;
 originInboxBusy=true;renderOriginInbox();
 try{
  const result=await flow.markInboxRead(id,!Number(record.readAt),snapshot.currentUser,Number(record.readAt)||0);
  saved=Boolean(result?.ok);
  if(!saved)notify('既読の保存に失敗しました。最新の通知を確認してください。');
 }catch(e){notify('通知の操作に失敗しました。再度お試しください。')}
 finally{
  originInboxBusy=false;renderOriginInbox();originInboxUpdateBadge();
  restoreOriginInboxReadCursor(cursor,saved);
 }
}
async function originInboxReadAll(){
 const flow=window.WorkBoardWorkflowV152;if(!flow||originInboxBusy)return;
 originInboxBusy=true;renderOriginInbox();
 try{
  const result=await flow.markAllInboxRead(snapshot.currentUser);
  if(!result?.ok)notify('一部の既読状態を保存できませんでした。');
 }catch(e){notify('通知を既読にできませんでした。')}
 finally{originInboxBusy=false;renderOriginInbox();originInboxUpdateBadge()}
}
let originTool='templates',originToolQuery='',originToolLimit=60;
const originManagementDrafts=Object.create(null);
function renderOriginTools(){
 const workflow=window.WorkBoardWorkflowV152,q=originToolQuery.trim().toLocaleLowerCase();
 const match=values=>!q||values.join(' ').toLocaleLowerCase().includes(q);
 const tabs=[['templates','テンプレート','繰り返し使う作業','file'],['archive','アーカイブ','完了した業務を保管','check'],['knowledge','ナレッジ','対応手順を共有','notes'],['insights','集計','担当ごとの状況','tasks'],['settings','管理','分類・状態・利用者','filter']];
 let body='';
 if(originTool==='templates')body=`<div class="section-head"><h2>タスクテンプレート</h2><button type="button" class="primary-button" data-action="template-new">テンプレートを追加</button></div><div class="origin-tool-list">${data.templates.filter(t=>match([t.name,t.title,t.description])).map(t=>`<button type="button" class="origin-tool-row" data-action="template-edit" data-id="${esc(t.id)}"><span><strong>${esc(t.name)}</strong><small>${esc(t.title)} · ${esc(t.category)}</small></span>${icon('edit',16)}</button>`).join('')}</div>`;
 if(originTool==='knowledge'){
   const rows=data.knowledge.filter(t=>match([t.title,t.summary,t.symptom,t.action,t.checkpoint]));
   body=`<h2>業務ナレッジ</h2><p class="quiet-small">タスク詳細の「ナレッジとして残す」から登録できます。</p><div class="origin-tool-list">${rows.slice(0,originToolLimit).map(t=>`<button type="button" class="origin-tool-row" data-action="open" data-kind="knowledge" data-id="${esc(t.id)}"><span><strong>${esc(t.title)}</strong><small>${esc(t.summary||t.action).slice(0,160)}</small></span>${icon('right',16)}</button>`).join('')}</div>${rows.length>originToolLimit?'<button type="button" class="secondary-button" data-action="tool-more">さらに表示</button>':''}`;
 }
 if(originTool==='archive'){
   const rows=data.tasks.filter(t=>workflow?.isArchived(t.id)&&match([t.title,t.desc,t.category,t.assignee]));
   body=`<h2>アーカイブ</h2><div class="origin-tool-list">${rows.slice(0,originToolLimit).map(t=>`<article class="origin-tool-row"><button type="button" class="text-button" data-action="open" data-kind="tasks" data-id="${esc(t.id)}">${esc(t.title)}</button><button type="button" class="secondary-button" data-action="archive-restore" data-id="${esc(t.id)}" data-base="${esc(JSON.stringify(workflow.archiveInfo(t.id)))}">一覧へ戻す</button></article>`).join('')}</div>${rows.length>originToolLimit?'<button type="button" class="secondary-button" data-action="tool-more">さらに表示</button>':''}${!rows.length?empty('アーカイブはありません','完了済みタスクの詳細からアーカイブできます。'):''}`;
 }
 if(originTool==='settings')body=originManagementMarkup();
 if(originTool==='insights'){
   const groups=[...new Set(data.tasks.map(t=>t.assignee||'担当未設定'))];
   body=`<h2>タスクの集計</h2><div class="origin-stats-scroll"><table class="origin-stats"><thead><tr><th>担当者</th><th>未完了</th><th>完了</th><th>期限超過</th></tr></thead><tbody>${groups.map(name=>{const rows=data.tasks.filter(t=>(t.assignee||'担当未設定')===name);return `<tr><th>${esc(name)}</th><td>${rows.filter(t=>!t.completed).length}</td><td>${rows.filter(t=>t.completed).length}</td><td>${rows.filter(t=>!t.completed&&t.due&&t.due<base).length}</td></tr>`}).join('')}</tbody></table></div><p class="quiet-small">予約・アーカイブを含む登録済みタスクを集計しています。</p>`;
 }
 return `${head('WORKSPACE','その他の機能','')}<nav class="origin-tool-nav" aria-label="業務ツール">${tabs.map(([id,label,hint,glyph])=>`<button type="button" class="${originTool===id?'active':''}" data-action="tool-tab" data-value="${id}" aria-pressed="${originTool===id}">${icon(glyph,20)}<span><strong>${label}</strong><small>${hint}</small></span></button>`).join('')}</nav>${!['insights','settings'].includes(originTool)?`<label class="form-field origin-tool-search">この一覧を検索<input type="search" id="originToolQuery" value="${esc(originToolQuery)}"/></label>`:''}<section class="surface surface-section">${body}</section>`;
}
function originManagementMarkup(){
 const management=snapshot.management||{};
 return [['categories','分類'],['statuses','自分の状態'],['users','利用者']].map(([group,label])=>{
   const values=management[group]||[];
   return `<section class="origin-management" data-group="${group}" data-base="${esc(JSON.stringify(values))}"><h2>${label}</h2><div class="origin-workflow-add"><label class="form-field">追加する${label}<input data-management-draft="${group}:new" maxlength="${group==='users'?12:20}" value="${esc(originManagementDrafts[group+':new']||'')}"/></label><button type="button" class="secondary-button" data-action="management-write" data-operation="add">追加</button></div><div class="origin-tool-list">${values.map((name,index)=>`<div class="origin-tool-row" data-management-name="${esc(name)}"><div>${group==='users'?`<strong>${esc(name)}</strong>`:`<input aria-label="${esc(name)}の新しい名称" data-management-draft="${esc(group+':'+name)}" maxlength="20" value="${esc(originManagementDrafts[group+':'+name]??name)}"/><button type="button" class="secondary-button" data-action="management-write" data-operation="rename" ${name==='完了'?'disabled':''}>名称変更</button>`}<div class="origin-comment-actions"><button type="button" class="secondary-button" data-action="management-write" data-operation="up" data-target="${esc(values[index-1]||'')}" ${index===0?'disabled':''}>上へ</button><button type="button" class="secondary-button" data-action="management-write" data-operation="down" data-target="${esc(values[index+1]||'')}" ${index===values.length-1?'disabled':''}>下へ</button><button type="button" class="secondary-button" data-action="management-write" data-operation="delete" ${values.length<=1||(group==='statuses'&&(management.protectedStatuses||[]).includes(name))?'disabled':''}>削除</button></div></div></div>`).join('')}</div></section>`;
 }).join('');
}
async function saveOriginManagement(el){
 const group=el.closest('.origin-management'),row=el.closest('[data-management-name]'),operation=el.dataset.operation;
 if(!group||busy)return;
 const command={type:'management.write',group:group.dataset.group,base:group.dataset.base,action:['up','down'].includes(operation)?'move':operation,name:operation==='add'?group.querySelector('[data-management-draft]').value:row?.dataset.managementName,next:['up','down'].includes(operation)?el.dataset.target:row?.querySelector('input')?.value,ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser};
 const ok=await send(command,'管理情報を更新しました');
 if(ok){for(const key of Object.keys(originManagementDrafts))if(key.startsWith(command.group+':'))delete originManagementDrafts[key];render();}
}
async function originSidecarAction(el){
 if(busy)return;
 const workflow=window.WorkBoardWorkflowV152;if(!workflow)return;
 const action=el.dataset.action,id=el.dataset.id;
 if(action==='task-archive'&&originDetailHasDraft()&&!window.confirm('未保存の入力を破棄してアーカイブしますか？'))return;
 busy=true;
 try{
   const result=action==='task-archive'?await workflow.archiveTask(id,'manual',JSON.parse(el.dataset.base))
     :await workflow.unarchiveTask(id,JSON.parse(el.dataset.base));
   if(result?.ok){if(action==='task-archive')closePanel(true,false);render();notify('更新しました。')}
   else notify('更新できませんでした。ほかの端末の更新や接続状態を確認してください。');
 }finally{busy=false}
}
function originKnowledgeEditor(v){
 return `<div class="form-grid"><label class="form-field full">件名<input name="title" maxlength="80" required value="${esc(v.title||'')}"/></label>${[['summary','概要'],['symptom','症状・背景'],['action','対応内容'],['checkpoint','確認事項']].map(([id,label])=>`<label class="form-field full">${label}<textarea name="${id}" maxlength="6000" ${id==='action'?'required':''}>${esc(v[id]||'')}</textarea></label>`).join('')}</div>`;
}
function originTemplateEditor(v){
 return `<div class="form-grid"><label class="form-field full">テンプレート名<input name="name" maxlength="30" required value="${esc(v.name||'')}"/></label><label class="form-field full">件名<input name="title" maxlength="80" required value="${esc(v.title||'')}"/></label>
 <label class="form-field">優先度<select name="priority">${['緊急','高','中','低'].map(x=>`<option ${x===(v.priority||'中')?'selected':''}>${x}</option>`).join('')}</select></label>
 <label class="form-field">分類<select name="category">${[...new Set([v.category,...snapshot.categories].filter(Boolean))].map(x=>`<option ${x===v.category?'selected':''}>${esc(x)}</option>`).join('')}</select></label>
 <label class="form-field full">タグ<input name="tags" maxlength="80" value="${esc(v.tags||'')}"/></label><label class="form-field full">説明<textarea name="description" maxlength="6000">${esc(v.description||'')}</textarea></label><label class="form-field full">チェックリスト（1行に1項目）<textarea name="checklist" maxlength="6000">${esc(v.checklist||'')}</textarea></label></div>`;
}
function originTemplatePicker(){
 return `<div class="form-field full origin-template-picker"><label>テンプレート<select id="originTemplateSelect"><option value="">選択してください</option>${data.templates.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label><button type="button" class="secondary-button" data-action="template-apply">入力欄へ反映</button></div>`;
}
function applyOriginTemplate(){
 const form=$('#editForm'),template=data.templates.find(x=>x.id===$('#originTemplateSelect')?.value);if(!template||!form)return;
 if(['title','desc'].some(name=>form.elements[name].value.trim())&&!window.confirm('現在の入力内容にテンプレートを反映しますか？'))return;
 for(const [field,key] of [['title','title'],['priority','priority'],['category','category'],['tags','tags'],['desc','description']]){
   const control=form.elements[field];if(control.tagName!=='SELECT'||Array.from(control.options).some(x=>x.value===template[key]))control.value=template[key]||'';
 }
 $('#originTaskChecks').innerHTML=String(template.checklist||'').split('\n').filter(x=>x.trim()).map(text=>taskCheckRow({text,done:false})).join('');
 updateOriginDraftState();form.elements.title.focus();
}
function originRecurrenceEditor(v){
 const r=v.recurrenceRule||{},method=v.recurrence||'none',date=r.anchorDate||v.due||base;
 const options=[['none','繰り返さない'],['daily','毎日・N日ごと'],['weekdays','平日のみ'],['weekly','毎週・曜日指定'],['monthlyDay','毎月の指定日'],['monthlyNth','毎月の第N曜日'],['monthEnd','毎月末'],['lastWeekday','毎月の最終平日'],['yearly','毎年'],['dates','日付を個別指定']];
 return `<details class="origin-task-optional origin-recurrence" ${method!=='none'?'open':''}><summary>繰り返し設定</summary><div class="origin-task-extra-grid">
 <p class="quiet-small form-field full">このタスクの完了時に、次回の1件を自動作成します。</p>
 <label class="form-field full">繰り返し<select name="recurrence">${options.map(([id,label])=>`<option value="${id}" ${method===id?'selected':''}>${label}</option>`).join('')}</select></label>
 <div id="originRecurrenceFields" class="form-grid">
 <label class="form-field" data-recur-field="anchor">繰り返し開始日<input name="repeatAnchor" type="date" value="${esc(date)}"/></label>
 <label class="form-field" data-recur-field="interval">間隔（1〜36）<input name="repeatInterval" type="number" min="1" max="36" value="${r.interval||1}"/></label>
 <fieldset class="form-field full" data-recur-field="weekdays"><legend>対象曜日</legend><div class="origin-batch-weekdays">${days.map((d,i)=>`<label><input name="repeatWeekdays" type="checkbox" value="${i}" ${(r.weekdays||[parseDay(date).getDay()]).includes(i)?'checked':''}/>${d}</label>`).join('')}</div></fieldset>
 <label class="form-field" data-recur-field="monthDay">毎月の何日<input name="repeatMonthDay" type="number" min="1" max="31" value="${r.monthDay||parseDay(date).getDate()}"/></label>
 <label class="form-field" data-recur-field="nth">第何週<select name="repeatNth">${['1','2','3','4','5','last'].map(x=>`<option value="${x}" ${String(r.nth||'1')===x?'selected':''}>${x==='last'?'最終':'第'+x}</option>`).join('')}</select></label>
 <label class="form-field" data-recur-field="weekday">何曜日<select name="repeatWeekday">${days.map((d,i)=>`<option value="${i}" ${i===(r.weekday??parseDay(date).getDay())?'selected':''}>${d}曜日</option>`).join('')}</select></label>
 <label class="form-field full" data-recur-field="dates">指定日（最大200件）<textarea name="repeatDates" placeholder="YYYY-MM-DD（改行またはカンマ区切り）">${esc((r.selectedDates||[]).join('\n'))}</textarea></label>
 <label class="form-field" data-recur-field="endMode">終了条件<select name="repeatEndMode">${[['count','件数で指定'],['date','終了日まで'],['unlimited','無期限']].map(([id,label])=>`<option value="${id}" ${id===(r.endMode||'count')?'selected':''}>${label}</option>`).join('')}</select></label>
 <label class="form-field" data-recur-field="count">自動作成する件数<input name="repeatCount" type="number" min="1" max="200" value="${r.count||4}"/></label>
 <label class="form-field" data-recur-field="endDate">終了日<input name="repeatEndDate" type="date" value="${esc(r.endDate||'')}"/></label>
 <button type="button" class="secondary-button" data-action="task-recurrence-preview">次回の日付を確認</button><div id="originRecurrenceReview" class="form-field full origin-batch-review" role="status" aria-live="polite">${Number(r.generatedCount)||0}件作成済み。条件を指定して次回の日付を確認できます。</div>
 </div></div></details>`;
}
function syncOriginRecurrenceFields(form){
 const root=form?.querySelector('#originRecurrenceFields');if(!root)return;
 const method=form.elements.recurrence.value,end=form.elements.repeatEndMode.value;
 root.hidden=method==='none';
 const visible={anchor:method!=='dates',interval:!['dates','weekdays'].includes(method),weekdays:method==='weekly',monthDay:method==='monthlyDay',nth:method==='monthlyNth',weekday:method==='monthlyNth',dates:method==='dates',endMode:method!=='dates',count:method!=='dates'&&end==='count',endDate:method!=='dates'&&end==='date'};
 root.querySelectorAll('[data-recur-field]').forEach(el=>{el.hidden=!visible[el.dataset.recurField]});
 // Retain hidden calendar defaults so an unchanged series keeps its identity.
}
function originRecurrenceValues(form){
 const e=form.elements,method=e.recurrence.value;
 return {recurrence:method,recurrenceRule:{anchorDate:e.repeatAnchor.value,interval:Number(e.repeatInterval.value),weekdays:Array.from(form.querySelectorAll('[name="repeatWeekdays"]:checked')).map(x=>Number(x.value)),monthDay:Number(e.repeatMonthDay.value),nth:e.repeatNth.value,weekday:Number(e.repeatWeekday.value),endMode:method==='dates'?'dates':e.repeatEndMode.value,count:Number(e.repeatCount.value),endDate:e.repeatEndDate.value,selectedDates:e.repeatDates.value.split(/[\s,、]+/).filter(Boolean)}};
}
async function previewOriginTaskRecurrence(form){
 if(busy||!form)return;
 busy=true;
 try{
   const result=await bridge.dispatch({type:'task.preview-recurrence',id:form.dataset.id,revision:Number(form.dataset.revision),ownerRoom:form.dataset.ownerRoom,ownerUser:form.dataset.ownerUser,...originRecurrenceValues(form)});
   if(!form.isConnected)return;
   form.querySelector('#originRecurrenceReview').textContent=result?.ok
     ?result.description+'：'+(result.dates.length?result.dates.join(' ／ '):'今後の作成日はありません。')
     :result?.detail||'繰り返し条件を確認してください。';
 }finally{busy=false}
}
function originWorkflowPanel(t){
 const workflow=window.WorkBoardWorkflowV152;
 if(!workflow)return '';
 const deps=workflow.depIds(t.id),relations=workflow.relationIds(t.id),reminder=workflow.reminderFor(t.id);
 const group=(kind,label,ids)=>{
   const candidates=data.tasks.filter(x=>x.id!==t.id&&!ids.includes(x.id)
     &&(kind!=='dependencies'||(!x.completed&&!window.WorkBoardCompletionGuardV149?.wouldCycle(t.id,x.id))));
   return `<section data-origin-workflow-kind="${kind}" data-expected="${esc(JSON.stringify(ids))}"><h4>${label}</h4>
   <ul class="origin-workflow-list">${ids.map(id=>{const item=findItem('tasks',id);return `<li>${item?`<button type="button" class="text-button" data-action="related-open" data-kind="tasks" data-id="${esc(id)}">${esc(item.title)} · ${esc(item.status)}</button>`:'<span>削除済みのタスク</span>'}<button type="button" class="secondary-button" data-action="workflow-remove" data-value="${esc(id)}">解除</button></li>`}).join('')}</ul>
   <div class="origin-workflow-add"><select aria-label="${label}の候補"><option value="">タスクを選択</option>${candidates.map(x=>`<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('')}</select><button type="button" class="secondary-button" data-action="workflow-add">追加</button></div>
   <p class="quiet-small">${kind==='dependencies'?'未完了の前提タスクがある間は、このタスクを完了できません。':'一緒に確認するタスクを関連付けます。'}</p></section>`;
 };
 return `<details class="origin-task-section origin-workflow" id="originWorkflow" data-id="${esc(t.id)}" data-owner-room="${esc(snapshot.roomId)}" data-owner-user="${esc(snapshot.currentUser)}"><summary>前提・関連タスク・確認リマインダー<small>前提 ${deps.length}件 · 関連 ${relations.length}件${reminder?' · リマインダー設定中':''}</small></summary>
 ${group('dependencies','前提タスク',deps)}${group('relations','関連タスク',relations)}
 <section data-origin-workflow-kind="reminder" data-expected="${esc(JSON.stringify(reminder))}"><h4>自分の確認リマインダー</h4>
 ${t.completed?'<p class="quiet-small">完了済みタスクにはリマインダーを設定しません。</p>':`<div class="origin-workflow-add"><label class="form-field">再確認日時<input type="datetime-local" name="reminderAt" value="${reminder?scheduleLocalInput(reminder.at):''}"/></label><label class="form-field">メモ<input name="reminderNote" maxlength="120" value="${esc(reminder?.note||'')}"/></label></div><div class="origin-sheet-secondary"><button type="button" class="secondary-button" data-action="workflow-reminder">保存</button>${reminder?'<button type="button" class="secondary-button" data-action="workflow-reminder-clear">解除</button>':''}</div>`}</section>
 <section class="origin-duplicate"><h4>重複タスクの統合</h4><p class="quiet-small">説明・コメント・チェックリストを統合先へ引き継ぎ、元タスクを完了・アーカイブします。共同編集接続時に利用できます。</p><div class="origin-workflow-add"><select aria-label="重複タスクの統合先"><option value="">統合先を選択</option>${data.tasks.filter(x=>x.id!==t.id&&!window.WorkBoardWorkflowV152?.duplicateOf(x.id)).map(x=>`<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('')}</select><button type="button" class="secondary-button" data-action="duplicate-merge" data-id="${esc(t.id)}" ${snapshot.connectionMode!=='remote-online'?'disabled':''}>統合する</button></div></section>
 <p class="origin-schedule-error" role="alert" hidden></p></details>`;
}
async function writeOriginWorkflow(button){
 if(busy)return;
 const root=button.closest('#originWorkflow'),group=button.closest('[data-origin-workflow-kind]'),workflow=window.WorkBoardWorkflowV152;
 if(!root||!group||!workflow)return;
 const id=root.dataset.id,kind=group.dataset.originWorkflowKind;
 if(root.dataset.ownerRoom!==snapshot.roomId||root.dataset.ownerUser!==snapshot.currentUser||!findItem('tasks',id))return notify('利用者またはタスクが変わりました。詳細を開き直してください。');
 if(!workflow.dependencyStateReady())return notify('前提・関連情報を確認中です。通信状態を確認して再試行してください。');
 const expected=JSON.parse(group.dataset.expected),action=button.dataset.action;
 let value;
 if(kind==='reminder'){
   value=action==='workflow-reminder-clear'?null:{at:new Date(group.querySelector('[name="reminderAt"]').value).getTime(),note:group.querySelector('[name="reminderNote"]').value.trim()};
   if(value&&(!Number.isFinite(value.at)||value.at<=Date.now()+30000))return notify('現在より後の再確認日時を入力してください。');
 }else{
   const candidate=action==='workflow-remove'?button.dataset.value:group.querySelector('select').value;
   if(!candidate)return notify('タスクを選択してください。');
   if(action==='workflow-add'&&kind==='dependencies'&&window.WorkBoardCompletionGuardV149?.wouldCycle(id,candidate))return notify('前提タスクが循環するため追加できません。');
   value=action==='workflow-remove'?expected.filter(x=>x!==candidate):[...expected,candidate];
 }
 busy=true;root.inert=true;
 const error=root.querySelector('[role="alert"]');error.hidden=true;
 try{
   const result=kind==='reminder'?await workflow.writeReminder(id,value,undefined,expected)
     :kind==='dependencies'?await workflow.writeDependencies(id,value,expected):await workflow.writeRelations(id,value,expected);
   if(!root.isConnected)return;
   if(!result?.ok){error.hidden=false;error.textContent='保存できませんでした。他端末の更新や通信状態を確認してください。入力内容は保持しています。';return}
   const markup=document.createElement('div');markup.innerHTML=originWorkflowPanel(findItem('tasks',id));
   const replacement=markup.querySelector('[data-origin-workflow-kind="'+kind+'"]');
   group.replaceWith(replacement);replacement.querySelector('select,input,button')?.focus({preventScroll:true});
   notify('設定を保存しました。');
 }catch(errorObject){error.hidden=false;error.textContent='保存に失敗しました。入力内容は保持しています。';}
 finally{busy=false;root.inert=false}
}
function originCommentsFor(t){
 if(window.WorkBoardOriginCommentBridge?.readComments)return window.WorkBoardOriginCommentBridge.readComments(t.id).slice().reverse();
 const source=window.WorkBoardOriginCommentBridge?.readTask(t.id)||bridge.readCommentTask?.(t.id);
 return (Array.isArray(source?.comments)?source.comments:Object.values(source?.comments||{})).slice().reverse();
}
function originTaskComments(t){
 const comments=originCommentsFor(t);
 const commentRevision=window.WorkBoardOriginCommentBridge?.readTask(t.id)?.revision??t.revision;
 const reactions=window.WorkBoardOriginCommentBridge?.reactions||[];
 const entries=rows=>rows.map(c=>{const parent=comments.find(x=>x.id===c.replyTo);return `<li data-comment-id="${esc(c.id)}"><div class="record-meta"><span class="origin-comment-avatar" aria-hidden="true">${esc(Array.from(c.author||'?')[0])}</span><strong>${esc(c.author)}</strong><span class="tag">${esc(c.type||'作業メモ')}</span><time>${c.createdAt?esc(new Date(c.createdAt).toLocaleString('ja-JP')):''}</time></div>${c.replyTo?`<blockquote>${esc(parent?.author||'以前のコメント')}への返信：${esc(String(parent?.text||'').slice(0,80))}</blockquote>`:''}<p class="record-description">${esc(c.text||'')}</p><div class="origin-comment-actions"><button type="button" class="secondary-button" data-action="comment-reply" data-value="${esc(c.id)}">返信</button>${reactions.map(({emoji,label})=>{const users=Object.values(c.reactions?.[emoji]||{}),pressed=users.includes(snapshot.currentUser);return `<button type="button" class="secondary-button" data-action="comment-reaction" data-value="${esc(c.id)}" data-emoji="${emoji}" aria-label="${esc(label)}" aria-pressed="${pressed}" ${snapshot.connectionMode!=='remote-online'?'disabled title="共同編集接続時に利用できます"':''}>${emoji}${users.length?'<small>'+users.length+'</small>':''}</button>`}).join('')}</div></li>`}).join('');
 return `<section class="origin-task-section origin-comments" id="originTaskComments"><h3>対応履歴・コメント <small>${comments.length}件</small></h3>
 <p class="origin-comment-connect" role="status" ${snapshot.connectionMode==='remote-online'?'hidden':''}>${snapshot.connectionMode==='local-only'?'リアクションは共同編集をONにすると使えます。':'接続を確認しています。リアクションは接続が戻ると使えます。'}</p>
 ${comments.length?`<ol class="origin-comment-list">${entries(comments.slice(0,5))}</ol>${comments.length>5?`<details class="origin-comment-more"><summary>以前のコメント ${comments.length-5}件</summary><ol class="origin-comment-list">${entries(comments.slice(5))}</ol></details>`:''}`:'<p class="origin-detail-empty">コメントはまだありません。</p>'}
 <form id="originCommentForm" data-id="${esc(t.id)}" data-revision="${commentRevision}" data-owner-room="${esc(snapshot.roomId)}" data-owner-user="${esc(snapshot.currentUser)}">
 <label class="form-field">種類<select name="commentType">${['作業メモ','業者回答','確認依頼','申し送り'].map(x=>`<option>${x}</option>`).join('')}</select></label>
 <input type="hidden" name="replyTo"/><p id="originReplyContext" class="quiet-small" hidden></p><label class="form-field">メンション<select name="mention" data-origin-mention><option value="">通知する利用者を選択</option>${(snapshot.users||[]).filter(x=>x!==snapshot.currentUser).map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><label class="form-field">コメント<textarea name="text" required maxlength="6000" placeholder="対応状況や申し送りを入力"></textarea></label>
 <p class="origin-schedule-error" role="alert" hidden></p><button class="secondary-button" type="submit">コメントを送信</button></form></section>`;
}
function setOriginReplyContext(form,replyTo){
 if(!form)return;
 form.elements.replyTo.value=replyTo||'';
 const hint=form.querySelector('#originReplyContext');hint.hidden=!replyTo;
 if(!replyTo){hint.replaceChildren();return;}
 const parent=originCommentsFor({id:form.dataset.id}).find(x=>x.id===replyTo);
 hint.innerHTML=`<span>${esc(parent?.author||'選択したコメント')}に返信</span><button type="button" class="text-button" data-action="comment-reply-cancel">返信をやめる</button>`;
}
function refreshOriginComments(){
 const form=$('#originCommentForm'),task=form&&findItem('tasks',form.dataset.id);if(!form||!task)return;
 const current=mount.activeElement,section=form.closest('.origin-comments');
 const anchor=current&&section.contains(current)?{action:current.dataset.action,comment:current.dataset.value,emoji:current.dataset.emoji,name:current.name,top:current.getBoundingClientRect().top,start:current.selectionStart,end:current.selectionEnd}:null;
 const expanded=Boolean(section.querySelector('.origin-comment-more')?.open);
 const draft={text:form.elements.text.value,commentType:form.elements.commentType.value,replyTo:form.elements.replyTo.value};
 const root=document.createElement('div');root.innerHTML=originTaskComments(task);
 section.replaceWith(root.firstElementChild);
 const next=$('#originCommentForm');for(const [name,value]of Object.entries(draft))next.elements[name].value=value;
 setOriginReplyContext(next,draft.replyTo);
 const more=$('#originTaskComments .origin-comment-more');if(more)more.open=expanded;
 const count=$('.origin-reader-nav [data-value="originTaskComments"] small');if(count)count.textContent=String(originCommentsFor(task).length);
 if(anchor){
   const candidates=[...$('#originTaskComments').querySelectorAll('button,input,select,textarea')];
   const target=candidates.find(el=>anchor.action?el.dataset.action===anchor.action&&el.dataset.value===anchor.comment&&el.dataset.emoji===anchor.emoji:anchor.name&&el.name===anchor.name);
   if(target){target.focus({preventScroll:true});if(anchor.start!=null)try{target.setSelectionRange(anchor.start,anchor.end)}catch{};const body=$('#sheet .sheet-body');if(body)body.scrollTop+=target.getBoundingClientRect().top-anchor.top;}
 }
}
// Connection transitions update controls in place, without replacing IME or drafts.
function syncOriginSharedControls(){
 if(!panelOpen||panelMode!=='detail'||panelKind!=='tasks')return;
 const online=snapshot.connectionMode==='remote-online';
 // Follow fresh revisions before typing; an existing draft keeps its conflict base.
 const composer=$('#originCommentForm'),current=findItem('tasks',panelId);
 if(composer&&current&&!composer.elements.text.value.trim())composer.dataset.revision=String(current.revision);
 $('#sheet').querySelectorAll('[data-action="comment-reaction"],[data-action="duplicate-merge"]').forEach(button=>{button.disabled=!online;});
 const status=$('#originTaskComments .origin-comment-connect');if(status){status.hidden=online;status.textContent=snapshot.connectionMode==='local-only'?'リアクションは共同編集をONにすると使えます。':'接続を確認しています。リアクションは接続が戻ると使えます。';}
}
async function submitOriginComment(form){
 if(busy||!form.reportValidity())return;
 const fd=new FormData(form),text=String(fd.get('text')||'').trim();if(!text)return;
 form.inert=true;
 const replyTo=String(fd.get('replyTo')||'');
 const ok=await send({type:replyTo?'comment.reply':'task.comment',commentId:replyTo,id:form.dataset.id,revision:Number(form.dataset.revision),ownerRoom:form.dataset.ownerRoom,ownerUser:form.dataset.ownerUser,text,commentType:String(fd.get('commentType'))},'コメントを追加しました');
 if(!form.isConnected)return;
 form.inert=false;
 if(ok){
   const scroll=$('#sheet .sheet-body')?.scrollTop||0;
   const container=document.createElement('div');
   container.innerHTML=originTaskComments(findItem('tasks',form.dataset.id));
   form.closest('.origin-comments').replaceWith(container.firstElementChild);
   $('#originCommentForm [name="text"]')?.focus({preventScroll:true});
   const body=$('#sheet .sheet-body');if(body)body.scrollTop=scroll;
 }else{
   const error=form.querySelector('[role="alert"]');error.hidden=false;error.textContent='追加できませんでした。入力は保持しています。他端末で更新された場合は、入力をコピーして詳細を開き直してください。';
 }
}
function originRecurrenceSummary(t){
 const r=t.recurrenceRule||{},labels={daily:'日ごと',weekly:'週ごと',monthlyDay:'か月ごと',monthlyNth:'か月ごと',monthEnd:'か月ごとの月末',lastWeekday:'か月ごとの最終平日',yearly:'年ごと'};
 const cadence=t.recurrence==='weekdays'?'平日のみ':t.recurrence==='dates'?'指定日 '+(r.selectedDates||[]).length+'件':String(r.interval||1)+(labels[t.recurrence]||'');
 const detail=t.recurrence==='weekly'?(r.weekdays||[]).map(x=>days[x]).join('・')+'曜日':t.recurrence==='monthlyDay'?String(r.monthDay)+'日':t.recurrence==='monthlyNth'?(r.nth==='last'?'最終':'第'+r.nth)+days[r.weekday]+'曜日':'';
 const end=r.endMode==='count'?'自動作成 '+r.count+'件まで':r.endMode==='date'?r.endDate+'まで':r.endMode==='dates'?'':'終了期限なし';
 return [cadence,detail,end].filter(Boolean).join(' · ');
}
function taskPanel(t){
 const items=t.checklist||[];
 const done=items.filter(x=>x.done).length;
 const pct=items.length?Math.round(done/items.length*100):0;
 const history=(t.history||[]).slice().reverse();
 const related=data.events.filter(e=>e.relatedTaskId===t.id);
 // Ended appointments are historical; in-progress appointments remain upcoming.
 const eventStart=e=>{const at=Date.parse(e.startAt);return Number.isFinite(at)?at:0};
 const eventEnd=e=>{const at=Date.parse(e.endAt);return Number.isFinite(at)?at:eventStart(e)};
 const now=Date.now();
 const future=related.filter(e=>eventEnd(e)>=now).sort((a,b)=>eventStart(a)-eventStart(b)||String(a.id).localeCompare(String(b.id)));
 const past=related.filter(e=>eventEnd(e)<now).sort((a,b)=>eventStart(b)-eventStart(a)||String(a.id).localeCompare(String(b.id)));
 const showPastInline=!future.length&&past.length<=3;
 const relatedEventLink=e=>`<div class="origin-related-entry"><button type="button" class="origin-related-link" data-action="related-open" data-kind="events" data-id="${esc(e.id)}" aria-label="関連予定「${esc(e.title)}」の詳細を開く">
 ${icon('calendar',16)}<span><strong>${esc(e.title)}</strong><small>${esc(dateLabel(e.date))}${e.time?' · '+esc(e.time):''}</small></span>${icon('right',15)}</button>
 <button type="button" class="origin-related-edit" data-action="related-event-menu" data-id="${esc(e.id)}" aria-label="関連予定「${esc(e.title)}」の操作" aria-expanded="false" aria-controls="originRelatedMenu-${esc(e.id)}">${icon('more',15)}<span>操作</span></button>
 <div class="origin-related-entry-actions" id="originRelatedMenu-${esc(e.id)}" role="group" aria-label="関連予定「${esc(e.title)}」の操作メニュー" hidden>
  <button type="button" data-action="related-event-edit" data-id="${esc(e.id)}">予定を編集</button>
  <button type="button" data-action="related-event-manage" data-id="${esc(e.id)}">紐付けを変更</button>
  <button type="button" data-action="related-event-unlink" data-id="${esc(e.id)}">関連を解除</button>
 </div></div>`;
 const formatHistory=events=>events.map(x=>`<li>${esc(x.text)}<small>${esc(x.author)} · ${x.createdAt?esc(new Date(x.createdAt).toLocaleString('ja-JP')):''}</small></li>`).join('');
 const due=t.due?dateLabel(t.due)+(t.dueTime?' '+t.dueTime:''):'期限なし';
 const count=history.length,commentCount=originCommentsFor(t).length;
 return `<div class="origin-task-detail">
 <nav class="origin-reader-nav" aria-label="タスク詳細の目次"><button type="button" data-action="detail-jump" data-value="originTaskOverview" aria-current="location">概要</button>${t.desc||items.length?'<button type="button" data-action="detail-jump" data-value="originTaskWork">作業内容</button>':''}<button type="button" data-action="detail-jump" data-value="originTaskComments">コメント<small>${commentCount}</small></button><button type="button" data-action="detail-jump" data-value="originTaskLinks">関連予定</button>${window.WorkBoardWorkflowV152?'<button type="button" data-action="detail-jump" data-value="originWorkflow">前提・設定</button>':''}</nav>
 <div class="record-meta">${badge(t)}<span class="tag">${esc(t.priority||'中')}優先</span><span class="tag">${esc(t.category||'分類なし')}</span></div>
 <section class="origin-task-overview" id="originTaskOverview" aria-label="タスクの要点">
 <dl class="detail-list origin-task-facts"><div class="origin-detail-main-fact ${t.due&&!t.completed&&t.due<base?'is-overdue':t.due?'':'is-undated'}"><dt>期限日・時刻</dt><dd>${esc(due)}</dd></div>
 <div><dt>担当者</dt><dd>${esc(t.assignee||'未設定')}</dd></div>
 <div><dt>依頼者</dt><dd>${esc(t.requester||'未設定')}</dd></div>
 <div><dt>状態</dt><dd>${esc(t.status||'未設定')}</dd></div>${t.startDate?`<div><dt>開始日・予約</dt><dd>${esc(dateLabel(t.startDate))}</dd></div>`:''}${t.recurrence&&t.recurrence!=='none'?`<div class="origin-recurrence-fact"><dt>繰り返し</dt><dd>${esc(originRecurrenceSummary(t))}</dd></div>`:''}</dl>
 ${items.length?`<div class="origin-task-check-progress"><div class="origin-progress-head"><strong>作業項目の進捗</strong><b>${pct}%</b></div><div class="origin-progress"><i style="width:${pct}%"></i></div><small>${done} / ${items.length} 完了</small></div>`:''}
 </section>
 ${t.desc?`<section class="origin-task-section origin-detail-section" id="originTaskWork"><h3>説明</h3><p class="record-description">${esc(t.desc)}</p></section>`:''}
 ${items.length?`<section class="origin-task-section" ${!t.desc?'id="originTaskWork"':''}><h3>作業項目 <small>${done}/${items.length}</small></h3>${items.map((x,i)=>`<label class="origin-task-check"><input data-action="task-check" data-id="${esc(t.id)}" data-index="${i}" data-revision="${t.revision}" type="checkbox" ${x.done?'checked':''}/><span class="${x.done?'is-done':''}">${esc(x.text)}</span></label>`).join('')}</section>`:''}
 ${t.tags?.length?`<section class="origin-task-section"><h3>タグ</h3><div class="record-meta">${t.tags.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div></section>`:''}
 ${originTaskComments(t)}
 <section class="origin-task-section origin-task-related-section" id="originTaskLinks">
 <div class="origin-task-related-head"><h3>関連する予定 <small>${related.length}件</small></h3>
 <button type="button" class="secondary-button origin-task-schedule-add" data-action="task-schedule-new" data-id="${esc(t.id)}" aria-label="このタスクに関連する予定を作成">${icon('plus',14)} 予定を作成</button></div>
 ${future.length?`<div class="origin-related-group-label"><strong>これからの予定</strong><small>${future.length}件</small></div>
 <div class="origin-task-related origin-related-future-group">${future.slice(0,3).map(relatedEventLink).join('')}</div>
 ${future.length>3?`<details class="origin-related-more"><summary>今後の予定をさらに${future.length-3}件表示</summary><div class="origin-task-related origin-related-future-group">${future.slice(3).map(relatedEventLink).join('')}</div></details>`:''}`:
 related.length?'<p class="origin-detail-empty">これからの予定はありません。</p>':'<p class="origin-detail-empty">関連する予定はまだありません。</p>'}
 ${past.length?`<div class="origin-related-group-label"><strong>過去の予定</strong><small>${past.length}件</small></div>
 ${showPastInline?`<div class="origin-task-related origin-related-history-group">${past.map(relatedEventLink).join('')}</div>`:
 `<details class="origin-related-past"><summary>過去の予定 ${past.length}件を表示</summary><div class="origin-task-related origin-related-history-group">${past.map(relatedEventLink).join('')}</div></details>`}`:''}
 </section>
 ${count?`<section class="origin-task-section origin-task-audit"><h3>最近の更新 <small>${count}件</small></h3><ol class="origin-task-history">${formatHistory(history.slice(0,3))}</ol>${count>3?`<details class="origin-task-history-more"><summary>以前の履歴 ${count-3}件を表示</summary><ol class="origin-task-history">${formatHistory(history.slice(3))}</ol></details>`:''}</section>`:''}
 ${originWorkflowPanel(t)}
 <p class="origin-task-last-updated">最終更新：${t.updatedAt?esc(new Date(t.updatedAt).toLocaleString('ja-JP')):'未記録'}</p>
 </div>`;
}
async function taskCheckToggle(el){
 const t=findItem('tasks',el.dataset.id),index=Number(el.dataset.index);
 if(busy){el.checked=!el.checked;notify('保存中です。処理完了後に操作してください。');return;}
 if(!t||!t.checklist[index]||Number(t.revision)!==Number(el.dataset.revision)){notify('更新競合があります。最新の内容を開き直してください。');el.checked=!el.checked;return;}
 const states=t.checklist.map((x,i)=>i===index?el.checked:Boolean(x.done)),scroll=$('#sheet .sheet-body')?.scrollTop||0;
 const ok=await send({type:'task.update',id:t.id,revision:Number(t.revision),ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser,
 title:t.title,assignee:t.assignee==='自分'?snapshot.currentUser:t.assignee,status:t.status,priority:t.priority,category:t.category,
 dueDate:t.due,dueTime:t.due?t.dueTime:'',requester:t.requester,description:t.desc,tags:t.tags.join(','),
 checklist:t.checklist.map(x=>x.text).join('\n'),checklistDone:states,pinned:Boolean(t.pinned)},'チェックリストを更新しました');
 if(ok&&panelOpen&&panelKind==='tasks'&&panelMode==='detail'&&panelId===t.id){panelShow('tasks',t.id);const body=$('#sheet .sheet-body');if(body)body.scrollTop=scroll;$('#sheet [data-action="task-check"][data-index="'+index+'"]')?.focus({preventScroll:true});}
 else if(!ok)el.checked=!el.checked;
}

function badge(t){return t.status==='完了'?'<span class="tag done">完了</span>':taskTag(t)}
function sheetFrame(kicker,title,content,footer){
 const reading=panelMode==='detail'?`<div class="origin-detail-reading" data-kind="${esc(panelKind)}">${content}</div>`:content;
 return `<div class="sheet-head"><div><small>${esc(kicker)}</small><h2 id="panelHeading" title="${esc(title)}">${esc(title)}</h2></div><button class="sheet-close" type="button" data-action="close" aria-label="閉じる">${icon('close',20)}</button></div><div class="sheet-body">${reading}</div><div class="sheet-foot">${panelMode==='edit'?'<p id="originDraftState" class="origin-draft-state" role="status" aria-live="polite">変更はありません</p>':''}${footer}</div>`}
let panelMode='detail', panelKind='', panelId='', initialFormSnapshot='',panelReturnScrollY=0,panelReturnSearch=null,panelReturnAnchor=null;
// Keeps the specific global search row and viewport offset while its detail is open.
let scheduleGlobalReturn=null;
let scheduleGlobalResultIds=[];
let scheduleWeekResultIds=[];
const ORIGIN_MOBILE_DAY_PREVIEW=4;
const scheduleExpandedDays=new Set();
let calendarRenderedMobile=window.innerWidth<=770;
let detailSequence=null;
// Linked task/event browsing is local to this open inspector, never persisted.
let detailTrail=[];
// Transient return point for a task editor opened from its detail.
let originDetailEditReturn=null;
// Local context for returning from a task-initiated schedule create or edit.
let originTaskScheduleSource=null;
let originEditorInitialHeight=0;
// Build a lightweight detail sequence from matching IDs, not mounted DOM rows.
// Grouped tasks use the same order as the board and omit deliberately collapsed groups.
function originPagedDetailIds(kind){
 if(kind==='memos'&&view==='notes')return originVisibleMemos().map(m=>m.id);
 if(kind==='todos'&&view==='todos'){
   const ids=originVisiblePendingTodos().map(todo=>todo.id);
   if(todoCompletedOpen)ids.push(...originVisibleCompletedTodos().map(todo=>todo.id));
   return ids;
 }
 if(kind!=='tasks'||view!=='tasks')return null;
 const groups={};
 for(const task of taskVisible()){
   const name=originTaskGroupName(task);
   if(taskCollapsedGroups.has(taskGrouping+'|'+name))continue;
   (groups[name]??=[]).push(task.id);
 }
 return Object.values(groups).flat();
}
// Global search and small dashboard lists still follow their actually visible cards.
function captureDetailSequence(kind,id,trigger){
 // A global result's pager follows every filtered match, not weekly cards or the first 30.
 const globalRow=kind==='events'&&view==='calendar'&&scheduleSearchScope==='all'
   ?trigger?.closest('.origin-schedule-global-item'):null;
 if(globalRow){
   const ids=scheduleGlobalResultIds.filter(candidate=>findItem(kind,candidate));
   if(id&&!ids.includes(id))ids.push(id);
   detailSequence={kind,view,ids};
   return;
 }
 if(kind==='events'&&view==='calendar'&&scheduleView==='week'&&trigger?.closest('.mobile-agenda,.week-board')){
   const ids=scheduleWeekResultIds.filter(candidate=>findItem(kind,candidate));
   if(id&&!ids.includes(id))ids.push(id);
   detailSequence={kind,view,ids};
   return;
 }
 const container=trigger?.closest('#workspace')||trigger?.closest('#searchResults');
 const ids=[],seen=new Set();
 const virtualIds=container?.id==='workspace'&&trigger?.dataset.action==='open'
   ?originPagedDetailIds(kind):null;
 if(virtualIds!==null){
   for(const candidate of virtualIds){
     if(!candidate||seen.has(candidate)||!findItem(kind,candidate))continue;
     seen.add(candidate);ids.push(candidate);
   }
 }else{
   for(const button of container?.querySelectorAll('[data-kind][data-id][data-action]')||[]){
     if(!['open','search-open'].includes(button.dataset.action)||button.dataset.kind!==kind)continue;
     const candidate=button.dataset.id;
     if(!candidate||seen.has(candidate)||!findItem(kind,candidate)||!button.getClientRects().length)continue;
     seen.add(candidate);ids.push(candidate);
   }
 }
 if(id&&!seen.has(id))ids.push(id);
 detailSequence={kind,view,ids};
}
function detailNeighbors(kind,id){
 const ids=detailSequence?.kind===kind&&detailSequence?.view===view
   ?detailSequence.ids.filter(candidate=>findItem(kind,candidate)):[];
 const index=ids.indexOf(id);
 return {ids,index,previous:index>0?ids[index-1]:'',next:index>=0&&index<ids.length-1?ids[index+1]:''};
}
function detailPager(kind,id){
 const {ids,index,previous,next}=detailNeighbors(kind,id);
 if(index<0||ids.length<2)return '';
 const label=singular[kind];
 return `<nav class="origin-detail-pager" aria-label="${label}を続けて確認。左右矢印キー・スマホでは左右スワイプでも移動できます"><span class="origin-detail-position">${index+1} / ${ids.length}件</span><div class="origin-detail-controls"><button type="button" data-action="detail-prev" ${previous?'':'disabled'} aria-label="前の${label}を表示">${icon('left',15)} 前へ</button><button type="button" data-action="detail-next" ${next?'':'disabled'} aria-label="次の${label}を表示">次へ ${icon('right',15)}</button></div></nav>`;
}
// Capture a visible record instead of relying only on an absolute scroll offset.
// A saved edit can reorder notes or tasks, and pagination can hide that record.
function originReturnCard(kind,id){
 if(!id)return null;
 const selector=kind==='tasks'
  ?'.origin-task-collection .item-name[data-action="open"][data-kind="tasks"]'
  :kind==='memos'?'.memo-grid .memo-card[data-action="open"][data-kind="memos"]'
  :kind==='todos'?'.origin-todo-main .todo-text[data-action="open"][data-kind="todos"]'
  :kind==='events'?
    '.mobile-agenda .agenda-entry[data-action="open"][data-kind="events"],.week-board .schedule-event[data-action="open"][data-kind="events"],.origin-day-entry[data-action="open"][data-kind="events"],.origin-agenda-entry[data-action="open"][data-kind="events"]':'';
 if(!selector)return null;
 return Array.from($('#workspace').querySelectorAll(selector))
  .find(button=>button.dataset.id===id&&button.getClientRects().length)||null;
}
function originReturnRow(kind,card){
 if(!card)return null;
 return kind==='tasks'?card.closest('.item-row')
  :kind==='todos'?card.closest('.todo-entry')
  :kind==='memos'?card.closest('.origin-memo-shell')
  :card;
}
function captureOriginReturnAnchor(kind,id,trigger){
 if(!((view==='tasks'&&kind==='tasks')||(view==='notes'&&kind==='memos')
   ||(view==='todos'&&kind==='todos')||(view==='calendar'&&kind==='events')))return null;
 const card=originReturnCard(kind,id);
 if(!card||!trigger)return null;
 const row=originReturnRow(kind,card);
 const sameRow=Boolean(row&&row===originReturnRow(kind,trigger));
 if(!sameRow&&!card.contains(trigger)&&card!==trigger)return null;
 return row?{view,kind,id,top:row.getBoundingClientRect().top,
   action:trigger.dataset.action==='list-quick-edit'?'list-quick-edit':'open'}:null;
}
// Find a nearby *still matching* result in the list order captured on opening
// the inspector. Never reset filters or choose an unrelated record.
function originAdjacentReturnIds(kind,id,currentIds){
 if(detailSequence?.kind!==kind||detailSequence.view!==view)return [];
 const ids=detailSequence.ids,index=ids.indexOf(id);
 if(index<0)return [];
 const allowed=new Set(currentIds);
 return ids.slice(index+1).concat(ids.slice(0,index).reverse())
   .filter(candidate=>allowed.has(candidate));
}
function revealOriginAdjacentReturnCard(kind,id){
 const current=kind==='tasks'&&view==='tasks'?taskVisible().map(t=>t.id)
  :kind==='memos'&&view==='notes'?originVisibleMemos().map(m=>m.id)
  :kind==='events'&&view==='calendar'?scheduleWeekResultIds:[];
 for(const candidate of originAdjacentReturnIds(kind,id,current)){
   const row=revealOriginReturnCard(kind,candidate);
   if(row)return row;
 }
 return null;
}
function revealOriginReturnCard(kind,id){
 let target=originReturnCard(kind,id);
 if(target||!id)return target;
 if(view==='tasks'&&kind==='tasks'){
  const visible=taskVisible(),item=visible.find(t=>t.id===id);
  if(!item)return null;
  const name=originTaskGroupName(item),groupKey=taskGrouping+'|'+name;
  const index=visible.filter(t=>originTaskGroupName(t)===name).findIndex(t=>t.id===id);
  const previous=taskVisibleLimits.get(groupKey);
  const limit=previous===Infinity?Infinity:Math.max(TASK_RENDER_BATCH,previous||TASK_RENDER_BATCH);
  let changed=taskCollapsedGroups.delete(groupKey);
  if(index>=limit){
   taskVisibleLimits.set(groupKey,Math.ceil((index+1)/TASK_RENDER_BATCH)*TASK_RENDER_BATCH);
   changed=true;
  }
  if(changed)render();
 }else if(view==='todos'&&kind==='todos'){
   const completed=originVisibleCompletedTodos(),doneIndex=completed.findIndex(todo=>todo.id===id);
   if(doneIndex>=0){
     let changed=!todoCompletedOpen;
     todoCompletedOpen=true;
     if(doneIndex>=todoCompletedLimit){
       todoCompletedLimit=Math.ceil((doneIndex+1)/TODO_RENDER_BATCH)*TODO_RENDER_BATCH;
       changed=true;
     }
     if(changed)render();
   }else{
     const index=originVisiblePendingTodos().findIndex(todo=>todo.id===id);
     if(index<0)return null;
     if(index>=todoPendingLimit){
       todoPendingLimit=Math.ceil((index+1)/TODO_RENDER_BATCH)*TODO_RENDER_BATCH;
       render();
     }
   }
 }else if(view==='notes'&&kind==='memos'){
  const index=originVisibleMemos().findIndex(m=>m.id===id);
  if(index<0)return null;
  if(index>=memoVisibleLimit){
   memoVisibleLimit=Math.ceil((index+1)/MEMO_RENDER_BATCH)*MEMO_RENDER_BATCH;
   render();
  }
 }else if(view==='calendar'&&kind==='events'&&scheduleView==='week'
   &&calendarRenderedMobile&&scheduleWeekResultIds.includes(id)){
   // The next matching appointment may be beyond the four-card day preview.
   const event=data.events.find(item=>item.id===id);
   if(event&&!scheduleExpandedDays.has(event.date)){
     scheduleExpandedDays.add(event.date);
     render();
   }
 }
 return originReturnCard(kind,id);
}
function restoreDetailFocus(kind,id){
 const workspace=$('#workspace');
 const visible=Array.from(workspace?.querySelectorAll('[data-action="open"][data-kind][data-id]')||[])
   .filter(button=>button.dataset.kind===kind&&button.getClientRects().length);
 let target=visible.find(button=>button.dataset.id===id);
 // If the item left this filter or was removed, return to a nearby visible row.
 if(!target&&detailSequence?.kind===kind&&detailSequence?.view===view){
   const visibleById=new Map(visible.map(button=>[button.dataset.id,button]));
   target=originAdjacentReturnIds(kind,id,visibleById.keys())
     .map(candidate=>visibleById.get(candidate))
     .find(Boolean);
 }
 const navigation=window.innerWidth<=770?$('#mobileNav'):$('#desktopNav');
 (target||visible[0]||navigation?.querySelector('[data-route="'+view+'"]'))?.focus({preventScroll:true});
}
function restorePanelReturnPosition(kind,id){
 // Restore a week item even if it is beyond the four-card mobile preview.
 if(kind==='events'&&view==='calendar'&&scheduleView==='week'&&scheduleSearchScope==='week'&&calendarRenderedMobile
   &&scheduleWeekResultIds.includes(id)
   &&!Array.from($('#workspace .mobile-agenda')?.querySelectorAll('.agenda-entry[data-id]')||[])
      .some(button=>button.dataset.id===id)){
   const event=data.events.find(item=>item.id===id);
   if(event){scheduleExpandedDays.add(event.date);render();}
 }
 // Global search retains its own query/facet/scroll restoration.
 const search=$('#originSearchInput');
 const anchor=panelReturnAnchor;
 let aligned=false;
 if(scheduleGlobalReturn&&view==='calendar'&&scheduleSearchScope==='all'){
   const saved=scheduleGlobalReturn;
   // After a deletion or filter change, continue with an adjacent matching
   // result instead of unexpectedly jumping to the first search hit.
   const available=scheduleGlobalResultIds;
   const resultId=[saved.id,...originAdjacentReturnIds('events',saved.id,available)]
     .find(candidate=>available.includes(candidate))||'';
   const resultIndex=available.indexOf(resultId);
   if(resultIndex>=scheduleSearchLimit){
     scheduleSearchLimit=Math.ceil((resultIndex+1)/30)*30;
     render();
   }
   const row=Array.from($('#workspace').querySelectorAll('.origin-schedule-global-item'))
     .find(element=>element.dataset.id===resultId);
   const target=row?.querySelector('[data-action="open"][data-kind="events"]')
     ||(window.innerWidth<=770?$('#workspace [data-action="schedule-filter-toggle"]'):$('#originScheduleSearch'));
   target?.focus({preventScroll:true});
   const maximum=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
   const destination=row?window.scrollY+row.getBoundingClientRect().top-saved.top:panelReturnScrollY;
   window.scrollTo({top:Math.max(0,Math.min(maximum,destination)),behavior:'instant'});
   if(!row&&target?.getClientRects().length){
     // The final filtered appointment is gone: don't leave the focused filter
     // off-screen at the old result's scroll position.
     target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
   }
   aligned=true;
 }else if(panelReturnSearch&&search?.value.trim()){
   renderSearch(search.value);
   const hits=Array.from($('#searchResults').querySelectorAll('.search-hit'));
   const target=hits.find(hit=>hit.dataset.kind===kind&&hit.dataset.id===id)
     ||hits.find(hit=>hit.dataset.kind===panelReturnSearch.kind
       &&hit.dataset.id===panelReturnSearch.id)
     ||hits[0];
   if(target)focusSearchResult(target);
   else search.focus({preventScroll:true});
 }else if(anchor&&anchor.view===view&&anchor.kind===kind){
   const target=revealOriginReturnCard(kind,id)||revealOriginAdjacentReturnCard(kind,id);
   if(target){
     const row=originReturnRow(kind,target);
     const quick=anchor.action==='list-quick-edit'
       ?row?.querySelector('[data-action="list-quick-edit"]'):null;
     (quick||target).focus({preventScroll:true});
     const top=row?.getBoundingClientRect().top??target.getBoundingClientRect().top;
     const maximum=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
     const destination=Math.max(0,Math.min(maximum,window.scrollY+top-anchor.top));
     window.scrollTo({top:destination,behavior:'instant'});
     aligned=true;
   }else{
     // When the final matching record disappears, focus a useful filter/input.
     const fallback=kind==='tasks'?$('#originTaskQuery')
       :kind==='memos'?$('#originMemoQuery')
       :kind==='events'?$('#workspace [data-action="schedule-filter-toggle"]')
       :$('#workspace [data-form="quick-todo"] [name="title"]');
     if(fallback?.getClientRects().length){
       fallback.focus({preventScroll:true});
       fallback.scrollIntoView({block:'nearest',behavior:'instant'});
       aligned=true;
     }else restoreDetailFocus(kind,id);
   }
 }else restoreDetailFocus(kind,id);
 if(!aligned){
   const maximum=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
   window.scrollTo({top:Math.min(panelReturnScrollY,maximum),behavior:'instant'});
 }
 panelReturnAnchor=null;panelReturnSearch=null;scheduleGlobalReturn=null;
}
function navigateDetail(direction){
 if(!panelOpen||panelMode!=='detail')return;
 const neighbor=detailNeighbors(panelKind,panelId);
 const nextId=direction<0?neighbor.previous:neighbor.next;
 if(!nextId)return;
 if(scheduleGlobalReturn&&panelKind==='events'&&view==='calendar'&&scheduleSearchScope==='all')
   scheduleGlobalReturn.id=nextId;
 panelShow(panelKind,nextId,false);
 // Retain the browse control after swapping details so the next item is one click away.
 const preferred=$('#sheet [data-action="'+(direction<0?'detail-prev':'detail-next')+'"]');
 const fallback=$('#sheet [data-action="'+(direction<0?'detail-next':'detail-prev')+'"]');
 (preferred&&!preferred.disabled?preferred:fallback)?.focus({preventScroll:true});
}
// A related detail is a nested inspector, not a new workspace or search result.
function originRelatedBackBar(){
 const previous=detailTrail[detailTrail.length-1];
 if(!previous)return '';
 const source=findItem(previous.kind,previous.id);
 const label=source?.title||singular[previous.kind]||'前の項目';
 return `<nav class="origin-related-back" aria-label="関連元の詳細へ戻る"><button type="button" data-action="related-back" aria-label="関連元「${esc(label)}」の詳細へ戻る">${icon('left',16)} <span>${esc(label)}に戻る</span></button></nav>`;
}
function openOriginRelatedDetail(kind,id){
 if(!panelOpen||panelMode!=='detail'||!id||!['tasks','events'].includes(kind))return;
 const target=findItem(kind,id);
 if(!target){notify('関連情報が見つかりません。内容を更新してから開き直してください。');return}
 const linked=panelKind==='tasks'&&kind==='events'&&target.relatedTaskId===panelId
  ||panelKind==='events'&&kind==='tasks'&&findItem('events',panelId)?.relatedTaskId===id;
 if(!linked)return notify('関連付けが変更されました。詳細を開き直してください。');
 if(detailTrail.length>=8)return notify('関連情報を戻りながら確認してください。');
 const previous={kind:panelKind,id:panelId,
  sequence:detailSequence?{...detailSequence,ids:[...detailSequence.ids]}:null,
  scrollTop:$('#sheet .sheet-body')?.scrollTop||0,
  relatedExpanded:Boolean($('#sheet .origin-related-more')?.open),
  relatedPastExpanded:Boolean($('#sheet .origin-related-past')?.open)};
 detailTrail.push(previous);
 detailSequence=null;
 panelShow(kind,id,false);
}
function backOriginRelatedDetail(){
 if(!panelOpen||panelMode!=='detail'||!detailTrail.length)return;
 const from={kind:panelKind,id:panelId};
 while(detailTrail.length){
  const previous=detailTrail.pop();
  if(!findItem(previous.kind,previous.id))continue;
  detailSequence=previous.sequence;
  panelShow(previous.kind,previous.id,false);
  const body=$('#sheet .sheet-body');
  // Keep the source link reachable when it was inside an expanded list.
  const relatedMore=$('#sheet .origin-related-more');
  if(relatedMore&&previous.relatedExpanded)relatedMore.open=true;
  const pastMore=$('#sheet .origin-related-past');
  if(pastMore&&previous.relatedPastExpanded)pastMore.open=true;
  if(body)body.scrollTop=previous.scrollTop;
  const button=Array.from($('#sheet').querySelectorAll('[data-action="related-open"]'))
   .find(x=>x.dataset.kind===from.kind&&x.dataset.id===from.id);
  (button||$('#sheet [data-action="related-back"]')||$('#sheet .sheet-close'))?.focus({preventScroll:true});
  return;
 }
 notify('関連元の項目が見つかりません。');
 closePanel();
}
// Capture transient UI state without changing canonical schedule or task data.
function captureOriginTaskScheduleSource(taskId,scheduleId=''){
 return {taskId,scheduleId,
  scrollTop:$('#sheet .sheet-body')?.scrollTop||0,
  relatedExpanded:Boolean($('#sheet .origin-related-more')?.open),
  relatedPastExpanded:Boolean($('#sheet .origin-related-past')?.open),
  relatedEventIds:data.events.filter(event=>event.relatedTaskId===taskId).map(event=>event.id)};
}
// Keep Origin inspector history and list/search return position intact.
function restoreOriginTaskFromSchedule(saved=false){
 const source=originTaskScheduleSource;if(!source)return false;
 originTaskScheduleSource=null;
 const listScroll=panelReturnScrollY,trail=detailTrail.slice();
 const sequence=detailSequence?{...detailSequence,ids:[...detailSequence.ids]}:null;
 closePanel(true,false);
 if(!findItem('tasks',source.taskId)){
   detailTrail=[];detailSequence=null;
   restorePanelReturnPosition('tasks',source.taskId);
   return false;
 }
 detailTrail=trail;detailSequence=sequence;
 panelShow('tasks',source.taskId,false);panelReturnScrollY=listScroll;
 const body=$('#sheet .sheet-body'),expanded=$('#sheet .origin-related-more');
 if(expanded&&source.relatedExpanded)expanded.open=true;
 const pastExpanded=$('#sheet .origin-related-past');
 if(pastExpanded&&source.relatedPastExpanded)pastExpanded.open=true;
 if(saved){
   const targetId=source.scheduleId||data.events.find(event=>
     event.relatedTaskId===source.taskId&&!source.relatedEventIds.includes(event.id))?.id;
   const link=Array.from($('#sheet').querySelectorAll('[data-action="related-open"][data-kind="events"]'))
     .find(button=>button.dataset.id===targetId);
   if(link){
     const details=link.closest('details');if(details)details.open=true;
     link.focus({preventScroll:true});link.scrollIntoView({block:'nearest'});return true;
   }
 }
 if(body)body.scrollTop=source.scrollTop;
 $('#sheet [data-action="task-schedule-new"]')?.focus({preventScroll:true});
 return true;
}
function originPanelFooter(kind,id,editing,item){
 const safeId=esc(id||'');
 const taskDetail=kind==='tasks'&&!editing;
 const main=editing
   ?`<button type="submit" class="primary-button" form="editForm">${id?'変更を保存':'登録する'}</button><button type="button" class="secondary-button" data-action="${originDetailEditReturn?.kind===kind&&originDetailEditReturn?.id===id?'origin-edit-back-detail':'close'}">${originDetailEditReturn?.kind===kind&&originDetailEditReturn?.id===id?'詳細に戻る':'キャンセル'}</button>`
   :taskDetail
   ?`<button type="button" class="primary-button" data-action="edit" data-kind="${kind}" data-id="${safeId}">${icon('edit',16)} 編集する</button><button type="button" class="secondary-button origin-task-primary-done" data-action="task-done" data-id="${safeId}">${item.completed?'未完了に戻す':'完了にする'}</button>`
   :`<button type="button" class="primary-button" data-action="edit" data-kind="${kind}" data-id="${safeId}">${icon('edit',16)} 編集する</button><button type="button" class="secondary-button" data-action="close">閉じる</button>`;
 let secondary='';
 if(!editing){
   if(kind==='tasks')secondary=`<button type="button" class="secondary-button" data-action="task-star" data-id="${safeId}" aria-pressed="${Boolean(item.favorite)}">${item.favorite?'★ お気に入り解除':'☆ お気に入り'}</button><button type="button" class="secondary-button" data-action="task-copy" data-id="${safeId}">複製して作成</button>`;
   if(kind==='tasks')secondary+=`<button type="button" class="secondary-button" data-action="task-knowledge" data-id="${safeId}">ナレッジ${item.knowledgeId?'を開く':'として残す'}</button>${item.completed?`<button type="button" class="secondary-button" data-action="task-archive" data-id="${safeId}" data-base="${esc(JSON.stringify(window.WorkBoardWorkflowV152?.archiveInfo(id)||null))}">アーカイブ</button>`:''}<button type="button" class="secondary-button" data-action="close">閉じる</button>`;
   if(kind==='todos'){
     const rows=data.todos.filter(t=>t.done===item.done),index=rows.findIndex(t=>t.id===id);
     secondary=`<button type="button" class="secondary-button" data-action="todo-toggle" data-id="${safeId}">${item.done?'未完了に戻す':'完了にする'}</button><button type="button" class="secondary-button" data-action="todo-move" data-id="${safeId}" data-value="up" ${index<=0?'disabled':''}>上へ移動</button><button type="button" class="secondary-button" data-action="todo-move" data-id="${safeId}" data-value="down" ${index>=rows.length-1?'disabled':''}>下へ移動</button>`;
   }
   if(kind==='memos')secondary=`<button type="button" class="secondary-button" data-action="memo-task" data-id="${safeId}">タスクにする</button>`;
   if(kind==='events')secondary+=`<button type="button" class="secondary-button" data-action="schedule-copy" data-id="${safeId}">複製して作成</button>`;
 }
 const dangerous=editing&&id
   ?`<div class="origin-sheet-danger"><button type="button" class="danger-button" data-action="delete" data-kind="${kind}" data-id="${safeId}">${icon('trash',14)} 削除する</button></div>`:'';
 const extras=secondary?(taskDetail
   ?`<details class="origin-task-more-actions"><summary>その他の操作</summary><div class="origin-sheet-secondary">${secondary}</div></details>`
   :`<div class="origin-sheet-secondary">${secondary}</div>`):'';
 return `<div class="origin-sheet-actions"><div class="origin-sheet-primary">${main}</div>${extras}${dangerous}</div>`;
}
function panelShow(kind,id,edit=false,seed={}){
 const obj=id?findItem(kind,id):null;if(id&&!obj)return;
 // Capture the detail reading state before switching to a task editor.
 const detailReturn=edit&&id&&panelOpen&&panelMode==='detail'
   &&panelKind===kind&&panelId===id&&['tasks','todos','events','memos'].includes(kind)?{
    kind,
    id,scrollTop:$('#sheet .sheet-body')?.scrollTop||0,
    workflowOpen:Boolean($('#sheet #originWorkflow')?.open),
    relatedExpanded:Boolean($('#sheet .origin-related-more')?.open),
    relatedPastExpanded:Boolean($('#sheet .origin-related-past')?.open),
    section:$('#sheet .origin-reader-nav [aria-current="location"]')?.dataset.value||''
   }:null;
 const replacing=panelOpen;
 if(replacing&&!closePanel(false,false))return;
 originDetailEditReturn=detailReturn;
 if(!replacing)panelReturnScrollY=window.scrollY;
 panelOpen=true;panelMode=edit?'edit':'detail';panelKind=kind;panelId=id||'';
 const freshObj=obj||{},v={...freshObj,...seed};
 if(edit){
 const fields=kind==='tasks'?`<div class="form-grid">${originTemplatePicker()}<label class="form-field full">件名<input name="title" maxlength="80" required value="${esc(v.title||'')}"/></label><label class="form-field">状態<select name="status">${snapshot.statuses.map(s=>`<option value="${esc(s)}" ${s===(v.status||'未着手')?'selected':''}>${esc(s)}</option>`).join('')}</select></label><label class="form-field">優先度<select name="priority">${['緊急','高','中','低'].map(s=>`<option value="${s}" ${s===(v.priority||'中')?'selected':''}>${s}</option>`).join('')}</select></label><label class="form-field full">説明<textarea name="desc" class="origin-task-description-input" maxlength="6000" placeholder="対応内容や補足事項">${esc(v.desc||'')}</textarea></label><label class="form-field">開始日・予約（任意）<input name="startDate" type="date" value="${esc(v.startDate||'')}"/></label><label class="form-field">期限日（任意）<input name="due" type="date" value="${esc(v.due||'')}"/></label><label class="form-field">期限時刻（任意）<input name="dueTime" type="time" value="${esc(v.dueTime||'')}"/></label><label class="form-field">担当者<select name="assignee">${[...new Set(['自分',...snapshot.assignees.filter(x=>x!==snapshot.currentUser),v.assignee])].filter(Boolean).map(s=>`<option value="${esc(s)}" ${s===(v.assignee||'自分')?'selected':''}>${esc(s)}</option>`).join('')}</select></label><label class="form-field">分類<select name="category">${snapshot.categories.map(s=>`<option value="${esc(s)}" ${s===(v.category||snapshot.categories[0])?'selected':''}>${esc(s)}</option>`).join('')}</select></label><details class="origin-task-optional" ${v.requester||(v.tags||[]).length||(v.checklist||[]).length||v.pinned?'open':''}><summary>追加情報 <small>依頼者・タグ・チェックリスト・固定</small><span class="origin-task-expand-cue" aria-hidden="true">${icon('chevron',14)}</span></summary><div class="origin-task-extra-grid"><label class="form-field">依頼者<input name="requester" maxlength="40" value="${esc(v.requester||'')}"/></label><label class="form-field">タグ<input name="tags" maxlength="80" value="${esc((v.tags||[]).join(', '))}"/></label><div class="form-field full"><strong>チェックリスト</strong><div id="originTaskChecks">${taskCheckboxRows(v)}</div><button type="button" class="secondary-button" data-action="task-check-add">＋ 項目を追加</button></div><label class="form-field full"><span><input type="checkbox" name="pinned" ${v.pinned?'checked':''}/>固定する</span></label></div></details>${originRecurrenceEditor(v)}<p id="originTaskError" class="origin-task-error" role="alert" hidden></p></div>`:
 kind==='templates'?originTemplateEditor(v):kind==='knowledge'?originKnowledgeEditor(v):
 kind==='todos'?`<div class="origin-todo-edit-fields"><label class="form-field">やること <span class="help">必須</span><input name="title" value="${esc(v.title||'')}" maxlength="${snapshot.todoTitleMaxLength}" required placeholder="何をしますか？"/></label><label class="form-field origin-todo-status-field"><span>状態</span><select name="done"><option value="false" ${!v.done?'selected':''}>未完了</option><option value="true" ${v.done?'selected':''}>完了</option></select></label><label class="form-field">補足メモ<textarea name="memo" maxlength="${snapshot.todoMemoMaxLength}" placeholder="必要な情報を記録（任意）">${esc(v.memo||'')}</textarea></label></div>`:
 kind==='events'?originScheduleEditor(v,id):
  `<div class="origin-memo-edit-fields"><label class="form-field">タイトル <span class="help">必須</span><input name="title" value="${esc(v.title||'')}" maxlength="80" required placeholder="メモのタイトル"/></label><fieldset class="form-field full"><legend>カードの色</legend><div class="origin-memo-palette">${memoColors.map(([k,label])=>`<label data-paper-color="${k}"><input type="radio" name="paperColor" value="${k}" ${memoColor(v.paperColor)===k?'checked':''}/><span class="origin-memo-swatch" aria-hidden="true"></span>${label}</label>`).join('')}</div></fieldset><label class="form-field">分類<select name="category">${Array.from(memoBridge?.categories||['その他']).map(s=>`<option value="${esc(s)}" ${s===(v.category||'その他')?'selected':''}>${esc(s)}</option>`).join('')}</select></label><label class="form-field">タグ<input name="tags" maxlength="80" value="${esc((v.tags||[]).join(', '))}" placeholder="カンマ区切りで入力"/></label><label class="form-field">内容<textarea name="body" maxlength="6000" required class="origin-memo-body-input" placeholder="ここに内容を記入">${esc(v.body||'')}</textarea></label><label class="form-field" style="flex-direction:row;align-items:center"><input style="width:auto;min-height:auto" type="checkbox" name="pinned" ${v.pinned?'checked':''}/>固定メモとして表示する</label></div>`;
 const f=`<form id="editForm" data-kind="${kind}" data-id="${esc(id||'')}"><p id="originEditorError" class="origin-editor-error" role="alert" hidden></p><div id="originSaveRecovery" class="origin-save-recovery" role="group" aria-label="保存失敗への対応" hidden><p id="originSaveRecoveryText"></p><div class="origin-save-recovery-actions"><button type="button" class="secondary-button" data-action="origin-copy-draft">入力内容をコピー</button><button type="button" class="secondary-button" data-action="origin-save-again" hidden>もう一度保存</button></div><textarea id="originDraftCopyFallback" readonly hidden aria-label="手動コピー用の入力内容"></textarea></div>${fields}</form>`;
 const footer=originPanelFooter(kind,id,true,v);
 $('#sheet').innerHTML=sheetFrame('EDIT · '+singular[kind],id?singular[kind]+'を編集':singular[kind]+'を新規作成',f,footer);
 originEditorInitialHeight=window.visualViewport?.height||window.innerHeight;
 if(kind==='events'||kind==='tasks'||kind==='memos'||kind==='todos'){
   const original=id?(kind==='events'?snapshot.schedules.find(x=>x.id===id):
     kind==='tasks'?snapshot.tasks.find(x=>x.id===id):
     kind==='memos'?memoItems.find(x=>x.id===id):snapshot.todos.find(x=>x.id===id)):null;
   const f=$('#editForm');
   f.dataset.revision=String(original?.revision??0);
   f.dataset.ownerRoom=String(snapshot.roomId);
   f.dataset.ownerUser=String(snapshot.currentUser);
 }
 syncOriginBatchFields($('#editForm'));syncOriginRecurrenceFields($('#editForm'));
 if(kind==='tasks')$('#editForm').dataset.startRevision=String(v.startRevision||0);
 if(kind==='knowledge'){const form=$('#editForm');form.dataset.revision=String(v.revision||0);form.dataset.taskId=v.taskId||'';form.dataset.taskRevision=String(v.taskRevision||0);form.dataset.ownerRoom=snapshot.roomId;form.dataset.ownerUser=snapshot.currentUser;}
 if(kind==='templates'){const form=$('#editForm');form.dataset.revision=String(snapshot.templateRevision||0);form.dataset.ownerRoom=snapshot.roomId;form.dataset.ownerUser=snapshot.currentUser;}
 initialFormSnapshot=formSnapshot($('#editForm'));updateOriginDraftState();
 }else{
 const t=obj;let body='';
 if(kind==='tasks'){body=taskPanel(t);}
 if(kind==='todos'){
  body=`<section class="origin-detail-summary origin-todo-overview" aria-label="ToDoの状態"><div class="record-meta">${t.done?'<span class="tag done">完了</span>':'<span class="tag">未完了</span>'}<span class="tag">個人ToDo</span></div></section>
  <section class="origin-detail-section"><h3 class="detail-subheading">補足メモ</h3>${t.memo?`<p class="record-description">${esc(t.memo)}</p>`:'<p class="origin-detail-empty">補足メモはありません。</p>'}</section>`;
 }
 if(kind==='events'){
  const linked=snapshot.tasks.find(x=>x.id===t.relatedTaskId);
  const linkedDue=linked?.dueDate
    ?'期限 '+humanDue(linked.dueDate)+(linked.dueTime?' '+linked.dueTime:'')
    :'期限なし';
  const linkedLate=Boolean(linked?.dueDate&&linked.dueDate<base&&linked.status!=='完了');
  const formatAt=value=>value?new Date(value).toLocaleString('ja-JP',{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'未設定';
  const sameDay=Boolean(t.startAt&&t.endAt&&String(t.startAt).slice(0,10)===String(t.endAt).slice(0,10));
  const endText=sameDay?new Date(t.endAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):formatAt(t.endAt);
  body=`<dl class="detail-list origin-schedule-facts origin-detail-summary" aria-label="予定の要点">
  <div class="origin-event-times origin-detail-main-fact"><dt>日時</dt><dd><time>${esc(formatAt(t.startAt))}</time><span aria-hidden="true"> → </span><time>${esc(endText)}</time></dd></div>
  <div><dt>担当者</dt><dd>${esc(t.assignee||'未設定')}</dd></div>
  <div><dt>分類</dt><dd>${esc(t.category||'未設定')}</dd></div>
  <div><dt>場所・方法</dt><dd>${esc(t.location||'指定なし')}</dd></div>
  ${t.relatedTaskId?`<div><dt>関連タスク</dt><dd>${linked
    ?`<button type="button" class="origin-related-link" data-action="related-open" data-kind="tasks" data-id="${esc(linked.id)}" aria-label="関連タスク「${esc(linked.title)}」の詳細を開く">${icon('tasks',16)}<span><strong>${esc(linked.title)}</strong><small>${esc(linked.status||'状態未設定')} · <span class="origin-linked-task-due ${linkedLate?'is-late':''}">${esc(linkedDue)}</span> · ${esc(linked.assignee||'担当未設定')}</small></span>${icon('right',15)}</button>`
    :'<span class="origin-related-missing">以前の関連タスク（現在は参照できません）</span>'}</dd></div>`:''}
  </dl>
  ${t.recurrenceSeriesId?'<p class="origin-schedule-note">繰り返し予定のこの1件です。編集画面から削除する範囲を選べます。</p>':''}
  ${t.desc?`<section class="origin-detail-section"><h3 class="detail-subheading">メモ</h3><p class="record-description">${esc(t.desc)}</p></section>`:''}`;
 }
 if(kind==='knowledge'){body=`<dl class="detail-list">${[['summary','概要'],['symptom','症状・背景'],['action','対応内容'],['checkpoint','確認事項']].map(([k,l])=>`<div><dt>${l}</dt><dd class="record-description">${esc(t[k]||'未記入')}</dd></div>`).join('')}</dl>`;}
 if(kind==='memos'){
  body=`<section class="origin-detail-summary origin-memo-summary" aria-label="メモの分類と状態"><div class="record-meta"><span class="tag">${esc(t.category||'その他')}</span>${t.pinned?`<span class="tag med">${icon('pin',12)} 固定</span>`:''}</div></section>
  ${t.tags?.length?`<div class="record-meta">${t.tags.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div>`:''}
  <section class="origin-detail-section origin-memo-document-section" aria-label="メモ本文"><article class="memo-document origin-memo-paper" data-paper-color="${memoColor(t.paperColor)}">${esc(t.body||'内容はありません。').replace(/\n/g,'<br>')}</article></section>
  <p class="quiet-small origin-memo-updated">内容更新：${t.updated?esc(new Date(t.updated).toLocaleString('ja-JP')):'未記録'}</p>`;
 }
 const footer=originPanelFooter(kind,id,false,t);
 $('#sheet').innerHTML=sheetFrame('DETAIL · '+singular[kind],t.title,detailPager(kind,id)+originRelatedBackBar()+body,footer);
 }
 $('#sheet').dataset.readerKind=edit?'':kind;
 $('#overlay').hidden=false;document.body.style.overflow='hidden';syncOriginEditorViewport();if(edit&&window.innerWidth>770)$('#editForm [name="title"]')?.focus();else $('#sheet .sheet-close')?.focus();
}
function formSnapshot(f){if(!f)return '';const fd=new FormData(f);return [...fd.entries()].map(([k,v])=>`${k}=${v}`).join('&')}

function syncOriginEditorViewport(){
 const sheet=$('#sheet');if(!sheet)return;
 if(!panelOpen||panelMode!=='edit'||window.innerWidth>770){
  sheet.style.removeProperty('--origin-visible-height');sheet.style.removeProperty('transform');
  delete sheet.dataset.originKeyboard;return;
 }
 const viewport=window.visualViewport,height=viewport?.height||window.innerHeight;
 sheet.style.setProperty('--origin-visible-height',Math.max(220,Math.round(height))+'px');
 sheet.style.transform=viewport?.offsetTop>0?'translateY('+Math.round(viewport.offsetTop)+'px)':'';
 const focused=mount.activeElement;
 const fieldFocused=Boolean(focused&&sheet.contains(focused)&&focused.matches('input,select,textarea'));
 sheet.dataset.originKeyboard=String(fieldFocused&&(window.innerHeight-height>110||originEditorInitialHeight-height>110));
 keepOriginEditorFieldVisible();
}
function keepOriginEditorFieldVisible(field=mount.activeElement){
 if(!panelOpen||panelMode!=='edit'||window.innerWidth>770)return;
 const body=$('#sheet .sheet-body');
 if(!body||!field||!body.contains(field)||!field.matches('input,select,textarea'))return;
 const viewport=body.getBoundingClientRect(),bounds=field.getBoundingClientRect();
 const top=viewport.top+12,bottom=viewport.bottom-22;
 // When a field is invalid, keep its inline explanation visible as well.
 const note=field.dataset.originFieldInvalid==='true'?body.querySelector('#originFieldError'):null;
 const visibleEnd=Math.max(bounds.bottom,note?.getBoundingClientRect().bottom||bounds.bottom);
 if(visibleEnd>bottom)body.scrollTop+=visibleEnd-bottom;
 const updated=field.getBoundingClientRect();
 if(updated.top<top)body.scrollTop-=top-updated.top;
}
function clearOriginFieldError(form){
 if(!form)return;
 const field=form.querySelector('[data-origin-field-invalid="true"]');
 if(field){
   field.removeAttribute('aria-invalid');
   delete field.dataset.originFieldInvalid;
   delete field.dataset.originErrorCode;
   const ids=(field.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!=='originFieldError');
   if(ids.length)field.setAttribute('aria-describedby',ids.join(' '));
   else field.removeAttribute('aria-describedby');
 }
 form.querySelector('#originFieldError')?.remove();
}

function reconcileOriginFieldError(form,changed){
 const field=form?.querySelector('[data-origin-field-invalid="true"]');
 if(!field||!changed)return;
 const code=field.dataset.originErrorCode||'field';
 if(code==='date-range'&&!['startAt','endAt'].includes(changed.name))return;
 if(code==='checklist-total'&&!['checkText','checkDone'].includes(changed.name))return;
 if(!['date-range','checklist-total'].includes(code)&&changed!==field)return;
 let resolved=false;
 if(code==='date-range'){
   const start=new Date(form.elements.namedItem('startAt')?.value||'');
   const end=new Date(form.elements.namedItem('endAt')?.value||'');
   resolved=Number.isFinite(start.getTime())&&Number.isFinite(end.getTime())&&end>start;
 }else if(code==='checklist-total'){
   const texts=[...form.querySelectorAll('.origin-checkrow [name="checkText"]')]
     .map(input=>input.value.trim()).filter(Boolean);
   resolved=texts.join('\n').length<=6000;
 }else{
   resolved=field.validity.valid&&(field.name!=='title'||Boolean(field.value.trim()));
 }
 if(!resolved)return;
 clearOriginFieldError(form);
 for(const id of ['originEditorError','originScheduleError','originTaskError']){
   const error=form.querySelector('#'+id);if(error)error.hidden=true;
 }
}
function reconcileOriginChecklistAfterRemoval(){
 const form=$('#editForm'),field=form?.querySelector('[data-origin-error-code="checklist-total"]');
 if(!field)return;
 const texts=[...form.querySelectorAll('.origin-checkrow [name="checkText"]')]
   .map(input=>input.value.trim()).filter(Boolean);
 if(texts.join('\n').length<=6000){
   clearOriginFieldError(form);
   const error=form.querySelector('#originTaskError');if(error)error.hidden=true;
 }
}
function markOriginInvalidField(form,name,message){
 if(!form)return false;
 const item=form.elements.namedItem(name);
 const field=item?.matches?.('input,select,textarea')?item:item?.item?.(0);
 if(!field?.focus)return false;
 clearOriginFieldError(form);
 const details=field.closest('details');
 if(details&&!details.open)details.open=true;
 const note=document.createElement('p');
 note.id='originFieldError';note.className='origin-field-error';note.textContent=message;
 const row=field.closest('.origin-checkrow');
 if(row)row.appendChild(note);else field.insertAdjacentElement('afterend',note);
 field.dataset.originFieldInvalid='true';
 field.dataset.originErrorCode=name==='checkText'&&message.includes('6,000')?'checklist-total':
   (name==='startAt'||name==='endAt')&&message.includes('終了日時')?'date-range':'field';
 field.setAttribute('aria-invalid','true');
 const existing=field.getAttribute('aria-describedby');
 field.setAttribute('aria-describedby',[existing,note.id].filter(Boolean).join(' '));
 field.focus({preventScroll:true});
 requestAnimationFrame(()=>{
   if(!form.isConnected||!field.isConnected)return;
   if(mount.activeElement!==field)field.focus({preventScroll:true});
   keepOriginEditorFieldVisible(field);
 });
 return true;
}
function updateOriginDraftState(){
 const indicator=$('#originDraftState'),form=$('#editForm');if(!indicator||!form)return;
 const unsaved=formSnapshot(form)!==initialFormSnapshot;
 indicator.dataset.unsaved=String(unsaved);
 indicator.textContent=unsaved?'未保存の変更があります':'変更はありません';
}
function markOriginEditorSaving(saving,command){
 const form=$('#editForm'),indicator=$('#originDraftState');
 if(!form||panelMode!=='edit')return;
 form.inert=saving;
 form.setAttribute('aria-busy',String(saving));
 if(indicator){
  if(saving){
   indicator.dataset.saving='true';
   indicator.textContent=command?.type?.endsWith('.delete')?'削除中…':'保存中…';
  }else{
   delete indicator.dataset.saving;
   updateOriginDraftState();
  }
 }
}
function originSheetFocusable(){
 // A single modal dialog must contain keyboard focus until it is closed.
 const sheet=$('#sheet');
 return Array.from(sheet?.querySelectorAll(
   'a[href],button:not([disabled]),summary:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
 )||[]).filter(el=>{
  if(!el.getClientRects().length||el.closest('[hidden]'))return false;
  // Author grid rules can leave closed <details> descendants with rectangles.
  // Only the direct summary of the nearest closed details remains tabbable.
  const closed=el.closest('details:not([open])');
  return !closed||(el.matches('summary')&&el.parentElement===closed
    &&!closed.parentElement.closest('details:not([open])'));
 });
}
function handleOriginModalKeys(e){
 if(!panelOpen)return false;
 if(e.key==='Escape'){
   const expanded=$('#sheet .origin-related-entry-actions:not([hidden])');
   if(expanded){
     e.preventDefault();
     expanded.hidden=true;
     const trigger=expanded.closest('.origin-related-entry')?.querySelector('[data-action="related-event-menu"]');
     trigger?.setAttribute('aria-expanded','false');
     trigger?.focus({preventScroll:true});
     return true;
   }
   e.preventDefault();
   closePanel();
   return true;
 }
 if(e.key==='Tab'){
   const candidates=originSheetFocusable();
   const first=candidates[0],last=candidates[candidates.length-1];
   if(!first){e.preventDefault();$('#sheet')?.focus({preventScroll:true});return true}
   const inside=$('#sheet')?.contains(e.target);
   if(e.shiftKey&&(!inside||e.target===first)){
     e.preventDefault();last.focus({preventScroll:true});return true;
   }
   if(!e.shiftKey&&(!inside||e.target===last)){
     e.preventDefault();first.focus({preventScroll:true});return true;
   }
   return false;
 }
 if(panelMode==='detail'&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.isComposing
   &&(e.key==='ArrowLeft'||e.key==='ArrowRight')
   &&!e.target.closest('input,select,textarea,[contenteditable="true"]')){
   const direction=e.key==='ArrowLeft'?-1:1;
   const state=detailNeighbors(panelKind,panelId);
   if(direction<0?state.previous:state.next){
     e.preventDefault();navigateDetail(direction);return true;
   }
 }
 return false;
}
function originDetailHasDraft(){
 return Boolean($('#originCommentForm [name="text"]')?.value.trim()
   ||Array.from($('#originWorkflow')?.querySelectorAll('input')||[]).some(input=>input.value!==input.defaultValue));
}
function closePanel(force=false,restoreFocus=true){
 if(!panelOpen)return true;
 if(!force&&panelMode==='detail'&&originDetailHasDraft()
   &&!window.confirm('入力中のコメント・設定を破棄して閉じますか？'))return false;
 if(!force&&busy){notify('保存処理中です。完了後に閉じてください。');return false;}
 if(!force&&restoreFocus&&originTaskScheduleSource&&panelMode==='edit'&&panelKind==='events'){
   if(busy){notify('保存処理中です。完了後に閉じてください。');return false;}
   if(formSnapshot($('#editForm'))!==initialFormSnapshot
     &&!window.confirm('入力中の変更を破棄してタスク詳細に戻りますか？'))return false;
   return restoreOriginTaskFromSchedule(false);
 }
 if(!force&&panelMode==='edit'&&busy){notify('保存処理中です。完了後に閉じてください。');return false;}
 if(!force&&panelMode==='edit'&&formSnapshot($('#editForm'))!==initialFormSnapshot){
   if(!window.confirm('入力中の変更を破棄して閉じますか？'))return false;
 }
 const kind=panelKind,id=panelId;
 originDetailEditReturn=null;
 const returnToInbox=Boolean(restoreFocus&&originInboxReturn&&originInboxReturn.user===snapshot.currentUser);
 originTaskScheduleSource=null;
 $('#overlay').hidden=true;$('#sheet').innerHTML='';syncOriginEditorViewport();document.body.style.overflow='';
 panelOpen=false;panelKind='';panelId='';originEditorInitialHeight=0;
 if(restoreFocus){
  // A close from any related detail restores the original list/search context.
  const origin=detailTrail[0];
  if(origin)detailSequence=origin.sequence;
  restorePanelReturnPosition(origin?.kind||kind,origin?.id||id);
  detailTrail=[];
  if(returnToInbox)openOriginInbox(true);
  originInboxReturn=null;
 }else if(force){detailTrail=[];originInboxReturn=null;}
 return true;
}
function returnOriginEditorToDetail(){
 const state=originDetailEditReturn,kind=panelKind;
 // Task-linked schedule editing already returns to its source task.
 if(originTaskScheduleSource&&kind==='events')return closePanel();
 if(!state||panelMode!=='edit'||panelKind!==state.kind||panelId!==state.id
   ||!findItem(kind,state.id))return closePanel();
 // Reuse the same unsaved-change guard as the existing cancel action.
 if(!closePanel(false,false))return false;
 panelShow(kind,state.id,false);
 if(!panelOpen||panelMode!=='detail'||panelKind!==kind||panelId!==state.id)return false;
 const workflow=$('#sheet #originWorkflow');
 if(kind==='tasks'&&workflow)workflow.open=state.workflowOpen;
 const related=$('#sheet .origin-related-more'),past=$('#sheet .origin-related-past');
 if(kind==='tasks'&&related)related.open=state.relatedExpanded;
 if(kind==='tasks'&&past)past.open=state.relatedPastExpanded;
 if(kind==='tasks'&&state.section){
   $('#sheet .origin-reader-nav')?.querySelectorAll('button').forEach(button=>
     button.dataset.value===state.section?button.setAttribute('aria-current','location'):button.removeAttribute('aria-current'));
 }
 const body=$('#sheet .sheet-body');
 if(body)body.scrollTop=state.scrollTop;
 $('#sheet .origin-sheet-primary [data-action="edit"]')?.focus({preventScroll:true});
 return true;
}
function notify(message){const t=$('#originToast');window.clearTimeout(toastTimer);
 t.textContent=String(message);t.hidden=false;toastTimer=window.setTimeout(()=>{t.hidden=true},4200)}
async function quickTodo(title){const value=String(title||'').trim();if(!value)return;
 const ok=await send({type:'todo.create',text:value},'ToDoを追加しました');
 if(ok){quickTodoDraft='';if(todoQuery){todoQuery='';render();}const next=$('#workspace [data-form="quick-todo"] [name="title"]');if(next){next.value='';next.focus({preventScroll:true})}}
}
function refreshDetailAfterStatusWrite(kind,id,action){
 if(!panelOpen||panelMode!=='detail'||panelKind!==kind||panelId!==id)return;
 const scroll=$('#sheet .sheet-body')?.scrollTop||0;
 panelShow(kind,id,false);
 const body=$('#sheet .sheet-body');
 if(body)body.scrollTop=scroll;
 // Updating status should not move the operator away from the same action.
 $('#sheet [data-action="'+action+'"]')?.focus({preventScroll:true});
}
async function toggleTodo(id){
 const listReturn=!panelOpen?captureOriginTodoListReturn(id):null;
 const saved=await send({type:'todo.toggle',id},'ToDoを更新しました');
 if(panelOpen){
   if(saved)refreshDetailAfterStatusWrite('todos',id,'todo-toggle');
   return;
 }
 if(!listReturn)return;
 if(!saved){
   // An unsuccessful write must not leave the checkbox visually toggled.
   syncSnapshot();render();
 }
 restoreOriginTodoListReturn(listReturn,{sameItem:!saved});
}
// Use the canonical status-only command. This must not rewrite other task fields.
async function updateOriginInlineStatus(select){
 const task=findItem('tasks',select.dataset.id),status=select.value;
 if(!task||!snapshot.statuses.includes(status)){render();return}
 if(task.status===status)return;
 const previous=task.status;
 select.disabled=true;
 try{
  const ok=await send({type:'task.status',id:task.id,status},'状態を変更しました');
  if(!ok){select.value=previous;select.disabled=false}
 }catch(error){
  select.value=previous;select.disabled=false;
  notify('状態を変更できませんでした。最新の内容を確認してください。');
 }
}
async function toggleTaskDone(id){
 const t=findItem('tasks',id);if(!t)return;
 const type=t.completed?'task.reopen':'task.complete';
 const saved=await send({type,id},type==='task.complete'?'タスクを完了しました':'タスクを再開しました');
 if(saved)refreshDetailAfterStatusWrite('tasks',id,'task-done');
}
function closeSearch(clear=false){
 const sr=$('#searchResults'),input=$('#originSearchInput');
 sr.hidden=true;input?.setAttribute('aria-expanded','false');
 if(clear){if(input)input.value='';searchQuery='';searchKind='all'}
}
function handleRoute(route){
 if(!viewDefs.some(x=>x[0]===route))return;
 originInboxReturn=null;
 closeOriginInbox(false);
 closeOriginSettings();
 if(panelOpen&&!closePanel(false,false))return;
 panelReturnAnchor=null;detailTrail=[];scheduleGlobalReturn=null;
 if(route===view){viewScrollPositions[view]=0;window.scrollTo({top:0,behavior:'instant'});return}
 viewScrollPositions[view]=window.scrollY;
 detailSequence=null;panelReturnSearch=null;view=route;selectedBulk.clear();closeSearch(true);
 $('#createMenu').hidden=true;
 render();
 const saved=Number(viewScrollPositions[route]||0);
 window.scrollTo({top:Math.max(0,saved),behavior:'instant'});
}
function originSearchMatches(term){
 const tokens=term.split(/\s+/);
 const types=[['tasks','タスク'],['todos','ToDo'],['events','予定'],['memos','メモ']];
 const matches=[],counts=Object.fromEntries(types.map(([kind])=>[kind,0]));
 if(!term)return {types,counts,matches};
 for(const [order,[kind,label]] of types.entries()){
   for(const item of data[kind]||[]){
     const title=String(item.title||''),lower=title.toLocaleLowerCase();
     const fields=[title,item.desc,item.body,item.memo,item.category,item.assignee,
       item.status,item.location,item.date,item.due,...(item.tags||[])];
     const text=fields.map(v=>String(v||'')).join(' ').toLocaleLowerCase();
     if(!tokens.every(token=>text.includes(token)))continue;
     counts[kind]++;
     const score=lower.startsWith(term)?0:lower.includes(term)?1
       :tokens.every(token=>lower.includes(token))?2:3;
     let details='';
     if(kind==='tasks')details=[item.status,item.due?humanDue(item.due):''].filter(Boolean).join(' · ');
     if(kind==='todos')details=item.done?'完了':'未完了';
     if(kind==='events')details=[item.date,item.time].filter(Boolean).join(' ');
     if(kind==='memos')details=item.category||'';
     matches.push({kind,id:item.id,label,title,details,score,order});
   }
 }
 matches.sort((a,b)=>a.score-b.score||a.order-b.order
   ||a.title.localeCompare(b.title,'ja')||String(a.id).localeCompare(String(b.id)));
 return {types,counts,matches};
}
function originFullSearchResults(){
 const collected=originSearchMatches(originFullSearchQuery.trim().toLocaleLowerCase());
 const filtered=searchKind==='all'?collected.matches:collected.matches.filter(item=>item.kind===searchKind);
 if(originFullSearchSort==='title')filtered.sort((a,b)=>a.title.localeCompare(b.title,'ja')||a.order-b.order||String(a.id).localeCompare(String(b.id)));
 return {...collected,filtered};
}
function renderOriginFullSearch(){
 const {types,counts,matches,filtered}=originFullSearchResults();
 const total=matches.length,visible=filtered.slice(0,originFullSearchLimit);
 const facets=[['all','すべて'],...types].map(([id,label])=>
  `<button type="button" data-action="full-search-kind" data-value="${id}" aria-pressed="${searchKind===id}">${esc(label)} <small>${id==='all'?total:counts[id]}</small></button>`).join('');
 const rows=visible.map(item=>`<button type="button" class="origin-full-search-hit" data-action="open" data-kind="${item.kind}" data-id="${esc(item.id)}">
  <span class="origin-full-search-kind">${esc(item.label)}</span>
  <span class="origin-full-search-hit-body"><strong>${esc(item.title)}</strong><small>${esc(item.details||'詳細を開いて確認')}</small></span>
  <span class="origin-full-search-chevron">${icon('right',16)}</span>
 </button>`).join('');
 const more=filtered.length>visible.length
  ?`<div class="origin-full-search-more"><span>${visible.length} / ${filtered.length}件表示</span>
   <button type="button" data-action="full-search-more">さらに${Math.min(30,filtered.length-visible.length)}件</button>
   <button type="button" data-action="full-search-show-all">残りすべて表示</button></div>`:'';
 return `${head('SEARCH · ALL RESULTS','詳細検索','仕事・予定・ToDo・メモをまとめて探せます。')}
 <div class="origin-full-search">
  <button type="button" class="origin-full-search-back" data-action="full-search-back">${icon('left',16)} 元の画面に戻る</button>
  <section class="surface origin-full-search-shell" aria-label="横断検索の全結果">
   <div class="origin-full-search-controls">
    <label class="origin-full-search-field" for="originFullSearchInput">${icon('search',18)}
     <input type="search" id="originFullSearchInput" value="${esc(originFullSearchQuery)}"
       placeholder="件名・担当・説明などで検索" aria-label="すべての記録を検索" autocomplete="off"/>
    </label>
    <label class="origin-full-search-order">並び順
     <select id="originFullSearchSort" aria-label="検索結果の並び順">
      <option value="relevance" ${originFullSearchSort==='relevance'?'selected':''}>関連度順</option>
      <option value="title" ${originFullSearchSort==='title'?'selected':''}>件名順</option>
     </select></label>
   </div>
   <div class="origin-full-search-facets" role="group" aria-label="検索対象の種類">${facets}</div>
   <p class="origin-full-search-summary" role="status">${originFullSearchQuery.trim()?filtered.length+'件の結果（全種類 '+total+'件）':'検索キーワードを入力してください'}${filtered.length>visible.length?' · 上位'+visible.length+'件を表示':''}</p>
   <div class="origin-full-search-list">${rows||(originFullSearchQuery.trim()?'<p class="origin-full-search-empty">一致する項目はありません。検索語や種類を変更してください。</p>':'<p class="origin-full-search-empty">検索語を入力すると、全データから探せます。</p>')}${more}</div>
  </section>
 </div>`;
}
function openOriginFullSearch(){
 const input=$('#originSearchInput'),query=String(input?.value||'').trim();
 if(!query)return;
 if(view!=='search'){originFullSearchReturn=view;viewScrollPositions[view]=window.scrollY;}
 originFullSearchQuery=query;originFullSearchLimit=30;originFullSearchSort='relevance';
 view='search';closeSearch();render();
 window.scrollTo({top:0,behavior:'instant'});
 $('#originFullSearchInput')?.focus({preventScroll:true});
}
function backOriginFullSearch(){
 if(view!=='search')return;
 view=originFullSearchReturn;
 render();window.scrollTo({top:Number(viewScrollPositions[view]||0),behavior:'instant'});
 const input=$('#originSearchInput');
 if(input){input.value=originFullSearchQuery;renderSearch(input.value);input.focus({preventScroll:true});}
}
function updateOriginFullSearchQuery(input){
 const start=input.selectionStart,end=input.selectionEnd;
 originFullSearchQuery=input.value;originFullSearchLimit=30;render();
 const next=$('#originFullSearchInput');
 if(next){next.focus({preventScroll:true});if(start!==null)next.setSelectionRange(start,end);}
}
function renderSearch(q){
 const sr=$('#searchResults'),input=$('#originSearchInput');
 const oldQuery=searchQuery;
 const oldKind=sr.querySelector('.origin-search-filters [aria-pressed="true"]')?.dataset.value;
 const oldRailScroll=sr.querySelector('.origin-search-filters')?.scrollLeft||0;
 const oldResultScroll=sr.scrollTop;
 const term=String(q||'').trim().toLocaleLowerCase();searchQuery=term;
 if(!term){closeSearch();return}
 const {types,counts,matches}=originSearchMatches(term);
 const total=matches.length;
 const filtered=searchKind==='all'?matches:matches.filter(item=>item.kind===searchKind);
 const visible=filtered.slice(0,10);
 const buttons=[['all','すべて'],...types].map(([kind,label])=>
   '<button type="button" data-action="search-kind" data-value="'+kind
   +'" aria-pressed="'+(searchKind===kind)+'">'+label
   +'<span class="origin-search-count">'+(kind==='all'?total:counts[kind])+'</span></button>'
 ).join('');
 const results=visible.map(item=>'<button type="button" class="search-hit"'
   +' data-action="search-open" data-kind="'+item.kind+'" data-id="'+esc(item.id)+'">'
   +'<strong>'+esc(item.title)+'</strong><span>'+esc(item.label)
   +(item.details?' · '+esc(item.details):'')+'</span></button>').join('');
 sr.innerHTML='<div class="origin-search-filters" role="group" aria-label="検索結果の種類">'
   +buttons+'</div><div class="origin-search-summary" role="status">'
   +filtered.length+'件の結果'+(filtered.length>visible.length?'（上位'+visible.length+'件を表示）':'')
   +'</div><button type="button" class="origin-search-all" data-action="search-all">すべての結果を確認（'
   +filtered.length+'件） →</button><div class="origin-search-list">'
   +(results||'<p class="origin-search-empty">一致する項目がありません。別の種類やキーワードをお試しください。</p>')
   +'</div>';
 sr.hidden=false;input?.setAttribute('aria-expanded','true');
 const filterRail=sr.querySelector('.origin-search-filters');
 if(filterRail)filterRail.scrollLeft=oldRailScroll;
 // Data-refresh preserves the current result, a new query/type starts at the top.
 sr.scrollTop=oldQuery===term&&oldKind===searchKind?oldResultScroll:0;
}
// Focus the first visible record; do not change filter state or canonical data.
function focusOriginFirstResult(kind){
 // A user may collapse history while searching; reveal matching history only
 // when the pending list has no result, so the jump button is never a dead end.
 if(kind==='todos'&&view==='todos'&&todoSearchHistory&&!todoCompletedOpen
   &&!originVisiblePendingTodos().length&&originVisibleCompletedTodos().length){
   todoCompletedOpen=true;render();
 }
 const selectors={
  tasks:'.origin-task-collection [data-action="open"][data-kind="tasks"]',
  todos:'.origin-todo-list [data-action="open"][data-kind="todos"],#originCompletedTodos [data-action="open"][data-kind="todos"]',
  events:view==='calendar'&&scheduleSearchScope==='all'
    ?'.origin-schedule-global-results .origin-schedule-global-item [data-action="open"][data-kind="events"]'
    :'[data-action="open"][data-kind="events"]',
  memos:'.memo-grid .memo-card[data-action="open"]'
 };
 const selector=selectors[kind];
 if(!selector)return;
 const first=Array.from($('#workspace').querySelectorAll(selector))
  .find(el=>el.getClientRects().length>0&&!el.closest('[hidden]'));
 if(!first){notify('該当する項目はありません。検索条件を確認してください。');return;}
 first.focus({preventScroll:true});
 first.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
}
function focusSearchResult(button){
 button.focus({preventScroll:true});
 const panel=$('#searchResults');
 const bounds=button.getBoundingClientRect(),frame=panel.getBoundingClientRect();
 // Keep the keyboard-selected result visible inside the popup, without
 // unexpectedly scrolling the entire task page under the sticky header.
 if(bounds.bottom>frame.bottom-8)panel.scrollTop+=bounds.bottom-frame.bottom+8;
 else if(bounds.top<frame.top+8)panel.scrollTop-=frame.top-bounds.top+8;
}
function closeOriginSettings(returnFocus=false){
 const panel=$('#originSettingsPanel'),toggle=$('#originSettingsToggle');
 if(!panel||panel.hidden)return;
 panel.hidden=true;toggle.setAttribute('aria-expanded','false');
 if(returnFocus)toggle.focus({preventScroll:true});
}
function toggleOriginSettings(){
 const panel=$('#originSettingsPanel'),toggle=$('#originSettingsToggle');
 if(!panel.hidden){closeOriginSettings(true);return;}
 $('#createMenu').hidden=true;closeSearch();
 panel.hidden=false;toggle.setAttribute('aria-expanded','true');
}
function openCreateMenu(){closeOriginSettings();const m=$('#createMenu');m.hidden=!m.hidden;if(!m.hidden)m.innerHTML=`${[['tasks','共有タスク','tasks'],['todos','個人ToDo','todo'],['events','予定','calendar'],['memos','業務メモ','notes']].map(([k,n,ic])=>`<button class="pop-row" type="button" data-action="new" data-kind="${k}">${icon(ic,19)} ${n}を作成</button>`).join('')}`}
async function saveForm(f){
 if(busy)return false;
 hideOriginSaveRecovery();
 const fd=new FormData(f),kind=f.dataset.kind,id=f.dataset.id;
 const title=String(fd.get('title')||'').trim();
 if(!title){
  const message='件名・タイトルを入力してください。';
  const error=f.querySelector('#originEditorError');
  if(error){error.hidden=false;error.textContent=message}
  markOriginInvalidField(f,'title',message);
  return false;
 }
 if(kind==='templates')return send({type:'template.save',id,revision:Number(f.dataset.revision),ownerRoom:f.dataset.ownerRoom,ownerUser:f.dataset.ownerUser,values:Object.fromEntries(fd)},'テンプレートを保存しました',{close:true});
 if(kind==='knowledge')return send({type:'knowledge.save',id,revision:Number(f.dataset.revision),ownerRoom:f.dataset.ownerRoom,ownerUser:f.dataset.ownerUser,taskId:f.dataset.taskId,taskRevision:Number(f.dataset.taskRevision),values:Object.fromEntries(fd)},'ナレッジを保存しました',{close:true});
 if(kind==='events'){
   const invalid=(message,field,reason='validation')=>{
     const region=f.querySelector('#originScheduleError');
     if(region){region.textContent=message;region.hidden=false}
     markOriginInvalidField(f,field,message);
     if(reason==='conflict')showOriginSaveRecovery('conflict');
     return false;
   };
   const startAt=String(fd.get('startAt')||''),endAt=String(fd.get('endAt')||'');
   const start=new Date(startAt),end=new Date(endAt);
   if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime()))
     return invalid('開始日時と終了日時を入力してください。','startAt');
   if(end<=start)return invalid('終了日時は開始日時より後にしてください。','endAt');
   if(f.dataset.ownerRoom!==snapshot.roomId||f.dataset.ownerUser!==snapshot.currentUser)
     return invalid('共有ルームまたは利用者が変わりました。開き直してください。','title','conflict');
   const revision=Number(f.dataset.revision);
   const record=id?snapshot.schedules.find(x=>x.id===id):null;
   if(!Number.isSafeInteger(revision)||revision<0||(id&&(!record||Number(record.revision)!==revision)))
     return invalid('ほかの端末で変更されました。編集中の入力を保っています。','title','conflict');
   const values={title,startAt,endAt,
     assignee:String(fd.get('assignee')||snapshot.currentUser),
     category:String(fd.get('category')||snapshot.categories[0]||'その他'),
     relatedTaskId:String(fd.get('relatedTaskId')||''),
     location:String(fd.get('location')||''),memo:String(fd.get('memo')||'')};
   if(!id&&fd.has('batchEnabled')){
     const command=originBatchCommand(f);
     if(f.dataset.batchReviewed!==JSON.stringify(command)){
       f.querySelector('#originBatchReview')?.scrollIntoView({block:'center'});
       return invalid('作成日を確認してから登録してください。','title');
     }
     return send({...command,type:'schedule.batch'},'複数日の予定を登録しました',{close:true,returnToTask:Boolean(originTaskScheduleSource)});
   }
   return send({type:id?'schedule.update':'schedule.create',id,revision,
     ownerRoom:f.dataset.ownerRoom,ownerUser:f.dataset.ownerUser,values},
     id?'予定を更新しました':'予定を登録しました',{close:true,returnToTask:Boolean(originTaskScheduleSource)});
 }
 const existing=id ? (kind==='tasks'?snapshot.tasks.find(t=>t.id===id):
  kind==='memos'?memoItems.find(t=>t.id===id):snapshot.todos.find(t=>t.id===id)) :null;
 if(kind==='tasks'){
  const rev=Number(f.dataset.revision),error=f.querySelector('#originTaskError');
  if(fd.get('startDate')&&fd.get('due')&&String(fd.get('startDate'))>String(fd.get('due'))){
    markOriginInvalidField(f,'startDate','開始日は期限日以前の日付を指定してください。');return false;
  }
  if(f.dataset.ownerRoom!==snapshot.roomId||f.dataset.ownerUser!==snapshot.currentUser||(!Number.isSafeInteger(rev)||rev<0)||(id&&Number(existing?.revision)!==rev)){
    if(error){error.hidden=false;error.textContent='ほかの端末で変更された可能性があります。入力内容を保持しています。'}
    showOriginSaveRecovery('conflict');return false;
  }
  const rows=[...f.querySelectorAll('.origin-checkrow')].map(x=>({text:x.querySelector('[name="checkText"]').value.trim(),done:x.querySelector('[name="checkDone"]').checked})).filter(x=>x.text);
  if(rows.map(x=>x.text).join('\n').length>6000){
    const message='チェック項目は合計6,000文字以内にしてください。';
    if(error){error.hidden=false;error.textContent=message}
    markOriginInvalidField(f,'checkText',message);
    return false;
   }
  const command={type:'task.'+(id?'update':'create'),id,revision:rev,ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser,title,
   assignee:String(fd.get('assignee'))==='自分'?snapshot.currentUser:String(fd.get('assignee')),
   status:String(fd.get('status')),priority:String(fd.get('priority')),category:String(fd.get('category')),
   dueDate:String(fd.get('due')||''),dueTime:fd.get('due')?String(fd.get('dueTime')||''):'',description:String(fd.get('desc')||''),
   requester:String(fd.get('requester')||''),tags:String(fd.get('tags')||''),checklist:rows.map(x=>x.text).join('\n'),
   checklistDone:rows.map(x=>x.done),pinned:fd.has('pinned'),startDate:String(fd.get('startDate')||''),startRevision:Number(f.dataset.startRevision),...originRecurrenceValues(f)};
  return send(command,id?'タスクを更新しました':'タスクを登録しました',{close:true});
 }
 if(kind==='todos'){
  const completed=String(fd.get('done'))==='true';
  if(id){
    // Never overwrite a newer ToDo when its revision changed after editing began.
    const revision=Number(f.dataset.revision);
    if(f.dataset.ownerRoom!==snapshot.roomId||f.dataset.ownerUser!==snapshot.currentUser
      ||!Number.isSafeInteger(revision)||revision<0
      ||!existing||Number(existing.revision)!==revision){
      showEditorSaveError('ToDoが他端末で変更されました。編集中の入力は残しています。','conflict');
      return false;
    }
    // Commit details and completion in one canonical CAS transaction.
    return send({type:'todo.update',id,text:title,memo:String(fd.get('memo')||''),
      completed,revision,ownerRoom:f.dataset.ownerRoom,ownerUser:f.dataset.ownerUser},
      'ToDoを更新しました',{close:true});
  }
  return send({type:'todo.create',text:title,memo:String(fd.get('memo')||''),completed},
    'ToDoを追加しました',{close:true});
 }
 if(kind==='memos'){
  const revision=Number(f.dataset.revision);
  if(f.dataset.ownerRoom!==snapshot.roomId||f.dataset.ownerUser!==snapshot.currentUser
    ||!Number.isSafeInteger(revision)||revision<0
    ||(id&&(!existing||Number(existing.revision)!==revision))){
    showEditorSaveError('他端末でメモが変更されました。入力内容を保持しています。','conflict');
    return false;
  }
  return send({type:'memo.'+(id?'update':'create'),id,revision,
    ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser,
    title,category:String(fd.get('category')||memoBridge?.categories?.[0]||'その他'),
    body:String(fd.get('body')||''),tags:String(fd.get('tags')||''),
    pinned:fd.has('pinned'),paperColor:memoColor(fd.get('paperColor'))},id?'メモを更新しました':'メモを登録しました',{close:true});
 }
}
async function deleteItem(kind,id){
 if(kind==='knowledge'){
   const form=$('#editForm');
   return send({type:'knowledge.delete',id,revision:Number(form.dataset.revision),ownerRoom:form.dataset.ownerRoom,ownerUser:form.dataset.ownerUser},'ナレッジを削除しました',{close:true});
 }
 if(kind==='templates'){
   if(!window.confirm('このテンプレートを削除しますか？'))return;
   const form=$('#editForm');
   return send({type:'template.delete',id,revision:Number(form.dataset.revision),ownerRoom:form.dataset.ownerRoom,ownerUser:form.dataset.ownerUser},'テンプレートを削除しました',{close:true});
 }
 const record=findItem(kind,id);
 if((kind==='events'&&record?.recurrenceSeriesId)||(kind==='tasks'&&(record?.hasSeries||record?.recurrence&&record.recurrence!=='none'))){
   const form=$('#editForm');if(!form||busy)return;
   busy=true;
   try{
     const result=await bridge.dispatch({type:'series.preview-delete',kind,id,revision:Number(form.dataset.revision),ownerRoom:form.dataset.ownerRoom,ownerUser:form.dataset.ownerUser});
     if(!result?.ok)return notify('系列が更新されています。詳細を開き直して確認してください。');
     form.querySelector('.origin-series-delete')?.remove();
     form.dataset.deleteToken=result.token;
     form.insertAdjacentHTML('beforeend',`<section class="origin-series-delete origin-batch-review" aria-label="系列の削除範囲を確認"><h3>削除する範囲を確認</h3><p>未保存の入力は保存されません。削除は元に戻せません。</p><fieldset class="form-field"><legend>対象範囲</legend>${[['one','この1件'],['following','この回以降'],['all','系列全体']].map(([scope,label])=>`<label><input type="radio" name="deleteScope" value="${scope}" ${scope==='one'?'checked':''}/> ${label}（${result.counts[scope]}件）</label>`).join('')}</fieldset><p>${kind==='tasks'?'この1件の削除では、未完了なら次回のタスクを作成して繰り返しを継続します。関連予定は残し、参照を解除します。':'選択範囲の予定を削除します。'}</p><button type="button" class="danger-button" data-action="series-delete-confirm">指定した範囲を削除する</button></section>`);
     form.querySelector('.origin-series-delete').scrollIntoView({block:'center'});
   }finally{busy=false}
   return;
 }
 if(kind==='todos'){
   // Canonical delete keeps its confirmation; Origin adds only the revision guard.
   const form=$('#editForm'),current=snapshot.todos.find(todo=>todo.id===id);
   if(!panelOpen||panelMode!=='edit'||panelKind!=='todos'||panelId!==id
     ||form?.dataset.kind!=='todos'||form.dataset.id!==id)
     return notify('ToDoの編集画面を開き直してください。');
   const revision=Number(form.dataset.revision);
   if(!current||form.dataset.ownerRoom!==snapshot.roomId
     ||form.dataset.ownerUser!==snapshot.currentUser
     ||!Number.isSafeInteger(revision)||revision<0
     ||Number(current.revision)!==revision){
     showEditorSaveError('このToDoは他端末で変更または削除されています。入力内容は保持しています。','conflict');
     return false;
   }
   return send({type:'todo.delete',id,revision,ownerRoom:form.dataset.ownerRoom,
     ownerUser:form.dataset.ownerUser},'ToDoを削除しました',{close:true});
 }
 if(!findItem(kind,id))return;
 if(kind==='events'){
   const item=snapshot.schedules.find(x=>x.id===id);
   if(!item)return notify('予定が更新されました。開き直してください。');
   const form=$('#editForm'),revision=form?.dataset.kind==='events'&&form.dataset.id===id
     ?Number(form.dataset.revision):Number(item.revision);
   return send({type:'schedule.delete',id,revision,
     ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser},
     '予定を削除しました',{close:true});
 }
 if(!window.confirm('この'+singular[kind]+'を削除しますか？'))return;
 const item=findItem(kind,id),type=kind==='tasks'?'task.delete':'memo.delete';
 return send({type,id,revision:item.revision,ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser},
 singular[kind]+'を削除しました',{close:true});
}
function setTheme(){theme=theme==='dark'?'light':'dark';initTheme();syncOriginColorTheme()}
function handleAction(el){const a=el.dataset.action,id=el.dataset.id,kind=el.dataset.kind,value=el.dataset.value;
 if(a==='settings-toggle')return toggleOriginSettings();
 if(a==='settings-close')return closeOriginSettings(true);
 if(a==='detail-jump'){
   const target=$('#sheet')?.querySelector('#'+value);if(!target)return;
   // Workflow settings live inside a closed details element. Open it before scrolling and focus its native summary.
   const summary=target.matches('details')?target.querySelector(':scope > summary'):null;
   if(summary)target.open=true;
   const heading=summary||target.querySelector('h3')||target;
   if(!summary)heading.tabIndex=-1;
   heading.focus({preventScroll:true});
   target.scrollIntoView({block:'start',behavior:'auto'});
   el.closest('nav').querySelectorAll('button').forEach(button=>button===el?button.setAttribute('aria-current','location'):button.removeAttribute('aria-current'));
   return;
 }
 if(a==='duplicate-merge'){
   if(busy)return;const target=el.closest('.origin-duplicate').querySelector('select').value;if(!target)return notify('統合先を選択してください。');
   if(originDetailHasDraft()&&!window.confirm('未保存の入力を破棄して統合に進みますか？'))return;
   busy=true;
   return window.WorkBoardDuplicateV182?.mergeDuplicate(id,target).then(result=>{
     if(result?.ok){closePanel(true,false);syncSnapshot();render();notify(result.cleanupPending?'統合本体は保存済みです。関連設定の整理が未完了のため、再統合せず設定を確認してください。':'重複タスクを統合しました。');}
     else if(!result?.cancelled)notify('統合できませんでした。接続状態・前提タスク・他端末の更新を確認してください。');
   }).finally(()=>{busy=false});
 }
 if(['task-archive','archive-restore'].includes(a))return originSidecarAction(el);
 if(a==='task-layout'){if(!['list','board','timeline'].includes(value))return;taskLayoutMode=value;if(value==='board')taskGrouping='status';if(value==='timeline')taskGrouping='deadline';taskCollapsedGroups.clear();taskVisibleLimits.clear();selectedBulk.clear();return render();}
 if(a==='task-view-save')return saveOriginTaskView();
 if(a==='tool-tab'){if(!['templates','archive','knowledge','insights','settings'].includes(value))return;originTool=value;originToolQuery='';originToolLimit=60;return render();}
 if(a==='tool-more'){originToolLimit+=60;return render();}
 if(a==='management-write')return saveOriginManagement(el);
 if(a==='task-knowledge'){
   const task=findItem('tasks',id);if(!task)return;
   if(task.knowledgeId)return panelShow('knowledge',task.knowledgeId,true);
   return panelShow('knowledge',null,true,{taskId:id,taskRevision:task.revision,title:task.title,summary:task.desc,symptom:task.desc,action:task.desc,checkpoint:task.checklist.map(x=>x.text).join(' / ')});
 }
 if(a==='series-delete-confirm'){
   const form=$('#editForm');if(!form?.dataset.deleteToken)return;
   return send({type:'series.delete',token:form.dataset.deleteToken,scope:form.querySelector('[name="deleteScope"]:checked')?.value,ownerRoom:form.dataset.ownerRoom,ownerUser:form.dataset.ownerUser},'指定範囲を削除しました',{close:true});
 }
 if(a==='comment-reply'||a==='comment-reply-cancel'){const form=$('#originCommentForm');if(!form||busy)return;setOriginReplyContext(form,a==='comment-reply'?value:'');form.elements.text.focus({preventScroll:true});form.elements.text.scrollIntoView({block:'nearest'});return;}
 if(a==='comment-reaction'){const form=$('#originCommentForm');if(!form||busy)return;return send({type:'comment.reaction',id:form.dataset.id,commentId:value,emoji:el.dataset.emoji,expectedPressed:el.getAttribute('aria-pressed')==='true',ownerRoom:form.dataset.ownerRoom,ownerUser:form.dataset.ownerUser},'リアクションを更新しました').then(ok=>{if(ok)refreshOriginComments()});}
 if(a==='template-new')return panelShow('templates',null,true);
 if(a==='template-edit')return panelShow('templates',id,true);
 if(a==='template-apply')return applyOriginTemplate();
 if(['workflow-add','workflow-remove','workflow-reminder','workflow-reminder-clear'].includes(a))return writeOriginWorkflow(el);
 if(a==='task-recurrence-preview')return previewOriginTaskRecurrence($('#editForm'));
 if(a==='schedule-preview')return previewOriginBatch($('#editForm'));
 if(a==='task-copy'){
   if(busy)return;
   const source=findItem('tasks',id);if(!source)return;
   return send({type:'task.duplicate',id,revision:source.revision,ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser},'タスクを複製しました',{close:true});
 }
 if(a==='schedule-copy'){
   if(busy)return;
   const source=findItem('events',id);if(!source)return;
   const seed={...source,recurrenceSeriesId:'',date:source.date};
   return panelShow('events',null,true,seed);
 }
 if(a==='task-star'){
   if(busy)return;
   const wasOpen=Boolean(el.closest('.origin-task-more-actions')?.open);
   const previousScroll=$('#sheet .sheet-body')?.scrollTop||0;
   return send({type:'task.star',id},'お気に入りを更新しました').then(ok=>{
     if(!ok||!panelOpen||panelMode!=='detail'||panelId!==id)return;
     panelShow('tasks',id);
     const more=$('#sheet .origin-task-more-actions');
     if(more&&wasOpen)more.open=true;
     const body=$('#sheet .sheet-body');if(body)body.scrollTop=previousScroll;
     more?.querySelector('[data-action="task-star"]')?.focus({preventScroll:true});
   });
 }
 if(a==='todo-move'){
   const item=findItem('todos',id);if(!item||busy)return;
   return send({type:'todo.move',id,direction:value,segment:item.done?'completed':'open'},'ToDoの並び順を変更しました').then(ok=>{if(ok&&panelOpen&&panelId===id)panelShow('todos',id)});
 }
 if(a==='origin-copy-draft'){
   const form=$('#editForm');if(form&&!busy)void copyOriginDraft(form);
   return;
 }
 if(a==='origin-save-again'){
   const form=$('#editForm'),panel=form?.querySelector('#originSaveRecovery');
   if(!busy&&form?.dataset.id&&panel?.dataset.reason==='retry'
     &&['tasks','events','memos','todos'].includes(form.dataset.kind))form.requestSubmit();
   return;
 }
 if(a==='related-event-menu'){
  if(!panelOpen||panelMode!=='detail'||panelKind!=='tasks')return;
  const entry=el.closest('.origin-related-entry'),menu=entry?.querySelector('.origin-related-entry-actions');
  if(!menu)return;
  const shouldOpen=menu.hidden;
  // A single expanded action group keeps longer task lists readable.
  for(const expanded of $('#sheet').querySelectorAll('.origin-related-entry-actions:not([hidden])')){
    expanded.hidden=true;
    expanded.closest('.origin-related-entry')?.querySelector('[data-action="related-event-menu"]')?.setAttribute('aria-expanded','false');
  }
  if(shouldOpen){menu.hidden=false;el.setAttribute('aria-expanded','true')}
  return;
 }
 if(['related-event-edit','related-event-manage','related-event-unlink'].includes(a)){
  if(!panelOpen||panelMode!=='detail'||panelKind!=='tasks')return;
  const taskId=panelId,appointment=findItem('events',id);
  if(!appointment||appointment.relatedTaskId!==taskId)
    return notify('関連付けが変更されました。内容を開き直してください。');
  const source=captureOriginTaskScheduleSource(taskId,id);
  panelShow('events',id,true);
  if(panelOpen&&panelMode==='edit'&&panelKind==='events'&&panelId===id){
    originTaskScheduleSource=source;
    if(a==='related-event-manage'){
      const search=$('#originRelatedTaskSearch'),hint=$('#originRelatedTaskHint');
      if(hint)hint.textContent='タスクを検索して選択し、「変更を保存」で関連先を変更します。';
      search?.focus({preventScroll:true});
      search?.scrollIntoView({block:'center',behavior:'instant'});
    }else if(a==='related-event-unlink'){
      const picker=$('#originRelatedTaskSelect'),search=$('#originRelatedTaskSearch');
      if(picker){
        picker.value='';
        if(search)search.value='';
        filterOriginRelatedTasks();
        updateOriginDraftState();
        const hint=$('#originRelatedTaskHint');
        if(hint)hint.textContent='このタスクとの関連だけを解除します。予定は削除されません。「変更を保存」で確定します。';
        picker.focus({preventScroll:true});
        picker.scrollIntoView({block:'center',behavior:'instant'});
      }
    }
  }
  return;
 }
 if(a==='task-schedule-new'){
  if(!panelOpen||panelMode!=='detail'||panelKind!=='tasks'||panelId!==id)return;
  const task=findItem('tasks',id);if(!task)return notify('元のタスクが見つかりません。');
  const source=captureOriginTaskScheduleSource(id);
  const date=/^\d{4}-\d{2}-\d{2}$/.test(task.due||'')&&task.due>=base?task.due:selectedDay;
  const assignee=task.assignee==='自分'?snapshot.currentUser:task.assignee;
  panelShow('events',null,true,{originTaskDraft:true,title:task.title.slice(0,80),
    relatedTaskId:task.id,date,assignee,category:task.category});
  if(panelOpen&&panelMode==='edit'&&panelKind==='events'&&!panelId)originTaskScheduleSource=source;
  return;
 }
 if(a==='related-task-clear'){
  const sel=$('#originRelatedTaskSelect'),search=$('#originRelatedTaskSearch');
  if(!sel)return;sel.value='';if(search){search.value='';filterOriginRelatedTasks();search.focus({preventScroll:true})}
  invalidateOriginBatchReview($('#editForm'));updateOriginDraftState();return;
 }
 if(a==='task-check-add'){const c=$('#originTaskChecks');if(c){if(c.children.length>=80)return notify('チェック項目は80件以内にしてください。');c.insertAdjacentHTML('beforeend',taskCheckRow());c.lastElementChild.querySelector('[name="checkText"]')?.focus();updateOriginDraftState();}return;}
 if(a==='task-check-remove'){const row=el.closest('.origin-checkrow');const next=row?.nextElementSibling||row?.previousElementSibling;row?.remove();(next?.querySelector('[name="checkText"]')||$('#editForm [name="title"]'))?.focus();reconcileOriginChecklistAfterRemoval();updateOriginDraftState();return;}
 if(a==='search-kind'){
  searchKind=['all','tasks','todos','events','memos'].includes(value)?value:'all';
  renderSearch($('#originSearchInput').value);
  $('#searchResults [data-action="search-kind"][data-value="'+searchKind+'"]')?.focus({preventScroll:true});
  return;
 }
 if(a==='search-all')return openOriginFullSearch();
 if(a==='full-search-back')return backOriginFullSearch();
 if(a==='full-search-kind'){
  searchKind=['all','tasks','todos','events','memos'].includes(value)?value:'all';
  originFullSearchLimit=30;render();
  $('#workspace [data-action="full-search-kind"][data-value="'+searchKind+'"]')?.focus({preventScroll:true});return;
 }
 if(a==='full-search-more'||a==='full-search-show-all'){
  const previous=$('#workspace .origin-full-search-list')?.querySelectorAll('.origin-full-search-hit').length||0;
  originFullSearchLimit=a==='full-search-show-all'?Infinity:originFullSearchLimit+30;render();
  const first=$('#workspace .origin-full-search-list')?.querySelectorAll('.origin-full-search-hit')[previous];
  if(first){first.focus({preventScroll:true});first.scrollIntoView({block:'nearest',behavior:'instant'});}
  return;
 }
 if(a==='inbox-shortcut')return openOriginInbox();
 if(a==='origin-inbox-close')return closeOriginInbox();
 if(a==='origin-inbox-section'){originInboxSection=value==='activity'?'activity':'important';originInboxGenre='all';originInboxLimit=40;renderOriginInbox();return}
 if(a==='origin-inbox-genre'){originInboxGenre=value;originInboxLimit=40;renderOriginInbox();return}
 if(a==='origin-inbox-more'){originInboxLimit+=40;return renderOriginInbox()}
 if(a==='origin-inbox-unread-quick'){originInboxReadFilter=originInboxReadFilter==='unread'?'all':'unread';originInboxLimit=40;return renderOriginInbox()}
 if(a==='origin-inbox-read')return originInboxRead(id);
 if(a==='origin-inbox-read-all')return originInboxReadAll();
 if(a==='origin-inbox-open'){
  if(!findItem(kind,id))return notify('該当の記録が見つかりません。');
  const list=$('#originInboxList');
  const selected=el.closest('[data-inbox-id]');
  const returnContext={user:snapshot.currentUser,scrollTop:list?.scrollTop||0,notificationId:selected?.dataset.inboxId||''};
  closeOriginInbox(false);
  panelShow(kind,id,false);
  // A failed navigation must not leave a stale return context.
  originInboxReturn=panelOpen&&panelId===id&&panelKind===kind?returnContext:null;
  return;
 }
 if(a==='theme')return setTheme();
 if(a==='task-advanced-toggle'){
  taskAdvancedOpen=!taskAdvancedOpen;render();
  $('#workspace [data-action="task-advanced-toggle"]')?.focus({preventScroll:true});return;
 }
 if(a==='memo-advanced-toggle'){
  memoAdvancedOpen=!memoAdvancedOpen;render();
  $('#workspace [data-action="memo-advanced-toggle"]')?.focus({preventScroll:true});return;
 }
 if(a==='todo-clear-query'){
  if(view!=='todos'||!todoSearchOpen||!todoQuery.trim())return;
  // Clear only the typed query; keep the history opt-in and the search panel.
  todoQuery='';
  todoPendingLimit=TODO_RENDER_BATCH;
  todoCompletedLimit=TODO_RENDER_BATCH;
  render();
  $('#originTodoQuery')?.focus({preventScroll:true});
  return;
 }
 if(a==='todo-search-toggle'){
  todoSearchOpen=!todoSearchOpen;
  if(!todoSearchOpen){todoQuery='';todoSearchHistory=false;todoPendingLimit=TODO_RENDER_BATCH;todoCompletedLimit=TODO_RENDER_BATCH;}
  render();
  if(todoSearchOpen)$('#originTodoQuery')?.focus({preventScroll:true});
  return;
 }
 if(a==='todo-search-history'){
  if(view!=='todos'||!todoSearchOpen)return;
  todoSearchHistory=!todoSearchHistory;
  todoPendingLimit=TODO_RENDER_BATCH;todoCompletedLimit=TODO_RENDER_BATCH;
  if(todoSearchHistory)todoCompletedOpen=true;
  render();
  $('#workspace [data-action="todo-search-history"]')?.focus({preventScroll:true});
  return;
 }
 if(a==='jump-result')return focusOriginFirstResult(kind);
 if(a==='todo-completed-toggle'){todoCompletedOpen=!todoCompletedOpen;return render()}
 if(a==='todo-load-more'||a==='todo-show-all'){
  if(view!=='todos'||!['pending','completed'].includes(value))return;
  if(value==='completed'&&!todoCompletedOpen)return;
  const parent=value==='pending'?$('#workspace .origin-todo-list'):$('#originCompletedTodos');
  if(!parent||!el.closest('.origin-todo-more')||!parent.contains(el))return;
  const oldCount=parent.querySelectorAll('.todo-entry').length;
  const limit=a==='todo-show-all'?Infinity:oldCount+TODO_RENDER_BATCH;
  if(value==='completed')todoCompletedLimit=limit;else todoPendingLimit=limit;
  render();
  const nextParent=value==='pending'?$('#workspace .origin-todo-list'):$('#originCompletedTodos');
  const next=nextParent?.querySelectorAll('.todo-entry')[oldCount];
  const first=next?.querySelector('.todo-text');
  if(first){first.focus({preventScroll:true});next.scrollIntoView({block:'nearest',behavior:'instant'});}
  return;
 }
 if(a==='today-task-filter'){
   if(!['active','late','waiting'].includes(value))return;
   taskFilter=value==='waiting'?'active':value;
   taskStatusChoice=value==='waiting'?'確認待ち':'';
   taskQuery='';taskCollapsedGroups.clear();taskVisibleLimits.clear();selectedBulk.clear();
   viewScrollPositions.tasks=0;
   return handleRoute('tasks');
  }
  if(a==='today-calendar-day'){
   scheduleView='day';
   viewScrollPositions.calendar=0;
   return handleRoute('calendar');
  }
  if(a==='detail-prev'||a==='detail-next')return navigateDetail(a==='detail-prev'?-1:1);
 if(a==='related-open')return openOriginRelatedDetail(kind,id);
 if(a==='related-back')return backOriginRelatedDetail();
 if(a==='schedule-filter-toggle'){
  scheduleFiltersOpen=!scheduleFiltersOpen;render();
  (scheduleFiltersOpen?$('#originScheduleSearch'):$('#workspace [data-action="schedule-filter-toggle"]'))?.focus({preventScroll:true});
  return;
 }
 if(a==='schedule-filter-reset'){
  scheduleQuery='';scheduleAssignee='all';scheduleCategory='all';scheduleDateFrom='';scheduleDateTo='';scheduleSearchSort='upcoming';scheduleSearchScope='week';scheduleSearchLimit=30;scheduleFiltersOpen=false;render();
  (window.innerWidth<=770?$('#workspace [data-action="schedule-filter-toggle"]'):$('#originScheduleSearch'))?.focus({preventScroll:true});
  return;
 }
 if(a==='schedule-advanced-toggle'){scheduleAdvancedOpen=!scheduleAdvancedOpen;render();return}
 if(a==='schedule-search-scope'){
  if(!['week','all'].includes(value)||scheduleSearchScope===value)return;
  scheduleSearchScope=value;scheduleSearchLimit=30;render();
  $('#workspace [data-action="schedule-search-scope"][data-value="'+value+'"]')?.focus({preventScroll:true});
  return;
 }
 if(a==='schedule-global-more'){
  if(view!=='calendar'||scheduleSearchScope!=='all')return;
  const oldCount=scheduleSearchLimit;scheduleSearchLimit+=30;render();
  const row=$('#workspace .origin-schedule-global-item:nth-child('+(oldCount+1)+')');
  const next=row?.querySelector('[data-action="schedule-global-week"]')
    ||$('#workspace [data-action="schedule-global-more"]');
  next?.focus({preventScroll:true});next?.scrollIntoView({block:'nearest',behavior:'instant'});
  return;
 }
 if(a==='schedule-global-week'){
  if(view!=='calendar'||scheduleSearchScope!=='all')return;
  const event=data.events.find(e=>e.id===id);
  if(!event||!/^\d{4}-\d{2}-\d{2}$/.test(event.date))return notify('予定が見つかりません。検索し直してください。');
  selectedDay=event.date;scheduleView='week';scheduleSearchScope='week';scheduleFiltersOpen=false;scheduleSearchLimit=30;scheduleExpandedDays.add(event.date);render();
  const target=Array.from($('#workspace').querySelectorAll('[data-action="open"][data-kind="events"]'))
    .find(button=>button.dataset.id===id&&button.getClientRects().length);
  if(target){target.focus({preventScroll:true});target.scrollIntoView({block:'center',behavior:'instant'});}
  else $('#workspace .origin-week-jump [data-action="schedule-week-focus"][aria-pressed="true"]')?.focus({preventScroll:true});
  return;
 }
 if(a==='calendar-view'){scheduleView=['week','agenda','day'].includes(value)?value:'week';return render()}
 if(a==='calendar-day'){if(/^\d{4}-\d{2}-\d{2}$/.test(el.dataset.date||'')){selectedDay=el.dataset.date;scheduleView='day';return render()}}
 if(a==='schedule-day-expand'){
   const date=el.dataset.date||'';
   if(view!=='calendar'||scheduleView!=='week'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
   if(scheduleExpandedDays.has(date))scheduleExpandedDays.delete(date);
   else scheduleExpandedDays.add(date);
   render();
   $('#workspace .origin-agenda-more[data-date="'+date+'"]')?.focus({preventScroll:true});
   return;
 }
 if(a==='schedule-week-focus'){
  const date=el.dataset.date||'';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||view!=='calendar'||scheduleView!=='week')return;
  selectedDay=date;scheduleExpandedDays.add(date);render();
  const day=$('#workspace .mobile-agenda .agenda-day[data-date="'+date+'"]');
  day?.scrollIntoView({block:'start',behavior:'instant'});
  day?.querySelector('.origin-agenda-day-label')?.focus({preventScroll:true});
  return;
 }
 if(a==='day-prev'||a==='day-next'){selectedDay=shift(selectedDay,a==='day-prev'?-1:1);return render()}
 if(a==='create-menu')return openCreateMenu();
 if(a==='schedule-duration'){
   const f=$('#editForm');if(!f||f.dataset.kind!=='events')return;
   const start=new Date(f.elements.namedItem('startAt')?.value||'');
   const minutes=Number(el.dataset.minutes);
   if(!Number.isFinite(start.getTime())||![30,60,120].includes(minutes))return;
   f.elements.namedItem('endAt').value=scheduleLocalInput(new Date(start.getTime()+minutes*60000));
   invalidateOriginBatchReview(f);
   const msg=f.querySelector('#originScheduleError');if(msg&&!f.querySelector('#originFieldError'))msg.hidden=true;
   updateOriginDraftState();
   return;
 }
 if(a==='new'){if(!closePanel(false,false))return;detailSequence=null;detailTrail=[];panelReturnSearch=null;panelReturnAnchor=null;scheduleGlobalReturn=null;$('#createMenu').hidden=true;return panelShow(kind,null,true,{date:el.dataset.date||selectedDay})}
 if(a==='list-quick-edit'){
   const routes={tasks:'tasks',todos:'todos',memos:'notes'};
   if(panelOpen||routes[kind]!==view||!id||!findItem(kind,id))return;
   // Preserve the source card's sequence and scroll context: the shortcut
   // is a sibling button rather than the detail-opening title/card.
   const card=originReturnCard(kind,id);
   if(!card)return;
   detailTrail=[];panelReturnSearch=null;scheduleGlobalReturn=null;
   panelReturnAnchor=captureOriginReturnAnchor(kind,id,el);
   captureDetailSequence(kind,id,card);
   return panelShow(kind,id,true);
 }
 if(a==='open'||a==='search-open'){
   if(!panelOpen){
     detailTrail=[];panelReturnSearch=a==='search-open'?{kind,id}:null;
     panelReturnAnchor=a==='open'?captureOriginReturnAnchor(kind,id,el):null;
     const row=a==='open'&&kind==='events'&&view==='calendar'?el.closest('.origin-schedule-global-item'):null;
     scheduleGlobalReturn=row?{id,top:row.getBoundingClientRect().top}:null;
   }
   captureDetailSequence(kind,id,el);
   if(a==='search-open')closeSearch();
   return panelShow(kind,id,false);
 }
 if(a==='close')return closePanel();
 if(a==='origin-edit-back-detail')return returnOriginEditorToDetail();
 if(a==='edit')return panelShow(kind,id,true);
 if(a==='delete')return deleteItem(kind,id);
 if(a==='task-done'){toggleTaskDone(id);return}
 if(a==='todo-toggle'){toggleTodo(id);return}
 if(a==='pick-day'){selectedDay=el.dataset.date;return render()}
 if(a==='pick-today'){selectedDay=base;return render()}
 if(a==='week-prev'||a==='week-next'){
  const fromBottom=Boolean(el.closest('.origin-mobile-week-actions'));
  selectedDay=shift(selectedDay,a==='week-prev'?-7:7);render();
  if(fromBottom){
   $('#workspace .origin-week-jump')?.scrollIntoView({block:'start',behavior:'instant'});
   $('#workspace .origin-week-jump button[aria-pressed="true"]')?.focus({preventScroll:true});
  }
  return;
 }
 if(a==='task-filter'){taskFilter=value;taskStatusChoice='';taskVisibleLimits.clear();selectedBulk.clear();return render()}
 if(a==='task-density'){taskDensity=taskDensity==='compact'?'comfortable':'compact';return render()}
 if(a==='task-load-more'||a==='task-show-all'){
  const groupKey=el.dataset.value||'',rowGroup=el.closest('.origin-task-group-rows');
  if(!rowGroup||rowGroup.hidden||rowGroup.dataset.groupKey!==groupKey
    ||!groupKey.startsWith(taskGrouping+'|'))return;
  const oldCount=rowGroup.querySelectorAll('.item-row').length;
  taskVisibleLimits.set(groupKey,a==='task-show-all'?Infinity:oldCount+TASK_RENDER_BATCH);
  render();
  // Place keyboard focus on the first newly revealed item, not the removed button.
  const updated=Array.from($('#workspace').querySelectorAll('.origin-task-group-rows'))
    .find(group=>group.dataset.groupKey===groupKey);
  const next=updated?.querySelectorAll('.item-row')[oldCount];
  const first=next?.querySelector('.item-name');
  if(first){first.focus({preventScroll:true});next.scrollIntoView({block:'nearest',behavior:'instant'})}
  return;
 }
 if(a==='task-group-toggle'){
   const key=el.dataset.value||'';
   if(!key.startsWith(taskGrouping+'|'))return;
   if(taskCollapsedGroups.has(key))taskCollapsedGroups.delete(key);
   else{
     // Prevent hidden selections from being completed by an unrelated bulk action.
     for(const box of el.closest('.group-title')?.nextElementSibling?.querySelectorAll('[data-action="bulk-toggle"]')||[])
       selectedBulk.delete(box.dataset.id);
     taskCollapsedGroups.add(key);
   }
   return render();
 }
 if(a==='task-reset'){taskQuery='';taskFilter='active';taskStatusChoice='';taskCollapsedGroups.clear();taskVisibleLimits.clear();selectedBulk.clear();return render()}
 if(a==='filter-status'){taskStatusChoice=taskStatusChoice===el.dataset.status?'':el.dataset.status;taskFilter='all';taskVisibleLimits.clear();selectedBulk.clear();return render()}
 if(a==='memo-load-more'||a==='memo-show-all'){
  if(view!=='notes'||!$('#workspace .origin-memo-more'))return;
  const oldCount=$('#workspace .memo-grid')?.querySelectorAll('.memo-card').length||0;
  memoVisibleLimit=a==='memo-show-all'?Infinity:oldCount+MEMO_RENDER_BATCH;
  render();
  // Move to the first newly revealed memo, preserving the reader's position.
  const next=$('#workspace .memo-grid')?.querySelectorAll('.memo-card')[oldCount];
  if(next){next.focus({preventScroll:true});next.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'})}
  return;
 }
 if(a==='memo-layout'){memoLayout=value==='list'?'list':'cards';return render()}
 if(a==='memo-filter'){memoFilter=value;memoVisibleLimit=MEMO_RENDER_BATCH;return render()}
 if(a==='memo-color-filter'){memoColorFilter=value;memoVisibleLimit=MEMO_RENDER_BATCH;return render()}
 if(a==='memo-reset'){memoFilter='all';memoColorFilter='all';memoQuery='';memoVisibleLimit=MEMO_RENDER_BATCH;return render()}
 if(a==='memo-color'){
  const m=findItem('memos',id);if(!m||memoColor(m.paperColor)===value)return;
  const user=snapshot.currentUser,room=snapshot.roomId,filter=memoColorFilter;
  const cards=Array.from($('#workspace').querySelectorAll('.origin-memo-shell .memo-card[data-id]'));
  const priorIds=cards.map(button=>button.dataset.id),position=priorIds.indexOf(id);
  const leavingFilter=filter!=='all'&&filter!==value;
  const label=leavingFilter
    ?'メモの色を変更しました。現在の色の絞り込みから外れました。':'メモの色を変更しました';
  return send({type:'memo.update',id,revision:m.revision,ownerRoom:room,ownerUser:user,title:m.title,category:m.category,body:m.body,tags:[...m.tags],pinned:Boolean(m.pinned),paperColor:memoColor(value)},label).then(ok=>{
    if(!ok||view!=='notes'||snapshot.currentUser!==user||snapshot.roomId!==room||memoColorFilter!==filter)return;
    const workspace=$('#workspace');
    // Reuse the recolored swatch if the memo remains in this view.
    const swatch=Array.from(workspace.querySelectorAll('[data-action="memo-color"]'))
      .find(button=>button.dataset.id===id&&button.dataset.value===value);
    if(swatch){swatch.focus({preventScroll:true});return}
    // If it leaves the filtered view, return to the nearest remaining memo.
    const visible=Array.from(workspace.querySelectorAll('.origin-memo-shell .memo-card[data-id]'));
    const after=priorIds.slice(Math.max(0,position+1));
    const before=priorIds.slice(0,Math.max(0,position)).reverse();
    const target=after.concat(before).map(key=>visible.find(button=>button.dataset.id===key))
      .find(Boolean)||visible[0]||workspace.querySelector(
        '[data-action="memo-color-filter"][data-value="'+filter+'"]');
    target?.focus({preventScroll:true});
  });
}
 if(a==='bulk-clear'){selectedBulk.clear();return render()}
 if(a==='bulk-done'){
   const items=snapshot.tasks.filter(t=>selectedBulk.has(t.id))
     .map(t=>({id:t.id,revision:t.revision}));
   if(!items.length){notify('完了するタスクを選択してください。');return}
   if(items.length!==selectedBulk.size){notify('選択したタスクが変更されています。選び直してください。');selectedBulk.clear();render();return}
   if(!window.confirm(items.length+'件のタスクを完了にしますか？'))return;
   return send({type:'task.bulk.complete',items,
     ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser},
     items.length+'件のタスクを完了しました').then(ok=>{if(ok){selectedBulk.clear();render()}});
 }
 if(a==='memo-task'){const m=findItem('memos',id);if(!m)return;return panelShow('tasks',null,true,{title:m.title,desc:m.body,category:snapshot.categories[0]||'その他'})}
 if(a==='undo')return;
}
setIconPlaceholders(mount);initTheme();selectOriginColorMode();syncSnapshot();render();
// Subscriptions can arrive during Japanese IME composition. Defer only the
// presentation refresh until compositionend (which already renders the final
// committed query); always ingest the canonical snapshot immediately.
function refreshFromCanonical(){
 const sr=$('#searchResults'),active=mount.activeElement;
 const open=!sr.hidden&&$('#originSearchInput').value.trim()&&!searchComposing;
 const selectedHit=active?.dataset?.action==='search-open'
   ?{kind:active.dataset.kind,id:active.dataset.id}:null;
 const selectedKind=active?.dataset?.action==='search-kind'?active.dataset.value:null;
 syncSnapshot();
 syncOriginSharedControls();
 if(taskComposing||memoComposing||scheduleComposing||todoComposing)return;
 render();
 if(open){
   renderSearch($('#originSearchInput').value);
   const buttons=Array.from(sr.querySelectorAll('button'));
   const target=selectedHit?buttons.find(button=>button.dataset.action==='search-open'
     &&button.dataset.kind===selectedHit.kind&&button.dataset.id===selectedHit.id)
     :selectedKind?buttons.find(button=>button.dataset.action==='search-kind'&&button.dataset.value===selectedKind):null;
   if(selectedHit||selectedKind)(target||$('#originSearchInput')).focus({preventScroll:true});
 }
}
bridge.subscribe(s=>{snapshot=s;refreshFromCanonical()});
memoBridge?.subscribe?.(items=>{memoItems=items;refreshFromCanonical()});
window.addEventListener('workboard:task-starts-changed',refreshFromCanonical);
let originWorkflowRenderPending=false;
for(const event of ['workflow-v150-update','workflow-v152-update'])window.addEventListener(event,()=>{
 if(originWorkflowRenderPending)return;
 originWorkflowRenderPending=true;
 queueMicrotask(()=>{originWorkflowRenderPending=false;restoreOriginTaskView();originInboxUpdateBadge();if($('#originInboxDialog')?.open)renderOriginInbox();if(['today','tools','tasks'].includes(view)&&document.documentElement.dataset.wbDisplay==='modern')render()});
});
$('#originInboxDialog').addEventListener('cancel',e=>{e.preventDefault();closeOriginInbox()});
$('#originInboxDialog').addEventListener('click',e=>{if(e.target===$('#originInboxDialog'))closeOriginInbox()});
mount.addEventListener('click',e=>{
 const target=e.target;
 if(!target.closest('.origin-header-settings'))closeOriginSettings();
 const route=target.closest('[data-route]');if(route){handleRoute(route.dataset.route);return}
 const action=target.closest('[data-action]');if(action){if(['todo-check','bulk-toggle','task-check'].includes(action.dataset.action))return;handleAction(action);return}
 if(!target.closest('#createMenu')&&!target.closest('#createBtn'))$('#createMenu').hidden=true;
 if(!target.closest('#searchbox'))closeSearch();
 if(target.id==='overlay')closePanel();
});
mount.addEventListener('change',e=>{
 if(e.target.id==='originInboxReadFilter'){originInboxReadFilter=['all','unread','read'].includes(e.target.value)?e.target.value:'all';originInboxLimit=40;renderOriginInbox();return}
 if(e.target.matches('[data-origin-mention]')&&e.target.value){const form=$('#originCommentForm');form.elements.text.value+=(form.elements.text.value?' ':'')+'@'+e.target.value+' ';e.target.value='';form.elements.text.focus();return;}

 if(e.target.closest?.('#editForm')){
   const form=e.target.closest('#editForm');
   if(form.dataset.kind==='events'){syncOriginBatchFields(form);invalidateOriginBatchReview(form);}
   if(form.dataset.kind==='tasks')syncOriginRecurrenceFields(form);
   reconcileOriginFieldError(e.target.closest('#editForm'),e.target);
   updateOriginDraftState();
 }
  const t=e.target;if(t.id==='originUserSelect'){
   const old=snapshot.currentUser,next=t.value;if(next===old)return;
   if(busy){t.value=old;notify('保存処理中です。完了後に利用者を切り替えてください。');return;}
   if(!snapshot.users?.includes(next)){t.value=old;return notify('利用者を切り替えられませんでした。')}
   const quick=$('#workspace [data-form="quick-todo"] [name="title"]');
   const draft=quick?.value||quickTodoDraft;
   const modified=panelOpen&&panelMode==='edit'&&formSnapshot($('#editForm'))!==initialFormSnapshot;
   const commentDraft=originDetailHasDraft()||Object.keys(originManagementDrafts).length>0;
   if((modified||draft.trim()||commentDraft)&&!window.confirm('入力中の変更を破棄して利用者を切り替えますか？')){t.value=old;return}
   if(panelOpen)closePanel(true,false);
   detailSequence=null;detailTrail=[];panelReturnSearch=null;panelReturnAnchor=null;
   // Clear the live input as well: bridge subscribers can render synchronously.
   if(quick)quick.value='';
   quickTodoDraft='';for(const key of Object.keys(originManagementDrafts))delete originManagementDrafts[key];originToolQuery='';originToolLimit=60;
   closeOriginInbox(false);originInboxReturn=null;
   const result=bridge.selectUser?.(next);
   if(!result?.ok){quickTodoDraft=draft;t.value=old;render();notify('利用者を切り替えられませんでした。');return}
   selectedBulk.clear();taskCollapsedGroups.clear();taskVisibleLimits.clear();memoVisibleLimit=MEMO_RENDER_BATCH;taskAdvancedOpen=false;memoAdvancedOpen=false;taskQuery='';todoQuery='';todoSearchOpen=false;todoSearchHistory=false;todoCompletedOpen=false;todoPendingLimit=TODO_RENDER_BATCH;todoCompletedLimit=TODO_RENDER_BATCH;taskFilter='active';taskStatusChoice='';memoFilter='all';memoColorFilter='all';memoQuery='';scheduleAssignee='all';scheduleQuery='';scheduleFiltersOpen=false;scheduleSearchScope='week';scheduleSearchLimit=30;scheduleCategory='all';scheduleDateFrom='';scheduleDateTo='';scheduleSearchSort='upcoming';scheduleGlobalReturn=null;scheduleGlobalResultIds=[];scheduleWeekResultIds=[];scheduleExpandedDays.clear();
   Object.keys(viewScrollPositions).forEach(key=>delete viewScrollPositions[key]);
   if(view==='search')view='today';
   originFullSearchQuery='';originFullSearchReturn='today';originFullSearchLimit=30;originFullSearchSort='relevance';
   closeSearch(true);syncSnapshot();render();window.scrollTo({top:0,behavior:'instant'});notify('利用者を切り替えました。');
   return;
 }
  if(t.id==='originDateJump'){if(/^\d{4}-\d{2}-\d{2}$/.test(t.value)){selectedDay=t.value;render()}return}
 if(t.id==='originScheduleAssignee'){scheduleAssignee=t.value;scheduleSearchLimit=30;render();return}
 if(t.id==='originScheduleCategory'){scheduleCategory=t.value;scheduleSearchLimit=30;render();return}
 if(t.id==='originScheduleFrom'||t.id==='originScheduleTo'){
  const date=/^\d{4}-\d{2}-\d{2}$/.test(t.value)?t.value:'';
  if(t.id==='originScheduleFrom')scheduleDateFrom=date;else scheduleDateTo=date;
  scheduleSearchLimit=30;render();return;
 }
 if(t.id==='originScheduleSort'){
  if(!['upcoming','newest','oldest'].includes(t.value))return;
  scheduleSearchSort=t.value;scheduleSearchLimit=30;render();return;
 }
 if(t.id==='originFullSearchSort'){originFullSearchSort=['relevance','title'].includes(t.value)?t.value:'relevance';originFullSearchLimit=30;render();$('#originFullSearchSort')?.focus({preventScroll:true});return}
 if(t.id==='originMemoSort'){memoSort=['updated','title','category'].includes(t.value)?t.value:'updated';memoVisibleLimit=MEMO_RENDER_BATCH;render();return}
 if(t.id==='groupSelect'){taskGrouping=t.value;taskVisibleLimits.clear();selectedBulk.clear();render();return}
 if(t.id==='originTaskSort'){taskSortMode=['due','priority','updated'].includes(t.value)?t.value:'due';taskVisibleLimits.clear();selectedBulk.clear();render();return}
  if(t.dataset.action==='task-inline-status'){updateOriginInlineStatus(t);return}
 if(t.dataset.action==='task-check'){taskCheckToggle(t);return}
 if(t.dataset.action==='todo-check'){toggleTodo(t.dataset.id,t.checked);return}
 if(t.dataset.action==='bulk-toggle'){if(t.checked)selectedBulk.add(t.dataset.id);else selectedBulk.delete(t.dataset.id);render();return}
});
mount.addEventListener('focusin',e=>{
 if(!$('#originSettingsPanel').hidden&&!e.target.closest('.origin-header-settings'))closeOriginSettings();
});
mount.addEventListener('input',e=>{if(e.target.id==='originInboxSearch'&&!e.isComposing){originInboxQuery=e.target.value;originInboxLimit=40;renderOriginInbox()}});
mount.addEventListener('compositionstart',e=>{
 if(e.target.id==='originScheduleSearch')scheduleComposing=true;
 if(e.target.id==='originRelatedTaskSearch')relatedTaskComposing=true;
 if(e.target.id==='originMemoQuery')memoComposing=true;
 if(e.target.id==='originTaskQuery')taskComposing=true;
 if(e.target.id==='originTodoQuery')todoComposing=true;
 if(e.target.id==='originFullSearchInput')originFullSearchComposing=true;
});
mount.addEventListener('compositionend',e=>{
 if(e.target.id==='originInboxSearch'){originInboxQuery=e.target.value;originInboxLimit=40;renderOriginInbox();return}
 if(e.target.id==='originScheduleSearch'){scheduleComposing=false;updateScheduleSearch(e.target)}
 if(e.target.id==='originRelatedTaskSearch'){relatedTaskComposing=false;filterOriginRelatedTasks()}
 if(e.target.id==='originMemoQuery'){memoComposing=false;updateMemoQuery(e.target)}
 if(e.target.id==='originTaskQuery'){taskComposing=false;updateTaskQuery(e.target)}
 if(e.target.id==='originTodoQuery'){todoComposing=false;updateTodoQuery(e.target)}
 if(e.target.id==='originFullSearchInput'){originFullSearchComposing=false;updateOriginFullSearchQuery(e.target)}
});
function updateScheduleSearch(input){
 const start=input.selectionStart,end=input.selectionEnd;
 scheduleQuery=input.value;scheduleSearchLimit=30;render();
 const next=$('#originScheduleSearch');
 if(next){next.focus({preventScroll:true});if(start!==null)next.setSelectionRange(start,end)}
}
function updateTodoQuery(input){
 const start=input.selectionStart,end=input.selectionEnd;
 todoQuery=input.value;todoPendingLimit=TODO_RENDER_BATCH;todoCompletedLimit=TODO_RENDER_BATCH;render();
 const next=$('#originTodoQuery');
 if(next){next.focus({preventScroll:true});if(start!==null)next.setSelectionRange(start,end)}
}
function updateMemoQuery(input){
 const start=input.selectionStart,end=input.selectionEnd;
 memoQuery=input.value;memoVisibleLimit=MEMO_RENDER_BATCH;render();
 const next=$('#originMemoQuery');
 if(next){next.focus({preventScroll:true});if(start!==null)next.setSelectionRange(start,end)}
}
function updateTaskQuery(input){
 const start=input.selectionStart,end=input.selectionEnd;
 taskQuery=input.value;taskVisibleLimits.clear();selectedBulk.clear();render();
 const next=$('#originTaskQuery');
 if(next){next.focus({preventScroll:true});if(start!==null)next.setSelectionRange(start,end)}
}
mount.addEventListener('focusin',e=>{
  if(e.target.closest?.('#editForm')&&window.innerWidth<=770)requestAnimationFrame(syncOriginEditorViewport);
 });
 mount.addEventListener('focusout',e=>{
  if(e.target.closest?.('#editForm')&&window.innerWidth<=770)requestAnimationFrame(syncOriginEditorViewport);
 });
 window.visualViewport?.addEventListener('resize',syncOriginEditorViewport);
 window.visualViewport?.addEventListener('scroll',syncOriginEditorViewport);
 window.addEventListener('resize',syncOriginEditorViewport);
 // Switching between mobile/desktop rebuilds only the relevant calendar markup.
 window.addEventListener('resize',()=>{
   if(view==='calendar'&&(window.innerWidth<=770)!==calendarRenderedMobile)render();
 });
 mount.addEventListener('invalid',e=>{
 const form=e.target?.form;
 if(form?.id!=='editForm'||!e.target.matches?.('input,select,textarea'))return;
 e.preventDefault();
 hideOriginSaveRecovery();
 if(form.querySelector('#originFieldError'))return;
 const message=e.target.validity.valueMissing?'必須項目を入力してください。':
   e.target.validity.tooLong?'入力文字数が上限を超えています。':'入力内容を確認してください。';
 const region=form.querySelector('#originEditorError');
 if(region){region.hidden=false;region.textContent=message}
 markOriginInvalidField(form,e.target.name,message);
},true);
mount.addEventListener('input',e=>{
 if(e.target.dataset.managementDraft){originManagementDrafts[e.target.dataset.managementDraft]=e.target.value;return;}
 if(e.target.id==='originToolQuery'&&!e.isComposing){originToolQuery=e.target.value;originToolLimit=60;render();return;}

 if(e.target.id==='originRelatedTaskSearch'){if(!e.isComposing&&!relatedTaskComposing)filterOriginRelatedTasks();return;}
 if(e.target.id==='originTodoQuery'){
   if(!e.isComposing&&!todoComposing)updateTodoQuery(e.target);
   return;
 }
 if(e.target.id==='originFullSearchInput'){
   if(!e.isComposing&&!originFullSearchComposing)updateOriginFullSearchQuery(e.target);
   return;
 }
 if(e.target.id==='originTaskQuery'){
   if(!e.isComposing&&!taskComposing)updateTaskQuery(e.target);
   return;
 }
 if(e.target.id==='originMemoQuery'){
   if(!e.isComposing&&!memoComposing)updateMemoQuery(e.target);
   return;
 }
 if(e.target.id==='originScheduleSearch'){
   if(!e.isComposing&&!scheduleComposing)updateScheduleSearch(e.target);
   return;
 }
 if(e.target.matches('[data-form="quick-todo"] [name="title"]'))quickTodoDraft=e.target.value;
 const f=e.target.form;
 if(f?.id==='editForm'&&f.dataset.kind==='tasks'&&!f.querySelector('#originFieldError')){const message=f.querySelector('#originTaskError');if(message)message.hidden=true;}
 if(f?.id==='editForm'){
  reconcileOriginFieldError(f,e.target);
  if(!f.querySelector('#originFieldError')){
   const error=f.querySelector('#originEditorError');if(error)error.hidden=true;
  }
  updateOriginDraftState();
 }
  if(f?.id==='editForm'&&f.dataset.kind==='events'){
   invalidateOriginBatchReview(f);
   const msg=f.querySelector('#originScheduleError');if(msg)msg.hidden=true;
 }
});
mount.addEventListener('submit',e=>{const form=e.target;
 if(form.id==='originCommentForm'){e.preventDefault();submitOriginComment(form);return}
 if(form.matches('[data-form="quick-todo"]')){e.preventDefault();const inp=form.querySelector('[name="title"]');const title=inp.value;quickTodo(title);return}
 if(form.id==='editForm'){e.preventDefault();saveForm(form);return}
});
$('#originColorSelect').addEventListener('change',e=>{
 const id=e.target.value;
 const option=document.querySelector('#wbColorThemeDialog [data-theme="'+CSS.escape(id)+'"]');
 if(option){option.click();selectOriginColorMode()}
 else{notify('カラー設定を読み込めませんでした。Classicで色を変更してください。');syncOriginColorTheme()}
});
new MutationObserver(selectOriginColorMode).observe(document.documentElement,{attributes:true,attributeFilter:['data-wb-color-theme']});
$('#originDisplaySelect').addEventListener('change',e=>{
 const mode=e.target.value;
 if(panelOpen&&!closePanel()){e.target.value='modern';return;}
 window.WorkBoardDisplayController?.selectMode?.(mode);
 e.target.value='modern';
});
$('#originSearchInput').addEventListener('input',e=>{
 if(!searchComposing&&!e.isComposing)renderSearch(e.target.value);
});
$('#originSearchInput').addEventListener('focus',e=>{
 if(!panelOpen&&e.target.value.trim())renderSearch(e.target.value);
});
$('#originSearchInput').addEventListener('compositionstart',()=>{searchComposing=true});
$('#originSearchInput').addEventListener('compositionend',e=>{
 searchComposing=false;renderSearch(e.target.value);
});
// Detail-only swipe browsing: leave editing, native scrolling and controls untouched.
let detailSwipeStart=null;
mount.addEventListener('touchstart',e=>{
 detailSwipeStart=null;
 if(!panelOpen||panelMode!=='detail'||window.innerWidth>770||e.touches.length!==1)return;
 const target=e.target;
 const body=$('#sheet .sheet-body');
 if(!(target instanceof Element)||!body?.contains(target))return;
 if(target.closest('button,a,input,select,textarea,label,[role="button"],[role="link"],[contenteditable],.origin-detail-controls'))return;
 // Horizontally scrollable content takes precedence over record navigation.
 for(let el=target;el&&el!==body;el=el.parentElement){
   if(el.scrollWidth>el.clientWidth+6)return;
 }
 const touch=e.touches[0];
 detailSwipeStart={identifier:touch.identifier,x:touch.clientX,y:touch.clientY,
   at:Date.now(),kind:panelKind,id:panelId};
},{passive:true});
mount.addEventListener('touchend',e=>{
 const start=detailSwipeStart;detailSwipeStart=null;
 if(!start||!panelOpen||panelMode!=='detail'||window.innerWidth>770
   ||panelKind!==start.kind||panelId!==start.id||Date.now()-start.at>900)return;
 const touch=Array.from(e.changedTouches).find(item=>item.identifier===start.identifier);
 if(!touch)return;
 const dx=touch.clientX-start.x,dy=touch.clientY-start.y;
 if(Math.abs(dx)<85||Math.abs(dx)<=Math.abs(dy)*1.5||Math.abs(dy)>65)return;
 if(window.getSelection?.()?.toString().trim())return;
 navigateDetail(dx>0?-1:1);
},{passive:true});
mount.addEventListener('touchcancel',()=>{detailSwipeStart=null},{passive:true});
mount.addEventListener('keydown',e=>{
 const inboxDialog=$('#originInboxDialog');
 if(inboxDialog?.open){
  const tab=e.target.closest?.('[data-action="origin-inbox-section"]');
  if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
   e.preventDefault();
   const tabs=Array.from(inboxDialog.querySelectorAll('[data-action="origin-inbox-section"]'));
   const next=e.key==='Home'?tabs[0]:e.key==='End'?tabs[tabs.length-1]:
     tabs[(tabs.indexOf(tab)+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];
   next?.click();next?.focus({preventScroll:true});return;
  }
  if(e.key==='Escape'){e.preventDefault();closeOriginInbox();return}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();return}
  if(e.key==='Tab'){
   const focusables=Array.from(inboxDialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled])')).filter(node=>node.getClientRects().length);
   const first=focusables[0],last=focusables[focusables.length-1];
   if(first&&((e.shiftKey&&mount.activeElement===first)||(!e.shiftKey&&mount.activeElement===last))){
    e.preventDefault();(e.shiftKey?last:first).focus();return;
   }
  }
  return;
 }
 if(e.key==='Escape'&&!$('#originSettingsPanel').hidden){e.preventDefault();closeOriginSettings(true);return}
 if(panelOpen){
   // Prevent global search from stealing focus from an open modal.
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();return}
   if(handleOriginModalKeys(e))return;
 }
 if(e.key==='Enter'&&!e.isComposing&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.repeat){
   const matchKind={originTaskQuery:'tasks',originMemoQuery:'memos',
    originScheduleSearch:'events',originTodoQuery:'todos'}[e.target.id];
   if(matchKind){e.preventDefault();focusOriginFirstResult(matchKind);return;}
 }
 const input=$('#originSearchInput'),results=$('#searchResults');
 const hit=e.target.closest?.('.search-hit'),inResults=results.contains(e.target);
 if(!panelOpen&&(e.target===input||inResults)){
   if(e.key==='Escape'){
     e.preventDefault();closeSearch(true);input.focus({preventScroll:true});return;
   }
   if(!results.hidden){
     const hits=Array.from(results.querySelectorAll('.search-hit'));
     if(e.key==='ArrowDown'&&(e.target===input||hit)){
       if(hits.length){e.preventDefault();focusSearchResult(hits[Math.min(hit?hits.indexOf(hit)+1:0,hits.length-1)])}
       return;
     }
     if(e.key==='ArrowUp'&&(e.target===input||hit)){
       e.preventDefault();const previous=hit?hits[hits.indexOf(hit)-1]:null;
       if(previous)focusSearchResult(previous);else input.focus({preventScroll:true});return;
     }
     if(e.key==='Enter'&&e.target===input&&hits.length){
       e.preventDefault();hits[0].click();return;
     }
   }
 }
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){
   e.preventDefault();input.focus();input.select();
   if(input.value.trim())renderSearch(input.value);
   return;
 }
 if(e.key==='Escape'){$('#createMenu').hidden=true;closeSearch()}
});
})();

    document.documentElement.dataset.modernOriginReady='true';
    window.dispatchEvent(new Event('workboard:display-ready'));
  };
  if(window.WORK_BOARD_ASSETS_READY)activate();
  else window.addEventListener('workboard:assets-ready',activate,{once:true});
  document.addEventListener('DOMContentLoaded',activate,{once:true});
  window.addEventListener('workboard:canonical-bridge-ready',activate,{once:true});
})();
