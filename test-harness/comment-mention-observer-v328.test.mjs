import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mention = readFileSync('comment-mentions-v191.js','utf8');
const manifest = readFileSync('release-manifest.js','utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json','utf8'));
const audit = readFileSync('COMMENT_MENTION_OBSERVER_AUDIT_V328.md','utf8');
const browser = readFileSync('tests/comment-mention-observer-audit-v328.spec.mjs','utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.328 audit stays evidence-only at release and responsibility baseline 281',()=>{
  assert.equal(release,281);
  assert.equal(String(responsibilities.baselineRelease),'281');
  assert.match(audit,/audit-only/);
  assert.match(audit,/product runtime, release manifest, Firebase paths, and business-data write behavior remain unchanged/i);
});

test('Ver.328 leaves the production detailBody observer unchanged',()=>{
  assert.match(mention,/const detail=document\.getElementById\('detailBody'\)/);
  assert.match(mention,/new MutationObserver\(mutations=>/);
  assert.match(mention,/mutations\.some\(mutation=>mutation\.addedNodes\.length\|\|mutation\.removedNodes\.length\)\)schedule\(\)/);
  assert.match(mention,/\.observe\(detail,\{childList:true,subtree:true\}\)/);
  assert.doesNotMatch(mention,/mutationTouchesMentionSurfaceV328/);
});

test('Ver.328 candidate filters scheduling semantically without narrowing the observer root',()=>{
  assert.match(browser,/mutationTouchesMentionSurfaceV328/);
  assert.match(browser,/\.task-comments-panel-v149, #commentForm, \.comment-form, textarea#commentText/);
  assert.match(browser,/observe\(detail,\{childList:true,subtree:true\}\)/);
  assert.match(browser,/unrelated detail churn does not schedule a mention rescan/);
  assert.match(browser,/canonical comment-form replacement is still adopted/);
  assert.match(browser,/replacing the whole comment panel remains covered on mobile/);
});

test('Ver.328 keeps Ver.327 Escape lifecycle and write boundaries outside the observer candidate',()=>{
  assert.match(mention,/bindMentionEscapeV327/);
  assert.match(mention,/unbindMentionEscapeV327/);
  assert.match(audit,/mention token semantics, Escape lifecycle/);
  assert.match(audit,/comment\/reaction\/reply persistence or Firebase write behavior/);
});

test('Ver.328 records a narrow Ver.329 product gate only after green audit evidence',()=>{
  assert.match(audit,/next work unit is Ver\.329 productization/);
  assert.match(audit,/must not narrow the `#detailBody` observer root/);
  assert.deepEqual(responsibilities.priorityCandidates?.[0]?.scope,['comment-mentions-v191.js']);
});
