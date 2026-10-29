# モダン v2：製品実装に向けた分離境界

状態：**独立Modernモックは架空データのまま。Ver.551タスク・Ver.552個人ToDo・Ver.553予定・Ver.554今日・Ver.555共有業務メモの5画面をlocalhostの明示的テストルーム限定で読み取り専用接続。通常製品画面・main公開・正式デザイン切替は未実施。**

## 今回固定したもの

- 承認されたv2モックの画面レイアウトと12配色。`modern/layout.css` が構造、`modern/palettes.css` が配色の正本。
- `modern/preview/` は架空データで動く独立操作モック。旧CSS、旧app.js、Firebase設定を一切読み込まない。
- SVGはルートの既存`assets/`を参照。画像の複製や全アプリの再実装をしない。
- `modern/preferences.mjs` は製品接続用の表示設定の小さな純粋モジュール。クラシックとモダンの切替と12配色を**別値**として保持し、ルーム×選択利用者×端末にスコープを限定。読み込みだけでは書込を行わず、未知値はクラシック・インクに戻す。保存にはユーザーの明示操作を要する。

## 製品での適用条件

1. ClassicのHTML、CSS、`app.js`、`release-manifest.js`、`config.js`にはこの段階で変更を加えない。
2. `modern/preview` の`demo-store.js`を本番データに向けて動作させることは**禁止**。モックは業務機能の完全互換を提供しない。
3. 正式な共通操作層には、タスク・ToDo・予定・メモのCRUDだけでなく、チェックリスト、コメント返信・リアクション、履歴、依存・関連、繰り返し、通知、設定、権限境界、競合・削除・オフライン同期を含める。
4. 旧app.jsには描画と業務操作が混在している。保存・Firebase購読・同期管理を専用共通層へ段階抽出し、**ClassicとModernが同時に購読・書込しない**ことをテストで確認してから製品切替を接続する。
5. モダンの見た目をClassic上へCSSで上書きする方式は不採用。Classicは現行コードの見た目そのまま維持。
6. 既存業務項目の順序・データは共通。画面パネルの表示順・密度はデザインごとの設定に分離。
7. デザイン切替は未保存の編集内容を検出して確認した後に行い、ルームID・利用者選択・戻り先の意図を維持する。表示設定で権限を代替しない。
8. 現在の本番Firebase Rulesは認証・閲覧権限を強制していない。UI統合により機密データの保存を正当化してはならない。

## 段階別の完了ゲート

| 工程 | 完了条件 | 現在 |
|---|---|---|
| ① モダンv2原本を独立ソースとして保全 | 12配色・5画面のデモが独立起動、Classic影響なし、静的テスト成功 | このPRで検証 |
| ② 業務操作の共通API切り出し | 保存・同期・競合・履歴とテストをClassicで先に通す | Ver.537〜549で主要な読み取り・書き込み所有者を段階的に抽出。Ver.550でClassicの正本から読み取る最小・読み取り専用APIを追加。全CRUD等の分離は引き続き未完了 |
| ③ Modern画面への実データ・全機能接続 | 全画面で実機能と同等の操作、旧CSSの混入0、モックとの差分検証 | Ver.551–555で5画面をlocalhost/testルーム/明示フラグ限定で読取専用接続。通常製品UI・お知らせ・CRUD・モック差分・全機能同等性は未完了 |
| ④ デザイン切替・配色を製品設定へ接続 | 利用者×ルーム別保存、未保存入力保護、Classic回帰、12配色×PC/モバイル検証 | 未実施 |
| ⑤ 本番公開 | 同一コミットの全体回帰・Firebase Emulator・表示レビュー・公開後検査 | 未実施 |

現段階では①と②の一部、および③の読み取り専用テスト画面に限る。独立モックの操作や局所的な実データ表示を、製品の全機能同等性・デザイン切替の完成と混同しない。

## ②-1 共通読み取りセレクター（先行抽出）

- `workspace-core-v537.js`は画面・Firebaseへ依存しない純粋モジュール。既存`todo-sync-v136.js`と同じToDo正規化・順序を利用する。
- Classicの`renderSummary()`と`visibleTodos()`を、このセレクター呼出しへ変更。従来の状態判定・担当者グループ判定・ローカル日付パーサーはClassicから引き渡し、計算結果の意味を変えない。
- Modernへは将来、認可済みの単一データ所有者から同じセレクターを提供する。**現段階でModernの表示・実データ接続は行わない。**
- 読み取り専用の計算以外を追加せず、Firebase購読・データ保存・トランザクション・競合検出・通知は一切変更しない。
- 新しい静的import資産を`release-manifest.js`のrequiredAssetsへ登録する。動的ローダーの順序は変更しない。
- CRUD等の操作移管、未保存編集のデザイン切替、実データのModern描画は次の独立した段階とする。

## ②-2 書き込み制御の共有（Ver.538、今回）

