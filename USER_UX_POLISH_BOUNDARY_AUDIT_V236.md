# Ver.236 user-ux-polish-v208.js 責務境界監査

## 目的

Ver.235 の通知改善が main / Pages / Regression まで green になった地点から整理作業を再開し、`user-ux-polish-v208.js` が現在も必要な実行責務を持つかを、製品コードを変更せず確認する。

## 結論

`user-ux-polish-v208.js` は **現時点では active runtime からそのまま退役できない**。

現在も次の3責務を実際に所有している。

1. **お気に入り表示の現行文言化**
   - `index.html` の左ナビ・詳細フィルターにはまだ「スター」が残る。
   - `app.js` のカード/詳細ボタンとtoastも「スター」を生成する。
   - sidecar が動的DOMを監視し、「お気に入り」表記・title・aria-label・toastへ補正している。

2. **廃止済みUIの非表示/除去**
   - 内部状態フックとして必要な `#favoriteOnly` はDOMに残したまま非表示にしている。
   - `#roomCacheHelp` / `#clearRoomCache` は現行製品UIから除去している。
   - `app.js` のお気に入りフィルター状態自体は `#favoriteOnly` を正本フックとして現在も利用する。

3. **タスク編集の未保存破棄確認**
   - `app.js` の `#closeTaskDialog` は直接 `dialog.close()` する。
   - `task-ux-v146.js` のbackdrop閉じも最終的に既存のcloseボタンへ委譲する。
   - sidecar がcapture phaseで × / backdrop / Escape を監視し、ユーザー入力がdirtyな場合だけ確認を出す。
   - sidecarを無効化すると未保存入力は確認なしで閉じられるため、独立した現役責務である。

## sidecarの責務ではないもの

### 個別通知の既読/未読切替

Ver.235 現在、通知の単品既読・未読戻し、カテゴリ単位の一括既読は `inbox-ui-v183.js` が所有する。`user-ux-polish-v208.js` には inbox read API への依存がない。

したがって、従来の `tests/user-ux-polish-v208.spec.mjs` にある「single notification read button」テストは、現在では sidecar 自身の責務テストではなく、同時期に導入したUXの回帰テストとして残っている。

### 詳細画面のクイック固定

`detail-layout-v154.js` が `data-quick-pin-v154`、固定/固定解除の表示と保存処理を所有する。sidecarを無効化してもクイック固定は残る。

## 実ブラウザ監査契約

`tests/user-ux-polish-boundary-v236.spec.mjs` では loader 上の `user-ux-polish-v208.js` だけを空JSへ置換し、他の現行assetを通常どおり動かす。

sidecar無効時に次を確認する。

- 左ナビが元の「スター」表記へ戻る。
- `#favoriteOnly` と旧cache UIがDOM上で除去/hidden化されない。
- お気に入りフィルターそのものは `app.js` により機能する。
- タスク詳細のクイック固定は `detail-layout-v154.js` により残る。
- 個別通知の既読切替は `inbox-ui-v183.js` により残る。
- タスク編集の未保存内容は確認なしで閉じられ、sidecarが破棄確認の実所有者であることを示す。

## 次の製品整理方針

次工程では一度に全面書換えせず、現在の挙動を保ったまま責務を正本へ移す。

1. **お気に入り文言**を `index.html` / `app.js` の生成時点から「お気に入り」に統一し、MutationObserverとtoast後置換を不要化する。
2. **favoriteOnlyの内部フック**はフィルター互換を維持したまま静的に非表示化し、cache UIは現行仕様に合わせて静的HTMLから整理する。
3. **未保存破棄確認**をタスクdialogのcanonical close経路へ統合し、× / backdrop / Escape の全経路を1つのguardへ集約する。
4. 上記を実ブラウザで確認してから `user-ux-polish-v208.js` をactive manifestから退役し、旧キャッシュmanifest/ロールバック互換用の物理ファイルだけを残す。

この監査では runtime product code と release version は変更しない。正式releaseは引き続き **Ver.235** とする。
