# openhc-map 共通更新の取り込み

- 取り込み日: 2026/11/08
- 参照元: [armd-02/openhc-map](https://github.com/armd-02/openhc-map)
- 参照コミット: [`60bed722ad749e09b33cb51de6765baea1a6ca5e`](https://github.com/armd-02/openhc-map/commit/60bed722ad749e09b33cb51de6765baea1a6ca5e)
- 取り込み前の Community Map Maker: `8526f8c62c310871a744d88c7f1b181be2d98e7f`

両リポジトリに共通のGit祖先がないため、ファイルの内容を比較して共通の変更を取り込んだ。

## 反映した内容

- `lib/listtable.js`: 列設定の `valueGlotPrefix` による項目値の翻訳。複数値と未翻訳値にも対応。施設名をカテゴリで補う場合にもアイコンを保持。
- `data/glot-custom.jsonc`: 宗教・宗派・年代のラベルと宗教・宗派の翻訳を追加。既存ラベルは保持。
- `lib/winlib.js`: 画像URL・Wikimediaの取得失敗時にサムネイルを除去し、全画像が失敗した場合は欄を非表示にする。古い要求の失敗で新しい画像欄を隠さない。
- `system.css`: 詳細メニューの切り取りを防止し、一覧のカテゴリ行を名称と同じ列に配置。
- `data/category-{ja,en}.jsonc`: `historic=manor/stone` の既存訳語を参照元に合わせて更新。その他のカテゴリは保持。
- `index.html`: CSSとスクリプトのキャッシュ更新番号を変更。
- 回帰テスト: 項目値翻訳・名称補完とアイコン、サムネイル失敗、地図装飾を検証するテストを取り込み。

参照元の歴史地図専用の一覧列設定は `tests/fixtures/openhc-listtable.jsonc` に保持し、共通エンジンのテストに使用する。実際の一覧設定は変更していない。

## 既存設定を維持した内容

サイト名、初期位置、投稿先、Google Analytics ID、取得対象、一覧列、配色、スプラッシュ・OGP画像は既存設定を維持した。参照元で削除されたイベント画像や `circle_marker.png` も、このサイトの参照や既存資産を保つため削除していない。

Overpassの優先URLは既に参照元と同じ `/api/interpreter` を使用している。既存の予備接続先、背景地図のキーと構成は保持した。背景地図の表示名も既に参照元相当の説明があるため変更していない。

## 検証

`node tests/run.cjs`: 67/67 成功。名称補完・翻訳、画像取得失敗や遅延した失敗通知などの動作を回帰テストで確認。ブラウザでの実表示確認は未実施。
