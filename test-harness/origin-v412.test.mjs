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
 assert.match(origin,/bridge\.selectUser\?\.\(next\)/);
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


test('Ver.415 paper-only changes preserve last content modification time across screens',()=>{
 assert.match(memo,/const contentUnchanged = Boolean\(existing\)/);
 assert.match(memo,/const colorOnly = contentUnchanged/);
 assert.match(memo,/updatedAt: colorOnly \? Number\(existing\.updatedAt/);
 assert.match(memo,/updatedBy: colorOnly \? String\(existing\.updatedBy/);
 assert.match(memo,/\.\.\.memo, id, paperColor: color/);
 assert.match(memo,/await commitMemo\(draft, expectedRevision\)/);
 assert.match(origin,/tags:\[\.\.\.m\.tags\]/);
});

test('Ver.415 Origin retains pending drafts, refocuses swatches and supports schedule search',()=>{
 assert.match(origin,/quickTodoDraft=''/);
 assert.match(origin,/function updateScheduleSearch\(input\)/);
 assert.match(origin,/scheduleComposing=true/);
 assert.match(origin,/id="originScheduleSearch"/);
 assert.match(origin,/origin-selected/);
 assert.match(origin,/input中の変更|入力中の変更を破棄して利用者を切り替えますか/);
 assert.match(origin,/if\(ok&&view==='notes'\)/);
 assert.match(origin,/window\.confirm\(/);
 assert.match(origin,/\.header-inner\{flex-wrap:wrap/);
 assert.doesNotMatch(origin,/localStorage\.setItem/);
});

test('Origin memo library navigation keeps pinned order and adds safe view-only search',()=>{
 assert.ok(origin.includes("function renderNotes(){"));
 assert.ok(origin.includes("memoQuery.trim().toLocaleLowerCase()"));
 assert.ok(origin.includes("memoSort==='title'"));
 assert.ok(origin.includes("memoSort==='category'"));
 assert.ok(origin.includes("if(a==='memo-reset')"));
 assert.ok(origin.includes("if(t.id==='originMemoSort')"));
 assert.ok(origin.includes("function updateMemoQuery(input)"));
 assert.ok(origin.includes("if(e.target.id==='originMemoQuery'){memoComposing=false"));
 assert.ok(origin.includes("const pin=Number(Boolean(b.pinned))-Number(Boolean(a.pinned))"));
 assert.doesNotMatch(origin,/memoQuery.*localStorage\.setItem/);
});

test('Origin responsive desktop header keeps tabs on an independent row',()=>{
 assert.ok(origin.includes("@media (min-width:771px) and (max-width:1500px)"));
 assert.ok(origin.includes(".header-nav{order:2;flex:0 0 100%"));
 assert.ok(origin.includes(".header-tools{order:1;margin-left:auto"));
 assert.ok(origin.includes("id=\"originMemoQuery\""));
 assert.ok(origin.includes('class="origin-memo-result"'));
});
