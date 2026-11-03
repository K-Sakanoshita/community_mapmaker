# ひがよど文化祭 会場周遊マップ2026

ひがよど文化祭2026の会場・出展情報を紹介する地図です。
公開APIの掲載情報を読み込み、会場アイコン・一覧・写真サムネイルから詳細を表示します。

公開先: https://armd-02.github.io/HigayodoStreetMap2026/

GitHub Pagesは `main` ブランチのルートディレクトリから配信します。

## 起動

静的サイトのため、ビルドは不要です。このディレクトリで次のコマンドを実行します。

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

ブラウザで `http://127.0.0.1:8765/` を開いてください。
地図タイル・外部ライブラリの読み込みにはインターネット接続が必要です。

## コピー元

- 最新エンジン: [K-Sakanoshita/expo2025-maniacs](https://github.com/K-Sakanoshita/expo2025-maniacs)
  - コピーしたコミット: `ee80f49fc48183a5b3149f07fcc68fc47f70bcd2`
  - 共通ソースを引き継ぎ、イベント専用のデータ・画面・設定・テストを除去しています。3Dモデルと表示ルールは引き継いでいます。
- 初期表示位置・表示範囲の参考: [armd-02/HigayodoStreetMap2025](https://github.com/armd-02/HigayodoStreetMap2025)
  - 参照コミット: `c3834568c9f82eedc187d19c3ac0ef98ee481904`

- 共通コード更新元: [armd-02/Playgrounds](https://github.com/armd-02/Playgrounds)
  - 取り込み確認コミット: `4455adb5b8a033f25404a605a2943f561ee3dfd0`（2026-10-31）
  - 無効な機能も含む共通処理を更新し、ひがよど固有の設定・データ・装飾と既存の共通拡張は保持しています。

## 2026年版の設定

- `index.html`: サイト名、説明、共有用URL、起動画面。
- `data/config-user.jsonc`: 初期位置・表示範囲、読み込み元、メニュー。
- `data/config-system.jsonc`: 背景地図と共通設定。
- `data/glot-custom.jsonc`: サイトの日本語・英語表示。
- `data/higayodo2026.json`: 初期作成時の空のOSM JSON（現在は読み込み対象外）。
- `data/config-activities.jsonc`: バックエンドの項目に対応する詳細表示。
- `manifest.json`: コピー元のアクセス解析IDを無効化。
- `image/higayodo2026.svg`: 起動画面・favicon。
- `image/higayodo2026-og.png`: SNS共有用の画像（1200×630px）。編集元は同名のSVGで、`rsvg-convert image/higayodo2026-og.svg -o image/higayodo2026-og.png` で再出力。
- `lib/mapillustrations.js`: 固定座標のイラスト・ロゴ表示。
- `docs/map-illustrations.md`: 装飾画像の座標・サイズ・表示設定。

2025年版の店舗データ・Google Apps Scriptには接続していません。
コピー元のイベント専用データ・公開ページ・更新履歴・ツール・テストは削除しています。3Dモデル（自動販売機・こみゃくを含む）と表示ルールは保持しています。
アプリKeyは `higayodo_artfes_2026`、公開時の取得先は
`https://armd-01.sakura.ne.jp/community-mapmaker-backend/api/activities.php?app=higayodo_artfes_2026` です。
`google.AppScript` と、優先される `activity.url` の両方をこのURLに揃えています。
ローカルホストでは `activity.local` により開発用API
`http://127.0.0.1:18080/api/activities.php?app=higayodo_artfes_2026` に切り替えます。
項目定義は `data/config-activities.jsonc` に同梱しています。
登録地点に紐づくOSMデータはOverpass APIから取得します。

## 更新履歴

### 2026-10-31

- Playgrounds の共通修正を取り込み。新着からの即時移動と詳細再取得、Overpass の欠落地物の代替サーバー取得、地域別の更新履歴・初回訪問処理、口コミと地図情報の内訳、一覧ボタンのキーボード操作と状態同期、トイレの人数・詳細リンク、絞り込みラベルを更新。
- ひがよどで無効な機能も更新対象とし、有効・無効の設定は維持。共通機能の実装資料は [検索と新着情報](docs/search-and-updates.md) に記載。

### 2026-10-28

- カテゴリ選択時に地図・一覧・写真が更新されない問題を修正。`selectItem.action`を`ChangePoi`に設定し、選択カテゴリへの絞り込みを有効化。

- 周遊範囲に額縁と四隅の装飾を追加。移動制限は額縁の外側25%の余白を基準に調整。
- 左上のひがよどロゴを拡大・移動し、右下にさんよどロゴを配置。
- メニューと一覧・詳細パネルに256×256pxの背景パターンを設定。

- メニューの説明文に地図の使い方と「さんよど大文化祭」公式サイトへのリンクを追加。

- SNS共有用のPNG画像を用意し、検索・OGP・Xの説明文を会場周遊マップの内容に統一。

- 起動ロゴの中央に「ひがよど文化祭」の画像を配置し、準備中の表示を削除。
- 開発サーバーの自動更新処理でも壊れないSVG構造へ変更。
- 地図上の装飾画像に輪郭に沿う影を追加。色・ぼかし・位置は設定可能。

- 公開APIの会場・出展情報35件と、その掲載写真に接続。
- 投稿画像とOSM画像タグの両方をサムネイルに表示。
- 透過イラスト8枚と「ひがよど文化祭」ロゴを地図上の固定座標に配置。
- 装飾画像は地図と一緒に回転・傾斜・拡大縮小し、重なりや枚数による自動非表示を無効化。
- サイト名・説明・起動画面を更新し、コピー元の万博専用データ・画面を除去。

掲載画像と地図用画像を `moto_data/加工/` に同梱します。元のPDF・未使用素材・
重複する `stores/` は今回の公開対象に含めません。

## ライセンス

ソースコードはコピー元のMITライセンスを継承します（[LICENSE](LICENSE)）。
OpenStreetMapデータ・背景地図・写真・3Dモデル等には各提供元のライセンスが適用されます。
詳細はコピー元リポジトリおよび各アセットのライセンス表記を参照してください。

検証は `node tests/run.cjs` で実行します。
