import { GoogleGenerativeAI } from "@google/generative-ai";

// Get API key from environment variable
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set in environment variables. Please add it to your .env file.");
}

// Access your API key
const genAI = new GoogleGenerativeAI(apiKey);

// For text-only input, use the gemini-pro model
export const gemini = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // こちらも必要であれば更新検討

// For multimodal (text and image) input, use an updated model
// gemini-pro-vision is deprecated. Using gemini-1.5-flash-latest as suggested.
export const geminiVision = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });