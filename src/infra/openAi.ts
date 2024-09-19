import OpenAI from "openai";

export const openAi = new OpenAI({
  organization: process.env.NEXT_PUBLIC_API_OPEN_AI_ORGANIZATION,
  project: process.env.NEXT_PUBLIC_API_OPEN_AI_PROJECT,
  apiKey: process.env.NEXT_PUBLIC_API_OPEN_AI_API_KEY,
});
