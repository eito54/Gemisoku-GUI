export const PROMPT = `
  ## instruction ##
  ゲームの結果画面を解析して全員分の順位とユーザー名、得点とチームを出力してください。

  結果画面には左から以下の項目が書いてあります。
  1. 順位
  2. ユーザー名
  3. 得点

  ## restriction ##
  - [rank]は順位です。
  - [rank]は1〜12までの整数です。
  - [name]はユーザー名です。
  - [name]はそのまま出力してください。
  - [team]は[name]の最初の一文字目のアルファベットです。
  - [team]は大文字で出力してください。
  - [score]は得点です。
  - [score]は正の整数で出力してください。


  ## Output Format ##
  {
    "results": [
      {
        rank: [rank],
        name: [name],
        team: [team],
        score: [score],
      },
    ]
  }
`;
