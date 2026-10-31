# Modern v2 機能差分・製品化ゲート（Ver.568 権限移行候補の独立検証中）

**基準**：PR #460、Ver.556の差分監査（Ver.555の読取機能を基準。最新のコミット・CIの合否はGitHub Actionsで確認）。差分は現行コード・テスト・`modern/INTEGRATION.md`に基づく**実装監査**であり、実環境での全操作受入を意味しない。

## 用語と現況

- **Classic（現行の正本）**：`app.js`（タスク・ToDo・予定）、`work-features-v167.js`（共有業務メモ・予約開始日）、`workflow-v152.js`等（通知・アーカイブ・リマインダー）、共有保存リポジトリ群。正本データの読込/保存を所有する。
- **Modern独立モック**：`modern/preview/ui.js` と `demo-store.js`。5画面・12配色と見た目/操作感を検証する**架空データ専用**。表示上の保存や操作ができても実業務の同等性には数えない。
- **Modern製品候補**：`modern/product/`のVer.551〜555。5画面すべてClassicの既存正本から読み取り可能。Ver.557はToDoの完了/未完了切替を検証済み。Ver.558で同じ操作APIを追加・編集・削除・上下移動まで拡張してCI全5ジョブが合格。Ver.559のドラッグ並び替え・Classicタスク化の一括保存はCI #40996495517の5ジョブで初回合格。Ver.560はCI #40999206558の全5ジョブで合格。Ver.561ではさらに独立した検証フラグを揃えた場合だけ、既存のClassic詳細パネルと削除処理へ接続する。通常の`main`/製品ナビと実運用への接続は行わない。
- **結果**：画面数の観点では5/5の読取検証を実施済みだが、**正式利用に必要なCRUD・詳細操作・通知・設定・安全な切替は未完了**。「5/5」は機能完成率ではない。

## 機能差分一覧

凡例：**読取**=テストルーム限定でClassic正本を表示、**部分**=一部だけ確認、**未**=Modern製品候補に未実装。Classicは現行コードを根拠に「実装あり」と記すが、すべての実環境条件で保証されたことを意味しない。

| 領域 | Classicの現行機能（実装参照） | Modern製品候補 Ver.555 | 正式反映前の不足・最小受入条件 |
|---|---|---|---|
| 今日：業務概要 | 未完了・期限超過・今日・担当等（`app.js`の`renderSummary`/`renderTodayView`） | **読取＋テスト限定Classic導線（Ver.564 CI #41021448882合格）**。タスク詳細/一覧・個人ToDo詳細/一覧・予定編集/一覧・業務メモ一覧をClassicへ委譲。開いた時点ではデータ保存なし | Modern間の正式画面切替、未整理/余力タスク、通知・お知らせ集約、デザイン設定と公開権限は未実装 |
| 個人ToDo | 作成、完了/戻す、本文・メモ編集、削除、昇降/ドラッグ、タスク化、完了履歴（`app.js`, `todo-sync-v136.js`） | **読取＋テスト限定操作（Ver.559合格）**。Classicへ委譲してドラッグ/タスク化まで検証済み | 正式UI切替と本番権限・認証、実端末受入は未達。Emulatorの結果は本番セキュリティを保証しない |
| タスク一覧 | 一覧/ボード/タイムライン、検索・絞込、登録/変更/削除、ドラッグ、複数選択/一括変更（`app.js`） | **部分（Ver.561検証中）**。共有一覧/検索・絞込、Classicフォームで新規・編集・状態変更、Classic削除と詳細への導線を検証 | 一括変更・一覧ドラッグ・ボード/タイムライン切替は未接続。関連削除の警告・競合・PC/モバイル回帰、正式UI切替が必要 |
| タスク詳細 | チェックリスト、担当/優先度/期限/状態、コメント・返信、履歴、繰り返し、複製等（`app.js`） | **Classic詳細パネルへの導線（Ver.561検証中）**。既存の詳細・履歴・コメント表示をそのまま使用し、Modern独自の詳細UIは未実装 | Modern製品UIでの詳細・履歴、正式な画面復帰、繰返し・コメント等の同等性を段階的に検証 |
| タスク関連・高度操作 | 依存・関連、予約開始日、アーカイブ、重複統合、通知/リマインダー、競合制御（`work-features-v167.js`、`workflow-v152.js`、共通writer群） | **未** | データ保全、他端末同時変更、削除/復元、権限とオフライン動作を一貫して検証 |
| スケジュール表示 | 日/週/月、一覧・月カレンダー、担当・分類・場所・関連タスク（`app.js`） | **読取**。開始日基準で7日/今月、月カレンダー、担当/分類/検索 | 日付・時間帯・日跨ぎ/繰返し表示をClassicと差分照合 |
| スケジュール操作 | 作成、編集、削除、コピー、タスク化、通知/繰返し（`app.js`） | **テスト限定操作（Ver.562 CI合格）**。作成・編集・削除・繰り返しコピーはClassicのフォーム/既存CASに委譲 | 本番アクセス制御・通知/繰り返しの実端末確認・正式UI切替が未完了 |
| 共有業務メモ | 追加、更新、削除、固定、本文のクリップボードコピー、タスク化、利用者×端末の表示順、タグ/分類検索、長文スクロール（`work-features-v167.js`） | **読取＋テスト限定操作（Ver.563 CI合格）**.Classicの既存メモ正本へ追加・編集・削除・固定・コピー・タスク化・上下移動を委譲 | 全CI合格確認、実端末でのクリップボード/タスク引継ぎ受入、本番権限・正式切替が未完了 |
| お知らせ・履歴/受信箱 | 通知の生成・既読/未読、各種履歴（`workflow-v152.js`、`app.js`他） | **未**。今日画面に未接続と表示 | 正本通知の購読・既読操作、既読競合、通知内容と日時の統一を検証 |
| 表示設定 | Classicのレイアウト、利用者/ルーム選択。独立Modernモックは12配色・画面デザイン案を保有 | **テスト限定の表示設定（Ver.565 CI合格）**。既存`modern/preferences.mjs`を使い、利用者×ルーム×端末でClassic/Modern・12配色を保存。Modernの5つの既存検証フレームに限り適用 | **本番用切替ではない**。正式統合ナビ、業務操作の完全同等性、未保存編集の全ケース、認証/権限、実端末・切戻しの受入が必要 |
| 複数端末・アクセス | 既存のFirebase/ローカル動作と競合/通知の一部を共通層が管理 | **部分**。読取で単一ownerを再利用するが公開用の操作経路なし | 実Firebase Emulatorで同時更新、offline→online、権限・共有範囲、履歴、切戻しを試験。現在のFirebase Rulesは認証・閲覧権限の保証にならない |

