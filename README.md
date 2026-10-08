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

## 更新履歴

* 2026/08/24 起動、施設データ取得、階層・インドア表示を改善
* 2026/10/08 サイドバー操作と共有URLを改善し、経路検索、投稿API・スキーマ対応、更新情報、敷地と地物の関連付け、検索、設定ベースの3D表示を追加
* 2026/10/08 地図のドラッグ・ズーム時の動作速度を改善
* 2026/10/08 インジケータを階数表示の上へ配置
* 2026/10/08 階数未設定の施設がある場合、階層表示中も1Fを選択できるよう修正
