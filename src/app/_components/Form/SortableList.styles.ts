// SortableList.styles.ts
export const animationStyles = `
  @keyframes rainbowBorder {
    0% { border-image-source: linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet); }
    14% { border-image-source: linear-gradient(to right, orange, yellow, green, blue, indigo, violet, red); }
    28% { border-image-source: linear-gradient(to right, yellow, green, blue, indigo, violet, red, orange); }
    42% { border-image-source: linear-gradient(to right, green, blue, indigo, violet, red, orange, yellow); }
    57% { border-image-source: linear-gradient(to right, blue, indigo, violet, red, orange, yellow, green); }
    71% { border-image-source: linear-gradient(to right, indigo, violet, red, orange, yellow, green, blue); }
    85% { border-image-source: linear-gradient(to right, violet, red, orange, yellow, green, blue, indigo); }
    100% { border-image-source: linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet); }
  }

  .animated-parallelogram-border::before {
    content: '';
    position: absolute;
    inset: -1.5px; /* Adjust to make the border appear outside */
    z-index: 0; /* Behind the content */
    background: linear-gradient(to right, rgba(15, 23, 42, 0.95), rgba(30, 58, 138, 0.9)); /* より濃い青のグラデーション */
    border-width: 2px;
    border-style: solid;
    border-color: transparent; /* For border-image */
    border-image-slice: 1;
    animation: rainbowBorder 4s linear infinite;
    transform: skewX(-12deg);
    box-shadow: 0 1px 2px 0 rgba(96, 165, 250, 0.4), 0 1px 3px 0 rgba(96, 165, 250, 0.4); /* shadow-sm shadow-blue-500/40 approx. */
    border-radius: 0.25rem; /* approx rounded-lg from Tailwind, adjust if needed */
  }

  .static-parallelogram-border::before {
    content: '';
    position: absolute;
    inset: -1.5px;
    z-index: 0;
    background: linear-gradient(to right, rgba(15, 23, 42, 0.95), rgba(30, 58, 138, 0.9)); /* より濃い青のグラデーション */
    border-width: 2px;
    border-style: solid;
    border-color: rgba(59, 130, 246, 0.7); /* border-blue-500/70 approx. */
    transform: skewX(-12deg);
    box-shadow: 0 1px 2px 0 rgba(96, 165, 250, 0.4), 0 1px 3px 0 rgba(96, 165, 250, 0.4);
    border-radius: 0.25rem;
  }

  /* 行全体のアニメーション用クラス */
  .position-up {
    position: relative;
  }
  
  .position-down {
    position: relative;
  }
  
  /* スコア枠点滅アニメーション */
  @keyframes scoreBoxGreenFlash {
    0%, 100% {
      /* ::before 疑似要素の背景を一時的に上書き、または透明度で調整 */
      /* ここでは、疑似要素自体ではなく、score-box本体の背景を操作するアプローチは難しい */
      /* そのため、疑似要素の opacity を変更するか、別のオーバーレイ要素をアニメーションさせることを検討 */
      /* 今回は、::before の box-shadow を利用する元の案に戻し、効果を調整 */
      /* もし背景色自体をアニメーションさせたい場合は、::before の背景グラデーションを一時的に無効化する必要がある */
       box-shadow: none;
    }
    50% {
       box-shadow: 0 0 8px 2px rgba(74, 222, 128, 0.8); /* より明るく、広範囲に */
    }
  }

  /* .score-box の ::before にアニメーションを適用 */
  .score-flash-active::before {
    animation: scoreBoxGreenFlash 0.4s ease-in-out 3; /* 0.4秒で3回点滅 */
  }
  
  @keyframes fadeInOut {
    0%, 100% {
      opacity: 0;
      transform: translateY(5px);
    }
    20%, 80% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .added-score-indicator {
    animation: fadeInOut 2s ease-in-out forwards; /* 2秒かけてフェードイン・アウト */
    /* 必要に応じて他のスタイル（position, z-indexなど）を追加 */
  }

  /* .team-selected と .team-selected::before のスタイルを削除 */
`;

// スタイルをヘッドに追加する関数
export function addAnimationStyles() {
  if (typeof document !== 'undefined') {
    const id = 'sortable-list-animation-styles';
    // すでに存在する場合は追加しない
    if (!document.getElementById(id)) {
      const styleEl = document.createElement('style');
      styleEl.id = id;
      styleEl.textContent = animationStyles;
      document.head.appendChild(styleEl);
    }
  }
}
