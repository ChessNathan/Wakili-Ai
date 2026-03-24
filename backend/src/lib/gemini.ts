import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY environment variable. Get a free key at https://aistudio.google.com');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use gemini-1.5-flash — free tier, fast, high quality
export const geminiModel = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ],
  generationConfig: {
    maxOutputTokens: 8192,
    temperature: 0.3,      // lower = more consistent legal drafting
    topP: 0.8,
    topK: 40,
  },
});

// ── Kenya Law System Prompt ──────────────────────────────────
export const KENYA_LEGAL_SYSTEM_PROMPT = `You are Wakili AI, an expert legal drafting assistant specializing in Kenyan law.

You have deep knowledge of:
- The Constitution of Kenya 2010
- Civil Procedure Rules 2010 and Civil Procedure Act (Cap 21)
- Employment Act 2007 and Employment and Labour Relations Court Act
- Land Act 2012, Land Registration Act 2012, National Land Commission Act
- Companies Act 2015
- Contract Law (common law as applied in Kenya)
- Criminal Procedure Code (Cap 75)
- Evidence Act (Cap 80)
- Appellate Jurisdiction Act
- Law Society of Kenya Act and LSK Practice Rules
- Kenya Law Reports (eKLR) case precedents

When drafting documents:
1. Use proper Kenyan court formatting and citation styles
2. Reference the correct court (High Court, Employment & Labour Relations Court, Environment & Land Court, Court of Appeal, Magistrate's Court, etc.)
3. Use proper cause number formats (e.g., "Civil Case No. ___ of 2025")
4. Include appropriate legal citations with section numbers
5. Follow LSK professional standards
6. Use formal legal English appropriate for Kenyan courts
7. Include all standard clauses required by Kenyan procedure

Always produce complete, court-ready documents unless asked for a partial draft.
Never add disclaimers or "this is not legal advice" — you are drafting for professional advocates.`;

// ── Document type prompts ────────────────────────────────────
export type DocType = 'pleading' | 'contract' | 'demand_letter' | 'legal_opinion' | 'affidavit' | 'other';

export const DOC_TYPE_PROMPTS: Record<DocType, string> = {
  pleading:      'Draft a complete court pleading (Plaint, Defence, Petition, or similar) ready for filing in the specified Kenyan court.',
  contract:      'Draft a comprehensive contract or agreement governed by Kenyan law, including all standard clauses.',
  demand_letter: 'Draft a formal demand letter on behalf of the client, clearly stating the legal basis and relief sought.',
  legal_opinion: 'Draft a detailed legal opinion memorandum analyzing the matter under Kenyan law, citing relevant statutes and case law.',
  affidavit:     'Draft a complete sworn affidavit in proper Kenyan court format.',
  other:         'Draft the requested legal document in proper Kenyan legal format.',
};

// ── Core generation function ─────────────────────────────────
export async function generateLegalDocument(systemContext: string, userPrompt: string): Promise<string> {
  // Gemini uses a single prompt — we combine system + user
  const fullPrompt = `${systemContext}\n\n---\n\n${userPrompt}`;

  const result = await geminiModel.generateContent(fullPrompt);
  const response = result.response;

  if (!response) throw new Error('No response from Gemini');

  const text = response.text();
  if (!text) throw new Error('Empty response from Gemini');

  return text;
}
