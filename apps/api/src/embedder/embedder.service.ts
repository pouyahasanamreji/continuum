import { Injectable, Logger } from '@nestjs/common';
import { EmbedderError } from './embedder.error';
import { AppSettingsService } from '../app-settings/app-settings.service';
import {
  SETTING_EMBEDDER_MODEL,
  SETTING_EMBEDDER_URL,
} from '../app-settings/app-settings.keys';

const DEFAULT_MODEL = 'embeddinggemma';
const TIMEOUT_MS = 30_000;
const OPENAI_EMBEDDINGS_PATH = '/v1/embeddings';

type OllamaEmbeddingResponse = { embeddings?: unknown };
type OpenAiEmbeddingResponse = { data?: unknown };

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
      const openAiCompatible = this.isOpenAiEmbeddingsUrl(url);
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          openAiCompatible
            ? { model, input: text, encoding_format: 'float' }
            : { model, input: text },
        ),
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

    const body = (await response.json()) as unknown;
    const vec = this.isOpenAiEmbeddingsUrl(url)
      ? this.readOpenAiEmbedding(body)
      : this.readOllamaEmbedding(body);
    if (!this.isValidEmbedding(vec)) {
      throw new EmbedderError('bad_response_shape');
    }
    return vec;
  }

  private isOpenAiEmbeddingsUrl(url: string): boolean {
    try {
      const path = new URL(url).pathname.replace(/\/+$/, '');
      return path === OPENAI_EMBEDDINGS_PATH;
    } catch {
      const path = url.split(/[?#]/, 1)[0]?.replace(/\/+$/, '') ?? '';
      return path.endsWith(OPENAI_EMBEDDINGS_PATH);
    }
  }

  private readOpenAiEmbedding(body: unknown): unknown {
    const data = (body as OpenAiEmbeddingResponse | null)?.data;
    if (!Array.isArray(data)) return undefined;
    return (data[0] as { embedding?: unknown } | undefined)?.embedding;
  }

  private readOllamaEmbedding(body: unknown): unknown {
    const embeddings = (body as OllamaEmbeddingResponse | null)?.embeddings;
    if (!Array.isArray(embeddings)) return undefined;
    return embeddings[0];
  }

  private isValidEmbedding(vec: unknown): vec is number[] {
    return (
      Array.isArray(vec) &&
      vec.length > 0 &&
      vec.every((value) => typeof value === 'number')
    );
  }
}
