import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const mention = readFileSync('comment-mentions-v191.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('COMMENT_MENTION_ESCAPE_AUDIT_V326.md', 'utf8');
const product = readFileSync('COMMENT_MENTION_ESCAPE_PRODUCT_V327.md', 'utf8');
const browser = readFileSync('tests/comment-mention-escape-lifecycle-v327.spec.mjs', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.327 advances release and responsibility baseline together to 281', () => {
  assert.equal(release, 281);
  assert.equal(String(responsibilities.baselineRelease), '281');
  assert.match(product, /Release and responsibility baseline advance from 280 to 281/);
});

test('Ver.327 owns document Escape only while the mention picker is open', () => {
  assert.match(mention, /let mentionEscapeBoundV327=false/);
  assert.match(mention, /function handleMentionEscapeV327\(event\)/);
  assert.match(mention, /function bindMentionEscapeV327\(\)/);
  assert.match(mention, /function unbindMentionEscapeV327\(\)/);
  assert.match(mention, /document\.addEventListener\('keydown',handleMentionEscapeV327\)/);
  assert.match(mention, /document\.removeEventListener\('keydown',handleMentionEscapeV327\)/);
  assert.match(mention, /shell\.hidden=false;\s*bindMentionEscapeV327\(\);/s);
  assert.match(mention, /shell\.hidden=true;\s*unbindMentionEscapeV327\(\);/s);
  assert.doesNotMatch(mention, /document\.addEventListener\('keydown',event=>/);
});

test('Ver.327 keeps the detailBody observer and comment write boundaries outside this product change', () => {
  assert.match(mention, /const detail=document\.getElementById\('detailBody'\)/);
  assert.match(mention, /new MutationObserver\(mutations=>/);
  assert.match(mention, /\.observe\(detail,\{childList:true,subtree:true\}\)/);
  assert.match(product, /`#detailBody` MutationObserver/);
  assert.match(product, /comment\/reaction\/reply persistence and Firebase write paths/);
});

test('Ver.327 preserves Ver.326 audit evidence and records the next isolated observer audit', () => {
  assert.match(audit, /Ver\.326/);
  assert.match(audit, /permanent `document` `keydown` listener/);
  assert.equal(existsSync('tests/comment-mention-escape-audit-v326.spec.mjs'), false,
    'superseded injected Ver.326 browser audit must stay retired after product promotion');

  const comments = responsibilities.groups.find(group => group.id === 'user-and-comments');
  assert.ok(comments, 'user/comment responsibility group must remain present');
  assert.match(comments.reason, /Ver\.326監査/);
  assert.match(comments.reason, /Ver\.327製品/);
  assert.match(comments.reason, /release 281/);
  assert.match(responsibilities.priorityCandidates?.[0]?.goal || '', /Ver\.328/);
  assert.deepEqual(responsibilities.priorityCandidates?.[0]?.scope, ['comment-mentions-v191.js']);
});

test('Ver.327 browser regression measures the named product lifecycle without source replacement', () => {
  assert.match(browser, /handleMentionEscapeV327/);
  assert.match(browser, /closed mention picker owns no Escape listener/);
  assert.match(browser, /open, cancel and Escape cycles own exactly one transient listener/);
  assert.match(browser, /backdrop and apply release ownership/);
  assert.match(browser, /1366/);
  assert.match(browser, /390/);
  assert.match(browser, /data-mention-layer-host-v321/);
  assert.doesNotMatch(browser, /page\.route\(\/\\\/comment-mentions-v191/);
  assert.doesNotMatch(browser, /mode:'candidate'/);
});
