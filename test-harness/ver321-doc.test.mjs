import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Ver.321 checkpoint documentation records rollback and unchanged release', () => {
  const doc = readFileSync('docs/ver321-task-dialog-polish.md', 'utf8');
  assert.match(doc, /Release remains 279/);
  assert.match(doc, /backup\/ver320-before-task-dialog-polish-v321/);
});
