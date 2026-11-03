# Community Map Maker

OpenStreetMapのOverpass APIやGoogle Spreadsheetのデータを地図上に表示し、設定ファイルを編集してさまざまなコミュニティマップを作成できるWebアプリです。

## 最新版の取り込み（2026-11-03）

[HigayodoStreetMap2026](https://github.com/armd-02/HigayodoStreetMap2026) の
コミット `85aa48a2eab03b1e0e5dcb801905f60171adba72`（2026-10-31 JST）を取り込みました。
無効な機能も含めて全コードと全アセットを同梱しています。取り込み元の記録は
[元のREADME](docs/upstream-higayodo.md)、設定変更は [最新版の設定](docs/configuration-update.md) を参照してください。

サイト名・初期位置・OSM取得対象・サンプル投稿定義は汎用サイトの設定を維持しています。
祭典専用のAPI接続と固定座標の装飾は無効ですが、その実装・モデル・画像も同梱しています。
既存の屋上表示、駐車場カテゴリ、インドア表示の拡張も保持しています。

`node tests/run.cjs` で回帰テストを実行できます。

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

`map.zoomMessageThreshold` は「もっとズームしてください」を消すズームレベルです。POI自体の取得・表示開始ズームは、従来どおり `poiView.poiZoom` と `poiView.mobilePoiZoom` で対象ごとに設定します。

## 起動とOverpass取得

初期HTMLにスプラッシュと進捗を直接配置し、外部CSSとJavaScriptを並列に読み込みます。地図と操作UIの準備が完了した時点でスプラッシュを閉じ、その次の描画フレームからOverpassによる周辺データ取得を開始するため、データ取得中も先に地図を操作できます。読み込み失敗時はスプラッシュに再読み込みボタンを表示します。

Overpassのダウンロード中は受信量を0.1MB単位で `Loading...` に表示します。HTTP 408/425や一時的な応答異常は同じサーバーで一度再試行し、HTTP 429、5xx、タイムアウトなどは別の設定済みサーバーへ切り替えます。構文・クエリエラーに相当する4xxは別サーバーへ送っても改善しないため、そのまま終了します。429を返したサーバーにはクールダウンを設けます。

動的取得のキャッシュはズーム14のタイル範囲と取得対象の組み合わせで管理します。画面の中心、表示範囲、ズーム、傾き、方角が同じ連続更新だけを重複処理として抑止し、地図を別地域へ移動した場合は新しい範囲をOverpassから取得します。

## 取得後の更新処理

一覧の元データ・行DOM・マーカーソースを差分更新し、同じ内容の再処理を省きます。取得キャッシュの方式は従来どおりです。詳細は [差分更新と性能](docs/render-performance.md) を参照してください。

## POIデータの保持上限

動的なOverpass取得では、`data/config-user.jsonc` の `poiData.maxFeatures` を`pdata`の保持上限、`poiData.pruneThreshold` を整理開始件数として使います。既定では15,000件を超えた時だけ現在地に近い12,000件へ整理し、毎回の追加時には全件ソートしません。表示中の詳細POIとActivityに紐づくPOIは優先して保持します。データ整理後はタイルの取得済み判定を無効化し、同一の表示範囲・中心座標・ズーム・傾き・方角で続けて発生する重複更新だけを抑止します。地図を移動した場合はOverpassから取得し直します。`poiData.applyToStatic` が `false` の場合、静的データには上限を適用しません。

## インドア表示

`data/config-user.jsonc` の `indoor.use` を `true` にすると、建物内の部屋、壁、通路とドアを階別に表示します。`indoor=corridor` と `highway=corridor` の両方を通路として扱い、`highway=corridor` に `level` がなければ1Fとして表示します。インドアの面地物は塗りつぶさず、部屋・通路・共用エリアを輪郭線と名称で描画します。`level` の単一値、セミコロン区切り、数値範囲、`repeat_on` を解釈します。`level` のないPOIはOSMの `level=0` と同じ1F扱いです。

`poiView=true` の取得対象に属する `level=*` または `location=roof` 付きPOIが画面内にあり、その対象の `poiView.poiZoom` / `mobilePoiZoom` に達した場合は「階層表示」とし、階選択と階別表示を有効にします。低ズームでは、画面内に部屋・通路や階タグ付きPOIがあっても階数選択を表示しません。設定した `indoor=room/area/corridor/wall` または `highway=corridor` がある場合を「インドア表示」とし、部屋、通路、壁などを表示します。どちらの状態でも背景3D建物の不透明度は変更しません。建物を使う従来判定では通常は `poiView.poiZoom.indoor`、モバイルは `poiView.mobilePoiZoom.indoor` のズームレベルを使います。小規模な建物は `indoor.buildingGroup` の面積・距離条件で複数棟をまとめられ、画面を覆う大規模建物は `indoor.largeBuildingActivation` の条件でズーム15から判定できます。

階層表示へ初めて入る時は、URLに `indoor.control.urlParameter` の階指定があればその値を優先し、未指定なら `indoor.defaultLevel` を使います。詳細URLを開き直した場合や再読み込みした場合も指定階を保持します。指定階が対象データにない場合は、表示可能な最初の階へ切り替えます。階数切り替えは開始時から5段の縦スクロール式階選択を展開し、現在階だけを表示する折りたたみボタンは置きません。階の選択肢をクリックまたはタップすると即時に切り替わり、続けて別の階を選べます。`location=roof` のPOIがある場合は数値階の後ろに「屋上」を追加し、選択時は屋上POIだけを表示します。フロアを変更すると、選択中のPOI、詳細表示、地図上の選択強調を解除します。マウスホイール、スワイプ、上下キーは候補を移動するだけで、スクロール終了時には確定しません。キーボードではEnterで中央候補を確定できます。POIがなくても部屋、通路、壁などのインドア地物がある階は選択でき、POIとインドア地物のどちらもない推定階は薄く表示して選択不可にします。表示中の階はURLにも保存されます。

階数推定用の建物形状は `indoor.buildingSource` で指定したベクタータイルの `building` レイヤーだけから取得します。現在の背景地図に同じソースがあれば再利用し、ラスタースタイルでは判定専用の非表示ソースを追加します。建物形状は地図には描画せず、`render_height` を3.66m/階で四捨五入して最高階を推定します。地物に推定値を超える `level` がある場合は、明示された階を優先して階選択を延長します。Overpassからは建物way・relationを取得しません。インドア用の面・線・点は表示専用で選択できません。`indoor` 描画の対象は `data/overpass-custom.jsonc` の `expression.renderTags` で設定し、標準では `indoor=room/area/corridor/wall` または `highway=corridor` の面・線を輪郭表示し、Pointの青点は `door=*` または `indoor=door` を表示します。POIアイコンと施設リストへの掲載は各取得対象の `poiView` / `listView` に従い、階層表示中も `poiView.poiZoom` / `mobilePoiZoom` のズーム条件を維持します。POIマーカーと施設リストは選択階に合うものだけを表示し、インドア時はマーカー名の階数表記、重複するOSM点名、2F以上で使う影レイヤーを非表示にします。

主な設定項目は次のとおりです。

* `indoor.defaultLevel`: インドア表示開始時のOSM階番号
* `indoor.floorHeightMeters` / `floorOffsetMeters`: 傾斜表示時の階高（標準3.66m）と1階のオフセット。階別の輪郭・名称は階空間の中央高を基準にし、見分けやすくするため画面上の浮上量を2倍に補正
* `indoor.backgroundTransportationOpacity`: インドア表示中のベクタータイル上のレール、プラットフォーム、`highway=footway` の不透明度（標準0.08、終了時は元の値へ復元）
* `indoor.buildingLevelHeightMeters`: ベクタータイルの建物高さを階数へ戻す換算値
* `indoor.buildingSource`: 階数推定に使う建物タイルソース、ソースレイヤー、高さ属性
* `indoor.fallbackLevels`: `level` がない特定タグへ補う階番号
* `indoor.buildingGroup`: 小規模建物をまとめる面積、距離、屋内POI必須条件
* `indoor.underground`: 建物未選択時に地下施設からインドア表示を開始する条件
* `indoor.largeBuildingActivation`: 大規模建物を低いズームから判定する条件
* `indoor.levels`: データからの階数検出と階順
* `indoor.control`: 階数切り替えUIとURLパラメーター

取得対象と描画色は `data/overpass-custom.jsonc` の `osm.indoor` で設定します。`expression.poiView` と `expression.listView` はインドア地物そのもののマーカー・リスト表示を制御し、`expression.styles` で部屋、通路、壁、扉の色や線幅を変更できます。

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
* 2026/11/03 「HigayodoStreetMap2026」の最新版をもとに、設定・全機能・3Dモデル・画像を更新

## 主な更新履歴

Community Map Makerと、同じコードをもとに開発している各マップの機能面の履歴です。
日付は各リポジトリの更新履歴に記載された開発・公開日で、本家への取り込み日とは異なります。
各項目のリンクから元の記録を確認できます。データの追加・更新やイベントの告知は省いています。

### 2021年〜2022年

* 2021/03/28 GoogleスプレッドシートのデータとOSMの位置情報を組み合わせた地図表示に対応。Overpass APIによる取得と、取得済みOSMデータの静的ファイル読み込みを実装（[大阪思い出のこしマップ][history-osaka]）
* 2022/03/05 アート作品の表示に対応（[みんなの歴史文化マップ][history-historyculture]）
* 2022/03/10 敷地を面として地図上に表示する機能を追加（[みんなの歴史文化マップ][history-historyculture]）
* 2022/04/13 Wikipedia記事の画像表示、選択カテゴリを含めたURL共有、地物アイコン・種類名の拡充に対応（[みんなの歴史文化マップ][history-historyculture]）
* 2022/08/03 詳細情報の表示速度と読みやすさを改善（[大阪思い出のこしマップ][history-osaka]）
* 2022/09/08 案内板のカテゴリ選択を追加し、Facebook経由でリンクを開けない問題を修正（[みんなの歴史文化マップ][history-historyculture]）
* 2022/10/02 表示待ち時間を短縮し、ズーム別の地物表示を細分化。一部の地物が表示されない問題を修正（[みんなの歴史文化マップ][history-historyculture]）

### 2023年〜2024年

* 2023/09/26 遊具写真の表示に対応（[遊具のある公園マップ][history-playgrounds]）
* 2023/10/18 Wikimedia Commonsのファイル指定に対応（[遊具のある公園マップ][history-playgrounds]）
* 2024/01/28 詳細文の改行・URLのリンク変換を改善し、施設単位から場所の種類によるカテゴリ選択へ変更（[大阪思い出のこしマップ][history-osaka]）
* 2024/03/15 Wikimedia Commonsのクレジット表示とOverpass APIの切り替えを改善（[遊具のある公園マップ][history-playgrounds]）
* 2024/04/13 日付による表示選択機能を追加（[東淀川区新歓祭マップ2024][history-welcome]）
* 2024/04/18 PMTilesの背景地図に対応（[東淀川区新歓祭マップ2024][history-welcome]）
* 2024/07/16 空の表示と最大80度の傾斜表示に対応（[タイムマップトラベル][history-timemap]）
* 2024/08/31 敷地と地物の紐づけ処理を改善し、地図の最大傾き設定を追加（[遊具のある公園マップ][history-playgrounds]）
* 2024/12/25 UI、マルチポリゴン、Wikipedia表示、Commons画像取得を改善し、地物の種類を拡充（[遊具のある公園マップ][history-playgrounds]）

### 2025年

* 2025/01/16 建物と施設アイコンの取得時に、汎用の建物タグより施設の種類を優先する処理を改善（[みんなの歴史文化マップ][history-historyculture]）
* 2025/04/05 Overpass APIの長大クエリとWikimedia Commonsへのリクエスト、CSS・背景地図スタイルを改善（[遊具のある公園マップ][history-playgrounds]）
* 2025/05/04 検索機能を改善し、訪問済みの記録機能を追加（[万博マニアックマップ][history-expo]）
* 2025/05/06 マーカーをDOMから地図のSymbolレイヤーへ変更し、描画処理を改善（[万博マニアックマップ][history-expo]）
* 2025/05/10 POIの表現とメニュー機能を拡張し、予約の必要性を表示（[万博マニアックマップ][history-expo]）
* 2025/05/16 訪問済みの場所へのメモ、2階以上の地物の浮上表示、広場の名称、選択地物の強調表示を追加し、再読み込み時のカテゴリ保持を修正（[万博マニアックマップ][history-expo]）
* 2025/05/25 訪問履歴・メモの保存と取り込み、営業時間・トイレの収容人数・管理番号の表示を追加し、Commons写真の表示を拡充（[万博マニアックマップ][history-expo]）
* 2025/05/28 訪問履歴の取り込み時の改行処理を改善（[万博マニアックマップ][history-expo]）
* 2025/06/01 地球儀モードを追加し、訪問済みアイコンとメニューを調整（[万博マニアックマップ][history-expo]）
* 2025/06/04 地球儀の国名を日本語化し、国ごとの訪問状況、国旗、管理番号の表示に対応（[万博マニアックマップ][history-expo]）
* 2025/06/24 詳細表示をモーダルからサイドパネルへ変更し、絞り込みUIを整理（[万博マニアックマップ][history-expo]）
* 2025/07/11 PC横画面のサイドバーと地球儀を拡張し、複数国の表示、地球儀内の旗、樹木・広場の描画、選択時の強調を改善（[万博マニアックマップ][history-expo]）
* 2025/07/12 サイドバーのコンパクトモードと、2階以上の地物への階数表示を追加（[万博マニアックマップ][history-expo]）
* 2025/07/13 訪問チェック処理の不具合を修正（[万博マニアックマップ][history-expo]）
* 2025/08/11 お気に入り・訪問済みの非表示オプションを追加（[万博マニアックマップ][history-expo]）
* 2025/10/13 お気に入りのアイコン表示とメモ入力欄を改善（[万博マニアックマップ][history-expo]）
* 2025/10/19 背景地図の種類・時期を表示し、訪問状況によるアイコンの大きさを調整（[万博マニアックマップ][history-expo]）
* 2025/10/31 Wikipedia記事の表示を改善し、旗竿・国旗の表示に対応（[万博マニアックマップ][history-expo]）
* 2025/12/25 システムを軽量化しUIを改善。昼夜の雪景色と降雪表現を追加（[遊具のある公園マップ][history-playgrounds]・[万博マニアックマップ][history-expo]）

### 2026年

* 2026/01/12 路面電車が表示されない不具合と地図の読み込みを改善（[長浜城下町遺産マップ][history-nagahama]）
* 2026/04/29 Overpass APIキャッシュを導入し、障害時の自動切り替えと読み込み表示を改善（[遊具のある公園マップ][history-playgrounds]）
* 2026/06/20 Wikimedia APIキャッシュ、独自リストUI、口コミの評価・特徴、CSV出力を追加（[遊具のある公園マップ][history-playgrounds]）
* 2026/08/09 マーカー・写真・詳細表示用ライブラリの遅延読み込みと、地図初期化・GAS取得の並列化で起動を高速化（[十三新発見マップ2026][history-juso]）
* 2026/08/20 読み込み処理の安定性を改善（[長浜城下町遺産マップ][history-nagahama]）
* 2026/08/24 起動処理、Overpass取得・キャッシュ、POI保持上限、階層・インドア表示を改善（Community Map Maker）
* 2026/08/30 地図年・ズーム・都道府県に応じた全国／地域ニュースと、1日1回の起動案内を追加（[タイムマップトラベル][history-timemap]）
* 2026/08/31 ニュースのドラッグ・スワイプ切り替えとWikipedia記事リンクを追加し、起動表示を改善（[タイムマップトラベル][history-timemap]）
* 2026/09/02 敷地内の設備による検索、調査対象リスト、Activityの集約、平均評価による絞り込みを強化（[遊具のある公園マップ][history-playgrounds]）
* 2026/09/05 共通のニュース表示と起動案内を公園マップへ展開（[遊具のある公園マップ][history-playgrounds]）
* 2026/09/08 OSMの遊具を低ポリゴン3Dモデルで表示する機能を追加（[遊具のある公園マップ][history-playgrounds]）
* 2026/09/12 3D表示を遊具からベンチ・給水設備・自動販売機などにも拡張（[遊具のある公園マップ][history-playgrounds]）
* 2026/09/13 設定項目を共通化し、低ズーム時の検索、リスト操作、読み込み・ズーム案内を改善（[遊具のある公園マップ][history-playgrounds]）
* 2026/10/07 起動案内・各画面の英語対応、目的別の絞り込み、周辺・お気に入り・最近見たの切り替え、前回位置と目的の復元を改善（[遊具のある公園マップ][history-playgrounds]）
* 2026/10/07 口コミ・地図情報の更新を場所ごとに集約し、未確認・既読管理と表示範囲を限定したActivity API取得に対応。地物分類と3Dモデル表示を設定ベースで汎用化（[遊具のある公園マップ][history-playgrounds]）
* 2026/10/07 共有URLの統一、コピー結果の案内・手動コピー、経路検索へのリンクを追加し、非公開メモと公開投稿の違いを明示（[遊具のある公園マップ][history-playgrounds]）
* 2026/10/09 都道府県別の更新取得履歴・一覧の保存、お気に入りの独立した更新確認、取得失敗時の履歴保持に対応。口コミの内訳と一覧ボタンのキーボード操作を改善（[遊具のある公園マップ][history-playgrounds]）
* 2026/10/10 3D表示対象を拡充し、写真の読み込み表示とスマートフォンの詳細画面の余白を改善（[万博マニアックマップ][history-expo]）
* 2026/10/12 カテゴリ横断の「すべて表示」、検索から地図への連携、ブラウザ言語に合わせた表示を追加。写真スクロール案内・遅延読み込み・最大40枚表示、パネルのサイズ変更中の地図表示を改善（[万博マニアックマップ][history-expo]）
* 2026/10/28 固定座標の装飾画像を地図と一緒に回転・傾斜・拡大縮小して表示し、影とパネル背景を設定可能に。投稿画像とOSM画像の併用、カテゴリ変更時の地図・一覧・写真の更新を改善（[ひがよど文化祭 会場周遊マップ2026][history-higayodo]）
* 2026/10/31 新着情報の座標を使った先行移動と詳細の並行取得、欠落地物の代替Overpassサーバーからの取得に対応。更新内訳と絞り込み表示、低ズーム時のアイコン縮小を改善（[遊具のある公園マップ][history-playgrounds]・[ひがよど文化祭 会場周遊マップ2026][history-higayodo]）
* 2026/11/03 ソフトキーボード表示中のリサイズで入力フォームが再描画され、ユーザー名などを入力できなくなる問題を修正（[遊具のある公園マップの修正コミット](https://github.com/armd-02/Playgrounds/commit/ceab991d01046b866775886cc3618e1e93e9b1d5)から取り込み）

[history-osaka]: https://github.com/armd-02/OsakaMemories#更新履歴
[history-historyculture]: https://github.com/armd-02/openhc-map#更新履歴
[history-playgrounds]: https://github.com/armd-02/Playgrounds#主な更新履歴
[history-welcome]: https://github.com/armd-02/HigayodoWelcome2024#主な更新履歴
[history-timemap]: https://github.com/armd-02/TimeMapTravel_Japan#主な更新履歴
[history-expo]: https://github.com/K-Sakanoshita/expo2025-maniacs#更新履歴
[history-nagahama]: https://github.com/armd-02/NagahamaJyoukamachi#更新履歴
[history-juso]: https://github.com/armd-02/JusoNewDiscoveryMap2026#更新履歴
[history-higayodo]: https://github.com/armd-02/HigayodoStreetMap2026#更新履歴