- `workspace-write-v538.js` は **1つのinFlightOperations Mapと既存の実保存処理**を受け取る書き込み制御。FirebaseやDOM、ストレージ、別の購読は新設しない。
- `executeWrite` の20呼出箇所をすべて共通コーディネーターへ委譲。操作ID、同時操作の排他、接続モードごとの拒否、エラー分類（権限／通信／競合）、成功・失敗の戻り値を従来どおり維持する。
- 保存・トランザクション・revision・削除同期・履歴・コメント処理、画面を操作不能にするUI、ToDo再描画は **Classic既存コードの責務のまま**。新モジュールは書き込みの実装をもう1本作らない。
- 明示的な依存注入を採用し、Modern接続時も同じコーディネーターを **単一のデータ所有者経由**で利用する。モダンの架空データモックを製品データへ向けるのは禁止。
- `test-harness/workspace-write-v538.test.mjs` で、成功・同一操作の二重送信防止・別操作の独立性・読込中拒否・競合・権限・通信エラーの状態遷移・ロック解除を検証する。
- `release-manifest.js`のrequiredAssetsに静的import資産を登録。旧CSS・クラシックレイアウト、配色、デザイン切替は変更しない。

次工程：モダン向け業務操作ファサードの設計と、task/ToDo/schedule/memo各操作の契約・実Firebase Emulatorでの同等性確認を先行する。全機能・未保存フォーム保護が確認できるまで公開しない。

## ②-3 業務メモの保存部分の分離（Ver.539）

- `workspace-memo-v539.js` は既存サイドカーの `commitMemo` と削除トランザクションを、依存注入方式の共通リポジトリへ移したもの。`work-features-v167.js`が**唯一のメモ購読・ローカルキャッシュ・UI所有者**である点は変更しない。
- 既存のrevision判定、Firebaseパス `rooms/{roomId}/businessMemos/{id}`、ローカル保存キー、描画更新回数、失敗時の返り値を維持。新しいFirebase接続／購読／ユーザー設定の変更はない。
- `config.js` の既存の逐次スクリプト読込規則を利用し、`release-manifest.js`の必須資産・動的スクリプトの両方で、**共通リポジトリ→既存サイドカー**の順に登録する。
- `test-harness/workspace-memo-v539.test.mjs`で新規・更新・固定・ローカル削除・remote競合・remote削除・購読を増やさないこと・読込順を確認する。
- 画面操作・HTML・Classic CSSは変更しない。Modernのデモにはこのリポジトリも実データも接続せず、完全な製品化とは扱わない。
- 既存サイドカーのメモ以外（タスク開始日等）は別工程。リマインダー・通知・ユーザー登録・一括操作の競合保護も後続で監査する。

## ②-4 アーカイブの書き込み分離（Ver.540）

- `workspace-archive-v540.js`へアーカイブ保存／復元の正規化・expected-base照合・Firebase child transaction・競合時のremote winnerへの回復・通信エラー時のローカル復元を移管。
- `workflow-v152.js`が唯一の`workflowV152`購読・ローカルキャッシュ・イベント通知を保持し、新リポジトリはFirebase購読・DOM・storage・権限設定を増やさない。
- `workflow-v152.js`の`archiveTask`/`unarchiveTask`公開API、引数の明示的expected値の扱い、戻り値、既存のremote未接続時の互換動作を維持。`duplicate-merge-v182.js`のroom root transactionは未変更。
- `release-manifest.js`へrequiredとdynamic両方に追加し、`workspace-archive-v540.js`を`workflow-v152.js`の直前に読み込む。
- `patch-responsibilities.json`の`workflow-and-detail`に新しい保存正本を登録。既存のVer.246監査は新モジュールへの委譲・新側の`runTransaction`・expected-base・conflictを照合するよう更新する。
- 独立テストでローカル保存・復元、リモート競合拒否・最新勝者の保全・正常復元、通信失敗、購読・二重保存の不在を確認し、既存Firebase Emulatorによる実UI経由の競合テストを継続する。
- モダンモックの実データ接続は引き続き未実施。リマインダー・通知既読は個別の競合条件を持つため別の小さな工程で移管する。

## ②-5 リマインダーの保存・解除の分離（Ver.541）

- `workspace-reminder-v541.js`へ従来のリマインダー正規化、expected-base比較、`workflowV148/reminders/{user}/{taskId}`のchild transaction、競合時のremote winner復元を分離。
- `workflow-v152.js`は唯一の`Base.workflow.reminders`ローカルキャッシュとイベント通知を管理。新モジュールはFirebase接続・購読、localStorage、DOM、別の保存モデルを作らない。
- 既存`writeReminder(taskId, item, user=currentUser(), expectedReminder)`公開APIと、4引数を明示した場合のexpected値扱い（未指定時にはローカルの表示済み値）を維持。`Base.ensureRemote`/`Base.dependencyState`をそのまま利用し、失敗通知・ローカル巻戻し・local-only挙動を変更しない。
- `workflow-v152.js`を無効化した場合の`workflow-core-v150.js`のfallback writerはそのまま残す。画面は従来の`W.writeReminder`から呼び出す。
- requiredAssetsとdynamicScriptsに`workspace-reminder-v541.js`を`workflow-v152.js`の直前として追加。責務台帳を更新。
- Ver.245の既存Protocol/Browser検証は新モジュールの実transaction・expected compareを確認するよう更新し、実Firebase Emulatorでの古いexpected値による保存/解除の拒否を継続検証する。
- 未完了：通知既読、通知生成、重複統合などのwriter移管、およびModernの本番実データ接続・表示選択。これらは検証後に別工程で進める。

