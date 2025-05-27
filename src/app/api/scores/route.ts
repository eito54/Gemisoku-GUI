import { NextRequest, NextResponse } from 'next/server';
import type { TeamScore } from '@/types';

// スコア情報を保持する一時的なストレージ
// 本番環境ではデータベースなどを使用することが望ましい
let teamScores: TeamScore[] = [];
let lastUpdated = Date.now();

export async function GET() {
  // ログ出力を削除（必要時のみ出力）
  return NextResponse.json({
    scores: teamScores,
    lastUpdated: lastUpdated
  });
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    if (Array.isArray(data)) {
      teamScores = data;
      lastUpdated = Date.now(); // タイムスタンプを更新
      console.log('Scores updated successfully'); // 簡潔なログのみ
      return NextResponse.json({ success: true, message: 'Scores updated successfully', lastUpdated: lastUpdated });
    } else {
      console.error('POST /api/scores - Invalid data format');
      return NextResponse.json({ success: false, message: 'Invalid data format' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error updating scores:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update scores' },
      { status: 500 }
    );
  }
}