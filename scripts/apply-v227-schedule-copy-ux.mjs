import fs from 'node:fs';

function patch(path, changes) {
  let source = fs.readFileSync(path, 'utf8');
  for (const [before, after] of changes) {
    if (!source.includes(before)) throw new Error(`${path}: target not found: ${before.slice(0, 80)}`);
    source = source.replace(before, after);
  }
  fs.writeFileSync(path, source);
}

patch('app.js', [
  [
    'const SCHEDULE_COPY_MAX = 200;\nlet scheduleCopySourceId = "";',
    'const SCHEDULE_COPY_MAX = 200;\nconst SCHEDULE_COPY_LARGE_WARNING = 50;\nlet scheduleCopySourceId = "";'
  ],
  [
`function addScheduleCopyDateFromInput() {
  const value = $("scheduleCopyDateInput").value;
  if (!parseISODate(value)) return toast("追加する日付を選択してください", true);
  scheduleCopySelectedDates.add(value);
  renderScheduleCopySelectedDates();
  syncScheduleCopyPreview();
}`,
`function addScheduleCopyDateFromInput() {
  const value = $("scheduleCopyDateInput").value;
  if (!parseISODate(value)) return toast("追加する日付を選択してください", true);
  if (scheduleCopySelectedDates.has(value)) return toast("この日付はすでに追加されています", true);
  scheduleCopySelectedDates.add(value);
  renderScheduleCopySelectedDates();
  syncScheduleCopyPreview();
}`
  ],
  [
`  const notes = [];
  if (result.truncated) notes.push(\`最大\${SCHEDULE_COPY_MAX}件を超えています。期間または間隔を調整してください。\`);
  if (["monthlyDay", "yearly"].includes($("scheduleCopyMethod").value)) notes.push("存在しない日付（例：2月30日）は自動でスキップします。");
  if (conflicts.length) notes.push(\`既存予定と時間が重なるコピー先が\${new Set(conflicts.map(item => item.date)).size}日あります。\`);
  note.textContent = notes.join(" ");`,
`  const notes = [];
  if (result.truncated) notes.push(\`最大\${SCHEDULE_COPY_MAX}件を超えています。期間または間隔を調整してください。\`);
  if (result.dates.length >= SCHEDULE_COPY_LARGE_WARNING) notes.push(\`\${result.dates.length}件を一括作成します。内容と期間をもう一度確認してください。\`);
  if (["monthlyDay", "yearly"].includes($("scheduleCopyMethod").value)) notes.push("存在しない日付（例：2月30日）は自動でスキップします。");
  if (conflicts.length) notes.push(\`既存予定と時間が重なるコピー先が\${new Set(conflicts.map(item => item.date)).size}日あります。\`);
  note.textContent = notes.join(" ");
  note.dataset.level = result.dates.length >= SCHEDULE_COPY_LARGE_WARNING || conflicts.length ? "warning" : "info";`
  ],
  [
`  const conflicts = scheduleCopyConflicts(source, result.dates);
  if (conflicts.length) {
    const targetDates = [...new Set(conflicts.map(item => item.date))];
    const details = conflicts.slice(0, 5).map(item => \`・\${formatScheduleCopyDate(item.date)}：\${item.conflict.title}\`).join("\\
");
    if (!confirm(\`既存予定と時間が重なるコピー先が\${targetDates.length}日あります。\\
\\
\${details}\${conflicts.length > 5 ? \`\\
ほか\${conflicts.length - 5}件\` : ""}\\
\\
このままコピーしますか？\`)) return;
  }

  const copyResult = await copyScheduleOccurrences(source, result.dates);`,
`  const conflicts = scheduleCopyConflicts(source, result.dates);
  const largeCopy = result.dates.length >= SCHEDULE_COPY_LARGE_WARNING;
  if (conflicts.length || largeCopy) {
    const lines = [];
    if (largeCopy) lines.push(\`\${result.dates.length}件の予定を一括作成します。\`);
    if (conflicts.length) {
      const targetDates = [...new Set(conflicts.map(item => item.date))];
      lines.push(\`既存予定と時間が重なるコピー先が\${targetDates.length}日あります。\`);
      lines.push("");
      lines.push(...conflicts.slice(0, 5).map(item => \`・\${formatScheduleCopyDate(item.date)}：\${item.conflict.title}\`));
      if (conflicts.length > 5) lines.push(\`ほか\${conflicts.length - 5}件\`);
    }
    lines.push("", "作成内容と期間を確認しましたか？", "このままコピーしますか？");
    if (!confirm(lines.join("\\n"))) return;
  }

  const copyResult = await copyScheduleOccurrences(source, result.dates);`
  ]
]);