## ②-6 通知既読・未読切替の書込責務の分離（Ver.542）

- `workspace-inbox-read-v542.js`へ個別既読のexpected readAt照合・Firebase child transaction・cold-cache null probe・競合時のremote winner復元・失敗時の巻戻しを移管。
- `workflow-v152.js`は唯一のinbox購読・キャッシュ・イベント通知・通知生成の冪等性を保持。新モジュールはFirebase初期化・購読、localStorage、DOM、追加リスナーを作らない。
- 既存`markInboxRead(eventId,read=true,user=currentUser(),expectedReadAt)`公開API、4番目の明示的expected値、保存先`rooms/{roomId}/workflowV152/inbox/{user}/{eventId}`、戻り値と日本語エラーを維持。
- **`markAllInboxRead()`は移動せず、クリック時の未読ID集合・expectedReadAtを同期的に固定して個別既読APIへ渡す**。クリック後の新着通知を自動既読にしない。
- 既存Ver.247 ProtocolとFirebase Emulatorの新着・既読競合試験を継続し、実装抽出後の新writer内のCAS・cold-probe・conflictを検証する。
- requiredAssets/dynamicScripts双方でv152の直前に読み込み、patch責務台帳へ登録。Classic表示・業務データ・Firebaseルール、Modernの配色は変更しない。
- 未完了：通知生成writer、重複統合・一括操作・ユーザー登録等、およびModern本番実データ接続と表示切替。

## ②-7 通知イベントの保存・重複防止の分離（Ver.543）

- `workspace-inbox-event-v543.js`へ通知のレコード正規化・上限・イベントIDからの子パス生成と、Firebase側の`current||item` first-write-wins transactionを移管。既存のイベントID生成方式は変更せず、同じIDを再送しても既存本文・actor・createdAt・readAtを上書きしない。
- `workflow-v152.js`の既存`writeInboxEvent(recipient,eventId,event)` APIは同じ。**このサイドカーが引き続き唯一のinbox購読・ローカルキャッシュ・イベント通知の所有者**で、ID sanitizationと`emit()`、初回イベントのみローカル保存、重複時もイベント通知の既存挙動を担当する。
- `inbox-events-v183.js`の決定的ID、再接続時のdurable pending、room別／event別のローカルキュー、成功時のみ削除の仕組みをそのまま維持。新しい書込APIの失敗は従来どおり`ok:false`で通知生成側へ戻す。
- `release-manifest.js`のrequiredAssetsとdynamicScriptsでv152直前に登録。`patch-responsibilities.json`へ責務移管を記録。Classic CSS/HTMLとFirebaseルール、既存データスキーマは変更しない。
- 専用Nodeテストで同一IDのローカル/リモートfirst-write-wins、既読状態非初期化、ユーザー別分離、通信失敗、再送成功を検証。Ver.247/250/260の契約監査とFirebase Emulatorの複数端末通知冪等性テストを新ownerに対応させ、元の厳密な意味を維持する。
- モダンの実業務データへの接続・画面切替は未実施。次は重複統合などの残存writerを単一ownerから利用可能にする。

## ②-8 重複タスク統合：room単位の原子的保存責務の分離（Ver.544）

- `workspace-duplicate-atomic-v544.js`へ元・統合先タスクのデータ統合アルゴリズムと、`rooms/{roomId}`の単一Firebase transaction（2件のtasksとworkflowV152/duplicates・archives）の更新を抽出。
- Ver.246以来の**元／統合先revision期待値、重複統合済み・アーカイブ済み拒否、初回cold-null probe、committed snapshotのrevisionとworkflow結果確認**を変更せず維持。別端末に先行更新がある場合、対象のremote winnerを上書きしない。
- `duplicate-merge-v182.js`には前提関係検査・ユーザー確認ダイアログ・画面UI・既存キャッシュ更新・後続relationとreminder整理を残す。共通モジュールはDOM、確認UI、購読、localStorage、別の業務データキャッシュを持たない。
- **注意：relationとreminderの既存の後続整理はroom root transactionの外で行われる。** 今回それらを原子的更新だと誤認せず、元からの非原子的後処理を変えない。後工程で整合性・再試行・失敗表示を別途監査する。
- requiredAssetsとdynamicScriptsの両方で共通モジュールを`duplicate-merge-v182.js`より前に一度だけ読み込む。Ver.246 Protocol/Browser監査は新モジュールのroom root transactionとClassic側の実委譲を双方検査。Firebase Emulatorの遠隔revision競合試験を継続。
- Classic HTML/CSS・実業務データ・Firebaseルール・Modern独立レイアウトと12色の配色は変更しない。PR Draft・本番未適用を維持。

## ②-9 重複統合メタデータの保存責務の分離（Ver.545）

