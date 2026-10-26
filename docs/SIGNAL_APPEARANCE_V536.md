# SIGNAL 表示モード・互換性設計（Ver.535–536）

## 目的と採用ルール

現行Release 304の業務機能を壊さず、ユーザーがクラシック/SIGNALを選択できる。
SIGNALに限り「ブライト（明色）」と「ミッドナイト（暗色）」を選ぶ。
既存ユーザーへの初期値はクラシック。旧デザインのCSS、アイコン資産、既存ナビゲーションを削除しない。

## 正本と所有者

| 資産 | 所有 | 変更範囲 |
|---|---|---|
| ui-design-d3l-v535.css | SIGNALと設定UIの見た目 | 新デザイン選択時の視覚表現のみ |
| ui-preferences-v536.js | 表示選択と端末内保存 | Firebase不使用。room/user毎にlocalStorage |
| index.html | 設定入口とdialogの静的DOM | 既存のユーザー・状態・分類管理画面へ委譲 |
| dialog-lifecycle-v239.js | 既存のdialog後方クリック制御 | wbSettingsDialogだけ明示的に追加 |
| release-manifest.js | 304のRelease資産正本 | CSS/JSを各1回登録。motion→mobile shell末尾の順を保護 |
| patch-responsibilities.json | 動的資産台帳 | 2つの独立した所有者を登録 |

### 個人設定の境界

- キー: \`work-board-appearance-v536:<encode(room)>:<encode(user)>\`
- 値: \`{"design":"classic"|"signal","tone":"bright"|"midnight"}\`
- 同じブラウザの同じルーム・選択ユーザー単位。異なる端末間では自動同期しない。
- 現行ユーザー名のローカル選択を参照するもので認証権限は変えない。
- 不明値、不正JSON、未保存はクラシック/ブライトへ戻す。
- 旧デザインを選択したときは新CSSが既存DOMへ作用しないようスコープを設定。

## 既存機能の保護

- ToDo追加フォームは、製品の\`renderTodoView\`にて元々リスト上にある。位置や保存イベントは変更しない。新デザインの試作HTMLのみこの構成へ修正。
- スケジュールの「一覧／月カレンダー」は既存\`renderScheduleView\`の正本としてそのまま使用する。
- 今日パネルの表示順、ユーザー別の並べ替え・上下ボタン、ドラッグ代替を変更しない。
- Firebaseデータ・ルール・接続・保存スキーマ、タスク/ToDoの編集・削除を改修対象に含めない。
- 既存SVGアイコンを上書きしない。表示用filterはnone。
- 新テーマでのみ装飾的な副題を非表示。重要なユーザー案内は残す。

## 作業用評価ゲート

1. ProtocolとRelease Contract、Browser回帰、Firebase Emulatorが成功。
2. 旧デザインの既存Visual Snapshotが変わらないこと。
3. SIGNAL/ブライト・ミッドナイトの両方で主要画面を確認。1366×768、1920×1080、390×844、320×800を重視。
4. ToDoの追加・並べ替え・完了、カレンダー/一覧切替、詳細dialog、設定・ユーザー変更を実際に確認。
5. PR同一HEAD成功の後にmainへ統合し、mainおよびPagesの同一SHA成功を別途確認。
6. 旧見た目維持のため新モードは初期値クラシック。公開後の利用者による選択は段階的。

## リポジトリ整理・削除方針

- 追加した実行ファイルはCSSとJSの2本。機能ごとの派生CSSを増殖させない。
- 根拠なく古いJS/CSSを削除しない。旧HTML/キャッシュ済みURLとの互換がある。
- 退役候補ごとに \`requiredAssets\`/\`dynamicStyles\`/\`dynamicScripts\`、DOM/JS参照、旧URL互換、およびPlaywright/Pages payloadを照合。
- 安全に退役可能なものは従来の\`asset-retirement-inventory-v379\`等の方式で別PRとし、実体ファイルと公開互換エイリアスを区別。
- タスク管理デザインと旧資産退役を同一PRで混在させず、切り戻せる変更単位を維持する。

## 残る工程

このPRは選択機能とSIGNALの視覚基盤であり、D3モックの全てのDOM再配置を完了したものではない。運用中パネル順・各フォームの既存挙動と衝突する箇所は、独立した視覚検証PRで後から移植する。完了と誤記しない。
