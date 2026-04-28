import { Injectable, Logger } from '@nestjs/common';
import { TokenizerError } from './tokenizer.error';

const ENDPOINT = 'https://api.anthropic.com/v1/messages/count_tokens';
const DEFAULT_MODEL = 'claude-opus-4-7';
const TIMEOUT_MS = 10_000;

@Injectable()
export class TokenizerService {
  private readonly logger = new Logger(TokenizerService.name);

  async countTokens(
    text: string,
  ): Promise<{ inputTokens: number; model: string }> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new TokenizerError('api_key_missing');
    }
    const model = process.env.ANTHROPIC_TOKENIZER_MODEL ?? DEFAULT_MODEL;

    if (text.trim() === '') {
      return { inputTokens: 0, model };
    }

    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: text }],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new TokenizerError('upstream_failed', message);
    }

    if (!response.ok) {
      const status = response.status;
      const raw = await response.text().catch(() => '');
      this.logger.warn(
        `count_tokens upstream rejected: status=${status} body=${raw.slice(0, 500)}`,
      );
      throw new TokenizerError('upstream_rejected', String(status));
    }

    const body = (await response.json()) as { input_tokens: number };
    return { inputTokens: body.input_tokens, model };
  }
}