- `workspace-duplicate-meta-v545.js`に`workflowV152/duplicates/{sourceId}`のexpected-base child transaction、値正規化・照合、競合時のremote winner復元、通信失敗時の旧値への戻しを抽出。`workspace-duplicate-atomic-v544.js`の二タスク同時更新とは別の既存APIである。
- `workflow-v152.js`は唯一の購読・ローカルキャッシュ・`emit()`管理者で、既存`markDuplicate(sourceId,targetId,expectedDuplicate)`を共通モジュールへ委譲する。3番目の引数が明示された場合のexpected値と、失敗・local-onlyの戻り値を維持。
- Firebaseのパスとschema、Classic CSS/HTML、通知・リマインダー、Modernモックは変更せず、requiredAssetsとdynamicScripts双方で共有writerをv152より前に登録。責務台帳更新。
- `test-harness/workspace-duplicate-meta-v545.test.mjs`でローカル保存、remote保存、明示的expected null、旧revision相当のフィールドの不一致、remote winner保持、ネットワーク失敗、abort、他のレコード不変、loader順を検証。Ver.246/245の旧のソース境界チェックは新writer側へ移す。
- 重要：重複統合本体のcommit後に実施する`writeRelations`と`writeReminder`は別トランザクション。失敗時の判定と修復は別途監査し、本体をもう一度統合しない。

## ②-10 重複統合後の非原子的整理の安全な結果報告（Ver.546）

- `workspace-duplicate-cleanup-v546.js`に、元タスクの関連設定→統合先へ転記→元の関連設定解除→本人のリマインダー解除の**既存と同じ保存順序**を移した。これはroom root transaction成功後の独立した保存であり、原子的な一括保存には含めない。
- 統合先relationの保存が失敗／通信不通／local-onlyの場合は、元relationの解除を**行わない**。元relationの解除が失敗した場合は対象を記録し、reminder整理も検査する。
- 任意の後処理で`ok:false`、例外、またはremote保存を証明できない`localOnly:true`の場合、完了したタスク統合そのものは`ok:true`として報告しつつ、`cleanupPending:true`と対象分類を返す。日本語で設定確認を促し、**本体統合操作を再実行しない**よう案内する。
- 従来の成功したケースは同じ成功通知・詳細画面クローズ・再描画を維持。後処理失敗時は詳細を無理に閉じず、再描画で状態を更新する。自動再試行や勝手なremote復旧は実装しない。
- `test-harness/workspace-duplicate-cleanup-v546.test.mjs`で成功順序、重複ID除外、target/source/reminderの失敗、予期せぬ例外、local-only、複数失敗、UI契約を検証。既存Firebase Emulatorに、root commit後のrelationとreminderの失敗を模擬して誤った再統合を促さない試験を追加する。
- Classic HTML/CSS・Firebaseスキーマ・Modernの実データ接続・UI・12配色を変更しない。PRはDraftのまま。

## ②-11 一括更新・完了の保存責務と定期生成を共通化（Ver.547）

- `workspace-bulk-update-v547.js`へ既存Ver.243の改訂番号正規化、次回定期日算出（daily/weekly/monthlyDay/monthlyNth/yearly）、履歴・変更理由、次回定期タスク生成と`rooms/{roomId}/tasks`の子パストランザクションを抽出。元の処理とフィールド設定を維持する。
- Classicの`bulk-actions-v243.js`は複数行選択と対象の確認、単一の共有接続`W.ensureRemote`、正本revisionの購読確認、通知、busy制御を所有。`WorkBoardBulkV243`の公開API（version, normalizeRevision, nextRecurringDueDate, applyOneTask）を維持する。
- **削除操作は変更しない。** Ver.134/143の正規削除機構を使うことで、予定・ナレッジなどの関連データを含む削除の競合保護を継続する。
- 新規共有モジュールはFirebase初期化/購読・DOM・localStorage・room全体transactionを作らない。requiredAssetsとdynamicScriptsでBulk UIより先にロード、責務台帳を更新する。
- 専用Node試験で2件のatomic update、revision競合無書込、変更履歴、完了解除、日次/月次/年次の定期タスク、既存child衝突、非対象タスク不変を検証。既存Ver.243 Protocol/Firebase Emulator/Brower回帰を新ownerで検査する。
- User registrationの既存Ver.155固定バイト契約は変更しない。Modern実データ接続・機能同等性とUI切替は未実施、PRはDraftのまま。

## ②-12 予約タスク開始日の保存責務を共通化（Ver.548）

- `workspace-start-date-v548.js`へ開始日レコードのlocal revision比較・更新、`rooms/{roomId}/taskStarts/{id}`のexpected-base Firebase child transactionと更新者／更新日時／revision設定を抽出。成功・競合・local-onlyの結果を呼出元へ返す。
- Classic `work-features-v167.js`は唯一のtaskStarts購読・キャッシュ・画面表示、保存中ガード、日本語の通知、タスク本体の保存成功をFirebaseの正本で確認した後の開始日保存ブリッジを保持する。
- 孤立開始日のサーバー再確認とrevision付き削除は既存コードのまま。開始日レコードはタスク本体とは**別の保存操作**であり、両者を原子的トランザクションと誤認しない。
- 必須資産・動的スクリプトの両方で共通writerを`work-features-v167.js`より先に読み込む。ClassicのCSS/HTML、Firebase Rules、表示設定、Modernモックの実データ接続を変更しない。
- 専用Node試験とVer.244/190の厳格な境界契約を検証し、PRはDraftのまま維持する。

## ②-13 予約タスク開始日の孤立記録cleanupを共通ownerへ（Ver.549）

