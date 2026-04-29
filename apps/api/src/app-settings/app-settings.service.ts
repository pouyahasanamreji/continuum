import { Injectable } from '@nestjs/common';
import {
  SETTING_ANTHROPIC_API_KEY,
  SETTING_ANTHROPIC_TOKENIZER_MODEL,
  SETTING_EMBEDDER_URL,
  WhitelistedSettingKey,
} from './app-settings.keys';
import { AppSettingsRepository } from './infrastructure/persistence/app-settings.repository';

@Injectable()
export class AppSettingsService {
  constructor(private readonly repo: AppSettingsRepository) {}

  resolve(key: WhitelistedSettingKey): string | null {
    const fromDb = this.repo.getValue(key);
    if (fromDb !== null && fromDb !== '') return fromDb;
    return process.env[key] ?? null;
  }

  readAllForPanel() {
    const apiKey = this.repo.getValue(SETTING_ANTHROPIC_API_KEY);
    const model = this.repo.getValue(SETTING_ANTHROPIC_TOKENIZER_MODEL);
    const embedderUrl = this.repo.getValue(SETTING_EMBEDDER_URL);
    return {
      anthropicApiKey: apiKey,
      anthropicTokenizerModel: model,
      embedderUrl,
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
      },
    };
  }

  applyPanelPatch(patch: {
    anthropicApiKey?: string;
    anthropicTokenizerModel?: string;
    embedderUrl?: string;
  }) {
    const mapped: Partial<Record<WhitelistedSettingKey, string>> = {};
    if (patch.anthropicApiKey !== undefined)
      mapped[SETTING_ANTHROPIC_API_KEY] = patch.anthropicApiKey;
    if (patch.anthropicTokenizerModel !== undefined)
      mapped[SETTING_ANTHROPIC_TOKENIZER_MODEL] = patch.anthropicTokenizerModel;
    if (patch.embedderUrl !== undefined)
      mapped[SETTING_EMBEDDER_URL] = patch.embedderUrl;
    this.repo.applyPatch(mapped, Date.now());
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
