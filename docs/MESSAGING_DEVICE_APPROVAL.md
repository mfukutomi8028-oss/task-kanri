# Origin メッセージ端末承認（初回限定試用）

本手順は管理者だけが実行する。ボード全体のログイン導入とは別の暫定手段。患者情報・機密情報を保存しない。

## 前提

- 最新の開発PRの検査・独立レビューが完了していること。候補Rulesを実際の本番Rulesと合成し、既存業務への影響もEmulatorで確認する。
- 管理用端末の作業ディレクトリで `npm ci` を実行する。
- Firebase Admin SDKが対象プロジェクトで認証管理とRTDBを操作できるADC（Application Default Credentials）を使用する。必要な資格情報はOSのローカル環境または安全な秘密管理機構から参照し、Git・Chat・ブラウザに貼り付けない。Firebase CLIへのログインだけでAdmin SDKの資格情報が利用可能とは限らない。
- 管理操作は一人ずつ実施する。別の管理者が同時に名簿や端末紐付けを手動変更しない。
- この管理ツールの本番対象は task-kanri-2ad16 に固定。検証用は demo-task-kanri-messaging とローカルEmulatorの組み合わせに限定する。

## 操作

1. 管理者が本人と現在の表示利用者名を別経路で確認する。端末承認情報はメッセージ画面の未承認時に表示される。UIDを知るだけでは本人確認にはならない。
2. 新規利用者の初回だけ `node security/messaging-device-admin.mjs new-person-id` で不変personIdを作る。同一人物の別端末には同じpersonIdを使う。
3. 下記のコマンドを **--apply を付けずに** 実行し、対象プロジェクト・状態と変更予定を確認する。問題がなければ同じコマンドに --apply を追加する。例の ROOM、PERSON、NAME、UID は確認済みの値へ置換する。

```powershell
node security/messaging-device-admin.mjs register-person --project task-kanri-2ad16 --room "ROOM" --person "PERSON" --name "NAME"
node security/messaging-device-admin.mjs approve-device --project task-kanri-2ad16 --room "ROOM" --person "PERSON" --name "NAME" --uid "UID"
node security/messaging-device-admin.mjs revoke-device --project task-kanri-2ad16 --room "ROOM" --person "PERSON" --uid "UID"
```

登録済みの表示名・personIdの変更、別人への端末付け替えは拒否する。失効した同一端末を再承認する場合だけ --reactivate を明示する。失効は端末紐付けを残して approved/active を false にする。他の端末・既存会話・旧roomsは変更しない。取得済みメッセージや画面キャプチャを回収することはできない。

## 検証・残工程

実際の本番Rules、秘密情報、Edge Functionの配備と外部JWT検証、二端末間の送受信確認が必要。未読のリアルタイム監視はメッセージ画面を開いている間、最大100会話・同時4リクエスト。招待の発見は画面表示中60秒間隔の一覧更新で行う。画面外の通知・上限超過会話の全数集計は未完了。機能無効のVer.676候補の段階では、実運用者の承認・配備・公開を行っていない。
