export type RaceResult = {
  rank: number;
  name: string;
  team: string;
  score: number; // レースごとの得点
  totalScore?: number; // プレイヤーごとの合計得点 (Geminiからのレスポンス用)
  isCurrentPlayer?: boolean; // 追加
};

export type TeamScore = {
  name?: string; // ★ 追加: プレイヤー名
  team: string;
  score: number;
  addedScore?: number;
  isCurrentPlayer?: boolean; // 追加
};

export type UploadImageToGeminiSuccessResponse = {
  results: RaceResult[];
  error?: never; // エラー時には存在しないことを明示
};

export type UploadImageToGeminiErrorResponse = {
  error: string;
  results?: never; // 成功時には存在しないことを明示
};

export type UploadImageToGeminiResponse =
  | UploadImageToGeminiSuccessResponse
  | UploadImageToGeminiErrorResponse;