- 既存の`workspace-start-date-v548.js`へ`cleanupOrphans()`を追加し、開始日の保存と孤立記録削除が同じwriterを通る。新しいファイル・Firebase購読・別キャッシュ・保存スキーマは追加しない。
- `work-features-v167.js`は、正規タスクと開始日の購読済み状態を判定する既存タイミングで共通ownerを呼ぶ。利用者の開始日入力・通知・予約タスク一覧、他の機能は変更しない。
- remote削除は既存どおり`tasks/{id}`を読む→`taskStarts/{id}`を読む→`tasks/{id}`を再確認→`taskStarts/{id}`のrevisionをchild transactionで照合。taskが復活した場合、またはstart側revisionが進んだ場合は削除を中止する。通信エラーでも無条件削除しない。
- 注意：task読取とstart削除はroot transactionで一体化していないため、最後のtask確認の直後にtaskが新規作成された場合まで原子的に守るものではない。この限界は既存仕様から変えない。
- Ver.548専用NodeテストへVer.549の成功・競合・再確認・失敗・local-onlyの検証を追加し、Ver.244の静的境界監査も委譲先へ移す。CIが通るまでPR #460はDraftを維持し、`main`へマージしない。

## ②-14 Classic正本からModernへ渡す読み取り専用API（Ver.550）

- `workspace-read-v550.js`へ、現行Classicの`state.tasks / state.todoRaw / state.schedules`を読み取るイミュータブルな最小表示データ投影を追加する。全件タスク・予定と、**現在選択中の利用者のToDoだけ**を渡す。現在の`workspace-core-v537.js`のタスク4件数と`selectVisibleTodos`を再利用し、状態・共有ルーム担当・日本のローカル日付・ToDo順序と当日完了条件の意味を変えない。
- `app.js`は既存の唯一の業務データ所有者として`window.WorkBoardReadV550.read()`を公開する。毎回現在の正本と選択利用者を読み、別キャッシュ、Firebase接続・購読、イベント監視、書込、権限変更を作らない。公開戻り値は必要項目だけをコピーして凍結し、UIが変更しても元データに影響しない。
- `remote-online`では既存の5コレクションがすべて`ready`のときだけデータを返す。読込中、`remote-degraded`、選択利用者なし、正本構造不正なら`ready:false`かつ空配列を返す。`local-only`の場合は`source:'local-only'`を明示する。戻り値は単一時点のクライアントメモリ投影であり、Firebaseの複数コレクション間の原子性や真正性を保証するものではない。
- 初期投影の範囲はタスク一覧向け基本情報、個人ToDoの未完了・当日完了、予定一覧の基本情報、既存4件数。過去完了ToDoの履歴、業務メモ（別の`work-features-v167.js`が購読を所有）、コメント・履歴・添付・設定の全機能同等性は次の契約で個別に設計する。未検証の詳細フィールドを架空データの形に変換しない。
- `modern/preview/`は引き続き架空データの独立モックであり、実データを読み込まない。`Classic`の画面・CSS・保存・Firebaseルール・利用者選択UIは変更せず、静的importのため`app.js`に最小の読取口を追加し、`release-manifest.js`のrequiredAssetsに新規資産を1つ追加する。dynamicScripts、正式デザイン切替、main公開は変更しない。
- **このAPIはセキュリティ境界ではない。** 選択利用者によるToDo絞り込みはUIのデータ最小化であり、現行Firebase Rulesのサーバー認証・閲覧権限制御の代わりにならない。医療・患者情報や機密業務情報をこの段階で新たに投入しない。
- Node Protocolテストで複数利用者・ローカル/オンライン・同期途中・データ変更の反映・入力不変性・凍結・実装分離と配布を確認する。全体回帰合格まではPR #460はDraftのまま維持する。

## ③-1 Modern実データ接続の読み取り専用タスク一覧（Ver.551）

- `modern/product/task-list-contract-v551.mjs`は`WorkBoardReadV550.read()`の返す現在のClassic正本投影だけを受け取り、共有タスクの名称・担当・状態・優先度・期限・revisionをModern側の一覧表示用に正規化・ソートする純粋関数。Classicの配列やタスク本体を変更せず、ToDo・予定・メモ・コメント・履歴等の機能を推測で移植しない。
- `modern/product/task-list-read-v551.html`と`task-list-v551.mjs`は既存`modern/layout.css`・`palettes.css`を再利用し、検索・状態絞り込み・手動再読込・Classicへ戻る機能だけを提供する。HTML挿入には`innerHTML`を使わず`textContent`経由で表示する。Firebase、localStorage、通信、通知、書込、購読、画面内の状態変更は実装しない。
- **起動条件（すべて必須）**：localhostまたは127.0.0.1、URLに`room=test-...`と`modernReadV551=1`、起動ページの`window.WORK_BOARD_TEST.modernReadV551 === true`、かつFirebase設定なしのlocal-onlyまたは明示的に選択したFirebase Emulator。これ以外では検証用iframeは生成しない。子画面も同条件を検査し、直接開いた場合や接続元がない場合は業務データを表示しない。
- Classicの`app.js`は**検証フラグによるiframe表示のみ**を追加し、既存`WorkBoardReadV550`とFirebase購読/業務処理/保存/同期/描画を変更しない。子画面はClassicの同一オリジンの正本読み取りAPIのみ参照し、データを別途購読・永続キャッシュしない。自動更新はしないため、タスク変更後は「正本を再読込」が必要。
- アプリ本体の`index.html`、`style.css`、Firebaseルール、`config.js`、配布`release-manifest.js`、`modern/preview`を変更しない。検証用3ファイルは通常製品配布資産には登録しない。GitHub PRはDraftのまま、mainへの反映は行わない。
- 画面は**権限付与・認証の仕組みではない**。本番Firebase Rulesの認証・閲覧権限の課題は引き続き未対応。病院の患者情報・機密情報を使った試験は禁止し、テストデータとEmulatorを使う。
- Node Protocolテストで既存読取モデル、検索、完了と期限の判定、表示結果の不変性、データの最小化、fail-closedを確認する。PlaywrightはPC/モバイル、Classic正本データの表示、利用者変更時の手動更新、XSS文字列、未選択ユーザー、テストフラグなし・単体URLでの表示拒否、既存ローカルデータ不変を検査する。全体回帰結果が成功するまで実装完了と扱わない。

