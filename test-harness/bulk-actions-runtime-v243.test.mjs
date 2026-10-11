import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Ver.243 bulk runtime parses and legacy v174 stays in frozen URL archive', () => {
  const current = path.join(ROOT, 'bulk-actions-v243.js');
  const legacy = path.join(ROOT, 'bulk-actions-v174.js');
  assert.ok(fs.existsSync(current));
  assert.equal(fs.existsSync(legacy), false, 'legacy bulk helper must leave Git root');
  const archive = JSON.parse(fs.readFileSync(path.join(ROOT, 'compat/frozen-legacy-runtime-v397.json'), 'utf8'));
  assert.equal(typeof archive['bulk-actions-v174.js'], 'string', 'cached old bulk JS must remain published');
  const parsed = spawnSync(process.execPath, ['--check', current], { encoding: 'utf8' });
  assert.equal(parsed.status, 0, parsed.stderr || parsed.stdout);
});
