# Ver.398候補：旧PR #82・#83の予定コピーUXを現行版へ再統合

起点：Ver.397 main `e0db50a47456debfcd074e34d7e9e08b343c00ec`、Release304維持。

## 背景と採用判断

長期未マージのPR #82は予定コピーの全日付表示・重複予定詳細・戻り先表記、PR #83は日付重複入力時の通知・50件以上コピーの注意喚起・読み上げ属性を提案した。両PRは共通の `app.js` / `index.html` / UI CSSを変更しており、古いPRをそのまま重複マージすると現行の予定保存・同期経路を破壊しかねない。

今回は**現行版のプレビュー表示関数と入力ガードだけ**へ両提案を取り込む。保存処理やコピー日付生成のアルゴリズムは変更しない。

## 実装範囲

- 生成される日付は通常先頭8件を表示し、9件以上なら「すべての日付を確認（N件）」から全件を展開
- 他の予定と時間帯が重なるコピー先に「重複」の目印を付け、該当日と重なる予定名を展開。**従来の最終確認ダイアログは残す**
- 既に追加された日付は重複追加せず「この日付はすでに追加されています」を通知
- 50件以上は内容と期間を確認する注意文を出し、同時に重複候補があれば双方を説明
- 作成件数と注意文の読み上げ属性 `aria-live="polite"` / `role="status"`、注意文のdata-level、390px向けCSS
- 戻りボタンを「予定詳細へ戻る」とし、戻り先の認識を合わせる

## 不変条件と検証

**変更なし**：現役 `copyScheduleOccurrences()`、`submitScheduleCopy()` のFirebase writer/トランザクション、既存予定リビジョン保護、コピー最大200件、スケジュール以外のアプリ、Firebase Authentication/Rules、`release-manifest.js`（Release304）。

従来の `tests/schedule-copy-v225.spec.mjs` に、生成日12件の展開、重複日の確認と従来confirmの中止、入力日付重複の抑止と50件警告を追加。既存Playwrightのコピー実書込とFirebase Emulatorの予定コピー回帰を維持する。現行ソースの一部分のみを再構成し、旧PR全体は直接マージしない。

## 完了条件・リスク

本PRは準備段階の独立ブランチで、Ver.397 mainの同SHA Regression/Pages/復旧checkpoint完了後にDraft PRとして評価する。現行mainと完全に同期し、Protocol/Browser/Firebase/最終Regressionの4ジョブ全success、mainへexpected-head merge、main同SHA Regression/Pages成功、復旧checkpointを通るまで正式完了としない。

注意：予定コピーの作成数や重複マークはあくまで**プレビュー時のスナップショット**で、共同編集中に他者が予定を追加し得る。現在の最終確認・実際の保存動作を置換するものではない。患者情報・要配慮個人情報を使わず、テストは合成データで行う。
