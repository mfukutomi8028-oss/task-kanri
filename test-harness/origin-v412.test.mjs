import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const origin=readFileSync('origin-modern-v372.js','utf8');
const selector=readFileSync('modern-display-v356.js','utf8');
const memo=readFileSync('work-features-v167.js','utf8');

test('Origin is the display name while the stored modern mode remains compatible',()=>{
 assert.match(selector,/\['modern', 'Origin'/);
 assert.match(origin,/<option value=\\\"modern\\\">Origin<\/option>/);
 assert.match(origin,/originUserSelect/);
 assert.match(origin,/bridge\.selectUser\?\.\(t\.value\)/);
});

test('Origin memo color is shared with the canonical bridge and supports existing color set',()=>{
 assert.match(memo,/MEMO_PAPER_COLORS = Object\.freeze/);
 assert.match(origin,/paperColor:t\.paperColor\|\|'ivory'/);
 assert.match(origin,/paperColor:memoColor\(fd\.get\('paperColor'\)\)/);
 assert.match(origin,/if\(a==='memo-color'\)/);
 assert.match(origin,/memoColorFilter/);
 assert.match(origin,/memoBridge\?\.categories/);
 assert.doesNotMatch(origin,/firebase\/database|runTransaction/);
});

test('Origin schedule controls use current canonical events without a second writer',()=>{
 for(const token of ['scheduleView','originDateJump','originScheduleAssignee','origin-agenda-entry'])
   assert.ok(origin.includes(token),token);
 assert.match(origin,/type:id\?'schedule.update':'schedule.create'/);
 assert.match(origin,/type:'schedule.delete'/);
});
