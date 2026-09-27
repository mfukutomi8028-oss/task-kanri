import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const app = readFileSync('app.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_SCHEDULE_RETRY_AUDIT_V303.md', 'utf8');
const product = readFileSync('MOBILE_SHELL_SCHEDULE_HANDOFF_V304.md', 'utf8');
const release = Number(manifest.match(/const VERSION = ["'](\d+)["']/)?.[1] || 0);

test('Ver.304 advances release and responsibility baseline together', () => {
  assert.equal(release, 273);
  assert.equal(String(responsibilities.baselineRelease), '273');
});

test('Ver.304 keeps direct open and canonical navigation but retires fixed schedule-create retries', () => {
  assert.match(mobile, /function openNewSchedule\(\)/);
  assert.match(mobile, /if \(tryOpen\(\)\) return;/);
  assert.match(mobile, /document\.querySelector\("\.nav-item\[data-layout='schedule'\], \[data-layout='schedule'\]"\)\?\.click\(\);\s*tryOpen\(\);/);
  assert.doesNotMatch(mobile, /setTimeout\(tryOpen, 80\)/);
  assert.doesNotMatch(mobile, /setTimeout\(tryOpen, 220\)/);
  assert.doesNotMatch(mobile, /setTimeout\(tryOpen, 500\)/);
});

test('Ver.304 remains coupled to the canonical synchronous schedule render contract', () => {
  assert.match(app, /state\.layout = button\.dataset\.layout[\s\S]*?syncNavigationUi\(\);\s*render\(\);/);
  assert.match(app, /data-new-schedule>＋ 新しい予定<\/button>/);
  assert.match(app, /querySelector\("\[data-new-schedule\]"\)\?\.addEventListener\("click", \(\) => openScheduleDialog\(\)\)/);
});

test('Ver.303 evidence is promoted without widening Ver.304 product scope', () => {
  assert.match(audit, /same JavaScript task/i);
  assert.match(audit, /80\/220\/500ms/);
  assert.match(product, /removes only the three fixed schedule-create callbacks/i);
  assert.match(product, /860\/861px conditional mobile-shell loading boundary/);
  assert.match(product, /Firebase, task persistence, workflow, notifications, and every business-data write path/);
});

test('Ver.304 history remains durable after Ver.305 audit advances the next boundary', () => {
  const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(group);
  assert.match(group.reason, /Ver\.303監査/);
  assert.match(group.reason, /Ver\.304製品/);
  assert.match(group.reason, /release 273/);
  assert.match(group.reason, /Ver\.305監査/);
  assert.ok(next);
  assert.deepEqual(next.scope, ['mobile-shell-v234.js']);
  assert.match(next.goal || '', /Ver\.306製品/);
  assert.match(next.goal || '', /setTimeout\(0\)/);
  assert.match(next.precondition || '', /Ver\.305監査/);
  assert.match(next.precondition || '', /273/);
});
