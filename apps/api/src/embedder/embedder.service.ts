import { Injectable, Logger } from '@nestjs/common';
import { EmbedderError } from './embedder.error';
import { AppSettingsService } from '../app-settings/app-settings.service';
import {
  SETTING_EMBEDDER_MODEL,
  SETTING_EMBEDDER_URL,
} from '../app-settings/app-settings.keys';

const DEFAULT_MODEL = 'embeddinggemma';
const TIMEOUT_MS = 30_000;

@Injectable()
export class EmbedderService {
  private readonly logger = new Logger(EmbedderService.name);

  constructor(private readonly settings: AppSettingsService) {}

  async embed(text: string): Promise<number[]> {
    const url = this.settings.resolve(SETTING_EMBEDDER_URL);
    if (!url) throw new EmbedderError('url_missing');
    const model =
      this.settings.resolve(SETTING_EMBEDDER_MODEL) ?? DEFAULT_MODEL;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, input: text }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new EmbedderError('upstream_failed', message);
    }

    if (!response.ok) {
      const status = response.status;
      const raw = await response.text().catch(() => '');
      this.logger.warn(
        `embed upstream rejected: status=${status} body=${raw.slice(0, 500)}`,
      );
      throw new EmbedderError('upstream_rejected', String(status));
    }

    const body = (await response.json()) as { embeddings?: number[][] };
    const vec = body.embeddings?.[0];
    if (!Array.isArray(vec) || vec.length === 0 || typeof vec[0] !== 'number') {
      throw new EmbedderError('bad_response_shape');
    }
    return vec;
  }
}
