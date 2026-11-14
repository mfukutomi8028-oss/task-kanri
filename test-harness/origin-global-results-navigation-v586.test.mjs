import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync('origin-modern-v372.js','utf8');
const calendar=source.slice(source.indexOf('function renderCalendar(){'),source.indexOf('const MEMO_RENDER_BATCH='));
const navigation=source.slice(source.indexOf('function focusOriginFirstResult(kind){'),source.indexOf('function focusSearchResult(button){'));

test('Origin global schedule jump is enabled by cross-week results, not the current week',()=>{
 assert.match(calendar,/const jumpCandidates=scheduleSearchScope==='all'\?globalVisible:shown;/);
 assert.match(calendar,/\$\{jumpCandidates\.length\?'':'disabled'\}/);
 assert.match(calendar,/全期間の検索結果.*この週の予定/);
});

test('Origin global schedule jump prioritizes global matches over unrelated weekly events',()=>{
 assert.match(navigation,/events:view==='calendar'&&scheduleSearchScope==='all'/);
 assert.match(navigation,/\.origin-schedule-global-results \.origin-schedule-global-item \[data-action="open"\]/);
});
