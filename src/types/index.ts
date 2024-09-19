export type RaceResult = {
  rank: number;
  name: string;
  team: string;
  score: number;
};

export type TeamScore = {
  team: string;
  score: number;
};

export type UploadImageToChatGptResponse = {
  results: RaceResult[];
};
