# Community Map Maker

OpenStreetMapのOverpass APIやGoogle Spreadsheetのデータを地図上に表示し、設定ファイルを編集してさまざまなコミュニティマップを作成できるWebアプリです。

## ローカルでの確認

静的Webサイトのため、リポジトリのルートでHTTPサーバーを起動して確認できます。

```bash
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000/` を開いてください。

## 追加機能

サイドバー操作、共有URL、経路検索、投稿API・スキーマ対応、更新情報、敷地と地物の関連付け、検索、設定ベースの3D表示を利用できます。

従来の `google.AppScript` / `google.targetName` は起動時に `activity` 設定へ対応付けるため、設定ファイルの移行は不要です。
明示した `activity` 設定がある場合はそちらを優先します。新しいJSON APIを利用する場合は、例えば次の設定を `data/config-user.jsonc` に追加できます（URLは自分のサーバーへ変更してください）。

```json
"activity": {
    "url": "https://example.com/api/activities.php?app=my-map",
    "authMode": "basic",
    "targetName": "activity"
}
```

`news`、`changes`、`intro`、`areaFeatureLinker`、`areaSearch`、`discovery`、`listActions`、`feature3d`、`directions` は、未設定の場合は無効です。
利用したい機能に `"use": true` と、その地図に合う設定を追加してください。
例えば経路検索は `"directions": { "use": true }` で有効になります。
敷地の関連付けは `areaFeatureLinker.areaTargets` / `featureTargets` に既存のOverpass対象名を指定し、一覧の `list.views` / `listTable.viewBindings` も設定します。
3D表示は `feature3d.models` / `rules` に任意のモデルURLとタグ条件を指定します。

## テスト

リポジトリのルートで、Node.jsの標準ライブラリだけを使う回帰テストを実行できます。

```bash
node tests/run.cjs
```

## 主な設定

* `data/config-user.jsonc`: 初期表示、サイドバー、一覧、外部データ、メニュー
* `data/config-system.jsonc`: Overpass API、背景地図、共通表示設定
* `data/overpass-custom.jsonc`: 表示するOSM地物
* `data/category-ja.jsonc` / `data/category-en.jsonc`: カテゴリ名
* `data/marker.jsonc`: マーカー画像の対応
* `data/glot-custom.jsonc`: サイト固有の表示文言
* `manifest.json`: 読み込むCSS、JavaScript、Analytics ID

マーカー画像は `icon/` に配置します。静的GeoJSONを利用する場合は `data/config-user.jsonc` の `static` を設定してください。

`map.zoomMessageThreshold` は「もっとズームしてください」を消すズームレベルです。POI自体の取得・表示開始ズームは、従来どおり `poiView.poiZoom` と `poiView.mobilePoiZoom` で対象ごとに設定します。

## データ取得

地図を移動すると、周辺の施設をOverpass APIから取得します。取得中も地図を操作でき、インジケータで進捗を確認できます。起動に失敗した場合は、再読み込みボタンを表示します。

大量の施設データによる動作の遅延を抑えるため、保持件数に上限があります。必要に応じて `data/config-user.jsonc` の `poiData.maxFeatures` と `poiData.pruneThreshold` で調整できます。

## インドア表示

`data/config-user.jsonc` の `indoor.use` を `true` にすると、OSMの階数データに応じて施設や建物内の部屋・通路を階別に表示できます。表示には、その場所の施設や屋内地物がOSMに登録されている必要があります。

階数表示をタップ・クリックして階を切り替えます。キーボードでは上下キーで候補を移動し、Enterで確定できます。選択した階は共有URLにも保存されます。表示対象の施設や屋内地物がない階は選択できません。

OSMの `level=0` は1Fとして表示します。階数未設定の施設も1F扱いです。実際の階を区別するには、元データに階数を登録してください。

基本的な設定は次のとおりです。

* `indoor.defaultLevel`: 最初に表示するOSM階番号（`0` は1F）
* `indoor.control`: 階数表示と共有URLの設定
* `data/overpass-custom.jsonc` の `osm.indoor`: 取得する屋内地物と表示スタイル

その他の設定項目は [data/config-user.jsonc](data/config-user.jsonc) を参照してください。

## 更新履歴

* 2026/08/24 起動処理、Overpass取得・キャッシュ、POI保持上限、階層・インドア表示を改善
* 2026/10/08 サイドバー操作と共有URLを改善し、経路検索、投稿API・スキーマ対応、更新情報、敷地と地物の関連付け、検索、設定ベースの3D表示を追加
* 2026/10/08 階数判定の不要な計算を削減し、地図のドラッグ・ズーム時の描画負荷を軽減
* 2026/10/08 インジケータを階数表示の上へ配置し、表示内容の高さに応じて位置を調整
* 2026/10/08 階数未設定の施設がある場合、階層表示中も1Fを選択できるよう修正