## 安定化調査（Ver.555 → Ver.556）

- CI #1676で既存の`tests/workspace-personal-order-v531.spec.mjs`は、旧カードがDOMにあるのに並べ替えボタンが**不可視**のままクリック待機（45秒）で初回失敗。既存`tests/workspace-readability-v532.spec.mjs`は、メモへ移動したつもりが`body`に`today-mode`が残り、`work-memo-mode-v167`を確認できず初回失敗。どちらもリトライで成功。
- **確定できる事実**：見えていないメモ画面のDOMを「表示準備完了」と誤認し得る。単なる`WORK_BOARD_ASSETS_READY`と`[data-work-memo-layout]`のDOM存在だけでは、Classicとメモowner双方の読み取り準備や実際の画面切替は保証しない。
- **Ver.556初回修正**：メモfixtureを読み込む際、`WorkBoardReadV550.read().ready`と`WorkBoardBusinessMemoReadV555.read().ready`の両方を待ち、画面モード/可視性を確認してから操作する。skip・固定sleep・クリック再試行・タイムアウト拡大は追加しない。CI #1678ではProtocol・Firebase・Browser (1)が合格したが、**Browser (2)の再読込後ナビゲーションで初回/再試行とも失敗**したため、この修正だけでは不十分だった。
- **CI #1679での追加発見と上書き修正**：CI #1678トレースでは再読込後にナビボタンへのクリック自体は成功するが、`body`は`today-mode`のままだった。`work-features-v167.js`の**ボタン個別ハンドラーを撤去して単一のdocument委譲へ置換**したところ、CI #1679ではモバイルVer.308の2件と業務メモ再読込Ver.531の1件が失敗。既存`mobile-shell-v234.js`は`.nav`のバブル段階でactiveを読み即時タイトル更新するため、documentのバブル段階の変更では遅く、モバイルの同期契約を破った。**既存の委譲ハンドラー登録をwindow capture段階（`window.addEventListener('click', handler, true)`）へ直接置換**。これなら既存のモバイルバブル処理より前に`enterMemoMode()`が走り、再生成されたナビボタンも捕捉できる。旧個別ハンドラーは復活させず、同じ業務画面の入口を二重にしない。Ver.531のDOM置換回帰とVer.308の即時同期試験を維持し、次のCIで初回成功・リトライ0件の確認までPASSにしない。

- **CI #1682の実測結果**：Protocol、Firebase、Browser (1)は成功、Browser (2)は304テスト成功・1テスト失敗。Ver.531の業務メモ並び順テストは**再読込後の画面切替が初回/リトライ両方失敗**。Ver.532の長文メモ表示テストも一度失敗し、再試行で成功したため、安定化ゲートは不合格。
- **CI #1682のPlaywrightトレースによる切り分け**：再読込直後はデスクトップサイドバーが幅68pxで折りたたまれ、メモボタンへのクリック操作時にhover展開（幅276px）が発生。ポインタのクリック座標が展開前の配置（例：x=34, y=274）に基づく一方、展開後はボタン位置が移動していた。Playwrightはクリック完了と判定したが、メモ画面の遷移は発生しなかった。初回ナビゲーションやDOM置換単体では成功していることから、主因は**クリック直前のサイドバー幾何変化**と判断。すべてのブラウザ/操作での再現条件を断定するものではない。
- **既存テストを直接修正**：Ver.531とVer.532の既存Playwrightテストで、実際のサイドバーhover展開・属性`data-desktop-sidebar-state=expanded`・CSS幅276pxを確認してから、一度だけメモボタンをクリックする。固定sleep、タイムアウト延長、skip、クリックの再試行、機能ハンドラーの重複は追加しない。Ver.531は再読込後に正本readinessも再確認する。**修正後のCIが全ジョブ成功し、リトライ0件になるまでVer.556は未完了**。

