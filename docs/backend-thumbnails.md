# 投稿画像のバックエンドサムネイル

`thumbnail.backend` で公開GET APIを設定します。

```json
"backend": {
    "use": true,
    "url": "https://example.org/api/thumbnail.php?app=YOUR_PROJECT",
    "concurrency": 2
}
```

バックエンドの画像項目は `image` 型である必要があります。フロントのフォームでは対応する項目を従来どおり `image_url` として指定します。APIには投稿の `id` と画像項目名 `field` を渡し、ブラウザから認証情報や任意URLのPOSTは送りません。

対象は、地図の写真アイコン、下部の画像一覧、投稿詳細内の縮小画像です。APIが返す長辺400px以内の画像を使用します。同じ画像はページ内で共有し、地図・画像一覧・詳細画面を合わせて、APIへの同時リクエストを最大2件に制限します。`concurrency` は1または2を指定でき、省略時は従来どおり1件です。一時的な503は最大2回再試行し、429や設定不整合の422では一定時間APIリクエストを控えます。取得失敗時は元画像で表示します。

拡大ビューアでは `data-original-src` の元URLを使います。Wikimedia Commonsは `src_org` を優先します。投稿の保存データ、原寸の画像ビューア、額縁内の画像、資料画像の表示先URLは書き換えません。

`./image/example.jpg` などの相対パス、`File:...`、投稿に紐づかないOSM画像はこのAPIへ送りません。Commonsは従来の縮小画像取得を利用します。相対パスの画像は元ファイルを表示します。

設定がない場合、または `use: false` の場合は従来動作です。

確認: `node tests/backend-thumbnails.cjs`。APIとの実接続には対象Projectの画像項目の型が正しく設定されている必要があります。
