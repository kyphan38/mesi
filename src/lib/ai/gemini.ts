import { GoogleGenerativeAI } from "@google/generative-ai";

function getGeminiApiKey(): string {
  const k = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!k) throw new Error("GEMINI_API_KEY is not set");
  return k;
}

/**
 * JSON mode + systemInstruction / user turn — mirror Cogi tuning (temperature, model id).
 */
export async function generateGeminiJson(
  systemInstruction: string,
  userMessage: string,
): Promise<string> {
  const modelId = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const genAI = new GoogleGenerativeAI(getGeminiApiKey());
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction,
    generationConfig: {
      temperature: 0.35,
      responseMimeType: "application/json",
    },
  });
  const result = await model.generateContent(userMessage);
  const text = result.response.text();
  if (!text?.trim()) {
    throw new Error("Empty response from Gemini");
  }
  return text;
}
