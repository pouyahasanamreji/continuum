import { Injectable } from '@nestjs/common';
import { OrchestratorDbService } from '../../../../../database/orchestrator-db.service';
import {
  WHITELISTED_SETTING_KEYS,
  WhitelistedSettingKey,
} from '../../../../app-settings.keys';
import { AppSettingsRepository } from '../../app-settings.repository';

@Injectable()
export class AppSettingsRelationalRepository extends AppSettingsRepository {
  constructor(private readonly dbs: OrchestratorDbService) {
    super();
  }

  getValue(key: WhitelistedSettingKey): string | null {
    const row = this.dbs.db
      .prepare<
        [string],
        { value: string }
      >('SELECT value FROM app_settings WHERE key = ?')
      .get(key);
    return row ? row.value : null;
  }

  setValue(key: WhitelistedSettingKey, value: string, now: number): void {
    this.dbs.db
      .prepare(
        'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ' +
          'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      )
      .run(key, value, now);
  }

  deleteValue(key: WhitelistedSettingKey): void {
    this.dbs.db.prepare('DELETE FROM app_settings WHERE key = ?').run(key);
  }

  applyPatch(
    patch: Partial<Record<WhitelistedSettingKey, string>>,
    now: number,
  ): void {
    const db = this.dbs.db;
    const tx = db.transaction(() => {
      for (const key of WHITELISTED_SETTING_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
        const value = patch[key];
        if (value === undefined) continue;
        if (value === '') {
          this.deleteValue(key);
        } else {
          this.setValue(key, value, now);
        }
      }
    });
    tx.immediate();
  }
}
