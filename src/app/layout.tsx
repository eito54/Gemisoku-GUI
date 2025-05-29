import type { Metadata } from "next";
import { Inter, Press_Start_2P } from "next/font/google"; // Press_Start_2P をインポート
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" }); // Interも変数として定義
const pressStart2P = Press_Start_2P({ // Press Start 2P フォントの設定
  weight: "400", // Press Start 2P は通常 400 のみ
  subsets: ["latin"],
  display: "swap",
  variable: "--font-press-start-2p", // CSS変数として利用
});

export const metadata: Metadata = {
  title: "MK8DX Team Score Overlay", // title を適切なものに変更
  description: "Displays Mario Kart 8 Deluxe team scores from OBS and Gemini.", // description を適切なものに変更
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // htmlタグにフォント変数を適用
    <html lang="en" className={`${inter.variable} ${pressStart2P.variable}`}>
      {/* bodyのclassNameからinter.classNameを削除 */}
      <body>{children}</body>
    </html>
  );
}
