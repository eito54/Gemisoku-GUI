// import webpack from 'webpack'; // この行を削除します

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer, webpack }) => { // 第2引数から webpack を取得します
    if (isServer) {
      // ws のネイティブ依存関係である bufferutil と utf-8-validate を無視させる
      // これにより、ws はネイティブモジュールをロードしようとせず、
      // JavaScript のフォールバック実装を使用するようになり、エラーが回避される可能性がある。
      config.plugins.push(
        new webpack.IgnorePlugin({ // 引数から取得した webpack を使用します
          resourceRegExp: /^(bufferutil|utf-8-validate)$/,
        })
      );
    }
    return config;
  },
  // トレース機能を無効化してファイルアクセス権限エラーを回避
  outputFileTracingExcludes: {
    '*': ['node_modules/**'],
  },
};

export default nextConfig;
