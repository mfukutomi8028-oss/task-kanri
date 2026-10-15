# Protocol・Browser・Firebase テスト運用（Ver.473）

ここは開発・検証用ファイルです。本番のFirebase接続先、実データ、患者情報を使わずに検証してください。現行の実行コマンドの正本はルートの `package.json` です。

## 通常の検証

- `npm run test:protocol`：`test-harness/run-protocol.mjs` が直下の `*.test.mjs` を自動検出し、Node標準テストランナーへ引き渡します。Firebase実接続は不要です。
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

旧 `final-runtime-inventory-v325.test.mjs` は、後続のVer.345・355で検査範囲が拡張されたため通常CIから外して物理削除しました。Ver.325の実行資産の列挙、重複排除、実在チェック、desktop/sidebarとmobile-shellの確認、イベント・タイマー種別の集計、Releaseと責務台帳の同期検証は、`final-runtime-inventory-v345.test.mjs` および `final-runtime-inventory-v355.test.mjs` に引き継がれています。Ver.345・355の固有のイベント解放・監視範囲・非ポーリング検証は、Ver.468以降は統合先のVer.355で引き続き実行します。

旧Ver.325固有の全資産単位のログ出力はなくなりますが、後続テストは全実行資産の存在を検証し、イベントを持つ所有者と合計値を出力します。旧版のテスト原本と出力形式は、Ver.466確定コミット `6ccf9440967f114b39be8e7efe11366b91884a74` から取得できます。製品コード・Release304・既存Browser/Firebaseテストは変更していません。

## Ver.468：Ver.345とVer.355のランタイム監査統合

重複する全実行資産の列挙、manifest配列解析、監視・タイマー集計、Releaseと責務台帳の整合性確認を `final-runtime-inventory-v355.test.mjs` に一本化しました。旧 `final-runtime-inventory-v345.test.mjs` は物理削除し、`test:protocol` の登録から外しています。

旧Ver.345固有の監査2件（list-column-sort、comment-mentions、desktop-sidebar、mobile-shell、work-featuresの長寿命イベント境界、およびcomment-reactionsのキーボード/observerスコープ）は、**元のアサーションをそのまま** Ver.355側へ移管しました。実行時資産5件の明示的な存在契約と、各資産のバイト数計測も維持しています。重複していた資産再棚卸し1件とRelease同期確認1件は、より厳しいVer.355の確認で代替しています。ブラウザ用の `tests/final-runtime-wakeup-inventory-v355.spec.mjs` と既存のFirebase Emulator検証には変更ありません。

