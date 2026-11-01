import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  DEFAULT_DISPLAY, MODERN_PALETTES, DESIGN_IDS,
  displayPreferenceKey, normalizeDisplayPreferences,
  readDisplayPreferences, writeDisplayPreferences
} from '../modern/preferences.mjs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const storage = () => {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    dump: () => [...values]
  };
};

test('modern v2 owns its own markup and styles; Classic boot and Firebase are absent', () => {
  const html = read('modern/preview/index.html');
  const ui = read('modern/preview/ui.js');
  const demo = read('modern/preview/demo-store.js');
  const layout = read('modern/layout.css');
  const palettes = read('modern/palettes.css');
  assert.match(html, /href="\.\.\/layout\.css"/);
  assert.match(html, /href="\.\.\/palettes\.css"/);
  assert.match(html, /src="demo-store\.js"/);
  assert.match(html, /src="ui\.js"/);
  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(html, /(?:src|href)="(?:\.\.\/)*\/?(?:app\.js|config\.js|style\.css|ui-[^" ]+\.css)/i);
  assert.match(ui, /window\.Demo/);
  assert.match(demo, /Isolated mock data/);
  assert.doesNotMatch(ui + demo, /(?:firebaseConfig|getDatabase|firebaseio\.com|fetch\(|XMLHttpRequest|WebSocket|onValue\()/);
  assert.doesNotMatch(layout, /(?:#[0-9a-f]{3,8}\b|rgba?\(|hsla?\()/i, 'layout contains no fixed colors');
  assert.equal((palettes.match(/\[data-palette="(?:[a-z]+)"\]/g) || []).length, 12);
  for (const palette of MODERN_PALETTES) assert.ok(palettes.includes(`[data-palette="${palette}"]`));
  for (const file of ['modern/preview/classic-reference.webp', 'modern/preview/index.html']) {
    assert.ok(fs.statSync(new URL('../' + file, import.meta.url)).size > 0);
  }
  // V580 stages only the opted-in product UI; keep mock source out of Pages.
  assert.doesNotMatch(read('index.html'), /modern\/preview/);
  assert.match(read('release-manifest.js'), /modern\/layout\.css/);
  assert.match(read('release-manifest.js'), /modern\/palettes\.css/);
  assert.doesNotMatch(read('release-manifest.js'), /modern\/preview/);
});

test('design and 12 colors are separate choices scoped to room and selected user', () => {
  const s = storage();
  assert.deepEqual(DESIGN_IDS, ['classic', 'modern']);
  assert.deepEqual(readDisplayPreferences(s, 'demo room', '佐藤'), DEFAULT_DISPLAY);
  assert.deepEqual(writeDisplayPreferences(s,'demo room','佐藤',{design:'modern',palette:'charcoal'}),
    { value: {design:'modern',palette:'charcoal'}, persisted:true });
  assert.deepEqual(readDisplayPreferences(s,'demo room','佐藤'), {design:'modern',palette:'charcoal'});
  assert.deepEqual(readDisplayPreferences(s,'demo room','福冨'), DEFAULT_DISPLAY);
  assert.deepEqual(readDisplayPreferences(s,'another room','佐藤'), DEFAULT_DISPLAY);
  assert.match(displayPreferenceKey('demo room','佐藤'), /^workboard-display-v1:demo%20room:/);
  writeDisplayPreferences(s,'demo room','佐藤',{design:'classic'});
  assert.deepEqual(readDisplayPreferences(s,'demo room','佐藤'), {design:'classic',palette:'charcoal'});
  assert.equal(s.dump().length,1);
});

test('invalid values and denied localStorage do not corrupt saved theme or Classic', () => {
  const s=storage(), key=displayPreferenceKey('room','user');
  s.setItem(key,'not-json');
  assert.deepEqual(readDisplayPreferences(s,'room','user'), DEFAULT_DISPLAY);
  s.setItem(key,JSON.stringify({design:'modern',palette:'sage'}));
  assert.deepEqual(writeDisplayPreferences(s,'room','user',{design:'signal',palette:'not-a-theme'}).value,
    {design:'modern',palette:'sage'});
  assert.deepEqual(normalizeDisplayPreferences({design:'invalid',palette:'invalid'}), DEFAULT_DISPLAY);
  assert.deepEqual(normalizeDisplayPreferences([1,2]),DEFAULT_DISPLAY);
  assert.throws(()=>displayPreferenceKey('','user'), /roomId/);
  const denied={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
  assert.deepEqual(readDisplayPreferences(denied,'room','user'), DEFAULT_DISPLAY);
  assert.deepEqual(writeDisplayPreferences(denied,'room','user',{design:'modern',palette:'night'}),
    {value:{design:'modern',palette:'night'},persisted:false});
});

test('Ver.565 preference preview is strictly local test-only and uses the existing preferences owner', () => {
  const app = read('app.js');
  const adapter = read('modern/display-preview-v565.mjs');
  const html = read('index.html');
  const release = read('release-manifest.js');
  assert.match(app, /function isModernDisplayPreviewTestV565\(\)/);
  assert.match(app, /modernDisplayV565/);
  assert.match(app, /ROOM_ID\.startsWith\('test-'\)/);
  assert.match(app, /flags\?\.modernDisplayV565 === true/);
  assert.match(app, /!\[\.\.\.params\.keys\(\)\]\.some/);
  assert.match(app, /function installModernDisplayPreviewV565\(\)/);
  assert.ok(app.includes("import('./modern/display-preview-v565.mjs?v='+window.WORK_BOARD_RELEASE.version)"));
  assert.match(app, /function openModernTestViewV566\(target=null\)/);
  assert.match(app, /function closeModernTestViewV566\(\)/);
  assert.match(app, /openView:target=>openModernTestViewV566\(target\)/);
  assert.match(app, /closeView:closeModernTestViewV566/);
  assert.doesNotMatch(app,/function openModernReadOnly(?:Task|Todo|Schedule|Today|Memo)TestV55\d\(\)/);
  assert.match(adapter, /from '\.\/preferences\.mjs'/);
  assert.match(adapter, /readDisplayPreferences/);
  assert.match(adapter, /writeDisplayPreferences/);
  assert.match(adapter, /displayPaletteBoundV565/);
  assert.match(adapter, /MutationObserver/);
  assert.match(app, /getFrame:currentModernTestFrameV566,getView:currentModernTestViewV566/);
  assert.match(adapter, /const frame=getFrame;/);
  assert.match(adapter, /const active=getView\(\);/);
  assert.doesNotMatch(adapter, /FRAME_SELECTOR|data-modern-(?:task|todo|schedule|today|memo)-v55\d/);
  assert.doesNotMatch(adapter, /\b(?:initializeApp|getDatabase|runTransaction|onValue|onChildAdded|fetch)\s*\(/);
  assert.doesNotMatch(adapter, /window\.Demo|demo-store|\.innerHTML\s*=/);
  assert.match(release, /display-preview-v565|modern\/preferences\.mjs/);
  assert.doesNotMatch(html, /display-preview-v565|modernDisplayV565/);
  assert.equal(MODERN_PALETTES.length, 12);
});

test('Ver.566 uses one guarded Modern test frame router without parallel legacy launchers', () => {
  const app = read('app.js');
  assert.match(app,/function selectModernTestViewV566\(params\)/);
  assert.match(app,/function isModernTestReadAllowedV566\(params,view\)/);
  assert.match(app,/function openModernTestViewV566\(target=null\)/);
  assert.match(app,/function closeModernTestViewV566\(\)/);
  assert.match(app,/keys\.length!==1\)return null/);
  assert.match(app,/params\.get\(keys\[0\]\)==='1'/);
  assert.match(app,/ROOM_ID\.startsWith\('test-'\)/);
  assert.match(app,/flags\?\.\['modernReadV'\+view\.version\]===true/);
  assert.match(app,/if\(!production && !isModernDisplayPreviewTestV565\(\)\)return null;/);
  for (const [name,ver,attr,src] of [
    ['tasks','551','task','task-list'],
    ['todos','552','todo','todo-list'],
    ['schedules','553','schedule','schedule-list'],
    ['today','554','today','today'],
    ['memos','555','memo','memo-list']
  ]) {
    assert.ok(app.includes("name:'"+name+"',version:'"+ver+"',attribute:'data-modern-"+attr+"-v"+ver+"'"));
    assert.ok(app.includes("./modern/product/"+src+"-read-v"+ver+".html"));
  }
  assert.equal((app.match(/function openModernTestViewV566\(/g)||[]).length,1);
  assert.doesNotMatch(app,/function openModernReadOnly(?:Task|Todo|Schedule|Today|Memo)TestV55\d/);
  const section=app.split('function openModernTestViewV566(target=null) {')[1]
    ?.split('function closeModernTestViewV566() {')[0];
  assert.ok(section,'one canonical view launcher is present');
  assert.equal((section.match(/document\.createElement\('iframe'\)/g)||[]).length,1);
  assert.match(app,/^  openModernTestViewV566\(\);$/m);
  assert.doesNotMatch(app,/^  openModernReadOnly.*\(\);$/m);
});


test('Ver.567 Modern direct and preview gates share the verified source check',()=>{
  const app=read('app.js');
  const source=app.split('function isModernTestDataSourceV567() {')[1]
    ?.split('function isModernDisplayPreviewTestV565() {')[0];
  const preview=app.split('function isModernDisplayPreviewTestV565() {')[1]
    ?.split('function installModernDisplayPreviewV565() {')[0];
  const route=app.split('function isModernTestReadAllowedV566(params,view) {')[1]
    ?.split('function openModernTestViewV566(target=null) {')[0];
  assert.ok(source&&preview&&route,'both test-only gates and the source checker exist');
  assert.match(source,/const localOnly = !config\?\.apiKey \|\| !config\?\.databaseURL/);
  assert.match(source,/flags\?\.emulator === true/);
  assert.match(source,/demo-\[\\w-\]/);
  assert.match(source,/return localOnly \|\| demoEmulator/);
  assert.match(preview,/isModernTestDataSourceV567\(\)/);
  assert.match(route,/isModernTestDataSourceV567\(\)/);
  assert.doesNotMatch(route,/flags\?\.emulator===true/);
  assert.equal(source.includes('https://'),false);
});

test('V580+ public pilot is opt-in, Classic-owned and never ships mock or trusted Admin code',()=>{
  const app=read('app.js');
  const manifest=read('release-manifest.js');
  const builder=read('test-harness/build-pages-runtime-v382.mjs');
  const adapter=read('modern/production-owner-v580.mjs');
  assert.match(app,/modernProductionSessionV580 = false/);
  assert.match(app,/function isModernProductionPilotV580/);
  assert.match(app,/isModernProductionReadAllowedV580/);
  assert.match(app,/modernProductionSessionV580=false/);
  assert.match(app,/function isModernTestReadAllowedV566/);
  assert.match(adapter,/WorkBoardModernProductionV580/);
  assert.match(adapter,/WorkBoardReadV550/);
  assert.doesNotMatch(adapter,/\b(?:initializeApp|getDatabase|runTransaction|onValue|set|update|remove|fetch)\s*\(/);
  assert.match(builder,/modernPilotAssets/);
  const optional=manifest.match(/optionalAssets:\s*\[([\s\S]*?)\]/)?.[1]||'';
  assert.match(optional,/modern\/production-owner-v580\.mjs/);
  assert.doesNotMatch(optional,/modern\/preview/);
  assert.doesNotMatch(optional,/security\/database\.rules/);
  assert.match(app,/function isModernTodoToggleTestV557/);
  assert.match(app,/function isModernTaskWriteTestV560/);
  assert.match(app,/function isModernScheduleWriteTestV562/);
});


test('V581 production schedule actions reuse the canonical Classic owner behind opt-in',()=>{
  const app=read('app.js');
  const ui=read('modern/product/schedule-list-v553.mjs');
  const owner=app.split('function modernScheduleOwnerV562(request) {')[1]
    ?.split('function modernScheduleCurrentV562(')[0] || '';
  const install=app.split('function installModernScheduleActionsV562() {')[1]
    ?.split('// Ver.566:')[0] || '';
  assert.match(owner,/isModernScheduleWriteTestV562\(\)/);
  assert.match(owner,/WorkBoardModernProductionV580\?\.allowRead\('schedules', location.origin\)/);
  assert.match(owner,/workspaceReadFacadeV550\.read\(\)/);
  assert.match(install,/isModernProductionPilotV580\(\)/);
  assert.match(install,/openScheduleDialog\(current\)/);
  assert.match(install,/openScheduleCopyDialog\(current\)/);
  assert.match(install,/deleteSchedule\(current\.id, request\.expectedRevision\)/);
  assert.match(ui,/WorkBoardModernProductionV580\?\.allowRead\('schedules',location.origin\)/);
  assert.match(ui,/host\.WORK_BOARD_TEST\?\.modernWriteV562 === true/);
  assert.doesNotMatch(ui,/\b(?:getDatabase|runTransaction|onValue|localStorage)\s*\(/);
  assert.doesNotMatch(read('modern/production-owner-v580.mjs'),/\b(?:getDatabase|runTransaction|onValue)\s*\(/);
  const release=read('release-manifest.js').match(/version:\s*"(\d+)"/)?.[1];
  assert.ok(read('modern/product/schedule-list-read-v553.html').includes('schedule-list-v553.mjs?v='+release));
});


test('V582 Classic form handoff preserves the active Modern schedule and reloads its view',()=>{
  const app=read('app.js');
  const ui=read('modern/product/schedule-list-v553.mjs');
  const bridge=app.split("Object.defineProperty(window,'WorkBoardModernProductionV580',{")[1]
    ?.split('// Ver.580/581:')[0] || '';
  assert.match(bridge,/enterClassicSurface\(view,origin,mode='dialog'\)/);
  assert.match(bridge,/this\.allowRead\(view,origin\)/);
  assert.match(bridge,/frame\.style\.display='none'/);
  assert.match(bridge,/dialog\.addEventListener\('close',\(\)=>this\.leaveClassicSurface\(view,origin\),\{once:true\}\)/);
  assert.match(bridge,/const dialog=document\.querySelector\('dialog\[open\]'\)/);
  assert.match(bridge,/frame\.style\.display=''/);
  assert.match(bridge,/workboard:modern-'\+view\+'-resume/);
  assert.match(ui,/function showClassicScheduleFormV582\(\)/);
  assert.match(ui,/WorkBoardModernProductionV580\?\.enterClassicSurface\?\./);
  assert.equal((ui.match(/showClassicScheduleFormV582\(\);return;/g)||[]).length,2);
  assert.match(ui,/window\.addEventListener\('workboard:modern-schedule-resume',render\)/);
});


test('V583 typography design uses one shared, readable scale across all Modern product pages',()=>{
  const layout=read('modern/layout.css');
  const palette=read('modern/palettes.css');
  assert.match(layout,/font:16px\/1\.65/);
  for(const token of ['micro','caption','small','body','strong','subtitle','section','heading','heading-large','display']){
    assert.ok(layout.includes('--type-'+token+':'), 'missing typography token: '+token);
  }
  assert.match(layout,/\.btn \{[\s\S]*?min-height:46px/);
  assert.match(layout,/\.btn\.small \{[\s\S]*?min-height:42px/);
  assert.match(layout,/\.icon-btn \{[\s\S]*?width:44px;[\s\S]*?height:44px/);
  assert.doesNotMatch(layout,/font-size:\s*(?:8|9|10|11|12)px\b/);
  const release=read('release-manifest.js').match(/version:\s*"(\d+)"/)?.[1];
  for(const [view,ver] of [['task-list','551'],['todo-list','552'],['schedule-list','553'],['today','554'],['memo-list','555']]){
    const html=read('modern/product/'+view+'-read-v'+ver+'.html');
    assert.ok(html.includes('../layout.css?v='+release));
    assert.ok(html.includes('../palettes.css?v='+release));
    assert.doesNotMatch(html,/font-size:\s*(?:8|9|10|11|12)px\b/);
  }
  assert.match(palette,/--rail:#eaf2ff/);
  assert.match(read('modern/display-preview-v565.mjs'),/scroll-snap-type:x proximity/);
});


test('V584 production task actions reuse Classic writer with per-call owner and revision checks',()=>{
  const app=read('app.js');
  const child=read('modern/product/task-list-v551.mjs');
  const owner=app.split('function modernTaskOwnerV560(request) {')[1]
    ?.split('function modernTaskCurrentV560(')[0] || '';
  const installer=app.split('function installModernTaskActionsV560() {')[1]
    ?.split('// Ver.581:')[0] || '';
  const adapter=read('modern/production-owner-v580.mjs');
  assert.match(owner,/isModernTaskWriteTestV560\(\)/);
  assert.match(owner,/WorkBoardModernProductionV580\?\.allowRead\('tasks',location.origin\)/);
  assert.match(owner,/workspaceReadFacadeV550\.read\(\)/);
  assert.match(owner,/snapshot\.roomId !== request\?\.roomId/);
  assert.match(installer,/isModernProductionPilotV580\(\)/);
  assert.match(installer,/modernTaskCurrentV560\(owner.snapshot, request\)/);
  assert.match(installer,/openTaskDialog\(current\)/);
  assert.match(installer,/completeTaskWithMemo\(current.id\)/);
  assert.match(installer,/requestTaskDelete\(current.id, base\)/);
  assert.match(installer,/selectTask\(current.id\)/);
  assert.match(child,/WorkBoardModernProductionV580\?\.allowRead\('tasks',location.origin\)/);
  assert.match(child,/host\.WORK_BOARD_TEST\?\.modernWriteV560 === true|parent\.WORK_BOARD_TEST\?\.modernWriteV560 === true/);
  assert.match(child,/window\.addEventListener\('workboard:modern-tasks-resume',\(\)=>\{/);
  assert.match(child,/clearTaskBulkV593\(\);\s*render\(\);/);
  assert.match(adapter,/view === 'tasks'/);
  assert.doesNotMatch(child,/\b(?:getDatabase|runTransaction|onValue|localStorage)\s*\(/);
  assert.doesNotMatch(adapter,/\b(?:getDatabase|runTransaction|onValue)\s*\(/);
});

test('V584 one Classic surface bridge covers forms, task detail and async writes without two handlers',()=>{
  const app=read('app.js');
  const task=read('modern/product/task-list-v551.mjs');
  const schedule=read('modern/product/schedule-list-v553.mjs');
  const bridge=app.split("Object.defineProperty(window,'WorkBoardModernProductionV580',{")[1]
    ?.split('// Ver.580/581:')[0] || '';
  assert.match(bridge,/enterClassicSurface\(view,origin,mode='dialog'\)/);
  assert.match(bridge,/leaveClassicSurface\(view,origin\)/);
  assert.match(bridge,/modernClassicHandoffV584=null/);
  assert.match(bridge,/attributeFilter:\['class'\]/);
  assert.match(bridge,/handoff\.disconnect\?\.\(\)/);
  assert.match(bridge,/frame\.style\.display='none'/);
  assert.match(bridge,/handoff\.frame\.style\.display=''/);
  assert.match(task,/enterClassicSurface\?\.\('tasks',location.origin,mode\)/);
  assert.match(task,/leaveClassicSurface\?\.\('tasks',location.origin\)/);
  assert.match(schedule,/enterClassicSurface\?\.\('schedules',location.origin,'dialog'\)/);
  assert.doesNotMatch(app,/enterScheduleForm\(origin\)/);
  const manifest=read('release-manifest.js');
  const release=manifest.match(/version:\s*"(\d+)"/)?.[1];
  for(const [name,num] of [['task-list','551'],['schedule-list','553']]){
    const html=read('modern/product/'+name+'-read-v'+num+'.html');
    assert.ok(html.includes(name+'-v'+num+'.mjs?v='+release));
  }
});


test('V585 opt-in Modern ToDo uses only Classic save commands and retains all test gates',()=>{
  const app=read('app.js');
  const child=read('modern/product/todo-list-v552.mjs');
  const adapter=read('modern/production-owner-v580.mjs');
  const owner=app.split('function modernTodoOwnerV558(request) {')[1]
    ?.split('function modernTodoCurrentV558(')[0] || '';
  const installer=app.split('function installModernTodoToggleV557() {')[1]
    ?.split('// Ver.561 only extends')[0] || '';
  assert.match(app,/function isModernTodoWriteAllowedV585\(level='toggle'\)/);
  assert.match(app,/WorkBoardModernProductionV580\?\.allowRead\('todos',location.origin\)/);
  assert.match(app,/isModernTodoToggleTestV557\(\)/);
  assert.match(app,/isModernTodoCrudTestV558\(\)/);
  assert.match(app,/isModernTodoAdvancedTestV559\(\)/);
  assert.match(owner,/isModernTodoWriteAllowedV585\(\)/);
  assert.match(owner,/workspaceReadFacadeV550\.read\(\)/);
  assert.match(owner,/request\?\.roomId !== snapshot\.roomId/);
  assert.match(owner,/request\?\.selectedUser !== snapshot\.selectedUser/);
  assert.match(installer,/isModernProductionPilotV580\(\)/);
  assert.match(installer,/toggleTodo\(current\.id\)/);
  assert.match(installer,/createTodo\(values\.text, values\.memo\)/);
  assert.match(installer,/updateTodoDetails\(current\.id, values\.text, values\.memo\)/);
  assert.match(installer,/deleteTodo\(current\.id\)/);
  assert.match(installer,/reorderTodo\(current\.id, request\.direction, request\.segment\)/);
  assert.match(installer,/moveTodoByDropV531\(source\.id, target\.id, request\.after, request\.segment\)/);
  assert.match(installer,/promoteTodo\(current\)/);
  assert.match(child,/WorkBoardModernProductionV580\?\.allowRead\('todos',location.origin\)/);
  assert.match(child,/host\.WORK_BOARD_TEST\?\.modernWriteV557===true/);
  assert.match(adapter,/view === 'todos'/);
  assert.doesNotMatch(child,/\b(?:getDatabase|runTransaction|onValue|localStorage)\s*\(/);
  assert.doesNotMatch(adapter,/\b(?:getDatabase|runTransaction|onValue)\s*\(/);
});

test('V585 Modern ToDo has protected unsaved edits and returns from Classic promotion',()=>{
  const parent=read('app.js');
  const child=read('modern/product/todo-list-v552.mjs');
  const html=read('modern/product/todo-list-read-v552.html');
  const preview=read('modern/display-preview-v565.mjs');
  assert.match(parent,/!\['today','tasks','schedules','todos','memos'\]\.includes\(view\)/);
  assert.match(parent,/todoEditorOpen=Boolean\(modern\?\.contentDocument\?\.getElementById\('todoFormV558'\)\)/);
  assert.match(child,/enterClassicSurface\?\.\('todos',location.origin,'dialog'\)/);
  assert.match(child,/todoDraftV558 && !window\.confirm/);
  assert.match(child,/window\.addEventListener\('workboard:modern-todos-resume',render\)/);
  assert.match(preview,/displayToolbarNoticeV565/);
  assert.match(preview,/next==='classic' && getView\(\) && !canSwitch\(\)/);
  assert.match(html,/min-width:44px;min-height:44px/);
  const ver=read('release-manifest.js').match(/version:\s*"(\d+)"/)?.[1];
  assert.ok(html.includes('todo-list-v552.mjs?v='+ver));
});


test('V587 production memo action uses the existing Classic owner and deferred modal handoff',()=>{
  const app=read('app.js');
  const sidecar=read('work-features-v167.js');
  const ui=read('modern/product/memo-list-v555.mjs');
  const adapter=read('modern/production-owner-v580.mjs');
  const owner=sidecar.split('function modernMemoOwnerV563(request) {')[1]
    ?.split('function modernMemoCurrentV563(')[0] || '';
  const actions=sidecar.split('function installModernMemoActionsV563() {')[1]
    ?.split('function memoList(')[0] || '';
  assert.match(sidecar,/function isModernMemoWriteAllowedV587\(\)/);
  assert.match(sidecar,/isModernMemoWriteTestV563\(\)/);
  assert.match(sidecar,/WorkBoardModernProductionV580\?\.allowRead\('memos',location.origin\)/);
  assert.match(owner,/isModernMemoWriteAllowedV587\(\)/);
  assert.match(owner,/WorkBoardReadV550\?\.read\?\.\(\)/);
  assert.match(owner,/memos\.selectedUser !== classic\.selectedUser/);
  assert.match(owner,/request\?\.roomId !== classic\.roomId/);
  assert.match(actions,/openMemoDialog\(\)/);
  assert.match(actions,/openMemoDialog\(request\.id\)/);
  assert.match(actions,/deleteMemoByIdV167\(request\.id, request\.expectedRevision, request\.selectedUser\)/);
  assert.match(actions,/toggleMemoPin\(request\.id\)/);
  assert.match(actions,/copyMemo\(request\.id\)/);
  assert.match(actions,/createTaskFromMemo\(request\.id\)/);
  assert.match(actions,/moveMemoV531\(request\.id, request\.targetId/);
  assert.match(ui,/WorkBoardModernProductionV580\?\.allowRead\('memos',location.origin\)/);
  assert.match(ui,/showClassicMemoFormV587\(action==='task'\?'deferred-dialog':'dialog'\)/);
  assert.match(ui,/window\.addEventListener\('workboard:modern-memos-resume',render\)/);
  assert.match(adapter,/view === 'memos'/);
  assert.match(app,/mode==='deferred-dialog'/);
  assert.match(app,/getElementById\('taskDialog'\)/);
  assert.match(app,/attributeFilter:\['open'\]/);
  assert.match(app,/handoff\.timeoutId/);
  assert.doesNotMatch(ui,/\b(?:initializeApp|getDatabase|runTransaction|onValue|localStorage)\s*\(/);
});


test('V589 Modern mobile controls retain 44px touch targets and readable headers',()=>{
  const css=read('modern/layout.css');
  assert.match(css,/\.todo-tools button \{[\s\S]*?min-width:44px;[\s\S]*?min-height:44px/);
  assert.match(css,/\.toolbar select \{[\s\S]*?min-height:44px/);
  assert.match(css,/\.search-field input \{[\s\S]*?min-height:44px/);
  assert.match(css,/\.todo-full \.todo-tools button \{[\s\S]*?min-width:44px;[\s\S]*?min-height:44px/);
  assert.match(css,/\.panel-head h2 \{[\s\S]*?font-size:var\(--type-subtitle\)/);
  const release=read('release-manifest.js').match(/version:\s*"(\d+)"/)?.[1];
  assert.ok(Number(release)>=315);
  for(const [name,n] of [['today','554'],['todo-list','552'],['task-list','551'],['schedule-list','553'],['memo-list','555']]){
    const html=read('modern/product/'+name+'-read-v'+n+'.html');
    const js=read('modern/product/'+name+'-v'+n+'.mjs');
    assert.ok(html.includes('../layout.css?v='+release), name+' CSS release');
    assert.ok(html.includes('../palettes.css?v='+release), name+' palette release');
    assert.ok(html.includes(name+'-v'+n+'.mjs?v='+release), name+' script release');
    assert.ok(js.includes('../production-owner-v580.mjs?v='+release), name+' canonical owner release');
  }
});

test('Ver.321 Modern uses one larger, readable type scale with a stable 16px root',()=>{
  const css=read('modern/layout.css');
  const htmlRule=css.match(/html\s*\{([\s\S]*?)\}/)?.[1]||'';
  const expected={micro:14,caption:15,small:16,body:17,strong:18,
    subtitle:20,section:24,heading:28,'heading-large':32,display:36};
  for(const [name,px] of Object.entries(expected)){
    const value=htmlRule.match(new RegExp('--type-'+name+':([0-9.]+)rem;'))?.[1];
    assert.ok(value,name+' must have one shared rem token');
    assert.equal(Number(value)*16,px,name+' must remain legible');
  }
  assert.match(css,/font:16px\/1\.65/);
  assert.match(css,/body \{[\s\S]*?font-size:var\(--type-body\)/);
  const display=read('modern/display-preview-v565.mjs');
  assert.match(display,/font:16px\/1\.55 system-ui,sans-serif/);
  assert.match(display,/\.display-nav-v565 button,\.display-toolbar-bottom-v565 button\{/);
  assert.match(display,/\.display-preferences-v565 select\{/);
});


test('Ver.322 Modern fixed toolbar reserves scroll clearance and actions keep 44px targets',()=>{
  const css=read('modern/layout.css');
  const preview=read('modern/display-preview-v565.mjs');
  assert.match(css,/scroll-padding-bottom:var\(--modern-toolbar-clearance,0px\)/);
  assert.match(css,/padding:24px 19px max\(102px,var\(--modern-toolbar-clearance,0px\)\)/);
  assert.match(css,/padding:19px 13px max\(100px,var\(--modern-toolbar-clearance,0px\)\)/);
  assert.match(preview,/function syncFrameClearanceV322\(\)/);
  assert.match(preview,/new host\.ResizeObserver\(syncFrameClearanceV322\)/);
  assert.match(preview,/current\.addEventListener\('load',apply\)/);
  assert.match(preview,/syncFrameClearanceV322\(\);lastFrame=frame\(\)/);
  assert.match(css,/\.btn\.small \{[\s\S]*?min-height:44px/);
  const todo=read('modern/product/todo-list-read-v552.html');
  assert.match(todo,/\.modern-todo-tool-v558\{min-height:44px;[\s\S]*?min-width:44px\}/);
  assert.doesNotMatch(todo,/\.modern-todo-tool-v558\{min-height:42px/);
  assert.match(read('modern/product/memo-list-read-v555.html'),/\.memo-actions-v563 \.btn\{min-height:44px/);
});


test('Ver.323 Today completion reuses the guarded Classic completion memo/CAS writer',()=>{
  const app=read('app.js');
  const child=read('modern/product/today-v554.mjs');
  const html=read('modern/product/today-read-v554.html');
  assert.match(app,/function isModernTodayCompletionAllowedV323\(\)/);
  assert.match(app,/isModernTodayNavigationTestV564\(\)/);
  assert.match(app,/q\.get\('modernCompleteV323'\)==='1'/);
  assert.match(app,/WORK_BOARD_TEST\?\.modernCompleteV323===true/);
  assert.match(app,/async complete\(request\)/);
  assert.match(app,/modernTodayNavigationCurrentV564\(owner\.snapshot,request\)/);
  assert.match(app,/document\.querySelector\('dialog\[open\]'\)\|\|modernClassicHandoffV584/);
  assert.match(app,/kind==='todo' \? toggleTodo\(current\.id\)\s*: completeTaskWithMemo\(current\.id\)/);
  assert.match(child,/data-today-complete-v323/);
  assert.match(child,/renderTask\(item,i,canNavigate,canComplete\)/);
  assert.match(html,/\.today-complete-v323\{[\s\S]*?min-height:44px/);
  assert.doesNotMatch(child,/\b(?:getDatabase|runTransaction|onValue|localStorage)\s*\(/);
});


test('Ver.324 Today personal ToDo completion only invokes Classic toggleTodo with two-sided opt-in',()=>{
  const app=read('app.js');
  const today=read('modern/product/today-v554.mjs');
  const html=read('modern/product/today-read-v554.html');
  assert.match(app,/function isModernTodayTodoCompleteAllowedV324\(\)/);
  assert.match(app,/modernTodoCompleteV324'\)==='1'/);
  assert.match(app,/WORK_BOARD_TEST\?\.modernTodoCompleteV324===true/);
  // The active Today iframe must not require the separate ToDo iframe.
  const todoGate=app.split('function isModernTodayTodoCompleteAllowedV324() {')[1]
    ?.split('function isModernTodayCompletionAllowedV323() {')[0]||'';
  assert.match(todoGate,/if\(isModernTodayNavigationProductionV588\(\)\)return true/);
  assert.doesNotMatch(todoGate,/allowRead\('todos'|isModernTodoWriteAllowedV585/);
  assert.match(app,/canCompleteTodo: isModernTodayTodoCompleteAllowedV324\(\)/);
  assert.match(app,/modernTodayNavigationCurrentV564\(owner\.snapshot,request\)/);
  assert.match(app,/kind==='todo' \? toggleTodo\(current\.id\)/);
  assert.match(app,/if\(document\.querySelector\('dialog\[open\]'\)\|\|modernClassicHandoffV584\)/);
  assert.match(today,/renderTodo\(item,canNavigate,canCompleteTodo\)/);
  assert.match(today,/button\.dataset\.todayTodoV324='todo'/);
  assert.match(html,/\.today-todo-toggle-v324\{[^}]*min-width:44px;min-height:44px/);
  assert.doesNotMatch(today,/\b(?:getDatabase|runTransaction|onValue|localStorage)\s*\(/);
});


test('Ver.325 active Today production gate works without a separate ToDo iframe',()=>{
  const app=read('app.js');
  const functionSource=app.match(/function isModernTodayTodoCompleteAllowedV324\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(functionSource,'The guarded Classic Today capability must exist');
  const execute=(production,query,flag)=>{
    const context={
      isModernTodayNavigationProductionV588:()=>production,
      isModernTodayNavigationTestV564:()=>true,
      URLSearchParams,
      location:{search:query},
      window:{WORK_BOARD_TEST:{modernTodoCompleteV324:flag}}
    };
    return vm.runInNewContext(functionSource+'; isModernTodayTodoCompleteAllowedV324()',context);
  };
  // This was broken in 324: the separate ToDo iframe is not mounted
  // while the current Modern view is Today.
  assert.equal(execute(true,'',false),true);
  assert.equal(execute(false,'?modernTodoCompleteV324=1',true),true);
  assert.equal(execute(false,'',true),false);
  assert.equal(execute(false,'?modernTodoCompleteV324=1',false),false);
});


test('Ver.326 formal Modern dock has five views, one settings owner and no floating right panel',()=>{
  const adapter=read('modern/display-preview-v565.mjs');
  const css=read('modern/layout.css');
  assert.match(adapter,/for\(const \[value,label,icon\] of VIEWS\)/);
  assert.match(adapter,/display-settings-panel-v326/);
  assert.match(adapter,/settingsPanel\.appendChild\(control\)/);
  assert.match(adapter,/card\.appendChild\(control\)/);
  assert.match(adapter,/displayPreferenceKey\(roomId,user\)/);
  assert.doesNotMatch(adapter,/right:12px;[\s\S]*?width:min\(510px/);
  assert.match(css,/html\[data-modern-dock-v326="true"\] \.rail\{display:none\}/);
  assert.match(css,/@media\(max-width:860px\)/);
  assert.doesNotMatch(adapter,/<(?:iframe|script)/);
});
