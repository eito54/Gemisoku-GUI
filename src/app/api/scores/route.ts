import { NextRequest, NextResponse } from 'next/server';
import type { TeamScore } from '@/types';

// スコア情報を保持する一時的なストレージ
// 本番環境ではデータベースなどを使用することが望ましい
let teamScores: TeamScore[] = [];

export async function GET() {
  return NextResponse.json({ scores: teamScores });
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    if (Array.isArray(data)) {
      teamScores = data;
      return NextResponse.json({ success: true, message: 'Scores updated successfully' });
    } else {
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