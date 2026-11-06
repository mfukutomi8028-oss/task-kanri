import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categorizeFailure, extractFailedTests, failureMarkdown, summarizeLog } from './ci-failure-digest.mjs';

test('CI failure digest: extracts distinct Playwright failures without treating retries as separate failures', () => {
  const log = [
    '  1) tests/classic-color-theme-v329.spec.mjs:68:1 › theme stays legible',
    '    Error: page.evaluate: Error: Unknown computed color oklab(...)',
    '    Retry #1',
    '    Error: page.evaluate: Error: Unknown computed color oklab(...)',
    '  2) tests/firebase-emulator-comment-replies-v215.spec.mjs:130:1 › comment reply',
    '    Error: expect(locator).toBeVisible() failed',
    '    Timeout: 15000ms',
    '  2 failed'
  ].join('\n');
  const result = extractFailedTests(log);
  assert.equal(result.length, 2);
  assert.equal(result[0].file, 'tests/classic-color-theme-v329.spec.mjs');
  assert.equal(result[0].line, 68);
  assert.equal(result[0].category, 'テスト補助処理・形式差');
  assert.equal(result[1].category, '期待値・画面状態の不一致');
  const markdown = failureMarkdown('Browser shard 2', result, 'browser-results.log');
  assert.match(markdown, /失敗テスト 2 件/);
  assert.match(markdown, /comment reply/);
  assert.match(markdown, /暫定分類/);
});

test('CI failure digest: only explicit environment symptoms suggest an environmental cause', () => {
  assert.equal(categorizeFailure('Error: listen EADDRINUSE'), '実行環境の可能性');
  assert.equal(categorizeFailure('Error: page.evaluate: Error: todo.create failed: write-failed'), '画面処理・保存エラー');
  assert.equal(categorizeFailure('Test timeout of 90000ms exceeded'), '待機・時間超過（原因未確定）');
  assert.equal(categorizeFailure('Error: pastel-blue navigation text'), 'その他（原本ログで確認）');
  const empty = summarizeLog('npm ERR! network timeout', 'Firebase Emulator', 'firebase-results.log');
  assert.equal(empty.failures.length, 0);
  assert.match(empty.markdown, /セットアップ・サーバー起動/);
});

test('CI failure digest: Markdown cells are escaped', () => {
  const out = failureMarkdown('Browser', [{
    file: 'tests/failure.spec.mjs', line: 1, title: 'cell | delimiter',
    category: 'その他', message: 'bad | value'
  }], 'browser-results.log');
  assert.ok(out.includes('cell \\| delimiter'));
  assert.ok(out.includes('bad \\| value'));
});