patch('index.html', [
  [
    '<div class="schedule-copy-preview-summary-row"><small>作成予定</small><strong id="scheduleCopyPreviewSummary">コピー先を指定してください</strong></div>\n        <div id="scheduleCopyPreviewDates" class="schedule-copy-preview-dates"></div><p id="scheduleCopyPreviewNote"></p>',
    '<div class="schedule-copy-preview-summary-row"><small>作成予定</small><strong id="scheduleCopyPreviewSummary" aria-live="polite">コピー先を指定してください</strong></div>\n        <div id="scheduleCopyPreviewDates" class="schedule-copy-preview-dates" aria-label="コピー先の日付"></div><p id="scheduleCopyPreviewNote" role="status" aria-live="polite"></p>'
  ]
]);

patch('ui-schedule-copy-v225.css', [
  [
    '.schedule-copy-preview p:empty{display:none}\n.schedule-copy-actions{margin-top:0}',
    '.schedule-copy-preview p:empty{display:none}\n.schedule-copy-preview p[data-level="warning"]{padding:9px 10px;border-radius:10px;background:#fff6df;color:#7a5410}\n.schedule-copy-actions{margin-top:0}'
  ]
]);

patch('release-manifest.js', [
  ['installFirstPaintGuardV226', 'installFirstPaintGuardV227'],
  ["const VERSION = '226';", "const VERSION = '227';"],
  ['wb-first-paint-v226', 'wb-first-paint-v227'],
  ['wb-first-paint-style-v226', 'wb-first-paint-style-v227'],
  ['__WB_LEGACY_ICON_OBSERVER_V226__', '__WB_LEGACY_ICON_OBSERVER_V227__'],
  ['version: "226"', 'version: "227"']
]);

patch('test-harness/version-source-v194.test.mjs', [
  ['Ver.226 manifest is the release-version source and stable is no longer active', 'Ver.227 manifest is the release-version source and stable is no longer active'],
  ['assert.match(manifest, /version:\\s*["\']226["\']/);', 'assert.match(manifest, /version:\\s*["\']227["\']/);'],
  ['assert.match(manifest, /const VERSION = ["\']226["\']/);', 'assert.match(manifest, /const VERSION = ["\']227["\']/);'],
  ['remains canonical in Ver.226', 'remains canonical in Ver.227']
]);

patch('tests/schedule-copy-v225.spec.mjs', [
  [
`test('one-date copy writes an independent schedule while preserving source time, duration and fields', async ({ page }) => {`,
`test('schedule copy warns on duplicate explicit dates and highlights large batches before write', async ({ page }) => {
  await boot(page); await openCopy(page);
  await selectMethod(page, 'dates');
  await setDate(page, '#scheduleCopyDateInput', '2026-10-05');
  await page.locator('#scheduleCopyAddDate').click();
  await page.locator('#scheduleCopyAddDate').click();
  await expect(page.locator('#toast')).toContainText('すでに追加されています');
  await expect(page.locator('#scheduleCopyDateList [data-remove-copy-date]')).toHaveCount(1);

  await selectMethod(page, 'daily');
  await page.locator('#scheduleCopyCount').fill('50');
  await expect(page.locator('#scheduleCopyPreviewSummary')).toHaveText('50件の予定を作成');
  await expect(page.locator('#scheduleCopyPreviewNote')).toContainText('50件を一括作成');
  await expect(page.locator('#scheduleCopyPreviewNote')).toHaveAttribute('data-level', 'warning');
  await expect(page.locator('#scheduleCopyPreviewSummary')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('#scheduleCopyPreviewNote')).toHaveAttribute('role', 'status');
});

test('one-date copy writes an independent schedule while preserving source time, duration and fields', async ({ page }) => {`
  ]
]);

console.log('Ver.227 schedule copy UX patch applied');
