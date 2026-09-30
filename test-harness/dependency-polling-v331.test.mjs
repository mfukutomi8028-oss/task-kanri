import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../dependencies-v149.js', import.meta.url), 'utf8');
const browserAudit = fs.readFileSync(new URL('../tests/dependency-polling-audit-v331.spec.mjs', import.meta.url), 'utf8');

test('Ver.331 audit keeps product runtime unchanged while measuring the 60s dependency timer', () => {
  assert.match(source, /setInterval\(schedule,60000\)/);
  assert.match(source, /workflow-v148-update/);
  assert.match(source, /workflow-v149-update/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /mainContent/);
});

test('Ver.331 browser audit suppresses only the dependencies-v149 60s interval', () => {
  assert.match(browserAudit, /Number\(delay\) === 60000/);
  assert.match(browserAudit, /stack\.includes\('dependencies-v149\.js'\)/);
  assert.match(browserAudit, /__v331DependencyInterval/);
  assert.match(browserAudit, /data-quick-task-status/);
  assert.match(browserAudit, /writeDependencies\('target', \[\], \['blocker'\]\)/);
});
