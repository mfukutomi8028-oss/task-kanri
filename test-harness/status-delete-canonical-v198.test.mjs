import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const stable = fs.readFileSync(new URL('../stable-fixes-v108.js', import.meta.url), 'utf8');
const mobile = fs.readFileSync(new URL('../mobile-fixes.js', import.meta.url), 'utf8');

const CORE_STATUSES = ['未着手', '対応中', '確認待ち', '保留', '完了'];

function literalArray(source, constantName) {
  const match = source.match(new RegExp(`const\\s+${constantName}\\s*=\\s*\\[([^\\]]*)\\]`, 's'));
  assert.ok(match, `${constantName} must remain a literal array for the ownership contract`);
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map(item => item[1]);
}

function functionBody(source, signature, nextSignature = '\nfunction ') {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `missing function: ${signature}`);
  const next = source.indexOf(nextSignature, start + signature.length);
  return source.slice(start, next >= 0 ? next : source.length);
}

test('app owns five-status deletion protection separately from completed-name locking', () => {
  assert.deepEqual(literalArray(app, 'DEFAULT_STATUSES'), CORE_STATUSES);
  assert.match(app, /function isProtectedDeleteStatus\(status\)\s*{[\s\S]*DEFAULT_STATUSES\.some/);

  const manager = functionBody(app, 'function renderStatusManager()', '\nasync function addStatusFromForm');
  assert.match(manager, /const nameLocked = isCompletedStatus\(status\);/);
  assert.match(manager, /const deleteProtected = isProtectedDeleteStatus\(status\);/);
  assert.match(manager, /data-status-old=[\s\S]*\$\{nameLocked \? "readonly" : ""\}/);
  assert.match(manager, /data-delete-status=[\s\S]*\$\{deleteAttributes\}/);
  assert.match(manager, /aria-disabled="true"/);
  assert.match(manager, /基本状態のため削除できません/);
});

test('deleteStatus rejects all core statuses while renameStatus still locks only completed', () => {
  const deleteBody = functionBody(app, 'async function deleteStatus(name)', '\nfunction setStatuses');
  assert.match(deleteBody, /if \(isProtectedDeleteStatus\(name\)\)/);
  assert.match(deleteBody, /完了は削除できません/);
  assert.match(deleteBody, /基本状態のため削除できません/);

  const renameBody = functionBody(app, 'async function renameStatus(oldName, newValue)', '\nasync function deleteStatus');
  assert.match(renameBody, /if \(isCompletedStatus\(oldName\)\) return toast\("完了は名称変更できません", true\);/);
  assert.doesNotMatch(renameBody, /isProtectedDeleteStatus/);
});

test('stable retires duplicate delete guard while mobile remains as transitional compatibility', () => {
  assert.doesNotMatch(stable, /PROTECTED_STATUSES/);
  assert.doesNotMatch(stable, /function isProtectedStatus\s*\(/);
  assert.doesNotMatch(stable, /function patchStatusManager\s*\(/);
  assert.doesNotMatch(stable, /\[data-delete-status\]/);

  assert.deepEqual(literalArray(mobile, 'PROTECTED_DELETE_STATUSES'), CORE_STATUSES);
  assert.match(mobile, /function isProtectedDeleteStatus\s*\(/);
  assert.match(mobile, /function patchStatusManager\s*\(/);
  assert.match(mobile, /\[data-delete-status\]/);
  assert.match(mobile, /基本状態のため削除できません/);
});
