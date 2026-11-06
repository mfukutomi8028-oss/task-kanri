import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');

test('Pages publication is blocked before uploading assets when Protocol fails', () => {
  const workflow = read('.github/workflows/pages.yml');
  const install = workflow.indexOf('name: Install protocol test dependencies');
  const protocol = workflow.indexOf('name: Preflight release contracts');
  const stage = workflow.indexOf('name: Stage verified runtime artifact');
  const upload = workflow.indexOf('name: Upload artifact');
  assert.ok(install >= 0 && install < protocol && protocol < stage && stage < upload);
  assert.match(workflow, /- name: Preflight release contracts\s+run: npm run test:protocol/);
  assert.match(workflow, /- name: Deploy to GitHub Pages/);
});

test('Backup exports are excluded from the public source repository', () => {
  const ignore = read('.gitignore');
  const guide = read('docs/BACKUP_RECOVERY_RUNBOOK_20261106.md');
  assert.match(ignore, /\*\.rtdb\.json/);
  assert.match(ignore, /\/backups\//);
  assert.match(guide, /公開リポジトリ/);
  assert.match(guide, /Import JSON/);
  assert.match(guide, /SHA-256/);
});
