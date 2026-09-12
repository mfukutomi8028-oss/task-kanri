import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const stable = fs.readFileSync(new URL('../stable-fixes-v108.js', import.meta.url), 'utf8');
const mobile = fs.readFileSync(new URL('../mobile-fixes.js', import.meta.url), 'utf8');

const CORE_STATUSES = ['未着手', '対応中', '確認待ち', '保留', '完了'];

function literalArray(source, constantName) {
  const match = source.match(new RegExp(`const\\s+${constantName}\\s*=\\s*\\[([^\\]]*)\\]`, 's'));
  assert.ok(match, `${constantName} must remain a literal array for the ownership audit`);
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map(item => item[1]);
}

function functionBody(source, signature, nextSignature = '\\nfunction ') {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `missing function: ${signature}`);
  const next = source.indexOf(nextSignature, start + signature.length);
  return source.slice(start, next >= 0 ? next : source.length);
}

test('app owns the canonical five default statuses but currently locks editing/deletion only for completed', () => {
  assert.deepEqual(literalArray(app, 'DEFAULT_STATUSES'), CORE_STATUSES);
  assert.match(app, /const protectedStatus = isCompletedStatus\(status\);/);

  const deleteStatusBody = functionBody(app, 'async function deleteStatus(name)');
  assert.match(deleteStatusBody, /if \(isCompletedStatus\(name\)\) return toast\(["']完了は削除できません["'], true\);/);
  assert.doesNotMatch(deleteStatusBody, /DEFAULT_STATUSES/);

  // Ver.197 characterizes the migration gap: deletion protection for the other
  // four defaults is still supplied by compatibility patches, while their
  // names remain editable in the app-owned status manager.
  assert.match(app, /data-status-old=.*\$\{protectedStatus \? ["']readonly["'] : ["']["']\}/s);
});

test('stable and mobile compatibility layers duplicate the same five-status delete guard', () => {
  assert.deepEqual(literalArray(stable, 'PROTECTED_STATUSES'), CORE_STATUSES);
  assert.deepEqual(literalArray(mobile, 'PROTECTED_DELETE_STATUSES'), CORE_STATUSES);

  for (const [label, source, predicate] of [
    ['stable', stable, 'isProtectedStatus'],
    ['mobile', mobile, 'isProtectedDeleteStatus']
  ]) {
    assert.match(source, /function patchStatusManager\s*\(/, `${label} must still expose the UI guard during Ver.197 audit`);
    assert.match(source, /querySelectorAll\(["']\[data-delete-status\]["']\)/);
    assert.match(source, /button\.disabled = true/);
    assert.match(source, /button\.setAttribute\(["']aria-disabled["'], ["']true["']\)/);
    assert.match(source, /基本状態のため削除できません/);
    assert.match(source, new RegExp(`if \\(!${predicate}\\(status\\)\\) return`));
  }
});
