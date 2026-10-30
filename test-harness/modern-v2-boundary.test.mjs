import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
  // A separate product integration must explicitly opt in. Merely adding files cannot alter Classic.
  for (const productFile of ['index.html', 'release-manifest.js']) {
    const file = new URL('../' + productFile, import.meta.url);
    if (fs.existsSync(file)) assert.doesNotMatch(read(productFile), /(?:modern\/preview|modern\/layout\.css|modern\/palettes\.css)/);
  }
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
  assert.match(app, /import\('\.\/modern\/display-preview-v565\.mjs'\)/);
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
  assert.doesNotMatch(release, /display-preview-v565|modern\/preferences\.mjs/);
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
  assert.match(app,/if\(!isModernDisplayPreviewTestV565\(\)\)return null;/);
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