## ③-2 Modern個人ToDoの正本読み取り専用接続（Ver.552）

- **同じ業務データ所有者を維持**：`workspace-read-v550.js`の`read()`に、Ver.552の`todoHistory`を追加する。既存の`todos`（`selectVisibleTodos`で未完了→本日完了の順）と`version:'550'`は変更せず、完了履歴を混入させない。履歴は既存`sortTodos`で**選択中の利用者のみ**を正規化し、本日完了IDを除く完了レコードを日時の新しい順で別配列にする。過去7日などの期間制限は設けず、記録に残る名称・メモ・完了日時を表示する。日時欠落時は「完了日時不明」と明示し推測で補完しない。
- **正規化・プライバシー**：ToDoのIDはFirebaseマップキーを正本とし、不正キー・空名称は既存正規化処理で除外。所有者が現在選択中の利用者と一致すること、当日完了/過去完了が重複しないことを`modern/product/todo-list-contract-v552.mjs`が検証する。不正snapshot、未選択、loading/degradedでは全グループを空にして表示停止する。各返却行・配列・集計はfreezeし別キャッシュを作らない。
- **単一タブ表示**：`modern/product/todo-list-read-v552.html`と`todo-list-v552.mjs`はModern専用CSS・12配色正本を参照するが、実際の画面操作は検索・過去完了欄の開閉・正本の手動再読込・Classicへ戻るだけ。描画はDOMの`textContent`で、保存・完了切替・削除・並び替え・タスク化・Firebase・モックの呼出しは行わない。
- **切替時の情報残留防止**：Classicの`setCurrentUser()`による`systemTaskUser`更新を、同一オリジンの別iframeで受信する`storage`イベントで検知し、正本を再取得して旧利用者の行を全消去・再描画する。定期ポーリング・二重Firebase購読・業務データの独立ストレージは追加しない。クラシックのToDo画面本体・動作・保存は一切変更しない。
- **明示起動限定**：localhost/127.0.0.1、`room=test-...`、`modernReadV552=1`、`window.WORK_BOARD_TEST.modernReadV552 === true`とFirebase設定なしのlocal-onlyまたは明示Emulatorのみ起動。Ver.551のテスト起動と競合しないよう両方の指定は拒否する。子iframeも同条件と正本のroomIdを確認。direct URLやフラグなしは表示拒否。これはアクセス制御・認証を代替しない。
- `modern/preview/`の架空データ5画面、Classic CSS、本番Firebaseルール、`index.html`、正式デザイン切替、`release-manifest.js`は変更しない。新しい製品用表示ファイルは本番配布資産に登録しない。業務データの実接続はテスト画面だけ。
- Node ProtocolとPlaywright（1366px/390px）で、未完了/当日完了の既存順序、数十日前の履歴、所有者・ルーム分離、利用者切替後の旧データ除去、空・不正状態、同内容のXSS文字列、読み取り前後のローカルデータ不変性、接続制限、通常画面の回帰を検証。全ジョブ成功までPR #460はDraftに固定する。

## ③-3 Modernスケジュールの正本読み取り専用接続（Ver.553）

