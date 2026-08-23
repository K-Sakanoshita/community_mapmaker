# Community Map Maker

OpenStreetMapのOverpass APIやGoogle Spreadsheetのデータを地図上に表示し、設定ファイルを編集してさまざまなコミュニティマップを作成できるWebアプリです。

## ローカルでの確認

静的Webサイトのため、リポジトリのルートでHTTPサーバーを起動して確認できます。

```bash
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000/` を開いてください。

## 主な設定

* `data/config-user.jsonc`: 初期表示、サイドバー、一覧、外部データ、メニュー
* `data/config-system.jsonc`: Overpass API、背景地図、共通表示設定
* `data/overpass-custom.jsonc`: 表示するOSM地物
* `data/category-ja.jsonc` / `data/category-en.jsonc`: カテゴリ名
* `data/marker.jsonc`: マーカー画像の対応
* `data/glot-custom.jsonc`: サイト固有の表示文言
* `manifest.json`: 読み込むCSS、JavaScript、Analytics ID

マーカー画像は `icon/` に配置します。静的GeoJSONを利用する場合は `data/config-user.jsonc` の `static` を設定してください。

## インドア表示

`data/config-user.jsonc` の `indoor.use` を `true` にすると、建物内の部屋、壁、出入口、階段、エレベーター、通路とPOIを階別に表示します。`indoor=corridor` と `highway=corridor` の両方に対応し、`level` の単一値、セミコロン区切り、数値範囲、`repeat_on` を解釈します。`level` のないPOIはOSMの `level=0` と同じ1F扱いです。

インドア表示への切り替えは、通常は `poiView.poiZoom.indoor`、モバイルは `poiView.mobilePoiZoom.indoor` のズームレベルを使います。地図中央にある建物を基準とし、小規模な建物は `indoor.buildingGroup` の面積・距離条件で複数棟をまとめて表示できます。地下POIがある場合は `indoor.underground` の条件で建物を選択していなくてもインドア表示に入れます。画面を覆う大規模建物は、負荷を抑えた建物先行判定を行い、`indoor.largeBuildingActivation` の条件でズーム17から表示できます。

インドア表示へ入る時や対象が変わった時は `indoor.defaultLevel` に戻ります。階数切り替えはベース地図一覧の下に固定表示され、地下は `BF`、1〜10階は `0x`、11〜20階は `1x` のように階層を選択します。地下がある時は `BF` でB1、`0x` で1F、`1x` で11Fを最初に選択します。POIがない階はボタンを無効化し、選択できない色で表示します。表示中の階は `indoor.control.urlParameter` で指定したURLパラメーターにも保存されます。

建物輪郭には `building=*` のwayを使用します。表示階が `building:levels`、建物高さから求めた階数、または建物内POIの最高階を超えた場合、その建物の輪郭は表示しません。インドア用の面・線・点は表示専用で選択できません。POIマーカーは対象建物群と選択階に合うものだけを表示し、インドア時はマーカー名の階数表記、重複するOSM点名、2F以上で使う影レイヤーを非表示にします。また、`poiView=false` の対象は施設リストにも表示しません。

主な設定項目は次のとおりです。

* `indoor.defaultLevel`: インドア表示開始時のOSM階番号
* `indoor.floorHeightMeters` / `floorOffsetMeters` / `floorThicknessMeters`: 傾斜表示時の階高、1階のオフセット、床の厚み
* `indoor.fallbackLevels`: `level` がない特定タグへ補う階番号
* `indoor.buildingGroup`: 小規模建物をまとめる面積、距離、屋内POI必須条件
* `indoor.underground`: 建物未選択時に地下施設からインドア表示を開始する条件
* `indoor.largeBuildingActivation`: 大規模建物を低いズームから判定する条件
* `indoor.levels`: データからの階数検出と階順
* `indoor.control`: 階数切り替えUIとURLパラメーター

取得対象と描画色は `data/overpass-custom.jsonc` の `osm.indoor` で設定します。`expression.poiView` と `expression.listView` はインドア地物そのもののマーカー・リスト表示を制御し、`expression.styles` で部屋、通路、壁、建物輪郭、扉の色や線幅を変更できます。

## 経歴

* 2020/11/23 開発開始
* 2021/04/07 「大阪思い出のこしマップ」をリリース
* 2021/08/05 「くさつお宝マップ」をリリース
* 2021/10/02 「図書館年表マップ」をリリース
* 2022/03/04 「Open History & Culture Map」をリリース
* 2022/05/02 「設備管理MAP(デモ)」をリリース
* 2023/01/25 「遊具のある公園マップ(β版)」をもとに本家を更新
* 2024/05/18 「東淀川区新歓祭マップ2024」をもとに本家を更新
* 2026/08/22 「長浜城下町遺産マップ」の実装をもとに本家を更新
