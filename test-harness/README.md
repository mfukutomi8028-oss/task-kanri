# Protocol・Browser・Firebase テスト運用（Ver.466）

ここは開発・検証用ファイルです。本番のFirebase接続先、実データ、患者情報を使わずに検証してください。現行の実行コマンドの正本はルートの `package.json` です。

## 通常の検証

- `npm run test:protocol`：`package.json` の明示的な `node --test` 一覧を実行します。Firebase実接続は不要です。
- `npm run test:ui`：Playwright（Chromium）の画面・操作テストを実行します。CIでは2分割し、`test-harness/static-server.mjs` を使います。
- `npm run test:firebase`：`demo-task-kanri` のFirebase Realtime Database Emulatorでテストします。本番環境への接続・書込は行わないことが前提です。
- `npm test`：ProtocolとPlaywrightの実行です。Firebase Emulatorテストは別途実行します。

GitHub Actions `.github/workflows/regression-checks.yml` がProtocol、Browser 2系統、Firebase Emulatorを別々に実行し、最後のRegressionジョブで全件合格を必須とします。 `.github/workflows/pages.yml` は別の公開検証です。

## Ver.466：実行対象外テスト6件の整理

6件を調査し、次の5件を `test:protocol` へ正式登録しました。ファイル自体は保持し、ブラウザ回帰テストも従来どおり維持しています。

- `stable-today-retirement-v219.test.mjs`：Todayの担当者・共有ルーム判定と、旧stable資産の退役・固定アーカイブ契約。
- `user-reported-stability-v319.test.mjs`：通知アイコン・業務ボード表示・タスク詳細・文字体裁の回帰契約。
- `task-dialog-ui-v320.test.mjs`：タスク詳細のスコープ付きレイアウト、チェックボックス、コメント、画面テストとの整合。旧UX監査から今も有効な5条件を移管。
- `task-dialog-polish-v321.test.mjs`：Ver.321の詳細ダイアログ・タイトル・メンション・操作ボタンの契約。
- `ver321-doc.test.mjs`：`docs/ver321-task-dialog-polish.md` に残るRelease 279当時の記録とロールバック先。旧文書の削除は禁止。

`task-dialog-ux-v320.test.mjs` は退役しました。このファイルが要求していた `taskDialogUxVersion='320'` は、現行ではVer.321に置き換わっています。有効なスコープ・チェックリストの確認を `task-dialog-ui-v320.test.mjs` へ移し、コメント履歴と入力欄の4条件は同ファイルに既存の同等チェックがあるため重複を削除しました。原本はVer.465の検証済みコミット `6027a56c51dd03b8dc712a008656e9f911109e74` から復元できます。

テストの追加時は `test:protocol` への登録・Playwrightとの役割分担を確認し、実行対象外とする場合は理由を明記してください。現行実装の仕様を過去版の固定文字列へ戻してテストを通すことはしません。

## Ver.467：Ver.325監査テストの重複整理

旧 `final-runtime-inventory-v325.test.mjs` は、後続のVer.345・355で検査範囲が拡張されたため通常CIから外して物理削除しました。Ver.325の実行資産の列挙、重複排除、実在チェック、desktop/sidebarとmobile-shellの確認、イベント・タイマー種別の集計、Releaseと責務台帳の同期検証は、`final-runtime-inventory-v345.test.mjs` および `final-runtime-inventory-v355.test.mjs` に引き継がれています。Ver.345・355の固有のイベント解放・監視範囲・非ポーリング検証は引き続き実行します。

旧Ver.325固有の全資産単位のログ出力はなくなりますが、後続テストは全実行資産の存在を検証し、イベントを持つ所有者と合計値を出力します。旧版のテスト原本と出力形式は、Ver.466確定コミット `6ccf9440967f114b39be8e7efe11366b91884a74` から取得できます。製品コード・Release304・既存Browser/Firebaseテストは変更していません。
