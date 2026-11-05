import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync('origin-modern-v372.js','utf8');
const css = readFileSync('modern-display-v356.css','utf8');
const app = readFileSync('app.js','utf8');
const manifest = readFileSync('release-manifest.js','utf8');
test('origin independent Modern reads the canonical data owner', () => {
  assert.match(source,/attachShadow/);
  assert.match(source,/WorkBoardPaletteBridge/);
  assert.match(source,/WorkBoardPaletteMemoBridgeV369/);
  assert.match(source,/workboard:canonical-bridge-ready/);
  assert.match(source,/originDisplaySelect/);
  assert.match(source,/WorkBoardPaletteMemoBridgeV369\?\.readSnapshot/);
  assert.doesNotMatch(source,/localStorage\.setItem/);
  assert.match(css,/data-modern-origin-ready/);
  assert.match(css,/body > \.app-shell/);
  assert.match(css,/data-wb-palette-next-preview/);
});
test('origin delegates schedule editing and safe task deletion', () => {
  assert.match(app,/WorkBoardOriginScheduleBridge = Object\.freeze/);
  assert.match(app,/openScheduleDialog\(record\)/);
  assert.match(app,/requestDeleteWithSeries\('task', id/);
  assert.match(app,/workboard:canonical-bridge-ready/);
  assert.doesNotMatch(source,/firebase\/database|runTransaction/);
});
test('origin belongs to the release manifest', () => {
  assert.doesNotMatch(manifest,/origin-modern-v372\.css/);
  assert.match(manifest,/origin-modern-v372\.js/);
  assert.match(css,/data-modern-origin-ready/);
  assert.match(source,/originSearchInput/);
  assert.match(source,/originToast/);
  assert.doesNotMatch(source,/この画面は新規設計のデモです/);
});

test('origin bulk completion delegates to a single revision-safe canonical transaction', () => {
  assert.match(source,/type:'task\.bulk\.complete',items/);
  assert.match(source,/selectedBulk\.clear\(\);render\(\)/);
  assert.doesNotMatch(source,/一括完了は既存のタスク画面から実行してください/);
  assert.match(app,/case 'task\.bulk\.complete'/);
  assert.match(app,/source: 'origin', ids, expectedRevisions,/);
  assert.match(app,/action: command\.type === 'task\.bulk\.complete' \? 'complete' : command\.action/);
  assert.match(app,/normalizeRevision\(task\.revision\) !== options\.expectedRevisions\[task\.id\]/);
  assert.match(app,/const result = await executeWrite\('bulk'/);
  assert.match(app,/normalizeRevision\(current\.revision\) !== normalizeRevision\(original\.revision\)/);
});

test('origin fully suppresses the former Modern view only when ready', () => {
  assert.match(css,/html\[data-wb-display="modern"\]\[data-modern-origin-ready="true"\]\[data-wb-color-theme\] body\.desktop-sidebar-v158 > \.app-shell/);
  assert.match(css,/body\.desktop-sidebar-v158 > \.app-shell\.detail-open/);
  assert.match(css,/html\[data-wb-display="modern"\]\[data-modern-origin-ready="true"\]:not\(\[data-wb-palette-next-preview="true"\]\) #modernOriginRoot/);
  assert.match(css,/#modernOriginRoot \{display:none !important;\}/);
});

test('origin shows the release manifest version instead of a separately maintained constant', () => {
  assert.match(source,/window\.WORK_BOARD_RELEASE_VERSION \|\| window\.WORK_BOARD_RELEASE\?\.version/);
  assert.match(source,/label\.textContent='WORKSPACE · Ver\.'\+release/);
  assert.match(source,/host\.dataset\.releaseVersion=release/);
});

test('origin schedule form submits canonical CAS commands without Classic modal',()=>{
  assert.match(source,/function originScheduleEditor\(v,id\)/);
  assert.match(source,/name="startAt" type="datetime-local"/);
  assert.match(source,/type:id\?'schedule.update':'schedule.create'/);
  assert.match(source,/f.dataset.revision=String\(original\?\.revision\?\?0\)/);
  assert.match(source,/type:'schedule.delete'/);
  assert.match(app,/case 'schedule.create':/);
  assert.match(app,/case 'schedule.update':/);
  assert.match(app,/case 'schedule.delete':/);
  assert.doesNotMatch(source,/if\(kind==='events' && edit\)\{window.WorkBoardOriginScheduleBridge/);
});

test('origin schedule UI is native and preserves canonical CAS ownership',()=>{
  assert.match(source,/function originScheduleEditor\(v,id\)/);
  assert.match(source,/name="startAt" type="datetime-local"/);
  assert.match(source,/name="endAt" type="datetime-local"/);
  assert.match(source,/data-action="schedule-duration"/);
  assert.match(source,/type:id\?'schedule.update':'schedule.create'/);
  assert.match(source,/f.dataset.revision=String\(original\?\.revision\?\?0\)/);
  assert.match(source,/type:'schedule.delete'/);
  assert.match(source,/schedule-classic/);
  for(const name of ['schedule.create','schedule.update','schedule.delete'])
    assert.match(app,new RegExp("case '"+name.replaceAll('.','\\.')+"':"));
  assert.doesNotMatch(source,/if\(kind==='events' && edit\)\{window.WorkBoardOriginScheduleBridge/);
});
