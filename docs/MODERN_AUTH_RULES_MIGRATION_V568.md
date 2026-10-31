# Ver.568 — Auth UID・ルーム権限・Firebase Rulesの安全移行設計（検証用候補）

対象：Draft PR #460、Security Issue #368、Ver.449監査。2026-10-31時点の**リポジトリ構成**を検査した工程であり、Firebase Console・本番Database・現行デプロイ済みRulesを監査した記録ではない。

## 結論：正式公開 NO-GO

現行 `app.js` は `room` パラメータと `systemTaskUser`（localStorage）でルーム/表示利用者を選択し、Firebase Authenticationによる本人確認をしていない。`firebase-rules.json` の `rooms/$roomId` は `.read:true/.write:true`。ただし**本番適用状態は未確認**であり、リポジトリ定義を実際の配布済み権限と同一視しない。

現行の `/rooms/$roomId` で `runTransaction` する処理と、同じルーム配下の個人ToDo/通知/リマインダーは、ルーム単位の広いread/writeを許す設計から直接安全な個人別権限に切り替えられない。親のread/write許可は子で取り消せない。認証の追加だけ・URLの秘密化だけ・表示名の制限だけでは解決しない。

**Ver.568の実装範囲**は独立した将来スキーマRulesの候補、独立EmulatorのAllow/Deny自動検証、Protocol監査、移行判断の設計である。**既存アプリ・既存Firebaseクライアント・本番Rules・旧Emulator・配布物・実データは変更しない。** 候補Rulesはそのまま本番適用してはならない。

## 採用候補と比較

| 方式 | 強み | 現時点の課題 | 判定 |
| --- | --- | --- | --- |
| A. Firebase Auth＋管理者のみ付与するUID/ルームmembership＋ルーム内共有とUID別個人データを分離 | 既存RTDB資産を継続しつつ最小権限に近づける | 既存全経路のデータ移行、room root transactionの解消、通知配送と監査の設計が必要 | **優先してstaging実証** |
| B. Firebase Auth＋サーバーAPI/Functionsに業務書込を集約 | 原子的な複数領域更新、監査、権限制御をサーバーに集約できる | 追加のサーバー運用・費用・可用性・保守負荷 | 原子的タスク化等でAだけでは維持できないときの有力代替 |
| C. 旧 `/rooms` を所属者へ一括許可し、個人領域だけ子ルールで制限 | 変更が小さい | 親許可が子へ継承されるため個人領域が保護できない | **不採用** |

## 現行→将来（検証用最小スキーマ）の境界

| 現行参照・操作 | Ver.568候補パス | 採用前の対応 |
| --- | --- | --- |
| `rooms/{room}/tasks`、`schedules` | `roomsV2/{room}/shared/tasks/{id}`、`.../schedules/{id}` | membershipに基づき共有閲覧。編集者/管理者のみ子レコード単位の書込。タスクのschema/revision検証、削除後の関連整理は未設計 |
| `rooms/{room}/todos` | `personalV2/{auth.uid}/{room}/todos/{id}` | 認証UID本人＋所属確認でのみ読み書き。画面の表示名は権限に使わない |
| `rooms/{room}/workflowV152/inbox/{displayUser}` | `personalV2/{auth.uid}/{room}/inbox/{id}` ＋ `inboxRead/{id}` | 通知内容は本人閲覧のみ・クライアントからの通知捏造を拒否。既読は本人の専用パスへ。**通知配送は別途サーバー側の信頼経路が必要** |
| リマインダー | `personalV2/{auth.uid}/{room}/reminders/{taskId}` | 本人の保存範囲のみ確認。送信/通知時計とタスクの一貫性は未検証 |
| ルームの利用者、membership | `access/{room}/members/{auth.uid}` | 信頼できる管理操作のみ付与・失効。一般クライアントは自己登録/昇格不可。読む場合は本人のmembershipのみ |
| `rooms/{room}` 全体トランザクション、`meta`、`knowledge`、`taskStarts`、`workflowV148/V152`、関連データ一括整理 | **まだ移行先の操作仕様を決めていない** | 候補Rulesでは未許可（default deny）。既存Classic/Modernのwriter、ToDoタスク化の一括原子性、通知・履歴を失わない方式を再設計し、Emulatorで証明する |