- **Ver.556 最終合格：CI #40987175747**（HEAD `46936d3ed69b01db2d05c4767cb7129a84516e66`）。Protocol・Firebase・Browser (1)・Browser (2)・Regressionの5ジョブがすべて成功。Browser (1)は249 pass/56 skip（Emulator対象の意図的skip）、Browser (2)は305 pass。Firebase同時返信監査も初回成功し、全ジョブで失敗後リトライ合格は0件。CI成功はそのコミット時点の回帰結果であり、Ver.557の追加操作には別途CI合格が必要。

## Ver.557：個人ToDo操作の最小縦断（検証中）

- 既存`app.js`の`toggleTodo`→`commitTodoRecord`→`sharedWriteCoordinator`を**単一の書き込み経路**とする。Classicの`toggleTodo`は結果を返すだけの互換修正を行う。Modern専用のFirebase client、transaction、ローカル保存、購読は作らない。
- `WorkBoardTodoActionsV557.toggle`をlocalhost/127.0.0.1＋一致する`room=test-...`＋`modernReadV552=1`＋`modernWriteV557=1`＋2つの明示フラグ＋local-only/実demo Emulatorに限り公開。呼び出しごとにClassicの正本ready・選択利用者・ルーム・expectedRevision・期待状態を検証し、不一致を拒否。これは認証・アクセス制御ではない。
- `modern/product/todo-list-v552.mjs`の**既存描画とイベント処理を直接変更**し、テスト時だけ完了/戻すボタンを表示。保存成功後は既存のread projectionを再取得する。読み取り専用検証のUI・HTML文字列安全性・他利用者の非表示を維持し、未承認のCRUDをできるように見せない。
- 新規テストは個人/他人のデータ分離、1回の操作でrevisionが1増えること、完了日時と過去履歴、別ルーム・別利用者・古いrevisionの拒否、書き込みフラグ無しの読取維持、PC/モバイルの表示を対象とする。remote同時編集や全CRUDは**合格判定に含めず未完了**とする。
- このVer.557の変更はPR #460のDraftブランチ上の検証対象であり、CI合格・公開承認前に本番へ適用しない。


## Ver.558：個人ToDo CRUD・上下移動の単一owner接続（検証中）

- Ver.557で導入した`WorkBoardTodoActionsV557`を**直接拡張**し、別API/新しいFirebaseクライアントや保存層は作成しない。Classicの既存`createTodo`/`updateTodoDetails`/`deleteTodo`/`reorderTodo`/`toggleTodo`を引き続き唯一の書き込み経路とする。Classicの削除・上下移動は元の成功/失敗/キャンセルをModernへ返すために戻り値だけ補う。
- 追加の操作には`modernWriteV558=1`と`WORK_BOARD_TEST.modernWriteV558=true`が**両方**必要で、Ver.557の全条件（localhost、testルーム、demo Emulatorもしくはlocal-only）も維持する。Ver.557のみを有効にした場合は従来の完了切替のみ。公開環境はどちらも表示・利用できない。
- モダンの既存`todo-list-v552.mjs`を直接改修し、書き込みフラグ時だけ同じ画面に作成・編集・削除・上下移動を表示。入力は保存成功時に消し、失敗時は残す。別の利用者へ切り替わった際には、その利用者の画面へ他人の編集中内容を残さない。確認ダイアログはClassicの既存処理を一度だけ利用する。
- 初回保存前にルーム・利用者・正本ready・期待revisionと並び替え相手を再検証し、最終的なremote revision/ownerチェックはClassicの既存transactionが再実行する。タスク化とPCドラッグ操作は今回の対象外であり、上下ボタンが同等の最小操作となる。検索・絞り込み中は非表示行との順序を誤解しないよう、上下ボタンを非表示とする。
- Node Protocol、PC 1366px・スマホ390px、local-only操作、Firebase EmulatorのCRUDと2ブラウザ競合、従来Ver.552/557の読み取り/完了機能の回帰を追加。**CI全5ジョブ初回成功・リトライ0件**まではVer.558未完了・PR #460 Draft維持。

## Ver.559：個人ToDoドラッグと原子的タスク化（検証中）

