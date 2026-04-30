import { Injectable } from '@nestjs/common';
import {
  SETTING_ANTHROPIC_API_KEY,
  SETTING_ANTHROPIC_TOKENIZER_MODEL,
  SETTING_EMBEDDER_DIM,
  SETTING_EMBEDDER_MODEL,
  SETTING_EMBEDDER_URL,
  WhitelistedSettingKey,
} from './app-settings.keys';
import { AppSettingsRepository } from './infrastructure/persistence/app-settings.repository';
import {
  DEFAULT_EMBEDDER_DIM,
  DEFAULT_EMBEDDER_MODEL,
  makeEmbedderSignature,
  ResolvedEmbedderProfile,
} from '../embedder/embedder-profile';

@Injectable()
export class AppSettingsService {
  constructor(private readonly repo: AppSettingsRepository) {}

  resolve(key: WhitelistedSettingKey): string | null {
    const fromDb = this.repo.getValue(key);
    if (fromDb !== null && fromDb !== '') return fromDb;
    return process.env[key] ?? null;
  }

  resolveEmbedderProfile(): ResolvedEmbedderProfile {
    const url = this.resolve(SETTING_EMBEDDER_URL);
    const model =
      this.resolve(SETTING_EMBEDDER_MODEL) ?? DEFAULT_EMBEDDER_MODEL;
    const dim =
      this.parseDim(this.resolve(SETTING_EMBEDDER_DIM)) ?? DEFAULT_EMBEDDER_DIM;
    if (!url) {
      return {
        url: null,
        model,
        dim,
        configured: false,
        signature: null,
      };
    }
    return {
      url,
      model,
      dim,
      configured: true,
      signature: makeEmbedderSignature({ url, model, dim }),
    };
  }

  readAllForPanel() {
    const apiKey = this.repo.getValue(SETTING_ANTHROPIC_API_KEY);
    const model = this.repo.getValue(SETTING_ANTHROPIC_TOKENIZER_MODEL);
    const embedderUrl = this.repo.getValue(SETTING_EMBEDDER_URL);
    const embedderModel = this.repo.getValue(SETTING_EMBEDDER_MODEL);
    const embedderDimRaw = this.repo.getValue(SETTING_EMBEDDER_DIM);
    return {
      anthropicApiKey: apiKey,
      anthropicTokenizerModel: model,
      embedderUrl,
      embedderModel,
      embedderDim:
        this.parseDim(embedderDimRaw) ??
        this.parseDim(process.env.EMBEDDER_DIM ?? null),
      effective: {
        anthropicApiKey: this.sourceFor(
          apiKey,
          SETTING_ANTHROPIC_API_KEY,
          'unset',
        ),
        anthropicTokenizerModel: this.sourceFor(
          model,
          SETTING_ANTHROPIC_TOKENIZER_MODEL,
          'default',
        ),
        embedderUrl: this.sourceFor(embedderUrl, SETTING_EMBEDDER_URL, 'unset'),
        embedderModel: this.sourceFor(
          embedderModel,
          SETTING_EMBEDDER_MODEL,
          'default',
        ),
        embedderDim: this.sourceFor(
          embedderDimRaw,
          SETTING_EMBEDDER_DIM,
          'default',
        ),
      },
    };
  }

  applyPanelPatch(patch: {
    anthropicApiKey?: string;
    anthropicTokenizerModel?: string;
    embedderUrl?: string;
    embedderModel?: string;
    embedderDim?: number;
  }) {
    const mapped: Partial<Record<WhitelistedSettingKey, string>> = {};
    if (patch.anthropicApiKey !== undefined)
      mapped[SETTING_ANTHROPIC_API_KEY] = patch.anthropicApiKey;
    if (patch.anthropicTokenizerModel !== undefined)
      mapped[SETTING_ANTHROPIC_TOKENIZER_MODEL] = patch.anthropicTokenizerModel;
    if (patch.embedderUrl !== undefined)
      mapped[SETTING_EMBEDDER_URL] = patch.embedderUrl;
    if (patch.embedderModel !== undefined)
      mapped[SETTING_EMBEDDER_MODEL] = patch.embedderModel;
    if (patch.embedderDim !== undefined)
      mapped[SETTING_EMBEDDER_DIM] = String(patch.embedderDim);
    this.repo.applyPatch(mapped, Date.now());
  }

  private parseDim(raw: string | null): number | null {
    if (raw === null || raw === '') return null;
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n) || n < 1) return null;
    return n;
  }

  private sourceFor<F extends 'unset' | 'default'>(
    dbValue: string | null,
    key: WhitelistedSettingKey,
    fallback: F,
  ): 'db' | 'env' | F {
    if (dbValue !== null && dbValue !== '') return 'db';
    if (process.env[key]) return 'env';
    return fallback;
  }
}
