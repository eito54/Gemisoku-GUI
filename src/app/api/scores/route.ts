import { NextRequest, NextResponse } from 'next/server';
import type { TeamScore } from '@/types';
import fs from 'fs';
import path from 'path';

// ファイルベースのスコア管理に変更
const SCORES_FILE = path.join(process.cwd(), 'gui', 'scores.json');

// スコアファイルから読み込む関数
const readScoresFromFile = (): { scores: TeamScore[], lastUpdated: number } => {
  try {
    if (fs.existsSync(SCORES_FILE)) {
      const data = fs.readFileSync(SCORES_FILE, 'utf8');
      const scores = JSON.parse(data);
      
      // ファイルの更新時刻を取得
      const stats = fs.statSync(SCORES_FILE);
      const lastUpdated = stats.mtime.getTime();
      
      return { scores: Array.isArray(scores) ? scores : [], lastUpdated };
    }
  } catch (error) {
    console.error('Error reading scores file:', error);
  }
  return { scores: [], lastUpdated: Date.now() };
};

// スコアファイルに書き込む関数
const writeScoresToFile = (scores: TeamScore[]): boolean => {
  try {
    // ディレクトリが存在しない場合は作成
    const dir = path.dirname(SCORES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing scores file:', error);
    return false;
  }
};

export async function GET() {
  const { scores, lastUpdated } = readScoresFromFile();
  return NextResponse.json({
    scores,
    lastUpdated
  });
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    if (Array.isArray(data)) {
      const writeSuccess = writeScoresToFile(data);
      
      if (writeSuccess) {
        console.log('Scores updated successfully in file');
        return NextResponse.json({
          success: true,
          message: 'Scores updated successfully',
          lastUpdated: Date.now()
        });
      } else {
        return NextResponse.json({
          success: false,
          message: 'Failed to write scores to file'
        }, { status: 500 });
      }
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