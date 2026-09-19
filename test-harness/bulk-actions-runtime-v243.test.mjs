import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Ver.243 bulk runtime parses and legacy v174 stays physical only', () => {
  const current = path.join(ROOT, 'bulk-actions-v243.js');
  const legacy = path.join(ROOT, 'bulk-actions-v174.js');
  assert.ok(fs.existsSync(current));
  assert.ok(fs.existsSync(legacy));
  const parsed = spawnSync(process.execPath, ['--check', current], { encoding: 'utf8' });
  assert.equal(parsed.status, 0, parsed.stderr || parsed.stdout);
});
