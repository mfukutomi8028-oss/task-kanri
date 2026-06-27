# システム課タスク共有

システム担当2名向けのリアルタイムタスク共有サイトです。GitHub Pages + Firebase Realtime Database で動作します。

## 主な機能

- Firebase Realtime Databaseによる共同編集
- ルームID付きURLで複数ルーム運用
- ユーザー選択、ユーザー追加、ユーザーカラー
- タスク追加・編集・削除
- 状態：未着手 / 対応中 / 確認待ち / 保留 / 完了
- 優先度：緊急 / 高 / 中 / 低
- 分類：PC / プリンタ / ネットワーク / 電子カルテ / Web/HP / アカウント / 業者対応 / 定期作業 / その他
- 期限日・期限時刻
- 依頼元
- タグ
- チェックリスト
- コメント・申し送り
- 固定表示
- 期限超過、今日まで、自分の担当、固定のみフィルター
- ボード表示 / 一覧表示 / 自分の担当 / 完了表示
- Firebase未設定時のローカル保存フォールバック

## GitHub Pagesへのアップロード

1. このzipを解凍します。
2. 中身をGitHubリポジトリへアップロードします。
3. `config.js` にFirebase設定を貼り付けます。
4. GitHub Pagesを有効化します。
5. 公開URLへアクセスします。

## Firebase Realtime Database設定

### 1. Firebaseプロジェクト作成

Firebase Consoleで新規プロジェクトを作成します。Google Analyticsは不要ならOFFで構いません。

### 2. Webアプリ追加

プロジェクト概要からWebアプリを追加し、表示された `firebaseConfig` を `config.js` に貼り付けます。

### 3. Realtime Database作成

Realtime Databaseを作成します。場所は近い地域で構いません。最初はテストモードでも動きますが、公開前にルールを確認してください。

### 4. ルール設定

Realtime Database の「ルール」タブに `firebase-rules.json` の内容を貼り付けて公開します。

注意：このルールは、URLを知っている人が読み書きできる簡易運用向けです。院内の実名・患者情報・パスワード・IPアドレスなどの機密情報は入力しないでください。認証付きにしたい場合はFirebase Authenticationを追加してください。

## config.js の例

```js
window.firebaseConfig = {
  apiKey: "xxxx",
  authDomain: "xxxx.firebaseapp.com",
  databaseURL: "https://xxxx-default-rtdb.firebaseio.com",
  projectId: "xxxx",
  storageBucket: "xxxx.firebasestorage.app",
  messagingSenderId: "xxxx",
  appId: "xxxx"
};
```

## データ構造

```text
rooms/{roomId}/meta
rooms/{roomId}/tasks/{taskId}
```

## 共有方法

画面右上の「共有リンク」を押すと、現在のルームID付きURLをコピーできます。
同じURLを2人で開くと同じタスクを共有できます。


## v2 修正内容

- `config.js` にFirebase設定を反映しました。
- Firebase Consoleから取得したコードに含まれる `import` / `initializeApp` / `getAnalytics` は削除しました。
- このサイトでは `app.js` 側でFirebase SDKを読み込むため、`config.js` には `window.firebaseConfig = {...}` のみ記載します。
- Realtime Database用に `databaseURL` を追加しました。
- `databaseURL` は `https://task-kanri-2ad16-default-rtdb.firebaseio.com` としています。
  - Firebase ConsoleのRealtime Database画面に表示されるURLが異なる場合は、`config.js` の `databaseURL` だけ差し替えてください。


## v3 修正内容

- 初期ユーザー（福冨・森井）も削除できるようにしました。
- タイトルを「システム課タスク共有」から「タスク共有」に変更しました。
- ヒーロー右側の「共有リンク」ボタンを削除しました。
- 「＋ 新しいタスク」ボタンを検索バー左側へ移動しました。
- 左上の「管」アイコンをユーザー提供画像へ変更しました。
- 統計カードと左メニューのアイコンをユーザー提供画像へ変更しました。
- 分類管理画面を追加しました。
  - 分類の追加
  - 分類名の変更
  - 分類の削除
  - 既存タスクに使われている分類を変更/削除した場合、タスク側も反映
- 分類一覧はFirebaseの `rooms/{roomId}/meta/categories` に保存されます。


## v4 修正内容

- タイトル枠の高さを少し小さくしました。
- 共有ルーム表示をタイトル左下ではなく、タイトル枠の右下へ移動しました。
- 右側の空きスペースを活かす配置に変更しています。
- 画面幅が狭い場合は、共有ルーム表示がタイトル下へ自然に回り込むようにしています。
- `style.css?v=4` / `app.js?v=4` にしてブラウザキャッシュを回避しています。


## v5 修正内容

- タスク詳細の「完了にする」ボタンを緑の強調ボタンへ変更しました。
- 左メニューのアイコン画像を少し大きくしました。
- 左上のブランドアイコンを、ユーザー提供の3枚目アイコンへ変更しました。
- favicon / apple-touch-icon も同じ3枚目アイコンへ差し替えました。
- `style.css?v=5` / `app.js?v=5` / 各アイコン画像 `?v=5` にしてブラウザキャッシュを回避しています。
