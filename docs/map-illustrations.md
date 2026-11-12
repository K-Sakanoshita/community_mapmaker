# 地図の装飾イラスト

`data/config-user.jsonc` の `mapIllustrations` で設定する。
画像を固定座標に配置する。共通版の初期設定では無効で、配置リストは空。使用する画像と配置をサイトごとに設定する。
座標は `[経度, 緯度]`。
実際の会場・投稿としては扱わず、検索・一覧・サムネイルには追加しない。

| 項目 | 意味 |
| --- | --- |
| `use` | 全体の表示切替。省略時は無効 |
| `autoHide` | 重なり・画面端・枚数での自動非表示。通常は`false`。省略時も無効 |
| `minZoom`, `maxZoom` | 表示ズーム。`minZoom` 以上、`maxZoom` 未満 |
| 各画像の`corners` | `[[経度, 緯度], ...]`を左上・右上・右下・左下の順に4点指定。`bounds`より優先し、凸四角形に配置する |
| 各画像の`bounds` | `[西端経度, 南端緯度, 東端経度, 北端緯度]`。指定時は中心座標・サイズより優先し、画像を範囲全体に配置する。影の追加は無効。PC・モバイルで範囲は同じ |
| `referenceZoom` | 画像の大きさを決める基準ズーム。初期値15 |
| `widthPx`, `mobileWidthPx` | 基準ズーム・傾きなしでのPC・画面幅640px以下での幅。縦横比は画像から取得 |
| `shadow.use` | 画像の輪郭に沿う影を表示する |
| `shadow.color` | 影の色と濃さ。初期値`rgba(0, 0, 0, 0.25)`（黒・不透明度25%） |
| `shadow.blurPx` | 基準ズームでのぼかし量。初期値4px |
| `shadow.offsetXPx`, `shadow.offsetYPx` | 基準ズームで影をずらす距離。初期値は右2px・下4px |
| `maxVisible.desktop`, `maxVisible.mobile` | `autoHide: true`の場合の画面内の表示枚数の上限 |
| `avoidPaddingPx` | `autoHide: true`の場合のPOIのアイコン・名称、操作部品、画面端との余白 |
| `illustrationGapPx` | `autoHide: true`の場合のイラスト同士の最小間隔 |
| `items` | 個別イラストの設定配列 |

個別設定では `id`、`image`、`coordinates`、`priority` を指定する。
`priority` は小さい値から優先し、同じ値なら配列順。
個別に `use: false` を指定すると無効になる。
`coordinates` が未設定・不正な画像は表示しない。
`widthPx`、`mobileWidthPx`、`referenceZoom`、`minZoom`、`maxZoom` は個別にも上書きできる。
`shadow`も個別に上書きできる。たとえばロゴだけ影を消す場合は、ロゴの項目に
`"shadow": { "use": false }`を追加する。
影は透過部分の輪郭から描画し、元のPNGは変更しない。
影の余白を含めて地図へ配置するため、元画像の中心座標や地図上の大きさも変えない。

通常は、重なり・画面端・枚数によって画像全体を隠すことはしない。
初期設定のズーム範囲は0以上24未満で、地図の操作可能範囲全体を含む。
`autoHide: true`を明示した場合のみ、地図の移動・POI更新・操作部品の変更時に
画面上の重なりを判定し、優先度順で表示する画像を選ぶ。
画像の四隅を緯度経度で固定したMapLibreの画像ソースとして描画する。
地図と一緒に回転・傾斜・拡大縮小し、ズームが1増えると地図上の幅は約2倍になる。
操作を遮らず、読み上げ対象にも含めない。背景地図の切替時は画像レイヤーを復元する。

確認: `node tests/map-illustrations.cjs`
