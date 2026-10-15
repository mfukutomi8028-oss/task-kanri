// Ver.473: OS-independent, fail-closed discovery of direct Protocol test files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function discoverProtocolTests(root = ROOT) {
  const directory = path.join(root, 'test-harness');
  const tests = fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.test.mjs'))
    .map(entry => path.join('test-harness', entry.name))
    .sort();
  if (!tests.length) throw new Error('Protocolテストが見つかりません: ' + directory);
  return tests;
}

export function protocolArgs(tests) {
  if (!Array.isArray(tests) || tests.length === 0) {
    throw new Error('Protocolテストの実行対象が空です');
  }
  return ['--test', ...tests];
}

export function childExitCode(result) {
  if (result.error) throw result.error;
  return Number.isInteger(result.status) && !result.signal ? result.status : 1;
}

function main() {
  const tests = discoverProtocolTests(ROOT);
  process.stdout.write('Protocolテスト: ' + tests.length + 'ファイルを実行します。\n');
  const result = spawnSync(process.execPath, protocolArgs(tests), {
    cwd: ROOT, stdio: 'inherit', windowsHide: true, shell: false
  });
  process.exitCode = childExitCode(result);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) {
    console.error('Protocolテストの開始に失敗しました:', error);
    process.exitCode = 1;
  }
}