旧版テストの原本は確定Ver.467 `38126fe1590ede24f1f1fe465e866cfacbf9487f` の [固定Git参照](https://github.com/mfukutomi8028-oss/task-kanri/blob/38126fe1590ede24f1f1fe465e866cfacbf9487f/test-harness/final-runtime-inventory-v345.test.mjs) で復元できます。新規依存ファイル・製品コード変更・Release番号更新はありません。

## Ver.469：小規模監査テストの所有元統合

- `version-display-style-order-v232.test.mjs` の1テストを `version-display-consolidation-v232.test.mjs` に移管しました。元の3つのassert（表示CSSの現役登録、日付コントロールCSSより後、TODO表示CSSより前）を維持し、既存のmanifest解析関数を共用します。
- `ver321-doc.test.mjs` の1テストを `task-dialog-polish-v321.test.mjs` に移管しました。歴史文書 `docs/ver321-task-dialog-polish.md` のRelease279と復旧ブランチ記録を引き続き検証します。文書は削除しません。
- 上記2ファイルを現行Git treeから削除し、`package.json` のProtocol指定のみ更新しました。残存126件の `test-harness/*.test.mjs` は全件Protocol登録を維持。skip・閾値緩和・新規helperはありません。
- 元ファイルはVer.468確定main `a31deeb00afb9a4fedbb72a525af80fd5059bee5` のGit履歴から復旧可能です。Release304、製品JS/CSS、Firebase認証・Rules、Browser/Firebase、Pages配布は変更していません。

## Ver.470：Ver.231/243旧単独Protocol監査を責務別ファイルへ統合

- `version-display-ownership-v231.test.mjs` の3テスト中、現役の2テストをassertionを変えずに `version-display-consolidation-v232.test.mjs` へ移しました。旧URLの固定Git blob、旧JavaScript内のバージョン復帰処理、起動時のVer.143フォールバック確認を含みます。残りの旧Release<=231分岐は、同じファイルのRelease>=234契約から現在到達せず、その実行される側のmanifest除外・config復帰検証は既にVer.232で保持しています。
- `bulk-actions-runtime-v243.test.mjs` のNode構文検査・現行ファイル存在・旧URL互換の1テストを、assertionのまま `bulk-actions-boundary-v243.test.mjs` へ移管しました。旧Ver.174ソースの復元可能性・固定blob検査は既存境界テストでも保持します。
- 上記2ファイルを現行treeから物理削除し、`package.json` のProtocol指定を更新しました。残存124件の `test-harness/*.test.mjs` は全件登録。新規依存・skip・閾値変更・製品runtime/Release304/Firebase/Pages/旧キャッシュ資産の変更はありません。
- 元原本はVer.469 main `b0d53dc34757fbdb52b21bc9208196203d978822` の履歴から復元できます。Ver.469のmain同SHA回帰・Pages受入が完了するまで、本PRはDraftのまま正式統合しません。

## Ver.471：ブランド初期化・favicon監査テストの統合

- Ver.280単独テスト `brand-bootstrap-v280.test.mjs` のうち現行でも固有の3件（旧config favicon注入の禁止、brand起動・復旧責務、責務台帳）を、後継の `brand-dataset-idempotency-v286.test.mjs` へassertionを変更せず移管しました。
- Ver.282単独テスト `brand-immediate-v282.test.mjs` の固有4件（apply内でのfavicon処理1回化、loader→apply、pageshow/Notification共存、責務台帳）も、同じ後継テストへassertionを変更せず移管しました。
- 旧リリース263/264以上かつbaseline一致の2条件は、より厳しい後継Release266以上/baseline一致の現行検証に包含されるため、重複分のみ退役。3ファイル計13ケース→後継1ファイル11ケースとなります。旧起動/通知コードの静的互換性とBFCache idempotencyは引き続き検証します。
- `package.json`のProtocol登録124→122件、Git現行treeの対象122テスト全件登録。旧単独ファイル2件は物理削除し、元原本はVer.470 main `d168e87d05b512f769beb1b2a5e656af50cde323` の履歴に保持します。
- Release304・製品JS/CSS/HTML・manifest・Firebase認証/Rules/保存モデル・Pages配布と旧キャッシュ資産は変更せず、テストskip・タイムアウト緩和や新規依存は導入しません。Ver.470のmain同SHA回帰・Pages受入完了まではPRをDraftで保持します。

## Ver.472：ブランドライフサイクルとBFCache監査を後継Ver.286へ集約

- `brand-lifecycle-v272.test.mjs` の6件（うちRelease259以上とbaseline文字列の厳密な同値確認を含む）を元のアサーションを変更せず `brand-dataset-idempotency-v286.test.mjs` へ移管。旧HTMLのVer.143 favicon/通知フォールバック、icon set検査、Notificationの再適用防止、release-script読込順、旧config修復禁止を保持します。
- `brand-pageshow-coldboot-v284.test.mjs` の5件中、固有の4件を元のアサーションを変更せず移管。残り1件はRelease265以上かつbaseline一致で、後継のRelease266以上/baseline一致と重複するため一本化しました。
- `BRAND_PAGESHOW_COLD_BOOT_AUDIT_V284.md` は当時のpersisted-only判断根拠を保存するため削除せず、移管先テストからの読込を維持します。
- 旧2ファイルをGit現行treeから物理削除し、`package.json` のProtocol登録を122→120ファイルに更新。3ファイル合計22ケース→統合後21ケース（削減は重複の下限チェック1件のみ）。新規依存・skip・検証閾値緩和は行いません。
- 元原本はVer.471 main `9393a1034efea4de782881de43179f8c874acaaa` から復元できます。Release304、製品JS/CSS/HTML、Firebase/Auth/Rules/保存処理、Pages配布・旧キャッシュ互換、Browser/Firebaseテストは変更しません。Ver.471 mainのRegressionとPagesが成功し専用checkpointを検証するまで、PRはDraftを維持します。

## Ver.473：Protocolテスト登録を自動検出化

- 以前の `package.json` では120ファイルを長い `node --test` コマンドへ直接列挙していました。Ver.472 main `059fc49ef05a5d92103d597a06cf46736208d206` の現存直下120ファイルと登録120ファイルが完全一致することを確認したうえで、`npm run test:protocol` を `node test-harness/run-protocol.mjs` に置換しました。
- 専用runnerは `test-harness/` 直下の `*.test.mjs` **だけ**を読み、ファイル名順にNodeの `--test` に配列引数として渡します。シェルのワイルドカード展開を使わず、Windows/CI間で同じ対象が選ばれます。0件・読み込み失敗・Node起動失敗・子プロセスの非0終了は合格扱いにしません。
- `test-harness/release-contract.test.mjs` にfixtureの除外/整列/異常系、現行全件自動登録、保護すべき主要テストの存在検査を追加しました。今後の直下Protocolテストの追加・削除に、`package.json` の手動列挙編集は不要です。Playwrightの `tests/*.spec.mjs`、Firebase Emulatorテストは従来どおり独立実行します。
- 変更対象は開発用runner、Protocol実行コマンド、既存検証契約、運用文書のみ。製品JS/CSS/HTML・Release304・GitHub Pages配布・Firebase/Auth/Rules・利用者データ・旧URL互換資産は変更しません。PR全5ジョブsuccess→expected-head merge→main同SHAのRegression/Pages成功→checkpoint照合を必須とします。