- `modern/product/schedule-list-contract-v553.mjs`は`window.WorkBoardReadV550.read()`から返された`schedules / tasks / todayISO`のみを受け取り、ブラウザの**ローカル日付**を基準に「今日・アンカー日から7日・アンカー日の月」を選択し、予定の`startAt`で期間内判定・昇順並び替えを行う。日付境界をUTC固定にしない。終了が翌日になっても予定は開始日だけに表示する。壊れた開始日時はClassicと同様に表示対象から除き、終了日時が不明ならUIで明示する。
- 表示項目：予定名、開始/終了日時、担当、分類、場所、メモ、関連タスクの名称（現在のClassicタスク一覧に実在する場合だけ）、revision。関連IDだけが残る孤立参照は名称を推測せず「現在のタスク一覧で確認できません」と表示する。予定名・メモにHTML文字列があっても`textContent`で描画し、スクリプトとして実行させない。
- `modern/product/schedule-list-read-v553.html`と`schedule-list-v553.mjs`は既存Modernの`layout.css / palettes.css`を再利用。表示期間切替、今日へ・前後移動、一覧/閲覧専用月カレンダー、検索、担当/分類の完全一致フィルター、正本の手動再読込、Classicへ戻る機能だけを持つ。月カレンダーは日曜始まりで現地日の予定を表示し、端末幅が狭い場合はカレンダー部分だけを横スクロールする。
- 起動はlocalhost/127.0.0.1＋`room=test-...`＋`modernReadV553=1`＋`window.WORK_BOARD_TEST.modernReadV553 === true`＋local-onlyまたは明示Emulatorの**すべて**が成立した場合のみ。Ver.551/552の同時起動フラグは拒否し、子iframeも同一オリジン・正本roomId・他フラグ不在を検査。直接URL、利用者未選択、通信不良、読込途中、不正レコードでは予定を返さない。これは認証・セキュリティ境界ではなく、あくまで検証用のデータ最小化。
- Classic `app.js`にテスト用iframeの起動だけ追加。Classicの予定編集・通知・表示期間・Firebase購読・保存・リマインダー・競合処理・データ形式は変更しない。Modernモックの`modern/preview/`は引き続き架空データだけを表示する。新規3ファイルは通常配布`release-manifest.js`に登録せず、`index.html`や本番サイト、Firebase Rules、正式デザイン切替も変更しない。
- 画面内の期間・検索条件は一時的なUI選択状態であり、業務データの独立キャッシュを持たない。ユーザー切替時は別iframeの`storage`イベントで再読込し、現在の正本利用者表示へ更新する。予定自体は共有ルーム全件からフィルターする（個人ToDoの所有者分離と混同しない）。業務データを自動監視しないため、予定が更新された場合には手動再読込が必要。
- Node試験は日跨ぎ、7日境界、月末/うるう年、日曜始まりカレンダー、関連タスク、担当/分類/検索、破損日時、immutable、未選択・同期不良・不正構造・配布境界を検証。PlaywrightはPC 1366px、スマートフォン390px、日付操作、関連先表示、検索/フィルター、HTML文字列、書込なし、利用者切替、直接URL/フラグなしの非表示と既存画面の回帰を確認する。CI全5ジョブが成功するまでPR #460はDraft固定、mainへマージしない。

## ③-4 Modern「今日」の正本読み取り専用ダッシュボード（Ver.554）

- `modern/product/today-contract-v554.mjs`はClassic `window.WorkBoardReadV550.read()`の**一回分の同一スナップショット**を既存の`selectModernTaskListV551`、`selectModernTodosV552`、`selectModernSchedulesV553`へ渡し、タスク・個人ToDo・当日の予定を合成する。画面ごとにFirebaseのデータ購読や別キャッシュを増やさない。各結果のルーム・選択利用者・同期元・日付の整合性がとれない場合、すべての業務データを非表示にする。
- **タスク集計と今日の対応リストの範囲は異なる**。4つのKPI（未完了・期限超過・今日締切・自分の担当）は`workspace-core-v537.js`から継承したClassicの正本集計であり、保留も未完了として含み、担当範囲に共有ルームを含む。対応パネルはClassicの`renderTodayView`に合わせ、`完了`と`保留`を除外した「期限超過」「今日締切」を分けて扱う。KPIと一覧件数が一致しないことは仕様として注記し、独自基準の数字へ置換しない。件数の整合性に異常があればフェイルクローズとする。
- 期限超過/今日締切の対応リストは既存Classicのおすすめ順（固定→期限カテゴリ→優先度→期限時刻→更新日時→名称）を照合して並び替える。タスクは各パネル最大6件、個人ToDoは未完了の先頭4件、今日の予定は開始時刻順の先頭6件に限定し、集計件数は省略前の全件を維持する。予定はローカル開始日で判定し日跨ぎは開始日側へ置く。個人ToDoは選択中の本人のみ（未完了・当日完了の個数）であり、過去完了履歴は「今日」に混ぜない。
- `modern/product/today-read-v554.html`と`today-v554.mjs`は既存`modern/layout.css`・`palettes.css`のBrief、今日用2カラム、優先リスト、概要、個人ToDo、予定の画面構成を再利用。正本を手動再読込するボタンとClassicへ戻るボタン以外の保存・編集・完了・削除操作はない。すべての業務文字列は`textContent`でDOMに描画しHTMLとして実行しない。
- **お知らせと業務メモは未接続**。それぞれClassic側の別モジュールが所有するデータのため、実データ読取契約が整うまでModernの架空のお知らせ・メモを流用しない。「未接続」と画面上にも明示する。Classicの今日に存在する未整理ボックス、空き時間タスク、サイドバー絞り込み、タスク編集などの機能同等性もこの工程では保証しない。
- 起動はlocalhost/127.0.0.1＋`room=test-...`＋`modernReadV554=1`＋`window.WORK_BOARD_TEST.modernReadV554 === true`＋local-onlyまたは明示Emulatorの場合のみ許可。Ver.551/552/553の同時検証フラグは拒否。子iframe側でも同一オリジン、正本roomId、同じ条件を照合し、直接URL、未選択利用者、読み込み途中、接続劣化、不正データ時には全パネルを空にして表示拒否する。利用者切替時は`storage`イベントで再取得し、**前利用者のToDoをDOMから削除**する。
- Classicに追加したのはテスト用iframe起動のみ。Classicの業務保存、通知、Firebase Rules、CSS、正本データ形式、`release-manifest.js`、`index.html`、Modernの5画面独立モック、製品の正式デザイン切替は不変。検証画面はセキュリティ境界や認証機構ではなく、**患者・機密情報をテスト投入しない**。
- Node Protocolで4件数と保留除外の差、タスク優先順、個人ToDo所有者、スケジュール日跨ぎ、入力不変性、単一読み取り・フェイルクローズ・プレビュー上限・配布境界を検証する。PlaywrightでPC 1366px/モバイル390px、検索なしでの表示、HTML文字列の安全性、利用者切替と旧個人情報の消去、localStorage不変性、空ルーム、未選択・直接URL・フラグなしを確認する。CI全5ジョブが合格するまではPR #460をDraft維持し、mainに反映しない。

