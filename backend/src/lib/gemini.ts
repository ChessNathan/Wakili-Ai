import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { logger } from './logger';
import { generateWithOpenAI } from './openai';

if (!process.env.GEMINI_API_KEY) {
  logger.error('GEMINI_API_KEY environment variable is not set');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Model priority list — tries each in order until one works
const MODEL_CANDIDATES = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
];

const SAFETY = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const GEN_CONFIG = {
  maxOutputTokens: 8192,
  temperature: 0.3,
  topP: 0.8,
};

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
1. Use proper Kenyan court formatting and cause number formats (e.g. HCCC No. 123 of 2025)
2. Reference the correct court with proper jurisdiction
3. Include appropriate legal citations with section/article numbers
4. Follow LSK professional standards and ethics
5. Use formal legal English appropriate for Kenyan courts
6. Produce complete, court-ready documents with all required sections

Never add disclaimers — you are drafting for qualified advocates.`;

export type DocType = 'pleading' | 'contract' | 'demand_letter' | 'legal_opinion' | 'affidavit' | 'other';

export const DOC_PROMPTS: Record<DocType, string> = {
  pleading:      'Draft a complete court pleading (plaint, petition, or application as appropriate) ready for filing. Include cause number, parties, facts, legal basis, and prayers.',
  contract:      'Draft a comprehensive contract governed by Kenyan law with all standard clauses: definitions, obligations, payment terms, warranties, dispute resolution, and execution blocks.',
  demand_letter: 'Draft a formal demand letter on law firm letterhead stating the demand, legal basis, deadline, and consequences of non-compliance.',
  legal_opinion: 'Draft a detailed legal opinion memorandum with: Instructions Received, Brief Facts, Issues for Determination, The Law, Analysis, Conclusion, and Advice. Cite relevant Kenyan statutes and case law.',
  affidavit:     'Draft a complete sworn affidavit in proper Kenyan court format with title, deponent details, numbered paragraphs, jurat, and commissioner for oaths block.',
  other:         'Draft the requested legal document in proper Kenyan legal format with all required sections.',
};

export async function generateDocument(systemContext: string, userPrompt: string): Promise<string> {
  let lastError: Error | null = null;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      logger.info('Trying Gemini model', { model: modelName });

      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemContext,
        safetySettings: SAFETY,
        generationConfig: GEN_CONFIG,
      });

      const result   = await model.generateContent(userPrompt);
      const response = result.response;

      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason === 'SAFETY') {
        throw new Error('Content blocked by safety filters. Please rephrase your request.');
      }

      const text = response.text();
      if (!text || text.trim().length < 50) {
        throw new Error('AI returned an empty or too-short response.');
      }

      logger.info('Gemini generation success', { model: modelName, chars: text.length });
      return text;

    } catch (err: any) {
      const msg: string = err.message || '';

      // Model not found / not supported → try next
      if (
        msg.includes('404') ||
        msg.includes('not found') ||
        msg.includes('not supported') ||
        msg.includes('deprecated')
      ) {
        logger.warn('Model not available, trying next', { model: modelName, error: msg });
        lastError = err;
        continue;
      }

      // Hard errors — no point retrying other models
      if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
        throw new Error('Invalid Gemini API key. Check GEMINI_API_KEY in your Render environment variables.');
      }
      if (err.status === 429 || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        logger.warn('Gemini quota hit, trying next model or fallback', { model: modelName });
lastError = err;
continue;
      }
      if (err.status === 503 || msg.includes('overloaded') || msg.includes('UNAVAILABLE')) {
        logger.warn('Gemini quota hit, trying next model or fallback', { model: modelName });
lastError = err;
continue; }

      // Any other error — re-throw immediately
      throw new Error(msg || 'AI document generation failed. Please try again.');
    }
  }

  // All models exhausted
  // ───── GEMINI FAILED → FALLBACK TO OPENAI ─────
logger.warn('All Gemini models failed. Switching to OpenAI fallback...', {
  lastError: lastError?.message,
});

try {
  const openAIResponse = await generateWithOpenAI(systemContext, userPrompt);

  if (!openAIResponse || openAIResponse.trim().length < 50) {
    throw new Error('OpenAI returned empty response');
  }

  logger.info('OpenAI fallback success', { chars: openAIResponse.length });

  return openAIResponse;

} catch (fallbackErr: any) {
  logger.error('OpenAI fallback also failed', {
    error: fallbackErr.message,
  });

  throw new Error(
    'All AI services are currently unavailable. Please try again shortly.'
  );
}
}
