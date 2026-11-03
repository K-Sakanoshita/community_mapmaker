# Community Map Maker

OpenStreetMap（OSM）やGoogle Spreadsheetのデータを地図上に表示するWebアプリです。設定ファイルを編集して、地域やテーマに合わせたコミュニティマップを作成できます。

## 利用・公開方法

このリポジトリをクローンまたはダウンロードし、ルートディレクトリでHTTPサーバーを起動します。ビルドは不要です。

```bash
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000/` を開いてください。公開する場合は、GitHub Pagesなどの静的サイト用サーバーに配置できます。

## 自分の地図を作る

主に次のファイルを編集します。`data/` の設定ファイルは、コメントを書けるJSONC形式です。

* [data/config-user.jsonc](data/config-user.jsonc): 初期位置、ズーム、施設リスト、外部データ、メニュー
* [data/config-system.jsonc](data/config-system.jsonc): Overpass API、背景地図
* [data/overpass-custom.jsonc](data/overpass-custom.jsonc): 取得・表示するOSM地物と表示スタイル
* [data/category-ja.jsonc](data/category-ja.jsonc) / [data/category-en.jsonc](data/category-en.jsonc): カテゴリ名
* [data/marker.jsonc](data/marker.jsonc): OSMタグとマーカー画像の対応
* [data/glot-custom.jsonc](data/glot-custom.jsonc): サイト固有の表示文言
* [manifest.json](manifest.json): 読み込むファイルとAnalytics ID

サイト名や初期位置、表示対象を自分の用途に合わせて変更してください。外部データや投稿機能を利用する場合は、接続先も設定します。マーカー画像は `icon/` に配置し、見た目は `user.css` で調整できます。

Google Spreadsheetを利用する場合は `config-user.jsonc` の `google`、静的GeoJSONを利用する場合は `static` を設定します。経路検索、検索、3D表示などの追加機能は、利用したい機能の設定で `use` を有効にし、必要な接続先や表示ルールを指定してください。設定項目は各ファイルのコメントを参照してください。

## バックエンド

[Community Mapmaker Backend](https://github.com/K-Sakanoshita/community_mapmaker_backend) は、投稿データの保存・取得、プロジェクトと投稿項目の管理、ユーザー登録・認証を提供するPHPバックエンドです。投稿機能などで利用する場合は、別途バックエンドを設置し、フロントエンドの接続先を設定します。

必要環境、セットアップ、API、公開方法は、[バックエンドのREADME](https://github.com/K-Sakanoshita/community_mapmaker_backend#readme)を参照してください。

## OSMデータを整備する方へ

表示する施設の種類は、地図ごとの取得対象と表示設定で決まります。施設が表示されない場合は、OSMの登録内容と [data/overpass-custom.jsonc](data/overpass-custom.jsonc) の対象タグを確認してください。

施設の種類は `amenity`、`shop`、`leisure`、`historic` など、名称は `name` で登録します。実際の施設に合うタグと位置を整備してください。

### 建物内の施設・インドア地物

階別表示を利用する地図では、`config-user.jsonc` の `indoor.use` を有効にします。部屋や通路も表示するには、それらの地物をOSMに登録します。

* 施設や屋内地物の階数は `level` に登録します。OSMの `level=0` は、この地図では1F、`level=1` は2Fとして表示します。
* 階数未設定の施設は1F扱いになるため、上階や地下の施設には実際の階数を登録してください。
* 複数階に属する地物は、セミコロン区切りの `level` や `repeat_on` に対応しています。
* 部屋・共用エリア・通路・壁には `indoor=room/area/corridor/wall`、通路には `highway=corridor`、扉には `door=*` などを使います。階数と必要な名称も登録してください。

表示内容はOSMデータと取得・表示設定に依存します。この地図の表示だけでは、施設がないことや建物全体の階構成を判断できません。

## 開発時の確認

Node.jsで回帰テストを実行できます。

```bash
node tests/run.cjs
```

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
* 2026/10/08 サイドバー操作と共有URLを改善し、経路検索、投稿API・スキーマ対応、更新情報、敷地と地物の関連付け、検索、設定ベースの3D表示を追加
* 2026/10/08 地図のドラッグ・ズーム時の動作速度を改善
* 2026/10/08 インジケータを階数表示の上へ配置
* 2026/10/08 階数未設定の施設がある場合、階層表示中も1Fを選択できるよう修正
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
