/**
 * オーバーレイ(public/overlay/index.html)専用のTailwind設定。
 * `npm run build:overlay` で public/overlay/tailwind.css を生成する。
 * OBSブラウザソースはオフラインでも動作するよう、CDN(Play CDN)に依存させない。
 */
module.exports = {
  content: ['./public/overlay/index.html'],
  theme: {
    extend: {}
  },
  plugins: []
}
