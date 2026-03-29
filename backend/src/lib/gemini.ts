import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { logger } from './logger';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const SYSTEM_PROMPT = `You are Wakili AI, an expert legal drafting assistant for Kenyan law firms.

You have deep knowledge of:
- Constitution of Kenya 2010
- Civil Procedure Rules 2010 and Civil Procedure Act (Cap 21)
- Employment Act 2007 and Employment and Labour Relations Court Act
- Land Act 2012, Land Registration Act 2012
- Companies Act 2015
- Contract Law as applied in Kenya
- Criminal Procedure Code (Cap 75)
- Evidence Act (Cap 80)
- Law Society of Kenya Act and LSK Practice Rules
- Kenya Law Reports (eKLR) case precedents

When drafting:
1. Use proper Kenyan court formatting and citation styles
2. Reference the correct court with proper cause number formats
3. Include appropriate legal citations with section numbers
4. Follow LSK professional standards
5. Use formal legal English appropriate for Kenyan courts
6. Produce complete, court-ready documents

Never add disclaimers — you are drafting for qualified advocates.`;

export type DocType = 'pleading' | 'contract' | 'demand_letter' | 'legal_opinion' | 'affidavit' | 'other';

export const DOC_PROMPTS: Record<DocType, string> = {
  pleading:      'Draft a complete court pleading ready for filing in the specified Kenyan court.',
  contract:      'Draft a comprehensive contract governed by Kenyan law with all standard clauses.',
  demand_letter: 'Draft a formal demand letter clearly stating the legal basis and relief sought.',
  legal_opinion: 'Draft a detailed legal opinion memorandum citing relevant Kenyan statutes and case law.',
  affidavit:     'Draft a complete sworn affidavit in proper Kenyan court format.',
  other:         'Draft the requested legal document in proper Kenyan legal format.',
};

export async function generateDocument(systemContext: string, userPrompt: string): Promise<string> {
  // Use gemini-1.5-flash with systemInstruction for proper separation of system vs user content
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: systemContext,
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ],
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.3,
      topP: 0.8,
    },
  });

  try {
    const result = await model.generateContent(userPrompt);
    const response = result.response;

    // Check for safety blocks or empty response
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason === 'SAFETY') {
      throw new Error('Content was blocked by safety filters. Please rephrase your request.');
    }
    if (finishReason === 'RECITATION') {
      throw new Error('Content generation stopped due to recitation policy. Please rephrase.');
    }

    const text = response.text();
    if (!text || text.trim().length === 0) {
      throw new Error('AI returned an empty response. Please try again with more detail.');
    }

    return text;
  } catch (err: any) {
    logger.error('Gemini generation error', {
      message: err.message,
      status:  err.status,
      details: err.errorDetails,
    });

    // Translate Gemini API errors into user-friendly messages
    if (err.message?.includes('API_KEY_INVALID') || err.status === 400) {
      throw new Error('AI service configuration error. Please check your Gemini API key.');
    }
    if (err.status === 429) {
      throw new Error('AI rate limit reached. Please wait a moment and try again.');
    }
    if (err.status === 503 || err.message?.includes('overloaded')) {
      throw new Error('AI service is temporarily busy. Please try again in a few seconds.');
    }

    // Re-throw with the actual message
    throw new Error(err.message || 'AI document generation failed. Please try again.');
  }
}
