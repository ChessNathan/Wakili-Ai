import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const geminiModel = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ],
  generationConfig: { maxOutputTokens: 8192, temperature: 0.3, topP: 0.8 },
});

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
  pleading: 'Draft a complete court pleading ready for filing in the specified Kenyan court.',
  contract: 'Draft a comprehensive contract governed by Kenyan law with all standard clauses.',
  demand_letter: 'Draft a formal demand letter clearly stating the legal basis and relief sought.',
  legal_opinion: 'Draft a detailed legal opinion memorandum citing relevant Kenyan statutes and case law.',
  affidavit: 'Draft a complete sworn affidavit in proper Kenyan court format.',
  other: 'Draft the requested legal document in proper Kenyan legal format.',
};

export async function generateDocument(systemContext: string, userPrompt: string): Promise<string> {
  const result = await geminiModel.generateContent(`${systemContext}\n\n---\n\n${userPrompt}`);
  const text = result.response.text();
  if (!text) throw new Error('Empty response from AI');
  return text;
}
