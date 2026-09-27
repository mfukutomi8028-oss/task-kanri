import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const app = readFileSync('app.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_SCHEDULE_RETRY_AUDIT_V303.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.303 audit remains on the Ver.302 release baseline', () => {
  assert.equal(release, 272);
  assert.equal(String(responsibilities.baselineRelease), '272');
});

test('Ver.303 audit measures the current fixed schedule-create retries without product changes', () => {
  assert.match(mobile, /function openNewSchedule\(\)/);
  assert.match(mobile, /if \(tryOpen\(\)\) return;/);
  assert.match(mobile, /data-layout='schedule'/);
  assert.match(mobile, /setTimeout\(tryOpen, 80\)/);
  assert.match(mobile, /setTimeout\(tryOpen, 220\)/);
  assert.match(mobile, /setTimeout\(tryOpen, 500\)/);
});

test('Ver.303 canonical schedule navigation renders synchronously in app.js', () => {
  assert.match(app, /state\.layout = button\.dataset\.layout[\s\S]*?syncNavigationUi\(\);\s*render\(\);/);
  assert.match(app, /data-new-schedule>＋ 新しい予定<\/button>/);
  assert.match(app, /querySelector\("\[data-new-schedule\]"\)\?\.addEventListener\("click", \(\) => openScheduleDialog\(\)\)/);
});

test('Ver.303 audit records the synchronous handoff product gate', () => {
  assert.match(audit, /same JavaScript task/i);
  assert.match(audit, /80\/220\/500ms/);
  assert.match(audit, /製品コードは変更しない/);
  assert.match(audit, /Ver\.304/);
});
