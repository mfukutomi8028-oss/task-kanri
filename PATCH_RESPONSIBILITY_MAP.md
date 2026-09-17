# パッチ責務マップ（Ver.219 基準）

## 目的

この文書は、業務管理ボードに残るバージョン別CSS/JSを、古さではなく**現在の責務・依存関係・変更リスク**で整理する台帳です。実行時の正本は `release-manifest.js`、機械可読な責務分類の正本は `patch-responsibilities.json` です。

Ver.219では動的CSS **21本**を維持し、`stable-fixes-v108.js` のactive runtime退役により動的JSは **34本→33本**へ減少します。

## 基盤整理の到達点

- Ver.194〜214: version、状態削除保護、Today、状態タブ、schedule label、date input、Observer、style/native hidden責務を段階的に単独所有へ整理。
- Ver.215: コメント返信スレッドを追加し、リアクション紐付けをcomment ID正本へ強化。
- Ver.216: コメント入力フォームの暗黙grid列生成を修正。
- Ver.217: ユーザー向け「スター」表記を「お気に入り」へ統一。
- Ver.218: モバイルのリアクションpickerを押したコメント位置へ戻した。
- **Ver.219: Today意味論を `app.js` の正本描画へ統合し、`stable-fixes-v108.js` をactive runtimeから完全退役。**

## Todayの現在境界

### `app.js`

Ver.219からTodayのデータ・意味論・mine判定を一括所有します。

- 現在roomの `state.tasks` / `state.schedules` を正本として使用。
- Todayタスクは完了済みと「保留」をDOM生成前に除外。
- mine時は既存正本 `isCurrentUserOrGroupAssignee()` を使用。
- 共有担当は固定文字列ではなく現在の `state.roomName`。
- Today予定も同じmine述語を使用。
- 空き時間候補から「確認待ち」をDOM生成前に除外。
- `data-v108-hidden` の後処理は使用しない。

### `stable-fixes-v108.js`

Ver.219ではactive assetではありません。

- `requiredAssets` / `dynamicScripts` から退役。
- Ver.218以前をキャッシュしているブラウザへの互換性のため、物理ファイルだけを残す。
- 新しい機能や責務を追加しない。

### `ui-core-density-v188.css`

- Today / Schedule presentationを継続所有。
- `#todayView [data-v108-hidden]` の最終非表示ルールはVer.219で退役。

## 残るfoundation所有者

- 状態タブ表示・保護・横スクロール: `mobile-fixes.js`
- 日付入力: `date-keyboard-fix-v127.js`
- schedule `7日間`: `schedule-today-lock-v129.js`
- 一覧ソート: `list-sort-v131.js`
- version表示: `release-manifest.js` + `version-display-lock.js`

`patch-responsibilities.json` の `legacy-foundation` には、activeな上記4スクリプトだけを登録します。stableは台帳のactive assetからも除外します。

## コメント・お気に入りの境界

Ver.219では変更しません。

- コメント返信・リアクション: `comment-reactions-v191.js` / `ui-comment-reactions-v191.css`
- コメント通知: `inbox-events-v183.js`
- コメントフォーム1列: `ui-task-detail-responsive-v192.css`
- お気に入り保存・filter: `app.js`
- お気に入り表示補正: `user-ux-polish-v208.js`

## Ver.219の安全網

- static contractでTodayの3つの正本条件を固定。
  - 保留除外 + mine正本述語
  - Today予定のmine正本述語
  - 空き時間の確認待ち除外
- manifestに `stable-fixes-v108.js` がrequired/dynamicとして存在しないことを固定。
- stable物理ファイルはキャッシュ互換用に残ることを固定。
- `data-v108-hidden` が `app.js` / `ui-core-density-v188.css` に残らないことを固定。
- Browser回帰で非mine / mine / mine解除、共有ルーム担当、旧固定名担当、他担当、保留、確認待ち、Today予定を実製品コードのまま確認。
- Firebase書込・revision・transactionは変更しないため既存Emulator回帰を全件維持。

## 変更しないもの

- タスク / ToDo / スケジュール / 業務メモの保存モデル。
- Firebase書込・revision・transaction。
- mobile status tabの横スクロール。
- date keyboard。
- schedule label。
- version-display-lock。
- コメント返信・リアクション・メンション・通知。

## 復旧地点

- Ver.218正式main: `efa609079fdf45a337d5fae86e389d265333d383`
- Ver.219監査後main: `b5be835489360cd4417403a70f9b0943cd0e47b1`
- `backup/ver219-audits-before-stable-retirement`: 製品反映前の復旧地点。

## 次工程

Ver.219正式確定後は、stable退役後にactiveで残る `date-keyboard-fix-v127.js`、`schedule-today-lock-v129.js`、`list-sort-v131.js`、`version-display-lock.js` を監査し、追加退役または機能所有名への整理が可能かを確認します。
