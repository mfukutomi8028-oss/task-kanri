# Ver.486 — 旧サイドバー画像ベースラインの物理整理（Issue #292 / Stage D）

## 起点と結論
確定済みVer.485 main `a142a177ca0fdc536c9540fdc4ca49fdacc2cc86` を起点とする。追跡対象はGitの実ファイル535件、合計16,740,973バイト。スクリーンショットは6スイート・58件。

`tests/sidebar-visual.spec.mjs` はサイドバーのPNG比較を廃止済みで、デスクトップ幅1366/981/980/861、非デスクトップ境界860、detail-open、collapsed/expanded/pinnedの寸法と表示状態を検査する。ブランド画像の更新で旧サイドバー全体画像が不要な差分を発生させるため、現行仕様ではPNGベースラインを参照しない。画像検証は独立した `tests/icon-visual.spec.mjs` が担当する。

他の5件の画像比較スイートには引き続き `toHaveScreenshot` が存在し、画像50件を保持する。今回の削除は現行の画面テストやアプリの動作範囲を縮小しない。

## 退役する旧PNG（8件 / 564,357バイト）

すべて `tests/sidebar-visual.spec.mjs-snapshots/` 配下。Gitのファイル名別logical bytesを合計した数値であり、Git履歴・Gitオブジェクトの実容量削減値ではない。

| 旧ファイル名 | バイト | 元Git blob SHA-1 |
|---|---:|---|
| sidebar-1366-collapsed-linux.png | 39,792 | `592dce9f280142be31c7dffc75f19b8db5b969d4` |
| sidebar-1366-expanded-linux.png | 93,394 | `275232447a34977d3fcc032a2857ab16eb2172e2` |
| sidebar-1366-pinned-linux.png | 82,407 | `62a09d7a7f2f904cd80fbd5299b3ef04fcf05040` |
| sidebar-861-collapsed-linux.png | 39,792 | `592dce9f280142be31c7dffc75f19b8db5b969d4` |
| sidebar-861-expanded-linux.png | 93,394 | `275232447a34977d3fcc032a2857ab16eb2172e2` |
| sidebar-980-collapsed-linux.png | 39,792 | `592dce9f280142be31c7dffc75f19b8db5b969d4` |
| sidebar-980-expanded-linux.png | 93,394 | `275232447a34977d3fcc032a2857ab16eb2172e2` |
| sidebar-980-pinned-linux.png | 82,392 | `1f9badfac0f346379b3a421cd362c840929b3c1e` |

8パスの内容は4種類のGit blobで、重複を取り除いた原本サイズ合計は297,985バイト。過去の復元は上記の固定Ver.485コミットと元パスから可能。

## 安全性と今後の整理方針
- 新規Protocol `test-harness/sidebar-snapshot-retirement-v486.test.mjs` は旧ディレクトリの不存在、現役サイドバー寸法テストの存続、画像ベースラインが現役Playwrightスイート5件・50ファイルに属することをチェックする。
- 現行ルートJS/CSSはmanifest宣言済みのものが中心で、`config.example.js` は開発用に残す。PNGは旧ブラウザURLや同一バイトのPages配布契約を持つため、サイドバーのテスト用PNGと混同して削除しない。
- 製品のHTML/JS/CSS、manifest、Release304、Firebase writer/Auth/Rules、Pages構築、業務データは無変更。旧PNGのGit履歴は保持し、Pages公開物には元々含まれない。
- 実行時パス生成、外部参照、古いキャッシュの不存在は静的検索から証明できない。今回の削除可否は「現役テストがこの専用フォルダの画像を消費しない」ことに限定する。

## 完了ゲート
Draft PRでProtocol / Browser (1) / Browser (2) / Firebase Emulator / Regressionのexact-head全成功を確認し、expected-head指定でmainにマージ。その後、main同一SHAのRegressionとPages build/deployが全成功した場合のみ復旧checkpointを確定する。完了前は正式版として扱わない。
