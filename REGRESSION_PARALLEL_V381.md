# Ver.381候補：回帰CIを並列実行し、単一の最終合格ゲートで保護

## 現状と目的

現行GitHub Actionsでは `Protocol → Chromium UI → Firebase Emulator` を単一runner内で直列実行するため、特にPC/390px大量ブラウザ試験後にFirebaseまで順番待ちとなり、PR 1件の検証に長時間かかる。今回の修正は**テストの内容・検証範囲を減らさず**、独立した3runnerで同時に開始できるようにする。テスト内容・ブラウザ構成・firebase demo project・デプロイ設定は不変。

## 変更範囲と保護

- `protocol`：Node24で全Protocol・release-contractを実行
- `browser`：Node24/Chromiumで `npm run test:ui` を実行
- `firebase`：Node24/Java21/Chromiumで `npm run test:firebase` を実行。Firebase Emulatorはrunnerが独立しており、本番業務DBへ接続しない
- `regression`：3つの `needs` が**すべてsuccess**でなければ失敗になる最終ゲート。`if: always()` で先行Job失敗時にも検証する。従来の必須チェック名 `regression` を維持し、Protocolだけ成功した段階でPRを採用しない
- ブラウザ/Firebaseの各失敗レポートは個別artifact名で保存し、障害切分けを容易にする
- 既存concurrencyの古いCIキャンセル、GitHub Pagesビルド、Release/baseline、業務データの処理は変更しない
- `test-harness/release-contract.test.mjs` へCI構成検証を追加し、3本のjobが実行され、最終ゲートが3本全部を待つことを静的に固定する

## 費用・リスクと採用条件

`npm install`とChromiumセットアップが複数runnerへ分散するため総runner分（Actions利用量）は増える可能性がある。一方、ユーザーがCIを待つ実経過時間は短縮が期待できるが、実測前に速度改善率を断言しない。

従来run #37913096213 と新runのJob開始から終了までを比較する。PR exact-headで4Jobが全success、さらに `regression` 単一必須チェック成功まで確認する。古いjobと同じProtocol・Browser・Firebaseの全テスト件数・失敗監視が維持されたことを検証する。mainへマージ後、main Regression/Pages成功と復旧地点を確認する。

PR #294 はRelease304/Bootstrap SVGとしてmainへマージ済み。本PRはそのmainを親に再構成し、製品runtimeを変更せず、Release304を維持する。旧画像物理削除とは独立に進める。