## ③-5 Modern共有業務メモの読み取り専用接続（Ver.555）

- **正本を厳密に区別**：対象は`work-features-v167.js`が管理する`rooms/{roomId}/businessMemos`（ローカルキー`system-business-memos:{roomId}`）の業務メモであり、タスク由来の`state.knowledge`や個人ToDoの詳細メモとは異なる。保存・削除・固定切替は既存`workspace-memo-v539.js`が担当し続ける。ModernはFirebaseやlocalStorageから独立に取得しない。
- **副作用のない読み取り口**：既存所有者`work-features-v167.js`に`window.WorkBoardBusinessMemoReadV555.read()`を追加。返却は`version:'555'`、読込状態、接続元、ルーム、選択利用者、分類、固定/並び順確定済みの共有メモの**ホワイトリスト項目だけ**。IDは共有ルームのマップキーを正本とし、本文・タイトル・分類・タグ・固定状態・作成更新者/日時・revisionのみをコピーしてfreezeする。既存の`memoList()`と表示順比較関数を共通化し、Classicの検索・フィルター・固定グループの並びを変えない。
- **並び順の意味**：共有メモの中身はルーム共通だが、表示順の手動設定`workBoardMemoOrderV531:{roomId}:{currentUser}`は利用者・端末ごとに異なる。固定メモを先頭に置き、そのグループ内で登録済み手動順を優先し、残りは更新日時とIDの比較に委ねる既存仕様を継承する。Modernの検索はClassicと同じNFKC小文字化・空白圧縮でタイトル・本文・分類・タグに作用。フィルターの操作による本体/順序キーへの保存は行わない。
- **初期ロードの判定**：Classic側でローカルキャッシュを一度読み込んでも、Firebase接続を試みている間はModernには**loading**を返し、接続確定後の最初の`businessMemos`購読成功で`remote-online`、既存ローカルフォールバック完了後で`local-only`とする。Firebase購読失敗時には`degraded`を返してModernの表示をすべて消去。既存Classicの保存・UIの挙動は変更しない。ローカルDOMイベント`workboard-memo-state-v555`で子iframeへ接続状態の切替を通知するが、新たなFirebase購読・ポーリング・独立キャッシュは設けない。
- **Modern画面**：`modern/product/memo-list-contract-v555.mjs`がClassicの`WorkBoardReadV550.read()`と業務メモ所有者のread結果のルーム・利用者・接続元一致を確認。どちらかが未選択・読込途中・degraded・不正・不一致なら全メモを表示拒否。 `memo-list-read-v555.html`/`memo-list-v555.mjs`はModern専用CSS・配色を再利用し、検索・分類絞り込み・手動再読込・Classicへ戻る操作だけを提供する。本文は高さ制限付きのスクロール可能な`pre`要素として表示し、HTML文字列は`textContent`で表示して実行しない。ピン表示は単なるラベルであり、編集/ピン変更/コピー/タスク作成/上下移動は実装しない。
- **明示起動条件**：localhost/127.0.0.1＋`room=test-...`＋`modernReadV555=1`＋`window.WORK_BOARD_TEST.modernReadV555 === true`＋Firebase設定なし(local-only)または明示Emulatorの全条件が必要。Ver.551～554の検証フラグと同時起動できない。直接URLでは親の正本へアクセスできず、業務データは表示しない。これは権限管理や認証を代替せず、病院の個人情報・患者情報を使ったテストは禁止する。
- 変更は`work-features-v167.js`の読み取り部分とmemoListの共通比較処理、Classic `app.js`のテストiframe起動、新規Modern3ファイル、Node/Browserテスト、設計文書に限定。既存の`workspace-memo-v539.js`、本番Firebaseルール、`index.html`、`release-manifest.js`、Classic CSS、保存処理、`modern/preview/`（独立モック5画面）は変更しない。
- Nodeで実際のsidecarを初期化して読み取り状態・固定と利用者順・データ不変性を確認し、さらに純粋関数で検索、分類、所有者不一致、ローディング・劣化時の拒否、入力改ざん・freeze・XSS文字列・配布境界を検証。PlaywrightはPC 1366px、モバイル390px、Classicとの表示順直接比較、利用者変更、長文スクロール、検索、固定ラベル、端末保存キー不変、直接URL・未選択・フラグなし・空ルームを確認。CI5ジョブの成功まではPR #460をDraftに維持し、mainに反映しない。
