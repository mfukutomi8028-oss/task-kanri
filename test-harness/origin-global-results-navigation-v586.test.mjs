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

test('Origin schedule reset describes the full set of cleared filters',()=>{
 assert.match(calendar,/aria-label="予定の検索語・担当者・分類・期間などの条件を解除"/);
});

test('Origin schedule footer accurately explains the detail-first edit path',()=>{
 assert.match(calendar,/予定を押すと詳細を確認できます/);
 assert.doesNotMatch(calendar,/予定を押すと詳細・編集が開きます/);
});
