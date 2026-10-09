# 業務管理ボード — 開発ガイド

**現在の正本は [ルートREADME](../README.md) です。** 機能、開発環境、試験手順、セキュリティ上の注意、整理計画はそちらをご覧ください。

リリース番号は `release-manifest.js` の `WORK_BOARD_RELEASE.version`、責務台帳は `patch-responsibilities.json` の `baselineRelease` を参照してください。HTML内の `Ver.143` や一部の `?v=143` は旧ブラウザとの互換性を保つ初期プレースホルダーで、現在の公開リリース番号とは異なります。初回表示時にmanifestから現行番号へ同期されます。

リリースチェックは `release-check.ps1`（Windows PowerShell 5.1 / PowerShell 7）から既存のNodeリリース契約テストを実行します。直接 `npm run test:protocol` で関連契約を含む全Protocolを実行することもできます。公開前にはブラウザ・Firebase Emulatorの回帰テストも通してください。

過去のVer.1〜141までの更新履歴は、[以前の.github/README.md（Gitの固定コミット）](https://github.com/mfukutomi8028-oss/task-kanri/blob/500c5f2c785fc65845c68fb5d5b608bd340888a9/.github/README.md) に保存されています。古い手順・更新番号を現行の運用正本として使わないでください。

セキュリティ上、現状の共有ルームやFirebase設定を認証・権限管理の代替とみなさず、患者情報・機密情報は保存しないでください。
