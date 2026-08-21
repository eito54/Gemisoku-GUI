/**
 * オーバーレイ(public/overlay/index.html)専用のTailwind設定。
 * `npm run build:overlay` で public/overlay/tailwind.css を生成する。
 * OBSブラウザソースはオフラインでも動作するよう、CDN(Play CDN)に依存させない。
 */
module.exports = {
  // 注意: オーバーレイはJSでクラス名を組み立てるため、使うユーティリティクラスは
  // index.html 内にリテラルとして登場していなければならない（スキャン対象はこのファイルだけ）。
  // クラス定義を外部JSへ切り出す場合は content への追加か safelist が必要。
  content: ['./public/overlay/index.html'],
  theme: {
    extend: {}
  },
  plugins: []
}
