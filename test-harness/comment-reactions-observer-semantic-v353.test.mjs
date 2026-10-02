import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

function candidateSource() {
  let source = read('comment-reactions-v191.js');
  const anchor = '  function start() {';
  const helper = `  const COMMENT_SURFACE_SELECTOR_V353 = ".task-comments-panel-v149, .activity-comments-panel, #commentForm, .comment-form, .activity-comment";\n  const COMMENT_OWNED_SELECTOR_V353 = ".comment-thread-v215, .comment-reactions-v165, .comment-thread-actions-v215, .comment-reply-compose-v215, .comment-reply-context-v215";\n\n  function mutationTouchesCommentSurfaceV353(mutation) {\n    return [...mutation.addedNodes].some(node => {\n      if (!(node instanceof Element)) return false;\n      if (node.matches(COMMENT_OWNED_SELECTOR_V353)) return false;\n      return node.matches(COMMENT_SURFACE_SELECTOR_V353) || Boolean(node.querySelector(COMMENT_SURFACE_SELECTOR_V353));\n    });\n  }\n\n`;
  assert.ok(source.includes(anchor));
  source = source.replace(anchor, `${helper}${anchor}`);
  const broad = 'if (mutations.some(item => item.addedNodes.length || item.removedNodes.length)) schedulePatch();';
  assert.ok(source.includes(broad));
  return source.replace(broad, 'if (mutations.some(mutationTouchesCommentSurfaceV353)) schedulePatch();');
}

test('Ver.353 isolates the remaining broad #detailBody childList observer', () => {
  const source = read('comment-reactions-v191.js');
  assert.match(source, /new MutationObserver\(mutations => \{/);
  assert.match(source, /mutations\.some\(item => item\.addedNodes\.length \|\| item\.removedNodes\.length\)\) schedulePatch\(\)/);
  assert.match(source, /\.observe\(root, \{ childList: true, subtree: true \}\)/);
});

test('Ver.353 candidate keeps observer root but schedules only canonical comment additions', () => {
  const candidate = candidateSource();
  assert.match(candidate, /function mutationTouchesCommentSurfaceV353\(mutation\)/);
  assert.match(candidate, /COMMENT_SURFACE_SELECTOR_V353/);
  assert.match(candidate, /\.task-comments-panel-v149, \.activity-comments-panel, #commentForm, \.comment-form, \.activity-comment/);
  assert.match(candidate, /COMMENT_OWNED_SELECTOR_V353/);
  assert.match(candidate, /\.comment-thread-v215, \.comment-reactions-v165/);
  assert.match(candidate, /mutations\.some\(mutationTouchesCommentSurfaceV353\)\) schedulePatch\(\)/);
  assert.match(candidate, /\.observe\(root, \{ childList: true, subtree: true \}\)/);
  assert.doesNotMatch(candidate, /mutations\.some\(item => item\.addedNodes\.length \|\| item\.removedNodes\.length\)\) schedulePatch\(\)/);
});

test('Ver.353 audit does not alter product runtime or release 291', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  assert.equal(manifest.match(/version:\s*["'](\d+)["']/)?.[1], '291');
  assert.equal(String(responsibilities.baselineRelease), '291');
  assert.match(read('comment-reactions-v191.js'), /mutations\.some\(item => item\.addedNodes\.length \|\| item\.removedNodes\.length\)\) schedulePatch\(\)/);
});