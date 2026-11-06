# 認証・権限制御への移行判定（2026-11-06）

## 現時点の結論：NO_GO（本番への認証切替は行わない）

業務管理ボードの本番UIは従来の `/rooms/{roomId}` に接続し、画面上で切り替える「利用者名」は Firebase Authentication の UID ではありません。一方、隔離検証中の `security/database.rules.v568.candidate.json` と `security/database.rules.v577.candidate.json` は `/roomsV2/{roomId}` を対象にしています。後者は移行データを保全する**クライアント書き込み禁止**の候補ルールです。現行UIへそのまま適用すると保存処理と整合しません。

リポジトリ上の `firebase-rules.json` は `/rooms/{roomId}` に認証なしの `.read: true` と `.write: true` が残っています。**本番Firebase Consoleに実際に適用されているRulesは今回確認していません**。この区別を厳守します。

Firebase Security Rulesでは親ノードがアクセスを許可すると子ノードで許可を取り消せません。そのため、ルーム単位の全面許可を残したまま個人ToDoや権限管理だけを子ルールで守る方式は成立しません。

## 今回の実装

- 独立したGitHub Actions `authorization` ジョブで、既存のVer.568認証候補ルール、Ver.577の保全重視の読み取りルール、Ver.573のAuth／Admin連携を **Firebase Local Emulator Suiteのダミー環境のみ**で検証する。
- 既存 `firebase` ジョブは従来の業務データ保存・競合制御テストだけを担当する。検証の重複実行はしない。
- 集約 `regression` ジョブは `authorization` の成功も必須とする。権限テストが失敗しても、業務データテストの成否と混同しない。
- **GitHub Pagesの公開ゲートは引き続きProtocolテスト中心**。今回の独立ジョブが自動的にデプロイを全面停止するわけではない。全テストを公開ゲートに統合するのは不安定な既存テストを解決してから実施する。

## 本番移行前に満たす必要がある条件

1. 本番Firebase Consoleで適用中のRulesと接続先を、権限のある担当者が閲覧専用で確認する。
2. 利用者名と個人ToDo等の既存データについて、実際の認証UIDへの対応方法・承認手順を定義する。氏名文字列だけからUIDを機械的に決めない。
3. 現行タスクのコメント、履歴、添付、繰り返し、拡張フィールド、ルーム設定、業務メモ、通知、個人ToDoを欠損なく保持する移行契約を検証する。既存の `legacy-room-schema-audit-v574.mjs` と `classic-lossless-schema-v576.mjs` は現段階で書き込みを実行しない。
4. Authの登録・サインイン・利用者切替、招待・権限変更・失効、共有・個人別の読み書きを実装し、すべてエミュレータで確認する。
5. 旧端末・古いURL・キャッシュ済みクライアントによる読み書きをどう停止させるか決め、切替日・復旧方法・担当者・合否基準を承認する。
6. **独立した復元可能なバックアップと復元試験が整うまで、本番データの移行・削除・Rules切替を行わない。** バックアップ作業は依頼により今回は保留中であり、完了扱いにしない。

## 変更の禁止範囲（現工程）

- 本番DBのデータ読み取り／書き込み、エクスポート、Rules変更、Firebase Authの有効化・利用者作成、実データの匿名性確認は行わない。
- 公開UIのFirebase接続パス、保存スキーマ、ローカル利用者選択、既存の共同編集、現在の本番ルールファイルは変更しない。
- GitHub Actionsの失敗ログに本番データ、UID、認証トークンを記録しない。

## Ver.579：認証UIDと従来の利用者名を分離する隔離検証

- `security/staged-identity-session-v579.mjs` は**本番画面から未参照**のNode向け検証契約です。現在の `setCurrentUser`、Classic・Origin・Palette・JOURNALの表示と保存は変更しません。
- 既存の `verifiedUidV578` を再利用し、Auth IDトークンの署名・発行先・失効を確認します。Admin SDKが読むルーム所属権限と承認済み `internal/identities/{uid}` の表示名を対応させ、表示名からUIDを推測しません。
- UIDと異なる職員名へ移る場合は **再認証が必要**。タスク担当者の選択とは区別します。切替前に保存中処理と未保存入力を検知し、無断で破棄しない方針です。
- Auth UID／ルームの変化・ログアウト・失効では個人データの表示を無効化します。同一UIDのトークン更新でも再確認前に書き込みを再開しません。
- エミュレータの架空利用者2名で、ログイン、閲覧専用権限、他人へのなりすまし拒否、別ルーム拒否、未承認・表示名重複、ログアウト時の消去方針を検証します。本番のIDトークンや資格情報は取得しません。
- **本番移行判定はNO_GOのままです。** 現行 `/rooms` のRulesが実運用で安全になったと主張するものではありません。本番Rules切替・Auth設定・データ移行・バックアップは未実施です。

## Ver.580：ローカル専用のログイン・アカウント切替画面

- **本番公開対象外**：`test-harness/staged-auth-ui-v580/` 以下の画面・Nodeサーバーのみ。Pagesはrootの明示的な公開資産だけを配置するため、公開HTMLから今回の画面へのリンクはありません。
- **実際のデモ認証**：ループバック `127.0.0.1` のFirebase Auth／Realtime Database Emulatorsだけを使い、職員A（編集者）／職員B（閲覧者）という架空の2ユーザーを作成します。サーバーはEmulator用環境変数が一致しなければ起動を拒否します。
- **機密情報の分離**：Admin SDK、IDトークン、承認済みUID対応表はNodeサーバー側に閉じ、ブラウザにはHttpOnly・SameSiteクッキーと表示名・権限のみ返します。資格情報をコンソールやCIログに出力しません。
- **操作の確認**：ログイン、別人としての再認証、未保存メモの破棄確認、ログアウト、通信障害時の画面ロック／再確認、スマートフォン幅での表示を確認します。
- **検証方法**：`npm run test:auth:ui:v580` はEmulatorとHTTPエンドポイントの結合テスト、`npm run test:ui` は操作UIをモック通信で検証します。手元で画面を確認する場合だけ `npm run demo:auth:ui:v580` を実行し、表示されるループバックURLを開きます。
- **本番移行はNO_GOのまま**：既存の利用者切替UIやFirebase Rules、`/rooms` の保存データは一切変更していません。バックアップ保留中につき、Authの本番導入・データ移行・権限切替は引き続き禁止します。

## 次に進める工程

実データに触れないまま、サインイン画面・利用者切替とUIDの対応設計、旧データのロスレス変換のエミュレータ試験、公開停止／ロールバック手順を順に整備する。本番切替とデータ移行は別工程として明示的に判断する。

参考：
- Firebase Realtime Database Security Rules https://firebase.google.com/docs/database/security
- ルールの親子継承 https://firebase.google.com/docs/rules/rules-behavior
- Local Emulator Suite https://firebase.google.com/docs/rules/emulator-setup
