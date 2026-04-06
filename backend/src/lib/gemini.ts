import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { logger } from './logger';
import { generateWithOpenAI, generateWithAnthropic } from './openai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
];

const SAFETY = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

function isGeminiRetryable(err: any): boolean {
  const msg = String(err?.message || err?.toString() || '').toLowerCase();
  return (
    msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted') ||
    msg.includes('rate') || msg.includes('overloaded') || msg.includes('unavailable') ||
    msg.includes('503') || msg.includes('not found') || msg.includes('404') ||
    msg.includes('deprecated') || msg.includes('not supported') || msg.includes('free tier')
  );
}

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

// ── generateDocument: Gemini → Anthropic → OpenAI ────────────────────────────
export async function generateDocument(systemContext: string, userPrompt: string): Promise<string> {
  const errors: string[] = [];

  // 1. Try Gemini
  if (process.env.GEMINI_API_KEY) {
    for (const modelName of GEMINI_MODELS) {
      try {
        logger.info('Trying Gemini', { model: modelName });
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemContext,
          safetySettings: SAFETY,
          generationConfig: { maxOutputTokens: 8192, temperature: 0.3, topP: 0.8 },
        });
        const result = await model.generateContent(userPrompt);
        if (result.response.candidates?.[0]?.finishReason === 'SAFETY') {
          throw new Error('Content blocked by safety filters');
        }
        const text = result.response.text();
        if (!text || text.trim().length < 50) throw new Error('Empty response from Gemini');
        logger.info('Gemini success', { model: modelName, chars: text.length });
        return text;
      } catch (err: any) {
        const msg = err.message || String(err);
        logger.warn('Gemini failed', { model: modelName, error: msg.slice(0, 150) });
        errors.push(`Gemini(${modelName}): ${msg.slice(0, 80)}`);
        if (!isGeminiRetryable(err)) break;
      }
    }
  } else {
    errors.push('Gemini: GEMINI_API_KEY not set');
  }

  // 2. Try Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const text = await generateWithAnthropic(systemContext, userPrompt);
      if (text && text.trim().length >= 50) return text;
      errors.push('Anthropic: empty response');
    } catch (err: any) {
      const msg = err.message || String(err);
      logger.warn('Anthropic failed', { error: msg.slice(0, 150) });
      errors.push(`Anthropic: ${msg.slice(0, 80)}`);
    }
  } else {
    errors.push('Anthropic: ANTHROPIC_API_KEY not set');
  }

  // 3. Try OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const text = await generateWithOpenAI(systemContext, userPrompt);
      if (text && text.trim().length >= 50) return text;
      errors.push('OpenAI: empty response');
    } catch (err: any) {
      const msg = err.message || String(err);
      logger.warn('OpenAI failed', { error: msg.slice(0, 150) });
      errors.push(`OpenAI: ${msg.slice(0, 80)}`);
    }
  } else {
    errors.push('OpenAI: OPENAI_API_KEY not set');
  }

  logger.error('All AI providers failed', { errors });
  throw new Error(`AI unavailable. Details: ${errors.join(' | ')}`);
}

// ── generateJSON: same fallback chain, returns parsed object or null ──────────
export async function generateJSON(prompt: string): Promise<any | null> {
  const systemCtx = 'You are a JSON data extractor. Return ONLY valid JSON. No markdown fences, no explanation.';
  const errors: string[] = [];

  // 1. Gemini
  if (process.env.GEMINI_API_KEY) {
    for (const modelName of GEMINI_MODELS) {
      try {
        logger.info('generateJSON: trying Gemini', { model: modelName });
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { temperature: 0.0, maxOutputTokens: 512 },
        });
        const result = await model.generateContent(prompt);
        const raw    = result.response.text().trim().replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(raw);
        logger.info('generateJSON: Gemini success', { model: modelName });
        return parsed;
      } catch (err: any) {
        const msg = err.message || String(err);
        logger.warn('generateJSON: Gemini failed', { model: modelName, error: msg.slice(0, 120) });
        errors.push(`Gemini(${modelName}): ${msg.slice(0, 60)}`);
        if (!isGeminiRetryable(err)) break;
      }
    }
  }

  // 2. Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      logger.info('generateJSON: trying Anthropic');
      const raw    = await generateWithAnthropic(systemCtx, prompt);
      const parsed = JSON.parse(raw.trim().replace(/```json|```/g, '').trim());
      logger.info('generateJSON: Anthropic success');
      return parsed;
    } catch (err: any) {
      const msg = err.message || String(err);
      logger.warn('generateJSON: Anthropic failed', { error: msg.slice(0, 120) });
      errors.push(`Anthropic: ${msg.slice(0, 60)}`);
    }
  }

  // 3. OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      logger.info('generateJSON: trying OpenAI');
      const raw    = await generateWithOpenAI(systemCtx, prompt);
      const parsed = JSON.parse(raw.trim().replace(/```json|```/g, '').trim());
      logger.info('generateJSON: OpenAI success');
      return parsed;
    } catch (err: any) {
      const msg = err.message || String(err);
      logger.warn('generateJSON: OpenAI failed', { error: msg.slice(0, 120) });
      errors.push(`OpenAI: ${msg.slice(0, 60)}`);
    }
  }

  logger.error('generateJSON: all providers failed', { errors });
  return null;
}
