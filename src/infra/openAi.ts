import OpenAI from "openai";

export const openAi = new OpenAI({
  organization: process.env.OPEN_AI_ORGANIZATION,
  project: process.env.OPEN_AI_PROJECT,
  apiKey: process.env.OPEN_AI_API_KEY,
});
