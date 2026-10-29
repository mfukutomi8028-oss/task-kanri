# モダン v2：製品実装に向けた分離境界

状態：**独立UIの検証用コードを導入。製品の業務データへは未接続。mainでの公開・切替不可。**

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
| ② 業務操作の共通API切り出し | 保存・同期・競合・履歴とテストをClassicで先に通す | 読み取りセレクター＋共通書き込み制御（排他・通信・エラー・解放）を抽出。トランザクション本体・履歴等は未移管 |
| ③ Modern画面への実データ・全機能接続 | 全画面で実機能と同等の操作、旧CSSの混入0、モックとの差分検証 | 未実施 |
| ④ デザイン切替・配色を製品設定へ接続 | 利用者×ルーム別保存、未保存入力保護、Classic回帰、12配色×PC/モバイル検証 | 未実施 |
| ⑤ 本番公開 | 同一コミットの全体回帰・Firebase Emulator・表示レビュー・公開後検査 | 未実施 |

現段階では①と②の一部のみを扱う。モックが操作できることと製品で全機能が利用できることを混同しない。

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
