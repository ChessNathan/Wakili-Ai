import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ],
  generationConfig: {
    maxOutputTokens: 8192,
    temperature: 0.3,
    topP: 0.8,
  },
});

export const SYSTEM_PROMPT = `You are Wakili AI, an expert Kenyan legal drafting assistant.

Produce COMPLETE, court-ready documents with:
- Proper structure
- Headings
- Legal citations
- Formal tone

DO NOT summarize. ALWAYS produce full documents.`;

export async function generateDocument(system: string, prompt: string): Promise<string> {
  try {
    const fullPrompt = `${system}\n\n---\n\n${prompt}`;

    const result = await model.generateContent(fullPrompt);

    const text = result.response.text();

    if (!text || text.trim().length < 50) {
      throw new Error("Empty or weak AI response");
    }

    return text;

  } catch (error: any) {
    console.error("AI ERROR:", error.message);

    // Retry once (VERY IMPORTANT)
    try {
      const retry = await model.generateContent(prompt);
      const retryText = retry.response.text();

      if (!retryText) throw new Error("Retry failed");

      return retryText;
    } catch {
      throw new Error("AI generation failed completely");
    }
  }
}
