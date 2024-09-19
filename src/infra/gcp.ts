import googleVisionApi from "@google-cloud/vision";
import file from "../credientials/mk8dx-bot-463461693972.json";

export const googleVisionClient = new googleVisionApi.ImageAnnotatorClient({
  credentials: file,
});
