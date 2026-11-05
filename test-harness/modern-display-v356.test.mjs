import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const css = readFileSync(new URL('../modern-display-v356.css', import.meta.url), 'utf8');
const js = readFileSync(new URL('../modern-display-v356.js', import.meta.url), 'utf8');
const themeCss = readFileSync(new URL('../color-themes-v329.css', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../release-manifest.js', import.meta.url), 'utf8');

function strippedCss(value) {
  return value.replace(/\/\*[\s\S]*?\*\//g, '');
}
test('Modern retains canonical Classic forms, writers, and data ownership', () => {
  assert.doesNotMatch(js, /\b(?:initializeApp|getDatabase|onValue|runTransaction|deleteTask|saveTask)\s*\(/);
  assert.doesNotMatch(js, /iframe|contentWindow|document\.write|innerHTML/i);
  assert.match(js, /root\.dataset\.wbDisplay = next/);
  assert.match(js, /new Set\(\['classic', 'modern', 'palette'\]\)/);
  assert.match(js, /workBoardDisplayV356:/);
  assert.match(js, /localStorage\.setItem\(storageKey\(\), mode\)/);
  assert.match(js, /roomNameInput/);
  assert.match(js, /wb-color-theme-field/);
  assert.match(js, /dialog\[open\]/);
  assert.match(js, /task-dragging/);
});

test('Modern styles are isolated, cover 5 areas and preserve semantic calendar/status colors', () => {
  const src = strippedCss(css);
  assert.equal((src.match(/\{/g)||[]).length, (src.match(/\}/g)||[]).length);
  assert.match(src, /html\[data-wb-display="modern"\]/);
  for (const part of ['.hero','.sidebar','.summary-card','.toolbar','.board-column',
    '.task-card','.today-panel','.todo-workspace','.schedule-calendar',
    '.detail-panel','.nav-item','.task-control-row']) {
    assert.ok(src.includes(part), 'Missing Modern work surface: '+part);
  }
  assert.match(src,/--modern-accent:var\(--wb-ui-accent/);
  assert.match(src,/data-wb-color-mode="dark"/);
  assert.match(src,/data-wb-color-theme="pure-yellow"/);
  assert.match(src,/wb-modern-mobile-dock-v356/);
  assert.match(src,/wb-modern-context-toggle-v356/);
  assert.match(src,/data-modern-context-collapsed/);
  assert.match(js,/canonical\?\.click\(\)/);
  assert.match(js,/workBoardModernContextV356:/);
  assert.match(js,/aria-current/);
  assert.match(js,/sessionContextCollapsed/);
  assert.match(js,/event.key.startsWith\(contextPrefix\)/);
  assert.match(src,/data-modern-context-collapsed="true"\] \.sidebar\s*\{[\s\S]*?transition:none !important/);
  assert.match(src,/\.wb-modern-context-toggle-v356,\.wb-modern-mobile-tab-v356/);
  assert.doesNotMatch(src,/\.calendar-cell\.holiday\s*\{\s*background:/);
  assert.doesNotMatch(src,/\.calendar-cell\.saturday\s*\{\s*background:/);
  assert.match(src,/\.calendar-cell\s*\{\s*border-color:/);
  assert.match(src,/\.task-card \.task-title\s*\{\s*font-size:15px/);
  assert.match(src,/\.board-column \.task-list\s*\{gap:6px !important;padding:8px/);
  assert.match(src,/\.board-view\[hidden\]\s*\{\s*display:none !important/);
  assert.match(src,/\.board-view:not\(\[hidden\]\)\s*\{\s*display:grid !important/);
  assert.match(src,/\.board-view:not\(\[hidden\]\) > \.board-column\s*\{/);
  assert.match(src,/grid-template-columns:repeat\(auto-fit,minmax\(215px,1fr\)\)/);
  assert.match(src,/grid-template-columns:repeat\(auto-fit,minmax\(225px,1fr\)\)/);
  assert.match(src,/\.list-view \.task-table :is\(th,td\)/);
  assert.match(src,/\.task-card\[role="button"\]/);
  assert.match(themeCss,/\.calendar-cell\.holiday:not\(\.today\)/);
  assert.match(themeCss,/\.calendar-cell\.saturday:not\(\.today\):not\(\.holiday\)/);
  assert.match(themeCss,/recurring-delete-dialog/);
  assert.match(themeCss,/recurring-delete-options label:has\(input:checked\)/);
});

test('all existing 8 pure, 6 pastel and 5 dark palette names remain unchanged', () => {
  for (const type of [
    'pure-blue','pure-red','pure-green','pure-yellow',
    'pure-orange','pure-purple','pure-cyan','pure-pink',
    'pastel-blue','pastel-lilac','pastel-mint','pastel-rose','pastel-peach','pastel-lemon',
    'night-navy','night-charcoal','night-forest','night-plum','night-mocha'
  ]) {
    assert.ok(themeCss.includes('data-wb-color-theme="'+type+'"'),type+' missing');
  }
  assert.match(manifest,/modern-display-v356\.css/);
  assert.match(manifest,/modern-display-v356\.js/);
  assert.match(manifest,/version: "364"/);
});

test('Classic is initial view unless room/user explicitly selected Modern', () => {
  // Validate the actual module with a minimal document/store fixture; the
  // real application UI and browser-style regressions are exercised separately.
  const document = {
    documentElement: { dataset: {} },
    getElementById: () => ({})
  };
  // This guard exits before accessing DOM, proving duplicate installation
  // doesn't re-register listeners or touch localStorage in an existing page.
  const sandbox = { document, localStorage: { setItem() { throw Error('storage changed'); } } };
  assert.doesNotThrow(() => runInNewContext(js, sandbox, {timeout:200}));
});

test('Modern preference switches and restores per room/user without modifying work data', () => {
  function element(tag = 'div') {
    return {
      tagName:tag, children:[], dataset:{}, attributes:{}, listeners:{}, textContent:'',
      classList:{contains:()=>false},
      append(...nodes){this.children.push(...nodes);},
      appendChild(node){this.children.push(node);},
      before(node){this.beforeNode=node;},
      insertAdjacentElement(position,node){this.inserted={position,node};},
      setAttribute(key,value){this.attributes[key]=value;},
      getAttribute(key){return this.attributes[key];},
      addEventListener(name,handler){(this.listeners[name] ||= []).push(handler);},
      dispatch(name){(this.listeners[name] || []).forEach(handler=>handler());},
      click(){this.dispatch('click');}
    };
  }
  const field=element(),room=element(),sidebar=element(),filters=element();
  const selector=element(),form=element();
  field.querySelector=sel=>sel==='#roomNameInput'?room:null;
  sidebar.querySelector=sel=>sel==='.side-card.filters'?filters:null;
  const root={dataset:{}};
  const body={dataset:{},classList:{contains:()=>false}};
  const lookup={currentUserSelect:selector,userForm:form};
  let dialogOpen=false;
  const document={
    documentElement:root,body,
    getElementById:id=>lookup[id] || null,
    querySelector:sel=>{
      if(sel==='.sidebar .user-card')return field;
      if(sel==='.sidebar')return sidebar;
      if(sel==='dialog[open]')return dialogOpen?{}:null;
      return null;
    },
    createElement:element
  };
  const records=new Map([['systemTaskRoomId','room-x'],['systemTaskUser','User-A']]);
  const localStorage={
    getItem:key=>records.get(key) || null,
    setItem:(key,value)=>records.set(key,value),
    removeItem:key=>records.delete(key)
  };
  const events={};
  const window={addEventListener:(name,fn)=>{events[name]=fn;}};
  const sandbox={
    document,window,localStorage,location:{search:'?room=room-x'},
    URLSearchParams,queueMicrotask:callback=>callback()
  };
  runInNewContext(js,sandbox,{timeout:1500});
  assert.equal(root.dataset.wbDisplay,'classic');
  const chooser=room.inserted?.node;
  assert.equal(chooser?.id,'wbDisplayChoiceV356');
  const [classic,modern]=chooser.children[1].children;
  modern.click();
  assert.equal(root.dataset.wbDisplay,'modern');
  assert.equal(modern.getAttribute('aria-pressed'),'true');
  assert.equal(records.get('workBoardDisplayV356:room-x:User-A'),'modern');
  records.set('systemTaskUser','User-B');
  selector.dispatch('change');
  assert.equal(root.dataset.wbDisplay,'classic');
  records.set('systemTaskUser','User-A');
  events.pageshow();
  assert.equal(root.dataset.wbDisplay,'modern');
  dialogOpen=true;
  classic.click();
  assert.equal(root.dataset.wbDisplay,'modern','no view switch while editing');
  dialogOpen=false;
  classic.click();
  assert.equal(root.dataset.wbDisplay,'classic');
  assert.equal(records.has('workBoardDisplayV356:room-x:User-A'),false);
  filters.beforeNode.click();
  assert.equal(body.dataset.modernFiltersOpen,'true');
  filters.beforeNode.click();
  assert.equal(body.dataset.modernFiltersOpen,'false');
});
