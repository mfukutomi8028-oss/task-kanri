/* origin. Modern workspace: separate Shadow DOM presentation over canonical data. */
(function(){
  'use strict';
  const bridgeReady=()=>Boolean(window.WorkBoardPaletteBridge?.readSnapshot && window.WorkBoardPaletteMemoBridgeV369?.readSnapshot);
  const activate=()=>{
    if(document.getElementById('modernOriginRoot')||!bridgeReady())return;
    const host=document.createElement('div');host.id='modernOriginRoot';
    const mount=host.attachShadow({mode:'open'});
    mount.innerHTML='<style>'+"\n:host{font-family:Inter,\"Noto Sans JP\",\"Yu Gothic\",Meiryo,system-ui,-apple-system,sans-serif;font-size:15px;font-synthesis:none;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;--bg:#f5f5f3;--paper:#fff;--sidebar:#fff;--ink:#252b37;--ink-soft:#526071;--muted:#818a98;--line:#e6e9ed;--line-soft:#eff1f4;--accent:#535fd0;--accent-dark:#3948b8;--accent-bg:#eff0fc;--hover:#f7f8fc;--shadow:0 12px 42px rgba(33,43,70,.035);--success:#23786e;--success-bg:#eaf5f1;--warn:#b3663b;--warn-bg:#fff3eb;--red:#b94c58;--red-bg:#fff0f1;--blue:#477dba;--blue-bg:#eaf2fa}\n:host([data-theme=\"dark\"]){color-scheme:dark;--bg:#151920;--paper:#1d222b;--sidebar:#1b2028;--ink:#ebedf4;--ink-soft:#bdc4d2;--muted:#8f99ac;--line:#333b48;--line-soft:#29313d;--accent:#a3abff;--accent-dark:#bac0ff;--accent-bg:#2e3559;--hover:#272e3a;--shadow:0 16px 46px rgba(0,0,0,.12);--success:#79bfae;--success-bg:#223d39;--warn:#e8a578;--warn-bg:#423125;--red:#e695a0;--red-bg:#402a31;--blue:#93b6ee;--blue-bg:#25364e}\n*{box-sizing:border-box}:host,.app{margin:0;min-height:100%;background:var(--bg);color:var(--ink)}:host{overflow-x:hidden}button,input,select,textarea{font:inherit}button{cursor:pointer}button:disabled{cursor:not-allowed;opacity:.5}input,select,textarea{color:var(--ink)}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,a:focus-visible{outline:3px solid #8c99ed;outline-offset:3px}\nbutton{ -webkit-tap-highlight-color:transparent}a{color:inherit;text-decoration:none}svg{display:block;flex:none}.app{min-height:100vh}.header{position:sticky;top:0;background:color-mix(in srgb,var(--paper) 96%,transparent);backdrop-filter:blur(18px);border-bottom:1px solid var(--line);z-index:30}.header-inner{max-width:1560px;margin:auto;min-height:73px;padding:0 32px;display:flex;align-items:center;gap:32px}.brand{display:flex;align-items:center;gap:11px;flex:none}.brand-emblem{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:#303951;color:white;box-shadow:0 8px 18px #22263b19}.brand-name{font-size:21px;letter-spacing:-1.4px;font-weight:850;line-height:1}.brand-name span{color:var(--accent)}.brand-small{margin-left:8px;font-size:10px;letter-spacing:.1em;color:var(--muted);font-weight:850}.header-nav{display:flex;align-items:center;gap:5px;height:100%;flex:1;min-width:0}.header-nav .nav-button{display:flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:10px;background:transparent;padding:10px 13px;font-weight:740;color:var(--muted);white-space:nowrap}.header-nav .nav-button:hover{background:var(--hover);color:var(--ink)}.header-nav .nav-button.active{background:var(--accent-bg);color:var(--accent-dark)}.header-nav .nav-button svg{width:17px;height:17px;stroke-width:1.9}.header-tools{display:flex;align-items:center;gap:9px}.searchbox{height:41px;display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--bg);border-radius:11px;padding:0 11px;width:218px;color:var(--muted);position:relative}.searchbox input{border:0;outline:0;background:transparent;width:100%;min-width:0;font-size:13px;color:var(--ink)}.searchbox input::placeholder{color:var(--muted)}.kbd{font-size:10px;padding:2px 5px;border:1px solid var(--line);border-radius:4px;white-space:nowrap}.icon-button{width:40px;height:40px;display:grid;place-items:center;color:var(--ink-soft);border:1px solid transparent;border-radius:11px;background:transparent}.icon-button:hover{background:var(--hover);color:var(--ink)}.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;border:1px solid var(--accent);background:#535fd0;border-radius:10px;color:#fff;padding:9px 17px;font-weight:820;font-size:13px;white-space:nowrap}.primary-button:hover{background:#3e4fbc}.primary-button svg{width:17px;height:17px}.header-avatar{width:34px;height:34px;border-radius:50%;background:#e2e7f6;color:#4e5a85;display:grid;place-items:center;font-weight:850;font-size:11px;border:2px solid var(--paper);margin-left:5px}.workspace{max-width:1490px;margin:0 auto;padding:35px 38px 80px}.page-heading{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:25px}.eyebrow{font-size:11px;font-weight:880;letter-spacing:.13em;text-transform:uppercase;color:var(--accent-dark);margin:0 0 10px}.page-heading h1{font-size:clamp(27px,2.65vw,38px);letter-spacing:-1.4px;line-height:1.25;margin:0 0 5px;font-weight:850}.page-heading p.page-desc{font-size:13px;color:var(--muted);margin:4px 0 0;line-height:1.7}.heading-meta{display:flex;align-items:center;gap:11px;color:var(--muted);font-size:12px}.secondary-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--line);border-radius:10px;min-height:39px;background:var(--paper);color:var(--ink-soft);padding:8px 12px;font-weight:720;font-size:12px}.secondary-button:hover{background:var(--hover);border-color:var(--accent)}.secondary-button svg{width:15px;height:15px}.text-button{display:inline-flex;align-items:center;gap:4px;border:0;background:transparent;color:var(--accent-dark);font-size:12px;font-weight:820;padding:7px 3px}.text-button:hover{text-decoration:underline}.quiet-small{color:var(--muted);font-size:11px}.strip{display:flex;align-items:center;gap:10px;overflow-x:auto;scrollbar-width:thin;padding:4px 1px 12px;margin-bottom:17px}.strip-title{min-width:82px;color:var(--muted);font-size:12px;font-weight:820}.day-chip{flex:1 0 78px;min-width:0;min-height:73px;border-radius:12px;border:1px solid var(--line);background:var(--paper);color:var(--ink);padding:10px 8px;text-align:center;display:grid;justify-items:center;gap:3px;position:relative}.day-chip:hover{border-color:var(--accent)}.day-chip.active{background:#343d5f;border-color:#343d5f;color:white;box-shadow:0 10px 25px #2e396422}.day-chip .dow{font-size:10px;color:var(--muted);font-weight:800}.day-chip.active .dow{color:#cbd3f2}.day-chip .number{font-size:19px;font-weight:820;line-height:1}.day-chip .dots{display:flex;gap:3px;height:4px;align-items:center}.tiny-dot{width:4px;height:4px;border-radius:50%;background:#8e98d8}.day-chip.active .tiny-dot{background:#d4d9ff}.day-chip.weekend{color:var(--ink-soft)}.day-chip.weekend.active{color:white}\n.day-grid{display:grid;grid-template-columns:minmax(0,1.48fr) minmax(320px,.82fr);gap:19px;align-items:start}.surface{background:var(--paper);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);min-width:0}.surface-section{padding:24px 26px}.surface-section+.surface-section{border-top:1px solid var(--line)}.section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 16px}.section-head h2{display:flex;align-items:center;gap:10px;font-size:16px;letter-spacing:-.35px;margin:0;font-weight:830}.section-head h2 .count{font-size:11px;color:var(--muted);background:var(--bg);border-radius:7px;padding:4px 7px;letter-spacing:0}.section-meta{font-size:12px;color:var(--muted)}.soft-icon{width:24px;height:24px;display:grid;place-items:center;border-radius:8px;background:var(--accent-bg);color:var(--accent-dark)}.soft-icon svg{width:14px;height:14px}.status-summary{display:flex;gap:17px;margin-bottom:16px;padding:10px 0;border-bottom:1px solid var(--line-soft);flex-wrap:wrap}.status-summary span{font-size:12px;color:var(--muted);display:inline-flex;align-items:center;gap:6px}.status-summary strong{font-size:14px;color:var(--ink)}.status-summary .bullet{width:6px;height:6px;border-radius:50%;background:var(--accent)}.focus-item{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:13px;align-items:start;padding:17px 0;border-bottom:1px solid var(--line-soft)}.focus-item:last-child{border-bottom:0}.focus-order{width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;color:var(--muted);font-size:11px;font-weight:780}.focus-item:first-child .focus-order{background:var(--accent-bg);border-color:var(--accent-bg);color:var(--accent-dark)}.focus-main{min-width:0}.focus-name{background:none;border:none;color:var(--ink);text-align:left;font-weight:780;font-size:15px;line-height:1.5;overflow-wrap:anywhere;padding:0}.focus-name:hover{color:var(--accent-dark)}.focus-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;font-size:11px;color:var(--muted)}.focus-actions{display:flex;align-items:center;gap:7px}.row-action{font-size:11px;font-weight:820;color:var(--accent-dark);background:var(--accent-bg);border:0;border-radius:8px;padding:9px 10px;white-space:nowrap}.row-action:hover{filter:brightness(.97)}.ghost-row-action{border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink-soft);padding:8px;font-size:11px}.ghost-row-action:hover{background:var(--hover)}.tag{display:inline-flex;align-items:center;gap:4px;border-radius:5px;background:var(--bg);padding:3px 7px;font-size:11px;color:var(--ink-soft);font-weight:720}.tag.overdue{background:var(--red-bg);color:var(--red)}.tag.today{background:var(--warn-bg);color:var(--warn)}.tag.waiting{background:var(--blue-bg);color:var(--blue)}.tag.done{background:var(--success-bg);color:var(--success)}.tag.high{background:var(--red-bg);color:var(--red)}.tag.med{background:var(--accent-bg);color:var(--accent-dark)}.tag.low{background:var(--success-bg);color:var(--success)}.right-stack{display:grid;gap:18px}.agenda-line{position:relative;margin:0 0 0 3px;border-left:1px solid var(--line);padding:4px 0 1px 16px}.agenda-entry{position:relative;display:grid;grid-template-columns:49px minmax(0,1fr);gap:8px;align-items:start;width:100%;padding:9px 0 16px;background:transparent;border:0;text-align:left;color:var(--ink)}.agenda-entry:before{content:'';position:absolute;left:-20px;top:15px;width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 4px var(--paper)}.agenda-entry:hover .agenda-name{color:var(--accent-dark)}.agenda-time{color:var(--muted);font-size:11px;font-weight:820;margin-top:3px;font-variant-numeric:tabular-nums}.agenda-name{font-weight:780;font-size:13px;line-height:1.5}.agenda-location{color:var(--muted);font-size:11px;margin-top:4px}.mini-todo{display:flex;align-items:start;gap:9px;padding:9px 0;border-bottom:1px solid var(--line-soft)}.mini-todo:last-of-type{border:0}.todo-check{appearance:none;display:grid;place-items:center;width:20px;height:20px;flex:0 0 20px;border-radius:6px;border:1.8px solid var(--muted);background:var(--paper);cursor:pointer;position:relative;margin:0;vertical-align:middle}.todo-check:checked{background:var(--success);border-color:var(--success)}.todo-check:checked:after{content:'';display:block;width:5px;height:9px;border-right:2px solid #fff;border-bottom:2px solid #fff;transform:translateY(-2px) rotate(45deg)}.todo-check:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.todo-check.task-select-check:checked{background:var(--accent);border-color:var(--accent)}.mini-todo .todo-title{font-size:13px;font-weight:670;line-height:1.55;flex:1;min-width:0}.mini-todo .todo-title.done{text-decoration:line-through;color:var(--muted)}.small-add{display:flex;align-items:center;gap:9px;border-top:1px solid var(--line-soft);padding-top:14px;margin-top:9px}.small-add input{min-width:0;flex:1;padding:9px 10px;background:var(--bg);border:1px solid var(--line);border-radius:8px;font-size:13px}.small-add button{height:38px;min-width:42px;border:0;border-radius:8px;background:var(--accent-bg);color:var(--accent-dark);font-weight:900;font-size:18px}.banner-quiet{margin-top:18px;display:flex;align-items:center;gap:10px;background:var(--accent-bg);color:var(--accent-dark);border-radius:13px;padding:13px 16px;font-size:12px;line-height:1.5}.banner-quiet svg{width:16px;height:16px}\n/* Work area list */\n.work-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin-bottom:15px}.tab-pills{display:inline-flex;gap:3px;padding:4px;background:var(--paper);border:1px solid var(--line);border-radius:11px}.tab-pills button{font-size:12px;font-weight:760;padding:8px 12px;border:0;background:transparent;color:var(--muted);border-radius:8px;white-space:nowrap}.tab-pills button.active{background:var(--accent-bg);color:var(--accent-dark)}.work-toolbar .spacer{flex:1}.select-small{min-height:39px;padding:8px 11px;background:var(--paper);border:1px solid var(--line);border-radius:9px;font-size:12px;font-weight:720;max-width:210px}.work-collection{overflow:hidden}.group-title{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--hover);border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:13px 22px}.group-title:first-child{border-top:0}.group-title strong{font-size:12px;letter-spacing:.01em}.group-title span{font-size:11px;color:var(--muted)}.item-row{display:grid;grid-template-columns:24px minmax(0,1.6fr) minmax(100px,.65fr) minmax(90px,.6fr) 104px;align-items:center;gap:14px;padding:13px 21px;border-bottom:1px solid var(--line-soft);min-height:68px}.item-row:last-child{border-bottom:0}.item-row:hover{background:var(--hover)}.item-row .item-name{display:block;font-weight:780;line-height:1.4;font-size:14px;text-align:left;border:0;background:none;color:var(--ink);padding:0;overflow-wrap:anywhere}.item-row .item-name:hover{color:var(--accent-dark)}.row-under{font-size:11px;margin-top:5px;color:var(--muted)}.item-row .item-assignee,.item-row .item-date{font-size:12px;color:var(--ink-soft)}.item-row .item-date.urgent{color:var(--red);font-weight:830}.row-last{display:flex;align-items:center;justify-content:end;gap:6px}.row-last button{border:1px solid var(--line);background:var(--paper);color:var(--ink-soft);border-radius:7px;padding:8px;font-size:11px;font-weight:770;white-space:nowrap}.row-last button:hover{border-color:var(--accent);color:var(--accent-dark)}.row-last button.primary-mini{background:var(--accent-bg);color:var(--accent-dark);border-color:transparent}.bulkbar{display:flex;align-items:center;gap:10px;background:var(--accent-bg);color:var(--accent-dark);padding:11px 15px;border-radius:11px;margin-bottom:11px;font-size:12px;font-weight:780}.bulkbar button{background:var(--paper);border:1px solid var(--line);padding:7px 11px;border-radius:7px;color:var(--ink);font-size:12px;font-weight:760}.bulkbar .spacer{flex:1}.status-rail{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-bottom:14px}.status-marker{border:1px solid var(--line);background:var(--paper);border-radius:11px;text-align:left;padding:9px 12px;min-width:0;min-height:61px}.status-marker.active{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}.status-marker .label{font-size:11px;color:var(--muted);display:flex;align-items:center;gap:7px}.status-marker .label:before{content:'';width:7px;height:7px;border-radius:50%;background:var(--accent)}.status-marker:nth-child(2) .label:before{background:var(--blue)}.status-marker:nth-child(3) .label:before{background:var(--warn)}.status-marker:nth-child(4) .label:before{background:var(--muted)}.status-marker:nth-child(5) .label:before{background:var(--success)}.status-marker strong{font-size:19px;display:block;margin-top:3px;font-variant-numeric:tabular-nums}\n/* ToDo */\n.todo-columns{display:grid;grid-template-columns:minmax(0,1.32fr) minmax(280px,.68fr);gap:18px}.todo-entry{display:flex;gap:11px;align-items:center;padding:15px 0;border-bottom:1px solid var(--line-soft)}.todo-entry:last-child{border:0}.todo-entry .todo-text{border:0;background:none;text-align:left;font-size:15px;line-height:1.4;font-weight:720;color:var(--ink);flex:1;min-width:0;overflow-wrap:anywhere}.todo-entry .todo-text.done{color:var(--muted);text-decoration:line-through}.todo-entry .todo-date{color:var(--muted);font-size:11px}.todo-entry .todo-edit{width:32px;height:32px;border:0;background:none;color:var(--muted);border-radius:8px}.todo-entry .todo-edit:hover{background:var(--hover);color:var(--ink)}.progress-track{height:6px;border-radius:20px;background:var(--line);overflow:hidden;margin:14px 0 6px}.progress-fill{height:100%;background:var(--success);transition:width .2s}.note-preview{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:16px;margin-top:13px;font-size:12px;color:var(--ink-soft);line-height:1.8}\n/* Schedule */\n.calendar-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.calendar-tools button{width:36px;height:36px;border-radius:9px;border:1px solid var(--line);background:var(--paper);display:grid;place-items:center;color:var(--ink)}.calendar-tools .period{font-weight:780;min-width:140px;text-align:center}.week-board{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:9px;padding:15px}.weekday-col{min-width:0;background:var(--bg);border:1px solid var(--line-soft);border-radius:12px;min-height:270px;overflow:hidden}.weekday-col.current{background:var(--accent-bg);border-color:color-mix(in srgb,var(--accent) 28%,var(--line))}.weekday-head{display:flex;flex-direction:column;align-items:center;gap:3px;border-bottom:1px solid var(--line);padding:15px 5px 12px}.weekday-head span{color:var(--muted);font-size:11px}.weekday-head strong{font-size:21px}.weekday-body{padding:8px}.schedule-event{width:100%;text-align:left;border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:7px;background:var(--paper);color:var(--ink);padding:9px 7px;margin-bottom:7px;overflow-wrap:anywhere}.schedule-event:hover{border-color:var(--accent)}.schedule-event .time{font-size:10px;color:var(--muted);font-weight:780;margin-bottom:4px}.schedule-event .title{font-size:11px;line-height:1.4;font-weight:750}.schedule-event.blue{border-left-color:var(--blue)}.schedule-event.warn{border-left-color:var(--warn)}.weekday-add{width:100%;border:1px dashed var(--line);border-radius:7px;color:var(--muted);background:transparent;padding:9px 2px;font-size:12px;margin-top:3px}.weekday-add:hover{color:var(--accent-dark);border-color:var(--accent)}.mobile-agenda{display:none}.calendar-footer{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 22px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}\n/* Memo library */\n.memo-toolbar{display:flex;align-items:center;gap:9px;margin-bottom:17px;flex-wrap:wrap}.memo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.memo-card{text-align:left;border:1px solid var(--line);background:var(--paper);border-radius:14px;padding:22px;min-height:210px;display:flex;flex-direction:column;align-items:start;transition:transform .12s,border-color .12s;min-width:0;color:var(--ink)}.memo-card:hover{transform:translateY(-2px);border-color:var(--accent)}.memo-icon{display:grid;place-items:center;background:var(--accent-bg);color:var(--accent-dark);border-radius:11px;width:38px;height:38px;margin-bottom:20px}.memo-card h3{font-size:16px;line-height:1.45;margin:0 0 9px;letter-spacing:-.25px;overflow-wrap:anywhere}.memo-card p{margin:0;color:var(--ink-soft);font-size:12px;line-height:1.7;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;overflow-wrap:anywhere}.memo-card .memo-bottom{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;margin-top:auto;padding-top:18px;font-size:11px;color:var(--muted)}\n/* Popovers, drawer, toast */\n.popover{position:fixed;z-index:55;background:var(--paper);border:1px solid var(--line);border-radius:13px;box-shadow:0 24px 64px #131b3030;padding:8px;min-width:225px}.create-popover{top:65px;right:max(32px,calc((100vw - 1550px)/2 + 36px))}.pop-row{width:100%;display:flex;align-items:center;gap:12px;border:0;border-radius:9px;background:none;color:var(--ink);text-align:left;padding:12px 11px;font-weight:760;font-size:13px}.pop-row:hover{background:var(--hover)}.pop-row svg{color:var(--accent-dark)}.search-results{position:absolute;left:0;top:49px;width:330px;max-width:calc(100vw - 20px);padding:10px;background:var(--paper);box-shadow:0 20px 45px #14223b25;border:1px solid var(--line);border-radius:12px;z-index:80}.search-hit{display:block;text-align:left;width:100%;padding:11px 9px;border:0;border-radius:8px;color:var(--ink);background:transparent}.search-hit:hover{background:var(--hover)}.search-hit strong{display:block;font-size:12px;line-height:1.5}.search-hit span{display:block;font-size:10px;color:var(--muted);margin-top:4px}.overlay{position:fixed;inset:0;z-index:100;background:rgba(17,24,38,.49);display:flex;justify-content:flex-end;align-items:stretch;backdrop-filter:blur(3px)}[hidden]{display:none!important}.sheet{width:min(520px,100%);height:100dvh;background:var(--paper);box-shadow:-20px 0 60px #0b102034;display:flex;flex-direction:column;animation:sheetin .17s ease-out;overflow:hidden}@keyframes sheetin{from{transform:translateX(12px);opacity:.7}to{transform:translateX(0);opacity:1}}.sheet-head{display:flex;align-items:start;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line);padding:24px 26px 19px}.sheet-head small{font-size:11px;color:var(--accent-dark);font-weight:850;letter-spacing:.09em}.sheet-head h2{margin:7px 0 0;font-size:22px;letter-spacing:-.5px;line-height:1.4}.sheet-body{padding:24px 26px;overflow:auto;flex:1;min-height:0}.sheet-foot{border-top:1px solid var(--line);padding:15px 26px;display:flex;align-items:center;justify-content:flex-end;gap:9px;flex-wrap:wrap}.sheet-close{width:38px;height:38px;border:1px solid var(--line);background:var(--paper);border-radius:10px;color:var(--ink)}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}.form-field{min-width:0;display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:800;color:var(--ink-soft);margin-bottom:17px}.form-field.full{grid-column:1/-1}.form-field input,.form-field select,.form-field textarea{width:100%;min-height:43px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:11px;font-weight:580;font-size:14px}.form-field textarea{resize:vertical;min-height:125px;line-height:1.7}.origin-schedule-intro{padding:15px 17px;border-radius:12px;border:1px solid var(--line-soft);background:var(--accent-bg);margin-bottom:22px}.origin-schedule-intro strong{display:block;font-size:14px;color:var(--ink)}.origin-schedule-intro p{margin:5px 0 0;color:var(--ink-soft);font-size:12px;line-height:1.6}.origin-schedule-duration{display:flex;flex-direction:row;align-items:center;flex-wrap:wrap;gap:6px;margin-top:-7px}.origin-schedule-duration span{color:var(--muted);font-size:12px;margin-right:5px}.origin-schedule-duration button{padding:7px 11px;border-radius:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink-soft);font-size:12px;font-weight:750}.origin-schedule-duration button:hover{background:var(--accent-bg);border-color:var(--accent);color:var(--accent-dark)}.origin-schedule-note{color:var(--muted);font-size:12px;line-height:1.8;margin:9px 0 15px}.origin-schedule-note button{color:var(--accent-dark);font-size:12px;font-weight:800;text-decoration:underline;background:none;border:0;padding:0}.origin-schedule-error{font-size:12px;color:var(--red);background:var(--red-bg);border-radius:8px;padding:12px;font-weight:750}.form-field .help{color:var(--muted);font-size:11px;font-weight:450}.danger-button{color:var(--red);background:var(--red-bg);border:1px solid transparent;border-radius:9px;padding:10px 12px;font-size:12px;font-weight:800;margin-right:auto}.toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:200;display:flex;align-items:center;gap:12px;padding:12px 18px;background:#2c3445;color:white;border-radius:11px;font-size:12px;box-shadow:0 16px 38px #14213836;max-width:calc(100vw - 28px)}.toast button{border:0;background:none;color:#cbd6ff;font-weight:850;font-size:12px}.empty{display:flex;align-items:center;justify-content:center;text-align:center;flex-direction:column;padding:43px 16px;color:var(--muted);gap:9px}.empty svg{color:var(--accent)}.empty strong{color:var(--ink);font-size:14px}.empty p{margin:0;max-width:300px;font-size:12px;line-height:1.8}.mobile-nav{display:none}.touch-only{display:none}\n@media(max-width:1280px){.header-inner{gap:19px;padding:0 23px}.searchbox{width:170px}.header-nav .nav-button{padding:10px}.workspace{padding:30px 25px 70px}.day-grid{grid-template-columns:minmax(0,1.3fr) minmax(285px,.8fr)}.surface-section{padding:21px 22px}.memo-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}\n@media(max-width:1050px){.brand-small{display:none}.header-inner{gap:14px}.header-nav .nav-button{font-size:12px;padding:9px 7px}.searchbox{width:140px}.kbd{display:none}.day-grid{grid-template-columns:minmax(0,1fr) minmax(250px,.8fr)}.focus-item{grid-template-columns:31px minmax(0,1fr);gap:9px}.focus-actions{grid-column:2}.item-row{grid-template-columns:22px minmax(0,1.5fr) minmax(60px,.5fr) 102px}.item-row .item-assignee{display:none}.week-board{gap:5px}.weekday-body{padding:5px}.weekday-col{min-height:240px}.weekday-head{padding:11px 2px}}\n@media(max-width:770px){.status-rail{display:flex;gap:8px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scrollbar-width:thin;padding-bottom:5px;margin-bottom:14px}.status-marker{flex:0 0 116px;scroll-snap-align:start}.header{top:0}.header-inner{min-height:62px;padding:0 16px;gap:10px}.brand-name{font-size:21px}.header-nav{display:none}.header-tools{margin-left:auto;gap:2px}.searchbox{width:40px;height:40px;padding:0;justify-content:center;background:none;border-color:transparent}.searchbox input{position:absolute;left:0;top:0;opacity:0;width:40px;height:40px;z-index:2}.searchbox:focus-within{position:absolute;left:12px;right:12px;top:10px;width:auto;z-index:40;justify-content:flex-start;padding:0 12px;background:var(--paper);border-color:var(--accent)}.searchbox:focus-within input{position:static;opacity:1;width:100%;height:100%;background:none}.search-results{top:48px;left:0;width:100%}.header-avatar{display:none}.header-tools>.primary-button{width:40px;height:40px;padding:0;font-size:0;min-height:40px}.header-tools>.primary-button svg{width:21px;height:21px}.workspace{padding:26px 15px calc(100px + env(safe-area-inset-bottom,0px))}.page-heading{align-items:start;margin-bottom:21px}.page-heading h1{font-size:29px;letter-spacing:-1px}.page-heading p.page-desc{font-size:12px}.heading-meta{display:none}.strip-title{display:none}.strip{margin-left:-3px;margin-right:-3px;gap:7px}.day-chip{flex:0 0 61px;min-height:70px}.day-grid{grid-template-columns:1fr;gap:13px}.right-stack{grid-template-columns:1fr}.surface-section{padding:19px}.status-summary{gap:12px}.focus-item{grid-template-columns:30px minmax(0,1fr) auto}.focus-actions{grid-column:auto}.focus-actions .ghost-row-action{display:none}.focus-order{width:28px;height:28px}.focus-name{font-size:14px}.todo-columns{grid-template-columns:1fr}.status-rail{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.status-marker{padding:10px}.status-marker strong{font-size:18px}.status-marker .label{font-size:10px}.item-row{grid-template-columns:21px minmax(0,1fr) auto;gap:9px;padding:13px 12px}.item-row .item-date{display:none}.item-row .row-last button:not(.primary-mini){display:none}.item-row .item-name{font-size:13px}.item-row .row-under{font-size:10px}.tab-pills{max-width:100%;overflow-x:auto}.tab-pills button{padding:8px 10px}.work-toolbar{gap:7px}.work-toolbar .spacer{display:none}.select-small{margin-left:auto}.memo-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.memo-card{padding:15px;min-height:200px}.memo-icon{margin-bottom:15px}.memo-card h3{font-size:14px}.week-board{display:none}.mobile-agenda{display:block;padding:14px}.mobile-agenda .agenda-day{padding:12px 3px;border-bottom:1px solid var(--line)}.mobile-agenda .agenda-day:last-child{border-bottom:0}.mobile-agenda .agenda-day-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.mobile-agenda .agenda-day-head strong{font-size:13px}.mobile-agenda .agenda-day-head button{border:1px solid var(--line);background:var(--paper);border-radius:8px;font-size:12px;padding:8px 10px;color:var(--accent-dark)}.mobile-agenda .agenda-entry{border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:10px;padding:12px;margin-bottom:7px;grid-template-columns:50px 1fr}.mobile-agenda .agenda-entry:before{display:none}.calendar-footer{padding:13px}.mobile-nav{position:fixed;bottom:0;left:0;right:0;z-index:29;display:grid;grid-template-columns:repeat(5,1fr);background:color-mix(in srgb,var(--paper) 98%,transparent);backdrop-filter:blur(15px);border-top:1px solid var(--line);padding:9px 6px calc(8px + env(safe-area-inset-bottom,0px))}.mobile-nav button{display:grid;justify-items:center;gap:4px;align-content:center;min-height:53px;border:0;background:none;color:var(--muted);font-size:10px;font-weight:760;padding:4px}.mobile-nav button.active{color:var(--accent-dark)}.mobile-nav button svg{width:21px;height:21px}.create-popover{right:9px;top:60px}.sheet-head{padding:18px 19px 15px}.sheet-body{padding:19px}.sheet-foot{padding:12px 19px}.toast{bottom:calc(80px + env(safe-area-inset-bottom,0px))}.touch-only{display:inline}}\n@media(max-width:420px){.workspace{padding:22px 12px calc(100px + env(safe-area-inset-bottom,0px))}.page-heading h1{font-size:27px}.surface-section{padding:16px}.section-head h2{font-size:15px}.focus-item{grid-template-columns:26px minmax(0,1fr);gap:10px}.focus-actions{grid-column:2;justify-content:flex-start}.focus-name{font-size:14px}.focus-meta{gap:5px}.focus-order{width:26px;height:26px}.strip{gap:5px}.day-chip{flex-basis:56px}.memo-grid{grid-template-columns:1fr}.memo-card{min-height:165px}.form-grid{grid-template-columns:1fr}.form-field.full{grid-column:auto}.heading-meta{display:none}.section-head{align-items:start}.primary-button{padding-inline:11px}.status-marker{padding:9px 6px}.status-marker .label{font-size:9px}.work-toolbar .select-small{max-width:138px}}\n@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}\n\n\n.record-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 20px}.detail-list{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:19px 0;margin:0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.detail-list>div{min-width:0}.detail-list dt{font-size:11px;font-weight:800;color:var(--muted);margin-bottom:7px}.detail-list dd{font-size:14px;font-weight:750;color:var(--ink);margin:0;overflow-wrap:anywhere}.detail-subheading{font-size:13px;margin:22px 0 10px;color:var(--ink);font-weight:840}.record-description{white-space:pre-wrap;color:var(--ink-soft);font-size:14px;line-height:1.85;margin:0;overflow-wrap:anywhere}.memo-document{padding:19px 4px 12px;font-size:14px;color:var(--ink);line-height:2.05;white-space:pre-wrap;overflow-wrap:anywhere}\n@media(max-width:480px){.detail-list{grid-template-columns:1fr;gap:14px}.sheet-foot{justify-content:stretch}.sheet-foot .primary-button{flex:1}.sheet-foot .secondary-button{flex:1}.sheet-foot .danger-button{width:100%}}\n\n:host {display:block;isolation:isolate;min-height:100vh;font-family:Inter,\"Noto Sans JP\",system-ui,sans-serif}\n#originDisplaySelect {width:72px;border:1px solid var(--line);border-radius:9px;padding:8px 2px;color:var(--ink);background:var(--paper);font-size:11px;cursor:pointer}\n@media(max-width:770px){#originDisplaySelect{width:52px;max-width:52px;font-size:10px;padding:6px 0}.header-tools{gap:4px}}\n"+"\n.origin-task-overview{border:1px solid var(--line);border-radius:12px;padding:17px;background:var(--bg)}\n.origin-progress-head{display:flex;justify-content:space-between;align-items:center;color:var(--ink);font-size:13px}\n.origin-progress{height:8px;border-radius:10px;background:var(--line);overflow:hidden;margin:12px 0 7px}.origin-progress i{display:block;height:100%;background:var(--success)}\n.origin-task-overview>small{color:var(--muted);font-size:11px}.origin-task-overview .detail-list{margin-top:15px}\n.origin-task-section{border-top:1px solid var(--line);padding:19px 0}.origin-task-section h3{font-size:14px;margin:0 0 13px}.origin-task-section>p{font-size:13px;color:var(--ink-soft)}\n.origin-task-check{display:flex;align-items:center;gap:10px;min-height:44px;font-size:13px;cursor:pointer;padding:8px 3px}\n.origin-task-check input{width:19px;height:19px;accent-color:var(--success)}.origin-task-check .is-done{text-decoration:line-through;color:var(--muted)}\n.origin-task-history{padding-left:19px;font-size:12px;line-height:1.8}.origin-task-history li{margin-bottom:10px}.origin-task-history small{display:block;color:var(--muted);font-size:10px}\n.origin-checkrow{display:flex;align-items:center;gap:9px;margin:8px 0}.origin-checkrow input[type=checkbox]{width:19px;height:19px;accent-color:var(--success)}\n.origin-checkrow input[type=text]{flex:1;min-width:0;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:8px;min-height:42px;padding:9px}\n"+"\n/* Origin task mobile editor touch and readability */\n.origin-checkrow{display:grid;grid-template-columns:22px minmax(0,1fr) 42px;align-items:center;gap:9px;margin:9px 0}\n.origin-checkrow input[name=\"checkDone\"]{width:21px;height:21px;accent-color:var(--success);cursor:pointer}\n.origin-checkrow input[name=\"checkText\"]{min-width:0;min-height:44px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:10px;font-size:14px}\n.origin-checkrow button{border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink-soft);width:42px;height:44px;display:grid;place-items:center}\n.origin-checkrow button:hover{border-color:var(--red);color:var(--red)}\n.origin-task-error{font-size:12px;color:var(--red);background:var(--red-bg);border-radius:9px;padding:11px 13px;line-height:1.6;font-weight:760}\n.origin-task-error[hidden]{display:none}\n.origin-task-check{min-height:46px;padding:10px 7px;border-radius:9px}\n.origin-task-check:hover{background:var(--hover)}\n.origin-task-check input{width:22px;height:22px;accent-color:var(--success)}\n.origin-task-section .secondary-button{margin:4px 5px 6px 0;max-width:100%;min-height:44px;white-space:normal}\n.origin-task-overview .detail-list{gap:12px}\n.origin-task-history{margin-top:10px}\n.sheet-foot{padding-bottom:max(15px,env(safe-area-inset-bottom,0px))}\n@media(max-width:520px){.sheet-head{padding:16px 18px 12px}.sheet-head h2{font-size:20px}.sheet-body{padding:16px 18px}.sheet-foot{padding:12px 18px max(15px,env(safe-area-inset-bottom,0px))}.sheet-foot button{min-height:44px}.origin-task-overview{padding:14px}}\n"+"#originUserSelect{width:121px;max-width:16vw;height:38px;background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:9px;font-size:12px;padding:0 7px}@media(max-width:770px){#originUserSelect{width:77px;max-width:77px;height:36px;font-size:11px}}"+".origin-memo-palette{display:flex;gap:7px;flex-wrap:wrap}.origin-memo-palette label{display:flex;align-items:center;gap:5px;border:1px solid var(--line);padding:7px;border-radius:8px;cursor:pointer}.origin-memo-palette label:has(:checked){background:var(--accent-bg);border-color:var(--accent)}"+".origin-memo-filters{display:flex;gap:7px;overflow-x:auto;margin-bottom:14px}.origin-memo-filters button{padding:8px 12px;border:1px solid var(--line);border-radius:99px;background:var(--paper);color:var(--ink);white-space:nowrap;font-size:12px}.origin-memo-filters button.active{background:var(--accent-bg);border-color:var(--accent)}.origin-memo-shell{border:1px solid var(--line);border-radius:14px;background:var(--memo-paper,var(--paper));overflow:hidden}.origin-memo-shell .memo-card{border:0;border-radius:0;background:transparent;width:100%;min-height:155px;color:#283347}.origin-memo-shell .memo-card p,.origin-memo-shell .memo-bottom{color:#546378}.origin-memo-shell[data-paper-color=\"lemon\"]{--memo-paper:#fff4d5}.origin-memo-shell[data-paper-color=\"peach\"]{--memo-paper:#ffebe4}.origin-memo-shell[data-paper-color=\"mint\"]{--memo-paper:#e2f5ea}.origin-memo-shell[data-paper-color=\"sky\"]{--memo-paper:#e5f0ff}.origin-memo-shell[data-paper-color=\"lavender\"]{--memo-paper:#efe8ff}.origin-memo-colors{display:flex;align-items:center;flex-wrap:wrap;gap:7px;padding:5px 12px 13px}.origin-memo-colors span{font-size:11px;color:#526179;margin-right:auto}.origin-color-dot{width:27px;height:27px;border-radius:50%;border:2px solid #fff9;box-shadow:0 0 0 1px #52617950;cursor:pointer}.origin-color-dot[data-paper-color=\"ivory\"]{background:#fff}.origin-color-dot[data-paper-color=\"lemon\"]{background:#ffe29e}.origin-color-dot[data-paper-color=\"peach\"]{background:#ffc6b5}.origin-color-dot[data-paper-color=\"mint\"]{background:#bce6ca}.origin-color-dot[data-paper-color=\"sky\"]{background:#bedfff}.origin-color-dot[data-paper-color=\"lavender\"]{background:#d5c6ff}.origin-color-dot[aria-pressed=\"true\"]{outline:2px solid #40567c;outline-offset:2px}:host([data-theme=\"dark\"]) .origin-memo-shell[data-paper-color=\"ivory\"]{--memo-paper:#29313d}:host([data-theme=\"dark\"]) .origin-memo-shell[data-paper-color=\"lemon\"]{--memo-paper:#433b2b}:host([data-theme=\"dark\"]) .origin-memo-shell[data-paper-color=\"peach\"]{--memo-paper:#43312f}:host([data-theme=\"dark\"]) .origin-memo-shell[data-paper-color=\"mint\"]{--memo-paper:#293e36}:host([data-theme=\"dark\"]) .origin-memo-shell[data-paper-color=\"sky\"]{--memo-paper:#29394b}:host([data-theme=\"dark\"]) .origin-memo-shell[data-paper-color=\"lavender\"]{--memo-paper:#383047}:host([data-theme=\"dark\"]) .origin-memo-shell .memo-card{color:var(--ink)}:host([data-theme=\"dark\"]) .origin-memo-shell .memo-card p,:host([data-theme=\"dark\"]) .origin-memo-shell .memo-bottom{color:var(--ink-soft)}"+".origin-calendar-controls{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.origin-calendar-search{min-width:135px;max-width:200px;flex:1;height:39px;border:1px solid var(--line);border-radius:9px;padding:8px 10px;background:var(--paper);color:var(--ink);font-size:12px}.weekday-col.origin-selected,.agenda-day.origin-selected{outline:2px solid var(--accent);outline-offset:-2px}.origin-calendar-controls input{height:39px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);padding:5px}.origin-agenda-group{padding:15px;border-bottom:1px solid var(--line)}.origin-agenda-group>strong{display:block;font-size:14px;margin-bottom:10px}.origin-agenda-entry{width:100%;display:grid;grid-template-columns:110px minmax(0,1fr) auto;gap:10px;align-items:center;text-align:left;background:var(--paper);border:1px solid var(--line);border-radius:10px;color:var(--ink);padding:13px;margin:7px 0}.origin-agenda-entry:hover{background:var(--hover);border-color:var(--accent)}.origin-agenda-entry time{font-size:11px;font-weight:800;color:var(--accent-dark)}.origin-agenda-entry strong{font-size:13px;overflow-wrap:anywhere}.origin-agenda-entry small{font-size:11px;color:var(--muted)}@media(max-width:770px){.origin-calendar-controls{width:100%;justify-content:flex-start}.origin-calendar-search{max-width:none;flex-basis:100%}.origin-agenda-entry{grid-template-columns:90px minmax(0,1fr)}.origin-agenda-entry small{grid-column:2}}@media(max-width:770px){.header-inner{flex-wrap:wrap;column-gap:6px;row-gap:2px;min-height:96px;padding:7px 12px}.brand{height:36px;gap:7px}.brand-emblem{width:32px;height:32px;border-radius:10px}.brand-name{font-size:20px}.header-tools{flex:1 0 100%;width:100%;justify-content:flex-end;gap:7px;margin-left:0}.create-popover{top:107px;right:12px}.searchbox:focus-within{top:48px;left:12px;right:12px}}@media(max-width:370px){.header-tools{gap:5px}.header-inner{padding:7px 10px}.create-popover{right:10px}}"+"/* Origin next: a real two-row header at desktop widths that previously caused pointer overlap */\n@media (min-width:771px) and (max-width:1500px) {\n .header-inner{flex-wrap:wrap;column-gap:16px;row-gap:0;padding:8px 24px 0}\n .brand{order:0;min-width:0}\n .header-tools{order:1;margin-left:auto;flex:0 0 auto;min-width:0}\n .header-nav{order:2;flex:0 0 100%;width:100%;min-width:0;max-width:100%;height:42px;justify-content:space-between;gap:5px;border-top:1px solid var(--line-soft)}\n .header-nav .nav-button{flex:1 1 0;min-width:0;max-width:none;position:relative}\n .searchbox{width:170px}\n}\n@media (min-width:771px) and (max-width:1050px) {\n .header-inner{padding:8px 15px 0;column-gap:8px}\n .searchbox{width:135px}\n #originUserSelect{max-width:105px}\n .header-nav .nav-button{padding:8px 6px}\n}"+"/* Search and sorting are view-only and never update memo timestamps. */\n.origin-memo-utility{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:2px 0 12px}\n.origin-memo-utility>input{flex:1 1 240px;min-width:0;max-width:380px;min-height:42px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);padding:9px 13px;font-size:13px}\n.origin-memo-utility>label{display:inline-flex;align-items:center;gap:8px;color:var(--muted);font-size:12px;font-weight:700;white-space:nowrap}\n.origin-memo-utility select{height:42px;min-width:145px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink);padding:0 10px;font-size:12px}\n.origin-memo-result{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:-4px 0 13px;color:var(--muted);font-size:12px}\n.origin-memo-result button{border:0;background:transparent;color:var(--accent-dark);font-size:12px;font-weight:760;text-decoration:underline;padding:8px}\n@media(max-width:770px){.origin-memo-utility>input{flex-basis:100%;max-width:none}.origin-memo-utility>label{width:100%;justify-content:space-between}.origin-memo-utility select{min-width:160px}.memo-toolbar .tab-pills{overflow-x:auto;min-width:0}}\n"+"\n.origin-detail-pager{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0 15px;margin:-5px 0 18px;border-bottom:1px solid var(--line)}\n.origin-detail-position{display:inline-flex;align-items:center;font-size:12px;font-weight:780;color:var(--muted);font-variant-numeric:tabular-nums}\n.origin-detail-controls{display:flex;align-items:center;gap:8px}\n.origin-detail-controls button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-width:86px;min-height:38px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink);font-size:12px;font-weight:750}\n.origin-detail-controls button:not([disabled]):hover{background:var(--accent-bg);border-color:var(--accent)}\n.origin-detail-controls button[disabled]{opacity:.36;cursor:default}\n@media(max-width:420px){.origin-detail-pager{gap:6px}.origin-detail-controls{gap:5px}.origin-detail-controls button{min-width:66px;padding:6px 8px}}\n"+"\n/* ToDo is an undated personal checklist; do not imply a deadline. */\n.origin-todo-summary{display:flex;align-items:center;gap:17px;flex-wrap:wrap;border:1px solid var(--line);background:var(--paper);padding:12px 17px;border-radius:13px;margin-bottom:13px}\n.origin-todo-metrics{display:flex;align-items:center;gap:20px;flex-wrap:wrap;color:var(--muted);font-size:12px}\n.origin-todo-metrics strong{font-size:17px;color:var(--ink);font-variant-numeric:tabular-nums}\n.origin-todo-summary .progress-track{flex:1 1 130px;min-width:80px;max-width:290px;margin:0;height:7px}\n.origin-todo-main .surface-section{padding:17px 21px}\n.origin-todo-add{display:flex;align-items:stretch;gap:9px;margin:8px 0 8px!important;padding:0!important;border:0!important}\n.origin-todo-add input{min-width:0;min-height:42px;flex:1;border-radius:10px}\n.origin-todo-add button{min-width:44px;min-height:42px}\n.origin-todo-main .todo-entry{padding:10px 0;min-height:48px;gap:10px}\n.origin-todo-main .todo-entry .todo-text{font-size:14px;font-weight:680;padding:4px 0}\n.origin-todo-main .todo-entry .todo-edit{flex:0 0 34px}\n.origin-todo-archive{margin-top:11px;padding-top:10px;border-top:1px solid var(--line)}\n.origin-todo-archive-toggle{width:100%;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);min-height:43px;padding:9px 12px;display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:12px;font-weight:740}\n.origin-todo-archive-toggle>span{display:inline-flex;align-items:center;gap:8px}\n.origin-todo-archive-toggle>span:last-child{color:var(--muted);font-weight:600}\n.origin-todo-archive-toggle:hover{border-color:var(--accent)}\n#originCompletedTodos{padding-top:7px}\n#originCompletedTodos[hidden]{display:none}\n@media(max-width:770px){.origin-todo-main .surface-section{padding:13px 14px}.origin-todo-summary{padding:12px 14px;gap:11px}.origin-todo-metrics{gap:13px}.origin-todo-summary .progress-track{max-width:none}}\n"+"\n/* Compact, consistent task list: useful metadata stays visible on mobile. */\n.origin-task-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 9px}\n.origin-task-tools>input{min-height:40px;min-width:190px;flex:1 1 220px;max-width:400px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);padding:9px 12px;font-size:13px}\n.origin-task-tools>label{display:inline-flex;align-items:center;gap:7px;color:var(--muted);font-size:12px;font-weight:730}\n.origin-task-tools select{min-height:40px;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:9px;padding:6px 9px;font-size:12px}\n.origin-density-button{min-height:40px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink-soft);font-size:12px;font-weight:720;padding:8px 12px}\n.origin-density-button:hover{border-color:var(--accent);color:var(--accent-dark)}\n.origin-task-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--muted);font-size:12px;padding:0 2px 9px}\n.origin-task-summary button{border:0;background:transparent;color:var(--accent-dark);text-decoration:underline;font-size:12px;font-weight:740;padding:7px}\n.origin-task-tip{margin:10px 0 0}\n.origin-task-mobile-due{display:none}\n.origin-task-main{min-width:0}\n.origin-task-collection.origin-tasks-compact .item-row{min-height:53px;padding:9px 16px;gap:11px}\n.origin-task-collection.origin-tasks-compact .group-title{padding:9px 16px}\n.origin-task-collection.origin-tasks-compact .row-under{margin-top:3px;display:flex;align-items:center;gap:7px;flex-wrap:wrap}\n.origin-task-collection .item-assignee,.origin-task-collection .item-date{min-width:0}\n.origin-task-collection .row-last button{min-height:36px;min-width:48px}\n@media(max-width:770px){\n .origin-task-tools>input{flex-basis:100%;min-width:0;max-width:none}\n .origin-task-tools{gap:8px}\n .origin-task-tools>label{flex:1}\n .origin-task-collection .row-under .origin-task-mobile-due{display:inline-flex;align-items:center;white-space:nowrap;color:var(--muted);font-size:11px;font-weight:750}\n .origin-task-collection .row-under .origin-task-mobile-due.urgent{color:var(--red)}\n .origin-task-collection.origin-tasks-compact .item-row{padding:10px 12px;gap:9px;min-height:52px}\n .origin-task-collection.origin-tasks-compact .item-name{font-size:13px}\n .origin-task-collection .row-last button{min-height:40px;min-width:44px}\n}\n"+"\n/* Calendar modes share a single filtered event set. */\n.origin-schedule-view{display:inline-flex;gap:3px;padding:3px;border:1px solid var(--line);border-radius:10px;background:var(--paper)}\n.origin-schedule-view button{min-height:33px;padding:6px 10px;border:0;border-radius:8px;font-size:12px;font-weight:760;color:var(--muted);background:transparent}\n.origin-schedule-view button.active{background:var(--accent-bg);color:var(--accent-dark)}\n.origin-weekday-focus{display:flex;flex-direction:column;align-items:center;gap:3px;width:100%;background:transparent;color:var(--ink);border:0;padding:0;min-height:55px}\n.origin-weekday-focus span{font-size:11px;color:var(--muted)}\n.origin-weekday-focus strong{font-size:18px}\n.origin-weekday-focus small{font-size:10px;color:var(--muted);font-weight:650}\n.origin-weekday-focus:hover strong,.origin-weekday-focus:focus-visible strong{color:var(--accent-dark)}\n.origin-agenda-day-label{border:0;background:transparent;text-align:left;color:var(--ink);font-size:13px;font-weight:760;padding:5px 0}\n.origin-agenda-day-label span{font-size:11px;color:var(--muted)}\n.origin-day-focus{padding:18px 20px}\n.origin-day-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px;border-bottom:1px solid var(--line);padding-bottom:13px}\n.origin-day-heading small{font-size:10px;letter-spacing:.1em;font-weight:800;color:var(--muted)}\n.origin-day-heading h2{margin:5px 0 0;font-size:19px;color:var(--ink)}\n.origin-day-heading h2 span{font-size:12px;font-weight:650;color:var(--muted);margin-left:8px}\n.origin-day-controls{display:flex;align-items:center;gap:7px}\n.origin-day-controls button{display:grid;place-items:center;width:39px;height:39px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink)}\n.origin-day-items{display:grid;gap:7px}\n.origin-day-entry{display:grid;grid-template-columns:100px minmax(0,1fr) 22px;align-items:center;gap:12px;width:100%;min-height:51px;border:1px solid var(--line);border-radius:11px;padding:11px 13px;background:var(--paper);color:var(--ink);text-align:left}\n.origin-day-entry:hover{border-color:var(--accent);background:var(--hover)}\n.origin-day-entry time{font-size:11px;color:var(--accent-dark);font-weight:760;font-variant-numeric:tabular-nums}\n.origin-day-entry strong{display:block;font-size:13px;line-height:1.4;overflow-wrap:anywhere}\n.origin-day-entry small{display:block;font-size:11px;color:var(--muted);margin-top:3px}\n.origin-day-open{color:var(--muted)}\n.origin-day-add{margin-top:13px}\n.origin-schedule-toolbar{align-items:center}\n.origin-todo-archive-toggle svg{transition:transform .15s}\n.origin-todo-archive-toggle[aria-expanded=\"true\"]>span:last-child svg{transform:rotate(180deg)}\n@media(max-width:770px){.origin-schedule-view{flex:1 1 100%;justify-content:space-between}.origin-schedule-view button{flex:1}.origin-day-focus{padding:13px 12px}.origin-day-heading h2{font-size:16px}.origin-day-entry{grid-template-columns:76px minmax(0,1fr) 16px;gap:8px;padding:10px}.origin-day-entry strong{font-size:12px}.origin-day-entry time{font-size:10px}}\n"+".origin-todo-main .todo-text{word-break:break-word}.origin-todo-main .todo-check{flex-shrink:0}.origin-todo-archive-toggle[aria-expanded=\"false\"]{margin-bottom:0}"+'</style>'+"<div class=\"app\" id=\"app\">\n  <header class=\"header\">\n    <div class=\"header-inner\">\n      <div class=\"brand\" aria-label=\"origin. 業務管理\">\n        <div class=\"brand-emblem\" aria-hidden=\"true\"><svg width=\"25\" height=\"25\" viewBox=\"0 0 28 28\" fill=\"none\"><path d=\"M5 14a9 9 0 1 1 18 0\" stroke=\"#a9b5ff\" stroke-width=\"2.8\" stroke-linecap=\"round\"/><path d=\"M5 14a9 9 0 0 0 18 0\" stroke=\"#f7f8fd\" stroke-width=\"2.8\" stroke-linecap=\"round\"/><circle cx=\"14\" cy=\"14\" r=\"3.3\" fill=\"#f7f8fd\"/></svg></div>\n        <div class=\"brand-name\">origin<span>.</span></div><div class=\"brand-small\">WORKSPACE</div>\n      </div>\n      <nav class=\"header-nav\" aria-label=\"メインナビゲーション\" id=\"desktopNav\"></nav>\n      <div class=\"header-tools\">\n        <div class=\"searchbox\" id=\"searchbox\"><span data-icon=\"search\" aria-hidden=\"true\"></span><input id=\"originSearchInput\" aria-label=\"タスク・ToDo・予定・メモを横断検索\" placeholder=\"仕事を検索\" autocomplete=\"off\"/><span class=\"kbd\">Ctrl K</span><div class=\"search-results\" id=\"searchResults\" hidden></div></div>\n        <button type=\"button\" id=\"themeBtn\" data-action=\"theme\" class=\"icon-button\" title=\"ライト／ダーク切替\" aria-label=\"ライト／ダーク切替\"><span data-icon=\"moon\"></span></button>\n        <button type=\"button\" id=\"createBtn\" data-action=\"create-menu\" class=\"primary-button\"><span data-icon=\"plus\"></span><span>新規作成</span></button>\n        <select id=\"originDisplaySelect\" aria-label=\"画面デザインを切り替える\"><option value=\"modern\">Origin</option><option value=\"classic\">Classic</option><option value=\"palette\">Palette</option><option value=\"journal\">Journal</option></select>\n        <select id=\"originUserSelect\" aria-label=\"利用者を切り替える\"></select>\n      </div>\n    </div>\n  </header>\n  <main class=\"workspace\" id=\"workspace\" aria-live=\"polite\"></main>\n  <nav class=\"mobile-nav\" id=\"mobileNav\" aria-label=\"モバイルナビゲーション\"></nav>\n  <div class=\"popover create-popover\" id=\"createMenu\" hidden></div>\n  <div class=\"overlay\" id=\"overlay\" hidden><section class=\"sheet\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"panelHeading\" id=\"sheet\"></section></div>\n  <div class=\"toast\" id=\"originToast\" role=\"status\" aria-live=\"polite\" hidden></div>\n</div>";
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
let data={tasks:[],todos:[],events:[],memos:[]};
const clock=(v)=>{const d=new Date(v||0);return Number.isNaN(d.getTime())?'':String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
function scheduleLocalInput(v){const d=new Date(v);return Number.isFinite(d.getTime())?key(d)+'T'+clock(d):''}
function syncSnapshot(){
 snapshot=bridge.readSnapshot();
 const user=snapshot.currentUser;
 const picker=$('#originUserSelect');if(picker){const users=[...new Set([user,...(snapshot.users||[])].filter(Boolean))];const signature=users.join('|');if(picker.dataset.signature!==signature){picker.innerHTML=users.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');picker.dataset.signature=signature}picker.value=user||'';}
 data.tasks=snapshot.tasks.map(t=>({id:t.id,title:t.title,status:t.status,priority:t.priority,
   due:t.dueDate||'',dueTime:t.dueTime||'',completed:Boolean(t.completed),assignee:t.assignee===user?'自分':t.assignee,
   category:t.category,desc:t.description||'',revision:t.revision,updatedAt:t.updatedAt||0,
   pinned:t.pinned,requester:t.requester||'',tags:t.tags||[],checklist:t.checklist||[],history:t.history||[]}));
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
function showEditorSaveError(message){
  // Keep the unsaved draft visible and put save errors next to the editor.
  // The canonical bridge remains the only validator and data writer.
  if(panelMode!=='edit')return;
  const region=panelKind==='events' ? $('#originScheduleError') :
    panelKind==='tasks' ? $('#originTaskError') : null;
  if(region){region.hidden=false;region.textContent=message}
}
async function send(command,label,{close=false}={}){
 if(busy)return false;
 busy=true;
 try{
   const result=command.type.startsWith('memo.')
     ? await memoBridge?.dispatch?.(command) : await bridge.dispatch(command);
   if(result?.ok){ if(close)closePanel(true);syncSnapshot();render();notify(label);return true; }
   if(result?.error==='cancelled'||result?.pending)return false;
   const conflict=['revision-or-state-mismatch','revision-or-relation-mismatch','owner-mismatch','not-found','remote-content-changed'].includes(result?.error);
   const scheduleInvalid=command.type.startsWith('schedule.')&&result?.error==='invalid-input';
   const msg=conflict
     ? '他端末で変更されました。入力内容を保持しています。最新の内容を確認してください。'
     : scheduleInvalid
       ? '予定を保存できませんでした。担当者・分類・関連タスクなどの入力を確認してください。入力内容は保持されています。'
       : '保存できませんでした。入力内容は保持されています。';
   showEditorSaveError(msg);
   notify(msg);
   return false;
 }catch(error){
   console.error('origin command failed',error);
   const message='通信・保存に失敗しました。入力内容を保持しています。接続状態を確認してください。';
   showEditorSaveError(message);notify(message);return false;
 }
 finally{busy=false}
}
let memoColorFilter='all',memoQuery='',memoSort='updated',memoComposing=false,scheduleView='week',scheduleAssignee='all',scheduleQuery='',scheduleComposing=false,quickTodoDraft='',todoCompletedOpen=false,taskQuery='',taskSortMode='due',taskDensity='compact',taskComposing=false;
let view='today',selectedDay=base,taskFilter='active',taskGrouping='deadline',taskStatusChoice='',memoFilter='all',selectedBulk=new Set(),toastTimer=0,previousSnapshot=null,panelOpen=false,panelDirty=false,searchQuery='';
let theme='light';
const viewDefs=[['today','今日','home'],['tasks','タスク','tasks'],['todos','ToDo','todo'],['calendar','予定','calendar'],['notes','メモ','notes']];
function nav(){const n=(mobile)=>viewDefs.map(([id,label,ic])=>`<button type="button" data-route="${id}" class="${mobile?'':'nav-button '}${view===id?'active':''}" ${view===id?'aria-current="page"':''}>${icon(ic,mobile?21:17)}<span>${label}</span></button>`).join('');$('#desktopNav').innerHTML=n(false);$('#mobileNav').innerHTML=n(true)}
function initTheme(){host.dataset.theme=theme;$('#themeBtn').innerHTML=icon(theme==='dark'?'sun':'moon');$('#themeBtn').title=theme==='dark'?'ライトテーマへ':'ダークテーマへ'}
function empty(text,desc='新規作成から登録できます。'){return `<div class="empty">${icon('layers',28)}<strong>${esc(text)}</strong><p>${esc(desc)}</p></div>`}
const activeTasks=()=>data.tasks.filter(x=>!x.completed);function dueState(d){return !d?'':d<base?'overdue':d===base?'today':''}
function taskSort(a,b){const rank={'緊急':-1,'高':0,'中':1,'低':2};return (a.due||'9999').localeCompare(b.due||'9999')||(rank[a.priority]??9)-(rank[b.priority]??9)}
function humanDue(k){if(!k)return '期限なし';if(k===base)return '今日';if(k===shift(base,1))return '明日';if(k===shift(base,-1))return '昨日';return dateLabel(k).replace(/（.*）/,'')}
function taskTag(t){if(t.completed)return `<span class="tag done">完了</span>`;if(t.due&&t.due<base)return `<span class="tag overdue">期限超過</span>`;if(t.due===base)return `<span class="tag today">今日まで</span>`;if(t.status==='確認待ち')return `<span class="tag waiting">確認待ち</span>`;return `<span class="tag">${esc(t.status)}</span>`}
function head(kicker,title,desc,right=''){return `<div class="page-heading"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p class="page-desc">${desc}</p></div>${right?`<div class="heading-meta">${right}</div>`:''}</div>`}
function render(){
 // Keep a typed quick ToDo intact when live shared data refreshes the workspace.
 const previous=$('#workspace [data-form="quick-todo"] [name="title"]');
 const active=previous&&mount.activeElement===previous;
 const selection=active?[previous.selectionStart,previous.selectionEnd]:null;
 if(previous)quickTodoDraft=previous.value;
 nav();
 const m={today:renderToday,tasks:renderTasks,todos:renderTodos,calendar:renderCalendar,notes:renderNotes};
 $('#workspace').innerHTML=m[view]();
 const next=$('#workspace [data-form="quick-todo"] [name="title"]');
 if(next){next.value=quickTodoDraft;if(active){next.focus({preventScroll:true});if(selection[0]!==null)next.setSelectionRange(...selection)}}
 mount.querySelectorAll('#workspace [data-autofocus]')?.forEach(x=>x.focus());
}
function renderToday(){
 const d=parseDay(selectedDay), start=monday(d);const weekdays=[0,1,2,3,4,5,6].map(i=>{const x=addDay(start,i),k=key(x),evt=data.events.filter(e=>e.date===k).length;
 return `<button type="button" class="day-chip ${k===selectedDay?'active':''} ${(i===5||i===6)?'weekend':''}" data-action="pick-day" data-date="${k}" aria-pressed="${k===selectedDay}"><span class="dow">${days[x.getDay()]}曜日</span><span class="number">${x.getDate()}</span><span class="dots">${evt?'<i class="tiny-dot"></i>'.repeat(Math.min(evt,3)):''}</span></button>`}).join('');
 const priority=activeTasks().filter(t=>(t.due&&t.due<=selectedDay)||t.status==='対応中').sort(taskSort).slice(0,5);const todayEvents=data.events.filter(e=>e.date===selectedDay).sort((a,b)=>a.time.localeCompare(b.time));const todos=data.todos.filter(t=>!t.done).slice(0,4);
 return `${head('YOUR DAY · DAILY PLAN',`${dateLabel(selectedDay)}の仕事`,'予定と次の行動を、ひとつの視線で確認できます。',`<button class="secondary-button" data-action="pick-today">${icon('clock')} 今日に戻る</button>`)}
 <div class="strip"><span class="strip-title">今週</span>${weekdays}</div>
 <div class="day-grid">
 <section class="surface"><div class="surface-section"><div class="section-head"><h2>${icon('spark',18)} 先に進めたいこと <span class="count">${priority.length}</span></h2><button class="text-button" data-route="tasks">タスクをすべて見る ${icon('right',13)}</button></div>
 <div class="status-summary"><span><i class="bullet"></i>未完了 <strong>${activeTasks().length}</strong>件</span><span><i class="bullet" style="background:var(--red)"></i>期限超過 <strong>${activeTasks().filter(t=>t.due&&t.due<base).length}</strong>件</span><span><i class="bullet" style="background:var(--blue)"></i>確認待ち <strong>${activeTasks().filter(t=>t.status==='確認待ち').length}</strong>件</span></div>
 ${priority.length?priority.map((t,i)=>`<div class="focus-item"><div class="focus-order">${String(i+1).padStart(2,'0')}</div><div class="focus-main"><button class="focus-name" data-action="open" data-kind="tasks" data-id="${t.id}">${esc(t.title)}</button><div class="focus-meta">${taskTag(t)}<span>${esc(t.assignee)}</span><span>·</span><span>${esc(t.category)}</span></div></div><div class="focus-actions"><button class="row-action" data-action="task-done" data-id="${t.id}">完了</button><button class="ghost-row-action" data-action="open" data-kind="tasks" data-id="${t.id}">詳細</button></div></div>`).join(''):empty('対応待ちのタスクはありません','すべて完了しています。')}
 </div><div class="surface-section"><div class="section-head"><h2>次の操作</h2><span class="section-meta">すぐ始める</span></div><div style="display:flex;flex-wrap:wrap;gap:8px"><button class="secondary-button" data-action="new" data-kind="tasks">${icon('plus')} 共有タスク</button><button class="secondary-button" data-action="new" data-kind="todos">${icon('plus')} 個人ToDo</button><button class="secondary-button" data-action="new" data-kind="events">${icon('plus')} 予定</button></div></div></section>
 <div class="right-stack"><section class="surface"><div class="surface-section"><div class="section-head"><h2>今日の予定 <span class="count">${todayEvents.length}</span></h2><button class="text-button" data-route="calendar">カレンダー ${icon('right',13)}</button></div>
 ${todayEvents.length?`<div class="agenda-line">${todayEvents.map(e=>`<button class="agenda-entry" data-action="open" data-kind="events" data-id="${e.id}"><span class="agenda-time">${e.time}</span><span><span class="agenda-name">${esc(e.title)}</span><span class="agenda-location">${e.end?`${e.end}まで`:''}${e.location?' · '+esc(e.location):''}</span></span></button>`).join('')}</div>`:empty('予定はありません','追加から今日の予定を登録できます。')}
 <button class="text-button" data-action="new" data-kind="events" data-date="${selectedDay}">${icon('plus',14)} 予定を追加</button></div></section>
 <section class="surface"><div class="surface-section"><div class="section-head"><h2>個人ToDo <span class="count">${data.todos.filter(x=>!x.done).length}</span></h2><button class="text-button" data-route="todos">一覧へ ${icon('right',13)}</button></div>
 ${todos.length?todos.map(t=>`<label class="mini-todo"><input class="todo-check" type="checkbox" data-action="todo-check" data-id="${t.id}"/><span class="todo-title">${esc(t.title)}</span></label>`).join(''):empty('未完了のToDoはありません','下から新しいToDoを登録できます。')}
 <form class="small-add" data-form="quick-todo"><input name="title" placeholder="＋ ToDoをすばやく追加" aria-label="ToDoの追加" required maxlength="130"/><button type="submit" aria-label="ToDoを登録">＋</button></form></div></section></div></div>
 <div class="banner-quiet">${icon('info')} タスク・ToDo・予定・業務メモは、現在のルームの共通データを使用しています。</div>`;
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
   &&(taskFilter==='all'||(taskFilter==='active'&&!t.completed)
     ||(taskFilter==='mine'&&t.assignee==='自分')
     ||(taskFilter==='late'&&!t.completed&&t.due&&t.due<base)
     ||(taskFilter==='done'&&t.completed))
   &&(!q||[t.title,t.status,t.priority,t.category,t.assignee,t.requester,t.desc,...(t.tags||[])]
      .join(' ').toLocaleLowerCase().includes(q))
 ).sort(taskDisplaySort);
}
function renderTasks(){
 const filterOptions=[['active','進行中'],['all','すべて'],['mine','自分の担当'],['late','期限超過'],['done','完了']];
 const statusMarkers=snapshot.statuses.map(name=>`<button type="button" class="status-marker ${taskStatusChoice===name?'active':''}" data-action="filter-status" data-status="${esc(name)}" aria-pressed="${taskStatusChoice===name}"><span class="label">${esc(name)}</span><strong>${data.tasks.filter(t=>t.status===name).length}</strong></button>`).join('');
 const visible=taskVisible(),groups={};
 for(const task of visible){
   let name='';
   if(taskGrouping==='status')name=task.status||'状態未設定';
   else if(taskGrouping==='assignee')name=task.assignee||'担当者未設定';
   else if(task.completed)name='完了した仕事';
   else if(task.due&&task.due<base)name='期限超過';
   else if(task.due===base)name='今日まで';
   else if(task.due&&task.due<=shift(base,7))name='今週・近日';
   else if(!task.due)name='期限なし';
   else name='今後の予定';
   (groups[name]??=[]).push(task);
 }
 const groupList=Object.entries(groups).map(([name,rows])=>`<div class="group-title"><strong>${esc(name)}</strong><span>${rows.length}件</span></div>${rows.map(taskRow).join('')}`).join('');
 const filtered=taskQuery.trim()||taskStatusChoice||taskFilter!=='active';
 return `${head('WORK · TASKS','チームのタスク','期限・担当・状態から仕事を整理し、一覧で処理できます。',`<span>登録 ${data.tasks.length}件</span>`)}
 <div class="status-rail" aria-label="タスクの状態別件数">${statusMarkers}</div>
 <div class="work-toolbar"><div class="tab-pills" role="group" aria-label="タスクの表示条件">${filterOptions.map(([id,label])=>`<button type="button" class="${taskFilter===id?'active':''}" data-action="task-filter" data-value="${id}" aria-pressed="${taskFilter===id}">${label}</button>`).join('')}</div><div class="spacer"></div>
 <label class="quiet-small" for="groupSelect">まとめ方</label><select id="groupSelect" class="select-small" aria-label="タスクをまとめる方法"><option value="deadline" ${taskGrouping==='deadline'?'selected':''}>期限別</option><option value="status" ${taskGrouping==='status'?'selected':''}>状態別</option><option value="assignee" ${taskGrouping==='assignee'?'selected':''}>担当者別</option></select>
 <button type="button" class="secondary-button" data-action="new" data-kind="tasks">${icon('plus')} タスクを追加</button></div>
 <div class="origin-task-tools"><input id="originTaskQuery" type="search" placeholder="件名・担当・分類・説明を検索" aria-label="タスクを検索" autocomplete="off" value="${esc(taskQuery)}"/>
 <label for="originTaskSort">並び順 <select id="originTaskSort"><option value="due" ${taskSortMode==='due'?'selected':''}>期限順</option><option value="priority" ${taskSortMode==='priority'?'selected':''}>優先度順</option><option value="updated" ${taskSortMode==='updated'?'selected':''}>更新順</option></select></label>
 <button type="button" class="origin-density-button" data-action="task-density" aria-pressed="${taskDensity==='compact'}" title="一覧の行間隔を切り替える">${taskDensity==='compact'?'ゆったり表示':'コンパクト表示'}</button>
 </div>
 <div class="origin-task-summary"><span>表示 ${visible.length}件 ／ 全体 ${data.tasks.length}件${selectedBulk.size?' · '+selectedBulk.size+'件選択中':''}</span>${filtered?'<button type="button" data-action="task-reset">絞り込みを解除</button>':''}</div>
 ${selectedBulk.size?`<div class="bulkbar">${icon('check',16)} ${selectedBulk.size}件選択中 <div class="spacer"></div><button data-action="bulk-done">まとめて完了</button><button data-action="bulk-clear">選択解除</button></div>`:''}
 <section class="surface work-collection origin-task-collection ${taskDensity==='compact'?'origin-tasks-compact':''}">${groupList||empty('表示するタスクがありません','絞り込みを解除するか、新しくタスクを登録してください。')}</section>
 <p class="quiet-small origin-task-tip">件名から詳細を確認できます。チェックは一括選択用です。</p>`;
}
function taskRow(t){
 const urgent=!t.completed&&t.due&&t.due<base;
 const dateText=t.due?humanDue(t.due)+(t.dueTime?' '+t.dueTime:''):'期限なし';
 const due=t.due?`<span class="origin-task-mobile-due ${urgent?'urgent':''}">${esc(dateText)}</span>`:'';
 return `<div class="item-row"><input type="checkbox" class="todo-check task-select-check" data-action="bulk-toggle" data-id="${esc(t.id)}" aria-label="一括選択：${esc(t.title)}" ${selectedBulk.has(t.id)?'checked':''}/><div class="origin-task-main"><button type="button" class="item-name" data-action="open" data-kind="tasks" data-id="${esc(t.id)}">${esc(t.title)}</button><div class="row-under">${taskTag(t)} <span class="origin-task-meta">${esc(t.category||'分類なし')} · ${esc(t.priority||'中')}優先</span>${due}</div></div><span class="item-assignee">${esc(t.assignee||'未設定')}</span><span class="item-date ${urgent?'urgent':''}">${esc(dateText)}</span><div class="row-last"><button type="button" class="primary-mini" data-action="task-done" data-id="${esc(t.id)}" aria-label="${esc(t.title)}を${t.completed?'未完了に戻す':'完了にする'}">${t.completed?'戻す':'完了'}</button></div></div>`;
}
function renderTodos(){
 const done=data.todos.filter(t=>t.done),pending=data.todos.filter(t=>!t.done);
 const pct=data.todos.length?Math.round(done.length/data.todos.length*100):0;
 return `${head('MY LIST · PERSONAL','自分のToDo','今すぐ取りかかることを、すばやく追加・確認できます。',`<span>未完了 ${pending.length}件</span>`)}
 <div class="origin-todo-summary" aria-label="ToDoの進捗">
   <div class="origin-todo-metrics"><span>未完了 <strong>${pending.length}</strong>件</span><span>完了 <strong>${done.length}</strong>件</span><span>進捗 <strong>${pct}%</strong></span></div>
   <div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="ToDoの完了率"><div class="progress-fill" style="width:${pct}%"></div></div>
 </div>
 <section class="surface origin-todo-main"><div class="surface-section">
   <div class="section-head"><h2>${icon('todo',18)} やること <span class="count">${pending.length}</span></h2><button type="button" class="text-button" data-action="new" data-kind="todos">詳しく追加 ${icon('plus',13)}</button></div>
   <form class="small-add origin-todo-add" data-form="quick-todo"><input name="title" placeholder="やることを入力してEnter" maxlength="130" required autocomplete="off" aria-label="新しいToDo"/><button type="submit" aria-label="ToDoを追加">${icon('plus',16)}</button></form>
   <div class="origin-todo-list">${pending.length?pending.map(todoRow).join(''):empty('未完了のToDoはありません','上の入力欄からすぐ追加できます。')}</div>
   <div class="origin-todo-archive">
     <button type="button" class="origin-todo-archive-toggle" data-action="todo-completed-toggle" aria-expanded="${todoCompletedOpen}" aria-controls="originCompletedTodos"><span>${icon('check',16)} 完了したToDo <strong>${done.length}件</strong></span><span>${todoCompletedOpen?'閉じる':'履歴を見る'} ${icon('chevron',15)}</span></button>
     <div id="originCompletedTodos" ${todoCompletedOpen?'':'hidden'}>${done.length?done.slice().reverse().map(todoRow).join(''):'<p class="quiet-small">まだ完了履歴はありません。</p>'}</div>
   </div>
 </div></section>`;
}
function todoRow(t){
 return `<div class="todo-entry"><input type="checkbox" class="todo-check" data-action="todo-check" data-id="${esc(t.id)}" ${t.done?'checked':''} aria-label="${esc(t.title)}を${t.done?'未完了へ戻す':'完了にする'}"/><button type="button" class="todo-text ${t.done?'done':''}" data-action="open" data-kind="todos" data-id="${esc(t.id)}">${esc(t.title)}</button><button type="button" class="todo-edit" data-action="open" data-kind="todos" data-id="${esc(t.id)}" aria-label="${esc(t.title)}の詳細を開く">${icon('right',15)}</button></div>`;
}
function renderCalendar(){
 const start=monday(parseDay(selectedDay)),end=addDay(start,6),query=scheduleQuery.trim().toLocaleLowerCase();
 const weekAll=data.events.filter(e=>e.date>=key(start)&&e.date<=key(end));
 const shown=weekAll.filter(e=>(scheduleAssignee==='all'||e.assignee===scheduleAssignee)
   &&(!query||[e.title,e.location,e.assignee,e.category,e.desc].join(' ').toLocaleLowerCase().includes(query)));
 const daysInWeek=[0,1,2,3,4,5,6].map(i=>{
   const date=addDay(start,i),dateKey=key(date);
   return {date,dateKey,events:shown.filter(e=>e.date===dateKey).sort((a,b)=>a.time.localeCompare(b.time))};
 });
 const wide=daysInWeek.map(({date,dateKey,events})=>`
 <section class="weekday-col ${dateKey===base?'current':''} ${dateKey===selectedDay?'origin-selected':''}">
   <div class="weekday-head"><button type="button" class="origin-weekday-focus" data-action="calendar-day" data-date="${dateKey}" aria-label="${dateLabel(dateKey)}の予定を日別表示"><span>${days[date.getDay()]}曜日</span><strong>${date.getDate()}</strong><small>${events.length}件</small></button></div>
   <div class="weekday-body">${events.map(e=>`<button class="schedule-event ${e.time<'12:00'?'':'blue'}" data-action="open" data-kind="events" data-id="${esc(e.id)}"><div class="time">${esc(e.time)}–${esc(e.end)}</div><div class="title">${esc(e.title)}</div></button>`).join('')}<button class="weekday-add" data-action="new" data-kind="events" data-date="${dateKey}" aria-label="${dateLabel(dateKey)}に予定追加">＋</button></div>
 </section>`).join('');
 const mobile=daysInWeek.map(({date,dateKey,events})=>`<div class="agenda-day ${dateKey===selectedDay?'origin-selected':''}">
   <div class="agenda-day-head"><button type="button" class="origin-agenda-day-label" data-action="calendar-day" data-date="${dateKey}" aria-label="${dateLabel(dateKey)}の日別表示">${date.getMonth()+1}/${date.getDate()}（${days[date.getDay()]}） ${dateKey===base?'・今日':''} <span>${events.length}件</span></button><button data-action="new" data-kind="events" data-date="${dateKey}">＋ 予定</button></div>
   ${events.length?events.map(e=>`<button class="agenda-entry" data-action="open" data-kind="events" data-id="${esc(e.id)}"><span class="agenda-time">${esc(e.time)}–${esc(e.end)}</span><span><span class="agenda-name">${esc(e.title)}</span>${e.location||e.assignee?`<span class="agenda-location">${esc(e.location||e.assignee)}</span>`:''}</span></button>`).join(''):'<span class="quiet-small">予定なし</span>'}</div>`).join('');
 const agenda=daysInWeek.map(({dateKey,events})=>`<section class="origin-agenda-group"><strong>${dateLabel(dateKey)} · ${events.length}件</strong>${events.map(e=>`<button class="origin-agenda-entry" data-action="open" data-kind="events" data-id="${esc(e.id)}"><time>${esc(e.time)}–${esc(e.end)}</time><strong>${esc(e.title)}</strong><small>${esc(e.location||e.assignee||'')}</small></button>`).join('')||'<p class="quiet-small">予定なし</p>'}</section>`).join('');
 const focused=shown.filter(e=>e.date===selectedDay).sort((a,b)=>a.time.localeCompare(b.time));
 const dayView=`<div class="origin-day-focus"><div class="origin-day-heading"><div><small>SELECTED DAY</small><h2>${dateLabel(selectedDay)} <span>${focused.length}件</span></h2></div><div class="origin-day-controls"><button type="button" data-action="day-prev" aria-label="前の日へ">${icon('left',17)}</button><button type="button" data-action="day-next" aria-label="次の日へ">${icon('right',17)}</button></div></div><div class="origin-day-items">${focused.length?focused.map(e=>`<button type="button" class="origin-day-entry" data-action="open" data-kind="events" data-id="${esc(e.id)}"><time>${esc(e.time)}–${esc(e.end)}</time><span><strong>${esc(e.title)}</strong>${e.location||e.assignee?`<small>${esc(e.location||e.assignee)}</small>`:''}</span><span class="origin-day-open">${icon('right',17)}</span></button>`).join(''):empty('この日の予定はありません','ほかの日付を選ぶか、この日に新しい予定を登録してください。')}</div><button class="text-button origin-day-add" data-action="new" data-kind="events" data-date="${selectedDay}">${icon('plus',15)} この日に予定を追加</button></div>`;
 const calendarBody=scheduleView==='day'?dayView:scheduleView==='agenda'?agenda:`<div class="week-board">${wide}</div><div class="mobile-agenda">${mobile}</div>`;
 return `${head('TIME · CALENDAR','予定を見渡す','週全体と選択日の予定を、用途に合わせて切り替えられます。')}
 <div class="work-toolbar origin-schedule-toolbar"><div class="calendar-tools"><button data-action="week-prev" aria-label="前の週">${icon('left')}</button><span class="period">${rangeLabel(selectedDay)}</span><button data-action="week-next" aria-label="次の週">${icon('right')}</button></div><div class="origin-calendar-controls"><input type="search" id="originScheduleSearch" class="origin-calendar-search" value="${esc(scheduleQuery)}" placeholder="この週の予定を検索" aria-label="この週の予定を検索"/><input type="date" id="originDateJump" aria-label="表示する日付を選ぶ" value="${selectedDay}"/><select class="select-small" id="originScheduleAssignee" aria-label="予定担当者で絞り込む"><option value="all">全担当者</option>${[...new Set(data.events.map(e=>e.assignee).filter(Boolean))].map(a=>`<option value="${esc(a)}" ${scheduleAssignee===a?'selected':''}>${esc(a)}</option>`).join('')}</select><div class="origin-schedule-view" role="group" aria-label="予定の表示形式">${[['week','週間'],['agenda','一覧'],['day','日別']].map(([mode,label])=>`<button type="button" data-action="calendar-view" data-value="${mode}" class="${scheduleView===mode?'active':''}" aria-pressed="${scheduleView===mode}">${label}</button>`).join('')}</div></div><div class="spacer"></div><button class="secondary-button" data-action="pick-today">今日に戻る</button><button class="secondary-button" data-action="new" data-kind="events">${icon('plus')} 予定を追加</button></div>
 <section class="surface">${calendarBody}<div class="calendar-footer"><span>予定を押すと詳細・編集が開きます</span><span>表示 ${shown.length}件 ／ この週 ${weekAll.length}件</span></div></section>`;
}
const memoColors=[['ivory','白'],['lemon','レモン'],['peach','ピーチ'],['mint','ミント'],['sky','スカイ'],['lavender','ラベンダー']];function memoColor(v){return memoColors.some(x=>x[0]===v)?v:'ivory'}
 function renderNotes(){
 const query=memoQuery.trim().toLocaleLowerCase();
 const items=data.memos.filter(m=>{
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
 const categories=Array.from(new Set([...(memoBridge?.categories||[]),...data.memos.map(m=>m.category)].filter(Boolean)));
 const filtered=memoFilter!=='all'||memoColorFilter!=='all'||Boolean(query);
 return `${head('LIBRARY · NOTES','業務メモ','分類や色、キーワードからメモを探せます。',`<span>保存 ${data.memos.length}件</span>`)}
 <div class="memo-toolbar"><div class="tab-pills" role="group" aria-label="メモの分類で絞り込む">${[['all','すべて'],['pinned','固定'],...categories.map(x=>[x,x])].map(([id,label])=>`<button type="button" data-action="memo-filter" data-value="${esc(id)}" class="${memoFilter===id?'active':''}" aria-pressed="${memoFilter===id}">${esc(label)}</button>`).join('')}</div><button class="secondary-button" data-action="new" data-kind="memos">${icon('plus')} メモを書く</button></div>
 <div class="origin-memo-utility"><input type="search" id="originMemoQuery" placeholder="タイトル・本文・タグを検索" aria-label="メモを検索" autocomplete="off" value="${esc(memoQuery)}"/><label for="originMemoSort">並び順 <select id="originMemoSort" aria-label="メモの並び順"><option value="updated" ${memoSort==='updated'?'selected':''}>最近の内容更新</option><option value="title" ${memoSort==='title'?'selected':''}>タイトル順</option><option value="category" ${memoSort==='category'?'selected':''}>分類順</option></select></label></div>
 <div class="origin-memo-filters" role="group" aria-label="メモの色で絞り込む">${[['all','全色'],...memoColors].map(([id,label])=>`<button type="button" data-action="memo-color-filter" data-value="${id}" class="${memoColorFilter===id?'active':''}" aria-pressed="${memoColorFilter===id}">${label}</button>`).join('')}</div>
 <div class="origin-memo-result" aria-live="polite"><span>表示 ${items.length}件 ／ 全体 ${data.memos.length}件</span>${filtered?'<button type="button" data-action="memo-reset">絞り込みを解除</button>':''}</div>
 <div class="memo-grid">${items.length?items.map(m=>`<div class="origin-memo-shell" data-paper-color="${memoColor(m.paperColor)}"><button class="memo-card" data-action="open" data-kind="memos" data-id="${esc(m.id)}"><span class="memo-icon">${icon('notes',19)}</span><h3>${esc(m.title)}</h3><p>${esc(m.body)}</p><span class="memo-bottom"><span>${esc(m.category)} · ${Number.isFinite(m.updated)&&m.updated>0?new Date(m.updated).toLocaleDateString('ja-JP'):'更新日未設定'}</span><span>${m.pinned?icon('pin',15):icon('right',15)}</span></span></button><div class="origin-memo-colors"><span>色変更</span>${memoColors.map(([value,label])=>`<button type="button" class="origin-color-dot" data-paper-color="${value}" data-action="memo-color" data-id="${esc(m.id)}" data-value="${value}" aria-label="${esc(m.title)}を${label}に変更" title="${label}" aria-pressed="${memoColor(m.paperColor)===value}"></button>`).join('')}</div></div>`).join(''):empty('該当するメモがありません','絞り込みを解除するか、新しいメモを作成してください。')}</div>`;
}
const singular={tasks:'タスク',todos:'ToDo',events:'予定',memos:'メモ'};
function findItem(kind,id){return data[kind]?.find(x=>x.id===id)}
// Native schedule editor over the canonical (single-owner) schedule writer.
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
 return `<div class="origin-schedule-intro"><strong>予定を登録・編集</strong><p>日時と担当者を選び、この画面でそのまま保存できます。</p></div>
 <div class="form-grid">
 <label class="form-field full">予定名<input name="title" value="${esc(v.title||'')}" maxlength="80" required placeholder="例：部署ミーティング"/></label>
 <label class="form-field">開始日時<input name="startAt" type="datetime-local" value="${esc(start)}" required/></label>
 <label class="form-field">終了日時<input name="endAt" type="datetime-local" value="${esc(end)}" required/></label>
 <div class="form-field full origin-schedule-duration" role="group" aria-label="所要時間"><span>所要時間</span><button type="button" data-action="schedule-duration" data-minutes="30">30分</button><button type="button" data-action="schedule-duration" data-minutes="60">1時間</button><button type="button" data-action="schedule-duration" data-minutes="120">2時間</button></div>
 <label class="form-field">担当者<select name="assignee" required>${options(snapshot.assignees,assignee)}</select></label>
 <label class="form-field">分類<select name="category" required>${options(snapshot.categories,category)}</select></label>
 <label class="form-field full">関連するタスク<select name="relatedTaskId">${related}</select></label>
 <label class="form-field full">場所・方法<input name="location" maxlength="60" value="${esc(v.location||'')}" placeholder="会議室・オンラインなど"/></label>
 <label class="form-field full">メモ<textarea name="memo" maxlength="1000" placeholder="議題や補足">${esc(v.desc||'')}</textarea></label>
 </div><p id="originScheduleError" class="origin-schedule-error" role="alert" hidden></p>
 ${v.recurrenceSeriesId?'<p class="origin-schedule-note">繰り返し予定のこの1件のみ編集し、系列の設定は維持します。</p>':''}
 <p class="origin-schedule-note">繰り返しや複数日登録は <button type="button" data-action="schedule-classic" data-id="${esc(id||'')}">詳細設定</button>を使用できます。</p>`;
}

function taskCheckRow(x={}){return '<div class="origin-checkrow"><input type="checkbox" name="checkDone" aria-label="この項目を完了にする" '+(x.done?'checked':'')+'/><input type="text" name="checkText" maxlength="180" value="'+esc(x.text||'')+'" aria-label="チェック項目の内容" placeholder="作業項目を入力"/><button type="button" data-action="task-check-remove" aria-label="このチェック項目を削除" title="削除">'+icon('trash',14)+'</button></div>'}
function taskCheckboxRows(v){return (v.checklist||[]).map(taskCheckRow).join('')}
function taskPanel(t){
 const items=t.checklist||[],done=items.filter(x=>x.done).length,pct=items.length?Math.round(done/items.length*100):0;
 const hist=(t.history||[]).slice().reverse(),related=data.events.filter(e=>e.relatedTaskId===t.id).slice(0,3);
 return `<div class="origin-task-detail"><div class="record-meta">${badge(t)}<span class="tag">${esc(t.priority)}優先</span><span class="tag">${esc(t.category)}</span></div>
 <section class="origin-task-overview"><div class="origin-progress-head"><strong>チェックリスト</strong><b>${items.length?pct+'%':'未設定'}</b></div><div class="origin-progress"><i style="width:${pct}%"></i></div><small>${done} / ${items.length} 完了</small>
 <dl class="detail-list"><div><dt>担当者</dt><dd>${esc(t.assignee)}</dd></div><div><dt>期限日</dt><dd>${esc(dateLabel(t.due))}</dd></div><div><dt>依頼者</dt><dd>${esc(t.requester||'未設定')}</dd></div><div><dt>状態</dt><dd>${esc(t.status)}</dd></div></dl></section>
 <section class="origin-task-section"><h3>作業項目</h3>${items.length?items.map((x,i)=>`<label class="origin-task-check"><input data-action="task-check" data-id="${esc(t.id)}" data-index="${i}" data-revision="${t.revision}" type="checkbox" ${x.done?'checked':''} /><span class="${x.done?'is-done':''}">${esc(x.text)}</span></label>`).join(''):'<p>項目はまだありません。</p>'}</section>
 <section class="origin-task-section"><h3>説明</h3><p class="record-description">${esc(t.desc||'説明はありません。')}</p></section>
 ${t.tags?.length?`<section class="origin-task-section"><h3>タグ</h3><div class="record-meta">${t.tags.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div></section>`:''}
 ${related.length?`<section class="origin-task-section"><h3>関連する予定</h3>${related.map(e=>`<button type="button" class="secondary-button" data-action="open" data-kind="events" data-id="${esc(e.id)}">${esc(e.title)}</button>`).join('')}</section>`:''}
 <section class="origin-task-section"><h3>最近の更新</h3><small>最終更新：${t.updatedAt?esc(new Date(t.updatedAt).toLocaleString('ja-JP')):'未記録'}</small>
 ${hist.length?`<ol class="origin-task-history">${hist.map(x=>`<li>${esc(x.text)}<small>${esc(x.author)} · ${x.createdAt?esc(new Date(x.createdAt).toLocaleString('ja-JP')):''}</small></li>`).join('')}</ol>`:'<p>履歴はまだありません。</p>'}</section></div>`;
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
function sheetFrame(kicker,title,content,footer){return `<div class="sheet-head"><div><small>${esc(kicker)}</small><h2 id="panelHeading">${esc(title)}</h2></div><button class="sheet-close" type="button" data-action="close" aria-label="閉じる">${icon('close',20)}</button></div><div class="sheet-body">${content}</div><div class="sheet-foot">${footer}</div>`}
let panelMode='detail', panelKind='', panelId='', initialFormSnapshot='';
let detailSequence=null;
// Use only the cards displayed in the originating view; no persistent sorting state.
function captureDetailSequence(kind,id,trigger){
 const container=trigger?.closest('#workspace')||trigger?.closest('#searchResults');
 const ids=[],seen=new Set();
 for(const button of container?.querySelectorAll('[data-kind][data-id][data-action]')||[]){
   if(!['open','search-open'].includes(button.dataset.action)||button.dataset.kind!==kind)continue;
   const candidate=button.dataset.id;
   if(!candidate||seen.has(candidate)||!findItem(kind,candidate)||!button.getClientRects().length)continue;
   seen.add(candidate);ids.push(candidate);
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
 return `<nav class="origin-detail-pager" aria-label="${label}を続けて確認"><span class="origin-detail-position">${index+1} / ${ids.length}件</span><div class="origin-detail-controls"><button type="button" data-action="detail-prev" ${previous?'':'disabled'} aria-label="前の${label}を表示">${icon('left',15)} 前へ</button><button type="button" data-action="detail-next" ${next?'':'disabled'} aria-label="次の${label}を表示">次へ ${icon('right',15)}</button></div></nav>`;
}
function restoreDetailFocus(kind,id){
 const workspace=$('#workspace');
 const target=Array.from(workspace?.querySelectorAll('[data-action="open"][data-kind][data-id]')||[])
   .find(button=>button.dataset.kind===kind&&button.dataset.id===id&&button.getClientRects().length);
 const navigation=window.innerWidth<=770?$('#mobileNav'):$('#desktopNav');
 (target||navigation?.querySelector('[data-route="'+view+'"]'))?.focus({preventScroll:true});
}
function navigateDetail(direction){
 if(!panelOpen||panelMode!=='detail')return;
 const neighbor=detailNeighbors(panelKind,panelId);
 const nextId=direction<0?neighbor.previous:neighbor.next;
 if(!nextId)return;
 panelShow(panelKind,nextId,false);
 // Retain the browse control after swapping details so the next item is one click away.
 const preferred=$('#sheet [data-action="'+(direction<0?'detail-prev':'detail-next')+'"]');
 const fallback=$('#sheet [data-action="'+(direction<0?'detail-next':'detail-prev')+'"]');
 (preferred&&!preferred.disabled?preferred:fallback)?.focus({preventScroll:true});
}
function panelShow(kind,id,edit=false,seed={}){
 const obj=id?findItem(kind,id):null;if(id&&!obj)return;
 if(panelOpen&&!closePanel(false,false))return;
 panelOpen=true;panelMode=edit?'edit':'detail';panelKind=kind;panelId=id||'';
 const freshObj=obj||{},v={...freshObj,...seed};
 if(edit){
 const fields=kind==='tasks'?`<div class="form-grid"><label class="form-field full">件名<input name="title" maxlength="80" required value="${esc(v.title||'')}"/></label><label class="form-field">状態<select name="status">${snapshot.statuses.map(s=>`<option value="${esc(s)}" ${s===(v.status||'未着手')?'selected':''}>${esc(s)}</option>`).join('')}</select></label><label class="form-field">優先度<select name="priority">${['緊急','高','中','低'].map(s=>`<option value="${s}" ${s===(v.priority||'中')?'selected':''}>${s}</option>`).join('')}</select></label><label class="form-field">期限日（任意）<input name="due" type="date" value="${esc(v.due||'')}"/></label><label class="form-field">期限時刻（任意）<input name="dueTime" type="time" value="${esc(v.dueTime||'')}"/></label><label class="form-field">担当者<select name="assignee">${[...new Set(['自分',...snapshot.assignees.filter(x=>x!==snapshot.currentUser),v.assignee])].filter(Boolean).map(s=>`<option value="${esc(s)}" ${s===(v.assignee||'自分')?'selected':''}>${esc(s)}</option>`).join('')}</select></label><label class="form-field">分類<select name="category">${snapshot.categories.map(s=>`<option value="${esc(s)}" ${s===(v.category||snapshot.categories[0])?'selected':''}>${esc(s)}</option>`).join('')}</select></label><label class="form-field">依頼者<input name="requester" maxlength="40" value="${esc(v.requester||'')}"/></label><label class="form-field">タグ<input name="tags" maxlength="80" value="${esc((v.tags||[]).join(', '))}"/></label><label class="form-field full">説明<textarea name="desc" maxlength="6000" placeholder="対応内容や補足事項">${esc(v.desc||'')}</textarea></label><div class="form-field full"><strong>チェックリスト</strong><div id="originTaskChecks">${taskCheckboxRows(v)}</div><button type="button" class="secondary-button" data-action="task-check-add">＋ 項目を追加</button></div><label class="form-field full"><span><input type="checkbox" name="pinned" ${v.pinned?'checked':''}/>固定する</span></label><p id="originTaskError" class="origin-task-error" role="alert" hidden></p></div>`:
 kind==='todos'?`<label class="form-field">やること <span class="help">必須</span><input name="title" value="${esc(v.title||'')}" maxlength="220" required placeholder="何をしますか？"/></label><label class="form-field"><span>状態</span><select name="done"><option value="false" ${!v.done?'selected':''}>未完了</option><option value="true" ${v.done?'selected':''}>完了</option></select></label><label class="form-field">補足メモ<textarea name="memo" placeholder="必要な情報を記録（任意）">${esc(v.memo||'')}</textarea></label>`:
 kind==='events'?originScheduleEditor(v,id):
  `<fieldset class="form-field full"><legend>カードの色</legend><div class="origin-memo-palette">${memoColors.map(([k,label])=>`<label><input type="radio" name="paperColor" value="${k}" ${memoColor(v.paperColor)===k?'checked':''}/>${label}</label>`).join('')}</div></fieldset>`+
 `<label class="form-field">タイトル <span class="help">必須</span><input name="title" value="${esc(v.title||'')}" maxlength="150" required placeholder="メモのタイトル"/></label><label class="form-field">分類<select name="category">${Array.from(memoBridge?.categories||['その他']).map(s=>`<option value="${s}" ${s===(v.category||'その他')?'selected':''}>${s}</option>`).join('')}</select></label><label class="form-field">内容<textarea name="body" style="min-height:260px" placeholder="ここに内容を記入">${esc(v.body||'')}</textarea></label><label class="form-field" style="flex-direction:row;align-items:center"><input style="width:auto;min-height:auto" type="checkbox" name="pinned" ${v.pinned?'checked':''}/>固定メモとして表示する</label>`;
 const f=`<form id="editForm" data-kind="${kind}" data-id="${esc(id||'')}">${fields}</form>`;
 const footer=`${id&&!(kind==='events'&&v.recurrenceSeriesId)?`<button type="button" class="danger-button" data-action="delete" data-kind="${kind}" data-id="${esc(id)}">${icon('trash',14)} 削除</button>`:''}<button type="button" class="secondary-button" data-action="close">キャンセル</button><button class="primary-button" type="submit" form="editForm">${id?'変更を保存':'登録する'}</button>`;
 $('#sheet').innerHTML=sheetFrame('EDIT · '+singular[kind],id?singular[kind]+'を編集':singular[kind]+'を新規作成',f,footer);
 if(kind==='events'||kind==='tasks'){
   const original=id?(kind==='events'?snapshot.schedules.find(x=>x.id===id):snapshot.tasks.find(x=>x.id===id)):null;
   const f=$('#editForm');
   f.dataset.revision=String(original?.revision??0);
   f.dataset.ownerRoom=String(snapshot.roomId);
   f.dataset.ownerUser=String(snapshot.currentUser);
 }
 initialFormSnapshot=formSnapshot($('#editForm'));
 }else{
 const t=obj;let body='';
 if(kind==='tasks'){body=taskPanel(t);}
 if(kind==='todos'){body=`<div class="record-meta">${t.done?'<span class="tag done">完了</span>':'<span class="tag">未完了</span>'}<span class="tag">個人ToDo</span></div>${t.memo?`<h3 class="detail-subheading">メモ</h3><p class="record-description">${esc(t.memo)}</p>`:''}`;}
 if(kind==='events'){
  const linked=snapshot.tasks.find(x=>x.id===t.relatedTaskId);
  body=`<dl class="detail-list">
  <div><dt>開始日時</dt><dd>${esc(new Date(t.startAt).toLocaleString('ja-JP'))}</dd></div>
  <div><dt>終了日時</dt><dd>${esc(new Date(t.endAt).toLocaleString('ja-JP'))}</dd></div>
  <div><dt>担当者</dt><dd>${esc(t.assignee||'未設定')}</dd></div>
  <div><dt>分類</dt><dd>${esc(t.category||'未設定')}</dd></div>
  <div><dt>場所・方法</dt><dd>${esc(t.location||'指定なし')}</dd></div>
  ${t.relatedTaskId?`<div><dt>関連タスク</dt><dd>${esc(linked?.title||'以前の関連タスク')}</dd></div>`:''}
  </dl>
  ${t.recurrenceSeriesId?'<p class="origin-schedule-note">繰り返し予定のこの1件です。系列全体は詳細設定から管理できます。</p>':''}
  <h3 class="detail-subheading">メモ</h3><p class="record-description">${esc(t.desc||'メモはありません。')}</p>`;
 }
 if(kind==='memos'){body=`<div class="record-meta"><span class="tag">${esc(t.category)}</span>${t.pinned?`<span class="tag med">${icon('pin',12)} 固定</span>`:''}</div><article class="memo-document">${esc(t.body||'内容はありません。').replace(/\n/g,'<br>')}</article><p class="quiet-small" style="margin-top:17px">更新：${new Date(t.updated).toLocaleString('ja-JP')}</p>`;}
 let footer=`<button type="button" class="secondary-button" data-action="close">閉じる</button>`;
 if(kind==='tasks'){footer+=`<button class="secondary-button" data-action="task-done" data-id="${id}">${t.status==='完了'?'未完了に戻す':'完了にする'}</button>`;}
 if(kind==='todos'){footer+=`<button class="secondary-button" data-action="todo-toggle" data-id="${id}">${t.done?'未完了に戻す':'完了にする'}</button>`;}
 if(kind==='memos')footer+=`<button class="secondary-button" data-action="memo-task" data-id="${id}">タスクにする</button>`;
 if(kind==='events'&&t.recurrenceSeriesId)
   footer+=`<button class="secondary-button" data-action="schedule-classic" data-id="${esc(id)}">系列の設定</button>`;
 footer+=`<button class="primary-button" data-action="edit" data-kind="${kind}" data-id="${id}">${icon('edit',16)} 編集する</button>`;
 $('#sheet').innerHTML=sheetFrame('DETAIL · '+singular[kind],t.title,detailPager(kind,id)+body,footer);
 }
 $('#overlay').hidden=false;document.body.style.overflow='hidden';if(edit&&window.innerWidth>770)$('#editForm [name="title"]')?.focus();else $('#sheet .sheet-close')?.focus();
}
function formSnapshot(f){if(!f)return '';const fd=new FormData(f);return [...fd.entries()].map(([k,v])=>`${k}=${v}`).join('&')}
function closePanel(force=false,restoreFocus=true){
 if(!panelOpen)return true;
 if(!force&&panelMode==='edit'&&formSnapshot($('#editForm'))!==initialFormSnapshot){
   if(!window.confirm('入力中の変更を破棄して閉じますか？'))return false;
 }
 const kind=panelKind,id=panelId;
 $('#overlay').hidden=true;$('#sheet').innerHTML='';document.body.style.overflow='';
 panelOpen=false;panelKind='';panelId='';
 if(restoreFocus)restoreDetailFocus(kind,id);
 return true;
}
function notify(message){const t=$('#originToast');window.clearTimeout(toastTimer);
 t.textContent=String(message);t.hidden=false;toastTimer=window.setTimeout(()=>{t.hidden=true},4200)}
async function quickTodo(title){const value=String(title||'').trim();if(!value)return;
 const ok=await send({type:'todo.create',text:value},'ToDoを追加しました');
 if(ok){quickTodoDraft='';const next=$('#workspace [data-form="quick-todo"] [name="title"]');if(next){next.value='';next.focus({preventScroll:true})}}
}
async function toggleTodo(id){await send({type:'todo.toggle',id},'ToDoを更新しました')}
async function toggleTaskDone(id){const t=findItem('tasks',id);if(!t)return;
 const type=t.completed?'task.reopen':'task.complete';
 await send({type,id},type==='task.complete'?'タスクを完了しました':'タスクを再開しました')}
function closeSearch(){const sr=$('#searchResults');sr.hidden=true;searchQuery=''}
function handleRoute(route){if(!viewDefs.some(x=>x[0]===route))return;if(panelOpen&&!closePanel(false,false))return;detailSequence=null;view=route;selectedBulk.clear();closeSearch();$('#createMenu').hidden=true;render();window.scrollTo({top:0,behavior:'instant'})}
function renderSearch(q){const sr=$('#searchResults');const s=String(q||'').trim().toLocaleLowerCase();searchQuery=s;if(!s){sr.hidden=true;return}let hits=[];const types=[['tasks','共有タスク'],['todos','個人ToDo'],['events','予定'],['memos','業務メモ']];for(const [kind,label] of types){for(const item of data[kind]){if([item.title,item.desc,item.body,item.category,item.assignee].some(s=>String(s||'').toLocaleLowerCase().includes(searchQuery))){hits.push({kind,id:item.id,label,title:item.title})}}}hits=hits.slice(0,8);sr.innerHTML=hits.length?`<p class="quiet-small" style="margin:4px 8px 8px">検索結果 ${hits.length}件${hits.length===8?'（最初の8件）':''}</p>`+hits.map(h=>`<button class="search-hit" type="button" data-action="search-open" data-kind="${h.kind}" data-id="${h.id}"><strong>${esc(h.title)}</strong><span>${h.label}</span></button>`).join(''):`<p class="quiet-small" style="padding:12px">該当する仕事はありません。</p>`;sr.hidden=false}
function openCreateMenu(){const m=$('#createMenu');m.hidden=!m.hidden;if(!m.hidden)m.innerHTML=`${[['tasks','共有タスク','tasks'],['todos','個人ToDo','todo'],['events','予定','calendar'],['memos','業務メモ','notes']].map(([k,n,ic])=>`<button class="pop-row" type="button" data-action="new" data-kind="${k}">${icon(ic,19)} ${n}を作成</button>`).join('')}`}
async function saveForm(f){
 const fd=new FormData(f),kind=f.dataset.kind,id=f.dataset.id;
 const title=String(fd.get('title')||'').trim();if(!title)return;
 if(kind==='events'){
   const invalid=(message,field)=>{
     const region=f.querySelector('#originScheduleError');
     if(region){region.textContent=message;region.hidden=false}
     f.elements.namedItem(field)?.focus();
     return false;
   };
   const startAt=String(fd.get('startAt')||''),endAt=String(fd.get('endAt')||'');
   const start=new Date(startAt),end=new Date(endAt);
   if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime()))
     return invalid('開始日時と終了日時を入力してください。','startAt');
   if(end<=start)return invalid('終了日時は開始日時より後にしてください。','endAt');
   if(f.dataset.ownerRoom!==snapshot.roomId||f.dataset.ownerUser!==snapshot.currentUser)
     return invalid('共有ルームまたは利用者が変わりました。開き直してください。','title');
   const revision=Number(f.dataset.revision);
   const record=id?snapshot.schedules.find(x=>x.id===id):null;
   if(!Number.isSafeInteger(revision)||revision<0||(id&&(!record||Number(record.revision)!==revision)))
     return invalid('ほかの端末で変更されました。編集中の入力を保っています。','title');
   const values={title,startAt,endAt,
     assignee:String(fd.get('assignee')||snapshot.currentUser),
     category:String(fd.get('category')||snapshot.categories[0]||'その他'),
     relatedTaskId:String(fd.get('relatedTaskId')||''),
     location:String(fd.get('location')||''),memo:String(fd.get('memo')||'')};
   return send({type:id?'schedule.update':'schedule.create',id,revision,
     ownerRoom:f.dataset.ownerRoom,ownerUser:f.dataset.ownerUser,values},
     id?'予定を更新しました':'予定を登録しました',{close:true});
 }
 const existing=id ? (kind==='tasks'?snapshot.tasks.find(t=>t.id===id):
  kind==='memos'?memoItems.find(t=>t.id===id):snapshot.todos.find(t=>t.id===id)) :null;
 if(kind==='tasks'){
  const rev=Number(f.dataset.revision),error=f.querySelector('#originTaskError');
  if(f.dataset.ownerRoom!==snapshot.roomId||f.dataset.ownerUser!==snapshot.currentUser||(!Number.isSafeInteger(rev)||rev<0)||(id&&Number(existing?.revision)!==rev)){
    if(error){error.hidden=false;error.textContent='ほかの端末で変更された可能性があります。入力内容を保持しています。'}return false;
  }
  const rows=[...f.querySelectorAll('.origin-checkrow')].map(x=>({text:x.querySelector('[name="checkText"]').value.trim(),done:x.querySelector('[name="checkDone"]').checked})).filter(x=>x.text);
  if(rows.map(x=>x.text).join('\n').length>6000){if(error){error.hidden=false;error.textContent='チェック項目は合計6,000文字以内にしてください。'}return false;}
  const command={type:'task.'+(id?'update':'create'),id,revision:rev,ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser,title,
   assignee:String(fd.get('assignee'))==='自分'?snapshot.currentUser:String(fd.get('assignee')),
   status:String(fd.get('status')),priority:String(fd.get('priority')),category:String(fd.get('category')),
   dueDate:String(fd.get('due')||''),dueTime:fd.get('due')?String(fd.get('dueTime')||''):'',description:String(fd.get('desc')||''),
   requester:String(fd.get('requester')||''),tags:String(fd.get('tags')||''),checklist:rows.map(x=>x.text).join('\n'),
   checklistDone:rows.map(x=>x.done),pinned:fd.has('pinned')};
  return send(command,id?'タスクを更新しました':'タスクを登録しました',{close:true});
 }
 if(kind==='todos'){
  if(id){ const ok=await send({type:'todo.update',id,text:title,memo:String(fd.get('memo')||'')},'ToDoを更新しました',{close:true});
    if(ok&&String(fd.get('done'))!==String(existing?.completed))await send({type:'todo.toggle',id},'ToDoの状態を更新しました');
    return ok;
  }
  return send({type:'todo.create',text:title,memo:String(fd.get('memo')||'')},'ToDoを追加しました',{close:true});
 }
 if(kind==='memos'){
  return send({type:'memo.'+(id?'update':'create'),id,revision:existing?.revision||0,
    ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser,
    title,category:String(fd.get('category')||memoBridge?.categories?.[0]||'その他'),
    body:String(fd.get('body')||''),tags:(existing?.tags||[]).join(','),
    pinned:fd.has('pinned'),paperColor:memoColor(fd.get('paperColor'))},id?'メモを更新しました':'メモを登録しました',{close:true});
 }
}
async function deleteItem(kind,id){
 if(!findItem(kind,id))return;
 if(kind==='events'){
   const item=snapshot.schedules.find(x=>x.id===id);
   if(!item)return notify('予定が更新されました。開き直してください。');
   if(item.recurrenceSeriesId)return notify('繰り返し予定の削除範囲は「詳細設定」から指定してください。');
   const form=$('#editForm'),revision=form?.dataset.kind==='events'&&form.dataset.id===id
     ?Number(form.dataset.revision):Number(item.revision);
   return send({type:'schedule.delete',id,revision,
     ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser},
     '予定を削除しました',{close:true});
 }
 if(!window.confirm('この'+singular[kind]+'を削除しますか？'))return;
 const item=findItem(kind,id),type=kind==='tasks'?'task.delete':kind==='todos'?'todo.delete':'memo.delete';
 return send({type,id,revision:item.revision,ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser},
 singular[kind]+'を削除しました',{close:true});
}
function setTheme(){theme=theme==='dark'?'light':'dark';initTheme()}
function handleAction(el){const a=el.dataset.action,id=el.dataset.id,kind=el.dataset.kind,value=el.dataset.value;
 if(a==='task-check-add'){const c=$('#originTaskChecks');if(c){if(c.children.length>=80)return notify('チェック項目は80件以内にしてください。');c.insertAdjacentHTML('beforeend',taskCheckRow());c.lastElementChild.querySelector('[name="checkText"]')?.focus();}return;}
 if(a==='task-check-remove'){const row=el.closest('.origin-checkrow');const next=row?.nextElementSibling||row?.previousElementSibling;row?.remove();(next?.querySelector('[name="checkText"]')||$('#editForm [name="title"]'))?.focus();return;}
 if(a==='theme')return setTheme();
 if(a==='todo-completed-toggle'){todoCompletedOpen=!todoCompletedOpen;return render()}
 if(a==='detail-prev'||a==='detail-next')return navigateDetail(a==='detail-prev'?-1:1);
 if(a==='calendar-view'){scheduleView=['week','agenda','day'].includes(value)?value:'week';return render()}
 if(a==='calendar-day'){if(/^\d{4}-\d{2}-\d{2}$/.test(el.dataset.date||'')){selectedDay=el.dataset.date;scheduleView='day';return render()}}
 if(a==='day-prev'||a==='day-next'){selectedDay=shift(selectedDay,a==='day-prev'?-1:1);return render()}
 if(a==='create-menu')return openCreateMenu();
 if(a==='schedule-duration'){
   const f=$('#editForm');if(!f||f.dataset.kind!=='events')return;
   const start=new Date(f.elements.namedItem('startAt')?.value||'');
   const minutes=Number(el.dataset.minutes);
   if(!Number.isFinite(start.getTime())||![30,60,120].includes(minutes))return;
   f.elements.namedItem('endAt').value=scheduleLocalInput(new Date(start.getTime()+minutes*60000));
   const msg=f.querySelector('#originScheduleError');if(msg)msg.hidden=true;
   return;
 }
 if(a==='schedule-classic'){
   if(!closePanel())return;
   window.WorkBoardDisplayController?.selectMode?.('classic');
   if(document.documentElement.dataset.wbDisplay!=='classic')
     return notify('画面を切り替えられませんでした。');
   if(!window.WorkBoardOriginScheduleBridge?.open?.(id||'',selectedDay)?.ok)
     window.alert('予定の詳細設定を開けませんでした。');
   return;
 }
 if(a==='new'){if(!closePanel(false,false))return;detailSequence=null;$('#createMenu').hidden=true;return panelShow(kind,null,true,{date:el.dataset.date||selectedDay})}
 if(a==='open'||a==='search-open'){captureDetailSequence(kind,id,el);if(a==='search-open')closeSearch();return panelShow(kind,id,false)}
 if(a==='close')return closePanel();
 if(a==='edit')return panelShow(kind,id,true);
 if(a==='delete')return deleteItem(kind,id);
 if(a==='task-done'){toggleTaskDone(id);return}
 if(a==='todo-toggle'){toggleTodo(id);return}
 if(a==='pick-day'){selectedDay=el.dataset.date;return render()}
 if(a==='pick-today'){selectedDay=base;return render()}
 if(a==='week-prev'){selectedDay=shift(selectedDay,-7);return render()}
 if(a==='week-next'){selectedDay=shift(selectedDay,7);return render()}
 if(a==='task-filter'){taskFilter=value;taskStatusChoice='';selectedBulk.clear();return render()}
 if(a==='task-density'){taskDensity=taskDensity==='compact'?'comfortable':'compact';return render()}
 if(a==='task-reset'){taskQuery='';taskFilter='active';taskStatusChoice='';selectedBulk.clear();return render()}
 if(a==='filter-status'){taskStatusChoice=taskStatusChoice===el.dataset.status?'':el.dataset.status;taskFilter='all';selectedBulk.clear();return render()}
 if(a==='memo-filter'){memoFilter=value;return render()}
 if(a==='memo-color-filter'){memoColorFilter=value;return render()}
 if(a==='memo-reset'){memoFilter='all';memoColorFilter='all';memoQuery='';return render()}
 if(a==='memo-color'){
  const m=findItem('memos',id);if(!m||memoColor(m.paperColor)===value)return;
  return send({type:'memo.update',id,revision:m.revision,ownerRoom:snapshot.roomId,ownerUser:snapshot.currentUser,title:m.title,category:m.category,body:m.body,tags:[...m.tags],pinned:Boolean(m.pinned),paperColor:memoColor(value)},'メモの色を変更しました').then(ok=>{
    // Re-render replaces the swatch. Restore keyboard focus without scrolling.
    if(ok&&view==='notes')mount.querySelectorAll('[data-action="memo-color"]').forEach(button=>{
      if(button.dataset.id===id&&button.dataset.value===value)button.focus({preventScroll:true});
    });
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
setIconPlaceholders(mount);initTheme();syncSnapshot();render();
bridge.subscribe(s=>{snapshot=s;syncSnapshot();render()});
memoBridge?.subscribe?.(items=>{memoItems=items;syncSnapshot();render()});
mount.addEventListener('click',e=>{
 const target=e.target;
 const route=target.closest('[data-route]');if(route){handleRoute(route.dataset.route);return}
 const action=target.closest('[data-action]');if(action){if(['todo-check','bulk-toggle','task-check'].includes(action.dataset.action))return;handleAction(action);return}
 if(!target.closest('#createMenu')&&!target.closest('#createBtn'))$('#createMenu').hidden=true;
 if(!target.closest('#searchbox'))closeSearch();
 if(target.id==='overlay')closePanel();
});
mount.addEventListener('change',e=>{
 const t=e.target;if(t.id==='originUserSelect'){
   const old=snapshot.currentUser,next=t.value;if(next===old)return;
   if(!snapshot.users?.includes(next)){t.value=old;return notify('利用者を切り替えられませんでした。')}
   const quick=$('#workspace [data-form="quick-todo"] [name="title"]');
   const draft=quick?.value||quickTodoDraft;
   const modified=panelOpen&&panelMode==='edit'&&formSnapshot($('#editForm'))!==initialFormSnapshot;
   if((modified||draft.trim())&&!window.confirm('入力中の変更を破棄して利用者を切り替えますか？')){t.value=old;return}
   if(panelOpen)closePanel(true,false);
   detailSequence=null;
   // Clear the live input as well: bridge subscribers can render synchronously.
   if(quick)quick.value='';
   quickTodoDraft='';
   const result=bridge.selectUser?.(next);
   if(!result?.ok){quickTodoDraft=draft;t.value=old;render();notify('利用者を切り替えられませんでした。');return}
   selectedBulk.clear();taskQuery='';taskFilter='active';taskStatusChoice='';memoFilter='all';memoColorFilter='all';memoQuery='';scheduleAssignee='all';scheduleQuery='';
   closeSearch();syncSnapshot();render();notify('利用者を切り替えました。');
   return;
 }
  if(t.id==='originDateJump'){if(/^\d{4}-\d{2}-\d{2}$/.test(t.value)){selectedDay=t.value;render()}return}
 if(t.id==='originScheduleAssignee'){scheduleAssignee=t.value;render();return}
 if(t.id==='originMemoSort'){memoSort=['updated','title','category'].includes(t.value)?t.value:'updated';render();return}
 if(t.id==='groupSelect'){taskGrouping=t.value;render();return}
 if(t.id==='originTaskSort'){taskSortMode=['due','priority','updated'].includes(t.value)?t.value:'due';render();return}
 if(t.dataset.action==='task-check'){taskCheckToggle(t);return}
 if(t.dataset.action==='todo-check'){toggleTodo(t.dataset.id,t.checked);return}
 if(t.dataset.action==='bulk-toggle'){if(t.checked)selectedBulk.add(t.dataset.id);else selectedBulk.delete(t.dataset.id);render();return}
});
mount.addEventListener('compositionstart',e=>{
 if(e.target.id==='originScheduleSearch')scheduleComposing=true;
 if(e.target.id==='originMemoQuery')memoComposing=true;
 if(e.target.id==='originTaskQuery')taskComposing=true;
});
mount.addEventListener('compositionend',e=>{
 if(e.target.id==='originScheduleSearch'){scheduleComposing=false;updateScheduleSearch(e.target)}
 if(e.target.id==='originMemoQuery'){memoComposing=false;updateMemoQuery(e.target)}
 if(e.target.id==='originTaskQuery'){taskComposing=false;updateTaskQuery(e.target)}
});
function updateScheduleSearch(input){
 const start=input.selectionStart,end=input.selectionEnd;
 scheduleQuery=input.value;render();
 const next=$('#originScheduleSearch');
 if(next){next.focus({preventScroll:true});if(start!==null)next.setSelectionRange(start,end)}
}
function updateMemoQuery(input){
 const start=input.selectionStart,end=input.selectionEnd;
 memoQuery=input.value;render();
 const next=$('#originMemoQuery');
 if(next){next.focus({preventScroll:true});if(start!==null)next.setSelectionRange(start,end)}
}
function updateTaskQuery(input){
 const start=input.selectionStart,end=input.selectionEnd;
 taskQuery=input.value;selectedBulk.clear();render();
 const next=$('#originTaskQuery');
 if(next){next.focus({preventScroll:true});if(start!==null)next.setSelectionRange(start,end)}
}
mount.addEventListener('input',e=>{
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
 if(f?.id==='editForm'&&f.dataset.kind==='tasks'){const message=f.querySelector('#originTaskError');if(message)message.hidden=true;}
 if(f?.id==='editForm'&&f.dataset.kind==='events'){
   const msg=f.querySelector('#originScheduleError');if(msg)msg.hidden=true;
 }
});
mount.addEventListener('submit',e=>{const form=e.target;
 if(form.matches('[data-form="quick-todo"]')){e.preventDefault();const inp=form.querySelector('[name="title"]');const title=inp.value;quickTodo(title);return}
 if(form.id==='editForm'){e.preventDefault();saveForm(form);return}
});
$('#originDisplaySelect').addEventListener('change',e=>{
 const mode=e.target.value;
 if(panelOpen&&!closePanel()){e.target.value='modern';return;}
 window.WorkBoardDisplayController?.selectMode?.(mode);
 e.target.value='modern';
});
$('#originSearchInput').addEventListener('input',e=>renderSearch(e.target.value));
$('#originSearchInput').addEventListener('keydown',e=>{if(e.key==='Escape'){e.target.blur();e.target.value='';closeSearch()}});
mount.addEventListener('keydown',e=>{
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#originSearchInput').focus();$('#originSearchInput').select()}
 if(e.key==='Escape'){$('#createMenu').hidden=true;closeSearch();if(panelOpen)closePanel()}
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