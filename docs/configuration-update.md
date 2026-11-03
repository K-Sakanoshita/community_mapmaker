# 2026-11-03 設定更新

取り込み元: armd-02/HigayodoStreetMap2026 `85aa48a2eab03b1e0e5dcb801905f60171adba72`。

`data/config-user.jsonc` は最新版の全項目を基に既存の汎用設定を統合しています。
設定はJSONCとして読み込まれます。従来のGoogle Apps Scriptにも接続できます。

| 項目 | 用途・初期状態 |
| --- | --- |
| `activity.url/authMode/targetName` | Activity API。URLは空、認証方式は従来互換の `legacy`。バックエンドAPIを使う場合はURLと `basic` を指定 |
| `activity.local` | localhost用のAPI切り替え。無効、URLは空 |
| `feature3d` | タグ別の3D表示。有効。モデル定義、表示ルール、読込設定をすべて同梱 |
| `mapIllustrations` | 固定座標の画像表示。無効、配置リストは空。描画・影・枚数などの設定は同梱 |
| `mapDisplayStatus.use` | 地図の状態表示。無効 |
| `siteUpdates.use` | サイト更新案内。無効 |
| `news/changes/intro` | ニュース、新着、初回案内。各 `use: false` |
| `areaFeatureLinker/areaSearch` | 面地物の関連付け、地域検索。各 `use: false` |
| `discovery/listActions/directions` | 発見、一覧アクション、経路案内。各 `use: false` |
| `icon.flagPath` | 国旗の画像パス。`./flags/w40` |
| `poiView.poiFilter` | POI表示フィルタ。`all` |
| `listTable.nameFallback/height` | 名称がない場合の代替表示、一覧の高さ。最新版の設定を追加 |
| `google.Analytics` | 空。アクセス解析IDは `manifest.json` も空 |
| `wikipedia.image` | Wikipediaの画像表示。有効 |
| `map._maxBounds` | 廃止済みの無効な旧項目を削除。現在の `map.maxBounds` を使用 |

サイト名、初期位置、表示範囲、起動画像、開発サイトURL、施設一覧のタグ表示は従来の汎用設定です。
`indoor.use` は従来どおり有効で、屋上ラベルと階の設定も保持しています。
初期背景は従来どおり `tiles/osmfj_nopoi.json` です。

`data/config-activities.jsonc` には従来の `sample` と取り込み元の投稿項目定義を同梱しています。
祭典専用の定義は、取得先が未設定のため使用されません。
汎用のOSM取得対象を維持し、最新版の緑地・交通案内板などの取得定義を追加しています。

新着・検索等の詳細は [検索と新着情報](search-and-updates.md) を参照してください。
装飾配置の例は [地図イラスト](map-illustrations.md) と
`tests/fixtures/map-illustrations.json` に残しています。
イラスト、ロゴ、背景パターンは `image/` と `moto_data/加工/` に同梱しています。

3Dモデルは `assets/models/`、テクスチャは各モデルのサブディレクトリにあります。
コードのMITライセンスと、各画像・モデル等の提供元ライセンスは区別して確認してください。