- **旧処理の置換**：Classicの旧`persistTask`→`completePromotedTodoAfterTaskSave`という2回の書き込みを廃止し、`persistPromotedTaskV559`から既存の`transactionRoom`を呼ぶ単一RTDBルームトランザクションへ置換。ToDoのowner/id/revisionとタスクID未使用を同一commit内で照合し、片方だけ残る状態・同時二重タスク化を防ぐ。local-onlyの同じルーム状態にもToDo正本を含め、成功後だけタスク/ToDoの既存キャッシュへ反映。
- **既存フォームを維持**：Classicの`promoteTodo`と`saveTaskFromForm`を直接修正。Modernはテスト時だけそのClassicタスク入力フォームを開き、iframeを閉じる。タスク内容は引き継ぎ、送信失敗時は入力と文脈を保持。タスク作成と元ToDo完了の整合をModern独自writerでは実装しない。
- **ドラッグ**：既存Classic`moveTodoByDropV531`の単一トランザクションを再利用。Modernはドラッグ対象/並び順のrevisionを操作時に照合し、検索中はドラッグを隠す。マウス向けHTML5ドラッグのみ追加し、スマートフォン・キーボードは従来の上下ボタンを使う。
- **明示的テスト制限**：Ver.557+558の全条件に加えて`modernWriteV559=1`と`WORK_BOARD_TEST.modernWriteV559=true`の双方が必要。Classicのタスク化処理の一括書込への置換は同ブランチ全体に適用されるが、main/本番は未変更。
- **未達ゲート**：Protocolでwriter一元化/禁止HTML/旧二段処理の撤去、PCドラッグ・モバイル代替・誤操作拒否、local-onlyとFirebase Emulatorの一括確定・競合・別利用者保護・入力保持、従来全体回帰、リトライ0を確認する。ルーム全体トランザクションは認証・承認の代替ではなく、Firebase Rulesの正式安全性は別途未完了。

## Ver.560：Modernタスク一覧からClassicの基本操作への接続（CI #40999206558 合格）

- **保存処理の重複なし**：Classic `app.js`にテスト用 `WorkBoardTaskActionsV560`（`create`/`edit`/`status`/`statuses`）を設置するが、新たなタスクwriterではない。作成/編集は既存の`openTaskDialog`を開き、`saveTaskFromForm`・`persistTask`/`commitTaskDraft`へ委譲。状態変更は`changeStatus`、完了は既存の`completeTaskWithMemo`へ委譲し、履歴・繰返し・revision競合の既存挙動を維持。完了メモ取消時の戻り値のみ整理。
- **既存Modern画面を直接拡張**：`modern/product/task-list-v551.mjs`と`task-list-read-v551.html`の読み取り描画に、テスト時のみ新規作成・編集ボタンと行別の状態選択を追加。新規/編集時はClassicダイアログを表示して検証用iframeを閉じる。Modernの独立フォーム、Firebase接続、購読、ローカル保存を作らない。
- **全操作の事前検証**：localhost/127.0.0.1＋完全一致`test-`ルーム＋`modernReadV551=1`・`modernWriteV560=1`＋両方の`WORK_BOARD_TEST`フラグ＋local-onlyまたはdemo Emulatorを要求。API実行時に正本ready・接続元・ルーム・選択利用者・対象ID・expectedRevisionを再検証。状態はClassicに存在する選択肢に限定する。これは認証や本番アクセス権ではない。
- **検証条件**：PC/スマホ、作成/編集・状態遷移・完了メモ/取消、権限境界、既存Ver.551読取の完全維持、Firebase EmulatorのCRUD・複数ブラウザの競合・入力保持、Node Protocolと総合回帰の全5ジョブを初回合格、リトライ0件とする。
- **残る差分**：Modern独自のタスク詳細/削除/ドラッグ/一括操作、通知・履歴の完全同等性、正式UI切替、12配色、UID権限管理、実運用受入・切戻しは未完了。

## Ver.561：Modernタスク削除・Classic詳細への安全な接続（検証中）

- **単一ownerを直接拡張**：既存`WorkBoardTaskActionsV560`に`detail`と`remove`を追加。別の`WorkBoardTaskActionsV561`やModern独自writerを作らない。`modernWriteV561=1`と`WORK_BOARD_TEST.modernWriteV561=true`がVer.560の全条件とともに揃った場合のみ操作を公開する。
- **詳細導線**：同じルーム・利用者・snapshot revisionを照合してClassicの既存`selectTask`を呼び、Modernの検証用iframeを閉じる。履歴・コメント・チェックリスト・関連情報はClassic詳細パネルが引き続き担当。専用のModern詳細キャッシュや二重HTMLは追加しない。
- **削除導線**：Classicの`captureDeleteBase`でタスク・関連予定/ナレッジの正本を確認し、確認ダイアログの前後でルーム・利用者・revisionを照合。削除の実処理は`requestTaskDelete`→`deleteTaskV134`の既存経路に委譲し、競合時はClassicの競合確認ダイアログを表示する。成功/取消/通信失敗を区別してModernへ表示。新規トランザクション・削除リトライを追加しない。
- **既存コード整理**：`deleteTask`の`return deleteTaskV134(...)`以降に残っていた、実行されない旧二段削除コードを直接削除。Git履歴に保存し、別の旧実装を残さない。
- **重要な既存仕様**：Firebaseではまずタスク本体をCAS削除し、その後関連予定とナレッジを子レコード単位で整理する。後段の整理は完全な全件一括トランザクションではない。失敗した関連項目は`cleanupWarnings`として明示し、関連リンクに残存の可能性があるため手動確認を必要とする。本番データでの削除を認めるものではない。
- **検証ゲート**：Ver.560の閲覧・作成/編集・状態操作の回帰、Ver.561の確認取消・正当削除・関連解除・外部更新競合・利用者変更・PC/モバイル・XSS・Emulator保存・Protocol・全5CIジョブ初回成功を確認する。

## Ver.564：今日画面のClassic導線（CI #41021448882 最終合格）

