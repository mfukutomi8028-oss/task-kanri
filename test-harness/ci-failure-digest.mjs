import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Diagnostic only: never retries tests or changes their exit status.
export function extractFailedTests(log) {
  const lines = String(log).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').split(/\r?\n/);
  const headers = [];
  const pattern = /^\s{2,}(\d+)\)\s+(tests\/[^\s:]+\.spec\.(?:mjs|js|ts|tsx)):(\d+):(\d+)\s+›\s+(.+)$/;
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(pattern);
    if (match) headers.push({ start: i, file: match[2], line: Number(match[3]), title: match[5].trim() });
  }
  return headers.map((item, index) => {
    const end = headers[index + 1]?.start ?? lines.length;
    const segment = lines.slice(item.start + 1, end).slice(0, 100);
    const first = segment.find(line => /^\s+(?:Error:|AssertionError|Test timeout of|TimeoutError:)/.test(line));
    const message = (first || '詳細は元のテストログを確認').trim().slice(0, 250);
    return {
      file: item.file,
      line: item.line,
      title: item.title,
      message,
      category: categorizeFailure(message, segment.join('\n').slice(0, 3500))
    };
  });
}

export function categorizeFailure(message, context = '') {
  const text = String(message) + '\n' + String(context);
  if (/Unknown computed color|parseColor.*Unknown|unsupported.*color/i.test(text)) return 'テスト補助処理・形式差';
  if (/EADDRINUSE|ENOSPC|No space left on device|Executable doesn't exist|browserType\.launch:.*not found/i.test(text)) {
    return '実行環境の可能性';
  }
  if (/write-failed|transaction.*failed|page\.evaluate: Error:/i.test(text)) return '画面処理・保存エラー';
  if (/AssertionError|Error: expect\(|Expected:|Received:/i.test(text)) return '期待値・画面状態の不一致';
  if (/Test timeout of|TimeoutError:|Timed out|Timeout:\s*\d+ms/i.test(text)) return '待機・時間超過（原因未確定）';
  return 'その他（原本ログで確認）';
}

function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').replace(/\x60/g, "'").slice(0, 200);
}
function annotationValue(value) {
  return String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

export function failureMarkdown(kind, failures, logFile) {
  const rows = [
    '### ' + escapeCell(kind) + '：失敗テストの症状',
    '',
    '症状による暫定分類です。環境障害やアプリ不具合と確定したものではありません。',
    '',
    '失敗テスト ' + failures.length + ' 件（再試行後にも残ったもの）。',
    ''
  ];
  if (failures.length) {
    rows.push('| テスト | 症状分類 | 最初のエラー |', '| --- | --- | --- |');
    for (const f of failures.slice(0, 25)) {
      rows.push('| ' + escapeCell(f.file + ':' + f.line + ' ' + f.title) + ' | ' +
        escapeCell(f.category) + ' | ' + escapeCell(f.message) + ' |');
    }
    if (failures.length > 25) rows.push('', '残り ' + (failures.length - 25) + ' 件は添付ログで確認してください。');
  } else {
    rows.push('Playwrightの失敗テスト見出しを検出できませんでした。セットアップ・サーバー起動・npm・タイムアウト等、ジョブログ本体を確認してください。');
  }
  rows.push('', '原本ログ: ' + escapeCell(logFile) + '。この診断処理は合否・再試行回数を変更しません。', '');
  return rows.join('\n');
}

export function summarizeLog(log, kind, logFile) {
  const failures = extractFailedTests(log);
  return { failures, markdown: failureMarkdown(kind, failures, logFile) };
}

function runCli() {
  const logFile = process.argv[2] || '';
  const kind = process.argv[3] || '回帰テスト';
  const raw = logFile && fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
  const result = summarizeLog(raw, kind, logFile || '(未生成)');
  console.log(result.markdown);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, result.markdown + '\n');
  for (const failure of result.failures.slice(0, 10)) {
    console.log('::error file=' + annotationValue(failure.file) +
      ',line=' + failure.line + ',title=' + annotationValue(failure.category) +
      '::' + annotationValue(failure.title + ' — ' + failure.message));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
