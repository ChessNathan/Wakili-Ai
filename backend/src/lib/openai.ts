import { logger } from './logger';

// ── OpenAI fallback ───────────────────────────────────────────────────────────
export async function generateWithOpenAI(system: string, prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  // Try gpt-4o-mini first, fall back to gpt-3.5-turbo (available on all plans)
  const models = ['gpt-4o-mini', 'gpt-3.5-turbo'];

  for (const model of models) {
    try {
      logger.info('Trying OpenAI model', { model });
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user',   content: prompt  },
          ],
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });

      const body: any = await res.json();

      if (!res.ok) {
        const errMsg = body?.error?.message || JSON.stringify(body).slice(0, 300);
        // Quota/billing errors — no point trying further
        if (res.status === 429 || res.status === 402) {
          throw new Error(`OpenAI quota/billing error (${res.status}): ${errMsg}`);
        }
        // Model not available — try next
        if (res.status === 404 || res.status === 400) {
          logger.warn('OpenAI model not available, trying next', { model, status: res.status, error: errMsg });
          continue;
        }
        throw new Error(`OpenAI ${res.status}: ${errMsg}`);
      }

      const text = body.choices?.[0]?.message?.content || '';
      if (!text) throw new Error('OpenAI returned empty content');
      logger.info('OpenAI success', { model, chars: text.length });
      return text;

    } catch (err: any) {
      const msg = err.message || '';
      // Quota/billing — stop immediately, don't try next model
      if (msg.includes('quota') || msg.includes('billing') || msg.includes('402') || msg.includes('insufficient_quota')) {
        logger.error('OpenAI quota/billing issue', { model, error: msg });
        throw err;
      }
      logger.warn('OpenAI model attempt failed', { model, error: msg.slice(0, 200) });
      if (model === models[models.length - 1]) throw err;
    }
  }

  throw new Error('All OpenAI models failed');
}

// ── Anthropic Claude fallback ─────────────────────────────────────────────────
export async function generateWithAnthropic(system: string, prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  logger.info('Trying Anthropic Claude Haiku');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const body: any = await res.json();

  if (!res.ok) {
    const errMsg = body?.error?.message || JSON.stringify(body).slice(0, 300);
    logger.error('Anthropic API error', { status: res.status, error: errMsg });
    throw new Error(`Anthropic ${res.status}: ${errMsg}`);
  }

  const text = body.content?.[0]?.text || '';
  if (!text) throw new Error('Anthropic returned empty content');
  logger.info('Anthropic success', { chars: text.length });
  return text;
}