- コミット `6bddf64348b2d76ceaaf44d1bd055ecd2df1c2ff`、[Actions #41021448882](https://github.com/mfukutomi8028-oss/task-kanri/actions/runs/41021448882)、**全5ジョブ初回成功**。当初の描画停止を既存画面コードへ修正し、タスク/ToDo/予定/メモのClassic詳細・一覧への遷移、未保存フォーム保持、ルーム/利用者/日付/revisionの失効時拒否を確認した。
- あくまでlocalhost/testルーム/明示フラグのClassic導線で、Modernの正式画面切替ではない。複数端末検証の安定化は既存テストを直接修正し、同じ業務処理を並走させない。

## Ver.565：Classic／Modern・12配色をテストルームで選択（CI #41025904186 全5ジョブ合格）

- **既存正本を使用**：`modern/preferences.mjs`の`readDisplayPreferences`/`writeDisplayPreferences`を唯一の設定正本とする。ユーザー×ルーム×端末のローカル保存だけを変更し、ClassicやFirebaseの業務データは書き換えない。Classic CSSへModern配色を上書きしない。
- **共有表示アダプター**：`modern/display-preview-v565.mjs`を追加し、検証用UIから既存の5フレームを切り替える。業務画面/保存処理/購読の2本目ではない。Modernの色はそのiframeの`data-palette`だけに適用する。
- **起動条件**：localhost/127.0.0.1、完全一致`test-`ルーム、`modernDisplayV565=1`と`WORK_BOARD_TEST.modernDisplayV565=true`に加えて全5画面の明示的な読み取りフラグ、local-onlyまたはdemo Emulatorを必要とする。`modernWriteV*`併用は禁止。これは本番認証・権限ではない。
- **入力保護**：Classicの開いたdialogと未保存クイック追加の文字列がある間は切替を拒否する。ModernからClassicへ戻る時には端末設定を更新し、iframeの閉鎖を検知して旧画面へ復帰する。ユーザー切替時は保存したユーザー別設定を再取得。
- **検証結果**：HEAD `4df6103fd55a02cbfdc0953242bc62da1a35bda6`、[CI #41025904186](https://github.com/mfukutomi8028-oss/task-kanri/actions/runs/41025904186) のProtocol／Firebase／Browser (1)／Browser (2)／Regressionが全5ジョブ初回成功・テストリトライ0件。Browser (1) 269件成功・83件意図的skip、Browser (2) 343件成功。12配色・5画面・PC/スマートフォン・個人別保存・再読込・入力保護を検証済み。
- **公開前に必要**：Modern 5画面の統合実装、Classicとの全機能・権限差分解消、通知・履歴・アーカイブ等の完全移植、未保存編集の多画面保護、正式ユーザー設定の導線、Firebase Rules/認証の安全性、切戻しと実運用受入。Draft PRのまま本番公開しない。

## Ver.566：Modern 5画面の起動処理を単一ルーターへ置換（CI #41030338482 全5ジョブ合格）

- **直接置換・重複削除**：`app.js` の旧`openModernReadOnlyTaskTestV551`／`TodoV552`／`ScheduleV553`／`TodayV554`／`MemoV555`の5関数を削除。1つの`openModernTestViewV566`に検証用iframeの生成・表示先・URLフラグ・ルーム・元データを集約。Ver.565側にあった別ルーター（画面別URLの追加／削除・iframe破棄）と、5画面のCSSセレクタ・表示名判定も撤去し、共通ルーターの`getFrame`・`getView`を参照。互換目的の旧関数ラッパーは残さない。
- **安全境界**：明示した`modernReadV551`～`555`のうち有効なURLフラグが**正確に1件**、対応する`WORK_BOARD_TEST`フラグ、localhost/127.0.0.1、一致する`test-`ルーム、local-onlyまたは明示Emulatorが必須。重複・未知のreadフラグは起動拒否。切替UIを経由する起動には従来のVer.565全条件を追加要求し、`modernWriteV*`を併用しない。
- **業務データ・デザイン非変更**：Classicのwriter／Firebase接続／通知／状態管理や既存5画面のHTML/CSSは変更せず、検証UIの読取専用と利用者別12配色を保持。正式公開用ナビゲーションへの変更ではない。
- **最終CI合格**：HEAD `b934f81e40c03ffbaac1c4b51100a8e952ae9068`、[Actions #41030338482](https://github.com/mfukutomi8028-oss/task-kanri/actions/runs/41030338482) はProtocol/Firebase/Browser (1)/Browser (2)/Regressionの全5ジョブ初回合格・リトライ0件。Browser (1)は269成功/83意図的skip、Browser (2)は347件成功。Ver.551～555の既存直接URL、5画面循環・同画面再選択・Classic復帰、無効なフラグの拒否、iframe重複禁止、旧関数なしを検証。
- **公開前に残る課題**：本番権限/認証、正式統合画面、残る詳細機能のClassic同等性、未保存入力の実端末受入、通知・履歴・データ保全・切戻し。Draft PR #460のまま`main`／公開環境へは反映しない。

## Ver.567：製品化に向けた機能差分・安全性ゲート監査（CI検証中）

**現時点の判定：正式公開は不可（NO-GO）**。5画面の読取、Classic既存操作への委譲、12配色、共通ルーターはテストルームで検証済み。ただし「CI合格」と「本番の権限・機能同等性・継続利用の保証」は別。認証やFirebase Rulesの適用状態を確認せず、`main`へのマージ・正式画面切替をしてはならない。

### 監査結果と解除条件

| 優先 | 項目 | リポジトリとテストで確認できたこと | 未完了・公開までの解除条件 |
| --- | --- | --- | --- |
| **P0・公開阻止** | 本人認証、ルーム別閲覧・編集権限、個人情報分離 | `firebase-rules.json`の`rooms/$roomId`は`.read:true/.write:true`であり**この定義が適用された場合はアクセス制限されない**。`firebase.json`は全許可の`database.rules.test.json`を指定。表示名・`?room`・テストフラグは本人認証でない。 | 実運用DBの適用Rules・Auth・実データ分類を管理者が確認。認証UID/所属/権限、個人ToDo/通知分離とroom-root更新の扱いを設計し、**拒否が基本**の別staging Rulesと実クライアントのAllow/Denyテストを実施。詳細は[Ver.449既存監査](../docs/FIREBASE_ACCESS_BOUNDARY_AUDIT_V449.md)を正本とする。 |
| **P0・公開阻止** | 正式画面とユーザー切替 | `app.js`の`openModernTestViewV566`はlocalhost・`test-`・明示フラグの検証用。製品ルーターでない。`release-manifest.js`に`modern/product`画面は未登録。 | 本番権限の確定後、Classic/Modern両方が同じ業務正本に接続する正式ルーティング、公開資産、画面復帰、切替/切戻し、権限とユーザー単位の設定を別途実装・受入。 |
| **P0・データ保全** | 書込・競合・欠損・オフライン | ModernのToDo/タスク/予定/メモはテスト時のみClassic既存writerに委譲し、Firebase Emulatorの限定ケースで競合・削除・再接続を確認。 | 実端末・stagingで複数利用者/ルーム、古いrevision・同時削除、通信切断/再接続、通知/関連データの整合、バックアップ復元・切戻しを正本件数/差分とともに検証。 |
| **P1・機能差分** | タスク高度操作・詳細、通知/履歴、アーカイブ | Modernのタスクには一覧一括操作・ボード/タイムライン等の未接続項目あり。「今日」のお知らせ/履歴は未接続。Classic詳細への導線はあるがModern独自の完全な詳細UIはない。 | 機能ごとにModernへ接続するか、Classicを明示的に開く暫定導線にするか決定。タスク一覧/詳細・コメント・通知既読・繰返し/リマインダー・関連・履歴・アーカイブを対照表で同等性確認。 |
| **P1・操作安全** | 未保存入力・表示設定・端末別復元 | Ver.565はClassicの開いた`dialog`とクイック追加文字列を検知する。12配色・5画面切替はブラウザCI合格。これは全画面の未保存編集を検知する仕組みではない。 | Classicの全てのインライン編集とModernの編集フォームについて、入力中の画面移動/利用者・ルーム変更/ブラウザ再読み込み/通信失敗/保存競合を調査して破棄防止・確認を実装。PC/モバイル・キーボード・スクリーンリーダーも受入。 |
| **P1・運用** | リリース・復元・実環境受入 | `.github/workflows/pages.yml`は`main` pushを公開対象にし、PR #460はDraft。CI合格は公開品質の必要条件だが十分条件ではない。 | 別staging、正本バックアップと復元テスト、切替対象の同意・公開手順・監視、旧クライアントの扱い、失敗時の復旧方針を定義。以前の全許可Rulesへの単純巻戻しを前提にしない。 |

### Ver.567で行う限定改修

- **直接読取の起動元検証を統一**：Ver.566共通ルーターは従来、`WORK_BOARD_TEST.emulator=true`だけでも通過し得たが、Ver.565プレビューは実際のデモEmulator URLも照合していた。双方から同一`isModernTestDataSourceV567`を呼び、local-onlyまたは`http://localhost/127.0.0.1:port/?ns=demo-...`形式のみを許可する。通常Firebase URLと`emulator:true`の組合せは拒否。
- **既存境界を維持**：Firebase SDK、Rules、認証、Classic writer、通知、公開HTML、`release-manifest.js`は変更しない。テスト経路の接続先判定のみ強化する。ブラウザで不正な接続先＋Emulatorフラグ、個別URL/プレビューの拒否を検証し、Node Protocolと既存5ジョブの回帰結果を確認する。
- **判定の意味**：今回の「監査完了」は公開許可ではない。P0項目がすべて解消され、本番環境の証拠とユーザー承認が揃うまでDraft維持。

## Ver.568：UID/ルーム権限・Rules移行の分離候補検証（CI判定待ち）

- **P0の安全移行工程**：Ver.567のNO-GOを維持。現行Classicのroom root transactionと個人ToDo/inboxの共有同居により、ルーム親にread/writeを許すだけのRules差替えは不可。詳細は[`docs/MODERN_AUTH_RULES_MIGRATION_V568.md`](../docs/MODERN_AUTH_RULES_MIGRATION_V568.md)。
- **今回の成果物**：既存Firebase接続・本番Rulesを触らず、`roomsV2`共有業務と`personalV2`のUID個人データ、管理者のみが維持するmembershipの最小候補Rulesを独立Emulatorで検証。匿名・他ルーム・自己昇格・親書込をdenyし、権限に応じた子操作のみallowする。旧開発用全許可Emulatorとは設定と実行を分離。
- **範囲外**：現行スキーマへの適用、Auth導入、旧クライアント、room全体transaction、通知配送、業務writer・UI統合、schema validation、実環境の適用Rules確認、復元試験・承認。本工程のCI成功は本番公開の許可ではなく、PRはDraft・main/Pages/本番DBは非変更。

## 次の実装優先順位と完了ゲート

| 優先 | 次の工程 | 守るべき条件 |
|---|---|---|
| P0 | Ver.556の安定化/現行機能差分の固定 | CI全5ジョブが成功し、**初回失敗→リトライ合格が0件**。現行Classicの変更・本番公開なし |
| P0 | 共有操作APIへの入口設計・単一ownerの明確化 | Classicのwriterと同じ保存/競合経路に委譲。旧関数/新関数を並走させず、置換する。各APIで未選択・同期不良・revision競合を検証 |
| P0 | 個人ToDo・タスクの基本CRUDと状態操作 | 既存データ形式・所有者・保存順・履歴を維持。Firebase Emulatorと複数端末同時更新で確認 |
| P0 | 予定・共有メモのCRUDと固定/並べ替え | 同じClassic正本を共有。保存/削除・競合・local-only・入力途中の保持を検証 |
| P1 | タスク詳細・通知・繰り返し・複製・一括操作・履歴 | Classicで使える主要操作をModernでも提供するか、正式な段階的Classic導線として明示・承認する |
| P1 | デザイン選択と未保存入力保護 | ユーザー単位でClassic/Modern・12配色を保存し、戻す操作が安全に使える |
| P1 | 最終回帰・表示品質・公開/切戻し | 対象SHAを固定した5ジョブ、12配色・PC/スマートフォン、データ継続性・ロールバック・公開後検査、正式公開の承認を確認 |

## 開発指針との整合

- **同じ機能を複数実装しない。** Ver.566で5つの旧検証用`openModernReadOnly*Test`を共通`openModernTestViewV566`へ置換して削除した。互換性は旧URLを共通ルーターへ通す形で維持し、旧関数や同等の分岐を別名で重ねない。正式製品のナビゲーション・権限制御は、検証用フラグを流用せず別途設計する。
- `modern/preview/demo-store.js`は意図して隔離したデザイン確認用資産であり、本番の業務処理正本として再利用しない。プレビュー残置の要否は製品化/配布監査時に判断する。
- `modern/INTEGRATION.md`は実装の経緯・境界を管理し、この表は**現時点の機能差分の正本**とする。今後は進捗をここで更新し、同じ比較表を複数ファイルへ積み増さない。
- この監査は置換計画の確定であり、未確認の実装を完了扱いにしない。公開判断はユーザー承認が必要。

関連資料：[`modern/INTEGRATION.md`](INTEGRATION.md)、[`modern/preferences.mjs`](preferences.mjs)、[`work-features-v167.js`](../work-features-v167.js)、[`app.js`](../app.js)。


## Ver.562：Modernスケジュール操作のClassic委譲（CI #41007074059 合格）

- **テスト限定**：`modernReadV553=1`と`modernWriteV562=1`、双方の`WORK_BOARD_TEST`真値、localhost/127.0.0.1、完全一致`test-`ルーム、local-onlyまたはdemo Emulatorのみ。公開環境では操作APIを生成しない。
- **単一owner**：`WorkBoardScheduleActionsV562`はClassic `app.js`の`openScheduleDialog`、`openScheduleCopyDialog`、`deleteSchedule`を呼ぶだけの検証用入口。Modernに独自Firebase書き込み、定期生成、通知購読を設置しない。
- **操作**：Modernの一覧から作成・編集・削除・繰り返し/コピー、月カレンダーから編集を開始。入力と保存はClassicフォーム、重複警告、関連タスクの選択と既存CASを使用。繰り返しはClassicの一括日付コピー仕様であり、タスク自動再生成とは別物。
- **競合対策**：Classicフォームの初期revision、利用者、ルームを開いた時点で保持し、保存・削除に用いる。最新購読revisionの上書き採用による古いフォームの誤保存を拒否。コピーについても開始時revisionと利用者を保持して確認後に再検査し、remoteでは既存collection transactionに委譲。確認をキャンセルした場合は保存しない。
- **通知**：Classicの既存schedule reminder watcherに委譲し、Modern独自タイマーは作らない。予定の繰り返しコピーに伴う通知の完全同等性は実機受入対象として残る。
- **最終検証済み**：HEAD `4dd2c857dd4d2d65fdee10e5512bb86659801d14` に対するCI [#41007074059](https://github.com/mfukutomi8028-oss/task-kanri/actions/runs/41007074059) は全5ジョブ初回成功・リトライ0件。Firebase Emulatorの予定操作7件合格、Browser (1) は262件、Browser (2) は326件合格。Draft PRを維持しmain/公開資産を変更しない。

## Ver.563：共有業務メモ操作のClassic単一owner接続（CI #41009035854 合格）

- **既存仕様を厳守**：本文コピーはクリップボードへのコピーで、メモ複製はしない。固定は共有レコードの`pinned`属性を書き換える。上下移動は`workBoardMemoOrderV531:room:user`に保存する個人・端末別の並び順のみ変更し、共有メモのrevisionや更新日時は変更しない。タスク化はClassicのタスク作成ダイアログへタイトル・本文・タグを引き継ぐが、メモ選択だけではタスクを保存しない。
- **単一owner・単一writer**：既存`work-features-v167.js`に検証専用`WorkBoardBusinessMemoActionsV563`を追加。Classicの`openMemoDialog`、`saveMemoFromForm`、`memoRepository.commit/remove`、`toggleMemoPin`、`copyMemo`、`createTaskFromMemo`、`moveMemoV531`を直接利用。Modernの`memo-list-v555.mjs`にはデータ保存、RTDB client、subscribe、二重メモキャッシュを追加しない。
- **既存コードを整理して競合を強化**：`workspace-memo-v539.js`の同一commit/remove経路に欠損済みレコードのrevision拒否とローカル削除CASを追加。Classicの編集・削除フォームの利用者/ルーム/開始時revisionを維持。削除確認の前後と最後のFirebase transactionで他端末による変更を拒否し、削除済みメモの古いフォーム保存による復活を防止。フィルタ中はModern側の並び替え操作を隠し、既存`moveMemoV531`に必要最小限の「Modernからの全件表示順」オプションだけ拡張する。
- **安全な実行条件**：localhost/127.0.0.1、完全一致の`test-`ルーム、`modernReadV555=1`/`modernWriteV563=1`両URL値と`WORK_BOARD_TEST`両真値、local-onlyまたは`demo-` Firebase Emulator。全操作でClassicとメモ正本のready・同期元・ルーム・利用者・必要なexpectedRevisionをチェック。これは本番の認証・権限保証ではない。
- **回帰ゲート**：Node Protocolで既存の共有メモwriter・順序の所有権・削除済みメモ復活拒否を検証。Playwright local-onlyで作成・編集・固定・順序・コピー・タスク引継ぎ・削除取消・未許可・古いrevisionの拒否、Firebase Emulatorで共同CRUD・2ブラウザ競合・削除・個人順序を検証。CI #41009035854（HEAD `7393a4879aa14d55102cda18e0251953f617a9bd`）で全5ジョブ初回合格・リトライ0件を確認してVer.563を完了。
- **正式公開前の残課題**：本番Firebase Rules/認証・利用者権限、正式なClassic/Modern切替・配色選択、実端末でのクリップボード可用性・タスク引継ぎ・未保存編集・切戻しの受入を別途必要とする。PR #460 Draft・main変更なし。

## Ver.564：Modern「今日」からClassic正本の既存画面へ移動（CI検証中）

- **設計**：ModernのToday一覧は従来どおり`WorkBoardReadV550`の一貫した正本projectionから読み取るだけ。テスト限定で`WorkBoardTodayNavigationV564`を`app.js`に登録し、Classicの`selectTask`、`openTodoWorkspace`、`openScheduleDialog`、タスク/予定一覧の既存`state.layout`＋`render`、業務メモsidecarの既存ナビを呼ぶ。別のModern iframeを重ねたり、独自の画面router・業務writer・Firebase購読/キャッシュを新設しない。
- **操作対象**：期限超過/本日期限タスクからClassic詳細（履歴・コメント・チェックリストを含む）、個人ToDoから本人の既存展開画面、当日予定からClassic編集フォーム、各カードの既存一覧（タスク/ToDo/予定）、未接続パネルからClassic業務メモ一覧。今日のModern自身にデータ書き込み/完了ボタンを設けない。
- **安全境界**：localhost/127.0.0.1＋`test-`ルーム＋`modernReadV554=1`/`modernNavigateV564=1`と対応する`WORK_BOARD_TEST`両真値＋local-only/正規`demo-` Emulator。開始前に正本ready、通信source、利用者、ルーム、表示日を再確認。行クリック時のID/expectedRevisionを正本と照合し、他端末の更新・対象消失/別利用者の個人ToDoを拒否。Classicでダイアログが開いていれば未保存入力保全のため移動しない。データは画面を開くだけでは保存されず、編集する場合は従来のClassic保存/競合処理だけで確定する。
- **表示・受入**：通常は閲覧専用でリンク/APIとも生成せず、検証フラグ時のみキーボード操作可能な詳細/一覧リンクを表示。PC/モバイル・不正HTMLのテキスト描画・他利用者のToDo非表示・エラー時のUI/データ維持・Firebase Emulator同時編集を回帰対象とする。全5CIジョブ初回合格・リトライ0件が最終合格条件。
- **残る本質的差分**：今回はModern間の製品内ルーティングではなく**Classicへの段階的ハンドオフ**。正式なClassic/Modernデザイン切替・12配色、画面復帰導線、通知/お知らせのModern読取、権限/認証・実端末/切戻し受入は別工程。PR #460 Draft、main/公開資産は未変更。