検証用ルール `security/database.rules.v568.candidate.json` は既存 `firebase-rules.json` の改訂版ではなく、**移行後の最小アクセス境界を確認するための分離された試作品**。タスク本文フィールド、revisionの整合、読み取りクエリ・索引、ログ、悪意ある編集者の不正レコード投入などを十分に制限するものではない。ルールを通過しても製品権限が完成したとは判定しない。

## 安全な移行順序と解除条件

1. **実環境の事実確認（管理権限保持者）**：Firebase project/RTDB instanceの実際の適用Rules、Auth設定、現在の利用端末・旧キャッシュ済みクライアント、取扱情報の分類、アクセスログ・DBバックアップ能力を組織の管理手順で確認。機密データ、トークン、全量エクスポート、個人情報をPR・CI・Chatへ載せない。
2. **ID・運用承認**：認証方式（病院が承認する本人確認手段）、UIDと表示名の対応、viewer/editor/adminの付与/失効担当、退職・異動、端末の共用、MFA、旧アカウントの無効化・緊急遮断を決める。membershipはクライアントから書かせない。
3. **stagingで既存操作と新スキーマの差分を実装・試験**：認証完了まで画面はremoteデータを開かない。UID別個人データと共有データを独立購読する。room全体をatomic更新するToDoタスク化/重複統合等は**原子性を維持するサーバー処理**か安全な再設計を選ぶ。未接続時にlocal-onlyで権限をすり抜けない。二重writer/購読は作らず既存ownerを置換する。
4. **権限・整合試験**：匿名、未所属、他ルーム、reader、editor、admin、本人と他人のToDo/inbox、自己昇格、root書込、失効後の接続、未認証旧クライアント、同時編集、offline復帰、入力保持、通知重複、部分失敗を検査する。新Rulesはschema・index・サイズ/上限・履歴追跡も追加審査する。
5. **バックアップ・復旧と段階公開**：本番への書込前に復元可能なバックアップと**復元テスト**、データ移行の前後突合、旧クライアント強制更新/接続拒否、移行手順と停止時間、監査記録、障害時の読取専用・切戻しを承認。古い `.read:true/.write:true` への安易なロールバックは許可しない。安全なstaging検証と管理者承認がない限り、本番Rules/Pagesは変更しない。

## Ver.568のテストと限界

- **専用コマンド**：`npm run test:rules:v568`。明示した`firebase.v568.candidate.json` と`demo-task-kanri-v568` のEmulator（127.0.0.1:9001）のみ。既存 `firebase.json` が指す開発用全許可Rulesとは別の一時プロセスで起動する。
- テストは `@firebase/rules-unit-testing` の認証済みUID/未認証コンテキストを使用する。認証なし・非所属・別ルーム・viewerの共有編集・別人のToDo/inbox・自己昇格・room親書込をdeny、editorの子レコード書込・本人の個人領域をallow。membership失効後にdenyとなることも確認する。
- GitHub ActionsのFirebase jobで従来のEmulatorテスト後に**専用候補テスト**を実行し、どちらかが失敗すれば既存Regressionの最終ゲートを失敗とする。Protocolは候補Rulesに無条件許可がないこと、既存公開Rulesを触っていないことを監査する。
- この試験は**新パスだけの権限マトリクスの実証**。Classic/Modern業務画面は新パスを使用しておらず、Firebase Auth導入・本番移行・schema validation・運用受入・利用者権限の正式承認は**すべて未完了**。本番の実際の適用Rulesは未確認。PRはDraft、main/GitHub Pages/実DBは現状維持。

公式参考：Firebase Security Rulesの階層と継承 https://firebase.google.com/docs/database/security/core-syntax 、条件 https://firebase.google.com/docs/database/security/rules-conditions 、Emulatorテスト https://firebase.google.com/docs/rules/unit-tests 。
