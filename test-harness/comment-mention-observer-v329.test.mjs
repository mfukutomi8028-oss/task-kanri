import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mention = readFileSync('comment-mentions-v191.js','utf8');
const manifest = readFileSync('release-manifest.js','utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json','utf8'));
const audit = readFileSync('COMMENT_MENTION_OBSERVER_AUDIT_V328.md','utf8');
const product = readFileSync('COMMENT_MENTION_OBSERVER_PRODUCT_V329.md','utf8');
const browser = readFileSync('tests/comment-mention-observer-v329.spec.mjs','utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.329 advances release and responsibility baseline together to 282',()=>{
  assert.equal(release,282);
  assert.equal(String(responsibilities.baselineRelease),'282');
  assert.match(product,/281 to 282/);
});

test('Ver.329 filters mention observer scheduling by semantic comment surfaces without narrowing its root',()=>{
  assert.match(mention,/function mutationTouchesMentionSurfaceV329\(mutation\)/);
  assert.match(mention,/\.task-comments-panel-v149, #commentForm, \.comment-form, textarea#commentText/);
  assert.match(mention,/mutations\.some\(mutationTouchesMentionSurfaceV329\)\)schedule\(\)/);
  assert.match(mention,/const detail=document\.getElementById\('detailBody'\)/);
  assert.match(mention,/\.observe\(detail,\{childList:true,subtree:true\}\)/);
  assert.doesNotMatch(mention,/mutations\.some\(mutation=>mutation\.addedNodes\.length\|\|mutation\.removedNodes\.length\)\)schedule\(\)/);
});

test('Ver.329 preserves mention lifecycle and explicit workflow reconciliation boundaries',()=>{
  assert.match(mention,/bindMentionEscapeV327/);
  assert.match(mention,/unbindMentionEscapeV327/);
  assert.match(mention,/window\.addEventListener\('workflow-v152-update',schedule\)/);
  assert.match(mention,/function applyMentions\(\)/);
  assert.match(mention,/function protectTextarea\(textarea\)/);
  assert.match(product,/comment, reply, reaction, Firebase and business-data write behavior remain unchanged/);
});

test('Ver.329 product regression exercises the real runtime without candidate source replacement',()=>{
  assert.match(browser,/unrelated detail churn does not recreate the mention helper/);
  assert.match(browser,/canonical comment-form replacement is adopted/);
  assert.match(browser,/whole comment-panel replacement remains adopted on mobile/);
  assert.match(browser,/picker remains usable after semantic adoption/);
  assert.doesNotMatch(browser,/mode:'candidate'/);
  assert.doesNotMatch(browser,/route\.fulfill/);
});

test('Ver.329 preserves Ver.328 audit evidence and advances the next isolated audit to completion-unpin polling',()=>{
  assert.match(audit,/Ver\.328/);
  assert.match(audit,/candidate may receive the broad observer callback but does not schedule or execute `patch\(\)`/);
  const comments=responsibilities.groups.find(group=>group.id==='user-and-comments');
  assert.ok(comments);
  assert.match(comments.reason,/Ver\.328監査/);
  assert.match(comments.reason,/Ver\.329製品/);
  assert.match(comments.reason,/release 282/);
  assert.deepEqual(responsibilities.priorityCandidates?.[0]?.scope,['completion-unpin-v150.js']);
  assert.match(responsibilities.priorityCandidates?.[0]?.goal||'',/Ver\.330/);
  assert.match(responsibilities.priorityCandidates?.[0]?.goal||'',/1500ms/);
});
